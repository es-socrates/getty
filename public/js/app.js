document.addEventListener('DOMContentLoaded', () => {
  const ws = new WebSocket(`${location.protocol==='https:'?'wss://':'ws://'}${window.location.host}`);
  const statusDot = document.querySelector('.connection-status .status-dot');
  const statusText = document.querySelector('.connection-status span:last-child');

  if (!statusDot || !statusText) {
    console.error('Connection status items not found');
    return;
  }

  ws.onopen = () => {
    statusDot.classList.add('connected');
    statusDot.classList.remove('disconnected');
    statusText.textContent = '';
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = '';
  };
  
  ws.onclose = () => {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = '';
  };
});