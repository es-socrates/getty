<template>
  <section class="admin-tab active chat-root" role="form" aria-labelledby="chat-config-heading">
    <h2 id="chat-config-heading" class="sr-only">
      {{ t('chatConfigHeading') || 'Chat configuration' }}
    </h2>
    <div class="chat-grid">
      <div class="chat-col chat-col-left">
        <div class="chat-group-box" aria-labelledby="chat-colors-heading">
          <h3 id="chat-colors-heading" class="chat-group-title flex items-center gap-2">
            <HeaderIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </HeaderIcon>
            <span>{{ t('colorCustomizationTitle') }}</span>
          </h3>
          <div class="form-group" aria-labelledby="chat-url-label" aria-live="polite">
            <label class="label" id="chat-url-label" for="chat-url">{{
              t('chatClaimId') || 'ClaimID of your livestream post'
            }}</label>
            <input
              class="input"
              :aria-invalid="!!errors.chatUrl"
              :class="{ 'input-error': errors.chatUrl }"
              id="chat-url"
              v-model="form.chatUrl"
              maxlength="40"
              type="text"
              :placeholder="claimPlaceholder" />
            <div class="flex gap-2 small justify-between mt-1">
              <small :class="errors.chatUrl ? 'text-red-700' : ''">{{
                errors.chatUrl || ' '
              }}</small>
              <small aria-live="polite" aria-atomic="true">{{
                t('charsUsed', { used: form.chatUrl.length, max: 40 })
              }}</small>
            </div>
          </div>
          <div class="chat-color-surface" aria-labelledby="general-colors-heading">
            <h4 id="general-colors-heading" class="chat-subtitle">
              {{ t('generalColors') || 'General' }}
            </h4>
            <div class="flex flex-wrap gap-2 items-end chat-general-colors">
              <ColorInput v-model="form.colors.bg" :label="t('colorBg')" />
              <ColorInput v-model="form.colors.msgBg" :label="t('colorMsgBg')" />
              <ColorInput v-model="form.colors.msgBgAlt" :label="t('colorMsgAltBg')" />
              <ColorInput v-model="form.colors.border" :label="t('colorMsgBorder')" />
              <ColorInput v-model="form.colors.text" :label="t('colorMsgText')" />
            </div>
          </div>
          <div class="chat-color-surface mb-0" aria-labelledby="donation-colors-heading">
            <h4 id="donation-colors-heading" class="chat-subtitle">
              {{ t('donationColors') || 'Donations' }}
            </h4>
            <div class="flex flex-wrap gap-2 items-end chat-donation-colors">
              <ColorInput v-model="form.colors.donation" :label="t('colorMsgDonation')" />
              <ColorInput v-model="form.colors.donationBg" :label="t('colorMsgDonationBg')" />
            </div>
          </div>
          <div class="chat-actions-row">
            <button
              class="btn"
              :disabled="saving"
              @click="save"
              :aria-busy="saving ? 'true' : 'false'">
              {{ saving ? t('commonSaving') : t('saveSettings') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-compact-secondary"
              @click="resetColors"
              :aria-label="t('resetColors')">
              {{ t('resetColors') }}
            </button>
          </div>
          <div class="chat-save-row">
            <div class="chat-status-row mt-3" aria-live="polite">
              <span class="chat-inline-badge">
                <span
                  class="inline-block w-2 h-2 rounded-full"
                  :class="connected ? 'bg-green-500' : 'bg-red-500'"></span>
                <span>{{
                  connected ? t('connected') || 'Connected' : t('disconnected') || 'Disconnected'
                }}</span>
              </span>
              <small class="opacity-70">{{
                lastStatusAt ? new Date(lastStatusAt).toLocaleTimeString() : ''
              }}</small>
            </div>
          </div>
        </div>
        <div class="chat-group-box" aria-labelledby="obs-heading">
          <h3 id="obs-heading" class="chat-group-title flex items-center gap-2">
            <HeaderIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </HeaderIcon>
            <span>{{ t('obsIntegration') }}</span>
          </h3>
          <div class="form-group">
            <label class="label mb-0">{{ t('chatWidgetUrl') }}</label>
            <CopyField :value="widgetUrl" />
          </div>
          <div class="form-group mt-2">
            <label class="label mb-0">{{
              t('chatWidgetUrlHorizontal') || 'Chat Widget URL (horizontal):'
            }}</label>
            <CopyField :value="widgetHorizontalUrl" />
          </div>
        </div>
      </div>
      <!-- Right Column -->
      <div class="chat-col chat-col-right">
        <div
          class="chat-group-box"
          aria-labelledby="username-heading"
          :aria-describedby="overrideUsername ? 'username-hint' : null">
          <h3 id="username-heading" class="chat-group-title flex items-center gap-2">
            <HeaderIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 6.5-6 8-6s6.5 2 8 6" />
              </svg>
            </HeaderIcon>
            <span>{{ t('usernameColors') || 'Username' }}</span>
          </h3>
          <div class="mb-2">
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                class="switch"
                @click="overrideUsername = !overrideUsername"
                :aria-pressed="overrideUsername ? 'true' : 'false'"
                tabindex="0"
                @keydown.enter="overrideUsername = !overrideUsername"
                @keydown.space.prevent="overrideUsername = !overrideUsername">
                <div class="knob"></div>
              </div>
              <span>{{ t('overrideUsername') || 'Override username colors' }}</span>
            </label>
            <small class="block opacity-70 mt-1" id="username-hint">{{
              t('toggleUsernameOverride') ||
              'Override username colors (otherwise the palette is used)'
            }}</small>
          </div>
          <div v-if="overrideUsername" class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <ColorInput v-model="form.colors.username" :label="t('colorMsgUsername')" />
            <ColorInput v-model="form.colors.usernameBg" :label="t('colorMsgUsernameBg')" />
            <div class="sm:col-span-2">
              <small class="opacity-70 text-xs">{{
                t('usernameOverrideOn') || 'These colors will replace the per-user palette.'
              }}</small>
            </div>
          </div>
          <div v-else>
            <small class="opacity-70 text-xs">{{
              t('usernameOverrideOff') ||
              'Using CYBERPUNK_PALETTE — each user gets a different color.'
            }}</small>
          </div>
          <div class="my-3 h-px bg-[var(--card-border)] opacity-60"></div>
          <div class="mb-3" :aria-describedby="transparentBg ? 'transparent-hint' : null">
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                class="switch"
                @click="transparentBg = !transparentBg"
                :aria-pressed="transparentBg ? 'true' : 'false'"
                tabindex="0"
                @keydown.enter="transparentBg = !transparentBg"
                @keydown.space.prevent="transparentBg = !transparentBg">
                <div class="knob"></div>
              </div>
              <span>{{ t('transparentBg') || 'Transparent background' }}</span>
            </label>
            <small id="transparent-hint" class="block opacity-60 text-xs mt-1">{{
              t('transparentBgHint') ||
              'If enabled, chat panel background becomes fully transparent.'
            }}</small>
          </div>
          <div>
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                class="switch"
                @click="avatarRandomBg = !avatarRandomBg"
                :aria-pressed="avatarRandomBg ? 'true' : 'false'"
                tabindex="0"
                @keydown.enter="avatarRandomBg = !avatarRandomBg"
                @keydown.space.prevent="avatarRandomBg = !avatarRandomBg">
                <div class="knob"></div>
              </div>
              <span>{{
                t('avatarRandomBg') || 'Random default avatar background per message'
              }}</span>
            </label>
            <small class="block opacity-70 mt-1">{{
              t('avatarRandomBgHint') ||
              'If enabled, users without avatar will get a random background color on each message.'
            }}</small>
            <small class="block opacity-60 mt-1 text-xs" aria-live="polite">{{
              saving ? t('commonSaving') || 'Saving…' : ''
            }}</small>
          </div>
        </div>
        <div class="chat-group-box" aria-labelledby="tts-heading">
          <h3 id="tts-heading" class="chat-group-title flex items-center gap-2">
            <HeaderIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-4.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </HeaderIcon>
            <span>{{ t('ttsSectionTitle') || 'Text-to-Speech' }}</span>
          </h3>
          <div class="mb-3">
            <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <div
                class="switch"
                @click="ttsAllChat = !ttsAllChat"
                :aria-pressed="ttsAllChat ? 'true' : 'false'"
                tabindex="0"
                @keydown.enter="ttsAllChat = !ttsAllChat"
                @keydown.space.prevent="ttsAllChat = !ttsAllChat">
                <div class="knob"></div>
              </div>
              <span>{{ t('enableTtsAllChat') || 'Read all chat messages' }}</span>
            </label>
            <small class="block opacity-70 mt-1">{{
              t('enableTtsAllChatHint') || 'Enable TTS for all incoming chat messages'
            }}</small>
          </div>
          <div class="chat-actions-row">
            <button
              class="btn"
              :disabled="savingTts"
              @click="saveTtsAllChat"
              :aria-busy="savingTts ? 'true' : 'false'">
              {{ savingTts ? t('commonSaving') : t('saveSettings') }}
            </button>
          </div>
        </div>
        <div
          class="chat-group-box"
          aria-labelledby="test-msg-heading"
          :aria-describedby="'test-msg-hint'">
          <h3 id="test-msg-heading" class="chat-group-title flex items-center gap-2">
            <HeaderIcon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-4.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </HeaderIcon>
            <span>{{ t('testMessages') || 'Test messages' }}</span>
          </h3>
          <p id="test-msg-hint" class="sr-only">
            {{ t('testMessagesHint') || 'Send sample messages or donations for preview.' }}
          </p>
          <div
            class="flex flex-wrap items-center gap-2 mb-3 text-xs"
            aria-live="polite"
            aria-atomic="false">
            <span class="chat-inline-badge"
              ><strong>AR</strong><span v-if="price.loading">…</span
              ><span v-else>{{ price.usd.toFixed(4) }} USD</span></span
            >
            <span class="chat-inline-badge" :title="'Tried: ' + price.providersTried.join(', ')"
              ><span>{{ price.source }}</span
              ><span v-if="price.ageSeconds >= 0">({{ price.ageSeconds.toFixed(0) }}s)</span></span
            >
            <button
              type="button"
              class="btn btn-sm px-2 py-0.5"
              @click="refreshPrice"
              :disabled="price.refreshing">
              {{ price.refreshing ? t('refreshing') || 'Refreshing…' : t('refresh') || 'Refresh' }}
            </button>
            <span
              v-if="price.isFallback"
              class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-600/40"
              >Fallback</span
            >
            <span
              v-else-if="price.isStale"
              class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-600/40"
              >Stale</span
            >
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-live="off">
            <div class="form-group">
              <label class="label">{{ t('username') || 'Username' }}</label>
              <input class="input" v-model="testForm.username" type="text" placeholder="TestUser" />
            </div>
            <div class="form-group">
              <label class="label">{{ t('credits') || 'Credits' }}</label>
              <input
                class="input"
                v-model.number="testForm.credits"
                type="number"
                min="0"
                step="1"
                placeholder="5" />
            </div>
            <div class="sm:col-span-2 form-group">
              <label class="label">{{ t('message') || 'Message' }}</label>
              <input
                class="input"
                v-model="testForm.message"
                type="text"
                placeholder="Hello from test" />
              <small class="opacity-70">{{
                t('testMessagesHint') ||
                'Send a fake chat message or a donation to preview styles without using real chat.'
              }}</small>
            </div>
          </div>
          <div
            class="flex gap-2 mt-2"
            role="group"
            :aria-label="t('testActionsLabel') || 'Test actions'">
            <button
              class="btn btn-secondary btn-compact-secondary"
              :disabled="testSending"
              @click="sendTest('message')">
              {{
                testSending && testKind === 'message'
                  ? t('sending') || 'Sending…'
                  : t('sendTestMessage') || 'Send test message'
              }}
            </button>
            <button
              class="btn btn-secondary btn-compact-secondary"
              :disabled="testSending"
              @click="sendTest('donation')">
              {{
                testSending && testKind === 'donation'
                  ? t('sending') || 'Sending…'
                  : t('sendTestDonation') || 'Send test donation'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-8" aria-labelledby="chat-builder-heading">
      <h2 id="chat-builder-heading" class="sr-only">
        {{ t('chatThemeCustomize') || 'Custom theme builder' }}
      </h2>
      <ChatThemeBuilder />
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import ColorInput from '../shared/ColorInput.vue';
import CopyField from '../shared/CopyField.vue';
import HeaderIcon from '../shared/HeaderIcon.vue';
import ChatThemeBuilder from '../ChatThemeManager/ChatThemeManager.vue';
import { createChatPanel } from './ChatPanel.js';

const { t } = useI18n();
const state = createChatPanel(t);
const {
  form,
  transparentBg,
  avatarRandomBg,
  overrideUsername,
  errors,
  claimPlaceholder,
  saving,
  connected,
  lastStatusAt,
  testForm,
  testSending,
  testKind,
  widgetUrl,
  widgetHorizontalUrl,
  ttsAllChat,
  savingTts,
  resetColors,
  save,
  saveTtsAllChat,
  sendTest,
  price,
  refreshPrice,
} = state;
</script>
<style scoped src="./ChatPanel.css"></style>
