/* eslint-env node */
function computeOpenTestMode() {
  const forceOpen = process.env.GETTY_TEST_FORCE_OPEN === '1';
  const requireSession = process.env.GETTY_REQUIRE_SESSION === '1';
  const autoCandidate =
    process.env.NODE_ENV === 'test' && !process.env.REDIS_URL && !requireSession;
  const value = forceOpen
    ? true
    : !requireSession && (process.env.GETTY_TEST_OPEN_MODE === '1' || autoCandidate);
  if (process.env.NODE_ENV === 'test' && process.env.GETTY_TEST_OPEN_MODE_DEBUG === '1') {
    try {
      console.warn(
        '[openTestMode]',
        JSON.stringify({
          NODE_ENV: process.env.NODE_ENV,
          REDIS_URL: !!process.env.REDIS_URL,
          GETTY_REQUIRE_SESSION: process.env.GETTY_REQUIRE_SESSION,
          GETTY_TEST_OPEN_MODE: process.env.GETTY_TEST_OPEN_MODE,
          computed: value,
          forceOpen,
          requireSession,
          dynamic: true,
        })
      );
    } catch {}
  }
  return value;
}

function isOpenTestMode() {
  return computeOpenTestMode();
}
Object.defineProperty(module.exports, 'openTestMode', { get: () => computeOpenTestMode() });
module.exports.isOpenTestMode = isOpenTestMode;
module.exports.computeOpenTestMode = computeOpenTestMode;
