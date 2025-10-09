const claimIds = [
    'f72567faf314d8caa16976acaf104e2f1df809a9',
    '057ca5a46e70cc1cb70558940ba0a7f22bad5714',
    'e29e2ced2f8b829f4a056b593ca673575ffada33',
    'ada5f36d4a63794403f47589de4f3b80fb60cf8d',
];

function getConsistentColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20);
    const lightness = 45 + (Math.abs(hash >> 8) % 20);
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function cleanDescription(html) {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => img.remove());
    
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
}

function isAllowedImageUrl(url) {
    if (!url) return false;
    
    const allowedDomains = [
        'thumbs.odycdn.com',
        'thumbnails.odycdn.com', 
        'odysee.com',
        'static.odycdn.com',
        'twemoji.maxcdn.com',
        'spee.ch',
        'arweave.net',
        'uexkkutudmzozimeopch.supabase.co'
    ];
    
    try {
        const urlObj = new URL(url);

        return allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)) ||
               urlObj.protocol === 'data:' ||
               urlObj.protocol === 'blob:' ||
               url.startsWith('/');
    } catch {
        return false;
    }
}

async function fetchChannelData(claimId) {
    try {
        const response = await fetch('https://api.na-backend.odysee.com/api/v1/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: 'claim_search',
                params: { claim_ids: [claimId], page_size: 1, no_totals: true }
            })
        });
        const data = await response.json();
        const items = data?.result?.items || data?.data?.result?.items || [];
        const item = Array.isArray(items) && items[0] ? items[0] : null;
        if (item) {
            const channel = item.signing_channel || item.publisher || item.value?.signing_channel || item;
            const title = channel.title || channel.name || 'Unknown Channel';
            const rawDescription = channel.description || channel.value?.description || '';
            
            const description = cleanDescription(rawDescription);
            
            const rawThumbnail = channel.thumbnail?.url || channel.value?.thumbnail?.url || '';
            
            const thumbnail = isAllowedImageUrl(rawThumbnail) ? rawThumbnail : '';
            
            const name = channel.name || item.name || '';
            const url = name ? `https://odysee.com/${name}` : '';
            return {
                title,
                description,
                thumbnail,
                url
            };
        }
    } catch (error) {
        console.error('Error fetching channel data:', error);
    }
    return null;
}

async function loadMarquee() {
    const marqueeContent = document.getElementById('marquee-content');
    if (!marqueeContent) return;

    const channels = [];
    for (const claimId of claimIds) {
        const data = await fetchChannelData(claimId);
        if (data) {
            channels.push(data);
        }
    }

    if (channels.length === 0) return;

    const createItem = (channel) => {
        const item = document.createElement('a');
        item.href = channel.url;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.className = 'flex flex-col gap-1 rounded-md border bg-card p-4 text-card-foreground shadow-sm hover:bg-card/80 transition-colors';
        
        let avatarContent;
        if (channel.thumbnail) {
            const cleanTitle = channel.title.replace(/^@/, '');
            const firstLetter = cleanTitle.charAt(0).toUpperCase();
            const bgColor = getConsistentColor(cleanTitle);
            avatarContent = `<img src="${channel.thumbnail}" alt="" class="w-8 h-8 rounded-full object-cover avatar-image" data-channel-title="${channel.title}" data-bg-color="${bgColor}" data-first-letter="${firstLetter}">`;
        } else {
            const cleanTitle = channel.title.replace(/^@/, '');
            const firstLetter = cleanTitle.charAt(0).toUpperCase();
            const bgColor = getConsistentColor(cleanTitle);
            avatarContent = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm avatar-color" data-bg-color="${bgColor}">${firstLetter}</div>`;
        }
        
        item.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <div class="avatar-container">
                    ${avatarContent}
                </div>
                <div class="font-medium text-sm leading-tight sm:text-base">${channel.title}</div>
            </div>
            <span class="line-clamp-2 text-muted-foreground text-sm">${channel.description}</span>
        `;
        
        setTimeout(() => {
            const avatarImg = item.querySelector('.avatar-image');
            if (avatarImg) {

                const loadTimeout = setTimeout(() => {
                    const bgColor = avatarImg.getAttribute('data-bg-color');
                    const firstLetter = avatarImg.getAttribute('data-first-letter');
                    avatarImg.parentElement.innerHTML = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style="background-color: ${bgColor};">${firstLetter}</div>`;
                }, 5000);
                
                avatarImg.onload = function() {
                    clearTimeout(loadTimeout);
                };
                
                avatarImg.onerror = function() {
                    clearTimeout(loadTimeout);
                    const bgColor = this.getAttribute('data-bg-color');
                    const firstLetter = this.getAttribute('data-first-letter');
                    this.parentElement.innerHTML = `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style="background-color: ${bgColor};">${firstLetter}</div>`;
                };
            }
            
            const avatarColor = item.querySelector('.avatar-color');
            if (avatarColor) {
                const bgColor = avatarColor.getAttribute('data-bg-color');
                avatarColor.style.backgroundColor = bgColor;
            }
        }, 0);
        
        return item;
    };

    channels.forEach(channel => {
        marqueeContent.appendChild(createItem(channel));
    });
}

document.addEventListener('DOMContentLoaded', loadMarquee);