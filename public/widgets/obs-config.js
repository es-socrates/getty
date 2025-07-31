document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const widget = document.getElementById('widget-container');
  
  if (!widget) return;

  widget.className = '';
  widget.classList.add('tip-notification-widget');

  const position = urlParams.get('position') || 'bottom-right';
  widget.classList.add(`pos-${position}`);

  const width = urlParams.get('width') || 'auto';
  const height = urlParams.get('height') || 'auto';
  widget.style.width = width === 'auto' ? 'auto' : `${width}px`;
  widget.style.height = height === 'auto' ? 'auto' : `${height}px`;

  widget.style.background = 'var(--bg-main, #080c10)';
  widget.style.fontFamily = 'Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif';
  widget.style.color = 'var(--text, #e6edf3)';

  if (urlParams.get('edit') === 'true') {
    addResizeControls(widget);
    addPositionControls(widget);
  }

  window.addEventListener('resize', updateUrlParams);

  let AR_TO_USD = 0;
  const lastDonationElement = document.getElementById('last-donation');
  const titleElement = document.querySelector('.notification-title');
  const amountElement = document.querySelector('.notification-amount');
  const fromElement = document.querySelector('.notification-from-lasttip');

  function formatArAmount(amount) {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }

  function calculateUsdValue(arAmount) {
    const arNum = parseFloat(arAmount);
    if (isNaN(arNum) || AR_TO_USD === 0) return '';
    const usdValue = arNum * AR_TO_USD;
    return `≈ $${usdValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} USD`;
  }

  async function updateExchangeRate() {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd');
      const data = await response.json();
      if (data.arweave?.usd) {
        AR_TO_USD = data.arweave.usd;
      }
    } catch (error) {
      AR_TO_USD = AR_TO_USD || 5;
    }
  }

  async function updateUI(data) {
    if (!data) {
      titleElement.textContent = 'No tips yet. Send one! 💸';
      amountElement.innerHTML = '0 <span class="ar-symbol">AR</span>';
      fromElement.textContent = 'Send your first tip';
      return;
    }

    await updateExchangeRate();

    const formattedAmount = formatArAmount(data.amount);
    const usdValue = calculateUsdValue(data.amount);

    titleElement.textContent = '🎉 New Tip Received. Woohoo!';
    amountElement.innerHTML = `
      <div class="amount-container">
        <span class="ar-amount">${formattedAmount} AR</span>
        <span class="usd-value">${usdValue}</span>
      </div>
    `;
    fromElement.innerHTML = `📦 From: ${data.from.slice(0, 8)}... <span style="color: #00ff7f;">🟢 Thank you! 🤞</span>`;

    lastDonationElement.classList.remove('update-animation');
    void lastDonationElement.offsetWidth;
    lastDonationElement.classList.add('update-animation');
  }

  async function loadInitialData() {
    try {
      const response = await fetch('/last-donation');
      const data = await response.json();
      await updateExchangeRate();
      updateUI(data);
    } catch (error) {}
  }

  const ws = new WebSocket(`ws://${window.location.host}`);
  ws.onopen = () => {
    loadInitialData();
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'tip' || msg.type === 'lastTip') {
        await updateExchangeRate();
        updateUI(msg.data);
      }
    } catch (error) {}
  };

  setInterval(() => {
    lastDonationElement.classList.remove('update-animation');
    void lastDonationElement.offsetWidth;
    lastDonationElement.classList.add('update-animation');
  }, 60000);

  updateExchangeRate();
  
  const goalWidget = document.getElementById('goal-widget');
  if (goalWidget) {
    goalWidget.classList.add('tip-goal-widget');
    goalWidget.style.background = 'var(--bg-main, #080c10)';
    goalWidget.style.fontFamily = 'Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif';
    goalWidget.style.color = 'var(--text, #e6edf3)';
  }
  
  const notificationWidget = document.getElementById('notification');
  if (notificationWidget) {
    notificationWidget.classList.add('tip-notification-widget');
  }
});

function addResizeControls(element) {
  const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    element.appendChild(handle);
    
    handle.addEventListener('mousedown', initResize);
  });

  function initResize(e) {
    e.preventDefault();
    const handle = e.target;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.offsetWidth;
    const startHeight = element.offsetHeight;
    const isRight = handle.classList.contains('bottom-right') || handle.classList.contains('top-right');
    const isBottom = handle.classList.contains('bottom-right') || handle.classList.contains('bottom-left');

    function onMouseMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (isRight) {
        newWidth = startWidth + dx;
      } else {
        newWidth = startWidth - dx;
      }

      if (isBottom) {
        newHeight = startHeight + dy;
      } else {
        newHeight = startHeight - dy;
      }

      newWidth = Math.max(100, Math.min(newWidth, 2000));
      newHeight = Math.max(50, Math.min(newHeight, 2000));

      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;

      updateUrlParams();
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}

function addPositionControls(element) {
  element.style.cursor = 'move';
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  element.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const style = window.getComputedStyle(element);
    startLeft = parseInt(style.left) || 0;
    startTop = parseInt(style.top) || 0;
    
    element.classList.remove('pos-top-right', 'pos-bottom-right', 'pos-bottom-left', 'pos-top-left', 'pos-center');
    element.style.position = 'absolute';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.left = `${startLeft + dx}px`;
    element.style.top = `${startTop + dy}px`;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    updateUrlParams();
  });
}

function updateUrlParams() {
  const widget = document.getElementById('widget-container');
  if (!widget) return;
  
  const url = new URL(window.location.href);
  const style = window.getComputedStyle(widget);
  
  url.searchParams.set('width', widget.offsetWidth);
  url.searchParams.set('height', widget.offsetHeight);
  
  if (!widget.className.match(/pos-(top|bottom)-(left|right|center)/)) {
    url.searchParams.set('left', parseInt(style.left) || 0);
    url.searchParams.set('top', parseInt(style.top) || 0);
    url.searchParams.delete('position');
  }
  
  window.history.replaceState({}, '', url);
}
