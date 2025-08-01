
const fs = require('fs');
const path = require('path');

class RaffleModule {
    constructor(wss) {
        this.wss = wss;
        this.active = false;
        this.paused = false;
        this.command = '!giveaway';
        this.prize = '';
        this.imageUrl = '';
        this.maxWinners = 1;
        this.mode = 'manual';
        this.enabled = true;
        this.participants = new Map();
        this.previousWinners = new Set();
        this.settingsFile = path.join(__dirname, '../raffle-settings.json');
        this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsFile)) {
                const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
                this.command = data.command || '!giveaway';
                this.prize = data.prize || '';
                this.imageUrl = data.imageUrl || '';
                this.active = !!data.active;
                this.paused = !!data.paused;
                this.maxWinners = typeof data.maxWinners === 'number' ? data.maxWinners : 1;
                this.mode = data.mode || 'manual';
                this.enabled = data.enabled !== undefined ? !!data.enabled : true;
                this.participants = new Map(data.participants || []);
                this.previousWinners = new Set(data.previousWinners || []);
            }
        } catch (err) {}
    }

    saveSettingsToFile() {
        try {
            const data = {
                command: this.command,
                prize: this.prize,
                imageUrl: this.imageUrl,
                active: this.active,
                paused: this.paused,
                maxWinners: this.maxWinners,
                mode: this.mode,
                enabled: this.enabled,
                participants: Array.from(this.participants.entries()),
                previousWinners: Array.from(this.previousWinners)
            };
            fs.writeFileSync(this.settingsFile, JSON.stringify(data, null, 2));
        } catch (err) {}
    }

    saveSettings(settings) {
        this.command = settings.command || this.command;
        this.prize = settings.prize || this.prize;
        this.maxWinners = typeof settings.maxWinners === 'number' && !isNaN(settings.maxWinners) ? settings.maxWinners : this.maxWinners;
        this.mode = settings.mode || this.mode;
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
            maxWinners: this.maxWinners,
            mode: this.mode,
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
            maxWinners: this.maxWinners,
            mode: this.mode,
            enabled: this.enabled,
            participants: Array.from(this.participants.values()).map(p => p.username),
            totalWinners: this.previousWinners.size
        };
    }

    start() {
        this.active = true;
        this.paused = false;
        this.participants.clear();
        this.saveSettingsToFile();
        this.broadcastState();
        return { success: true };
    }

    stop() {
        this.active = false;
        this.paused = false;
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
        this.saveSettingsToFile();
        return result;
    }

    resetWinners() {
        this.previousWinners.clear();
        this.participants.clear();
        this.active = false;
        this.paused = false;
        this.saveSettingsToFile();

        if (this.wss) {
            const state = {
                type: 'raffle_state',
                active: this.active,
                paused: this.paused,
                command: this.command,
                prize: this.prize,
                imageUrl: this.imageUrl,
                maxWinners: this.maxWinners,
                mode: this.mode,
                enabled: this.enabled,
                participants: Array.from(this.participants.values()).map(p => p.username),
                totalWinners: this.previousWinners.size,
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
            maxWinners: this.maxWinners,
            mode: this.mode,
            enabled: this.enabled,
            participants: Array.from(this.participants.values()).map(p => p.username),
            totalWinners: this.previousWinners.size
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
