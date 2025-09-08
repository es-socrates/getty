<template>
  <OsCard>
    <template #header>
      <h3 class="os-card-title flex items-center gap-1.5">
        <span class="icon os-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M4 6h16" />
            <path d="M4 10h10" />
            <path d="M4 14h16" />
            <path d="M4 18h10" />
          </svg>
        </span>
        {{ t('activityLogTitle') || 'Activity Log' }}
      </h3>
    </template>
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <div class="flex items-center gap-2">
        <label class="text-sm">{{ t('activityLevelLabel') }}</label>
        <div class="relative h-full overflow-hidden rounded-full">
          <select
            v-model="level"
            class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]">
            <option value="">{{ t('activityAll') }}</option>
            <option value="info">{{ t('activityInfo') }}</option>
            <option value="warn">{{ t('activityWarn') }}</option>
            <option value="error">{{ t('activityError') }}</option>
          </select>
          <svg
            class="pointer-events-none absolute top-1/2 right-4 transform -translate-y-1/2"
            width="17"
            height="16"
            viewBox="0 0 17 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13.1673 6L8.50065 10.6667L3.83398 6"
              stroke="#0C1523"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"></path>
          </svg>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-sm">{{ t('activityRowsLabel') }}</label>
        <div class="relative h-full overflow-hidden rounded-full">
          <select
            v-model.number="limit"
            class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
          <svg
            class="pointer-events-none absolute top-1/2 right-4 transform -translate-y-1/2"
            width="17"
            height="16"
            viewBox="0 0 17 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13.1673 6L8.50065 10.6667L3.83398 6"
              stroke="#0C1523"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"></path>
          </svg>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-sm">{{ t('activityOrderLabel') }}</label>
        <div class="relative h-full overflow-hidden rounded-full">
          <select
            v-model="order"
            class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]">
            <option value="desc">{{ t('activityOrderNewest') }}</option>
            <option value="asc">{{ t('activityOrderOldest') }}</option>
          </select>
          <svg
            class="pointer-events-none absolute top-1/2 right-4 transform -translate-y-1/2"
            width="17"
            height="16"
            viewBox="0 0 17 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13.1673 6L8.50065 10.6667L3.83398 6"
              stroke="#0C1523"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"></path>
          </svg>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-sm">Search</label>
        <input
          v-model="q"
          placeholder="keyword"
          class="px-2 py-1 rounded-os-sm bg-[var(--bg-chat)] border border-[var(--card-border)] text-sm w-44" />
      </div>
      <label class="text-sm flex items-center gap-2">
        <span>{{ t('activityAutoScroll') }}</span>
        <span class="checkbox-wrapper-2"
          ><input type="checkbox" class="checkbox" v-model="autoScroll"
        /></span>
      </label>
      <button
        class="ml-auto px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
        @click="refresh">
        {{ t('refresh') }}
      </button>
      <button
        class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
        @click="clearLog">
        {{ t('activityClear') }}
      </button>
      <button
        class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
        @click="downloadLog">
        {{ t('activityDownload') }}
      </button>
    </div>
    <div class="flex flex-wrap gap-2 mb-2" v-if="chips.length">
      <span
        v-for="(chip, i) in chips"
        :key="i"
        class="inline-flex items-center gap-2 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs">
        <strong>{{ chip.label }}:</strong>
        <span>{{ chip.value }}</span>
        <button
          class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
          @click="chip.clear()">
          ×
        </button>
      </span>
    </div>
    <div ref="listRef" class="os-subtle rounded-os-sm max-h-72 overflow-auto" aria-live="polite">
      <div
        v-for="(it, idx) in items"
        :key="idx"
        class="px-2 py-1 text-xs border-b flex items-center gap-2">
        <span :class="badgeClass(it.level)" class="inline-block px-1 rounded">{{
          it.level.toUpperCase()
        }}</span>
        <span class="text-neutral-400">{{ formatTs(it.ts) }}</span>
        <span class="ml-2 flex-1">{{ it.message }}</span>
        <button
          class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
          title="Copy"
          @click="copyLine(it)">
          Copy
        </button>
      </div>
      <div v-if="!items.length" class="p-3 text-sm text-neutral-400">{{ t('activityEmpty') }}</div>
    </div>
    <div class="flex items-center justify-between mt-2 text-xs text-neutral-400">
      <div>{{ t('activityTotal') }}: {{ total }}</div>
      <div class="flex items-center gap-2 activity-pagination">
        <button
          class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
          :disabled="offset <= 0"
          @click="prevPage">
          {{ t('activityPrev') }}
        </button>
        <span>Offset: {{ offset }}</span>
        <button
          class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
          :disabled="offset + limit >= total"
          @click="nextPage">
          {{ t('activityNext') }}
        </button>
        <button
          class="px-1.5 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-[11px] opacity-80 hover:opacity-100"
          @click="showAll">
          {{ t('activityShowAll') }}
        </button>
      </div>
    </div>
  </OsCard>
</template>
<script setup>
import { useActivityPanel } from './ActivityPanel.js';
import OsCard from '../os/OsCard.vue';
const {
  t,
  items,
  level,
  q,
  limit,
  order,
  offset,
  total,
  autoScroll,
  listRef,
  formatTs,
  badgeClass,
  refresh,
  clearLog,
  downloadLog,
  prevPage,
  nextPage,
  showAll,
  copyLine,
  chips,
} = useActivityPanel();
</script>
<script>
export default { name: 'ActivityPanel' };
</script>
<style src="./ActivityPanel.css"></style>
