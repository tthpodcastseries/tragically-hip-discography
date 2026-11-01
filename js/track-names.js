// track-names.js - tidy track names for the live-recording player (audit DATA-07 / BRAND-01)
// Many recordings came from the archive with file names instead of song titles
// ("Track01", "tth1996 07 11d01t18 TheWherewithal", "thetragicallyhip1998 09 24audiencet05").
// This only changes what is shown: data/tour-tracks.json is never edited.
// Used by js/tour-map-player.js (player and its track list) and js/home.js (show card track list).
(function() {
  var MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
  var FILE_NAME = [
    /^[\s.,#()\-]*\d{0,3}[\s.,#()\-]*$/,                      // a bare track number: "01", "15 - " (not a year like "1979")
    /^(?:\d{1,3}\s+){2,}[a-z]?$/i,                             // number runs: "11 13 4 a"
    /^(?:audio\s*)?track\s*(?:no\.?\s*)?\d*(?:\s+\d+)*$/i,      // "Track01", "Track 01 15", "AudioTrack 05", "Track No03", "Audio Track"
    /^disc\s+(?:one|two|three|\d+)\s+\d+$/i,                    // "Disc One 01"
    /(?:^|[^a-z])d\s?\d{1,2}\s?t(?:rk)?\s?\d{1,3}/i,            // disc/track codes: "d01t18", "D1T10", "tth d2 t 2", "D1Trk10"
    /(?:\d|[a-z]{3})t\d{1,3}(?:\b|$)/i,                         // taper codes: "audiencet05", "19951028t01", "neumannkm184t25" (not "PT1")
    /(?:^|\s)[tT]\d{1,3}(?:\s|$|[A-Z])/,                        // "T1 GiftShop", "T10LockedInTheTrunkOfACar", "c t01"
    /(?:19[89]\d|20[0-2]\d)[ ._\-]\d{1,2}[ ._\-]\d{1,2}/,       // dates: "1996 07 11", "1999 5 8"
    /(?:19[89]\d|20[0-2]\d)(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])/, // dates: "19921114", "20130701"
    new RegExp('\\d{1,2}' + MONTH + '(?:19|20)\\d\\d', 'i'),                  // run-together dates: "12Aug1995", "21Jun1996"
    new RegExp(MONTH + '\\d{1,2},?(?:19|20)\\d\\d', 'i'),                     // "May112007", "jan27,2007"
    new RegExp(MONTH + '(?:19|20)\\d\\d', 'i'),                                 // "June2003"
    /\d{1,2} \d{2} (?:19|20)\d\d/,                              // "28 06 1992"
    /^(?:tth|thip|ttb|th)(?:\s|\d)/i,                           // taper prefixes: "tth halifax01", "TTH2000 ...", "thip2007"
    /^(?:the\s*)?hip\d/i,                                       // "hip1991 08 04d1t1"
    /tra(?:gi|ig)cally\s*(?:hip)?.*(?:19|20)\d\d/i,             // band name plus a year: "Tragically Hip 2000 12 05 ...", "Tragically Hip 3 from Berlin 1997"
    /^[a-z]+\d{2}$/i,                                           // "milab01", "halifax01"
    /\b(?:mp3|flac|sbd|wav|shn|dpa\d+)\b/i                      // file and gear words
  ];

  // Some names are a real title with the band name tacked on: "Poets Tragically Hip Las Vegas December 15 2012",
  // "Courage The Tragically Hip", "Tragically Hip, The Locked in the Trunk of a Car". Keep just the title.
  function stripBandName(name) {
    var m = name.match(/^(.+?)\s+(?:the\s+)?tragically\s+hip\b.*$/i);
    if (m && !/^the$/i.test(m[1].trim()) && !/[\[\]()]/.test(m[1])) return m[1].trim();
    m = name.match(/^tragically\s+hip,\s*the\s+(.+)$/i);
    if (m) return m[1].trim();
    return name;
  }

  // A file name often ends with the song after its track code: "T8TheWherewithal",
  // "tth1996 07 11d01t18 TheWherewithal", "The Tragically Hip TTH 1996 09 30 01 Grace Too".
  // Track codes: disc/track ("d01t18", "D1T10", "d1 t1", "D1Trk10"), "Disc101", "d101", "t05",
  // "Track 3", and a track number straight after a date ("1996 09 30 01", "May112007 01").
  var DATE_SRC = '(?:(?:19[89]\\d|20[0-2]\\d)[ ._\\-]\\d{1,2}[ ._\\-]\\d{1,2}|' + MONTH + '\\d{1,2},?(?:19|20)\\d\\d|\\d{1,2}' + MONTH + '(?:19|20)\\d\\d)';
  var TRACK_CODE = new RegExp([
    'd\\s?\\d{1,2}\\s?t(?:rk)?\\s?\\d{1,3}(?!\\d)',
    'disc\\s?\\d{1,3}(?!\\d)',
    '\\bd\\d{3}\\b',
    't\\d{1,3}(?!\\d)',
    'track\\s*\\d{1,3}(?!\\d)',
    DATE_SRC + '\\s+\\d{1,2}(?!\\d)'
  ].join('|'), 'gi');
  var JUNK_WORD = /^(?:audience|sbd|flac|mp3|wav|shn|matrix|jgm|cd|soundcheck|bonus)$/i;

  // The readable title left after the last track code, CamelCase split into words; '' if none.
  // Wording and capitals are kept as the file has them (no renaming to the official title).
  function titleFromFileName(name) {
    var live = name.match(/^(?:the\s+)?tra(?:gi|ig)cally\s*hip\s+(.+?)\s+live\s*@/i);  // "... X Live @ Parkpop, ..."
    if (live && !/\d/.test(live[1])) return live[1].trim();
    var end = -1, m;
    TRACK_CODE.lastIndex = 0;
    while ((m = TRACK_CODE.exec(name))) {
      end = Math.max(end, m.index + m[0].length);
      if (m[0] === '') TRACK_CODE.lastIndex++;
    }
    if (end < 0) return '';                         // no track code: a venue or city line, or a bare file name
    var rest = name.slice(end)
      .replace(/([A-Za-z])fm$/, '$1')              // taper tag glued on: "Wheat Kingsfm", "NOISfm"
      .replace(/([a-z])([A-Z])/g, '$1 $2')          // "NewOrleansIsSinking" -> "New Orleans Is Sinking"
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');    // "ABeautiful" -> "A Beautiful"
    var words = rest.split(/\s+/).filter(function(w) {
      if (!w || JUNK_WORD.test(w)) return false;
      // drop gear and file codes like "dpa4061", "D50", "V3"; keep "100th", "700FT"
      return !(/\d/.test(w) && /[a-z]/i.test(w) && !/^\d+(?:st|nd|rd|th|ft)\.?$/i.test(w));
    });
    var title = words.join(' ').replace(/^[\s.,:;_\-]+|[\s.,:;_\-]+$/g, '');
    // Nothing readable: no word of 3+ letters, a short code like "NOIS", a taper's "new" tag, or a
    // one-word lower-case file stub like "bobc", "abac", "gus" (one 2004 taper names every track that way)
    if (!/[a-z]{3,}/i.test(title) || /^[A-Z]{1,4}$/.test(title) || /^new$/i.test(title) || /^[a-z]+$/.test(title)) return '';
    return title;
  }

  // name: the track's name from the data; number: its place in the recording (1, 2, 3 ...)
  window.tthTrackName = function(name, number) {
    var fallback = number ? 'Track ' + number : 'Unknown track';
    var raw = String(name || '').trim();
    if (!raw) return fallback;
    var shown = stripBandName(raw);
    for (var i = 0; i < FILE_NAME.length; i++) {
      if (FILE_NAME[i].test(shown)) return titleFromFileName(shown) || fallback;
    }
    return shown;
  };
})();
