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
        theme: raw.theme === 'horizontal' ? 'horizontal' : 'vertical',
        bgColor: typeof raw.bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.bgColor) ? raw.bgColor : '#0e1014',
        textColor: typeof raw.textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.textColor) ? raw.textColor : '#e8eef2',
        animationMode: ['fade','slide-up','slide-left','scale','random'].includes(raw.animationMode) ? raw.animationMode : 'fade',
        defaultDurationSeconds: (Number(raw.defaultDurationSeconds) >=1 && Number(raw.defaultDurationSeconds) <=60) ? Number(raw.defaultDurationSeconds) : 10
      };
    }
  } catch (e) {
    console.error('[announcement] loadConfig error:', e.message);
  }
  return { messages: [], cooldownSeconds: 300, theme: 'vertical', bgColor: '#0e1014', textColor: '#e8eef2', animationMode: 'fade', defaultDurationSeconds: 10 };
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
  this.scheduleNext();
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
    const payload = { type: 'announcement', data: { id: msg.id, text: msg.text, imageUrl: msg.imageUrl || null, linkUrl: msg.linkUrl || null, theme: this.state.theme, duration, bgColor: this.state.bgColor, textColor: this.state.textColor, animationMode: this.state.animationMode } };
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
        usesDefaultDuration: !(Number(m.durationSeconds) > 0)
      })),
        cooldownSeconds: this.state.cooldownSeconds,
        theme: this.state.theme,
        bgColor: this.state.bgColor,
        textColor: this.state.textColor,
        animationMode: this.state.animationMode,
        defaultDurationSeconds: this.state.defaultDurationSeconds || 10
    };
  }

  setSettings({ cooldownSeconds, theme, bgColor, textColor, animationMode, defaultDurationSeconds, applyAllDurations }) {
    if (Number(cooldownSeconds) > 0) this.state.cooldownSeconds = Number(cooldownSeconds);
    if (['vertical', 'horizontal'].includes(theme)) this.state.theme = theme;
    if (typeof bgColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(bgColor)) this.state.bgColor = bgColor;
    if (typeof textColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(textColor)) this.state.textColor = textColor;
    if (['fade','slide-up','slide-left','scale','random'].includes(animationMode)) this.state.animationMode = animationMode;
    if (Number(defaultDurationSeconds) >=1 && Number(defaultDurationSeconds) <=60) {
      this.state.defaultDurationSeconds = Number(defaultDurationSeconds);
    }
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

  addMessage({ text, imageUrl, linkUrl, durationSeconds }) {
    const dur = Number(durationSeconds);
    const fallback = this.state.defaultDurationSeconds || 10;
    const wasEmpty = this.state.messages.length === 0; // track if this is the first message
    const message = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), text, imageUrl: imageUrl || null, linkUrl: linkUrl || null, createdAt: new Date().toISOString(), enabled: true, durationSeconds: (dur >=1 && dur <= 60) ? dur : fallback };
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
