/* eslint-disable no-console */

const util = require('util');

const LEVELS = ['debug','info','warn','error'];
const DEFAULT_LEVEL = (process.env.GETTY_LOG_LEVEL || 'info').toLowerCase();
const FORCE = process.env.GETTY_FORCE_LOG === '1';
const CI = process.env.CI === 'true' || process.env.CI === '1';

function levelIndex(l){ const i = LEVELS.indexOf(l); return i === -1 ? LEVELS.indexOf('info') : i; }
const threshold = (() => {
  if (FORCE) return levelIndex('debug');
  if (CI) return levelIndex('warn');
  return levelIndex(DEFAULT_LEVEL);
})();

function emit(tag, level, parts){
  if (levelIndex(level) < threshold) return;
  const method = level === 'debug' || level === 'info' ? 'log' : level;
  const time = new Date().toISOString();
  try {
    if (parts.length === 1) {
      console[method](`[${time}][${tag}][${level}]`, parts[0]);
    } else {
      console[method](`[${time}][${tag}][${level}]`, util.format(...parts));
    }
  } catch { /* ignore logging failure */ }
}

module.exports = function makeLogger(tag){
  return {
    debug: (...a) => emit(tag, 'debug', a),
    info:  (...a) => emit(tag, 'info', a),
    warn:  (...a) => emit(tag, 'warn', a),
    error: (...a) => emit(tag, 'error', a)
  };
};
