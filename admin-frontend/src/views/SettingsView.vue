<template>
  <section class="admin-tab active">
    <div
      class="text-sm opacity-70 p-3 border border-[var(--card-border)] rounded-os-sm bg-[var(--bg-chat)]">
      {{
        t('walletOnlySettingsPlaceholder') ||
        'All legacy session token tools have been removed. Future global settings will appear here.'
      }}
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped></style>
