// Index page UI behavior (extracted from inline script)
// - Theme toggle persistence
// - User menu open/close
// - Chat theme flags
// - Raffle element tagging

;(function() {
  const userMenuButton = document.getElementById('user-menu-button');
  const userMenu = document.getElementById('user-menu');
  const themeToggle = document.getElementById('theme-toggle');
  const chatContainer = document.getElementById('chat-container');
  const raffleRoot = document.getElementById('raffleContentContainer');

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
    });
  }

  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener('click', function(e) {
      e.stopPropagation();
      userMenu.classList.toggle('opacity-0');
      userMenu.classList.toggle('invisible');
    });

    document.addEventListener('click', function(e) {
      if (!userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
        userMenu.classList.add('opacity-0', 'invisible');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        userMenu.classList.add('opacity-0', 'invisible');
      }
    });
  }

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
})();
