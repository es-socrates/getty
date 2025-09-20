document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('persistent-notifications-container');
    const list = document.getElementById('notifications-list');
    
           const ws = new WebSocket(`${location.protocol==='https:'?'wss://':'ws://'}${window.location.host}`);
    
    ws.onopen = () => {

    };
    
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'persistentTipsUpdate') {
                updateNotificationsList(msg.data);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
    
    function updateNotificationsList(tips) {
        list.innerHTML = '';
        
        if (tips.length === 0) {
            list.innerHTML = '<div class="empty-message">No tips received yet</div>';
            return;
        }
        
        tips.forEach(tip => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            
            const time = new Date(tip.timestamp).toLocaleTimeString();
            
            item.innerHTML = `
                <div class="amount">${tip.amount} AR ($${tip.usd})</div>
                <div class="from">From: ${tip.from}</div>
                ${tip.message ? `<div class="message">"${tip.message}"</div>` : ''}
                <div class="time">${time}</div>
            `;
            
            list.appendChild(item);
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') === 'true') {
        container.classList.add('pn-edit');
    }
});