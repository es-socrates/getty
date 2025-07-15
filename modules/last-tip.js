const axios = require('axios');
const WebSocket = require('ws');

class LastTipModule {
  constructor(wss) {
    this.wss = wss;
    this.ARWEAVE_GATEWAY = 'https://arweave.net';
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.lastDonation = null;
    this.processedTxs = new Set();
    
    this.init();
  }
  
  init() {
    if (!this.walletAddress) {
      console.error('❌ ERROR: WALLET_ADDRESS is missing in .env');
      return;
    }
    
    this.updateLatestDonation();
    setInterval(() => this.updateLatestDonation(), 60000);
  }
  
  async getEnhancedTransactions(address) {
    try {
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
      }, { timeout: 15000 });

      if (graphqlResponse.data?.data?.transactions?.edges) {
        return graphqlResponse.data.data.transactions.edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner.address,
          amount: edge.node.quantity.ar,
          timestamp: edge.node.block?.timestamp,
          tags: edge.node.tags
        }));
      }

      console.log('⚠️ Using REST API as a fallback');
      const restResponse = await axios.get(`${this.ARWEAVE_GATEWAY}/tx/history/${address}`, {
        timeout: 15000
      });

      if (Array.isArray(restResponse.data)) {
        return restResponse.data
          .filter(tx => tx.target === address)
          .map(tx => ({
            id: tx.txid,
            owner: tx.owner,
            amount: tx.quantity / 1e12,
            timestamp: tx.block_timestamp
          }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      return [];
    }
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
    process.env.WALLET_ADDRESS = newAddress;
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