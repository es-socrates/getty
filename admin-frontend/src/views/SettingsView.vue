<template>
  <section class="admin-tab active">
    <div class="mb-4">
      <h3 class="text-lg font-semibold mb-2">
        {{ t('tenantConfigManagement') || 'Tenant Configuration' }}
      </h3>
      <p class="text-sm opacity-70 mb-4">
        {{
          t('tenantConfigDescription') ||
          'Export or import your tenant configuration settings. This includes all module configurations for your wallet session.'
        }}
      </p>

      <div class="flex gap-3 mb-4">
        <button
          @click="exportConfig"
          :disabled="exporting"
          class="btn btn-secondary btn-compact-secondary">
          {{
            exporting
              ? t('exporting') || 'Exporting...'
              : t('exportConfig') || 'Export Configuration'
          }}
        </button>

        <label class="btn btn-secondary btn-compact-secondary cursor-pointer">
          {{ t('importConfig') || 'Import Configuration' }}
          <input type="file" accept=".json" @change="handleFileSelect" class="hidden" />
        </label>
      </div>

      <div v-if="importResult" class="mt-6 space-y-6">
        <div
          class="rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] p-4 transition-colors dark:bg-[var(--bg-card)]"
          :class="resultCardClass">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] transition-colors"
              :class="resultIconClass">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <template v-if="resultState === 'success'">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </template>
                <template v-else-if="resultState === 'partial'">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm0 2a10 10 0 110-20 10 10 0 010 20z" />
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M9 7a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z" />
                </template>
                <template v-else>
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.828-10.828a1 1 0 10-1.414-1.414L10 8.172 8.586 6.758a1 1 0 10-1.414 1.414L8.586 9.586 7.172 11a1 1 0 101.414 1.414L10 11.414l1.414 1.414a1 1 0 001.414-1.414L11.414 9.586l1.414-1.414z" />
                </template>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="text-base font-semibold" :class="resultAccentClass">
                {{ resultTitle }}
              </h4>
              <p v-if="resultMessage" class="mt-1 text-sm" :class="resultAccentMutedClass">
                {{ resultMessage }}
              </p>
              <div v-if="summaryBadges.length" class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="badge in summaryBadges"
                  :key="badge.id"
                  class="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--bg-chat)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors"
                  :class="badge.class">
                  <span
                    class="inline-block h-1.5 w-1.5 rounded-full"
                    :class="badge.dotClass"></span>
                  {{ badge.text }}
                </span>
              </div>
              <div
                v-if="metaInfo.length"
                class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs opacity-70">
                <div v-for="meta in metaInfo" :key="meta.label" class="flex items-center gap-1">
                  <span class="font-semibold">{{ meta.label }}:</span>
                  <span>{{ meta.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="moduleStatusList.length" class="space-y-3">
          <h4 class="text-xs font-semibold uppercase tracking-wide opacity-70">
            {{ t('configImportDetailsHeading') || 'Module status' }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="item in moduleStatusList"
              :key="item.key"
              class="flex flex-col gap-2 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-sm truncate">{{ item.label }}</span>
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--bg-chat)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors"
                  :class="item.badgeClass">
                  <template v-if="item.icon === 'success'">
                    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </template>
                  <template v-else-if="item.icon === 'skipped'">
                    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm0 2a10 10 0 110-20 10 10 0 010 20z" />
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 6a1 1 0 00-1 1v4a1 1 0 102 0V7a1 1 0 00-1-1zm0 7.75a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" />
                    </svg>
                  </template>
                  <template v-else>
                    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.828-10.828a1 1 0 10-1.414-1.414L10 8.172 8.586 6.758a1 1 0 10-1.414 1.414L8.586 9.586 7.172 11a1 1 0 101.414 1.414L10 11.414l1.414 1.414a1 1 0 001.414-1.414L11.414 9.586l1.414-1.414z" />
                    </svg>
                  </template>
                  {{ item.statusLabel }}
                </span>
              </div>
              <div v-if="item.description" class="text-[11px] leading-snug opacity-70">
                {{ item.description }}
              </div>
              <div v-if="item.error" class="text-[11px] leading-snug text-red-600">
                {{ item.error }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="mt-4 rounded border border-red-500 bg-red-50 p-3">
        <h4 class="font-semibold text-red-600">{{ t('error') || 'Error' }}</h4>
        <p class="text-sm text-red-600">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, te } = useI18n();

const exporting = ref(false);
const importResult = ref(null);
const error = ref(null);

const moduleOrder = [
  'announcement',
  'socialmedia',
  'tip-goal',
  'last-tip',
  'raffle',
  'achievements',
  'chat',
  'liveviews',
  'external-notifications',
];

const kebabToCamel = (str) => {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
};

const getConfigLabel = (key) => {
  const normalizedKey = kebabToCamel(key);

  const labels = {
    announcement: t('announcementModule') || 'Announcement',
    socialmedia: t('socialModule') || 'Social Networks',
    tipGoal: t('tipGoalModule') || 'Tip Goal',
    lastTip: t('lastTipModule') || 'Last Tip',
    raffle: t('raffleModule') || 'Raffle',
    achievements: t('achievementsModule') || 'Achievements',
    chat: t('chatModule') || 'Chat',
    liveviews: t('liveviewsModule') || 'Live viewers',
    externalNotifications: t('externalNotificationsTitle') || 'External notifications',
  };
  return labels[normalizedKey] || key;
};

const getBadgeClass = (result) => {
  if (result.success && !result.skipped) {
    return 'border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-900/30 dark:text-emerald-200';
  }
  if (result.success && result.skipped) {
    return 'border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-400/50 dark:bg-amber-900/30 dark:text-amber-200';
  }
  return 'border-red-400/60 bg-red-50 text-red-700 dark:border-red-400/50 dark:bg-red-900/30 dark:text-red-200';
};

const getStatusLabel = (result) => {
  if (result.success && result.skipped) {
    return t('configImportSkipped') || 'Skipped';
  }
  if (result.success) {
    return t('configImportAppliedLabel') || 'Imported';
  }
  return t('configImportFailed') || 'Failed';
};

const formatCount = (count, singularKey, pluralKey, singularFallback, pluralFallback) => {
  const key = count === 1 ? singularKey : pluralKey;
  const fallback = count === 1 ? singularFallback : pluralFallback;
  if (typeof te === 'function' && te(key)) {
    return t(key, { count });
  }
  return fallback.replace('{count}', count);
};

const summaryCounts = computed(() => {
  const results = importResult.value?.results;
  if (!results) return { imported: 0, skipped: 0, failed: 0 };

  return Object.values(results).reduce(
    (acc, item) => {
      if (item?.success) {
        if (item.skipped) acc.skipped += 1;
        else acc.imported += 1;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    { imported: 0, skipped: 0, failed: 0 }
  );
});

const resultState = computed(() => {
  if (!importResult.value) return null;
  if (summaryCounts.value.failed > 0) return 'failed';
  if (summaryCounts.value.skipped > 0) return 'partial';
  return 'success';
});

const resultTitle = computed(() => {
  if (!importResult.value) return '';
  if (resultState.value === 'failed') {
    return t('configImportFailedTitle') || 'Import Failed';
  }
  if (resultState.value === 'partial') {
    return t('configImportPartialTitle') || 'Import completed with warnings';
  }
  return t('configImportSuccessTitle') || 'Import Successful';
});

const resultMessage = computed(() => {
  if (!importResult.value) return '';
  if (resultState.value === 'failed') {
    return t('configImportFailedDescription') || 'Fix the errors below and try again.';
  }
  if (resultState.value === 'partial') {
    return (
      t('configImportPartialDescription') ||
      'Some modules were skipped or failed. Review the list below.'
    );
  }
  return t('configImportNoIssues') || 'All modules imported successfully.';
});

const resultCardClass = computed(() => {
  if (resultState.value === 'failed') {
    return 'border-red-400/60 bg-red-50/80 dark:border-red-400/60 dark:bg-red-900/20';
  }
  if (resultState.value === 'partial') {
    return 'border-amber-400/60 bg-amber-50/80 dark:border-amber-400/60 dark:bg-amber-900/20';
  }
  if (resultState.value === 'success') {
    return 'border-emerald-400/60 bg-emerald-50/80 dark:border-emerald-400/60 dark:bg-emerald-900/20';
  }
  return '';
});

const resultIconClass = computed(() => {
  if (resultState.value === 'failed') {
    return 'border-red-400/60 bg-red-100 text-red-700 dark:border-red-400/50 dark:bg-red-900/40 dark:text-red-200';
  }
  if (resultState.value === 'partial') {
    return 'border-amber-400/60 bg-amber-100 text-amber-700 dark:border-amber-400/50 dark:bg-amber-900/40 dark:text-amber-200';
  }
  if (resultState.value === 'success') {
    return 'border-emerald-400/60 bg-emerald-100 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  return '';
});

const resultAccentClass = computed(() => {
  if (resultState.value === 'failed') return 'text-red-700 dark:text-red-200';
  if (resultState.value === 'partial') return 'text-amber-700 dark:text-amber-200';
  if (resultState.value === 'success') return 'text-emerald-700 dark:text-emerald-200';
  return '';
});

const resultAccentMutedClass = computed(() => {
  if (resultState.value === 'failed') return 'text-red-700/80 dark:text-red-200/90';
  if (resultState.value === 'partial') return 'text-amber-700/80 dark:text-amber-200/90';
  if (resultState.value === 'success') return 'text-emerald-700/80 dark:text-emerald-200/90';
  return 'text-[var(--text-secondary)]';
});

const summaryBadges = computed(() => {
  const badges = [];
  const counts = summaryCounts.value;

  if (counts.imported) {
    badges.push({
      id: 'imported',
      text: formatCount(
        counts.imported,
        'configImportImportedSingle',
        'configImportImportedPlural',
        '{count} module imported',
        '{count} modules imported'
      ),
      class:
        'border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-900/30 dark:text-emerald-200',
      dotClass: 'bg-emerald-500 dark:bg-emerald-300',
    });
  }
  if (counts.skipped) {
    badges.push({
      id: 'skipped',
      text: formatCount(
        counts.skipped,
        'configImportSkippedSingle',
        'configImportSkippedPlural',
        '{count} module skipped',
        '{count} modules skipped'
      ),
      class:
        'border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-400/50 dark:bg-amber-900/30 dark:text-amber-200',
      dotClass: 'bg-amber-500 dark:bg-amber-300',
    });
  }
  if (counts.failed) {
    badges.push({
      id: 'failed',
      text: formatCount(
        counts.failed,
        'configImportFailedSingle',
        'configImportFailedPlural',
        '{count} module failed',
        '{count} modules failed'
      ),
      class:
        'border-red-400/60 bg-red-50 text-red-700 dark:border-red-400/50 dark:bg-red-900/30 dark:text-red-200',
      dotClass: 'bg-red-500 dark:bg-red-300',
    });
  }
  return badges;
});

const formattedTimestamp = computed(() => {
  const ts = importResult.value?.timestamp;
  if (!ts) return '';
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date
    );
  } catch {
    return ts;
  }
});

const metaInfo = computed(() => {
  const info = [];
  if (importResult.value?.namespace) {
    info.push({
      label: t('configImportMetaNamespace') || 'Namespace',
      value: importResult.value.namespace,
    });
  }
  if (formattedTimestamp.value) {
    info.push({
      label: t('configImportMetaTimestamp') || 'Completed',
      value: formattedTimestamp.value,
    });
  }
  return info;
});

const moduleStatusList = computed(() => {
  const results = importResult.value?.results;
  if (!results) return [];

  const orderedKeys = moduleOrder
    .filter((key) => key in results)
    .concat(Object.keys(results).filter((key) => !moduleOrder.includes(key)));

  return orderedKeys.map((key) => {
    const result = results[key] || {};
    const skipped = !!(result.success && result.skipped);
    const success = !!(result.success && !result.skipped);
    const failed = !result.success;

    return {
      key,
      label: getConfigLabel(key),
      badgeClass: getBadgeClass(result),
      statusLabel: getStatusLabel(result),
      icon: success ? 'success' : skipped ? 'skipped' : 'failed',
      description: skipped
        ? t('configImportSkippedHint') || 'No changes were provided in the file.'
        : '',
      error: failed ? result.error || '' : '',
    };
  });
});

const exportConfig = async () => {
  try {
    exporting.value = true;
    error.value = null;

    const response = await fetch('/api/admin/tenant/config-export', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') ||
      'tenant-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err.message;
  } finally {
    exporting.value = false;
  }
};

const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    error.value = null;
    importResult.value = null;

    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData || typeof importData !== 'object') {
      throw new Error(t('invalidJsonFormat') || 'Invalid JSON format');
    }

    if (!importData.configs || typeof importData.configs !== 'object') {
      throw new Error(t('missingConfigs') || 'Missing configs section in JSON');
    }

    const expectedKeys = [
      'announcement',
      'socialmedia',
      'tipGoal',
      'tip-goal',
      'lastTip',
      'last-tip',
      'raffle',
      'achievements',
      'chat',
      'liveviews',
    ];
    const hasValidConfigs = expectedKeys.some((key) => importData.configs[key] !== undefined);

    if (!hasValidConfigs) {
      throw new Error(t('noValidConfigs') || 'No valid configuration sections found');
    }

    const response = await fetch('/api/admin/tenant/config-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(importData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Import failed');
    }

    importResult.value = result;

    event.target.value = '';
  } catch (err) {
    error.value = err.message;
  }
};
</script>

<style scoped></style>
