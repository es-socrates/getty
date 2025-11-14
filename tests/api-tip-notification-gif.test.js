const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { freshServer } = require('./helpers/freshServer');
let appRef; let restoreBaseline;
beforeAll(() => { ({ app: appRef, restore: restoreBaseline } = freshServer({ REDIS_URL: null, GETTY_REQUIRE_SESSION: null, GETTY_ENFORCE_OWNER_WRITES: '0', GETTY_REQUIRE_ADMIN_WRITE: '0' })); });
afterAll(() => { try { restoreBaseline && restoreBaseline(); } catch {} });

const configDir = path.join(process.cwd(), 'config');
const gifLibraryFile = path.join(configDir, 'tip-notification-gif-library.json');
const gifConfigFile = path.join(configDir, 'tip-notification-config.json');

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
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  });

  test('DELETE resets config safely (idempotent)', async () => {
  const res = await request(appRef).delete('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, gifPath: '', position: 'right', libraryId: '' });
  });

  test('GET returns default-like structure', async () => {
  const res = await request(appRef).get('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('gifPath');
    expect(res.body).toHaveProperty('position');
    expect(res.body).toHaveProperty('width');
    expect(res.body).toHaveProperty('height');
    expect(res.body).toHaveProperty('libraryId');
  });

  test('Library endpoint returns array shape', async () => {
  const res = await request(appRef).get('/api/tip-notification-gif/library');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
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
    expect(res.body).toHaveProperty('libraryId');
  });

  test('Accepts valid GIF and stores config', async () => {
    const res = await uploadGif(120, 100, 'left');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.position).toBe('left');
    expect(res.body.width).toBe(120);
    expect(res.body.height).toBe(100);
    expect(res.body).toHaveProperty('libraryId');
    expect(res.body.gifPath).toMatch(/^https?:\/\/.+/);
  });

  test('Updates position without re-uploading file', async () => {
  const res = await request(appRef)
      .post('/api/tip-notification-gif')
      .field('position', 'bottom');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.position).toBe('bottom');
    expect(res.body.gifPath).toMatch(/^https?:\/\/.+/);
    expect(res.body.width).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('libraryId');
  });

  test('DELETE removes stored GIF data', async () => {
  const res = await request(appRef).delete('/api/tip-notification-gif');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.gifPath).toBe('');
    expect(res.body.width).toBe(0);
    expect(res.body.height).toBe(0);
    expect(res.body.libraryId).toBe('');
  });

  test('Library delete removes Supabase item and clears active config', async () => {
    const entry = {
      id: 'lib-supabase-1',
      url: 'https://cdn.example.com/gifs/lib-supabase-1.gif',
      provider: 'supabase',
      path: 'tenant-demo/lib-supabase-1.gif',
      uploadedAt: new Date().toISOString(),
    };
    const previousLibrary = fs.existsSync(gifLibraryFile)
      ? fs.readFileSync(gifLibraryFile, 'utf8')
      : null;
    const previousConfig = fs.existsSync(gifConfigFile)
      ? fs.readFileSync(gifConfigFile, 'utf8')
      : null;
    try {
      fs.writeFileSync(gifLibraryFile, JSON.stringify([entry], null, 2));
      fs.writeFileSync(
        gifConfigFile,
        JSON.stringify(
          {
            gifPath: entry.url,
            position: 'left',
            width: 120,
            height: 120,
            libraryId: entry.id,
            storageProvider: 'supabase',
          },
          null,
          2
        )
      );
      const res = await request(appRef).delete('/api/tip-notification-gif/library/lib-supabase-1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, cleared: true });
      const libraryState = JSON.parse(fs.readFileSync(gifLibraryFile, 'utf8'));
      expect(Array.isArray(libraryState)).toBe(true);
      expect(libraryState).toHaveLength(0);
      const cfgState = JSON.parse(fs.readFileSync(gifConfigFile, 'utf8'));
      expect(cfgState.gifPath).toBe('');
      expect(cfgState.libraryId).toBe('');
    } finally {
      if (previousLibrary === null) {
        try {
          fs.unlinkSync(gifLibraryFile);
        } catch {}
      } else {
        fs.writeFileSync(gifLibraryFile, previousLibrary);
      }
      if (previousConfig === null) {
        try {
          fs.unlinkSync(gifConfigFile);
        } catch {}
      } else {
        fs.writeFileSync(gifConfigFile, previousConfig);
      }
    }
  });

  test('Library delete rejects non-Supabase providers', async () => {
    const entry = {
      id: 'lib-turbo-1',
      url: 'https://arweave.example/lib.gif',
      provider: 'turbo',
      path: 'ignored',
      uploadedAt: new Date().toISOString(),
    };
    const previousLibrary = fs.existsSync(gifLibraryFile)
      ? fs.readFileSync(gifLibraryFile, 'utf8')
      : null;
    try {
      fs.writeFileSync(gifLibraryFile, JSON.stringify([entry], null, 2));
      const res = await request(appRef).delete('/api/tip-notification-gif/library/lib-turbo-1');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('gif_library_delete_unsupported');
    } finally {
      if (previousLibrary === null) {
        try {
          fs.unlinkSync(gifLibraryFile);
        } catch {}
      } else {
        fs.writeFileSync(gifLibraryFile, previousLibrary);
      }
    }
  });
});
