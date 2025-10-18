CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stream_tenants (
  tenant_id TEXT PRIMARY KEY,
  claim_id TEXT,
  admin_namespace TEXT,
  pub_namespace TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_namespace),
  UNIQUE (pub_namespace),
  UNIQUE (claim_id)
);

CREATE TABLE IF NOT EXISTS stream_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES stream_tenants (tenant_id) ON DELETE CASCADE,
  segment_start TIMESTAMPTZ NOT NULL,
  segment_end TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'poller',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_segment JSONB,
  ingest_version TEXT NOT NULL DEFAULT 'v1',
  CHECK (segment_end IS NULL OR segment_end >= segment_start)
);

CREATE INDEX IF NOT EXISTS stream_sessions_tenant_start_idx
  ON stream_sessions (tenant_id, segment_start DESC);
CREATE INDEX IF NOT EXISTS stream_sessions_tenant_end_idx
  ON stream_sessions (tenant_id, segment_end DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS stream_samples (
  tenant_id TEXT NOT NULL REFERENCES stream_tenants (tenant_id) ON DELETE CASCADE,
  session_id UUID REFERENCES stream_sessions (session_id) ON DELETE SET NULL,
  sample_at TIMESTAMPTZ NOT NULL,
  live BOOLEAN NOT NULL,
  viewers INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  ingest_version TEXT NOT NULL DEFAULT 'v1',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, sample_at)
);

SELECT create_hypertable(
  'stream_samples',
  'sample_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS stream_samples_tenant_sample_idx
  ON stream_samples (tenant_id, sample_at DESC);
CREATE INDEX IF NOT EXISTS stream_samples_tenant_live_idx
  ON stream_samples (tenant_id, live, sample_at DESC);
CREATE INDEX IF NOT EXISTS stream_samples_session_idx
  ON stream_samples (session_id, sample_at DESC);

ALTER TABLE stream_samples
  SET (timescaledb.compress, timescaledb.compress_segmentby = 'tenant_id', timescaledb.compress_orderby = 'sample_at DESC');

SELECT add_compression_policy('stream_samples', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('stream_samples', INTERVAL '400 days', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS stream_import_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES stream_tenants (tenant_id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  imported_segments INTEGER NOT NULL DEFAULT 0,
  imported_samples INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  details JSONB
);

CREATE INDEX IF NOT EXISTS stream_import_jobs_tenant_idx
  ON stream_import_jobs (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS stream_schema_version (
  migration_id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
