function getWalletAddress() {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return config.walletAddress || '';
        } catch (e) {
            console.error('[TipGoal] Error reading wallet address from config:', e);
        }
    }
    return '';
}

function getGoalConfig() {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error('[TipGoal] Error reading goal config:', e);
        }
    }
    return null;
}
const axios = require('axios');
const WebSocket = require('ws');

class TipGoalModule {
    constructor(wss) {
        if (!wss) {
            throw new Error('WebSocketServer instance is required');
        }

        this.wss = wss;
        this.walletAddress = '';
        this.monthlyGoalAR = 10;
        this.currentTipsAR = 0;
        this.loadWalletAddress();

        this.AR_TO_USD = 0;
        this.processedTxs = new Set();
        this.lastDonationTimestamp = null;
        this.lastExchangeRateUpdate = null;
        this.lastTransactionCheck = null;
        this.isInitialized = false;
        
        this.exchangeRateInterval = 3600000;
        this.transactionCheckInterval = 60000;
        
        if (process.env.NODE_ENV !== 'test') {
            this.init();
        }
    }

    loadWalletAddress() {
        const fs = require('fs');
        const path = require('path');
        const configDir = path.join(process.cwd(), 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const configPath = path.join(configDir, 'tip-goal-config.json');
        const tipGoalDefault = {
            walletAddress: '',
            monthlyGoal: 10,
            currentAmount: 0,
            bgColor: '#080c10',
            fontColor: '#ffffff',
            borderColor: '#00ff7f',
            progressColor: '#00ff7f',
            audioSource: 'remote'
        };
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(tipGoalDefault, null, 2));
        }
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.walletAddress) {
                this.walletAddress = config.walletAddress;
            }
            if (typeof config.monthlyGoal === 'number') {
                this.monthlyGoalAR = config.monthlyGoal;
            }
            if (typeof config.currentAmount === 'number') {
                this.currentTipsAR = config.currentAmount;
            }
            if (!this.walletAddress) {
                try {
                    const lastTipConfigPath1 = path.join(configDir, 'last-tip-config.json');
                    const lastTipConfigPath2 = path.join(process.cwd(), 'last-tip-config.json');
                    let lastTipWallet = '';
                    if (fs.existsSync(lastTipConfigPath1)) {
                        const lt = JSON.parse(fs.readFileSync(lastTipConfigPath1, 'utf8'));
                        if (lt && typeof lt.walletAddress === 'string' && lt.walletAddress.trim()) {
                            lastTipWallet = lt.walletAddress.trim();
                        }
                    }
                    if (!lastTipWallet && fs.existsSync(lastTipConfigPath2)) {
                        const lt2 = JSON.parse(fs.readFileSync(lastTipConfigPath2, 'utf8'));
                        if (lt2 && typeof lt2.walletAddress === 'string' && lt2.walletAddress.trim()) {
                            lastTipWallet = lt2.walletAddress.trim();
                        }
                    }
                    if (lastTipWallet) {
                        this.walletAddress = lastTipWallet;

                        const updated = { ...tipGoalDefault, ...config, walletAddress: lastTipWallet };
                        try { fs.writeFileSync(configPath, JSON.stringify(updated, null, 2)); } catch {}
                    }
                } catch (e) {

                }
            }
        } catch (e) {
            console.error('[TipGoal] Error reading wallet address from config:', e);
        }
    }
    
    async init() {
        if (!this.walletAddress) {
            console.error('❌ ERROR: walletAddress is missing in tip-goal-config.json');
            return;
        }
        
        try {
            await this.updateExchangeRate();
            await this.checkTransactions(true);
            this.isInitialized = true;
            
            this.exchangeRateIntervalId = setInterval(
                () => this.updateExchangeRate(), 
                this.exchangeRateInterval
            );
            if (this.exchangeRateIntervalId && typeof this.exchangeRateIntervalId.unref === 'function') {
                try { this.exchangeRateIntervalId.unref(); } catch {}
            }
            
            this.transactionCheckIntervalId = setInterval(
                () => this.checkTransactions(), 
                this.transactionCheckInterval
            );
            if (this.transactionCheckIntervalId && typeof this.transactionCheckIntervalId.unref === 'function') {
                try { this.transactionCheckIntervalId.unref(); } catch {}
            }
            
            console.log('✅ TipGoalModule initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize TipGoalModule:', error);
        }
    }
    
    async updateExchangeRate() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd', {
                timeout: 5000
            });
            
            if (response.data?.arweave?.usd) {
                this.AR_TO_USD = response.data.arweave.usd;
                this.lastExchangeRateUpdate = new Date();
                console.log(`💱 Updated exchange rate: 1 AR = $${this.AR_TO_USD} USD`);
                this.sendGoalUpdate();
                return true;
            }
            
            console.warn('⚠️ No exchange rate data received from CoinGecko');
            return false;
        } catch (error) {
            console.error('Error updating exchange rate:', error.message);
            this.AR_TO_USD = this.AR_TO_USD || 5;
            return false;
        }
    }
    
    async getAddressTransactions(address) {
        if (!address) {
            console.error('No address provided to getAddressTransactions');
            return [];
        }

        try {
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

            const graphqlResponse = await axios.post('https://arweave.net/graphql', graphqlQuery, {
                timeout: 15000
            });

            if (graphqlResponse.data?.data?.transactions?.edges) {
                return graphqlResponse.data.data.transactions.edges.map(edge => ({
                    id: edge.node.id,
                    owner: edge.node.owner.address,
                    target: address,
                    amount: edge.node.quantity.ar,
                    timestamp: edge.node.block?.timestamp,
                    source: 'graphql'
                }));
            }

            console.log('⚠️ Using REST API as a fallback');
            const restResponse = await axios.get(`https://arweave.net/tx/history/${address}`, {
                timeout: 15000
            });
            
            if (Array.isArray(restResponse.data)) {
                return restResponse.data
                    .filter(tx => tx.target === address)
                    .map(tx => ({
                        id: tx.txid,
                        owner: tx.owner,
                        target: tx.target,
                        amount: tx.quantity / 1e12,
                        timestamp: tx.block_timestamp,
                        source: 'rest'
                    }));
            }
            
            return [];
        } catch (error) {
            console.error('Error in getAddressTransactions:', error.message);
            if (error.response) {
                console.error('Error response:', error.response.data);
                console.error('Status code:', error.response.status);
            }
            return [];
        }
    }
    
    async checkTransactions(initialLoad = false) {
        if (!this.walletAddress) {
            console.error('Cannot check transactions without wallet address');
            return;
        }

        try {
            console.log('🔍 Checking transactions for', this.walletAddress.slice(0, 8) + '...');
            const txs = await this.getAddressTransactions(this.walletAddress);
            
            if (txs.length === 0) {
                console.log('ℹ️ No transactions found for address');
                if (initialLoad) {
                    this.sendGoalUpdate();
                }
                return;
            }

            let newDonations = false;
            let totalNewAR = 0;
            
            for (const tx of txs) {
                if (!tx.id || this.processedTxs.has(tx.id)) continue;
                
                if (tx.target === this.walletAddress && tx.amount > 0) {
                    const amount = parseFloat(tx.amount);
                    this.processedTxs.add(tx.id);
                    
                    console.log(`💰 New transaction: ${amount} AR`, {
                        from: tx.owner.slice(0, 6) + '...',
                        txId: tx.id.slice(0, 8) + '...',
                        timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending',
                        source: tx.source || 'unknown'
                    });
                    
                    this.currentTipsAR += amount;
                    totalNewAR += amount;
                    this.lastDonationTimestamp = tx.timestamp || Math.floor(Date.now() / 1000);
                    newDonations = true;
                }
            }

            if (newDonations) {
                console.log(`🎉 Found ${totalNewAR.toFixed(2)} AR in new donations`);
                this.sendGoalUpdate();
                
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'newDonation',
                            amount: totalNewAR,
                            count: this.processedTxs.size
                        }));
                    }
                });
            } else if (initialLoad) {
                this.sendGoalUpdate();
            }
        } catch (error) {
            console.error('Error in checkTransactions:', error);
            if (error.response) {
                console.error('API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            if (initialLoad) {
                this.sendGoalUpdate();
            }
        }
    }
    
    sendGoalUpdate() {
        const progress = Math.min((this.currentTipsAR / this.monthlyGoalAR) * 100, 100);
        const updateData = {
            currentTips: this.currentTipsAR,
            monthlyGoal: this.monthlyGoalAR,
            progress: progress,
            exchangeRate: this.AR_TO_USD,
            usdValue: (this.currentTipsAR * this.AR_TO_USD).toFixed(2),
            goalUsd: (this.monthlyGoalAR * this.AR_TO_USD).toFixed(2),
            lastDonationTimestamp: this.lastDonationTimestamp,
            lastUpdated: new Date().toISOString()
        };

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'tipGoalUpdate',
                    data: updateData
                }));
            }
        });
    }
    
    updateWalletAddress(newAddress) {
        if (!newAddress || newAddress === this.walletAddress) {

            return this.getStatus();
        }
        this.walletAddress = newAddress;
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            try {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                console.error('[TipGoal] Error reading config for wallet update:', e);
            }
        }
        config.walletAddress = newAddress;
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (e) {
            console.error('[TipGoal] Error writing wallet address to config:', e);
        }
        this.processedTxs = new Set();
        this.currentTipsAR = 0;
        this.lastDonationTimestamp = null;
        this.sendGoalUpdate();
        if (process.env.NODE_ENV !== 'test') {
            this.checkTransactions(true);
        }
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
        process.env.GOAL_AR = this.monthlyGoalAR.toString();
        process.env.STARTING_AR = this.currentTipsAR.toString();
        
        this.sendGoalUpdate();
        return this.getStatus();
    }
    
    getGoalProgress() {
        const progress = Math.min((this.currentTipsAR / this.monthlyGoalAR) * 100, 100);
        return {
            currentTips: this.currentTipsAR,
            monthlyGoal: this.monthlyGoalAR,
            progress: progress,
            exchangeRate: this.AR_TO_USD,
            usdValue: (this.currentTipsAR * this.AR_TO_USD).toFixed(2),
            goalUsd: (this.monthlyGoalAR * this.AR_TO_USD).toFixed(2),
            lastDonationTimestamp: this.lastDonationTimestamp,
            lastUpdated: new Date().toISOString()
        };
    }
    
    getStatus() {
        return {
            active: !!this.walletAddress,
            initialized: this.isInitialized,
            walletAddress: this.walletAddress,
            monthlyGoal: this.monthlyGoalAR,
            currentTips: this.currentTipsAR,
            processedTxs: this.processedTxs.size,
            exchangeRate: this.AR_TO_USD,
            lastDonation: this.lastDonationTimestamp,
            lastExchangeRateUpdate: this.lastExchangeRateUpdate,
            lastTransactionCheck: this.lastTransactionCheck,
            nextExchangeRateUpdate: this.lastExchangeRateUpdate ? 
                new Date(this.lastExchangeRateUpdate.getTime() + this.exchangeRateInterval) : null,
            nextTransactionCheck: this.lastTransactionCheck ? 
                new Date(this.lastTransactionCheck.getTime() + this.transactionCheckInterval) : null,
            ...this.getGoalProgress()
        };
    }

    cleanup() {
        if (this.exchangeRateIntervalId) {
            clearInterval(this.exchangeRateIntervalId);
        }
        if (this.transactionCheckIntervalId) {
            clearInterval(this.transactionCheckIntervalId);
        }
    }

    dispose() {
        this.cleanup();
    }
}

module.exports = {
    TipGoalModule,
    getWalletAddress,
    getGoalConfig
};
