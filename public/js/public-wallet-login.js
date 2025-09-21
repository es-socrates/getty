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
        this.t = (k) => (this.messages && this.messages[k]) || k;
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

        if (!/\/admin\//.test(window.location.pathname)) {
            setTimeout(() => { window.location.href = '/admin/'; }, 350);
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
        banner.innerHTML = `
          <div class="banner-title">${title}</div>
          <div class="banner-msg" data-i18n="wanderMissingMsg">${missing}</div>
          <div class="banner-actions">
            <button type="button" data-act="dismiss">${dismiss}</button>
            <a href="https://chromewebstore.google.com/detail/wander/einnioafmpimabjcddiinlhmijaionap" target="_blank" rel="noopener" data-act="install" class="banner-install">${install}</a>
          </div>`;
        document.body.appendChild(banner);
        this.ui.installBanner = banner;
        banner.addEventListener('click', (e) => {
            const act = e.target && e.target.getAttribute('data-act');
            if (act === 'dismiss') this.hideInstallBanner();
        });
    }
    showInstallBanner() { if (this.ui.installBanner) this.ui.installBanner.style.display = 'block'; }
    hideInstallBanner() { if (this.ui.installBanner) this.ui.installBanner.style.display = 'none'; }

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
            toast.className = 'getty-toast' + (level === 'error' ? ' error' : (level === 'warn' ? ' warn' : ''));
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
            'bannerTitle','bannerMissing','bannerDismiss','bannerInstall','connecting','loginLabel',
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
}

document.addEventListener('DOMContentLoaded', () => {
    new WanderWalletLogin();
});