document.addEventListener('DOMContentLoaded', () => {
  function getCookie(name){
    try { return document.cookie.split('; ').find(r=>r.startsWith(name+'='))?.split('=')[1] || ''; } catch { return ''; }
  }
  const token = getCookie('getty_admin_token') || getCookie('getty_public_token') || new URLSearchParams(location.search).get('token') || '';
  const ws = new WebSocket(`${location.protocol==='https:'?'wss://':'ws://'}${window.location.host}${token?`/?token=${encodeURIComponent(token)}`:''}`);
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