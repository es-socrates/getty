document.addEventListener('DOMContentLoaded', () => {
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = () => {
        console.log('✅ Connected to dashboard server');
        document.querySelector('.connection-status .status-dot').classList.add('connected');
        document.querySelector('.connection-status .status-dot').classList.remove('disconnected');
        document.querySelector('.connection-status span').textContent = '';
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        document.querySelector('.connection-status .status-dot').classList.remove('connected');
        document.querySelector('.connection-status .status-dot').classList.add('disconnected');
        document.querySelector('.connection-status span').textContent = '';
    };
    
    ws.onclose = () => {
        document.querySelector('.connection-status .status-dot').classList.remove('connected');
        document.querySelector('.connection-status .status-dot').classList.add('disconnected');
        document.querySelector('.connection-status span').textContent = '';
    };
});