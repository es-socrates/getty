// Index page UI behavior

;(function() {
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
  function setCookie(name, value, days) {
    try {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = 'expires=' + d.toUTCString();
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + encodeURIComponent(value) + '; ' + expires + '; Path=/' + '; SameSite=Lax' + secure;
    } catch (_) {}
  }

  try {
    const langSel = document.getElementById('language-selector');
    let savedLang = null;
    try { savedLang = localStorage.getItem('lang'); } catch {}
    const cookieLang = getCookie('getty_lang');
    const currentLang = (cookieLang || savedLang || (window.__i18n && window.__i18n.getLanguage && window.__i18n.getLanguage()) || 'en');
    if (langSel && langSel.value !== currentLang) {
      langSel.value = currentLang;
    }
    try {
      if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
        window.__i18n.setLanguage(currentLang);
      }
    } catch (_) {}
    if (langSel) {
      langSel.addEventListener('change', function() {
        const lang = langSel.value;
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

  const userMenuButton = document.getElementById('user-menu-button');
  const userMenu = document.getElementById('user-menu');
  const themeToggle = document.getElementById('theme-toggle');
  const langBtn = document.getElementById('lang-btn');
  const langMenu = document.getElementById('lang-menu');
  const langBtnLabel = document.getElementById('lang-btn-label');
  const chatContainer = document.getElementById('chat-container');
  const raffleRoot = document.getElementById('raffleContentContainer');
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');

  try {
    const themeCSS = localStorage.getItem('chatLiveThemeCSS') || '';
    if (chatContainer) {
      const hasTheme = !!themeCSS && themeCSS.trim().length > 0;
      chatContainer.classList.toggle('theme-active', hasTheme);
      chatContainer.classList.toggle('chat-default', !hasTheme);
      chatContainer.classList.toggle('theme-light', hasTheme && themeCSS.includes('--text: #1f2328'));
    }
  } catch (e) {}

  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
      try { themeToggle.setAttribute('aria-pressed', (!isDark).toString()); } catch(_) {}
    });

    try { themeToggle.setAttribute('aria-pressed', (document.documentElement.classList.contains('dark')).toString()); } catch(_) {}
  }

  if (langBtn && langMenu && langBtnLabel) {
    try {
      langBtn.dataset.langMenuBound = 'true';
      langMenu.dataset.langMenuBound = 'true';
      langBtn.dataset.langMenuOwner = 'index-ui';
    } catch(_) {}

    function closeMenu() {
      langMenu.classList.add('hidden');
      langBtn.setAttribute('aria-expanded', 'false');
    }
    function openMenu() {
      langMenu.classList.remove('hidden');
      langBtn.setAttribute('aria-expanded', 'true');
    }
    function toggleMenu() {
      if (langMenu.classList.contains('hidden')) {
        openMenu();
      } else {
        closeMenu();
      }
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

    let saved = null;
    let cookieLang = getCookie('getty_lang');
    try { saved = localStorage.getItem('lang'); } catch {}
    const current = (cookieLang || saved || (window.__i18n && window.__i18n.getLanguage && window.__i18n.getLanguage()) || 'en');
    applyLangLabel(current);

    try {
      if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
        window.__i18n.setLanguage(current);
      }
    } catch (_) {}

    langBtn.classList.remove('hidden');
    langBtn.setAttribute('data-visible', 'true');

    langMenu.querySelectorAll('button[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        if (!lang) return;
        try { localStorage.setItem('lang', lang); } catch {}
        setCookie('getty_lang', lang, 365);
        try {
          if (window.__i18n && typeof window.__i18n.setLanguage === 'function') {
            window.__i18n.setLanguage(lang);
          }
        } catch (_) {}
        applyLangLabel(lang);
        closeMenu();
      });
    });
  }

  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener('click', function(e) {
      e.stopPropagation();
      userMenu.classList.toggle('opacity-0');
      userMenu.classList.toggle('invisible');
      const expanded = !userMenu.classList.contains('invisible');
      try { userMenuButton.setAttribute('aria-expanded', expanded.toString()); } catch(_) {}
    });

    document.addEventListener('click', function(e) {
      if (!userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
        userMenu.classList.add('opacity-0', 'invisible');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        userMenu.classList.add('opacity-0', 'invisible');
        try { userMenuButton.setAttribute('aria-expanded', 'false'); userMenuButton.focus(); } catch(_) {}
      }
    }, true);
  }

  if (prefersReducedMotion) {
    try { document.documentElement.classList.add('reduced-motion'); } catch(_) {}
  }

  try {
    const panels = document.querySelectorAll('.os-card');
    const seen = new WeakSet();
    const loadFor = async (panel) => {
      try {
        const hasLastTip = !!panel.querySelector('#last-donation');
        const hasGoal = !!panel.querySelector('#goal-widget');
        const hasNotif = !!panel.querySelector('#notification');
        const hasChat = !!panel.querySelector('#chat-container');
        const hasRaffle = !!panel.querySelector('#raffleContentContainer');
        const widgets = await import('/js/modules/widgets.js');
        if (hasLastTip) { await widgets.loadLastTip(); await widgets.loadTipWidget(); }
        if (hasGoal) { await widgets.loadTipGoal(); }
        if (hasNotif) { await widgets.loadNotifications(); }
        if (hasChat) { await widgets.loadChat(); }
        if (hasRaffle) { await widgets.loadRaffle(); }
        try {
          const ach = document.getElementById('achievements-panel')
            || document.getElementById('achievements-embed')
            || document.querySelector('[data-ach-embed]');
          if (ach) { const m = await import('/js/modules/achievements-widget.js'); if (m) {/* auto-booted module */} }
        } catch {}
        await widgets.loadAppStatus();
      } catch (e) { /* ignore */ }
    };
    const io = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting && !seen.has(ent.target)) {
          seen.add(ent.target);
          loadFor(ent.target);
        }
      }
    }, { rootMargin: '0px 0px 200px 0px', threshold: 0.01 }) : null;
    if (io) panels.forEach(p => io.observe(p)); else panels.forEach(p => loadFor(p));
  } catch(_) {}

  try {
    const setBusy = (selector, busy) => {
      try { const el = typeof selector === 'string' ? document.querySelector(selector) : selector; if (el) el.setAttribute('aria-busy', (!!busy).toString()); } catch(_) {}
    };
    const addFadeIn = (el) => { try { if (el && !el.classList.contains('fade-in')) el.classList.add('fade-in'); } catch(_){} };
    const hideSkeleton = (key) => {
      document.querySelectorAll(`[data-skeleton="${key}"]`).forEach(el => el.classList.add('hidden'));
      if (key === 'last-tip') { setBusy('#last-donation', false); addFadeIn(document.querySelector('#last-donation .last-donation-content')); }
      else if (key === 'goal') { setBusy('#goal-widget', false); addFadeIn(document.querySelector('#goal-widget .goal-container')); }
      else if (key === 'notification') { setBusy('#notification', false); addFadeIn(document.querySelector('#notification')); }
      else if (key === 'chat') { setBusy('#chat-container', false); addFadeIn(document.querySelector('#chat-container')); }
      else if (key === 'raffle') { setBusy(document.querySelector('.raffle-embed'), false); addFadeIn(document.querySelector('#raffleContentContainer')); }
    };
    const observeReady = (target, isReady, onReady) => {
      if (!target) return;
      let done = false;
      let mo = null;
      const check = () => {
        if (done) return;
        try {
          if (isReady(target)) {
            done = true;
            try { onReady(); } catch(_){ }
            try { if (mo) mo.disconnect(); } catch(_) {}
          }
        } catch(_) {}
      };
      mo = new MutationObserver(check);
      mo.observe(target, { childList: true, subtree: true, characterData: true });

      check();
      setTimeout(check, 2000);
      setTimeout(check, 6000);
    };

    const lastTipRoot = document.getElementById('last-donation');
    observeReady(lastTipRoot || document.body, () => {
      const amt = lastTipRoot && lastTipRoot.querySelector('.ar-amount');
      const title = lastTipRoot && lastTipRoot.querySelector('.notification-title');
      return (amt && amt.textContent && amt.textContent.trim() !== '--') || (title && title.textContent && title.textContent.trim() !== '');
    }, () => hideSkeleton('last-tip'));

    const goalContainer = document.querySelector('#goal-widget .goal-container');
    observeReady(goalContainer || document.body, (node) => {
      const c = node === document.body ? goalContainer : node;
      return c && c.children && c.children.length > 0;
    }, () => hideSkeleton('goal'));

    const notificationBox = document.getElementById('notification');
    observeReady(notificationBox || document.body, (node) => {
      const n = node === document.body ? notificationBox : node;
      return n && n.children && n.children.length > 0;
    }, () => hideSkeleton('notification'));

    observeReady(chatContainer || document.body, (node) => {
      const c = node === document.body ? chatContainer : node;
      if (!c) return false;
      if (c.children && c.children.length > 0) return true;
      return !!c.querySelector('.message, .chat-root, [data-chat-ready]');
    }, () => hideSkeleton('chat'));

    observeReady(raffleRoot || document.body, (node) => {
      const r = node === document.body ? raffleRoot : node;
      return r && r.children && r.children.length > 0;
    }, () => hideSkeleton('raffle'));
  } catch(_) {}

  if (raffleRoot) {
    const tagRafflePieces = () => {
      try {
        const winnerTitle = raffleRoot.querySelector('[data-i18n="raffleWinnerTitle"]');
        const prizeLabel = raffleRoot.querySelector('[data-i18n="rafflePrizeLabel"]');
        const participantsLabel = raffleRoot.querySelector('[data-i18n="raffleParticipants"]');
        const participantCountBox = raffleRoot.querySelector('#participantCount');
        if (winnerTitle && !winnerTitle.classList.contains('raffle-winner-title')) {
          winnerTitle.classList.add('raffle-winner-title');
        }
        if (prizeLabel && !prizeLabel.classList.contains('raffle-prize-label')) {
          prizeLabel.classList.add('raffle-prize-label');
        }
        if (participantsLabel && !participantsLabel.classList.contains('raffle-participants-label')) {
          participantsLabel.classList.add('raffle-participants-label');
        }
        if (participantCountBox && !participantCountBox.classList.contains('raffle-participant-count')) {
          participantCountBox.classList.add('raffle-participant-count');
        }
      } catch (_) {}
    };

    tagRafflePieces();
    const mo = new MutationObserver(tagRafflePieces);
    mo.observe(raffleRoot, { childList: true, subtree: true });
  }

  try {
    const PREFS = {
      'menu.open': false,
      'scroll.y': 0,
      'demo.tips': false,
    };

    const SKEY = 'index.ui.prefs';
    const loadPrefs = () => { try { return JSON.parse(sessionStorage.getItem(SKEY) || '{}'); } catch { return {}; } };
    const savePrefs = (obj) => { try { sessionStorage.setItem(SKEY, JSON.stringify(obj)); } catch {} };
    const prefs = { ...PREFS, ...loadPrefs() };
    if (prefs['menu.open'] && userMenu && userMenuButton) {
      userMenu.classList.remove('opacity-0','invisible');
      userMenuButton.setAttribute('aria-expanded', 'true');
    }

    if (typeof prefs['scroll.y'] === 'number' && prefs['scroll.y'] > 0) {
      try { window.scrollTo(0, prefs['scroll.y']); } catch {}
    }

    if (userMenuButton && userMenu) {
      const syncSave = () => { prefs['menu.open'] = !userMenu.classList.contains('invisible'); savePrefs(prefs); };
      userMenuButton.addEventListener('click', syncSave);
      document.addEventListener('click', (e)=>{ if (!userMenu.contains(e.target) && !userMenuButton.contains(e.target)) syncSave(); });
      document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') syncSave(); }, true);
    }

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { prefs['scroll.y'] = window.scrollY || 0; savePrefs(prefs); }, 200);
    }, { passive: true });

    const demoToggle = document.getElementById('demo-tips-toggle');
    const applyDemo = () => {
      try { document.documentElement.setAttribute('data-demo-tips', prefs['demo.tips'] ? '1' : '0'); } catch {}
      if (!demoToggle) return;
      try {
        if ('checked' in demoToggle) {
          demoToggle.checked = !!prefs['demo.tips'];
        } else {
          demoToggle.setAttribute('aria-pressed', (!!prefs['demo.tips']).toString());
        }
      } catch {}
    };
    applyDemo();
    if (demoToggle) {
      const onDemoChange = () => {
        if ('checked' in demoToggle) {
          prefs['demo.tips'] = !!demoToggle.checked;
        } else {
          prefs['demo.tips'] = demoToggle.getAttribute('aria-pressed') === 'true';
        }
        savePrefs(prefs); applyDemo();
      };
      demoToggle.addEventListener('change', onDemoChange);
      demoToggle.addEventListener('click', () => {
        if (!('checked' in demoToggle)) {
          const v = demoToggle.getAttribute('aria-pressed') === 'true';
          demoToggle.setAttribute('aria-pressed', (!v).toString());
          onDemoChange();
        }
      });
    }
  } catch {}

  try {
    const ensureEmpty = (sel, key) => {
      const root = document.querySelector(sel);
      if (!root) return;
      const hasContent = root.children && root.children.length > 0;
      if (hasContent) return;
      if (root.querySelector('[data-empty-state]') || root.querySelector('[data-skeleton]')) return;
      const card = document.createElement('div');
      card.className = 'p-3';
      card.setAttribute('data-empty-state', key);
      const big = document.createElement('div');
  big.className = 'skeleton rounded-xl mb-3 h-[120px]';
      big.setAttribute('data-skeleton', key.replace('-empty',''));
      const line1 = document.createElement('div');
  line1.className = 'skeleton skeleton-line w-[60%]';
      const line2 = document.createElement('div');
  line2.className = 'skeleton skeleton-line w-[40%]';
      card.appendChild(big);
      card.appendChild(line1);
      card.appendChild(line2);
      root.appendChild(card);
    };
    ensureEmpty('#notification', 'notification-empty');
    ensureEmpty('#chat-container', 'chat-empty');
    ensureEmpty('#raffleContentContainer', 'raffle-empty');
  } catch {}

  try {
    const primaryLoginButton = document.getElementById('public-wallet-login');
    if (primaryLoginButton) {
      const delegateButtons = [
        document.getElementById('public-wallet-login-hero'),
        document.getElementById('public-wallet-login-cta')
      ];
      const triggerLogin = (event) => {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        try { primaryLoginButton.click(); } catch (_) {}
      };
      delegateButtons.forEach((btn) => {
        if (!btn) return;
        btn.addEventListener('click', triggerLogin);
      });
    }
  } catch (_) {}

  window.loadUserSpecificWidgets = async function() {
    try {
      const isLoggedIn = document.querySelector('#public-wallet-login[data-state="logged-in"]');
      
      if (isLoggedIn) {
        const config = await loadUserNamespaceConfig();
        
        applyUserConfigToWidgets(config);
      }
    } catch (e) {
      console.warn('[index-ui] Failed to load user-specific widgets', e);
    }
  };

  async function loadUserNamespaceConfig() {
    try {

      const response = await fetch('/api/user/config');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('[index-ui] Failed to load user config', e);
    }
    return {};
  }

  function applyUserConfigToWidgets(config) {
    if (config.lastTip?.title) {
      const lastTipTitle = document.querySelector('#last-donation .os-panel-title span:last-child');
      if (lastTipTitle) lastTipTitle.textContent = config.lastTip.title;
    }

    if (config.goal?.title) {
      const goalTitle = document.querySelector('#goal-widget').closest('.os-card').querySelector('.os-panel-title span:last-child');
      if (goalTitle) goalTitle.textContent = config.goal.title;
    }

    if (config.colors) {
      applyCustomColors(config.colors);
    }
  }

  function applyCustomColors(colors) {
    const root = document.documentElement;
    if (colors.primary) root.style.setProperty('--user-primary-color', colors.primary);
    if (colors.secondary) root.style.setProperty('--user-secondary-color', colors.secondary);
    
    const header = document.querySelector('.os-header');
    if (header && colors.primary) {
      header.style.borderBottomColor = colors.primary;
    }
  }
})();
