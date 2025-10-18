const path = require('path');

const routesPath = path.join(__dirname, '..', 'routes', 'stream-history.js');
const { aggregate } = require(routesPath)._testHooks;

describe('stream-history aggregate anchoring', () => {
  test('weekly buckets anchor to last active day within the range', () => {
    const tz = 0;
    const liveStart = Date.UTC(2025, 9, 17, 2, 0, 0);
    const liveEnd = liveStart + 2 * 3600000;
    const hist = {
      segments: [{ start: liveStart, end: liveEnd }],
      samples: [],
    };
    const result = aggregate(hist, 'week', 2, tz);
    expect(result).toHaveLength(2);
    const last = result[result.length - 1];
    expect(last.date).toBe('2025-10-17');
    expect(last.bucketLabel).toBe('2025-10-12');
    expect(last.rangeStartDate).toBe('2025-10-12');
    expect(last.rangeEndDate).toBe('2025-10-18');
    expect(last.bucketStartEpoch).not.toBe(last.epoch);
    expect(last.hours).toBeCloseTo(2, 2);
  });

  test('monthly buckets report anchor day while preserving month label', () => {
    const tz = 0;
    const hist = {
      segments: [{
        start: Date.UTC(2025, 9, 3, 18, 0, 0),
        end: Date.UTC(2025, 9, 3, 20, 30, 0),
      }],
      samples: [],
    };
    const result = aggregate(hist, 'month', 1, tz);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-10-03');
    expect(result[0].bucketLabel).toBe('2025-10');
    expect(result[0].rangeStartDate).toBe('2025-10-01');
    expect(result[0].rangeEndDate).toBe('2025-10-31');
    expect(result[0].hours).toBeCloseTo(2.5, 2);
  });
});
