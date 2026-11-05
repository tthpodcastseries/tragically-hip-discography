// not-found.js - on the 404 page, rescue a link that had words stuck to its end.
// A fan pastes a game's share text and types straight after the link, so
// ".../bring-it-all-back" turns into ".../bring-it-all-backHow'd" (Umami, Nov 2026).
// If the dead address starts with one of these pages, go to that page instead.
// Loaded in the <head> so it moves on before the page draws.
(function () {
  var PAGES = ['bring-it-all-back', 'unlocked', 'tour-map', 'discography', 'setlists', 'podcasts'];
  var path = location.pathname.replace(/^\//, '');
  for (var i = 0; i < PAGES.length; i++) {
    var page = PAGES[i];
    if (path.length > page.length && path.indexOf(page) === 0 && !/[\/.]/.test(path.charAt(page.length))) {
      location.replace('/' + page + location.search + location.hash);
      return;
    }
  }
})();
