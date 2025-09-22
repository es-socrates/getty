const path = require('path');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');

const CONFIG_FILE = path.join(process.cwd(), 'config', 'raffle-config.json');

function nsKey(ns) {
  const key = String(ns || '') || '__global__';
  return key;
}

class RaffleModule {
    constructor(wss, opts = {}) {
        this.wss = wss;
        this.sessions = new Map();
        this.store = opts.store || null;
        this.DEFAULTS = {
            command: '!giveaway',
            prize: '',
            imageUrl: '',
            maxWinners: 1,
            mode: 'manual',
            enabled: true,
            duration: 5,
            interval: 5
        };
    }

    async __loadConfigFor(ns) {
        const reqShim = { ns: { admin: ns } };
        let loaded;
        try {
            loaded = await loadTenantConfig(reqShim, this.store, CONFIG_FILE, 'raffle-config.json');
        } catch {
            loaded = { data: { ...this.DEFAULTS }, meta: {} };
        }
        const candidate = loaded && loaded.data ? loaded.data : {};
        const unwrapped = (candidate && candidate.data && (candidate.__version || candidate.checksum)) ? candidate.data : candidate;
        let meta = null;
        try {
            if (candidate && (candidate.__version || candidate.checksum)) {
                meta = { __version: candidate.__version || null, checksum: candidate.checksum || null, updatedAt: candidate.updatedAt || null, source: loaded.source };
            }
        } catch { meta = null; }
        return { raw: unwrapped || {}, meta };
    }

    async getOrCreate(ns) {
        const key = nsKey(ns);
        if (!this.sessions.has(key)) {
            let persisted = {};
            try {
                const { raw } = await this.__loadConfigFor(ns);
                persisted = raw || {};
            } catch { persisted = {}; }
            this.sessions.set(key, {
                active: false,
                paused: false,
                participants: new Map(),
                previousWinners: new Set(),
                command: typeof persisted.command === 'string' ? persisted.command : this.DEFAULTS.command,
                prize: typeof persisted.prize === 'string' ? persisted.prize : this.DEFAULTS.prize,
                imageUrl: typeof persisted.imageUrl === 'string' ? persisted.imageUrl : this.DEFAULTS.imageUrl,
                maxWinners: Number.isInteger(persisted.maxWinners) && persisted.maxWinners > 0 ? persisted.maxWinners : this.DEFAULTS.maxWinners,
                mode: (persisted.mode === 'auto' || persisted.mode === 'manual') ? persisted.mode : this.DEFAULTS.mode,
                enabled: typeof persisted.enabled === 'boolean' ? persisted.enabled : this.DEFAULTS.enabled,
                duration: Number.isInteger(persisted.duration) && persisted.duration > 0 ? persisted.duration : this.DEFAULTS.duration,
                interval: Number.isInteger(persisted.interval) && persisted.interval > 0 ? persisted.interval : this.DEFAULTS.interval
            });
        }
        return this.sessions.get(key);
    }

    async saveSettings(ns, settings) {
        const s = await this.getOrCreate(ns);
        s.command = settings.command || s.command;
        s.prize = settings.prize || s.prize;
        s.maxWinners = typeof settings.maxWinners === 'number' && !isNaN(settings.maxWinners) ? settings.maxWinners : s.maxWinners;
        s.mode = (settings.mode === 'auto' || settings.mode === 'manual') ? settings.mode : s.mode;
        s.imageUrl = (settings.imageUrl !== undefined) ? settings.imageUrl : s.imageUrl;
        if (settings.enabled !== undefined) s.enabled = !!settings.enabled;
        if (settings.active !== undefined) s.active = !!settings.active;
        if (settings.paused !== undefined) s.paused = !!settings.paused;
        if (settings.duration !== undefined) {
            const d = Number(settings.duration);
            if (Number.isFinite(d) && d > 0) s.duration = Math.trunc(d);
        }
        if (settings.interval !== undefined) {
            const it = Number(settings.interval);
            if (Number.isFinite(it) && it > 0) s.interval = Math.trunc(it);
        }

        s.participants.clear();
        s.previousWinners.clear();

        const toPersist = {
            command: s.command,
            prize: s.prize,
            imageUrl: s.imageUrl,
            maxWinners: s.maxWinners,
            mode: s.mode,
            enabled: s.enabled,
            duration: s.duration,
            interval: s.interval
        };
        try { await saveTenantConfig({ ns: { admin: ns } }, this.store, CONFIG_FILE, 'raffle-config.json', toPersist); } catch {}
    }

    async setImage(ns, imageUrl) {
        const s = await this.getOrCreate(ns);
        s.imageUrl = imageUrl;
        const toPersist = {
            command: s.command,
            prize: s.prize,
            imageUrl: s.imageUrl,
            maxWinners: s.maxWinners,
            mode: s.mode,
            enabled: s.enabled,
            duration: s.duration,
            interval: s.interval
        };
        try { await saveTenantConfig({ ns: { admin: ns } }, this.store, CONFIG_FILE, 'raffle-config.json', toPersist); } catch {}
    }

    async getSettings(ns) {
        const s = await this.getOrCreate(ns);
        return {
            command: s.command,
            prize: s.prize,
            imageUrl: s.imageUrl,
            active: s.active,
            paused: s.paused,
            maxWinners: s.maxWinners,
            mode: s.mode,
            enabled: s.enabled,
            duration: s.duration,
            interval: s.interval,
            participants: Array.from(s.participants.entries()),
            previousWinners: Array.from(s.previousWinners)
        };
    }

    async getSettingsWithMeta(ns) {
        try {
            const s = await this.getSettings(ns);
            const { meta } = await this.__loadConfigFor(ns);
            return { settings: s, meta: meta || null };
        } catch { return { settings: await this.getSettings(ns), meta: null }; }
    }

    async getPublicState(ns) {
        const s = await this.getOrCreate(ns);
        return {
            active: s.active,
            paused: s.paused,
            command: s.command,
            prize: s.prize,
            imageUrl: s.imageUrl,
            maxWinners: s.maxWinners,
            mode: s.mode,
            enabled: s.enabled,
            participants: Array.from(s.participants.values()).map(p => p.username),
            totalWinners: s.previousWinners.size
        };
    }

    getActiveNamespaces() {
        const out = [];
        try {
            for (const [key, session] of this.sessions.entries()) {
                if (session && session.active && !session.paused) out.push(key);
            }
        } catch {}
        return out;
    }

    async start(ns) {
        const s = await this.getOrCreate(ns);
        s.active = true;
        s.paused = false;
        s.participants.clear();
        return { success: true };
    }

    async stop(ns) {
        const s = await this.getOrCreate(ns);
        s.active = false;
        s.paused = false;
        return { success: true };
    }

    async pause(ns) {
        const s = await this.getOrCreate(ns);
        if (!s.active) return { success: false, error: 'Raffle is not active' };
        s.paused = true;
        return { success: true };
    }

    async resume(ns) {
        const s = await this.getOrCreate(ns);
        if (!s.active) return { success: false, error: 'Raffle is not active' };
        s.paused = false;
        return { success: true };
    }

    async addParticipant(ns, username, userId) {
        const s = await this.getOrCreate(ns);
        if (!s.active || s.paused) return false;
        if (!s.participants.has(userId)) {
            s.participants.set(userId, { username, timestamp: Date.now() });
            return true;
        }
        return false;
    }

    async drawWinner(ns) {
        const s = await this.getOrCreate(ns);
        if (s.participants.size === 0) {
            return { success: false, error: 'No participants in the raffle' };
        }
        const eligible = Array.from(s.participants.entries())
            .filter(([userId]) => !s.previousWinners.has(userId));
        if (eligible.length === 0) {
            return {
                success: false,
                error: 'All participants have already won. Reset winners to continue.'
            };
        }
        const [winnerId, winner] = eligible[Math.floor(Math.random() * eligible.length)];
        s.previousWinners.add(winnerId);
        s.participants.delete(winnerId);
        const result = {
            success: true,
            winner: winner.username || winner,
            prize: s.prize,
            imageUrl: s.imageUrl,
            timestamp: Date.now()
        };
        s.active = false;
        s.paused = false;
        return result;
    }

    async resetWinners(ns) {
        const s = await this.getOrCreate(ns);
        s.previousWinners.clear();
        s.participants.clear();
        s.active = false;
        s.paused = false;
        return { success: true };
    }
}

module.exports = RaffleModule;
