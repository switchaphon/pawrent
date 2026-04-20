// Pawrent landing — analytics stub
// Exposes window.pawrentAnalytics.trackEvent(name, props) with console logging by default.
// Wire GA4 or Plausible by uncommenting the relevant block below.
(function () {
  var ENABLED = true;

  function trackEvent(name, props) {
    if (!ENABLED) return;
    var payload = props || {};
    try { console.debug('[pawrent:event]', name, payload); } catch (_) {}

    // GA4 — uncomment and add <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
    // if (typeof gtag === 'function') gtag('event', name, payload);

    // Plausible — uncomment and add <script defer data-domain="pawrent.pops.pet" src="https://plausible.io/js/script.js"></script>
    // if (typeof plausible === 'function') plausible(name, { props: payload });
  }

  window.pawrentAnalytics = { trackEvent: trackEvent };

  // Optional page_view on load (cheap signal, no PII)
  trackEvent('page_view', { path: location.pathname });
})();
