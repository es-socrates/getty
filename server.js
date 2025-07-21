require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const SETTINGS_FILE = './tts-settings.json';

const LastTipModule = require('./modules/last-tip');
const TipWidgetModule = require('./modules/tip-widget');
const TipGoalModule = require('./modules/tip-goal');
const ChatModule = require('./modules/chat');
const ExternalNotifications = require('./modules/external-notifications');
const LanguageConfig = require('./modules/language-config');

const app = express();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "media-src 'self' https://cdn.streamlabs.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https://thumbs.odycdn.com https://thumbnails.odycdn.com https://odysee.com https://static.odycdn.com https://cdn.streamlabs.com https://twemoji.maxcdn.com; " + 
        "font-src 'self' data: blob: https://fonts.gstatic.com; " +
        "connect-src 'self' ws://" + req.get('host') + " wss://sockety.odysee.tv https://arweave.net https://api.coingecko.com https://api.telegram.org; " +
        "frame-src 'self'"
    );

    next();
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ noServer: true });

const lastTip = new LastTipModule(wss);
const tipWidget = new TipWidgetModule(wss);
const tipGoal = new TipGoalModule(wss);
const chat = new ChatModule(wss);
const externalNotifications = new ExternalNotifications(wss);
const languageConfig = new LanguageConfig();

function setupWebSocketListeners() {
    wss.removeAllListeners('tip');
    
    wss.on('tip', (tipData) => {
        console.log('[Main] Tip event received:', {
            from: tipData.from,
            amount: tipData.amount,
            source: tipData.source || 'direct'
        });
        
        externalNotifications.handleIncomingTip(tipData).catch(error => {
            console.error('[Main] Error processing tip:', error);
        });
    });
}

setupWebSocketListeners();

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            return {
                ttsEnabled: typeof settings.ttsEnabled === 'boolean' ? settings.ttsEnabled : true,
                ttsLanguage: settings.ttsLanguage || 'en'
            };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return { ttsEnabled: true, ttsLanguage: 'en' }; // Default language
}

function saveSettings(newSettings) {
    let current = {};
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error reading settings for merge:', error);
    }
    const merged = { ...current, ...newSettings };
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

app.get('/api/tts-setting', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsEnabled: settings.ttsEnabled });
});

app.post('/api/tts-setting', express.json(), (req, res) => {
    const { ttsEnabled } = req.body;
    saveSettings({ ttsEnabled: Boolean(ttsEnabled) });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ttsSettingUpdate',
                data: { ttsEnabled: Boolean(ttsEnabled) }
            }));
        }
    });
    
    res.json({ 
        success: true, 
        ttsEnabled: Boolean(ttsEnabled),
        message: "TTS setting updated successfully"
    });
});

app.get('/api/tts-language', (_req, res) => {
    const settings = loadSettings();
    res.json({ ttsLanguage: settings.ttsLanguage || 'en' });
});

app.post('/api/tts-language', express.json(), (req, res) => {
    const { ttsLanguage } = req.body;
    if (!ttsLanguage || (ttsLanguage !== 'en' && ttsLanguage !== 'es')) {
        return res.status(400).json({ success: false, error: 'Invalid ttsLanguage value' });
    }
    saveSettings({ ttsLanguage });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ttsLanguageUpdate',
                data: { ttsLanguage }
            }));
        }
    });
    res.json({ success: true, ttsLanguage, message: 'TTS language updated successfully' });
});

app.use(express.json());

app.post('/api/tts-setting', express.json(), (req, res) => {
    try {
        const { ttsEnabled } = req.body;
        
        res.json({ 
            success: true, 
            ttsEnabled: Boolean(ttsEnabled),
            message: "TTS setting updated successfully"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: "Internal server error",
            details: error.message 
        });
    }
});

app.post('/api/last-tip', (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    
    const result = lastTip.updateWalletAddress(walletAddress);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error updating wallet address:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.post('/api/tip-goal', (req, res) => {
  try {
    const { goalAmount, startingAmount } = req.body;
    
    if (!goalAmount || isNaN(goalAmount)) {
      return res.status(400).json({ error: "Valid goal amount is required" });
    }
    
    const result = tipGoal.updateGoal(goalAmount, startingAmount);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error updating tip goal:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.post('/api/chat', (req, res) => {
  try {
    const { chatUrl } = req.body;
    
    if (!chatUrl) {
      return res.status(400).json({ error: "Chat URL is required" });
    }
    
    const result = chat.updateChatUrl(chatUrl);
    res.json(result);
  } catch (error) {
    console.error('Error updating chat URL:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.post('/api/external-notifications', async (req, res) => {
  try {
    const { discordWebhook, telegramBotToken, telegramChatId, template } = req.body;
    
    if (!discordWebhook && !(telegramBotToken && telegramChatId)) {
      return res.status(400).json({ 
        error: "Either Discord webhook or Telegram credentials are required",
        success: false
      });
    }
    
    await externalNotifications.saveConfig({
      discordWebhook,
      telegramBotToken,
      telegramChatId,
      template: template || '🎉 New tip from {from}: {amount} AR (${usd}) - "{message}"'
    });
    
    res.json({ 
      success: true, 
      status: externalNotifications.getStatus(),
      message: "Settings saved successfully"
    });
  } catch (error) {
    console.error('Error saving external notifications config:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.get('/api/external-notifications', (req, res) => {
  res.json(externalNotifications.getStatus());
});

app.post('/api/test-tip', (req, res) => {
  try {
    const { amount, from, message } = req.body;
    if (typeof amount === 'undefined' || typeof from === 'undefined') {
      return res.status(400).json({ error: "Both amount and from are required" });
    }
    
    const donation = {
      amount: parseFloat(amount),
      from: String(from),
      message: message || '',
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'tip', data: donation }));
      }
    });
    
    externalNotifications.handleTip({
      ...donation,
      usd: (donation.amount * 5).toFixed(2)
    });
    
    res.json({ ok: true, sent: donation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/last-donation', (_req, res) => {
  const lastDonation = lastTip.getLastDonation();
  if (lastDonation) {
    res.json(lastDonation);
  } else {
    res.status(404).json({ error: "No donation found" });
  }
});

app.get('/widgets/persistent-notifications', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/persistent-notifications.html'));
});

app.get('/obs/widgets', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const widgets = {
    lastTip: {
      name: "Last Tip",
      url: `${baseUrl}/widgets/last-tip`,
      params: {
        position: "bottom-right",
        width: 380,
        height: 120
      }
    },
    tipGoal: {
      name: "Donation Goal",
      url: `${baseUrl}/widgets/tip-goal`,
      params: {
        position: "bottom-right",
        width: 280,
        height: 120
      }
    },
    tipNotification: {
      name: "Donation Notification",
      url: `${baseUrl}/widgets/tip-notification`,
      params: {
        position: "center",
        width: 380,
        height: 120,
        duration: 15
      }
    },
    chat: {
      name: "Live Chat",
      url: `${baseUrl}/widgets/chat`,
      params: {
        position: "top-right",
        width: 350,
        height: 500
      }
    },
    persistentNotifications: {
      name: "Persistent Notifications",
      url: `${baseUrl}/widgets/persistent-notifications`,
      params: {
        position: "top-left",
        width: 380,
        height: 500
      }
    }
  };
  
  res.json(widgets);
});

app.get('/widgets/last-tip', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/last-tip.html'));
});

app.get('/widgets/tip-goal', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/tip-goal.html'));
});

app.get('/widgets/tip-notification', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/tip-notification.html'));
});

app.get('/widgets/chat', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/widgets/chat.html'));
});

app.get('/obs-help', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/obs-integration.html'));
});

app.use(express.static('public'));

app.get('/api/modules', (_req, res) => {
  res.json({
    lastTip: lastTip.getStatus(),
    tipWidget: tipWidget.getStatus(),
    tipGoal: tipGoal.getStatus(),
    chat: chat.getStatus(),
    externalNotifications: externalNotifications.getStatus()
  });
});

app.get('/api/ar-price', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
        if (response.status !== 200) throw new Error('Failed to fetch from CoinGecko');
        res.json({ arweave: { usd: response.data.arweave.usd } });
    } catch (error) {
        console.error('Error fetching AR price:', error);
        res.status(500).json({ error: 'Failed to fetch AR price' });
    }
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      lastTip: lastTip.getLastDonation(),
      tipGoal: tipGoal.getGoalProgress(),
      persistentTips: externalNotifications.getStatus().lastTips
    }
  }));
  
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      console.log('Message from client:', msg);
    } catch (error) {
      console.error('Error parsing message from client:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

app.post('/api/test-discord', express.json(), async (req, res) => {
  try {
    const { from, amount } = req.body;
    const success = await externalNotifications.sendToDiscord({
      from: from || "test-user",
      amount: amount || 1,
      message: "Test notification",
      source: "test",
      timestamp: new Date().toISOString()
    });
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/language', (req, res) => {
  try {
    const currentLanguage = languageConfig.getLanguage();
    const availableLanguages = languageConfig.getAvailableLanguages();
    res.json({ 
      currentLanguage, 
      availableLanguages 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/language', express.json(), (req, res) => {
  try {
    const { language } = req.body;
    if (!language || !languageConfig.getAvailableLanguages().includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    const success = languageConfig.setLanguage(language);
    if (success) {
      res.json({ success: true, language });
    } else {
      res.status(500).json({ error: 'Failed to save language setting' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});