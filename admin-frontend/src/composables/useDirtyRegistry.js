const registry = [];
export function registerDirty(fn) {
  if (typeof fn === 'function' && !registry.includes(fn)) registry.push(fn);
}
export function anyDirty() {
  return registry.some((fn) => {
    try {
      return fn();
    } catch {
      return false;
    }
  });
}
export function clearDirty(fn) {
  if (fn) {
    const idx = registry.indexOf(fn);
    if (idx >= 0) registry.splice(idx, 1);
  } else {
    registry.splice(0, registry.length);
  }
}
