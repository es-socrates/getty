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

      <div
        v-if="importResult"
        class="mt-4 p-3 border rounded"
        :class="importResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'">
        <h4 class="font-semibold">
          {{
            importResult.success
              ? t('configImportSuccessTitle') || 'Import Successful'
              : t('configImportFailedTitle') || 'Import Failed'
          }}
        </h4>
        <div v-if="importResult.results" class="mt-2 text-sm">
          <div v-for="(result, key) in importResult.results" :key="key">
            <span class="font-medium">{{ key }}:</span>
            <span :class="result.success ? 'text-green-600' : 'text-red-600'">
              {{
                result.success
                  ? result.skipped
                    ? 'Skipped'
                    : 'Success'
                  : `Failed: ${result.error}`
              }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="error" class="mt-4 p-3 border border-red-500 bg-red-50 rounded">
        <h4 class="font-semibold text-red-600">{{ t('error') || 'Error' }}</h4>
        <p class="text-sm text-red-600">{{ error }}</p>
      </div>
    </div>

    <div v-if="importResult && importResult.results" class="mt-6">
      <h3 class="text-lg font-semibold mb-4">
        {{ t('tenantConfigManagement') || 'Configuration Status' }}
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div
          v-for="(result, key) in importResult.results"
          :key="key"
          class="p-2 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] flex flex-col gap-1">
          <div class="flex items-center gap-1 justify-between">
            <span class="font-medium">{{ getConfigLabel(key) }}</span>
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide"
              :class="getBadgeClass(result)">
              <template v-if="result.success && !result.skipped">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd" />
                </svg>
                {{ t('commonOn') || 'On' }}
              </template>
              <template v-else-if="result.success && result.skipped">
                {{ t('configImportSkipped') || 'Skipped' }}
              </template>
              <template v-else>
                {{ t('configImportFailed') || 'Failed' }}
              </template>
            </span>
          </div>
          <div
            v-if="!result.success && result.error"
            class="text-[10px] opacity-70 leading-snug text-red-600">
            {{ result.error }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const exporting = ref(false);
const importResult = ref(null);
const error = ref(null);

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
  };
  return labels[normalizedKey] || key;
};

const getBadgeClass = (result) => {
  if (result.success && !result.skipped) {
    return 'bg-[var(--badge-active-bg)] text-[var(--badge-active-fg)]';
  } else if (result.success && result.skipped) {
    return 'bg-[var(--badge-configured-bg)] text-[var(--badge-configured-fg)]';
  } else {
    return 'bg-[var(--badge-inactive-bg)] text-[var(--badge-inactive-fg)]';
  }
};

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
