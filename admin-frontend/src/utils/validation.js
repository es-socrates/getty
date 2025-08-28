export const MAX_TITLE_LEN = 120;
export const MAX_ANNOUNCEMENT_IMAGE = 512 * 1024; // 512 KB
export const MAX_GIF_SIZE = 1024 * 1024; // 1 MB
export const MAX_AUDIO_SIZE = 1024 * 1024; // 1 MB
export const MAX_CUSTOM_ICON_SIZE = 120 * 1024; // 120 KB
export const MAX_RAFFLE_IMAGE = 1024 * 1024; // 1 MB (raffle prize image)

export function isHttpUrl(str) {
  if (!str) return false;
  return /^https?:\/\//i.test(str.trim());
}

export function withinRange(value, min, max) {
  if (value == null || value === '') return false;
  return value >= min && value <= max;
}

export function fileSizeUnder(file, maxBytes) {
  if (!file) return true;
  return file.size <= maxBytes;
}

export function notEmpty(str) {
  return !!(str && str.trim());
}

export function isLikelyWallet(addr) {
  if (!addr) return false;
  return addr.trim().length >= 5;
}

const AR_RX = /^[A-Za-z0-9_-]{43}$/;
export function isArweaveAddress(addr) {
  try {
    if (typeof addr !== 'string') return false;
    const s = addr.trim();
    if (!s) return false;
    if (!AR_RX.test(s)) return false;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 2 ? '==' : (b64.length % 4 === 3 ? '=' : '');
    const decoded = atob(b64 + pad);
    if (decoded.length !== 32) return false;
    const u8 = new Uint8Array(32);
    for (let i = 0; i < 32; i++) u8[i] = decoded.charCodeAt(i);
    let re = '';
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    re = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return re === s;
  } catch {
    return false;
  }
}
