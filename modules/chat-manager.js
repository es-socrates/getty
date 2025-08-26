const ChatModule = require('./chat');

class ChatManager {
  constructor(wss) {
    this.wss = wss;
    this.instances = new Map();
    this.global = new ChatModule(wss, null);
  }

  _get(ns) {
    if (!ns) return this.global;
    if (!this.instances.has(ns)) {
      const inst = new ChatModule(this.wss, ns);
      this.instances.set(ns, inst);
    }
    return this.instances.get(ns);
  }

  updateChatUrl(url, ns = null) {
    return this._get(ns).updateChatUrl(url);
  }

  getHistory(ns = null) {
    if (ns) return this._get(ns).getHistory();
    const all = [this.global, ...this.instances.values()].flatMap(m => m.getHistory());
    return all.slice(-100);
  }

  getStatus(ns = null) {
    if (ns) return this._get(ns).getStatus();
    return this.global.getStatus();
  }
}

module.exports = ChatManager;
