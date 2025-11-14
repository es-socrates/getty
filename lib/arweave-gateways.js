function baseGateways() {
  return [
    'https://arweave.net',
    'https://ar-io.net',
    'https://arweave-search.goldsky.com',
    'https://permagate.io',
    'https://ar-io.dev',
    'https://zigza.xyz',
    'https://ario-gateway.nethermind.dev',
    'https://zerosettle.online',
  ];
}

function normalize(list) {
  return Array.from(
    new Set(
      list
        .filter(Boolean)
        .map((s) => s.trim())
        .filter((s) => !!s)
        .map((s) => (s.startsWith('http') ? s : `https://${s}`))
        .map((s) => s.replace(/\/$/, ''))
    )
  );
}

function applyEnv(list) {
  let out = list.slice();
  try {
    if (process.env.GETTY_ARWEAVE_EXTRA_GATEWAYS) {
      out.push(
        ...process.env.GETTY_ARWEAVE_EXTRA_GATEWAYS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  } catch {}
  try {
    if (process.env.GETTY_ARWEAVE_GATEWAY_EXCLUDE) {
      const excl = new Set(
        process.env.GETTY_ARWEAVE_GATEWAY_EXCLUDE.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
      out = out.filter((g) => !excl.has(g) && !excl.has(g.replace(/^https?:\/\//, '')));
    }
  } catch {}
  out = normalize(out);
  try {
    if (process.env.GETTY_ARWEAVE_REQUIRE_HTTPS === '1') {
      out = out.filter((g) => /^https:\/\//i.test(g));
    }
  } catch {}
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGatewayList(opts = {}) {
  const stableCount = Number(opts.stableCount || process.env.GETTY_ARWEAVE_STABLE_COUNT || 4);
  const max = Number(opts.max || process.env.GETTY_ARWEAVE_MAX_GATEWAYS || 16);
  const shuffleTail =
    typeof opts.shuffleTail === 'boolean'
      ? opts.shuffleTail
      : process.env.GETTY_ARWEAVE_SHUFFLE_TAIL === '1';

  let list = applyEnv(baseGateways());
  if (shuffleTail && list.length > stableCount) {
    const head = list.slice(0, stableCount);
    const tail = list.slice(stableCount);
    shuffle(tail);
    list = head.concat(tail);
  }
  if (max > 0 && list.length > max) list = list.slice(0, max);
  return list;
}

module.exports = { buildGatewayList };
