// music-videos.js - Music Videos page (moved out of music-videos.html in v5.4.17)
(async function() {
  var resp = await fetch('data/music-videos.json');
  if (!resp.ok) {
    document.getElementById('mvGrid').innerHTML = '<p class="no-results">Couldn\'t load the music video data. Check yer connection and refresh.</p>';
    return;
  }
  var data = await resp.json();

  function esc(str) {
    if (str == null) return '';
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // Stats
  var videos = data.videos || [];
  var albums = new Set(videos.map(function(v) { return v.album; }));
  var directors = new Set(videos.filter(function(v) { return v.director; }).map(function(v) { return v.director; }));
  var decades = new Set(videos.map(function(v) { return Math.floor(v.year / 10) * 10; }));

  document.getElementById('statTotal').textContent = videos.length;
  document.getElementById('statAlbums').textContent = albums.size;
  document.getElementById('statDirectors').textContent = directors.size;
  document.getElementById('statDecades').textContent = decades.size;

  if (data.playlistUrl) {
    document.getElementById('playlistLink').href = data.playlistUrl;
  }
  if (data.credit) {
    document.getElementById('creditLine').textContent = data.credit + ' - Last updated ' + data.lastUpdated;
  }

  // Build cards (oldest to newest)
  var sorted = videos.slice().sort(function(a, b) {
    if (a.year !== b.year) return a.year - b.year;
    return a.song.localeCompare(b.song);
  });

  var grid = document.getElementById('mvGrid');
  sorted.forEach(function(v) {
    var card = document.createElement('div');
    card.className = 'mv-card';
    var decade = Math.floor(v.year / 10) * 10;
    card.setAttribute('data-decade', String(decade));
    var searchBlob = [v.song, v.album, v.director, String(v.year)].filter(Boolean).join(' ').toLowerCase();
    card.setAttribute('data-search', searchBlob);

    var isFallback = !v.youtubeId;
    var thumbInner = v.thumbnailUrl
      ? '<img src="' + esc(v.thumbnailUrl) + '" alt="' + esc(v.song) + ' music video thumbnail" loading="lazy" data-onerror="placeholder" data-placeholder="' + esc(v.song) + '">'
      : '<div class="mv-thumb-placeholder">' + esc(v.song) + '</div>';
    var thumbHtml =
      '<a class="mv-thumb" href="' + esc(v.youtubeUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Watch ' + esc(v.song) + '">' +
        thumbInner +
        '<span class="mv-thumb-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
      '</a>';

    var trilogyBadge = v.trilogy ? '<span class="mv-trilogy-badge">Part of trilogy</span>' : '';
    var directorHtml = v.director
      ? '<div class="mv-director">dir. ' + esc(v.director) + '</div>'
      : '<div class="mv-director unknown">director unknown</div>';
    var notesHtml = v.notes ? '<div class="mv-notes">' + esc(v.notes) + '</div>' : '<div class="mv-notes"></div>';
    var watchClass = isFallback ? 'mv-watch fallback' : 'mv-watch';
    var watchLabel = isFallback ? 'Search on YouTube &rarr;' : 'Watch on YouTube &rarr;';

    card.innerHTML =
      thumbHtml +
      '<div class="mv-body">' +
        '<div class="mv-song"><a href="' + esc(v.youtubeUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(v.song) + '</a></div>' +
        '<div class="mv-album-year"><span class="mv-album">' + esc(v.album) + '</span> &middot; ' + esc(String(v.year)) + '</div>' +
        directorHtml +
        trilogyBadge +
        notesHtml +
        '<a class="' + watchClass + '" href="' + esc(v.youtubeUrl) + '" target="_blank" rel="noopener noreferrer">' + watchLabel + '</a>' +
      '</div>';

    grid.appendChild(card);
  });

  // Filter logic
  var activeDecade = 'all';
  var activeSearch = '';
  var filterBtns = document.querySelectorAll('.filter-btn');
  var searchInput = document.getElementById('filterSearch');

  function applyFilters() {
    var cards = grid.querySelectorAll('.mv-card');
    var visible = 0;
    cards.forEach(function(card) {
      var matchDecade = activeDecade === 'all' || card.getAttribute('data-decade') === activeDecade;
      var matchSearch = !activeSearch || card.getAttribute('data-search').indexOf(activeSearch) !== -1;
      var show = matchDecade && matchSearch;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var noRes = grid.querySelector('.no-results');
    if (visible === 0) {
      if (!noRes) {
        noRes = document.createElement('p');
        noRes.className = 'no-results';
        noRes.textContent = 'No videos match those filters.';
        grid.appendChild(noRes);
      }
    } else if (noRes) {
      noRes.remove();
    }
  }

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeDecade = btn.getAttribute('data-decade');
      applyFilters();
    });
  });

  searchInput.addEventListener('input', function() {
    activeSearch = searchInput.value.trim().toLowerCase();
    applyFilters();
  });
})();
