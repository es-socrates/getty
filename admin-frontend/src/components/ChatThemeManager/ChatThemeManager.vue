<template>
  <div class="chat-theme-manager">
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
          <select v-model="orderMode" class="select w-32">
            <option value="recent">
              {{ t('themeOrderRecent') || 'Recent' }}
            </option>
            <option value="alpha">{{ t('themeOrderAlpha') || 'A→Z' }}</option>
          </select>
          <select
            :id="selectId"
            class="select"
            v-model.number="selectedIdx"
            @change="onSelectChange"
            :aria-describedby="previewId">
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
            {{ t('diffThemes') || 'Diff' }}
          </button>
        </div>
        <div class="mt-4" :id="previewId" aria-live="polite">
          <div class="flex items-center justify-between mb-2 gap-3">
            <h4 class="text-sm font-semibold">
              {{ t('chatThemePreview') || 'Live preview' }}
            </h4>
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

    <OsCard class="mt-4" aria-labelledby="chat-theme-css-heading">
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

    <OsCard class="mt-4" aria-labelledby="chat-theme-custom-heading">
      <h3 id="chat-theme-custom-heading" class="os-card-title mb-3">
        {{ t('chatThemeCustomize') || 'Custom builder:' }}
      </h3>
      <div class="flex flex-wrap gap-2 mb-4">
        <button type="button" class="btn" @click="beginCustomize">
          {{
            customizing
              ? t('chatThemeEditing') || 'Editing…'
              : t('chatThemeEdit') || 'Create/Edit theme'
          }}
        </button>
        <button type="button" class="btn" @click="clearTheme">
          {{ t('chatThemeClear') || 'Clear theme' }}
        </button>
        <button type="button" class="btn" @click="openSizeVariantModal" :disabled="creatingVariant">
          {{ t('saveSizeVariant') || 'Save size variant' }}
        </button>
        <button type="button" class="btn" @click="revertSizes" :disabled="!hasSizeBlock">
          {{ t('revertSizes') || 'Revert sizes' }}
        </button>
        <button type="button" class="btn" @click="openExportModal" :disabled="!customThemes.length">
          {{ t('exportThemes') || 'Export' }}
        </button>
        <button type="button" class="btn" @click="triggerFileDialog($event)" @mousedown.prevent>
          {{ t('importThemes') || 'Import' }}
        </button>
        <input
          ref="importFileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onImportFileChange" />
        <button
          v-if="customizing"
          type="button"
          class="btn primary"
          @click="saveCustomizedTheme"
          :disabled="!customWorkingName || !customWorkingCSS">
          {{ t('chatThemeSave') || 'Save theme' }}
        </button>
        <button v-if="customizing" type="button" class="btn" @click="cancelCustomize">
          {{ t('chatThemeCancel') || 'Cancel' }}
        </button>
      </div>

      <div v-if="customizing" class="space-y-4">
        <div class="form-group">
          <label for="chat-theme-working-name">{{
            t('chatThemeNamePlaceholder') || 'Theme name'
          }}</label>
          <input
            id="chat-theme-working-name"
            class="input"
            v-model="customWorkingName"
            type="text" />
        </div>
        <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div class="flex flex-col">
            <label class="text-xs font-medium mb-1" for="sz-username">{{
              t('chatFontUsername') || 'Username px'
            }}</label>
            <input
              id="sz-username"
              type="number"
              min="8"
              max="60"
              class="input"
              v-model.number="fontSizes.username" />
            <span v-if="fontSizes.username >= 60" class="text-[10px] text-amber-500 mt-0.5"
              >max</span
            >
          </div>
          <div class="flex flex-col">
            <label class="text-xs font-medium mb-1" for="sz-message">{{
              t('chatFontMessage') || 'Message px'
            }}</label>
            <input
              id="sz-message"
              type="number"
              min="8"
              max="60"
              class="input"
              v-model.number="fontSizes.message" />
            <span v-if="fontSizes.message >= 60" class="text-[10px] text-amber-500 mt-0.5"
              >max</span
            >
          </div>
          <div class="flex flex-col">
            <label class="text-xs font-medium mb-1" for="sz-donation">{{
              t('chatFontDonation') || 'Donation px'
            }}</label>
            <input
              id="sz-donation"
              type="number"
              min="8"
              max="60"
              class="input"
              v-model.number="fontSizes.donation" />
            <span v-if="fontSizes.donation >= 60" class="text-[10px] text-amber-500 mt-0.5"
              >max</span
            >
          </div>
          <div class="flex flex-col">
            <label class="text-xs font-medium mb-1" for="sz-avatar">{{
              t('chatAvatarSize') || 'Avatar px'
            }}</label>
            <input
              id="sz-avatar"
              type="number"
              min="16"
              max="60"
              class="input"
              v-model.number="fontSizes.avatar" />
            <span v-if="fontSizes.avatar >= 60" class="text-[10px] text-amber-500 mt-0.5">max</span>
          </div>
          <div class="flex items-end gap-2">
            <button type="button" class="btn" @click="resetSizes">
              {{ t('reset') || 'Reset' }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="chat-theme-working-css">{{
            t('chatThemeCSSPlaceholder') || 'Theme CSS'
          }}</label>
          <textarea
            id="chat-theme-working-css"
            class="textarea w-full font-mono resize-y"
            v-model="customWorkingCSS"
            rows="10"></textarea>
        </div>
      </div>
    </OsCard>

    <teleport to="body">
      <div
        v-if="showVariantModal"
        class="modal-overlay ctm"
        role="dialog"
        aria-modal="true"
        @click.self="!creatingVariant && (showVariantModal = false)">
        <div class="modal-card max-w-[420px]">
          <div class="modal-title text-sm font-semibold">
            {{ t('saveSizeVariant') || 'Save size variant' }}
          </div>
          <div class="modal-body flex flex-col gap-3">
            <label class="text-xs font-medium" for="variant-name">{{
              t('chatThemeNamePlaceholder') || 'Theme name'
            }}</label>
            <input
              id="variant-name"
              class="input"
              v-model="variantName"
              :disabled="creatingVariant" />
            <div class="text-xs opacity-70" v-if="variantMode === 'overwrite'">
              {{
                t('chatThemeOverwriteHint') ||
                'A theme with this name exists. Saving will overwrite it.'
              }}
            </div>
            <div class="text-xs opacity-70" v-else>
              {{ t('chatThemeNewHint') || 'This will create a new theme.' }}
            </div>
            <div v-if="variantMode === 'overwrite'" class="flex items-center gap-2 mt-2">
              <label class="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="variantModeDuplicate"
                  @change="onVariantDuplicateToggle" />
                <span>{{ t('duplicateInstead') || 'Duplicate instead of overwrite' }}</span>
              </label>
            </div>
          </div>
          <div class="modal-actions flex gap-2 mt-4">
            <button
              type="button"
              class="btn"
              :disabled="creatingVariant"
              @click="showVariantModal = false">
              {{ t('commonClose') || 'Close' }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="creatingVariant || !variantName.trim()"
              @click="saveVariantConfirmed">
              {{
                creatingVariant
                  ? t('commonSaving') || 'Saving…'
                  : variantMode === 'overwrite' && !variantModeDuplicate
                  ? t('chatThemeOverwrite') || 'Overwrite'
                  : t('chatThemeSave') || 'Save'
              }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="showExport"
        class="modal-overlay ctm"
        role="dialog"
        aria-modal="true"
        @click.self="closeExport">
        <div class="modal-card max-w-[780px]">
          <div class="modal-title text-sm font-semibold flex items-center justify-between">
            <span>{{ t('exportModalTitle') || 'Export themes JSON' }}</span>
            <button class="btn btn-xs" @click="closeExport">✕</button>
          </div>
          <p class="text-xs opacity-70 mb-2">
            {{
              t('exportModalHint') ||
              'Copy and save this JSON to back up or share your custom themes.'
            }}
          </p>
          <textarea
            class="textarea w-full font-mono"
            rows="12"
            readonly
            :value="exportText"></textarea>
          <div class="modal-actions flex gap-2 mt-3">
            <button class="btn" @click="copyExport" :disabled="copiedExport">
              {{ copiedExport ? t('exportCopied') || 'Copied!' : t('exportCopy') || 'Copy JSON' }}
            </button>
            <button class="btn" @click="downloadExport">
              {{ t('exportDownload') || 'Download JSON' }}
            </button>
            <button class="btn" @click="closeExport">
              {{ t('commonClose') || 'Close' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="showImport"
        class="modal-overlay ctm"
        role="dialog"
        aria-modal="true"
        @click.self="closeImport">
        <div class="modal-card max-w-[780px]">
          <div class="modal-title text-sm font-semibold flex items-center justify-between">
            <span>{{ t('importModalTitle') || 'Import themes JSON' }}</span>
            <button class="btn btn-xs" @click="closeImport">✕</button>
          </div>
          <p class="text-xs opacity-70 mb-2">
            {{
              t('importModalHint') ||
              'Paste JSON exported from another instance. Choose conflict strategy.'
            }}
          </p>
          <div class="flex flex-wrap gap-4 mb-2 text-xs">
            <label class="inline-flex items-center gap-1"
              ><input type="radio" value="overwrite" v-model="importMode" />
              {{ t('importModeOverwrite') || 'Overwrite' }}
            </label>
            <label class="inline-flex items-center gap-1"
              ><input type="radio" value="skip" v-model="importMode" />
              {{ t('importModeSkip') || 'Skip' }}
            </label>
            <label class="inline-flex items-center gap-1"
              ><input type="radio" value="duplicate" v-model="importMode" />
              {{ t('importModeDuplicate') || 'Duplicate' }}
            </label>
          </div>
          <div
            class="import-drop"
            :class="{ over: dragOver }"
            @dragover.prevent
            @dragenter.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleImportDrop">
            <span class="text-xs" v-if="!droppedFileName">{{
              t('importDropHint') || 'Drag & drop a .json file here'
            }}</span>
            <span class="text-xs" v-else>{{ droppedFileName }}</span>
          </div>
          <textarea
            class="textarea w-full font-mono"
            rows="12"
            v-model="importText"
            :placeholder="importPlaceholder"></textarea>
          <div class="modal-actions flex gap-2 mt-3">
            <button class="btn" @click="performImport" :disabled="importing">
              {{ importing ? t('commonSaving') || 'Saving...' : t('importApply') || 'Import' }}
            </button>
            <button class="btn" @click="closeImport">
              {{ t('commonClose') || 'Close' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="showDiff"
        class="modal-overlay ctm"
        role="dialog"
        aria-modal="true"
        @click.self="closeDiff">
        <div class="modal-card max-w-[960px]">
          <div class="modal-title text-sm font-semibold flex items-center justify-between">
            <span>{{ t('diffModalTitle') || 'Compare themes (Diff)' }}</span>
            <button class="btn btn-xs" @click="closeDiff">✕</button>
          </div>
          <div class="flex flex-wrap gap-2 mb-3">
            <select v-model.number="diffA" class="select">
              <option v-for="(th, i) in allThemes" :key="'da_' + i" :value="i">
                A: {{ th.name }}
              </option>
            </select>
            <select v-model.number="diffB" class="select">
              <option v-for="(th, i) in allThemes" :key="'db_' + i" :value="i">
                B: {{ th.name }}
              </option>
            </select>
            <button class="btn" @click="computeDiff">
              {{ t('commonPreview') || 'Preview' }}
            </button>
          </div>
          <div v-if="diffLines.length" class="diff-container">
            <div class="diff-lines">
              <div
                v-for="(l, idx) in diffLines"
                :key="idx"
                :class="['diff-line', 'type-' + l.type]">
                <span class="diff-gutter">{{
                  l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '
                }}</span>
                <pre class="diff-code" v-text="l.text"></pre>
              </div>
            </div>
          </div>
          <div v-else class="text-xs opacity-70">
            {{ t('diffNoChanges') || 'No differences / select themes' }}
          </div>
          <div class="modal-actions flex gap-2 mt-4">
            <button type="button" class="btn" @click="closeDiff">
              {{ t('commonClose') || 'Close' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { createChatThemeManager } from './ChatThemeManager.script.js';
import OsCard from '../os/OsCard.vue';

const { t } = useI18n();
const state = createChatThemeManager(t);

const {
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
  closeImport,
  performImport,
  handleImportDrop,
  openDiffModal,
  closeDiff,
  computeDiff,
  clearTheme,
  copyCSS,
  onVariantDuplicateToggle,
  importFileInput,
  triggerFileDialog,
  onImportFileChange,
} = state;

const copiedCss = ref(false);
function handleCopyCSS() {
  copyCSS();
  copiedCss.value = true;
  setTimeout(() => {
    copiedCss.value = false;
  }, 1500);
}
</script>
<style scoped src="./ChatThemeManager.css"></style>
