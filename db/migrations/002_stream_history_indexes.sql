CREATE UNIQUE INDEX IF NOT EXISTS stream_sessions_tenant_start_uq
  ON stream_sessions (tenant_id, segment_start);
