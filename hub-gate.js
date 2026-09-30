/* The whole Initiative Hub is behind the shared resources.mismo.org sign-in (Perry, 30 Sept 2026).
   Each Hub page marks <html data-rs-gate>, which keeps it hidden until this has decided: a person
   without access to the Hub sees the shared sign-in or refusal screen instead of the page.
   The sidebar's Work Requests group is shown to people who also have access to Work Requests.
   Opened from disk, where /assets/session.js is not there, the page simply shows. */
(function () {
  var RS = window.ResourcesSession;
  if (!RS) { document.documentElement.classList.remove('rs-wait'); return; }
  function whenReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function showRequests() {
    var g = document.getElementById('wrGroup'); if (!g) return;
    var has = function () { return !!RS.role('hub-requests'); };
    if (has()) { g.hidden = false; return; }
    /* The browser's copy of someone's access is taken at sign-in; ask the relay before hiding it. */
    if (RS.refreshAccess) RS.refreshAccess(['hub-requests']).then(function () { if (has()) g.hidden = false; }, function () {});
  }
  /* After the page is parsed: the sign-in screen needs the page's body to attach to. Until then
     data-rs-gate keeps the page hidden, so nothing shows before the decision. */
  whenReady(function () {
    RS.requireAccess('hub', { toolName: 'the Initiative Hub', eyebrow: 'Programs & Operations' })
      .then(showRequests, function () { document.documentElement.classList.remove('rs-wait'); });
  });
})();
