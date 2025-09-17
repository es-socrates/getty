const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CONFIG_FILE = (process.env.NODE_ENV === 'test')
  ? path.join(process.cwd(), 'config', 'announcement-config.test.json')
  : path.join(process.cwd(), 'config', 'announcement-config.json');
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
    console.error('[announcement] loadConfig error:', e.message);
  }
  return { messages: [], cooldownSeconds: 300, theme: 'horizontal', bgColor: '#0e1014', textColor: '#e8eef2', animationMode: 'fade', defaultDurationSeconds: 10, staticMode: false, bannerBgType: 'solid', gradientFrom: '#4f36ff', gradientTo: '#10d39e' };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[announcement] saveConfig error:', e.message);
    return false;
  }
}

class AnnouncementModule {
  constructor(wss) {
    this.wss = wss;
    this.state = loadConfig();
    this._timer = null;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    if (process.env.NODE_ENV !== 'test') {
      this.start();
    }
  }

  start() {
    this.stop();
  if (process.env.NODE_ENV === 'test') return;
  if (!this.state.staticMode) this.scheduleNext();
  }

  stop() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  dispose() {
    this.stop();
  }

  scheduleNext() {
    if (!this.state.messages.length) return;
    if (this.state.staticMode) return;
    const cooldown = this.state.cooldownSeconds * 1000;
    this._timer = setTimeout(() => {
      try { this.broadcastRandomMessage(); } catch {
        console.error('[announcement] broadcast error');
      }
      this.scheduleNext();
    }, cooldown);
    if (this._timer && typeof this._timer.unref === 'function') {
      try { this._timer.unref(); } catch {}
    }
  }

  broadcastRandomMessage() {
    if (!this.state.messages.length) return;
    const pool = this.state.messages.filter(m => m.enabled !== false);
    if (!pool.length) return;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    let duration = Number(msg.durationSeconds);
    if (!(duration >= 1)) duration = this.state.defaultDurationSeconds || 10;
    if (duration > 60) duration = 60;
    const payload = { type: 'announcement', data: { 
      id: msg.id,
      text: msg.text,
      imageUrl: msg.imageUrl || null,
      linkUrl: msg.linkUrl || null,
      theme: this.state.theme,
      duration,
      bgColor: this.state.bgColor,
      textColor: this.state.textColor,
      animationMode: this.state.animationMode,
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
    this.wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(payload)); });
  }

  broadcastConfig() {
    const payload = { type: 'announcement_config', data: this.getPublicConfig() };
    this.wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(payload)); });
  }

  getPublicConfig() {
    return { 
      messages: this.state.messages.map(m => ({
        id: m.id,
        text: m.text,
        imageUrl: m.imageUrl || null,
        linkUrl: m.linkUrl || null,
        enabled: m.enabled !== false,
        durationSeconds: Number(m.durationSeconds) > 0 ? Number(m.durationSeconds) : this.state.defaultDurationSeconds || 10,
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
        cooldownSeconds: this.state.cooldownSeconds,
        theme: this.state.theme,
        bgColor: this.state.bgColor,
        textColor: this.state.textColor,
        animationMode: this.state.animationMode,
        defaultDurationSeconds: this.state.defaultDurationSeconds || 10,
        staticMode: !!this.state.staticMode,
        bannerBgType: this.state.bannerBgType || 'solid',
        gradientFrom: this.state.gradientFrom || '#4f36ff',
        gradientTo: this.state.gradientTo || '#10d39e'
    };
  }

  setSettings({ cooldownSeconds, theme, bgColor, textColor, animationMode, defaultDurationSeconds, applyAllDurations, bannerBgType, gradientFrom, gradientTo, staticMode }) {
    if (Number(cooldownSeconds) > 0) this.state.cooldownSeconds = Number(cooldownSeconds);
    if (theme === 'horizontal') this.state.theme = 'horizontal';
    if (typeof bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgColor)) this.state.bgColor = bgColor;
    if (typeof textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(textColor)) this.state.textColor = textColor;
    if (['fade','slide-up','slide-left','scale','random'].includes(animationMode)) this.state.animationMode = animationMode;
    if (Number(defaultDurationSeconds) >=1 && Number(defaultDurationSeconds) <=60) {
      this.state.defaultDurationSeconds = Number(defaultDurationSeconds);
    }
    if (typeof staticMode === 'boolean') this.state.staticMode = staticMode;
    if (bannerBgType === 'solid' || bannerBgType === 'gradient') this.state.bannerBgType = bannerBgType;
    if (typeof gradientFrom === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(gradientFrom)) this.state.gradientFrom = gradientFrom;
    if (typeof gradientTo === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(gradientTo)) this.state.gradientTo = gradientTo;
    if (applyAllDurations && Number(this.state.defaultDurationSeconds) >=1) {
      this.state.messages = this.state.messages.map(m => {
        const clone = { ...m };
        delete clone.durationSeconds;
        return clone;
      });
    }
  saveConfig(this.state);
    this.start();
    this.broadcastConfig();
    return this.getPublicConfig();
  }

  addMessage({ text, imageUrl, linkUrl, durationSeconds, title, subtitle1, subtitle2, subtitle3, titleColor, subtitle1Color, subtitle2Color, subtitle3Color, titleSize, subtitle1Size, subtitle2Size, subtitle3Size, ctaText, ctaTextSize, ctaIcon, ctaBgColor, textColorOverride, textSize }) {
    const dur = Number(durationSeconds);
    const fallback = this.state.defaultDurationSeconds || 10;
    const wasEmpty = this.state.messages.length === 0;
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
    this.state.messages.push(message);
    saveConfig(this.state);
    this.broadcastConfig();

    if (wasEmpty) {
      try {
        this.start();
        this.broadcastRandomMessage();
      } catch { /* ignore */ }
    }
    return message;
  }

  updateMessage(id, patch) {
    const idx = this.state.messages.findIndex(m => m.id === id);
    if (idx === -1) return null;
    const next = { ...this.state.messages[idx], ...patch };
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
    this.state.messages[idx] = next;
    saveConfig(this.state);
    this.broadcastConfig();
    return this.state.messages[idx];
  }

  removeMessage(id) {
    const idx = this.state.messages.findIndex(m => m.id === id);
    if (idx === -1) return false;
    const [removed] = this.state.messages.splice(idx, 1);
    if (removed && removed.imageUrl && removed.imageUrl.startsWith('/uploads/announcement/')) {
      try { fs.unlinkSync(path.join(process.cwd(), 'public', removed.imageUrl)); } catch {}
    }
    saveConfig(this.state);
    this.broadcastConfig();
    return true;
  }

  clearMessages(mode = 'all') {
    const before = this.state.messages.length;
    if (before === 0) return { before: 0, after: 0 };
    if (mode === 'test') {
      const testRegex = /^(Default dur|DD-|WS ping|Image test message updated|Temp img message updated)/;
      this.state.messages = this.state.messages.filter(m => !testRegex.test(m.text));
    } else {
      this.state.messages = [];
    }
    saveConfig(this.state);
    this.broadcastConfig();
    return { before, after: this.state.messages.length };
  }

  getMessage(id) {
    return this.state.messages.find(m => m.id === id) || null;
  }
}

module.exports = { AnnouncementModule, UPLOAD_DIR };
