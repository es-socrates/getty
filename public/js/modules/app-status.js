let __started = false;

export function initAppStatus() {
  if (__started) return;
  __started = true;
  try {
    const ws = new WebSocket(
      `${location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}`
    );
    const statusDot = document.querySelector('.connection-status .status-dot');
    const statusText = document.querySelector('.connection-status span:last-child');
    if (!statusDot || !statusText) return;
    ws.onopen = () => {
      statusDot.classList.add('connected');
      statusDot.classList.remove('disconnected');
      statusText.textContent = '';
    };
    ws.onerror = () => {
      statusDot.classList.remove('connected');
      statusDot.classList.add('disconnected');
      statusText.textContent = '';
    };
    ws.onclose = () => {
      statusDot.classList.remove('connected');
      statusDot.classList.add('disconnected');
      statusText.textContent = '';
    };
  } catch {}
}

export default { initAppStatus };
