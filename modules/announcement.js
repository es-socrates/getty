const fs = require('fs');
const path = require('path');
const makeLogger = require('../lib/logger');
const log = makeLogger('announcement');

const CONFIG_FILE = (process.env.NODE_ENV === 'test')
  ? path.join(process.cwd(), 'config', 'announcement-config.test.json')
  : path.join(process.cwd(), 'config', 'announcement-config.json');
const { saveTenantConfig, loadTenantConfig } = require('../lib/tenant-config');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'announcement');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        messages: Array.isArray(raw.messages) ? raw.messages : [],
        cooldownSeconds: Number(raw.cooldownSeconds) > 0 ? Number(raw.cooldownSeconds) : 300,
        theme: 'horizontal',
        bgColor: typeof raw.bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.bgColor) ? raw.bgColor : '#0e1014',
        textColor: typeof raw.textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.textColor) ? raw.textColor : '#e8eef2',
        animationMode: ['fade','slide-up','slide-left','scale','random'].includes(raw.animationMode) ? raw.animationMode : 'fade',
        defaultDurationSeconds: (Number(raw.defaultDurationSeconds) >=1 && Number(raw.defaultDurationSeconds) <=60) ? Number(raw.defaultDurationSeconds) : 10,
        staticMode: raw.staticMode === true,
        bannerBgType: (raw.bannerBgType === 'gradient' || raw.bannerBgType === 'solid') ? raw.bannerBgType : 'solid',
        gradientFrom: (typeof raw.gradientFrom === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.gradientFrom)) ? raw.gradientFrom : '#4f36ff',
        gradientTo: (typeof raw.gradientTo === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.gradientTo)) ? raw.gradientTo : '#10d39e'
      };
    }
  } catch (e) {
    log.error('loadConfig error %s', e.message);
  }
  return { messages: [], cooldownSeconds: 300, theme: 'horizontal', bgColor: '#0e1014', textColor: '#e8eef2', animationMode: 'fade', defaultDurationSeconds: 10, staticMode: false, bannerBgType: 'solid', gradientFrom: '#4f36ff', gradientTo: '#10d39e' };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    log.error('saveConfig error %s', e.message);
    return false;
  }
}

class AnnouncementModule {
  constructor(wss, opts = {}) {
    this.wss = wss;
    this.store = opts.store || null;

    this.state = loadConfig();

    this._states = new Map();
    this._timers = new Map();
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    if (process.env.NODE_ENV !== 'test') {
      this.start();
    }
  }

  async _getState(ns) {
    if (!ns) return this.state;
    if (this._states.has(ns)) return this._states.get(ns);
    let st = null;
    if (this.store) {
      try {
        const j = await this.store.getConfig(ns, 'announcement-config.json', null) || await this.store.get(ns, 'announcement-config', null);
        if (j && typeof j === 'object') st = this._normalizeState(j.data ? j.data : j);
      } catch {}

      if (!st) {
        try {
          const globalPath = CONFIG_FILE;
          const lt = await loadTenantConfig({ ns: { admin: ns } }, this.store, globalPath, 'announcement-config.json');
          if (lt && lt.data) {
            const raw = lt.data.data ? lt.data.data : lt.data;
            if (raw && typeof raw === 'object') st = this._normalizeState(raw);
          }
        } catch {}
      }
    }
    if (!st) st = this._normalizeState({});
    this._states.set(ns, st);
    return st;
  }

  _normalizeState(raw) {
    try {
      return {
        messages: Array.isArray(raw.messages) ? raw.messages : [],
        cooldownSeconds: Number(raw.cooldownSeconds) > 0 ? Number(raw.cooldownSeconds) : 300,
        theme: 'horizontal',
        bgColor: typeof raw.bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.bgColor) ? raw.bgColor : '#0e1014',
        textColor: typeof raw.textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.textColor) ? raw.textColor : '#e8eef2',
        animationMode: ['fade','slide-up','slide-left','scale','random'].includes(raw.animationMode) ? raw.animationMode : 'fade',
        defaultDurationSeconds: (Number(raw.defaultDurationSeconds) >=1 && Number(raw.defaultDurationSeconds) <=60) ? Number(raw.defaultDurationSeconds) : 10,
        staticMode: raw.staticMode === true,
        bannerBgType: (raw.bannerBgType === 'gradient' || raw.bannerBgType === 'solid') ? raw.bannerBgType : 'solid',
        gradientFrom: (typeof raw.gradientFrom === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.gradientFrom)) ? raw.gradientFrom : '#4f36ff',
        gradientTo: (typeof raw.gradientTo === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.gradientTo)) ? raw.gradientTo : '#10d39e'
      };
    } catch { return { messages: [], cooldownSeconds: 300, theme: 'horizontal', bgColor: '#0e1014', textColor: '#e8eef2', animationMode: 'fade', defaultDurationSeconds: 10, staticMode: false, bannerBgType: 'solid', gradientFrom: '#4f36ff', gradientTo: '#10d39e' }; }
  }

  async _saveState(ns, st) {
    if (!ns) {
      this.state = st;
      saveConfig(st);
      return true;
    }
    this._states.set(ns, st);
    if (this.store) {
      try {
        await this.store.setConfig(ns, 'announcement-config.json', st);

        await saveTenantConfig({ ns: { admin: ns } }, this.store, CONFIG_FILE, 'announcement-config.json', st);
      } catch {}
    }
    return true;
  }

  start(ns = null) {
    this.stop(ns);
    if (process.env.NODE_ENV === 'test') return;
    this.scheduleNext(ns);
  }

  stop(ns = null) {
    if (ns) {
      const t = this._timers.get(ns);
      if (t) clearTimeout(t);
      this._timers.delete(ns);
    } else {
      if (this._timer) clearTimeout(this._timer);
      this._timer = null;

      for (const [k, t] of this._timers.entries()) { try { clearTimeout(t); } catch {} this._timers.delete(k); }
    }
  }

  dispose() {
    this.stop();
  }

  async scheduleNext(ns = null) {
    const st = await this._getState(ns);
    if (!st.messages.length) return;
    if (st.staticMode) return;
    const cooldown = st.cooldownSeconds * 1000;
    const timer = setTimeout(async () => {
  try { await this.broadcastRandomMessage(ns); } catch { log.error('broadcast error'); }
      this.scheduleNext(ns);
    }, cooldown);
    if (ns) {
      this._timers.set(ns, timer);
    } else {
      this._timer = timer;
    }
    if (timer && typeof timer.unref === 'function') { try { timer.unref(); } catch {} }
  }

  async broadcastRandomMessage(ns = null) {
    const st = await this._getState(ns);
    if (!st.messages.length) return;
    const pool = st.messages.filter(m => m.enabled !== false);
    if (!pool.length) return;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    if (process.env.NODE_ENV === 'test') {
      log.debug('broadcastRandomMessage %j', { ns: ns || null, pool: pool.length, pick: msg && msg.id });
    }
    let duration = Number(msg.durationSeconds);
    if (!(duration >= 1)) duration = st.defaultDurationSeconds || 10;
    if (duration > 60) duration = 60;
    const payload = { type: 'announcement', data: {
      id: msg.id,
      text: msg.text,
      imageUrl: msg.imageUrl || null,
      linkUrl: msg.linkUrl || null,
      theme: st.theme,
      duration,
      bgColor: st.bgColor,
      textColor: st.textColor,
      animationMode: st.animationMode,
      title: msg.title || null,
      subtitle1: msg.subtitle1 || null,
      subtitle2: msg.subtitle2 || null,
      subtitle3: msg.subtitle3 || null,
      titleColor: msg.titleColor || null,
      subtitle1Color: msg.subtitle1Color || null,
      subtitle2Color: msg.subtitle2Color || null,
      subtitle3Color: msg.subtitle3Color || null,
      titleSize: typeof msg.titleSize === 'number' ? msg.titleSize : undefined,
      subtitle1Size: typeof msg.subtitle1Size === 'number' ? msg.subtitle1Size : undefined,
      subtitle2Size: typeof msg.subtitle2Size === 'number' ? msg.subtitle2Size : undefined,
      subtitle3Size: typeof msg.subtitle3Size === 'number' ? msg.subtitle3Size : undefined,
      ctaText: msg.ctaText || null,
      ctaTextSize: typeof msg.ctaTextSize === 'number' ? msg.ctaTextSize : undefined,
      ctaIcon: msg.ctaIcon || null,
      ctaBgColor: msg.ctaBgColor || null,
      textColorOverride: msg.textColorOverride || null,
      textSize: typeof msg.textSize === 'number' ? msg.textSize : undefined
    } };
    if (typeof this.wss?.broadcast === 'function') {
      this.wss.broadcast(ns || null, payload);
    } else {
      try {
        this.wss.clients.forEach(c => { if (c && c.readyState === 1) c.send(JSON.stringify(payload)); });
      } catch {}
    }
  }

  async broadcastConfig(ns = null) {
    const { config, meta } = await this.getConfigWithMeta(ns);

    const payload = { type: 'announcement_config', data: config, ...(meta ? { meta } : {}) };
    if (typeof this.wss?.broadcast === 'function') {
      this.wss.broadcast(ns || null, payload);
    } else {
      try {
        this.wss.clients.forEach(c => { if (c && c.readyState === 1) c.send(JSON.stringify(payload)); });
      } catch {}
    }
  }

  async getPublicConfig(ns = null) {
    const { config } = await this.getConfigWithMeta(ns);
    return config;
  }

  async getConfigWithMeta(ns = null) {
    const st = await this._getState(ns);
    const config = {
      messages: st.messages.map(m => ({
        id: m.id,
        text: m.text,
        imageUrl: m.imageUrl || null,
        linkUrl: m.linkUrl || null,
        enabled: m.enabled !== false,
        durationSeconds: Number(m.durationSeconds) > 0 ? Number(m.durationSeconds) : st.defaultDurationSeconds || 10,
        usesDefaultDuration: !(Number(m.durationSeconds) > 0),
        title: m.title || null,
        subtitle1: m.subtitle1 || null,
        subtitle2: m.subtitle2 || null,
        subtitle3: m.subtitle3 || null,
        titleColor: m.titleColor || null,
        subtitle1Color: m.subtitle1Color || null,
        subtitle2Color: m.subtitle2Color || null,
        subtitle3Color: m.subtitle3Color || null,
        titleSize: typeof m.titleSize === 'number' ? m.titleSize : undefined,
        subtitle1Size: typeof m.subtitle1Size === 'number' ? m.subtitle1Size : undefined,
        subtitle2Size: typeof m.subtitle2Size === 'number' ? m.subtitle2Size : undefined,
        subtitle3Size: typeof m.subtitle3Size === 'number' ? m.subtitle3Size : undefined,
        ctaText: m.ctaText || null,
        ctaTextSize: typeof m.ctaTextSize === 'number' ? m.ctaTextSize : undefined,
        ctaIcon: m.ctaIcon || null,
        ctaBgColor: m.ctaBgColor || null,
        textColorOverride: m.textColorOverride || null,
        textSize: typeof m.textSize === 'number' ? m.textSize : undefined
      })),
      cooldownSeconds: st.cooldownSeconds,
      theme: st.theme,
      bgColor: st.bgColor,
      textColor: st.textColor,
      animationMode: st.animationMode,
      defaultDurationSeconds: st.defaultDurationSeconds || 10,
      staticMode: !!st.staticMode,
      bannerBgType: st.bannerBgType || 'solid',
      gradientFrom: st.gradientFrom || '#4f36ff',
      gradientTo: st.gradientTo || '#10d39e'
    };

    let meta = null;
    try {
      if (this.store && (ns || ns === null)) {
        const globalPath = CONFIG_FILE;

        const { loadTenantConfig, computeChecksum } = require('../lib/tenant-config');
        const reqShim = ns ? { ns: { admin: ns } } : {};
        const lt = await loadTenantConfig(reqShim, this.store, globalPath, 'announcement-config.json');
        if (lt && lt.data) {
          const wrapped = lt.data;

            if (wrapped && typeof wrapped === 'object' && (wrapped.__version || wrapped.checksum || wrapped.updatedAt)) {
              meta = {
                __version: wrapped.__version || 1,
                checksum: wrapped.checksum || computeChecksum(config),
                updatedAt: wrapped.updatedAt || new Date().toISOString(),
                source: lt.source
              };
            }
        }
      }
    } catch { /* ignore meta errors */ }
    if (!meta) {
      try {
        const { computeChecksum } = require('../lib/tenant-config');
        meta = { __version: 1, checksum: computeChecksum(config), updatedAt: new Date().toISOString(), source: 'memory' };
      } catch {}
    }
    return { config, meta };
  }

  async setSettings({ cooldownSeconds, theme, bgColor, textColor, animationMode, defaultDurationSeconds, applyAllDurations, bannerBgType, gradientFrom, gradientTo, staticMode }, ns = null) {
    const st = await this._getState(ns);
    if (Number(cooldownSeconds) > 0) st.cooldownSeconds = Number(cooldownSeconds);
    if (theme === 'horizontal') st.theme = 'horizontal';
    if (typeof bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgColor)) st.bgColor = bgColor;
    if (typeof textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(textColor)) st.textColor = textColor;
    if (['fade','slide-up','slide-left','scale','random'].includes(animationMode)) st.animationMode = animationMode;
    if (Number(defaultDurationSeconds) >=1 && Number(defaultDurationSeconds) <=60) {
      st.defaultDurationSeconds = Number(defaultDurationSeconds);
    }
    if (typeof staticMode === 'boolean') st.staticMode = staticMode;
    if (bannerBgType === 'solid' || bannerBgType === 'gradient') st.bannerBgType = bannerBgType;
    if (typeof gradientFrom === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(gradientFrom)) st.gradientFrom = gradientFrom;
    if (typeof gradientTo === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(gradientTo)) st.gradientTo = gradientTo;
    if (applyAllDurations && Number(st.defaultDurationSeconds) >=1) {
      st.messages = st.messages.map(m => { const clone = { ...m }; delete clone.durationSeconds; return clone; });
    }
    await this._saveState(ns, st);
    this.start(ns);
    await this.broadcastConfig(ns);
    return this.getPublicConfig(ns);
  }

  async addMessage({ text, imageUrl, linkUrl, durationSeconds, title, subtitle1, subtitle2, subtitle3, titleColor, subtitle1Color, subtitle2Color, subtitle3Color, titleSize, subtitle1Size, subtitle2Size, subtitle3Size, ctaText, ctaTextSize, ctaIcon, ctaBgColor, textColorOverride, textSize }, ns = null) {
    const st = await this._getState(ns);
    const dur = Number(durationSeconds);
    const fallback = st.defaultDurationSeconds || 10;
    const wasEmpty = st.messages.length === 0;
    const clamp = (n, lo, hi) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return undefined;
      return Math.min(Math.max(x, lo), hi);
    };
    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      text: typeof text === 'string' ? text : '',
      imageUrl: imageUrl || null,
      linkUrl: linkUrl || null,
      createdAt: new Date().toISOString(),
      enabled: true,
      durationSeconds: (dur >=1 && dur <= 60) ? dur : fallback,
      title: title || null,
      subtitle1: subtitle1 || null,
      subtitle2: subtitle2 || null,
      subtitle3: subtitle3 || null,
      titleColor: titleColor || null,
      subtitle1Color: subtitle1Color || null,
      subtitle2Color: subtitle2Color || null,
      subtitle3Color: subtitle3Color || null,
      titleSize: clamp(titleSize, 8, 72),
      subtitle1Size: clamp(subtitle1Size, 8, 64),
      subtitle2Size: clamp(subtitle2Size, 8, 64),
      subtitle3Size: clamp(subtitle3Size, 8, 64),
      ctaText: ctaText || null,
      ctaTextSize: clamp(ctaTextSize, 8, 64),
      ctaIcon: ctaIcon || null,
      ctaBgColor: ctaBgColor || null,
      textColorOverride: textColorOverride || null,
      textSize: clamp(textSize, 8, 64)
    };
    st.messages.push(message);
    await this._saveState(ns, st);
    await this.broadcastConfig(ns);

    if (wasEmpty) {
      try {
        this.start(ns);
        await this.broadcastRandomMessage(ns);
      } catch { /* ignore */ }
    }
    return message;
  }

  async updateMessage(id, patch, ns = null) {
    const st = await this._getState(ns);
    const idx = st.messages.findIndex(m => m.id === id);
    if (idx === -1) return null;
    const next = { ...st.messages[idx], ...patch };
    if (patch.durationSeconds !== undefined) {
      const d = Number(patch.durationSeconds);
      if (d >= 1 && d <= 60) next.durationSeconds = d; else delete next.durationSeconds;
    }

    const clamp = (n, lo, hi) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return undefined;
      return Math.min(Math.max(x, lo), hi);
    };
    if (Object.prototype.hasOwnProperty.call(patch, 'titleSize')) next.titleSize = clamp(patch.titleSize, 8, 72);
    if (Object.prototype.hasOwnProperty.call(patch, 'subtitle1Size')) next.subtitle1Size = clamp(patch.subtitle1Size, 8, 64);
    if (Object.prototype.hasOwnProperty.call(patch, 'subtitle2Size')) next.subtitle2Size = clamp(patch.subtitle2Size, 8, 64);
    if (Object.prototype.hasOwnProperty.call(patch, 'subtitle3Size')) next.subtitle3Size = clamp(patch.subtitle3Size, 8, 64);
    if (Object.prototype.hasOwnProperty.call(patch, 'textSize')) next.textSize = clamp(patch.textSize, 8, 64);
    if (Object.prototype.hasOwnProperty.call(patch, 'ctaTextSize')) next.ctaTextSize = clamp(patch.ctaTextSize, 8, 64);
    st.messages[idx] = next;
    await this._saveState(ns, st);
    await this.broadcastConfig(ns);
    return st.messages[idx];
  }

  async removeMessage(id, ns = null) {
    const st = await this._getState(ns);
    const idx = st.messages.findIndex(m => m.id === id);
    if (idx === -1) return false;
    const [removed] = st.messages.splice(idx, 1);
    if (removed && removed.imageUrl && removed.imageUrl.startsWith('/uploads/announcement/')) {
      try { fs.unlinkSync(path.join(process.cwd(), 'public', removed.imageUrl)); } catch {}
    }
    await this._saveState(ns, st);
    await this.broadcastConfig(ns);
    return true;
  }

  async clearMessages(mode = 'all', ns = null) {
    const st = await this._getState(ns);
    const before = st.messages.length;
    if (before === 0) return { before: 0, after: 0 };
    if (mode === 'test') {
      const testRegex = /^(Default dur|DD-|WS ping|Image test message updated|Temp img message updated)/;
      st.messages = st.messages.filter(m => !testRegex.test(m.text));
    } else {
      st.messages = [];
    }
    await this._saveState(ns, st);
    await this.broadcastConfig(ns);
    return { before, after: st.messages.length };
  }

  async getMessage(id, ns = null) {
    const st = await this._getState(ns);
    return st.messages.find(m => m.id === id) || null;
  }
}

module.exports = { AnnouncementModule, UPLOAD_DIR };
