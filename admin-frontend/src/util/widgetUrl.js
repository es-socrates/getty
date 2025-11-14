export function widgetUrlBase(path) {
  try {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  } catch {
    return path;
  }
}

export function buildWidgetUrl(path) {
  return widgetUrlBase(path);
}

export function widgetUrlForChannel(widgetName, channel, opts = {}) {
  const { token } = opts;
  const safeChannel = encodeURIComponent(channel || '').replace(/%20/g, '+');
  return buildWidgetUrl(`/widgets/${widgetName}/${safeChannel}`, token);
}

export function chatWidgetUrl(channel, opts = {}) {
  return widgetUrlForChannel('chat', channel, opts);
}
export function lastTipWidgetUrl(channel, opts = {}) {
  return widgetUrlForChannel('last-tip', channel, opts);
}
export function raffleWidgetUrl(channel, opts = {}) {
  return widgetUrlForChannel('raffle', channel, opts);
}
export function tipGoalWidgetUrl(channel, opts = {}) {
  return widgetUrlForChannel('tip-goal', channel, opts);
}
