/* eslint-env jest */
const { beforeEach, describe, expect, test } = global;
const fs = require('fs');
const path = require('path');
const { URLSearchParams } = require('node:url');
const request = require('supertest');

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const axios = require('axios');

const TENANT_DIR = path.join(process.cwd(), 'tenant');

function makeApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  const limiter = (_req, _res, next) => next();
  const { NamespacedStore } = require('../lib/store');
  const store = new NamespacedStore();
  const registerChannelAnalyticsRoutes = require('../routes/channel-analytics');
  const { walletTestMiddleware } = require('./test-helpers.js');
  app.use(walletTestMiddleware('__tenant1'));
  registerChannelAnalyticsRoutes(app, limiter, { store });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  try {
    fs.rmSync(TENANT_DIR, { recursive: true, force: true });
  } catch {}
});

function mockOdyseeEndpoints({ channelClaim, streamClaims, channelClaimsTotal = streamClaims.length }) {
  function parseBody(payload) {
    if (!payload) return {};
    if (payload instanceof URLSearchParams) {
      const result = {};
      for (const [key, value] of payload.entries()) {
        if (result[key]) {
          if (Array.isArray(result[key])) {
            result[key].push(value);
          } else {
            result[key] = [result[key], value];
          }
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    if (typeof payload === 'string') {
      return parseBody(new URLSearchParams(payload));
    }
    return payload || {};
  }

  axios.post.mockImplementation((url, payload) => {
    if (url.includes('api.na-backend') && payload?.method === 'resolve') {
      const key = payload?.params?.urls?.[0];
      return Promise.resolve({ data: { result: { [key]: { claim_id: channelClaim } } } });
    }
    if (url.includes('api.na-backend') && payload?.method === 'claim_search') {
      if (payload?.params?.channel_ids) {
        return Promise.resolve({
          data: {
            result: {
              items: streamClaims.map((stream, idx) => ({
                claim_id: stream,
                value: { release_time: Math.floor(Date.now() / 1000) - idx * 86400 },
                signing_channel: {
                  claim_id: channelClaim,
                  meta: {
                    claims_in_channel: channelClaimsTotal,
                  },
                },
              })),
            },
          },
        });
      }
      return Promise.resolve({ data: { result: { items: [{ claim_id: channelClaim }] } } });
    }
    if (url.includes('subscription/sub_count')) {
      const body = parseBody(payload);
      if (!body.auth_token) {
        return Promise.reject(new Error('missing auth'));
      }
      return Promise.resolve({ data: { data: { sub_count: 99 } } });
    }
    if (url.includes('file/view_count')) {
      const body = parseBody(payload);
      const rawClaimIds = Array.isArray(body['claim_id'])
        ? body['claim_id']
        : body['claim_id']
          ? [body['claim_id']]
          : body['claim_ids'] || body['claim_ids[]'] || [];
      const claimIds = Array.isArray(rawClaimIds)
        ? rawClaimIds
        : typeof rawClaimIds === 'string' && rawClaimIds.includes(',')
          ? rawClaimIds.split(',').map((id) => id.trim()).filter(Boolean)
          : rawClaimIds
            ? [rawClaimIds]
            : [];
      return Promise.resolve({
        data: {
          data: {
            items: claimIds.map((id, idx) => ({ claim_id: id, view_count: (idx + 1) * 10 })),
          },
        },
      });
    }
    if (url.includes('channel/stats')) {
      return Promise.resolve({
        data: {
          data: {
            ChannelURI: '@getty',
            ChannelSubs: 123,
            ChannelSubChange: 4,
            AllContentViews: 4567,
            AllContentViewChange: -12,
            VideoURITopAllTime: 'classic:1111',
            VideoTitleTopAllTime: 'Classic Stream',
            VideoViewsTopAllTime: 789,
            VideoViewChangeTopAllTime: 10,
            VideoURITopNew: 'new:2222',
            VideoTitleTopNew: 'New Drop',
            VideoViewsTopNew: 12,
            VideoViewChangeTopNew: 3,
            VideoURITopCommentNew: 'comment:3333',
            VideoTitleTopCommentNew: 'Hot Takes',
            VideoCommentTopCommentNew: 45,
            VideoCommentChangeTopCommentNew: 5,
          },
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('channel analytics routes', () => {
  test('disables auth token form when env flag is off', async () => {
    const originalFlag = process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED;
    const originalToken = process.env.ODYSEE_ANALYTICS_AUTH_TOKEN;
    process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED = '0   # comment';
    process.env.ODYSEE_ANALYTICS_AUTH_TOKEN = 'env-secret-token';

    try {
      const channelClaim = 'd'.repeat(40);
      const streamClaims = ['e'.repeat(40)];
      mockOdyseeEndpoints({ channelClaim, streamClaims, channelClaimsTotal: 10 });
      const app = makeApp();

      const saveRes = await request(app)
        .post('/config/channel-analytics-config.json')
        .send({ channelHandle: '@managed' });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.config.authFormEnabled).toBe(false);
      expect(saveRes.body.config.hasAuthToken).toBe(true);

      const getRes = await request(app).get('/config/channel-analytics-config.json');
      expect(getRes.body.authFormEnabled).toBe(false);
      expect(getRes.body.envOverrides.authToken).toBe(true);
    } finally {
      if (typeof originalFlag === 'undefined') delete process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED;
      else process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED = originalFlag;
      if (typeof originalToken === 'undefined') delete process.env.ODYSEE_ANALYTICS_AUTH_TOKEN;
      else process.env.ODYSEE_ANALYTICS_AUTH_TOKEN = originalToken;
    }
  });

  test('keeps auth token form enabled when flag is truthy with inline comment', async () => {
    const originalFlag = process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED;
    process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED = '1   # keep form on';

    try {
      const app = makeApp();
      const res = await request(app).get('/config/channel-analytics-config.json');
      expect(res.status).toBe(200);
      expect(res.body.authFormEnabled).toBe(true);
    } finally {
      if (typeof originalFlag === 'undefined') delete process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED;
      else process.env.ODYSEE_ANALYTICS_AUTH_FORM_ENABLED = originalFlag;
    }
  });

  test('saves config via handle and returns masked token', async () => {
    const channelClaim = 'a'.repeat(40);
    const streamClaims = ['b'.repeat(40), 'c'.repeat(40)];
    mockOdyseeEndpoints({ channelClaim, streamClaims, channelClaimsTotal: 2293 });
    const app = makeApp();

    const saveRes = await request(app)
      .post('/config/channel-analytics-config.json')
      .send({ channelHandle: '@getty', authToken: 'secret-12345' });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body).toHaveProperty('config');
    expect(saveRes.body.config).toMatchObject({
      channelHandle: '@getty',
      hasAuthToken: true,
    });
    expect('tokenPreview' in saveRes.body.config).toBe(false);

    const getRes = await request(app).get('/config/channel-analytics-config.json');
    expect(getRes.status).toBe(200);
    expect(getRes.body.hasAuthToken).toBe(true);
    expect(getRes.body.claimId).toBe(channelClaim);

    const analyticsRes = await request(app).get('/api/channel-analytics/overview?range=day');
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.totals).toMatchObject({
      videos: 2293,
      subscribers: 99,
    });
    expect(analyticsRes.body.data.highlights).toMatchObject({
      subs: 123,
      subsChange: 4,
    });
    expect(analyticsRes.body.data.highlights.topAllTime).toMatchObject({
      title: 'Classic Stream',
      uri: 'classic:1111',
    });
    expect(Array.isArray(analyticsRes.body.data.bars)).toBe(true);
    expect(analyticsRes.body.data.bars.at(-1).views).toBeGreaterThan(0);
  });

  test('requires session for config access', async () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    const limiter = (_req, _res, next) => next();
    const registerChannelAnalyticsRoutes = require('../routes/channel-analytics');
    registerChannelAnalyticsRoutes(app, limiter, { store: null });

    const res = await request(app).get('/config/channel-analytics-config.json');
    expect(res.status).toBe(401);
  });
});
