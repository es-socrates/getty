import { reactive, computed, onMounted, onUnmounted, watch, ref } from 'vue';
import api from '../../services/api';
import { pushToast } from '../../services/toast';
import { registerDirty } from '../../composables/useDirtyRegistry';
import { usePublicToken } from '../../composables/usePublicToken';

export function createChatPanel(t) {
  const colorHeadingId = 'chat-color-heading';
  const form = reactive({
    chatUrl: '',
    colors: {
      bg: '#0f1419',
      msgBg: '#15202b',
      msgBgAlt: '#192734',
      border: '#1d9bf0',
      text: '#e7e9ea',
      username: '#ffffff',
      usernameBg: '#11ff79',
      donation: '#e7e9ea',
      donationBg: '#ececec',
    },
  });
  const transparentBg = ref(false);
  const avatarRandomBg = ref(false);
  const overrideUsername = ref(false);
  const clearedThemeCSS = ref(false);
  const ttsAllChat = ref(false);
  const errors = reactive({ chatUrl: '' });
  const CLAIM_BASE = 'wss://sockety.odysee.tv/ws/commentron?id=';
  const claimPlaceholder = 'ej: 9e28103c613048b4a40...';
  const saving = ref(false);
  const connected = ref(false);
  const lastStatusAt = ref(0);
  const savingTts = ref(false);
  const original = reactive({ snapshot: null });
  const testForm = reactive({
    username: t('testUsernameDefault'),
    message: t('testMessageDefault'),
    credits: 5,
  });
  const testSending = ref(false);
  const testKind = ref('');

  const publicToken = ref('');
  const { withToken, refresh } = usePublicToken();
  function buildWidgetBase(extraParams = '') {
    const base = withToken(`${location.origin}/widgets/chat`);
    if (!extraParams) return base;
    return base + (extraParams.startsWith('?') ? extraParams : '?' + extraParams);
  }
  const widgetUrl = computed(() => {
    const params = avatarRandomBg.value ? 'avatarRandom=1' : '';
    return buildWidgetBase(params);
  });
  const widgetHorizontalUrl = computed(() => {
    const params = ['horizontal=1'];
    if (avatarRandomBg.value) params.push('avatarRandom=1');
    return buildWidgetBase(params.join('&'));
  });

  function resetColors() {
    form.colors = {
      bg: '#0f1419',
      msgBg: '#15202b',
      msgBgAlt: '#192734',
      border: '#1d9bf0',
      text: '#e7e9ea',
      username: '#ffffff',
      usernameBg: '#11ff79',
      donation: '#e7e9ea',
      donationBg: '#ececec',
    };
    transparentBg.value = false;
    overrideUsername.value = false;

    try {
      localStorage.removeItem('chatLiveThemeCSS');
    } catch {}
    clearedThemeCSS.value = true;
  }

  async function load() {
    try {
      const { data } = await api.get('/api/chat-config');
      if (data) {
        const raw = data.chatUrl || '';
        let extracted = '';
        if (raw.startsWith(CLAIM_BASE)) {
          extracted = raw.substring(CLAIM_BASE.length);
        } else if (raw.includes('id=')) {
          extracted = raw.split('id=')[1].split('&')[0];
        } else {
          extracted = raw;
        }

        const isUnset = !extracted || extracted === '...' || extracted === '/' || extracted === '#';
        form.chatUrl = isUnset ? '' : extracted;
        form.colors.bg = data.bgColor || form.colors.bg;
        if (form.colors.bg === 'transparent') {
          transparentBg.value = true;
        }
        form.colors.msgBg = data.msgBgColor || form.colors.msgBg;
        form.colors.msgBgAlt = data.msgBgAltColor || form.colors.msgBgAlt;
        form.colors.border = data.borderColor || form.colors.border;
        form.colors.text = data.textColor || form.colors.text;

        if (typeof data.usernameColor === 'string' && data.usernameColor) {
          form.colors.username = data.usernameColor;
          overrideUsername.value = true;
        }
        if (typeof data.usernameBgColor === 'string' && data.usernameBgColor) {
          form.colors.usernameBg = data.usernameBgColor;
          overrideUsername.value = true;
        }
        form.colors.donation = data.donationColor || form.colors.donation;
        form.colors.donationBg = data.donationBgColor || form.colors.donationBg;
        if (typeof data.avatarRandomBg === 'boolean') avatarRandomBg.value = !!data.avatarRandomBg;
        original.snapshot = JSON.stringify(form);
      }
    } catch {
      pushToast({ type: 'error', message: t('loadFailedChat') });
    }
    try {
      const { data } = await api.get('/api/tts-setting');
      ttsAllChat.value = !!data.ttsAllChat;
    } catch {}
  }

  async function save() {
    if (!validate()) return;
    try {
      saving.value = true;
      const claimId = extractClaimId(form.chatUrl.trim());
      const payload = {
        chatUrl: CLAIM_BASE + claimId,
        bgColor: transparentBg.value ? 'transparent' : form.colors.bg,
        msgBgColor: form.colors.msgBg,
        msgBgAltColor: form.colors.msgBgAlt,
        borderColor: form.colors.border,
        textColor: form.colors.text,
        usernameColor: overrideUsername.value ? form.colors.username : '',
        usernameBgColor: overrideUsername.value ? form.colors.usernameBg : '',
        donationColor: form.colors.donation,
        donationBgColor: form.colors.donationBg,
        themeCSS: clearedThemeCSS.value
          ? ''
          : localStorage.getItem('chatLiveThemeCSS') || undefined,
        avatarRandomBg: avatarRandomBg.value,
      };
      await api.post('/api/chat', payload);
      original.snapshot = JSON.stringify(form);
      pushToast({ type: 'success', message: t('savedChat') });
    } catch {
      pushToast({ type: 'error', message: t('saveFailedChat') });
    } finally {
      saving.value = false;
      clearedThemeCSS.value = false;
    }
  }

  async function saveTtsAllChat() {
    try {
      savingTts.value = true;
      await api.post('/api/tts-setting', { ttsAllChat: ttsAllChat.value });
      pushToast({ type: 'success', message: t('savedChat') });
    } catch {
      pushToast({ type: 'error', message: t('saveFailedChat') });
    } finally {
      savingTts.value = false;
    }
  }

  function extractClaimId(input) {
    if (!input) return '';
    if (input.startsWith(CLAIM_BASE)) return input.substring(CLAIM_BASE.length);
    if (input.startsWith('wss://') && input.includes('id='))
      return input.split('id=')[1].split('&')[0];
    return input;
  }

  function validate() {
    const claimId = extractClaimId(form.chatUrl.trim());
    const valid = /^[A-Za-z0-9]{5,64}$/.test(claimId);
    errors.chatUrl = claimId && !valid ? t('invalidClaimId') || 'Invalid Claim ID' : '';
    return !errors.chatUrl;
  }

  function isChatDirty() {
    return original.snapshot && original.snapshot !== JSON.stringify(form);
  }
  registerDirty(isChatDirty);
  watch(form, () => {}, { deep: true });
  onMounted(async () => {
    try {
      await refresh();
    } catch {}
    load();
  });

  const autoSaveTimer = ref(null);
  function scheduleToggleAutosave() {
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
    autoSaveTimer.value = setTimeout(() => {
      if (saving.value) {
        autoSaveTimer.value = setTimeout(scheduleToggleAutosave, 200);
        return;
      }
      save();
    }, 450);
  }
  watch([overrideUsername, transparentBg, avatarRandomBg], () => {
    scheduleToggleAutosave();
  });
  onUnmounted(() => {
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  });

  async function pollStatus() {
    try {
      const { data } = await api.get('/api/chat/status');
      connected.value = !!data?.connected;
      lastStatusAt.value = Date.now();
    } catch {}
  }

  onMounted(() => {
    pollStatus();
    const id = setInterval(pollStatus, 5000);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pollStatus();
    });

    try {
      onUnmounted(() => clearInterval(id));
    } catch {}
  });

  async function sendTest(kind) {
    try {
      testSending.value = true;
      testKind.value = kind;
      if (kind === 'donation') {
        const credits =
          Number.isFinite(Number(testForm.credits)) && Number(testForm.credits) > 0
            ? Number(testForm.credits)
            : 5;
        await api.post('/api/chat/test-message', {
          username: testForm.username || t('testUsernameDefault'),
          message: testForm.message || '',
          credits,
          donationOnly: true,
        });
        pushToast({ type: 'success', message: t('sentTestDonation') || 'Test donation sent' });
      } else {
        await api.post('/api/chat/test-message', {
          username: testForm.username || t('testUsernameDefault'),
          message: testForm.message || t('testMessageDefault'),
          credits: 0,
          donationOnly: false,
        });
        pushToast({ type: 'success', message: t('sentTestMessage') || 'Test message sent' });
      }
    } catch (e) {
      pushToast({
        type: 'error',
        message: t('sendFailed') || 'Failed to send',
        detail: e?.response?.data?.error || e?.message,
      });
    } finally {
      testSending.value = false;
      testKind.value = '';
    }
  }

  const price = reactive({
    usd: 0,
    source: 'none',
    ageSeconds: 0,
    providersTried: [],
    loading: true,
    refreshing: false,
    isFallback: false,
    isStale: false,
  });

  async function fetchPrice(force = false) {
    try {
      if (force) price.refreshing = true;
      else price.loading = true;
      const { data } = await api.get(`/api/ar-price${force ? '?force=1' : ''}`);
      price.usd = Number(data?.arweave?.usd || 0);
      price.source = data?.source || 'unknown';
      price.ageSeconds = Number(data?.ageSeconds || 0);
      price.providersTried = Array.isArray(data?.providersTried) ? data.providersTried : [];
      price.isFallback = /fallback/.test(price.source);
      price.isStale = !price.isFallback && price.ageSeconds > 90;
    } catch {
      price.source = 'error';
    } finally {
      price.loading = false;
      price.refreshing = false;
    }
  }
  function refreshPrice() {
    fetchPrice(true);
  }

  onMounted(() => {
    fetchPrice(false);
    const id = setInterval(() => fetchPrice(false), 60000);
    try {
      onUnmounted(() => clearInterval(id));
    } catch {}
  });

  return {
    colorHeadingId,
    form,
    transparentBg,
    avatarRandomBg,
    overrideUsername,
    clearedThemeCSS,
    ttsAllChat,
    errors,
    CLAIM_BASE,
    claimPlaceholder,
    saving,
    connected,
    lastStatusAt,
    savingTts,
    original,
    testForm,
    testSending,
    testKind,
    publicToken,
    widgetUrl,
    widgetHorizontalUrl,
    resetColors,
    load,
    save,
    saveTtsAllChat,
    extractClaimId,
    validate,
    sendTest,
    price,
    refreshPrice,
  };
}
