import { reactive } from 'vue';
import i18n from '../i18n';

export const toasts = reactive([]);
let id = 0;

// Flexible pushToast:
// 1) pushToast('Message text', 'success', 4000)
// 2) pushToast({ message:'Message text', type:'success', timeout:4000 })
// 3) pushToast({ i18nKey:'urlCopied', type:'success', params:{}, timeout:3000 })
export function pushToast(arg, type = 'info', timeout = 3000) {
  let message = '';
  let finalType = type;
  let finalTimeout = timeout;

  if (typeof arg === 'string') {
    message = arg;
  } else if (arg && typeof arg === 'object') {
    if (arg.message) message = arg.message;
    if (arg.type) finalType = arg.type;
    if (typeof arg.timeout === 'number') finalTimeout = arg.timeout;
    if (!message && arg.i18nKey) {
      const { i18nKey, params } = arg;
      if (i18n.global?.te?.(i18nKey)) {
        message = i18n.global.t(i18nKey, params || {});
      } else {
        message = i18nKey;
      }
    } else if (message && i18n.global?.te?.(message) && arg.autoTranslate !== false) {
      message = i18n.global.t(message);
    }
  } else {
    message = String(arg);
  }

  const toast = { id: ++id, message, type: finalType };
  toasts.push(toast);
  if (finalTimeout) setTimeout(() => removeToast(toast.id), finalTimeout);
  return toast.id;
}

export function removeToast(tid) {
  const idx = toasts.findIndex(t => t.id === tid);
  if (idx >= 0) toasts.splice(idx, 1);
}
