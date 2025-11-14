<template>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div class="admin-container mx-auto px-6 py-4 max-w-[1330px]" :class="{ dark: isDark }">
    <header
      class="os-header flex items-center justify-between pb-5 mb-8 border-b border-border"
      role="banner">
      <div class="flex items-center gap-4">
        <button
          class="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-card transition-colors"
          @click="toggleMobileSidebar"
          :aria-expanded="mobileSidebarOpen.toString()"
          aria-controls="admin-sidebar"
          aria-label="Toggle navigation">
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        </button>
        <RouterLink
          to="/admin/status"
          class="flex items-center gap-2"
          :aria-label="t('statusTitle')">
          <img :src="logoLight" alt="getty Logo" class="h-9 logo-light" />
          <img :src="logoDark" alt="getty Logo" class="h-9 logo-dark" />
        </RouterLink>
      </div>
      <div class="flex items-center gap-3 relative">
        <WalletLoginButton />

        <a
          href="/index.html"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
          aria-label="Home"
          :title="t('home')">
          <svg
            viewBox="0 0 24 24"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </svg>
          <span data-i18n="home">Home</span>
        </a>

        <div class="relative" @keyup.esc="menuOpen = false">
          <button
            @click="toggleMenu"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card transition-colors"
            :aria-expanded="menuOpen.toString()"
            aria-haspopup="true">
            <svg
              viewBox="0 0 24 24"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path
                d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
            </svg>
            <span class="font-medium">{{ currentLocaleLabel }}</span>
            <svg
              class="w-4 h-4 opacity-70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div
            v-show="menuOpen"
            class="absolute right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg p-2 z-50"
            role="menu">
            <p class="px-2 py-1 text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              {{ t('language') }}
            </p>
            <ul class="space-y-1">
              <li>
                <button
                  @click="setLocale('en')"
                  class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[var(--bg-chat)]"
                  :class="{ 'bg-[var(--bg-chat)]': locale === 'en' }">
                  English
                </button>
              </li>
              <li>
                <button
                  @click="setLocale('es')"
                  class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[var(--bg-chat)]"
                  :class="{ 'bg-[var(--bg-chat)]': locale === 'es' }">
                  Español
                </button>
              </li>
            </ul>
          </div>
        </div>
        <button @click="toggleTheme" class="theme-toggle" title="Toggle theme">
          <svg class="sun-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.52,9.22 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.22 6.91,16.84 7.51,17.35L3.36,17M20.65,7L18.88,10.77C18.74,10 18.47,9.22 18.05,8.5C17.63,7.78 17.09,7.16 16.49,6.65L20.65,7M20.64,17L16.5,17.35C17.1,16.84 17.64,16.22 18.06,15.5C18.48,14.78 18.75,14 18.89,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.86,19 13.67,18.83 14.41,18.56L12,22Z" />
          </svg>
          <svg class="moon-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.4 6.35,17.41C9.37,20.43 14,20.54 17.33,17.97Z" />
          </svg>
        </button>
        <!-- New standalone logout button to the right of language selector -->
        <WalletLogoutButton />
      </div>
    </header>
    <div
      class="admin-layout flex flex-col md:flex-row md:items-start gap-5"
      :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <aside
        id="admin-sidebar"
        class="admin-sidebar os-sidebar w-56 flex-shrink-0 transition-all duration-300"
        :class="{ 'w-16': sidebarCollapsed }"
        role="navigation"
        aria-label="Primary">
        <div class="px-3 pt-3 pb-2">
          <div class="flex items-center gap-2">
            <img :src="sidebarIcon" alt="getty" class="w-7 h-7 rounded" />
            <div class="flex flex-col gap-0.5 leading-none" v-if="!sidebarCollapsed">
              <span class="font-semibold">{{ t('administration') }}</span>
              <span class="text-xs opacity-80">v{{ appVersion }}</span>
            </div>
          </div>
        </div>
        <button
          class="sidebar-toggle-btn"
          @click="toggleSidebar"
          :aria-pressed="sidebarCollapsed.toString()"
          :title="sidebarCollapsed ? 'Expand' : 'Collapse'">
          <svg
            class="sidebar-toggle-icon w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <div class="sidebar-section">
          <h3 class="sidebar-title">Widgets</h3>
          <nav class="sidebar-nav">
            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/status">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
              <span>{{ t('statusTitle') }}</span>
            </RouterLink>

            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/user-profile">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span>{{ t('userProfileTitle') }}</span>
            </RouterLink>

            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/chat">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8.5 8.5Z" />
                </svg>
              </span>
              <span>{{ t('chat') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/events">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
              <span>{{ t('eventsTitle') || 'Events' }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/raffle">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <rect x="15" y="3" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                  <rect x="3" y="15" width="6" height="6" rx="1" />
                  <rect x="15" y="15" width="6" height="6" rx="1" />
                </svg>
              </span>
              <span>{{ t('raffleTitle') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/last-tip">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M12 1v22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span>{{ t('lastTip') }}</span>
            </RouterLink>
            <RouterLink class="sidebar-link os-nav-link" active-class="active" to="/admin/tip-goal">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              </span>
              <span>{{ t('tipGoal') }}</span>
            </RouterLink>
            <!-- Wander auth panel removed; login now handled by header button -->
            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/notifications">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              <span>{{ t('notifications') }}</span>
            </RouterLink>
            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/liveviews">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <span>{{ t('liveviewsTitle') }}</span>
            </RouterLink>
            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/social-media">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51 15.42 17.49" />
                  <path d="m15.41 6.51-6.82 3.98" />
                </svg>
              </span>
              <span>{{ t('socialMediaTitle') }}</span>
            </RouterLink>
            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/announcement">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6l-5 4H4a1 1 0 0 0-1 1Z" />
                  <path d="M16 12h2" />
                  <path d="M16 8h2" />
                  <path d="M16 16h2" />
                </svg>
              </span>
              <span>{{ t('announcementTitle') }}</span>
            </RouterLink>
            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/integrations">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <rect x="6" y="3" width="12" height="18" rx="1" />
                  <path d="M10 12h.01" />
                </svg>
              </span>
              <span>{{ t('externalNotificationsTitle') }}</span>
            </RouterLink>

            <RouterLink
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/achievements">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                  <path d="M17 9a5 5 0 0 0 5-5h-5" />
                  <path d="M7 9a5 5 0 0 1-5-5h5" />
                </svg>
              </span>
              <span>{{ t('achievementsTitle') }}</span>
            </RouterLink>
            <RouterLink
              v-if="SHOW_SETTINGS_SECTION"
              class="sidebar-link os-nav-link"
              active-class="active"
              to="/admin/settings">
              <span class="icon os-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.26 1.3.73 1.77.47.47 1.11.73 1.77.73H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </span>
              <span>{{ t('settings') }}</span>
            </RouterLink>
          </nav>
          <div v-if="!sidebarCollapsed" class="mt-3 px-2">
            <SidebarSuggestion />
          </div>
        </div>
      </aside>

      <div class="admin-overlay md:hidden" @click="setMobileSidebar(false)"></div>
      <main class="admin-main flex-1 min-w-0" id="main" tabindex="-1" role="main">
        <div class="admin-main-content flex-1">
          <RouterView />
        </div>

        <footer
          class="mt-10 pt-6 border-t border-border text-xs text-[var(--text-secondary)]"
          role="contentinfo">
          <div class="flex justify-end">
            <nav class="flex items-center gap-3" aria-label="Footer">
              <a
                :href="siteUrl"
                :aria-label="t('footerSite')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerSite')">
                <img :src="siteFavicon" alt="" class="w-4 h-4 rounded" />
              </a>
              <a
                :href="odyseeUrl"
                :aria-label="t('footerOdysee')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerOdysee')">
                <svg viewBox="0 0 192 192" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="12.096"
                    d="M98.612 39.193c7.085.276 9.76 4.503 12.192 10.124 3.249 7.494.988 10.141-12.192 13.85-13.187 3.74-19.535-1.171-20.404-10.115-.976-10.115 11.684-12.729 11.684-12.729 3.495-.876 6.36-1.226 8.72-1.13zm65.362 107.42c2.54-9.665-6.121-19.201-11.2-27.806-4.998-8.467-11.972-17.925-18.629-22.87a4.832 4.832 0 0 1-.378-7.376c6.57-6.21 18.15-18.329 21.813-24.725 3.413-6.664 7.628-14.488 5.34-21.513-2.058-6.317-8.8-14.298-15.274-12.806-7.342 1.692-6.837 10.98-9.216 20.638-3.222 13.187-10.86 11.697-13.968 11.697-3.108 0-1.24-4.658-8.46-25.377-7.217-20.72-26.002-15.526-40.27-6.985-18.14 10.874-10.046 34.054-5.562 48.992-2.546 2.453-12.118 4.368-20.834 9.06-10.75 5.78-21.645 9.363-24.66 19.372-1.883 6.254.172 15.997 6.162 18.602 6.645 2.889 12.633-1.694 19.751-9.073a36.226 36.226 0 0 1 7.089-5.482 75.994 75.994 0 0 1 18.276-8.59s6.97 10.707 13.432 23.393c6.457 12.686-6.968 16.918-8.459 16.918-1.497 0-22.675-1.973-17.95 15.926 4.726 17.9 30.598 11.437 43.785 2.728 13.187-8.708 9.947-37.06 9.947-37.06 12.94-1.985 16.915 11.684 18.158 18.628 1.243 6.944 4.06 18.052 11.449 19.412 8.248 1.517 17.528-7.593 19.659-15.705z" />
                </svg>
              </a>
              <a
                :href="privacyUrl"
                :aria-label="t('footerPrivacy')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerPrivacy')">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                  class="text-[#1d1d1d] dark:text-white transition-colors">
                  <path
                    d="M17 9.99V7A5 5 0 0 0 7 7v2.99A4.482 4.482 0 0 0 4.5 14v3A4.507 4.507 0 0 0 9 21.5h6a4.507 4.507 0 0 0 4.5-4.5v-3A4.482 4.482 0 0 0 17 9.99ZM13 16a1 1 0 0 1-2 0v-1a1 1 0 0 1 2 0Zm2-6.5H9V7a3 3 0 0 1 6 0Z" />
                </svg>
              </a>
              <a
                :href="termsUrl"
                :aria-label="t('footerTerms')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerTerms')">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6" />
                  <path d="M9 17h3" />
                </svg>
              </a>
              <a
                :href="githubUrl"
                :aria-label="t('footerGithub')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerGithub')">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true">
                  <path
                    d="M12 .5C5.73.5.98 5.24.98 11.5c0 4.84 3.14 8.94 7.49 10.39.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.05.66-3.7-1.3-3.7-1.3-.5-1.27-1.22-1.61-1.22-1.61-.99-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.97 1.67 2.54 1.19 3.15.91.1-.7.38-1.19.69-1.46-2.43-.28-4.98-1.22-4.98-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.42.11-2.95 0 0 .93-.3 3.05 1.13a10.6 10.6 0 0 1 5.56 0c2.12-1.43 3.05-1.13 3.05-1.13.6 1.53.22 2.67.11 2.95.7.77 1.13 1.75 1.13 2.95 0 4.22-2.56 5.14-5 5.42.39.33.74.98.74 1.98 0 1.43-.01 2.58-.01 2.93 0 .29.2.64.75.53 4.35-1.45 7.49-5.55 7.49-10.39C23.02 5.24 18.27.5 12 .5Z" />
                </svg>
              </a>
              <a
                :href="xUrl"
                :aria-label="t('footerX')"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center hover:text-[var(--text-primary)]"
                :title="t('footerX')">
                <svg viewBox="0 0 1024 1024" width="16" height="16" aria-hidden="true">
                  <g
                    fill="none"
                    fill-rule="evenodd"
                    stroke="none"
                    stroke-width="1"
                    transform="translate(112 112)">
                    <path
                      class="footer-x-bg"
                      d="M711.111 800H88.89C39.8 800 0 760.2 0 711.111V88.89C0 39.8 39.8 0 88.889 0H711.11C760.2 0 800 39.8 800 88.889V711.11C800 760.2 760.2 800 711.111 800" />
                    <path
                      class="footer-x-fg"
                      fill-rule="nonzero"
                      d="M628 623H484.942L174 179h143.058zm-126.012-37.651h56.96L300.013 216.65h-56.96z" />
                    <path
                      class="footer-x-fg"
                      fill-rule="nonzero"
                      d="M219.296885 623 379 437.732409 358.114212 410 174 623z" />
                    <path
                      class="footer-x-fg"
                      fill-rule="nonzero"
                      d="M409 348.387347 429.212986 377 603 177 558.330417 177z" />
                  </g>
                </svg>
              </a>
            </nav>
          </div>
        </footer>
      </main>
    </div>
    <ToastHost />
    <OsConfirmDialog />
  </div>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import { watch, ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { anyDirty } from './composables/useDirtyRegistry';
import ToastHost from './components/shared/ToastHost.vue';
import SidebarSuggestion from './components/shared/SidebarSuggestion.vue';
import OsConfirmDialog from './components/os/OsConfirmDialog.vue';
import { confirmDialog } from './services/confirm';
import WalletLoginButton from './components/WalletLoginButton.vue';
import WalletLogoutButton from './components/WalletLogoutButton.vue';
import { useWanderSession } from './wander/store/wanderSession';
const logoLight =
  'https://aqet2p7rnwvvcvraawg2ojq7sfyals6jav2dh6vm7occr347kfsa.arweave.net/BAk9P_Ftq1FWIAWNpyYfkXAFy8kFdDP6rPuEKO-fUWQ';
const logoDark =
  'https://xc43575rqmogbtegwxry2rk4hkctslkb63os6y2cdq25nfkgmguq.arweave.net/uLm-_7GDHGDMhrXjjUVcOoU5LUH23S9jQhw11pVGYak';

const sidebarIcon = '/favicon.ico';
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
const privacyUrl = import.meta.env.VITE_PRIVACY_URL || 'https://getty.sh/en/guide/privacypolicy/';
const termsUrl = import.meta.env.VITE_TERMS_URL || 'https://getty.sh/en/guide/terms/';
const siteUrl = import.meta.env.VITE_SITE_URL || 'https://getty.sh/';
const siteFavicon = '/favicon.ico';
const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com/gettyteam/getty';
const xUrl = import.meta.env.VITE_X_URL || 'https://x.com/getty_sh';
const odyseeUrl = import.meta.env.VITE_ODYSEE_URL || 'https://odysee.com';

const { locale, t } = useI18n();
const route = useRoute();
const router = useRouter();
const SHOW_SETTINGS_SECTION = true;

const isDark = ref(false);
const menuOpen = ref(false);
const sidebarCollapsed = ref(false);
const mobileSidebarOpen = ref(false);

const currentLocaleLabel = computed(() => (locale.value === 'es' ? 'ES' : 'EN'));

const wanderSession = useWanderSession();

watch(
  () => [wanderSession.state.address, wanderSession.state.loading, route.path],
  ([address, loading, path]) => {
    if (loading) return;
    if (!address && path.startsWith('/admin')) {
      router.push('/');
    }
  },
  { immediate: true }
);

watch(route, () => {});

function resolveThemePreference() {
  let stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch {}
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  let legacy = null;
  try {
    legacy = localStorage.getItem('prefers-dark');
  } catch {}
  if (legacy === '1') return true;
  if (legacy === '0') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

function applyTheme(dark, persist = true) {
  if (isDark.value === dark && !persist) return;
  isDark.value = dark;
  const mode = dark ? 'dark' : 'light';
  let allowTransition = true;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq?.matches) allowTransition = false;
  } catch {}
  if (allowTransition) {
    try {
      if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
        themeTransitionTimer = null;
      }
      document.documentElement.classList.add('theme-transition');
      document.body?.classList.add('theme-transition');
      themeTransitionTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
        document.body?.classList.remove('theme-transition');
        themeTransitionTimer = null;
      }, 320);
    } catch {}
  } else {
    try {
      if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
        themeTransitionTimer = null;
      }
      document.documentElement.classList.remove('theme-transition');
      document.body?.classList.remove('theme-transition');
    } catch {}
  }
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
  try {
    document.documentElement.setAttribute('data-theme', mode);
  } catch {}
  try {
    const body = document.body;
    if (body) {
      body.classList.toggle('dark', dark);
      body.classList.toggle('light', !dark);
    }
  } catch {}
  if (persist) {
    try {
      localStorage.setItem('theme', mode);
    } catch {}
    try {
      localStorage.setItem('prefers-dark', dark ? '1' : '0');
    } catch {}
  }
}
function toggleTheme() {
  applyTheme(!isDark.value);
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}
function handleClickOutside(e) {
  if (!menuOpen.value) return;
  const menuEl = document.querySelector('.os-header .relative');
  if (menuEl && !menuEl.contains(e.target)) menuOpen.value = false;
}
function setLocale(l) {
  locale.value = l;
  menuOpen.value = false;
  try {
    localStorage.setItem('admin_locale', l);
    localStorage.setItem('lang', l);
  } catch {}
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  try {
    localStorage.setItem('admin-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0');
  } catch {}
  setSidebarWidthVar();
}

function setMobileSidebar(open) {
  mobileSidebarOpen.value = open;
  try {
    document.documentElement.classList.toggle('mobile-sidebar-open', open);
  } catch {}
  try {
    document.body.style.overflow = open ? 'hidden' : '';
  } catch {}
}
function toggleMobileSidebar() {
  setMobileSidebar(!mobileSidebarOpen.value);
}

function setHeaderHeightVar() {
  try {
    const header = document.querySelector('.os-header');
    const h = header ? header.offsetHeight : 64;
    document.documentElement.style.setProperty('--admin-header-h', h + 'px');
    const rect = header ? header.getBoundingClientRect() : null;
    const headerBottom = rect ? rect.bottom : h;
    const hs = header ? getComputedStyle(header) : null;
    const mb = hs ? parseFloat(hs.marginBottom || '0') : 0;
    document.documentElement.style.setProperty('--admin-top', headerBottom + mb + 'px');
  } catch {
    /* ignore */
  }
}
let resizeTimer = null;
let storageHandler = null;
let themeTransitionTimer = null;
function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setHeaderHeightVar();
    setContainerLeftVar();
    if (window.innerWidth >= 768) setMobileSidebar(false);
  }, 100);
}
function onScroll() {
  setHeaderHeightVar();
}

function setContainerLeftVar() {
  try {
    const container = document.querySelector('.admin-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    document.documentElement.style.setProperty('--container-left', left + 'px');
  } catch {
    /* ignore */
  }
}

function setSidebarWidthVar() {
  const w = sidebarCollapsed.value ? 64 : 224;
  document.documentElement.style.setProperty('--sidebar-w', w + 'px');
}

onMounted(() => {
  const initialDark = resolveThemePreference();
  applyTheme(initialDark, true);
  window.addEventListener('click', handleClickOutside);
  setHeaderHeightVar();
  setContainerLeftVar();
  setSidebarWidthVar();
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMobileSidebar(false);
  });

  storageHandler = (event) => {
    if (!event) return;
    if (event.storageArea && event.storageArea !== localStorage) return;
    if (event.key && event.key !== 'theme' && event.key !== 'prefers-dark') return;
    applyTheme(resolveThemePreference(), false);
  };
  try {
    window.addEventListener('storage', storageHandler);
  } catch {}

  try {
    localStorage.removeItem('admin-compact');
  } catch {}
  try {
    document.documentElement.classList.remove('compact');
  } catch {}
  let sc = null;
  try {
    sc = localStorage.getItem('admin-sidebar-collapsed');
  } catch {}
  if (sc === '1') sidebarCollapsed.value = true;
});
onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', onScroll);
  if (storageHandler) {
    try {
      window.removeEventListener('storage', storageHandler);
    } catch {}
  }
});

let suppressNextDirtyPrompt = false;
router.beforeEach(async (to, from, next) => {
  if (suppressNextDirtyPrompt) {
    suppressNextDirtyPrompt = false;
    return next();
  }
  if (from.fullPath !== to.fullPath && anyDirty()) {
    const ok = await confirmDialog({
      title: t('unsavedChangesTitle') || 'Unsaved changes',
      description:
        t('unsavedChangesBody') || 'You have unsaved changes. Leave this page and discard them?',
      confirmText: t('leaveAnyway') || 'Leave anyway',
      cancelText: t('commonCancel') || 'Cancel',
      danger: true,
    });
    if (!ok) {
      suppressNextDirtyPrompt = true;
      return next(false);
    }
  }
  next();
});

router.afterEach(() => {
  setTimeout(() => {
    setHeaderHeightVar();
    setContainerLeftVar();
  }, 0);
  setMobileSidebar(false);

  try {
    const hourId = Math.floor(Date.now() / 3600000);
    localStorage.setItem('admin-suggestion-closed-hour', String(hourId));
  } catch {}
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
  background: var(--sidebar-link-active-bg);
  color: var(--text-primary);
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

.footer-x-bg {
  fill: #000;
}
.footer-x-fg {
  fill: #fff;
}
html.dark .footer-x-bg {
  fill: #fff;
}
html.dark .footer-x-fg {
  fill: #000;
}
</style>
