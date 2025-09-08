const { computeLineDiff } = require('../admin-frontend/src/components/ChatThemeManager/utils/diffUtil.js');

describe('computeLineDiff', () => {
  test('empty vs empty returns []', () => {
    expect(computeLineDiff('', '')).toEqual([]);
  });

  test('identical single line', () => {
    expect(computeLineDiff('a', 'a')).toEqual([]);
  });

  test('simple add', () => {
    const diff = computeLineDiff('', 'a');
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ text: 'a', type: 'add' });
  });

  test('simple delete', () => {
    const diff = computeLineDiff('a', '');
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ text: 'a', type: 'del' });
  });

  test('change in middle', () => {
    const diff = computeLineDiff('a\nb\nc', 'a\nx\nc');
    const types = diff.map(d => d.type);
    expect(types.filter(t => t === 'eq').length).toBe(2);
    expect(types).toContain('del');
    expect(types).toContain('add');
  });

  test('larger block maintains order', () => {
    const left = ['one','two','three','four'].join('\n');
    const right = ['one','dos','three','cuatro'].join('\n');
    const diff = computeLineDiff(left, right);
    const seq = diff.map(d => d.text).join('|');
    expect(seq).toMatch(/one/);
    expect(seq).toMatch(/three/);
    expect(seq).toMatch(/dos/);
    expect(seq).toMatch(/cuatro/);
  });
});
