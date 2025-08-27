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
    const ws = new WebSocket(`${wsProto}://${window.location.host}`);

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

    function applyCustomColors(customColors = {}) {
        if (!isOBSWidget) return;
        const colors = { ...lastTipColors, ...customColors };

        lastDonationElement.style.setProperty('background', colors.bgColor || '#080c10', 'important');
        lastDonationElement.style.setProperty('border-left', `8px solid ${colors.borderColor || '#00ff7f'}`, 'important');
        lastDonationElement.style.setProperty('color', colors.fontColor || '#ffffff', 'important');

        if (titleElement && colors.fontColor) {
            titleElement.style.setProperty('color', colors.fontColor, 'important');
        }

        const amount = document.querySelector('.notification-amount');
        if (amount) amount.style.setProperty('color', colors.amountColor || '#00ff7f', 'important');
        const arAmount = document.querySelector('.ar-amount');
        if (arAmount) arAmount.style.setProperty('color', colors.amountColor || '#00ff7f', 'important');

        const icon = document.querySelector('.notification-icon');
        if (icon) {
            const ic = colors.iconColor || '#ffffff';
            const icBg = colors.iconBgColor || '#4f36ff';
            icon.style.setProperty('background', icBg, 'important');
            const svg = icon.querySelector('svg');
            if (svg) svg.style.setProperty('color', ic, 'important');
        }

        const from = document.querySelector('.notification-from-lasttip');
        if (from) from.style.setProperty('color', colors.fromColor || '#817ec8', 'important');
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
            titleElement.textContent = 'No tips yet. Send one! 💸';
            if (amountElement) amountElement.textContent = '0';
            if (symbolElement) symbolElement.textContent = 'AR';
            if (usdValueElement) usdValueElement.textContent = '';
            if (fromElement) fromElement.textContent = 'Send your first tip';
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
            const controller = new AbortController();
            const to = setTimeout(() => controller.abort(), 4000);
            const response = await fetch('/last-donation', { signal: controller.signal });
            clearTimeout(to);
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (data && typeof data === 'object' && data.error) {
                    updateUI(null);
                } else {
                    await updateExchangeRate();
                    await loadColors();
                    updateUI(data);
                }
            } catch (jsonError) {
                updateUI(null);
            }
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
                    updateUI(msg.data.lastTip);
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
