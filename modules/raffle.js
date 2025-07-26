const fs = require('fs');
const path = require('path');

class RaffleModule {
    _autoDraw() {
        if (!this.active || this.paused) return;
        this.drawWinner();
        this.active = false;
        this.endTime = null;
        this.saveSettingsToFile();
        this.broadcastState();
    }
    constructor(wss) {
        this.wss = wss;
        this.active = false;
        this.paused = false;
        this.command = '!sorteo';
        this.prize = '';
        this.imageUrl = '';
        this.duration = 5;
        this.maxWinners = 1;
        this.mode = 'manual';
        this.interval = 5;
        this.enabled = true;
        this.participants = new Map();
        this.previousWinners = new Set();
        this.settingsFile = path.join(__dirname, '../raffle-settings.json');
        this.loadSettings();

        this.timer = null;
        this.endTime = null;
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsFile)) {
                const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
                this.command = data.command || '!sorteo';
                this.prize = data.prize || '';
                this.imageUrl = data.imageUrl || '';
                this.active = !!data.active;
                this.paused = !!data.paused;
                this.duration = typeof data.duration === 'number' ? data.duration : 5;
                this.maxWinners = typeof data.maxWinners === 'number' ? data.maxWinners : 1;
                this.mode = data.mode || 'manual';
                this.interval = typeof data.interval === 'number' ? data.interval : 5;
                this.enabled = data.enabled !== undefined ? !!data.enabled : true;
                this.participants = new Map(data.participants || []);
                this.previousWinners = new Set(data.previousWinners || []);
            }
        } catch (err) {

        }
    }

    saveSettingsToFile() {
        try {
            const data = {
                command: this.command,
                prize: this.prize,
                imageUrl: this.imageUrl,
                active: this.active,
                paused: this.paused,
                duration: this.duration,
                maxWinners: this.maxWinners,
                mode: this.mode,
                interval: this.interval,
                enabled: this.enabled,
                participants: Array.from(this.participants.entries()),
                previousWinners: Array.from(this.previousWinners)
            };
            fs.writeFileSync(this.settingsFile, JSON.stringify(data, null, 2));
        } catch (err) {

        }
    }

    saveSettings(settings) {
        this.command = settings.command || this.command;
        this.prize = settings.prize || this.prize;
        this.duration = typeof settings.duration === 'number' && !isNaN(settings.duration) ? settings.duration : this.duration;
        this.maxWinners = typeof settings.maxWinners === 'number' && !isNaN(settings.maxWinners) ? settings.maxWinners : this.maxWinners;
        this.mode = settings.mode || this.mode;
        this.interval = typeof settings.interval === 'number' && !isNaN(settings.interval) ? settings.interval : this.interval;
        this.imageUrl = settings.imageUrl || this.imageUrl;
        if (settings.enabled !== undefined) this.enabled = !!settings.enabled;
        if (settings.active !== undefined) this.active = !!settings.active;
        if (settings.paused !== undefined) this.paused = !!settings.paused;

        this.participants.clear();
        this.previousWinners.clear();
        this.saveSettingsToFile();
        this.broadcastState();
    }

    setImage(imageUrl) {
        this.imageUrl = imageUrl;
        this.saveSettingsToFile();
    }

    getSettings() {
        return {
            command: this.command,
            prize: this.prize,
            imageUrl: this.imageUrl,
            active: this.active,
            paused: this.paused,
            duration: this.duration,
            maxWinners: this.maxWinners,
            mode: this.mode,
            interval: this.interval,
            enabled: this.enabled,
            participants: Array.from(this.participants.entries()),
            previousWinners: Array.from(this.previousWinners)
        };
    }

    getPublicState() {
        return {
            active: this.active,
            paused: this.paused,
            command: this.command,
            prize: this.prize,
            imageUrl: this.imageUrl,
            duration: this.duration,
            maxWinners: this.maxWinners,
            mode: this.mode,
            interval: this.interval,
            enabled: this.enabled,
            participants: Array.from(this.participants.values()).map(p => p.username),
            totalWinners: this.previousWinners.size,
            endTime: this.endTime
        };
    }

    start() {
        this.active = true;
        this.paused = false;
        this.participants.clear();

        if (this.duration > 0) {
            if (this.timer) clearTimeout(this.timer);
            this.endTime = Date.now() + this.duration * 60 * 1000;
            this.timer = setTimeout(() => {
                this._autoDraw();
            }, this.duration * 60 * 1000);
        } else {
            this.endTime = null;
            if (this.timer) clearTimeout(this.timer);
        }
        this.saveSettingsToFile();
        this.broadcastState();
        return { success: true };
    }

    stop() {
        this.active = false;
        this.paused = false;
        if (this.timer) clearTimeout(this.timer);
        this.endTime = null;
        this.saveSettingsToFile();
        this.broadcastState();
        return { success: true };
    }

    pause() {
        if (!this.active) return { success: false, error: 'Raffle is not active' };
        this.paused = true;
        this.saveSettingsToFile();
        this.broadcastState();
        return { success: true };
    }

    resume() {
        if (!this.active) return { success: false, error: 'Raffle is not active' };
        this.paused = false;
        this.saveSettingsToFile();
        this.broadcastState();
        return { success: true };
    }

    addParticipant(username, userId) {
        if (!this.active || this.paused) return false;
        if (!this.participants.has(userId)) {
            this.participants.set(userId, { username, timestamp: Date.now() });
            this.saveSettingsToFile();
            this.broadcastState();
            return true;
        }
        return false;
    }

    drawWinner() {
        if (this.participants.size === 0) {
            return { success: false, error: 'No participants in the raffle' };
        }
        const eligible = Array.from(this.participants.entries())
            .filter(([userId]) => !this.previousWinners.has(userId));
        if (eligible.length === 0) {
            return { 
                success: false, 
                error: 'All participants have already won. Reset winners to continue.'
            };
        }
        const [winnerId, winner] = eligible[Math.floor(Math.random() * eligible.length)];
        this.previousWinners.add(winnerId);
        this.participants.delete(winnerId);
        const result = {
            success: true,
            winner: winner.username || winner,
            prize: this.prize,
            imageUrl: this.imageUrl,
            timestamp: Date.now()
        };
        this.broadcastWinner(result);
        this.active = false;
        this.paused = false;
        this.endTime = null;
        this.saveSettingsToFile();
        this.broadcastState();
        return result;
    }

    resetWinners() {
        this.previousWinners.clear();
        this.participants.clear();
        this.active = false;
        this.paused = false;
        if (this.timer) clearTimeout(this.timer);
        this.endTime = null;
        this.saveSettingsToFile();
        // Broadcast con bandera de reset
        if (this.wss) {
            const state = {
                type: 'raffle_state',
                active: this.active,
                paused: this.paused,
                command: this.command,
                prize: this.prize,
                imageUrl: this.imageUrl,
                duration: this.duration,
                maxWinners: this.maxWinners,
                mode: this.mode,
                interval: this.interval,
                enabled: this.enabled,
                participants: Array.from(this.participants.values()).map(p => p.username),
                totalWinners: this.previousWinners.size,
                endTime: this.endTime,
                reset: true
            };
            this.wss.clients.forEach(client => {
                if (client.readyState === 1 || client.readyState ===  WebSocket.OPEN) {
                    client.send(JSON.stringify(state));
                }
            });
        }
        return { success: true };
    }

    broadcastState() {
        if (!this.wss) return;
        const state = {
            type: 'raffle_state',
            active: this.active,
            paused: this.paused,
            command: this.command,
            prize: this.prize,
            imageUrl: this.imageUrl,
            duration: this.duration,
            maxWinners: this.maxWinners,
            mode: this.mode,
            interval: this.interval,
            enabled: this.enabled,
            participants: Array.from(this.participants.values()).map(p => p.username),
            totalWinners: this.previousWinners.size,
            endTime: this.endTime
        };
        this.wss.clients.forEach(client => {
            if (client.readyState === 1 || client.readyState ===  WebSocket.OPEN) {
                client.send(JSON.stringify(state));
            }
        });
    }

    broadcastWinner(winnerData) {
        if (!this.wss) return;
        const message = {
            type: 'raffle_winner',
            ...winnerData
        };
        this.wss.clients.forEach(client => {
            if (client.readyState === 1 || client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

module.exports = RaffleModule;
