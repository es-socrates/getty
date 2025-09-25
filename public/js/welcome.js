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
      if (footEl) footEl.classList.add('hidden');
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
  let idx = 0;
  let typingTimer = null;
  let pausedForMotion = false;

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }

  function clearTimers() {
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
  }

  function setText(text) {
    if (!el) return;
    el.textContent = text;
  }

  function typewrite(texts) {
    if (!el || !texts || texts.length === 0) return;
    if (prefersReducedMotion()) {

      pausedForMotion = true;
      el.classList.remove('typewriter');
      setText(texts[idx] || '');
      idx = (idx + 1) % texts.length;
      typingTimer = setTimeout(() => typewrite(texts), 2500);
      return;
    }

    pausedForMotion = false;
    el.classList.add('typewriter');
    const full = texts[idx] || '';
    let pos = 0;
    const typeSpeed = 34;
    const holdTime = 1400;
    const eraseSpeed = 28;

    function typeNext() {
      setText(full.slice(0, pos));
      if (pos < full.length) {
        pos++;
        typingTimer = setTimeout(typeNext, typeSpeed);
      } else {
        typingTimer = setTimeout(() => eraseNext(), holdTime);
      }
    }

    function eraseNext() {
      setText(full.slice(0, pos));
      if (pos > 0) {
        pos--;
        typingTimer = setTimeout(eraseNext, eraseSpeed);
      } else {
        idx = (idx + 1) % texts.length;
        typingTimer = setTimeout(() => typewrite(texts), 350);
      }
    }

    clearTimers();
    typeNext();
  }

  function refreshCaptions(reset) {
    caps = buildCaps();
    if (reset) idx = 0;
    clearTimers();
    typewrite(caps);
  }

  try { refreshCaptions(true); } catch (e) {}

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

    function clearStoredWidgetToken() {
      try { localStorage.removeItem('getty_widget_token'); } catch {}
      setCookie('getty_widget_token', '', -1);
    }

    function getStoredWidgetToken() {
      let token = null;
      try { token = localStorage.getItem('getty_widget_token'); } catch {}
      if (token && token.trim()) return token.trim();
      const cookieToken = getCookie('getty_widget_token');
      return cookieToken && cookieToken.trim() ? cookieToken.trim() : '';
    }

    const langBtn = document.getElementById('lang-btn');
    const langMenu = document.getElementById('lang-menu');
    const langBtnLabel = document.getElementById('lang-btn-label');
    if (langBtn && langMenu && langBtnLabel) {
      if (langBtn.dataset.langMenuBound === 'true') {
        const existing = window.__gettyLangMenu;
        if (existing && typeof existing.applyLabel === 'function') {
          try {
            existing.applyLabel(existing.getCurrentLanguage ? existing.getCurrentLanguage() : undefined);
          } catch (_) {}
        }
      } else {
        langBtn.dataset.langMenuBound = 'true';
        langMenu.dataset.langMenuBound = 'true';

        function closeMenu() {
          langMenu.classList.add('hidden');
          langBtn.setAttribute('aria-expanded', 'false');
        }
        function openMenu() {
          langMenu.classList.remove('hidden');
          langBtn.setAttribute('aria-expanded', 'true');
        }
        function toggleMenu() {
          if (langMenu.classList.contains('hidden')) openMenu(); else closeMenu();
        }
        langBtn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleMenu();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeMenu();
        });
        document.addEventListener('click', (e) => {
          if (!langMenu.contains(e.target) && !langBtn.contains(e.target)) closeMenu();
        });

        function applyLangLabel(lang) {
          langBtnLabel.textContent = (lang || 'en').toUpperCase();
        }

        function persistLanguage(lang) {
          if (!lang) return;
          try { localStorage.setItem('lang', lang); } catch {}
          setCookie('getty_lang', lang, 365);
          try {
            if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
              window.__i18n.setLanguage(lang);
            }
          } catch (_) {}
        }

        let saved = null;
        let cookieLang = getCookie('getty_lang');
        try { saved = localStorage.getItem('lang'); } catch {}
        let current = (cookieLang || saved || (window.__i18n && window.__i18n.getLanguage && window.__i18n.getLanguage()) || 'en');
        applyLangLabel(current);

        try {
          if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
            window.__i18n.setLanguage(current);
          }
        } catch (_) {}

        function setLanguage(lang) {
          if (!lang) return;
          persistLanguage(lang);
          current = lang;
          applyLangLabel(current);
          closeMenu();
        }

        langMenu.querySelectorAll('button[data-lang]').forEach(btn => {
          btn.dataset.langMenuBound = 'true';
          btn.addEventListener('click', () => {
            setLanguage(btn.getAttribute('data-lang'));
          });
        });

        if (!window.__gettyLangMenu) {
          window.__gettyLangMenu = {
            open: openMenu,
            close: closeMenu,
            toggle: toggleMenu,
            applyLabel: applyLangLabel,
            persistLanguage,
            setLanguage,
            getCurrentLanguage: () => current
          };
        }
      }
    }

    function handleWidgetTokenFlow() {
      const statusEl = document.getElementById('welcome-status');
      const loginLink = document.getElementById('welcome-login-link');
      const labelEl = loginLink ? loginLink.querySelector('.btn-label') : null;
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');

      if (statusEl) {
        statusEl.classList.add('hidden');
        statusEl.textContent = '';
      }

      if (reason === 'invalid-token' || reason === 'expired-token') {
        clearStoredWidgetToken();
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.textContent = reason === 'expired-token'
            ? tr('welcomeTokenExpired', 'Session expired. Please log in again to refresh your dashboard link.')
            : tr('welcomeTokenInvalid', 'We could not open your dashboard. Please log in again.');
        }
        if (labelEl) {
          labelEl.textContent = tr('welcomeLogin', 'Login');
        }
        params.delete('reason');
        const nextUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + (window.location.hash || '');
        window.history.replaceState({}, document.title, nextUrl);
        return;
      }

      const storedToken = getStoredWidgetToken();
      if (storedToken && loginLink) {
        const destination = `/user/${encodeURIComponent(storedToken)}`;
        loginLink.href = destination;
        loginLink.setAttribute('data-state', 'continue');
        if (labelEl) {
          labelEl.textContent = tr('welcomeContinue', 'Open dashboard');
        }
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.textContent = tr('welcomeRedirecting', 'Redirecting to your dashboard…');
        }
        setTimeout(() => {
          try { window.location.replace(destination); } catch { window.location.href = destination; }
        }, 800);
      } else if (loginLink) {
        loginLink.href = '/';
      }
    }

    handleWidgetTokenFlow();
  } catch (_) {}
});
