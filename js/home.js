// home.js - The Hip Handbook home page (moved out of index.html in v5.4.17 so the
// security policy can block inline scripts, audit SEC-03)
// Escape data and visitor text before it goes into innerHTML
function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

(async function() {
  // Both boxes show from the first paint with placeholder text, so nothing jumps
  // when the data arrives (audit PERF-06); on a failed load they go away
  function hideToday() {
    document.getElementById('onThisDay').hidden = true;
    document.getElementById('sotd').hidden = true;
  }
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('onThisDayTitle').textContent = 'On This Day - ' + MONTH_NAMES[new Date().getMonth()] + ' ' + new Date().getDate();

  // Start the On This Day download now instead of after discography.json
  const otdPromise = fetch('data/on-this-day.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });

  // ─── Load discography data ───
  let discographyData = null;
  try {
    const resp = await fetch('data/discography.json');
    if (resp.ok) discographyData = await resp.json();
  } catch (e) { console.error('Failed to load discography data:', e); }

  if (!discographyData) { hideToday(); return; }

  const albums = discographyData.albums;
  const milestones = discographyData.milestones;

  // ─── On This Day ───
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const events = [];
  let allSetlists = []; // kept for Show of the Day

  // Check album release dates
  for (const a of albums) {
    if (!a.releaseDate) continue;
    const match = a.releaseDate.match(/^(\w+)\s+(\d+),\s+(\d{4})$/);
    if (match) {
      const mIdx = MONTHS.indexOf(match[1]) + 1;
      const d = parseInt(match[2]);
      if (mIdx === todayMonth && d === todayDay) {
        events.push({ year: parseInt(match[3]), tag: 'release', desc: '<b>' + esc(a.title) + '</b> (' + esc(a.type) + ') released.' });
      }
    }
  }

  // Check milestones
  for (const m of milestones) {
    if (m.month === todayMonth && m.day === todayDay) {
      events.push({ year: m.year, tag: 'milestone', desc: esc(m.desc) });
    }
  }

  // Check for concerts on this day. data/on-this-day.json (scripts/build-light-data.js) has
  // every show without its setlist, so phones skip the 2 MB setlist file (audit PERF-03).
  // Shows flagged in data/setlist-corrections.json have a guessed date and aren't in it.
  try {
    const setData = await otdPromise;
    {
      if (setData && setData.shows) {
        allSetlists = setData.shows;
        const dayStr = String(todayDay).padStart(2, '0');
        const monthStr = String(todayMonth).padStart(2, '0');
        const matches = setData.shows.filter(function(s) {
          const parts = s.date.split('-');
          return parts[0] === dayStr && parts[1] === monthStr;
        });
        for (const s of matches) {
          const yr = parseInt(s.date.split('-')[2]);
          const venue = s.venue || 'Unknown venue';
          const city = s.city || '';
          const state = s.state || '';
          const loc = [city, state, s.country].filter(Boolean).join(', ');
          const songCount = s.songCount;
          const tourInfo = s.tour ? ' (' + window.tthAlbumCase(s.tour) + ')' : '';
          const noSetlist = !songCount ? ' <span style="color:var(--muted);font-style:italic;font-size:0.75rem;">(no setlist available)</span>' : '';
          const hasVideo = !!s.video;
          // Only link when the tour map can actually show something (gigs span 1985-2016)
          const linkable = !!s.id && yr >= 1985 && yr <= 2016 && (songCount > 0 || hasVideo);
          events.push({ year: yr, tag: 'show', desc: 'Live at <b>' + esc(venue) + '</b>, ' + esc(loc) + esc(tourInfo) + (songCount ? ' - ' + songCount + ' songs' : '') + noSetlist, showId: linkable ? s.id : null, hasVideo: hasVideo });
        }
      }
    }
  } catch (e) { /* setlist data may not be available */ }

  events.sort(function(a, b) { return a.year - b.year; });

  const container = document.getElementById('onThisDayEvents');
  const wrapper = document.getElementById('onThisDay');
  const titleEl = document.getElementById('onThisDayTitle');
  titleEl.textContent = 'On This Day - ' + MONTHS[todayMonth - 1] + ' ' + todayDay;

  if (events.length === 0) {
    container.innerHTML = '<div class="otd-empty">No known events for The Hip on this date.</div>';
  } else {
    container.innerHTML = events.map(function(e) {
      var inner = '<span class="otd-year">' + e.year + '</span><span class="otd-desc"><span class="otd-tag otd-tag-' + e.tag + '">' + e.tag + '</span> ' + e.desc + (e.showId ? ' <span class="otd-view">' + (e.hasVideo ? '🎬 ' : '') + 'View show →</span>' : '') + '</span>';
      if (e.showId) {
        return '<a class="otd-event" href="tour-map.html#show=' + e.showId + '" title="Open this show on the Interactive Tour Map">' + inner + '</a>';
      }
      return '<div class="otd-event">' + inner + '</div>';
    }).join('');
  }
  wrapper.classList.remove('otd-loading');

  // ─── Show of the Day (v5) ───
  // One recorded show per day, the same for everyone: a show played on today's
  // date if the Hip Archive has one, otherwise a stepped walk through all of
  // the recordings so consecutive days jump around without repeating for ~614 days.
  try {
    const recorded = allSetlists.filter(function(s) { return s.rec; })
      .sort(function(a, b) { return a.id < b.id ? -1 : 1; });
    if (recorded.length) {
      const dayNumber = Math.floor(Date.UTC(now.getFullYear(), todayMonth - 1, todayDay) / 86400000);
      const dd = String(todayDay).padStart(2, '0'), mm = String(todayMonth).padStart(2, '0');
      const onThisDate = recorded.filter(function(s) { const p = s.date.split('-'); return p[0] === dd && p[1] === mm; })
        .sort(function(a, b) { return a.date.split('-')[2] - b.date.split('-')[2]; });
      const pick = onThisDate.length ? onThisDate[dayNumber % onThisDate.length] : recorded[(dayNumber * 7919) % recorded.length];
      const pp = pick.date.split('-');
      const songCount = pick.namedCount != null ? pick.namedCount : pick.songCount;
      const loc = [pick.city, pick.state, pick.country].filter(Boolean).join(', ');
      document.getElementById('sotdVenue').textContent = pick.venue || 'A show by The Hip';
      document.getElementById('sotdMeta').textContent = [new Date(+pp[2], +pp[1] - 1, +pp[0]).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }), loc, pick.tour, songCount ? songCount + ' songs' : ''].filter(Boolean).join(' \u00b7 ');
      document.getElementById('sotdWhy').textContent = onThisDate.length ? 'Played on this day in ' + pp[2] + '.' : 'Today\'s pick from The Tragically Hip Archive.';
      document.getElementById('sotdPlay').href = 'tour-map.html#play=' + encodeURIComponent(pick.id);
    } else {
      document.getElementById('sotd').hidden = true;
    }
  } catch (e) { document.getElementById('sotd').hidden = true; /* Show of the Day is optional */ }

  // ─── Universal Search (albums, songs, lyrics, shows) ───
  var albumIndex = albums.map(function(a) {
    return { title: a.title, year: a.year, type: a.type, category: a.category };
  });

  // Lazy-loaded data
  var lyricsData = null;
  var tourData = null;
  var setlistData = null;
  var setlistLookup = {};
  var songPages = null; // title key -> { s: slug, t: title }, from data/song-index.json (v5.1 song pages)
  var searchDebounce = null;
  var songKey = function(t) { return String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); };
  // The local preview server has no rewrites, so there song.html takes ?s=<slug>
  var songHref = function(slug) { return ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) >= 0 ? '/song?s=' + slug : '/song/' + slug; };

  async function loadSearchData() {
    if (!songPages) {
      try {
        const r = await fetch('data/song-index.json');
        if (r.ok) {
          songPages = {};
          (await r.json()).songs.forEach(function(s) { songPages[songKey(s.t)] = s; });
        }
      } catch(e) {}
    }
    if (!lyricsData) {
      try { const r = await fetch('data/lyrics.json'); if (r.ok) lyricsData = await r.json(); } catch(e) {}
    }
    if (!tourData) {
      // The tour map's light file (no track lists); tracks come from tour-tracks.json when a show is opened
      try { const r = await fetch('data/tour-map.json'); if (r.ok) tourData = await r.json(); } catch(e) {}
    }
    if (!setlistData) {
      try {
        const r = await fetch('data/setlists.min.json');
        if (r.ok) {
          setlistData = await r.json();
          if (setlistData.setlists) {
            setlistData.setlists.forEach(function(s) { setlistLookup[s.id] = s; });
          }
        }
      } catch(e) {}
    }
  }

  // Folded text (tthFold in shared-footer.js): straight and curly apostrophes and accents all match.
  // Remembered, because the same song names are checked on every keystroke.
  var foldMemo = new Map();
  function fold(text) {
    var v = foldMemo.get(text);
    if (v === undefined) { v = window.tthFold(text); foldMemo.set(text, v); }
    return v;
  }

  function universalSearch(query) {
    if (!query || query.length < 2) return { albums: [], songs: [], lyrics: [], shows: [], livePerformances: [] };
    var q = window.tthFold(query);
    if (q.length < 2) return { albums: [], songs: [], lyrics: [], shows: [], livePerformances: [] };
    var results = { albums: [], songs: [], lyrics: [], shows: [], livePerformances: [] };

    // Albums
    albumIndex.forEach(function(a) {
      if (fold(a.title).includes(q)) {
        results.albums.push(a);
      }
    });
    results.albums.sort(function(a, b) {
      return (fold(a.title).startsWith(q) ? 0 : 1) - (fold(b.title).startsWith(q) ? 0 : 1) || a.title.localeCompare(b.title);
    });
    results.albums = results.albums.slice(0, 5);

    // Songs (from album track lists in discographyData)
    var albumsList = discographyData && discographyData.albums ? discographyData.albums : discographyData;
    if (albumsList && Array.isArray(albumsList)) {
      var seenSongs = new Set();
      albumsList.forEach(function(a) {
        if (a.tracks) a.tracks.forEach(function(t) {
          var name = typeof t === 'string' ? t : (t && t.title);
          if (name && fold(name).includes(q) && !seenSongs.has(name)) {
            // A song with its own page appears once, however many releases and versions it is on
            var page = songPages && songPages[songKey(name.replace(/\s*\((Live|Demo|Alternate Version)\)\s*$/i, ''))];
            var dedupeKey = page ? 'page:' + page.s : name;
            if (seenSongs.has(dedupeKey)) return;
            seenSongs.add(name);
            seenSongs.add(dedupeKey);
            results.songs.push(page ? { title: page.t, album: a.title, category: a.category, slug: page.s } : { title: name, album: a.title, category: a.category });
          }
        });
      });
      results.songs = results.songs.slice(0, 5);
    }

    // Lyrics
    if (lyricsData && lyricsData.songs) {
      Object.entries(lyricsData.songs).forEach(function(entry) {
        if (results.lyrics.length >= 3) return;
        var key = entry[0], text = entry[1];
        if (typeof text === 'string' && fold(text).includes(q)) {
          var parts = key.split('|||');
          // Find the match in the folded text, then map it back onto the original wording for the snippet
          var f = window.tthFoldMap(text);
          var idx = f.s.indexOf(q);
          var mStart = f.map[idx], mEnd = f.map[idx + q.length - 1] + 1;
          var start = Math.max(0, mStart - 30);
          results.lyrics.push({
            song: parts[1] || key, album: parts[0] || '', query: q,
            pre: (start > 0 ? '...' : '') + text.slice(start, mStart).replace(/\n/g, ' '),
            match: text.slice(mStart, mEnd).replace(/\n/g, ' '),
            post: text.slice(mEnd, mEnd + 40).replace(/\n/g, ' ') + '...'
          });
        }
      });
    }

    // Shows (by venue/city/date)
    if (tourData) {
      tourData.forEach(function(g) {
        if (results.shows.length >= 5) return;
        var haystack = fold([g.venue, g.city, g.state].concat(window.tthDateForms(g.isoDate)).filter(Boolean).join(' '));
        if (haystack.includes(q)) {
          results.shows.push(g);
        }
      });
    }

    // Live Performances (shows where a song was played)
    if (setlistData && setlistData.setlists && tourData) {
      var tourLookup = {};
      tourData.forEach(function(g) { tourLookup[g.id] = g; });
      setlistData.setlists.forEach(function(s) {
        if (results.livePerformances.length >= 5) return;
        var played = s.songs && s.songs.some(function(sg) { return fold(sg.name).includes(q); });
        if (played && tourLookup[s.id]) {
          results.livePerformances.push(tourLookup[s.id]);
        }
      });
    }

    return results;
  }

  var searchInput = document.getElementById('songSearchInput');
  var searchDropdown = document.getElementById('songSearchDropdown');
  var activeIdx = -1;

  function renderUniversalDropdown(results, query) {
    searchDropdown.innerHTML = '';
    var hasResults = false;

    // Albums
    if (results.albums.length) {
      hasResults = true;
      var label = document.createElement('div');
      label.className = 'search-category-label';
      label.textContent = 'Albums';
      searchDropdown.appendChild(label);
      results.albums.forEach(function(a) {
        var opt = document.createElement('div');
        opt.className = 'song-search-option';
        opt.innerHTML = '<span class="opt-song">' + esc(a.title) + '</span><span class="opt-album">' + esc(a.type) + ' (' + esc(a.year) + ')</span>';
        opt.addEventListener('mousedown', function(e) { e.preventDefault(); window.location.href = 'discography.html#cat=' + encodeURIComponent(a.category) + '&album=' + encodeURIComponent(a.title); });
        searchDropdown.appendChild(opt);
      });
    }

    // Songs
    if (results.songs.length) {
      hasResults = true;
      var label = document.createElement('div');
      label.className = 'search-category-label';
      label.textContent = 'Songs';
      searchDropdown.appendChild(label);
      results.songs.forEach(function(s) {
        var opt = document.createElement('div');
        opt.className = 'song-search-option';
        opt.innerHTML = '<span class="opt-song">' + esc(s.title) + '</span><span class="opt-album">' + esc(s.album) + '</span>';
        opt.addEventListener('mousedown', function(e) { e.preventDefault(); window.location.href = s.slug ? songHref(s.slug) : 'discography.html#cat=' + encodeURIComponent(s.category) + '&album=' + encodeURIComponent(s.album); });
        searchDropdown.appendChild(opt);
      });
    }

    // Lyrics
    if (results.lyrics.length) {
      hasResults = true;
      var label = document.createElement('div');
      label.className = 'search-category-label';
      label.textContent = 'Lyrics';
      searchDropdown.appendChild(label);
      results.lyrics.forEach(function(l) {
        var opt = document.createElement('div');
        opt.className = 'song-search-option';
        var highlighted = esc(l.pre) + '<strong style="color:var(--text)">' + esc(l.match) + '</strong>' + esc(l.post);
        opt.innerHTML = '<span class="opt-song">' + esc(l.song) + '</span><span class="opt-album">' + esc(l.album) + '</span><span class="opt-lyric">' + highlighted + '</span>';
        opt.addEventListener('mousedown', function(e) { e.preventDefault(); window.location.href = '/lyrics?q=' + encodeURIComponent(l.query); });
        searchDropdown.appendChild(opt);
      });
    }

    // Shows
    if (results.shows.length) {
      hasResults = true;
      var label = document.createElement('div');
      label.className = 'search-category-label';
      label.textContent = 'Live Shows';
      searchDropdown.appendChild(label);
      results.shows.forEach(function(g) {
        var opt = document.createElement('div');
        opt.className = 'song-search-option';
        opt.innerHTML = '<span class="opt-song">' + esc(g.venue || 'Unknown') + '</span><span class="opt-album">' + esc(g.city || '') + ' - ' + esc(g.isoDate || '') + '</span>';
        opt.addEventListener('mousedown', function(e) { e.preventDefault(); showDetailCard(g); });
        searchDropdown.appendChild(opt);
      });
    }

    // Live Performances (song was played at these shows)
    if (results.livePerformances.length) {
      hasResults = true;
      var label = document.createElement('div');
      label.className = 'search-category-label';
      label.textContent = 'Live Performances';
      searchDropdown.appendChild(label);
      results.livePerformances.forEach(function(g) {
        var opt = document.createElement('div');
        opt.className = 'song-search-option';
        opt.innerHTML = '<span class="opt-song">' + esc(g.venue || 'Unknown') + '</span><span class="opt-album">' + esc(g.city || '') + ' - ' + esc(g.isoDate || '') + '</span>';
        opt.addEventListener('mousedown', function(e) { e.preventDefault(); showDetailCard(g); });
        searchDropdown.appendChild(opt);
      });
    }

    if (!hasResults && query.length >= 2) {
      var opt = document.createElement('div');
      opt.className = 'song-search-option';
      opt.innerHTML = '<span class="opt-song" style="color:var(--muted)">No results for "' + esc(query) + '"</span>';
      searchDropdown.appendChild(opt);
    }

    activeIdx = -1;
    if (query.length >= 2) searchDropdown.classList.add('open');
    else searchDropdown.classList.remove('open');
  }

  searchInput.addEventListener('input', function() {
    var q = searchInput.value.trim();
    if (q.length < 2) { searchDropdown.classList.remove('open'); return; }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async function() {
      await loadSearchData();
      renderUniversalDropdown(universalSearch(q), q);
    }, 150);
  });

  searchInput.addEventListener('keydown', function(e) {
    var opts = searchDropdown.querySelectorAll('.song-search-option');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, opts.length - 1);
      opts.forEach(function(o, i) { o.classList.toggle('active', i === activeIdx); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      opts.forEach(function(o, i) { o.classList.toggle('active', i === activeIdx); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) {
        opts[activeIdx].dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      } else if (opts.length > 0) {
        opts[0].dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      }
    } else if (e.key === 'Escape') {
      searchDropdown.classList.remove('open');
    }
  });

  searchInput.addEventListener('blur', function() {
    setTimeout(function() { searchDropdown.classList.remove('open'); }, 150);
  });

  searchInput.addEventListener('focus', function() {
    if (searchInput.value.trim().length >= 2) {
      loadSearchData().then(function() {
        renderUniversalDropdown(universalSearch(searchInput.value.trim()), searchInput.value.trim());
      });
    }
  });

  // ─── Show Detail Card ───
  function formatShowDate(iso) {
    if (!iso) return 'Unknown date';
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  var tracksPromise = null;
  function loadTracks() {
    if (!tracksPromise) tracksPromise = fetch('data/tour-tracks.json').then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { tracksPromise = null; return {}; });
    return tracksPromise;
  }

  function showDetailCard(g) {
    document.getElementById('sdDate').textContent = formatShowDate(g.isoDate);
    document.getElementById('sdVenue').textContent = g.venue || 'Unknown venue';
    document.getElementById('sdCity').textContent = (g.city || '') + (g.state ? ', ' + g.state : '') + (g.countryName ? ' - ' + g.countryName : '');
    document.getElementById('sdTour').textContent = g.tour || '';
    document.getElementById('sdTour').style.display = g.tour ? '' : 'none';
    document.getElementById('sdSongs').textContent = g.songCount > 0 ? g.songCount + ' songs in setlist' : '';

    // Show track list if available
    var setlistEl = document.getElementById('sdSetlist');
    setlistEl.style.display = 'none';
    if (g.trackCount) {
      loadTracks().then(function(all) {
        var list = all[g.id];
        if (!list || document.getElementById('sdVenue').textContent !== (g.venue || 'Unknown venue')) return;
        var ol = '<ol>';
        list.forEach(function(t) { ol += '<li>' + esc(t.name || 'Unknown') + '</li>'; });
        ol += '</ol>';
        setlistEl.innerHTML = ol;
        setlistEl.style.display = '';
      });
    }

    var actions = document.getElementById('sdActions');
    actions.innerHTML = '';

    // Play button
    if (g.trackCount) {
      var playBtn = document.createElement('button');
      playBtn.className = 'sd-play';
      playBtn.textContent = '🎧 Play this show';
      playBtn.addEventListener('click', function() {
        document.getElementById('showDetailOverlay').classList.remove('active');
        window.location.href = 'tour-map.html#play=' + encodeURIComponent(g.id);
      });
      actions.appendChild(playBtn);
    }

    // Download button
    if (g.archiveUrl && !g.trackCount) {
      var dlBtn = document.createElement('a');
      dlBtn.className = 'sd-download';
      dlBtn.href = g.archiveUrl;
      dlBtn.target = '_blank';
      dlBtn.rel = 'noopener noreferrer';
      dlBtn.textContent = '🎧 Download this show';
      actions.appendChild(dlBtn);
    }

    // View setlist button
    if (g.setlistUrl || setlistLookup[g.id]) {
      var setlistBtn = document.createElement('button');
      setlistBtn.className = 'sd-setlist-link';
      setlistBtn.textContent = 'View full setlist →';
      setlistBtn.addEventListener('click', function() {
        document.getElementById('showDetailOverlay').classList.remove('active');
        showSetlistCard(g);
      });
      actions.appendChild(setlistBtn);
    }

    // Show on map
    var mapBtn = document.createElement('a');
    mapBtn.className = 'sd-setlist-link';
    mapBtn.href = 'tour-map.html';
    mapBtn.textContent = 'Open on Map';
    actions.appendChild(mapBtn);

    document.getElementById('showDetailOverlay').classList.add('active');
    searchDropdown.classList.remove('open');
  }

  document.getElementById('showDetailClose').addEventListener('click', function() {
    document.getElementById('showDetailOverlay').classList.remove('active');
  });
  document.getElementById('showDetailOverlay').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // Setlist overlay logic
  function showSetlistCard(g) {
    var sl = setlistLookup[g.id];
    var overlay = document.getElementById('setlistOverlay');

    // If no setlist data at all, fall back to setlist.fm in new tab
    if (!sl && g.setlistUrl) {
      window.open(g.setlistUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Header
    document.getElementById('slDate').textContent = formatShowDate(g.isoDate);
    document.getElementById('slVenue').textContent = (sl ? sl.venue : g.venue) || 'Unknown venue';

    var cityParts = [];
    if (sl) {
      if (sl.city) cityParts.push(sl.city);
      if (sl.state) cityParts.push(sl.state);
    } else {
      if (g.city) cityParts.push(g.city);
      if (g.state) cityParts.push(g.state);
      if (g.countryName) cityParts.push(g.countryName);
    }
    document.getElementById('slCity').textContent = cityParts.join(', ');

    var tourName = (sl && sl.tour) || g.tour || '';
    document.getElementById('slTour').textContent = tourName;
    document.getElementById('slTour').style.display = tourName ? '' : 'none';

    // Songs
    var songsWrap = document.getElementById('slSongsWrap');
    songsWrap.innerHTML = '';

    if (sl && sl.songs && sl.songs.length > 0) {
      var sets = {};
      var setOrder = [];
      sl.songs.forEach(function(song) {
        var setName = song.set || 'Set';
        if (!sets[setName]) {
          sets[setName] = [];
          setOrder.push(setName);
        }
        sets[setName].push(song);
      });

      var songNum = 0;
      setOrder.forEach(function(setName) {
        var header = document.createElement('div');
        header.className = 'setlist-set-header';
        header.textContent = setName;
        songsWrap.appendChild(header);

        sets[setName].forEach(function(song) {
          songNum++;
          var row = document.createElement('div');
          row.className = 'setlist-song' + (song.tape ? ' setlist-song-tape' : '');

          var num = document.createElement('span');
          num.className = 'setlist-song-num';
          num.textContent = songNum;
          row.appendChild(num);

          var name = document.createElement('span');
          name.className = 'setlist-song-name';
          name.textContent = song.name;
          row.appendChild(name);

          if (song.cover) {
            var cover = document.createElement('span');
            cover.className = 'setlist-song-cover';
            cover.textContent = '(cover)';
            row.appendChild(cover);
          }

          if (song.tape) {
            var tape = document.createElement('span');
            tape.className = 'setlist-song-tape-label';
            tape.textContent = '[tape]';
            row.appendChild(tape);
          }

          songsWrap.appendChild(row);
        });
      });

      document.getElementById('slCount').textContent = songNum + ' song' + (songNum !== 1 ? 's' : '');
    } else {
      songsWrap.innerHTML = '<div class="setlist-empty">No setlist data available for this show.</div>';
      document.getElementById('slCount').textContent = '';
    }

    // Actions
    var slActions = document.getElementById('slActions');
    slActions.innerHTML = '';

    if (g.trackCount) {
      var playBtn = document.createElement('button');
      playBtn.className = 'setlist-play-btn';
      playBtn.textContent = '\uD83C\uDFA7 Play this show';
      playBtn.addEventListener('click', function() {
        overlay.classList.remove('active');
        window.location.href = 'tour-map.html#play=' + encodeURIComponent(g.id);
      });
      slActions.appendChild(playBtn);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'setlist-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function() { overlay.classList.remove('active'); });
    slActions.appendChild(closeBtn);

    // Credit
    var credit = document.getElementById('slCredit');
    var setlistUrl = (sl && sl.url) || g.setlistUrl || '';
    if (setlistUrl) {
      credit.innerHTML = '<a href="' + esc(setlistUrl) + '" target="_blank" rel="noopener noreferrer">Setlist data from setlist.fm</a>';
    } else {
      credit.innerHTML = '';
    }

    overlay.classList.add('active');
  }

  document.getElementById('setlistClose').addEventListener('click', function() {
    document.getElementById('setlistOverlay').classList.remove('active');
  });
  document.getElementById('setlistOverlay').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

})();
