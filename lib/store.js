const crypto = require('crypto');

class InMemoryKV {
  constructor() {
    this.map = new Map();
  }
  async get(key) { return this.map.get(key) || null; }
  async set(key, val, ttlSec) {
    this.map.set(key, val);
    if (ttlSec && ttlSec > 0) {
      setTimeout(() => this.map.delete(key), ttlSec * 1000).unref?.();
    }
    return true;
  }
  async del(key) { this.map.delete(key); }
}

function safeJSONParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

class NamespacedStore {
  constructor({ redis, ttlSeconds = 72 * 3600 } = {}) {
    this.ttl = ttlSeconds;
    this.redis = redis || null;
    this.kv = this.redis ? null : new InMemoryKV();
    this.__configPrefix = 'gettycfg:';
  }

  _key(ns, key) {
    return `getty:${ns}:${key}`;
  }

  _configKey(ns, key) {
    return `${this.__configPrefix}${ns}:${key}`;
  }

  async get(ns, key, fallback = null) {
    const k = this._key(ns, key);
    if (this.redis) {
      const val = await this.redis.get(k);
      return val ? safeJSONParse(val, fallback) : fallback;
    }
    const val = await this.kv.get(k);
    return typeof val === 'undefined' ? fallback : val;
  }

  async set(ns, key, value) {
    const k = this._key(ns, key);
    if (this.redis) {
      const v = JSON.stringify(value);
      await this.redis.set(k, v, 'EX', this.ttl);
      return true;
    }
    await this.kv.set(k, value, this.ttl);
    return true;
  }

  async setConfig(ns, key, value) {
    const k = this._configKey(ns, key);
    if (this.redis) {
      const v = JSON.stringify(value);
      await this.redis.set(k, v);
      return true;
    }
    await this.kv.set(k, value, 0);
    return true;
  }

  async getConfig(ns, key, fallback = null) {
    const k = this._configKey(ns, key);
    if (this.redis) {
      const val = await this.redis.get(k);
      return val ? safeJSONParse(val, fallback) : fallback;
    }
    const val = await this.kv.get(k);
    return typeof val === 'undefined' ? fallback : val;
  }

  async delConfig(ns, key) {
    const k = this._configKey(ns, key);
    if (this.redis) return this.redis.del(k);
    return this.kv.del(k);
  }

  async del(ns, key) {
    const k = this._key(ns, key);
    if (this.redis) return this.redis.del(k);
    return this.kv.del(k);
  }

  async export(ns) {
    if (!this.redis) {
      const prefix = `getty:${ns}:`;
      const out = {};
      for (const [k, v] of this.kv.map.entries()) {
        if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
      }
      return out;
    }
    return {};
  }

  static genToken(bytes = 24) {
    return crypto.randomBytes(bytes).toString('base64url');
  }
}

module.exports = { NamespacedStore };
