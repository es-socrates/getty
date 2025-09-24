const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline;
beforeAll(() => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
afterAll(() => { try { restoreBaseline && restoreBaseline(); } catch {} });

function makeMinimalGif(width, height) {
  const buf = Buffer.alloc(10);
  buf.write('GIF89a'); // 6 bytes signature
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

async function uploadGif(width, height, position = 'right') {
  const gifBuffer = makeMinimalGif(width, height);
  return request(appRef)
    .post('/api/tip-notification-gif')
    .field('position', position)
    .attach('gifFile', gifBuffer, { filename: 'test.gif', contentType: 'image/gif' });
}

describe('Tip Notification GIF API', () => {
  beforeAll(() => {
    const cfgDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
  });

  test('DELETE resets config safely (idempotent)', async () => {
  const res = await request(appRef).delete('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, gifPath: '', position: 'right' });
  });

  test('GET returns default-like structure', async () => {
  const res = await request(appRef).get('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('gifPath');
    expect(res.body).toHaveProperty('position');
    expect(res.body).toHaveProperty('width');
    expect(res.body).toHaveProperty('height');
  });

  test('Rejects non-GIF file', async () => {
  const res = await request(appRef)
      .post('/api/tip-notification-gif')
      .field('position', 'left')
      .attach('gifFile', Buffer.from('not a gif'), { filename: 'file.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only GIF/i);
  });

  test('Accepts large dimension GIF (now scaled client-side only)', async () => {
    const res = await uploadGif(1200, 800, 'top');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.width).toBe(1200);
    expect(res.body.height).toBe(800);
  });

  test('Accepts valid GIF and stores config', async () => {
    const res = await uploadGif(120, 100, 'left');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.position).toBe('left');
    expect(res.body.width).toBe(120);
    expect(res.body.height).toBe(100);
    expect(res.body.gifPath).toMatch(/https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/notification-gifs\//);
  });

  test('Updates position without re-uploading file', async () => {
  const res = await request(appRef)
      .post('/api/tip-notification-gif')
      .field('position', 'bottom');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.position).toBe('bottom');
    expect(res.body.gifPath).toMatch(/https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/notification-gifs\//);
    expect(res.body.width).toBeGreaterThan(0);
  });

  test('DELETE removes stored GIF data', async () => {
  const res = await request(appRef).delete('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.gifPath).toBe('');
    expect(res.body.width).toBe(0);
    expect(res.body.height).toBe(0);
  });
});
