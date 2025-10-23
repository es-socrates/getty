/* eslint-env jest */
const { describe, test, expect, beforeEach, afterAll } = global;
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AxiosMockAdapter = require('axios-mock-adapter');
const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');

const CONFIG_DIR = path.join(process.cwd(), 'config');
const LIVEVIEWS_CONFIG_PATH = path.join(CONFIG_DIR, 'liveviews-config.json');
const STREAM_HISTORY_CONFIG_PATH = path.join(CONFIG_DIR, 'stream-history-config.json');
const TENANT_DIR = path.join(process.cwd(), 'tenant');

function cleanupConfigFiles() {
  try { fs.unlinkSync(LIVEVIEWS_CONFIG_PATH); } catch {}
  try { fs.unlinkSync(STREAM_HISTORY_CONFIG_PATH); } catch {}
  try { fs.rmSync(TENANT_DIR, { recursive: true, force: true }); } catch {}
}

describe('Live Metrics viewer count configuration', () => {
  let mock;

  beforeEach(() => {
    cleanupConfigFiles();
    if (mock) {
      try { mock.restore(); } catch {}
    }
    mock = new AxiosMockAdapter(axios);
  });

  afterAll(() => {
    if (mock) {
      try { mock.restore(); } catch {}
      mock = null;
    }
    cleanupConfigFiles();
  });

  test('falls back to stream-history claim when liveviews config is empty', async () => {
    const claim = 'abcdef123456abcdef123456abcdef123456abcd';

    mock
      .onGet(`https://api.odysee.live/livestream/is_live?channel_claim_id=${claim}`)
      .reply(200, { data: { Live: true, ViewerCount: 42 } });

    const { app, restore } = freshServer({ GETTY_REQUIRE_SESSION: '0', REDIS_URL: '' });
    try {
      const saveRes = await request(app)
        .post('/config/stream-history-config.json')
        .send({ claimid: claim });
      expect(saveRes.status).toBe(200);
      expect(saveRes.body?.success).toBe(true);

      const metricsRes = await request(app).get('/api/metrics');
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body?.liveviews?.viewerCount).toBe(42);
      expect(metricsRes.body?.liveviews?.live).toBe(true);
    } finally {
      restore();
      cleanupConfigFiles();
      if (mock) mock.resetHistory();
    }
  });

  test('prefers liveviews claim when both configs provide a channel', async () => {
    const streamClaim = '1111111111111111111111111111111111111111';
    const liveviewsClaim = '2222222222222222222222222222222222222222';
    mock
      .onGet(`https://api.odysee.live/livestream/is_live?channel_claim_id=${streamClaim}`)
      .reply(200, { data: { Live: true, ViewerCount: 5 } });
    mock
      .onGet(`https://api.odysee.live/livestream/is_live?channel_claim_id=${liveviewsClaim}`)
      .reply(200, { data: { Live: true, ViewerCount: 99 } });

    const { app, restore } = freshServer({ GETTY_REQUIRE_SESSION: '0', REDIS_URL: '' });
    try {
      const saveStream = await request(app)
        .post('/config/stream-history-config.json')
        .send({ claimid: streamClaim });
      expect(saveStream.status).toBe(200);
      expect(saveStream.body?.success).toBe(true);

      const saveLiveviews = await request(app)
        .post('/config/liveviews-config.json')
        .field('claimid', liveviewsClaim)
        .field('viewersLabel', 'viewers');
      expect(saveLiveviews.status).toBe(200);
      expect(saveLiveviews.body?.success).toBe(true);

      const liveviewsConfig = await request(app).get('/config/liveviews-config.json');
      expect(liveviewsConfig.status).toBe(200);
      expect(liveviewsConfig.body?.claimid).toBe(liveviewsClaim);

      const metricsRes = await request(app).get('/api/metrics');
      expect(metricsRes.status).toBe(200);
      const requestedUrls = mock.history.get.map((entry) => entry.url);
      expect(requestedUrls).toContain(
        `https://api.odysee.live/livestream/is_live?channel_claim_id=${liveviewsClaim}`
      );
      expect(metricsRes.body?.liveviews?.viewerCount).toBe(99);
      expect(metricsRes.body?.liveviews?.live).toBe(true);
    } finally {
      restore();
      cleanupConfigFiles();
      if (mock) mock.resetHistory();
    }
  });
});
