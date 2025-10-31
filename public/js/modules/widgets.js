import { loadScriptOnce, markLoaded } from './loadScript.js';

export async function loadLastTip() {
  try {
    const m = await import('./last-tip.js');
    if (m && typeof m.initLastTip === 'function') await m.initLastTip();
  } catch {
    await loadScriptOnce('/js/min/last-tip.js', 'last-tip-js');
  }
  markLoaded('last-tip');
}
export async function loadTipGoal() {
  try {
    const m = await import('./tip-goal.js');
    if (m && typeof m.initTipGoal === 'function') await m.initTipGoal();
  } catch {
    await loadScriptOnce('/js/min/tip-goal.js', 'tip-goal-js');
  }
  markLoaded('tip-goal');
}
export async function loadTipWidget() {
  await loadNotifications();
  markLoaded('tip-widget');
}
export async function loadNotifications() {
  try {
    const m = await import('./tip-notification.js');
    if (m && typeof m.initNotifications === 'function') await m.initNotifications();
  } catch {
    await loadScriptOnce('/js/min/tip-notification.js', 'tip-notification-js');
  }
  markLoaded('tip-notification');
}
export async function loadChat() {
  try {
    const m = await import('./chat.js');
    if (m && typeof m.initChat === 'function') await m.initChat();
  } catch {
    await loadScriptOnce('/js/min/chat.js', 'chat-js');
  }
  markLoaded('chat');
}
export async function loadRaffle() {
  try {
    const m = await import('./raffle.js');
    if (m && typeof m.initRaffle === 'function') await m.initRaffle();
  } catch {
    await loadScriptOnce('/js/min/raffle.js', 'raffle-js');
  }
  markLoaded('raffle');
}
export async function loadAppStatus() {
  try {
    const m = await import('./app-status.js');
    if (m && typeof m.initAppStatus === 'function') m.initAppStatus();
  } catch {
    await loadScriptOnce('/js/min/app.js', 'app-js');
  }
  markLoaded('app');
}
