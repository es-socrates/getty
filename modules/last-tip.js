const axios = require('axios');
const WebSocket = require('ws');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { tenantEnabled } = (() => { try { return require('../lib/tenant'); } catch { return { tenantEnabled: () => false }; } })();
const { buildGatewayList } = require('../lib/arweave-gateways');

class LastTipModule {
  constructor(wss) {
    this.wss = wss;

    this.ARWEAVE_GATEWAYS = buildGatewayList({});

    try {
      if (process.env.LAST_TIP_EXTRA_GATEWAYS) {
        const extra = process.env.LAST_TIP_EXTRA_GATEWAYS.split(',').map(s=>s.trim()).filter(Boolean);
        const merged = Array.from(new Set([...this.ARWEAVE_GATEWAYS, ...extra]));
        this.ARWEAVE_GATEWAYS = merged;
      }
    } catch {}
    this.GRAPHQL_TIMEOUT = Number(process.env.LAST_TIP_GRAPHQL_TIMEOUT_MS || 10000);
    this.VIEWBLOCK_TIMEOUT = Number(process.env.LAST_TIP_VIEWBLOCK_TIMEOUT_MS || 6000);
    this.walletAddress = null;
    this._loadedMeta = null;
    this._lastReqForSave = null;
    this.lastDonation = null;

    this._lastFetchTs = null;
    this._lastFetchGatewayAttempts = [];
    this._lastFetchSucceededGateway = null;
    this._lastFetchErrorCount = 0;
    this._fetchCount = 0;
    this.processedTxs = new Set();
    this._cacheLoaded = false;
    this._updateInterval = null;
    this._pendingFlush = null;

  const __loadPromise = this.loadWalletAddress();
    try {
      if (__loadPromise && typeof __loadPromise.then === 'function') {
        __loadPromise.then(() => {
          try {
            if (process.env.NODE_ENV !== 'test' && !this.lastDonation && this.walletAddress && (!this._initDeferred || !this._initDeferred.started)) {
              this.init();
            } else if (process.env.NODE_ENV === 'test' && this.walletAddress && !this.lastDonation) {

              try { this.updateLatestDonation?.(); } catch {}
            }
          } catch {}
        }).catch(()=>{});
      }
    } catch {}
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }

  scheduleWriteThrough(configSnapshot) {
    try {
      const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (!hostedMode) return;
      if (!this._lastReqForSave) return;
      if (this._pendingFlush) clearTimeout(this._pendingFlush);
      this._pendingFlush = setTimeout(() => {
        try {
          const req = this._lastReqForSave;
          const store = (req.app && req.app.get) ? req.app.get('store') : null;
          const path = require('path');
          const globalPath = path.join(process.cwd(), 'config', 'last-tip-config.json');
          saveTenantConfig(req, store, globalPath, 'last-tip-config.json', configSnapshot)
            .then(r => { this._loadedMeta = r.meta; })
            .catch(e => { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[LastTip][WRITE_THROUGH_ERROR]', e.message); });
        } catch (e) {
          if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[LastTip][WRITE_THROUGH_FATAL]', e.message);
        }
      }, 250);
    } catch {}
  }

  async loadWalletAddress(reqForTenant) {
    const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
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
      iconBgColor: '#4f36ff',
      fromColor: '#817ec8',
      title: 'Last Tip'
    };
    let config = {};
    try {
      if (tenantEnabled && tenantEnabled(reqForTenant)) {
        try {
          const store = (reqForTenant && reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
          const lt = await loadTenantConfig(reqForTenant, store, lastTipConfigPath, 'last-tip-config.json');
          const data = lt.data?.data ? lt.data.data : lt.data;
          if (data && Object.keys(data).length) config = data;
          this._loadedMeta = { source: lt.source, tenantPath: lt.tenantPath };
        } catch (e) { if (process.env.GETTY_TENANT_DEBUG === '1') console.warn('[LastTip][TENANT_LOAD_ERROR]', e.message); }
      }
      if (!config || !Object.keys(config).length) {
        if (fs.existsSync(lastTipConfigPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(lastTipConfigPath, 'utf8'));
            config = raw.data ? raw.data : raw;
          } catch {}
        } else if (!hostedMode) {
          try {
            fs.writeFileSync(lastTipConfigPath, JSON.stringify(lastTipDefault, null, 2));
            config = { ...lastTipDefault };
            if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[LastTip][CREATE_DEFAULT]', { path: lastTipConfigPath });
          } catch (e) { console.error('[LastTip] Failed creating default config:', e.message); }
        }
      }
      const prevWallet = config.walletAddress || '';

      let mutated = false;
      for (const [k,v] of Object.entries(lastTipDefault)) {
        if (!Object.prototype.hasOwnProperty.call(config, k)) { config[k] = v; mutated = true; }
      }
      if (mutated && !hostedMode) {
        try {
          fs.writeFileSync(lastTipConfigPath, JSON.stringify(config, null, 2));
          if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[LastTip][FILL_DEFAULTS]', { path: lastTipConfigPath, addedKeys: true });
        } catch (e) { console.error('[LastTip] Failed writing filled defaults:', e.message); }
      }
      if (config.walletAddress) {
        this.walletAddress = config.walletAddress;
      }

      if (!this.walletAddress) {
        const envWallet = process.env.LAST_TIP_WALLET || process.env.WALLET_ADDRESS || '';
        if (typeof envWallet === 'string' && envWallet.trim()) {
          this.walletAddress = envWallet.trim();
        }
      }
      if (!this.walletAddress) {
        try {
          const tgPath = path.join(configDir, 'tip-goal-config.json');
          if (fs.existsSync(tgPath)) {
            const tg = JSON.parse(fs.readFileSync(tgPath, 'utf8'));
            if (typeof tg.walletAddress === 'string' && tg.walletAddress.trim()) {
              this.walletAddress = tg.walletAddress.trim();
              const updated = { ...config, walletAddress: this.walletAddress };
              if (!hostedMode) {
                try {
                  fs.writeFileSync(lastTipConfigPath, JSON.stringify(updated, null, 2));
                  if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[LastTip][IMPORT_WALLET_FROM_TIP_GOAL]', { prevWallet, newWallet: this.walletAddress });
                } catch (e) { console.error('[LastTip] Failed persisting imported wallet:', e.message); }
              } else if (tenantEnabled && tenantEnabled(reqForTenant)) {
                try {
                  const store = (reqForTenant && reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
                  await saveTenantConfig(reqForTenant, store, lastTipConfigPath, 'last-tip-config.json', updated);
                } catch {}
              }
              try { console.warn('[LastTip] Wallet address imported from tip-goal-config.json'); } catch {}
            }
          }
        } catch {}
      }
    } catch (e) { console.error('[LastTip] Error reading wallet address from config:', e); }
  }
  
  init() {
    if (!this._bootLogged) this._bootLogged = { missing: false };
    if (!this.walletAddress) {
      const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';

      if (hostedMode && !this.walletAddress) {
        (async () => {
          try {
            const store = this._store || (global.__gettyStore || null);
            if (!store && typeof global.getAppStore === 'function') {
              try { this._store = global.getAppStore(); } catch {}
            } else { this._store = store; }
            const nsCandidates = [];
            try { if (global.__lastAdminNamespace) nsCandidates.push(global.__lastAdminNamespace); } catch {}
            try { if (global.__lastPublicNamespace) nsCandidates.push(global.__lastPublicNamespace); } catch {}
            const seen = new Set();
            for (const cand of nsCandidates) {
              if (!cand || seen.has(cand)) continue; seen.add(cand);
              let cfgObj = null;
              if (this._store && typeof this._store.getConfig === 'function') {
                try { cfgObj = await this._store.getConfig(cand, 'last-tip-config.json', null); } catch {}
              }
              if (!cfgObj && this._store && typeof this._store.get === 'function') {
                try { cfgObj = await this._store.get(cand, 'last-tip-config', null); } catch {}
              }
              if (cfgObj) {
                const data = cfgObj && cfgObj.data ? cfgObj.data : cfgObj;
                if (data && typeof data.walletAddress === 'string' && data.walletAddress.trim()) {
                  this.walletAddress = data.walletAddress.trim();
                  if (typeof data.title === 'string' && data.title.trim()) this.title = data.title.trim();
                  break;
                }
              }
            }
          } catch {}
        })();
      }
      const msgHosted = '[LastTip] walletAddress not set at boot (hosted multi-tenant). Waiting for namespaced configuration.';
      const msgSingle = '❌ ERROR: walletAddress is missing in last-tip-config.json';
      if (!this._bootLogged.missing) {
        try {
          const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1' || process.env.NODE_ENV !== 'production';
          const isLocalhost = process.env.GETTY_LOCALHOST === '1' || !process.env.GETTY_FORCE_SINGLE_TENANT;
          const shouldShowError = !hostedMode && !isLocalhost;
          const dbg = process.env.GETTY_DEBUG_WALLET_BOOT === '1';
          if (!shouldShowError) {
            if (dbg) console.warn(msgHosted);
          } else {
            console.error(msgSingle);
          }
        } catch {}
        this._bootLogged.missing = true;
      }
      return;
    }
    this.updateLatestDonation();
    if (process.env.NODE_ENV !== 'test') {
      const quickDelays = [2000, 5000, 10000, 20000];
      quickDelays.forEach(d => setTimeout(() => { try { this.updateLatestDonation(); } catch {} }, d));
      this._updateInterval = setInterval(() => this.updateLatestDonation(), 60000);
    }
  }

  toDonation(tx) {
    const amount = Number(tx.amount);
    if (isNaN(amount) || amount <= 0) return null;
    const from = tx.owner || 'Anonymous';
    return {
      from,
      amount: amount.toString(),
      txId: tx.id,
      timestamp: tx.timestamp || Math.floor(Date.now() / 1000)
    };
  }

  async getEnhancedTransactions(address) {

    this._lastFetchTs = Date.now();
    this._lastFetchGatewayAttempts = [];
    this._lastFetchSucceededGateway = null;
    this._lastFetchErrorCount = 0;
    this._fetchCount += 1;
    const query = `
      query($recipients: [String!]) {
        transactions(recipients: $recipients, first: 75, sort: HEIGHT_DESC) {
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
    `;

    const tryGateway = async (gw) => {
      const url = `${gw}/graphql`;
      this._lastFetchGatewayAttempts.push(gw);
      const resp = await axios.post(
        url,
        { query, variables: { recipients: [address] } },
        { timeout: this.GRAPHQL_TIMEOUT, validateStatus: (s) => s >= 200 && s < 300 }
      );
      const edges = resp.data?.data?.transactions?.edges || [];
      if (!Array.isArray(edges)) throw new Error('Bad GraphQL shape');
      if (!this._lastFetchSucceededGateway) this._lastFetchSucceededGateway = gw;
      return edges.map((edge) => ({
        id: edge.node.id,
        owner: edge.node.owner?.address,
        amount: edge.node.quantity?.ar,
        timestamp: edge.node.block?.timestamp || null,
        tags: edge.node.tags || []
      }));
    };

    const gateways = this.ARWEAVE_GATEWAYS.slice();

    let graphqlResults = [];
    if (typeof Promise.any === 'function') {
      try {
        graphqlResults = await Promise.any(gateways.map((gw) => tryGateway(gw)));
      } catch {
        this._lastFetchErrorCount += 1;

      }
    } else {
      for (const gw of gateways) {
        try {
          graphqlResults = await tryGateway(gw);
          break;
  } catch {
          this._lastFetchErrorCount += 1;
        }
      }
    }

    if (Array.isArray(graphqlResults) && graphqlResults.length) {
      return graphqlResults;
    }

    const vbKey = process.env.VIEWBLOCK_API_KEY || '';
    if (vbKey) {
      try {
        const vb = await axios.get(
          `https://api.viewblock.io/arweave/addresses/${address}/transactions`,
          {
            timeout: this.VIEWBLOCK_TIMEOUT,
            headers: { 'X-APIKEY': vbKey }
          }
        );
        if (Array.isArray(vb.data) && vb.data.length > 0) {
          if (!this._lastFetchSucceededGateway) this._lastFetchSucceededGateway = 'viewblock';
          return vb.data
            .filter((tx) => tx?.owner && tx?.id && (typeof tx.quantity === 'number' || typeof tx.quantity === 'string'))
            .map((tx) => ({
              id: tx.id,
              owner: tx.owner,
              amount: typeof tx.quantity === 'number' ? tx.quantity : tx.quantity,
              timestamp: tx.timestamp || Math.floor(Date.now() / 1000)
            }));
        }
  } catch {
        this._lastFetchErrorCount += 1;
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      console.warn('[LastTip] All transaction fetchers failed (GraphQL gateways). Will retry next interval.');
    }
    return [];
  }
  
  shouldUpdateDonation(newDonation) {
    if (!this.lastDonation) return true;
    return newDonation.txId !== this.lastDonation.txId;
  }
  
  async refreshDonationsCache() {
    try {
      if (!this.walletAddress) return { last: null, count: 0 };
      const txs = await this.getEnhancedTransactions(this.walletAddress);
      if (!Array.isArray(txs) || txs.length === 0) return { last: this.lastDonation, count: 0 };

      const donations = txs.map(tx => this.toDonation({ id: tx.id, owner: tx.owner, amount: tx.amount, timestamp: tx.timestamp })).filter(Boolean);
      if (!donations.length) return { last: this.lastDonation, count: 0 };
      donations.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
      return { last: donations[0], count: donations.length };
    } catch {
      return { last: this.lastDonation, count: 0 };
    }
  }

  async updateLatestDonation() {
    let last = null;
    try {
      if (typeof this.refreshDonationsCache === 'function') {
        const res = await this.refreshDonationsCache();
        last = res.last;
      } else {
        last = await this.fetchLastDonation(this.walletAddress);
      }
    } catch {}
    if (last && this.shouldUpdateDonation(last)) {
      this.lastDonation = last;
      this.notifyFrontend(last);
      this.saveDonationCache();
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

  broadcastConfig(config = {}) {
    try {
      const payload = {
        bgColor: config.bgColor,
        fontColor: config.fontColor,
        borderColor: config.borderColor,
        amountColor: config.amountColor,
        iconBgColor: config.iconBgColor,
        fromColor: config.fromColor,
        title: config.title
      };
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'lastTipConfig', data: payload }));
        }
      });
    } catch {}
  }
  
  updateWalletAddress(newAddress, reqForTenant) {
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(process.cwd(), 'config');
    const configPath = path.join(configDir, 'last-tip-config.json');
    const cachePath = path.join(configDir, 'last-donation-cache.json');
    let existing = {};
    if (fs.existsSync(configPath)) {
      try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    }

    if ((!newAddress || !newAddress.trim()) && existing.walletAddress) {
      this.walletAddress = existing.walletAddress;
      return this.getStatus();
    }
    const incoming = (newAddress || '').trim();
    const prev = this.walletAddress || '';
    const changed = !!incoming && incoming !== prev;
    this.walletAddress = incoming;
    if (changed) {
      this.processedTxs = new Set();
      this.lastDonation = null;
      try { if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); } catch {}
      this._cacheLoaded = false;

      try { if (this.walletAddress) this.updateLatestDonation(); } catch {}
    }
    const config = { ...existing, walletAddress: this.walletAddress };
    try {
      const hostedMode = !!process.env.REDIS_URL || process.env.GETTY_REQUIRE_SESSION === '1';
      if (!hostedMode) {
        if (existing.walletAddress && !this.walletAddress) {
          if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[LastTip][SKIP_WRITE_EMPTY_WALLET]', { existing: existing.walletAddress });
        } else {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          if (process.env.GETTY_DEBUG_CONFIG === '1') console.warn('[LastTip][WRITE_CONFIG]', { path: configPath, wallet: this.walletAddress });
        }
      } else if (reqForTenant && tenantEnabled && tenantEnabled(reqForTenant)) {
        try {
          const store = (reqForTenant.app && reqForTenant.app.get) ? reqForTenant.app.get('store') : null;
          saveTenantConfig(reqForTenant, store, configPath, 'last-tip-config.json', config)
            .then(res => { this._loadedMeta = res.meta; this._lastReqForSave = reqForTenant; })
            .catch(()=>{});
        } catch {}
      }
    } catch (e) { console.error('[LastTip] Error writing wallet address to config:', e.message); }
    if (this._lastReqForSave) this.scheduleWriteThrough(config);
    if (process.env.NODE_ENV !== 'test' && this.walletAddress) {

      this.updateLatestDonation();
    }
    return this.getStatus();
  }
  
  getLastDonation() {
    if (this.lastDonation) return this.lastDonation;

    if (!this._cacheLoaded) {
      this._cacheLoaded = true;
      try {
        const fs = require('fs');
        const path = require('path');
        const p = path.join(process.cwd(), 'config', 'last-donation-cache.json');
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (raw && raw.txId && raw.amount) {

            if (!raw.walletAddress || raw.walletAddress === this.walletAddress) {
              this.lastDonation = {
                from: raw.from,
                amount: raw.amount,
                txId: raw.txId,
                timestamp: raw.timestamp || Math.floor(Date.now() / 1000)
              };
            }
          }
        }
      } catch {}
    }
    return this.lastDonation || null;
  }
  
  getStatus() {
    const cached = this.lastDonation || this.getLastDonation();
    return {
      active: !!this.walletAddress,
      walletAddress: this.walletAddress,
      lastChecked: new Date().toISOString(),
      lastDonation: cached || null,
      processedTxs: this.processedTxs.size,
      meta: this._loadedMeta || null,
      diagnostics: {
        lastFetchTs: this._lastFetchTs,
        lastFetchTsIso: this._lastFetchTs ? new Date(this._lastFetchTs).toISOString() : null,
        lastFetchGatewayAttempts: this._lastFetchGatewayAttempts,
        lastFetchSucceededGateway: this._lastFetchSucceededGateway,
        lastFetchErrorCount: this._lastFetchErrorCount,
        fetchCount: this._fetchCount,
        hasDonationCached: !!cached
      }
    };
  }

  async fetchLastDonation(address) {
    try {
      if (typeof address !== 'string' || !address.trim()) return null;
      const txs = await this.getEnhancedTransactions(address.trim());
      if (!Array.isArray(txs) || txs.length === 0) return null;
      const sorted = txs
        .filter(tx => tx && tx.id && (typeof tx.amount === 'string' || typeof tx.amount === 'number'))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const seen = new Set();
      for (const tx of sorted) {
        if (seen.has(tx.id)) continue;
        seen.add(tx.id);
        const d = this.toDonation(tx);
        if (d) return d;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveDonationCache() {
    try {
      if (!this.lastDonation || !this.walletAddress) return;
      const fs = require('fs');
      const path = require('path');
      const configDir = path.join(process.cwd(), 'config');
      if (!fs.existsSync(configDir)) {
        try { fs.mkdirSync(configDir, { recursive: true }); } catch {}
      }
      const cachePath = path.join(configDir, 'last-donation-cache.json');
      const payload = {
        walletAddress: this.walletAddress,
        from: this.lastDonation.from,
        amount: this.lastDonation.amount,
        txId: this.lastDonation.txId,
        timestamp: this.lastDonation.timestamp
      };
      fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
    } catch {}
  }

  dispose() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    if (this._pendingFlush) {
      clearTimeout(this._pendingFlush);
      this._pendingFlush = null;
    }
  }
}

module.exports = LastTipModule;
