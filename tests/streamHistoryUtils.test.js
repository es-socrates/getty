const path = require('path');
const utilsPath = path.join(__dirname, '..', 'admin-frontend', 'src', 'components', 'StreamHistoryPanel', 'utils', 'streamHistoryUtils.js');
const { formatHours, formatTotalHours, usdFromAr, buildDisplayData } = require(utilsPath);

describe('streamHistoryUtils', () => {
  test('formatHours edge cases', () => {
    expect(formatHours(0)).toBe('0 min');
    expect(formatHours(0.75)).toBe('45 min');
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

  test('buildDisplayData preserves chronological order and past zeros', () => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const day4 = new Date(now - 4 * day).toISOString().slice(0, 10);
    const day3 = new Date(now - 3 * day).toISOString().slice(0, 10);
    const day2 = new Date(now - 2 * day).toISOString().slice(0, 10);
    const day1 = new Date(now - day).toISOString().slice(0, 10);
    const src = [
      { hours: 0, date: day4 },
      { hours: 0, date: day3 },
      { hours: 5, date: day2 },
      { hours: 2, date: day1 },
    ];
    const out = buildDisplayData(src);
    expect(out).toHaveLength(src.length);
    expect(out.map((item) => item.date)).toEqual(src.map((item) => item.date));
  });

  test('buildDisplayData sorts by date when needed and discards future buckets', () => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const past2 = new Date(now - 2 * day).toISOString().slice(0, 10);
    const past1 = new Date(now - day).toISOString().slice(0, 10);
    const future = new Date(now + 2 * day).toISOString().slice(0, 10);
    const src = [
      { hours: 1, date: past1 },
      { hours: 3, date: past2 },
      { hours: 0, epoch: now + day },
      { hours: 6, date: future },
    ];
    const out = buildDisplayData(src);
    expect(out.map((item) => item.date)).toEqual([past2, past1]);
    expect(out.every((item) => item.hours >= 0)).toBe(true);
  });
});
