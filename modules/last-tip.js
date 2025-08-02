const axios = require('axios');
const WebSocket = require('ws');

class LastTipModule {
  constructor(wss) {
    this.wss = wss;
    this.ARWEAVE_GATEWAY = 'https://arweave.net';
    this.walletAddress = null;
    this.lastDonation = null;
    this.processedTxs = new Set();
    this.loadWalletAddress();
    this.init();
  }

  loadWalletAddress() {
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const lastTipConfigPath = path.join(configDir, 'last-tip-config.json');
    const lastTipDefault = {
      walletAddress: '',
      bgColor: '#080c10',
      fontColor: '#ffffff',
      borderColor: '#00ff7f',
      amountColor: '#00ff7f',
      iconColor: '#ca004b',
      fromColor: '#817ec8'
    };
    if (!fs.existsSync(lastTipConfigPath)) {
      fs.writeFileSync(lastTipConfigPath, JSON.stringify(lastTipDefault, null, 2));
      console.log('[LastTip] last-tip-config.json created with default values');
    }

    try {
      const config = JSON.parse(fs.readFileSync(lastTipConfigPath, 'utf8'));
      if (config.walletAddress) {
        this.walletAddress = config.walletAddress;
      }
    } catch (e) {
      console.error('[LastTip] Error reading wallet address from config:', e);
    }
  }
  
  init() {
    if (!this.walletAddress) {
      console.error('❌ ERROR: walletAddress is missing in last-tip-config.json');
      return;
    }
    this.updateLatestDonation();
    setInterval(() => this.updateLatestDonation(), 60000);
  }
  
  async getEnhancedTransactions(address) {
    let graphqlError = null;
    let restError = null;
    try {
      console.log(`[LastTip] Checking transactions for wallet: ${address}`);
      const graphqlResponse = await axios.post(`${this.ARWEAVE_GATEWAY}/graphql`, {
        query: `
          query {
            transactions(
              recipients: ["${address}"]
              first: 100
              sort: HEIGHT_DESC
            ) {
              edges {
                node {
                  id
                  owner { address }
                  quantity { ar }
                  block { timestamp }
                  tags { name value }
                }
              }
            }
          }
        `
      }, { timeout: 30000 });

      if (graphqlResponse.status) {
        console.log(`[LastTip] GraphQL response status: ${graphqlResponse.status}`);
      }
      if (graphqlResponse.data?.data?.transactions?.edges) {
        console.log(`[LastTip] GraphQL returned ${graphqlResponse.data.data.transactions.edges.length} edges`);
        return graphqlResponse.data.data.transactions.edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner.address,
          amount: edge.node.quantity.ar,
          timestamp: edge.node.block?.timestamp,
          tags: edge.node.tags
        }));
      }
    } catch (error) {
      graphqlError = error;
      console.warn('[LastTip] GraphQL request failed:', error.message);
    }

    try {
      console.log('⚠️ Using REST API as a fallback');
      const restResponse = await axios.get(`${this.ARWEAVE_GATEWAY}/tx/history/${address}`, {
        timeout: 30000
      });
      if (restResponse.status) {
        console.log(`[LastTip] REST response status: ${restResponse.status}`);
      }
      if (Array.isArray(restResponse.data)) {
        console.log(`[LastTip] REST returned ${restResponse.data.length} transactions`);
        return restResponse.data
          .filter(tx => tx.target === address)
          .map(tx => ({
            id: tx.txid,
            owner: tx.owner,
            amount: tx.quantity / 1e12,
            timestamp: tx.block_timestamp
          }));
      }
    } catch (error) {
      restError = error;
      console.warn('[LastTip] REST request failed:', error.message);
    }

    if (graphqlError && restError) {
      console.warn('[LastTip] Both GraphQL and REST requests failed. Skipping update until next interval.');
    }
    return [];
  }
  
  async findLatestDonation() {
    const transactions = await this.getEnhancedTransactions(this.walletAddress);
    
    if (transactions.length === 0) {
      console.log('ℹ️ No transactions found for address');
      return null;
    }

    const sortedTxs = transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    for (const tx of sortedTxs) {
      const amount = Number(tx.amount);
      if (!isNaN(amount) && amount > 0 && !this.processedTxs.has(tx.id)) {
        console.log(`✅ Found valid deposit: ${amount} AR from ${tx.owner.slice(0, 6)}...`);
        this.processedTxs.add(tx.id);
        return {
          from: tx.owner,
          amount: amount.toString(),
          txId: tx.id,
          timestamp: tx.timestamp
        };
      }
    }

    return null;
  }
  
  shouldUpdateDonation(newDonation) {
    if (!this.lastDonation) return true;
    return newDonation.txId !== this.lastDonation.txId;
  }
  
  async updateLatestDonation() {
    const donation = await this.findLatestDonation();
    if (donation && this.shouldUpdateDonation(donation)) {
      this.lastDonation = donation;
      this.notifyFrontend(donation);
    }
  }
  
  notifyFrontend(data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'lastTip',
          data: {
            from: data.from,
            amount: data.amount,
            txId: data.txId,
            timestamp: data.timestamp
          }
        }));
      }
    });
  }
  
  updateWalletAddress(newAddress) {
    this.walletAddress = newAddress;
    this.processedTxs = new Set();
    this.lastDonation = null;

    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'last-tip-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error('[LastTip] Error reading config for wallet update:', e);
      }
    }
    config.walletAddress = newAddress;
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('[LastTip] Error writing wallet address to config:', e);
    }
    this.updateLatestDonation();
    return this.getStatus();
  }
  
  getLastDonation() {
    return this.lastDonation || null;
  }
  
  getStatus() {
    return {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      lastChecked: new Date().toISOString(),
      lastDonation: this.lastDonation,
      processedTxs: this.processedTxs.size
    };
  }
}

module.exports = LastTipModule;
