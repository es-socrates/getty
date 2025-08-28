window.addEventListener('DOMContentLoaded', function () {
  try {
    var isLocal = (
      location.protocol === 'file:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1' ||
      (location.hostname && location.hostname.endsWith && location.hostname.endsWith('.local'))
    );
    if (isLocal) {
      var footEl = document.querySelector('.foot');
      if (footEl) footEl.style.display = 'none';
    }
  } catch (_) {}

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      document.documentElement.classList.toggle('light', isDark);
      try {
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
      } catch (e) {}
    });
  }

  function tr(key, fallback) {
    try {
      if (window.__i18n && typeof window.__i18n.t === 'function') {
        const v = window.__i18n.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function buildCaps() {
    return [
        tr('welcomeCaptionTips', 'Real-time tip notifications'),
        tr('welcomeCaptionGoals', 'Donation goals with celebratory effects'),
        tr('welcomeCaptionChatRaffle', 'Live chat overlay and raffles'),
        tr('welcomeCaptionAnnouncements', 'Announcements and external notifications'),
        tr('welcomeCaptionPrivacy', 'Privacy-aware hosted mode'),
        tr('welcomeCaptionObs', 'OBS-friendly widgets, zero fuss'),
        tr('welcomeCaptionAllForOdysee', 'Everything for your livestreams on Odysee'),
        tr('welcomeCaptionSocialWidgets', 'Social media widgets'),
        tr('welcomeCaptionRunLocalOrHosted', 'Run locally or online'),
        tr('welcomeCaptionArweaveTips', 'Your decentralized tips via Arweave')
    ].filter(Boolean);
  }

  const el = document.getElementById('caption');
  let caps = buildCaps();
  let i = 0;

  function refreshCaptions(reset) {
    caps = buildCaps();
    if (reset) i = 0;
    if (el) el.textContent = caps[i] || '';
  }

  function showNext() {
    if (!el || caps.length === 0) return;
    el.style.transition = 'opacity .5s ease';
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = caps[i] || '';
      i = (i + 1) % caps.length;
      el.style.opacity = '1';
    }, 420);
  }

  try {
    refreshCaptions(true);
  } catch (e) {}
  setInterval(showNext, 3300);

  try {
    if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
      const _origSet = window.__i18n.setLanguage;
      window.__i18n.setLanguage = function (lang) {
        _origSet.call(window.__i18n, lang);
        refreshCaptions(true);
      };
    }
  } catch (e) {}

  try {
    function setCookie(name, value, days) {
      try {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = 'expires=' + d.toUTCString();
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = name + '=' + encodeURIComponent(value) + '; ' + expires + '; Path=/' + '; SameSite=Lax' + secure;
      } catch (_) {}
    }
    function getCookie(name) {
      try {
        const cname = name + '=';
        const parts = document.cookie.split(';');
        for (let i = 0; i < parts.length; i++) {
          let c = parts[i].trim();
          if (c.indexOf(cname) === 0) return decodeURIComponent(c.substring(cname.length));
        }
      } catch (_) {}
      return null;
    }

    const sel = document.getElementById('lang-select');
    if (sel) {
      let saved = null;
      let cookieLang = getCookie('getty_lang');
      try { saved = localStorage.getItem('lang'); } catch {}
      const current = (cookieLang || saved || (window.__i18n && window.__i18n.getLanguage && window.__i18n.getLanguage()) || 'en');
      if (current && sel.value !== current) {
        sel.value = current;
      }

      try {
        if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
          window.__i18n.setLanguage(current);
        }
      } catch (_) {}

      sel.addEventListener('change', function() {
        const lang = sel.value;
        try { localStorage.setItem('lang', lang); } catch {}
        setCookie('getty_lang', lang, 365);
        try {
          if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
            window.__i18n.setLanguage(lang);
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
});
