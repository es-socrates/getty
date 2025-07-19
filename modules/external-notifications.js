const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Logger = {
    debug: (...args) => console.log('[DEBUG]', ...args),
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

class ExternalNotifications {
    constructor(wss) {
        this.wss = wss;
        this.configFile = path.join(__dirname, 'external-notifications-config.json');
        this.lastTips = [];
        this.discordWebhook = '';
        this.telegramBotToken = '';
        this.telegramChatId = '';
        this.template = 'New tip from {from}: {amount} AR (${usd}) - "{message}"';

        this.loadConfig();
        this.setupListeners();

        console.log('[ExternalNotifications] Initialized with WebSocket support');
    }

    getStatus() {
        return {
            active: this.discordWebhook || (this.telegramBotToken && this.telegramChatId),
            lastTips: this.lastTips.slice(0, 5),
            config: {
                hasDiscord: !!this.discordWebhook,
                hasTelegram: !!(this.telegramBotToken && this.telegramChatId),
                discordWebhook: this.discordWebhook,
                telegramBotToken: this.telegramBotToken,
                telegramChatId: this.telegramChatId,
                template: this.template
            },
            lastUpdated: new Date().toISOString()
        };
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const rawData = fs.readFileSync(this.configFile, 'utf8');
                const config = JSON.parse(rawData);
                
                this.discordWebhook = config.discordWebhook || '';
                this.telegramBotToken = config.telegramBotToken || '';
                this.telegramChatId = config.telegramChatId || '';
                this.template = config.template || this.template;
                this.lastTips = config.lastTips || [];

                console.log('[ExternalNotifications] Config loaded:', {
                    hasDiscord: !!this.discordWebhook,
                    hasTelegram: !!(this.telegramBotToken && this.telegramChatId)
                });
            }
        } catch (error) {
            console.error('[ExternalNotifications] Error loading config:', error);
        }
    }

    async saveConfig(config) {
        try {
            const data = JSON.stringify({
                discordWebhook: config.discordWebhook,
                telegramBotToken: config.telegramBotToken,
                telegramChatId: config.telegramChatId,
                template: config.template,
                lastTips: this.lastTips
            }, null, 2);

            fs.writeFileSync(this.configFile, data);
            console.log('[ExternalNotifications] Config saved');

            this.discordWebhook = config.discordWebhook;
            this.telegramBotToken = config.telegramBotToken;
            this.telegramChatId = config.telegramChatId;
            this.template = config.template;
        } catch (error) {
            console.error('[ExternalNotifications] Error saving config:', error);
            throw error;
        }
    }

    setupListeners() {
        if (this.wss) {
            this.wss.removeAllListeners('tip');
            this.wss.on('tip', (tipData) => {
                console.log('Processing tip from:', tipData.from);
                this.handleIncomingTip(tipData).catch(error => {
                    console.error('Error processing tip:', error);
                });
            });
        }
    }

    async handleIncomingTip(tipData) {
        if (!tipData || !tipData.amount) {
            console.warn('[ExternalNotifications] Invalid tip data received');
            return;
        }

        function removeEmojisAndCodes(text) {
            if (!text) return '';
            const noUnicode = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
            return noUnicode.replace(/:[a-zA-Z0-9_]+:/g, '');
        }

        try {
            const usdValue = await this.calculateUsdValue(tipData.amount);
            const formattedTip = {
                from: tipData.from || 'Anonymous',
                amount: tipData.amount,
                usd: usdValue,
                message: removeEmojisAndCodes(tipData.message || ''),
                source: tipData.source || 'direct',
                timestamp: tipData.timestamp || new Date().toISOString()
            };

            this.lastTips.unshift(formattedTip);
            if (this.lastTips.length > 10) this.lastTips.pop();

            if (this.discordWebhook) {
                await this.sendToDiscord(formattedTip);
            }

            if (this.telegramBotToken && this.telegramChatId) {
                await this.sendToTelegram(formattedTip);
            }

            await this.saveConfig({
                discordWebhook: this.discordWebhook,
                telegramBotToken: this.telegramBotToken,
                telegramChatId: this.telegramChatId,
                template: this.template
            });

        } catch (error) {
            console.error('[ExternalNotifications] Error processing tip:', error);
            throw error;
        }
    }

    async sendToDiscord(tipData) {
        if (!this.discordWebhook) {
            console.warn('Discord webhook not configured');
            return false;
        }

        try {
            if (!tipData.amount || isNaN(tipData.amount)) {
                throw new Error('Invalid tip amount');
            }

            const payload = {
                embeds: [{
                    title: `New tip ${tipData.source === 'chat' ? 'received. Woohoo!' : 'Direct'}`,
                    description: this.formatMessage(tipData),
                    color: tipData.source === 'chat' ? 0x5865F2 : 0x00FF7F,
                    fields: [
                        { name: "From:", value: tipData.from || 'Anonymous', inline: true },
                        { name: "Amount", value: `${tipData.amount} AR ($${tipData.usd})`, inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Getty" }
                }],
                username: "Getty",
                avatar_url: "https://thumbs.odycdn.com/43f53f554e4a85240564f8ff794eb60e.webp?override=" + Date.now()
            };

            const response = await axios.post(this.discordWebhook, payload, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status >= 400) {
                throw new Error(`Discord API error: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to send to Discord:', {
                error: error.message,
                tipData: {
                    from: tipData.from,
                    amount: tipData.amount,
                    source: tipData.source
                },
                stack: error.stack
            });
            return false;
        }
    }

    async sendToTelegram(tipData) {
        if (!this.telegramBotToken || !this.telegramChatId) {
            return false;
        }

        try {
            const message = this.formatMessage(tipData);
            const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
            
            await axios.post(url, {
                chat_id: this.telegramChatId,
                text: message,
                parse_mode: 'HTML'
            });
            
            return true;
        } catch (error) {
            console.error('[ExternalNotifications] Telegram error:', error.message);
            return false;
        }
    }

    async calculateUsdValue(amount) {
        try {
            const response = await axios.get('http://localhost:3000/api/ar-price', {
                timeout: 3000
            });
            
            const rate = response.data?.arweave?.usd || 5;
            return (amount * rate).toFixed(2);
        } catch (error) {
            console.warn('[ExternalNotifications] Using fallback AR price (5 USD)');
            return (amount * 5).toFixed(2);
        }
    }

    formatMessage(tipData) {
        return this.template
            .replace('{from}', tipData.from || 'Anonymous')
            .replace('{amount}', tipData.amount)
            .replace('{usd}', tipData.usd || '?')
            .replace('{message}', tipData.message || 'No message');
    }
}

module.exports = ExternalNotifications;