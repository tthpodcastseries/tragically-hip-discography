// shuffle-machine.js - the two shuffle machines on the home page (v5.10, 'Scared'):
// Song Shuffle (decade, album, song) and Live Show Shuffle (year, place, venue).
// Each lands on its pick about 8 seconds after the press, with a drum roll that starts on the
// press and stops the moment the pick is revealed. The pick is made before anything moves:
// every song (or every show with a recording) has the same chance.
// Data: data/shuffle-pool.json (scripts/build-shuffle-pool.js). Styles: css/shuffle-machine.css.
// Kept on the device only: the sound on/off choice and the last pick (so it never comes up
// twice in a row). The streaming service a fan picks is shared with the album pages for that visit.
(function () {
  'use strict';

  var STOPS = [3.0, 5.5, 8.0]; // seconds until each reel lands
  var SPEED = 6;               // cells a second at full speed
  var EASE_A = 0.6, EASE_N = 3;
  var EASE_S = EASE_N / (1 - EASE_A + EASE_N * EASE_A);
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) STOPS = [0.35, 0.7, 1.05];

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };
  var isLocal = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) >= 0;
  var songHref = function (slug) { return isLocal ? '/song?s=' + slug : '/song/' + slug; };

  /* ---------- small helpers ---------- */
  function fairIndex(n) { // unbiased pick from 0..n-1
    if (window.crypto && crypto.getRandomValues) {
      var limit = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function any(list) { return list[Math.floor(Math.random() * list.length)]; }
  function uniq(list) { var seen = {}; return list.filter(function (x) { return seen[x] ? false : (seen[x] = true); }); }
  function filler(count, list, avoid) { // a run with no two alike in a row
    var out = [], last = avoid;
    for (var i = 0; i < count; i++) {
      var pick = any(list), tries = 0;
      while (pick === last && list.length > 1 && tries++ < 8) pick = any(list);
      out.push(pick); last = pick;
    }
    return out;
  }
  function without(list, x, fallback) {
    var f = list.filter(function (v) { return v !== x; });
    return f.length ? f : (fallback || []).filter(function (v) { return v !== x; });
  }
  function ease(u) {
    if (u < EASE_A) return EASE_S * u;
    var v = (u - EASE_A) / (1 - EASE_A);
    return EASE_S * EASE_A + (1 - EASE_S * EASE_A) * (1 - Math.pow(1 - v, EASE_N));
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- sound (made in the browser, no audio files) ---------- */
  var ctx = null, out = null, noiseBuf = null;
  var soundOn = store.get('hh_shuffle_sound') !== 'off';
  function audio() {
    if (!soundOn) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
      var squash = ctx.createDynamicsCompressor(); squash.connect(ctx.destination);
      out = ctx.createGain(); out.gain.value = 0.8; out.connect(squash);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function toneAt(t, freq, dur, type, vol, slideTo, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || out); o.start(t); o.stop(t + dur + 0.02);
  }
  function tone(freq, dur, type, vol, when) { if (ctx && soundOn) toneAt(ctx.currentTime + (when || 0), freq, dur, type, vol); }
  function noiseAt(t, dur, vol, highpass, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = highpass;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function snareAt(t, vol, dest) { noiseAt(t, 0.075, vol, 900, dest); toneAt(t, 190, 0.05, 'triangle', vol * 0.5, 150, dest); }
  var lastTick = 0;
  function tick() {
    var now = performance.now();
    if (now - lastTick < 38) return;
    lastTick = now; tone(1500, 0.025, 'square', 0.025);
  }
  function clunk() { if (!ctx || !soundOn) return; toneAt(ctx.currentTime, 150, 0.16, 'triangle', 0.3, 60); tone(700, 0.04, 'square', 0.05); }
  function ratchet() { for (var i = 0; i < 6; i++) tone(420 - i * 30, 0.03, 'square', 0.06, i * 0.035); }
  function bell() {
    [0, 0.16, 0.32, 0.48, 0.8, 0.96].forEach(function (t, i) {
      tone(i % 2 ? 1318.5 : 1046.5, 0.5, 'sine', 0.16, t);
      tone(i % 2 ? 2637 : 2093, 0.3, 'sine', 0.05, t);
    });
  }
  // The drum roll: starts on the press, builds, and is cut the moment the pick is revealed.
  function Roll(seconds) {
    if (!ctx || !soundOn || calm) return;
    var self = this, t0 = ctx.currentTime + 0.01;
    this.t0 = t0; this.end = t0 + seconds; this.n = 0;
    this.bus = ctx.createGain(); this.bus.connect(out);
    snareAt(t0, 0.34, this.bus); toneAt(t0, 110, 0.18, 'sine', 0.45, 60, this.bus); // the opening hit
    this.next = t0 + 0.05;
    this.timer = setInterval(function () { self.pump(); }, 25); this.pump();
  }
  Roll.prototype.pump = function () {
    if (!this.bus) return;
    var horizon = ctx.currentTime + 0.08;
    while (this.next < horizon) {
      var u = Math.min(1, (this.next - this.t0) / (this.end - this.t0));
      var vol = 0.18 + 0.1 * u * u + (this.n % 2 ? 0 : 0.02);
      snareAt(this.next, vol * (0.85 + Math.random() * 0.3), this.bus);
      this.next += (1 / (20 + 12 * u)) * (0.94 + Math.random() * 0.12);
      this.n++;
    }
  };
  Roll.prototype.stop = function () {
    if (!this.bus) return;
    clearInterval(this.timer);
    var bus = this.bus, t = ctx.currentTime; this.bus = null;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(1, t); bus.gain.linearRampToValueAtTime(0.0001, t + 0.03);
    setTimeout(function () { bus.disconnect(); }, 200);
  };

  /* ---------- streaming links (same services and preference as the album pages) ---------- */
  var SERVICES = [
    ['apple', 'Apple Music', function (q) { return 'https://music.apple.com/search?term=' + q; }],
    ['spotify', 'Spotify', function (q) { return 'https://open.spotify.com/search/' + q; }],
    ['amazon', 'Amazon Music', function (q) { return 'https://music.amazon.com/search/' + q; }],
    ['tidal', 'Tidal', function (q) { return 'https://tidal.com/search?q=' + q; }],
    ['youtube', 'YouTube Music', function (q) { return 'https://music.youtube.com/search?q=' + q; }]
  ];
  function preferredStream() { try { return sessionStorage.getItem('tth_preferred_stream') || ''; } catch (e) { return ''; } }
  function streamLinks(title) {
    var q = encodeURIComponent(title + ' The Tragically Hip'), pref = preferredStream();
    var list = SERVICES.slice();
    list.sort(function (a, b) { return (b[0] === pref) - (a[0] === pref); });
    return list.map(function (s) {
      var a = el('a', 'sm-link' + (s[0] === pref ? ' preferred' : ''), s[1]);
      a.href = s[2](q); a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.addEventListener('click', function () { try { sessionStorage.setItem('tth_preferred_stream', s[0]); } catch (e) { /* storage blocked */ } });
      return a;
    });
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) { var p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }

  /* ---------- what each machine spins ---------- */
  var KINDS = {
    song: {
      title: 'Song Shuffle',
      labels: ['Decade', 'Album', 'Song'],
      kicker: 'Yer song',
      idle: 'Hit shuffle to spin one.',
      count: function (n) { return 'Spin one of ' + n + ' songs from the catalogue'; },
      items: function (pool) {
        return pool.songs.map(function (s) { return { key: s[3], r: [Math.floor(s[2] / 10) * 10 + 's', s[1], s[0]], t: s[0], a: s[1], y: s[2], slug: s[3] }; });
      },
      show: function (item, main, detail, actions) {
        main.textContent = "'" + item.t + "'";
        detail.textContent = 'From "' + item.a + '" (' + item.y + ')';
        var page = el('a', 'sm-link', 'Song page'); page.href = songHref(item.slug);
        actions.appendChild(page);
        streamLinks(item.t).forEach(function (a) { actions.appendChild(a); });
      }
    },
    show: {
      title: 'Live Show Shuffle',
      labels: ['Year', 'Place', 'Venue'],
      kicker: 'Yer show',
      idle: 'Hit shuffle to spin one.',
      count: function (n) { return 'Play one of ' + n + ' live recordings'; },
      items: function (pool) {
        return pool.shows.map(function (s) { return { key: s[0], r: [s[1].slice(0, 4), s[2], s[3] || 'Venue not on record'], id: s[0], iso: s[1], place: s[2], venue: s[3] }; });
      },
      show: function (item, main, detail, actions) {
        main.textContent = item.venue || item.place;
        detail.textContent = longDate(item.iso) + (item.venue ? ' - ' + item.place : '');
        var play = el('a', 'sm-link play', 'Play this show'); play.href = 'tour-map.html#play=' + encodeURIComponent(item.id);
        actions.appendChild(play);
      }
    }
  };

  /* ---------- one machine ---------- */
  function Machine(root, kind, items) {
    var K = KINDS[kind], self = this;
    this.K = K; this.items = items; this.kind = kind; this.spinning = false;
    this.lastKey = store.get('hh_shuffle_last_' + kind);

    var body = el('div', 'sm-body');
    var cab = el('div', 'sm-cab');
    var bulbs = el('div', 'sm-bulbs'); bulbs.setAttribute('aria-hidden', 'true');
    this.bulbs = [];
    for (var i = 0; i < 9; i++) { var b = el('i'); bulbs.appendChild(b); this.bulbs.push(b); }
    cab.appendChild(bulbs);
    var h = el('h3', 'sm-title', K.title); cab.appendChild(h);
    cab.appendChild(el('p', 'sm-sub', K.count(items.length)));

    var win = el('div', 'sm-window'); win.setAttribute('aria-hidden', 'true');
    win.appendChild(el('div', 'sm-pointer l'));
    this.reels = K.labels.map(function (label) {
      var col = el('div', 'sm-col');
      col.appendChild(el('div', 'sm-label', label));
      var reel = el('div', 'sm-reel'), wrap = el('div', 'sm-strip-wrap'), strip = el('div', 'sm-strip');
      wrap.appendChild(strip); reel.appendChild(wrap); col.appendChild(reel); win.appendChild(col);
      return { el: reel, strip: strip, shown: ['?', '?', '?'] };
    });
    win.appendChild(el('div', 'sm-pointer r'));
    cab.appendChild(win);

    var res = el('div', 'sm-result idle'); res.setAttribute('aria-live', 'polite');
    this.res = res;
    this.kickerEl = el('div', 'sm-kicker', K.kicker);
    this.mainEl = el('div', 'sm-main', K.idle);
    this.detailEl = el('div', 'sm-detail');
    this.actionsEl = el('div', 'sm-actions');
    res.appendChild(this.kickerEl); res.appendChild(this.mainEl); res.appendChild(this.detailEl); res.appendChild(this.actionsEl);
    cab.appendChild(res);

    var controls = el('div', 'sm-controls');
    this.go = el('button', 'sm-go', 'Shuffle'); this.go.type = 'button';
    this.go.setAttribute('aria-label', 'Shuffle: spin a ' + (kind === 'song' ? 'song' : 'live show'));
    this.sound = el('button', 'sm-sound'); this.sound.type = 'button';
    controls.appendChild(this.go); controls.appendChild(this.sound);
    cab.appendChild(controls);
    body.appendChild(cab);

    this.lever = el('div', 'sm-lever'); this.lever.setAttribute('aria-hidden', 'true');
    this.lever.appendChild(el('div', 'mount')); this.lever.appendChild(el('div', 'arm')); this.lever.appendChild(el('div', 'knob'));
    body.appendChild(this.lever);

    var fallback = root.querySelector('.sm-fallback');
    root.appendChild(body);
    if (fallback) fallback.hidden = true;

    this.reels.forEach(function (r) { self.paint(r, r.shown); self.place(r, 1); });
    this.drawSound();

    // The press itself starts everything (a click fires on release, a beat late).
    var press = function (e) { if (e.button === 0) { e.preventDefault(); self.spin(); } };
    this.go.addEventListener('pointerdown', press);
    this.lever.addEventListener('pointerdown', press);
    this.go.addEventListener('click', function (e) { if (e.detail === 0) self.spin(); }); // Enter or Space
    this.sound.addEventListener('click', function () {
      soundOn = !soundOn; store.set('hh_shuffle_sound', soundOn ? 'on' : 'off');
      machines.forEach(function (m) { m.drawSound(); });
    });
    this.lightMode = 'idle'; this.lightStep = 0;
    setInterval(function () { self.lights(); }, 110);
  }

  Machine.prototype.drawSound = function () {
    this.sound.textContent = soundOn ? 'Sound on' : 'Sound off';
    this.sound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  };
  Machine.prototype.lights = function () {
    var mode = this.lightMode, step = ++this.lightStep;
    if (calm && mode !== 'idle') mode = 'still';
    this.bulbs.forEach(function (b, i) {
      var on;
      if (mode === 'spin') on = (i + step) % 3 === 0;
      else if (mode === 'win') on = step % 2 === 0;
      else if (mode === 'still') on = true;
      else on = (i + Math.floor(step / 6)) % 2 === 0;
      b.classList.toggle('on', on);
    });
  };
  Machine.prototype.cellPx = function (reel) { return reel.el.clientHeight / 3 || 54; };
  Machine.prototype.paint = function (reel, cells) {
    reel.strip.textContent = '';
    cells.forEach(function (text) {
      var d = el('div', 'sm-cell' + (text === '?' ? ' q' : (text.length > 34 ? ' l3' : (text.length > 22 ? ' l2' : ''))), text);
      reel.strip.appendChild(d);
    });
    reel.tilted = [];
  };
  Machine.prototype.place = function (reel, centre) {
    var cell = this.cellPx(reel);
    reel.strip.style.transform = 'translateY(' + (-(centre - 1) * cell) + 'px)';
    // The rows above and below the payline squash, so the reel reads as a drum (never slanted)
    var cells = reel.strip.children, first = Math.max(0, Math.floor(centre) - 2), last = Math.min(cells.length - 1, Math.ceil(centre) + 2);
    (reel.tilted || []).forEach(function (k) { if ((k < first || k > last) && cells[k]) cells[k].style.removeProperty('--tilt'); });
    reel.tilted = [];
    for (var i = first; i <= last; i++) {
      var off = Math.max(-1.6, Math.min(1.6, i - centre));
      cells[i].style.setProperty('--tilt', (1 - 0.3 * Math.abs(off)).toFixed(3));
      reel.tilted.push(i);
    }
  };
  Machine.prototype.spinReel = function (reel, seconds, run, target, near, done) {
    var self = this;
    // cells[1] is where it lands; the last three cells are what shows now, so nothing jumps
    var cells = [near[0], target, near[1]].concat(run.slice().reverse()).concat(reel.shown);
    this.paint(reel, cells);
    var from = cells.length - 2, start = performance.now(), lastWhole = from;
    this.place(reel, from);
    function frame(now) {
      var u = Math.min(1, (now - start) / (seconds * 1000));
      var pos = from - (from - 1) * ease(u);
      self.place(reel, pos);
      var whole = Math.round(pos);
      if (whole !== lastWhole) { lastWhole = whole; tick(); }
      if (u < 1) { requestAnimationFrame(frame); return; }
      reel.shown = [cells[0], cells[1], cells[2]];
      self.paint(reel, reel.shown); self.place(reel, 1);
      reel.el.classList.remove('thunk'); void reel.el.offsetWidth; reel.el.classList.add('thunk');
      clunk(); done();
    }
    requestAnimationFrame(frame);
  };
  Machine.prototype.spin = function () {
    if (this.spinning) return;
    var self = this;
    this.spinning = true; this.go.disabled = true;
    audio();
    this.roll = new Roll(STOPS[2]);
    ratchet();
    this.lever.classList.remove('back'); this.lever.style.setProperty('--pull', 1);
    setTimeout(function () { self.lever.classList.add('back'); self.lever.style.setProperty('--pull', 0); }, 260);
    this.res.classList.add('idle'); this.res.classList.remove('pop');
    this.kickerEl.textContent = this.K.kicker;
    this.mainEl.textContent = '. . .'; this.detailEl.textContent = ''; this.actionsEl.textContent = '';
    this.reels.forEach(function (r) { r.el.classList.remove('win'); });
    this.lightMode = 'spin';

    // The pick is made here, before anything moves. Never the same one twice in a row.
    var pool = this.items.filter(function (it) { return it.key !== self.lastKey; });
    if (!pool.length) pool = this.items;
    var pick = pool[fairIndex(pool.length)];
    var all = this.items;
    var col = function (list, i) { return uniq(list.map(function (it) { return it.r[i]; })); };
    var inFirst = all.filter(function (it) { return it.r[0] === pick.r[0]; });
    var inSecond = inFirst.filter(function (it) { return it.r[1] === pick.r[1]; });
    var run = function (seconds) { return Math.max(6, Math.round(SPEED * seconds / EASE_S)); };
    var near = function (list, x, fallback) {
      var p = without(list, x, fallback);
      if (!p.length) return [x, x];
      var a = any(p), rest = p.filter(function (v) { return v !== a; });
      return [a, rest.length ? any(rest) : a];
    };
    // Each reel runs through everything, then slows through the part the reel before it landed on
    var all0 = col(all, 0), all1 = col(all, 1), all2 = col(all, 2);
    var narrow1 = col(inFirst, 1), narrow2 = col(inSecond, 2), wide2 = col(inFirst, 2);
    var n1 = run(STOPS[1]), n2 = run(STOPS[2]);
    var run0 = filler(run(STOPS[0]), all0, pick.r[0]);
    var run1 = filler(n1 - 6, all1).concat(filler(6, without(narrow1, pick.r[1], all1), pick.r[1]));
    var run2 = filler(n2 - 8, all2).concat(filler(8, without(narrow2, pick.r[2], wide2.length > 1 ? wide2 : all2), pick.r[2]));
    var left = 3, landed = function () { if (--left === 0) self.finish(pick); };
    this.spinReel(this.reels[0], STOPS[0], run0, pick.r[0], near(all0, pick.r[0], all0), landed);
    this.spinReel(this.reels[1], STOPS[1], run1, pick.r[1], near(narrow1, pick.r[1], all1), landed);
    this.spinReel(this.reels[2], STOPS[2], run2, pick.r[2], near(narrow2, pick.r[2], wide2.length > 1 ? wide2 : all2), landed);
  };
  Machine.prototype.finish = function (pick) {
    var self = this;
    // The pick shows first; on the same beat the drums stop and the bell rings
    this.actionsEl.textContent = '';
    this.K.show(pick, this.mainEl, this.detailEl, this.actionsEl);
    this.res.classList.remove('idle'); void this.res.offsetWidth; this.res.classList.add('pop');
    if (this.roll) { this.roll.stop(); this.roll = null; }
    bell();
    this.lightMode = 'win';
    this.reels.forEach(function (r) { r.el.classList.add('win'); });
    this.lastKey = pick.key; store.set('hh_shuffle_last_' + this.kind, pick.key);
    setTimeout(function () { self.lightMode = 'idle'; self.spinning = false; self.go.disabled = false; }, calm ? 400 : 1800);
  };

  /* ---------- start ---------- */
  var machines = [];
  var roots = document.querySelectorAll('.sm[data-kind]');
  if (!roots.length || !window.fetch) return;
  fetch('/data/shuffle-pool.json').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (pool) {
    Array.prototype.forEach.call(roots, function (root) {
      var kind = root.getAttribute('data-kind');
      if (!KINDS[kind]) return;
      var items = KINDS[kind].items(pool);
      if (items.length) machines.push(new Machine(root, kind, items));
    });
  }).catch(function () { /* the plain links stay, so the shuffle still works */ });
})();
