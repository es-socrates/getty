import { ref } from 'vue';

export function usePublicToken() {
  const supported = ref(false);
  const active = ref(false);
  const loaded = ref(true);

  async function refresh() { /* intentionally blank */ }

  function tokenQuery() { return ''; }
  function withToken(urlBase) { return urlBase; }

  return { supported, active, loaded, refresh, tokenQuery, withToken };
}

export default usePublicToken;
