/* global module, require, global */
module.exports = async () => {
  try {
    const WS = require('./tests/mocks/ws');
    if (WS && typeof WS.__reset === 'function') WS.__reset();
  } catch { /* ignore ws reset errors */ }
  try {
    if (global.__GETTY_HTTP_SERVER__ && typeof global.__GETTY_HTTP_SERVER__.close === 'function') {
      await new Promise(res => global.__GETTY_HTTP_SERVER__.close(() => res()));
    }
  } catch { /* ignore server close errors */ }
  try {
    if (global.__GETTY_WSS__ && typeof global.__GETTY_WSS__.close === 'function') {
      global.__GETTY_WSS__.clients?.forEach(c => { try { c.terminate(); } catch {} });
      await new Promise(res => global.__GETTY_WSS__.close(() => res()));
    }
  } catch { /* ignore wss close errors */ }
  try {
    if (global.__GETTY_REDIS__ && typeof global.__GETTY_REDIS__.quit === 'function') {
      await global.__GETTY_REDIS__.quit();
    }
  } catch { /* ignore redis close */ }
};
