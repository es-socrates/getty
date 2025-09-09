import { reactive } from 'vue';

const state = reactive({
  open: false,
  title: '',
  description: '',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  danger: true,
  resolve: null,
});

export function useConfirmState() {
  return state;
}

export function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    state.title = options.title || 'Are you sure?';
    state.description = options.description || 'This action cannot be undone.';
    state.confirmText = options.confirmText || 'Continue';
    state.cancelText = options.cancelText || 'Cancel';
    state.danger = options.danger !== undefined ? !!options.danger : true;
    state.resolve = resolve;
    state.open = true;
  });
}

export function resolveConfirm(result) {
  try {
    if (typeof state.resolve === 'function') state.resolve(!!result);
  } finally {
    state.open = false;
    state.resolve = null;
  }
}
