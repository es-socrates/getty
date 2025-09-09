(() => {
    let __started = false;
    function startOnce(fn) {
        if (__started) return;
        __started = true;
        try { fn(); } catch (e) { console.error('LastTip init error:', e); }
    }

    function init() {
    const lastDonationElement = document.getElementById('last-donation');
    if (!lastDonationElement) {
        console.error('Error: Element #last-donation not found');
        return;
    }

    const titleElement = document.querySelector('.notification-title');
    const amountElement = document.querySelector('.notification-amount .ar-amount');
    const symbolElement = document.querySelector('.notification-amount .ar-symbol');
    const usdValueElement = document.querySelector('.notification-amount .usd-value');
    const fromElement = document.querySelector('.notification-from-lasttip');

    if (!titleElement) {
        console.error('Element .notification-title not found');
        return;
    }

    let AR_TO_USD = 0;
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';

    const __cookie = (name) => (document.cookie.split('; ').find(r=>r.startsWith(name+'='))||'').split('=')[1] || '';
    const token = __cookie('getty_public_token') || __cookie('getty_admin_token') || new URLSearchParams(location.search).get('token') || '';
    const q = token ? `/?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${wsProto}://${window.location.host}${q}`);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Recent';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    const formatArAmount = (amount) => {
        const num = parseFloat(amount);
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    };

    const calculateUsdValue = (arAmount) => {
        const arNum = parseFloat(arAmount);
        if (isNaN(arNum) || AR_TO_USD === 0) return '';
        
        const usdValue = arNum * AR_TO_USD;
        return `≈ $${usdValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} USD`;
    };

    const updateExchangeRate = async () => {
        try {
            const res = await fetch('/api/ar-price').catch(()=>null);
            if (res.ok) {
                let data = null; try { data = await res.json(); } catch {}
                if (data?.arweave?.usd) {
                    AR_TO_USD = Number(data.arweave.usd) || AR_TO_USD || 5;
                    return;
                }
            }
    } catch {}
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
            const data = await response.json();
            if (data.arweave?.usd) {
                AR_TO_USD = data.arweave.usd;
                return;
            }
        } catch (error) {
            console.error('Error updating exchange rate:', error);
        }
        AR_TO_USD = AR_TO_USD || 5;
    };

    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let hasRenderedOnce = false;
    let lastTipColors = {};

    function getNonce() {
        try {
            const m = document.querySelector('meta[property="csp-nonce"]');
            return (m && (m.nonce || m.getAttribute('nonce'))) || document.head?.dataset?.cspNonce || '';
        } catch { return ''; }
    }
    function ensureStyleTag(id) {
        let tag = document.getElementById(id);
        if (!tag) {
            tag = document.createElement('style');
            tag.id = id;
            const n = getNonce();
            if (n) tag.setAttribute('nonce', n);
            document.head.appendChild(tag);
        } else {
            try { const n = getNonce(); if (n && !tag.getAttribute('nonce')) tag.setAttribute('nonce', n); } catch {}
        }
        return tag;
    }
    function setLastTipVars(colors) {
        try {
            const tag = ensureStyleTag('last-tip-inline-vars');
            const c = colors || {};
            const decls = [
                c.bgColor ? `--lt-bg:${c.bgColor};` : '',
                c.borderColor ? `--lt-border:${c.borderColor};` : '',
                c.fontColor ? `--lt-text:${c.fontColor};` : '',
                c.amountColor ? `--lt-amount:${c.amountColor};` : '',
                c.iconColor ? `--lt-icon:${c.iconColor};` : '',
                c.iconBgColor ? `--lt-icon-bg:${c.iconBgColor};` : '',
                c.fromColor ? `--lt-from:${c.fromColor};` : ''
            ].filter(Boolean).join('');
            tag.textContent = decls ? `#last-donation{${decls}}` : '';
        } catch {}
    }

    function applyCustomColors(customColors = {}) {
        if (!isOBSWidget) return;
        const colors = { ...lastTipColors, ...customColors };
        setLastTipVars(colors);
    }

    async function loadColors() {
        if (!isOBSWidget) return;
        try {
            const cookieToken = (document.cookie.split('; ').find(r=>r.startsWith('getty_public_token='))||'').split('=')[1] || (document.cookie.split('; ').find(r=>r.startsWith('getty_admin_token='))||'').split('=')[1] || new URLSearchParams(location.search).get('token') || '';
            const nsQuery = cookieToken ? (`?token=${encodeURIComponent(cookieToken)}`) : '';
            const res = await fetch('/api/modules' + nsQuery);
            const data = await res.json();
            if (data.lastTip) {
                lastTipColors = {
                    bgColor: data.lastTip.bgColor,
                    fontColor: data.lastTip.fontColor,
                    borderColor: data.lastTip.borderColor,
                    amountColor: data.lastTip.amountColor,
                    iconColor: data.lastTip.iconColor,
                    iconBgColor: data.lastTip.iconBgColor,
                    fromColor: data.lastTip.fromColor
                };

                const cached = data.lastTip.lastDonation;
                if (cached && !hasRenderedOnce) {
                    hasRenderedOnce = true;
                    updateUI(cached);
                }
            }
        } catch (e) { /* ignore */ }
    }

    function applyCustomColorsAfterUI() {
        applyCustomColors();
    }

    const updateUI = async (data) => {
    if (!data) {
            await loadColors();
            titleElement.textContent = 'Configure last tip 💸';
            if (amountElement) amountElement.textContent = '0';
            if (symbolElement) symbolElement.textContent = 'AR';
            if (usdValueElement) usdValueElement.textContent = '';
            if (fromElement) fromElement.textContent = 'The wallet is not configured';
            applyCustomColors();

            return;
        }
    hasRenderedOnce = true;
        
        await updateExchangeRate();
        await loadColors();
        
        const formattedAmount = formatArAmount(data.amount);
        const usdValue = calculateUsdValue(data.amount);

        try {
            const modulesRes = await fetch('/api/modules').catch(()=>null);
            if (modulesRes && modulesRes.ok) {
                let modulesData = null; try { modulesData = await modulesRes.json(); } catch {}
                const customTitle = modulesData?.lastTip?.title;
                if (customTitle && customTitle.trim()) {
                    titleElement.textContent = customTitle.trim();
                } else {
                    titleElement.textContent = 'Last tip received 👏';
                }
            } else {
                titleElement.textContent = 'Last tip received 👏';
            }
        } catch {
            titleElement.textContent = 'Last tip received 👏';
        }
    if (amountElement) amountElement.textContent = formattedAmount;
    if (symbolElement) symbolElement.textContent = 'AR';
    if (usdValueElement) usdValueElement.textContent = usdValue;
        
        if (fromElement) {
            fromElement.textContent = `From: ${data.from?.slice(0, 22) || 'Anonymous'}... 📑`;
        }
        
        lastDonationElement.classList.remove('update-animation');
        void lastDonationElement.offsetWidth;
        lastDonationElement.classList.add('update-animation');
    applyCustomColors(data);
    };

    const loadInitialData = async () => {
        try {
            const cookieToken = (document.cookie.split('; ').find(r=>r.startsWith('getty_public_token='))||'').split('=')[1] || (document.cookie.split('; ').find(r=>r.startsWith('getty_admin_token='))||'').split('=')[1] || new URLSearchParams(location.search).get('token') || '';
            const nsQuery = cookieToken ? (`?token=${encodeURIComponent(cookieToken)}`) : '';
            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(), 4000);
            const response = await fetch('/api/modules' + nsQuery, { signal: controller.signal });
            clearTimeout(to);
            if (!response.ok) throw new Error('modules fetch failed');
            const modulesData = await response.json();
            const payload = modulesData?.lastTip?.lastDonation || null;
            await updateExchangeRate();
            await loadColors();
            updateUI(payload);
        } catch (_error) {
            updateUI(null);
        }
    };
    ws.onopen = async () => {
        loadColors();
        updateExchangeRate();
        loadInitialData();
    };
    
    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
                        if (msg.type === 'init' && msg.data) {
                                if (msg.data.lastTip) {
                    await updateExchangeRate();
                    await loadColors();
                                        const payload = (msg.data.lastTip && msg.data.lastTip.lastDonation)
                                            ? msg.data.lastTip.lastDonation
                                            : msg.data.lastTip;
                                        updateUI(payload);
                }
                return;
            }
            if (msg.type === 'lastTipConfig' && msg.data) {
                lastTipColors = { ...lastTipColors, ...msg.data };
                if (msg.data.title && titleElement) {
                    titleElement.textContent = msg.data.title;
                }
                applyCustomColors();
                return;
            }
            if (msg.type === 'tip' || msg.type === 'lastTip') {
                await updateExchangeRate();
                await loadColors();
                updateUI({ ...msg.data, ...lastTipColors });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
    
    ws.onclose = () => {

    };

    setInterval(() => {
        if (lastDonationElement) {
            lastDonationElement.classList.remove('update-animation');
            void lastDonationElement.offsetWidth;
            lastDonationElement.classList.add('update-animation');
        }
    }, 10000);

    (async () => {
        await loadColors();
        applyCustomColors();
        updateExchangeRate();
        loadInitialData();
    })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => startOnce(init));
    } else {
        startOnce(init);
    }
})();
