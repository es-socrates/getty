const WebSocket = require('ws');
const axios = require('axios');

function resolveWsFromClaimId(claimId) {
  try {
    const DEFAULT_WS_TEMPLATE = 'wss://ws-na1.odysee.com/commentron?id={claimId}';
    const tpl = process.env.ODYSEE_WS_TEMPLATE || DEFAULT_WS_TEMPLATE;
    if (typeof claimId !== 'string' || !claimId.trim()) return null;
    if (typeof tpl === 'string' && tpl.includes('{claimId}')) {
      return tpl.replace(/\{claimId\}/g, claimId.trim());
    }
  } catch {}
  return null;
}

class ChatNsManager {
  constructor(wss, store) {
    this.wss = wss;
    this.store = store;
    this.sessions = new Map();
    this.channelCache = new Map();
    this.CACHE_TTL_MS = 60 * 60 * 1000;
    this.__msgCounters = new Map();
  }

  _broadcast(ns, payload) {
    try {
      if (this.wss && typeof this.wss.broadcast === 'function') {
        this.wss.broadcast(ns, payload);
      }
    } catch {}
  }

  async _broadcastBoth(ns, payload) {
    try {
      this._broadcast(ns, payload);
      if (!this.store || !ns) return;

      let other = null;
      try {
        const adminOfNs = await this.store.get(ns, 'adminToken', null);
        const publicOfNs = await this.store.get(ns, 'publicToken', null);
        other = adminOfNs || publicOfNs || null;
      } catch {}
      if (other && other !== ns) this._broadcast(other, payload);
    } catch {}
  }

  async start(ns, chatUrlInput) {
    if (!ns || !chatUrlInput) return;

    if (process.env.NODE_ENV === 'test') {
      this.sessions.set(ns, { ws: null, url: chatUrlInput, connected: false, history: [] });
      this._broadcast(ns, { type: 'chatStatus', data: { connected: false } });
      return;
    }

    let url = chatUrlInput;
    if (typeof url === 'string' && !/^wss?:\/\//i.test(url)) {
      const maybe = resolveWsFromClaimId(url);
      if (maybe) url = maybe;
    }
    if (!/^wss?:\/\//i.test(url) || !url.includes('commentron')) return;

    await this.stop(ns);

    const ws = new WebSocket(url);
    const session = { ws, url, connected: false, history: [] };
    this.sessions.set(ns, session);

    ws.on('open', () => {
      session.connected = true;
      this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: true } });
      try { console.info('[chat-ns] connected', { ns: (ns||'').slice(0,6) + '…' }); } catch {}
    });
    ws.on('error', (err) => {
      session.connected = false;
      this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: false } });
      try { console.warn('[chat-ns] error', { ns: (ns||'').slice(0,6) + '…', error: err && err.message ? err.message : String(err) }); } catch {}
    });
    ws.on('close', () => {
      session.connected = false;
      this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: false } });
      try { console.info('[chat-ns] disconnected', { ns: (ns||'').slice(0,6) + '…' }); } catch {}

      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => {
          try { this.start(ns, url); } catch {}
        }, 5000);
      }
    });
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this._handleOdyseeMessage(ns, message);
      } catch {}
    });
  }

  async stop(ns) {
    const s = this.sessions.get(ns);
    if (!s) return;
    try { if (s.ws && s.ws.readyState === WebSocket.OPEN) s.ws.close(); } catch {}
    this.sessions.delete(ns);
  this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: false } });
  }

  getStatus(ns) {
    const s = this.sessions.get(ns);
    if (!s) return { connected: false };
    return { connected: !!s.connected, url: s.url };
  }

  dispose() {
    for (const ns of Array.from(this.sessions.keys())) {
      try { this.stop(ns); } catch {}
    }
    this.sessions.clear();
  }

  async _fetchChannelAvatar(claimId) {
    try {
      if (!claimId) return { avatar: null, title: null };
      if (process.env.NODE_ENV === 'test') return { avatar: null, title: null };

      const cached = this.channelCache.get(claimId);
      const now = Date.now();
      if (cached && (now - cached.ts) < this.CACHE_TTL_MS) {
        return { avatar: cached.avatar, title: cached.title };
      }

      const resp = await axios.post('https://api.na-backend.odysee.com/api/v1/proxy', {
        jsonrpc: '2.0',
        method: 'claim_search',
        params: { claim_id: claimId, page: 1, page_size: 1, no_totals: true },
        id: Date.now()
      }, { timeout: 5000 });

      const item = resp.data?.result?.items?.[0];
      if (!item) {
        const out = { avatar: null, title: null };
        this.channelCache.set(claimId, { ...out, ts: now });
        return out;
      }

      const thumbnailUrl = item.value?.thumbnail?.url || item.signing_channel?.value?.thumbnail?.url;
      const channelTitle = item.signing_channel?.value?.title || item.value?.title || null;

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

      const out = { avatar, title: channelTitle };
      this.channelCache.set(claimId, { ...out, ts: now });
      return out;
  } catch {
      try { this.channelCache.set(claimId, { avatar: null, title: null, ts: Date.now() }); } catch {}
      return { avatar: null, title: null };
    }
  }

  async _handleOdyseeMessage(ns, message) {
    if (message.type === 'delta' && message.data?.comment) {
      const comment = message.data.comment;
      const channelId = comment.channel_id || comment.channel_claim_id || '';
      let avatarUrl = null;
      let titleFromApi = null;
      if (channelId) {
        const info = await this._fetchChannelAvatar(channelId);
        avatarUrl = info.avatar;
        titleFromApi = info.title;
      }
      const chatMessage = {
        type: 'chatMessage',
        channelTitle: titleFromApi || comment.channel_name || 'Anonymous',
        message: comment.comment,
        credits: comment.support_amount || 0,
        creditsIsUsd: true,
        isChatTip: (comment.support_amount || 0) > 0,
        avatar: avatarUrl,
        timestamp: comment.timestamp || Date.now(),
        userId: comment.channel_id || comment.channel_claim_id || comment.channel_name,
        username: titleFromApi || comment.channel_name || 'Anonymous'
      };

      try {
        const raffle = global && global.gettyRaffleInstance ? global.gettyRaffleInstance : null;
        if (raffle && typeof raffle.getPublicState === 'function' && typeof raffle.addParticipant === 'function') {
          const st = raffle.getPublicState(ns);
          if (st && st.active && !st.paused && typeof st.command === 'string' && typeof chatMessage.message === 'string') {
            const msg = (chatMessage.message || '').trim().toLowerCase();
            const cmd = (st.command || '').trim().toLowerCase();
            const msgNorm = msg.replace(/^!+/, '');
            const cmdNorm = cmd.replace(/^!+/, '');
            if (msgNorm && cmdNorm && msgNorm === cmdNorm) {
              try {
                const added = raffle.addParticipant(ns, chatMessage.username, chatMessage.userId);
                if (added) {
                  try { console.info('[giveaway] participant added', { user: chatMessage.username }); } catch {}
                  try { this._broadcastBoth(ns, { type: 'raffle_state', ...raffle.getPublicState(ns) }); } catch {}
                }
              } catch {}
            }
          }
        }
      } catch {}

      this._broadcastBoth(ns, { type: 'chatMessage', data: chatMessage });
      try {
        const s = this.sessions.get(ns);
        if (s && Array.isArray(s.history)) {
          s.history.push(chatMessage);
          if (s.history.length > 200) s.history.shift();
        }
      } catch {}
      try {
        const key = String(ns);
        const prev = this.__msgCounters.get(key) || 0;
        const next = prev + 1;
        this.__msgCounters.set(key, next);
        if (next % 25 === 0) {
          console.info('[chat-ns] messages', { ns: (ns||'').slice(0,6) + '…', count: next });
        }
      } catch {}

      if (chatMessage.credits > 0) {
        const tipData = {
          from: chatMessage.channelTitle || 'Anonymous',
          amount: chatMessage.credits,
          message: chatMessage.message || '',
          source: 'chat',
          timestamp: chatMessage.timestamp || new Date().toISOString(),
          creditsIsUsd: true,
          isChatTip: true
        };
        try {
          if (this.wss && typeof this.wss.emit === 'function') this.wss.emit('tip', tipData, ns);
          console.info('[chat-ns] tip', { ns: (ns||'').slice(0,6) + '…', amount: tipData.amount });
        } catch {}
      }
    }
  }

  getHistory(ns) {
    try {
      const s = this.sessions.get(ns);
      if (!s || !Array.isArray(s.history)) return [];
      return s.history.slice();
    } catch { return []; }
  }
}

module.exports = ChatNsManager;
