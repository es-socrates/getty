const request = require('supertest');
const app = require('../server');

describe('SocialMedia config validation', () => {
  it('rejects invalid config payload type', async () => {
    const res = await request(app)
      .post('/api/socialmedia-config')
      .send({ config: { platform: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  it('accepts valid config array', async () => {
    const res = await request(app)
      .post('/api/socialmedia-config')
      .send({ config: [{ platform: 'x', enabled: true, url: 'https://odysee.com/you', handle: '@you' }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
