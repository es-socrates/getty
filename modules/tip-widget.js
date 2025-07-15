const axios = require('axios');

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
      console.error('❌ ERROR: WALLET_ADDRESS is missing in .env');
      return;
    }
    
    this.checkTransactions();
    setInterval(() => this.checkTransactions(), 60000);
  }
  
  async getAddressTransactions(address) {
    try {
      console.log('[DEBUG] Consultando transacciones para address:', address);
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
      console.log('[DEBUG] GraphQL body:', JSON.stringify(graphqlQuery));

      const graphqlResponse = await axios.post(`${this.ARWEAVE_GATEWAY}/graphql`, graphqlQuery, { timeout: 15000 });

      if (graphqlResponse.data?.data?.transactions?.edges) {
        return graphqlResponse.data.data.transactions.edges.map(edge => ({
          id: edge.node.id,
          owner: edge.node.owner.address,
          target: address,
          quantity: edge.node.quantity.ar * 1e12,
          block: edge.node.block?.height,
          timestamp: edge.node.block?.timestamp
        }));
      }

      console.log('⚠️ Using REST API as a fallback');
      const restResponse = await axios.get(`${this.ARWEAVE_GATEWAY}/tx/history/${address}`, {
        timeout: 15000
      });
      
      if (Array.isArray(restResponse.data)) {
        return restResponse.data.map(tx => ({
          id: tx.txid,
          owner: tx.owner,
          target: tx.target || '',
          quantity: tx.quantity,
          block: tx.block_height,
          timestamp: tx.block_timestamp
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error in getAddressTransactions:', error.message);
      if (error.response) {
        console.error('[DEBUG] Respuesta de error:', JSON.stringify(error.response.data));
        console.error('[DEBUG] Código de estado:', error.response.status);
      }
      return [];
    }
  }
  
  async checkTransactions() {
    try {
      console.log('🔍 Looking for transactions for', this.walletAddress);
      const txs = await this.getAddressTransactions(this.walletAddress);
      
      if (txs.length === 0) {
        console.log('ℹ️ No transactions found. Have AR been sent to this address?');
        return;
      }

      for (const tx of txs) {
        if (!tx.id || this.processedTxs.has(tx.id)) continue;
        
        if (tx.target === this.walletAddress && tx.quantity) {
          const amount = (tx.quantity / 1e12).toFixed(6);
          this.processedTxs.add(tx.id);
          
          console.log(`💰 New transaction: ${amount} AR`, {
            from: tx.owner.slice(0, 6) + '...',
            txId: tx.id.slice(0, 8) + '...',
            block: tx.block,
            timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending'
          });
          
          this.notifyFrontend({
            from: tx.owner,
            amount: amount,
            txId: tx.id,
            message: '🎉 New AR tip. Awesome!'
          });
        }
      }
    } catch (error) {
      console.error('Error in checkTransactions:', error.message);
    }
  }
  
  notifyFrontend(data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'tipNotification',
          data: {
            from: data.from,
            amount: data.amount,
            txId: data.txId,
            message: data.message,
            timestamp: new Date().toISOString()
          }
        }));
      }
    });
  }
  
  updateWalletAddress(newAddress) {
    this.walletAddress = newAddress;
    this.processedTxs = new Set();
    process.env.WALLET_ADDRESS = newAddress;
    this.checkTransactions();
    return this.getStatus();
  }
  
  getStatus() {
    return {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      processedTxs: this.processedTxs.size,
      lastChecked: new Date().toISOString()
    };
  }
}

module.exports = TipWidgetModule;