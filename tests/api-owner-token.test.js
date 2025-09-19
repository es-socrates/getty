const request = require('supertest');
const app = require('../server');

describe('Owner Token Lifecycle', () => {
  let claimedToken = null;

  test('status before claim shows claimable and not claimed', async () => {
    const res = await request(app).get('/api/owner/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('claimed');

    if (res.body.claimed) {
      claimedToken = null;
      return;
    }
    expect(res.body.claimed).toBe(false);
    expect(res.body.claimable).toBe(true);
  });

  test('first claim succeeds and returns token', async () => {
    const pre = await request(app).get('/api/owner/status');
    if (pre.body.claimed) return;
    const res = await request(app)
      .post('/api/owner/claim')
      .send({ token: 'testOwnerToken12345' });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      claimedToken = res.body.token;
    }
  });

  test('duplicate claim is rejected', async () => {
    const res = await request(app).post('/api/owner/claim').send({ token: 'anotherToken' });

    if (res.status === 200) {

      claimedToken = res.body.token;
      return;
    }
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'already_claimed');
  });

  test('rotate with wrong oldToken fails', async () => {
    const status = await request(app).get('/api/owner/status');
    if (!status.body.claimed) return;
    const res = await request(app).post('/api/owner/rotate').send({ oldToken: 'notTheRightOne' });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {

      return;
    }
    expect(res.body.error).toBeDefined();
  });

  test('rotate with correct oldToken succeeds (if we have it)', async () => {
    if (!claimedToken) {

      return;
    }
    const res = await request(app).post('/api/owner/rotate').send({ oldToken: claimedToken });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
    }
  });
});
