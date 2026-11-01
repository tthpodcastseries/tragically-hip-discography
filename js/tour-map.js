// tour-map.js - Live Show Tour Map: data, map, popups and search (moved out of
// tour-map.html in v5.4.17, audit SEC-03)
(async function() {

  // Load data. data/tour-map.json is tth-tour-data.json without the track lists
  // (scripts/build-light-data.js, audit PERF-04); tracks load on first Play.
  // Setlists and the video map start downloading now, alongside it, but the map
  // doesn't wait for them; the setlist and show cards do.
  let setlistLookup = {};
  let showVideosMap = {};
  const extrasReady = Promise.all([
    fetch('data/setlists.min.json').then(r => r.ok ? r.json() : null).then(slData => {
      if (slData && slData.setlists) slData.setlists.forEach(s => { setlistLookup[s.id] = s; });
    }).catch(e => console.warn('Setlist data load failed:', e)),
    // Show ↔ video map (v3.6 Long Time Running). Hide silently on failure.
    fetch('data/show-videos.json').then(r => r.ok ? r.json() : null).then(svData => {
      showVideosMap = (svData && svData.byShow) || {};
    }).catch(e => console.warn('Show-videos map load failed:', e))
  ]);

  function showMapError(what) {
    document.getElementById('statsPill').textContent = `Couldn't load the ${what}`;
    document.getElementById('otdBanner').hidden = true;
    document.getElementById('map').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-family:Poppins,sans-serif;text-align:center;padding:40px;"><div><p style="font-size:1.1rem;margin-bottom:8px;">Couldn't load the ${what}.</p><p style="font-size:0.85rem;">Check yer connection and refresh.</p></div></div>`;
  }

  // Leaflet comes from unpkg.com; if that is down or blocked, say so instead of
  // stopping with a blank page (audit REL-05)
  if (typeof L === 'undefined' || typeof L.markerClusterGroup !== 'function') {
    showMapError('map');
    console.error('Leaflet did not load');
    return;
  }

  let allGigs;
  try {
    const res = await fetch('data/tour-map.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allGigs = await res.json();
    allGigs.forEach(g => { g.tour = window.tthAlbumCase(g.tour); });
  } catch (e) {
    showMapError('tour data');
    console.error('Tour data load failed:', e);
    return;
  }

  // Map setup - dark tiles
  // No zoom or fade animation for people who asked for less motion (audit A11Y-08)
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map('map', {
    center: [50, -85],
    zoom: 4,
    zoomControl: true,
    attributionControl: true,
    zoomAnimation: !REDUCE_MOTION,
    fadeAnimation: !REDUCE_MOTION,
    markerZoomAnimation: !REDUCE_MOTION
  });

  // CARTO basemaps need a key since Sept 2026 (free non-commercial tier, 5M tiles/month).
  // Public by design - it ships in every tile URL. Manage at dashboard.basemaps.carto.com (jd@tthpods.com).
  const CARTO_KEY = 'cb1_4wzs_1_6486b4aebf6d574862008dc4';
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a> | Setlist data: <a href="https://www.setlist.fm" target="_blank">setlist.fm</a> | Gig data: <a href="https://www.hipbase.com" target="_blank">Hipbase</a> (Lance Robinson) | Live recordings: <a href="https://www.thehiparchive.com" target="_blank">The Tragically Hip Archive</a> (Darrin Cappe)',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  // Custom red marker
  function createIcon(color = '#C8102E') {
    return L.divIcon({
      className: 'custom-pin',
      html: `<svg width="24" height="34" viewBox="0 0 20 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="${color}" opacity="0.9"/>
        <circle cx="10" cy="10" r="4" fill="#0e0b16"/>
      </svg>`,
      iconSize: [24, 34],
      iconAnchor: [12, 34],
      popupAnchor: [0, -34]
    });
  }

  const redIcon = createIcon('#C8102E');
  const goldIcon = createIcon('#CCA23C');

  // Keyboard use of the pins (audit A11Y-04): Enter on a pin opens its popup and moves
  // focus into it, Esc closes it and puts focus back on the pin. Leaflet only listens
  // for Esc when the map itself has focus, not a pin.
  let kbPopupOpener = null;
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('leaflet-marker-icon')) kbPopupOpener = e.target;
    else if (e.key === 'Escape' && document.querySelector('.leaflet-popup')) map.closePopup();
  }, true);
  document.addEventListener('mousedown', () => { kbPopupOpener = null; }, true);
  map.on('popupopen', (e) => {
    if (!kbPopupOpener) return;
    const pop = e.popup.getElement();
    const f = pop && (pop.querySelector('.leaflet-popup-content button, .leaflet-popup-content a[href]') || pop.querySelector('.leaflet-popup-close-button'));
    if (f) f.focus();
  });
  map.on('popupclose', () => {
    const opener = kbPopupOpener;
    const ae = document.activeElement;
    if (opener && document.contains(opener) && (ae === document.body || (ae && ae.closest && ae.closest('.leaflet-popup')))) opener.focus();
  });

  // A pin is announced as "Venue, City, date" (audit A11Y-04); the title also
  // shows as a hover tooltip
  function pinLabel(g) {
    return [g.venue || 'Unknown venue', g.city, g.isoDate].filter(Boolean).join(', ');
  }
  function makePin(g, icon) {
    const label = pinLabel(g);
    const m = L.marker([g.lat, g.lng], { icon, title: label, alt: label });
    m.on('add', () => { const el = m.getElement(); if (el) el.setAttribute('aria-label', label); });
    return m;
  }

  // Marker cluster group
  let clusterGroup = L.markerClusterGroup({
    // Say what a cluster is, not just a number
    iconCreateFunction: function(cluster) {
      const n = cluster.getChildCount();
      const size = n < 10 ? 'small' : n < 100 ? 'medium' : 'large';
      return new L.DivIcon({
        html: '<div><span>' + n + '</span><span class="vh"> shows in this spot. Press Enter to zoom in.</span></div>',
        className: 'marker-cluster marker-cluster-' + size,
        iconSize: new L.Point(40, 40)
      });
    },
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    chunkedLoading: true
  });
  map.addLayer(clusterGroup);

  // Populate filters
  const tours = [...new Set(allGigs.map(g => g.tour).filter(Boolean))].sort();
  const countries = [...new Set(allGigs.map(g => g.countryName).filter(Boolean))].sort();

  const tourSelect = document.getElementById('tourFilter');
  tours.forEach(t => {
    const count = allGigs.filter(g => g.tour === t).length;
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${t} (${count})`;
    tourSelect.appendChild(opt);
  });

  const countrySelect = document.getElementById('countryFilter');
  countries.forEach(c => {
    const count = allGigs.filter(g => g.countryName === c).length;
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = `${c} (${count})`;
    countrySelect.appendChild(opt);
  });

  // Format date nicely
  function formatDate(iso) {
    if (!iso) return 'Unknown date';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Create popup content
  function popupHTML(g) {
    let html = `<div class="popup-date">${formatDate(g.isoDate)}</div>`;
    html += `<div class="popup-venue">${g.venue || 'Unknown venue'}</div>`;
    html += `<div class="popup-city">${g.city || ''}${g.state ? ', ' + g.state : ''}${g.countryName ? ' - ' + g.countryName : ''}</div>`;
    if (g.tour) html += `<div class="popup-tour">${g.tour}</div>`;
    if (g.dateNote) html += `<div class="popup-date-note">Date unconfirmed</div>`;
    if (g.songCount > 0) html += `<div class="popup-songs">${g.songCount} songs in setlist</div>`;
    if (g.trackCount && g.recordingNote) html += `<div class="popup-date-note">${g.recordingNote}</div>`;
    if (g.trackCount) {
      window._gigLookup = window._gigLookup || {};
      window._gigLookup[g.id] = g;
      html += `<button data-gig-action="play" data-gig="${g.id}" style="display:block;width:100%;margin-top:6px;padding:5px 0;background:none;border:none;color:#fff;text-decoration:underline;text-decoration-color:#CCA23C;text-underline-offset:3px;font-family:Poppins,sans-serif;font-size:0.7rem;font-weight:600;cursor:pointer;text-align:left;">🎧 Play this show</button>`;
    } else if (g.archiveUrl) {
      html += `<a href="${g.archiveUrl}" target="_blank" rel="noopener noreferrer" class="popup-link popup-archive">🎧 Download this show</a>`;
    }
    if (g.setlistUrl) html += `<button data-gig-action="setlist" data-gig="${g.id}" style="display:block;width:100%;margin-top:6px;padding:4px 0;background:none;border:none;color:#fff;text-decoration:underline;text-decoration-color:#CCA23C;text-underline-offset:3px;font-family:Poppins,sans-serif;font-size:0.7rem;font-weight:500;cursor:pointer;text-align:left;">View setlist →</button>`;
    const isAttended = tthAttended.has(g.id);
    html += `<button class="iwt-popup-btn${isAttended ? ' active' : ''}" data-gig-action="attended" data-gig="${g.id}">${isAttended ? 'I Was There ✓' : 'I Was There'}</button>`;
    return html;
  }

  // Popup buttons (inline onclick until v5.4.17, audit SEC-03). Capture phase, so it runs
  // whatever Leaflet does with clicks inside a popup.
  document.addEventListener('click', function(e) {
    const btn = e.target.closest && e.target.closest('[data-gig-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-gig');
    const action = btn.getAttribute('data-gig-action');
    if (action === 'play' && window.playGig) window.playGig(id);
    else if (action === 'setlist' && window.showSetlist) window.showSetlist(id);
    else if (action === 'attended' && window.toggleAttended) window.toggleAttended(id, btn);
  }, true);

  // Render markers
  // Markers are created once per gig and reused across filter changes;
  // popup HTML is built lazily on first open instead of for all 1,355 gigs up front
  const markerCache = new Map();
  function getGigMarker(g) {
    let m = markerCache.get(g.id);
    if (!m) {
      m = makePin(g, redIcon);
      m.bindPopup(() => popupHTML(g), { maxWidth: 280 });
      markerCache.set(g.id, m);
    }
    return m;
  }

  function renderGigs(gigs) {
    clusterGroup.clearLayers();
    const markers = [];
    gigs.forEach(g => {
      if (!g.lat || !g.lng) return;
      markers.push(getGigMarker(g));
    });
    clusterGroup.addLayers(markers);
    document.getElementById('statsPill').textContent =
      `${gigs.length.toLocaleString()} gigs - ${[...new Set(gigs.map(g => g.city))].length} cities - ${[...new Set(gigs.map(g => g.countryName))].length} countries`;
  }

  // Filter logic
  function getFilteredGigs() {
    const tour = tourSelect.value;
    const country = countrySelect.value;
    const yearMinVal = parseInt(document.getElementById('yearMin').value);
    const yearMaxVal = parseInt(document.getElementById('yearMax').value);
    const minY = Math.min(yearMinVal, yearMaxVal);
    const maxY = Math.max(yearMinVal, yearMaxVal);

    return allGigs.filter(g => {
      const year = g.isoDate ? parseInt(g.isoDate.substring(0, 4)) : null;
      if (tour !== 'all' && g.tour !== tour) return false;
      if (country !== 'all' && g.countryName !== country) return false;
      if (year && (year < minY || year > maxY)) return false;
      return true;
    });
  }

  function applyFilters(fitMap) {
    const filtered = getFilteredGigs();
    renderGigs(filtered);
    updateSliderTrack();
    const minY = Math.min(
      parseInt(document.getElementById('yearMin').value),
      parseInt(document.getElementById('yearMax').value)
    );
    const maxY = Math.max(
      parseInt(document.getElementById('yearMin').value),
      parseInt(document.getElementById('yearMax').value)
    );
    document.getElementById('yearDisplay').textContent = minY === maxY ? `${minY}` : `${minY} - ${maxY}`;
    if (fitMap && filtered.length) {
      const pts = filtered.filter(g => g.lat && g.lng).map(g => [g.lat, g.lng]);
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
    }
  }

  // Slider track fill
  function updateSliderTrack() {
    const min = 1985, max = 2022;
    const minVal = Math.min(
      parseInt(document.getElementById('yearMin').value),
      parseInt(document.getElementById('yearMax').value)
    );
    const maxVal = Math.max(
      parseInt(document.getElementById('yearMin').value),
      parseInt(document.getElementById('yearMax').value)
    );
    const left = ((minVal - min) / (max - min)) * 100;
    const right = ((maxVal - min) / (max - min)) * 100;
    const fill = document.getElementById('trackFill');
    fill.style.left = left + '%';
    fill.style.width = (right - left) + '%';
  }

  // Event listeners
  tourSelect.addEventListener('change', () => applyFilters(true));
  countrySelect.addEventListener('change', () => applyFilters(true));
  // Year sliders: update the track/label instantly, but debounce the marker
  // re-render so dragging stays smooth (and never pass the event as fitMap)
  let yearDebounce = null;
  function onYearInput() {
    updateSliderTrack();
    const lo = Math.min(parseInt(document.getElementById('yearMin').value), parseInt(document.getElementById('yearMax').value));
    const hi = Math.max(parseInt(document.getElementById('yearMin').value), parseInt(document.getElementById('yearMax').value));
    document.getElementById('yearDisplay').textContent = lo === hi ? `${lo}` : `${lo} - ${hi}`;
    clearTimeout(yearDebounce);
    yearDebounce = setTimeout(() => applyFilters(), 120);
  }
  document.getElementById('yearMin').addEventListener('input', onYearInput);
  document.getElementById('yearMax').addEventListener('input', onYearInput);

  document.getElementById('resetBtn').addEventListener('click', () => {
    tourSelect.value = 'all';
    countrySelect.value = 'all';
    document.getElementById('yearMin').value = 1985;
    document.getElementById('yearMax').value = 2022;
    applyFilters();
    map.setView([50, -85], 4);
  });

  // ANIMATED PLAYBACK
  let isPlaying = false;
  let playbackTimeout = null;
  let playbackSpeed = 800;
  let allSeenCities = new Set();
  let allSeenCountries = new Set();

  // Speed controls
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      playbackSpeed = parseInt(btn.dataset.speed);
    });
  });

  document.getElementById('playBtn').addEventListener('click', () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    startPlayback();
  });

  function startPlayback() {
    isPlaying = true;
    allSeenCities.clear();
    allSeenCountries.clear();
    const btn = document.getElementById('playBtn');
    btn.classList.add('playing');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';

    const overlay = document.getElementById('playbackOverlay');
    overlay.classList.add('active');

    // Reset filters
    tourSelect.value = 'all';
    countrySelect.value = 'all';
    clusterGroup.clearLayers();

    const years = [...new Set(allGigs.map(g => g.isoDate?.substring(0, 4)).filter(Boolean))].sort();
    let yearIdx = 0;
    let totalShown = 0;

    function showYear() {
      if (!isPlaying || yearIdx >= years.length) {
        finishPlayback();
        return;
      }

      const year = years[yearIdx];
      const yearGigs = allGigs.filter(g => g.isoDate?.startsWith(year));

      // Update sliders
      document.getElementById('yearMin').value = 1985;
      document.getElementById('yearMax').value = parseInt(year);
      updateSliderTrack();
      document.getElementById('yearDisplay').textContent = `1985 - ${year}`;

      // Add markers for this year with gold icon
      yearGigs.forEach(g => {
        if (!g.lat || !g.lng) return;
        const marker = makePin(g, goldIcon);
        marker.bindPopup(popupHTML(g), { maxWidth: 280 });
        clusterGroup.addLayer(marker);
        if (g.city) allSeenCities.add(g.city);
        if (g.countryName) allSeenCountries.add(g.countryName);
      });

      totalShown += yearGigs.length;

      // Update overlay stats
      document.getElementById('playbackYear').textContent = year;
      document.getElementById('playbackYearGigs').textContent = `${yearGigs.length} show${yearGigs.length !== 1 ? 's' : ''} this year`;
      document.getElementById('pbTotal').textContent = totalShown.toLocaleString();
      document.getElementById('pbCities').textContent = allSeenCities.size;
      document.getElementById('pbCountries').textContent = allSeenCountries.size;
      document.getElementById('statsPill').textContent = `${totalShown.toLocaleString()} gigs through ${year}`;

      // Flash the year
      const flash = document.getElementById('gigFlash');
      flash.textContent = year;
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), Math.min(playbackSpeed * 0.5, 400));

      yearIdx++;
      playbackTimeout = setTimeout(showYear, playbackSpeed);
    }

    showYear();
  }

  function finishPlayback() {
    isPlaying = false;
    clearTimeout(playbackTimeout);
    const btn = document.getElementById('playBtn');
    btn.classList.remove('playing');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play Timeline';

    // Final flash
    const flash = document.getElementById('gigFlash');
    flash.textContent = `${allGigs.length} gigs`;
    flash.classList.add('show');
    setTimeout(() => {
      flash.classList.remove('show');
      document.getElementById('playbackOverlay').classList.remove('active');
      applyFilters();
      map.setView([50, -85], 4, { animate: !REDUCE_MOTION });
    }, 1500);
  }

  function stopPlayback() {
    isPlaying = false;
    clearTimeout(playbackTimeout);
    const btn = document.getElementById('playBtn');
    btn.classList.remove('playing');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play Timeline';
    document.getElementById('playbackOverlay').classList.remove('active');
    applyFilters();
  }

  // SEARCH FUNCTIONALITY
  const searchInput = document.getElementById('gigSearch');
  const searchResults = document.getElementById('searchResults');
  const searchClear = document.getElementById('searchClear');
  let searchDebounce = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    searchClear.style.display = q ? 'block' : 'none';
    if (q.length < 2) {
      searchResults.classList.remove('open');
      return;
    }
    searchDebounce = setTimeout(() => runSearch(q), 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchResults.classList.remove('open');
      searchInput.blur();
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchResults.classList.remove('open');
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      searchResults.classList.remove('open');
    }
  });

  // Folded once per show: straight and curly apostrophes and accents all match, and a date
  // can be typed as 1996-07-27, July 27, 1996, July 1996 or 27/07/1996 (audit FUNC-05, FUNC-09)
  const gigHaystack = new Map();
  function haystackFor(g) {
    let h = gigHaystack.get(g);
    if (h === undefined) {
      h = window.tthFold([g.venue, g.city, g.state, g.countryName, g.tour].concat(window.tthDateForms(g.isoDate)).filter(Boolean).join(' '));
      gigHaystack.set(g, h);
    }
    return h;
  }

  function runSearch(query) {
    const q = window.tthFold(query);
    const matches = allGigs.filter(g => haystackFor(g).includes(q));

    searchResults.innerHTML = '';
    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="search-result-count">No shows found</div>';
      searchResults.classList.add('open');
      return;
    }

    const shown = matches.slice(0, 50);
    const countDiv = document.createElement('div');
    countDiv.className = 'search-result-count';
    countDiv.textContent = matches.length === 1 ? '1 show found' :
      `${matches.length} shows found` + (matches.length > 50 ? ' (showing first 50)' : '');
    searchResults.appendChild(countDiv);

    shown.forEach(g => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<div class="sr-date">${formatDate(g.isoDate)}</div>
        <div class="sr-venue">${g.venue || 'Unknown venue'}</div>
        <div class="sr-city">${g.city || ''}${g.state ? ', ' + g.state : ''}${g.countryName ? ' - ' + g.countryName : ''}</div>`;
      item.addEventListener('click', () => {
        searchResults.classList.remove('open');
        showDetailCard(g);
      });
      searchResults.appendChild(item);
    });

    searchResults.classList.add('open');
  }

  // ─── Attended Shows (I Was There) ───
  // Backed by window.TTHMember (see /js/tth-member-gate.js), which persists to Supabase via RPC.
  const tthAttended = {
    _shows: new Set(),
    has(id) { return this._shows.has(id); },
    count() { return this._shows.size; },
    getAll() { return [...this._shows]; },
    init() {
      const session = window.TTHMember && window.TTHMember.getSession();
      this._shows = new Set(session && session.attendedShows ? session.attendedShows : []);
      this._updateUI();
    },
    async toggle(id) {
      // Optimistic local update, then persist.
      const wasAttended = this._shows.has(id);
      if (wasAttended) this._shows.delete(id);
      else this._shows.add(id);
      this._updateUI();
      try {
        const nowAttended = await window.TTHMember.toggleShow(id);
        // Reconcile in case server state differs.
        if (nowAttended) this._shows.add(id);
        else this._shows.delete(id);
        this._updateUI();
        return nowAttended;
      } catch (e) {
        // Roll back on failure.
        if (wasAttended) this._shows.add(id);
        else this._shows.delete(id);
        this._updateUI();
        console.error('Failed to save attended show:', e);
        return wasAttended;
      }
    },
    _updateUI() {
      const count = document.getElementById('myShowsCount');
      if (count) count.textContent = this._shows.size;
    }
  };

  // Toggle handler for popup buttons
  window.toggleAttended = async function(id, btn) {
    const now = await tthAttended.toggle(id);
    btn.className = 'iwt-popup-btn' + (now ? ' active' : '');
    btn.textContent = now ? 'I Was There ✓' : 'I Was There';
  };

  // "My Shows" filter button
  let showingMyShows = false;
  document.getElementById('myShowsBtn').addEventListener('click', () => {
    showingMyShows = !showingMyShows;
    const btn = document.getElementById('myShowsBtn');
    if (showingMyShows) {
      btn.classList.add('active');
      const myGigs = allGigs.filter(g => tthAttended.has(g.id));
      renderGigs(myGigs);
      if (myGigs.length) {
        const pts = myGigs.filter(g => g.lat && g.lng).map(g => [g.lat, g.lng]);
        if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
      }
    } else {
      btn.classList.remove('active');
      applyFilters();
      map.setView([50, -85], 4);
    }
  });

  // Init attended shows from TTHMember (unlock is guaranteed by the member gate).
  if (window.TTHMember) {
    tthAttended.init();
    // Keep local state in sync if the session changes (e.g. sign-out on another tab).
    if (typeof window.TTHMember.onChange === 'function') {
      window.TTHMember.onChange(() => tthAttended.init());
    }
  }

  // Show detail card (from search results)
  async function showDetailCard(g) {
    await extrasReady;
    document.getElementById('sdDate').textContent = formatDate(g.isoDate);
    document.getElementById('sdVenue').textContent = g.venue || 'Unknown venue';
    document.getElementById('sdCity').textContent = (g.city || '') + (g.state ? ', ' + g.state : '') + (g.countryName ? ' - ' + g.countryName : '');
    document.getElementById('sdTour').textContent = g.tour || '';
    document.getElementById('sdTour').style.display = g.tour ? '' : 'none';
    document.getElementById('sdSongs').textContent = g.songCount > 0 ? g.songCount + ' songs in setlist' : '';

    const actions = document.getElementById('sdActions');
    actions.innerHTML = '';

    // YouTube recordings tied to this show (silently hidden if no match)
    const matchedVideos = showVideosMap[g.id] || [];
    if (matchedVideos.length) {
      const strip = document.createElement('div');
      strip.className = 'show-videos-strip';
      const label = document.createElement('div');
      label.className = 'show-videos-strip-label';
      label.textContent = matchedVideos.length === 1
        ? '1 YouTube recording'
        : matchedVideos.length + ' YouTube recordings';
      strip.appendChild(label);
      const list = document.createElement('div');
      list.className = 'show-videos-strip-list';
      matchedVideos.forEach(function(v) {
        const a = document.createElement('a');
        a.className = 'show-video-thumb';
        a.href = v.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', 'Watch ' + (v.title || 'this recording') + ' on YouTube');
        const primaryTag = (v.tags && v.tags[0]) ? v.tags[0] : 'Live';
        const metaParts = [];
        if (v.trackCount) metaParts.push(v.trackCount + ' tracks');
        if (v.partialTracklist) metaParts.push('partial');
        a.innerHTML =
          '<img src="' + (v.thumbnail || '') + '" alt="" loading="lazy" data-onerror="hide">' +
          '<span class="show-video-thumb-tag">' + primaryTag + '</span>' +
          (metaParts.length ? '<div class="show-video-thumb-meta">' + metaParts.join(' · ') + '</div>' : '');
        list.appendChild(a);
      });
      strip.appendChild(list);
      actions.appendChild(strip);
    }

    if (g.trackCount) {
      window._gigLookup = window._gigLookup || {};
      window._gigLookup[g.id] = g;
      const playBtn = document.createElement('button');
      playBtn.className = 'show-detail-play';
      playBtn.textContent = '🎧 Play this show';
      playBtn.addEventListener('click', () => {
        document.getElementById('showDetailOverlay').classList.remove('active');
        window.playGig(g.id);
      });
      actions.appendChild(playBtn);
    }

    if (g.setlistUrl) {
      const setlistBtn = document.createElement('button');
      setlistBtn.className = 'show-detail-setlist';
      setlistBtn.textContent = 'View setlist →';
      setlistBtn.addEventListener('click', () => {
        document.getElementById('showDetailOverlay').classList.remove('active');
        window.showSetlist(g.id);
      });
      actions.appendChild(setlistBtn);
    }

    if (g.lat && g.lng) {
      const mapBtn = document.createElement('button');
      mapBtn.className = 'show-detail-map-btn';
      mapBtn.textContent = 'Show on map';
      mapBtn.addEventListener('click', () => {
        document.getElementById('showDetailOverlay').classList.remove('active');
        map.setView([g.lat, g.lng], 14, { animate: !REDUCE_MOTION });
      });
      actions.appendChild(mapBtn);
    }

    const iwtBtn = document.createElement('button');
    const isAttended = tthAttended.has(g.id);
    iwtBtn.className = 'iwt-popup-btn' + (isAttended ? ' active' : '');
    iwtBtn.textContent = isAttended ? 'I Was There ✓' : 'I Was There';
    iwtBtn.addEventListener('click', async () => {
      const now = await tthAttended.toggle(g.id);
      iwtBtn.className = 'iwt-popup-btn' + (now ? ' active' : '');
      iwtBtn.textContent = now ? 'I Was There ✓' : 'I Was There';
    });
    actions.appendChild(iwtBtn);

    document.getElementById('showDetailOverlay').classList.add('active');
  }

  document.getElementById('showDetailClose').addEventListener('click', () => {
    document.getElementById('showDetailOverlay').classList.remove('active');
  });
  document.getElementById('showDetailOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // Setlist overlay logic
  window.showSetlist = async function(gigId) {
    await extrasReady;
    const sl = setlistLookup[gigId];
    const g = allGigs.find(x => x.id === gigId);
    const overlay = document.getElementById('setlistOverlay');

    // Header info - use gig data as fallback
    document.getElementById('slDate').textContent = formatDate(g ? g.isoDate : null);
    document.getElementById('slVenue').textContent = (sl ? sl.venue : (g ? g.venue : 'Unknown venue'));
    const cityParts = [];
    if (sl) {
      if (sl.city) cityParts.push(sl.city);
      if (sl.state) cityParts.push(sl.state);
    } else if (g) {
      if (g.city) cityParts.push(g.city);
      if (g.state) cityParts.push(g.state);
      if (g.countryName) cityParts.push(g.countryName);
    }
    document.getElementById('slCity').textContent = cityParts.join(', ');

    const tourName = window.tthAlbumCase((sl && sl.tour) || (g && g.tour) || '');
    document.getElementById('slTour').textContent = tourName;
    document.getElementById('slTour').style.display = tourName ? '' : 'none';

    const songsWrap = document.getElementById('slSongsWrap');
    songsWrap.innerHTML = '';

    if (sl && sl.songs && sl.songs.length > 0) {
      // Group songs by set
      const sets = {};
      const setOrder = [];
      sl.songs.forEach(song => {
        const setName = song.set || 'Set';
        if (!sets[setName]) {
          sets[setName] = [];
          setOrder.push(setName);
        }
        sets[setName].push(song);
      });

      let songNum = 0;
      setOrder.forEach(setName => {
        const header = document.createElement('div');
        header.className = 'setlist-set-header';
        header.textContent = setName;
        songsWrap.appendChild(header);

        sets[setName].forEach(song => {
          songNum++;
          const row = document.createElement('div');
          row.className = 'setlist-song' + (song.tape ? ' setlist-song-tape' : '');

          const num = document.createElement('span');
          num.className = 'setlist-song-num';
          num.textContent = songNum;
          row.appendChild(num);

          const name = document.createElement('span');
          name.className = 'setlist-song-name';
          name.textContent = song.name;
          row.appendChild(name);

          if (song.cover) {
            const cover = document.createElement('span');
            cover.className = 'setlist-song-cover';
            cover.textContent = '(cover)';
            row.appendChild(cover);
          }

          if (song.tape) {
            const tape = document.createElement('span');
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
    const actions = document.getElementById('slActions');
    actions.innerHTML = '';

    if (g && g.trackCount) {
      window._gigLookup = window._gigLookup || {};
      window._gigLookup[g.id] = g;
      const playBtn = document.createElement('button');
      playBtn.className = 'setlist-play-btn';
      playBtn.textContent = '\uD83C\uDFA7 Play this show';
      playBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        window.playGig(g.id);
      });
      actions.appendChild(playBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'setlist-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => { overlay.classList.remove('active'); });
    actions.appendChild(closeBtn);

    // Credit link
    const credit = document.getElementById('slCredit');
    const setlistUrl = (sl && sl.url) || (g && g.setlistUrl) || '';
    if (setlistUrl) {
      credit.innerHTML = '<a href="' + setlistUrl + '" target="_blank" rel="noopener noreferrer">Setlist data from setlist.fm</a>';
    } else {
      credit.innerHTML = '';
    }

    overlay.classList.add('active');
  };

  document.getElementById('setlistClose').addEventListener('click', () => {
    document.getElementById('setlistOverlay').classList.remove('active');
  });
  document.getElementById('setlistOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // Initial render
  renderGigs(allGigs);
  updateSliderTrack();

  // ON THIS DAY
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todaySuffix = `-${mm}-${dd}`;
  const otdGigs = allGigs.filter(g => g.isoDate?.endsWith(todaySuffix) && !g.dateNote);

  // The strip shows from the first paint (so the filters below never jump, audit PERF-06)
  // and says so on the days with no show
  const banner = document.getElementById('otdBanner');
  const monthName = today.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
  if (!otdGigs.length) {
    document.getElementById('otdTitle').textContent = `On This Day (${monthName})`;
    document.getElementById('otdDetail').textContent = 'No shows by The Hip on record for this date.';
  } else {
    document.getElementById('otdTitle').textContent =
      `On This Day (${monthName}): The Hip played ${otdGigs.length} show${otdGigs.length > 1 ? 's' : ''}`;

    const details = otdGigs.map(g => {
      const year = g.isoDate.substring(0, 4);
      return `${year} - ${g.venue || 'Unknown'}, ${g.city || ''}`;
    }).join('  ·  ');
    document.getElementById('otdDetail').textContent = details + '  ·  Click to visit each gig';

    banner.classList.add('active');

    // Mark OTD pins with gold icon and badge
    const otdMarkers = [];
    otdGigs.forEach(g => {
      if (!g.lat || !g.lng) return;
      const marker = makePin(g, goldIcon);
      const badgeHTML = `<div class="otd-pin-badge">On This Day</div>`;
      marker.bindPopup(badgeHTML + popupHTML(g), { maxWidth: 280 });
      clusterGroup.addLayer(marker);
      otdMarkers.push(marker);
    });

    // Click banner to zoom to OTD gigs
    let otdIndex = 0;
    banner.addEventListener('click', () => {
      const m = otdMarkers[otdIndex % otdMarkers.length];
      const ll = m.getLatLng();
      map.setView(ll, 13, { animate: !REDUCE_MOTION });
      // Wait for zoom to finish then open popup
      setTimeout(() => {
        // At zoom 13 clusters should be broken - find the visible marker
        clusterGroup.eachLayer(layer => {
          if (layer.getLatLng().equals(ll)) {
            layer.openPopup();
          }
        });
      }, 600);
      otdIndex++;
    });
  }

  // A short note when a shared link points at a show we can't find (audit FUNC-13)
  let mapNoteTimer = null;
  function showMapNote(msg) {
    let note = document.getElementById('mapNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'mapNote';
      note.className = 'map-note';
      note.setAttribute('role', 'status');
      document.body.appendChild(note);
    }
    note.textContent = msg;
    note.classList.add('open');
    clearTimeout(mapNoteTimer);
    mapNoteTimer = setTimeout(() => note.classList.remove('open'), 7000);
  }

  // Deep-link from Video For New Recruits: tour-map.html#show=<id> auto-opens the show
  function handleShowHash() {
    const m = (location.hash || '').match(/show=([A-Za-z0-9_-]+)/);
    if (!m) return;
    const showId = m[1];
    const g = allGigs.find(x => String(x.id) === showId);
    if (!g) { showMapNote("Couldn't find that show. Try the search box."); return; }
    if (g.lat && g.lng) {
      try { map.setView([g.lat, g.lng], 12, { animate: !REDUCE_MOTION }); } catch (_) { /* noop */ }
    }
    showDetailCard(g);
  }
  handleShowHash();
  window.addEventListener('hashchange', handleShowHash);

  // Deep-link: tour-map.html#play=<id> starts playback of that show's recording;
  // #play=random picks a random show with playable Hip Archive audio.
  function handlePlayHash() {
    const m = (location.hash || '').match(/play=([A-Za-z0-9_-]+)/);
    if (!m) return;
    let g = null;
    if (m[1] === 'random') {
      const playable = allGigs.filter(x => x.trackCount);
      if (!playable.length) { showMapNote('No recordings to play yet.'); return; }
      g = playable[Math.floor(Math.random() * playable.length)];
    } else {
      g = allGigs.find(x => String(x.id) === m[1]);
    }
    if (!g) { showMapNote("Couldn't find that show. Try the search box."); return; }
    if (!g.trackCount) { showMapNote('No recording for that show yet.'); return; }
    if (g.lat && g.lng) {
      try { map.setView([g.lat, g.lng], 12, { animate: !REDUCE_MOTION }); } catch (_) { /* noop */ }
    }
    window._gigLookup = window._gigLookup || {};
    window._gigLookup[g.id] = g;
    if (window.playGig) window.playGig(g.id);
  }
  handlePlayHash();
  window.addEventListener('hashchange', handlePlayHash);

})();
