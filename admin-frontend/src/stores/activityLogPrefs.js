import { ref, watch } from 'vue';

const KEY = 'getty_activity_prefs_v1';
let initialized = false;

const enabled = ref(false);
const collapsed = ref(true);
const autoScrollDefault = ref(false);
const limitDefault = ref(50);

function load() {
  if (initialized) return;
  initialized = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj.enabled === 'boolean') enabled.value = obj.enabled;
      if (typeof obj.collapsed === 'boolean') collapsed.value = obj.collapsed;
      if (typeof obj.autoScrollDefault === 'boolean')
        autoScrollDefault.value = obj.autoScrollDefault;
      const lim = Number(obj.limitDefault);
      if (Number.isFinite(lim) && [50, 100, 200].includes(lim)) limitDefault.value = lim;
    }
  } catch {}
}

function save() {
  try {
    const obj = {
      enabled: enabled.value,
      collapsed: collapsed.value,
      autoScrollDefault: autoScrollDefault.value,
      limitDefault: limitDefault.value,
    };
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {}
}

export function useActivityLogPrefs() {
  load();

  watch([enabled, collapsed, autoScrollDefault, limitDefault], save, { deep: false });
  return { enabled, collapsed, autoScrollDefault, limitDefault };
}
