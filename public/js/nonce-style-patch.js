(function () {
  try {
    var meta = document.querySelector('meta[property="csp-nonce"]');
    var n =
      (meta && (meta.nonce || meta.getAttribute('nonce'))) ||
      (document.head && document.head.dataset && document.head.dataset.cspNonce) ||
      '';
    if (!n) return;

    try {
      var existing = document.querySelectorAll('style:not([nonce])');
      for (var i = 0; i < existing.length; i++) {
        existing[i].setAttribute('nonce', n);
      }
    } catch {}

    var origCreate = document.createElement;
    document.createElement = function (name, options) {
      var el = origCreate.call(document, name, options);
      try {
        if (String(name).toLowerCase() === 'style') {
          if (el && !el.getAttribute('nonce')) el.setAttribute('nonce', n);
        }
      } catch {}
      return el;
    };

    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (!m.addedNodes || !m.addedNodes.length) continue;
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            try {
              if (node && node.nodeType === 1) {
                if (node.tagName === 'STYLE' && !node.getAttribute('nonce'))
                  node.setAttribute('nonce', n);
                var styles = node.querySelectorAll
                  ? node.querySelectorAll('style:not([nonce])')
                  : [];
                for (var k = 0; k < styles.length; k++) {
                  styles[k].setAttribute('nonce', n);
                }
              }
            } catch {}
          }
        }
      });
      mo.observe(document.documentElement || document, { childList: true, subtree: true });
    } catch {}
  } catch {}
})();
