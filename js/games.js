// games.js - the Games page (/games, v5.11 'An Inch an Hour'): all five games on one page,
// one tab each, so fans can play them in a row without going home in between.
// Each game runs in its own frame (its own page, its own saved game), stripped down by
// js/embed-mode.js. A tab's status (Done, Started, New) is read from the game's saved game on
// this device and never written. Styles: css/games.css.
(function () {
  'use strict';

  // Start dates and saved-game keys, as in each game's own script (scripts/audit-site.js fails if they drift)
  var GAMES = [
    { id: 'bring-it-all-back', name: 'Bring It All Back', kind: 'Daily Setlist Game', key: 'tth_bia_v2', epoch: '2026-10-30', step: 1 },
    { id: 'unlocked', name: '(Un)Locked', kind: 'Daily Lyrics Game', key: 'tth_unlocked_v1', epoch: '2026-11-02', step: 1 },
    { id: 'little-bones', name: 'Little Bones', kind: 'Daily Live Clip Game', key: 'tth_littlebones_v1', epoch: '2026-11-16', step: 1 },
    { id: 'are-we-family', name: 'Are We Family', kind: 'Weekly Grouping Game', key: 'tth_family_v1', epoch: '2026-11-21', step: 7 },
    { id: 'words-into-birds', name: 'Words Into Birds', kind: 'Weekly Crossword', key: 'tth_birds_v1', epoch: '2026-11-21', step: 7 }
  ];

  var host = document.getElementById('arcade');
  if (!host) return;

  /* ---------- today's status for each game ---------- */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var clock = null;
  try { clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'numeric', day: 'numeric' }); } catch (e) { clock = null; }
  // The games change at midnight in Toronto, so the day is counted on Toronto's clock
  function torontoDay() {
    var now = new Date();
    if (!clock || !clock.formatToParts) return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    var p = {};
    clock.formatToParts(now).forEach(function (x) { p[x.type] = x.value; });
    return Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000);
  }
  function dayOf(iso) { var q = iso.split('-'); return Math.floor(Date.UTC(+q[0], +q[1] - 1, +q[2]) / 86400000); }
  function saved(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
  function played(t) { return !!(t && (t.started || (t.guesses && t.guesses.length) || (t.solved && t.solved.length))); }
  function status(g) {
    var today = torontoDay(), start = dayOf(g.epoch);
    if (today < start) {
      var d = new Date(start * 86400000);
      return { text: start - today < 7 ? 'Opens ' + DAYS[d.getUTCDay()] : 'Opens ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(), cls: 'soon' };
    }
    var no = g.step === 1 ? today - start + 1 : Math.floor((today - start) / g.step) + 1;
    var s = saved(g.key), t = s && s.today;
    if (t && t.no === no && t.done) return { text: 'Done', cls: 'done' };
    if (t && t.no === no && played(t)) return { text: 'Started', cls: 'started' };
    if (t && t.no === no - 1 && !t.done && played(t)) return { text: 'Started', cls: 'started' }; // the game keeps a half-played one going
    return { text: g.step === 1 ? 'New today' : 'New this week', cls: 'new' };
  }

  /* ---------- the tabs and the games ---------- */
  var tabs = document.createElement('div');
  tabs.className = 'arcade-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'The five games');
  var panels = document.createElement('div');
  panels.className = 'arcade-panels';

  GAMES.forEach(function (g, i) {
    var tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'arcade-tab'; tab.id = 'tab-' + g.id;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'panel-' + g.id);
    tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
    var name = document.createElement('span'); name.className = 'at-name'; name.textContent = g.name;
    var kind = document.createElement('span'); kind.className = 'at-kind'; kind.textContent = g.kind;
    var chip = document.createElement('span'); chip.className = 'at-status';
    tab.appendChild(name); tab.appendChild(kind); tab.appendChild(chip);
    tab.addEventListener('click', function () { open(i, true); });
    tabs.appendChild(tab);

    var panel = document.createElement('section');
    panel.className = 'arcade-panel'; panel.id = 'panel-' + g.id; panel.hidden = true;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-' + g.id);
    panels.appendChild(panel);
    g.tab = tab; g.chip = chip; g.panel = panel; g.frame = null;
  });

  // Arrow keys move along the tabs, Home and End jump to the ends
  tabs.addEventListener('keydown', function (e) {
    var at = current, to = null;
    if (e.key === 'ArrowRight') to = (at + 1) % GAMES.length;
    else if (e.key === 'ArrowLeft') to = (at - 1 + GAMES.length) % GAMES.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = GAMES.length - 1;
    if (to === null) return;
    e.preventDefault(); open(to, true); GAMES[to].tab.focus();
  });

  function drawStatus() {
    GAMES.forEach(function (g) {
      var s = status(g);
      g.chip.textContent = s.text;
      g.chip.className = 'at-status ' + s.cls;
      g.tab.setAttribute('aria-label', g.name + ', ' + g.kind + ': ' + s.text);
    });
  }

  /* ---------- each game's frame grows to fit the game, so the page scrolls as one ---------- */
  function fit(g) {
    var f = g.frame;
    if (!f || g.panel.hidden) return;
    try {
      var doc = f.contentDocument;
      if (!doc || !doc.body || !doc.documentElement.classList.contains('in-arcade')) return; // wait for embed mode
      // The game's own height: where its content ends. (The page's scroll height can't be used:
      // it is never less than the frame, so a frame could grow but never shrink back.)
      var cs = doc.defaultView.getComputedStyle(doc.body);
      var h = Math.ceil(doc.body.getBoundingClientRect().bottom + (parseFloat(cs.marginBottom) || 0));
      if (h > 0 && Math.abs(h - f.offsetHeight) > 2) f.style.height = h + 'px';
    } catch (e) { /* not ours to read: leave it at its default height */ }
  }
  function load(g) {
    if (g.frame) return;
    var f = document.createElement('iframe');
    f.className = 'arcade-frame';
    f.title = g.name + ' - ' + g.kind;
    f.src = '/' + g.id;
    f.addEventListener('load', function () {
      fit(g);
      try {
        var w = f.contentWindow;
        if (w.ResizeObserver) new w.ResizeObserver(function () { fit(g); }).observe(f.contentDocument.body);
      } catch (e) { /* the timer below still keeps it fitted */ }
    });
    g.panel.appendChild(f);
    g.frame = f;
  }
  setInterval(function () { GAMES.forEach(fit); }, 800);

  var current = -1;
  function open(i, fromTab) {
    var g = GAMES[i];
    GAMES.forEach(function (x, j) {
      var on = j === i;
      x.tab.setAttribute('aria-selected', on ? 'true' : 'false');
      x.tab.tabIndex = on ? 0 : -1;
      x.panel.hidden = !on;
    });
    current = i;
    load(g);
    fit(g);
    drawStatus();
    if (fromTab) {
      try { history.replaceState(null, '', location.pathname + location.search + '#' + g.id); } catch (e) { /* noop */ }
      // Bring the game's top into view if the page has scrolled down into the last one
      var top = host.getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > top) window.scrollTo(0, top);
    }
    // Keep the chosen tab in view on a phone, where the tabs scroll sideways
    if (g.tab.scrollIntoView && tabs.scrollWidth > tabs.clientWidth) {
      var l = g.tab.offsetLeft, r = l + g.tab.offsetWidth;
      if (l < tabs.scrollLeft || r > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = Math.max(0, l - 16);
    }
  }

  host.appendChild(tabs);
  host.appendChild(panels);
  var fallback = document.getElementById('arcadeFallback');
  if (fallback) fallback.hidden = true;

  // A game's tab updates the moment that game saves (each game writes to this device's storage)
  window.addEventListener('storage', function (e) {
    if (GAMES.some(function (g) { return g.key === e.key; })) drawStatus();
  });
  setInterval(drawStatus, 30000); // and at midnight, when new puzzles arrive

  function fromHash() {
    var id = (location.hash || '').replace('#', '');
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return i;
    return -1;
  }
  window.addEventListener('hashchange', function () { var i = fromHash(); if (i >= 0 && i !== current) open(i, false); });

  // Start on the game in the address, else the first one not done today
  drawStatus();
  var first = fromHash();
  if (first < 0) {
    for (var k = 0; k < GAMES.length; k++) { var s = status(GAMES[k]); if (s.cls === 'new' || s.cls === 'started') { first = k; break; } }
  }
  open(first < 0 ? 0 : first, false);
})();
