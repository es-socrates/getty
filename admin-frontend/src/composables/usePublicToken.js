import { ref, computed } from 'vue';
import api from '../services/api';

export function usePublicToken() {
  const supported = ref(false);
  const active = ref(false);
  const publicToken = ref('');
  const loaded = ref(false);

  async function refresh() {
    try {
      const statusRes = await api.get('/api/session/status').catch(() => ({ data: {} }));
      supported.value = !!statusRes?.data?.supported;
      active.value = !!statusRes?.data?.active;
    } catch {}
    try {
      const tRes = await api.get('/api/session/public-token').catch(() => ({ data: {} }));
      if (tRes?.data?.publicToken) publicToken.value = tRes.data.publicToken;
    } catch {}
    loaded.value = true;
  }

  const tokenQuery = computed(() => (publicToken.value ? `?token=${publicToken.value}` : ''));
  function withToken(urlBase) {
    return `${urlBase}${publicToken.value ? `?token=${publicToken.value}` : ''}`;
  }

  return { supported, active, publicToken, loaded, refresh, tokenQuery, withToken };
}
