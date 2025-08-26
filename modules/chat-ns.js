const WebSocket = require('ws');

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
    });
    ws.on('error', () => {
      session.connected = false;
      this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: false } });
    });
    ws.on('close', () => {
      session.connected = false;
      this._broadcastBoth(ns, { type: 'chatStatus', data: { connected: false } });

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

  _handleOdyseeMessage(ns, message) {
    if (message.type === 'delta' && message.data?.comment) {
      const comment = message.data.comment;
      const chatMessage = {
        type: 'chatMessage',
        channelTitle: comment.channel_name || 'Anonymous',
        message: comment.comment,
        credits: comment.support_amount || 0,
        avatar: null,
        timestamp: comment.timestamp || Date.now(),
        userId: comment.channel_id || comment.channel_claim_id || comment.channel_name,
        username: comment.channel_name || 'Anonymous'
      };

  this._broadcastBoth(ns, { type: 'chatMessage', data: chatMessage });

      if (chatMessage.credits > 0) {
        const tipData = {
          from: chatMessage.channelTitle || 'Anonymous',
          amount: chatMessage.credits,
          message: chatMessage.message || '',
          source: 'chat',
          timestamp: chatMessage.timestamp || new Date().toISOString()
        };
        try { if (this.wss && typeof this.wss.emit === 'function') this.wss.emit('tip', tipData, ns); } catch {}
      }
    }
  }
}

module.exports = ChatNsManager;
