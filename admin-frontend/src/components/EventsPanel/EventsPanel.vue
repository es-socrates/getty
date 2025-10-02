<template>
  <section class="admin-tab active relative events-root" role="form">
    <div class="events-grid">
      <div class="events-group-box" aria-labelledby="events-activity-title">
        <div class="events-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </HeaderIcon>
          <h3 id="events-activity-title" class="events-group-title">
            {{ t('eventsActivityPanelTitle') }}
          </h3>
        </div>
        <div class="events-setting-item">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsActivityDescription') }}</div>
          </div>
        </div>
        <div class="events-setting-item">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsActivityCountLabel') }}</div>
            <div class="events-setting-desc">{{ t('eventsActivityCountHint') }}</div>
          </div>
          <div class="events-setting-control">
            <input
              class="input"
              type="number"
              min="0"
              max="10"
              v-model.number="settings.eventCount"
              @input="autoSave" />
          </div>
        </div>
        <div class="events-activities-list">
          <div v-for="activity in activities" :key="activity.key" class="events-activity-item">
            <div class="events-activity-info">
              <span class="events-activity-name">{{ activity.name }}</span>
              <span class="events-activity-desc">{{ activity.desc }}</span>
            </div>
            <div class="events-activity-control">
              <button
                type="button"
                class="switch"
                :aria-pressed="String(settings.enabledActivities.includes(activity.key))"
                @click="toggleActivity(activity.key)">
                <span class="knob"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="events-group-box" aria-labelledby="events-preview-title">
        <div class="events-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </HeaderIcon>
          <h3 id="events-preview-title" class="events-group-title">
            {{ t('eventsPreviewPanelTitle') }}
          </h3>
        </div>
        <div class="events-setting-item is-vertical">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsPreviewDescription') }}</div>
          </div>
          <div class="events-preview-wrapper">
            <div
              class="events-preview-box"
              :style="previewStyle"
              role="img"
              aria-label="Events preview">
              <div class="ep-content">
                <div class="ep-event" v-for="event in previewEvents" :key="event.id">
                  <div class="ep-icon"><i :class="event.icon"></i></div>
                  <div class="ep-text">{{ event.text }}</div>
                  <div class="ep-time">{{ event.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="events-group-box" aria-labelledby="events-theme-title">
        <div class="events-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M14.31 8l5.74 9.94" />
              <path d="M9.69 8h11.48" />
              <path d="M7.38 12l5.74-9.94" />
              <path d="M9.69 16L3.95 6.06" />
              <path d="M14.31 16H2.83" />
            </svg>
          </HeaderIcon>
          <h3 id="events-theme-title" class="events-group-title">
            {{ t('eventsThemePanelTitle') }}
          </h3>
        </div>
        <div class="events-setting-item is-vertical">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsThemeDescription') }}</div>
          </div>
          <div class="flex flex-wrap gap-2 colors-section">
            <ColorInput
              v-model="settings.theme.bgColor"
              :label="t('eventsThemeBgColor')"
              @input="autoSave" />
            <ColorInput
              v-model="settings.theme.textColor"
              :label="t('eventsThemeTextColor')"
              @input="autoSave" />
            <div class="flex flex-col gap-2">
              <button type="button" class="btn btn-secondary" @click="resetColors">
                {{ t('eventsResetColors') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="events-group-box" aria-labelledby="events-obs-title">
        <div class="events-group-head">
          <HeaderIcon>
            <svg
              class="os-icon"
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
          <h3 id="events-obs-title" class="events-group-title">
            {{ t('eventsAnimationPanelTitle') }}
          </h3>
        </div>
        <div class="events-setting-item">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsAnimationLabel') }}</div>
          </div>
          <div class="events-setting-control">
            <select class="input select" v-model="settings.animation" @change="autoSave">
              <option value="fadeIn">{{ t('eventsAnimationFadeIn') }}</option>
              <option value="fadeInUp">{{ t('eventsAnimationFadeInUp') }}</option>
              <option value="slideInLeft">{{ t('eventsAnimationSlideInLeft') }}</option>
              <option value="slideInRight">{{ t('eventsAnimationSlideInRight') }}</option>
              <option value="bounceIn">{{ t('eventsAnimationBounceIn') }}</option>
              <option value="zoomIn">{{ t('eventsAnimationZoomIn') }}</option>
            </select>
          </div>
        </div>
        <div class="events-setting-item is-vertical">
          <div class="events-setting-text">
            <div class="events-setting-title">{{ t('eventsObsUrlLabel') }}</div>
            <div class="events-setting-desc">{{ t('eventsObsUrlHint') }}</div>
          </div>
          <div class="copy-field-row">
            <CopyField :value="widgetUrl" :aria-label="t('eventsObsUrlLabel')" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, onMounted, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/services/api';
import { pushToast } from '@/services/toast';
import { registerDirty } from '@/composables/useDirtyRegistry';
import CopyField from '@/components/shared/CopyField.vue';
import HeaderIcon from '@/components/shared/HeaderIcon.vue';
import ColorInput from '@/components/shared/ColorInput.vue';
import { usePublicToken } from '@/composables/usePublicToken';

const { t } = useI18n();
const { withToken, refresh } = usePublicToken();

const settings = reactive({
  eventCount: 6,
  enabledActivities: ['last-tip', 'chat-tip', 'achievement', 'last-achievement'],
  theme: {
    bgColor: '#080c10',
    textColor: '#ffffff',
  },
  animation: 'fadeIn',
});

const activities = [
  { key: 'last-tip', name: t('eventsActivityLastTip'), desc: 'Most recent donation' },
  { key: 'chat-tip', name: t('eventsActivityChatTip'), desc: 'Latest tip from chat' },
  { key: 'achievement', name: t('eventsActivityAchievement'), desc: 'Latest achievement unlocked' },
  {
    key: 'last-achievement',
    name: t('eventsActivityLastAchievement'),
    desc: 'Most recent achievement',
  },
];

const originalSettings = ref(null);

const widgetUrl = computed(() => withToken(`${location.origin}/widgets/events`));

const previewEvents = computed(() => {
  const enabled = settings.enabledActivities;
  const count = Math.min(settings.eventCount, enabled.length);
  const examples = {
    'last-tip': { icon: 'pi pi-dollar', text: `${t('eventsPreviewTip')}: 5.00 AR from Spaceman` },
    'chat-tip': { icon: 'pi pi-comment', text: `${t('eventsPreviewTip')}: 1.50 AR` },
    achievement: { icon: 'pi pi-trophy', text: `${t('eventsPreviewAchievement')}: First Tip!` },
    'last-achievement': {
      icon: 'pi pi-trophy',
      text: `${t('eventsPreviewAchievement')}: Recent Achievement`,
    },
  };

  return enabled.slice(0, count).map((key, index) => {
    const example = examples[key] || {
      icon: 'pi pi-bell',
      text: `${t('eventsPreviewUnknown')}: ${key}`,
    };
    const times = ['2m ago', '5m ago', '8m ago', '12m ago', '15m ago', '18m ago'];
    return {
      id: `${key}-${index}`,
      icon: example.icon,
      text: example.text,
      time: times[index % times.length],
    };
  });
});

const previewStyle = computed(() => ({
  '--events-bg': settings.theme.bgColor,
  '--events-text': settings.theme.textColor,
}));

function toggleActivity(key) {
  const index = settings.enabledActivities.indexOf(key);
  if (index > -1) {
    settings.enabledActivities.splice(index, 1);
  } else {
    settings.enabledActivities.push(key);
  }
  autoSave();
}

function resetColors() {
  settings.theme.bgColor = '#080c10';
  settings.theme.textColor = '#ffffff';
  autoSave();
}

let saveTimeout = null;
function autoSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSettings();
  }, 1000);
}

async function saveSettings() {
  try {
    await api.post('/api/events-settings', {
      eventCount: settings.eventCount,
      enabledActivities: settings.enabledActivities,
      theme: settings.theme,
      animation: settings.animation,
    });

    originalSettings.value = {
      eventCount: settings.eventCount,
      enabledActivities: [...settings.enabledActivities].sort(),
      theme: { ...settings.theme },
      animation: settings.animation,
    };

    pushToast({ type: 'success', message: t('eventsSettingsSaved') });
  } catch {
    pushToast({ type: 'error', message: t('eventsSaveFailed') });
  }
}

async function loadSettings() {
  try {
    const { data } = await api.get('/api/events-settings');
    if (data) {
      settings.eventCount = data.eventCount || 6;
      settings.enabledActivities = data.enabledActivities || [
        'last-tip',
        'chat-tip',
        'achievement',
        'last-achievement',
      ];
      settings.theme = { ...settings.theme, ...data.theme };
      settings.animation = data.animation || 'fadeIn';

      originalSettings.value = {
        eventCount: settings.eventCount,
        enabledActivities: [...settings.enabledActivities].sort(),
        theme: { ...settings.theme },
        animation: settings.animation,
      };
    }
  } catch {}
}

function isDirty() {
  const current = {
    eventCount: settings.eventCount,
    enabledActivities: [...settings.enabledActivities].sort(),
    theme: settings.theme,
    animation: settings.animation,
  };
  const saved = originalSettings.value;
  return JSON.stringify(current) !== JSON.stringify(saved);
}
registerDirty(isDirty);

onMounted(async () => {
  try {
    await refresh();
  } catch {}
  await loadSettings();
});
</script>

<style scoped src="./EventsPanel.css"></style>
