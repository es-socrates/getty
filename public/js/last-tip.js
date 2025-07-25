document.addEventListener('DOMContentLoaded', () => {
    const lastDonationElement = document.getElementById('last-donation');
    if (!lastDonationElement) {
        console.error('Error: Element #last-donation not found');
        return;
    }

    const titleElement = document.querySelector('.notification-title');
    const amountElement = document.querySelector('.notification-amount .ar-amount');
    const symbolElement = document.querySelector('.notification-amount .ar-symbol');
    const usdValueElement = document.querySelector('.notification-amount .usd-value');
    const fromElement = document.querySelector('.notification-from');

    const verifyElements = () => {
        if (!titleElement) console.error('Element .notification-title not found');
        if (!amountElement) console.error('Element .notification-amount .ar-amount not found');
        if (!symbolElement) console.error('Element .notification-amount .ar-symbol not found');
        if (!usdValueElement) console.error('Element .notification-amount .usd-value not found');
        return titleElement && amountElement && symbolElement && usdValueElement;
    };

    if (!verifyElements()) return;

    if (!titleElement) {
        return;
    }

    let AR_TO_USD = 0;
    const ws = new WebSocket(`ws://${window.location.host}`);

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
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
            const data = await response.json();
            if (data.arweave?.usd) {
                AR_TO_USD = data.arweave.usd;

            }
        } catch (error) {
            console.error('Error updating exchange rate:', error);
            AR_TO_USD = AR_TO_USD || 5;
        }
    };

    const isOBSWidget = window.location.pathname.includes('/widgets/');
    let lastTipColors = {};

    function applyCustomColors(customColors = {}) {
        if (!isOBSWidget) return;
        const colors = { ...customColors, ...lastTipColors };

        lastDonationElement.style.setProperty('background', colors.bgColor || '#080c10', 'important');
        lastDonationElement.style.setProperty('border-left', `8px solid ${colors.borderColor || '#00ff7f'}`, 'important');
        lastDonationElement.style.setProperty('color', colors.fontColor || '#ffffff', 'important');

        const amount = document.querySelector('.notification-amount');
        if (amount) amount.style.setProperty('color', colors.amountColor || '#00ff7f', 'important');
        const arAmount = document.querySelector('.ar-amount');
        if (arAmount) arAmount.style.setProperty('color', colors.amountColor || '#00ff7f', 'important');

        const icon = document.querySelector('.notification-icon');
        if (icon) icon.style.setProperty('color', colors.iconColor || '#ca004b', 'important');

        const from = document.querySelector('.notification-from');
        if (from) from.style.setProperty('color', colors.fromColor || '#e9e9e9', 'important');
    }

    async function loadColors() {
        if (!isOBSWidget) return;
        try {
            const res = await fetch('/api/modules');
            const data = await res.json();
            if (data.lastTip) {
                lastTipColors = {
                    bgColor: data.lastTip.bgColor,
                    fontColor: data.lastTip.fontColor,
                    borderColor: data.lastTip.borderColor,
                    amountColor: data.lastTip.amountColor,
                    iconColor: data.lastTip.iconColor,
                    fromColor: data.lastTip.fromColor
                };
            }
        } catch (e) { /* ignore */ }
    }

    function applyCustomColorsAfterUI() {
        applyCustomColors();
    }

    const updateUI = async (data) => {
        if (!data) {
            titleElement.textContent = 'No tips yet. Send one! 💸';
            amountElement.textContent = '0';
            symbolElement.textContent = 'AR';
            usdValueElement.textContent = '';
            if (fromElement) fromElement.textContent = 'Send your first tip';
            applyCustomColors();
            return;
        }
        
        await updateExchangeRate();
        await loadColors();
        
        const formattedAmount = formatArAmount(data.amount);
        const usdValue = calculateUsdValue(data.amount);
        
        titleElement.textContent = 'Last tip received 👏';
        amountElement.textContent = formattedAmount;
        symbolElement.textContent = 'AR';
        usdValueElement.textContent = usdValue;
        
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
            const response = await fetch('/last-donation');
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                await updateExchangeRate();
                await loadColors();
                updateUI(data);
            } catch (jsonError) {
                console.error('The response is not valid JSON:', text);
                updateUI(null);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            updateUI(null);
        }
    };

    ws.onopen = async () => {

        await loadColors();
        loadInitialData();
    };
    
    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
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
});