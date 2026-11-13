// clean-address.js - what Umami is allowed to see of the address bar.
//
// Every page loads this BEFORE the Umami script, and the Umami tag names the function
// below (data-before-send="tthCleanAddress"). Umami calls it with everything it is about
// to send, and sends only what it gets back.
//
// The rule (jD, 2026-11-06): the three link tags jD puts on his own posts get through
// (utm_source, utm_medium, utm_campaign), so he can see which post a visit came from.
// Everything else after the "?" is cut off: search words (q), the song or album someone
// opened (s, song, album), filters (cat, view), the first name on a membersHIP invite
// link (first), Facebook's click id (fbclid), and anything nobody has thought of yet.
// The same goes for the address of the page a visitor came from. The privacy page
// promises this, so if this file changes, check that page's wording too.
//
// If anything here goes wrong it cuts the whole "?" part, tags and all: losing a tag is
// fine, leaking a search word is not. scripts/audit-site.js fails if a page has the
// Umami tag without this script ahead of it.
(function () {
  var KEEP = ['utm_source', 'utm_medium', 'utm_campaign'];
  var MAX_TAG = 100; // a tag is a word or two; never pass on a long one

  // Cut everything from "?" up to "#" (or the end). Never fails.
  function cutQuery(address) {
    return String(address).replace(/\?[^#]*/, '');
  }

  // The page's own address, with only the three tags left on it
  function cleanAddress(address) {
    try {
      var u = new URL(address, location.href);
      var kept = new URLSearchParams();
      KEEP.forEach(function (name) {
        var value = u.searchParams.get(name);
        if (value) kept.set(name, value.slice(0, MAX_TAG));
      });
      var query = kept.toString();
      u.search = query ? '?' + query : '';
      return u.toString();
    } catch (e) {
      return cutQuery(address);
    }
  }

  // Umami used to ignore everything after the "?" (data-exclude-search), so changing only
  // that part of the address never counted as a new page view. Keep it that way: a page
  // view whose cleaned address matches the last one sent is not sent again.
  var lastPage = null;

  window.tthCleanAddress = function (type, payload) {
    try {
      if (!payload || typeof payload !== 'object') return payload;
      if (typeof payload.url === 'string') payload.url = cleanAddress(payload.url);
      if (typeof payload.referrer === 'string') payload.referrer = cutQuery(payload.referrer);
      if (type === 'event' && !payload.name) {
        if (payload.url === lastPage) return false;
        lastPage = payload.url;
      }
      return payload;
    } catch (e) {
      return false; // send nothing rather than something unchecked
    }
  };
})();
