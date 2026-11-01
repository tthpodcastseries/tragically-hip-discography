// dialog-a11y.js - focus handling for the show and setlist pop-ups on the home page and
// tour map (was the same inline block on both pages until v5.4.17)
// Dialog a11y: focus capture/restore + Escape + Tab-trap for modal overlays.
// One watcher for all the pop-ups (audit A11Y-04): when a pop-up opens another
// ("View full setlist" from a show card), the whole chain shares one opener, and
// focus only goes back to it once every pop-up is closed.
(function() {
  var SELECTOR = '.show-detail-overlay, .setlist-overlay';
  var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var FALLBACK = ['gigSearch', 'songSearchInput']; // Tour Map search, Home search
  var overlays = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
  if (!overlays.length) return;

  function focusables(el) {
    return Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function(n) {
      return !n.disabled && n.offsetParent !== null;
    });
  }

  function isOpen(el) { return el.classList.contains('active'); }

  function topOpen() {
    var open = overlays.filter(isOpen);
    if (!open.length) return null;
    return open.sort(function(a, b) {
      return (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0);
    })[0];
  }

  // Can focus still usefully go here? (still on the page, visible, not inside a closed pop-up)
  function usable(el) {
    if (!el || el === document.body || !document.contains(el)) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return !overlays.some(function(o) { return !isOpen(o) && o.contains(el); });
  }

  function focusInto(overlay) {
    var f = focusables(overlay);
    if (f.length) f[0].focus();
  }

  var wasOpen = overlays.map(isOpen);
  var opener = null; // what had focus before the first pop-up in the chain opened

  var watcher = new MutationObserver(function() {
    var nowOpen = overlays.map(isOpen);
    var anyBefore = wasOpen.some(Boolean);
    var anyNow = nowOpen.some(Boolean);
    var opened = overlays.filter(function(o, i) { return nowOpen[i] && !wasOpen[i]; });
    wasOpen = nowOpen;

    if (anyNow) {
      if (!anyBefore) opener = document.activeElement;
      var top = topOpen();
      if (opened.length) focusInto(opened.indexOf(top) !== -1 ? top : opened[0]);
      else if (!top.contains(document.activeElement)) focusInto(top);
    } else if (anyBefore) {
      // All closed. If a button already sent focus somewhere sensible (e.g. the
      // player's Play button after "Play this show"), leave it there.
      // If what opened the chain has gone (a closed search list, a page link),
      // fall back to the page's search box rather than the top of the page.
      var here = document.activeElement;
      if (!usable(here)) {
        var back = usable(opener) ? opener : null;
        for (var i = 0; !back && i < FALLBACK.length; i++) {
          var fb = document.getElementById(FALLBACK[i]);
          if (usable(fb)) back = fb;
        }
        if (back) { try { back.focus(); } catch (e) {} }
      }
      opener = null;
    }
  });
  overlays.forEach(function(o) { watcher.observe(o, { attributes: true, attributeFilter: ['class'] }); });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape' && e.key !== 'Tab') return;
    var overlay = topOpen();
    if (!overlay) return;
    if (e.key === 'Escape') { overlay.classList.remove('active'); return; }
    var f = focusables(overlay);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });
})();
