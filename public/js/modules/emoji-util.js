export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML
    .replace(/&lt;stkr&gt;/g,'<stkr>')
    .replace(/&lt;\/stkr&gt;/g,'</stkr>');
}

export function formatWithMapping(rawText, emojiMapping) {
  if (!rawText) return '';

  if (/<img[^>]+class=\"(?:comment-emoji|comment-sticker)\"/i.test(rawText)) return rawText;
  let formatted = escapeHtml(rawText);

  formatted = formatted.replace(/<stkr>(.*?)<\/stkr>/g, (m, url) => {
    try {
      const decoded = decodeURIComponent(url);
      if (/^https?:\/\//i.test(decoded)) {
        return `<img src="${decoded}" alt="Sticker" class="comment-sticker" loading="lazy" />`;
      }
      return m;
    } catch { return m; }
  });
  if (emojiMapping && typeof emojiMapping === 'object') {
    for (const [code, url] of Object.entries(emojiMapping)) {
      if (!code || !url) continue;
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isSticker = url.includes('/stickers/');
      const cls = isSticker ? 'comment-sticker' : 'comment-emoji';
      formatted = formatted.replace(new RegExp(escapedCode, 'g'), `<img src="${url}" alt="${code}" class="${cls}" loading="lazy" />`);
    }
  }
  return formatted;
}

export function truncateTipMessage(original) {
  const text = original || '';
  if (text.length <= 80) return text;

  const matches = text.match(/:[^:\s]{1,32}:/g) || [];
  const hasManyEmojis = matches.length >= 3;
  if (hasManyEmojis && text.length <= 160) return text;
  return text.substring(0, 80) + '...';
}

export default { escapeHtml, formatWithMapping, truncateTipMessage };
