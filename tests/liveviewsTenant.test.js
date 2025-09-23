/* eslint-env jest */
const { describe, test, expect, beforeEach } = global;
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { loadTenantConfig } = require('../lib/tenant-config');

function makeApp() {
  jest.resetModules();
  process.env.GETTY_MULTI_TENANT_WALLET = '1';
  const express = require('express');
  const app = express();
  app.use(require('./test-helpers.js').walletTestMiddleware('__forcewallet1'));
  const { NamespacedStore } = require('../lib/store');
  const store = new NamespacedStore();
  const limiter = (_req, _res, next) => next();
  const registerLiveviewsRoutes = require('../routes/liveviews');
  registerLiveviewsRoutes(app, limiter, { store });
  return app;
}

describe('liveviews tenant config', () => {
  const TENANT_DIR = path.join(process.cwd(), 'tenant');
  beforeEach(() => {
    try { fs.rmSync(TENANT_DIR, { recursive: true, force: true }); } catch {}
  });

  test('POST then GET persists tenant-specific config', async () => {
    const app = makeApp();

  let r1 = await request(app).get('/config/liveviews-config.json');
  expect(r1.status).toBe(200);
  expect(r1.body).toBeTruthy();
  expect(r1.body).toHaveProperty('bg');
  expect(r1.body).toHaveProperty('claimid');

  const form = { bg: '#123456', claimid: 'abc123TENANT', viewersLabel: 'viewersX' };
    const r2 = await request(app)
      .post('/config/liveviews-config.json')
      .field('bg', form.bg)
      .field('claimid', form.claimid)
      .field('viewersLabel', form.viewersLabel);
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(r2.body.config.bg).toBe('#123456');
    expect(r2.body.config.claimid).toBe('abc123TENANT');
    expect(r2.body.config.viewersLabel).toBe('viewersX');

    const r3 = await request(app).get('/config/liveviews-config.json');
    expect(r3.status).toBe(200);
    expect(r3.body.bg).toBe('#123456');
    expect(r3.body.claimid).toBe('abc123TENANT');
    expect(r3.body.viewersLabel).toBe('viewersX');

    const file = path.join(process.cwd(), 'tenant', '__forcewallet1', 'config', 'liveviews-config.json');
    expect(fs.existsSync(file)).toBe(true);
    const result = await loadTenantConfig({ ns: { admin: '__forcewallet1' } }, null, file, 'liveviews-config.json');
    expect(result.meta).toHaveProperty('__version');
    expect(result).toHaveProperty('data');
    expect(result.data.bg).toBe('#123456');
  });
});
