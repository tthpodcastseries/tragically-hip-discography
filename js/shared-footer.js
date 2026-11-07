// shared-footer.js - The Hip Handbook
// Injects site footer and registers service worker
(function() {
  var version = 'v5.8.3 (Thugs - Patch)';

  // Search folding (audit FUNC-05): searches compare folded text on both sides, so a curly
  // apostrophe matches a straight one and "Montreal" finds "Montréal". Used by the setlist,
  // lyrics, home and tour-map searches.
  var COMBINING = /[̀-ͯ]/g;
  var APOS = /[‘’‛′`´]/g;
  var QUOTE = /[“”‟″]/g;
  var DASH = /[‐-―−]/g;
  window.tthFold = function(text) {
    return String(text == null ? '' : text).toLowerCase().normalize('NFKD')
      .replace(COMBINING, '').replace(APOS, "'").replace(QUOTE, '"').replace(DASH, '-')
      .replace(/\s+/g, ' ').trim();
  };
  // The ways a fan might type a show date (audit FUNC-09). Takes 1996-07-27 or 27-07-1996.
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  window.tthDateForms = function(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || ''), y, mo, d;
    if (m) { y = m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{2})-(\d{2})-(\d{4})/.exec(date || ''))) { d = +m[1]; mo = +m[2]; y = m[3]; }
    else return [];
    if (mo < 1 || mo > 12) return [];
    var name = MONTH_NAMES[mo - 1], pad = function(n) { return (n < 10 ? '0' : '') + n; };
    return [y + '-' + pad(mo) + '-' + pad(d), name + ' ' + d + ', ' + y, name + ' ' + d + ' ' + y,
      d + ' ' + name + ' ' + y, name + ' ' + y, pad(d) + '/' + pad(mo) + '/' + y, pad(d) + '-' + pad(mo) + '-' + y];
  };
  // Folded text plus, for each folded character, where it sits in the original, so a
  // match found in the folded copy can be highlighted in the original text.
  window.tthFoldMap = function(text) {
    var src = String(text == null ? '' : text), out = '', map = [], i, j, piece, prevSpace = false;
    for (i = 0; i < src.length; i++) {
      piece = window.tthFold(src.charAt(i));
      if (!piece) {
        // whitespace: keep one space between words
        if (/\s/.test(src.charAt(i)) && out && !prevSpace) { out += ' '; map.push(i); prevSpace = true; }
        continue;
      }
      prevSpace = false;
      for (j = 0; j < piece.length; j++) { out += piece.charAt(j); map.push(i); }
    }
    return { s: out, map: map };
  };
  // Does the text contain what the fan typed? Folded on both sides, and also compared with
  // apostrophes and other punctuation dropped, so "dont" finds "Don't" and "fiddlers" finds
  // "Fiddler's Green" (audit FUNC-02, FUNC-14). Used by the Discography song box, Unplucked
  // Gems, Music Videos and Video For New Recruits searches.
  var bare = function(t) { return t.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); };
  window.tthBare = bare;
  window.tthMatch = function(text, query) {
    var t = window.tthFold(text), q = window.tthFold(query);
    if (!q) return true;
    if (t.indexOf(q) !== -1) return true;
    var qb = bare(q);
    return qb !== '' && bare(t).indexOf(qb) !== -1;
  };

  // Set headings as setlist.fm writes them come in about 20 spellings ("Set #1", "1st Set",
  // "First Set", "Set  I", "Set 1:"). Show one clean form; the data stays as it is
  // (jD, 2026-11-01, audit BRAND-14).
  var SET_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
  var setNum = function(w) { w = String(w).toLowerCase(); if (SET_WORDS[w]) return SET_WORDS[w]; w = w.replace(/(st|nd|rd|th)$/, ''); return /^\d+$/.test(w) ? +w : undefined; };
  window.tthSetLabel = function(name) {
    var t = String(name == null ? '' : name).replace(/\s+/g, ' ').replace(/:\s*$/, '').trim();
    var m = t.match(/^(?:main )?set #?(\w+)$/i) || t.match(/^(\w+) set$/i);
    if (m && setNum(m[1])) return 'Set ' + setNum(m[1]);
    m = t.match(/^encore #?(\w+)$/i) || t.match(/^(\w+) encore$/i);
    if (m && setNum(m[1])) return 'Encore ' + setNum(m[1]);
    return t;
  };

  var footerEl = document.getElementById('site-footer');
  if (footerEl) {
    footerEl.className = 'site-footer';
    footerEl.innerHTML =
      '<div class="footer-buttons">' +
        '<a href="mailto:tthpodcastseries@gmail.com" class="footer-btn">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
          'Connect with jD' +
        '</a>' +
      '</div>' +
      '<a href="https://subscribe.tthpods.com" target="_blank" rel="noopener noreferrer" class="yer-letter-link">Sign up for Yer Letter - The TTH Podcast Series Newsletter</a><br>' +
      '<strong style="color:#d9d9d9">The Tragically Hip</strong> - Gord Downie (1964-2017)<br>' +
      'Designed by <a href="https://home.tthpods.com" target="_blank" rel="noopener noreferrer">The Tragically Hip Podcast Series</a> - Coded by Claude<br>' +
      '<span style="color:#929292;font-size:0.72rem;">Unplucked Gems curated by Alonx</span><br>' +
      '<a href="/privacy.html">Privacy</a><br>' +
      '<span style="color:#929292;font-size:0.7rem;">' + version + '</span>';
  }

  // Pictures that fail to load (inline onerror until v5.4.17, audit SEC-03):
  // data-onerror="hide" hides the picture, "placeholder" swaps in its data-placeholder text.
  // Error events don't bubble, so this listens in the capture phase.
  function imageFailed(img) {
    var mode = img.getAttribute('data-onerror');
    if (mode === 'hide') img.style.display = 'none';
    else if (mode === 'placeholder' && img.parentNode) {
      var box = document.createElement('div');
      box.className = 'mv-thumb-placeholder';
      box.textContent = img.getAttribute('data-placeholder') || '';
      img.parentNode.replaceChild(box, img);
    }
  }
  document.addEventListener('error', function(e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.hasAttribute('data-onerror')) imageFailed(t);
  }, true);

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      // Offline copies are a bonus: some browsers (private windows, in-app browsers, a dropped
      // connection) refuse the worker, and an uncaught refusal was being logged as a "JS Error"
      navigator.serviceWorker.register('/service-worker.js').catch(function () { /* the site works without it */ });
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
