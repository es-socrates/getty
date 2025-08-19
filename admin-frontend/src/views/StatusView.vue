<template>
  <section class="admin-tab active">
    <OsCard :title="t('statusModules')" class="mb-4">
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
        <div v-for="m in modulesList" :key="m.key" class="os-subtle p-3 rounded-os-sm">
          <div class="flex items-center gap-2 font-semibold text-sm">
            <span :class="['w-2 h-2 rounded-full', m.active ? 'bg-[#16a34a]' : 'bg-neutral-400']"></span>
            {{ m.label }}
          </div>
          <div class="os-card-meta" v-if="m.extra">{{ m.extra }}</div>
        </div>
      </div>
    </OsCard>

    <OsCard :title="t('statusSystem')">
      <OsTable
        :headers="[]"
        :rows="systemRows"
        :cols="['col-span-3','col-span-9']"
        :aria-label="t('statusSystem')"
      >
        <template #cell="{ value, colIndex }">
          <template v-if="colIndex === 0"><span class="os-th">{{ value }}</span></template>
          <template v-else>{{ value }}</template>
        </template>
      </OsTable>
    </OsCard>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from '../components/os/OsCard.vue'
import OsTable from '../components/os/OsTable.vue'

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

const systemRows = computed(() => {
  const rows = [];
  rows.push([t('statusLocale'), locale]);
  rows.push([t('statusTime'), now.value]);
  if (system.value) {
    rows.push([t('statusUptime'), formattedUptime.value]);
    rows.push([t('statusWsClients'), system.value.wsClients]);
    rows.push(['ENV', system.value.env]);
  }
  return rows;
});

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
