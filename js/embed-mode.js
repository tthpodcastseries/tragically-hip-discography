// embed-mode.js - when a game page is shown inside the Games page (/games, js/games.js),
// it drops what the Games page already gives it: the Home link, the footer, the sign-in bar,
// and the site menu. On its own, the page is untouched. Loaded in the <head> of each game page.
(function () {
  'use strict';
  var inArcade = false;
  try {
    inArcade = window.top !== window.self && /^\/games(\.html)?\/?$/.test(window.top.location.pathname);
  } catch (e) { inArcade = false; } // a frame from anywhere else can't be read, so nothing changes
  if (!inArcade) return;

  document.documentElement.classList.add('in-arcade');
  var css = document.createElement('style');
  css.textContent =
    'html.in-arcade, html.in-arcade body { min-height: 0 !important; height: auto !important; overflow: hidden; }' +
    'html.in-arcade .back-link, html.in-arcade .skip-link, html.in-arcade #site-footer,' +
    ' html.in-arcade #tth-signin-bar, html.in-arcade .site-nav { display: none !important; }' +
    'html.in-arcade .page-header { padding-top: 18px; }';
  document.head.appendChild(css);
  // Any link inside the game opens in the whole window, never inside the game box
  var base = document.createElement('base');
  base.target = '_top';
  document.head.appendChild(base);
})();
