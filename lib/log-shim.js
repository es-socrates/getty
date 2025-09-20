/* eslint-disable no-console */
(function applyLogShim(){
  try {
    const env = process.env || {};
    if (env.GETTY_FORCE_LOG === '1') return;
    const silence = env.CI === 'true' || env.CI === '1' || env.GETTY_SILENCE_LOG === '1';
    if (!silence) return;
  if (console.__GETTY_LOG_SHIM__) return;
  console.__GETTY_LOG_SHIM__ = true;
    const noop = () => {};

    if (console.log) console.log = noop;
    if (console.debug) console.debug = noop;
    if (console.info) console.info = noop;
  } catch { /* ignore */ }
})();
