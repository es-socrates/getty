'use strict';

const { Pool } = require('pg');

let pool = null;

function buildConfig() {
  const connectionString = process.env.GETTY_PG_URI || process.env.DATABASE_URL || null;
  const sslEnabled = process.env.GETTY_PG_SSL === '1' || process.env.PGSSLMODE === 'require';

  if (!connectionString && !process.env.PGHOST) {
    throw new Error('Missing PostgreSQL connection settings (set GETTY_PG_URI or PG* env vars).');
  }

  const config = connectionString ? { connectionString } : {};
  if (sslEnabled) {
    config.ssl = { rejectUnauthorized: false };
  }

  const max = Number(process.env.GETTY_PG_POOL_MAX || 10);
  if (Number.isFinite(max) && max > 0) {
    config.max = Math.floor(max);
  }

  const idleMs = Number(process.env.GETTY_PG_POOL_IDLE_MS || 30000);
  if (Number.isFinite(idleMs) && idleMs >= 0) {
    config.idleTimeoutMillis = Math.floor(idleMs);
  }

  return config;
}

function getPool() {
  if (!pool) {
    pool = new Pool(buildConfig());
    pool.on('error', (err) => {
      console.error('[pg] unexpected error on idle client', err);
    });
  }
  return pool;
}

async function closePool() {
  if (!pool) return;
  const ref = pool;
  pool = null;
  await ref.end();
}

module.exports = {
  getPool,
  closePool
};
