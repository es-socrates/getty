const axios = require('axios');
const WebSocket = require('ws');

class LastTipModule {
  constructor(wss) {
    this.wss = wss;
    this.ARWEAVE_GATEWAYS = [
      'https://arweave.net',
      'https://ar-io.net',
      'https://arweave.live',
      'https://arweave-search.goldsky.com',
      'https://permagate.io',
      'https://zerosettle.online',
      'https://zigza.xyz',
      'https://ario-gateway.nethermind.dev'
    ];

    if (process.env.LAST_TIP_EXTRA_GATEWAYS) {
      try {
        const extra = String(process.env.LAST_TIP_EXTRA_GATEWAYS)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => (s.startsWith('http') ? s : `https://${s}`)
            .replace(/\/$/, ''));
        this.ARWEAVE_GATEWAYS.push(...extra);
      } catch {}
    }
    this.ARWEAVE_GATEWAYS = Array.from(new Set(this.ARWEAVE_GATEWAYS));
    this.GRAPHQL_TIMEOUT = Number(process.env.LAST_TIP_GRAPHQL_TIMEOUT_MS || 10000);
    this.VIEWBLOCK_TIMEOUT = Number(process.env.LAST_TIP_VIEWBLOCK_TIMEOUT_MS || 6000);
    this.walletAddress = null;
  this.lastDonation = null;
    this.processedTxs = new Set();
    this.loadWalletAddress();
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

    const lastTipConfigPath = path.join(configDir, 'last-tip-config.json');
    const lastTipDefault = {
      walletAddress: '',
      bgColor: '#080c10',
      fontColor: '#ffffff',
      borderColor: '#00ff7f',
      amountColor: '#00ff7f',
      iconColor: '#ffffff',
      iconBgColor: '#4f36ff',
      fromColor: '#817ec8'
    };
    if (!fs.existsSync(lastTipConfigPath)) {
      fs.writeFileSync(lastTipConfigPath, JSON.stringify(lastTipDefault, null, 2));
      console.log('[LastTip] last-tip-config.json created with default values');
    }

    try {
      let config = JSON.parse(fs.readFileSync(lastTipConfigPath, 'utf8'));
      if (config.walletAddress) {
        this.walletAddress = config.walletAddress;
      }
      if (!this.walletAddress) {
        try {
          const tgPath = path.join(configDir, 'tip-goal-config.json');
          if (fs.existsSync(tgPath)) {
            const tg = JSON.parse(fs.readFileSync(tgPath, 'utf8'));
            if (typeof tg.walletAddress === 'string' && tg.walletAddress.trim()) {
              this.walletAddress = tg.walletAddress.trim();
              const updated = { ...config, walletAddress: this.walletAddress };
              try { fs.writeFileSync(lastTipConfigPath, JSON.stringify(updated, null, 2)); } catch {}
              console.log('[LastTip] Wallet address imported from tip-goal-config.json');
            }
          }
        } catch {}
      }

      try {
        const legacyPath = path.join(process.cwd(), 'last-tip-config.json');
        if (fs.existsSync(legacyPath)) {
          const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) || {};
          const needsMerge = !this.walletAddress || !config || typeof config !== 'object';
          const hasLegacyData = legacy && (legacy.walletAddress || legacy.borderColor || legacy.bgColor || legacy.title);
          if (hasLegacyData && needsMerge) {
            const merged = { ...lastTipDefault, ...config, ...legacy };
            try { fs.writeFileSync(lastTipConfigPath, JSON.stringify(merged, null, 2)); } catch {}
            if (merged.walletAddress && !this.walletAddress) this.walletAddress = merged.walletAddress;
            console.log('[LastTip] Migrated settings from legacy last-tip-config.json into config/');
          }
        }
      } catch {}
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
    if (process.env.NODE_ENV !== 'test') {
      const quickDelays = [2000, 5000, 10000, 20000];
      quickDelays.forEach(d => setTimeout(() => { try { this.updateLatestDonation(); } catch {} }, d));
      setInterval(() => this.updateLatestDonation(), 60000);
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
      const resp = await axios.post(
        url,
        { query, variables: { recipients: [address] } },
        { timeout: this.GRAPHQL_TIMEOUT, validateStatus: (s) => s >= 200 && s < 300 }
      );
      const edges = resp.data?.data?.transactions?.edges || [];
      if (!Array.isArray(edges)) throw new Error('Bad GraphQL shape');
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

      }
    } else {
      for (const gw of gateways) {
        try {
          graphqlResults = await tryGateway(gw);
          break;
  } catch {

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

      }
    }

    console.warn('[LastTip] All transaction fetchers failed (GraphQL gateways). Will retry next interval.');
    return [];
  }
  
  async refreshDonationsCache() {
    const transactions = await this.getEnhancedTransactions(this.walletAddress);
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { last: null };
    }
    const sortedTxs = transactions
      .filter(tx => tx && tx.id && (typeof tx.amount === 'string' || typeof tx.amount === 'number'))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const seen = new Set();
    let last = null;
    for (const tx of sortedTxs) {
      if (seen.has(tx.id)) continue;
      const d = this.toDonation(tx);
      if (!d) continue;
      seen.add(tx.id);
      last = d;
      break;
    }

    if (last && !this.processedTxs.has(last.txId)) this.processedTxs.add(last.txId);

    if (last) this.lastDonation = last;

    // persist
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), 'config');
      fs.writeFileSync(path.join(dir, 'last-donation-cache.json'), JSON.stringify(this.lastDonation || null, null, 2));
    } catch {}

    return { last: this.lastDonation };
  }
  
  shouldUpdateDonation(newDonation) {
    if (!this.lastDonation) return true;
    return newDonation.txId !== this.lastDonation.txId;
  }
  
  async updateLatestDonation() {
  const { last } = await this.refreshDonationsCache();
    if (last && this.shouldUpdateDonation(last)) {
      this.lastDonation = last;
      this.notifyFrontend(last);
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
        iconColor: config.iconColor,
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
  
  updateWalletAddress(newAddress) {
    this.walletAddress = newAddress;
    this.processedTxs = new Set();
    this.lastDonation = null;

    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(process.cwd(), 'config');
    const configPath = path.join(configDir, 'last-tip-config.json');
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
    if (this.lastDonation) return this.lastDonation;

    try {
      const fs = require('fs');
      const path = require('path');
      const p = path.join(process.cwd(), 'config', 'last-donation-cache.json');
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (raw && raw.txId && raw.amount) {
          this.lastDonation = raw;
          return this.lastDonation;
        }
      }
    } catch {}
    return null;
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
