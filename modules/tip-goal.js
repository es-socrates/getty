const axios = require('axios');
const WebSocket = require('ws');

class TipGoalModule {
  constructor(wss) {
    this.wss = wss;
    this.ARWEAVE_GATEWAY = 'https://arweave.net';
    this.walletAddress = process.env.WALLET_ADDRESS;
    this.monthlyGoalAR = parseFloat(process.env.GOAL_AR) || 10;
    this.currentTipsAR = parseFloat(process.env.STARTING_AR) || 0;
    this.AR_TO_USD = 0;
    this.processedTxs = new Set();
    this.lastDonationTimestamp = null;
    
    this.init();
  }
  
  async init() {
    if (!this.walletAddress) {
      console.error('❌ ERROR: WALLET_ADDRESS is missing in .env');
      return;
    }
    
    await this.updateExchangeRate();
    await this.checkTransactions(true);
    
    setInterval(() => this.updateExchangeRate(), 3600000);
    setInterval(() => this.checkTransactions(), 60000);
  }
  
  async updateExchangeRate() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd', {
        timeout: 5000
      });
      
      if (response.data?.arweave?.usd) {
        this.AR_TO_USD = response.data.arweave.usd;
        console.log(`💱 Updated exchange rate: 1 AR = $${this.AR_TO_USD} USD`);
        this.sendGoalUpdate();
      } else {
        console.warn('⚠️ No exchange rate data received from CoinGecko');
      }
    } catch (error) {
      console.error('Error updating exchange rate:', error.message);
      this.AR_TO_USD = this.AR_TO_USD || 5;
    }
  }
  
  async getAddressTransactions(address) {
    try {
      const graphqlResponse = await axios.post(`${this.ARWEAVE_GATEWAY}/graphql`, {
        query: `
          query GetTransactions($address: String!) {
            transactions(
              recipients: ["${address}"]
              first: 20
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
        `,
        variables: { address }
      }, { timeout: 10000 });

      if (graphqlResponse.data?.data?.transactions?.edges) {
        return graphqlResponse.data.data.transactions.edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner.address,
          target: address,
          amount: edge.node.quantity.ar,
          timestamp: edge.node.block?.timestamp,
          tags: edge.node.tags
        }));
      }

      console.log('⚠️ Using REST API as a fallback');
      const restResponse = await axios.get(`${this.ARWEAVE_GATEWAY}/tx/history/${address}`, {
        timeout: 10000
      });
      
      if (Array.isArray(restResponse.data)) {
        return restResponse.data
          .filter(tx => tx.target === address)
          .map(tx => ({
            id: tx.txid,
            owner: tx.owner,
            target: tx.target,
            amount: tx.quantity / 1e12,
            timestamp: tx.block_timestamp
          }));
      }
      
      return [];
    } catch (error) {
      console.error('Error in getAddressTransactions:', error.message);
      return [];
    }
  }
  
  async checkTransactions(initialLoad = false) {
    try {
      console.log('🔍 Checking transactions for', this.walletAddress);
      const txs = await this.getAddressTransactions(this.walletAddress);
      
      if (txs.length === 0) {
        console.log('ℹ️ No transactions found for address');
        if (initialLoad) {
          this.sendGoalUpdate();
        }
        return;
      }

      let newDonations = false;
      for (const tx of txs) {
        if (!tx.id || this.processedTxs.has(tx.id)) continue;
        
        if (tx.target === this.walletAddress && tx.amount > 0) {
          const amount = parseFloat(tx.amount);
          this.processedTxs.add(tx.id);
          
          console.log(`💰 New transaction: ${amount} AR`, {
            from: tx.owner.slice(0, 6) + '...',
            txId: tx.id.slice(0, 8) + '...',
            timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending'
          });
          
          this.currentTipsAR += amount;
          this.lastDonationTimestamp = tx.timestamp || Math.floor(Date.now() / 1000);
          newDonations = true;
        }
      }

      if (newDonations || initialLoad) {
        this.sendGoalUpdate();
      }
    } catch (error) {
      console.error('Error in checkTransactions:', error.message);
      if (initialLoad) {
        this.sendGoalUpdate();
      }
    }
  }
  
  sendGoalUpdate() {
    const progress = Math.min((this.currentTipsAR / this.monthlyGoalAR) * 100, 100);
    const updateData = {
      current: this.currentTipsAR,
      goal: this.monthlyGoalAR,
      progress: progress,
      rate: this.AR_TO_USD,
      usdValue: (this.currentTipsAR * this.AR_TO_USD).toFixed(2),
      goalUsd: (this.monthlyGoalAR * this.AR_TO_USD).toFixed(2),
      lastDonation: this.lastDonationTimestamp
    };

    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'tipGoalUpdate',
          data: updateData
        }));
      }
    });

    console.log('📊 Goal update sent:', {
      current: updateData.current,
      progress: updateData.progress.toFixed(1) + '%'
    });
  }
  
  updateWalletAddress(newAddress) {
    if (!newAddress || newAddress === this.walletAddress) {
      return this.getStatus();
    }
    
    console.log(`🔄 Updating wallet address to: ${newAddress.slice(0, 8)}...`);
    this.walletAddress = newAddress;
    process.env.WALLET_ADDRESS = newAddress;
    this.processedTxs = new Set();
    this.currentTipsAR = parseFloat(process.env.STARTING_AR) || 0;
    this.lastDonationTimestamp = null;
    
    this.sendGoalUpdate();
    
    this.checkTransactions(true);
    
    return this.getStatus();
  }
  
  updateGoal(newGoal, startingAmount = 0) {
    const parsedGoal = parseFloat(newGoal) || 10;
    const parsedStarting = parseFloat(startingAmount) || 0;
    
    if (parsedGoal === this.monthlyGoalAR && parsedStarting === this.currentTipsAR) {
      return this.getStatus();
    }
    
    console.log(`🔄 Updating goal: ${parsedGoal} AR (starting: ${parsedStarting} AR)`);
    this.monthlyGoalAR = parsedGoal;
    this.currentTipsAR = parsedStarting;
    process.env.GOAL_AR = this.monthlyGoalAR;
    process.env.STARTING_AR = this.currentTipsAR;
    
    this.sendGoalUpdate();
    return this.getStatus();
  }
  
  getGoalProgress() {
    const progress = Math.min((this.currentTipsAR / this.monthlyGoalAR) * 100, 100);
    return {
      current: this.currentTipsAR,
      goal: this.monthlyGoalAR,
      progress: progress,
      rate: this.AR_TO_USD,
      usdValue: (this.currentTipsAR * this.AR_TO_USD).toFixed(2),
      goalUsd: (this.monthlyGoalAR * this.AR_TO_USD).toFixed(2),
      lastDonation: this.lastDonationTimestamp
    };
  }
  
  getStatus() {
    return {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      monthlyGoal: this.monthlyGoalAR,
      currentTips: this.currentTipsAR,
      processedTxs: this.processedTxs.size,
      exchangeRate: this.AR_TO_USD,
      lastDonation: this.lastDonationTimestamp,
      lastChecked: new Date().toISOString(),
      ...this.getGoalProgress()
    };
  }
}

module.exports = TipGoalModule;