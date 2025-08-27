const axios = require('axios');
const { getWalletAddress } = require('./tip-goal');

const COLORS = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  success: '\x1b[32m',  // Green
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  reset: '\x1b[0m',     // Reset
  timestamp: '\x1b[90m' // Gray
};

class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColor = COLORS[level] || COLORS.info;
    const levelText = level.toUpperCase().padEnd(7);
    
    let logMessage = `${COLORS.timestamp}[${timestamp}]${COLORS.reset} ${levelColor}${levelText}${COLORS.reset} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    }
    
    console.log(logMessage);
  }

  static debug(message, data = null) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, data);
    }
  }

  static info(message, data = null) {
    this.log('info', message, data);
  }

  static success(message, data = null) {
    this.log('success', message, data);
  }

  static warn(message, data = null) {
    this.log('warn', message, data);
  }

  static error(message, error = null) {
    let errorData = null;
    
    if (error instanceof Error) {
      errorData = {
        message: error.message,
        stack: process.env.LOG_LEVEL === 'debug' ? error.stack : undefined
      };
    } else if (error) {
      errorData = error;
    }
    
    this.log('error', message, errorData);
  }
}

class TipWidgetModule {
  constructor(wss) {
    this.wss = wss;
    this.ttsEnabled = true; // Default value
    this.ARWEAVE_GATEWAYS = [
      'https://arweave.net',
      'https://ar-io.net',
      'https://arweave.live',
      'https://arweave-search.goldsky.com'
    ];
    if (process.env.TIP_WIDGET_EXTRA_GATEWAYS) {
      try {
        const extra = String(process.env.TIP_WIDGET_EXTRA_GATEWAYS)
          .split(',').map(s=>s.trim()).filter(Boolean)
          .map(s => (s.startsWith('http') ? s : `https://${s}`)).map(u=>u.replace(/\/$/, ''));
        this.ARWEAVE_GATEWAYS.push(...extra);
      } catch {}
    }
    this.ARWEAVE_GATEWAYS = Array.from(new Set(this.ARWEAVE_GATEWAYS));
    this.GRAPHQL_TIMEOUT = Number(process.env.TIP_WIDGET_GRAPHQL_TIMEOUT_MS || 10000);
    this.walletAddress = getWalletAddress();
    this.processedTxs = new Set();
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }
  
  init() {
    if (!this.walletAddress) {
      Logger.error('walletAddress is missing in configuration file');
      return;
    }
    Logger.info('Initializing Tip Widget Module', {
      walletAddress: this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4),
      gateways: this.ARWEAVE_GATEWAYS
    });
    this.checkTransactions();
    if (process.env.NODE_ENV !== 'test') {
      setInterval(() => this.checkTransactions(), 30000);
    }
  }
  
  async getAddressTransactions(address) {
    try {
      Logger.debug('Consulting transactions for address', address);
      const query = `
        query($recipients: [String!]) {
          transactions(recipients: $recipients, first: 10, sort: HEIGHT_DESC) {
            edges { node { id owner { address } quantity { ar } block { height timestamp } } }
          }
        }
      `;

      const tryGateway = async (gw) => {
        const resp = await axios.post(`${gw}/graphql`, { query, variables: { recipients: [address] } }, { timeout: this.GRAPHQL_TIMEOUT });
        const edges = resp.data?.data?.transactions?.edges || [];
        return edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner?.address,
          target: address,
          quantity: Number(edge.node.quantity?.ar) * 1e12,
          block: edge.node.block?.height,
          timestamp: edge.node.block?.timestamp
        }));
      };

      const gws = this.ARWEAVE_GATEWAYS.slice();
      let results = [];
      if (typeof Promise.any === 'function') {
        try { results = await Promise.any(gws.map(g => tryGateway(g))); } catch {}
      } else {
        for (const g of gws) { try { results = await tryGateway(g); break; } catch {} }
      }

      if (Array.isArray(results) && results.length) return results;
      Logger.warn('All GraphQL gateways failed for address', address);
      return [];
    } catch (error) {
      Logger.error('Error in getAddressTransactions', error);
      return [];
    }
  }
  
  async checkTransactions() {
    try {
      Logger.info(`Checking transactions for wallet ${this.walletAddress.slice(0, 6)}...`);
      
      const txs = await this.getAddressTransactions(this.walletAddress);
      
      if (txs.length === 0) {
        Logger.info('No transactions found. Have AR been sent to this address?');
        return;
      }

      Logger.debug(`Found ${txs.length} transactions to process`);
      
      for (const tx of txs) {
        if (!tx.id || this.processedTxs.has(tx.id)) {
          Logger.debug('Skipping already processed transaction', tx.id?.slice(0, 8) + '...');
          continue;
        }
        
        if (tx.target === this.walletAddress && tx.quantity) {
          const amount = (tx.quantity / 1e12).toFixed(6);
          this.processedTxs.add(tx.id);
          
          Logger.success(`New transaction detected: ${amount} AR`, {
            from: tx.owner.slice(0, 6) + '...',
            txId: tx.id.slice(0, 8) + '...',
            block: tx.block,
            timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending'
          });
          
          this.notifyFrontend({
            from: tx.owner,
            amount: amount,
            txId: tx.id,
            message: '✅ The tip has been verified. Great!'
          });
        }
      }
    } catch (error) {
      Logger.error('Error in checkTransactions', error);
    }
  }
  
  notifyFrontend(data) {
      if (!this.wss || typeof this.wss.clients === 'undefined') {
          Logger.error('WebSocket server not properly initialized');
          return;
      }
      
      if (this.processedTxs.has(data.txId)) {
          Logger.debug('Transaction already notified, skipping', data.txId);
          return;
      }

      let clientsNotified = 0;
      
    const hosted = !!process.env.REDIS_URL;
    if (!hosted) {
    this.wss.clients.forEach(client => {
      const isOpen = client.readyState === (client.OPEN || 1);
      if (isOpen) {
        try {
          const notification = {
            type: 'tipNotification',
            data: {
              from: data.from,
              amount: data.amount,
              txId: data.txId,
              message: data.message,
              timestamp: new Date().toISOString()
            }
          };
                    
          client.send(JSON.stringify(notification));
          clientsNotified++;
                    
          Logger.debug('Notification sent to client', {
            notificationType: notification.type,
            clientState: client.readyState
          });
        } catch (error) {
          Logger.error('Error sending notification to client', error);
        }
      }
    });
    }
      
    try {
        if (this.wss && typeof this.wss.emit === 'function') {
            const eventData = {
                from: data.from,
                amount: data.amount,
                txId: data.txId,
                message: data.message || 'Direct AR transfer',
                source: 'direct',
                timestamp: data.timestamp || new Date().toISOString()
            };
            
            try {
              const ns = null;
              this.wss.emit('tip', eventData, ns);
            } catch {}
            
            Logger.debug('Tip Event issued', {
                eventData: eventData,
                clients: this.wss.clients.size
            });
        } else {
            Logger.error('WebSocket Server is not available to broadcast events');
        }
    } catch (error) {
        Logger.error('Critical error when issuing event tip', {
            error: error.message,
            stack: error.stack
        });
    }
}
  
  updateWalletAddress(newAddress) {
    Logger.info('Updating wallet address', {
      oldAddress: this.walletAddress ? this.walletAddress.slice(0, 6) + '...' : 'none',
      newAddress: newAddress.slice(0, 6) + '...'
    });
    
    this.walletAddress = newAddress;
    this.processedTxs = new Set();
    process.env.WALLET_ADDRESS = newAddress;
    this.checkTransactions();
    
    return this.getStatus();
  }

  updateTTSStatus(enabled) {
      this.ttsEnabled = enabled;
      Logger.info(`TTS setting updated: ${enabled ? 'ENABLED' : 'DISABLED'}`);
      
      this.broadcastTTSStatus();
  }

  broadcastTTSStatus() {
      if (!this.wss || typeof this.wss.clients === 'undefined') {
          Logger.error('WebSocket server not properly initialized');
          return;
      }

      this.wss.clients.forEach(client => {
          if (client.readyState === (client.OPEN || 1)) {
              client.send(JSON.stringify({
                  type: 'ttsSettingUpdate',
                  data: { ttsEnabled: this.ttsEnabled }
              }));
          }
      });
  }
  
  getStatus() {
    const status = {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      processedTxs: this.processedTxs.size,
      lastChecked: new Date().toISOString(),
      ttsEnabled: this.ttsEnabled
    };
    
    Logger.debug('Current module status', status);
    return status;
  }
}

module.exports = TipWidgetModule;
