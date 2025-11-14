/* global module */
const SizeBlocks = {
  clamp(v) {
    return Math.min(60, Math.max(1, v));
  },
  build(fontSizes) {
    const u = SizeBlocks.clamp(fontSizes.username);
    const m = SizeBlocks.clamp(fontSizes.message);
    const d = SizeBlocks.clamp(fontSizes.donation);
    const a = SizeBlocks.clamp(fontSizes.avatar);
    return [
      '/* AUTO_FONT_SIZES_START */',
      `:root{--chat-font-username:${u}px;--chat-font-message:${m}px;--chat-font-donation:${d}px;--chat-avatar-size:${a}px;}`,

      `#chat-container:not(.horizontal-chat) .message-username, #chat-container:not(.horizontal-chat) .message-username.cyberpunk{font-size:${u}px !important;}`,

      `#chat-container:not(.horizontal-chat) .message-text-inline{font-size:${m}px !important;}`,

      `#chat-container:not(.horizontal-chat) .message-donation{font-size:${d}px !important;}`,

      `#chat-container:not(.horizontal-chat) .message-avatar, #chat-container:not(.horizontal-chat) .message-avatar img{width:${a}px !important;height:${a}px !important;}`,
      '/* AUTO_FONT_SIZES_END */',
    ].join('\n');
  },
  merge(base, fontSizes) {
    const start = '/* AUTO_FONT_SIZES_START */';
    const end = '/* AUTO_FONT_SIZES_END */';
    const block = SizeBlocks.build({ ...fontSizes });
    const src = base || '';
    const sIdx = src.indexOf(start);
    const eIdx = sIdx >= 0 ? src.indexOf(end, sIdx + start.length) : -1;
    if (sIdx >= 0 && eIdx >= 0) {
      const afterEnd = eIdx + end.length;
      const before = src.slice(0, sIdx).replace(/\s+$/, '');
      const after = src.slice(afterEnd).replace(/^\s+/, '');
      const core = [before, after].filter(Boolean).join('\n\n');
      const needsNewline = /\S$/.test(core);
      return (core + (needsNewline ? '\n\n' : '') + block).trim();
    }
    const needsNewline = /\S$/.test(src);
    return (src + (needsNewline ? '\n\n' : '') + block).trim();
  },
  strip(base) {
    if (!base) return '';
    const start = '/* AUTO_FONT_SIZES_START */';
    const end = '/* AUTO_FONT_SIZES_END */';
    const sIdx = base.indexOf(start);
    const eIdx = sIdx >= 0 ? base.indexOf(end, sIdx + start.length) : -1;
    if (sIdx >= 0 && eIdx >= 0) {
      const afterEnd = eIdx + end.length;
      const before = base.slice(0, sIdx).replace(/\s+$/, '');
      const after = base.slice(afterEnd).replace(/^\s+/, '');
      return [before, after].filter(Boolean).join('\n\n').trim();
    }
    return base;
  },
  extract(css) {
    const sizes = {};
    if (!css) return sizes;
    const re = {
      username: /--chat-font-username:(\d+)px/,
      message: /--chat-font-message:(\d+)px/,
      donation: /--chat-font-donation:(\d+)px/,
      avatar: /--chat-avatar-size:(\d+)px/,
    };
    for (const k in re) {
      const m = css.match(re[k]);
      if (m) sizes[k] = Number(m[1]);
    }
    return sizes;
  },
};

export default { SizeBlocks };
export { SizeBlocks };
try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SizeBlocks, default: { SizeBlocks } };
  }
} catch {}
