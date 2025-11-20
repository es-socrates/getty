<template>
  <div class="chat-theme-selector">
    <!-- Theme selection + preview -->
    <OsCard class="mt-4" aria-labelledby="chat-theme-heading">
      <h3 id="chat-theme-heading" class="os-card-title mb-3 flex items-center gap-3">
        <span>{{ t('chatThemeLabel') || 'Chat theme:' }}</span>
        <span v-if="recentlyUpdated" class="badge-updated">{{
          t('updatedBadge') || 'Updated'
        }}</span>
      </h3>
      <div v-if="allThemes.length" class="form-group">
        <div class="flex flex-wrap items-center gap-3">
          <label class="label mb-0" :for="selectId">{{
            t('chatThemeSelect') || 'Select theme'
          }}</label>
          <input
            :placeholder="t('themeSearchPlaceholder') || 'Search'"
            v-model="searchTerm"
            class="input w-40 min-w-[140px]" />
          <select
            v-model="orderMode"
            class="select w-32"
            :aria-label="t('themeOrderMode') || 'Order mode'">
            <option value="recent">{{ t('themeOrderRecent') || 'Recent' }}</option>
            <option value="alpha">{{ t('themeOrderAlpha') || 'A→Z' }}</option>
          </select>
          <select
            :id="selectId"
            class="select"
            v-model.number="selectedIdx"
            @change="onSelectChange"
            :aria-describedby="selectId + '-hint'">
            <optgroup :label="t('chatThemeDefaults') || 'Default themes'">
              <option v-for="d in filteredDefaults" :key="'def_' + d.i" :value="d.i">
                {{ d.theme.name }}
              </option>
            </optgroup>
            <optgroup
              v-if="filteredCustoms.length"
              :label="t('chatThemeCustom') || 'Custom themes'">
              <option v-for="c in filteredCustoms" :key="'cus_' + c.i" :value="c.i">
                ★ {{ c.theme.name }}
              </option>
            </optgroup>
          </select>
          <p class="text-[11px] opacity-70 w-full mt-1" :id="selectId + '-hint'">
            {{ t('chatThemeCustomHint') || 'Custom themes (★) are the ones you create or edit.' }}
          </p>
          <button v-if="isCustomSelected" type="button" class="btn" @click="duplicateCurrentTheme">
            {{ t('duplicateTheme') || 'Duplicate' }}
          </button>
          <button v-if="isCustomSelected" type="button" class="btn danger" @click="deleteCustom">
            {{ t('chatThemeDelete') || 'Delete theme' }}
          </button>
          <button type="button" class="btn" @click="openDiffModal" :disabled="allThemes.length < 2">
            {{ t('compareThemes') || t('diffThemes') || 'Compare' }}
          </button>
        </div>
        <div class="mt-4" :id="previewId" aria-live="polite">
          <div class="flex items-center justify-between mb-2 gap-3">
            <h4 class="text-sm font-semibold">{{ t('chatThemePreview') || 'Live preview' }}</h4>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-xs badge-updated !bg-slate-500 badge-btn"
                @click="togglePreviewBg">
                {{
                  previewLight
                    ? t('previewBgToggleDark') || 'Dark BG'
                    : t('previewBgToggleLight') || 'Light BG'
                }}
              </button>
              <span class="text-[11px] opacity-70 hidden sm:inline">{{
                (t('cssRulesCount') || 'Rules') + ': ' + cssRuleCount
              }}</span>
            </div>
          </div>
          <div
            class="chat-theme-preview os-surface p-3 rounded-os border border-[var(--card-border)] bg-[var(--bg-card)]"
            :class="{ 'preview-light': previewLight }">
            <div class="message">
              <span class="message-username cyberpunk">User 1</span
              ><span class="message-text-inline">Hello world from the chat</span>
            </div>
            <div class="message odd">
              <span class="message-username cyberpunk">User 2</span
              ><span class="message-text-inline">Alternate message with different background</span>
            </div>
            <div class="message has-donation">
              <span class="message-username cyberpunk">Donor</span
              ><span class="message-text-inline">Thank you for your support!</span>
            </div>
          </div>
        </div>
      </div>
    </OsCard>
  </div>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { createChatThemeManager } from './ChatThemeManager.script.js';
import OsCard from '../os/OsCard.vue';

const { t } = useI18n();
const state = createChatThemeManager(t);

const {
  selectId,
  previewId,
  selectedIdx,
  previewLight,
  orderMode,
  searchTerm,
  allThemes,
  isCustomSelected,
  cssRuleCount,
  recentlyUpdated,
  filteredDefaults,
  filteredCustoms,
  onSelectChange,
  deleteCustom,
  duplicateCurrentTheme,
  togglePreviewBg,
  openDiffModal,
} = state;
</script>
<style scoped>
.chat-theme-selector select:focus-visible {
  outline: none;
}
.dark .chat-theme-selector span[class*='text-[11px]'] {
  color: #ffffff !important;
  opacity: 1 !important;
}
</style>
