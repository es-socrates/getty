<template>
  <section class="admin-tab active">
  <div class="panel-surface mb-4">
      <h3 class="widget-title mb-2">{{ t('statusModules') }}</h3>
      <div
        class="grid"
        style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;"
      >
        <div
          v-for="m in modulesList"
            :key="m.key"
            class="status-tile"
            :style="{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '12px', borderRadius: '8px' }"
        >
          <div
            style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;"
          >
            <span
              :style="{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: m.active ? '#16a34a' : '#64748b'
              }"
            ></span>
            {{ m.label }}
          </div>
          <div class="small" v-if="m.extra">{{ m.extra }}</div>
        </div>
      </div>
    </div>
  <div class="panel-surface">
      <h3 class="widget-title mb-2">{{ t('statusSystem') }}</h3>
      <div class="small" style="display:flex;flex-direction:column;gap:4px;">
        <div>{{ t('statusLocale') }}: {{ locale }}</div>
        <div>{{ t('statusTime') }}: {{ now }}</div>
        <div v-if="system"><span>{{ t('statusUptime') }}:</span> {{ formattedUptime }}</div>
        <div v-if="system"><span>{{ t('statusWsClients') }}:</span> {{ system.wsClients }}</div>
        <div v-if="system"><span>ENV:</span> {{ system.env }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const modulesList = ref([]);
const now = ref(new Date().toLocaleString());
const system = ref(null);

function formatUptime(seconds) {
  if (seconds < 60) return t('statusSeconds', { n: seconds });
  if (seconds < 3600) return t('statusMinutes', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('statusHours', { n: Math.floor(seconds / 3600) });
  return t('statusDays', { n: Math.floor(seconds / 86400) });
}
const formattedUptime = computed(() =>
  system.value ? formatUptime(system.value.uptimeSeconds || 0) : ''
);

async function load() {
  try {
    const r = await axios.get('/api/modules');
    const d = r.data;
    system.value = d.system || null;
  modulesList.value = [
      { key: 'lastTip', label: t('lastTip'), active: d.lastTip?.active !== false },
      { key: 'tipGoal', label: t('tipGoal'), active: d.tipGoal?.active !== false },
      { key: 'chat', label: t('chat'), active: d.chat?.active !== false },
      {
        key: 'announcement',
        label: t('announcementTitle'),
        active: d.announcement?.active,
        extra: d.announcement
          ? t('statusAnnouncements', {
              enabled: d.announcement.enabledMessages,
              total: d.announcement.totalMessages,
            })
          : '',
      },
      {
        key: 'socialmedia',
        label: t('socialMediaTitle'),
        active: d.socialmedia?.configured,
        extra: d.socialmedia ? t('statusItems', { n: d.socialmedia.entries }) : '',
      },
      {
        key: 'externalNotifications',
        label: t('externalNotificationsTitle'),
        active: d.externalNotifications?.active,
      },
      {
        key: 'liveviews',
        label: t('liveviewsTitle'),
        active: !!d.liveviews?.active,
        extra: d.liveviews?.claimid ? t('statusItems', { n: 1 }) : '',
      },
      {
        key: 'raffle',
        label: t('raffleTitle'),
        active: !!d.raffle?.active,
        extra: (() => {
          const parts = [];
          if (typeof d.raffle?.participants?.length === 'number') {
            parts.push(t('statusItems', { n: d.raffle.participants.length }));
          }
          if (typeof d.raffle?.totalWinners === 'number') {
            parts.push(t('statusRaffleWinners', { n: d.raffle.totalWinners }));
          }
          if (d.raffle?.paused) parts.push(t('rafflePaused'));
          return parts.join(' • ');
        })(),
      },
    ];
  } catch {}
}
onMounted(() => {
  load();
  setInterval(() => {
    now.value = new Date().toLocaleString();
    load();
  }, 60000);
});
</script>
