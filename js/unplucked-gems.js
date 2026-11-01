// unplucked-gems.js - Unplucked Gems page (moved out of unplucked-gems.html in v5.4.17)
(async function() {
  var resp = await fetch('data/unplucked-gems.json');
  if (!resp.ok) return;
  var data = await resp.json();

  // Image path mapping (fallback when JSON imagePath not yet populated)
  var imageMap = {
    'The Tragically Hip': 'assets-optimized/eps/The-EP.webp',
    'Up to Here': 'assets-optimized/studio-albums/Up-to-Here.webp',
    'Road Apples': 'assets-optimized/studio-albums/Road-Apples.webp',
    'Fully Completely': 'assets-optimized/studio-albums/Fully-Completely.webp',
    'Day for Night': 'assets-optimized/studio-albums/Day-for-Night.webp',
    'Trouble at the Henhouse': 'assets-optimized/studio-albums/Trouble-at-the-Henhouse.webp',
    'Live Between Us': 'assets-optimized/live-albums/Live-Between-Us.webp',
    'Phantom Power': 'assets-optimized/studio-albums/Phantom-Power.webp',
    'Music @ Work': 'assets-optimized/studio-albums/Music-at-Work.webp',
    'In Violet Light': 'assets-optimized/studio-albums/In-Violet-Light.webp',
    'In Between Evolution': 'assets-optimized/studio-albums/In-Between-Evolution.webp',
    'World Container': 'assets-optimized/studio-albums/World-Container.webp',
    'We Are the Same': 'assets-optimized/studio-albums/We-Are-the-Same.webp',
    'Now for Plan A': 'assets-optimized/studio-albums/Now-for-Plan-A.webp',
    'Man Machine Poem': 'assets-optimized/studio-albums/Man-Machine-Poem.webp'
  };

  // Utility
  function esc(str) {
    if (!str) return '';
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // Stats
  // Counted from the sessions themselves, with the same rule as each album's panel below, so
  // Available + In the Vault always adds up to Sessions (audit DATA-08). The tracker's own
  // summary numbers in the JSON come from its spreadsheet headers and don't add up.
  var globalStats = { sessions: 0, eras: data.eras.length, full: 0, vault: 0 };
  data.eras.forEach(function(era) {
    (era.sessions || []).forEach(function(s) {
      var av = (s.availability || '').toLowerCase();
      globalStats.sessions++;
      if (av === 'full' || av === 'partial' || av === 'snippet') globalStats.full++;
      else globalStats.vault++;
    });
  });

  var statTotal = document.getElementById('statTotal');
  var statEras = document.getElementById('statEras');
  var statFull = document.getElementById('statFull');
  var statVault = document.getElementById('statVault');
  var statsContext = document.getElementById('statsContext');

  function setStats(stats, label) {
    var nums = document.querySelectorAll('.stat-num');
    nums.forEach(function(n) { n.classList.add('updating'); });
    setTimeout(function() {
      statTotal.textContent = stats.sessions;
      statEras.textContent = stats.eras;
      statFull.textContent = stats.full;
      statVault.textContent = stats.vault;
      statsContext.textContent = label || '';
      nums.forEach(function(n) { n.classList.remove('updating'); });
    }, 150);
  }

  setStats(globalStats, '');

  // Credit
  if (data.credit) {
    document.getElementById('creditLine').textContent = data.credit + ' - Last updated ' + data.lastUpdated;
  }

  // DOM refs
  var grid = document.getElementById('albumGrid');
  var overlay = document.getElementById('gridOverlay');
  var currentFlippedCard = null;
  var currentPanel = null;

  // Shared close function
  function closeCurrentAlbum() {
    var cardToRefocus = currentFlippedCard;
    if (currentFlippedCard) {
      currentFlippedCard.classList.remove('flipped');
      currentFlippedCard = null;
    }
    if (currentPanel) {
      currentPanel.classList.remove('active');
      // Reset filters inside panel
      var search = currentPanel.querySelector('.panel-search');
      var filterBtns = currentPanel.querySelectorAll('.filter-btn');
      var sessions = currentPanel.querySelectorAll('.session-card');
      var noResults = currentPanel.querySelector('.panel-no-results');
      if (search) search.value = '';
      filterBtns.forEach(function(b, i) {
        b.classList.toggle('active', i === 0);
        b.setAttribute('aria-pressed', String(i === 0));
      });
      sessions.forEach(function(c) {
        c.style.display = '';
        c.classList.remove('expanded');
        var t = c.querySelector('.session-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (noResults) noResults.style.display = 'none';
      currentPanel._activeFilter = 'all';
      currentPanel = null;
    }
    overlay.classList.remove('active');
    setStats(globalStats, '');
    if (cardToRefocus) cardToRefocus.focus();
  }

  // Build each album card + panel
  var sessionCount = 0;
  data.eras.forEach(function(era) { era.era = window.tthAlbumCase(era.era); });
  data.eras.forEach(function(era, idx) {
    // Prefer the local imageMap - imported tracker data has carried stale filenames before
    var imagePath = imageMap[era.era] || era.imagePath || '';

    // Count availability
    var eraAvailable = 0;
    var eraUnavailable = 0;
    era.sessions.forEach(function(s) {
      var av = (s.availability || '').toLowerCase();
      if (av === 'full' || av === 'partial' || av === 'snippet') eraAvailable++;
      else eraUnavailable++;
    });

    // --- Grid card (front + back placeholder) ---
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'flip-card';

    var inner = document.createElement('div');
    inner.className = 'flip-card-inner';

    var front = document.createElement('div');
    front.className = 'flip-card-front';
    front.innerHTML =
      '<img src="' + esc(imagePath) + '" alt="" width="600" height="600" loading="lazy">' +
      '<div class="flip-card-label">' + esc(era.era) + '</div>' +
      '<div class="flip-card-count">' + era.sessions.length + ' sessions</div>';

    var backPlaceholder = document.createElement('div');
    backPlaceholder.className = 'flip-card-back-placeholder';
    backPlaceholder.setAttribute('aria-hidden', 'true'); // not part of the button's name (audit A11Y-11)
    backPlaceholder.innerHTML = '<span>Loading...</span>';

    inner.appendChild(front);
    inner.appendChild(backPlaceholder);
    card.appendChild(inner);
    grid.appendChild(card);

    // --- Expanded panel (overlay) ---
    var panel = document.createElement('div');
    panel.className = 'expanded-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', era.era + ' sessions');
    panel._activeFilter = 'all';

    // Panel header
    var panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';
    panelHeader.innerHTML =
      '<span class="panel-title">' + esc(era.era) + '</span>' +
      '<button class="panel-close" aria-label="Close">&times;</button>';

    // Panel controls
    var panelControls = document.createElement('div');
    panelControls.className = 'panel-controls';
    panelControls.innerHTML =
      '<input type="text" class="panel-search" placeholder="Search this era..." aria-label="Search sessions in ' + esc(era.era) + '">' +
      '<div class="panel-filter-row">' +
        '<button type="button" class="filter-btn active" data-filter="all" aria-pressed="true">All</button>' +
        '<button type="button" class="filter-btn" data-filter="full" aria-pressed="false">Available</button>' +
        '<button type="button" class="filter-btn" data-filter="holy-grail" aria-pressed="false">Holy Grails</button>' +
        '<button type="button" class="filter-btn" data-filter="demo" aria-pressed="false">Demos</button>' +
        '<button type="button" class="filter-btn" data-filter="throwaway" aria-pressed="false">Throwaways</button>' +
      '</div>' +
      '<div class="sr-only" role="status"></div>';

    // Panel sessions list
    var panelSessions = document.createElement('div');
    panelSessions.className = 'panel-sessions';

    var noResults = document.createElement('div');
    noResults.className = 'panel-no-results';
    noResults.style.display = 'none';
    noResults.textContent = 'No sessions match yer search.';

    // Build session cards
    era.sessions.forEach(function(s) {
      var sc = document.createElement('div');
      sc.className = 'session-card';
      sc.setAttribute('data-type', (s.type || '').toLowerCase());
      sc.setAttribute('data-availability', (s.availability || '').toLowerCase());
      sc.setAttribute('data-tier', s.tier || '');
      sc.setAttribute('data-search', [s.displayName || s.name, s.name, (s.altNames || []).join(' '), s.notes || '', s.type || ''].join(' ').toLowerCase());

      var tierBadge = '';
      if (s.tier === 'holy-grail') tierBadge = '<span class="tier-badge tier-holy-grail">Holy Grail</span>';
      else if (s.tier === 'standout') tierBadge = '<span class="tier-badge tier-standout">Standout</span>';
      else if (s.tier === 'notable') tierBadge = '<span class="tier-badge tier-notable">Notable</span>';

      var displayLabel = s.displayName || s.name;
      var altText = s.altNames && s.altNames.length ? '<span class="session-alt"> aka ' + s.altNames.map(esc).join(', ') + '</span>' : '';

      var tags = '';
      if (s.type) tags += '<span class="tag tag-type">' + esc(s.type) + '</span>';
      if (s.availability) {
        var avClass = 'tag-confirmed';
        if (s.availability === 'Full') avClass = 'tag-full';
        else if (s.availability === 'Partial') avClass = 'tag-partial';
        else if (s.availability === 'Snippet') avClass = 'tag-snippet';
        else if (s.availability === 'Rumored') avClass = 'tag-rumored';
        // The data says 'Rumored' (a match key); fans read the Canadian spelling (audit BRAND-12)
        tags += '<span class="tag ' + avClass + '">' + esc(s.availability === 'Rumored' ? 'Rumoured' : s.availability) + '</span>';
      }
      if (s.quality && s.quality !== 'Not Available') {
        var qClass = 'tag-quality-low';
        if (s.quality === 'Lossless') qClass = 'tag-quality-lossless';
        else if (s.quality === 'CD Quality') qClass = 'tag-quality-cd';
        else if (s.quality === 'High Quality') qClass = 'tag-quality-high';
        tags += '<span class="tag ' + qClass + '">' + esc(s.quality) + '</span>';
      }
      if (s.link) {
        tags += '<a href="' + esc(s.link) + '" target="_blank" rel="noopener noreferrer" class="tag tag-link">Listen</a>';
      }

      // Sessions with notes get a real button that opens them, so the keyboard and
      // screen readers can reach the notes too (audit A11Y-06)
      sessionCount++;
      var notesId = 'ugNotes' + sessionCount;
      var notesHtml = s.notes ? '<div class="session-notes" id="' + notesId + '">' + esc(s.notes) + '</div>' : '';
      var nameHtml = s.notes
        ? '<button type="button" class="session-toggle" aria-expanded="false" aria-controls="' + notesId + '">' + esc(displayLabel) + altText + '</button>'
        : esc(displayLabel) + altText;

      sc.innerHTML =
        '<div class="session-top">' +
          '<div class="session-name">' + nameHtml + '</div>' +
          tierBadge +
        '</div>' +
        (tags ? '<div class="session-tags">' + tags + '</div>' : '') +
        notesHtml;

      // The Listen link opens without toggling the card (was an inline onclick until v5.4.17)
      var listenLink = sc.querySelector('.tag-link');
      if (listenLink) listenLink.addEventListener('click', function(e) { e.stopPropagation(); });

      if (s.notes) {
        var toggle = sc.querySelector('.session-toggle');
        sc.addEventListener('click', function() {
          var open = sc.classList.toggle('expanded');
          toggle.setAttribute('aria-expanded', String(open));
        });
      }

      panelSessions.appendChild(sc);
    });

    panel.appendChild(panelHeader);
    panel.appendChild(panelControls);
    panel.appendChild(panelSessions);
    panel.appendChild(noResults);
    document.body.appendChild(panel);

    // --- Filter logic for this panel ---
    var panelSearch = panelControls.querySelector('.panel-search');
    var panelFilterBtns = panelControls.querySelectorAll('.filter-btn');
    var panelStatus = panelControls.querySelector('[role="status"]');
    var statusTimer = null;

    function applyPanelFilters() {
      var q = panelSearch.value.toLowerCase().trim();
      var cards = panelSessions.querySelectorAll('.session-card');
      var af = panel._activeFilter;
      var anyVisible = false;
      var shown = 0;

      cards.forEach(function(c) {
        // Folded match: curly or no apostrophes, accents (audit FUNC-02)
        var matchSearch = !q || window.tthMatch(c.getAttribute('data-search'), q);
        var matchFilter = true;
        if (af === 'full') matchFilter = c.getAttribute('data-availability') === 'full';
        else if (af === 'holy-grail') matchFilter = c.getAttribute('data-tier') === 'holy-grail';
        else if (af === 'demo') matchFilter = c.getAttribute('data-type') === 'demo';
        else if (af === 'throwaway') matchFilter = c.getAttribute('data-type') === 'throwaway';

        var show = matchSearch && matchFilter;
        c.style.display = show ? '' : 'none';
        if (show) { anyVisible = true; shown++; }
      });

      noResults.style.display = anyVisible ? 'none' : '';
      // Say how many sessions are left (audit A11Y-07)
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function() {
        panelStatus.textContent = shown ? shown + (shown === 1 ? ' session' : ' sessions') : 'No sessions match yer search.';
      }, 400);
    }

    panelSearch.addEventListener('input', applyPanelFilters);

    panelControls.querySelector('.panel-filter-row').addEventListener('click', function(e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      panelFilterBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      panel._activeFilter = btn.getAttribute('data-filter');
      applyPanelFilters();
    });

    // --- Click handlers ---

    // Open: click the card front
    card.addEventListener('click', function() {
      if (card.classList.contains('flipped')) {
        closeCurrentAlbum();
        return;
      }
      // Close any currently open album first
      if (currentFlippedCard) {
        closeCurrentAlbum();
      }
      // Open this one
      card.classList.add('flipped');
      currentFlippedCard = card;

      // Show panel after a brief delay so the flip animation starts first
      setTimeout(function() {
        panel.classList.add('active');
        currentPanel = panel;
        overlay.classList.add('active');

        // Focus search input for quick typing
        panelSearch.focus();
      }, 350);

      // Update stats
      setStats({
        sessions: era.sessions.length,
        eras: 1,
        full: eraAvailable,
        vault: eraUnavailable
      }, era.era);
    });

    // Close button
    panelHeader.querySelector('.panel-close').addEventListener('click', function(e) {
      e.stopPropagation();
      closeCurrentAlbum();
    });
  });

  // Overlay click to close
  overlay.addEventListener('click', closeCurrentAlbum);

  // Focus trap: keep Tab within the open dialog
  function trapPanelFocus(e) {
    var nodes = currentPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var focusables = Array.prototype.filter.call(nodes, function(el) { return !el.disabled && el.offsetParent !== null; });
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Escape to close, Tab to trap focus within the open dialog
  document.addEventListener('keydown', function(e) {
    if (!currentPanel) return;
    if (e.key === 'Escape') closeCurrentAlbum();
    else if (e.key === 'Tab') trapPanelFocus(e);
  });
})();
