const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { loadTenantConfig, saveTenantConfig } = require('../lib/tenant-config');
const { resolveLiveviewsMetrics } = require('../services/metrics/liveviews');

const USER_PROFILE_FILENAME = 'user-profile-config.json';
const USER_PROFILE_CONFIG_FILE = path.join(process.cwd(), 'config', USER_PROFILE_FILENAME);
const LIVEVIEWS_CONFIG_FILE = path.join(process.cwd(), 'config', 'liveviews-config.json');
const STREAM_HISTORY_CONFIG_FILE = path.join(process.cwd(), 'config', 'stream-history-config.json');
const SHARE_INDEX_FILE = path.join(process.cwd(), 'config', 'user-profile-share-index.json');
const SHARE_INDEX_KEY = 'getty:user-profile:share-index';
const SHARE_CACHE_TTL_MS = 5 * 60 * 1000;

function registerUserProfileRoutes(app, options = {}) {
  const store = options.store || null;
  const channelCache = new Map();

  function ensureHelpers() {
    const helpers = app.locals.streamHistoryHelpers;
    if (!helpers || typeof helpers.makeReqLike !== 'function') {
      throw new Error('stream history helpers unavailable');
    }
    return helpers;
  }

  function defaultConfig() {
    return {
      shareEnabled: false,
      shareSlug: null,
      sections: {
        header: true,
        summary: true,
        lifetime: true,
        chart: true,
        recent: true,
      },
    };
  }

  function normalizeSections(value) {
    const base = defaultConfig().sections;
    if (!value || typeof value !== 'object') return { ...base };
    return {
      header: value.header !== false,
      summary: value.summary !== false,
      lifetime: value.lifetime !== false,
      chart: value.chart !== false,
      recent: value.recent !== false,
    };
  }

  function normalizeConfig(raw) {
    const base = defaultConfig();
    if (!raw || typeof raw !== 'object') return base;
    const shareSlug = typeof raw.shareSlug === 'string' ? raw.shareSlug.trim() : null;
    const safeSlug = shareSlug && /^[a-z0-9-]{8,32}$/i.test(shareSlug) ? shareSlug : null;
    return {
      shareEnabled: raw.shareEnabled === true,
      shareSlug: safeSlug,
      sections: normalizeSections(raw.sections),
    };
  }

  function ensureDirFor(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function readShareIndexFile() {
    try {
      if (!fs.existsSync(SHARE_INDEX_FILE)) return {};
      const parsed = JSON.parse(fs.readFileSync(SHARE_INDEX_FILE, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeShareIndexFile(map) {
    try {
      ensureDirFor(SHARE_INDEX_FILE);
      fs.writeFileSync(SHARE_INDEX_FILE, JSON.stringify(map, null, 2));
    } catch {}
  }

  async function lookupShareSlug(slug) {
    if (!slug) return null;
    if (store && store.redis) {
      try {
        const ns = await store.redis.hget(SHARE_INDEX_KEY, slug);
        if (typeof ns === 'string') return ns || null;
      } catch {}
      return null;
    }
    const map = readShareIndexFile();
    const ns = map[slug];
    return typeof ns === 'string' && ns ? ns : null;
  }

  async function assignShareSlug(slug, adminNs) {
    if (!slug) return;
    const value = adminNs || '__global__';
    if (store && store.redis) {
      try {
        await store.redis.hset(SHARE_INDEX_KEY, slug, value);
      } catch {}
      return;
    }
    const map = readShareIndexFile();
    map[slug] = value;
    writeShareIndexFile(map);
  }

  async function clearShareSlug(slug) {
    if (!slug) return;
    if (store && store.redis) {
      try {
        await store.redis.hdel(SHARE_INDEX_KEY, slug);
      } catch {}
      return;
    }
    const map = readShareIndexFile();
    if (map[slug]) {
      delete map[slug];
      writeShareIndexFile(map);
    }
  }

  async function resolveAdminNs(req) {
    if (req?.ns?.admin) return req.ns.admin;
    if (store) {
      try {
        if (req?.ns?.pub) {
          const mapped = await store.get(req.ns.pub, 'adminToken', null);
          if (mapped) return mapped;
        }
      } catch {}
      const token = (req?.query?.token || req?.body?.token || '').toString();
      if (token) {
        try {
          const mapped = await store.get(token, 'adminToken', null);
          return mapped || token;
        } catch {
          return token;
        }
      }
    }
    return null;
  }

  function buildShareUrl(req, slug) {
    if (!slug) return null;
    try {
      const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim() || req.protocol || 'https';
      const host = req.get('host');
      if (host) return `${proto}://${host}/profile/${slug}`;
    } catch {}
    return `/profile/${slug}`;
  }

  async function ensureShareSlug(_adminNs) {
    let slug;
    for (let attempt = 0; attempt < 5; attempt++) {
      slug = crypto.randomBytes(6).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
      if (slug.length < 8) continue;
      const existing = await lookupShareSlug(slug);
      if (!existing) break;
      slug = null;
    }
    return slug || `profile-${Date.now().toString(36)}`;
  }

  async function fetchChannelDetails(claimId) {
    if (!claimId || !/^[a-f0-9]{6,40}$/i.test(claimId)) return null;
    const cached = channelCache.get(claimId);
    const now = Date.now();
    if (cached && cached.expires > now) return cached.data;
    try {
      const resp = await axios.post(
        'https://api.na-backend.odysee.com/api/v1/proxy',
        {
          method: 'claim_search',
          params: { claim_ids: [claimId], page_size: 1, no_totals: true },
        },
        { timeout: 6000 }
      );
      const items = resp?.data?.result?.items || resp?.data?.data?.result?.items || [];
      const first = Array.isArray(items) && items.length ? items[0] : null;
      if (!first) return null;
      const uri = first.canonical_url || first.permanent_url || '';
      const webUrl = uri ? `https://odysee.com/${uri.replace(/^lbry:\/\//i, '').replace('#', ':')}` : '';
      const thumbnail = first.value?.thumbnail?.url || first.value?.thumbnail_url || '';
      const cover = first.value?.cover?.url || first.value?.cover_url || '';
      const followers = Number(first.meta?.follower_count || first.meta?.followers || 0);
      const channel = {
        claimId,
        name: first.name || '',
        title: first.value?.title || '',
        description: first.value?.description || '',
        thumbnail,
        cover,
        followers: Number.isFinite(followers) ? followers : 0,
        url: webUrl,
      };
      channelCache.set(claimId, { data: channel, expires: now + SHARE_CACHE_TTL_MS });
      return channel;
    } catch {
      return null;
    }
  }

  async function loadProfileConfig(reqLike) {
    try {
      const loaded = await loadTenantConfig(reqLike, store, USER_PROFILE_CONFIG_FILE, USER_PROFILE_FILENAME);
      if (loaded && loaded.data) return normalizeConfig(loaded.data);
    } catch {}
    return defaultConfig();
  }

  async function storeProfileConfig(reqOriginal, adminNs, config) {
    const reqLike = reqOriginal || { ns: { admin: adminNs || null } };
    await saveTenantConfig(reqLike, store, USER_PROFILE_CONFIG_FILE, USER_PROFILE_FILENAME, config);
  }

  async function resolveClaimId(reqLike) {
    const helpers = ensureHelpers();
    try {
      const cfg = await helpers.loadConfig(reqLike);
      if (cfg && typeof cfg.claimid === 'string' && cfg.claimid.trim()) return cfg.claimid.trim();
    } catch {}
    try {
      const loaded = await loadTenantConfig(reqLike, store, LIVEVIEWS_CONFIG_FILE, 'liveviews-config.json');
      if (loaded && loaded.data && typeof loaded.data.claimid === 'string' && loaded.data.claimid.trim()) {
        return loaded.data.claimid.trim();
      }
    } catch {}
    try {
      if (fs.existsSync(STREAM_HISTORY_CONFIG_FILE)) {
        const raw = JSON.parse(fs.readFileSync(STREAM_HISTORY_CONFIG_FILE, 'utf8'));
        if (raw && typeof raw.claimid === 'string' && raw.claimid.trim()) return raw.claimid.trim();
      }
    } catch {}
    return '';
  }

  async function buildOverviewPayload(req, adminNs, options = {}) {
    const helpers = ensureHelpers();
    const reqLike = helpers.makeReqLike(adminNs || null, null);
    reqLike.headers = req.headers;
    const period = (req.query?.period || 'day').toString();
    const span = Math.max(1, Math.min(365, parseInt(req.query?.span || '30', 10)));
    let tz = parseInt(req.query?.tz ?? '0', 10);
    if (Number.isNaN(tz)) tz = 0;
    tz = Math.max(-840, Math.min(840, tz));

    const hist = await helpers.loadHistory(reqLike);
    const summary = helpers.aggregate(hist, period, span, tz);
    const performance = helpers.computePerformance(hist, period, span, tz);
    const claimId = await resolveClaimId(reqLike);
    let liveStatus = { live: false, viewerCount: 0 };
    try {
      liveStatus = await resolveLiveviewsMetrics({
        req: reqLike,
        ns: adminNs || null,
        store,
        loadTenantConfig,
        liveviewsConfigPath: LIVEVIEWS_CONFIG_FILE,
        streamHistoryConfigPath: STREAM_HISTORY_CONFIG_FILE,
      });
    } catch {}
    const channel = await fetchChannelDetails(claimId);
    const config = await loadProfileConfig(reqLike);
    const shareUrl = config.shareEnabled && config.shareSlug ? buildShareUrl(req, config.shareSlug) : null;

    const payload = {
      claimId,
      channel: channel || { claimId },
      live: {
        isLive: !!liveStatus.live,
        viewerCount: Number(liveStatus.viewerCount || 0),
      },
      summary: {
        period,
        span,
        tzOffsetMinutes: tz,
        data: summary,
      },
      performance,
      sections: config.sections,
      generatedAt: new Date().toISOString(),
    };

    if (!options.shareContext) {
      payload.profile = {
        shareEnabled: config.shareEnabled,
        shareSlug: config.shareSlug,
        shareUrl,
      };
    }

    return payload;
  }

  app.get('/config/user-profile-config.json', async (req, res) => {
    try {
      const hasNs = !!(req?.ns?.admin || req?.ns?.pub);
      if (!hasNs && store) {
        return res.json(defaultConfig());
      }
      const config = await loadProfileConfig(req);
      const shareUrl = config.shareEnabled && config.shareSlug ? buildShareUrl(req, config.shareSlug) : null;
      res.json({ ...config, shareUrl });
    } catch (err) {
      res.status(500).json({ error: 'failed_to_load_user_profile_config', details: err?.message });
    }
  });

  app.post('/config/user-profile-config.json', async (req, res) => {
    const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
    try {
      const adminNs = await resolveAdminNs(req);
      const hasSession = !!(req?.ns?.admin || req?.ns?.pub);
      if ((requireSessionFlag || store) && !adminNs && !hasSession) {
        return res.status(401).json({ error: 'session_required' });
      }
      const incoming = req.body || {};
      const incomingSections = incoming.sections && typeof incoming.sections === 'object' ? incoming.sections : {};
      const shareEnabled = incoming.shareEnabled === true || incoming.shareEnabled === 'true';
      const merged = {
        shareEnabled,
        sections: normalizeSections(incomingSections),
      };
      let config = await loadProfileConfig(req);
      let shareSlug = config.shareSlug;
      if (shareEnabled) {
        if (!shareSlug) {
          shareSlug = await ensureShareSlug(adminNs);
        }
        merged.shareSlug = shareSlug;
        await assignShareSlug(shareSlug, adminNs);
      } else {
        if (shareSlug) {
          await clearShareSlug(shareSlug);
        }
        merged.shareSlug = null;
      }
      config = { ...config, ...merged };
      await storeProfileConfig(req, adminNs, config);
      const shareUrl = config.shareEnabled && config.shareSlug ? buildShareUrl(req, config.shareSlug) : null;
      res.json({ success: true, config: { ...config, shareUrl } });
    } catch (err) {
      res.status(500).json({ error: 'failed_to_save_user_profile_config', details: err?.message });
    }
  });

  app.get('/api/user-profile/overview', async (req, res) => {
    try {
      const requireSessionFlag = process.env.GETTY_REQUIRE_SESSION === '1';
      const adminNs = await resolveAdminNs(req);
      const hasSession = !!(req?.ns?.admin || req?.ns?.pub);
      if ((requireSessionFlag || store) && !adminNs && !hasSession) {
        return res.status(401).json({ error: 'session_required' });
      }
      const payload = await buildOverviewPayload(req, adminNs, { shareContext: false });
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: 'failed_to_build_profile_overview', details: err?.message });
    }
  });

  app.get('/api/user-profile/public/:slug', async (req, res) => {
    try {
      const slug = (req.params.slug || '').toString().trim().toLowerCase();
      if (!slug || !/^[a-z0-9-]{8,32}$/.test(slug)) {
        return res.status(404).json({ error: 'not_found' });
      }
      const adminNs = await lookupShareSlug(slug);
      if (!adminNs) return res.status(404).json({ error: 'not_found' });
      const helpers = ensureHelpers();
      const reqLike = helpers.makeReqLike(adminNs === '__global__' ? null : adminNs);
      reqLike.headers = req.headers;
      const config = await loadProfileConfig(reqLike);
      if (!config.shareEnabled || config.shareSlug !== slug) {
        await clearShareSlug(slug);
        return res.status(404).json({ error: 'not_found' });
      }
      const payload = await buildOverviewPayload(req, adminNs === '__global__' ? null : adminNs, {
        shareContext: true,
      });
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: 'failed_to_build_public_profile', details: err?.message });
    }
  });
}

module.exports = { registerUserProfileRoutes };
