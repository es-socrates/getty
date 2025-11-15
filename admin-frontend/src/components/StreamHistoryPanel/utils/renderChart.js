/* global module */

import {
  renderStreamHistoryChart,
  renderViewersSparkline,
} from '../../../../../shared/charts/renderChart.js';

export { renderStreamHistoryChart, renderViewersSparkline };

if (typeof module !== 'undefined' && module?.exports) {
  module.exports = { renderStreamHistoryChart, renderViewersSparkline };
}
