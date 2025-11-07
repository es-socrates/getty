<template>
  <div :class="['public-profile-page', isDark ? 'theme-dark' : 'theme-light']">
    <div class="profile-container">
      <header class="site-header">
        <a href="/" class="logo-link" aria-label="getty home">
          <img
            src="https://aqet2p7rnwvvcvraawg2ojq7sfyals6jav2dh6vm7occr347kfsa.arweave.net/BAk9P_Ftq1FWIAWNpyYfkXAFy8kFdDP6rPuEKO-fUWQ"
            alt="getty"
            class="logo-dark"
            decoding="async"
            height="36" />
          <img
            src="https://xc43575rqmogbtegwxry2rk4hkctslkb63os6y2cdq25nfkgmguq.arweave.net/uLm-_7GDHGDMhrXjjUVcOoU5LUH23S9jQhw11pVGYak"
            alt="getty"
            class="logo-light"
            decoding="async"
            height="36" />
        </a>
        <div class="header-actions">
          <div class="language-switcher" role="group" :aria-label="t('language', 'Language')">
            <button
              type="button"
              class="lang-option"
              :class="{ active: lang.value === 'en' }"
              @click="setLanguage('en')">
              EN
            </button>
            <button
              type="button"
              class="lang-option"
              :class="{ active: lang.value === 'es' }"
              @click="setLanguage('es')">
              ES
            </button>
          </div>
          <button
            type="button"
            class="theme-toggle"
            :aria-label="themeToggleLabel"
            :title="themeToggleLabel"
            @click="toggleTheme">
            <svg
              class="theme-icon sun-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true">
              <path
                d="M12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0-5l2.39 3.42A6.97 6.97 0 0 0 12 5c-.84 0-1.65.15-2.39.42L12 2Zm-8.66 5L7.5 6.65A6.54 6.54 0 0 0 5.94 8.5a6.6 6.6 0 0 0-.83 2.29L3.34 7ZM3.36 17l1.76-3.77c.14.77.41 1.55.83 2.27c.42.72.96 1.34 1.56 1.85L3.36 17Zm17.29-10l-1.77 3.77a6.6 6.6 0 0 0-.83-2.27a6.54 6.54 0 0 0-1.56-1.85L20.65 7ZM20.64 17l-4.14.35c.6-.51 1.14-1.13 1.56-1.85c.42-.72.69-1.5.83-2.29L20.64 17ZM12 22l-2.41-3.44c.74.27 1.55.44 2.41.44s1.67-.17 2.41-.44L12 22Z" />
            </svg>
            <svg
              class="theme-icon moon-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true">
              <path
                d="M18.97 15.95A8.56 8.56 0 0 1 10.95 13c-2.2-2.19-3.16-5.16-2.89-8.02c.08-.83-.93-1.72-1.68-1.19c-.45.32-.87.68-1.27 1.08c-3.91 3.9-3.91 10.24 0 14.14c3.9 3.93 10.23 3.93 14.14 0c.42-.4.76-.82 1.08-1.27c.53-.75-.36-1.93-1.19-1.85Z" />
            </svg>
          </button>
        </div>
      </header>

      <main class="profile-main">
        <section v-if="loading" class="status-card">
          <span class="status-label">{{ t('publicProfileLoading', 'Loading profile...') }}</span>
        </section>

        <section v-else-if="hasError" class="status-card status-error">
          <h1>{{ t('publicProfileUnavailableTitle', 'Profile unavailable') }}</h1>
          <p>{{ errorMessage }}</p>
        </section>

        <article v-else class="profile-card">
          <section v-if="sections.header" class="profile-hero">
            <div class="profile-cover" :style="channelCoverStyle"></div>
            <div class="profile-header">
              <div class="profile-avatar" :style="channelAvatarStyle" aria-hidden="true"></div>
              <div class="profile-meta">
                <div class="profile-names">
                  <h1 class="profile-title">{{ channelDisplayName }}</h1>
                  <p v-if="channelHandle" class="profile-handle">{{ channelHandle }}</p>
                </div>
                <div class="profile-tags">
                  <span class="badge" :class="liveBadgeClass">{{ liveStatusText }}</span>
                  <span v-if="followersDisplay" class="badge badge-muted">
                    {{ t('publicProfileFollowersLabel', 'Followers') }} - {{ followersDisplay }}
                  </span>
                </div>
                <p v-if="channelDescription" class="profile-description">
                  {{ channelDescription }}
                </p>
                <div class="profile-links">
                  <a
                    v-if="channelUrl"
                    :href="channelUrl"
                    target="_blank"
                    rel="noopener"
                    class="profile-link">
                    <img class="profile-link-icon" :src="odyseeLogo" alt="" aria-hidden="true" />
                    <span>{{ t('publicProfileViewOnOdysee', 'View on Odysee') }}</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section v-if="sections.summary" class="summary-grid">
            <div class="summary-card">
              <span class="summary-label">{{
                t('publicProfileHoursStreamed', 'Hours streamed')
              }}</span>
              <span class="summary-value">{{ formatHours(summaryMetrics.hoursStreamed) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{
                t('publicProfileAverageViewers', 'Average viewers')
              }}</span>
              <span class="summary-value">{{ formatNumber(summaryMetrics.avgViewers, 1) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ t('publicProfilePeakViewers', 'Peak viewers') }}</span>
              <span class="summary-value">{{ formatNumber(summaryMetrics.peakViewers, 0) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ t('publicProfileViewerHours', 'Viewer hours') }}</span>
              <span class="summary-value">{{ formatNumber(summaryMetrics.hoursWatched, 1) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ t('publicProfileActiveDays', 'Active days') }}</span>
              <span class="summary-value">{{ formatNumber(summaryMetrics.activeDays, 0) }}</span>
            </div>
          </section>

          <section v-if="sections.lifetime" class="lifetime-grid">
            <div class="lifetime-card">
              <span class="lifetime-label">{{
                t('publicProfileLifetimeHours', 'Lifetime hours streamed')
              }}</span>
              <span class="lifetime-value">{{
                formatHours(lifetimeMetrics.totalHoursStreamed)
              }}</span>
            </div>
            <div class="lifetime-card">
              <span class="lifetime-label">{{
                t('publicProfileLifetimePeak', 'Lifetime peak viewers')
              }}</span>
              <span class="lifetime-value">{{
                formatNumber(lifetimeMetrics.highestViewers, 0)
              }}</span>
            </div>
          </section>

          <section v-if="sections.chart" class="chart-section">
            <div class="section-heading">
              <h2>{{ t('publicProfileStreamActivity', 'Stream activity') }}</h2>
              <span v-if="updatedAtLabel" class="updated-label">
                {{ t('publicProfileUpdatedAt', 'Updated {value}', { value: updatedAtLabel }) }}
              </span>
            </div>
            <div v-if="chartHasData" class="chart-visual">
              <div
                class="chart-legend"
                role="toolbar"
                :aria-label="t('publicProfileStreamActivity', 'Stream activity')">
                <button
                  type="button"
                  class="legend-item legend-viewers"
                  :class="showAvgSeries ? 'legend-active' : 'legend-inactive'"
                  @click="toggleAvgSeries"
                  :aria-pressed="String(showAvgSeries)">
                  <span class="legend-swatch legend-swatch-line" aria-hidden="true"></span>
                  <span>{{ t('publicProfileLegendAvgViewers', 'Avg viewers') }}</span>
                </button>
                <button
                  type="button"
                  class="legend-item legend-hours"
                  :class="showHoursSeries ? 'legend-active' : 'legend-inactive'"
                  @click="toggleHoursSeries"
                  :aria-pressed="String(showHoursSeries)">
                  <span class="legend-swatch legend-swatch-bar" aria-hidden="true"></span>
                  <span>{{ t('publicProfileLegendHoursStreamed', 'Hours streamed') }}</span>
                </button>
              </div>
              <svg
                class="activity-chart"
                :viewBox="chartGeometry.viewBox"
                preserveAspectRatio="none"
                role="img"
                aria-labelledby="profile-chart-title">
                <title id="profile-chart-title">
                  {{ t('publicProfileStreamActivity', 'Stream activity') }}
                </title>
                <g class="chart-guides">
                  <line
                    v-for="guide in chartGeometry.guides"
                    :key="guide.key"
                    :x1="
                      chartGeometry.guideRange
                        ? chartGeometry.guideRange.start
                        : chartGeometry.bounds.left
                    "
                    :x2="
                      chartGeometry.guideRange
                        ? chartGeometry.guideRange.end
                        : chartGeometry.bounds.right
                    "
                    :y1="guide.y"
                    :y2="guide.y"
                    class="chart-guide-line" />
                </g>
                <line
                  class="chart-baseline"
                  :x1="chartGeometry.bounds.left"
                  :x2="chartGeometry.bounds.right"
                  :y1="chartGeometry.bounds.bottom"
                  :y2="chartGeometry.bounds.bottom" />
                <g class="chart-bars">
                  <rect
                    v-for="bar in chartGeometry.bars"
                    :key="bar.key"
                    class="chart-bar-rect"
                    :x="bar.x"
                    :y="bar.y"
                    :width="bar.width"
                    :height="bar.height"
                    rx="4"
                    ry="4">
                    <title>{{ bar.tooltip }}</title>
                  </rect>
                </g>
                <path
                  v-if="chartGeometry.areaPath"
                  class="chart-line-area"
                  :d="chartGeometry.areaPath" />
                <path
                  v-if="chartGeometry.linePath"
                  class="chart-line-path"
                  :d="chartGeometry.linePath" />
                <g class="chart-points" v-if="chartGeometry.points.length">
                  <circle
                    v-for="point in chartGeometry.points"
                    :key="point.key"
                    class="chart-point"
                    :cx="point.x"
                    :cy="point.y"
                    r="6">
                    <title>{{ point.tooltip }}</title>
                  </circle>
                </g>
                <g class="chart-axis-left">
                  <text
                    v-for="tick in chartGeometry.leftTicks"
                    :key="tick.key"
                    :x="chartGeometry.bounds.left - 12"
                    :y="tick.y"
                    class="chart-axis-text"
                    text-anchor="end"
                    dominant-baseline="middle">
                    {{ tick.label }}
                  </text>
                </g>
                <g class="chart-axis-right" v-if="chartGeometry.rightTicks.length">
                  <text
                    v-for="tick in chartGeometry.rightTicks"
                    :key="tick.key"
                    :x="chartGeometry.bounds.right + 12"
                    :y="tick.y"
                    class="chart-axis-text chart-axis-text-right"
                    text-anchor="start"
                    dominant-baseline="middle">
                    {{ tick.label }}
                  </text>
                </g>
                <g class="chart-axis-bottom">
                  <text
                    v-for="label in chartGeometry.bottomLabels"
                    :key="label.key"
                    :x="label.x"
                    :y="chartGeometry.bounds.bottom + 28"
                    class="chart-axis-text"
                    text-anchor="middle">
                    {{ label.label }}
                  </text>
                </g>
              </svg>
            </div>
            <div v-else class="chart-empty">
              {{ t('publicProfileNoChartData', 'No chart data available yet.') }}
            </div>
          </section>

          <section v-if="sections.recent" class="recent-section">
            <div class="section-heading">
              <h2>{{ t('publicProfileRecentStreams', 'Recent streams') }}</h2>
            </div>
            <div v-if="recentStreams.length" class="recent-list">
              <article v-for="item in recentStreams" :key="item.startEpoch" class="recent-item">
                <header class="recent-meta">
                  <span class="recent-date">{{ formatDateTime(item.startEpoch) }}</span>
                </header>
                <dl class="recent-stats">
                  <div class="recent-stat recent-stat-duration">
                    <dt>{{ t('publicProfileStreamDuration', 'Duration') }}</dt>
                    <dd>{{ formatDuration(item.durationHours) }}</dd>
                  </div>
                  <div class="recent-stat recent-stat-avg">
                    <dt>{{ t('publicProfileAverageViewers', 'Average viewers') }}</dt>
                    <dd>{{ formatNumber(item.avgViewers, 1) }}</dd>
                  </div>
                  <div class="recent-stat recent-stat-peak">
                    <dt>{{ t('publicProfilePeakViewers', 'Peak viewers') }}</dt>
                    <dd>{{ formatNumber(item.peakViewers, 0) }}</dd>
                  </div>
                  <div class="recent-stat recent-stat-hours">
                    <dt>{{ t('publicProfileViewerHours', 'Viewer hours') }}</dt>
                    <dd>{{ formatNumber(item.viewerHours, 1) }}</dd>
                  </div>
                </dl>
              </article>
            </div>
            <p v-else class="recent-empty">
              {{ t('publicProfileNoRecentStreams', 'No recent streams yet.') }}
            </p>
          </section>
        </article>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import enTranslations from 'shared-i18n/en.json';
import esTranslations from 'shared-i18n/es.json';
import odyseeLogoUrl from '../../assets/odysee.svg?url';

const FALLBACK_TRANSLATIONS = {
  en: enTranslations,
  es: esTranslations,
};

const odyseeLogo = odyseeLogoUrl;

const DEFAULT_LANGUAGE = 'en';

const LANGUAGE_TO_LOCALE = {
  en: 'en-US',
  es: 'es-ES',
};

let syncingLanguageSources = false;

function normalizeLanguageCode(lang) {
  if (!lang || typeof lang !== 'string') return DEFAULT_LANGUAGE;
  const normalized = lang.toLowerCase().trim();
  if (!normalized) return DEFAULT_LANGUAGE;
  return normalized.split('-')[0] || DEFAULT_LANGUAGE;
}

function mapLanguageToLocale(lang) {
  const normalized = normalizeLanguageCode(lang);
  if (LANGUAGE_TO_LOCALE[normalized]) {
    return LANGUAGE_TO_LOCALE[normalized];
  }
  return `${normalized}-${normalized.toUpperCase()}`;
}

async function fetchServerLanguagePreference() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return '';
  try {
    const response = await fetch('/api/language', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return '';
    const payload = await response.json();
    const language = payload?.currentLanguage;
    return typeof language === 'string' ? language : '';
  } catch {
    return '';
  }
}

function persistLanguagePreference(lang) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('getty-language', lang);
  } catch {}
  try {
    localStorage.setItem('lang', lang);
  } catch {}
  try {
    document.cookie = `getty_lang=${encodeURIComponent(lang)};path=/;max-age=31536000`;
  } catch {}
}

function applyDocumentLanguage(lang) {
  try {
    if (document?.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }
  } catch {}
}

function syncLanguageSources(lang) {
  if (typeof window === 'undefined' || syncingLanguageSources) return;
  if (!lang) return;
  syncingLanguageSources = true;
  try {
    persistLanguagePreference(lang);
    applyDocumentLanguage(lang);

    try {
      const i18n = window.__i18n;
      if (i18n && typeof i18n.setLanguage === 'function') {
        const current = normalizeLanguageCode(i18n.current);
        if (current !== lang) {
          const result = i18n.setLanguage(lang);
          if (result && typeof result.then === 'function') {
            result.catch(() => {});
          }
        }
      }
    } catch {}

    try {
      const manager = window.languageManager;
      if (manager) {
        if (typeof manager.setLanguage === 'function') {
          const current = normalizeLanguageCode(manager.current);
          if (current !== lang) {
            const result = manager.setLanguage(lang);
            if (result && typeof result.then === 'function') {
              result.catch(() => {});
            }
          }
        } else if (typeof manager.updatePageLanguage === 'function') {
          if (manager.updatePageLanguage.length >= 1) {
            manager.updatePageLanguage(lang);
          } else {
            manager.updatePageLanguage();
          }
        }
      }
    } catch {}
  } finally {
    syncingLanguageSources = false;
  }
}

function syncLanguageQueryParam(lang) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeLanguageCode(lang || DEFAULT_LANGUAGE);
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const rawLang = params.get('lang');
    const rawAlt = params.get('language');
    const existingNormalized = normalizeLanguageCode(rawLang || rawAlt || '');
    const needsUpdate = existingNormalized !== normalized || !rawLang || rawAlt !== null;
    if (!needsUpdate) return;
    params.delete('language');
    params.set('lang', normalized);
    const newSearch = params.toString();
    const newSearchString = newSearch ? `?${newSearch}` : '';
    const newUrl = `${url.pathname}${newSearchString}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === newUrl) {
      return;
    }
    window.history.replaceState(window.history.state ?? null, '', newUrl);
  } catch {}
}

function shortenText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const slice = normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  return slice ? `${slice}...` : normalized.slice(0, maxLength);
}

function ensureAbsoluteUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (typeof window === 'undefined') return '';
  try {
    const resolved = new URL(trimmed, window.location.origin);
    return resolved.toString();
  } catch {
    return '';
  }
}

function clampTimezoneOffset(minutes) {
  if (!Number.isFinite(minutes)) return 0;
  if (minutes > 840) return 840;
  if (minutes < -840) return -840;
  return Math.round(minutes);
}

function resolveLocalTimezoneOffset() {
  try {
    const offset = -new Date().getTimezoneOffset();
    return clampTimezoneOffset(offset);
  } catch {
    return 0;
  }
}

const SEO_META_TARGETS = [
  { attr: 'name', value: 'description' },
  { attr: 'property', value: 'og:title' },
  { attr: 'property', value: 'og:description' },
  { attr: 'property', value: 'og:url' },
  { attr: 'property', value: 'og:site_name' },
  { attr: 'property', value: 'og:type' },
  { attr: 'property', value: 'og:locale' },
  { attr: 'property', value: 'profile:username' },
  { attr: 'property', value: 'og:image' },
  { attr: 'property', value: 'og:image:alt' },
  { attr: 'name', value: 'twitter:card' },
  { attr: 'name', value: 'twitter:title' },
  { attr: 'name', value: 'twitter:description' },
  { attr: 'name', value: 'twitter:image' },
  { attr: 'name', value: 'twitter:image:alt' },
  { attr: 'name', value: 'twitter:url' },
  { attr: 'name', value: 'twitter:creator' },
  { attr: 'name', value: 'twitter:domain' },
];

const initialSeoState = {
  captured: false,
  metas: new Map(),
  canonical: null,
};

function captureInitialSeoState() {
  if (initialSeoState.captured || typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;
  initialSeoState.captured = true;
  for (const target of SEO_META_TARGETS) {
    const selector = `${target.attr}:${target.value}`;
    const element = head.querySelector(`meta[${target.attr}="${target.value}"]`);
    initialSeoState.metas.set(selector, element ? element.getAttribute('content') ?? '' : null);
  }
  const canonical = head.querySelector('link[rel="canonical"]');
  initialSeoState.canonical = canonical ? canonical.getAttribute('href') || '' : null;
}

function setMetaTag(attribute, value, content) {
  if (typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;
  const selector = `meta[${attribute}="${value}"]`;
  let element = head.querySelector(selector);
  if (content == null || content === '') {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    head.appendChild(element);
  }
  if (element.getAttribute('content') !== content) {
    element.setAttribute('content', content);
  }
}

function setCanonicalLink(href) {
  if (typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;
  let link = head.querySelector('link[rel="canonical"]');
  if (!href) {
    if (link && link.parentNode) {
      link.parentNode.removeChild(link);
    }
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

function restoreSeoMeta() {
  if (!initialSeoState.captured || typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;
  for (const target of SEO_META_TARGETS) {
    const selector = `${target.attr}:${target.value}`;
    const original = initialSeoState.metas.get(selector);
    if (original == null || original === '') {
      const element = head.querySelector(`meta[${target.attr}="${target.value}"]`);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    } else {
      setMetaTag(target.attr, target.value, original);
    }
  }
  setCanonicalLink(initialSeoState.canonical);
  initialSeoState.captured = false;
  initialSeoState.metas.clear();
  initialSeoState.canonical = null;
}

function applySeoMeta(meta) {
  if (!meta || typeof document === 'undefined') return;
  captureInitialSeoState();
  setMetaTag('name', 'description', meta.description || null);
  setMetaTag('property', 'og:title', meta.title || null);
  setMetaTag('property', 'og:description', meta.description || null);
  setMetaTag('property', 'og:url', meta.canonical || null);
  setMetaTag('property', 'og:site_name', meta.siteName || null);
  setMetaTag('property', 'og:type', 'profile');
  setMetaTag('property', 'og:locale', meta.ogLocale || null);
  setMetaTag('property', 'profile:username', meta.profileUsername || null);
  setMetaTag('property', 'og:image', meta.image || null);
  setMetaTag('property', 'og:image:alt', meta.imageAlt || null);
  setMetaTag('name', 'twitter:card', meta.twitterCard || null);
  setMetaTag('name', 'twitter:title', meta.title || null);
  setMetaTag('name', 'twitter:description', meta.description || null);
  setMetaTag('name', 'twitter:image', meta.image || null);
  setMetaTag('name', 'twitter:image:alt', meta.imageAlt || null);
  setMetaTag('name', 'twitter:url', meta.canonical || null);
  setMetaTag('name', 'twitter:creator', meta.twitterCreator || null);
  setMetaTag('name', 'twitter:domain', meta.twitterDomain || null);
  setCanonicalLink(meta.canonical || null);
}

function getLanguageFromQuery() {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search || '');
    const qp = params.get('lang') || params.get('language');
    return qp ? qp.trim() : '';
  } catch {}
  return '';
}

function resolveInitialLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const fromQuery = getLanguageFromQuery();
  if (fromQuery) return fromQuery;

  try {
    const storageKeys = ['getty-language', 'language', 'lang', 'getty_lang', 'i18nextLng'];
    for (const key of storageKeys) {
      let value = '';
      try {
        value = localStorage.getItem(key) || '';
      } catch {}
      if (value && typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  } catch {}

  try {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)(getty_lang|lang|language)=([^;]+)/i);
    if (cookieMatch && cookieMatch[2]) {
      return decodeURIComponent(cookieMatch[2]);
    }
  } catch {}

  try {
    const attr = document?.documentElement?.getAttribute('lang');
    if (attr) return attr;
  } catch {}

  try {
    if (typeof navigator !== 'undefined') {
      const navPref =
        navigator.language ||
        (Array.isArray(navigator.languages) ? navigator.languages.filter(Boolean)[0] : '');
      if (navPref) return navPref;
    }
  } catch {}

  try {
    if (window.__i18n && typeof window.__i18n.current === 'string' && window.__i18n.current) {
      return window.__i18n.current;
    }
  } catch {}
  try {
    if (
      window.languageManager &&
      typeof window.languageManager.current === 'string' &&
      window.languageManager.current
    ) {
      return window.languageManager.current;
    }
  } catch {}
  return DEFAULT_LANGUAGE;
}

function setupLanguageListeners(onChange) {
  if (typeof window === 'undefined') return () => {};
  const cleanupFns = [];
  let i18nAttached = false;
  let managerAttached = false;

  const attachI18n = () => {
    const i18n = window.__i18n;
    if (!i18n || typeof i18n.setLanguage !== 'function') return false;
    if (!i18n.__gettyLanguageListeners) {
      i18n.__gettyLanguageListeners = new Set();
      const originalSetLanguage = i18n.setLanguage.bind(i18n);
      i18n.setLanguage = async function patchedSetLanguage(lang) {
        const result = await originalSetLanguage(lang);
        i18n.__gettyLanguageListeners.forEach((listener) => {
          try {
            listener(lang);
          } catch {}
        });
        return result;
      };
    }
    const handler = (lang) => onChange(lang);
    i18n.__gettyLanguageListeners.add(handler);
    cleanupFns.push(() => i18n.__gettyLanguageListeners.delete(handler));
    i18nAttached = true;
    return true;
  };

  const attachLanguageManager = () => {
    const manager = window.languageManager;
    if (!manager || typeof manager.updatePageLanguage !== 'function') return false;
    if (!manager.__gettyLanguageListeners) {
      manager.__gettyLanguageListeners = new Set();
      const originalUpdate = manager.updatePageLanguage.bind(manager);
      manager.updatePageLanguage = function patchedUpdatePageLanguage(...args) {
        const result = originalUpdate(...args);
        manager.__gettyLanguageListeners.forEach((listener) => {
          try {
            listener();
          } catch {}
        });
        return result;
      };
    }
    const managerHandler = () => onChange(resolveInitialLanguage());
    manager.__gettyLanguageListeners.add(managerHandler);
    cleanupFns.push(() => manager.__gettyLanguageListeners.delete(managerHandler));
    managerAttached = true;
    return true;
  };

  const tryAttach = () => {
    if (!i18nAttached) attachI18n();
    if (!managerAttached) attachLanguageManager();
    return i18nAttached && managerAttached;
  };

  if (!tryAttach()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryAttach() || attempts >= 40) {
        clearInterval(interval);
      }
    }, 250);
    cleanupFns.push(() => clearInterval(interval));
  }

  if (typeof MutationObserver === 'function' && document?.documentElement) {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'lang') {
          const attr = document.documentElement.getAttribute('lang');
          if (attr) {
            onChange(attr);
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    cleanupFns.push(() => observer.disconnect());
  }

  const storageHandler = (event) => {
    if (!event) return;
    if (event.key === 'getty-language' && typeof event.newValue === 'string' && event.newValue) {
      onChange(event.newValue);
    }
  };
  window.addEventListener('storage', storageHandler);
  cleanupFns.push(() => window.removeEventListener('storage', storageHandler));

  const popstateHandler = () => {
    const candidate = getLanguageFromQuery();
    if (candidate) {
      onChange(candidate);
    }
  };
  window.addEventListener('popstate', popstateHandler);
  cleanupFns.push(() => window.removeEventListener('popstate', popstateHandler));

  return () => {
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

function usePublicProfileI18n() {
  const lang = ref(normalizeLanguageCode(resolveInitialLanguage()));
  let teardown = null;

  function updateLanguage(next) {
    const normalized = normalizeLanguageCode(next);
    if (!normalized) return;
    const changed = normalized !== lang.value;
    if (changed) {
      lang.value = normalized;
    }
    if (changed) {
      syncLanguageSources(normalized);
    }
  }

  function translate(key, fallback = '', params) {
    const activeLang = lang.value || DEFAULT_LANGUAGE;
    let value = '';
    if (typeof window !== 'undefined') {
      try {
        const i18n = window.__i18n;
        if (i18n && typeof i18n.t === 'function') {
          const current = normalizeLanguageCode(i18n.current);
          if (!current || current === activeLang) {
            const candidate = i18n.t(key);
            if (typeof candidate === 'string' && candidate && candidate !== key) {
              value = candidate;
            }
          }
        }
      } catch {}
      if (!value) {
        try {
          const manager = window.languageManager;
          if (manager && typeof manager.getText === 'function') {
            const current = normalizeLanguageCode(manager.current);
            if (!current || current === activeLang) {
              const candidate =
                manager.getText.length >= 2
                  ? manager.getText(key, activeLang)
                  : manager.getText(key);
              if (typeof candidate === 'string' && candidate.trim() && candidate !== key) {
                value = candidate;
              }
            }
          }
        } catch {}
      }
    }

    if (!value || value === key) {
      const bundle = FALLBACK_TRANSLATIONS[activeLang];
      if (bundle && Object.prototype.hasOwnProperty.call(bundle, key)) {
        value = bundle[key];
      } else if (
        FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE] &&
        Object.prototype.hasOwnProperty.call(FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE], key)
      ) {
        value = FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE][key];
      }
    }

    if (!value || value === key) {
      value = fallback || key;
    }

    if (params && typeof params === 'object' && value && value.includes('{')) {
      value = value.replace(/\{(\w+)\}/g, (match, token) => {
        if (Object.prototype.hasOwnProperty.call(params, token)) {
          const paramValue = params[token];
          return paramValue == null ? '' : String(paramValue);
        }
        return '';
      });
    }

    return value;
  }

  if (typeof window !== 'undefined') {
    onMounted(() => {
      updateLanguage(resolveInitialLanguage());
      teardown = setupLanguageListeners(updateLanguage);
      syncLanguageSources(lang.value);
      ensureServerLanguagePreference();
    });

    onBeforeUnmount(() => {
      if (teardown) {
        teardown();
        teardown = null;
      }
    });
  }

  return {
    lang,
    setLanguage: (next) => updateLanguage(next),
    t: (key, fallback, params) => translate(key, fallback, params),
  };

  async function ensureServerLanguagePreference() {
    if (getLanguageFromQuery()) return;
    const serverPreferenceRaw = await fetchServerLanguagePreference();
    if (!serverPreferenceRaw) return;
    const serverPreference = normalizeLanguageCode(serverPreferenceRaw);
    if (!serverPreference) return;
    if (serverPreference !== lang.value) {
      updateLanguage(serverPreference);
    }
  }
}

const { t, lang, setLanguage } = usePublicProfileI18n();

const loading = ref(true);
const errorState = ref(null);
const payload = ref(null);
const slug = ref('');
const tzOffsetMinutes = ref(resolveLocalTimezoneOffset());
const locale = ref(mapLanguageToLocale(lang.value));
const bodyClasses = ['profile-page-mode'];
const isDark = ref(true);

const themeToggleLabel = computed(() =>
  isDark.value
    ? t('publicProfileToggleToLight', 'Switch to light theme')
    : t('publicProfileToggleToDark', 'Switch to dark theme')
);

const hasError = computed(() => Boolean(errorState.value));
const errorMessage = computed(() => {
  if (!errorState.value) return '';
  const { key, fallback, params } = errorState.value;
  return t(key, fallback, params);
});

function setError(key, fallback, params = {}) {
  errorState.value = { key, fallback, params };
}

function clearError() {
  errorState.value = null;
}

let storageHandler = null;
let mediaQuery = null;

const previousThemeState = {
  rootDark: false,
  rootLight: false,
  rootDataTheme: '',
  bodyDark: false,
  bodyLight: false,
  bodyClassicDark: false,
  bodyClassicLight: false,
};

const defaultSections = Object.freeze({
  header: true,
  summary: true,
  lifetime: true,
  chart: true,
  recent: true,
});

const sections = computed(() => {
  const merged = { ...defaultSections };
  const incoming = payload.value?.sections;
  if (incoming && typeof incoming === 'object') {
    for (const key of Object.keys(merged)) {
      if (incoming[key] === false) {
        merged[key] = false;
      } else if (incoming[key] === true) {
        merged[key] = true;
      }
    }
  }
  return merged;
});

const channelInfo = computed(() => payload.value?.channel || {});
const liveInfo = computed(() => payload.value?.live || {});

const FALLBACK_AVATAR_URL =
  'https://thumbnails.odycdn.com/optimize/s:0:0/quality:85/plain/https://player.odycdn.com/speech/spaceman-png:2.png';
const FALLBACK_AVATAR_COLORS = [
  '#00bcd4',
  '#ff9800',
  '#8bc34a',
  '#e91e63',
  '#9c27b0',
  '#3f51b5',
  '#ff5722',
  '#4caf50',
  '#2196f3',
  '#ffc107',
];

const MAX_CHART_BUCKETS = 30;
const summaryMetrics = computed(() => payload.value?.performance?.range || defaultSummary());
const lifetimeMetrics = computed(() => payload.value?.performance?.allTime || defaultLifetime());
const recentStreams = computed(() =>
  Array.isArray(payload.value?.performance?.recentStreams)
    ? payload.value.performance.recentStreams
    : []
);
const chartData = computed(() =>
  Array.isArray(payload.value?.summary?.data)
    ? payload.value.summary.data.slice(-MAX_CHART_BUCKETS)
    : []
);
const chartHasData = computed(() =>
  chartData.value.some((bucket) => {
    const hours = Number(bucket?.hours || 0);
    const avg = Number(bucket?.avgViewers || 0);
    const peak = Number(bucket?.peakViewers || 0);
    return (
      (Number.isFinite(hours) && hours > 0) ||
      (Number.isFinite(avg) && avg > 0) ||
      (Number.isFinite(peak) && peak > 0)
    );
  })
);

const showHoursSeries = ref(true);
const showAvgSeries = ref(true);

const CHART_VIEWBOX_WIDTH = 1200;
const CHART_VIEWBOX_HEIGHT = 360;
const CHART_PADDING = Object.freeze({ top: 40, right: 64, bottom: 76, left: 64 });

const numberFormatter = computed(() => new Intl.NumberFormat(locale.value || 'en-US'));
const decimalFormatter = computed(
  () =>
    new Intl.NumberFormat(locale.value || 'en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
);
const dateTimeFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value || 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
);
const chartLabelFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value || 'en-US', {
      month: 'short',
      day: 'numeric',
    })
);

const channelDisplayName = computed(() => {
  const info = channelInfo.value;
  return info.title || info.name || t('publicProfileFallbackChannelTitle', 'My Channel');
});

const channelHandle = computed(() => {
  const name = channelInfo.value?.name;
  if (!name) return '';
  return name.startsWith('@') ? name : `@${name}`;
});

const channelDescriptionFull = computed(() => {
  const text = channelInfo.value?.description;
  if (!text || typeof text !== 'string') return '';
  return text.trim();
});

const channelDescription = computed(() => {
  const text = channelDescriptionFull.value;
  if (!text) return '';
  if (text.length <= 240) return text;
  return `${text.slice(0, 237)}...`;
});

const channelUrl = computed(() => {
  const url = channelInfo.value?.url;
  return typeof url === 'string' && url ? url : '';
});

const channelCoverStyle = computed(() => {
  const url = channelInfo.value?.cover;
  if (url) {
    return {
      backgroundImage: `linear-gradient(120deg, rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.35)), url(${url})`,
    };
  }
  return {
    background: 'linear-gradient(120deg, rgba(99, 102, 241, 0.35), rgba(14, 116, 144, 0.35))',
  };
});

const channelAvatarStyle = computed(() => {
  const url = channelInfo.value?.thumbnail;
  if (url) {
    return { backgroundImage: `url(${url})` };
  }
  const fallbackCharCode = channelDisplayName.value ? channelDisplayName.value.charCodeAt(0) : 68;
  const paletteIndex = fallbackCharCode % FALLBACK_AVATAR_COLORS.length;
  const backgroundColor = FALLBACK_AVATAR_COLORS[paletteIndex];
  return {
    backgroundImage: `url(${FALLBACK_AVATAR_URL})`,
    backgroundColor,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
});

const followersDisplay = computed(() => {
  const raw = Number(channelInfo.value?.followers || 0);
  if (!Number.isFinite(raw) || raw <= 0) return '';
  return numberFormatter.value.format(Math.round(raw));
});

const liveBadgeClass = computed(() => (liveInfo.value?.isLive ? 'badge-live' : 'badge-muted'));
const liveStatusText = computed(() =>
  liveInfo.value?.isLive
    ? t('publicProfileLiveNow', 'Live now')
    : t('publicProfileOffline', 'Offline')
);

const updatedAtLabel = computed(() => {
  const value = payload.value?.generatedAt;
  if (!value) return '';
  try {
    return dateTimeFormatter.value.format(new Date(value));
  } catch {
    return '';
  }
});

const chartMaxHours = computed(() => {
  const values = chartData.value
    .map((bucket) => Number(bucket?.hours || 0))
    .filter((value) => Number.isFinite(value));
  const max = values.length ? Math.max(...values) : 0;
  return Math.max(max, 1);
});

const chartMaxAvgViewers = computed(() => {
  const values = chartData.value
    .map((bucket) => Number(bucket?.avgViewers || bucket?.peakViewers || 0))
    .filter((value) => Number.isFinite(value));
  const max = values.length ? Math.max(...values) : 0;
  return Math.max(max, 0);
});

const chartPreparedBuckets = computed(() =>
  chartData.value.map((bucket, index) => {
    const hours = Math.max(0, Number(bucket?.hours || 0));
    const avgViewers = Math.max(0, Number(bucket?.avgViewers || 0));
    const peakViewers = Math.max(0, Number(bucket?.peakViewers || 0));
    const date = resolveBucketDate(bucket);
    const label = (() => {
      if (!date) return '';
      try {
        return chartLabelFormatter.value.format(date);
      } catch {
        return date.toLocaleDateString();
      }
    })();
    return {
      key: `${bucketKey(bucket)}-${index}`,
      bucket,
      hours,
      avgViewers,
      peakViewers,
      date,
      label,
      tooltip: buildChartTooltip(bucket),
      index,
    };
  })
);

const chartGeometry = computed(() => {
  const prepared = chartPreparedBuckets.value;
  const viewBox = `0 0 ${CHART_VIEWBOX_WIDTH} ${CHART_VIEWBOX_HEIGHT}`;
  const bounds = {
    left: CHART_PADDING.left,
    right: CHART_VIEWBOX_WIDTH - CHART_PADDING.right,
    top: CHART_PADDING.top,
    bottom: CHART_VIEWBOX_HEIGHT - CHART_PADDING.bottom,
  };
  bounds.width = Math.max(0, bounds.right - bounds.left);
  bounds.height = Math.max(0, bounds.bottom - bounds.top);
  const guideRange = {
    start: Math.max(0, bounds.left - 24),
    end: Math.min(CHART_VIEWBOX_WIDTH, bounds.right + 24),
  };

  const includeHours = showHoursSeries.value;
  const includeAvg = showAvgSeries.value;

  if (
    !prepared.length ||
    (!includeHours && !includeAvg) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return {
      viewBox,
      bounds,
      guideRange,
      bars: [],
      points: [],
      guides: [],
      leftTicks: [],
      rightTicks: [],
      bottomLabels: [],
      linePath: '',
      areaPath: '',
    };
  }

  const count = prepared.length;
  const hoursMax = includeHours ? Math.max(chartMaxHours.value, 1) : 0;
  const viewersMax = includeAvg ? Math.max(chartMaxAvgViewers.value, 0) : 0;
  const segmentWidth = count > 0 ? bounds.width / count : bounds.width;
  const barWidth = Math.min(90, Math.max(18, segmentWidth * 0.55));
  const innerBottom = bounds.top + bounds.height;

  const bars = includeHours
    ? prepared.map((entry, index) => {
        const ratio = hoursMax > 0 ? entry.hours / hoursMax : 0;
        const barHeight = Math.max(4, ratio * bounds.height);
        const x = bounds.left + index * segmentWidth + (segmentWidth - barWidth) / 2;
        const y = innerBottom - barHeight;
        return {
          key: `bar-${entry.key}`,
          x,
          y,
          width: barWidth,
          height: barHeight,
          tooltip: entry.tooltip,
        };
      })
    : [];

  const showLine = includeAvg && viewersMax > 0;
  const points = showLine
    ? prepared.map((entry, index) => {
        const ratio = viewersMax > 0 ? entry.avgViewers / viewersMax : 0;
        const x = bounds.left + index * segmentWidth + segmentWidth / 2;
        const y = innerBottom - ratio * bounds.height;
        return {
          key: `point-${entry.key}`,
          x,
          y,
          tooltip: entry.tooltip,
        };
      })
    : [];

  let linePath = '';
  let areaPath = '';
  if (points.length >= 2) {
    linePath = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    areaPath = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const last = points[points.length - 1];
    const first = points[0];
    areaPath += ` L ${last.x.toFixed(2)} ${innerBottom.toFixed(2)} L ${first.x.toFixed(
      2
    )} ${innerBottom.toFixed(2)} Z`;
  } else {
    linePath = '';
    areaPath = '';
  }

  const guideSteps = 4;
  const guides = Array.from({ length: guideSteps + 1 }, (_, idx) => {
    const ratio = idx / guideSteps;
    const y = bounds.top + bounds.height * ratio;
    return {
      key: `guide-${idx}`,
      y,
      hoursValue: hoursMax * (1 - ratio),
      viewersValue: viewersMax * (1 - ratio),
    };
  });

  const axisFormatter = (value, kind) => {
    if (kind === 'hours') {
      return formatHours(value);
    }
    return formatNumber(value, 0);
  };

  const leftTicks = includeHours
    ? guides.map((guide) => ({
        key: `lh-${guide.key}`,
        y: guide.y,
        label: axisFormatter(guide.hoursValue, 'hours'),
      }))
    : [];

  const rightTicks =
    includeAvg && viewersMax
      ? guides.map((guide) => ({
          key: `rv-${guide.key}`,
          y: guide.y,
          label: axisFormatter(guide.viewersValue, 'viewers'),
        }))
      : [];

  const labelInterval = Math.max(1, Math.round(count / 8));
  const bottomLabels = prepared
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => index % labelInterval === 0 || index === count - 1)
    .map(({ entry, index }) => ({
      guideRange,
      key: `lbl-${entry.key}`,
      x: bounds.left + index * segmentWidth + segmentWidth / 2,
      label: entry.label,
    }));

  return {
    viewBox,
    bounds: { ...bounds, innerBottom },
    bars,
    points,
    guides,
    leftTicks,
    rightTicks,
    bottomLabels,
    linePath,
    areaPath,
  };
});

function bucketKey(bucket) {
  if (!bucket) return Math.random().toString(36).slice(2, 10);
  if (bucket.date) return `d-${bucket.date}`;
  if (bucket.epoch) return `e-${bucket.epoch}`;
  if (bucket.startEpoch) return `s-${bucket.startEpoch}`;
  return Math.random().toString(36).slice(2, 10);
}

function buildChartTooltip(bucket) {
  const date = resolveBucketDate(bucket);
  const dateLabel = (() => {
    if (!date) return '';
    try {
      return dateTimeFormatter.value.format(date);
    } catch {
      return date.toLocaleDateString();
    }
  })();
  const hoursLabel = formatHours(bucket?.hours);
  const avgLabel = formatNumber(bucket?.avgViewers, 1);
  const peakLabel = formatNumber(bucket?.peakViewers, 0);
  const lines = [];
  if (dateLabel) lines.push(dateLabel);
  lines.push(t('publicProfileTooltipHours', 'Hours streamed: {value}', { value: hoursLabel }));
  lines.push(t('publicProfileTooltipAverage', 'Average viewers: {value}', { value: avgLabel }));
  if (Number(bucket?.peakViewers || 0) > 0) {
    lines.push(t('publicProfileTooltipPeak', 'Peak viewers: {value}', { value: peakLabel }));
  }
  return lines.filter(Boolean).join('\n');
}

function toggleHoursSeries() {
  if (showHoursSeries.value && !showAvgSeries.value) return;
  showHoursSeries.value = !showHoursSeries.value;
}

function toggleAvgSeries() {
  if (showAvgSeries.value && !showHoursSeries.value) return;
  showAvgSeries.value = !showAvgSeries.value;
}

function resolveBucketDate(bucket) {
  if (!bucket) return null;
  if (Number.isFinite(Number(bucket?.epoch))) {
    const d = new Date(Number(bucket.epoch));
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (Number.isFinite(Number(bucket?.startEpoch))) {
    const d = new Date(Number(bucket.startEpoch));
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof bucket?.date === 'string' && bucket.date) {
    const parsed = new Date(bucket.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function defaultSummary() {
  return { hoursStreamed: 0, avgViewers: 0, peakViewers: 0, hoursWatched: 0, activeDays: 0 };
}

function defaultLifetime() {
  return { totalHoursStreamed: 0, highestViewers: 0 };
}

function formatNumber(value, minimumFractionDigits = 0) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (minimumFractionDigits > 0) {
    return decimalFormatter.value.format(num);
  }
  return numberFormatter.value.format(Math.round(num));
}

function formatHours(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return t('publicProfileHoursSuffix', '{value} h', { value: '0' });
  }
  const decimals = num >= 10 ? 1 : 2;
  const formatted = num
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
  return t('publicProfileHoursSuffix', '{value} h', { value: formatted });
}

function formatDuration(hours) {
  const totalMinutes = Math.max(0, Math.round(Number(hours || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) {
    return t('publicProfileDurationHoursMinutes', '{hours}h {minutes}m', {
      hours: h,
      minutes: m,
    });
  }
  if (h) {
    return t('publicProfileDurationHoursOnly', '{hours}h', { hours: h });
  }
  if (m) {
    return t('publicProfileDurationMinutesOnly', '{minutes}m', { minutes: m });
  }
  return t('publicProfileDurationUnavailable', 'N/A');
}

function formatDateTime(epoch) {
  if (!Number.isFinite(Number(epoch))) {
    return t('publicProfileDateTimeUnavailable', 'N/A');
  }
  try {
    return dateTimeFormatter.value.format(new Date(Number(epoch)));
  } catch {
    return t('publicProfileDateTimeUnavailable', 'N/A');
  }
}

function getStoredThemePreference() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return '';
}

function resolveThemePreference() {
  const stored = getStoredThemePreference();
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  try {
    const legacy = localStorage.getItem('prefers-dark');
    if (legacy === '1') return true;
    if (legacy === '0') return false;
  } catch {}
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

function applyTheme(dark, persist = true) {
  const nextIsDark = !!dark;
  if (isDark.value === nextIsDark && persist) return;
  isDark.value = nextIsDark;
  const themeLabel = nextIsDark ? 'dark' : 'light';
  const root = document.documentElement;
  if (root) {
    root.classList.toggle('dark', nextIsDark);
    root.classList.toggle('light', !nextIsDark);
    try {
      root.setAttribute('data-theme', themeLabel);
    } catch {}
  }
  const body = document.body;
  if (body) {
    body.classList.toggle('dark-mode', nextIsDark);
    body.classList.toggle('light-mode', !nextIsDark);
    body.classList.toggle('dark', nextIsDark);
    body.classList.toggle('light', !nextIsDark);
  }
  if (persist) {
    try {
      localStorage.setItem('theme', themeLabel);
    } catch {}
    try {
      localStorage.setItem('prefers-dark', nextIsDark ? '1' : '0');
    } catch {}
  }
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

function handleMediaChange(event) {
  if (!event) return;
  if (!getStoredThemePreference()) {
    applyTheme(!!event.matches, false);
  }
}

async function loadProfile() {
  if (!slug.value) {
    setError('publicProfileMissing', 'This public profile does not exist.');
    payload.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  clearError();
  try {
    const params = new URLSearchParams();
    params.set('tz', String(Number.isFinite(tzOffsetMinutes.value) ? tzOffsetMinutes.value : 0));
    const endpoint = `/api/user-profile/public/${encodeURIComponent(
      slug.value
    )}?${params.toString()}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      let responseData = null;
      try {
        responseData = await res.json();
      } catch {}
      if (res.status === 404 || responseData?.error === 'not_found') {
        setError('publicProfileNotAvailable', 'This public profile is not available.');
      } else {
        const fallbackMessage =
          typeof responseData?.message === 'string' && responseData.message.trim()
            ? responseData.message.trim()
            : 'Failed to load profile.';
        setError('publicProfileLoadFailed', fallbackMessage);
      }
      payload.value = null;
      return;
    }
    const data = await res.json();
    payload.value = data;
  } catch {
    setError('publicProfileLoadUnknown', 'Something went wrong while loading this profile.');
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const root = document.documentElement;
  if (root) {
    previousThemeState.rootDark = root.classList.contains('dark');
    previousThemeState.rootLight = root.classList.contains('light');
    previousThemeState.rootDataTheme = root.getAttribute('data-theme') || '';
  }
  if (document.body) {
    previousThemeState.bodyDark = document.body.classList.contains('dark-mode');
    previousThemeState.bodyLight = document.body.classList.contains('light-mode');
    previousThemeState.bodyClassicDark = document.body.classList.contains('dark');
    previousThemeState.bodyClassicLight = document.body.classList.contains('light');
  }

  bodyClasses.forEach((cls) => {
    if (!document.body.classList.contains(cls)) {
      document.body.classList.add(cls);
    }
  });

  const initialDark = resolveThemePreference();
  applyTheme(initialDark, false);

  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleMediaChange);
    }
  }

  storageHandler = (event) => {
    if (!event) return;
    if (event.key && event.key !== 'theme' && event.key !== 'prefers-dark') return;
    applyTheme(resolveThemePreference(), false);
  };
  try {
    window.addEventListener('storage', storageHandler);
  } catch {}

  const match = window.location.pathname.match(/\/profile\/([a-z0-9-]{8,32})/i);
  if (match) {
    slug.value = match[1].toLowerCase();
  }
  tzOffsetMinutes.value = resolveLocalTimezoneOffset();
  loadProfile();
});

onBeforeUnmount(() => {
  bodyClasses.forEach((cls) => {
    document.body.classList.remove(cls);
  });

  if (mediaQuery) {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleMediaChange);
    } else if (mediaQuery.removeListener) {
      mediaQuery.removeListener(handleMediaChange);
    }
    mediaQuery = null;
  }

  if (storageHandler) {
    try {
      window.removeEventListener('storage', storageHandler);
    } catch {}
    storageHandler = null;
  }

  const root = document.documentElement;
  if (root) {
    root.classList.toggle('dark', previousThemeState.rootDark);
    root.classList.toggle('light', previousThemeState.rootLight);
    if (previousThemeState.rootDataTheme) {
      root.setAttribute('data-theme', previousThemeState.rootDataTheme);
    } else {
      root.removeAttribute('data-theme');
    }
  }
  if (document.body) {
    document.body.classList.toggle('dark-mode', previousThemeState.bodyDark);
    document.body.classList.toggle('light-mode', previousThemeState.bodyLight);
    document.body.classList.toggle('dark', previousThemeState.bodyClassicDark);
    document.body.classList.toggle('light', previousThemeState.bodyClassicLight);
  }

  restoreSeoMeta();
});

const documentTitleSuffix = computed(() => t('publicProfileDocumentSuffix', 'getty profile'));

const pageTitle = computed(() => {
  const suffix = documentTitleSuffix.value || 'getty';
  if (payload.value && channelDisplayName.value) {
    return `${channelDisplayName.value} · ${suffix}`;
  }
  return suffix;
});

const canonicalUrl = computed(() => {
  const shareUrl = payload.value?.profile?.shareUrl;
  if (typeof shareUrl === 'string' && shareUrl.trim()) {
    const resolved = ensureAbsoluteUrl(shareUrl);
    if (resolved) return resolved;
  }
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin || '';
  const path = slug.value ? `/profile/${slug.value}` : window.location.pathname || '';
  return origin ? `${origin}${path}` : path;
});

const seoSiteName = computed(() => t('publicProfileSeoSiteName', 'getty'));

const seoDescription = computed(() => {
  const full = channelDescriptionFull.value;
  if (full) {
    return shortenText(full, 200);
  }
  const name = channelDisplayName.value || t('publicProfileFallbackChannelTitle', 'My Channel');
  const fallback = t(
    'publicProfileSeoDescription',
    'Explore streaming analytics and recent highlights for {name} on getty.',
    { name }
  );
  return shortenText(fallback, 200);
});

const seoImage = computed(() => {
  const sources = [channelInfo.value?.cover, channelInfo.value?.thumbnail, FALLBACK_AVATAR_URL];
  for (const source of sources) {
    const resolved = ensureAbsoluteUrl(source);
    if (resolved) return resolved;
  }
  return '';
});

const seoImageAlt = computed(() => {
  const name = channelDisplayName.value || t('publicProfileFallbackChannelTitle', 'My Channel');
  return t('publicProfileSeoImageAlt', '{name} public profile preview', { name });
});

const openGraphLocale = computed(() => {
  const candidate = locale.value || 'en-US';
  return candidate.replace(/-/g, '_');
});

const twitterCardType = computed(() => (seoImage.value ? 'summary_large_image' : 'summary'));

const profileUsername = computed(() => {
  const handle = channelHandle.value;
  if (!handle) return '';
  return handle.replace(/^@/, '');
});

const twitterCreator = computed(() => channelHandle.value || '');

const twitterDomain = computed(() => {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
});

watch(
  lang,
  (value) => {
    const normalized = normalizeLanguageCode(value);
    locale.value = mapLanguageToLocale(normalized);
    syncLanguageQueryParam(normalized);
  },
  { immediate: true }
);

if (typeof window !== 'undefined') {
  watch(
    pageTitle,
    (value) => {
      if (typeof document !== 'undefined') {
        document.title = value;
      }
    },
    { immediate: true }
  );

  watch(
    () => [
      pageTitle.value,
      seoDescription.value,
      canonicalUrl.value,
      seoImage.value,
      seoSiteName.value,
      openGraphLocale.value,
      seoImageAlt.value,
      profileUsername.value,
      twitterCreator.value,
      twitterCardType.value,
      twitterDomain.value,
    ],
    ([
      title,
      description,
      canonical,
      image,
      siteName,
      ogLocale,
      imageAlt,
      profileUser,
      creator,
      cardType,
      domain,
    ]) => {
      applySeoMeta({
        title,
        description,
        canonical,
        image,
        siteName,
        ogLocale,
        imageAlt,
        profileUsername: profileUser,
        twitterCreator: creator,
        twitterCard: cardType,
        twitterDomain: domain,
      });
    },
    { immediate: true }
  );
}
</script>

<style scoped>
.public-profile-page {
  min-height: 100vh;
  background: var(--profile-bg);
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
}

.profile-container {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 clamp(16px, 4vw, 32px) 48px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.public-profile-page.theme-dark {
  --profile-bg: #09090b;
  --text-primary: #f4f4f5;
  --text-secondary: rgba(161, 161, 170, 0.9);
  --surface-card: rgb(15 18 20);
  --surface-card-alt: rgba(24, 24, 27, 0.92);
  --surface-border: rgba(39, 39, 42, 0.75);
  --surface-border-strong: rgba(39, 39, 42, 0.9);
  --status-card-bg: rgb(15 18 20);
  --status-card-border: rgba(39, 39, 42, 0.8);
  --status-error-bg: rgb(15 18 20);
  --status-error-border: rgba(248, 113, 113, 0.45);
  --status-error-text: #fecaca;
  --badge-live-bg: rgba(248, 113, 113, 0.18);
  --badge-live-color: #fca5a5;
  --badge-muted-bg: rgba(113, 113, 122, 0.26);
  --badge-muted-color: rgba(228, 228, 231, 0.88);
  --link-color: #8b5cf6;
  --profile-header-bg: rgb(15 18 20);
  --profile-header-border: rgba(39, 39, 42, 0.9);
  --avatar-border: rgba(24, 24, 27, 0.98);
  --recent-meta-color: rgba(161, 161, 170, 0.85);
  --recent-card-bg: rgb(15 18 20);
  --recent-border: rgba(39, 39, 42, 0.8);
  --chart-surface-bg: rgb(15 18 20);
  --chart-empty-border: rgba(63, 63, 70, 0.55);
  --chart-gradient-start: rgba(129, 140, 248, 0.92);
  --chart-gradient-end: rgba(99, 102, 241, 0.85);
  --header-border: rgba(39, 39, 42, 0.85);
  --theme-toggle-bg: rgb(15 18 20);
  --theme-toggle-border: rgba(63, 63, 70, 0.7);
  --recent-stat-text: #0f172a;
}

.public-profile-page.theme-light {
  --profile-bg: linear-gradient(180deg, #f4f4f5, #ffffff 55%, #f8fafc);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --surface-card: #ffffff;
  --surface-card-alt: #f8fafc;
  --surface-border: rgba(203, 213, 225, 0.7);
  --surface-border-strong: rgba(148, 163, 184, 0.8);
  --status-card-bg: #f8fafc;
  --status-card-border: rgba(203, 213, 225, 0.9);
  --status-error-bg: rgba(254, 226, 226, 0.92);
  --status-error-border: rgba(248, 113, 113, 0.55);
  --status-error-text: #b91c1c;
  --badge-live-bg: rgba(254, 226, 226, 0.95);
  --badge-live-color: #b91c1c;
  --badge-muted-bg: rgba(226, 232, 240, 0.95);
  --badge-muted-color: #1f2937;
  --link-color: #2563eb;
  --profile-header-bg: #ffffff;
  --profile-header-border: rgba(203, 213, 225, 0.85);
  --avatar-border: #ffffff;
  --recent-meta-color: #64748b;
  --recent-card-bg: #ffffff;
  --recent-border: rgba(203, 213, 225, 0.85);
  --chart-surface-bg: #ffffff;
  --chart-empty-border: rgba(203, 213, 225, 0.65);
  --chart-gradient-start: rgba(59, 130, 246, 0.92);
  --chart-gradient-end: rgba(37, 99, 235, 0.88);
  --header-border: rgba(203, 213, 225, 0.7);
  --theme-toggle-bg: #ffffff;
  --theme-toggle-border: rgba(203, 213, 225, 0.9);
  --recent-stat-text: #0f172a;
}

.site-header {
  width: 100%;
  padding: 24px 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--header-border);
}

.logo-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.logo-dark,
.logo-light {
  height: 36px;
  width: auto;
  display: none;
}

.public-profile-page.theme-dark .logo-dark,
.public-profile-page.theme-light .logo-light {
  display: inline-block;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-switcher {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--theme-toggle-border);
  background: var(--theme-toggle-bg);
  overflow: hidden;
}

.lang-option {
  appearance: none;
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.lang-option:hover,
.lang-option:focus-visible {
  background: rgba(59, 130, 246, 0.12);
  color: var(--text-primary);
  outline: none;
}

.lang-option.active {
  background: var(--link-color);
  color: #ffffff;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--theme-toggle-border);
  background: var(--theme-toggle-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  border-color: var(--link-color);
  color: var(--link-color);
  outline: none;
}

.theme-toggle:focus-visible {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
}

.theme-icon {
  display: none;
  width: 18px;
  height: 18px;
}

.public-profile-page.theme-light .theme-toggle .sun-icon,
.public-profile-page.theme-dark .theme-toggle .moon-icon {
  display: inline-block;
}

.profile-main {
  width: 100%;
  padding: 0;
  box-sizing: border-box;
  flex: 1;
}

.status-card {
  margin-top: 48px;
  padding: 28px;
  border-radius: 18px;
  text-align: center;
  background: var(--status-card-bg);
  border: 1px solid var(--status-card-border);
}

.status-label {
  font-size: 1rem;
  color: var(--text-secondary);
}

.status-error {
  background: var(--status-error-bg);
  border-color: var(--status-error-border);
  color: var(--status-error-text);
}

.status-error h1 {
  margin: 0 0 12px;
  font-size: 1.4rem;
  color: inherit;
}

.profile-card {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-hero {
  position: relative;
}

.profile-cover {
  height: 200px;
  border-radius: 20px;
  background-size: cover;
  background-position: center;
}

.profile-header {
  position: relative;
  margin-top: -26px;
  display: flex;
  gap: 18px;
  padding: 20px;
  background: var(--profile-header-bg);
  border: 1px solid var(--profile-header-border);
  border-radius: 12px;
  color: var(--text-primary);
}

.profile-avatar {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border: 3px solid var(--avatar-border);
  border-radius: 24px;
  background-size: cover;
  background-position: center;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-handle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-live {
  background: var(--badge-live-bg);
  color: var(--badge-live-color);
}

.badge-muted {
  background: var(--badge-muted-bg);
  color: var(--badge-muted-color);
}

.profile-description {
  margin: 0;
  max-width: 640px;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.profile-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.profile-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #eb2565;
  text-decoration: none;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.08);
  padding: 6px 12px;
}
.profile-link:hover,
.profile-link:focus-visible {
  background: rgba(37, 99, 235, 0.16);
}
.profile-link:focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}

.profile-link-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: block;
  flex-shrink: 0;
}

.profile-tz {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.summary-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.summary-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 16px;
}

.summary-label {
  font-size: 14px;
  font-weight: 600;
}

.summary-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}

.lifetime-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.lifetime-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 16px;
}

.lifetime-label {
  font-size: 14px;
  font-weight: 600;
}

.lifetime-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-section {
  padding: 20px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}

.updated-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.chart-visual {
  margin-top: 12px;
  padding: 8px 0px 0px;
  background: var(--surface-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
}

.legend-item > span:last-child {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-item:hover {
  opacity: 0.85;
}

.legend-item:focus-visible {
  outline: 2px solid rgba(34, 97, 238, 0.6);
  outline-offset: 2px;
}

.legend-viewers.legend-active {
  border-color: rgba(235, 37, 101, 0.5);
  background: rgba(235, 37, 101, 0.08);
  color: var(--text-primary);
}

.legend-hours.legend-active {
  border-color: rgba(34, 97, 238, 0.5);
  background: rgba(34, 97, 238, 0.08);
  color: var(--text-primary);
}

.legend-inactive {
  opacity: 0.45;
}

.legend-swatch {
  display: inline-block;
  border-radius: 999px;
}

.legend-swatch-line {
  width: 12px;
  height: 6px;
  position: relative;
  background: #eb2565;
  border-radius: 999px;
}

.legend-swatch-bar {
  width: 16px;
  height: 14px;
  border-radius: 4px;
  background: #2261ee;
}

.activity-chart {
  width: 100%;
  height: auto;
  min-height: 260px;
  display: block;
  color: var(--text-secondary);
}

.chart-guide-line {
  stroke: rgba(148, 163, 184, 0.24);
  stroke-width: 1;
  stroke-dasharray: 2 8;
}

.public-profile-page.theme-dark .chart-guide-line {
  stroke: rgba(63, 63, 70, 0.42);
}

.chart-baseline {
  stroke: rgba(148, 163, 184, 0.4);
  stroke-width: 1.2;
}

.public-profile-page.theme-dark .chart-baseline {
  stroke: rgba(99, 102, 241, 0.5);
}

.chart-bar-rect {
  fill: #2261ee;
}

.chart-line-area {
  fill: rgba(235, 37, 101, 0.12);
}

.chart-line-path {
  fill: none;
  stroke: #eb2565;
  stroke-width: 4;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.public-profile-page.theme-dark .chart-line-path {
  stroke: #ff4f8a;
}

.chart-point {
  fill: #eb2565;
  stroke: #ffffff;
  stroke-width: 2.2;
}

.public-profile-page.theme-dark .chart-point {
  fill: #ff4f8a;
  stroke: rgba(15, 23, 42, 0.95);
}

.chart-axis-text {
  font-size: 0.75rem;
  fill: var(--text-secondary);
}

.chart-axis-text-right {
  fill: var(--text-secondary);
}

.chart-axis-bottom text {
  font-size: 0.78rem;
}

.chart-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  border: 1px dashed var(--chart-empty-border);
  border-radius: 16px;
}

.recent-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 18px;
}

.recent-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.recent-item {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 176px;
  background: var(--recent-card-bg);
  border: 1px solid var(--recent-border);
  border-radius: 16px;
  color: var(--text-primary);
}

.recent-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.recent-date {
  font-weight: 500;
}

.recent-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--recent-stat-text, #0f172a);
}

.recent-stat dt {
  margin: 0;
  font-weight: 600;
}

.recent-stat dd {
  margin: 0;
  font-weight: 700;
}

.recent-stat-duration {
  background: #fbbf24e6;
}

.recent-stat-avg {
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.9), rgba(6, 182, 212, 0.9));
}

.recent-stat-peak {
  background: linear-gradient(90deg, rgba(134, 239, 172, 0.9), rgba(34, 197, 94, 0.9));
}

.recent-stat-hours {
  background: linear-gradient(90deg, rgba(129, 140, 248, 0.9), rgba(79, 70, 229, 0.9));
}

.recent-empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--recent-meta-color);
}

@media (max-width: 640px) {
  .site-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 0 10px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-avatar {
    margin-top: -40px;
  }

  .profile-links {
    justify-content: center;
  }

  .section-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .chart-grid {
    grid-template-columns: repeat(auto-fit, minmax(48px, 1fr));
  }

  .recent-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
