fetch('/api/socialmedia-config')
  .then(res => res.json())
  .then(data => {
    if (!data.success || !Array.isArray(data.config)) return;
    const config = data.config;
    const container = document.createElement('div');
    container.className = 'socialmedia-overlay';
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'flex-start';
    container.style.gap = '12px';
    container.style.padding = '18px 0';
    container.style.height = 'auto';
    container.style.fontFamily = "'Inter', Arial, sans-serif";
    config.forEach(item => {
      const panel = document.createElement('div');
      panel.className = 'socialmedia-panel';
      panel.style.display = 'flex';
      panel.style.flexDirection = 'row';
      panel.style.alignItems = 'center';
      panel.style.background = 'var(--card-bg, #181c22)';
      panel.style.borderRadius = '4px';
      panel.style.padding = '8px 18px 8px 10px';
      panel.style.minWidth = '90px';
      panel.style.margin = '0';
      panel.style.border = '1.5px solid #00ff7f33';
      panel.style.boxShadow = 'none';
      panel.style.transition = 'none';
      
      const icon = document.createElement('div');
      icon.className = 'socialmedia-icon';
      icon.style.width = '28px';
      icon.style.height = '28px';
      icon.style.borderRadius = '50%';
      icon.style.background = 'var(--darker-bg, #222)';
      icon.style.display = 'flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      icon.style.marginRight = '8px';
      icon.innerHTML = getSocialIconSVG(item.icon);
      panel.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'socialmedia-name';
      name.textContent = item.name;
      name.style.fontWeight = '600';
      name.style.fontSize = '1rem';
      name.style.color = 'var(--text-color, #fff)';
      name.style.marginRight = '8px';
      name.style.marginBottom = '0';
      name.style.letterSpacing = '0.02em';
      name.style.textShadow = 'none';
      panel.appendChild(name);
      
      const link = document.createElement('a');
      link.className = 'socialmedia-link';
      link.href = item.link;
      link.target = '_blank';
      link.textContent = item.link.replace(/^https?:\/\//, '');
      link.style.color = '#00ff7f';
      link.style.fontSize = '1rem';
      link.style.wordBreak = 'break-all';
      link.style.textDecoration = 'none';
      link.style.transition = 'none';
      panel.appendChild(link);
      container.appendChild(panel);
    });
    document.body.appendChild(container);
  });

function getSocialIconSVG(icon) {
  switch(icon) {
    case 'x': return '<svg width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#222"/><path fill="#fff" d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2"/></svg>';
    case 'odysee': return '<img src="/assets/odysee.png" alt="Odysee" style="height:32px;">';
    case 'instagram': return '<svg width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#E1306C"/><path fill="#fff" d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm10 2c1.65 0 3 1.35 3 3v10c0 1.65-1.35 3-3 3H7c-1.65 0-3-1.35-3-3V7c0-1.65 1.35-3 3-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm6.5-.5a1 1 0 100 2 1 1 0 000-2z"/></svg>';
    case 'youtube': return '<svg width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#FF0000"/><polygon fill="#fff" points="10,15 15.19,12 10,9"/></svg>';
    case 'rumble': return '<svg width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#53C22B"/><path fill="#fff" d="M12 7l5 10H7z"/></svg>';
    case 'telegram': return '<svg width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#0088cc"/><path fill="#fff" d="M2 21l21-9-21-9v18zm2-2.18V5.18L19.82 12 4 18.82z"/></svg>';
    default: return '';
  }
}
