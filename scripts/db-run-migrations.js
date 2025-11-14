'use strict';

/**
 * Simple migration runner for PostgreSQL/TimescaleDB.
 * Executes SQL files in db/migrations ordered by filename.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

async function main() {
  const connectionString = process.env.GETTY_PG_URI || process.env.DATABASE_URL || null;
  const sslEnabled = process.env.GETTY_PG_SSL === '1' || process.env.PGSSLMODE === 'require';

  if (!connectionString && !process.env.PGHOST) {
    console.error(
      'Missing PostgreSQL connection details. Set GETTY_PG_URI or standard PG* env vars.'
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.toLowerCase().endsWith('.sql'))
      .sort();

    await client.query(`
      CREATE TABLE IF NOT EXISTS stream_schema_version (
        migration_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRows = await client.query('SELECT migration_id FROM stream_schema_version');
    const applied = new Set(appliedRows.rows.map((row) => row.migration_id));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.warn(`Running migration ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO stream_schema_version (migration_id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.warn(`Migration ${file} applied.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration ${file} failed:`, err);
        process.exitCode = 1;
        return;
      }
    }

    console.warn('Migrations complete.');
  } catch (err) {
    console.error('Migration runner error:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  main();
}
