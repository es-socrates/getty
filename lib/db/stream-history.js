'use strict';

const { getPool } = require('./index');

async function withClient(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function ensureTenant({ tenantId, claimId = null, adminNamespace = null, pubNamespace = null }) {
  if (!tenantId) throw new Error('tenantId required');
  const sql = `
    INSERT INTO stream_tenants (tenant_id, claim_id, admin_namespace, pub_namespace)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (tenant_id) DO UPDATE SET
      claim_id = EXCLUDED.claim_id,
      admin_namespace = EXCLUDED.admin_namespace,
      pub_namespace = EXCLUDED.pub_namespace,
      updated_at = NOW()
    RETURNING *
  `;
  const params = [tenantId, claimId, adminNamespace, pubNamespace];
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows[0];
}

async function openSession({ tenantId, segmentStart, source = 'poller', rawSegment = null, ingestVersion = 'v1' }) {
  if (!tenantId) throw new Error('tenantId required');
  if (!segmentStart) throw new Error('segmentStart required');
  const sql = `
    INSERT INTO stream_sessions (tenant_id, segment_start, source, raw_segment, ingest_version)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const params = [tenantId, segmentStart, source, rawSegment, ingestVersion];
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows[0];
}

async function closeSession({ sessionId, segmentEnd, rawSegment = null }) {
  if (!sessionId) throw new Error('sessionId required');
  if (!segmentEnd) throw new Error('segmentEnd required');
  const sql = `
    UPDATE stream_sessions
    SET segment_end = $2,
        raw_segment = COALESCE($3, raw_segment),
        updated_at = NOW()
    WHERE session_id = $1
    RETURNING *
  `;
  const params = [sessionId, segmentEnd, rawSegment];
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows[0] || null;
}

async function upsertSession({ tenantId, segmentStart, segmentEnd = null, source = 'poller', rawSegment = null, ingestVersion = 'v1' }) {
  if (!tenantId) throw new Error('tenantId required');
  if (!segmentStart) throw new Error('segmentStart required');
  const sql = `
    INSERT INTO stream_sessions (tenant_id, segment_start, segment_end, source, raw_segment, ingest_version)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (tenant_id, segment_start)
    DO UPDATE SET
      segment_end = COALESCE(EXCLUDED.segment_end, stream_sessions.segment_end),
      raw_segment = COALESCE(EXCLUDED.raw_segment, stream_sessions.raw_segment),
      updated_at = NOW()
    RETURNING *
  `;
  const params = [tenantId, segmentStart, segmentEnd, source, rawSegment, ingestVersion];
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows[0];
}

async function recordSample({ tenantId, sessionId = null, sampleAt, live, viewers = 0, payload = null, ingestVersion = 'v1' }) {
  if (!tenantId) throw new Error('tenantId required');
  if (!sampleAt) throw new Error('sampleAt required');
  const sql = `
    INSERT INTO stream_samples (tenant_id, session_id, sample_at, live, viewers, payload, ingest_version)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (tenant_id, sample_at) DO UPDATE SET
      session_id = COALESCE(EXCLUDED.session_id, stream_samples.session_id),
      live = EXCLUDED.live,
      viewers = EXCLUDED.viewers,
      payload = COALESCE(EXCLUDED.payload, stream_samples.payload),
      ingest_version = EXCLUDED.ingest_version,
      recorded_at = NOW()
    RETURNING *
  `;
  const params = [tenantId, sessionId, sampleAt, !!live, viewers, payload, ingestVersion];
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows[0];
}

async function latestSession({ tenantId }) {
  const sql = `
    SELECT *
    FROM stream_sessions
    WHERE tenant_id = $1
    ORDER BY segment_start DESC
    LIMIT 1
  `;
  const { rows } = await withClient((client) => client.query(sql, [tenantId]));
  return rows[0] || null;
}

async function latestSample({ tenantId }) {
  const sql = `
    SELECT *
    FROM stream_samples
    WHERE tenant_id = $1
    ORDER BY sample_at DESC
    LIMIT 1
  `;
  const { rows } = await withClient((client) => client.query(sql, [tenantId]));
  return rows[0] || null;
}

async function samplesInRange({ tenantId, start, end }) {
  if (!tenantId) throw new Error('tenantId required');
  const clauses = ['tenant_id = $1'];
  const params = [tenantId];
  if (start) {
    params.push(start);
    clauses.push(`sample_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    clauses.push(`sample_at <= $${params.length}`);
  }
  const sql = `
    SELECT *
    FROM stream_samples
    WHERE ${clauses.join(' AND ')}
    ORDER BY sample_at ASC
  `;
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows;
}

async function summarizeDaily({ tenantId, start, end }) {
  if (!tenantId) throw new Error('tenantId required');
  const params = [tenantId];
  const filters = ['tenant_id = $1'];
  if (start) {
    params.push(start);
    filters.push(`sample_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    filters.push(`sample_at <= $${params.length}`);
  }
  const sql = `
    WITH samples AS (
      SELECT sample_at, live, viewers
      FROM stream_samples
      WHERE ${filters.join(' AND ')}
    )
    SELECT
      time_bucket('1 day', sample_at) AS day_start,
      SUM(CASE WHEN live THEN extract(epoch FROM lead(sample_at, 1, sample_at) OVER (ORDER BY sample_at) - sample_at) ELSE 0 END) AS live_seconds,
      MAX(viewers) FILTER (WHERE live) AS peak_viewers
    FROM samples
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await withClient((client) => client.query(sql, params));
  return rows;
}

async function replaceTenantHistory({ tenantId, segments = [], samples = [], source = 'sync', ingestVersion = 'v1' }) {
  if (!tenantId) throw new Error('tenantId required');
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM stream_samples WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM stream_sessions WHERE tenant_id = $1', [tenantId]);

      const insertSessionSql = `
        INSERT INTO stream_sessions (tenant_id, segment_start, segment_end, source, raw_segment, ingest_version)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      for (const segment of segments) {
        const startEpoch = Number(segment?.start ?? segment?.segment_start ?? segment?.segmentStart);
        if (!Number.isFinite(startEpoch)) continue;
        const endValue = segment?.end == null ? null : Number(segment.end);
        const segmentStart = new Date(startEpoch);
        const segmentEnd = Number.isFinite(endValue) ? new Date(endValue) : null;
        const payload = segment?.raw_segment !== undefined ? segment.raw_segment : (segment?.payload !== undefined ? segment.payload : segment || null);
        await client.query(insertSessionSql, [
          tenantId,
          segmentStart,
          segmentEnd,
          segment?.source || source,
          payload,
          segment?.ingest_version || ingestVersion
        ]);
      }

      if (samples.length) {
        const insertSampleSql = `
          INSERT INTO stream_samples (tenant_id, session_id, sample_at, live, viewers, payload, ingest_version)
          VALUES ($1, NULL, $2, $3, $4, $5, $6)
          ON CONFLICT (tenant_id, sample_at) DO UPDATE SET
            live = EXCLUDED.live,
            viewers = EXCLUDED.viewers,
            payload = COALESCE(EXCLUDED.payload, stream_samples.payload),
            ingest_version = EXCLUDED.ingest_version,
            recorded_at = NOW()
        `;
        for (const sample of samples) {
          const sampleEpoch = Number(sample?.ts ?? sample?.sample_at ?? sample?.sampleAt);
          if (!Number.isFinite(sampleEpoch)) continue;
          const sampleAt = new Date(sampleEpoch);
          const rawViewers = Number(sample?.viewers);
          const viewers = Number.isFinite(rawViewers) ? rawViewers : 0;
          const payload = sample?.payload !== undefined ? sample.payload : sample || null;
          await client.query(insertSampleSql, [
            tenantId,
            sampleAt,
            !!sample?.live,
            viewers,
            payload,
            sample?.ingest_version || ingestVersion
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

module.exports = {
  ensureTenant,
  openSession,
  closeSession,
  upsertSession,
  recordSample,
  latestSession,
  latestSample,
  samplesInRange,
  summarizeDaily,
  replaceTenantHistory
};
