function notify(message, type = 'error') {
  try {
    if (window.showAlert) return window.showAlert(message, type);
  } catch(e) {}
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.setAttribute('role','status');
    el.style.position = 'fixed';
    el.style.right = '12px';
    el.style.bottom = '12px';
    el.style.zIndex = '9999';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '10px';
    el.style.border = '1px solid rgba(0,0,0,.15)';
    el.style.background = type === 'success' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)';
    el.style.color = type === 'success' ? '#065f46' : '#7f1d1d';
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 2500);
  } catch(e) {
    console.log(`[${type}]`, message);
  }
}

function t(key) {
  try {
    if (window.__i18n && typeof window.__i18n.t === 'function') return window.__i18n.t(key);
    if (window.languageManager && typeof window.languageManager.getText === 'function') return window.languageManager.getText(key);
  } catch (e) {}
  return key;
}
if (!window.languageManager && window.__i18n && typeof window.__i18n.t === 'function') {
  window.languageManager = {
    getText: (k) => window.__i18n.t(k),
    updatePageLanguage: () => {}
  };
}
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

  if (!viewerCountEl.textContent || viewerCountEl.textContent.trim() === '' || viewerCountEl.textContent === t('viewers')) {
      viewerCountEl.textContent = config.viewersLabel || 'viewers';
    }
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
  console.log('[Liveviews] endpoint:', url);
  console.log('[Liveviews] API response:', data);

    const viewerCountEl = document.getElementById('viewer-count');
    const liveButtonEl = document.getElementById('live-button');
    if (!viewerCountEl || !liveButtonEl) return;

    let config = window._liveviewsConfigCache;
    if (!config) {
      try {
        const configRes = await fetch('/config/liveviews-config.json', { cache: 'no-cache' });
        if (configRes.ok) config = await configRes.json();
      } catch (e) { config = {}; }
    }
    let customLabel = (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) ? config.viewersLabel : t('viewers');
    let bg = config && config.bg ? config.bg : '#fff';
    let color = config && config.color ? config.color : '#222';
    let font = config && config.font ? config.font : 'Arial';
    let size = config && config.size ? config.size : '32';
    viewerCountEl.style.background = bg;
    viewerCountEl.style.color = color;
    viewerCountEl.style.fontFamily = font;
    viewerCountEl.style.fontSize = size + 'px';
  if (data && data.data && typeof data.data.ViewerCount !== 'undefined') {
      viewerCountEl.textContent = `${data.data.ViewerCount} ${customLabel}`;
      const was = liveButtonEl.textContent === t('liveNow');
      const nowLive = !!data.data.Live;
      liveButtonEl.textContent = nowLive ? t('liveNow') : t('notLive');
  if (was !== nowLive) reportStreamState(nowLive, data.data.ViewerCount);
  } else if (data && data.data && typeof data.data.Live !== 'undefined') {
      viewerCountEl.textContent = `0 ${customLabel}`;
      const was = liveButtonEl.textContent === t('liveNow');
      const nowLive = !!data.data.Live;
      liveButtonEl.textContent = nowLive ? t('liveNow') : t('notLive');
  if (was !== nowLive) reportStreamState(nowLive, 0);
    } else {
      viewerCountEl.textContent = `0 ${customLabel}`;
      const was = liveButtonEl.textContent === t('liveNow');
      const nowLive = false;
      liveButtonEl.textContent = t('notLive');
  if (was !== nowLive) reportStreamState(nowLive, 0);
    }
  } catch (error) {
    console.error('Error details:', error);
    const viewerCountEl = document.getElementById('viewer-count');
    const liveButtonEl = document.getElementById('live-button');
    if (!viewerCountEl || !liveButtonEl) return;
    let config = window._liveviewsConfigCache || {};
    let customLabel = (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) ? config.viewersLabel : t('viewers');
    let bg = config && config.bg ? config.bg : '#fff';
    let color = config && config.color ? config.color : '#222';
    let font = config && config.font ? config.font : 'Arial';
    let size = config && config.size ? config.size : '32';
    viewerCountEl.style.background = bg;
    viewerCountEl.style.color = color;
    viewerCountEl.style.fontFamily = font;
    viewerCountEl.style.fontSize = size + 'px';
    viewerCountEl.textContent = `0 ${customLabel}`;
  const was = liveButtonEl.textContent === t('liveNow');
  const nowLive = false;
  liveButtonEl.textContent = t('notLive');
  if (was !== nowLive) reportStreamState(nowLive);
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
    notify('The icon is too big. Maximum size: 1MB.', 'error');
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
      liveviewsStatus.textContent = `${t('liveNow')}: ${count} ${t('views')}`;
    } else {
      liveviewsStatus.textContent = t('notLive');
    }

    const viewerCount = document.getElementById('viewer-count');
    if (viewerCount) {
      let label = '';
      let config = window._liveviewsConfigCache || {};
      if (config && typeof config.viewersLabel === 'string' && config.viewersLabel.trim()) {
        label = config.viewersLabel;
      } else {
        label = t('viewers');
      }
      let count = typeof liveviews.count === 'number' ? liveviews.count : 0;
      viewerCount.textContent = `${count} ${label}`;
      viewerCount.style.background = config.bg || '#fff';
      viewerCount.style.color = config.color || '#222';
      viewerCount.style.fontFamily = config.font || 'Arial';
      viewerCount.style.fontSize = (config.size || '32') + 'px';
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
      console.log('[Liveviews Admin] endpoint:', url);
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
  window._liveviewsConfigCache = config;
  applyLiveviewsConfig(config);

  const claimidInput = document.getElementById('liveviews-claimid');
  if (claimidInput && config.claimid) claimidInput.value = config.claimid;
  const viewersLabelInput = document.getElementById('liveviews-viewers-label');
  if (viewersLabelInput && config.viewersLabel) viewersLabelInput.value = config.viewersLabel;

  const viewerCountInit = document.getElementById('viewer-count');
  if (viewerCountInit) {
    viewerCountInit.textContent = `0 ${config.viewersLabel || 'viewers'}`;
    viewerCountInit.style.background = config.bg || '#fff';
    viewerCountInit.style.color = config.color || '#222';
    viewerCountInit.style.fontFamily = config.font || 'Arial';
    viewerCountInit.style.fontSize = (config.size || '32') + 'px';
  }

  const searchToken = (() => { try { return new URL(window.location.href).searchParams.get('token') || ''; } catch { return ''; } })();
  const API_URL = `/api/liveviews/status` + (searchToken ? `?token=${encodeURIComponent(searchToken)}` : '');

  startViewerCountUpdates(API_URL);
  startAdminViewerCountUpdates(API_URL);
  const iconInput = document.getElementById('liveviews-icon-input');
  if (iconInput) {

    let warning = document.createElement('div');
    warning.style.color = 'red';
    warning.style.fontSize = '14px';
    warning.style.marginBottom = '6px';
    warning.innerText = 'The icon must weigh a maximum of 1MB.';
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

function reportStreamState(isLive, viewers) {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token') || '';
    const endpoint = '/api/stream-history/event' + (token ? `?token=${encodeURIComponent(token)}` : '');
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ live: !!isLive, at: Date.now(), viewers: typeof viewers === 'number' ? viewers : undefined })
    }).catch(() => {});
  } catch {}
}

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
      notify('Error saving the label in the backend: ' + (e.message || e), 'error');
    }
    }
}

if (window.location.pathname.startsWith('/admin')) {
    document.addEventListener('DOMContentLoaded', async function () {
        await loadLiveviewsViewersLabel();

        const config = await fetchLiveviewsConfig();
        const iconPreview = document.getElementById('liveviews-icon-preview');
        const iconMeta = document.getElementById('liveviews-icon-meta');
        const removeBtn = document.getElementById('liveviews-remove-icon');
        if (config.icon && iconPreview) {
            iconPreview.innerHTML = `<img src="${config.icon}" alt="icon" style="max-width:64px;max-height:64px;border-radius:50%;border:1px solid #ccc;">`;
            if (removeBtn) removeBtn.style.display = '';
            if (iconMeta) iconMeta.textContent = '';
        } else if (iconPreview) {
            iconPreview.innerHTML = '';
            if (removeBtn) removeBtn.style.display = 'none';
            if (iconMeta) iconMeta.textContent = '';
        }

        if (removeBtn) {
            removeBtn.onclick = function () {
                iconPreview.innerHTML = '';
                if (iconMeta) iconMeta.textContent = '';
                if (iconInput) iconInput.value = '';
                removeBtn.style.display = 'none';

                iconInput.dataset.remove = '1';
            };
        }

        const iconInput = document.getElementById('liveviews-icon-input');
        if (iconInput) {
            iconInput.addEventListener('change', function () {
                const file = iconInput.files && iconInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        if (iconPreview) {
                            iconPreview.innerHTML = `<img src="${e.target.result}" alt="icon" style="max-width:64px;max-height:64px;border-radius:50%;border:1px solid #ccc;">`;
                        }
                    };
                    reader.readAsDataURL(file);
                    if (iconMeta) {
                        iconMeta.textContent = `${file.name} (${(file.size/1024).toFixed(1)} KB)`;
                    }
                    if (removeBtn) removeBtn.style.display = '';
                    iconInput.dataset.remove = '';
                } else {
                    if (iconPreview) iconPreview.innerHTML = '';
                    if (iconMeta) iconMeta.textContent = '';
                    if (removeBtn) removeBtn.style.display = 'none';
                }
            });
        }
    });

    document.getElementById('liveviews-save')?.addEventListener('click', async function (e) {
        e.preventDefault();
        let bg = document.getElementById('liveviews-bg-color')?.value;
        let color = document.getElementById('liveviews-font-color')?.value;
        let font = document.getElementById('liveviews-font-family')?.value;
        let size = document.getElementById('liveviews-size')?.value;
        let claimid = document.getElementById('liveviews-claimid')?.value;
        let viewersLabel = document.getElementById('liveviews-viewers-label')?.value;

        if (!bg) bg = '#fff';
        if (!color) color = '#222';
        if (!font) font = 'Arial';
        if (!size) size = '32';
        if (!claimid) claimid = '';
        if (!viewersLabel) viewersLabel = 'viewers';
        const iconInput = document.getElementById('liveviews-icon-input');
        const iconFile = iconInput && iconInput.files && iconInput.files[0] ? iconInput.files[0] : null;
        const removeIcon = iconInput && iconInput.dataset.remove === '1';

        const formData = new FormData();
        formData.append('bg', bg);
        formData.append('color', color);
        formData.append('font', font);
        formData.append('size', size);
        formData.append('claimid', claimid);
        formData.append('viewersLabel', viewersLabel);
        if (iconFile) {
            formData.append('icon', iconFile);
        }
        if (removeIcon) {
            formData.append('removeIcon', '1');
        }

        try {
            const res = await fetch('/config/liveviews-config.json', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error('Could not save configuration');

            const saveBtn = document.getElementById('liveviews-save');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.classList.add('saved');
                const oldText = saveBtn.querySelector('span[data-i18n]')?.textContent;
                const span = saveBtn.querySelector('span[data-i18n]');
                if (span) span.textContent = 'Saved!';
            if (span) span.textContent = t('saved') || 'Saved!';
                setTimeout(() => {
                    if (span && oldText) span.textContent = oldText;
                    saveBtn.classList.remove('saved');
                    saveBtn.disabled = false;
                }, 1500);
            }

            const config = await fetchLiveviewsConfig();
            const iconPreview = document.getElementById('liveviews-icon-preview');
            const iconMeta = document.getElementById('liveviews-icon-meta');
            const removeBtn = document.getElementById('liveviews-remove-icon');
            if (config.icon && iconPreview) {
                iconPreview.innerHTML = `<img src="${config.icon}" alt="icon" style="max-width:64px;max-height:64px;border-radius:50%;border:1px solid #ccc;">`;
                if (removeBtn) removeBtn.style.display = '';
                if (iconMeta) iconMeta.textContent = '';
            } else if (iconPreview) {
                iconPreview.innerHTML = '';
                if (removeBtn) removeBtn.style.display = 'none';
                if (iconMeta) iconMeta.textContent = '';
            }
            if (iconInput) iconInput.value = '';
            if (iconInput) iconInput.dataset.remove = '';

            window._liveviewsConfigCache = config;
            const claimidInput = document.getElementById('liveviews-claimid');
            if (claimidInput && config.claimid) claimidInput.value = config.claimid;
            const viewersLabelInput = document.getElementById('liveviews-viewers-label');
            if (viewersLabelInput && config.viewersLabel) viewersLabelInput.value = config.viewersLabel;
            const viewerCountSave = document.getElementById('viewer-count');
            if (viewerCountSave) {
                let label = config.viewersLabel || 'viewers';
                let count = typeof config.count === 'number' ? config.count : 0;
                viewerCountSave.textContent = `${count} ${label}`;
                viewerCountSave.style.background = config.bg || '#fff';
                viewerCountSave.style.color = config.color || '#222';
                viewerCountSave.style.fontFamily = config.font || 'Arial';
                viewerCountSave.style.fontSize = (config.size || '32') + 'px';
            }
    } catch (err) {
      notify('Error saving configuration: ' + (err.message || err), 'error');
    }
    });
}
