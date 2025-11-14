/* eslint-env node */
const fs = require('fs');
const axios = require('axios');

const LIVEVIEWS_FONT_STACK =
  'Roobert, Tajawal, Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

function getLiveviewsConfigWithDefaults(partial) {
  return {
    bg: typeof partial?.bg === 'string' && partial.bg.trim() ? partial.bg : '#fff',
    color: typeof partial?.color === 'string' && partial.color.trim() ? partial.color : '#222',
    font:
      typeof partial?.font === 'string' && partial.font.trim()
        ? partial.font
        : LIVEVIEWS_FONT_STACK,
    size: typeof partial?.size === 'string' && partial.size.trim() ? partial.size : '32',
    icon: typeof partial?.icon === 'string' ? partial.icon : '',
    claimid: typeof partial?.claimid === 'string' ? partial.claimid : '',
    viewersLabel:
      typeof partial?.viewersLabel === 'string' && partial.viewersLabel.trim()
        ? partial.viewersLabel
        : 'viewers',
  };
}

async function resolveStreamHistoryClaimId({
  req,
  ns,
  store,
  loadTenantConfig,
  streamHistoryConfigPath,
  fsModule = fs,
}) {
  let claim = '';

  if (loadTenantConfig) {
    try {
      const wrapped = await loadTenantConfig(
        req,
        store,
        streamHistoryConfigPath,
        'stream-history-config.json'
      );
      if (wrapped && wrapped.data && typeof wrapped.data.claimid === 'string') {
        claim = wrapped.data.claimid;
      }
    } catch {}
  }

  if (!claim && store && ns) {
    try {
      const legacy = await store.get(ns, 'stream-history-config', null);
      if (legacy && typeof legacy.claimid === 'string') claim = legacy.claimid;
    } catch {}
  }

  if (!claim && streamHistoryConfigPath) {
    try {
      if (fsModule.existsSync(streamHistoryConfigPath)) {
        const raw = JSON.parse(fsModule.readFileSync(streamHistoryConfigPath, 'utf8'));
        if (raw && typeof raw.claimid === 'string') claim = raw.claimid;
      }
    } catch {}
  }

  return typeof claim === 'string' ? claim.trim() : '';
}

async function loadLiveviewsConfig({
  req,
  ns,
  store,
  loadTenantConfig,
  liveviewsConfigPath,
  fsModule = fs,
}) {
  let cfgData = null;

  if (loadTenantConfig) {
    try {
      const wrapped = await loadTenantConfig(
        req,
        store,
        liveviewsConfigPath,
        'liveviews-config.json'
      );
      if (wrapped && wrapped.data) cfgData = wrapped.data;
    } catch {}
  }

  if ((!cfgData || !cfgData.claimid) && store && ns) {
    try {
      const legacy = await store.get(ns, 'liveviews-config', null);
      if (legacy && typeof legacy === 'object') cfgData = { ...(cfgData || {}), ...legacy };
    } catch {}
  }

  if ((!cfgData || !cfgData.claimid) && liveviewsConfigPath) {
    try {
      if (fsModule.existsSync(liveviewsConfigPath)) {
        const raw = JSON.parse(fsModule.readFileSync(liveviewsConfigPath, 'utf8'));
        if (raw && typeof raw === 'object') cfgData = { ...(cfgData || {}), ...raw };
      }
    } catch {}
  }

  return cfgData || {};
}

async function resolveLiveviewsMetrics({
  req,
  ns,
  store,
  loadTenantConfig,
  liveviewsConfigPath,
  streamHistoryConfigPath,
  cache = Object.create(null),
  ttlMs = 10000,
  axiosInstance = axios,
  fsModule = fs,
}) {
  const liveviews = { live: false, viewerCount: 0 };
  const key = ns ? `ns:${ns}` : 'single';
  const now = Date.now();

  const baseCfg = await loadLiveviewsConfig({
    req,
    ns,
    store,
    loadTenantConfig,
    liveviewsConfigPath,
    fsModule,
  });

  if (!baseCfg.claimid) {
    const fallbackClaim = await resolveStreamHistoryClaimId({
      req,
      ns,
      store,
      loadTenantConfig,
      streamHistoryConfigPath,
      fsModule,
    });
    if (fallbackClaim) baseCfg.claimid = fallbackClaim;
  }

  const cfg = getLiveviewsConfigWithDefaults(baseCfg);
  const claimid = (cfg.claimid || '').trim();
  if (!claimid) return liveviews;

  const cached = cache[key];
  const cacheValid = cached && cached.claimid === claimid && now - cached.ts < ttlMs;
  if (cacheValid) {
    liveviews.live = !!cached.data.Live;
    liveviews.viewerCount =
      typeof cached.data.ViewerCount === 'number' ? cached.data.ViewerCount : 0;
    return liveviews;
  }

  try {
    const url = `https://api.odysee.live/livestream/is_live?channel_claim_id=${encodeURIComponent(claimid)}`;
    const resp = await axiosInstance.get(url, { timeout: 3000 });
    const data = resp?.data?.data || {};
    const out = {
      Live: !!data.Live,
      ViewerCount: typeof data.ViewerCount === 'number' ? data.ViewerCount : 0,
    };
    cache[key] = { ts: now, data: out, claimid };
    liveviews.live = out.Live;
    liveviews.viewerCount = out.ViewerCount;
  } catch {
    const stale = cache[key];
    if (stale && stale.claimid === claimid) {
      liveviews.live = !!stale.data.Live;
      liveviews.viewerCount =
        typeof stale.data.ViewerCount === 'number' ? stale.data.ViewerCount : 0;
    }
  }

  return liveviews;
}

module.exports = {
  getLiveviewsConfigWithDefaults,
  resolveStreamHistoryClaimId,
  resolveLiveviewsMetrics,
};
