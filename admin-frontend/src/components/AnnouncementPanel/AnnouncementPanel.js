import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { pushToast } from '../../services/toast';
import { confirmDialog } from '../../services/confirm';
import { isHttpUrl, withinRange, MAX_ANNOUNCEMENT_IMAGE } from '../../utils/validation';
import { usePublicToken } from '../../composables/usePublicToken';

export function useAnnouncementPanel(t) {
  const settings = ref({
    cooldownSeconds: 300,
    theme: 'vertical',
    bgColor: '#0a0e12',
    textColor: '#ffffff',
    animationMode: 'fade',
    defaultDurationSeconds: 10,
    applyAllDurations: false
  });
  const cooldownMinutes = computed({
    get() { return Math.max(1, Math.round((settings.value.cooldownSeconds || 300) / 60)); },
    set(v) { const n = Number(v); settings.value.cooldownSeconds = Number.isFinite(n) && n > 0 ? n * 60 : 300; }
  });
  const messages = ref([]);
  const newMsg = ref({ text: '', linkUrl: '', durationSeconds: 10, imageFile: null });
  const errors = ref({ text: '', linkUrl: '', durationSeconds: '' });
  const editing = ref(false);
  const editForm = ref({ id: null, text: '', linkUrl: '', durationSeconds: 10, enabled: true, removeImage: false });
  const faviconUrl = ref('');
  const faviconData = ref(null);
  const savingSettings = ref(false);
  const adding = ref(false);
  const updating = ref(false);
  const modalRef = ref(null);
  const lastTriggerEl = ref(null);
  const pt = usePublicToken();
  const widgetUrl = computed(() => pt.withToken(`${location.origin}/widgets/announcement`));
  const activeTab = ref('settings');

  async function load() {
    try {
      const r = await axios.get('/api/announcement');
      if (r.data && r.data.success) {
        const cfg = r.data.config?.settings || r.data.config || {};
        Object.assign(settings.value, cfg);
        messages.value = r.data.config?.messages || r.data.messages || [];
      }
    } catch {}
  }

  async function saveSettings() {
    try {
      savingSettings.value = true;
      const payload = { ...settings.value };
      const r = await axios.post('/api/announcement', payload);
      if (r.data.success) {
        pushToast({ type: 'success', message: t('announcementSavedSettings') });
        load();
      } else {
        pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
      }
    } catch {
      pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
    } finally { savingSettings.value = false; }
  }

  function onNewImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_ANNOUNCEMENT_IMAGE) {
      pushToast({ type: 'error', message: t('announcementImageTooLarge') });
      return;
    }
    newMsg.value.imageFile = f;
  }

  function validateNew() {
    errors.value = { text: '', linkUrl: '', durationSeconds: '' };
    if (!newMsg.value.text.trim()) errors.value.text = t('requiredField');
    if (newMsg.value.linkUrl && !isHttpUrl(newMsg.value.linkUrl)) errors.value.linkUrl = t('invalidUrl');
    if (!withinRange(newMsg.value.durationSeconds, 1, 60)) errors.value.durationSeconds = t('valRange1to60');
    return !errors.value.text && !errors.value.linkUrl && !errors.value.durationSeconds;
  }

  async function addMessage() {
    if (!validateNew()) return;
    try {
      adding.value = true;
      const fd = new FormData();
      fd.append('text', newMsg.value.text);
      if (newMsg.value.linkUrl) fd.append('linkUrl', newMsg.value.linkUrl);
      if (newMsg.value.durationSeconds) fd.append('durationSeconds', newMsg.value.durationSeconds);
      if (newMsg.value.imageFile) fd.append('image', newMsg.value.imageFile);
      const r = await fetch('/api/announcement/message', { method: 'POST', body: fd });
      const data = await r.json();
      if (data.success) {
        pushToast({ type: 'success', message: t('announcementMsgAdded') });
        newMsg.value = { text: '', linkUrl: '', durationSeconds: 10, imageFile: null };
        load();
      } else {
        pushToast({ type: 'error', message: data.error || t('announcementSaveSettingsFailed') });
      }
    } catch { pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') }); }
    finally { adding.value = false; }
  }

  async function toggleMessageEnabled(m) { m.enabled = !!m.enabled; await updateMessage(m); }

  async function updateMessage(m) {
    try {
      const payload = { enabled: m.enabled, text: m.text, linkUrl: m.linkUrl || '', durationSeconds: m.durationSeconds };
      const r = await axios.put(`/api/announcement/message/${m.id}`, payload);
      if (r.data.success) {
        pushToast({ type: 'success', message: t('announcementMsgUpdated') });
      } else { pushToast({ type: 'error', message: r.data.error }); }
    } catch { pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') }); }
  }

  function openEdit(m, evt) {
    if (evt && evt.currentTarget instanceof HTMLElement) {
      lastTriggerEl.value = evt.currentTarget;
    } else {
      lastTriggerEl.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    editing.value = true;
    editForm.value = { id: m.id, text: m.text, linkUrl: m.linkUrl || '', durationSeconds: m.durationSeconds || 10, enabled: !!m.enabled, removeImage: false };
    nextTick(() => { const first = modalRef.value?.querySelector('input,button,select,textarea'); first && first.focus(); });
  }
  function closeEdit() { 
    editing.value = false; 
    nextTick(() => { if (lastTriggerEl.value) { lastTriggerEl.value.focus(); } });
  }

  async function submitEdit() {
    try {
      updating.value = true;
      const payload = { text: editForm.value.text, linkUrl: editForm.value.linkUrl, enabled: editForm.value.enabled, durationSeconds: editForm.value.durationSeconds, removeImage: editForm.value.removeImage };
      const r = await axios.put(`/api/announcement/message/${editForm.value.id}`, payload);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementMsgUpdated') }); editing.value = false; load(); }
      else { pushToast({ type: 'error', message: r.data.error }); }
    } catch { pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') }); }
    finally { updating.value = false; }
  }

  async function deleteMessage(m) {
    const ok = await confirmDialog({ title: t('commonDelete') + '?', description: t('announcementMsgDeleteConfirm') || 'This will permanently delete the announcement.', confirmText: t('commonDelete') || 'Delete', cancelText: t('commonCancel') || 'Cancel', danger: true });
    if (!ok) return;
    try {
      const r = await axios.delete(`/api/announcement/message/${m.id}`);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementMsgDeleted') }); load(); }
      else { pushToast({ type: 'error', message: r.data.error || t('announcementMsgDeleteFailed') }); }
    } catch { pushToast({ type: 'error', message: t('announcementMsgDeleteFailed') }); }
  }

  async function clearAll(mode) {
    try {
      const r = await axios.delete(`/api/announcement/messages?mode=${mode}`);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementCleared') }); load(); }
      else { pushToast({ type: 'error', message: t('announcementClearFailed') }); }
    } catch { pushToast({ type: 'error', message: t('announcementClearFailed') }); }
  }

  async function fetchFavicon() {
    if (!faviconUrl.value) return;
    try { const r = await axios.get('/api/announcement/favicon', { params: { url: faviconUrl.value } }); faviconData.value = r.data.favicon; }
    catch { faviconData.value = null; }
  }
  function clearFavicon() { faviconData.value = null; }

  function trapFocus(e) {
    if (!editing.value) return;
    const focusable = modalRef.value?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable || !focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') closeEdit();
  }

  onMounted(async () => { await pt.refresh(); load(); document.addEventListener('keydown', trapFocus); });
  onBeforeUnmount(() => document.removeEventListener('keydown', trapFocus));

  return { settings, cooldownMinutes, messages, newMsg, errors, editing, editForm, faviconUrl, faviconData, savingSettings, adding, updating, modalRef, widgetUrl, activeTab,
    load, saveSettings, onNewImage, addMessage, toggleMessageEnabled, updateMessage, openEdit, closeEdit, submitEdit, deleteMessage, clearAll, fetchFavicon, clearFavicon };
}
