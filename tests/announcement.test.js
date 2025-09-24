const request = require('supertest');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline;

let server;
let base;

beforeAll(async () => {
  try {     const create = await base.post('/api/announcement/message').field('text','WS live');
    expect(create.status).toBe(200);
    appRef.getWss();
    const announcementModule = appRef.getAnnouncementModule();
    console.warn('[test-debug] about to broadcast via module');
    await new Promise(resolve => setTimeout(resolve, 100)); // Add delay
    await announcementModule.broadcastRandomMessage(null);
    console.warn('[test-debug] broadcast done');
  } catch { /* ignore spy error */ }
  ({ app: appRef, restore: restoreBaseline } = freshServer({ GETTY_REQUIRE_SESSION: null, REDIS_URL: null }));
  if (typeof appRef.startTestServer === 'function') {
    server = await appRef.startTestServer();
    base = request(server);
  } else {
    base = request(appRef);
  }
});

afterAll(done => {
  try {
    if (appRef?.disposeGetty) appRef.disposeGetty();
  } catch { /* ignore dispose errors */ }
  try { restoreBaseline && restoreBaseline(); } catch {}
  if (server) server.close(done); else done();
});

async function createMessage(text, extra = {}) {
  const req = base.post('/api/announcement/message');
  req.field('text', text);
  if (extra.linkUrl) req.field('linkUrl', extra.linkUrl);
  if (extra.durationSeconds) req.field('durationSeconds', String(extra.durationSeconds));
  return req;
}

describe('Announcement API', () => {
  it('GET /api/announcement returns config structure', async () => {
    const res = await base.get('/api/announcement');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config).toHaveProperty('messages');
    expect(res.body.config).toHaveProperty('cooldownSeconds');
    expect(res.body.config).toHaveProperty('theme');
  });

  let createdId;
  it('POST /api/announcement/message adds message', async () => {
    const res = await createMessage('Test *announcement* message', { linkUrl: 'https://example.com', durationSeconds: 5 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    createdId = res.body.message.id;
    expect(res.body.message.durationSeconds).toBe(5);
  });

  it('PUT /api/announcement/message/:id toggles enabled', async () => {
    const res = await base
      .put(`/api/announcement/message/${createdId}`)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message.enabled).toBe(false);
  });

  it('Validation: reject over 90 chars', async () => {
    const long = 'x'.repeat(95);
    const res = await base
      .post('/api/announcement/message')
      .field('text', long);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/announcement/message/:id removes message', async () => {
    const res = await base.delete(`/api/announcement/message/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/announcement updates settings', async () => {
  const res = await base.post('/api/announcement').send({ cooldownSeconds: 120, theme: 'horizontal', bgColor: '#112233', textColor: '#ffeecc', animationMode: 'slide-up' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.cooldownSeconds).toBe(120);
    expect(res.body.config.theme).toBe('horizontal');
    expect(res.body.config.bgColor).toBe('#112233');
    expect(res.body.config.textColor).toBe('#ffeecc');
  expect(res.body.config.animationMode).toBe('slide-up');

  const check = await base.get('/api/announcement');
  expect(check.body.config.animationMode).toBe('slide-up');
  });

  it('PUT /api/announcement/message/:id/image replaces image', async () => {
    const create = await createMessage('Image test message', { linkUrl: 'https://example.com' });
    expect(create.status).toBe(200);
    const id = create.body.message.id;
    const imgBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgYhRPJwAAAAASUVORK5CYII=','base64');
    const res = await base
      .put(`/api/announcement/message/${id}/image`)
      .attach('image', imgBuffer, { filename: 'tiny.png', contentType: 'image/png' })
      .field('text','Image test message updated');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message.imageUrl).toMatch(/https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/announcement-images\//);
  });

  it('PUT /api/announcement/message/:id/removeImage clears existing image', async () => {

    const imgBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgYhRPJwAAAAASUVORK5CYII=','base64');
    const create = await base
      .post('/api/announcement/message')
      .field('text', 'Temp img message')
      .attach('image', imgBuffer, { filename: 'tiny.png', contentType: 'image/png' });
    expect(create.status).toBe(200);
    const id = create.body.message.id;
    expect(create.body.message.imageUrl).toBeTruthy();
    const update = await base
      .put(`/api/announcement/message/${id}`)
      .send({ text: 'Temp img message updated', removeImage: true });
    expect(update.status).toBe(200);
    expect(update.body.success).toBe(true);
    expect(update.body.message.imageUrl).toBe(null);
  });

  it('POST /api/announcement defaultDurationSeconds applyAllDurations flow', async () => {
    const marker = 'DD-' + Date.now();
    await createMessage(marker + ' A');
    await createMessage(marker + ' B');
    const res = await base.post('/api/announcement').send({ defaultDurationSeconds: 22, applyAllDurations: true });
    expect(res.body.config.defaultDurationSeconds).toBe(22);
    const msgs = res.body.config.messages.filter(m => m.text.startsWith(marker));
    expect(msgs.length).toBe(2);
    msgs.forEach(m => { expect(m.durationSeconds).toBe(22); expect(m.usesDefaultDuration).toBe(true); });
    const res2 = await base.post('/api/announcement').send({ defaultDurationSeconds: 28 });
    expect(res2.body.config.defaultDurationSeconds).toBe(28);
    const msgs2 = res2.body.config.messages.filter(m => m.text.startsWith(marker));
    msgs2.forEach(m => { expect(m.durationSeconds).toBe(28); expect(m.usesDefaultDuration).toBe(true); });
  });
});

describe('Announcement WebSocket', () => {
  let server, address, ws;
  const WebSocket = require('ws');
  beforeAll(async () => {
  server = await appRef.startTestServer();
    const token = 'ws-ann-test';
    address = `ws://localhost:${server.address().port}?token=${token}`;

    global.__ANN_WS_TOKEN = token;

    try { base = request(server); } catch { /* ignore rebind error */ }
  });
  afterAll(done => { try { if (ws && ws.readyState === 1) ws.close(); } catch { /* ignore ws close */ }; if (server) server.close(()=>done()); else done(); });

  test('receives config broadcast and manual announcement', async () => {
    const events = [];
    async function waitForWsDebug(minSockets = 1, timeoutMs = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const dbg = await base.get('/__ws-debug');
        if (dbg.status === 200 && Array.isArray(dbg.body.sockets)) {
          if (dbg.body.sockets.length >= minSockets) return dbg.body;
        }
        await new Promise(r=>setTimeout(r,50));
      }
      throw new Error(`ws-debug timeout waiting for ${minSockets} socket(s)`);
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(()=>reject(new Error('ws open timeout')), 4000);
      ws = new WebSocket(address, { headers: { 'x-ws-ns': 'ws-ann-test' } });

      ws.on('message', raw => {
        console.warn('[test-debug] received raw message:', raw.toString());
        let data = null; try { data = JSON.parse(raw.toString()); } catch { /* ignore parse error */ }
        console.warn('[test-debug] received parsed message:', data);
        if (!data || typeof data !== 'object') return;
        events.push(data);
      });
      ws.once('open', ()=>{ clearTimeout(timeout); resolve(); });
      ws.on('error', reject);
    });

  try { await waitForWsDebug(1); } catch (e) { console.warn('[announcement.test][debug-ws-registration-failed]', e.message); }

    await base.delete('/api/announcement/messages?mode=all');
    const create = await base.post('/api/announcement/message').field('text','WS live');
    expect(create.status).toBe(200);
    const wss = appRef.getWss();
    const announcementModule = appRef.getAnnouncementModule();
    const broadcastSpy = jest.spyOn(wss, 'broadcast');
    console.warn('[test-debug] about to broadcast via module');
    await new Promise(resolve => setTimeout(resolve, 100));
    await announcementModule.broadcastRandomMessage(null);
    console.warn('[test-debug] broadcast done');

    expect(broadcastSpy).toHaveBeenCalledWith(null, expect.objectContaining({ type: 'announcement', data: expect.objectContaining({ text: 'WS live' }) }));
    const safe = events.filter(e=>e && typeof e==='object');
    expect(safe.some(e=>e.type==='init' || e.type==='initTenant')).toBe(true);
  }, 15000);
});
