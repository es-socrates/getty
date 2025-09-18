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
        this.bgColor = '#080c10';
        this.fontColor = '#ffffff';
        this.borderColor = '#00ff7f';
        this.progressColor = '#00ff7f';
        this.theme = 'classic';
        this.title = 'Monthly tip goal 🎖️';
        this.loadWalletAddress();

        this.AR_TO_USD = 0;
        this.ARWEAVE_GATEWAYS = [
            'https://arweave.net',
            'https://ar-io.net',
            'https://arweave.live',
            'https://arweave-search.goldsky.com'
        ];

        if (process.env.TIP_GOAL_EXTRA_GATEWAYS) {
            try {
                const extra = String(process.env.TIP_GOAL_EXTRA_GATEWAYS)
                    .split(',').map(s=>s.trim()).filter(Boolean)
                    .map(s => (s.startsWith('http') ? s : `https://${s}`)).map(u=>u.replace(/\/$/, ''));
                this.ARWEAVE_GATEWAYS.push(...extra);
            } catch {}
        }
        this.ARWEAVE_GATEWAYS = Array.from(new Set(this.ARWEAVE_GATEWAYS));
        this.GRAPHQL_TIMEOUT = Number(process.env.TIP_GOAL_GRAPHQL_TIMEOUT_MS || 10000);
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
            theme: 'classic',
            bgColor: '#080c10',
            fontColor: '#ffffff',
            borderColor: '#00ff7f',
            progressColor: '#00ff7f',
            audioSource: 'remote',
            title: 'Monthly tip goal 🎖️'
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
            if (typeof config.bgColor === 'string') this.bgColor = config.bgColor;
            if (typeof config.fontColor === 'string') this.fontColor = config.fontColor;
            if (typeof config.borderColor === 'string') this.borderColor = config.borderColor;
            if (typeof config.progressColor === 'string') this.progressColor = config.progressColor;
            if (typeof config.theme === 'string') {
                this.theme = (config.theme === 'koku-list') ? 'modern-list' : config.theme;
            }
            if (typeof config.title === 'string' && config.title.trim()) this.title = config.title.trim();
            if (!this.walletAddress) {
                try {
                    const lastTipConfigPath1 = path.join(configDir, 'last-tip-config.json');
                    let lastTipWallet = '';
                    if (fs.existsSync(lastTipConfigPath1)) {
                        const lt = JSON.parse(fs.readFileSync(lastTipConfigPath1, 'utf8'));
                        if (lt && typeof lt.walletAddress === 'string' && lt.walletAddress.trim()) {
                            lastTipWallet = lt.walletAddress.trim();
                        }
                    }
                    if (lastTipWallet) {
                        this.walletAddress = lastTipWallet;

                        const updated = { ...tipGoalDefault, ...config, walletAddress: lastTipWallet };
                        try { fs.writeFileSync(configPath, JSON.stringify(updated, null, 2)); } catch {}
                    }
                } catch {}
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
        const localUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/ar-price`;
        try {
            const cached = await axios.get(localUrl, { timeout: 3000 });
            const usd = cached.data?.arweave?.usd;
            if (usd) {
                this.AR_TO_USD = Number(usd);
                this.lastExchangeRateUpdate = new Date();
                this.sendGoalUpdate();
                return true;
            }
        } catch {}
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd', { timeout: 5000 });
            if (response.data?.arweave?.usd) {
                this.AR_TO_USD = response.data.arweave.usd;
                this.lastExchangeRateUpdate = new Date();
                this.sendGoalUpdate();
                return true;
            }
            return false;
        } catch {
                this.AR_TO_USD = this.AR_TO_USD || 5;
                this.lastExchangeRateUpdate = new Date();
                this.sendGoalUpdate();
                return false;
            }
        }
    
        async getAddressTransactions(address) {
        if (!address) {
            console.error('No address provided to getAddressTransactions');
            return [];
        }

                const query = `
                    query($recipients: [String!]) {
                        transactions(recipients: $recipients, first: 25, sort: HEIGHT_DESC) {
                            edges { node { id owner { address } quantity { ar } block { height timestamp } } }
                        }
                    }
                `;

                const tryGateway = async (gw) => {
                        const resp = await axios.post(`${gw}/graphql`, { query, variables: { recipients: [address] } }, { timeout: this.GRAPHQL_TIMEOUT });
                        const edges = resp.data?.data?.transactions?.edges || [];
                        if (!Array.isArray(edges)) throw new Error('Bad GraphQL shape');
                        return edges.map(edge => ({
                                id: edge.node.id,
                                owner: edge.node.owner?.address,
                                target: address,
                                amount: edge.node.quantity?.ar,
                                timestamp: edge.node.block?.timestamp,
                                source: 'graphql'
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
                console.warn('[TipGoal] All GraphQL gateways failed; will retry next interval.');
                return [];
    }
    
    async checkTransactions(initialLoad = false) {
        if (!this.walletAddress) {
            console.error('Cannot check transactions without wallet address');
            return;
        }

        try {
            this.lastTransactionCheck = new Date();
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

            const skipRecount = initialLoad && this.currentTipsAR > 0;
            if (skipRecount) {
                console.log('[TipGoal] Initial load: avoiding re-summing historical transactions (currentTipsAR=%s).', this.currentTipsAR);
            }
            let latestTs = this.lastDonationTimestamp || 0;
            
            for (const tx of txs) {
                if (!tx.id || this.processedTxs.has(tx.id)) continue;
                if (tx.target === this.walletAddress && tx.amount > 0) {
                    const amount = parseFloat(tx.amount);
                    this.processedTxs.add(tx.id);
                    const tsIso = tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending';
                    if (!skipRecount) {
                        console.log(`💰 New transaction: ${amount} AR`, {
                            from: tx.owner.slice(0, 6) + '...',
                            txId: tx.id.slice(0, 8) + '...',
                            timestamp: tsIso,
                            source: tx.source || 'unknown'
                        });
                        this.currentTipsAR += amount;
                        totalNewAR += amount;
                        this.lastDonationTimestamp = tx.timestamp || Math.floor(Date.now() / 1000);
                        latestTs = Math.max(latestTs, this.lastDonationTimestamp);
                        newDonations = true;
                    } else {
                        if (tx.timestamp) latestTs = Math.max(latestTs, tx.timestamp);
                    }
                }
            }
            if (skipRecount && latestTs && !this.lastDonationTimestamp) {
                this.lastDonationTimestamp = latestTs;
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

            if (!this.lastTransactionCheck) this.lastTransactionCheck = new Date();
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
            lastUpdated: new Date().toISOString(),
            theme: this.theme,
            bgColor: this.bgColor,
            fontColor: this.fontColor,
            borderColor: this.borderColor,
            progressColor: this.progressColor,
            title: this.title
        };

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'tipGoalUpdate',
                    data: updateData
                }));
            }
        });

        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
            let existing = {};
            if (fs.existsSync(configPath)) {
                try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
            }
            const merged = {
                ...existing,
                walletAddress: this.walletAddress,
                monthlyGoal: this.monthlyGoalAR,
                currentAmount: this.currentTipsAR,
                theme: this.theme,
                bgColor: this.bgColor,
                fontColor: this.fontColor,
                borderColor: this.borderColor,
                progressColor: this.progressColor,
                title: this.title
            };
            fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
    } catch {}
    }
    
    updateWalletAddress(newAddress) {
        // Allow explicit clearing (empty string) and avoid unnecessary work if unchanged
        if (newAddress === this.walletAddress) {
            return this.getStatus();
        }
        this.walletAddress = newAddress || '';
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
        config.walletAddress = this.walletAddress;
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (e) {
            console.error('[TipGoal] Error writing wallet address to config:', e);
        }
        this.processedTxs = new Set();
        this.currentTipsAR = 0;
        this.lastDonationTimestamp = null;
        this.sendGoalUpdate();
        // Only check network if not in tests and we have a non-empty address
        if (process.env.NODE_ENV !== 'test' && this.walletAddress) {
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
            ...this.getGoalProgress(),
            theme: this.theme,
            bgColor: this.bgColor,
            fontColor: this.fontColor,
            borderColor: this.borderColor,
            progressColor: this.progressColor,
            title: this.title
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
