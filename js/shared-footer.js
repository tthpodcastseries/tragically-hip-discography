// shared-footer.js - The Hip Compendium
// Injects site footer and registers service worker
(function() {
  var version = 'v3.4 (The Luxury)';

  var footerEl = document.getElementById('site-footer');
  if (footerEl) {
    footerEl.className = 'site-footer';
    footerEl.innerHTML =
      '<div class="footer-buttons">' +
        '<a href="mailto:jd@tthpods.com" class="footer-btn">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
          'Connect with jD' +
        '</a>' +
        '<a href="https://tthpods.kit.com/products/tipsforjd" target="_blank" rel="noopener noreferrer" class="footer-btn">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z"/></svg>' +
          'Leave A Tip' +
        '</a>' +
      '</div>' +
      '<a href="https://subscribe.tthpods.com" target="_blank" rel="noopener noreferrer" class="yer-letter-link">Sign up For Yer Letter - The TTH Podcast Series Newsletter</a><br>' +
      '<strong style="color:#aaa">The Tragically Hip</strong> - Gord Downie (1964-2017)<br>' +
      'Designed by <a href="https://www.tragicallyhippodcast.com" target="_blank" rel="noopener noreferrer">The Tragically Hip Podcast Series</a> - Coded by Claude<br>' +
      '<span style="color:#888;font-size:0.72rem;">Unplucked Gems curated by Alonx</span><br>' +
      '<span style="color:#666;font-size:0.7rem;">' + version + '</span>';
  }

  // Wire existing "Yer Discussions" menu links into the SSO flow.
  // Any <a href="https://forum.tthpods.com"> on the page will, for unlocked
  // non-guest members, be intercepted and submitted as a form POST to
  // /.netlify/functions/sso-login (verifies the membersHIP server-side,
  // exchanges for a Flarum session cookie, redirects to the forum).
  // Guests and locked users fall through to the plain link behaviour.
  function wireForumLinks() {
    var member = window.TTHMember;
    if (!member || typeof member.isUnlocked !== 'function' || !member.isUnlocked()) return;
    var session = member.getSession();
    if (!session) return;
    // Guest bypass (TheHip/1984) cannot SSO into the forum — let the plain link
    // carry them to the public-facing forum view instead.
    if (session.firstName === 'TheHip' && session.memberNumber === 1984) return;

    var links = document.querySelectorAll('a[href="https://forum.tthpods.com"], a[href="https://forum.tthpods.com/"]');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var form = document.createElement('form');
          form.method = 'POST';
          form.action = '/.netlify/functions/sso-login';
          form.style.display = 'none';

          var fn = document.createElement('input');
          fn.type = 'hidden';
          fn.name = 'first_name';
          fn.value = session.firstName;
          form.appendChild(fn);

          var num = document.createElement('input');
          num.type = 'hidden';
          num.name = 'member_number';
          num.value = String(session.memberNumber);
          form.appendChild(num);

          document.body.appendChild(form);
          form.submit();
        });
      })(links[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireForumLinks);
  } else {
    wireForumLinks();
  }

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js');
    });
  }
})();
