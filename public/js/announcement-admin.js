document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('announcement-message-form');
  const listEl = document.getElementById('announcement-messages-list');
  const emptyEl = document.getElementById('announcement-empty');
  const cooldownInput = document.getElementById('announcement-cooldown');
  const themeSelect = document.getElementById('announcement-theme');
  const animationModeSelect = document.getElementById('announcement-animation-mode');
  const saveSettingsBtn = document.getElementById('announcement-save-settings');
  const defaultDurationInput = document.getElementById('announcement-default-duration');
  const applyAllCheckbox = document.getElementById('announcement-apply-all');
  const widgetUrlInput = document.getElementById('announcement-widget-url');
  const bgColorInput = document.getElementById('announcement-bg-color');
  const textColorInput = document.getElementById('announcement-text-color');
  const editIdInput = document.getElementById('announcement-edit-id');
  const cancelEditBtn = document.getElementById('announcement-cancel-edit');
  const previewBtn = document.getElementById('announcement-preview-btn');
  const previewBox = document.getElementById('announcement-preview');
  const durationInput = document.getElementById('announcement-duration');
  const imageInput = document.getElementById('announcement-image');
  const currentImgBox = document.getElementById('announcement-image-current');
  const currentImgThumb = document.getElementById('announcement-image-thumb');
  const removeImgBtn = document.getElementById('announcement-remove-image');
  let removeImageFlag = false;

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', () => {
      removeImageFlag = true;
      if (currentImgBox) currentImgBox.classList.add('hidden');
      if (imageInput) imageInput.value = '';

      let pending = document.getElementById('ann-remove-indicator');
      if (!pending) {
        pending = document.createElement('div');
        pending.id = 'ann-remove-indicator';
        pending.className = 'ann-remove-indicator';
        pending.textContent = t('announcementRemoveImage') + ' ✓';
        form.appendChild(pending);
      }
    });
  }

  function t(key){
    if (window.languageManager) return window.languageManager.getText(key);
    return key;
  }

  function showAlert(message, type='success') {
    if (window.showAlert) return window.showAlert(message, type);
    console.log('[announcement-admin]', type, message);
  }

  function loadConfig() {
    fetch('/api/announcement').then(r=>r.json()).then(data => {
      if (!data.success) return;
      const secs = Number(data.config.cooldownSeconds);
      cooldownInput.value = Number.isFinite(secs) && secs > 0 ? Math.round(secs/60) : 5; // minutes
      themeSelect.value = data.config.theme;
  if (animationModeSelect) animationModeSelect.value = data.config.animationMode || 'fade';
      if (bgColorInput) bgColorInput.value = data.config.bgColor || '#0e1014';
      if (textColorInput) textColorInput.value = data.config.textColor || '#fcfcfc';
  if (defaultDurationInput) defaultDurationInput.value = data.config.defaultDurationSeconds || 10;
      renderMessages(data.config.messages);
      if (widgetUrlInput) widgetUrlInput.value = window.location.origin + '/widgets/announcement';
    });
  }

  function renderMessages(messages) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!messages.length) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    messages.forEach(m => {
      const li = document.createElement('li');
      li.className = 'announcement-msg-item';
      const safe = m.text.replace(/</g,'&lt;');
      const durVal = (m.durationSeconds || (defaultDurationInput? Number(defaultDurationInput.value) : 10));
      const durationHtml = `${durVal}s${m.usesDefaultDuration ? ' <span class="ann-def-tag">(def)</span>' : ''}`;
      li.innerHTML = `
        <div class="ann-msg-text" title="${safe}">${safe}</div>
        <div class="ann-msg-duration">${durationHtml}</div>
        <div class="ann-msg-actions">
          <button data-action="toggle" data-id="${m.id}" class="save-btn">${m.enabled? t('active'):t('inactive')}</button>
          <button data-action="edit" data-id="${m.id}" class="save-btn">✎</button>
          <button data-action="delete" data-id="${m.id}" class="save-btn danger-btn ann-minw-36">✕</button>
        </div>`;
      listEl.appendChild(li);
    });
  }

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
  if (editIdInput && editIdInput.value) return;
      const fd = new FormData(form);
      const textEl = document.getElementById('announcement-text');
      const text = (fd.get('text')||'').toString().trim();
  if (!text) return showAlert(t('announcementValidationRequired'),'error');
  if (text.length > 120) return showAlert(t('announcementValidationTooLong'),'error');
      const link = document.getElementById('announcement-link').value.trim();
      if (link) fd.set('linkUrl', link);
      if (durationInput) {
        const d = Number(durationInput.value);
        if (!isNaN(d) && d >=1 && d <=60) fd.set('durationSeconds', String(d));
      }
      fetch('/api/announcement/message', { method: 'POST', body: fd }).then(r=>r.json()).then(data => {
  if (!data.success) return showAlert(data.error||t('announcementErrorGeneric'),'error');
        form.reset();
        if (durationInput) durationInput.value = '10';
        if (textEl) textEl.value='';
        loadConfig();
  showAlert(t('announcementMessageAdded'),'success');
  }).catch(()=>showAlert(t('announcementErrorGeneric'),'error'));
    });
  }

  if (listEl) {
    listEl.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'delete') {
        fetch('/api/announcement/message/' + id, { method: 'DELETE' }).then(r=>r.json()).then(()=> loadConfig());
      } else if (action === 'toggle') {
        const enable = btn.textContent === t('inactive');
        fetch('/api/announcement/message/' + id, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled: enable }) }).then(r=>r.json()).then(()=> loadConfig());
      } else if (action === 'edit') {
        editIdInput.value = id;
        const textEl = btn.closest('li').querySelector('.ann-msg-text');
        const original = textEl ? textEl.getAttribute('title') : '';
        document.getElementById('announcement-text').value = original.replace(/&lt;/g,'<');
  cancelEditBtn.classList.remove('hidden');
        const span = document.querySelector('#announcement-message-form button[type="submit"] span');
        if (span) { span.setAttribute('data-i18n','announcementEditBtn'); span.textContent = t('announcementEditBtn'); }

        fetch('/api/announcement').then(r=>r.json()).then(d=>{
          if (d.success) {
            const msg = d.config.messages.find(m=>m.id===id);
            if (msg) {
              document.getElementById('announcement-link').value = msg.linkUrl || '';
              if (durationInput) durationInput.value = msg.durationSeconds || 10;
              if (msg.imageUrl) {
                currentImgThumb.src = msg.imageUrl;
    currentImgBox.classList.remove('hidden');
                removeImageFlag = false;
              } else {
    currentImgBox.classList.add('hidden');
              }
            }
          }
        });
      }
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
  const minutes = Number(cooldownInput.value);
  if (isNaN(minutes) || minutes <= 0) return showAlert(t('announcementInvalidCooldown'),'error');
  const defaultDur = defaultDurationInput ? Number(defaultDurationInput.value) : 10;
  const applyAll = applyAllCheckbox ? applyAllCheckbox.checked : false;
  fetch('/api/announcement', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cooldownSeconds: Math.max(60, minutes*60), theme: themeSelect.value, bgColor: bgColorInput.value, textColor: textColorInput.value, animationMode: animationModeSelect? animationModeSelect.value : undefined, defaultDurationSeconds: defaultDur, applyAllDurations: applyAll }) }).then(r=>r.json()).then(data => {
  if (!data.success) return showAlert(data.error||t('announcementErrorGeneric'),'error');
    if (applyAllCheckbox) applyAllCheckbox.checked = false;
  showAlert(t('announcementSettingsSaved'),'success');

  loadConfig();
      });
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      editIdInput.value='';
      form.reset();
  cancelEditBtn.classList.add('hidden');
  previewBox.classList.add('hidden');
  currentImgBox.classList.add('hidden');
      removeImageFlag = false;
    });
  }

  if (previewBtn && previewBox) {
    previewBtn.addEventListener('click', () => {
      const raw = document.getElementById('announcement-text').value;
      if (!raw.trim()) { previewBox.classList.add('hidden'); return; }
      const md = raw
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/\[(.+?)\]\((https?:\/\/[^\s]+?)\)/g,'<a href="$2" target="_blank" class="ann-link">$1<\/a>');
      previewBox.innerHTML = md;
      previewBox.classList.remove('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', e => {
      if (editIdInput.value) {
        e.preventDefault();
        const id = editIdInput.value;
        const text = document.getElementById('announcement-text').value.trim();
  if (!text) return showAlert(t('announcementValidationRequired'),'error');
  if (text.length>120) return showAlert(t('announcementValidationTooLong'),'error');
        const link = document.getElementById('announcement-link').value.trim();
        const hasNewImage = imageInput && imageInput.files && imageInput.files.length>0;
        const dVal = durationInput ? Number(durationInput.value) : NaN;
        if (hasNewImage) {
          const fd = new FormData();
            fd.append('text', text);
            if (link) fd.append('linkUrl', link);
            if (removeImageFlag) fd.append('removeImage','1');
            if (!isNaN(dVal) && dVal>=1 && dVal<=60) fd.append('durationSeconds', String(dVal));
            fd.append('image', imageInput.files[0]);
            fetch('/api/announcement/message/' + id + '/image', { method:'PUT', body: fd }).then(r=>r.json()).then(data => {
              if (!data.success) return showAlert(data.error||t('announcementErrorGeneric'),'error');
              showAlert(t('announcementMessageUpdated'),'success');
              finalizeEdit();
            });
        } else {
          const body = { text, linkUrl: link || '' };
          if (!isNaN(dVal) && dVal>=1 && dVal<=60) body.durationSeconds = dVal;
          if (removeImageFlag) body.removeImage = true;
          fetch('/api/announcement/message/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r=>r.json()).then(data => {
            if (!data.success) return showAlert(data.error||t('announcementErrorGeneric'),'error');
            showAlert(t('announcementMessageUpdated'),'success');
            finalizeEdit();
          });
        }
      }
    }, { capture: true });
  }

  function finalizeEdit() {
    editIdInput.value='';
  cancelEditBtn.classList.add('hidden');
  previewBox.classList.add('hidden');
    form.reset();
  if (durationInput) durationInput.value = '10';
  currentImgBox.classList.add('hidden');
    removeImageFlag = false;
  const pending = document.getElementById('ann-remove-indicator');
  if (pending) pending.remove();
    loadConfig();
  }

  loadConfig();

  try {
    const listsCard = document.querySelector('#announcement-messages-list')?.closest('.form-card');
    if (listsCard && !listsCard.querySelector('.ann-clear-buttons')) {
      const bar = document.createElement('div');
      bar.className = 'ann-clear-buttons';
      const btnTest = document.createElement('button');
      btnTest.type = 'button';
      btnTest.className = 'save-btn';
      btnTest.textContent = t('announcementClearTest') || 'Clean test';
      const btnAll = document.createElement('button');
      btnAll.type = 'button';
      btnAll.className = 'save-btn danger-btn';
      btnAll.textContent = t('announcementClearAll') || 'Delete all';
      btnTest.addEventListener('click', () => {
        if (!confirm(t('announcementConfirmClearTest') || 'Delete test messages?')) return;
        fetch('/api/announcement/messages?mode=test', { method: 'DELETE' }).then(r=>r.json()).then(d=>{ if (d.success) { showAlert(t('announcementClearedTest') || 'Test messages deleted'); loadConfig(); } else showAlert(d.error||'Error','error'); });
      });
      btnAll.addEventListener('click', () => {
        if (!confirm(t('announcementConfirmClearAll') || 'Delete ALL messages?')) return;
        fetch('/api/announcement/messages', { method: 'DELETE' }).then(r=>r.json()).then(d=>{ if (d.success) { showAlert(t('announcementClearedAll') || 'All messages deleted'); loadConfig(); } else showAlert(d.error||'Error','error'); });
      });
      bar.appendChild(btnTest);
      bar.appendChild(btnAll);
      listsCard.insertBefore(bar, listsCard.firstChild);
    }
  } catch {}
});
