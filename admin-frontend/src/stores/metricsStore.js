import { ref, computed, watch } from 'vue';
import axios from 'axios';

export const metrics = ref({});
export const hist = ref({ rpm: [], heap: [], bandwidth: [], chat: [], tips: [], ws: [], latency: [], views: [] });
export const deltas = ref({ rpm: null, heap: null, bandwidth: null, chat: null, ws: null });

const MAX_CAP = 240;
const intervalMs = 10000;

export const currentRange = ref('5m');
try {
  const saved = localStorage.getItem('getty_overview_range');
  if (saved && ['5m','15m','60m'].includes(saved)) currentRange.value = saved;
} catch {}
export function setRange(v){
  if (!['5m','15m','60m'].includes(v)) return;
  currentRange.value = v;
  try { localStorage.setItem('getty_overview_range', v); } catch {}
}

export const maxPoints = computed(()=>{
  const map = { '5m': 30, '15m': 90, '60m': 360 };
  const target = map[currentRange.value] ?? 30;
  return Math.min(target, MAX_CAP);
});

function trimAll(to){
  const obj = hist.value;
  for (const k of Object.keys(obj)){
    const arr = obj[k];
    if (Array.isArray(arr) && arr.length > to){
      obj[k] = arr.slice(arr.length - to);
    }
  }
}
watch(maxPoints, (mp)=>{ trimAll(mp); });

function deltaFromArr(arr){
  if (!arr || arr.length < 2) return null;
  const first = arr[0];
  const last = arr[arr.length - 1];
  const diff = last - first;
  const base = Math.abs(first) < 1e-6 ? 0 : (diff / first) * 100;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const pctText = isFinite(base) ? `${(base).toFixed(1)}%` : '';
  const absText = `${diff > 0 ? '+' : ''}${(diff).toFixed(1)}`;
  return { dir, text: pctText || absText };
}

function push(arr, v){ arr.push(v); if (arr.length > maxPoints.value) arr.shift(); }

async function refresh(){
  try {
    const r = await axios.get('/api/metrics');
    const m = r.data || {};
    metrics.value = m;
    push(hist.value.rpm, +(m.system?.requests?.perMin ?? 0));
    push(hist.value.heap, +(m.system?.memory?.heapUsedMB ?? 0));
    const kb = (()=>{ const s=m.bandwidth?.human?.perMin||'0 KB'; const n=parseFloat(s); return isNaN(n)?0:n; })();
    push(hist.value.bandwidth, kb);
    push(hist.value.chat, +(m.chat?.perMin ?? 0));
    push(hist.value.tips, +(m.tips?.rate?.perMin?.ar ?? 0));
    push(hist.value.ws, +(m.system?.wsClients ?? 0));
    push(hist.value.latency, +((m.latency?.ms ?? m.system?.latencyMs ?? 0)));
    push(hist.value.views, +(m.liveviews?.viewerCount ?? 0));

    deltas.value = {
      rpm: deltaFromArr(hist.value.rpm),
      heap: deltaFromArr(hist.value.heap),
      bandwidth: deltaFromArr(hist.value.bandwidth),
      chat: deltaFromArr(hist.value.chat),
      ws: deltaFromArr(hist.value.ws),
    };
  } catch {}
}

let timer = null;
export function start(){
  try {
    if (timer) return;
    refresh();
    timer = setInterval(refresh, intervalMs);
  } catch {}
}
export function stop(){
  try { if (timer) clearInterval(timer); } catch {}
  timer = null;
}
