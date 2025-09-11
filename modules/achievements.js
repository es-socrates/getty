const fs = require('fs');
const path = require('path');
const LanguageConfig = require('./language-config');

class AchievementsModule {
  constructor(wss, opts = {}) {
    this.wss = wss;
    this.store = opts.store || null;
    this.liveviewsCfgFile = opts.liveviewsCfgFile || path.join(process.cwd(), 'config', 'liveviews-config.json');
    this.configFile = opts.configFile || path.join(process.cwd(), 'config', 'achievements-config.json');
    this.stateFile = opts.stateFile || path.join(process.cwd(), 'data', 'achievements-state.json');
    this.namespaced = !!this.store;
    this.languageConfig = new LanguageConfig();

    this._i18nCache = { en: null, es: null };

    this.state = {

    };

    try { fs.mkdirSync(path.dirname(this.stateFile), { recursive: true }); } catch {}
    this._loadStateFromDisk();
  }

  loadConfig(ns = null) {
    try {
      if (this.namespaced && ns) return this.store.get(ns, 'achievements-config', null);
      if (!fs.existsSync(this.configFile)) return null;
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch { return null; }
  }
  async saveConfig(ns, cfg) {
    try {
      const sane = this._withDefaults(cfg);
      if (this.namespaced && ns) {
        await this.store.set(ns, 'achievements-config', sane);
        return true;
      }
      fs.writeFileSync(this.configFile, JSON.stringify(sane, null, 2));
      return true;
    } catch { return false; }
  }
  _withDefaults(partial) {
    const p = partial || {};
    return {
      enabled: !!p.enabled,
      claimid: typeof p.claimid === 'string' ? p.claimid.trim() : '',
      theme: typeof p.theme === 'string' ? p.theme : 'light',
      position: typeof p.position === 'string' ? p.position : 'top-right',
      color: typeof p.color === 'string' ? p.color : '#0b1220',
      sound: { enabled: !!(p.sound?.enabled), url: (p.sound?.url || ''), volume: Number(p.sound?.volume || 0.5) },
      dnd: !!p.dnd,
      historySize: Number(p.historySize || 10)
    };
  }

  _loadStateFromDisk() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        this.state = raw || {};
      }
    } catch { this.state = {}; }
  }
  _saveStateToDisk() {
    try {
      const out = {};
      for (const [key, bagAny] of Object.entries(this.state || {})) {
        const bag = bagAny || {};
        const completed = Array.isArray(bag.completed)
          ? bag.completed
          : Array.from((bag._completedSet instanceof Set) ? bag._completedSet : new Set());
        out[key] = {
          completed,
          progress: bag.progress || {},
          notifications: Array.isArray(bag.notifications) ? bag.notifications : []
        };
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(out, null, 2));
    } catch {}
  }

  _loadI18n(lang) {
    try {
      const safe = (lang === 'es') ? 'es' : 'en';
      if (this._i18nCache[safe]) return this._i18nCache[safe];
      const file = path.join(process.cwd(), 'shared-i18n', `${safe}.json`);
      const obj = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      this._i18nCache[safe] = obj || {};
      return this._i18nCache[safe];
    } catch { return {}; }
  }
  _t(lang, key, fallback = '') {
    try {
      const i18n = this._loadI18n(lang);
      const en = this._loadI18n('en');
      return (i18n && i18n[key]) || (en && en[key]) || fallback || key;
    } catch { return fallback || key; }
  }

  _getNs(ns) {
    const key = ns || '__global__';
    if (!this.state[key]) {
      this.state[key] = { completed: [], progress: {}, notifications: [] };
    }

    const bag = this.state[key];
    if (!(bag._completedSet instanceof Set)) {
      bag._completedSet = new Set(Array.isArray(bag.completed) ? bag.completed : []);
    }
    if (!bag.progress) bag.progress = {};
    if (!Array.isArray(bag.notifications)) bag.notifications = [];
    return bag;
  }

  resetAchievement(ns, id) {
    const bag = this._getNs(ns);

    if (bag._completedSet.has(id)) {
      bag._completedSet.delete(id);
      bag.completed = Array.from(bag._completedSet);
    }

    try {
      if (Array.isArray(bag.notifications) && bag.notifications.length) {
        bag.notifications = bag.notifications.filter(n => n && n.id !== id);
      }
    } catch {}

    try {
      const defs = this.getDefinitions();
      const def = Array.isArray(defs) ? defs.find(d => d && d.id === id) : null;
      if (def && def.metric) {
        const m = def.metric;
        if (m === 'chatMsgsSession') {
          bag.progress.chatMsgsSession = 0;
        } else if (m === 'chatActiveSenders') {
          bag.progress.chatActiveSenders = 0;
          bag.progress.chatSenders = {};
        } else if (m === 'tipCountSession') {
          bag.progress.tipCountSession = 0;
        } else if (m === 'tipUsdSession') {
          bag.progress.tipUsdSession = 0;
        } else if (m === 'tipBiggestUsd') {
          bag.progress.tipBiggestUsd = 0;
        } else if (m === 'viewersPeak') {
          bag.progress.viewersPeak = 0;
        } else {
          bag.progress[m] = 0;
        }
      }
    } catch {}

  this._saveStateToDisk();

  try { this._broadcast(ns, { type: 'achievement-clear', data: { id } }); } catch {}
  }

  onTip(ns, tip) {
    try {
      const bag = this._getNs(ns);
      const usd = Number(tip.usd || tip.amount || 0) || 0;
      bag.progress.tipCountSession = (bag.progress.tipCountSession || 0) + 1;
      bag.progress.tipUsdSession = (bag.progress.tipUsdSession || 0) + usd;
      bag.progress.tipBiggestUsd = Math.max(Number(bag.progress.tipBiggestUsd || 0), usd);
      this._evaluateAll(ns);
    } catch {}
  }
  onChatMessage(ns, msg) {
    try {
      const bag = this._getNs(ns);
      bag.progress.chatMsgsSession = (bag.progress.chatMsgsSession || 0) + 1;
      const user = (msg && (msg.channelTitle || msg.username || msg.user || '')) + '';
      if (!bag.progress.chatSenders) bag.progress.chatSenders = {};
      if (user) bag.progress.chatSenders[user] = true;
      bag.progress.chatActiveSenders = Object.keys(bag.progress.chatSenders).length;
      this._evaluateAll(ns);
    } catch {}
  }
  onViewerSample(ns, count) {
    try {
      const bag = this._getNs(ns);
      bag.progress.viewersPeak = Math.max(Number(bag.progress.viewersPeak || 0), Number(count || 0));
      this._evaluateAll(ns);
    } catch {}
  }

  getDefinitions() {

    return [
      { id: 'v_5', category: 'viewers', titleKey: 'ach.def.v_5.title', descKey: 'ach.def.v_5.desc', target: 5, metric: 'viewersPeak' },
      { id: 'v_20avg', category: 'viewers', titleKey: 'ach.def.v_20avg.title', descKey: 'ach.def.v_20avg.desc', target: 20, metric: 'viewersPeak' },
      { id: 'v_30simul', category: 'viewers', titleKey: 'ach.def.v_30simul.title', descKey: 'ach.def.v_30simul.desc', target: 30, metric: 'viewersPeak' },
      { id: 'v_50x5', category: 'viewers', titleKey: 'ach.def.v_50x5.title', descKey: 'ach.def.v_50x5.desc', target: 50, metric: 'viewersPeak' },
      { id: 'v_100break', category: 'viewers', titleKey: 'ach.def.v_100break.title', descKey: 'ach.def.v_100break.desc', target: 100, metric: 'viewersPeak' },
      { id: 'v_500break', category: 'viewers', titleKey: 'ach.def.v_500break.title', descKey: 'ach.def.v_500break.desc', target: 500, metric: 'viewersPeak' },

      { id: 'c_10msg', category: 'chat', titleKey: 'ach.def.c_10msg.title', descKey: 'ach.def.c_10msg.desc', target: 10, metric: 'chatMsgsSession' },
      { id: 'c_50msg', category: 'chat', titleKey: 'ach.def.c_50msg.title', descKey: 'ach.def.c_50msg.desc', target: 50, metric: 'chatMsgsSession' },
      { id: 'c_5people', category: 'chat', titleKey: 'ach.def.c_5people.title', descKey: 'ach.def.c_5people.desc', target: 5, metric: 'chatActiveSenders' },
      { id: 'c_20people', category: 'chat', titleKey: 'ach.def.c_20people.title', descKey: 'ach.def.c_20people.desc', target: 20, metric: 'chatActiveSenders' },

      { id: 't_first', category: 'tips', titleKey: 'ach.def.t_first.title', descKey: 'ach.def.t_first.desc', target: 1, metric: 'tipCountSession' },
      { id: 't_100usd', category: 'tips', titleKey: 'ach.def.t_100usd.title', descKey: 'ach.def.t_100usd.desc', target: 100, metric: 'tipUsdSession' },
      { id: 't_5in1', category: 'tips', titleKey: 'ach.def.t_5in1.title', descKey: 'ach.def.t_5in1.desc', target: 5, metric: 'tipCountSession' },
      { id: 't_50one', category: 'tips', titleKey: 'ach.def.t_50one.title', descKey: 'ach.def.t_50one.desc', target: 50, metric: 'tipBiggestUsd' },
  { id: 't_1000usd', category: 'tips', titleKey: 'ach.def.t_1000usd.title', descKey: 'ach.def.t_1000usd.desc', target: 1000, metric: 'tipUsdSession' },
  { id: 't_20000usd', category: 'tips', titleKey: 'ach.def.t_20000usd.title', descKey: 'ach.def.t_20000usd.desc', target: 20000, metric: 'tipUsdSession' },
    ];
  }

  _evaluateAll(ns) {
    const bag = this._getNs(ns);
    const defs = this.getDefinitions();
    const lang = (function getLang(self){ try { return self.languageConfig.getLanguage(); } catch { return 'en'; } })(this);
    const now = Date.now();
    for (const d of defs) {
      if (bag._completedSet.has(d.id)) continue;
      const cur = Number(bag.progress[d.metric] || 0);
      const prog = Math.min(cur / (d.target || 1), 1);
      if (prog >= 1) {
        bag._completedSet.add(d.id);
        bag.completed = Array.from(bag._completedSet);
        const notif = {
          id: d.id,
          title: this._t(lang, d.titleKey, ''),
          desc: this._t(lang, d.descKey, ''),
          titleKey: d.titleKey,
          descKey: d.descKey,
          category: d.category,
          ts: now
        };
        const cfg = this._coerceConfigSync(ns);
        if (!cfg.dnd) this._broadcast(ns, { type: 'achievement', data: notif });
        bag.notifications.push(notif);
        const maxHist = Math.max(1, Math.min(Number(cfg.historySize || 10), 100));
        if (bag.notifications.length > maxHist) bag.notifications.splice(0, bag.notifications.length - maxHist);
        this._saveStateToDisk();
      }
    }
  }

  _broadcast(ns, payload) {
    try {
      if (typeof this.wss.broadcast === 'function') {
        this.wss.broadcast(ns || null, payload);
        return;
      }
      this.wss.clients.forEach(c => {
        if (c && c.readyState === 1) c.send(JSON.stringify(payload));
      });
    } catch {}
  }

  async getStatus(ns) {
    const bag = this._getNs(ns);
    const defs = this.getDefinitions();
    const lang = (function getLang(self){ try { return self.languageConfig.getLanguage(); } catch { return 'en'; } })(this);
    const items = defs.map(d => {
      const cur = Number(bag.progress[d.metric] || 0);
      const pct = Math.min(100, Math.floor((cur / (d.target || 1)) * 100));
      const done = (bag._completedSet.has(d.id));
      return {
        id: d.id,
        title: this._t(lang, d.titleKey, ''),
        desc: this._t(lang, d.descKey, ''),
        titleKey: d.titleKey,
        descKey: d.descKey,
        category: d.category,
        progress: { current: cur, target: d.target, percent: pct },
        completed: done
      };
    });
    return { items, completedIds: Array.from(bag._completedSet), notifications: bag.notifications.slice(-20) };
  }

  async getConfigEffective(ns) {
    const raw = await this.loadConfig(ns);
    return this._withDefaults(raw || {});
  }

  async pollViewersOnce(ns) {
    try {
      const cfg = await this.getConfigEffective(ns);
      const claim = cfg.claimid || this._readClaimFromFile();
      if (!claim) return;
      const axios = require('axios');
      const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claim)}`;
      const resp = await axios.get(url, { timeout: 5000 });
      const viewers = Number(resp?.data?.data?.ViewerCount || 0) || 0;
      this.onViewerSample(ns, viewers);
    } catch {}
  }

  _readClaimFromFile() {
    try {
      if (!fs.existsSync(this.liveviewsCfgFile)) return '';
      const raw = JSON.parse(fs.readFileSync(this.liveviewsCfgFile, 'utf8'));
      return (typeof raw.claimid === 'string') ? raw.claimid.trim() : '';
    } catch { return ''; }
  }

  _coerceConfigSync(ns) {
    try { const v = this.loadConfig(ns); if (v && typeof v.then === 'function') return this._withDefaults(null); } catch {}
    try {
      if (this.namespaced || ns) return this._withDefaults({});
      if (fs.existsSync(this.configFile)) return this._withDefaults(JSON.parse(fs.readFileSync(this.configFile, 'utf8')));
    } catch {}
    return this._withDefaults({});
  }
}

module.exports = { AchievementsModule };
