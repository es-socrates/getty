import { ref } from 'vue';

export function usePublicToken() {
  const supported = ref(true);
  const token = ref('');
  const loaded = ref(false);

  async function refresh() {
    try {
      const response = await fetch('/api/publicToken');
      if (response.ok) {
        const data = await response.json();
        token.value = data.publicToken || '';
      } else {
        token.value = '';
      }
    } catch {
      token.value = '';
    } finally {
      loaded.value = true;
    }
  }

  function tokenQuery() {
    return token.value ? `token=${encodeURIComponent(token.value)}` : '';
  }

  function withToken(urlBase) {
    const q = tokenQuery();
    if (!q) return urlBase;
    return urlBase.includes('?') ? `${urlBase}&${q}` : `${urlBase}?${q}`;
  }

  return { supported, active: token, loaded, refresh, tokenQuery, withToken };
}

export default usePublicToken;
