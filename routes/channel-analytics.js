const path = require('path');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const {
  buildChannelAnalytics,
  resolveChannelClaimId,
  normalizeRangeKey,
  fetchChannelIdentity,
} = require('../services/channel-analytics');

const CONFIG_FILENAME = 'channel-analytics-config.json';
const CONFIG_FILE_PATH = path.join(process.cwd(), 'config', CONFIG_FILENAME);

function readBooleanEnvFlag(key, defaultValue = true) {
  const raw = process.env[key];
  if (typeof raw !== 'string') return defaultValue;
  const trimmed = raw.trim();
  const commentIndex = trimmed.indexOf('#');
  const value = (commentIndex >= 0 ? trimmed.slice(0, commentIndex) : trimmed).trim();
  if (!value) return defaultValue;
  const normalized = value.toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(normalized);
}

function isAuthFormEnabled() {
  return readBooleanEnvFlag('ODYSEE_ANALYTICS_AUTH_FORM_ENABLED', true);
}

function getEnvAnalytics() {
  return {
    claimId: process.env.ODYSEE_ANALYTICS_CLAIM_ID || '',
    authToken: process.env.ODYSEE_ANALYTICS_AUTH_TOKEN || '',
    idToken: process.env.ODYSEE_ANALYTICS_ID_TOKEN || '',
    lbryId: process.env.ODYSEE_ANALYTICS_LBRY_ID || '',
  };
}

function resolveEffectiveSecrets(raw = {}) {
  const envValues = getEnvAnalytics();
  return {
    claimId: envValues.claimId || raw.claimId || '',
    authToken: envValues.authToken || raw.authToken || '',
    idToken: envValues.idToken || '',
    lbryId: envValues.lbryId || '',
  };
}

function sanitizeConfig(raw = {}, extras = {}) {
  const envValues = getEnvAnalytics();
  const effective = resolveEffectiveSecrets(raw);
  return {
    channelHandle: raw.channelHandle || '',
    claimId: effective.claimId || '',
    hasAuthToken: !!effective.authToken,
    authFormEnabled: isAuthFormEnabled(),
    updatedAt: raw.updatedAt || null,
    lastResolvedHandle: raw.lastResolvedHandle || '',
    lastResolvedAt: raw.lastResolvedAt || null,
    envOverrides: {
      claimId: !!envValues.claimId,
      authToken: !!envValues.authToken,
    },
    channelIdentity: extras.channelIdentity || null,
  };
}

function isClaimId(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

async function ensureSession(req, res) {
  const ns = req?.ns?.admin || req?.ns?.pub || null;
  if (!ns) {
    res.status(401).json({ error: 'session_required' });
    return null;
  }
  return ns;
}

function registerChannelAnalyticsRoutes(app, strictLimiter, options = {}) {
  const store = options.store || null;

  async function lookupChannelIdentity(config) {
    try {
      const effective = resolveEffectiveSecrets(config);
      if (!isClaimId(effective.claimId)) return null;
      return await fetchChannelIdentity(effective.claimId);
    } catch (err) {
      try {
        console.warn('[channel-analytics] channel identity lookup failed', err.message);
      } catch {}
      return null;
    }
  }

  app.get('/config/channel-analytics-config.json', strictLimiter, async (req, res) => {
    const ns = await ensureSession(req, res);
    if (!ns) return;
    try {
      const loaded = await loadTenantConfig(req, store, CONFIG_FILE_PATH, CONFIG_FILENAME);
      const config = loaded?.data || {};
      const identity = await lookupChannelIdentity(config);
      return res.json(sanitizeConfig(config, { channelIdentity: identity }));
    } catch (err) {
      try {
        console.warn('[channel-analytics] failed to load config', err.message);
      } catch {}
      return res.json(sanitizeConfig({}, { channelIdentity: null }));
    }
  });

  app.post('/config/channel-analytics-config.json', strictLimiter, async (req, res) => {
    const ns = await ensureSession(req, res);
    if (!ns) return;
    const body = req.body || {};
    try {
      const existingWrapped = await loadTenantConfig(req, store, CONFIG_FILE_PATH, CONFIG_FILENAME);
      const current = existingWrapped?.data || {};
      const allowAuthInput = isAuthFormEnabled();
      let nextAuth = current.authToken || '';
      const inputToken =
        allowAuthInput && typeof body.authToken === 'string' ? body.authToken.trim() : '';
      const clearToken =
        allowAuthInput && (body.clearAuthToken === '1' || body.clearAuthToken === 'true');
      if (allowAuthInput) {
        if (clearToken) nextAuth = '';
        else if (inputToken) nextAuth = inputToken;
      }

      const envValues = getEnvAnalytics();
      let nextClaim =
        typeof body.claimId === 'string' && body.claimId.trim()
          ? body.claimId.trim()
          : current.claimId || '';
      const providedHandle = typeof body.channelHandle === 'string' ? body.channelHandle.trim() : '';
      let resolvedHandleMeta = current.lastResolvedHandle || '';
      let resolvedAtMeta = current.lastResolvedAt || null;
      if (!isClaimId(nextClaim) && providedHandle) {
        const resolved = await resolveChannelClaimId(providedHandle);
        if (!resolved) {
          return res.status(400).json({ error: 'invalid_claim', message: 'Unable to resolve channel handle.' });
        }
        nextClaim = resolved;
        resolvedHandleMeta = providedHandle;
        resolvedAtMeta = new Date().toISOString();
      }

      if (!isClaimId(nextClaim) && !envValues.claimId) {
        return res.status(400).json({ error: 'missing_claim', message: 'Channel claim_id is required.' });
      }
      const effectiveAuthToken = envValues.authToken || nextAuth;
      if (!effectiveAuthToken && !(allowAuthInput && clearToken)) {
        return res.status(400).json({ error: 'missing_auth', message: 'auth_token is required.' });
      }

      const merged = {
        ...current,
        claimId: nextClaim,
        channelHandle: providedHandle || current.channelHandle || '',
        authToken: nextAuth,
        updatedAt: new Date().toISOString(),
        lastResolvedHandle: resolvedHandleMeta,
        lastResolvedAt: resolvedAtMeta,
      };

      await saveTenantConfig(req, store, CONFIG_FILE_PATH, CONFIG_FILENAME, merged);
      const identity = await lookupChannelIdentity(merged);
      return res.json({ success: true, config: sanitizeConfig(merged, { channelIdentity: identity }) });
    } catch (err) {
      try {
        console.error('[channel-analytics] failed to persist config', err.message || err);
      } catch {}
      return res.status(500).json({ error: 'config_save_failed' });
    }
  });

  app.get('/api/channel-analytics/overview', strictLimiter, async (req, res) => {
    const ns = await ensureSession(req, res);
    if (!ns) return;
    try {
      const loaded = await loadTenantConfig(req, store, CONFIG_FILE_PATH, CONFIG_FILENAME);
      const config = loaded?.data || {};
      const effective = resolveEffectiveSecrets(config);
      if (!isClaimId(effective.claimId)) {
        return res.status(400).json({ error: 'missing_claim' });
      }
      if (!effective.authToken) {
        return res.status(400).json({ error: 'missing_auth' });
      }
      const rangeKey = normalizeRangeKey(req.query?.range || 'week');
      const data = await buildChannelAnalytics({
        claimId: effective.claimId,
        authToken: effective.authToken,
        channelHandle: config.channelHandle || '',
        idToken: effective.idToken || undefined,
        lbryId: effective.lbryId || undefined,
        rangeKey,
      });
      return res.json({ data });
    } catch (err) {
      try {
        console.error('[channel-analytics] overview failed', err.message || err);
      } catch {}
      return res.status(502).json({ error: 'channel_analytics_failed' });
    }
  });
}

module.exports = registerChannelAnalyticsRoutes;
