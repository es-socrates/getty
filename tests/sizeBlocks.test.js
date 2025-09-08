const { SizeBlocks } = require('../admin-frontend/src/components/ChatThemeManager/utils/sizeBlocks.js');

describe('SizeBlocks utility', () => {
  test('clamp limits values between 1 and 60', () => {
    expect(SizeBlocks.clamp(-5)).toBe(1);
    expect(SizeBlocks.clamp(0)).toBe(1);
    expect(SizeBlocks.clamp(14)).toBe(14);
    expect(SizeBlocks.clamp(120)).toBe(60);
  });

  test('build produces block with required markers and vars', () => {
    const block = SizeBlocks.build({ username: 14, message: 15, donation: 16, avatar: 40 });
    expect(block).toMatch(/\/\* AUTO_FONT_SIZES_START \*\//);
    expect(block).toMatch(/\/\* AUTO_FONT_SIZES_END \*\//);
    expect(block).toMatch(/--chat-font-username:14px/);
    expect(block).toMatch(/--chat-avatar-size:40px/);
  });

  test('merge inserts block when none present', () => {
    const base = '.message{color:red;}';
    const merged = SizeBlocks.merge(base, { username: 10, message: 11, donation: 12, avatar: 20 });
    expect(merged).toMatch(/AUTO_FONT_SIZES_START/);
    expect(merged).toMatch(/message{color:red;}/);
  });

  test('merge replaces existing block', () => {
    const first = SizeBlocks.merge('', { username: 10, message: 11, donation: 12, avatar: 20 });
    const replaced = SizeBlocks.merge(first + '\n.other{}', { username: 20, message: 21, donation: 22, avatar: 32 });
    const count = (replaced.match(/AUTO_FONT_SIZES_START/g)||[]).length;
    expect(count).toBe(1);
    expect(replaced).toMatch(/--chat-font-username:20px/);
  });

  test('strip removes block', () => {
    const withBlock = SizeBlocks.merge('.x{}', { username: 10, message: 11, donation: 12, avatar: 20 });
    const stripped = SizeBlocks.strip(withBlock);
    expect(stripped).not.toMatch(/AUTO_FONT_SIZES_START/);
    expect(stripped).toMatch(/\.x\{\}/);
  });

  test('extract pulls numeric sizes', () => {
    const css = SizeBlocks.build({ username: 13, message: 14, donation: 15, avatar: 25 });
    const ext = SizeBlocks.extract(css);
    expect(ext).toEqual({ username: 13, message: 14, donation: 15, avatar: 25 });
  });
});
