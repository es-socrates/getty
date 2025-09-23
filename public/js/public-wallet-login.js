(function ensureWalletLoginCss(){
    try {
        if (!document.querySelector('link[data-wallet-login-css]')) {
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = '/css/wallet-login.css';
            l.setAttribute('data-wallet-login-css','1');
            document.head.appendChild(l);
        }
    } catch {}
})();

class WanderWalletLogin {
    constructor() {
        this.isConnected = false;
        this.arweaveAddress = null;
        this.session = null;
        this.lastBalance = null;
        this.balanceFetchInFlight = false;
        this.balanceLastFetchTs = 0;

        this.arweave = (typeof Arweave !== 'undefined') ?
            Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' }) :
            this.createArweaveShim();
        this.ui = { installBanner: null };
        this.elements = {
            loginBtn: null,
            logoutBtn: null,
            userInfo: null,
            addressEl: null,
            balanceEl: null,
            statusDot: null,
            btnLabel: null
        };

        this.locale = this.detectLocale();
        this.messages = this.loadSharedMessages(this.locale);
        this.t = (k) => {

            if (this.messages && this.messages[k]) return this.messages[k];

            try {
                const globalStore = window.__i18n && window.__i18n[this.locale];
                if (globalStore && globalStore[k]) return globalStore[k];
            } catch {}

            return k;
        };
        this.init();
    }

    init() {
        this.elements.loginBtn = document.getElementById('public-wallet-login') || document.getElementById('wanderLoginBtn');
        this.elements.logoutBtn = document.getElementById('logoutBtn');
        this.elements.userInfo = document.getElementById('userInfo');
        this.elements.addressEl = document.getElementById('arweaveAddress');
        this.elements.balanceEl = document.getElementById('arweaveBalance');
        this.elements.inlineBalance = document.getElementById('login-balance');
        this.elements.openAdmin = document.getElementById('open-admin');
        this.elements.logoutInline = document.getElementById('logout-inline');
        this.elements.langInline = document.getElementById('language-selector-inline');
        this.elements.langBtn = document.getElementById('lang-btn');
        this.elements.langMenu = document.getElementById('lang-menu');
        this.elements.langBtnLabel = document.getElementById('lang-btn-label');
        this.elements.statusDot = document.querySelector('.connection-status .status-dot');
        this.elements.btnLabel = this.elements.loginBtn ? this.elements.loginBtn.querySelector('.btn-label') : null;
        this.safeAttach(this.elements.loginBtn, 'click', () => this.handleLoginClick());
        this.safeAttach(this.elements.logoutBtn, 'click', () => this.logout());
        this.safeAttach(this.elements.logoutInline, 'click', () => this.logout());
        this.safeAttach(this.elements.openAdmin, 'click', () => {
            try { window.open('/admin/', '_self'); } catch { window.location.href = '/admin/'; }
        });

            this.safeAttach(this.elements.langBtn, 'click', (e) => {
                e.preventDefault();
                const m = this.elements.langMenu;
                if (!m) return;
                const isHidden = m.classList.contains('hidden');
                if (isHidden) {
                    m.classList.remove('hidden');
                    this.elements.langBtn.setAttribute('aria-expanded','true');

                    const closer = (ev) => {
                        if (!m.contains(ev.target) && ev.target !== this.elements.langBtn) {
                            m.classList.add('hidden');
                            this.elements.langBtn.setAttribute('aria-expanded','false');
                            window.removeEventListener('click', closer);
                        }
                    };
                    setTimeout(() => window.addEventListener('click', closer), 0);
                } else {
                    m.classList.add('hidden');
                    this.elements.langBtn.setAttribute('aria-expanded','false');
                }
            });
            if (this.elements.langMenu) {
                this.elements.langMenu.querySelectorAll('[data-lang]').forEach(btn => {
                    this.safeAttach(btn, 'click', () => {
                        const lang = btn.getAttribute('data-lang');
                        try { localStorage.setItem('lang', lang); localStorage.setItem('admin_locale', lang); } catch {}

                        if (this.elements.langBtnLabel) {
                            this.elements.langBtnLabel.textContent = lang.toUpperCase();
                        }
                        window.location.reload();
                    });
                });
            }

            if (this.elements.langBtn && this.elements.langBtn.classList.contains('hidden')) {
                const origFn = this.updateUI.bind(this);
                this.updateUI = async (...args) => {
                    const res = await origFn(...args);
                    try {
                        if (this.elements.langBtn.dataset.visible === 'true') {
                            this.elements.langBtn.classList.add('flex');
                        }
                    } catch {}
                    return res;
                };
            }

        this.bootstrapSession();
        this.startWalletInjectionWatcher();
    this.ensureInstallBanner();

        try {
            const storedLang = (localStorage.getItem('lang') || this.locale || 'en').toLowerCase();
            if (this.elements.langBtnLabel) {
                this.elements.langBtnLabel.textContent = storedLang.toUpperCase();
            }
        } catch {}

        try {
            window.addEventListener('storage', (e) => {
                if (e && e.key === 'getty_logout') {
                    try { console.info('[wander-login] detected global logout event, refreshing'); } catch {}

                    this.isConnected = false;
                    this.arweaveAddress = null;
                    this.session = null;
                    localStorage.removeItem('wanderWalletConnected');
                    localStorage.removeItem('arweaveAddress');

                    setTimeout(() => { window.location.reload(); }, 100);
                }
            });
        } catch {}
    }

    safeAttach(el, ev, fn) { if (el) try { el.addEventListener(ev, fn); } catch {} }

    createArweaveShim() {
        const WINSTON_PER_AR = 1e12;
        return {
            wallets: {
                async getBalance(address) {
                    if (!address) return '0';
                    try {
                        const r = await fetch('https://arweave.net/wallet/' + address + '/balance', { cache: 'no-store' });
                        if (!r.ok) return '0';
                        return await r.text();
                    } catch { return '0'; }
                }
            },
            ar: {
                winstonToAr(winston) {
                    try {
                        const n = parseFloat(winston || '0');
                        if (!isFinite(n)) return '0';
                        return (n / WINSTON_PER_AR).toString();
                    } catch { return '0'; }
                }
            }
        };
    }

    async bootstrapSession() {
        try {
            const me = await this.fetchMe();
            if (me && me.address) {
                this.session = me;
                this.arweaveAddress = me.address;
                this.isConnected = true;

                await this.updateUI();

                this.scheduleBalanceFetch();
                return;
            }
        } catch {}

        this.checkLegacyLocalSession();
    }

    checkLegacyLocalSession() {
        const isConn = localStorage.getItem('wanderWalletConnected') === 'true';
        const addr = localStorage.getItem('arweaveAddress');
        if (isConn && addr) {
            this.isConnected = true;
            this.arweaveAddress = addr;
            this.getBalance().then(b => this.updateUI(b));
        } else {
            this.updateUI();
        }
    }

    async handleLoginClick() {
        if (!this.elements.loginBtn) return;
        if (this.isConnected) return;
        try {
            this.setLoading(true, this.t('connecting'));
            await this.loginFlow();
        } catch (e) {
            console.error('[wander-login] login failed', e);
            this.showError(e.message || 'Unknown error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading, label) {
        const btn = this.elements.loginBtn;
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            if (this.elements.btnLabel) this.elements.btnLabel.textContent = label || '...';
        } else {
            btn.classList.remove('loading');
            if (this.elements.btnLabel) this.elements.btnLabel.textContent = this.t('loginLabel');
        }
    }

    async loginFlow() {
        await this.ensureWalletLoadedEvent();

        const wallet = await this.waitForWallet(2000, 150);
    if (!wallet) throw new Error(this.t('notDetectedError'));

        let existingPerms = [];
        if (typeof wallet.getPermissions === 'function') {
            try { existingPerms = await wallet.getPermissions() || []; } catch {}
        }
        const needed = ['ACCESS_ADDRESS','ACCESS_PUBLIC_KEY','SIGN_MESSAGE'];
        const hasAll = needed.every(p => existingPerms.includes(p));
    const address = hasAll ? await this.getActiveAddressSafe(wallet) : await this.connectWithPermissions(wallet, needed);
    if (!address) throw new Error(this.t('noAddressConnect'));

    let publicKey = await this.obtainPublicKey(wallet);
    if (!publicKey) throw new Error(this.t('publicKeyMissing'));
    console.info('[wander-login] publicKey obtained type=', typeof publicKey, 'preview=', (typeof publicKey === 'string' ? publicKey.slice(0,16) : '[obj]'));

        const nonceResp = await this.postJson('/api/auth/wander/nonce', { address });
        if (nonceResp.error) throw new Error('Nonce error: ' + nonceResp.error);
        const message = nonceResp.message;
        if (!message) throw new Error('No message to sign was received');

        try {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(message);
            const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
            const h = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
            console.info('[wander-login][debug] message bytes', bytes.length, 'sha256', h.slice(0,32));
        } catch {}
        console.info('[wander-login] signing message of length', message?.length);
        const firstSig = await this.signMessage(message, { order: 'message-first' });
        let signatureB64 = this.toBase64Url(firstSig.signature);
        const publicKeyB64 = this.normalizePublicKey(publicKey);
        console.info('[wander-login] signature method', firstSig.method, 'sigPreview=', signatureB64.slice(0,16));

        let verifyResp = await this.postJson('/api/auth/wander/verify', { address, publicKey: publicKeyB64, signature: signatureB64 });
        if (!verifyResp || !verifyResp.success) {
            if (verifyResp && verifyResp.error === 'bad_signature') {
                console.warn('[wander-login] bad_signature: attempting alternative strategy');
                try {
                    const altSig = await this.signMessage(message, { order: 'signature-first', exclude: firstSig.method });
                    signatureB64 = this.toBase64Url(altSig.signature);
                    console.info('[wander-login] reattempt signature method', altSig.method, 'sigPreview=', signatureB64.slice(0,16));
                    verifyResp = await this.postJson('/api/auth/wander/verify', { address, publicKey: publicKeyB64, signature: signatureB64 });
                } catch (e) {
                    console.warn('[wander-login] reattempt signature failed', e?.message || e);
                }
            }
            if (!verifyResp || !verifyResp.success) {
                throw new Error(verifyResp?.error || 'Verification failed');
            }
        }

        this.session = verifyResp;
        this.arweaveAddress = address;
        this.isConnected = true;
        localStorage.setItem('wanderWalletConnected', 'true');
        localStorage.setItem('arweaveAddress', address);

        await this.updateUI();
        this.scheduleBalanceFetch();
        console.log('[wander-login] connected', address);

        const isOnMainPage = window.location.pathname === '/' || window.location.pathname === '/index.html';

        if (isOnMainPage) {

            this.showUserDashboard();
        } else {

            setTimeout(() => { window.open('/admin/', '_self'); }, 350);
        }
    }

    async signMessage(message, opts = {}) {
        if (!this.isWalletReady()) throw new Error(this.t('walletNotReady'));
        const w = this.resolveWalletHandle();
        if (!w) throw new Error(this.t('walletNotAvailable'));

        const orderMsgFirst = ['signMessage','signature','_signatureAlgo'];
        const orderSigFirst = ['signature','signMessage','_signatureAlgo'];
        const exclude = opts.exclude || null;
        let order = orderMsgFirst;
        if (opts.order === 'signature-first') order = orderSigFirst;
        const input = this.prepareMessageForSigning(message);
        const algoAttempts = [
            { name: 'RSA-PSS', saltLength: 0 },
            { name: 'RSA-PSS', saltLength: 32 },
            { name: 'RSA-PKCS1-v1_5' }
        ];
        for (const method of order) {
            if (exclude && method === exclude) continue;
            if (method === '_signatureAlgo') {
                if (typeof w.signature === 'function') {
                    for (const alg of algoAttempts) {
                        try {
                            const resp = await w.signature(input, alg);
                            if (!resp) continue;
                            if (typeof resp === 'object' && resp.signature) return { signature: resp.signature, method: 'signature('+alg.name+')' };
                            return { signature: resp, method: 'signature('+alg.name+')' };
                        } catch (e) {
                            if (/Algorithm cannot be undefined/i.test(e?.message || '')) continue;
                            console.warn('[wander-login] failure signature alg', alg.name, e?.message || e);
                        }
                    }
                }
                continue;
            }
            if (typeof w[method] === 'function') {
                try {
                    const resp = await w[method](input);
                    if (!resp) continue;
                    if (typeof resp === 'object' && resp.signature) return { signature: resp.signature, method };
                    return { signature: resp, method };
                } catch (e) {
                    console.warn('[wander-login] failure', method, e?.message || e);
                }
            }
        }
        throw new Error(this.t('signatureMethodsUnavailable'));
    }

    prepareMessageForSigning(message) {
        if (!message) throw new Error('Empty message to sign');

        if (message instanceof Uint8Array) return message;
        if (message instanceof ArrayBuffer) return new Uint8Array(message);

        const b64Regex = /^[A-Za-z0-9+/=]+$/;
        if (typeof message === 'string') {
            try {
                const enc = new TextEncoder().encode(message);
                if (enc?.length) return enc;
            } catch {}

            if (b64Regex.test(message) && message.length % 4 === 0) {
                try {
                    const bin = atob(message);
                    const arr = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                    return arr;
                } catch {}
            }

            return new TextEncoder().encode(String(message));
        }

        if (typeof message === 'object') {
            try { return new TextEncoder().encode(JSON.stringify(message)); } catch {
                return new TextEncoder().encode(String(message));
            }
        }

        return new TextEncoder().encode(String(message));
    }

    isWalletReady() { return !!this.resolveWalletHandle(); }

    resolveWalletHandle() {
        if (typeof window.wanderWallet !== 'undefined') return window.wanderWallet;
        if (typeof window.wander !== 'undefined') return window.wander;
        if (typeof window.arweaveWallet !== 'undefined') return window.arweaveWallet;

        return null;
    }

    async waitForWallet(timeoutMs = 2000, stepMs = 100) {
        const start = Date.now();
        let logged = false;
        while (Date.now() - start < timeoutMs) {
            const w = this.resolveWalletHandle();
            if (w) {
                if (!logged) {
                    try { console.info('[wander-login] wallet available after', Date.now() - start, 'ms', Object.keys(w)); } catch {}
                }
                return w;
            }
            await new Promise(r => setTimeout(r, stepMs));
        }
        return null;
    }

    startWalletInjectionWatcher() {
        const MAX_MS = 5000;
        const intervalMs = 250;
        const start = Date.now();
        const tick = () => {
            if (this.isWalletReady()) {
                this.hideInstallBanner();
                try { console.info('[wander-login] wallet detectada tras', Date.now() - start, 'ms'); } catch {}
                return;
            }
            if (Date.now() - start < MAX_MS) {
                setTimeout(tick, intervalMs);
            } else {
                try { console.warn('[wander-login] wallet not detected after waiting. Make sure the extension is enabled for this site.'); } catch {}
                this.showInstallBanner();
            }
        };
        setTimeout(tick, intervalMs);
    }

    ensureInstallBanner() {
        if (document.getElementById('wander-install-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'wander-install-banner';
        const title = this.t('bannerTitle');
        const missing = this.t('bannerMissing');
        const dismiss = this.t('bannerDismiss');
        const install = this.t('bannerInstall');

        const titleEl = document.createElement('div');
        titleEl.className = 'banner-title';
        titleEl.textContent = title;

        const msgEl = document.createElement('div');
        msgEl.className = 'banner-msg';
        msgEl.setAttribute('data-i18n','wanderMissingMsg');
        msgEl.textContent = missing;

        const actions = document.createElement('div');
        actions.className = 'actions';

        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.setAttribute('data-act','dismiss');
        dismissBtn.textContent = dismiss;

        const installLink = document.createElement('a');
        installLink.href = 'https://chromewebstore.google.com/detail/wander/einnioafmpimabjcddiinlhmijaionap';
        installLink.target = '_blank';
        installLink.rel = 'noopener';
        installLink.setAttribute('data-act','install');
        installLink.textContent = install;

        actions.appendChild(dismissBtn);
        actions.appendChild(installLink);

        banner.appendChild(titleEl);
        banner.appendChild(msgEl);
        banner.appendChild(actions);

        try { banner.style.display = 'none'; } catch {}
        document.body.appendChild(banner);
        this.ui.installBanner = banner;
        banner.addEventListener('click', (e) => {
            const act = e.target && e.target.getAttribute('data-act');
            if (act === 'dismiss') this.hideInstallBanner();
        });
    }
    showInstallBanner() {
        if (this.ui.installBanner) {
            try { this.ui.installBanner.style.display = 'block'; } catch {}

            try { this.ui.installBanner.classList.remove('hidden'); } catch {}
        }
    }
    hideInstallBanner() {
        if (this.ui.installBanner) {
            try { this.ui.installBanner.style.display = 'none'; } catch {}
            try { this.ui.installBanner.classList.add('hidden'); } catch {}
        }
    }

    toBase64Url(val) {
        try {

            if (val instanceof Uint8Array) {
                return this._u8ToB64Url(val);
            }

            if (val instanceof ArrayBuffer) {
                return this._u8ToB64Url(new Uint8Array(val));
            }

            if (typeof val === 'string' && /^[0-9a-fA-F]+$/.test(val) && val.length % 2 === 0) {
                const u8 = new Uint8Array(val.length / 2);
                for (let i = 0; i < val.length; i += 2) {
                    u8[i/2] = parseInt(val.substring(i, i+2), 16);
                }
                return this._u8ToB64Url(u8);
            }

            if (typeof val === 'string' && /[+/=]/.test(val)) {
                return val.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
            }

            if (typeof val === 'string' && /^[A-Za-z0-9_-]+$/.test(val)) {
                return val.replace(/=+$/,'');
            }

            if (val && typeof val === 'object' && val.signature) {
                return this.toBase64Url(val.signature);
            }

            if (typeof val === 'string') {
                const enc = new TextEncoder().encode(val);
                return this._u8ToB64Url(enc);
            }
            if (val) {
                const enc = new TextEncoder().encode(JSON.stringify(val));
                return this._u8ToB64Url(enc);
            }
        } catch (e) {
            console.warn('[wander-login] toBase64Url fallo', e);
        }
        throw new Error('Formato de firma o clave desconocido');
    }

    _u8ToB64Url(u8) {
        let binary = '';
        for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
        const b64 = btoa(binary);
        return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }

    async postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        let json; try { json = await res.json(); } catch { json = { error: 'bad_json' }; }
        return json;
    }

    async fetchMe() {
        try {
            const res = await fetch('/api/auth/wander/me', { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (res.status === 401) return null;
            return await res.json();
        } catch { return null; }
    }

    async logout() {
        try { await this.postJson('/api/auth/wander/logout', {}); } catch {}

        try {
            const w = this.resolveWalletHandle();
            if (w && typeof w.disconnect === 'function') w.disconnect();
        } catch {}

        this.isConnected = false;
        this.arweaveAddress = null;
        this.session = null;
        localStorage.removeItem('wanderWalletConnected');
        localStorage.removeItem('arweaveAddress');

        try { localStorage.setItem('getty_logout', String(Date.now())); } catch {}
 
        this.updateUI();
    }
    
    async connectWallet() { return this.loginFlow(); }
    
    async getBalance() {
        try {
            if (!this.arweaveAddress) return '0';

            const CACHE_KEY = 'arweaveBalanceCache';
            const TTL = 60_000;
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (cached && cached.addr === this.arweaveAddress && (Date.now() - cached.ts) < TTL) {
                        return cached.val;
                    }
                }
            } catch {}

            const controller = new AbortController();
            const timeout = setTimeout(() => { try { controller.abort(); } catch {} }, 3000);
            let winston;
            try {
                winston = await Promise.race([
                    this.arweave.wallets.getBalance(this.arweaveAddress),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('balance_timeout')), 3000))
                ]);
            } finally { clearTimeout(timeout); }
            const ar = this.arweave.ar.winstonToAr(winston);
            const val = parseFloat(ar).toFixed(4);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ addr: this.arweaveAddress, ts: Date.now(), val })); } catch {}
            return val;
        } catch (error) {
            console.warn('[wander-login] Failed to obtain balance', error?.message || error);
            return null;
        }
    }
    
    disconnectWallet() { return this.logout(); }
    
    async updateUI(balance = undefined) {
    const { loginBtn, userInfo, addressEl, balanceEl, statusDot, btnLabel, inlineBalance, openAdmin, logoutInline, langBtn } = this.elements;
        if (this.isConnected) {
            const truncated = this.truncateAddress(this.arweaveAddress);
            if (loginBtn) {
                loginBtn.dataset.state = 'logged-in';
                if (btnLabel) btnLabel.textContent = truncated;
                loginBtn.title = this.arweaveAddress || '';
            }
            if (inlineBalance) {
                let displayBalance = typeof balance === 'string' ? balance : (this.lastBalance || '');
                if (!displayBalance) {
                    inlineBalance.textContent = '…';
                } else {
                    inlineBalance.textContent = displayBalance + ' AR';
                }
                inlineBalance.classList.remove('hidden');
            }
            if (userInfo) userInfo.style.display = 'none';
            if (addressEl) addressEl.textContent = this.arweaveAddress || '';
            if (balanceEl) balanceEl.textContent = balance;
            if (openAdmin) { openAdmin.classList.remove('hidden'); openAdmin.dataset.visible = 'true'; }
            if (logoutInline) {
                logoutInline.classList.remove('hidden');
                logoutInline.dataset.visible = 'true';
                try {
                        const candidates = ['logoutLabel','walletLogout','walletPublic.logoutLabel'];
                        let chosen = '';
                        for (const c of candidates) {
                            const v = this.t(c);
                            if (v && v !== c) { chosen = v; break; }
                        }
                        if (chosen) {
                            const span = logoutInline.querySelector('[data-i18n]');
                            if (span) span.textContent = chosen; else logoutInline.textContent = chosen;
                            logoutInline.title = chosen;
                            logoutInline.setAttribute('aria-label', chosen);
                    }
                } catch {}
            }
            if (langBtn) { langBtn.classList.remove('hidden'); langBtn.dataset.visible = 'true'; langBtn.classList.add('flex'); }
            if (statusDot) {
                statusDot.classList.remove('disconnected');
                statusDot.classList.add('connected');
            }
        } else {
            if (loginBtn) {
                loginBtn.dataset.state = 'logged-out';
                if (btnLabel) btnLabel.textContent = this.t('loginLabel');
                loginBtn.title = this.t('loginLabel');
            }
            if (inlineBalance) {
                inlineBalance.textContent = '';
                inlineBalance.classList.add('hidden');
            }
            if (userInfo) userInfo.style.display = 'none';
            if (openAdmin) { openAdmin.classList.add('hidden'); openAdmin.dataset.visible = 'false'; }
            if (logoutInline) { logoutInline.classList.add('hidden'); logoutInline.dataset.visible = 'false'; }

            if (langBtn) {
                langBtn.classList.remove('hidden');
                langBtn.dataset.visible = 'true';
                langBtn.classList.add('flex');
            }
            if (statusDot) {
                statusDot.classList.remove('connected');
                statusDot.classList.add('disconnected');
            }
        }
    }

    scheduleBalanceFetch(force = false) {
        if (!this.isConnected || !this.arweaveAddress) return;
        const now = Date.now();
        if (!force && (this.balanceFetchInFlight || (now - this.balanceLastFetchTs) < 15000)) return; // throttle 15s
        this.balanceFetchInFlight = true;
        this.getBalance()
            .then(b => {
                if (b) {
                    this.lastBalance = b;
                    this.balanceLastFetchTs = Date.now();

                    if (this.elements.inlineBalance && this.isConnected) {
                        this.elements.inlineBalance.textContent = b + ' AR';
                    }
                } else if (b === null) {
                }
            })
            .catch(() => {})
            .finally(() => { this.balanceFetchInFlight = false; });
    }

    truncateAddress(addr) {
        if (!addr) return '';
        if (addr.length <= 12) return addr;
        return addr.slice(0,6) + '…' + addr.slice(-4);
    }

    async connectWithPermissions(wallet) {
        const permsPrimary = [
            'ACCESS_ADDRESS',
            'ACCESS_PUBLIC_KEY',
            'SIGNATURE',
            'SIGN_MESSAGE',
            'DISPATCH'
        ];
        const attempts = [];

        attempts.push(async () => wallet.connect(permsPrimary));
        attempts.push(async () => wallet.connect({ permissions: permsPrimary }));

        const permsMinimal = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGNATURE'];
        attempts.push(async () => wallet.connect(permsMinimal));
        attempts.push(async () => wallet.connect({ permissions: permsMinimal }));

        let lastErr;
        for (const attempt of attempts) {
            try {
                const maybeAddr = await attempt();
                let address = maybeAddr;
                if (!address && typeof wallet.getActiveAddress === 'function') {
                    try { address = await wallet.getActiveAddress(); } catch {}
                }
                if (address) return address;
 
                if (!address) {
                    await new Promise(r => setTimeout(r, 150));
                    if (typeof wallet.getActiveAddress === 'function') {
                        try { address = await wallet.getActiveAddress(); } catch {}
                    }
                    if (address) return address;
                }
            } catch (e) {
                lastErr = e;
                if (/(denied|reject|user)/i.test(String(e?.message))) {
                    throw new Error('Permissions denied by the user');
                }
            }
        }
        console.error('[wander-login] connect failed', lastErr);
        throw lastErr || new Error('Unable to connect wallet');
    }

    async obtainPublicKey(wallet) {
        if (typeof wallet.getActivePublicKey === 'function') {
            try { const pk = await wallet.getActivePublicKey(); if (pk) return pk; } catch (e) { console.warn('[wander-login] getActivePublicKey failed', e); }
        }
        if (typeof wallet.getPublicKey === 'function') {
            try { const pk = await wallet.getPublicKey(); if (pk) return pk; } catch (e) { console.warn('[wander-login] getPublicKey failed', e); }
        }
        if (wallet.publicKey) return wallet.publicKey;

        if (wallet.account && wallet.account.publicKey) return wallet.account.publicKey;
        return null;
    }
    async ensureWalletLoadedEvent() {
        if (this.isWalletReady()) return;
        let resolved = false;
        await Promise.race([
            new Promise(r => setTimeout(r, 1200)),
            new Promise(r => {
                try {
                    window.addEventListener('arweaveWalletLoaded', () => { resolved = true; r(); }, { once: true });
                } catch { r(); }
            })
        ]);
        if (!resolved && !this.isWalletReady()) {
        }
    }
    async getActiveAddressSafe(wallet) {
        if (typeof wallet.getActiveAddress === 'function') {
            try { const a = await wallet.getActiveAddress(); if (a) return a; } catch {}
        }
        if (typeof wallet.getAllAddresses === 'function') {
            try {
                const list = await wallet.getAllAddresses();
                if (Array.isArray(list) && list.length) return list[0];
            } catch {}
        }
        return null;
    }
    normalizePublicKey(pk) {
        try {
            if (typeof pk === 'string') return this.toBase64Url(pk);
            if (pk && typeof pk === 'object') {
                if (typeof pk.n === 'string') return this.toBase64Url(pk.n);
                if (typeof pk.publicKey === 'string') return this.toBase64Url(pk.publicKey);
            }
        } catch (e) { console.warn('[wander-login] normalizePublicKey failed', e); }
        return this.toBase64Url(pk);
    }
    
    showError(message) {
        try { console.warn('[wander-login] error', message); } catch {}
        const walletNotDetected = /wander wallet.*(no detectada|not detected)/i.test(message);
        if (walletNotDetected) {
            this.showInstallBanner();
            this.maybeToast(message, 'warn');
            return;
        }

        try { alert(this.t('errorPrefix') + ': ' + message + '\n\n' + this.t('alertSuffix')); } catch {}

        if (/install.+wander wallet/i.test(message)) {
            const url = 'https://chromewebstore.google.com/detail/wander/einnioafmpimabjcddiinlhmijaionap';
            try { if (window.confirm(this.t('openInstallConfirm'))) window.open(url, '_blank'); } catch {}
        }
    }

    maybeToast(message, level = 'info') {
        try {

            if (typeof window.showToast === 'function') {
                window.showToast(message, level);
                return;
            }

            let root = document.getElementById('getty-toast-root');
            if (!root) {
                root = document.createElement('div');
                root.id = 'getty-toast-root';
                document.body.appendChild(root);
            }
            const toast = document.createElement('div');
            toast.className = 'getty-toast';
            if (level === 'warn') toast.classList.add('warn');
            else if (level === 'error') toast.classList.add('error');
            toast.textContent = message;
            root.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 400);
            }, 4200);
        } catch {}
    }

    async signData(data) { return this.signMessage(data); }

    async sendTransaction(transaction) {
        if (!this.isConnected) {
            throw new Error(this.t('walletNotConnected'));
        }
        
        try {
            const w = this.resolveWalletHandle();
            if (!w || typeof w.dispatch !== 'function') throw new Error('dispatch not supported by the wallet');
            const result = await w.dispatch(transaction);
            return result;
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    }

    detectLocale() {
        try {
            const stored = (localStorage.getItem('lang') || localStorage.getItem('admin_locale') || '').toLowerCase();
            if (stored === 'es' || stored === 'en') return stored;
        } catch {}
        try {
            const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
            if (/^es/i.test(nav)) return 'es';
        } catch {}
        return 'en';
    }
    loadSharedMessages(locale) {

        const prefix = 'walletPublic.';
        const keys = [
            'bannerTitle','bannerMissing','bannerDismiss','bannerInstall','connecting','loginLabel','logoutLabel','welcomeUser',
            'notDetectedError','noAddressConnect','publicKeyMissing','signatureMethodsUnavailable',
            'walletNotReady','walletNotAvailable','walletNotConnected','openInstallConfirm','alertSuffix','errorPrefix'
        ];
        const out = {};
        let foundAny = false;
        try {
            const store = (window.__i18n && window.__i18n[locale]) || (window.__i18n && window.__i18n.en) || null;
            if (store) {
                for (const k of keys) {
                    const full = prefix + k;
                    if (Object.prototype.hasOwnProperty.call(store, full)) {
                        out[k] = store[full];
                        foundAny = true;
                    }
                }
            }
        } catch {}

        if (!foundAny) {
            if (locale === 'es') {
                return {
                    bannerTitle: 'Wander Wallet',
                    bannerMissing: 'No detectada. Instala la extensión para iniciar sesión segura.',
                    bannerDismiss: 'OK',
                    bannerInstall: 'Instalar',
                    connecting: 'Conectando...',
                    loginLabel: 'Conectar',
                    logoutLabel: 'Cerrar sesión',
                    welcomeUser: 'Bienvenido, {token}',
                    notDetectedError: 'Wander Wallet no detectada',
                    noAddressConnect: 'No se obtuvo dirección (connect)',
                    publicKeyMissing: 'No se pudo obtener la clave pública',
                    signatureMethodsUnavailable: 'Métodos de firma no disponibles',
                    walletNotReady: 'Wallet no lista',
                    walletNotAvailable: 'Wallet no disponible',
                    walletNotConnected: 'Wallet no conectada',
                    openInstallConfirm: '¿Abrir la página de instalación de Wander Wallet?',
                    alertSuffix: 'Asegúrate de tener la extensión Wander Wallet instalada y habilitada.',
                    errorPrefix: 'Error'
                };
            }
            return {
                bannerTitle: 'Wander Wallet',
                bannerMissing: 'Not detected. Install the extension to sign in securely.',
                bannerDismiss: 'OK',
                bannerInstall: 'Install',
                connecting: 'Connecting...',
                loginLabel: 'Login',
                logoutLabel: 'Logout',
                welcomeUser: 'Welcome, {token}',
                notDetectedError: 'Wander Wallet not detected',
                noAddressConnect: 'No address received (connect)',
                publicKeyMissing: 'Public key could not be obtained',
                signatureMethodsUnavailable: 'Signature methods not available',
                walletNotReady: 'Wallet not ready',
                walletNotAvailable: 'Wallet not available',
                walletNotConnected: 'Wallet not connected',
                openInstallConfirm: 'Open the Wander Wallet installation page?',
                alertSuffix: 'Make sure you have the Wander Wallet extension installed and enabled.',
                errorPrefix: 'Error'
            };
        }
        return out;
    }

    showUserDashboard() {

        const userToken = this.session?.userToken || this.arweaveAddress?.slice(0, 8);
        const welcomeEl = document.getElementById('user-welcome-message');
        if (welcomeEl) {
            welcomeEl.textContent = this.t('welcomeUser').replace('{token}', userToken);
            welcomeEl.classList.remove('hidden');
        }

        document.body.classList.add('user-dashboard-mode');
        document.body.classList.remove('landing');

        this.loadUserSpecificConfig();
        
        if (typeof window.loadUserSpecificWidgets === 'function') {
            window.loadUserSpecificWidgets();
        }
    }

    async loadUserSpecificConfig() {
        try {

            const response = await fetch('/api/user/config');
            if (response.ok) {
                const config = await response.json();
                this.applyUserConfigToWidgets(config);
            }
        } catch (e) {
            console.warn('[wander-login] Failed to load user config', e);
        }
    }

    applyUserConfigToWidgets(config) {
        if (config.lastTip?.title) {
            const lastTipTitle = document.querySelector('#last-donation .os-panel-title span:last-child');
            if (lastTipTitle) lastTipTitle.textContent = config.lastTip.title;
        }

        if (config.colors) {
            this.applyCustomColors(config.colors);
        }
    }

    applyCustomColors(colors) {
        const root = document.documentElement;
        if (colors.primary) root.style.setProperty('--user-primary-color', colors.primary);
        if (colors.secondary) root.style.setProperty('--user-secondary-color', colors.secondary);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WanderWalletLogin();
});