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

const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { tenantEnabled } = (() => { try { return require('../lib/tenant'); } catch { return { tenantEnabled: () => false }; } })();

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
        this._loadedMeta = null;

    const __loadPromise = this.loadWalletAddress();
    try {
        if (__loadPromise && typeof __loadPromise.then === 'function') {
            __loadPromise.then(() => {
                try {
                    if (!this.isInitialized && this.walletAddress && process.env.NODE_ENV !== 'test') {
                        this.init();
                    } else if (!this.isInitialized && this.walletAddress && process.env.NODE_ENV === 'test') {

                        try { this.sendGoalUpdate(); } catch {}
                    } else if (!this.isInitialized && !this.walletAddress && process.env.GETTY_REQUIRE_SESSION === '1') {
                        // Hosted idle state; nothing to do yet.
                    }
                } catch {}
            }).catch(()=>{});
        }
    } catch {}

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

        try {
            const hostedSync = !!process.env.GETTY_REQUIRE_SESSION || !!process.env.REDIS_URL;
            if (!this.walletAddress && hostedSync) {
                const fs = require('fs');
                const path = require('path');
                const p = path.join(process.cwd(),'config','tip-goal-config.json');
                if (fs.existsSync(p)) {
                    try {
                        const rawTxt = fs.readFileSync(p,'utf8');
                        let parsed = {};
                        try { parsed = JSON.parse(rawTxt); } catch {}
                        const dataLayer = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
                        if (dataLayer && typeof dataLayer.walletAddress === 'string' && dataLayer.walletAddress.trim()) {
                            this.walletAddress = dataLayer.walletAddress.trim();
                            if (typeof dataLayer.monthlyGoal === 'number') this.monthlyGoalAR = dataLayer.monthlyGoal;
                            if (typeof dataLayer.currentAmount === 'number') this.currentTipsAR = dataLayer.currentAmount;
                        }
                    } catch {}
                }
            }
        } catch {}
    }

    async loadWalletAddress(reqForTenant) {
        const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
        const fs = require('fs');
        const path = require('path');
        const configDir = path.join(process.cwd(), 'config');
        const globalPath = path.join(configDir, 'tip-goal-config.json');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
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
        let config = {};
        try {
            if (tenantEnabled && tenantEnabled(reqForTenant)) {
                try {
                    const store = (reqForTenant && reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
                    const lt = await loadTenantConfig(reqForTenant, store, globalPath, 'tip-goal-config.json');
                    const data = lt.data?.data ? lt.data.data : lt.data;
                    if (data && Object.keys(data).length) config = data;
                    this._loadedMeta = { source: lt.source, tenantPath: lt.tenantPath };
                } catch (e) {
                    if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[TipGoal][TENANT_LOAD_ERROR]', e.message);
                }
            }
            if (!config || !Object.keys(config).length) {
                if (fs.existsSync(globalPath)) {
                    try { config = JSON.parse(fs.readFileSync(globalPath, 'utf8')); } catch {}
                } else if (!hostedMode) {
                    try {
                        fs.writeFileSync(globalPath, JSON.stringify(tipGoalDefault, null, 2));
                        config = { ...tipGoalDefault };
                        if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][CREATE_DEFAULT]', { path: globalPath });
                    } catch (e) { console.error('[TipGoal] Failed creating default config:', e.message); }
                }
            }
            const prevWallet = config.walletAddress || '';
            if (config.walletAddress) {
                this.walletAddress = config.walletAddress;
            }
            if (!this.walletAddress) {
                const envWallet = process.env.TIP_GOAL_WALLET || process.env.WALLET_ADDRESS || '';
                if (typeof envWallet === 'string' && envWallet.trim()) {
                    this.walletAddress = envWallet.trim();
                }
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
                        if (!hostedMode) {
                            try {
                                fs.writeFileSync(globalPath, JSON.stringify(updated, null, 2));
                                if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][IMPORT_WALLET_FROM_LAST_TIP]', { prevWallet, newWallet: lastTipWallet });
                            } catch (e) { console.error('[TipGoal] Failed persisting imported wallet:', e.message); }
                        } else if (tenantEnabled && tenantEnabled(reqForTenant)) {
                            try {
                                const store = (reqForTenant && reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
                                const saveReq = reqForTenant || { __forceWalletHash: (this.walletAddress || '').slice(0, 12) };
                                await saveTenantConfig(saveReq, store, globalPath, 'tip-goal-config.json', updated);
                            } catch {}
                        }
                    }
                } catch {}
            }
        } catch (e) {
            console.error('[TipGoal] Error reading wallet address from config:', e);
        }
    }
    
    async init() {
        if (!this.walletAddress) {
            const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
            const msg = hostedMode
                ? '[TipGoal] walletAddress not set. Hosted mode will stay idle until configured via Admin UI or import.'
                : '❌ ERROR: walletAddress is missing in tip-goal-config.json';
            try { hostedMode ? console.warn(msg) : console.error(msg); } catch {}
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
            
            console.warn('✅ TipGoalModule initialized successfully');
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
            console.warn('🔍 Checking transactions for', this.walletAddress.slice(0, 8) + '...');
            const txs = await this.getAddressTransactions(this.walletAddress);
            
            if (txs.length === 0) {
                console.warn('ℹ️ No transactions found for address');
                if (initialLoad) {
                    this.sendGoalUpdate();
                }
                return;
            }

            let newDonations = false;
            let totalNewAR = 0;

            const skipRecount = initialLoad && this.currentTipsAR > 0;
            if (skipRecount) {
                console.warn('[TipGoal] Initial load: avoiding re-summing historical transactions (currentTipsAR=%s).', this.currentTipsAR);
            }
            let latestTs = this.lastDonationTimestamp || 0;
            
            for (const tx of txs) {
                if (!tx.id || this.processedTxs.has(tx.id)) continue;
                if (tx.target === this.walletAddress && tx.amount > 0) {
                    const amount = parseFloat(tx.amount);
                    this.processedTxs.add(tx.id);
                    const tsIso = tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending';
                    if (!skipRecount) {
                        console.warn(`💰 New transaction: ${amount} AR`, {
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
                console.warn(`🎉 Found ${totalNewAR.toFixed(2)} AR in new donations`);
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

        try {
            const tenantEnabled = process.env.GETTY_MULTI_TENANT_WALLET === '1';
            if (typeof this.wss.broadcast === 'function') {
                if (!tenantEnabled) {
                    this.wss.broadcast(null, { type: 'tipGoalUpdate', data: updateData });
                } else {
                    // For hosted / tenant aware contexts we cannot know the wallet hash.
                }
            } else {
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'tipGoalUpdate', data: updateData }));
                    }
                });
            }
        } catch {
            try {
                this.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'tipGoalUpdate', data: updateData }));
                    }
                });
            } catch {}
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const globalPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
            let existing = {};
            if (fs.existsSync(globalPath)) { try { existing = JSON.parse(fs.readFileSync(globalPath, 'utf8')); } catch {} }
            const merged = { ...existing, walletAddress: this.walletAddress, monthlyGoal: this.monthlyGoalAR, currentAmount: this.currentTipsAR, theme: this.theme, bgColor: this.bgColor, fontColor: this.fontColor, borderColor: this.borderColor, progressColor: this.progressColor, title: this.title };
            const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
            if (!hostedMode) {
                if (existing.walletAddress && !this.walletAddress) {
                    if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][SKIP_WRITE_EMPTY_WALLET]', { existing: existing.walletAddress });
                } else {
                    fs.writeFileSync(globalPath, JSON.stringify(merged, null, 2));
                    if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][WRITE_CONFIG]', { path: globalPath, wallet: this.walletAddress });
                }
            } else {
                if (this._lastReqForSave && (tenantEnabled && tenantEnabled(this._lastReqForSave))) {
                    try {
                        const store = (this._lastReqForSave.app && this._lastReqForSave.app.get) ? this._lastReqForSave.app.get('store') : null;
                        saveTenantConfig(this._lastReqForSave, store, globalPath, 'tip-goal-config.json', merged)
                          .then(saveRes => { this._loadedMeta = saveRes.meta; })
                          .catch(e => { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[TipGoal][TENANT_SAVE_ERROR]', e.message); });
                    } catch (e) {
                        if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[TipGoal][TENANT_SAVE_ERROR]', e.message);
                    }
                }
            }
        } catch (e) {
            if (process.env.GETTY_DEBUG_CONFIG === '1') console.error('[TipGoal][WRITE_ERROR]', e.message);
        }
    }
    
    updateWalletAddress(newAddress, reqForTenant) {
        const incoming = (newAddress || '').trim();

        if (incoming === this.walletAddress) return this.getStatus();
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(process.cwd(), 'config', 'tip-goal-config.json');
        let existing = {};
        if (fs.existsSync(configPath)) {
            try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
        }
        if (!incoming && existing.walletAddress) {
            this.walletAddress = existing.walletAddress;
            return this.getStatus();
        }
        this.walletAddress = incoming;
        const merged = { ...existing, walletAddress: this.walletAddress };
        try {
            const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
            if (!hostedMode) {
                if (existing.walletAddress && !this.walletAddress) {
                    if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][SKIP_WRITE_EMPTY_WALLET_EXPLICIT]', { existing: existing.walletAddress });
                } else {
                    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
                    if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[TipGoal][WRITE_CONFIG_EXPLICIT]', { path: configPath, wallet: this.walletAddress });
                }
            } else if (reqForTenant && tenantEnabled && tenantEnabled(reqForTenant)) {
                try {
                    const store = (reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
                    saveTenantConfig(reqForTenant, store, configPath, 'tip-goal-config.json', merged)
                      .then(saveRes => { this._loadedMeta = saveRes.meta; this._lastReqForSave = reqForTenant; })
                      .catch(e => { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[TipGoal][TENANT_SAVE_WALLET_ERROR]', e.message); });
                } catch (e) { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[TipGoal][TENANT_SAVE_WALLET_ERROR]', e.message); }
            }
        } catch (e) { console.error('[TipGoal] Error writing wallet address to config:', e); }
        this.processedTxs = new Set();
        this.currentTipsAR = 0;
        this.lastDonationTimestamp = null;
        this.sendGoalUpdate();

        if (process.env.NODE_ENV !== 'test' && this.walletAddress) {
            this.checkTransactions(true);
        }
        return this.getStatus();
    }
    
    updateGoal(newGoal, startingAmount = 0, reqForTenant) {
        const parsedGoal = parseFloat(newGoal) || 10;
        const parsedStarting = parseFloat(startingAmount) || 0;
        
        if (parsedGoal === this.monthlyGoalAR && parsedStarting === this.currentTipsAR) {
            return this.getStatus();
        }
        
    console.warn(`🔄 Updating goal: ${parsedGoal} AR (starting: ${parsedStarting} AR)`);
        this.monthlyGoalAR = parsedGoal;
        this.currentTipsAR = parsedStarting;
        process.env.GOAL_AR = this.monthlyGoalAR.toString();
        process.env.STARTING_AR = this.currentTipsAR.toString();
        
        if (reqForTenant) this._lastReqForSave = reqForTenant;
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
