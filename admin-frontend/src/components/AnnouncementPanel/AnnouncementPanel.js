import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import api from '../../services/api';
import { pushToast } from '../../services/toast';
import { confirmDialog } from '../../services/confirm';
import { withinRange, MAX_ANNOUNCEMENT_IMAGE } from '../../utils/validation';
import { usePublicToken } from '../../composables/usePublicToken';

export function useAnnouncementPanel(t) {
  const settings = ref({
    cooldownSeconds: 300,
  theme: 'horizontal',
    bgColor: '#0a0e12',
    textColor: '#ffffff',
    animationMode: 'fade',
    defaultDurationSeconds: 10,
    applyAllDurations: false,
    bannerBgType: 'solid',
    gradientFrom: '#4f36ff',
    gradientTo: '#10d39e',
    staticMode: false
  });
  const cooldownMinutes = computed({
    get() { return Math.max(1, Math.round((settings.value.cooldownSeconds || 300) / 60)); },
    set(v) { const n = Number(v); settings.value.cooldownSeconds = Number.isFinite(n) && n > 0 ? n * 60 : 300; }
  });
  const messages = ref([]);
  const newMsg = ref({
    text: '',
    durationSeconds: 10,
    imageFile: null,
    title: '',
    subtitle1: '',
    subtitle2: '',
    subtitle3: '',
    titleColor: '#ffffff',
    subtitle1Color: '#e8eef2',
    subtitle2Color: '#cdd6df',
    subtitle3Color: '#cdd6df',
    titleSize: 28,
    subtitle1Size: 18,
    subtitle2Size: 14,
    subtitle3Size: 12,
    ctaText: '',
    ctaIcon: '',
    ctaBgColor: '#000000',
    ctaTextSize: 16,
    textColorOverride: '#ffffff',
    textSize: 16
  });
  const errors = ref({ text: '', durationSeconds: '' });
  const editing = ref(false);
  const editForm = ref({
    id: null,
    text: '',
    durationSeconds: 10,
    enabled: true,
    removeImage: false,
    title: '',
    subtitle1: '',
    subtitle2: '',
    subtitle3: '',
    titleColor: '#ffffff',
    subtitle1Color: '#e8eef2',
    subtitle2Color: '#cdd6df',
    subtitle3Color: '#cdd6df',
    titleSize: 28,
    subtitle1Size: 18,
    subtitle2Size: 14,
    subtitle3Size: 12,
    ctaText: '',
    ctaIcon: '',
    ctaBgColor: '#000000',
    ctaTextSize: 16,
    textColorOverride: '#ffffff',
    textSize: 16
  });
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
      const r = await api.get('/api/announcement');
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
      const r = await api.post('/api/announcement', payload);
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
    errors.value = { text: '', durationSeconds: '' };

    if (newMsg.value.text && newMsg.value.text.trim().length > 90) errors.value.text = t('announcementValidationTooLong') || 'Too long';
    if (!withinRange(newMsg.value.durationSeconds, 1, 60)) errors.value.durationSeconds = t('valRange1to60');

    const hasContent = Boolean(
      (newMsg.value.text && newMsg.value.text.trim().length) ||
      (newMsg.value.title && newMsg.value.title.trim().length) ||
      (newMsg.value.subtitle1 && newMsg.value.subtitle1.trim().length) ||
      (newMsg.value.subtitle2 && newMsg.value.subtitle2.trim().length) ||
      (newMsg.value.subtitle3 && newMsg.value.subtitle3.trim().length) ||
      (newMsg.value.ctaText && newMsg.value.ctaText.trim().length) ||
      newMsg.value.imageFile
    );
    if (!hasContent) {
      pushToast({ type: 'error', message: t('announcementValidationNoContent') || 'The banner cannot be empty.' });
      return false;
    }
    return !errors.value.text && !errors.value.durationSeconds;
  }

  async function addMessage() {
    if (!validateNew()) return;
    try {
      adding.value = true;
      const fd = new FormData();
  fd.append('text', newMsg.value.text);
      if (newMsg.value.durationSeconds) fd.append('durationSeconds', newMsg.value.durationSeconds);
      if (newMsg.value.imageFile) fd.append('image', newMsg.value.imageFile);
      if (newMsg.value.title) fd.append('title', newMsg.value.title);
      if (newMsg.value.subtitle1) fd.append('subtitle1', newMsg.value.subtitle1);
      if (newMsg.value.subtitle2) fd.append('subtitle2', newMsg.value.subtitle2);
      if (newMsg.value.subtitle3) fd.append('subtitle3', newMsg.value.subtitle3);
      if (newMsg.value.titleColor) fd.append('titleColor', newMsg.value.titleColor);
      if (newMsg.value.subtitle1Color) fd.append('subtitle1Color', newMsg.value.subtitle1Color);
      if (newMsg.value.subtitle2Color) fd.append('subtitle2Color', newMsg.value.subtitle2Color);
      if (newMsg.value.subtitle3Color) fd.append('subtitle3Color', newMsg.value.subtitle3Color);
      if (newMsg.value.titleSize) fd.append('titleSize', String(newMsg.value.titleSize));
      if (newMsg.value.subtitle1Size) fd.append('subtitle1Size', String(newMsg.value.subtitle1Size));
      if (newMsg.value.subtitle2Size) fd.append('subtitle2Size', String(newMsg.value.subtitle2Size));
      if (newMsg.value.subtitle3Size) fd.append('subtitle3Size', String(newMsg.value.subtitle3Size));
      if (newMsg.value.ctaText) fd.append('ctaText', newMsg.value.ctaText);
      if (newMsg.value.ctaIcon) fd.append('ctaIcon', newMsg.value.ctaIcon);
      if (newMsg.value.ctaBgColor) fd.append('ctaBgColor', newMsg.value.ctaBgColor);
      if (newMsg.value.ctaTextSize) fd.append('ctaTextSize', String(newMsg.value.ctaTextSize));
      if (newMsg.value.textColorOverride) fd.append('textColorOverride', newMsg.value.textColorOverride);
      if (newMsg.value.textSize) fd.append('textSize', String(newMsg.value.textSize));
      const r = await api.post('/api/announcement/message', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = r.data;
      if (data && data.success) {
        pushToast({ type: 'success', message: t('announcementMsgAdded') });
        newMsg.value = {
          text: '', durationSeconds: 10, imageFile: null,
          title: '', subtitle1: '', subtitle2: '', subtitle3: '',
          titleColor: '#ffffff', subtitle1Color: '#e8eef2', subtitle2Color: '#cdd6df', subtitle3Color: '#cdd6df',
          titleSize: 28, subtitle1Size: 18, subtitle2Size: 14, subtitle3Size: 12,
          ctaText: '', ctaIcon: '', ctaBgColor: '#000000', ctaTextSize: 16,
          textColorOverride: '#ffffff', textSize: 16
        };
        load();
      } else {
        pushToast({ type: 'error', message: data.error || t('announcementSaveSettingsFailed') });
      }
    } catch { pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') }); }
    finally { adding.value = false; }
  }

  async function toggleMessageEnabled(m) {
    const desired = !!m.enabled;
    try {
      const r = await api.put(`/api/announcement/message/${m.id}`, { enabled: desired });
      if (r.data?.success) {
        pushToast({ type: 'success', message: t('announcementMsgUpdated') });
      } else {
        throw new Error(r.data?.error || 'failed');
      }
    } catch {
      m.enabled = !desired;
      pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
    }
  }

  async function updateMessage(m) {
    try {
      const payload = {
        enabled: m.enabled,
        durationSeconds: m.durationSeconds,
        title: m.title,
        subtitle1: m.subtitle1,
        subtitle2: m.subtitle2,
        subtitle3: m.subtitle3,
        titleColor: m.titleColor,
        subtitle1Color: m.subtitle1Color,
        subtitle2Color: m.subtitle2Color,
        subtitle3Color: m.subtitle3Color,
        titleSize: m.titleSize,
        subtitle1Size: m.subtitle1Size,
        subtitle2Size: m.subtitle2Size,
        subtitle3Size: m.subtitle3Size,
        ctaText: m.ctaText,
        ctaIcon: m.ctaIcon,
        ctaBgColor: m.ctaBgColor,
        ctaTextSize: m.ctaTextSize,
        textColorOverride: m.textColorOverride,
        textSize: m.textSize
      };

      Object.keys(payload).forEach((k) => {
        if (payload[k] === null || payload[k] === undefined) delete payload[k];
      });

      if (typeof m.text === 'string') {
        const trimmed = m.text.trim();
            if (trimmed.length > 0 && trimmed.length <= 90) {
          payload.text = m.text;
            } else if (trimmed.length > 90) {
          pushToast({ type: 'warning', message: t('announcementValidationTooLong') + ' — text not updated' });
        }
      }
      const r = await api.put(`/api/announcement/message/${m.id}`, payload);
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
    editForm.value = {
      id: m.id,
      text: m.text,
      durationSeconds: m.durationSeconds || 10,
      enabled: !!m.enabled,
      removeImage: false,
      title: m.title || '',
      subtitle1: m.subtitle1 || '',
      subtitle2: m.subtitle2 || '',
      subtitle3: m.subtitle3 || '',
      titleColor: m.titleColor || '#ffffff',
      subtitle1Color: m.subtitle1Color || '#e8eef2',
      subtitle2Color: m.subtitle2Color || '#cdd6df',
      subtitle3Color: m.subtitle3Color || '#cdd6df',
      titleSize: m.titleSize ?? 28,
      subtitle1Size: m.subtitle1Size ?? 18,
      subtitle2Size: m.subtitle2Size ?? 14,
      subtitle3Size: m.subtitle3Size ?? 12,
      ctaText: m.ctaText || '',
      ctaIcon: m.ctaIcon || '',
      ctaBgColor: m.ctaBgColor || '#000000',
      ctaTextSize: m.ctaTextSize ?? 16,
      textColorOverride: m.textColorOverride || settings.value.textColor || '#ffffff',
      textSize: m.textSize ?? 16
    };
    nextTick(() => { const first = modalRef.value?.querySelector('input,button,select,textarea'); first && first.focus(); });
  }
  function closeEdit() { 
    editing.value = false; 
    nextTick(() => { if (lastTriggerEl.value) { lastTriggerEl.value.focus(); } });
  }

  async function submitEdit() {
    try {
      updating.value = true;
      const payload = {
        enabled: editForm.value.enabled,
        durationSeconds: editForm.value.durationSeconds,
        removeImage: editForm.value.removeImage,
        title: editForm.value.title,
        subtitle1: editForm.value.subtitle1,
        subtitle2: editForm.value.subtitle2,
        subtitle3: editForm.value.subtitle3,
        titleColor: editForm.value.titleColor,
        subtitle1Color: editForm.value.subtitle1Color,
        subtitle2Color: editForm.value.subtitle2Color,
        subtitle3Color: editForm.value.subtitle3Color,
        titleSize: editForm.value.titleSize,
        subtitle1Size: editForm.value.subtitle1Size,
        subtitle2Size: editForm.value.subtitle2Size,
        subtitle3Size: editForm.value.subtitle3Size,
        ctaText: editForm.value.ctaText,
        ctaIcon: editForm.value.ctaIcon,
        ctaBgColor: editForm.value.ctaBgColor,
        ctaTextSize: editForm.value.ctaTextSize,
        textColorOverride: editForm.value.textColorOverride,
        textSize: editForm.value.textSize
      };

      if (typeof editForm.value.text === 'string') {
        const raw = editForm.value.text;
        const trimmed = raw.trim();
        if (trimmed.length <= 90) {
          payload.text = raw;
        } else {
          pushToast({ type: 'warning', message: t('announcementValidationTooLong') + ' — text not updated' });
        }
      }
  const r = await api.put(`/api/announcement/message/${editForm.value.id}`, payload);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementMsgUpdated') }); editing.value = false; load(); }
      else { pushToast({ type: 'error', message: r.data.error }); }
    } catch { pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') }); }
    finally { updating.value = false; }
  }

  async function onEditImage(e) {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > MAX_ANNOUNCEMENT_IMAGE) {
        pushToast({ type: 'error', message: t('announcementImageTooLarge') });
        return;
      }
      if (!editForm.value?.id) return;

      const fd = new FormData();
      fd.append('image', f);
      const r = await api.put(`/api/announcement/message/${editForm.value.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = r.data;
      if (data && data.success) {
        pushToast({ type: 'success', message: t('announcementMsgUpdated') });
        await load();
      } else {
        pushToast({ type: 'error', message: data.error || t('announcementSaveSettingsFailed') });
      }
    } catch {
      pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
    }
  }

  async function deleteMessage(m) {
    const ok = await confirmDialog({ title: t('commonDelete') + '?', description: t('announcementMsgDeleteConfirm') || 'This will permanently delete the announcement.', confirmText: t('commonDelete') || 'Delete', cancelText: t('commonCancel') || 'Cancel', danger: true });
    if (!ok) return;
    try {
      const r = await api.delete(`/api/announcement/message/${m.id}`);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementMsgDeleted') }); load(); }
      else { pushToast({ type: 'error', message: r.data.error || t('announcementMsgDeleteFailed') }); }
    } catch { pushToast({ type: 'error', message: t('announcementMsgDeleteFailed') }); }
  }

  async function clearAll(mode) {
    try {
      const r = await api.delete(`/api/announcement/messages?mode=${mode}`);
      if (r.data.success) { pushToast({ type: 'success', message: t('announcementCleared') }); load(); }
      else { pushToast({ type: 'error', message: t('announcementClearFailed') }); }
    } catch { pushToast({ type: 'error', message: t('announcementClearFailed') }); }
  }

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

  return { settings, cooldownMinutes, messages, newMsg, errors, editing, editForm, savingSettings, adding, updating, modalRef, widgetUrl, activeTab,
    load, saveSettings, onNewImage, addMessage, toggleMessageEnabled, updateMessage, openEdit, closeEdit, submitEdit, deleteMessage, clearAll, onEditImage };
}
