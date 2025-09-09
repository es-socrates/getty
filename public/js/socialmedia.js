fetch('/api/socialmedia-config')
  .then(res => res.json())
  .then(data => {
    if (!data.success || !Array.isArray(data.config)) return;
    const config = data.config;
    const container = document.createElement('div');
    container.className = 'socialmedia-widget';
    config.forEach(item => {
    const panel = document.createElement('div');
    panel.className = 'socialmedia-panel';
      
      const icon = document.createElement('div');
      icon.className = 'socialmedia-icon';
      if (item.icon === 'custom' && item.customIcon) {
        icon.innerHTML = `<img src="${item.customIcon}" alt="Custom" class="socialmedia-custom-icon">`;
      } else {
        icon.innerHTML = getSocialIconSVG(item.icon);
      }
      panel.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'socialmedia-name';
      name.textContent = item.name;
      panel.appendChild(name);
      
      const link = document.createElement('a');
      link.className = 'socialmedia-link';
      link.href = item.link;
      link.target = '_blank';
      link.textContent = item.link.replace(/^https?:\/\//, '');
      panel.appendChild(link);
      container.appendChild(panel);
    });
    document.body.appendChild(container);
  });

function getSocialIconSVG(icon) {
  switch(icon) {
    case 'x':
      return '<svg width="40" height="40" viewBox="0 0 24 24"><rect width="24" height="24" rx="2" fill="#222"/><path fill="#fff" d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2"/></svg>';
    case 'odysee':
      return `<svg width="40" height="40" viewBox="0 0 192 192"><path fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="12" d="M98.612 39.193c7.085.276 9.76 4.503 12.192 10.124 3.249 7.494.988 10.141-12.192 13.85-13.187 3.74-19.535-1.171-20.404-10.115-.976-10.115 11.684-12.729 11.684-12.729 3.495-.876 6.36-1.226 8.72-1.13zm65.362 107.42c2.54-9.665-6.121-19.201-11.2-27.806-4.998-8.467-11.972-17.925-18.629-22.87a4.832 4.832 0 0 1-.378-7.376c6.57-6.21 18.15-18.329 21.813-24.725 3.413-6.664 7.628-14.488 5.34-21.513-2.058-6.317-8.8-14.298-15.274-12.806-7.342 1.692-6.837 10.98-9.216 20.638-3.222 13.187-10.86 11.697-13.968 11.697-3.108 0-1.24-4.658-8.46-25.377-7.217-20.72-26.002-15.526-40.27-6.985-18.14 10.874-10.046 34.054-5.562 48.992-2.546 2.453-12.118 4.368-20.834 9.06-10.75 5.78-21.645 9.363-24.66 19.372-1.883 6.254.172 15.997 6.162 18.602 6.645 2.889 12.633-1.694 19.751-9.073a36.226 36.226 0 0 1 7.089-5.482 75.994 75.994 0 0 1 18.276-8.59s6.97 10.707 13.432 23.393c6.457 12.686-6.968 16.918-8.459 16.918-1.497 0-22.675-1.973-17.95 15.926 4.726 17.9 30.598 11.437 43.785 2.728 13.187-8.708 9.947-37.06 9.947-37.06 12.94-1.985 16.915 11.684 18.158 18.628 1.243 6.944 4.06 18.052 11.449 19.412 8.248 1.517 17.528-7.593 19.659-15.705z"/></svg>`;
    case 'instagram':
      return `<svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint0_radial_87_7153)"/>
<rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint1_radial_87_7153)"/>
<rect x="2" y="2" width="28" height="28" rx="6" fill="url(#paint2_radial_87_7153)"/>
<path d="M23 10.5C23 11.3284 22.3284 12 21.5 12C20.6716 12 20 11.3284 20 10.5C20 9.67157 20.6716 9 21.5 9C22.3284 9 23 9.67157 23 10.5Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M16 21C18.7614 21 21 18.7614 21 16C21 13.2386 18.7614 11 16 11C13.2386 11 11 13.2386 11 16C11 18.7614 13.2386 21 16 21ZM16 19C17.6569 19 19 17.6569 19 16C19 14.3431 17.6569 13 16 13C14.3431 13 13 14.3431 13 16C13 17.6569 14.3431 19 16 19Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M6 15.6C6 12.2397 6 10.5595 6.65396 9.27606C7.2292 8.14708 8.14708 7.2292 9.27606 6.65396C10.5595 6 12.2397 6 15.6 6H16.4C19.7603 6 21.4405 6 22.7239 6.65396C23.8529 7.2292 24.7708 8.14708 25.346 9.27606C26 10.5595 26 12.2397 26 15.6V16.4C26 19.7603 26 21.4405 25.346 22.7239C24.7708 23.8529 23.8529 24.7708 22.7239 25.346C21.4405 26 19.7603 26 16.4 26H15.6C12.2397 26 10.5595 26 9.27606 25.346C8.14708 24.7708 7.2292 23.8529 6.65396 22.7239C6 21.4405 6 19.7603 6 16.4V15.6ZM15.6 8H16.4C18.1132 8 19.2777 8.00156 20.1779 8.0751C21.0548 8.14674 21.5032 8.27659 21.816 8.43597C22.5686 8.81947 23.1805 9.43139 23.564 10.184C23.7234 10.4968 23.8533 10.9452 23.9249 11.8221C23.9984 12.7223 24 13.8868 24 15.6V16.4C24 18.1132 23.9984 19.2777 23.9249 20.1779C23.8533 21.0548 23.7234 21.5032 23.564 21.816C23.1805 22.5686 22.5686 23.1805 21.816 23.564C21.5032 23.7234 21.0548 23.8533 20.1779 23.9249C19.2777 23.9984 18.1132 24 16.4 24H15.6C13.8868 24 12.7223 23.9984 11.8221 23.9249C10.9452 23.8533 10.4968 23.7234 10.184 23.564C9.43139 23.1805 8.81947 22.5686 8.43597 21.816C8.27659 21.5032 8.14674 21.0548 8.0751 20.1779C8.00156 19.2777 8 18.1132 8 16.4V15.6C8 13.8868 8.00156 12.7223 8.0751 11.8221C8.14674 10.9452 8.27659 10.4968 8.43597 10.184C8.81947 9.43139 9.43139 8.81947 10.184 8.43597C10.4968 8.27659 10.9452 8.14674 11.8221 8.0751C12.7223 8.00156 13.8868 8 15.6 8Z" fill="white"/>
<defs>
<radialGradient id="paint0_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 23) rotate(-55.3758) scale(25.5196)">
<stop stop-color="#B13589"/>
<stop offset="0.79309" stop-color="#C62F94"/>
<stop offset="1" stop-color="#8A3AC8"/>
</radialGradient>
<radialGradient id="paint1_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(11 31) rotate(-65.1363) scale(22.5942)">
<stop stop-color="#E0E8B7"/>
<stop offset="0.444662" stop-color="#FB8A2E"/>
<stop offset="0.71474" stop-color="#E2425C"/>
<stop offset="1" stop-color="#E2425C" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint2_radial_87_7153" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0.500002 3) rotate(-8.1301) scale(38.8909 8.31836)">
<stop offset="0.156701" stop-color="#406ADC"/>
<stop offset="0.467799" stop-color="#6A45BE"/>
<stop offset="1" stop-color="#6A45BE" stop-opacity="0"/>
</radialGradient>
</defs>
</svg>`;
    case 'youtube':
      return `<svg width="40" height="40" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#CE1312"/><polygon points="19,32 19,16 32,24" fill="#fff"/></svg>`;
    case 'rumble':
      return '<svg width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#53C22B"/><path fill="#fff" d="M12 7l5 10H7z"/></svg>';
    case 'telegram':
      return `<svg width="40" height="40" viewBox="0 0 512 512"><rect width="512" height="512" rx="76" fill="#37aee2"/><path fill="#c8daea" d="M199 404c-11 0-10-4-13-14l-32-105 245-144"/><path fill="#a9c9dd" d="M199 404c7 0 11-4 16-8l45-43-56-34"/><path fill="#f6fbfe" d="M204 319l135 99c14 9 26 4 30-14l55-258c5-22-9-32-24-25L79 245c-21 8-21 21-4 26l83 26 190-121c9-5 17-3 11 4"/></svg>`;
    case 'discord':
      return `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="32" height="32" rx="8" fill="#5865F2"/>
  <g transform="translate(7,10) scale(0.105)">
    <path d="M216.86,16.6c-16.57-7.75-34.29-13.39-52.82-16.6c-2.28,4.11-4.93,9.64-6.77,14.05c-19.69-2.96-39.2-2.96-58.53,0c-1.83-4.41-4.62-9.93-6.87-14.05C73.35,3.21,55.61,8.86,39.04,16.64C5.62,67.15-3.44,116.4,1.09,164.96c22.17,16.56,43.66,26.61,64.78,33.19c5.22-7.18,9.87-14.85,13.89-22.89c-7.63-2.9-14.94-6.48-21.85-10.63c1.83-1.36,3.62-2.76,5.39-4.24c42.12,19.7,87.89,19.7,129.51,0c1.75,1.46,3.54,2.86,5.36,4.24c-6.93,4.17-14.22,7.75-21.85,10.65c4.01,8.04,8.63,15.65,13.89,22.89c21.14-6.58,42.62-16.63,64.78-33.19C260.23,108.67,245.83,59.87,216.86,16.6zM85.47,135.09c-12.64,0-23.03-11.8-23.03-26.18c0-14.37,10.15-26.16,23.03-26.16c12.87,0,23.26,11.8,23.04,26.16C108.51,123.29,98.34,135.09,85.47,135.09zM170.53,135.09c-12.64,0-23.02-11.8-23.02-26.18c0-14.37,10.15-26.16,23.02-26.16c12.87,0,23.26,11.8,23.04,26.16C193.54,123.29,183.39,135.09,170.53,135.09z" fill="#fff"/>
  </g>
</svg>`;
    default:
      return '';
  }
}
