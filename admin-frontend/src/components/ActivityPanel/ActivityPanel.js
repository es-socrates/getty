import { ref, onMounted, watch, nextTick, computed, onUnmounted } from 'vue';
import api from '../../services/api';
import { useI18n } from 'vue-i18n';
import { useActivityLogPrefs } from '../../stores/activityLogPrefs';

export function useActivityPanel(){
  const { t } = useI18n();
  const { enabled, collapsed, autoScrollDefault, limitDefault } = useActivityLogPrefs();
  const items = ref([]);
  const level = ref('');
  const q = ref('');
  const limit = ref(limitDefault.value || 50);
  const order = ref('desc');
  const offset = ref(0);
  const total = ref(0);
  const autoScroll = ref(autoScrollDefault.value);
  const listRef = ref(null);
  let intervalId = null;

  function formatTs(ts){ try { return new Date(ts).toLocaleString(); } catch { return ts; } }
  function badgeClass(lvl){
    if (lvl === 'error') return 'bg-red-500/20 text-red-300 border border-red-500/40';
    if (lvl === 'warn') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  }
  async function refresh(){
    if (!enabled.value) return;
    try {
  const r = await api.get('/api/activity', { params: { level: level.value || undefined, q: q.value || undefined, limit: limit.value, offset: offset.value, order: order.value } });
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
  try { await api.post('/api/activity/clear'); offset.value = 0; await refresh(); } catch {}
  }

  function downloadLog(){
    const params = new URLSearchParams();
    if (level.value) params.set('level', level.value);
    if (q.value) params.set('q', q.value);
    const qs = params.toString();
    const url = `/api/activity/export${qs ? ('?'+qs) : ''}`;
    const a = document.createElement('a'); a.href = url; a.download = ''; a.click();
  }

  function prevPage(){ offset.value = Math.max(offset.value - limit.value, 0); refresh(); }
  function nextPage(){ if (offset.value + limit.value < total.value) { offset.value += limit.value; refresh(); } }
  function showAll(){ limit.value = 'all'; offset.value = 0; refresh(); }

  function copyLine(it){
    try { navigator.clipboard.writeText(`[${formatTs(it.ts)}] ${it.level.toUpperCase()} ${it.message}`); } catch {}
  }

  const chips = computed(()=>{
    const c = [];
    if (level.value) c.push({ label: 'Level', value: level.value, clear: ()=>{ level.value = ''; } });
    if (q.value) c.push({ label: 'Search', value: q.value, clear: ()=>{ q.value = ''; } });
    return c;
  });

  function setupInterval(){
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (!enabled.value) return;
    intervalId = setInterval(()=>{ if (!collapsed.value) refresh(); }, 5000);
  }

  onMounted(()=>{ if (enabled.value) refresh(); setupInterval(); });
  onUnmounted(()=>{ if (intervalId) clearInterval(intervalId); });
  watch([level, limit, order, q], ()=>{ offset.value = 0; refresh(); });
  watch(enabled, (v)=>{ if (v) { refresh(); } else { items.value = []; total.value = 0; } setupInterval(); });
  watch(collapsed, (c)=>{ if (!c && enabled.value) refresh(); });
  watch([autoScroll, limit], ()=>{
    try {
      autoScrollDefault.value = autoScroll.value;
      if (limit.value !== 'all' && [50,100,200].includes(Number(limit.value))) limitDefault.value = Number(limit.value);
    } catch {}
  });

  return { t, items, level, q, limit, order, offset, total, autoScroll, listRef, formatTs, badgeClass, refresh, clearLog, downloadLog, prevPage, nextPage, showAll, copyLine, chips, enabled, collapsed };
}