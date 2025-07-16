const axios = require('axios');
const WebSocket = require('ws');

class TipGoalModule {
    constructor(wss) {
        if (!wss) {
            throw new Error('WebSocketServer instance is required');
        }

        this.wss = wss;
        this.walletAddress = process.env.WALLET_ADDRESS || '';
        this.monthlyGoalAR = parseFloat(process.env.GOAL_AR) || 10;
        this.currentTipsAR = parseFloat(process.env.STARTING_AR) || 0;
        this.AR_TO_USD = 0;
        this.processedTxs = new Set();
        this.lastDonationTimestamp = null;
        this.lastExchangeRateUpdate = null;
        this.lastTransactionCheck = null;
        this.isInitialized = false;
        
        this.exchangeRateInterval = 3600000;
        this.transactionCheckInterval = 300000;
        
        this.init();
    }
    
    async init() {
        if (!this.walletAddress) {
            console.error('❌ ERROR: WALLET_ADDRESS is missing in .env');
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
            
            this.transactionCheckIntervalId = setInterval(
                () => this.checkTransactions(), 
                this.transactionCheckInterval
            );
            
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
            this.lastTransactionCheck = new Date();
            
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
            console.error('Error in checkTransactions:', error.message);
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

        console.log('📊 Goal update sent:', {
            current: updateData.currentTips.toFixed(2),
            goal: updateData.monthlyGoal.toFixed(2),
            progress: updateData.progress.toFixed(1) + '%',
            rate: this.AR_TO_USD
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
}

module.exports = TipGoalModule;