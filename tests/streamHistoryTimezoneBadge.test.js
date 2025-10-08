/**
 * @jest-environment jsdom
 */
const { mount } = require('@vue/test-utils');
const { createI18n } = require('vue-i18n');
const { defineComponent } = require('vue');
const { createStreamHistoryPanel } = require('../admin-frontend/src/components/StreamHistoryPanel/createStreamHistoryPanel.js');

const messages = {
  en: {
    streamHistoryTzNote: 'Times are shown in your local timezone',
    streamHistoryTzOffset: 'UTC{offset}',
    streamHistoryTitle: 'Stream history',
    activity: 'Activity',
    connected: 'Connected',
    disconnected: 'Disconnected',
    liveNow: 'Live',
    notLive: 'Offline',
    streamHistoryClaimId: 'Claim ID',
    commonSaving: 'Saving',
    commonSave: 'Save',
    commonRefresh: 'Refresh',
    streamHistoryClear: 'Clear',
    streamHistoryExport: 'Export',
    streamHistoryImport: 'Import',
    quickToday: 'Today',
    quickThisWeek: 'This week',
    quickThisMonth: 'This month',
    quickThisYear: 'This year',
    kpiAvgViewers: 'Avg viewers',
    kpiPeakViewers: 'Peak viewers',
    kpiHighestViewers: 'Highest viewers',
    streamHistoryHint: 'Hover the chart for details',
    chartLine: 'Line',
    chartCandle: 'Candle',
    kpiHoursStreamed: 'Hours streamed',
    kpiHoursWatched: 'Viewer Hours',
    kpiActiveDays: 'Active days',
    kpiTotalHoursStreamed: 'Total hours streamed',
    kpiTotalEarnings: 'Total earnings',
    hide: 'Hide',
    show: 'Show',
    commonClose: 'Close'
  }
};

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages
  });
}

describe('StreamHistoryPanel timezone badge', () => {
  test('computes tzOffsetShort and renders badge text', async () => {
    const i18n = makeI18n();
    let panelStateRef;
    const Wrapper = defineComponent({
      name: 'StreamHistoryPanelTzTestWrapper',
      setup() {
        const state = createStreamHistoryPanel((k) => k);
        panelStateRef = state;
        return state;
      },
      template: `
        <div class="tz-badge-test">
          <span class="badge-text">Times are shown in your local timezone (UTC{{ tzOffsetShort }})</span>
        </div>
      `
    });
    const wrapper = mount(Wrapper, { global: { plugins: [i18n] } });
    await Promise.resolve();
    const text = wrapper.text();
    expect(text).toMatch(/Times are shown in your local timezone \(UTC[+-]\d{2}:\d{2}\)/);

    if (panelStateRef && typeof panelStateRef.dispose === 'function') {
      panelStateRef.dispose();
    }
    wrapper.unmount();
  });
});
