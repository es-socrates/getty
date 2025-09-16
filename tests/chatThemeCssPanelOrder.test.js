const fs = require('fs');
const path = require('path');

describe('ChatThemeManager source uniqueness/order', () => {
  test('single Theme CSS panel label appears after theme selector heading', () => {
    const filePath = path.join(
      __dirname,
      '..',
      'admin-frontend',
      'src',
      'components',
      'ChatThemeManager',
      'ChatThemeManager.vue'
    );
    const src = fs.readFileSync(filePath, 'utf8');

    const selectorHeading = 'Chat theme:';
    const cssPanelLabel = 'Theme CSS for OBS:';

    const selectorIndex = src.indexOf(selectorHeading);
    const cssPanelIndex = src.indexOf(cssPanelLabel);

    expect(selectorIndex).toBeGreaterThan(-1);
    expect(cssPanelIndex).toBeGreaterThan(-1);
    expect(selectorIndex).toBeLessThan(cssPanelIndex);

    const occurrences = (src.match(new RegExp(cssPanelLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    expect(occurrences).toBe(1);
  });
});
