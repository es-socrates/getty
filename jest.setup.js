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
  } catch { /* ignore */ }
}

let __configSandbox = null;
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
