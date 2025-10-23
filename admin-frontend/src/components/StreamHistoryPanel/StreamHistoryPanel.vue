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
        <div class="live-analytics-trigger relative">
          <button
            type="button"
            class="top-toggle inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-chat)] text-sm font-medium"
            :aria-expanded="String(!overlayCollapsed)"
            @click="overlayCollapsed = !overlayCollapsed"
            :title="overlayCollapsed ? 'Expand live analytics' : 'Collapse live analytics'">
            <svg
              width="14"
              height="14"
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              :style="
                overlayCollapsed
                  ? 'transform:rotate(-90deg);transition:transform .2s'
                  : 'transition:transform .2s'
              "
              aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
          <div
            v-if="!overlayCollapsed"
            class="chart-overlay chart-overlay-popover"
            aria-label="viewer-stats">
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
        </div>

        <div class="relative flex items-center gap-1">
          <button
            ref="calendarTriggerRef"
            type="button"
            class="range-trigger"
            :class="customRangeActive ? 'range-trigger-active' : ''"
            :aria-expanded="String(calendarOpen)"
            aria-haspopup="dialog"
            :title="rangeLabel"
            @click="toggleCalendar"
            @keydown.enter.prevent="toggleCalendar"
            @keydown.space.prevent="toggleCalendar">
            <span class="range-trigger-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
              </svg>
            </span>
            <span class="range-trigger-label">{{ rangeLabel }}</span>
            <span class="range-trigger-icon" aria-hidden="true">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          <button
            v-if="customRangeActive || hasDraft"
            type="button"
            class="range-clear-btn"
            :title="t('streamHistoryRangeClear')"
            @click="onClearRangeClick">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            v-if="calendarOpen"
            ref="calendarPopoverRef"
            class="range-popover"
            role="dialog"
            :aria-label="t('streamHistoryRangePlaceholder')">
            <div class="range-popover-body">
              <label>
                <span>{{ t('streamHistoryRangeStart') }}</span>
                <input type="date" v-model="rangeDraft.start" :max="todayIso" />
              </label>
              <label>
                <span>{{ t('streamHistoryRangeEnd') }}</span>
                <input
                  type="date"
                  v-model="rangeDraft.end"
                  :min="rangeDraft.start || undefined"
                  :max="todayIso" />
              </label>
              <p v-if="rangeError" class="range-error">{{ rangeError }}</p>
            </div>
            <div class="range-popover-footer">
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs font-medium hover:opacity-100 disabled:opacity-60"
                :disabled="!customRangeActive && !hasDraft"
                @click="onClearRangeClick">
                {{ t('streamHistoryRangeClear') }}
              </button>
              <div class="range-actions">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent bg-transparent text-xs font-medium text-[var(--text-secondary,#475569)] hover:underline"
                  @click="closeCalendar">
                  {{ t('commonCancel') }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-transparent bg-[#2563eb] text-xs font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed range-apply-btn"
                  :disabled="applyDisabled"
                  @click="applyCalendarRange">
                  {{ t('streamHistoryRangeApply') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="relative">
          <button
            ref="quickPeriodTriggerRef"
            type="button"
            class="quick-select-trigger"
            :class="quickPeriodOpen ? 'quick-select-trigger-active' : ''"
            :aria-expanded="String(quickPeriodOpen)"
            aria-haspopup="listbox"
            @click="toggleQuickPeriod">
            <span class="quick-select-label">{{ quickPeriodLabel }}</span>
            <span class="quick-select-caret" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          <div
            v-if="quickPeriodOpen"
            ref="quickPeriodPopoverRef"
            class="quick-select-popover"
            role="listbox"
            :aria-label="t('streamHistoryRangePlaceholder')">
            <button
              v-for="option in quickPeriodOptions"
              :key="option.value"
              type="button"
              class="quick-select-option"
              :class="filterQuick === option.value ? 'quick-select-option-active' : ''"
              role="option"
              :aria-selected="filterQuick === option.value ? 'true' : 'false'"
              @click="selectQuickPeriod(option.value)">
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="relative">
          <button
            ref="quickSpanTriggerRef"
            type="button"
            class="quick-select-trigger"
            :class="quickSpanOpen ? 'quick-select-trigger-active' : ''"
            :aria-expanded="String(quickSpanOpen)"
            aria-haspopup="listbox"
            @click="toggleQuickSpan">
            <span class="quick-select-label">{{ quickSpanLabel }}</span>
            <span class="quick-select-caret" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          <div
            v-if="quickSpanOpen"
            ref="quickSpanPopoverRef"
            class="quick-select-popover"
            role="listbox"
            :aria-label="t('streamHistoryRangePlaceholder')">
            <button
              v-for="option in quickSpanOptions"
              :key="option.value"
              type="button"
              class="quick-select-option"
              :class="Number(filterQuickSpan) === option.value ? 'quick-select-option-active' : ''"
              role="option"
              :aria-selected="Number(filterQuickSpan) === option.value ? 'true' : 'false'"
              @click="selectQuickSpan(option.value)">
              {{ option.label }}
            </button>
          </div>
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
          :title="
            showViewers
              ? t('chartHideViewers') || 'Hide viewers'
              : t('chartShowViewers') || 'Show viewers'
          ">
          <span
            class="inline-block w-2.5 h-2.5 rounded-full bg-[var(--viewers-line-color,#553fee)]"></span>
          <span>{{ showViewers ? t('chartViewersOn') : t('chartViewersOff') }}</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode === 'candle' ? 'true' : 'false'"
          :class="mode === 'candle' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode = 'candle'">
          {{ t('chartCandle') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--card-border)] bg-[var(--bg-chat)] text-xs"
          :aria-pressed="mode === 'line' ? 'true' : 'false'"
          :class="mode === 'line' ? 'ring-1 ring-[var(--card-border)]' : ''"
          @click="mode = 'line'">
          {{ t('chartLine') }}
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
        <div v-if="streamComparisons.hasCurrent" class="kpi-subtitle">
          <span>{{ lastStreamSubtitle }}</span>
          <span class="kpi-delta" :class="deltaClass(streamComparisons.durationDiffHours)">
            {{ formatHoursDelta(streamComparisons.durationDiffHours) }}
          </span>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiAvgViewers') }}</div>
        <div class="kpi-value">{{ perf.range.avgViewers.toFixed(2) }}</div>
        <div v-if="streamComparisons.hasCurrent" class="kpi-subtitle">
          <span>{{ lastStreamSubtitle }}</span>
          <span class="kpi-delta" :class="deltaClass(streamComparisons.avgViewersDiff)">
            {{ formatAvgViewersDelta(streamComparisons.avgViewersDiff) }}
          </span>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">{{ t('kpiPeakViewers') }}</div>
        <div class="kpi-value">{{ perf.range.peakViewers }}</div>
        <div v-if="streamComparisons.hasCurrent" class="kpi-subtitle">
          <span>{{ lastStreamSubtitle }}</span>
          <span class="kpi-delta" :class="deltaClass(streamComparisons.peakViewersDiff)">
            {{ formatPeakViewersDelta(streamComparisons.peakViewersDiff) }}
          </span>
        </div>
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
        <div v-if="streamComparisons.hasCurrent" class="kpi-subtitle">
          <span>{{ lastStreamSubtitle }}</span>
          <span class="kpi-delta" :class="deltaClass(streamComparisons.viewerHoursDiff)">
            {{ formatViewerHoursDelta(streamComparisons.viewerHoursDiff) }}
          </span>
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
          </div>
          <div v-if="displayedUSD != null" class="usd">
            ≈ ${{
              displayedUSD.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }}
          </div>
          <span
            v-if="usingWalletBalance"
            class="wallet-badge px-1 py-0.5 rounded text-[0.55rem] font-semibold tracking-wide bg-[var(--bg-chat)] border border-[var(--card-border)] opacity-80"
            :title="t('walletBalanceLabel') || 'Wallet balance (60s cache)'"
            >wallet</span
          >
        </div>
      </div>
      <div class="kpi stream-duration-kpi">
        <div class="kpi-label">{{ t('kpiStreamDuration') }}</div>
        <div class="kpi-value">
          <template v-if="streamComparisons.hasCurrent">
            {{ fmtHours(streamComparisons.durationHours) }}
          </template>
          <template v-else>
            {{ t('kpiNoStreamData') }}
          </template>
        </div>
        <div v-if="streamComparisons.hasCurrent" class="kpi-subtitle">
          <span>{{ lastStreamSubtitle }}</span>
          <span class="kpi-delta" :class="deltaClass(streamComparisons.durationDiffHours)">
            {{ formatHoursDelta(streamComparisons.durationDiffHours) }}
          </span>
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
import { ref, watch, computed, onMounted, onBeforeUnmount, reactive } from 'vue';
import { metrics } from '../../stores/metricsStore.js';

const { t, locale } = useI18n();
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
  customRange,
  customRangeActive,
  applyCustomRange,
  clearCustomRange,
  streamComparisons,
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

const streamDateFormatter = computed(() => {
  try {
    return new Intl.DateTimeFormat(locale.value || 'en-US', { month: 'short', day: 'numeric' });
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  }
});

const formatActiveDayLabel = (dayKey) => {
  if (typeof dayKey !== 'string' || dayKey.length !== 10) return '';
  const [yearRaw, monthRaw, dayRaw] = dayKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(candidate.getTime())) return '';
  try {
    return streamDateFormatter.value.format(candidate);
  } catch {
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
  }
};

const hasStreamComparisons = computed(() => !!streamComparisons?.value?.hasCurrent);

const lastStreamSubtitle = computed(() => {
  if (!hasStreamComparisons.value) return '';
  const dateLabel = formatActiveDayLabel(streamComparisons.value.activeDayKey);
  if (dateLabel) return t('kpiLastStreamSubtitle', { date: dateLabel });
  return t('kpiLastStreamSubtitleStandalone');
});

const toFixedTrim = (num, decimals) => {
  const safeDecimals = Math.max(0, Number(decimals) || 0);
  const str = num.toFixed(safeDecimals);
  if (safeDecimals <= 0) return str;
  return str.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

const formatDeltaValue = (delta, decimals = 2, unit = '') => {
  if (delta == null) return t('kpiNoPreviousStream');
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return t('kpiNoPreviousStream');
  const absVal = Math.abs(numeric);
  const trimmed = toFixedTrim(absVal, decimals);
  const valuePart = unit ? `${trimmed}${unit}` : trimmed;
  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
  return `${sign}${valuePart} ${t('kpiVsPrevious')}`;
};

const formatHoursDelta = (delta) => {
  const magnitude = Math.abs(Number(delta || 0));
  const decimals = magnitude >= 10 ? 1 : 2;
  return formatDeltaValue(delta, decimals, 'h');
};

const formatAvgViewersDelta = (delta) => formatDeltaValue(delta, 2);

const formatPeakViewersDelta = (delta) => formatDeltaValue(delta, 0);

const formatViewerHoursDelta = (delta) => formatDeltaValue(delta, 2, 'h');

const deltaClass = (delta) => {
  if (delta == null) return 'neutral';
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return 'neutral';
  if (numeric > 0) return 'positive';
  if (numeric < 0) return 'negative';
  return 'neutral';
};

const quickPeriodOpen = ref(false);
const quickSpanOpen = ref(false);
const quickPeriodTriggerRef = ref(null);
const quickPeriodPopoverRef = ref(null);
const quickSpanTriggerRef = ref(null);
const quickSpanPopoverRef = ref(null);

const calendarOpen = ref(false);
const calendarTriggerRef = ref(null);
const calendarPopoverRef = ref(null);
const rangeDraft = reactive({ start: '', end: '' });

const todayIso = computed(() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});

const dateFormatter = computed(() => {
  try {
    return new Intl.DateTimeFormat(locale.value || 'en-US', { dateStyle: 'medium' });
  } catch {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  }
});

const parseInputDate = (value) => {
  if (typeof value !== 'string' || value.length !== 10) return null;
  const [yRaw, mRaw, dRaw] = value.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const candidate = new Date(y, m - 1, d);
  if (Number.isNaN(candidate.getTime())) return null;
  if (candidate.getFullYear() !== y || candidate.getMonth() !== m - 1 || candidate.getDate() !== d)
    return null;
  return candidate;
};

const formatDateDisplay = (iso) => {
  const date = parseInputDate(iso);
  if (!date) return '';
  try {
    return dateFormatter.value.format(date);
  } catch {
    return iso;
  }
};

const syncDraftFromRange = () => {
  const range = customRange.value || {};
  if (customRangeActive.value && range.startDate && range.endDate) {
    rangeDraft.start = range.startDate;
    rangeDraft.end = range.endDate;
  } else {
    rangeDraft.start = '';
    rangeDraft.end = '';
  }
};

const hasDraft = computed(() => !!(rangeDraft.start || rangeDraft.end));

const draftValid = computed(() => {
  return !!(parseInputDate(rangeDraft.start) && parseInputDate(rangeDraft.end));
});

const draftOrdered = computed(() => {
  if (!draftValid.value) return false;
  const start = parseInputDate(rangeDraft.start);
  const end = parseInputDate(rangeDraft.end);
  return start && end ? start.getTime() <= end.getTime() : false;
});

const rangeError = computed(() => {
  if (!draftValid.value || draftOrdered.value) return '';
  return t('streamHistoryRangeErrorOrder');
});

const applyDisabled = computed(() => !draftValid.value || !draftOrdered.value);

const rangeLabel = computed(() => {
  if (!customRangeActive.value || !customRange.value) {
    return t('streamHistoryRangePlaceholder');
  }
  const { startDate, endDate } = customRange.value;
  const startLabel = formatDateDisplay(startDate);
  const endLabel = formatDateDisplay(endDate);
  if (!startLabel || !endLabel) return t('streamHistoryRangePlaceholder');
  if (startLabel === endLabel) return startLabel;
  try {
    return t('chartTooltipRange', { start: startLabel, end: endLabel });
  } catch {
    return `${startLabel} - ${endLabel}`;
  }
});

const quickPeriodOptions = computed(() => [
  { value: 'day', label: t('quickToday') },
  { value: 'week', label: t('quickThisWeek') },
  { value: 'month', label: t('quickThisMonth') },
  { value: 'year', label: t('quickThisYear') },
]);

const quickPeriodLabel = computed(() => {
  if (filterQuick.value === 'custom') return t('streamHistoryRangeCustom');
  const option = quickPeriodOptions.value.find((item) => item.value === filterQuick.value);
  return option ? option.label : t('quickToday');
});

const quickSpanOptions = computed(() => [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '180d' },
  { value: 365, label: '365d' },
]);

const quickSpanLabel = computed(() => {
  const current = Number(filterQuickSpan.value);
  const option = quickSpanOptions.value.find((item) => item.value === current);
  return option ? option.label : `${filterQuickSpan.value || 30}d`;
});

const toggleCalendar = () => {
  calendarOpen.value = !calendarOpen.value;
  if (calendarOpen.value) {
    quickPeriodOpen.value = false;
    quickSpanOpen.value = false;
  }
};

const closeCalendar = () => {
  calendarOpen.value = false;
};

const applyCalendarRange = () => {
  if (applyDisabled.value) return;
  const start = parseInputDate(rangeDraft.start);
  const end = parseInputDate(rangeDraft.end);
  if (!start || !end) return;
  applyCustomRange([start, end]);
  closeCalendar();
};

const onClearRangeClick = () => {
  if (customRangeActive.value) {
    clearCustomRange();
  }
  rangeDraft.start = '';
  rangeDraft.end = '';
};

const toggleQuickPeriod = () => {
  quickPeriodOpen.value = !quickPeriodOpen.value;
  if (quickPeriodOpen.value) {
    calendarOpen.value = false;
    quickSpanOpen.value = false;
  }
};

const toggleQuickSpan = () => {
  quickSpanOpen.value = !quickSpanOpen.value;
  if (quickSpanOpen.value) {
    calendarOpen.value = false;
    quickPeriodOpen.value = false;
  }
};

const selectQuickPeriod = (value) => {
  quickPeriodOpen.value = false;
  if (filterQuick.value === value) return;
  filterQuick.value = value;
  onQuickFilterChange();
};

const selectQuickSpan = (value) => {
  quickSpanOpen.value = false;
  if (Number(filterQuickSpan.value) === value) return;
  filterQuickSpan.value = value;
  onQuickRangeChange();
};

watch(calendarOpen, (open) => {
  if (open) {
    syncDraftFromRange();
  }
});

watch(customRangeActive, (active) => {
  if (!active) {
    rangeDraft.start = '';
    rangeDraft.end = '';
  } else if (!calendarOpen.value) {
    syncDraftFromRange();
  }
});

watch(
  () => {
    const range = customRange.value || {};
    return `${range.startDate || ''}/${range.endDate || ''}`;
  },
  () => {
    if (calendarOpen.value) {
      syncDraftFromRange();
    }
  }
);

watch(quickPeriodOpen, (open) => {
  if (open) {
    quickSpanOpen.value = false;
  }
});

watch(quickSpanOpen, (open) => {
  if (open) {
    quickPeriodOpen.value = false;
  }
});

watch(filterQuick, () => {
  quickPeriodOpen.value = false;
});

watch(filterQuickSpan, () => {
  quickSpanOpen.value = false;
});

const handlePointerDown = (event) => {
  if (!calendarOpen.value && !quickPeriodOpen.value && !quickSpanOpen.value) {
    return;
  }
  const target = event.target;
  const within = (triggerRef, popoverRef) => {
    try {
      if (triggerRef && triggerRef.contains(target)) return true;
      if (popoverRef && popoverRef.contains(target)) return true;
    } catch {}
    return false;
  };
  if (calendarOpen.value && !within(calendarTriggerRef.value, calendarPopoverRef.value)) {
    closeCalendar();
  }
  if (quickPeriodOpen.value && !within(quickPeriodTriggerRef.value, quickPeriodPopoverRef.value)) {
    quickPeriodOpen.value = false;
  }
  if (quickSpanOpen.value && !within(quickSpanTriggerRef.value, quickSpanPopoverRef.value)) {
    quickSpanOpen.value = false;
  }
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    let handled = false;
    if (calendarOpen.value) {
      closeCalendar();
      handled = true;
    }
    if (quickPeriodOpen.value) {
      quickPeriodOpen.value = false;
      handled = true;
    }
    if (quickSpanOpen.value) {
      quickSpanOpen.value = false;
      handled = true;
    }
    if (handled) {
      try {
        event.preventDefault();
        event.stopPropagation();
      } catch {}
    }
  }
};

onMounted(() => {
  try {
    document.addEventListener('pointerdown', handlePointerDown, true);
  } catch {}
  try {
    window.addEventListener('keydown', handleKeydown);
  } catch {}
});

onBeforeUnmount(() => {
  try {
    document.removeEventListener('pointerdown', handlePointerDown, true);
  } catch {}
  try {
    window.removeEventListener('keydown', handleKeydown);
  } catch {}
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
