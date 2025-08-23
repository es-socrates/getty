<template>
  <OsCard :title="t('activityLogTitle') || 'Activity Log'">
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <label class="text-sm">{{ t('activityLevelLabel') }}</label>
      <select v-model="level" class="os-input">
        <option value="">{{ t('activityAll') }}</option>
        <option value="info">{{ t('activityInfo') }}</option>
        <option value="warn">{{ t('activityWarn') }}</option>
        <option value="error">{{ t('activityError') }}</option>
      </select>
      <label class="text-sm ml-3">{{ t('activityRowsLabel') }}</label>
      <select v-model.number="limit" class="os-input">
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="200">200</option>
      </select>
      <label class="text-sm ml-3">{{ t('activityOrderLabel') }}</label>
      <select v-model="order" class="os-input">
        <option value="desc">{{ t('activityOrderNewest') }}</option>
        <option value="asc">{{ t('activityOrderOldest') }}</option>
      </select>
      <label class="text-sm ml-3 flex items-center gap-2">
        <span>{{ t('activityAutoScroll') }}</span>
        <span class="checkbox-wrapper-2"><input type="checkbox" class="checkbox" v-model="autoScroll"></span>
      </label>
      <button class="btn ml-auto" @click="refresh">{{ t('refresh') }}</button>
      <button class="btn" @click="clearLog">{{ t('activityClear') }}</button>
      <button class="btn" @click="downloadLog">{{ t('activityDownload') }}</button>
    </div>
    <div ref="listRef" class="os-subtle rounded-os-sm max-h-72 overflow-auto" aria-live="polite">
      <div v-for="(it, idx) in items" :key="idx" class="px-2 py-1 text-xs border-b">
        <span :class="badgeClass(it.level)" class="inline-block px-1 mr-2 rounded">{{ it.level.toUpperCase() }}</span>
        <span class="text-neutral-400">{{ formatTs(it.ts) }}</span>
        <span class="ml-2">{{ it.message }}</span>
      </div>
      <div v-if="!items.length" class="p-3 text-sm text-neutral-400">{{ t('activityEmpty') }}</div>
    </div>
    <div class="flex items-center justify-between mt-2 text-xs text-neutral-400">
      <div>{{ t('activityTotal') }}: {{ total }}</div>
      <div class="flex items-center gap-2 activity-pagination">
        <button class="btn btn-outline" :disabled="offset<=0" @click="prevPage">{{ t('activityPrev') }}</button>
        <span>Offset: {{ offset }}</span>
        <button class="btn btn-outline" :disabled="offset+limit>=total" @click="nextPage">{{ t('activityNext') }}</button>
        <button class="btn btn-outline" @click="showAll">{{ t('activityShowAll') }}</button>
      </div>
    </div>
  </OsCard>
</template>
<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import OsCard from './os/OsCard.vue';

const { t } = useI18n();
const items = ref([]);
const level = ref('');
const limit = ref(100);
const order = ref('desc');
const offset = ref(0);
const total = ref(0);
const autoScroll = ref(true);
const listRef = ref(null);

function formatTs(ts){ try { return new Date(ts).toLocaleString(); } catch { return ts; } }
function badgeClass(lvl){
  if (lvl === 'error') return 'bg-red-500/20 text-red-300 border border-red-500/40';
  if (lvl === 'warn') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
  return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
}
async function refresh(){
  try {
    const r = await axios.get('/api/activity', { params: { level: level.value || undefined, limit: limit.value, offset: offset.value, order: order.value } });
    items.value = r.data?.items || [];
    total.value = r.data?.total ?? 0;
    await nextTick();
    if (autoScroll.value && order.value === 'desc' && listRef.value) {
      listRef.value.scrollTop = 0;
    } else if (autoScroll.value && order.value === 'asc' && listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  } catch {}
}

async function clearLog(){
  try { await axios.post('/api/activity/clear'); offset.value = 0; await refresh(); } catch {}
}

function downloadLog(){
  const url = `/api/activity/export${level.value ? ('?level='+encodeURIComponent(level.value)) : ''}`;
  const a = document.createElement('a'); a.href = url; a.download = ''; a.click();
}

function prevPage(){ offset.value = Math.max(offset.value - limit.value, 0); refresh(); }
function nextPage(){ if (offset.value + limit.value < total.value) { offset.value += limit.value; refresh(); } }
function showAll(){ limit.value = 'all'; offset.value = 0; refresh(); }

onMounted(()=>{ refresh(); const int = setInterval(refresh, 5000); window.addEventListener('beforeunload', ()=>clearInterval(int)); });
watch([level, limit, order], ()=>{ offset.value = 0; refresh(); });
</script>
<style scoped>
 .os-input { background:#0a0e12; border:1px solid #161b22; padding:4px 8px; border-radius:6px; color:#e6edf3; }

 :deep(.text-emerald-300) { color: rgb(45,45,45) !important; }
 :deep(.bg-emerald-500\/20) { background-color: rgba(60, 230, 150, 0.20) !important; }
 :deep(.border-emerald-500\/30) {
   border-color: rgba(60, 230, 150, 0.30) !important;
   background-color: #3ce696 !important;
 }

 :deep(.text-yellow-300) { color: rgb(45,45,45) !important; }
 :deep(.bg-yellow-500\/20) { background-color: rgba(255, 216, 77, 0.20) !important; }
 :deep(.border-yellow-500\/30) {
   border-color: rgba(255, 216, 77, 0.30) !important;
   background-color: #ffd84d !important;
 }

 :deep(.text-red-300) { color: rgb(45,45,45) !important; }
 :deep(.bg-red-500\/20) { background-color: rgba(255, 107, 107, 0.20) !important; }
 :deep(.border-red-500\/40) {
   border-color: rgba(255, 107, 107, 0.40) !important;
   background-color: #ff6b6b !important;
 }
</style>
