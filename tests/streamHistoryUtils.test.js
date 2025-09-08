const path = require('path');
const utilsPath = path.join(__dirname, '..', 'admin-frontend', 'src', 'components', 'StreamHistoryPanel', 'utils', 'streamHistoryUtils.js');
const { formatHours, formatTotalHours, usdFromAr, buildDisplayData } = require(utilsPath);

describe('streamHistoryUtils', () => {
  test('formatHours edge cases', () => {
    expect(formatHours(0)).toBe('0.00 h');
    expect(formatHours(0.75)).toBe('0.75 h');
    expect(formatHours(1.2)).toBe('1.2 h');
    expect(formatHours(10.2)).toBe('10 h');
    const d = formatHours(48);
    expect(d.startsWith('48 h')).toBe(true);
  });

  test('formatTotalHours days and hours', () => {
    expect(formatTotalHours(5)).toBe('5 h');
    expect(formatTotalHours(12)).toBe('12 h');
    expect(formatTotalHours(30)).toMatch(/d|h/);
  });

  test('usdFromAr', () => {
    expect(usdFromAr(2, 5)).toBe(10);
    expect(usdFromAr('3', '2')).toBe(6);
    expect(usdFromAr(1, 0)).toBe(0);
  });

  test('buildDisplayData trims leading zeros and re-appends', () => {
    const src = [ { hours:0 }, { hours:0 }, { hours: 5, date:'2025-01-01' }, { hours:2, date:'2025-01-02' } ];
    const out = buildDisplayData(src);
    expect(out.length).toBe(src.length);
    expect(out[0].hours).toBe(5);
    expect(out[out.length-1].hours).toBe(0);
  });
});
