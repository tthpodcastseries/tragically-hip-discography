// tour-map-player.js - the tour map audio player (moved out of tour-map.html in v5.4.17)
(function() {
  const player = document.getElementById('audioPlayer');
  const progressBar = document.getElementById('apProgressBar');
  const showTitle = document.getElementById('apShowTitle');
  const trackTitle = document.getElementById('apTrackTitle');
  const timeDisplay = document.getElementById('apTime');
  const playPauseBtn = document.getElementById('apPlayPause');
  const playIcon = document.getElementById('apPlayIcon');
  const prevBtn = document.getElementById('apPrev');
  const nextBtn = document.getElementById('apNext');
  const closeBtn = document.getElementById('apClose');
  const listToggle = document.getElementById('apListToggle');
  const tracklist = document.getElementById('apTracklist');
  const volumeSlider = document.getElementById('apVolume');

  const audio = new Audio();
  audio.volume = 0.8;
  let currentShow = null;
  let currentTrackIndex = 0;
  let tracks = [];

  function formatTime(s) {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function updatePlayIcon(playing) {
    const name = playing ? 'Pause' : 'Play';
    playPauseBtn.setAttribute('aria-label', name);
    playPauseBtn.title = name;
    playIcon.innerHTML = playing
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  function renderTracklist() {
    tracklist.innerHTML = '';
    if (currentShow && currentShow.recordingNote) {
      const note = document.createElement('div');
      note.className = 'ap-track-note';
      note.textContent = currentShow.recordingNote;
      tracklist.appendChild(note);
    }
    tracks.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'ap-track' + (i === currentTrackIndex ? ' active' : '');
      // Reachable and playable from the keyboard
      div.setAttribute('role', 'button');
      div.tabIndex = 0;
      if (i === currentTrackIndex) div.setAttribute('aria-current', 'true');
      div.innerHTML = `<span class="ap-track-num">${i + 1}</span><span class="ap-track-name">${t.name}</span><span class="ap-track-dur">${t.duration || ''}</span>`;
      div.addEventListener('click', () => playTrack(i));
      div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playTrack(i); } });
      tracklist.appendChild(div);
    });
  }

  // Say what is happening in the track line, so a silent player never looks like it is playing
  // (audit FUNC-06). The track's own name comes back as soon as it plays.
  let failedIndex = -1;
  let skipTimer = null;
  function showStatus(msg) { trackTitle.textContent = msg; }

  function trackFailed(index) {
    if (failedIndex === index || index !== currentTrackIndex) return;
    failedIndex = index;
    updatePlayIcon(false);
    clearTimeout(skipTimer);
    if (index < tracks.length - 1) {
      showStatus("This recording couldn't be loaded - skipping to the next one.");
      skipTimer = setTimeout(() => { if (currentTrackIndex === index) playTrack(index + 1); }, 2000);
    } else {
      showStatus("This recording couldn't be loaded.");
    }
  }

  // Start playing and handle the browser saying no: no tap yet (NotAllowedError) or a missing/unreadable file
  function startPlayback() {
    let attempt;
    try { attempt = audio.play(); } catch (err) { attempt = Promise.reject(err); }
    if (!attempt || !attempt.catch) return;
    attempt.catch(err => {
      if (err && err.name === 'AbortError') return; // another track was picked first
      if (err && err.name === 'NotAllowedError') {
        updatePlayIcon(false);
        showStatus('Tap play to start');
      } else {
        trackFailed(currentTrackIndex);
      }
    });
  }

  function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    clearTimeout(skipTimer);
    currentTrackIndex = index;
    failedIndex = -1;
    trackTitle.textContent = tracks[index].name;
    audio.src = tracks[index].url;
    updatePlayIcon(false);
    startPlayback();
    renderTracklist();
  }

  const AUDIO_BASE = 'https://f006.backblazeb2.com/file/tth-audio';

  // Track lists for every recording, fetched the first time a show is played (audit PERF-04)
  let tracksPromise = null;
  function loadTracks() {
    if (!tracksPromise) tracksPromise = fetch('data/tour-tracks.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => { tracksPromise = null; throw e; });
    return tracksPromise;
  }

  async function loadShow(gig) {
    if (!gig) return;
    currentShow = gig;
    player.classList.add('active');
    showTitle.textContent = `${gig.isoDate || ''} - ${gig.venue || 'Unknown'}, ${gig.city || ''}`;
    if (!gig.tracks && gig.trackCount) {
      trackTitle.textContent = 'Loading the recording...';
      try { gig.tracks = (await loadTracks())[gig.id] || []; }
      catch (e) { trackTitle.textContent = "Couldn't load this recording. Check yer connection and try again."; return; }
      if (currentShow !== gig) return; // another show was picked while this one loaded
    }
    if (gig.tracks && gig.tracks.length) {
      tracks = gig.tracks.map(t => ({
        name: t.name || 'Unknown track',
        // Encode each path part - a raw '#' (e.g. 'Toronto #4.mp3') would cut the URL short
        url: t.url.startsWith('http') ? t.url : `${AUDIO_BASE}/${t.url.split('/').map(encodeURIComponent).join('/')}`,
        duration: t.duration || ''
      }));
      currentTrackIndex = 0;
      renderTracklist();
      playTrack(0);
    }
  }

  playPauseBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    if (audio.error || failedIndex === currentTrackIndex) { playTrack(currentTrackIndex); return; }
    if (audio.paused) startPlayback();
    else audio.pause();
  });
  prevBtn.addEventListener('click', () => { audio.currentTime > 3 ? audio.currentTime = 0 : playTrack(currentTrackIndex - 1); });
  nextBtn.addEventListener('click', () => playTrack(currentTrackIndex + 1));
  closeBtn.addEventListener('click', () => { clearTimeout(skipTimer); tracks = []; audio.pause(); audio.removeAttribute('src'); audio.load(); player.classList.remove('active'); tracklist.classList.remove('open'); listToggle.setAttribute('aria-expanded', 'false'); updatePlayIcon(false); });
  listToggle.addEventListener('click', () => {
    const open = tracklist.classList.toggle('open');
    listToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    listToggle.setAttribute('aria-label', open ? 'Hide tracklist' : 'Show tracklist');
    listToggle.title = open ? 'Hide tracklist' : 'Show tracklist';
  });
  volumeSlider.addEventListener('input', () => { audio.volume = parseFloat(volumeSlider.value); });
  const seekBar = document.getElementById('apSeek');
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = audio.currentTime / audio.duration * 100;
    progressBar.style.width = pct + '%';
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    seekBar.value = pct;
    seekBar.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} of ${formatTime(audio.duration)}`);
  });
  // A real slider: drag, click, or arrow keys (audit A11Y-04)
  seekBar.addEventListener('input', () => { if (audio.duration) audio.currentTime = (parseFloat(seekBar.value) / 100) * audio.duration; });
  // The button follows what the audio element is really doing
  audio.addEventListener('play', () => {
    updatePlayIcon(true);
    if (tracks[currentTrackIndex] && failedIndex !== currentTrackIndex) trackTitle.textContent = tracks[currentTrackIndex].name;
  });
  audio.addEventListener('pause', () => updatePlayIcon(false));
  audio.addEventListener('error', () => { if (tracks.length && audio.getAttribute('src')) trackFailed(currentTrackIndex); });
  audio.addEventListener('ended', () => { currentTrackIndex < tracks.length - 1 ? playTrack(currentTrackIndex + 1) : (updatePlayIcon(false), progressBar.style.width = '0%'); });

  window.tthPlayer = { loadShow };
  window.playGig = function(id) { var gig = window._gigLookup && window._gigLookup[id]; if (gig) loadShow(gig); };
})();
