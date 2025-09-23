/* eslint-env node, jest */
const { EventEmitter } = require('events');

const servers = [];

class WebSocketClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;

    try {
      const u = new URL(url);
      const ns = u.searchParams.get('ns');
      if (ns) this.nsToken = ns;
    } catch {}
    setTimeout(() => {
      this.readyState = 1;
      servers.forEach(s => {
        if (!s.clients.has(this)) {
          s.clients.add(this);
          s.emit('connection', this, { url });
        }
      });
      this.emit('open');
    }, 0);
  }
  send(data) {
    if (this.readyState !== 1) return;
    console.warn('[mock][send] emitting message to client with nsToken:', this.nsToken, 'data:', data);
    const messageData = typeof data === 'string' ? data : String(data);
    this.emit('message', messageData);
    // Also send to server ws with matching nsToken
    if (this.nsToken) {
      servers.forEach(server => {
        server.clients.forEach(client => {
          if (client.nsToken === this.nsToken) {
            client.emit('message', messageData);
          }
        });
      });
    }
  }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.emit('close'); }
}

class Server extends EventEmitter {
  constructor() { super(); this.clients = new Set(); servers.push(this); }
  handleUpgrade(req, _socket, _head, cb) {
    console.warn('[mock][handleUpgrade] called');
    const client = new WebSocketClient(req?.url || 'ws://test');
    client.readyState = 1;

    try {
      const url = new URL(req.url, 'http://localhost');
      const ns = url.searchParams.get('ns');
      if (ns) client.nsToken = ns;
    } catch {}
    if (!this.clients.has(client)) this.clients.add(client);
    if (cb) cb(client);
  }
  close() {
    this.clients.forEach(c => { try { c.close(); } catch { /* ignore client close */ } });
    const idx = servers.indexOf(this);
    if (idx !== -1) servers.splice(idx, 1);
    this.emit('close');
  }
  broadcast(data) { this.clients.forEach(c => { try { c.send(data); } catch { /* ignore send */ } }); }
}

WebSocketClient.Server = Server;
WebSocketClient.OPEN = 1;
WebSocketClient.CLOSED = 3;
WebSocketClient.__reset = () => {
  while (servers.length) {
    try { servers[0].close(); } catch { /* ignore */ }
  }
};

module.exports = WebSocketClient;
