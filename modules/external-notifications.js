const axios = require('axios');
const fs = require('fs');
const path = require('path');
const IS_TEST = process.env.NODE_ENV === 'test';
const __VERBOSE_EXT_NOTIF = process.env.GETTY_VERBOSE_EXTERNAL_NOTIFICATIONS === '1';

let tenantConfigLib = null;
function ensureTenantLib() {
  if (!tenantConfigLib) {
    try {
      tenantConfigLib = require('../lib/tenant-config');
    } catch {
      tenantConfigLib = {};
    }
  }
  return tenantConfigLib;
}

class ExternalNotifications {
  constructor(wss) {
    this.wss = wss;
    this.hosted = !!process.env.REDIS_URL;

    const resolvedConfigDir = process.env.GETTY_CONFIG_DIR
      ? path.isAbsolute(process.env.GETTY_CONFIG_DIR)
        ? process.env.GETTY_CONFIG_DIR
        : path.join(process.cwd(), process.env.GETTY_CONFIG_DIR)
      : path.join(process.cwd(), 'config');

    this.configFile = path.join(resolvedConfigDir, 'external-notifications-config.json');
    this.legacyConfigFile = path.join(__dirname, 'external-notifications-config.json');
    this.fallbackProcessCwdConfigFile = path.join(
      process.cwd(),
      'config',
      'external-notifications-config.json'
    );
    this.lastTips = [];
    this.discordWebhook = process.env.DISCORD_WEBHOOK || '';
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

    this.liveDiscordWebhook = process.env.LIVE_DISCORD_WEBHOOK || '';
    this.liveTelegramBotToken = process.env.LIVE_TELEGRAM_BOT_TOKEN || '';
    this.liveTelegramChatId = process.env.LIVE_TELEGRAM_CHAT_ID || '';
    this.template = 'New tip from {from}: {amount} AR (${usd}) - "{message}"';

    this.loadConfig();
    this.setupListeners();

    if (__VERBOSE_EXT_NOTIF)
      try {
        console.warn('[ExternalNotifications] Initialized with WebSocket support');
      } catch {}
  }

  async sendWithConfig(cfg, tip) {
    try {
      if (!cfg || !tip) return false;
      const usdValue = await this.calculateUsdValue(tip.amount);
      const formattedTip = {
        from: tip.from || 'Anonymous',
        amount: tip.amount,
        usd: usdValue,
        message: tip.message || '',
        source: tip.source || 'direct',
        timestamp: tip.timestamp || new Date().toISOString(),
      };
      const template =
        cfg.template || this.template || 'New tip from {from}: {amount} AR (${usd}) - "{message}"';

      let ok = false;
      if (cfg.discordWebhook) {
        ok = (await this.sendToDiscord({ ...formattedTip, template }, cfg.discordWebhook)) || ok;
      }
      if (cfg.telegramBotToken && cfg.telegramChatId) {
        ok =
          (await this.sendToTelegram(
            { ...formattedTip, template },
            cfg.telegramBotToken,
            cfg.telegramChatId
          )) || ok;
      }
      return ok;
    } catch {
      return false;
    }
  }

  getStatus() {
    return {
      active: this.discordWebhook || (this.telegramBotToken && this.telegramChatId),
      lastTips: this.hosted ? [] : this.lastTips.slice(0, 5),
      config: {
        hasDiscord: !!this.discordWebhook,
        hasTelegram: !!(this.telegramBotToken && this.telegramChatId),
        template: this.template,
        hasLiveDiscord: !!this.liveDiscordWebhook,
        hasLiveTelegram: !!(this.liveTelegramBotToken && this.liveTelegramChatId),
      },
      lastUpdated: new Date().toISOString(),
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
          try {
            fs.unlinkSync(this.legacyConfigFile);
          } catch {}
          if (__VERBOSE_EXT_NOTIF)
            try {
              console.warn('[ExternalNotifications] Migrated config to /config');
            } catch {}
        } catch (e) {
          console.error('[ExternalNotifications] Migration failed:', e.message);
        }
      }

      if (
        !fs.existsSync(this.configFile) &&
        this.fallbackProcessCwdConfigFile !== this.configFile &&
        fs.existsSync(this.fallbackProcessCwdConfigFile)
      ) {
        try {
          const raw = fs.readFileSync(this.fallbackProcessCwdConfigFile, 'utf8');
          if (!fs.existsSync(path.dirname(this.configFile)))
            fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
          fs.writeFileSync(this.configFile, raw);
          if (__VERBOSE_EXT_NOTIF)
            try {
              console.warn(
                '[ExternalNotifications] Adopted legacy config from default ./config directory'
              );
            } catch {}
        } catch {}
      }

      if (fs.existsSync(this.configFile)) {
        const rawData = fs.readFileSync(this.configFile, 'utf8');
        const config = JSON.parse(rawData);

        if (!this.discordWebhook) this.discordWebhook = config.discordWebhook || '';
        if (!this.telegramBotToken) this.telegramBotToken = config.telegramBotToken || '';
        if (!this.telegramChatId) this.telegramChatId = config.telegramChatId || '';
        if (!this.liveDiscordWebhook) this.liveDiscordWebhook = config.liveDiscordWebhook || '';
        if (!this.liveTelegramBotToken)
          this.liveTelegramBotToken = config.liveTelegramBotToken || '';
        if (!this.liveTelegramChatId) this.liveTelegramChatId = config.liveTelegramChatId || '';
        this.template = config.template || this.template;
        this.lastTips = config.lastTips || [];

        if (__VERBOSE_EXT_NOTIF) {
          try {
            console.warn('[ExternalNotifications] Config loaded:', {
              hasDiscord: !!this.discordWebhook,
              hasTelegram: !!(this.telegramBotToken && this.telegramChatId),
            });
          } catch {}
        }
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
      if (!process.env.LIVE_DISCORD_WEBHOOK && typeof config.liveDiscordWebhook === 'string') {
        this.liveDiscordWebhook = config.liveDiscordWebhook;
      }
      if (!process.env.LIVE_TELEGRAM_BOT_TOKEN && typeof config.liveTelegramBotToken === 'string') {
        this.liveTelegramBotToken = config.liveTelegramBotToken;
      }
      if (!process.env.LIVE_TELEGRAM_CHAT_ID && typeof config.liveTelegramChatId === 'string') {
        this.liveTelegramChatId = config.liveTelegramChatId;
      }
      this.template = config.template;

      const persistSecrets =
        !process.env.DISCORD_WEBHOOK &&
        !process.env.TELEGRAM_BOT_TOKEN &&
        !process.env.TELEGRAM_CHAT_ID &&
        !process.env.LIVE_DISCORD_WEBHOOK &&
        !process.env.LIVE_TELEGRAM_BOT_TOKEN &&
        !process.env.LIVE_TELEGRAM_CHAT_ID;
      const filePayload = {
        template: this.template,
        lastTips: this.lastTips,
      };
      if (persistSecrets) {
        filePayload.discordWebhook = this.discordWebhook;
        filePayload.telegramBotToken = this.telegramBotToken;
        filePayload.telegramChatId = this.telegramChatId;
        filePayload.liveDiscordWebhook = this.liveDiscordWebhook;
        filePayload.liveTelegramBotToken = this.liveTelegramBotToken;
        filePayload.liveTelegramChatId = this.liveTelegramChatId;
      }

      fs.writeFileSync(this.configFile, JSON.stringify(filePayload, null, 2));
      if (!IS_TEST && __VERBOSE_EXT_NOTIF)
        try {
          console.warn('[ExternalNotifications] Config saved', {
            persistedSecrets: persistSecrets,
          });
        } catch {}
    } catch {
      console.error('[ExternalNotifications] Error saving config');
      throw new Error('Save failed');
    }
  }

  setupListeners() {
    if (this.wss) {
      this.wss.removeAllListeners('tip');
      this.wss.on('tip', (tipData, ns) => {
        if (__VERBOSE_EXT_NOTIF)
          try {
            console.warn(
              '[ExternalNotifications] Processing tip from:',
              tipData.from,
              'ns=',
              ns || null
            );
          } catch {}
        this.handleIncomingTip(tipData, ns || null).catch((err) => {
          console.error('Error processing tip:', err);
        });
      });
    }
  }

  async handleIncomingTip(tipData, ns) {
    if (!tipData || !tipData.amount) {
      try {
        console.warn('[ExternalNotifications] Invalid tip data received');
      } catch {}
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
        timestamp: tipData.timestamp || new Date().toISOString(),
      };

      const isTenant = !!ns;
      if (isTenant) {
        const { loadTenantConfig, saveTenantConfig } = ensureTenantLib();
        const reqLike = { ns: { admin: ns } };
        let loaded = null;
        try {
          loaded = await loadTenantConfig(
            reqLike,
            null,
            require('path').join(process.cwd(), 'config', 'external-notifications-config.json'),
            'external-notifications-config.json'
          );
        } catch {}
        const data = loaded && loaded.data ? loaded.data : {};
        if (!Array.isArray(data.lastTips)) data.lastTips = [];
        data.lastTips.unshift(formattedTip);
        if (data.lastTips.length > 10) data.lastTips.splice(10);
        try {
          await saveTenantConfig(
            reqLike,
            null,
            require('path').join(process.cwd(), 'config', 'external-notifications-config.json'),
            'external-notifications-config.json',
            data
          );
        } catch (e) {
          if (!IS_TEST)
            console.error('[ExternalNotifications] save tenant lastTips failed', e.message);
        }
      } else {
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
            template: this.template,
            lastTips: this.lastTips,
          });
        }
      }
    } catch (err) {
      console.error('[ExternalNotifications] Error processing tip:', err);
      throw err;
    }
  }

  async sendToDiscord(tipData, overrideWebhook) {
    const webhook = overrideWebhook || this.discordWebhook;
    if (!webhook) {
      try {
        console.warn('Discord webhook not configured');
      } catch {}
      return false;
    }

    try {
      if (!tipData.amount || isNaN(tipData.amount)) {
        throw new Error('Invalid tip amount');
      }

      const payload = {
        embeds: [
          {
            title: `New tip ${tipData.source === 'chat' ? 'received. Woohoo!' : 'Direct'}`,
            description: this.formatMessage(tipData, tipData.template),
            color: tipData.source === 'chat' ? 0x5865f2 : 0x00ff7f,
            fields: [
              { name: 'From:', value: tipData.from || 'Anonymous', inline: true },
              { name: 'Amount', value: `${tipData.amount} AR ($${tipData.usd})`, inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'getty' },
          },
        ],
        username: 'getty',
        avatar_url:
          'https://thumbs.odycdn.com/43f53f554e4a85240564f8ff794eb60e.webp?override=' + Date.now(),
      };

      const response = await axios.post(webhook, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status >= 400) {
        throw new Error(`Discord API error: ${response.status}`);
      }

      return true;
    } catch (e) {
      if (!IS_TEST) {
        console.error('Failed to send to Discord:', {
          error: e.message,
          tipData: {
            from: tipData.from,
            amount: tipData.amount,
            source: tipData.source,
          },
          stack: e.stack,
        });
      }
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
        parse_mode: 'HTML',
      });

      return true;
    } catch (e) {
      if (!IS_TEST) console.error('[ExternalNotifications] Telegram error:', e.message);
      return false;
    }
  }

  async calculateUsdValue(amount) {
    try {
      const response = await axios.get('http://localhost:3000/api/ar-price', {
        timeout: 3000,
      });

      const rate = response.data?.arweave?.usd || 5;
      return (amount * rate).toFixed(2);
    } catch {
      if (!IS_TEST)
        try {
          console.warn('[ExternalNotifications] Using fallback AR price (5 USD)');
        } catch {}
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

  async sendLiveToDiscord(payload, overrideWebhook) {
    const webhook = overrideWebhook || this.liveDiscordWebhook;
    if (!webhook) return false;
    try {
      const { title, description, channelUrl, imageUrl, signature } = payload;

      let finalImage = imageUrl;
      let ogTitle = '';
      let themeColorHex = '';
      let siteName = '';
      let providerIcon = '';
      if ((!finalImage || !ogTitle) && channelUrl) {
        try {
          const u = new URL(channelUrl);
          const allowedHosts = new Set(['odysee.com', 'www.odysee.com']);
          if (!allowedHosts.has(u.hostname)) throw new Error('host_not_allowed');
          const r = await axios.get(channelUrl, { timeout: 3500 });
          const html = String(r.data || '');
          const matchFirst = (patterns) => {
            for (const pattern of patterns) {
              const mm = html.match(pattern);
              if (mm && mm[1]) return mm[1];
            }
            return '';
          };
          const imgRaw = matchFirst([
            /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
            /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
            /<meta[^>]+name=["']twitter:player:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player:image["'][^>]*>/i,
          ]);
          ogTitle = matchFirst([
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
            /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
          ]);
          themeColorHex = matchFirst([
            /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["'][^>]*>/i,
          ]);
          siteName =
            matchFirst([
              /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            ]) || u.hostname;
          if (/^odysee\.com$/i.test(u.hostname) || /^www\.odysee\.com$/i.test(u.hostname)) {
            providerIcon = 'https://odysee.com/public/favicon_128.png';
          }
          let img = imgRaw || '';
          if (img && !/^https?:\/\//i.test(img)) {
            img = `${u.origin}${img.startsWith('/') ? '' : '/'}${img}`;
          }
          const imgHost = img ? new URL(img).hostname : '';
          const allowedImgHosts = new Set([
            'thumbs.odycdn.com',
            'thumbnails.odycdn.com',
            'static.odycdn.com',
            'odysee.com',
            'www.odysee.com',
          ]);
          if (img && allowedImgHosts.has(imgHost)) finalImage = img;

          if (
            (!finalImage || !ogTitle) &&
            (u.hostname === 'odysee.com' || u.hostname === 'www.odysee.com')
          ) {
            try {
              const oembedUrl = `https://odysee.com/$/oembed?url=${encodeURIComponent(channelUrl)}&format=json`;
              const or = await axios.get(oembedUrl, { timeout: 3500 });
              const data = or.data || {};
              if (!finalImage && data.thumbnail_url) {
                try {
                  const ih = new URL(data.thumbnail_url).hostname;
                  if (allowedImgHosts.has(ih)) finalImage = data.thumbnail_url;
                } catch {}
              }
              if (!ogTitle && data.title) ogTitle = String(data.title);
              if (!siteName && data.provider_name) siteName = String(data.provider_name);
            } catch {}
          }
        } catch {}
      }

      const safeImage = (url) => {
        try {
          const u = new URL(url);
          return u.protocol === 'http:' || u.protocol === 'https:' ? url : undefined;
        } catch {
          return undefined;
        }
      };
      const colorFromTheme = (() => {
        const hex = (themeColorHex || '').trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(hex)) {
          const h = hex.startsWith('#') ? hex.slice(1) : hex;
          return parseInt(h, 16);
        }

        if (providerIcon && /odysee\.com/.test(providerIcon)) {
          return parseInt('ca004b', 16);
        }
        return undefined;
      })();
      const embed = {
        author:
          siteName || providerIcon
            ? { name: siteName || 'Odysee', icon_url: providerIcon || undefined }
            : undefined,
        title: (title || ogTitle || 'We are live on Odysee! 🎬').slice(0, 150),
        description: (description || '').slice(0, 200),
        url: channelUrl,
        color: colorFromTheme,
        image: finalImage ? { url: safeImage(finalImage) } : undefined,
        thumbnail: providerIcon ? { url: providerIcon } : undefined,
        footer: signature ? { text: String(signature).slice(0, 80) } : undefined,
        timestamp: new Date().toISOString(),
      };

      Object.keys(embed).forEach((k) => embed[k] === undefined && delete embed[k]);
      const embeds = [embed];

      if (finalImage && /^\/uploads\/live-announcements\//.test(finalImage)) {
        const FormData = require('form-data');
        const fd = new FormData();
        const filePath = path.join(process.cwd(), 'public', finalImage.replace(/^\//, ''));
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

        embeds[0].image = { url: `attachment://${fileName}` };
        const jsonPayload = { username: 'getty', content: channelUrl || '', embeds };
        fd.append('payload_json', JSON.stringify(jsonPayload));
        fd.append('files[0]', fs.createReadStream(filePath), {
          filename: fileName,
          contentType: mime,
        });
        const res = await axios.post(webhook, fd, {
          headers: fd.getHeaders(),
          timeout: 12000,
          maxBodyLength: Infinity,
          validateStatus: () => true,
        });
        if (res.status >= 400) {
          console.error(
            '[ExternalNotifications] Live Discord multipart error:',
            res.status,
            res.data && (res.data.message || JSON.stringify(res.data)).slice(0, 200)
          );
          return false;
        }
        return true;
      }

      const body = { username: 'getty', content: channelUrl || '', embeds };
      const res = await axios.post(webhook, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 7000,
        validateStatus: () => true,
      });
      if (res.status >= 400) {
        console.error(
          '[ExternalNotifications] Live Discord JSON error:',
          res.status,
          res.data && (res.data.message || JSON.stringify(res.data)).slice(0, 200)
        );
        return false;
      }
      return true;
    } catch (e) {
      console.error('[ExternalNotifications] Live Discord error:', e.message);
      return false;
    }
  }

  async sendLiveToTelegram(payload, overrideBotToken, overrideChatId) {
    const token = overrideBotToken || this.liveTelegramBotToken;
    const chatId = overrideChatId || this.liveTelegramChatId;
    if (!token || !chatId) return false;
    try {
      const { title, description, channelUrl, imageUrl, signature } = payload;
      const textParts = [
        title ? `<b>${escapeHtml(title.slice(0, 150))}</b>` : '<b>We are live on Odysee! 🎬</b>',
        description ? `${escapeHtml(description.slice(0, 200))}` : '',
        channelUrl ? `\n<a href="${escapeHtml(channelUrl)}">${escapeHtml(channelUrl)}</a>` : '',
      ].filter(Boolean);
      if (signature) textParts.push(`\n<em>${escapeHtml(String(signature).slice(0, 80))}</em>`);
      const text = textParts.join('\n\n');
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: imageUrl ? true : false,
      });
      if (imageUrl) {
        const photoUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
        await axios.post(photoUrl, { chat_id: chatId, photo: imageUrl, caption: undefined });
      }
      return true;
    } catch (e) {
      console.error('[ExternalNotifications] Live Telegram error:', e.message);
      return false;
    }
  }

  async sendLiveWithConfig(cfg, payload) {
    try {
      let ok = false;
      const overrideDiscord =
        payload && typeof payload.discordWebhook === 'string' && payload.discordWebhook
          ? payload.discordWebhook
          : '';
      if (overrideDiscord) {
        ok = (await this.sendLiveToDiscord(payload, overrideDiscord)) || ok;
      } else if (cfg.liveDiscordWebhook) {
        ok = (await this.sendLiveToDiscord(payload, cfg.liveDiscordWebhook)) || ok;
      }
      if (cfg.liveTelegramBotToken && cfg.liveTelegramChatId)
        ok =
          (await this.sendLiveToTelegram(
            payload,
            cfg.liveTelegramBotToken,
            cfg.liveTelegramChatId
          )) || ok;
      return ok;
    } catch {
      return false;
    }
  }
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (m) => map[m] || m);
}

module.exports = ExternalNotifications;
