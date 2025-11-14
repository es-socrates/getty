import api from '../../services/api';

export async function fetchAchievementsConfig() {
  const r = await api.get('/api/achievements/config');
  return {
    config: r?.data?.data || {},
    meta: r?.data?.meta || null,
  };
}

export async function saveAchievementsConfig(cfg) {
  const r = await api.post('/api/achievements/config', cfg);
  return {
    ok: !!r?.data?.ok,
    config: r?.data?.data || {},
    meta: r?.data?.meta || null,
  };
}
export async function getAchievementsStatus() {
  const r = await api.get('/api/achievements/status');
  return r.data;
}
export async function resetAchievement(id) {
  const r = await api.post(`/api/achievements/reset/${encodeURIComponent(id)}`);
  return r.data;
}
export async function pollAchievementsViewers() {
  const r = await api.post('/api/achievements/poll-viewers');
  return r.data;
}

export async function testAchievementsNotification(namespace) {
  const url = namespace
    ? `/api/achievements/test-notification?ns=${encodeURIComponent(namespace)}`
    : '/api/achievements/test-notification';
  console.warn('Making POST request to:', url);
  try {
    const r = await api.post(url);
    console.warn('POST request successful:', r);
    return r.data;
  } catch (error) {
    console.error('POST request failed:', error);
    throw error;
  }
}
