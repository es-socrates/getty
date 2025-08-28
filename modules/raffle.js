const WebSocket = require('ws');

class RaffleModule {
    constructor(wss) {
        this.wss = wss;
        // Map<nsToken, RaffleState>
        this.sessions = new Map();
    }

    getOrCreate(ns) {
        const key = String(ns || '') || '__global__';
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                active: false,
                paused: false,
                command: '!giveaway',
                prize: '',
                imageUrl: '',
                maxWinners: 1,
                mode: 'manual',
                enabled: true,
                participants: new Map(),
                previousWinners: new Set()
            });
        }
        return this.sessions.get(key);
    }

    saveSettings(ns, settings) {
        const s = this.getOrCreate(ns);
        s.command = settings.command || s.command;
        s.prize = settings.prize || s.prize;
        s.maxWinners = typeof settings.maxWinners === 'number' && !isNaN(settings.maxWinners) ? settings.maxWinners : s.maxWinners;
        s.mode = settings.mode || s.mode;
        s.imageUrl = settings.imageUrl || s.imageUrl;
        if (settings.enabled !== undefined) s.enabled = !!settings.enabled;
        if (settings.active !== undefined) s.active = !!settings.active;
        if (settings.paused !== undefined) s.paused = !!settings.paused;

        s.participants.clear();
        s.previousWinners.clear();
    }

    setImage(ns, imageUrl) {
        const s = this.getOrCreate(ns);
        s.imageUrl = imageUrl;
    }

    getSettings(ns) {
        const s = this.getOrCreate(ns);
        return {
            command: s.command,
            prize: s.prize,
            imageUrl: s.imageUrl,
            active: s.active,
            paused: s.paused,
            maxWinners: s.maxWinners,
            mode: s.mode,
            enabled: s.enabled,
            participants: Array.from(s.participants.entries()),
            previousWinners: Array.from(s.previousWinners)
        };
    }

    getPublicState(ns) {
        const s = this.getOrCreate(ns);
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

    start(ns) {
        const s = this.getOrCreate(ns);
        s.active = true;
        s.paused = false;
        s.participants.clear();
        return { success: true };
    }

    stop(ns) {
        const s = this.getOrCreate(ns);
        s.active = false;
        s.paused = false;
        return { success: true };
    }

    pause(ns) {
        const s = this.getOrCreate(ns);
        if (!s.active) return { success: false, error: 'Raffle is not active' };
        s.paused = true;
        return { success: true };
    }

    resume(ns) {
        const s = this.getOrCreate(ns);
        if (!s.active) return { success: false, error: 'Raffle is not active' };
        s.paused = false;
        return { success: true };
    }

    addParticipant(ns, username, userId) {
        const s = this.getOrCreate(ns);
        if (!s.active || s.paused) return false;
        if (!s.participants.has(userId)) {
            s.participants.set(userId, { username, timestamp: Date.now() });
            return true;
        }
        return false;
    }
    drawWinner(ns) {
        const s = this.getOrCreate(ns);
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

    resetWinners(ns) {
        const s = this.getOrCreate(ns);
        s.previousWinners.clear();
        s.participants.clear();
        s.active = false;
        s.paused = false;
        return { success: true };
    }

}

module.exports = RaffleModule;
