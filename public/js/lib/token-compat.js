(function(global){
  if(!global.tokenCompat) global.tokenCompat = {};
  Object.assign(global.tokenCompat, {
    hasWalletSessionCookie: function(){ try { return /(?:^|; )getty_wallet_session=/.test(document.cookie); } catch { return false; } },
  });
})(window);
