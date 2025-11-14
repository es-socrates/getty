/* global module */
function computeLineDiff(aText, bText) {
  const a = aText ? aText.split(/\r?\n/) : [];
  const b = bText ? bText.split(/\r?\n/) : [];
  if (aText === bText) return [];
  const m = a.length,
    n = b.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0,
    j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ text: a[i], type: 'eq' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ text: a[i], type: 'del' });
      i++;
    } else {
      out.push({ text: b[j], type: 'add' });
      j++;
    }
  }
  while (i < m) {
    out.push({ text: a[i], type: 'del' });
    i++;
  }
  while (j < n) {
    out.push({ text: b[j], type: 'add' });
    j++;
  }
  return out;
}

export default { computeLineDiff };
export { computeLineDiff };
try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeLineDiff, default: { computeLineDiff } };
  }
} catch {}
