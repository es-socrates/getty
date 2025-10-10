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
            stroke-linejoin="round">
            <path d="M3 3v18h18" />
            <polyline points="7 14 11 10 14 13 18 9" />
          </svg>
        </span>
        {{ t('streamHistoryTitle') }}
      </h3>
    </template>
    <div class="status-row" v-if="!settingsCollapsed">
      <span class="badge" :class="status.connected ? 'ok' : 'err'">
        {{ status.connected ? t('connected') : t('disconnected') }}
      </span>
      <span class="badge" :class="status.live ? 'live' : 'idle'" v-if="status.connected">
        {{ status.live ? t('liveNow') : t('notLive') }}
      </span>
      <span
        class="badge samples"
        :title="
          t('streamHistoryDataPointsHint') +
          '\n' +
          t('streamHistoryDataPointsCurrent') +
          ': ' +
          sampleCount
        ">
        {{ t('streamHistoryDataPoints') }}: {{ sampleCount }}
        <span class="hist-points-info" aria-hidden="true">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="10" width="3" height="11" rx="0.5" />
            <rect x="9" y="6" width="3" height="15" rx="0.5" />
            <rect x="15" y="13" width="3" height="8" rx="0.5" />
            <path d="M3 21h18" />
          </svg>
        </span>
      </span>
    </div>
    <div
      class="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-3"
      v-if="!settingsCollapsed">
      <span v-if="samplingCaption" class="text-[0.72rem] opacity-90 italic sampling-caption">
        {{ samplingCaption }}
      </span>
      <div class="form-group [grid-column:1/-1]">
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
            <input type="file" accept="application/json" @change="onImport" class="hidden" />
          </label>
        </div>
        <div class="mt-3 flex flex-col gap-1">
          <label class="label flex items-center gap-2">
            <span>{{ t('streamHistoryDailyGoalLabel') }}</span>
            <span class="text-[0.7rem] font-normal opacity-70">{{
              t('streamHistoryDailyGoalHint')
            }}</span>
          </label>
          <input class="input w-28" type="number" min="0" step="0.5" v-model.number="goalHours" />
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between -m-2">
      <div class="w-auto p-2 flex items-center gap-2">
        <h3 class="font-heading text-lg font-semibold">{{ t('activity') }}</h3>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-os-sm border text-[0.75rem] hover:opacity-100"
          style="background: rgb(255, 24, 76); color: #fff; border-color: rgb(255, 24, 76)"
          @click="settingsCollapsed = !settingsCollapsed">
          <span>{{ t('settings') || 'Settings' }}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            :style="
              settingsCollapsed
                ? 'transform:rotate(-90deg);transition:transform .2s'
                : 'transition:transform .2s'
            ">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div class="w-auto p-2 flex items-center gap-2">
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

    <div class="mt-4">
      <div
        v-if="tzChangeVisible"
        class="mb-3 p-3 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs flex flex-col gap-2">
        <div class="font-semibold flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ t('streamHistoryTzChangedTitle') }}</span>
        </div>
        <div>
          {{
            t('streamHistoryTzChangedBody', {
              prev: previousTzDisplay || '—',
              current: currentPhysicalTzDisplay,
            })
          }}
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--card-border)] bg-[var(--bg-chat)] hover:opacity-100"
            @click="acceptNewTimezone">
            {{ t('streamHistoryUseNewTz') }} ({{ currentPhysicalTzDisplay }})
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--card-border)] hover:opacity-100"
            @click="keepPreviousTimezone">
            {{ t('streamHistoryKeepPrevTz') }} ({{ previousTzDisplay || tzDisplay }})
          </button>
        </div>
      </div>
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
      <div class="text-xs opacity-80 mt-1 flex flex-wrap items-center gap-2">
        <span>{{ t('streamHistoryHint') }}</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="showViewers ? 'true' : 'false'"
          :class="showViewers ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="toggleShowViewers"
          :title="showViewers ? 'Hide viewers' : 'Show viewers'">
          <span
            class="inline-block w-2.5 h-2.5 rounded-full bg-[var(--viewers-line-color,#553fee)]"></span>
          <span>{{ showViewers ? 'Viewers: on' : 'Viewers: off' }}</span>
        </button>
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
        <span v-if="peakSessionSummary" class="peak-session-summary ml-auto">
          <span class="peak-session-label">{{ t('chartTopSessionBadgeTitle') }}</span>
          <span class="peak-session-value">{{ peakSessionSummary }}</span>
        </span>
      </div>
      <div v-if="sparklineAvailable" class="viewers-trend mt-2">
        <div class="viewers-trend-header">
          <span>{{ t('streamHistoryViewersTrend') }}</span>
          <button type="button" class="trend-toggle" @click="showViewerTrend = !showViewerTrend">
            {{ showViewerTrend ? t('hide') || 'Hide' : t('show') || 'Show' }}
          </button>
        </div>
        <div v-show="showViewerTrend" ref="sparklineEl" class="sparkline-canvas"></div>
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
        <div
          class="kpi-value"
          :title="
            t('kpiHoursWatchedTooltip') || 'Total hours all viewers spent watching (viewers × time)'
          ">
          {{ perf.range.hoursWatched.toFixed(2) }}
        </div>
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
          <div class="line-amount">
            <span>{{ displayedAR.toFixed(4) }}</span>
            <span class="unit">AR</span>
            <span v-if="displayedUSD != null" class="usd"
              >≈ ${{
                displayedUSD.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}</span
            >
          </div>
          <span
            v-if="usingWalletBalance"
            class="wallet-badge px-1 py-0.5 rounded text-[0.55rem] font-semibold tracking-wide bg-[var(--bg-chat)] border border-[var(--card-border)] opacity-80"
            :title="t('walletBalanceLabel') || 'Wallet balance (60s cache)'"
            >wallet</span
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
import { ref, watch, computed } from 'vue';
import { metrics } from '../../stores/metricsStore.js';

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
  sparklineEl,
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
  showViewers,
  toggleShowViewers,
  goalHours,
  samplingCaption,
  showViewerTrend,
  sparklineAvailable,
  peakSessionSummary,
} = state;

const usingWalletBalance = computed(() => {
  try {
    return (
      metrics.value?.tips?.totalBalance && typeof metrics.value.tips.totalBalance.ar === 'number'
    );
  } catch {
    return false;
  }
});
const displayedAR = computed(() => {
  if (usingWalletBalance.value) {
    try {
      return Number(metrics.value.tips.totalBalance.ar || 0);
    } catch {}
  }
  return Number(totalAR.value || 0);
});
const displayedUSD = computed(() => {
  if (usingWalletBalance.value) {
    try {
      const v = metrics.value.tips.totalBalance.usd;
      if (typeof v === 'number' && !isNaN(v)) return v;
    } catch {}
  }
  try {
    if (arUsd.value != null) return usdFromAr(totalAR.value, arUsd.value);
  } catch {}
  return null;
});

const SETTINGS_KEY = 'getty_stream_history_settings_panel_v1';
const settingsCollapsed = ref(true);
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (saved && typeof saved.collapsed === 'boolean') settingsCollapsed.value = saved.collapsed;
} catch {}
watch(
  settingsCollapsed,
  (v) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ collapsed: v }));
    } catch {}
  },
  { immediate: false }
);

const {
  tzDisplay,
  tzChangeVisible,
  previousTzDisplay,
  currentPhysicalTzDisplay,
  acceptNewTimezone,
  keepPreviousTimezone,
  sampleCount,
} = state;
</script>
<style scoped src="./StreamHistoryPanel.css"></style>
