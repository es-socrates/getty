async function fetchLiveviewsConfig() {
  try {
    const res = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('No config file');
    return await res.json();
  } catch (e) {
    return {
      bg: '#fff',
      color: '#222',
      font: 'Arial',
      size: '32',
      icon: ''
    };
  }
}

function applyLiveviewsConfig(config) {
  const viewerCountEl = document.getElementById('viewer-count');
  if (viewerCountEl) {
    viewerCountEl.style.background = config.bg;
    viewerCountEl.style.color = config.color;
    viewerCountEl.style.fontFamily = config.font;
    viewerCountEl.style.fontSize = config.size + 'px';
  }

  let iconEl = document.getElementById('liveviews-icon');

  const liveButtonEl = document.querySelector('.live-button');
  let iconSize = 40;
  if (liveButtonEl) {
    iconSize = liveButtonEl.offsetHeight;
  }

  if (!iconEl && config.icon && viewerCountEl && viewerCountEl.parentNode) {
    iconEl = document.createElement('img');
    iconEl.id = 'liveviews-icon';
    iconEl.style.height = iconSize + 'px';
    iconEl.style.width = iconSize + 'px';
    iconEl.style.borderRadius = '50%';
    iconEl.style.objectFit = 'cover';
    iconEl.style.marginRight = '18px';
    iconEl.style.verticalAlign = 'middle';
    viewerCountEl.parentNode.insertBefore(iconEl, viewerCountEl);
  }
  if (iconEl && config.icon) {
    iconEl.src = config.icon;
    iconEl.style.display = '';
    iconEl.style.height = '54px';
    iconEl.style.width = '54px';
    iconEl.style.borderRadius = '50%';
    iconEl.style.objectFit = 'cover';
    iconEl.style.verticalAlign = 'middle';
    iconEl.style.marginLeft = '10px';
    iconEl.style.marginRight = '10px';
  } else if (iconEl) {
    iconEl.style.display = 'none';
  }
}

async function fetchViewerCountAndDisplay(url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Network response was not ok: status ${response.status}, ${response.statusText}`);
    }
    const data = await response.json();
    console.log('[Liveviews] CLAIM_ID:', url);
    console.log('[Liveviews] API response:', data);

    const viewerCountEl = document.getElementById('viewer-count');
    const liveButtonEl = document.getElementById('live-button');
    if (!viewerCountEl || !liveButtonEl) return;
    // Obtener viewersLabel del backend config
    let customLabel = window.languageManager.getText('viewers');
    try {
      const configRes = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
      if (configRes.ok) {
        const config = await configRes.json();
        if (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) {
          customLabel = config.viewersLabel;
        }
      }
    } catch (e) {}
    if (data && data.data && typeof data.data.ViewerCount !== 'undefined') {
      viewerCountEl.textContent = `${data.data.ViewerCount} ${customLabel}`;
      liveButtonEl.textContent = data.data.Live ? window.languageManager.getText('liveNow') : window.languageManager.getText('notLive');
    } else if (data && data.data && typeof data.data.Live !== 'undefined') {
      viewerCountEl.textContent = window.languageManager.getText('noData');
      liveButtonEl.textContent = data.data.Live ? window.languageManager.getText('liveNow') : window.languageManager.getText('notLive');
    } else {
      viewerCountEl.textContent = window.languageManager.getText('noData');
      liveButtonEl.textContent = window.languageManager.getText('notLive');
    }
  } catch (error) {
    console.error('Error details:', error);
    const viewerCountEl = document.getElementById('viewer-count');
    const liveButtonEl = document.getElementById('live-button');
    if (!viewerCountEl || !liveButtonEl) return;
    if (error.message && error.message.toLowerCase().includes('network')) {
      viewerCountEl.textContent = window.languageManager.getText('failedToConnect');
      liveButtonEl.textContent = window.languageManager.getText('notLive');
    } else {
      viewerCountEl.textContent = window.languageManager.getText('errorFetchingStatus');
      liveButtonEl.textContent = window.languageManager.getText('notLive');
    }
  }
}

async function startViewerCountUpdates(url, interval = 10000) {
  await fetchViewerCountAndDisplay(url);
  setTimeout(() => startViewerCountUpdates(url, interval), interval);
}

function isValidUrl() {
  return true;
}

function validateIconSize(fileInput) {
  const file = fileInput.files[0];
  if (!file) return true;
  if (file.size > 1024 * 1024) {
    alert('The icon is too big. Maximum size: 1MB.');
    fileInput.value = '';
    return false;
  }
  return true;
}

window.addEventListener('DOMContentLoaded', async () => {
  function updateLiveviewsStatusAdmin(liveviews) {
    const liveviewsStatus = document.getElementById('liveviews-status');
    if (!liveviewsStatus) return;
    if (liveviews && liveviews.active) {
      const count = typeof liveviews.count === 'number' ? liveviews.count : 0;
      liveviewsStatus.textContent = `${window.languageManager.getText('liveNow')}: ${count} ${window.languageManager.getText('views')}`;
    } else {
      liveviewsStatus.textContent = window.languageManager.getText('notLive');
    }
  }

  if (window.ws) {
    window.ws.addEventListener('message', function (event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'liveviews_state') {
          updateLiveviewsStatusAdmin(msg);
        }
      } catch (e) {}
    });
  }

  async function updateLiveviewsStatusAdminFromAPI(url) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      console.log('[Liveviews Admin] CLAIM_ID:', url);
      console.log('[Liveviews Admin] API response:', data);
      if (data && data.data && typeof data.data.ViewerCount !== 'undefined') {
        updateLiveviewsStatusAdmin({ active: data.data.Live, count: data.data.ViewerCount });
      } else if (data && data.data && typeof data.data.Live !== 'undefined') {
        updateLiveviewsStatusAdmin({ active: data.data.Live, count: 0 });
      } else {
        updateLiveviewsStatusAdmin({ active: false, count: 0 });
      }
    } catch (e) {
      updateLiveviewsStatusAdmin({ active: false, count: 0 });
    }
  }

  function startAdminViewerCountUpdates(url, interval = 10000) {
    if (!url) return;
    updateLiveviewsStatusAdminFromAPI(url);
    setTimeout(() => startAdminViewerCountUpdates(url, interval), interval);
  }
  const config = await fetchLiveviewsConfig();
  applyLiveviewsConfig(config);
  const CLAIM_ID = config.claimid || '';
  const API_BASE = 'https://api.odysee.live/livestream/is_live?channel_claim_id=';
  const API_URL = CLAIM_ID ? `${API_BASE}${CLAIM_ID}` : '';

  function startUpdatesWhenReady() {
    if (window.languageManager) {
      if (API_URL) {
        startViewerCountUpdates(API_URL);
        startAdminViewerCountUpdates(API_URL);
      }
    } else {
      setTimeout(startUpdatesWhenReady, 50);
    }
  }
  startUpdatesWhenReady();
  const iconInput = document.getElementById('liveviews-icon-input');
  if (iconInput) {

    let warning = document.createElement('div');
    warning.style.color = 'red';
    warning.style.fontSize = '14px';
    warning.style.marginBottom = '6px';
    warning.innerText = 'El icono debe pesar máximo 1MB.';
    iconInput.parentNode.insertBefore(warning, iconInput);
    iconInput.addEventListener('change', function() {
      validateIconSize(iconInput);
    });
  }

  const colorPickerIds = ['liveviews-bg-color', 'liveviews-font-color'];
  colorPickerIds.forEach(id => {
    const el = document.getElementById(id);
    const hexLabel = document.getElementById(id + '-hex');
    if (el) {
      el.classList.add('color-picker');
      if (hexLabel) {
        hexLabel.textContent = el.value;
        el.addEventListener('input', function() {
          hexLabel.textContent = el.value;
        });
      }
    }
  });

  const widget = document.querySelector('.liveviews-widget');
  const liveButton = document.querySelector('.live-button');
  const viewerCount = document.getElementById('viewer-count');
  if (widget) {
    widget.style.display = 'flex';
    widget.style.alignItems = 'center';
  }
  if (liveButton && viewerCount) {
    liveButton.style.marginRight = '0px';
    viewerCount.style.marginLeft = '10px';
  }
});

async function loadLiveviewsViewersLabel() {
    var input = document.getElementById('liveviews-viewers-label');
    if (input) {
        try {
            const res = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
            if (res.ok) {
                const config = await res.json();
                if (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) {
                    input.value = config.viewersLabel;
                }
            }
        } catch (e) {}
    }
}

async function saveLiveviewsViewersLabel() {
    var input = document.getElementById('liveviews-viewers-label');
    if (input) {
        const label = input.value || 'viewers';
        localStorage.setItem('liveviews-viewers-label', label);
        
        try {
            const res = await fetch('/api/save-liveviews-label', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ viewersLabel: label })
            });
            if (!res.ok) throw new Error('Could not save to backend');
        } catch (e) {
            alert('Error saving the label in the backend: ' + (e.message || e));
        }
    }
}

if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', loadLiveviewsViewersLabel);
    document.getElementById('liveviews-save')?.addEventListener('click', saveLiveviewsViewersLabel);
}