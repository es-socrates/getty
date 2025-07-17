const axios = require('axios');

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
    this.ARWEAVE_GATEWAY = 'https://arweave.net';
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.processedTxs = new Set();
    
    this.init();
  }
  
  init() {
    if (!this.walletAddress) {
      Logger.error('WALLET_ADDRESS is missing in .env');
      return;
    }
    
    Logger.info('Initializing Tip Widget Module', {
      walletAddress: this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4),
      gateway: this.ARWEAVE_GATEWAY
    });
    
    this.checkTransactions();
    setInterval(() => this.checkTransactions(), 30000);
  }
  
  async getAddressTransactions(address) {
    try {
      Logger.debug('Consulting transactions for address', address);
      
      const graphqlQuery = {
        query: `
          query GetTransactions($address: String!) {
            transactions(
              recipients: [$address]
              first: 10
              sort: HEIGHT_DESC
            ) {
              edges {
                node {
                  id
                  owner { address }
                  quantity { ar }
                  block { height timestamp }
                }
              }
            }
          }
        `,
        variables: { address }
      };
      
      Logger.debug('GraphQL query to be sent', graphqlQuery);

      const graphqlResponse = await axios.post(`${this.ARWEAVE_GATEWAY}/graphql`, graphqlQuery, { 
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (graphqlResponse.data?.data?.transactions?.edges) {
        Logger.debug('GraphQL response received', {
          edgeCount: graphqlResponse.data.data.transactions.edges.length
        });
        
        return graphqlResponse.data.data.transactions.edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner.address,
          target: address,
          quantity: edge.node.quantity.ar * 1e12,
          block: edge.node.block?.height,
          timestamp: edge.node.block?.timestamp
        }));
      }

      Logger.warn('Using REST API as a fallback for address', address);
      
      const restResponse = await axios.get(`${this.ARWEAVE_GATEWAY}/tx/history/${address}`, {
        timeout: 15000
      });
      
      if (Array.isArray(restResponse.data)) {
        Logger.debug('REST API response received', {
          transactionCount: restResponse.data.length
        });
        
        return restResponse.data.map(tx => ({
          id: tx.txid,
          owner: tx.owner,
          target: tx.target || '',
          quantity: tx.quantity,
          block: tx.block_height,
          timestamp: tx.block_timestamp
        }));
      }
      
      Logger.debug('No transactions found for address', address);
      return [];
    } catch (error) {
      Logger.error('Error in getAddressTransactions', error);
      
      if (error.response) {
        Logger.debug('API Error response', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
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
            message: '🎖️ The tip has been verified. Great!'
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
    
    Logger.info(`Notifications sent to ${clientsNotified} clients`);
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
  
  getStatus() {
    const status = {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      processedTxs: this.processedTxs.size,
      lastChecked: new Date().toISOString()
    };
    
    Logger.debug('Current module status', status);
    return status;
  }
}

module.exports = TipWidgetModule;