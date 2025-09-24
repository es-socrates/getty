<template>
  <div
    v-if="visible && !disabled"
    class="os-suggestion group relative rounded-xl border border-border bg-card shadow-sm"
    role="complementary"
    :aria-label="t('suggestionAriaLabel')">
    <button
      class="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-chat)]"
      @click="closeForHour"
      :aria-label="t('commonClose')">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>

    <div class="p-4">
      <div class="mb-2 flex items-center gap-2 text-sm font-medium">
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--bg-chat)] text-[var(--text-primary)]">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <span class="opacity-80">{{ badgeText }}</span>
        <span class="ml-auto mr-8 text-[11px] tabular-nums opacity-70" :title="nextChangeTitle">{{
          etaLabel
        }}</span>
      </div>

      <h4 class="mb-1 text-sm font-semibold leading-snug">{{ current.title }}</h4>
      <p class="mb-3 text-xs text-[var(--text-secondary)] leading-normal">
        {{ current.message }}
      </p>

      <div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          class="h-full rounded-full bg-[var(--text-primary)] transition-all"
          :style="{ width: progress + '%' }" />
      </div>

      <component
        :is="current.href ? 'a' : RouterLink"
        :href="current.href || undefined"
        :to="current.to || undefined"
        :target="current.href ? current.target || '_blank' : undefined"
        :rel="current.href ? current.rel || 'noopener' : undefined"
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg cta-btn px-3 py-2 text-xs font-semibold hover:opacity-95 active:opacity-90">
        {{ current.cta || t('suggestionOpen') }}
      </component>

      <button
        class="mt-2 w-full text-center text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        @click="disablePermanently">
        {{ t('suggestionNeverShow') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

const { t } = useI18n();

const templates = [
  { id: 'obs', to: '/admin/integrations' },
  { id: 'notifications', to: '/admin/notifications' },
  { id: 'chat', to: '/admin/chat' },
  { id: 'last-tip', to: '/admin/last-tip' },
  { id: 'goal', to: '/admin/tip-goal' },
  { id: 'raffle', to: '/admin/raffle' },
  { id: 'liveviews', to: '/admin/liveviews' },
  { id: 'settings', to: '/admin/settings' },
  { id: 'social-media', to: '/admin/social-media' },
  { id: 'announcement', to: '/admin/announcement' },
  { id: 'integrations', to: '/admin/integrations' },
  { id: 'status-page', to: '/admin/status' },
  { id: 'odysee-channel', href: 'https://odysee.com/', target: '_blank' },
  { id: 'odysee-docs', href: 'https://odysee.com/', target: '_blank' },
  { id: 'getty-docs', href: 'https://getty.sh/en/guide/intro/', target: '_blank' },
].map((item) => ({
  ...item,
  title: t(`suggestion_${item.id.replace('-', '_')}_title`),
  message: t(`suggestion_${item.id.replace('-', '_')}_message`),
  cta: t(`suggestion_${item.id.replace('-', '_')}_cta`),
}));

const STORAGE = {
  DISABLED: 'admin-suggestion-disabled',
  CLOSED_HOUR: 'admin-suggestion-closed-hour',
  HOUR: 'admin-suggestion-hour',
  IDX: 'admin-suggestion-idx',
};

const disabled = ref(false);
const visible = ref(true);
const progress = ref(0);
const etaLabel = ref('');
const currentIdx = ref(0);
const tickTimer = ref(null);

const badgeText = t('suggestionBadge');
const nextChangeTitle = computed(() => {
  const ms = msToNextHour();
  const d = new Date(Date.now() + ms);
  return `${t('suggestionNextChangeAt')} ${d.toLocaleTimeString()}`;
});

const current = computed(() => templates[currentIdx.value] || templates[0]);

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function hourId() {
  return Math.floor(Date.now() / 3600000);
}
function msToNextHour() {
  const now = Date.now();
  const next = (Math.floor(now / 3600000) + 1) * 3600000;
  return Math.max(0, next - now);
}

function chooseTemplateForHour() {
  const h = hourId();
  const storedHour = parseInt(safeGet(STORAGE.HOUR) || '-1', 10);
  if (storedHour !== h) {
    const idx = Math.floor(Math.random() * templates.length);
    currentIdx.value = idx;
    safeSet(STORAGE.HOUR, String(h));
    safeSet(STORAGE.IDX, String(idx));
  } else {
    const idx = parseInt(safeGet(STORAGE.IDX) || '0', 10);
    currentIdx.value = Number.isFinite(idx) ? idx : 0;
  }
}

function updateVisibility() {
  const h = hourId();
  const closedHour = parseInt(safeGet(STORAGE.CLOSED_HOUR) || '-1', 10);
  visible.value = closedHour !== h;
}

function updateProgress() {
  const ms = msToNextHour();
  const total = 3600000;
  progress.value = Math.min(100, Math.max(0, ((total - ms) / total) * 100));
  const secs = Math.ceil(ms / 1000);
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  etaLabel.value = `${m}:${s}`;
}

function tick() {
  const beforeHour = hourId();
  updateProgress();

  const afterHour = hourId();
  if (afterHour !== beforeHour) {
    chooseTemplateForHour();
    updateVisibility();
  }
}

function closeForHour() {
  safeSet(STORAGE.CLOSED_HOUR, String(hourId()));
  updateVisibility();
}

function disablePermanently() {
  safeSet(STORAGE.DISABLED, '1');
  disabled.value = true;
}

onMounted(() => {
  disabled.value = safeGet(STORAGE.DISABLED) === '1';
  chooseTemplateForHour();
  updateVisibility();
  updateProgress();
  tickTimer.value = setInterval(tick, 1000);
});

onBeforeUnmount(() => {
  if (tickTimer.value) clearInterval(tickTimer.value);
});
</script>

<style scoped>
.os-suggestion {
  background: var(--card);
}
.cta-btn {
  background-color: #111;
  color: #fff !important;
  cursor: pointer;
}
html.dark .cta-btn {
  background-color: #1a1a1a;
  color: #fff !important;
}
</style>
