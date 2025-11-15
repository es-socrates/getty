/* global module */

import {
  formatHours,
  formatTotalHours,
  usdFromAr,
  buildDisplayData,
} from '../../../../../shared/charts/streamHistoryUtils.js';

export { formatHours, formatTotalHours, usdFromAr, buildDisplayData };

if (typeof module !== 'undefined' && module?.exports) {
  module.exports = { formatHours, formatTotalHours, usdFromAr, buildDisplayData };
}
