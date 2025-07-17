document.addEventListener('DOMContentLoaded', () => {
    const lastDonationElement = document.getElementById('last-donation');
    if (!lastDonationElement) {
        console.error('Error: Elemento #last-donation no encontrado');
        return;
    }

    const titleElement = document.querySelector('.notification-title');
    const amountElement = document.querySelector('.notification-amount .ar-amount');
    const symbolElement = document.querySelector('.notification-amount .ar-symbol');
    const usdValueElement = document.querySelector('.notification-amount .usd-value');
    const fromElement = document.querySelector('.notification-from');

    const verifyElements = () => {
        if (!titleElement) console.error('Elemento .notification-title no encontrado');
        if (!amountElement) console.error('Elemento .notification-amount .ar-amount no encontrado');
        if (!symbolElement) console.error('Elemento .notification-amount .ar-symbol no encontrado');
        if (!usdValueElement) console.error('Elemento .notification-amount .usd-value no encontrado');
        return titleElement && amountElement && symbolElement && usdValueElement;
    };

    if (!verifyElements()) return;

    if (!titleElement) {
        return;
    }

    let AR_TO_USD = 0;
    const ws = new WebSocket(`ws://${window.location.host}`);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Reciente';
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
                console.log('Tasa de cambio actualizada:', AR_TO_USD);
            }
        } catch (error) {
            console.error('Error al actualizar tasa de cambio:', error);
            AR_TO_USD = AR_TO_USD || 5;
        }
    };

    const updateUI = async (data) => {
        if (!data) {
            titleElement.textContent = 'No tips yet. Send one! 💸';
            amountElement.textContent = '0';
            symbolElement.textContent = 'AR';
            usdValueElement.textContent = '';
            if (fromElement) fromElement.textContent = 'Send your first tip';
            return;
        }
        
        await updateExchangeRate();
        
        const formattedAmount = formatArAmount(data.amount);
        const usdValue = calculateUsdValue(data.amount);
        
        titleElement.textContent = 'Last tip received 👏';
        amountElement.textContent = formattedAmount;
        symbolElement.textContent = 'AR';
        usdValueElement.textContent = usdValue;
        
        if (fromElement) {
            fromElement.textContent = `From: ${data.from?.slice(0, 22) || 'Anonymous'}... 🟢`;
        }
        
        lastDonationElement.classList.remove('update-animation');
        void lastDonationElement.offsetWidth;
        lastDonationElement.classList.add('update-animation');
    };

    const loadInitialData = async () => {
        try {
            const response = await fetch('/last-donation');
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                await updateExchangeRate();
                updateUI(data);
            } catch (jsonError) {
                console.error('La respuesta no es JSON válido:', text);
                updateUI(null);
            }
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            updateUI(null);
        }
    };

    ws.onopen = () => {
        console.log('✅ Conectado al servidor WebSocket');
        loadInitialData();
    };
    
    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'tip' || msg.type === 'lastTip') {
                await updateExchangeRate();
                updateUI(msg.data);
            }
        } catch (error) {
            console.error('Error procesando mensaje:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket desconectado');
    };

    setInterval(() => {
        if (lastDonationElement) {
            lastDonationElement.classList.remove('update-animation');
            void lastDonationElement.offsetWidth;
            lastDonationElement.classList.add('update-animation');
        }
    }, 10000);
});