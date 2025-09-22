/* eslint-env node */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDirFor(filePath) {
  try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); } catch {}
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(v => stableStringify(v)).join(',') + ']';
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function computeChecksum(dataObj) {
  const json = stableStringify(dataObj);
  return crypto.createHash('sha256').update(json).digest('hex');
}

function isWrapped(obj) {
  return obj && typeof obj === 'object' && '__version' in obj && 'checksum' in obj && 'data' in obj;
}

function readHybridConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { data: {}, meta: { existed: false } };
    const rawTxt = fs.readFileSync(filePath, 'utf8');
    let parsed = {};
    try { parsed = JSON.parse(rawTxt); } catch { return { data: {}, meta: { existed: true, corrupt: true } }; }
    if (isWrapped(parsed)) {
      return {
        data: (parsed.data && typeof parsed.data === 'object') ? parsed.data : {},
        meta: {
          existed: true,
            wrapped: true,
            __version: parsed.__version,
            checksum: parsed.checksum,
            updatedAt: parsed.updatedAt
        }
      };
    }
    return { data: (parsed && typeof parsed === 'object') ? parsed : {}, meta: { existed: true, wrapped: false, legacy: true } };
  } catch (e) {
    return { data: {}, meta: { existed: false, error: e.message } };
  }
}

function writeHybridConfig(filePath, dataObj) {
  const { data: prevData, meta: prevMeta } = readHybridConfig(filePath);
  const prevChecksum = prevMeta && prevMeta.checksum ? prevMeta.checksum : computeChecksum(prevData);
  const nextChecksum = computeChecksum(dataObj || {});
  let nextVersion = 1;
  if (prevMeta && prevMeta.__version && prevChecksum !== nextChecksum) {
    nextVersion = prevMeta.__version + 1;
  } else if (prevMeta && prevMeta.__version && prevChecksum === nextChecksum) {
    nextVersion = prevMeta.__version;
  }
  const wrapped = {
    __version: nextVersion,
    checksum: nextChecksum,
    updatedAt: new Date().toISOString(),
    data: dataObj || {}
  };
  try {
    ensureDirFor(filePath);
    fs.writeFileSync(filePath, JSON.stringify(wrapped, null, 2));
  } catch (e) {
    return { error: e.message, meta: { failed: true } };
  }
  return { meta: { __version: nextVersion, checksum: nextChecksum, updatedAt: wrapped.updatedAt, wrapped: true } };
}

function unwrapMaybeHybrid(obj) {
  if (isWrapped(obj)) return obj.data;
  return obj;
}

module.exports = {
  readHybridConfig,
  writeHybridConfig,
  unwrapMaybeHybrid,
  computeChecksum,
  ensureDirFor
};
