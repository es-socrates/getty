const path = require('path');
const { renderStreamHistoryChart } = require(path.join(__dirname, '..', 'admin-frontend', 'src', 'components', 'StreamHistoryPanel', 'utils', 'renderChart.js'));

describe('renderStreamHistoryChart', () => {
  test('renders line mode with circles', () => {
    const el = document.createElement('div');
    el.dataset.testWidth = '600';
    el.dataset.testHeight = '260';
    document.body.appendChild(el);
    const data = [
      { date: '2025-01-01', hours: 2 },
      { date: '2025-01-02', hours: 4 },
      { date: '2025-01-03', hours: 0 },
    ];
    renderStreamHistoryChart(el, data, { mode: 'line', period: 'day' });
    const circles = el.querySelectorAll('circle.line-point');
    expect(circles.length).toBe(data.length);
    const svg = el.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  test('renders candle mode with bars', () => {
    const el = document.createElement('div');
    el.dataset.testWidth = '600';
    el.dataset.testHeight = '260';
    document.body.appendChild(el);
    const data = [
      { date: '2025-01-01', hours: 2 },
      { date: '2025-01-02', hours: 1 },
    ];
    renderStreamHistoryChart(el, data, { mode: 'candle', period: 'day' });
    const bars = el.querySelectorAll('.bar');
    expect(bars.length).toBe(data.length);

  const texts = el.querySelectorAll('svg text');
  expect(texts.length).toBeGreaterThan(0);
  });
});
