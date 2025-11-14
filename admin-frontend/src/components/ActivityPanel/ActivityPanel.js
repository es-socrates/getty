import { ref, onMounted, watch, nextTick, computed, onUnmounted } from 'vue';
import api from '../../services/api';
import { useI18n } from 'vue-i18n';
import { useActivityLogPrefs } from '../../stores/activityLogPrefs';

/**
 * @typedef {Object} ActivityLogItem
 * @property {string | number | Date} ts
 * @property {string} level
 * @property {string} message
 * @property {unknown} [id]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} ActivityChip
 * @property {string} label
 * @property {string} value
 * @property {() => void} clear
 */

/**
 * @typedef {Object} ActivityPanelComposable
 * @property {(key: string, ...params: any[]) => string} t
 * @property {import('vue').Ref<ActivityLogItem[]>} items
 * @property {import('vue').Ref<string>} level
 * @property {import('vue').Ref<string>} q
 * @property {import('vue').Ref<number | 'all'>} limit
 * @property {import('vue').Ref<'asc' | 'desc'>} order
 * @property {import('vue').Ref<number>} offset
 * @property {import('vue').Ref<number>} total
 * @property {import('vue').Ref<boolean>} autoScroll
 * @property {import('vue').Ref<HTMLDivElement | null>} listRef
 * @property {(ts: string | number | Date) => string} formatTs
 * @property {(lvl: string) => string} badgeClass
 * @property {() => Promise<void>} refresh
 * @property {() => Promise<void>} clearLog
 * @property {() => void} downloadLog
 * @property {() => void} prevPage
 * @property {() => void} nextPage
 * @property {() => void} showAll
 * @property {(item: ActivityLogItem) => void} copyLine
 * @property {import('vue').ComputedRef<ActivityChip[]>} chips
 * @property {import('vue').Ref<boolean>} enabled
 * @property {import('vue').Ref<boolean>} collapsed
 */

/**
 * @returns {ActivityPanelComposable}
 */
export function useActivityPanel() {
  const { t: translate } = useI18n();
  /** @type {(key: string, ...params: any[]) => string} */
  const t = translate;

  /** @type {{
   *  enabled: import('vue').Ref<boolean>,
   *  collapsed: import('vue').Ref<boolean>,
   *  autoScrollDefault: import('vue').Ref<boolean>,
   *  limitDefault: import('vue').Ref<number>
   * }}
   */
  const { enabled, collapsed, autoScrollDefault, limitDefault } = useActivityLogPrefs();

  /** @type {import('vue').Ref<ActivityLogItem[]>} */
  const items = ref([]);
  /** @type {import('vue').Ref<string>} */
  const level = ref('');
  /** @type {import('vue').Ref<string>} */
  const q = ref('');
  /** @type {import('vue').Ref<number | 'all'>} */
  const limit = ref(limitDefault.value || 50);
  /** @type {import('vue').Ref<'asc' | 'desc'>} */
  const order = ref('desc');
  /** @type {import('vue').Ref<number>} */
  const offset = ref(0);
  /** @type {import('vue').Ref<number>} */
  const total = ref(0);
  /** @type {import('vue').Ref<boolean>} */
  const autoScroll = ref(Boolean(autoScrollDefault.value));
  /** @type {import('vue').Ref<HTMLDivElement | null>} */
  const listRef = ref(null);
  /** @type {ReturnType<typeof setInterval> | null} */
  let intervalId = null;

  /**
   * @param {string | number | Date} ts
   * @returns {string}
   */
  function formatTs(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts);
    }
  }

  /**
   * @param {string} lvl
   * @returns {string}
   */
  function badgeClass(lvl) {
    if (lvl === 'error') return 'bg-red-500/20 text-red-300 border border-red-500/40';
    if (lvl === 'warn') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  }

  async function refresh() {
    if (!enabled.value) return;
    try {
      const response = await api.get('/api/activity', {
        params: {
          level: level.value || undefined,
          q: q.value || undefined,
          limit: limit.value,
          offset: offset.value,
          order: order.value,
        },
      });
      const data = response?.data || {};
      items.value = Array.isArray(data.items) ? data.items : [];
      total.value = typeof data.total === 'number' ? data.total : 0;
      await nextTick();
      if (autoScroll.value && order.value === 'desc' && listRef.value) {
        listRef.value.scrollTop = 0;
      } else if (autoScroll.value && order.value === 'asc' && listRef.value) {
        listRef.value.scrollTop = listRef.value.scrollHeight;
      }
    } catch {}
  }

  async function clearLog() {
    try {
      await api.post('/api/activity/clear');
      offset.value = 0;
      await refresh();
    } catch {}
  }

  function downloadLog() {
    const params = new URLSearchParams();
    if (level.value) params.set('level', level.value);
    if (q.value) params.set('q', q.value);
    const qs = params.toString();
    const url = `/api/activity/export${qs ? `?${qs}` : ''}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.rel = 'noopener';
    a.click();
  }

  function prevPage() {
    if (limit.value === 'all') return;
    offset.value = Math.max(offset.value - limit.value, 0);
    refresh();
  }

  function nextPage() {
    if (limit.value === 'all') return;
    if (offset.value + limit.value < total.value) {
      offset.value += limit.value;
      refresh();
    }
  }

  function showAll() {
    limit.value = 'all';
    offset.value = 0;
    refresh();
  }

  /**
   * @param {ActivityLogItem} it
   */
  function copyLine(it) {
    try {
      navigator.clipboard.writeText(
        `[${formatTs(it.ts)}] ${String(it.level || '').toUpperCase()} ${it.message}`
      );
    } catch {}
  }

  /** @type {import('vue').ComputedRef<ActivityChip[]>} */
  const chips = computed(() => {
    /** @type {ActivityChip[]} */
    const c = [];
    if (level.value)
      c.push({
        label: 'Level',
        value: level.value,
        clear: () => {
          level.value = '';
        },
      });
    if (q.value)
      c.push({
        label: 'Search',
        value: q.value,
        clear: () => {
          q.value = '';
        },
      });
    return c;
  });

  function setupInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (!enabled.value) return;
    intervalId = setInterval(() => {
      if (!collapsed.value) refresh();
    }, 5000);
  }

  onMounted(() => {
    if (enabled.value) refresh();
    setupInterval();
  });

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
  });

  watch([level, limit, order, q], () => {
    offset.value = 0;
    refresh();
  });

  watch(enabled, (v) => {
    if (v) {
      refresh();
    } else {
      items.value = [];
      total.value = 0;
    }
    setupInterval();
  });

  watch(collapsed, (c) => {
    if (!c && enabled.value) refresh();
  });

  watch([autoScroll, limit], () => {
    try {
      autoScrollDefault.value = autoScroll.value;
      if (limit.value !== 'all' && [50, 100, 200].includes(Number(limit.value)))
        limitDefault.value = Number(limit.value);
    } catch {}
  });

  return {
    t,
    items,
    level,
    q,
    limit,
    order,
    offset,
    total,
    autoScroll,
    listRef,
    formatTs,
    badgeClass,
    refresh,
    clearLog,
    downloadLog,
    prevPage,
    nextPage,
    showAll,
    copyLine,
    chips,
    enabled,
    collapsed,
  };
}
