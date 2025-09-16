<template>
  <OsCard class="mt-4 chat-theme-css-panel" aria-labelledby="chat-theme-css-heading">
    <details :open="cssPanelOpen" @toggle="cssPanelOpen = $event.target.open">
      <summary class="cursor-pointer select-none flex items-center justify-between pr-2">
        <h3 id="chat-theme-css-heading" class="os-card-title m-0 flex items-center gap-2 text-sm">
          <span>{{ t('chatThemeCopyLabel') || 'Theme CSS for OBS:' }}</span>
          <span class="badge-updated !bg-indigo-600" v-if="cssPanelOpen">{{
            t('commonHide') || 'Hide'
          }}</span>
          <span class="badge-updated !bg-slate-500" v-else>{{ t('commonShow') || 'Show' }}</span>
        </h3>
        <div class="relative inline-flex items-center">
          <button
            type="button"
            class="btn btn-xs badge-updated !bg-slate-500 badge-btn"
            @click.prevent="handleCopyCSS"
            :aria-label="t('chatThemeCopyBtn') || 'Copy CSS'">
            {{ copiedCss ? t('exportCopied') || 'Copied!' : t('chatThemeCopyBtn') || 'Copy CSS' }}
          </button>
          <span v-if="copiedCss" class="copy-tooltip" role="status">{{
            t('exportCopied') || 'Copied!'
          }}</span>
        </div>
      </summary>
      <div class="mt-3">
        <textarea
          id="chat-theme-css-copy"
          class="textarea mt-1 w-full font-mono resize-y"
          readonly
          rows="10"
          :value="currentCSS"></textarea>
      </div>
    </details>
  </OsCard>
</template>
<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { createChatThemeManager } from './ChatThemeManager.script.js';
import OsCard from '../os/OsCard.vue';

const { t } = useI18n();
const state = createChatThemeManager(t);
const { cssPanelOpen, currentCSS, copyCSS } = state;
const copiedCss = ref(false);
function handleCopyCSS() {
  copyCSS();
  copiedCss.value = true;
  setTimeout(() => (copiedCss.value = false), 1500);
}
</script>
<style scoped>
summary:focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}
</style>
