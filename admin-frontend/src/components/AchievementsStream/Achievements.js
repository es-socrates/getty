export async function fetchAchievementsConfig() {
  const r = await fetch('/api/achievements/config', { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch config');
  return r.json();
}
export async function saveAchievementsConfig(cfg) {
  const r = await fetch('/api/achievements/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(cfg)
  });
  if (!r.ok) throw new Error('Failed to save config');
  return r.json();
}
export async function getAchievementsStatus() {
  const r = await fetch('/api/achievements/status', { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to fetch status');
  return r.json();
}
export async function resetAchievement(id) {
  const r = await fetch(`/api/achievements/reset/${encodeURIComponent(id)}`, { method: 'POST', credentials: 'include' });
  if (!r.ok) throw new Error('Failed to reset');
  return r.json();
}
export async function pollAchievementsViewers() {
  const r = await fetch('/api/achievements/poll-viewers', { method: 'POST', credentials: 'include' });
  if (!r.ok) throw new Error('Failed to poll');
  return r.json();
}

export async function testAchievementsNotification() {
  const r = await fetch('/api/achievements/test-notification', { method: 'POST', credentials: 'include' });
  if (!r.ok) throw new Error('Failed to test notification');
  return r.json();
}
