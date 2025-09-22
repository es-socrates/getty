/* eslint-env node */
/* global require, module */
const process = require('node:process');

function freshServer(envOverrides = {}) {
  const originalEnv = { ...process.env };

  try { delete require.cache[require.resolve('../../server')]; } catch {}
  try { delete require.cache[require.resolve('../../lib/test-open-mode')]; } catch {}

  for (const [k,v] of Object.entries(envOverrides)) {
    if (v === null) {

      delete process.env[k];
      if (k === 'GETTY_REQUIRE_SESSION') {

        process.env.GETTY_REQUIRE_SESSION = '0';
      } else if (k === 'REDIS_URL') {

        process.env.REDIS_URL = '';
      }
    } else {
      process.env[k] = v;
    }
  }

  if (!('GETTY_TEST_OPEN_MODE' in envOverrides) && !process.env.REDIS_URL && process.env.GETTY_REQUIRE_SESSION !== '1') {
    process.env.GETTY_TEST_OPEN_MODE = '1';
  }

  if (!('DONT_LOAD_DOTENV' in envOverrides)) {
    process.env.DONT_LOAD_DOTENV = '1';
  }

  process.env.NODE_ENV = 'test';
  const app = require('../../server');
  const restore = () => {
    try { if (app && typeof app.disposeGetty === 'function') app.disposeGetty(); } catch {}

    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    for (const [k,v] of Object.entries(originalEnv)) process.env[k] = v;
    try { delete require.cache[require.resolve('../../server')]; } catch {}
  try { delete require.cache[require.resolve('../../lib/test-open-mode')]; } catch {}
  };
  return { app, restore };
}

module.exports = { freshServer };
