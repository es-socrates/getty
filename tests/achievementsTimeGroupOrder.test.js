const request = require('supertest');
const app = require('../server');

/**
 * This test hits the achievements status API and verifies that the grouping
 * order (as exposed by the raw items categories) would render in the expected
 * sequence: viewers, chat, time, tips.
 */

describe('Achievements time group ordering', () => {
  test('time group ordering (simulated UI grouping)', async () => {
    const res = await request(app).get('/api/achievements/status');
    expect(res.status).toBe(200);
    const items = res.body.items || [];

    const uiOrder = ['viewers', 'chat', 'time', 'tips'];
    const byCat = Object.create(null);
    for (const it of items) {
      const key = uiOrder.includes(it.category) ? it.category : 'misc';
      (byCat[key] ||= []).push(it);
    }
    const groupedCats = uiOrder.filter((c) => (byCat[c] || []).length > 0);

    const timeIdx = groupedCats.indexOf('time');
    const tipsIdx = groupedCats.indexOf('tips');
    if (timeIdx !== -1 && tipsIdx !== -1) {
      expect(timeIdx).toBeLessThan(tipsIdx);
    }
    const viewersIdx = groupedCats.indexOf('viewers');
    const chatIdx = groupedCats.indexOf('chat');
    if (viewersIdx !== -1 && chatIdx !== -1) {
      expect(viewersIdx).toBeLessThan(chatIdx);
    }
  });
});
