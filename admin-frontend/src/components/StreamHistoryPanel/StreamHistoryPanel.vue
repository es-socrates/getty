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
            <path d="M3 3v18h18" />
            <polyline points="7 14 11 10 14 13 18 9" />
          </svg>
        </span>
        {{ t('streamHistoryTitle') }}
      </h3>
    </template>
    <div class="status-row">
      <span class="badge" :class="status.connected ? 'ok' : 'err'">
        {{ status.connected ? t('connected') : t('disconnected') }}
      </span>
      <span class="badge" :class="status.live ? 'live' : 'idle'" v-if="status.connected">
        {{ status.live ? t('liveNow') : t('notLive') }}
      </span>
    </div>
    <div
      class="grid"
      style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px">
      <div class="form-group" style="grid-column: 1/-1">
        <label class="label">{{ t('streamHistoryClaimId') }}</label>
        <input class="input" v-model="claimid" />
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100 disabled:opacity-60"
            :disabled="saving"
            :title="saving ? t('commonSaving') || 'Saving…' : t('commonSave') || 'Save'"
            @click="saveConfig">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true">
              <path
                d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M7 3v6h8V3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M7 21v-7h10v7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            <span>{{ saving ? t('commonSaving') : t('commonSave') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100"
            :title="t('commonRefresh') || 'Refresh'"
            @click="refresh">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true">
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M21 3v6h-6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            <span>{{ t('commonRefresh') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs text-red-500 hover:opacity-100"
            :title="t('streamHistoryClear') || 'Clear'"
            @click="clearHistory">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true">
              <path d="M3 6h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path
                d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            <span>{{ t('streamHistoryClear') }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100"
            :title="t('streamHistoryExport') || 'Export'"
            @click="downloadExport">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true">
              <path
                d="M12 3v12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M8 11l4 4 4-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M4 21h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>{{ t('streamHistoryExport') }}</span>
          </button>

          <label
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs opacity-85 hover:opacity-100 cursor-pointer"
            :title="t('streamHistoryImport') || 'Import'">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true">
              <path
                d="M12 21V9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M16 13l-4-4-4 4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M4 21h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>{{ t('streamHistoryImport') }}</span>
            <input type="file" accept="application/json" @change="onImport" style="display: none" />
          </label>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between -m-2 mt-2">
      <div class="w-auto p-2">
        <h3 class="font-heading text-lg font-semibold">{{ t('activity') }}</h3>
      </div>
      <div class="w-auto p-2">
        <div class="flex items-center gap-2">
          <div class="relative h-full overflow-hidden rounded-full">
            <select
              class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]"
              v-model="filterQuick"
              @change="onQuickFilterChange"
              aria-label="Quick period">
              <option value="day">{{ t('quickToday') }}</option>
              <option value="week">{{ t('quickThisWeek') }}</option>
              <option value="month">{{ t('quickThisMonth') }}</option>
              <option value="year">{{ t('quickThisYear') }}</option>
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

          <div class="relative h-full overflow-hidden rounded-full">
            <select
              class="quick-select appearance-none py-1.5 pl-3.5 pr-10 text-sm text-neutral-600 font-medium w-full h-full bg-light outline-none cursor-pointer border border-[var(--card-border)] rounded-full bg-[var(--bg-chat)]"
              v-model.number="filterQuickSpan"
              @change="onQuickRangeChange"
              aria-label="Quick range span">
              <option :value="7">7d</option>
              <option :value="14">14d</option>
              <option :value="30">30d</option>
              <option :value="90">90d</option>
              <option :value="180">180d</option>
              <option :value="365">365d</option>
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
      </div>
    </div>

    <div class="mt-4">
      <div class="chart-wrap">
        <div
          class="chart-overlay"
          :class="overlayCollapsed ? 'collapsed' : ''"
          aria-label="viewer-stats">
          <div class="overlay-header">
            <div class="overlay-title flex items-center gap-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true">
                <path
                  d="M3 12h4l3-7 4 14 3-7h4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span>{{ t('activity') }}</span>
            </div>
            <div v-if="showBackfill" class="overlay-actions" ref="overlayMenuEl">
              <button
                type="button"
                class="overlay-action-btn"
                :aria-expanded="String(menuOpen)"
                :title="t('actions') || 'Actions'"
                @click.stop="toggleMenu">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true">
                  <circle cx="5" cy="12" r="2" fill="currentColor" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <circle cx="19" cy="12" r="2" fill="currentColor" />
                </svg>
              </button>
              <div v-if="menuOpen" class="overlay-menu" role="menu">
                <div class="overlay-menu-title">
                  {{ t('streamHistoryBackfillTitle') || 'Backfill current segment' }}
                </div>
                <button
                  type="button"
                  class="overlay-item"
                  role="menuitem"
                  @click="onBackfillClick(24)">
                  +24h
                </button>
                <button
                  type="button"
                  class="overlay-item"
                  role="menuitem"
                  @click="onBackfillClick(48)">
                  +48h
                </button>
                <button
                  type="button"
                  class="overlay-item"
                  role="menuitem"
                  @click="onBackfillClick(72)">
                  +72h
                </button>
                <div class="overlay-sep"></div>
                <button
                  type="button"
                  class="overlay-item overlay-danger"
                  role="menuitem"
                  @click="onBackfillDismiss">
                  {{ t('commonClose') }}
                </button>
              </div>
            </div>
            <button
              type="button"
              class="overlay-toggle"
              :aria-expanded="String(!overlayCollapsed)"
              @click="overlayCollapsed = !overlayCollapsed"
              aria-label="Toggle">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div class="overlay-row">
            <span class="dot dot-teal" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiAvgViewers') }}</span>
            <span class="ov-value">{{ Number(perf.range.avgViewers || 0).toFixed(1) }}</span>
          </div>
          <div class="overlay-row">
            <span class="dot dot-red" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiPeakViewers') }}</span>
            <span class="ov-value">{{ perf.range.peakViewers }}</span>
          </div>
          <div class="overlay-row">
            <span class="dot dot-slate" aria-hidden="true"></span>
            <span class="ov-label">{{ t('kpiHighestViewers') }}</span>
            <span class="ov-value">{{ perf.allTime.highestViewers }}</span>
          </div>
        </div>
        <div ref="chartEl" class="chart-canvas"></div>
      </div>
      <div class="text-xs opacity-80 mt-1 flex items-center gap-2">
        <span>{{ t('streamHistoryHint') }}</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode === 'line' ? 'true' : 'false'"
          :class="mode === 'line' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode = 'line'">
          {{ t('chartLine') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode === 'candle' ? 'true' : 'false'"
          :class="mode === 'candle' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode = 'candle'">
          {{ t('chartCandle') }}
        </button>
      </div>
    </div>

    <div class="kpis mt-4">
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiHoursStreamed') }}</div>
        <div class="kpi-value">{{ fmtHours(perf.range.hoursStreamed) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiAvgViewers') }}</div>
        <div class="kpi-value">{{ perf.range.avgViewers.toFixed(2) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiPeakViewers') }}</div>
        <div class="kpi-value">{{ perf.range.peakViewers }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiHoursWatched') }}</div>
        <div class="kpi-value">{{ perf.range.hoursWatched.toFixed(2) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiActiveDays') }}</div>
        <div class="kpi-value">{{ perf.range.activeDays }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiTotalHoursStreamed') }}</div>
        <div class="kpi-value">{{ fmtTotal(perf.allTime.totalHoursStreamed) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiHighestViewers') }}</div>
        <div class="kpi-value">{{ perf.allTime.highestViewers }}</div>
      </div>
      <div class="kpi earnings-kpi">
        <div class="kpi-label flex items-center gap-2">
          <span>{{ t('kpiTotalEarnings') || 'Total earnings' }}</span>
          <button
            type="button"
            class="earnings-toggle"
            :aria-pressed="String(!earningsHidden)"
            @click="toggleEarningsHidden"
            :title="earningsHidden ? t('show') || 'Show' : t('hide') || 'Hide'">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </div>
        <div class="kpi-value earnings-values" :class="earningsHidden ? 'blurred' : ''">
          <span>{{ totalAR.toFixed(4) }}</span>
          <span class="unit">AR</span>
          <span class="usd"
            >≈ ${{
              usdFromAr(totalAR, arUsd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }}</span
          >
        </div>
      </div>
    </div>

    <teleport to="body">
      <div
        v-if="showClearModal"
        class="modal-overlay"
        @click.self="!clearBusy && (showClearModal = false)"
        role="dialog"
        aria-modal="true">
        <div class="modal-card">
          <div class="modal-title">{{ t('streamHistoryClear') }}</div>
          <div class="modal-body">
            <p class="mb-2">{{ t('streamHistoryClearConfirm') }}</p>
            <p class="text-xs opacity-80">{{ t('streamHistoryHint') }}</p>
          </div>
          <div class="modal-actions">
            <button class="btn" :disabled="clearBusy" @click="showClearModal = false">
              {{ t('commonClose') }}
            </button>
            <button class="btn" :disabled="clearBusy" @click="downloadExport">
              {{ t('streamHistoryExport') }}
            </button>
            <button class="btn btn-danger" :disabled="clearBusy" @click="confirmClear">
              {{ t('streamHistoryClear') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="showClaimChangeModal"
        class="modal-overlay"
        @click.self="!clearBusy && (showClaimChangeModal = false)"
        role="dialog"
        aria-modal="true">
        <div class="modal-card">
          <div class="modal-title">{{ t('streamHistoryClaimId') }}</div>
          <div class="modal-body">
            <p class="mb-2">{{ t('streamHistoryClaimChangeClearConfirm') }}</p>
            <p class="text-xs opacity-80">{{ t('streamHistoryHint') }}</p>
          </div>
          <div class="modal-actions">
            <button class="btn" :disabled="clearBusy" @click="showClaimChangeModal = false">
              {{ t('commonClose') }}
            </button>
            <button class="btn" :disabled="clearBusy" @click="downloadExport">
              {{ t('streamHistoryExport') }}
            </button>
            <button
              class="btn btn-danger"
              :disabled="clearBusy"
              @click="confirmClearAfterClaimChange">
              {{ t('streamHistoryClear') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </OsCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { createStreamHistoryPanel } from './createStreamHistoryPanel.js';

const { t } = useI18n();
const state = createStreamHistoryPanel(t);

const {
  status,
  claimid,
  saving,
  saveConfig,
  refresh,
  clearHistory,
  downloadExport,
  onImport,
  filterQuick,
  onQuickFilterChange,
  filterQuickSpan,
  onQuickRangeChange,
  overlayCollapsed,
  showBackfill,
  overlayMenuEl,
  menuOpen,
  toggleMenu,
  onBackfillClick,
  onBackfillDismiss,
  perf,
  chartEl,
  mode,
  fmtHours,
  fmtTotal,
  earningsHidden,
  toggleEarningsHidden,
  totalAR,
  usdFromAr,
  arUsd,
  showClearModal,
  clearBusy,
  confirmClear,
  showClaimChangeModal,
  confirmClearAfterClaimChange,
} = state;
</script>
<style scoped src="./StreamHistoryPanel.css"></style>
