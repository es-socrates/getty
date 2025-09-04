<template>
  <OsCard class="mt-4" aria-labelledby="chat-theme-heading">
    <h3 id="chat-theme-heading" class="os-card-title mb-3">{{ t('chatThemeLabel') || 'Chat theme:' }}</h3>
    <div v-if="allThemes.length" class="form-group">
      <div class="flex flex-wrap items-center gap-3">
        <label class="label mb-0" :for="selectId">{{ t('chatThemeSelect') || 'Select theme' }}</label>
        <select :id="selectId" class="select" v-model.number="selectedIdx" @change="onSelectChange" :aria-describedby="previewId">
          <option v-for="(th, i) in allThemes" :key="th.name + '_' + i" :value="i">{{ th.name }}</option>
        </select>
        <div class="flex gap-2 flex-wrap">
          <button type="button" class="btn" @click="openEditor(false)">{{ t('chatThemeEdit') || 'Create/Edit theme' }}</button>
          <button v-if="isCustomSelected" type="button" class="btn danger" @click="deleteCustom">
            {{ t('chatThemeDelete') || 'Delete theme' }}
          </button>
          <button type="button" class="btn" @click="clearTheme">
            {{ t('chatThemeClear') || 'Clear theme' }}
          </button>
          <button type="button" class="btn" @click="copyCSS">{{ t('chatThemeCopyBtn') || 'Copy CSS' }}</button>
        </div>
      </div>
  <div class="mt-4" :id="previewId" aria-live="polite">
        <h4 class="text-sm font-semibold mb-2">{{ t('chatThemePreview') || 'Live preview' }}</h4>
        <div class="chat-theme-preview os-surface p-3 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)]">
          <div class="message">
            <span class="message-username cyberpunk">User 1</span>
            <span class="message-text-inline">Hello world from the chat</span>
          </div>
          <div class="message odd">
            <span class="message-username cyberpunk">User 2</span>
            <span class="message-text-inline">Alternate message with different background</span>
          </div>
          <div class="message has-donation">
            <span class="message-username cyberpunk">Donor</span>
            <span class="message-text-inline">Thank you for your support!</span>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <label class="text-sm font-medium" for="chat-theme-css-copy">{{ t('chatThemeCopyLabel') || 'Theme CSS for OBS:' }}</label>
        <textarea id="chat-theme-css-copy" class="textarea mt-1 w-full" readonly rows="10" :value="currentCSS" style="font-family:monospace; resize:vertical;"></textarea>
      </div>
    </div>
  <div v-if="editor.open" class="mt-6 os-surface p-4 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)]" aria-labelledby="chat-theme-editor-heading">
      <h4 id="chat-theme-editor-heading" class="mb-3 text-sm font-semibold uppercase tracking-wide">
        {{ editingExisting ? (t('chatThemeEdit') || 'Edit theme') : (t('chatThemeEdit') || 'Create/Edit theme') }}
      </h4>
      <div class="form-group">
        <label for="chat-theme-name">{{ t('chatThemeNamePlaceholder') || 'Theme name' }}</label>
        <input id="chat-theme-name" class="input" v-model="editor.name" type="text" :placeholder="t('chatThemeNamePlaceholder') || 'Theme name'" />
      </div>
      <div class="form-group">
        <label for="chat-theme-css">{{ t('chatThemeCSSPlaceholder') || 'Theme CSS' }}</label>
        <textarea id="chat-theme-css" class="textarea w-full" v-model="editor.css" rows="10" :placeholder="t('chatThemeCSSPlaceholder') || 'Theme CSS'" style="font-family:monospace; resize:vertical;"></textarea>
      </div>
      <div class="flex gap-2 flex-wrap mt-2">
        <button type="button" class="btn" @click="saveTheme" :disabled="!editor.name || !editor.css">{{ t('chatThemeSave') || 'Save theme' }}</button>
        <button type="button" class="btn" @click="cancelEditor">{{ t('chatThemeCancel') || 'Cancel' }}</button>
      </div>
    </div>
  </OsCard>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { pushToast } from '../services/toast';
import OsCard from './os/OsCard.vue';

const { t } = useI18n();

const defaultThemes = [
  {
    name: 'getty',
  css: `:root { --bg-main: #080c10; --bg-message: #0a0e12; --bg-message-alt: #0a0e12; --border: #161b22; --text: #e6edf3; --username: #fff; --donation: #ddb826; --donation-bg: #ececec; }
  .message { background: #0a0e12 !important; border-radius: 4px; padding: 12px; margin-bottom: 6px; box-sizing: border-box; color: #fff !important; }
  .message.odd { background: #0a0e12 !important; }
  .message-username.cyberpunk { color: #fff; font-weight: 600; }
  .message-text-inline { color: #fff !important; font-weight: 600; }
  .message.has-donation { background: #ececec !important; }
  .message.has-donation .message-username { color: #111 !important; }
  .message.has-donation .message-text-inline { color: #111 !important; }
  .message-donation { background: #ddb826 !important; color: #111 !important; }`
  },
  {
    name: 'X',
  css: `:root { --bg-main: #f7f7f7; --bg-message: #f7f7f7; --bg-message-alt: #f7f7f7; --border: #3b5aff; --text: #111; --username: #111; --donation: #f7f7f7; --donation-bg: #3b5aff; }
  .message { background: #f7f7f7 !important; border-radius: 6px; padding: 12px; margin-bottom: 6px; box-sizing: border-box; border-left: 6px solid #3b5aff !important; color: #111 !important; }
  .message.odd { background: #f7f7f7 !important; }
  .message-username.cyberpunk { color: #111; font-weight: 600; }
  .message-text-inline { color: #111 !important; font-weight: 600; }
  .message.has-donation { background: #3b5aff !important; }
  .message.has-donation .message-username { color: #fff !important; }
  .message.has-donation .message-text-inline { color: #fff !important; }
  .message-donation { background: #f7f7f7 !important; color: #111 !important; }`
  },
  {
    name: 'Twitch',
  css: `:root { --bg-main: #18181b; --bg-message: #111; --bg-message-alt: #111; --border: #9147ff; --text: #fff; --username: #a970ff; --donation: #f7f7f7; --donation-bg: #9147ff; }
  .message { background: #111 !important; border-radius: 8px; padding: 10px 16px; margin-bottom: 6px; border-left: 6px solid #9147ff; box-shadow: 0 2px 8px rgba(0,0,0,0.08); color: #fff !important; }
  .message.odd { background: #111 !important; }
  .message-username.cyberpunk { color: #a970ff; text-shadow: 0 0 4px #9147ff; }
  .message-text-inline { color: #fff !important; }
  .message.has-donation { background: #9147ff !important; }
  .message.has-donation .message-username { color: #fff !important; }
  .message.has-donation .message-text-inline { color: #fff !important; }
  .message-donation { background: #f7f7f7 !important; color: #111 !important; }`
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
  .message-donation { background: #ffb44e !important; color: #111 !important; }`
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
  .message-donation { background: #f7f7f7 !important; color: #111 !important; }`
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
    @keyframes fadeOut { to { opacity: 0; transform: translateY(-6px); } }`
  }
];

const selectId = 'chat-theme-select';
const previewId = 'chat-theme-preview-section';
const selectedIdx = ref(0);
const editor = reactive({ open: false, name: '', css: '' });
const editingExisting = ref(false);

function getCustomThemes() {
  try { return JSON.parse(localStorage.getItem('chatCustomThemes') || '[]'); } catch { return []; }
}
function saveCustomThemes(themes) {
  localStorage.setItem('chatCustomThemes', JSON.stringify(themes));
}

const allThemes = computed(() => [...defaultThemes, ...getCustomThemes()]);
const isCustomSelected = computed(() => selectedIdx.value >= defaultThemes.length);
const currentTheme = computed(() => allThemes.value[selectedIdx.value] || allThemes.value[0] || { css: '', name: '' });
const currentCSS = ref('');

let hasUserInteracted = false;
let cssSource = 'fallback';

const previewCSS = computed(() => (editor.open ? (editor.css || '') : (currentCSS.value || '')));
const PREVIEW_STYLE_ID = 'chat-theme-preview-style';
function updatePreviewStyle(css) {
  try {
    let el = document.getElementById(PREVIEW_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = PREVIEW_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css || '';
  } catch { /* ignore */ }
}

watch(selectedIdx, () => {
  currentCSS.value = currentTheme.value.css || '';
  if (hasUserInteracted) {
    persistLiveTheme();
    debouncedPersistThemeCSS();
  }
  updatePreviewStyle(previewCSS.value);
});

onMounted(async () => {
  try {
    const stored = localStorage.getItem('chatLiveThemeCSS');
    if (stored && typeof stored === 'string' && stored.trim()) {
      currentCSS.value = stored;
      cssSource = 'local';
    } else {
      const chatConfig = await fetch('/api/chat-config').then(r => r.json()).catch(() => null);
      if (chatConfig && chatConfig.themeCSS) {
        currentCSS.value = chatConfig.themeCSS;
        cssSource = 'server';
      } else {
        currentCSS.value = currentTheme.value.css || '';
        cssSource = 'fallback';
      }
    }

    if (cssSource !== 'fallback') persistLiveThemeLocalOnly();
  } catch { /* ignore */ }
  updatePreviewStyle(previewCSS.value);
});
onUnmounted(() => {
  try {
    const el = document.getElementById(PREVIEW_STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch { /* ignore */ }
});
watch(previewCSS, css => { updatePreviewStyle(css); });

function persistLiveTheme() {
  if (!currentCSS.value) return;
  localStorage.setItem('chatLiveThemeCSS', currentCSS.value);
}
function persistLiveThemeLocalOnly() {
  try { if (currentCSS.value) localStorage.setItem('chatLiveThemeCSS', currentCSS.value); } catch {}
}
let persistTimer = null;
function debouncedPersistThemeCSS() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const chatConfig = await fetch('/api/chat-config').then(r => r.json()).catch(() => null);
  if (chatConfig && chatConfig.chatUrl && currentCSS.value) {
        await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatUrl: chatConfig.chatUrl, themeCSS: currentCSS.value }) });
      }
    } catch { /* ignore */ }
  }, 600);
}
function onSelectChange() { hasUserInteracted = true; persistLiveTheme(); debouncedPersistThemeCSS(); }

function openEditor(editExisting) {
  editingExisting.value = !!editExisting && isCustomSelected.value;
  editor.name = currentTheme.value.name || '';
  editor.css = currentTheme.value.css || '';
  editor.open = true;
}
function cancelEditor() { editor.open = false; editor.name = ''; editor.css = ''; }
function saveTheme() {
  if (!editor.name || !editor.css) return;
  const custom = getCustomThemes();
  if (custom.some(t => t.name === editor.name)) {
    const alt = editor.name + ' copy';
    custom.push({ name: alt, css: editor.css });
  } else {
    custom.push({ name: editor.name, css: editor.css });
  }
  saveCustomThemes(custom);
  editor.open = false;
  selectedIdx.value = allThemes.value.length - 1;
  hasUserInteracted = true;
  persistLiveTheme();
  debouncedPersistThemeCSS();
}
function deleteCustom() {
  if (!isCustomSelected.value) {
    pushToast({ type: 'error', message: t('chatThemeDeleteOnlyCustom') || 'Only custom themes can be deleted.' });
    return;
  }
  if (!confirm(t('chatThemeDelete') || 'Delete theme?')) return;
  const custom = getCustomThemes();
  const customIdx = selectedIdx.value - defaultThemes.length;
  if (customIdx >= 0) {
    custom.splice(customIdx, 1);
    saveCustomThemes(custom);
    selectedIdx.value = 0;
  hasUserInteracted = true;
  persistLiveTheme();
  debouncedPersistThemeCSS();
  }
}
async function clearTheme() {
  try {
    currentCSS.value = '';
    hasUserInteracted = true;
    try { localStorage.removeItem('chatLiveThemeCSS'); } catch {}
    const chatConfig = await fetch('/api/chat-config').then(r => r.json()).catch(() => null);
    if (chatConfig && chatConfig.chatUrl) {
      await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatUrl: chatConfig.chatUrl, themeCSS: '' }) });
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
    navigator.clipboard.writeText(css)
      .then(() => {
        pushToast({ type: 'success', message: t('chatThemeCopySuccess') || 'CSS copiado al portapapeles' });
      })
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = css; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        pushToast({ type: 'success', message: t('chatThemeCopySuccess') || 'CSS copiado al portapapeles' });
      });
  } catch { /* ignore */ }
}

</script>

<style scoped>
.chat-theme-preview { font-size: 14px; line-height: 1.35; }
.chat-theme-preview .message { font-family: 'Inter', system-ui, sans-serif; }
.chat-theme-preview .message-username { margin-right: 0.5rem; }
</style>
