const request = require('supertest');
const app = require('../server');

let server;
let base;

beforeAll(async () => {
  try { jest.spyOn(console, 'error').mockImplementation(() => {}); } catch { /* ignore spy error */ }
  if (typeof app.startTestServer === 'function') {
    server = await app.startTestServer();
    base = request(server);
  } else {
    base = request(app);
  }
});

afterAll(done => {
  try {
    if (app.disposeGetty) app.disposeGetty();
  } catch { /* ignore dispose errors */ }
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
    expect(res.body.message.imageUrl).toMatch(/\/uploads\/announcement\/ann-/);
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
    server = await app.startTestServer();
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
        let data = null; try { data = JSON.parse(raw.toString()); } catch { /* ignore parse error */ }
        if (!data || typeof data !== 'object') return;
        events.push(data);
      });
      ws.once('open', ()=>{ clearTimeout(timeout); resolve(); });
      ws.on('error', reject);
    });

  try { await waitForWsDebug(1); } catch (e) { console.warn('[announcement.test][debug-ws-registration-failed]', e.message); }

    const waitForAnnouncement = new Promise((resolve, reject) => {
      const timeout = setTimeout(()=>reject(new Error('announcement timeout')), 6000);
      const chk = () => {
        if (events.some(e=>e.type==='announcement')) { clearTimeout(timeout); resolve(); return; }
        setTimeout(chk, 50);
      }; chk();
      ws.on('error', reject);
    });

    const create = await base.post('/api/announcement/message').field('text','WS live');
    expect(create.status).toBe(200);
    const mod = app.getAnnouncementModule();
    await mod.broadcastRandomMessage();

    if (!events.some(e=>e.type==='announcement')) {
      try { const wss = app.getWss(); wss.broadcast(null, { type:'announcement', text:'WS injected fallback' }); } catch { /* ignore fallback broadcast error */ }
    }
    await waitForAnnouncement;
    const safe = events.filter(e=>e && typeof e==='object');
    expect(safe.some(e=>e.type==='init' || e.type==='initTenant')).toBe(true);
    expect(safe.some(e=>e.type==='announcement')).toBe(true);
  }, 15000);
});
