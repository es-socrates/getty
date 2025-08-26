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
    this.hosted = !!process.env.REDIS_URL;
    this.configFile = path.join(process.cwd(), 'config', 'external-notifications-config.json');
    this.legacyConfigFile = path.join(__dirname, 'external-notifications-config.json');
        this.lastTips = [];
        this.discordWebhook = process.env.DISCORD_WEBHOOK || '';
        this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
        this.template = 'New tip from {from}: {amount} AR (${usd}) - "{message}"';

        this.loadConfig();
    this.setupListeners();

        console.log('[ExternalNotifications] Initialized with WebSocket support');
    }

    async sendWithConfig(cfg, tip) {
        try {
            if (!cfg || !tip) return false;
            const usdValue = await this.calculateUsdValue(tip.amount);
            const formattedTip = {
                from: tip.from || 'Anonymous',
                amount: tip.amount,
                usd: usdValue,
                message: (tip.message || ''),
                source: tip.source || 'direct',
                timestamp: tip.timestamp || new Date().toISOString()
            };
            const template = cfg.template || this.template || 'New tip from {from}: {amount} AR (${usd}) - "{message}"';

            let ok = false;
            if (cfg.discordWebhook) {
                ok = (await this.sendToDiscord({ ...formattedTip, template }, cfg.discordWebhook)) || ok;
            }
            if (cfg.telegramBotToken && cfg.telegramChatId) {
                ok = (await this.sendToTelegram({ ...formattedTip, template }, cfg.telegramBotToken, cfg.telegramChatId)) || ok;
            }
            return ok;
        } catch { return false; }
    }

    getStatus() {
        return {
            active: this.discordWebhook || (this.telegramBotToken && this.telegramChatId),
            lastTips: this.hosted ? [] : this.lastTips.slice(0, 5),
            config: {
                hasDiscord: !!this.discordWebhook,
                hasTelegram: !!(this.telegramBotToken && this.telegramChatId),
                template: this.template
            },
            lastUpdated: new Date().toISOString()
        };
    }

    loadConfig() {
        try {
            if (!fs.existsSync(this.configFile) && fs.existsSync(this.legacyConfigFile)) {
                try {
                    const legacyData = fs.readFileSync(this.legacyConfigFile, 'utf8');
                    const legacyJson = JSON.parse(legacyData);
                    const cfgDir = path.dirname(this.configFile);
                    if (!fs.existsSync(cfgDir)) {
                        fs.mkdirSync(cfgDir, { recursive: true });
                    }
                    fs.writeFileSync(this.configFile, JSON.stringify(legacyJson, null, 2));
                    try { fs.unlinkSync(this.legacyConfigFile); } catch {}
                    console.log('[ExternalNotifications] Migrated config to /config');
                } catch (e) {
                    console.error('[ExternalNotifications] Migration failed:', e.message);
                }
            }

            if (fs.existsSync(this.configFile)) {
                const rawData = fs.readFileSync(this.configFile, 'utf8');
                const config = JSON.parse(rawData);
                
                if (!this.discordWebhook) this.discordWebhook = config.discordWebhook || '';
                if (!this.telegramBotToken) this.telegramBotToken = config.telegramBotToken || '';
                if (!this.telegramChatId) this.telegramChatId = config.telegramChatId || '';
                this.template = config.template || this.template;
                this.lastTips = config.lastTips || [];

                console.log('[ExternalNotifications] Config loaded:', {
                    hasDiscord: !!this.discordWebhook,
                    hasTelegram: !!(this.telegramBotToken && this.telegramChatId)
                });
            }
        } catch {
            console.error('[ExternalNotifications] Error loading config');
        }
    }

    async saveConfig(config) {
        try {
            const cfgDir = path.dirname(this.configFile);
            if (!fs.existsSync(cfgDir)) {
                fs.mkdirSync(cfgDir, { recursive: true });
            }
            if (!process.env.DISCORD_WEBHOOK && typeof config.discordWebhook === 'string') {
                this.discordWebhook = config.discordWebhook;
            }
            if (!process.env.TELEGRAM_BOT_TOKEN && typeof config.telegramBotToken === 'string') {
                this.telegramBotToken = config.telegramBotToken;
            }
            if (!process.env.TELEGRAM_CHAT_ID && typeof config.telegramChatId === 'string') {
                this.telegramChatId = config.telegramChatId;
            }
            this.template = config.template;

            const persistSecrets = !process.env.DISCORD_WEBHOOK && !process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_CHAT_ID;
            const filePayload = {
                template: this.template,
                lastTips: this.lastTips
            };
            if (persistSecrets) {
                filePayload.discordWebhook = this.discordWebhook;
                filePayload.telegramBotToken = this.telegramBotToken;
                filePayload.telegramChatId = this.telegramChatId;
            }

            fs.writeFileSync(this.configFile, JSON.stringify(filePayload, null, 2));
            console.log('[ExternalNotifications] Config saved', { persistedSecrets: persistSecrets });
        } catch {
            console.error('[ExternalNotifications] Error saving config');
            throw new Error('Save failed');
        }
    }

    setupListeners() {
    if (this.wss) {
            this.wss.removeAllListeners('tip');
            this.wss.on('tip', (tipData, _ns) => {
                console.log('Processing tip from:', tipData.from);
                this.handleIncomingTip(tipData).catch(err => {
                    console.error('Error processing tip:', err);
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

            if (!this.hosted) {
                this.lastTips.unshift(formattedTip);
                if (this.lastTips.length > 10) this.lastTips.pop();
            }

            if (!this.hosted) {
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
            }

        } catch (err) {
            console.error('[ExternalNotifications] Error processing tip:', err);
            throw err;
        }
    }

    async sendToDiscord(tipData, overrideWebhook) {
        const webhook = overrideWebhook || this.discordWebhook;
        if (!webhook) {
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
                    description: this.formatMessage(tipData, tipData.template),
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

            const response = await axios.post(webhook, payload, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status >= 400) {
                throw new Error(`Discord API error: ${response.status}`);
            }

            return true;
        } catch (e) {
            console.error('Failed to send to Discord:', {
                error: e.message,
                tipData: {
                    from: tipData.from,
                    amount: tipData.amount,
                    source: tipData.source
                },
                stack: e.stack
            });
            return false;
        }
    }

    async sendToTelegram(tipData, overrideBotToken, overrideChatId) {
        const token = overrideBotToken || this.telegramBotToken;
        const chatId = overrideChatId || this.telegramChatId;
        if (!token || !chatId) {
            return false;
        }

        try {
            const message = this.formatMessage(tipData, tipData.template);
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            
            await axios.post(url, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            
            return true;
        } catch (e) {
            console.error('[ExternalNotifications] Telegram error:', e.message);
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
        } catch {
            console.warn('[ExternalNotifications] Using fallback AR price (5 USD)');
            return (amount * 5).toFixed(2);
        }
    }

    formatMessage(tipData, tplOverride) {
        const tpl = typeof tplOverride === 'string' && tplOverride ? tplOverride : this.template;
        return tpl
            .replace('{from}', tipData.from || 'Anonymous')
            .replace('{amount}', tipData.amount)
            .replace('{usd}', tipData.usd || '?')
            .replace('{message}', tipData.message || 'No message');
    }
}

module.exports = ExternalNotifications;
