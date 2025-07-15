require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const LastTipModule = require('./modules/last-tip');
const TipWidgetModule = require('./modules/tip-widget');
const TipGoalModule = require('./modules/tip-goal');
const ChatModule = require('./modules/chat');

const app = express();
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; media-src 'self' https://cdn.streamlabs.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: https://thumbs.odycdn.com https://thumbnails.odycdn.com https://odysee.com https://static.odycdn.com; " +
        "font-src 'self' data: blob: https://fonts.gstatic.com; " +
        "connect-src 'self' ws://" + req.get('host') + " wss://sockety.odysee.tv https://arweave.net https://api.coingecko.com; " +
        "frame-src 'self'"
    );
    next();
});
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor unificado ejecutándose en http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ noServer: true });

const lastTip = new LastTipModule(wss);
const tipWidget = new TipWidgetModule(wss);
const tipGoal = new TipGoalModule(wss);
const chat = new ChatModule(wss);

app.post('/api/last-tip', express.json(), (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    
    const result = lastTip.updateWalletAddress(walletAddress);
    res.json(result);
  } catch (error) {
    console.error('Error updating wallet address:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.post('/api/tip-goal', express.json(), (req, res) => {
  try {
    const { goalAmount, startingAmount } = req.body;
    
    if (!goalAmount || isNaN(goalAmount)) {
      return res.status(400).json({ error: "Valid goal amount is required" });
    }
    
    const result = tipGoal.updateGoal(goalAmount, startingAmount);
    res.json(result);
  } catch (error) {
    console.error('Error updating tip goal:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

app.post('/api/chat', express.json(), (req, res) => {
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

app.post('/api/test-tip', express.json(), (req, res) => {
  try {
    const { amount, from } = req.body;
    if (typeof amount === 'undefined' || typeof from === 'undefined') {
      return res.status(400).json({ error: "Both amount and from are required" });
    }
    
    const donation = {
      amount: parseFloat(amount),
      from: String(from),
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'tip', data: donation }));
      }
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
    }
  };
  
  res.json(widgets);
});

// Rutas para los widgets individuales
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

app.use(express.json());
app.get('/api/modules', (_req, res) => {
  res.json({
    lastTip: lastTip.getStatus(),
    tipWidget: tipWidget.getStatus(),
    tipGoal: tipGoal.getStatus(),
    chat: chat.getStatus()
  });
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  console.log('Nueva conexión WebSocket');
  
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      lastTip: lastTip.getLastDonation(),
      tipGoal: tipGoal.getGoalProgress()
    }
  }));
  
  ws.on('close', () => {
    console.log('Conexión WebSocket cerrada');
  });
});
