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
