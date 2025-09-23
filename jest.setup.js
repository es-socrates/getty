/* eslint-env node, jest */
if (typeof globalThis.setImmediate === 'undefined') {
  globalThis.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

if (typeof global.crypto === 'undefined') {
  const crypto = require('crypto');
  global.crypto = {
    getRandomValues: (arr) => crypto.randomFillSync(arr),
    subtle: crypto.webcrypto && crypto.webcrypto.subtle ? crypto.webcrypto.subtle : undefined,
  };
}

if (process.env.NODE_ENV === 'test') {
  try {
  jest.mock('ws', () => require('./tests/mocks/ws'));
  jest.mock('obs-websocket-js', () => ({ OBSWebSocket: class MockOBS { async connect(){ return { connected:true }; } async call(){ return {}; } on(){} off(){} } }));

  jest.mock('./lib/arweave-gateways', () => ({
    buildGatewayList: () => [
      'https://arweave.net',
      'https://ar-io.net',
      'https://arweave.live',
      'https://arweave-search.goldsky.com',
      'https://permagate.io',
      'https://ar-io.dev',
      'https://ar.io',
      'https://arweave-search.g8way.io',
      'https://zigza.xyz',
      'https://ario-gateway.nethermind.dev',
      'https://zerosettle.online'
    ]
  }));

  jest.mock('ioredis', () => {
    const EventEmitter = require('events');
    class RedisMock extends EventEmitter {
      constructor() {
        super();
        this.data = new Map();
      }
      connect() { this.emit('ready'); return Promise.resolve(); }
      disconnect() {}
      async get(key) { return this.data.get(key) || null; }
      async set(key, value) { this.data.set(key, value); return 'OK'; }
      async del(key) { return this.data.delete(key) ? 1 : 0; }
      hget() { return Promise.resolve(null); }
      hset() { return Promise.resolve(1); }
      hdel() { return Promise.resolve(1); }
      expire() { return Promise.resolve(1); }
      ttl() { return Promise.resolve(-1); }
    }
    return RedisMock;
  });

  const nock = require('nock');
  nock.disableNetConnect();

  const arweaveHosts = [
    'arweave.net',
    'ar-io.net',
    'arweave.live',
    'arweave-search.goldsky.com',
    'permagate.io',
    'ar-io.dev',
    'ar.io',
    'arweave-search.g8way.io',
    'zigza.xyz',
    'ario-gateway.nethermind.dev',
    'zerosettle.online'
  ];

  arweaveHosts.forEach(host => {
    nock(`https://${host}`)
      .persist()
      .post('/graphql')
      .reply(200, {
        data: {
          transactions: {
            edges: []
          }
        }
      });
  });

  nock('https://api.coingecko.com')
    .persist()
    .get('/api/v3/simple/price')
    .query(true)
    .reply(200, {
      arweave: {
        usd: 10.0
      }
    });

  nock('http://localhost:3000')
    .persist()
    .get('/api/ar-price')
    .reply(200, {
      arweave: {
        usd: 10.0
      }
    });

    try {
      const fs = require('fs');
      const path = require('path');
      const cfgDir = path.join(process.cwd(), 'config');
      if (fs.existsSync(cfgDir)) {
        const entries = fs.readdirSync(cfgDir);
        const targets = entries.filter(f => /^(tip-goal-config|last-tip-config)(\.[0-9]+)?\.json$/i.test(f));
        for (const f of targets) {
          try { fs.unlinkSync(path.join(cfgDir, f)); } catch { /* ignore unlink errors */ }
        }
      }
    } catch { /* ignore cleanup errors */ }
  } catch { /* ignore */ }
}let __configSandbox = null;
try {
  if (process.env.NODE_ENV === 'test') {
    const { setupConfigSandbox } = require('./tests/helpers/configSandbox');
    __configSandbox = setupConfigSandbox([
      'last-tip-config.json',
      'tip-goal-config.json',
      'goal-audio-settings.json',
      'chat-config.json'
    ]);
  }
} catch { /* ignore sandbox errors */ }

try {
  const __origErr = console.error;
  console.error = (...args) => {
    try {
      const first = args[0] && String(args[0]);
      if (first && (
        first.includes('Cross origin http://localhost forbidden') ||
        first.includes('Error parsing message from client:')
      )) return;
    } catch { /* ignore */ }
    __origErr(...args);
  };
} catch { /* ignore console patch */ }

if (typeof globalThis.setImmediate === 'undefined') {
  globalThis.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

afterAll(() => {
  try {
    const WS = require('./tests/mocks/ws');
    if (WS && typeof WS.__reset === 'function') WS.__reset();
  } catch { /* ignore */ }
  try { if (__configSandbox && typeof __configSandbox.cleanup === 'function') __configSandbox.cleanup(); } catch { /* ignore */ }
});
