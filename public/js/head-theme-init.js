(function () {
  try {
    var doc = document.documentElement;
    var stored = null;
    try {
      stored = localStorage.getItem('theme');
    } catch (_) {}
    if (!stored) {
      var legacy = null;
      try {
        legacy = localStorage.getItem('prefers-dark');
      } catch (_) {}
      if (legacy === '1') stored = 'dark';
      else if (legacy === '0') stored = 'light';
    }
    var prefersDark = false;
    try {
      prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_) {}
    var useDark = stored ? stored === 'dark' : prefersDark;
    doc.classList.toggle('dark', useDark);
    doc.classList.toggle('light', !useDark);
    var body = document.body;
    if (body) {
      body.classList.toggle('dark', useDark);
      body.classList.toggle('light', !useDark);
    } else {
      var once = function () {
        document.removeEventListener('DOMContentLoaded', once);
        var lateBody = document.body;
        if (!lateBody) return;
        lateBody.classList.toggle('dark', useDark);
        lateBody.classList.toggle('light', !useDark);
      };
      document.addEventListener('DOMContentLoaded', once);
    }
    try {
      doc.setAttribute('data-theme', useDark ? 'dark' : 'light');
    } catch (_) {}
    try {
      localStorage.setItem('theme', useDark ? 'dark' : 'light');
    } catch (_) {}
    try {
      localStorage.setItem('prefers-dark', useDark ? '1' : '0');
    } catch (_) {}
  } catch (e) {}
})();
