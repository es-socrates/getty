import {
  ref,
  reactive,
  computed,
  onMounted,
  onUnmounted,
  watch,
  onActivated,
  onDeactivated,
} from 'vue';
import { confirmDialog } from '../../services/confirm';
import { pushToast } from '../../services/toast';
import api from '../../services/api';
import SizeBlocksModule from './utils/sizeBlocks';
import DiffUtilModule from './utils/diffUtil';
const { SizeBlocks } = SizeBlocksModule;
const { computeLineDiff } = DiffUtilModule;

export function createChatThemeManager(t) {
  const defaultThemes = [
    {
      name: 'getty',
      css: `:root { --bg-main: #080c10; --bg-message: #0a0e12; --bg-message-alt: #0a0e12; --text: #e6edf3; --username: #fff; --donation: #ddb826; --donation-bg: #ececec; }
	.message { background: #0a0e12 !important; border-radius: 4px; padding: 12px; margin-bottom: 6px; box-sizing: border-box; color: #fff !important; }
	.message.odd { background: #0a0e12 !important; }
	.message-username.cyberpunk { color: #fff; font-weight: 600; }
	.message-text-inline { color: #fff !important; font-weight: 600; }
	.message.has-donation { background: #ececec !important; }
	.message.has-donation .message-username { color: #111 !important; }
	.message.has-donation .message-text-inline { color: #111 !important; }
	.message-donation { background: #ddb826 !important; color: #111 !important; }`,
    },
    {
      name: 'X',
      css: `:root { --bg-main: #f7f7f7; --bg-message: #f7f7f7; --bg-message-alt: #f7f7f7; --text: #111; --username: #111; --donation: #f7f7f7; --donation-bg: #3b5aff; }
	.message { background: #f7f7f7 !important; border-radius: 6px; padding: 12px; margin-bottom: 6px; box-sizing: border-box; border-left: 6px solid #3b5aff !important; color: #111 !important; }
	.message.odd { background: #f7f7f7 !important; }
	.message-username.cyberpunk { color: #111; font-weight: 600; }
	.message-text-inline { color: #111 !important; font-weight: 600; }
	.message.has-donation { background: #3b5aff !important; }
	.message.has-donation .message-username { color: #fff !important; }
	.message.has-donation .message-text-inline { color: #fff !important; }
	.message-donation { background: #f7f7f7 !important; color: #111 !important; }`,
    },
    {
      name: 'Twitch',
      css: `:root { --bg-main: #18181b; --bg-message: #111; --bg-message-alt: #111; --text: #fff; --username: #a970ff; --donation: #f7f7f7; --donation-bg: #9147ff; }
	.message { background: #111 !important; border-radius: 8px; padding: 10px 16px; margin-bottom: 6px; border-left: 6px solid #9147ff; box-shadow: 0 2px 8px rgba(0,0,0,0.08); color: #fff !important; }
	.message.odd { background: #111 !important; }
	.message-username.cyberpunk { color: #a970ff; text-shadow: 0 0 4px #9147ff; }
	.message-text-inline { color: #fff !important; }
	.message.has-donation { background: #9147ff !important; }
	.message.has-donation .message-username { color: #fff !important; }
	.message.has-donation .message-text-inline { color: #fff !important; }
	.message-donation { background: #f7f7f7 !important; color: #111 !important; }`,
    },
    {
      name: 'Claro',
      css: `:root { --bg-main: #ffffff; --bg-message: #f1f5f9; --bg-message-alt: #f1f5f9; --border: #d0d7de; --text: #111; --username: #0969da; --donation: #ffb44e; --donation-bg: #fff4e5; }
	.message { background: #f1f5f9 !important; border-radius: 8px; padding: 10px 16px; margin-bottom: 6px; border: 1px solid #d0d7de; border-left: 6px solid #d0d7de; box-shadow: 0 2px 4px rgba(0,0,0,0.04); color: #111 !important; }
	.message.odd { background: #f1f5f9 !important; font-size: 14px; }
	.message-username.cyberpunk { color: #0969da; font-weight: 600; font-size: 14px; }
	.message-text-inline { color: #111 !important; font-size: 14px; }
	.message.has-donation { background: #fff4e5 !important; }
	.message.has-donation .message-username { color: #111 !important; font-size: 14px; }
	.message.has-donation .message-text-inline { color: #111 !important; font-size: 14px; }
	.message-donation { background: #ffb44e !important; color: #111 !important; }`,
    },
    {
      name: 'Oscuro',
      css: `:root { --bg-main: #080c10; --bg-message: #0d1114; --bg-message-alt: #0d1114; --border: #313131; --text: #fff; --username: #fff; --donation: #f7f7f7; --donation-bg: #2dcc89; }
	.message { background: #0d1114 !important; border-radius: 8px; padding: 10px 16px; margin-bottom: 6px; border-left: 6px solid #313131 !important; color: #fff !important; }
	.message.odd { background: #0d1114 !important; font-size: 14px; }
	.message-username.cyberpunk { color: #fff; font-weight: 600; font-size: 14px; }
	.message-text-inline { color: #fff !important; font-size: 14px; }
	.message.has-donation { background: #2dcc89 !important; }
	.message.has-donation .message-username { color: #111 !important; font-size: 14px; }
	.message.has-donation .message-text-inline { color: #111 !important; font-size: 14px; }
	.message-donation { background: #f7f7f7 !important; color: #111 !important; }`,
    },
    {
      name: 'Minimalista',
      css: `/* THEME_ID:MINIMALISTA_AUTO10S */
	:root { --bg-main: transparent; --bg-message: rgba(230,230,230,0.72); --bg-message-alt: rgba(230,230,230,0.72); --border: rgba(0,0,0,0.12); --text: #111; --username: #111; --donation: rgb(16,211,158); --donation-bg: rgba(42,197,213,0.12); }
	.message { background: rgba(230,230,230,0.72) !important; border: 1px solid rgba(0,0,0,0.12); border-left: 6px solid rgba(0,0,0,0.12); border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; color: #111 !important; backdrop-filter: saturate(120%) blur(4px); -webkit-backdrop-filter: saturate(120%) blur(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.18); will-change: opacity, transform; animation: fadeInUp 0.35s ease-out both, fadeOut 0.35s ease-in 9.65s forwards; }
	.message.odd { background: rgba(230,230,230,0.72) !important; }
	.message-username.cyberpunk { color: #111; font-weight: 600; }
	.message-text-inline { color: #111 !important; }
	.message.has-donation { background: rgba(42,197,213,0.12) !important; }
	.message.has-donation .message-username { color: #111 !important; }
	.message.has-donation .message-text-inline { color: #111 !important; }
	.message-donation { background: rgb(16,211,158) !important; color: #111 !important; }
		@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
		@keyframes fadeOut { to { opacity: 0; transform: translateY(-6px); } }`,
    },
  ];

  const selectId = 'chat-theme-select';
  const previewId = 'chat-theme-preview-section';
  const selectedIdx = ref(0);
  const cssPanelOpen = ref(false);
  const customizing = ref(false);
  const customWorkingName = ref('');
  const customWorkingCSS = ref('');
  const previewLight = ref(false);
  const orderMode = ref('recent');
  const searchTerm = ref('');
  const showDiff = ref(false);
  const diffA = ref(0);
  const diffB = ref(1);
  const diffLines = ref([]);
  const showExport = ref(false);
  const showImport = ref(false);
  const exportText = ref('');
  const importText = ref('');
  const copiedExport = ref(false);
  const importing = ref(false);
  const importMode = ref('overwrite');
  const importPlaceholder = computed(
    () => t('importPlaceholder') || '[{"name":"My Theme","css":".message { color: red; }"}]'
  );
  const dragOver = ref(false);
  const droppedFileName = ref('');
  const fontSizes = reactive({ username: 14, message: 14, donation: 14, avatar: 32 });
  let initialFontSizes = { username: 14, message: 14, donation: 14, avatar: 32 };
  const creatingVariant = ref(false);
  const showVariantModal = ref(false);
  const variantName = ref('');
  const variantMode = ref('new');
  const variantModeDuplicate = ref(false);

  const customThemes = ref([]);
  function loadCustomThemes() {
    try {
      customThemes.value = JSON.parse(localStorage.getItem('chatCustomThemes') || '[]') || [];
    } catch {
      customThemes.value = [];
    }
    const now = Date.now();
    customThemes.value.forEach((t) => {
      if (!t.updatedAt) t.updatedAt = now;
    });
    sortCustomThemes();
  }
  function saveCustomThemes(themes) {
    customThemes.value = themes.map((t) => ({ ...t, updatedAt: t.updatedAt || Date.now() }));
    sortCustomThemes();
    localStorage.setItem('chatCustomThemes', JSON.stringify(customThemes.value));
    persistCustomThemesServer();
  }
  function sortCustomThemes() {
    if (orderMode.value === 'alpha') {
      customThemes.value.sort((a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      );
    } else {
      customThemes.value.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
  }

  const PREVIEW_STYLE_ID = 'chat-theme-preview-style';
  const RUNTIME_SIZE_STYLE_ID = 'chat-theme-runtime-sizes';
  let hasUserInteracted = false;
  const currentCSS = ref('');
  let cssSource = 'fallback';
  const isCustomSelected = computed(() => selectedIdx.value >= defaultThemes.length);
  const allThemes = computed(() => [...defaultThemes, ...customThemes.value]);
  const currentTheme = computed(() => allThemes.value[selectedIdx.value] || defaultThemes[0]);
  const cssRuleCount = computed(() => (currentCSS.value.match(/\{/g) || []).length);
  const hasSizeBlock = computed(() => /\/\* AUTO_FONT_SIZES_START \*\//.test(currentCSS.value));
  const recentlyUpdated = computed(() => {
    const updated = currentTheme.value.updatedAt || 0;
    return Date.now() - updated < 1000 * 60 * 60;
  });
  const filteredDefaults = computed(() => {
    const term = searchTerm.value.trim().toLowerCase();
    return defaultThemes
      .map((t, i) => ({ i, theme: t }))
      .filter((o) => !term || o.theme.name.toLowerCase().includes(term));
  });
  const filteredCustoms = computed(() => {
    const term = searchTerm.value.trim().toLowerCase();
    return customThemes.value
      .map((t, ci) => ({ i: defaultThemes.length + ci, theme: t }))
      .filter((o) => !term || o.theme.name.toLowerCase().includes(term));
  });
  const previewCSS = computed(() => currentCSS.value);

  function mergeSizeCSS(base) {
    return SizeBlocks.merge(base, fontSizes);
  }
  function stripSizeCSS(base) {
    return SizeBlocks.strip(base);
  }
  function extractSizeVars(css) {
    return SizeBlocks.extract(css);
  }

  function buildRuntimeVarsBlock() {
    const u = SizeBlocks.clamp(Number(fontSizes.username) || 14);
    const m = SizeBlocks.clamp(Number(fontSizes.message) || 14);
    const d = SizeBlocks.clamp(Number(fontSizes.donation) || 14);
    const a = SizeBlocks.clamp(Number(fontSizes.avatar) || 32);
    fontSizes.username = u;
    fontSizes.message = m;
    fontSizes.donation = d;
    fontSizes.avatar = a;
    return `:root{--chat-font-username:${u}px;--chat-font-message:${m}px;--chat-font-donation:${d}px;--chat-avatar-size:${a}px;}`;
  }
  function ensureRuntimeVarsTag() {
    let el = document.getElementById(RUNTIME_SIZE_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = RUNTIME_SIZE_STYLE_ID;
      document.head.appendChild(el);
    }
    return el;
  }
  function applyRuntimeSizeVariables() {
    try {
      const el = ensureRuntimeVarsTag();
      el.textContent = buildRuntimeVarsBlock();

      try {
        localStorage.setItem('chatLiveThemeVars', buildRuntimeVarsBlock());
      } catch {}
    } catch {
      /* ignore */
    }
  }
  function composeFinalCSS(source) {
    const base = stripSizeCSS(source || '').trim();
    const cleaned = base.replace(/\/\* AUTO_FONT_SIZES_GENERATED:[0-9]+ \*\//g, '');
    return mergeSizeCSS(cleaned).replace(
      /\/\* AUTO_FONT_SIZES_START \*\//,
      `/* AUTO_FONT_SIZES_START */\n/* AUTO_FONT_SIZES_GENERATED:${Date.now()} */`
    );
  }
  function syncFontSizesFromCSS(css) {
    try {
      const ext = extractSizeVars(css || '');
      if (!Object.keys(ext).length) return;
      if (typeof ext.username === 'number') fontSizes.username = SizeBlocks.clamp(ext.username);
      if (typeof ext.message === 'number') fontSizes.message = SizeBlocks.clamp(ext.message);
      if (typeof ext.donation === 'number') fontSizes.donation = SizeBlocks.clamp(ext.donation);
      if (typeof ext.avatar === 'number') fontSizes.avatar = SizeBlocks.clamp(ext.avatar);
    } catch {}
  }
  function updatePreviewStyle(css) {
    try {
      let el = document.getElementById(PREVIEW_STYLE_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = PREVIEW_STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent = mergeSizeCSS(css || '');
    } catch {
      /* ignore */
    }
  }

  watch(selectedIdx, () => {
    const themeCSS = currentTheme.value.css || '';
    const extracted = extractSizeVars(themeCSS);
    fontSizes.username = extracted.username || 14;
    fontSizes.message = extracted.message || 14;
    fontSizes.donation = extracted.donation || 14;
    fontSizes.avatar = extracted.avatar || 32;

    initialFontSizes = {
      username: fontSizes.username,
      message: fontSizes.message,
      donation: fontSizes.donation,
      avatar: fontSizes.avatar,
    };
    currentCSS.value = themeCSS;
    if (hasUserInteracted) {
      persistLiveTheme();
      debouncedPersistThemeCSS();
    }
    updatePreviewStyle(previewCSS.value);
    applyRuntimeSizeVariables();
  });

  onMounted(async () => {
    loadCustomThemes();
    try {
      const stored = localStorage.getItem('chatLiveThemeCSS');
      if (stored && typeof stored === 'string' && stored.trim()) {
        currentCSS.value = stored;
        cssSource = 'local';
      } else {
        const chatConfig = await api
          .get('/api/chat-config')
          .then((r) => r.data)
          .catch(() => null);
        if (chatConfig && chatConfig.themeCSS) {
          currentCSS.value = chatConfig.themeCSS;
          cssSource = 'server';
        } else {
          currentCSS.value = currentTheme.value.css || '';
          cssSource = 'fallback';
        }
      }

      if (cssSource !== 'fallback') persistLiveThemeLocalOnly();
      try {
        const resp = await api.get('/api/chat-custom-themes').catch(() => null);
        if (resp && resp.data && Array.isArray(resp.data.themes)) {
          const data = resp.data;
          if (Array.isArray(data.themes)) {
            const map = new Map(customThemes.value.map((t) => [t.name, t]));
            for (const st of data.themes) {
              if (!st || typeof st.name !== 'string' || typeof st.css !== 'string') continue;
              const existing = map.get(st.name);
              if (!existing || (st.updatedAt && st.updatedAt > existing.updatedAt)) {
                map.set(st.name, {
                  name: st.name,
                  css: st.css,
                  updatedAt: st.updatedAt || Date.now(),
                });
              }
            }
            customThemes.value = Array.from(map.values());
            sortCustomThemes();
          }
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }

    syncFontSizesFromCSS(currentCSS.value);
    updatePreviewStyle(previewCSS.value);
    applyRuntimeSizeVariables();

    queueMicrotask(() => {
      try {
        const el = document.getElementById(PREVIEW_STYLE_ID);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
          document.head.appendChild(el);
        }
      } catch {}
    });
  });

  onActivated(() => {
    try {
      updatePreviewStyle(previewCSS.value);
      applyRuntimeSizeVariables();
    } catch {
      /* ignore */
    }
  });

  onDeactivated(() => {});
  onUnmounted(() => {
    try {
      const el = document.getElementById(PREVIEW_STYLE_ID);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      const sz = document.getElementById(RUNTIME_SIZE_STYLE_ID);
      if (sz && sz.parentNode) sz.parentNode.removeChild(sz);
    } catch {
      /* ignore */
    }
  });
  watch(previewCSS, (css) => {
    updatePreviewStyle(css);
  });
  watch(
    fontSizes,
    () => {
      fontSizes.username = SizeBlocks.clamp(fontSizes.username);
      fontSizes.message = SizeBlocks.clamp(fontSizes.message);
      fontSizes.donation = SizeBlocks.clamp(fontSizes.donation);
      fontSizes.avatar = SizeBlocks.clamp(fontSizes.avatar);
      hasUserInteracted = true;
      if (customizing.value) {
        customWorkingCSS.value = mergeSizeCSS(customWorkingCSS.value || currentCSS.value || '');
        currentCSS.value = customWorkingCSS.value;
        persistLiveTheme();
        debouncedPersistThemeCSS();
      } else {
        currentCSS.value = mergeSizeCSS(currentCSS.value || '');
        persistLiveTheme();
        debouncedPersistThemeCSS();
      }
      updatePreviewStyle(previewCSS.value);
      applyRuntimeSizeVariables();
    },
    { deep: true }
  );

  function resetSizes() {
    fontSizes.username = 14;
    fontSizes.message = 14;
    fontSizes.donation = 14;
    fontSizes.avatar = 32;
  }

  function openSizeVariantModal() {
    variantMode.value = 'new';
    variantName.value = `${currentTheme.value.name || 'theme'}-sz${fontSizes.message}`;
    showVariantModal.value = true;
  }
  function decideVariantMode(existingName) {
    if (customThemes.value.some((t) => t.name === existingName)) return 'overwrite';
    return 'new';
  }
  async function saveVariantConfirmed() {
    try {
      creatingVariant.value = true;
      const name = (variantName.value || '').trim();
      if (!name) {
        pushToast({ type: 'error', message: t('chatThemeNameRequired') || 'Name required' });
        return;
      }
      const baseForVariant = mergeSizeCSS(currentCSS.value || currentTheme.value.css || '');
      const cssWithSizes = composeFinalCSS(baseForVariant);
      const extractedAfter = extractSizeVars(cssWithSizes);
      const mismatch = ['username', 'message', 'donation', 'avatar'].some(
        (k) => extractedAfter[k] !== fontSizes[k]
      );
      if (mismatch) {
        const corrected = composeFinalCSS(mergeSizeCSS(stripSizeCSS(cssWithSizes)));
        if (corrected !== cssWithSizes) {
          pushToast({
            type: 'warn',
            message: t('chatThemeSizeBlockRebuilt') || 'Rebuilt size block for consistency',
          });
        }
      }
      let custom = customThemes.value.slice();
      const idx = custom.findIndex((t) => t.name === name);
      if (idx >= 0) {
        if (variantMode.value === 'overwrite') {
          custom[idx].css = cssWithSizes;
          custom[idx].updatedAt = Date.now();
        } else {
          let base = name;
          let c = 1;
          let newName = `${base}-${c}`;
          while (custom.some((t) => t.name === newName)) {
            c++;
            newName = `${base}-${c}`;
          }
          custom.push({ name: newName, css: cssWithSizes, updatedAt: Date.now() });
          variantName.value = newName;
        }
      } else {
        custom.push({ name, css: cssWithSizes, updatedAt: Date.now() });
      }
      saveCustomThemes(custom);
      selectedIdx.value =
        defaultThemes.length + custom.findIndex((t) => t.name === (variantName.value || name));
      currentCSS.value = cssWithSizes;
      syncFontSizesFromCSS(cssWithSizes);
      persistLiveTheme();

      try {
        const chatConfig = await api
          .get('/api/chat-config')
          .then((r) => r.data)
          .catch(() => null);
        if (chatConfig && chatConfig.chatUrl) {
          await api.post('/api/chat', { chatUrl: chatConfig.chatUrl, themeCSS: cssWithSizes });
        }
      } catch {}
      debouncedPersistThemeCSS();
      pushToast({ type: 'success', message: t('chatThemeSaved') || 'Saved variant' });
      showVariantModal.value = false;
      applyRuntimeSizeVariables();
    } catch {
      pushToast({ type: 'error', message: t('chatThemeSaveError') || 'Could not save variant' });
    } finally {
      creatingVariant.value = false;
    }
  }
  watch(variantName, (v) => {
    variantMode.value = decideVariantMode((v || '').trim());
  });

  function persistLiveTheme() {
    if (!currentCSS.value) return;
    localStorage.setItem('chatLiveThemeCSS', currentCSS.value);
  }
  function persistLiveThemeLocalOnly() {
    try {
      if (currentCSS.value) localStorage.setItem('chatLiveThemeCSS', currentCSS.value);
    } catch {}
  }
  let persistTimer = null;
  function debouncedPersistThemeCSS() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      try {
        const chatConfig = await api
          .get('/api/chat-config')
          .then((r) => r.data)
          .catch(() => null);
        if (chatConfig && chatConfig.chatUrl && currentCSS.value) {
          await api.post('/api/chat', { chatUrl: chatConfig.chatUrl, themeCSS: currentCSS.value });
        }
      } catch {
        /* ignore */
      }
    }, 600);
  }
  function onSelectChange() {
    hasUserInteracted = true;
    persistLiveTheme();
    debouncedPersistThemeCSS();
  }
  function beginCustomize() {
    customizing.value = true;
    customWorkingName.value = isCustomSelected.value ? currentTheme.value.name || '' : '';
    const base = stripSizeCSS(currentTheme.value.css || currentCSS.value || '');
    customWorkingCSS.value = mergeSizeCSS(base);
    syncFontSizesFromCSS(customWorkingCSS.value);

    initialFontSizes = {
      username: fontSizes.username,
      message: fontSizes.message,
      donation: fontSizes.donation,
      avatar: fontSizes.avatar,
    };
    updatePreviewStyle(previewCSS.value);
    applyRuntimeSizeVariables();
  }
  function cancelCustomize() {
    customizing.value = false;
    customWorkingName.value = '';
    customWorkingCSS.value = '';
  }
  function saveCustomizedTheme() {
    if (!customWorkingName.value || !customWorkingCSS.value) return;
    const name = customWorkingName.value.trim();
    let custom = customThemes.value.slice();
    const existing = custom.find((t) => t.name === name);
    const withSizesMerged = mergeSizeCSS(customWorkingCSS.value || '');
    const css = composeFinalCSS(withSizesMerged || '');
    const extracted = extractSizeVars(css);
    const mismatch = ['username', 'message', 'donation', 'avatar'].some(
      (k) => extracted[k] !== fontSizes[k]
    );
    if (mismatch) {
      const rebuilt = composeFinalCSS(mergeSizeCSS(stripSizeCSS(css)));
      if (rebuilt !== css) {
        pushToast({
          type: 'warn',
          message: t('chatThemeSizeBlockRebuilt') || 'Rebuilt size block for consistency',
        });
      }
    }
    if (existing) {
      existing.css = css;
      existing.updatedAt = Date.now();
    } else {
      custom.push({ name, css, updatedAt: Date.now() });
    }
    saveCustomThemes(custom);
    selectedIdx.value = defaultThemes.length + custom.findIndex((t) => t.name === name);
    currentCSS.value = css;
    syncFontSizesFromCSS(css);
    hasUserInteracted = true;
    persistLiveTheme();
    debouncedPersistThemeCSS();
    customizing.value = false;
    pushToast({ type: 'success', message: t('chatThemeSaved') || 'Theme saved' });
    persistCustomThemesServer();
    applyRuntimeSizeVariables();
  }
  async function deleteCustom() {
    if (!isCustomSelected.value) {
      pushToast({
        type: 'error',
        message: t('chatThemeDeleteOnlyCustom') || 'Only custom themes can be deleted.',
      });
      return;
    }
    const ok = await confirmDialog({
      title: t('chatThemeDelete') || 'Delete theme?',
      description:
        t('chatThemeDeleteDesc') || 'This will permanently delete the selected custom theme.',
      confirmText: t('commonDelete') || 'Delete',
      cancelText: t('commonCancel') || 'Cancel',
      danger: true,
    });
    if (!ok) return;
    const customIdx = selectedIdx.value - defaultThemes.length;
    if (customIdx >= 0) {
      const copy = customThemes.value.slice();
      copy.splice(customIdx, 1);
      saveCustomThemes(copy);
      selectedIdx.value = 0;
      hasUserInteracted = true;
      persistLiveTheme();
      debouncedPersistThemeCSS();
      persistCustomThemesServer();
    }
  }
  function duplicateCurrentTheme() {
    try {
      const baseName = currentTheme.value.name || 'theme';
      let custom = customThemes.value.slice();
      let newName = baseName + ' copy';
      let counter = 1;
      while (custom.some((t) => t.name === newName)) {
        counter++;
        newName = baseName + ' copy ' + counter;
      }
      const css = composeFinalCSS(currentTheme.value.css || '');
      custom.push({ name: newName, css, updatedAt: Date.now() });
      saveCustomThemes(custom);
      selectedIdx.value = defaultThemes.length + custom.findIndex((t) => t.name === newName);
      currentCSS.value = css;
      syncFontSizesFromCSS(css);
      hasUserInteracted = true;
      persistLiveTheme();
      debouncedPersistThemeCSS();
      pushToast({ type: 'success', message: t('duplicateThemeSuccess') || 'Theme duplicated' });
      persistCustomThemesServer();
    } catch {
      pushToast({ type: 'error', message: t('duplicateThemeFail') || 'Could not duplicate' });
    }
  }
  function togglePreviewBg() {
    previewLight.value = !previewLight.value;
  }
  function revertSizes() {
    try {
      fontSizes.username = initialFontSizes.username;
      fontSizes.message = initialFontSizes.message;
      fontSizes.donation = initialFontSizes.donation;
      fontSizes.avatar = initialFontSizes.avatar;

      const base = stripSizeCSS(currentCSS.value || '');
      currentCSS.value = composeFinalCSS(base);
      persistLiveTheme();
      debouncedPersistThemeCSS();
      updatePreviewStyle(previewCSS.value);
      applyRuntimeSizeVariables();
      pushToast({ type: 'success', message: t('revertSizesDone') || 'Sizes reverted' });
    } catch {
      pushToast({ type: 'error', message: t('revertSizesFail') || 'Could not revert sizes' });
    }
  }
  function openExportModal() {
    const payload = customThemes.value.map((t) => ({
      name: t.name,
      css: t.css,
      updatedAt: t.updatedAt || Date.now(),
    }));
    exportText.value = JSON.stringify(payload, null, 2);
    copiedExport.value = false;
    showExport.value = true;
  }
  function closeExport() {
    showExport.value = false;
  }
  function copyExport() {
    try {
      navigator.clipboard.writeText(exportText.value).then(() => {
        copiedExport.value = true;
      });
    } catch {
      copiedExport.value = true;
    }
  }
  function downloadExport() {
    try {
      const blob = new Blob([exportText.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-custom-themes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  function openImportModal() {
    try {
      importText.value = '';
      importMode.value = 'overwrite';
      showImport.value = true;
    } catch {
      /* swallow to avoid unmount */
    }
  }
  function closeImport() {
    showImport.value = false;
    importing.value = false;
  }
  const importFileInput = ref(null);
  function triggerFileDialog(evt) {
    if (evt && (evt.altKey || evt.metaKey)) {
      openImportModal();
      return;
    }
    try {
      importFileInput.value && importFileInput.value.click();
    } catch {
      openImportModal();
    }
  }
  function applyImportedThemes(sanitized) {
    if (!Array.isArray(sanitized) || !sanitized.length) return false;
    const current = customThemes.value.slice();
    for (const entry of sanitized) {
      const existing = current.find((t) => t.name === entry.name);
      if (existing) {
        if (importMode.value === 'overwrite') {
          existing.css = entry.css;
          existing.updatedAt = Date.now();
        } else if (importMode.value === 'duplicate') {
          let base = entry.name;
          let c = 1;
          let newName = base + ' ' + c;
          while (current.some((t) => t.name === newName)) {
            c++;
            newName = base + ' ' + c;
          }
          current.push({ name: newName, css: entry.css, updatedAt: Date.now() });
        }
      } else {
        current.push({ name: entry.name, css: entry.css, updatedAt: Date.now() });
      }
    }
    saveCustomThemes(current);
    persistCustomThemesServer();
    return true;
  }
  function onImportFileChange(e) {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        return;
      }
      if (!/\.json$/i.test(file.name)) {
        pushToast({ type: 'error', message: t('importFileType') || 'Not a JSON file' });
        return;
      }
      if (file.size > 200 * 1024) {
        pushToast({
          type: 'error',
          message: t('importFileTooLarge') || 'File too large (200KB max)',
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          let raw = String(reader.result || '')
            .trim()
            .replace(/^[\uFEFF\u200B]+/, '')
            .replace(/,\s*([}\]])/g, '$1');
          if (!raw) {
            pushToast({
              type: 'error',
              message: t('importFail') || 'Import failed (invalid JSON)',
            });
            return;
          }
          if (/^\{[\s\S]*\}$/.test(raw)) raw = '[' + raw + ']';
          const arr = JSON.parse(raw);
          const sanitized = validateImportArray(arr);
          if (!sanitized) throw new Error('invalid');
          if (applyImportedThemes(sanitized)) {
            pushToast({ type: 'success', message: t('importSuccess') || 'Import completed' });
          }
        } catch {
          pushToast({ type: 'error', message: t('importFail') || 'Import failed (invalid JSON)' });
        } finally {
          try {
            e.target.value = '';
          } catch {}
        }
      };
      reader.onerror = () => {
        pushToast({ type: 'error', message: t('importFail') || 'Import failed (invalid JSON)' });
      };
      reader.readAsText(file);
    } catch {
      /* ignore */
    }
  }
  function performImport() {
    if (!importText.value || !importText.value.trim()) {
      return;
    }
    importing.value = true;
    try {
      let raw = importText.value.trim();
      raw = raw.replace(/^[\uFEFF\u200B]+/, '');
      raw = raw.replace(/,\s*([}\]])/g, '$1');
      if (/^\{[\s\S]*\}$/.test(raw)) raw = '[' + raw + ']';
      const arr = JSON.parse(raw);
      const sanitized = validateImportArray(arr);
      if (!sanitized) throw new Error('invalid');
      if (applyImportedThemes(sanitized)) {
        pushToast({ type: 'success', message: t('importSuccess') || 'Import completed' });
        setTimeout(() => {
          showImport.value = false;
        }, 350);
      }
    } catch {
      pushToast({ type: 'error', message: t('importFail') || 'Import failed (invalid JSON)' });
    } finally {
      importing.value = false;
    }
  }
  function validateImportArray(arr) {
    if (!Array.isArray(arr)) return null;
    if (arr.length > 200) {
      pushToast({ type: 'error', message: t('importTooMany') || 'Too many themes (max 200)' });
      return null;
    }
    const out = [];
    const nameSet = new Set();
    for (const raw of arr) {
      if (!raw || typeof raw.name !== 'string' || typeof raw.css !== 'string') continue;
      const name = raw.name.trim();
      if (!name) continue;
      if (name.length > 100) {
        pushToast({ type: 'warn', message: t('importNameTooLong') || 'Name too long skipped' });
        continue;
      }
      const css = (raw.css || '').slice(0, 50000);
      if (!css) {
        continue;
      }
      if (nameSet.has(name)) continue;
      nameSet.add(name);
      out.push({ name, css });
    }
    if (!out.length) {
      pushToast({ type: 'error', message: t('importNoValid') || 'No valid entries' });
      return null;
    }
    return out;
  }
  function handleImportDrop(e) {
    dragOver.value = false;
    const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (!files.length) return;
    const file = files[0];
    droppedFileName.value = file.name;
    if (!/\.json$/i.test(file.name)) {
      pushToast({ type: 'error', message: t('importFileType') || 'Not a JSON file' });
      return;
    }
    const sizeLimit = 200 * 1024;
    if (file.size > sizeLimit) {
      pushToast({
        type: 'error',
        message: t('importFileTooLarge') || 'File too large (200KB max)',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      importText.value = String(reader.result || '');
    };
    reader.onerror = () => {
      pushToast({ type: 'error', message: t('importFail') || 'Import failed (invalid JSON)' });
    };
    reader.readAsText(file);
  }
  function openDiffModal() {
    diffA.value = 0;
    diffB.value = Math.min(1, allThemes.value.length - 1);
    computeDiff();
    showDiff.value = true;
  }
  function closeDiff() {
    showDiff.value = false;
    diffLines.value = [];
  }
  function computeDiff() {
    if (diffA.value === diffB.value) {
      diffLines.value = [];
      return;
    }
    const left = allThemes.value[diffA.value]?.css || '';
    const right = allThemes.value[diffB.value]?.css || '';
    diffLines.value = computeLineDiff(left, right);
  }
  async function clearTheme() {
    try {
      currentCSS.value = '';
      hasUserInteracted = true;
      try {
        localStorage.removeItem('chatLiveThemeCSS');
      } catch {}
      const chatConfig = await api
        .get('/api/chat-config')
        .then((r) => r.data)
        .catch(() => null);
      if (chatConfig && chatConfig.chatUrl) {
        await api.post('/api/chat', { chatUrl: chatConfig.chatUrl, themeCSS: '' });
      }
      pushToast({ type: 'success', message: t('chatThemeCleared') || 'Theme cleared' });
    } catch {
      pushToast({ type: 'error', message: t('chatThemeClearError') || 'Could not clear theme' });
    }
  }
  function copyCSS() {
    try {
      const css = currentCSS.value;
      if (!css) return;
      navigator.clipboard
        .writeText(css)
        .then(() => {
          pushToast({
            type: 'success',
            message: t('chatThemeCopySuccess') || 'CSS copiado al portapapeles',
          });
        })
        .catch(() => {
          const ta = document.createElement('textarea');
          ta.value = css;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          pushToast({
            type: 'success',
            message: t('chatThemeCopySuccess') || 'CSS copiado al portapapeles',
          });
        });
    } catch {
      /* ignore */
    }
  }
  function onVariantDuplicateToggle() {
    if (variantMode.value === 'overwrite') {
      variantMode.value = variantModeDuplicate.value ? 'duplicate' : 'overwrite';
    }
  }
  async function persistCustomThemesServer() {
    try {
      const payload = customThemes.value.map((t) => ({
        name: t.name,
        css: t.css,
        updatedAt: t.updatedAt || Date.now(),
      }));
      await api.post('/api/chat-custom-themes', { themes: payload });
    } catch {
      /* ignore */
    }
  }

  const state = {
    selectId,
    previewId,
    selectedIdx,
    cssPanelOpen,
    customizing,
    customWorkingName,
    customWorkingCSS,
    previewLight,
    orderMode,
    searchTerm,
    showDiff,
    diffA,
    diffB,
    diffLines,
    showExport,
    showImport,
    exportText,
    importText,
    copiedExport,
    importing,
    importMode,
    importPlaceholder,
    dragOver,
    droppedFileName,
    fontSizes,
    creatingVariant,
    showVariantModal,
    variantName,
    variantMode,
    variantModeDuplicate,
    customThemes,
    allThemes,
    isCustomSelected,
    currentCSS,
    cssRuleCount,
    hasSizeBlock,
    recentlyUpdated,
    filteredDefaults,
    filteredCustoms,
    resetSizes,
    openSizeVariantModal,
    saveVariantConfirmed,
    onSelectChange,
    beginCustomize,
    cancelCustomize,
    saveCustomizedTheme,
    deleteCustom,
    duplicateCurrentTheme,
    togglePreviewBg,
    revertSizes,
    openExportModal,
    closeExport,
    copyExport,
    downloadExport,
    openImportModal,
    closeImport,
    performImport,
    handleImportDrop,
    importFileInput,
    triggerFileDialog,
    onImportFileChange,
    openDiffModal,
    closeDiff,
    computeDiff,
    clearTheme,
    copyCSS,
    onVariantDuplicateToggle,
  };
  return state;
}
