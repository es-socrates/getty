/* eslint-env node */
/* global require, module */
const process = require('node:process');
const fs = require('fs');
const path = require('path');

function freshServer(envOverrides = {}) {
  const originalEnv = { ...process.env };

  try { delete require.cache[require.resolve('../../server')]; } catch {}
  try { delete require.cache[require.resolve('../../lib/test-open-mode')]; } catch {}

  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const supabaseUrlMatch = envContent.match(/^SUPABASE_URL=(.+)$/m);
      const supabaseKeyMatch = envContent.match(/^SUPABASE_ANON_KEY=(.+)$/m);
      if (supabaseUrlMatch && !process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = supabaseUrlMatch[1];
      }
      if (supabaseKeyMatch && !process.env.SUPABASE_ANON_KEY) {
        process.env.SUPABASE_ANON_KEY = supabaseKeyMatch[1];
      }
    } catch {
      // Ignore .env parsing errors
    }
  }

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
