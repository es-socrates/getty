const axios = require('axios');
const { URLSearchParams } = require('node:url');
const {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  formatISO,
  format,
} = require('date-fns');

const DEFAULT_PROXY_URL = 'https://api.na-backend.odysee.com/api/v1/proxy';
const DEFAULT_PUBLIC_API = 'https://api.odysee.com';
const DEFAULT_WEB_ORIGIN = 'https://odysee.com';

function normalizeApiBase(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let base = raw.trim();
  if (!base) return null;
  base = base.replace(/\s+/g, '');
  base = base.replace(/\/+$/, '');
  base = base.replace(/\/proxy$/i, '');
  if (!base) return null;
  if (/\/api\/v\d+$/i.test(base)) return base;
  if (/api\.na-backend/i.test(base) || /naked-api/i.test(base)) {
    return `${base}/api/v1`;
  }
  return base;
}

function normalizeProxyUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let candidate = raw.trim();
  if (!candidate) return null;
  candidate = candidate.replace(/\s+/g, '');
  if (/\/proxy$/i.test(candidate)) {
    return candidate.replace(/\/+$/, '');
  }
  const base = normalizeApiBase(candidate);
  if (!base) return null;
  return `${base}/proxy`;
}

function firstValid(candidates, normalizer) {
  for (const candidate of candidates) {
    const value = normalizer(candidate);
    if (value) return value;
  }
  return null;
}

function buildFormPayload(fields) {
  const params = new URLSearchParams();
  if (!fields || typeof fields !== 'object') return params;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      if (key === 'claim_ids') {
        for (const entry of value) {
          if (entry === undefined || entry === null) continue;
          params.append('claim_id', String(entry));
        }
      } else {
        for (const entry of value) {
          if (entry === undefined || entry === null) continue;
          params.append(`${key}[]`, String(entry));
        }
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

function buildFormHeaders(token, extras) {
  return {
    ...buildAuthHeaders(token, extras),
    Origin: ODYSEE_WEB_ORIGIN,
    Referer: `${ODYSEE_WEB_ORIGIN}/`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: '*/*',
  };
}

const ODYSEE_PROXY_URL =
  normalizeProxyUrl(process.env.ODYSEE_PROXY_URL) ||
  firstValid([process.env.LBRY_WEB_API_NO_CF, process.env.LBRY_WEB_API], normalizeProxyUrl) ||
  DEFAULT_PROXY_URL;

const ODYSEE_PUBLIC_API =
  normalizeApiBase(process.env.ODYSEE_PUBLIC_API) ||
  normalizeApiBase(process.env.LBRY_API_URL) ||
  DEFAULT_PUBLIC_API;
const ODYSEE_SUB_COUNT_URL = `${ODYSEE_PUBLIC_API}/subscription/sub_count`;
const ODYSEE_VIEW_COUNT_URL = `${ODYSEE_PUBLIC_API}/file/view_count`;
const ODYSEE_CHANNEL_STATS_URL = `${ODYSEE_PUBLIC_API}/channel/stats`;
const ODYSEE_WEB_ORIGIN = process.env.ODYSEE_WEB_ORIGIN || DEFAULT_WEB_ORIGIN;
const SUPPORTED_RANGES = ['day', 'week', 'month', 'halfyear', 'year'];

const RANGE_PRESETS = {
  day: {
    count: 14,
    startFn: (date) => startOfDay(date),
    addFn: (date) => addDays(date, 1),
    subFn: (date, amount) => subDays(date, amount),
    label: 'MMM d',
  },
  week: {
    count: 12,
    startFn: (date) => startOfWeek(date, { weekStartsOn: 1 }),
    addFn: (date) => addWeeks(date, 1),
    subFn: (date, amount) => subWeeks(date, amount),
    label: "'W'II",
  },
  month: {
    count: 12,
    startFn: (date) => startOfMonth(date),
    addFn: (date) => addMonths(date, 1),
    subFn: (date, amount) => subMonths(date, amount),
    label: 'MMM yyyy',
  },
  halfyear: {
    count: 6,
    startFn: (date) => startOfMonth(date),
    addFn: (date) => addMonths(date, 6),
    subFn: (date, amount) => subMonths(date, amount * 6),
    label: 'MMM yyyy',
  },
  year: {
    count: 5,
    startFn: (date) => startOfYear(date),
    addFn: (date) => addYears(date, 1),
    subFn: (date, amount) => subYears(date, amount),
    label: 'yyyy',
  },
};

function normalizeRangeKey(raw) {
  const candidate = String(raw || '').toLowerCase();
  if (SUPPORTED_RANGES.includes(candidate)) return candidate;
  return 'week';
}

function isClaimId(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function normalizePermanentUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, '').toLowerCase();
}

function coerceNumericCount(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/[,\s_]/g, '');
    const numeric = Number(sanitized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function extractClaimsInChannelCount(claimId, rawValue) {
  const direct = coerceNumericCount(rawValue);
  if (direct !== null) return direct;
  if (!rawValue || typeof rawValue !== 'object') return null;

  const normalizedId = typeof claimId === 'string' ? claimId.trim() : '';
  const candidateKeys = [];
  if (normalizedId) {
    candidateKeys.push(normalizedId);
    const lower = normalizedId.toLowerCase();
    const upper = normalizedId.toUpperCase();
    if (!candidateKeys.includes(lower)) candidateKeys.push(lower);
    if (!candidateKeys.includes(upper)) candidateKeys.push(upper);
  }

  for (const key of candidateKeys) {
    if (!key || rawValue[key] === undefined) continue;
    const numeric = coerceNumericCount(rawValue[key]);
    if (numeric !== null) return numeric;
  }

  for (const value of Object.values(rawValue)) {
    const numeric = coerceNumericCount(value);
    if (numeric !== null) return numeric;
  }

  return null;
}

function extractChannelClaimCountFromItem(claimId, item) {
  if (!item || typeof item !== 'object') return null;
  const directSources = [
    item.claims_in_channel,
    item.meta?.claims_in_channel,
    item.value?.meta?.claims_in_channel,
    item.signing_channel?.claims_in_channel,
    item.signing_channel?.meta?.claims_in_channel,
  ];
  for (const source of directSources) {
    const numeric = coerceNumericCount(source);
    if (numeric !== null) return numeric;
  }
  const signingMeta = item.signing_channel?.meta;
  if (signingMeta) {
    const inferred = extractClaimsInChannelCount(claimId, signingMeta);
    if (inferred !== null) return inferred;
  }
  return null;
}

function pickClaimSearchItems(response) {
  if (!response || typeof response !== 'object') return [];
  const layers = [response.result, response.data?.result, response.data, response];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    if (Array.isArray(layer.items) && layer.items.length) return layer.items;
  }
  return [];
}

function mapChannelIdentityFromClaim(item, claimId) {
  if (!item || typeof item !== 'object') return null;
  const value = item.value || {};
  const thumbnail = value.thumbnail?.url || value.cover?.url || item.thumbnail_url || null;
  return {
    claimId: claimId || item.claim_id || value.claim_id || null,
    name: item.name || value.name || null,
    title: value.title || value.metadata?.title || null,
    thumbnailUrl: thumbnail || null,
  };
}

async function fetchChannelIdentity(claimId) {
  if (!isClaimId(claimId)) return null;
  try {
    const resp = await axios.post(
      ODYSEE_PROXY_URL,
      {
        method: 'claim_search',
        params: {
          claim_ids: [claimId],
          claim_type: 'channel',
          page_size: 1,
          no_totals: true,
        },
      },
      { timeout: 7000 }
    );
    const items = pickClaimSearchItems(resp?.data) || [];
    const first = items[0];
    if (!first) return null;
    return mapChannelIdentityFromClaim(first, claimId);
  } catch (err) {
    try {
      console.warn('[channel-analytics] channel identity lookup failed', err.message);
    } catch {}
    return null;
  }
}

async function resolveChannelClaimId(handleOrClaim) {
  if (!handleOrClaim || typeof handleOrClaim !== 'string') return null;
  const trimmed = handleOrClaim.trim();
  if (!trimmed) return null;
  if (isClaimId(trimmed)) return trimmed.toLowerCase();
  const normalizedHandle = trimmed.replace(/^@/, '');
  const lbryUrl = `lbry://@${normalizedHandle}`;

  try {
    const resolveResp = await axios.post(
      ODYSEE_PROXY_URL,
      { method: 'resolve', params: { urls: [lbryUrl] } },
      { timeout: 7000 }
    );
    const result =
      resolveResp?.data?.result?.[lbryUrl] || resolveResp?.data?.data?.result?.[lbryUrl] || null;
    const claimId = result?.value?.claim_id || result?.claim_id || '';
    if (isClaimId(claimId)) return claimId.toLowerCase();
  } catch (err) {
    try {
      console.warn('[channel-analytics] resolve failed, falling back to claim_search', err.message);
    } catch {}
  }

  try {
    const searchResp = await axios.post(
      ODYSEE_PROXY_URL,
      {
        method: 'claim_search',
        params: { name: `@${normalizedHandle}`, claim_type: 'channel', page_size: 1, no_totals: true },
      },
      { timeout: 7000 }
    );
    const fallbackItem =
      searchResp?.data?.result?.items?.[0] || searchResp?.data?.data?.result?.items?.[0] || null;
    const claimId = fallbackItem?.claim_id || fallbackItem?.value?.claim_id || '';
    if (isClaimId(claimId)) return claimId.toLowerCase();
  } catch (err) {
    try {
      console.warn('[channel-analytics] claim_search fallback failed', err.message);
    } catch {}
  }
  return null;
}

async function fetchChannelStreams(claimId, limit = 200) {
  if (!isClaimId(claimId)) {
    return { streams: [], claimsInChannel: 0, totalItems: 0 };
  }
  const streams = [];
  const seen = new Set();
  let page = 1;
  let claimsInChannel = null;
  let totalItems = null;
  while (streams.length < limit) {
    const pageSize = Math.min(50, limit - streams.length);
    try {
      const resp = await axios.post(
        ODYSEE_PROXY_URL,
        {
          method: 'claim_search',
          params: {
            channel_ids: [claimId],
            claim_type: 'stream',
            order_by: ['release_time'],
            has_source: true,
            page_size: pageSize,
            page,
            no_totals: false,
          },
        },
        { timeout: 7000 }
      );
      const items =
        resp?.data?.result?.items ||
        resp?.data?.data?.result?.items ||
        resp?.data?.data?.items ||
        resp?.data?.items ||
        [];
      const metaSources = [
        resp?.data?.result,
        resp?.data?.data?.result,
        resp?.data?.data,
        resp?.data,
      ];
      for (const source of metaSources) {
        if (!source || typeof source !== 'object') continue;
        if (claimsInChannel === null && source.claims_in_channel !== undefined) {
          const numeric = extractClaimsInChannelCount(claimId, source.claims_in_channel);
          if (numeric !== null) claimsInChannel = numeric;
        }
        if (totalItems === null && source.total_items !== undefined) {
          const numeric = coerceNumericCount(source.total_items);
          if (numeric !== null) totalItems = numeric;
        }
      }
      if (!items || !items.length) break;
      for (const item of items) {
        const cid = item?.claim_id || item?.value?.claim_id;
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);
        if (claimsInChannel === null) {
          const channelCount = extractChannelClaimCountFromItem(claimId, item);
          if (channelCount !== null) claimsInChannel = channelCount;
        }
        const releaseRaw = item?.value?.release_time || item?.release_time || item?.timestamp || null;
        const releaseMs = releaseRaw ? Number(releaseRaw) * 1000 : null;
        streams.push({
          claimId: cid,
          releaseMs: Number.isFinite(releaseMs) ? releaseMs : null,
          title: item?.value?.title || item?.meta?.title || '',
          raw: item || {},
        });
        if (streams.length >= limit) break;
      }
      if (items.length < pageSize) break;
      page += 1;
    } catch (err) {
      try {
        console.error('[channel-analytics] claim_search failed', err.message);
      } catch {}
      break;
    }
  }
  const fallbackCount = streams.length;
  const normalizedClaims = Number.isFinite(claimsInChannel) ? claimsInChannel : null;
  const normalizedTotal = Number.isFinite(totalItems) ? totalItems : null;
  return {
    streams,
    claimsInChannel: normalizedClaims ?? normalizedTotal ?? fallbackCount,
    totalItems: normalizedTotal ?? normalizedClaims ?? fallbackCount,
  };
}

function buildAuthHeaders(token, extras = {}) {
  if (!token) return {};
  const cookies = [`auth_token=${token}`];
  if (extras.idToken) cookies.push(`lbry_id_token=${extras.idToken}`);
  const headers = {
    'X-Lbry-Auth-Token': token,
    Cookie: cookies.join('; '),
  };
  if (extras.lbryId) headers['X-Lbry-Id'] = extras.lbryId;
  return headers;
}

async function fetchSubscriptionCount(authToken, claimId, extras = {}) {
  if (!authToken || !isClaimId(claimId)) return 0;
  const headers = buildFormHeaders(authToken, extras);
  const payload = buildFormPayload({ auth_token: authToken, claim_id: claimId });
  try {
    const resp = await axios.post(
      ODYSEE_SUB_COUNT_URL,
      payload,
      { timeout: 7000, headers }
    );
    const counts = resp?.data?.data || resp?.data?.result || {};
    const value = counts?.sub_count || counts?.subscriptions || counts?.count || 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    try {
      console.warn('[channel-analytics] sub_count failed', err.message);
    } catch {}
    return 0;
  }
}


async function fetchViewCounts(authToken, claimTargets, extras = {}) {
  const map = new Map();
  if (!authToken || !Array.isArray(claimTargets) || !claimTargets.length) return map;
  const headers = buildFormHeaders(authToken, extras);
  for (const target of claimTargets) {
    if (!target.claimId && !target.permanentUrl) continue;
    const normalizedUrl = normalizePermanentUrl(target.permanentUrl);
    let handled = false;
    const payloadVariants = [];
    if (normalizedUrl) {
      payloadVariants.push(buildFormPayload({ auth_token: authToken, uris: [normalizedUrl] }));
    }
    if (target.claimId) {
      payloadVariants.push(buildFormPayload({ auth_token: authToken, claim_ids: [target.claimId] }));
    }
    for (let index = 0; index < payloadVariants.length; index += 1) {
      const payload = payloadVariants[index];
      try {
        const resp = await axios.post(
          ODYSEE_VIEW_COUNT_URL,
          payload,
          { timeout: 7000, headers }
        );
        const responseData = resp?.data?.data || resp?.data?.result || {};
        let value = null;
        if (typeof responseData === 'number') {
          value = responseData;
        } else if (Array.isArray(responseData) && responseData.length === 1) {
          value = Number(responseData[0]);
        } else if (responseData && typeof responseData === 'object') {
          if (Array.isArray(responseData.items) && responseData.items.length === 1) {
            const item = responseData.items[0];
            value = Number(item.view_count || item.views || item.count || item.total || item);
          } else {
            const keys = Object.keys(responseData);
            if (keys.length === 1) {
              value = Number(responseData[keys[0]]);
            }
          }
        }
        if (value !== null && Number.isFinite(value)) {
          map.set(target.claimId, value);
          handled = true;
          break;
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 400) {
          continue;
        }
        try {
          console.warn('[channel-analytics] view_count failed for claim', target.claimId || normalizedUrl, err.message);
        } catch {}
        break;
      }
    }
    if (!handled) {
      try {
        console.warn('[channel-analytics] view_count no valid response for claim', target.claimId || normalizedUrl);
      } catch {}
    }
  }
  return map;
}

async function fetchChannelStats({ authToken, channelHandle, claimId, extras = {} }) {
  if (!authToken) return null;
  const hasClaimId = isClaimId(claimId);
  const payload = buildFormPayload({
    auth_token: authToken,
    claim_id: hasClaimId ? claimId : undefined,
    channel_name: !hasClaimId && channelHandle ? channelHandle : undefined,
  });

  try {
    const resp = await axios.post(ODYSEE_CHANNEL_STATS_URL, payload, {
      timeout: 7000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '*/*',
        Origin: ODYSEE_WEB_ORIGIN,
        Referer: `${ODYSEE_WEB_ORIGIN}/`,
      },
    });
    return resp?.data?.data || null;
  } catch (err) {
    try {
      console.warn('[channel-analytics] channel/stats failed', err.message);
    } catch {}
    return null;
  }
}

function inferViewCountFromClaim(rawClaim) {
  if (!rawClaim || typeof rawClaim !== 'object') return 0;
  const meta = rawClaim.meta || rawClaim.value?.meta || {};
  const global = meta.global || {};
  const candidates = [
    global.views,
    global.view_count,
    global.viewer_count,
    global.downloads,
    meta.view_count,
    rawClaim.value?.meta?.view_count,
    rawClaim.value?.video?.views,
  ];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function createBuckets(rangeKey) {
  const preset = RANGE_PRESETS[rangeKey] || RANGE_PRESETS.week;
  const buckets = [];
  const now = new Date();
  for (let index = preset.count - 1; index >= 0; index -= 1) {
    const anchor = preset.subFn(now, index);
    const start = preset.startFn(anchor);
    const end = preset.addFn(start);
    const startMs = start.getTime();
    const endMs = end.getTime();
    buckets.push({
      key: `${rangeKey}-${startMs}`,
      startMs,
      endMs,
      startIso: formatISO(start),
      endIso: formatISO(new Date(endMs - 1)),
      label: format(start, preset.label),
      videos: 0,
      views: 0,
    });
  }
  return buckets;
}

function assignBucket(timestampMs, buckets) {
  if (!Number.isFinite(timestampMs)) return null;
  for (const bucket of buckets) {
    if (timestampMs >= bucket.startMs && timestampMs < bucket.endMs) return bucket;
  }
  return null;
}

async function buildChannelAnalytics({
  claimId,
  authToken,
  channelHandle,
  rangeKey = 'week',
  idToken,
  lbryId,
}) {
  if (!isClaimId(claimId)) {
    const err = new Error('missing_channel_claim');
    err.code = 'missing_channel_claim';
    throw err;
  }
  if (!authToken || typeof authToken !== 'string') {
    const err = new Error('missing_auth_token');
    err.code = 'missing_auth_token';
    throw err;
  }
  const normalizedRange = normalizeRangeKey(rangeKey);
  const authExtras = { idToken, lbryId };
  const [streamsResult, subscriberCount, channelStats] = await Promise.all([
    fetchChannelStreams(claimId, 200),
    fetchSubscriptionCount(authToken, claimId, authExtras),
    fetchChannelStats({ authToken, channelHandle, claimId, extras: authExtras }),
  ]);
  const safeStreamResult = streamsResult || {};
  const streams = Array.isArray(safeStreamResult.streams) ? safeStreamResult.streams : [];
  const absoluteVideoCount =
    safeStreamResult.claimsInChannel ?? safeStreamResult.totalItems ?? streams.length;
  const viewTargets = streams.map((item) => ({
    claimId: item.claimId,
    permanentUrl:
      item.raw?.permanent_url || item.raw?.canonical_url || item.raw?.short_url || null,
  }));
  const viewCounts = await fetchViewCounts(authToken, viewTargets, authExtras);
  const buckets = createBuckets(normalizedRange);
  const highlights = mapChannelStats(channelStats);
  const totals = {
    videos: absoluteVideoCount,
    views: highlights?.views || 0,
    subscribers: subscriberCount || 0,
  };

  let chartViewTotal = 0;
  for (const stream of streams) {
    const views = viewCounts.get(stream.claimId) ?? inferViewCountFromClaim(stream.raw);
    chartViewTotal += views;
    const bucket = assignBucket(stream.releaseMs, buckets);
    if (!bucket) continue;
    bucket.videos += 1;
    bucket.views += views;
  }

  if (!totals.views && chartViewTotal) {
    totals.views = chartViewTotal;
  }
  if (!totals.subscribers && highlights?.subs) {
    totals.subscribers = highlights.subs;
  }
  if (!totals.views && highlights?.views) {
    totals.views = highlights.views;
  }

  const bars = buckets
    .map((bucket) => ({
      key: bucket.key,
      start: bucket.startIso,
      end: bucket.endIso,
      label: bucket.label,
      videos: bucket.videos,
      views: bucket.views,
    }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    totals,
    bars,
    range: {
      key: normalizedRange,
      start: bars[0]?.start || null,
      end: bars[bars.length - 1]?.end || null,
    },
    updatedAt: new Date().toISOString(),
    highlights,
  };
}

function normalizeStatNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildOdyseeContentUrl(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const [name, claim] = trimmed.split(':');
  if (!name || !claim) return null;
  return `https://odysee.com/${name}:${claim}`;
}

function createVideoHighlight({ uri, title, views, change }) {
  if (!uri && !title) return null;
  return {
    uri: uri || null,
    title: title || null,
    views: normalizeStatNumber(views || 0),
    change: normalizeStatNumber(change || 0),
    url: buildOdyseeContentUrl(uri),
  };
}

function mapChannelStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    channelUri: raw.ChannelURI || null,
    subs: normalizeStatNumber(raw.ChannelSubs),
    subsChange: normalizeStatNumber(raw.ChannelSubChange),
    views: normalizeStatNumber(raw.AllContentViews),
    viewsChange: normalizeStatNumber(raw.AllContentViewChange),
    topAllTime: createVideoHighlight({
      uri: raw.VideoURITopAllTime,
      title: raw.VideoTitleTopAllTime,
      views: raw.VideoViewsTopAllTime,
      change: raw.VideoViewChangeTopAllTime,
    }),
    topNew: createVideoHighlight({
      uri: raw.VideoURITopNew,
      title: raw.VideoTitleTopNew,
      views: raw.VideoViewsTopNew,
      change: raw.VideoViewChangeTopNew,
    }),
    topCommented: createVideoHighlight({
      uri: raw.VideoURITopCommentNew,
      title: raw.VideoTitleTopCommentNew,
      views: raw.VideoCommentTopCommentNew,
      change: raw.VideoCommentChangeTopCommentNew,
    }),
  };
}

module.exports = {
  buildChannelAnalytics,
  resolveChannelClaimId,
  normalizeRangeKey,
  SUPPORTED_RANGES,
  fetchChannelStats,
  fetchChannelIdentity,
};
