#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { getStorage, STORAGE_PROVIDERS } = require('../lib/storage');

async function main() {
  const [, , inputPathArg, bucketArg] = process.argv;
  const bucket = bucketArg || 'test-uploads';
  if (!inputPathArg) {
    console.error('Usage: node scripts/test-arweave-upload.js <filePath> [bucketName]');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(inputPathArg)
    ? inputPathArg
    : path.join(process.cwd(), inputPathArg);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const storage = getStorage(STORAGE_PROVIDERS.TURBO);
  if (!storage || storage.provider !== STORAGE_PROVIDERS.TURBO) {
    console.error('Turbo storage is not configured. Set ARWEAVE_JWK_PATH or TURBO_ARWEAVE_JWK and STORAGE_PROVIDER=turbo.');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const fileSize = fileBuffer.length;
  const fileName = path.basename(absolutePath);
  const contentType = guessMimeType(fileName);

  console.log(`Uploading ${fileName} (${fileSize} bytes) via ${storage.provider}...`);
  const start = performance.now();
  const result = await storage.uploadFile(bucket, fileName, fileBuffer, { contentType });
  const durationMs = performance.now() - start;

  console.log('Upload complete:');
  console.log(JSON.stringify({
    provider: storage.provider,
    bucket,
    transactionId: result.transactionId,
    publicUrl: result.publicUrl,
    size: result.size || fileSize,
    durationMs: Number(durationMs.toFixed(2)),
  }, null, 2));

  if (typeof storage.getUploadCosts === 'function') {
    try {
      const costs = await storage.getUploadCosts(fileSize);
      const [cost] = Array.isArray(costs) ? costs : [];
      if (cost) {
        console.log('Estimated Turbo cost:', JSON.stringify(cost, null, 2));
      }
    } catch (error) {
      console.warn('Failed to fetch upload cost estimate:', error.message);
    }
  }
}

function guessMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.gif':
      return 'image/gif';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

main().catch((error) => {
  console.error('Turbo upload test failed:', error);
  process.exit(1);
});
