const WebSocket = require('ws');
const axios = require('axios');
const Logger = {
  debug: (...args) => { if (process.env.GETTY_VERBOSE_BROADCAST === '1') console.warn('[DEBUG]', ...args); },
  info: (...args) => console.warn('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const DEFAULT_WS_TEMPLATE = 'wss://ws-na1.odysee.com/commentron?id={claimId}';
function resolveWsFromClaimId(claimId) {
  try {
    if (process.env.NODE_ENV === 'test') return null;
    const tpl = process.env.ODYSEE_WS_TEMPLATE || DEFAULT_WS_TEMPLATE;
    if (typeof claimId !== 'string' || !claimId.trim()) return null;
    if (typeof tpl === 'string' && tpl.includes('{claimId}')) {
      return tpl.replace(/\{claimId\}/g, claimId.trim());
    }
  } catch { /* noop */ }
  return null;
}

class ChatModule {
  constructor(wss) {
    this.wss = wss;
    this.API_ENDPOINT = 'https://api.na-backend.odysee.com/api/v1/proxy';
    this.chatUrl = process.env.ODYSEE_WS_URL;
    this.ws = null;
    this.history = [];
    this.MAX_HISTORY = 100;
    this._reconnectTimer = null;
    this._reconnectDelayMs = 5000;
    
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }
  
  init() {
    if (process.env.REDIS_URL) {
      console.warn('[Chat] Hosted mode detected; global chat relay disabled to prevent cross-session leaks');
      return;
    }
    if (this.chatUrl) {
      this.connect(this.chatUrl);
    }
  }
  
  connect(websocketUrl) {
    if (!websocketUrl || !websocketUrl.includes('commentron')) {
      console.error('Invalid WebSocket URL');
      return;
    }

  console.warn(`[Chat] Connecting to: ${websocketUrl}`);

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          Logger.warn('[Chat] Connection is in progress; skipping duplicate connect');
          return;
        } else if (this.ws.readyState === WebSocket.CLOSING) {
          Logger.warn('[Chat] Socket is closing; will retry shortly');
          if (!this._reconnectTimer && process.env.NODE_ENV !== 'test') {
            this._reconnectTimer = setTimeout(() => {
              this._reconnectTimer = null;
              this.connect(websocketUrl);
            }, 1000);
          }
          return;
        }
      } catch {}
    }

    const originHeader = process.env.ODYSEE_WS_ORIGIN || 'https://odysee.com';
    this.ws = new WebSocket(websocketUrl, { headers: { Origin: originHeader } });
    this.chatUrl = websocketUrl;

    this.ws.on('open', () => {
      console.warn('[Chat] Connection established with Odysee chat');
      this.notifyStatus(true);
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket Error:', error);
      this.notifyStatus(false);
    });

    this.ws.on('close', () => {
      console.warn('[Chat] Connection closed, reconnecting...');
      this.notifyStatus(false);
      if (process.env.NODE_ENV !== 'test' && !this._reconnectTimer && this.chatUrl) {
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = null;
          this.connect(this.chatUrl);
        }, this._reconnectDelayMs);
      }
    });

    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await this.handleOdyseeMessage(message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
  }
  
  async handleOdyseeMessage(message) {
    if (message.type === 'delta' && message.data?.comment) {
      const comment = message.data.comment;
      let avatarUrl = null;
      let channelTitle = null;
      const claimId = comment.channel_id || comment.channel_claim_id;

      if (claimId) {
        try {
          const { avatar, title } = await this.fetchChannelAvatar(claimId);
          avatarUrl = avatar;
          channelTitle = title;
        } catch (e) {
          console.error('Error getting avatar for claim:', claimId, e.message);
          avatarUrl = null;
          channelTitle = null;
        }
      }

      const chatMessage = {
        type: 'chatMessage',
        channelTitle: channelTitle || comment.channel_name || 'Anonymous',
        message: comment.comment,
        credits: comment.support_amount || 0,
        creditsIsUsd: true,
        isChatTip: (comment.support_amount || 0) > 0,
        avatar: avatarUrl,
        timestamp: comment.timestamp || Date.now(),
        userId: comment.channel_id || comment.channel_claim_id || comment.channel_name,
        username: channelTitle || comment.channel_name || 'Anonymous'
      };

      try {
        const raffle = global.gettyRaffleInstance;
        if (raffle && typeof raffle.getPublicState === 'function' && typeof raffle.addParticipant === 'function') {
          const incomingMsg = (chatMessage.message || '').trim().toLowerCase();
          const incomingNorm = incomingMsg.replace(/^!+/, '');
          let targetNs = null;

          let state = await raffle.getPublicState(targetNs);

          if (!(state && state.active && !state.paused)) {
            try {
              if (typeof raffle.getActiveNamespaces === 'function') {
                const actives = raffle.getActiveNamespaces();
                for (const nsKey of actives) {
                  const st = await raffle.getPublicState(nsKey);
                  if (!st || !st.active || st.paused || typeof st.command !== 'string') continue;
                  const cmdNorm = (st.command || '').trim().toLowerCase().replace(/^!+/, '');
                  if (incomingNorm && cmdNorm && incomingNorm === cmdNorm) {
                    targetNs = nsKey === '__global__' ? null : nsKey;
                    state = st;
                    break;
                  }
                }
              }
            } catch {}
          }
          if (state && state.active && !state.paused && typeof state.command === 'string') {
            const cmdNorm = (state.command || '').trim().toLowerCase().replace(/^!+/, '');
            if (incomingNorm && cmdNorm && incomingNorm === cmdNorm) {
              const added = await raffle.addParticipant(targetNs, chatMessage.username, chatMessage.userId);
              if (added) {
                Logger.info(`[Giveaway] New participant: ${chatMessage.username}${targetNs ? ' ns=' + targetNs.slice(0,6)+'…' : ''}`);
                try {
                  const newState = await raffle.getPublicState(targetNs);
                  if (this.wss && typeof this.wss.broadcast === 'function') {
                    this.wss.broadcast(targetNs, { type: 'raffle_state', ...newState });
                  } else if (this.wss && this.wss.clients) {
                    const payload = JSON.stringify({ type: 'raffle_state', ...newState });
                    this.wss.clients.forEach(c => { try { if (c.readyState === 1 && (!targetNs || c.nsToken === targetNs)) c.send(payload); } catch {} });
                  }
                } catch {}
              }
            }
          }
        }
      } catch (err) {
        Logger.error('[Giveaway] Error trying to add participant:', err);
      }

      this.history.push(chatMessage);
      if (this.history.length > this.MAX_HISTORY) {
        this.history.shift();
      }
      this.notifyFrontend(chatMessage);

      try {
        if (global && global.gettyAchievementsInstance && typeof global.gettyAchievementsInstance.onChatMessage === 'function') {
          global.gettyAchievementsInstance.onChatMessage(null, chatMessage);
        }
      } catch {}
    }
  }
  
  async fetchChannelAvatar(claimId) {
    try {
      const response = await axios.post(this.API_ENDPOINT, {
        jsonrpc: '2.0',
        method: 'claim_search',
        params: {
          claim_id: claimId,
          page: 1,
          page_size: 1,
          no_totals: true
        },
        id: Date.now()
      });

      const channelData = response.data.result?.items?.[0];
      if (!channelData) return { avatar: null, title: null };

      const thumbnailUrl = channelData.value?.thumbnail?.url || 
                      channelData.signing_channel?.value?.thumbnail?.url;

      const channelTitle = channelData.signing_channel?.value?.title
          || channelData.value?.title
          || null;

      let avatar = null;
      if (thumbnailUrl) {
        if (thumbnailUrl.startsWith('http')) {
          avatar = thumbnailUrl.includes('thumbnails.odycdn.com') 
              ? thumbnailUrl.replace('s=85', 's=256')
              : thumbnailUrl;
        } else {
          avatar = thumbnailUrl.startsWith('/')
              ? `https://thumbnails.odycdn.com${thumbnailUrl}`
              : `https://thumbnails.odycdn.com/${thumbnailUrl}`;
          avatar = avatar.replace('s=85', 's=256');
        }
      }

      return { avatar, title: channelTitle };
    } catch (error) {
      console.error(`Error getting avatar for claim ${claimId}:`, error.message);
      return { avatar: null, title: null };
    }
  }
  
  notifyFrontend(data) {
      this.wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                  type: 'chatMessage',
                  data: data
              }));
          }
      });

      if (data.credits > 0) {
          try {
              const tipData = {
                  from: data.channelName || data.channelTitle || 'Anonymous',
                  amount: data.credits,
                  message: data.message || '',
                  source: 'chat',
                  timestamp: data.timestamp || new Date().toISOString(),
                  creditsIsUsd: true,
                  isChatTip: true
              };

              if (this.wss && typeof this.wss.emit === 'function') {
                  try {
                    const ns = null;
                    this.wss.emit('tip', tipData, ns);
                  } catch {}
                  Logger.debug('Chat tip event emitted', tipData);
              }
          } catch (error) {
              Logger.error('Error emitting chat tip:', error);
          }
      }
  }
  
  notifyStatus(connected) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'chatStatus',
          data: { connected }
        }));
      }
    });
  }
  
  updateChatUrl(newUrl) {
    if (process.env.REDIS_URL) {
      this.chatUrl = newUrl;
      return this.getStatus();
    }
    this.chatUrl = newUrl;

    let effectiveUrl = newUrl;
    if (typeof newUrl === 'string' && !/^wss?:\/\//i.test(newUrl)) {
      const maybe = resolveWsFromClaimId(newUrl);
      if (maybe) effectiveUrl = maybe;
    }

    process.env.ODYSEE_WS_URL = (typeof effectiveUrl === 'string' && /^wss?:\/\//i.test(effectiveUrl)) ? effectiveUrl : newUrl;

    if (
      process.env.NODE_ENV !== 'test' &&
      typeof effectiveUrl === 'string' &&
      /^wss?:\/\//i.test(effectiveUrl) &&
      effectiveUrl.includes('commentron')
    ) {
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      this.connect(effectiveUrl);
    }
    return this.getStatus();
  }
  
  getHistory() {
    return this.history.slice(-this.MAX_HISTORY);
  }
  
  getStatus() {
    return {
      active: !!this.chatUrl,
      connected: this.ws?.readyState === WebSocket.OPEN,
      chatUrl: this.chatUrl,
      historySize: this.history.length,
      lastMessage: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
    };
  }
}

module.exports = ChatModule;
