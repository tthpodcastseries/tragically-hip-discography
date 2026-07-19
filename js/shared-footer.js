// shared-footer.js - The Hip Handbook
// Injects site footer and registers service worker
(function() {
  var version = 'v4.5 (Lionized)';

  var footerEl = document.getElementById('site-footer');
  if (footerEl) {
    footerEl.className = 'site-footer';
    footerEl.innerHTML =
      '<div class="footer-buttons">' +
        '<a href="mailto:jd@tthpods.com" class="footer-btn">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
          'Connect with jD' +
        '</a>' +
      '</div>' +
      '<a href="https://subscribe.tthpods.com" target="_blank" rel="noopener noreferrer" class="yer-letter-link">Sign up For Yer Letter - The TTH Podcast Series Newsletter</a><br>' +
      '<strong style="color:#aaa">The Tragically Hip</strong> - Gord Downie (1964-2017)<br>' +
      'Designed by <a href="https://www.tragicallyhippodcast.com" target="_blank" rel="noopener noreferrer">The Tragically Hip Podcast Series</a> - Coded by Claude<br>' +
      '<span style="color:#888;font-size:0.72rem;">Unplucked Gems curated by Alonx</span><br>' +
      '<span style="color:#666;font-size:0.7rem;">' + version + '</span>';
  }

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js');
    });
  }

  // Analytics events via Umami (script tag lives in each page's <head>)
  function trackEvent(name, data) {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, data);
    }
  }

  // JS error reporting (max 3 per page view to avoid spam)
  var errorsSent = 0;
  function reportError(message, source) {
    if (errorsSent >= 3 || !message) return;
    errorsSent++;
    trackEvent('JS Error', {
      message: String(message).slice(0, 150),
      source: String(source || '').slice(0, 100),
      page: location.pathname
    });
  }
  window.addEventListener('error', function(e) {
    reportError(e.message, (e.filename || '') + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason;
    reportError((r && r.message) || String(r), 'unhandledrejection');
  });

  // Outbound link tracking (Plausible did this automatically; Umami's script doesn't)
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !/^https?:/.test(a.href)) return;
    if (a.hostname === location.hostname) return;
    trackEvent('Outbound Link', { url: a.href.slice(0, 200), page: location.pathname });
  }, true);
})();
