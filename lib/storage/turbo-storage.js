const fs = require('fs');
const path = require('path');
const { TurboFactory } = require('@ardrive/turbo-sdk');

const DEFAULT_TOKEN_TYPE = process.env.TURBO_TOKEN_TYPE || 'arweave';
const DEFAULT_GATEWAY_URL = process.env.TURBO_GATEWAY_URL || process.env.TURBO_API_URL || undefined;
const EXTRA_TAGS = parseTags(process.env.TURBO_UPLOAD_TAGS || '');
let cachedPrivateKey = null;
let cachedPrivateKeySource = null;
let storageInstance = null;

function parseTags(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (!name || !value) return null;
      return { name: name.trim(), value: value.trim() };
    })
    .filter(Boolean);
}

function resolvePrivateKey({ reload = false } = {}) {
  if (!reload && cachedPrivateKey) {
    return { key: cachedPrivateKey, source: cachedPrivateKeySource };
  }

  const inlineKey = process.env.TURBO_ARWEAVE_JWK || process.env.ARWEAVE_JWK || '';
  if (inlineKey) {
    try {
      cachedPrivateKey = JSON.parse(inlineKey);
      cachedPrivateKeySource = 'env';
      return { key: cachedPrivateKey, source: cachedPrivateKeySource };
    } catch (error) {
      console.warn('[turbo-storage] Failed to parse inline JWK JSON:', error.message);
    }
  }

  const filePath = process.env.ARWEAVE_JWK_PATH || process.env.TURBO_ARWEAVE_JWK_PATH || '';
  if (filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      const fileContents = fs.readFileSync(absolutePath, 'utf8');
      cachedPrivateKey = JSON.parse(fileContents);
      cachedPrivateKeySource = absolutePath;
      return { key: cachedPrivateKey, source: cachedPrivateKeySource };
    } catch (error) {
      console.warn('[turbo-storage] Failed to read JWK file:', error.message);
    }
  }

  cachedPrivateKey = null;
  cachedPrivateKeySource = null;
  return { key: null, source: null };
}

function isTurboConfigured() {
  return !!resolvePrivateKey().key;
}

class TurboStorage {
  constructor(options = {}) {
    const { key } = resolvePrivateKey();
    if (!key) {
      throw new Error('Turbo storage not configured. Provide ARWEAVE_JWK_PATH or TURBO_ARWEAVE_JWK.');
    }
    this.privateKey = key;
    this.provider = 'turbo';
    this.tokenType = options.tokenType || DEFAULT_TOKEN_TYPE;
    this.gatewayUrl = options.gatewayUrl || DEFAULT_GATEWAY_URL;
    this.extraTags = Array.isArray(options.extraTags) ? options.extraTags : EXTRA_TAGS;
    this.clientPromise = null;
  }

  async ensureClient() {
    if (!this.clientPromise) {
      const config = {
        privateKey: this.privateKey,
        token: this.tokenType,
      };
      if (this.gatewayUrl) {
        config.gatewayUrl = this.gatewayUrl;
      }
      this.clientPromise = TurboFactory.authenticated(config);
    }
    return this.clientPromise;
  }

  async uploadFile(bucket, fileName, fileData, options = {}) {
    const turbo = await this.ensureClient();
    if (!fileData) {
      throw new Error('Cannot upload empty file');
    }

    const buffer = Buffer.isBuffer(fileData)
      ? fileData
      : Buffer.from(fileData);

    const resolvedOptions = typeof options === 'string' ? { contentType: options } : { ...options };
    const contentType = resolvedOptions.contentType || resolvedOptions.mimeType || 'application/octet-stream';
    const userTags = Array.isArray(resolvedOptions.tags)
      ? resolvedOptions.tags.filter((t) => t && t.name && t.value)
      : [];

    const uniqueName = buildUniqueName(fileName || 'file');

    const tags = [
      { name: 'Content-Type', value: contentType },
      { name: 'App-Name', value: 'Getty-Storage' },
      { name: 'Storage-Bucket', value: bucket || 'default' },
      { name: 'Storage-Key', value: uniqueName },
    ];

    if (fileName) {
      tags.push({ name: 'Original-Filename', value: path.basename(fileName) });
    }

    for (const tag of this.extraTags) {
      tags.push(tag);
    }
    for (const tag of userTags) {
      tags.push(tag);
    }

    const uploadResult = await turbo.upload({
      data: buffer,
      dataItemOpts: { tags },
    });

    const id = uploadResult.id || uploadResult?.dataItem?.id;
    if (!id) {
      throw new Error('Turbo upload response missing transaction id');
    }

    return {
      success: true,
      path: id,
      publicUrl: buildPublicUrl(id, this.gatewayUrl),
      bucket,
      fileName: uniqueName,
      originalName: fileName || null,
      provider: this.provider,
      transactionId: id,
      size: buffer.length,
    };
  }

  async deleteFile(bucket, filePath) {
    void bucket;
    void filePath;
    console.warn('[turbo-storage] Delete requested but Arweave data is permanent.');
    return { success: false, deleted: false };
  }

  getPublicUrl(_bucket, filePath) {
    if (!filePath) return null;
    return buildPublicUrl(filePath, this.gatewayUrl);
  }

  async getUploadCosts(byteCounts) {
    const turbo = await this.ensureClient();
    const list = Array.isArray(byteCounts) ? byteCounts : [Number(byteCounts) || 0];
    return turbo.getUploadCosts({ bytes: list });
  }

  isConfigured() {
    return isTurboConfigured();
  }
}

function buildPublicUrl(id, gatewayUrl) {
  const base = gatewayUrl || 'https://arweave.net';
  return `${base.replace(/\/$/, '')}/${id}`;
}

function buildUniqueName(name) {
  const ext = path.extname(name || '');
  const trimmed = ext ? name.slice(0, -ext.length) : name;
  const safeBase = (trimmed || 'file')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 10);
  return `${safeBase || 'file'}-${timestamp}-${randomId}${ext || ''}`;
}

function getTurboStorage() {
  if (!storageInstance) {
    if (!isTurboConfigured()) {
      console.warn('[turbo-storage] Turbo not configured. Uploads will fail.');
      return null;
    }
    storageInstance = new TurboStorage();
  }
  return storageInstance;
}

module.exports = {
  TurboStorage,
  getTurboStorage,
  isTurboConfigured,
  parseTags,
  resolvePrivateKey,
};
