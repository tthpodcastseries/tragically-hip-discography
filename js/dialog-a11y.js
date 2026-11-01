// dialog-a11y.js - focus handling for the show and setlist pop-ups on the home page and
// tour map (was the same inline block on both pages until v5.4.17)
// Dialog a11y: focus capture/restore + Escape + Tab-trap for modal overlays.
(function() {
  var SELECTOR = '.show-detail-overlay, .setlist-overlay';
  var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function focusables(el) {
    return Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function(n) {
      return !n.disabled && n.offsetParent !== null;
    });
  }

  function topOpen() {
    var open = Array.prototype.filter.call(document.querySelectorAll(SELECTOR), function(el) {
      return el.classList.contains('active');
    });
    if (!open.length) return null;
    return open.sort(function(a, b) {
      return (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0);
    })[0];
  }

  Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function(overlay) {
    var lastFocus = null;
    new MutationObserver(function() {
      var isOpen = overlay.classList.contains('active');
      if (isOpen && !lastFocus) {
        lastFocus = document.activeElement;
        var f = focusables(overlay);
        if (f.length) f[0].focus();
      } else if (!isOpen && lastFocus) {
        try { lastFocus.focus(); } catch (e) {}
        lastFocus = null;
      }
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });

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
  });
})();
