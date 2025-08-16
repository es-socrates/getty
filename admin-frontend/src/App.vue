<template>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div
    class="admin-container mx-auto px-6 py-5 transition-[padding] duration-300 max-w-[1330px]"
    :class="{ dark: isDark, compact }"
  >
    <header class="flex items-center justify-between pb-5 mb-8 border-b border-border" role="banner">
      <div class="flex items-center gap-4">
  <RouterLink to="/admin/status" class="flex items-center gap-2" aria-label="Go to Status">
          <img :src="logoLight" alt="Getty Logo" class="h-9 logo-light" />
          <img :src="logoDark" alt="Getty Logo" class="h-9 logo-dark" />
        </RouterLink>
      </div>
      <div class="flex items-center gap-3 relative">
        <button @click="toggleTheme" class="theme-toggle" title="Toggle theme">
          <svg class="sun-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.52,9.22 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.22 6.91,16.84 7.51,17.35L3.36,17M20.65,7L18.88,10.77C18.74,10 18.47,9.22 18.05,8.5C17.63,7.78 17.09,7.16 16.49,6.65L20.65,7M20.64,17L16.5,17.35C17.1,16.84 17.64,16.22 18.06,15.5C18.48,14.78 18.75,14 18.89,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.86,19 13.67,18.83 14.41,18.56L12,22Z"
            />
          </svg>
          <svg class="moon-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.4 6.35,17.41C9.37,20.43 14,20.54 17.33,17.97Z"
            />
          </svg>
        </button>
        <button
          @click="toggleCompact"
          :class="['px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors', compact ? 'bg-card' : '']"
          :aria-pressed="compact.toString()"
          title="Compact mode"
        >
          📦
        </button>
        <div class="relative" @keyup.esc="menuOpen=false">
          <button
            @click="toggleMenu"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
            :aria-expanded="menuOpen.toString()"
            aria-haspopup="true"
          >
            <span class="font-medium">{{ currentLocaleLabel }}</span>
            <svg
              class="w-4 h-4 opacity-70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div
            v-show="menuOpen"
            class="absolute right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg p-2 z-50"
            role="menu"
          >
            <p class="px-2 py-1 text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              {{ t('language') }}
            </p>
            <ul class="space-y-1">
              <li>
                <button
                  @click="setLocale('en')"
                  class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[var(--bg-chat)]"
                  :class="{ 'bg-[var(--bg-chat)]': locale==='en' }"
                >
English
</button>
              </li>
              <li>
                <button
                  @click="setLocale('es')"
                  class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[var(--bg-chat)]"
                  :class="{ 'bg-[var(--bg-chat)]': locale==='es' }"
                >
Español
</button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
    <div
      class="admin-layout flex flex-col md:flex-row gap-5"
      :class="{ 'sidebar-collapsed': sidebarCollapsed }"
    >
      <aside
        class="admin-sidebar relative w-56 flex-shrink-0 transition-all duration-300"
        :class="{ 'w-16': sidebarCollapsed }"
        role="navigation"
        aria-label="Primary"
      >
        <button
          class="sidebar-toggle-btn"
          @click="toggleSidebar"
          :aria-pressed="sidebarCollapsed.toString()"
          :title="sidebarCollapsed ? 'Expand' : 'Collapse'"
        >
          <svg
            class="sidebar-toggle-icon w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <div class="sidebar-section">
          <h3 class="sidebar-title">Widgets</h3>
          <nav class="sidebar-nav">
            <RouterLink class="sidebar-link" active-class="active" to="/admin/status">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
              <span>{{ t('statusTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/chat">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8.5 8.5Z"
                  />
                </svg>
              </span>
              <span>{{ t('chat') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/last-tip">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 1v22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span>{{ t('lastTip') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/tip-goal">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </span>
              <span>{{ t('tipGoal') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/raffle">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M8 15h.01" />
                  <path d="M12 15h.01" />
                  <path d="M16 15h.01" />
                </svg>
              </span>
              <span>{{ t('raffleTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/notifications">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              <span>{{ t('notifications') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/liveviews">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <span>{{ t('liveviewsTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/social-media">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51 15.42 17.49" />
                  <path d="m15.41 6.51-6.82 3.98" />
                </svg>
              </span>
              <span>{{ t('socialMediaTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/announcement">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6l-5 4H4a1 1 0 0 0-1 1Z" />
                  <path d="M16 12h2" />
                  <path d="M16 8h2" />
                  <path d="M16 16h2" />
                </svg>
              </span>
              <span>{{ t('announcementTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link" active-class="active" to="/admin/external">
              <span class="icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M5 12a9 9 0 0 0 9 9" />
                  <path d="M5 12a9 9 0 0 1 9-9" />
                  <path d="M5 12H3" />
                  <path d="M12 5V3" />
                  <path d="M12 21v-2" />
                </svg>
              </span>
              <span>{{ t('externalNotificationsTitle') }}</span>
            </RouterLink>
          </nav>
        </div>
      </aside>
      <main class="admin-main flex-1 min-w-0" id="main" tabindex="-1" role="main">
        <RouterView />
      </main>
    </div>
    <ToastHost />
  </div>
</template>
<script setup>

import { useI18n } from 'vue-i18n';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import { watch, ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { anyDirty } from './composables/useDirtyRegistry';
import ToastHost from './components/shared/ToastHost.vue';
import logoLight from '../../public/assets/getty.png';
import logoDark from '../../public/assets/gettydark.png';

const { locale, t } = useI18n();
const route = useRoute();
const router = useRouter();

const isDark = ref(false);
const menuOpen = ref(false);
const compact = ref(false);
const sidebarCollapsed = ref(false);

const currentLocaleLabel = computed(() => (locale.value === 'es' ? 'ES' : 'EN'));

watch(route, () => {});

function applyTheme(dark) {
  isDark.value = dark;
  document.documentElement.classList.toggle('dark', dark);
  try { localStorage.setItem('prefers-dark', dark ? '1' : '0'); } catch {}
}
function toggleTheme() { applyTheme(!isDark.value); }

function toggleMenu() { menuOpen.value = !menuOpen.value; }
function handleClickOutside(e) {
  if (!menuOpen.value) return;
  const menuEl = document.querySelector('.admin-header .relative');
  if (menuEl && !menuEl.contains(e.target)) menuOpen.value = false;
}
function setLocale(l) { locale.value = l; menuOpen.value = false; }

function toggleCompact() {
  compact.value = !compact.value;
  document.documentElement.classList.toggle('compact', compact.value);
  try { localStorage.setItem('admin-compact', compact.value ? '1' : '0'); } catch {}
}
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  try { localStorage.setItem('admin-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0'); } catch {}
}

onMounted(() => {
  let pref = null; try { pref = localStorage.getItem('prefers-dark'); } catch {}
  if (pref === '1' || (pref === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    applyTheme(true);
  }
  window.addEventListener('click', handleClickOutside);

  let c = null; try { c = localStorage.getItem('admin-compact'); } catch {}
  if (c === '1') {
    compact.value = true;
    document.documentElement.classList.add('compact');
  }
  let sc = null; try { sc = localStorage.getItem('admin-sidebar-collapsed'); } catch {}
  if (sc === '1') sidebarCollapsed.value = true;
});
onBeforeUnmount(() => window.removeEventListener('click', handleClickOutside));

let suppressNextDirtyPrompt = false;
router.beforeEach((to, from, next) => {
  if (suppressNextDirtyPrompt) {
    suppressNextDirtyPrompt = false;
    return next();
  }
  if (from.fullPath !== to.fullPath && anyDirty()) {
    if (!confirm('You have unsaved changes. Leave anyway?')) {
      suppressNextDirtyPrompt = true;
      return next(false);
    }
  }
  next();
});
</script>
<style>
.skip-link {
  position: absolute;
  left: -999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.skip-link:focus {
  left: 8px;
  top: 8px;
  width: auto;
  height: auto;
  background: #1e293b;
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  z-index: 10000;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  color: var(--sidebar-link-color);
  text-decoration: none;
  font-size: 14px;
  line-height: 1.2;
}
.sidebar-link.active {
  background: var(--sidebar-active-bg, #1e293b);
}
.sidebar-link .icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sidebar-link .icon svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
}
html.dark .sidebar-link.active {
  background: var(--sidebar-link-active-bg);
  color: #fff;
}
html:not(.dark) .sidebar-link.active {
  background: #9eb474;
  color: #fff;
}

.logo-light {
  display: none;
}
.logo-dark {
  display: block;
}
html.dark .logo-light {
  display: block;
}
html.dark .logo-dark {
  display: none;
}
</style>
