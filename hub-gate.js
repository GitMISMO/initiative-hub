/* The whole Initiative Hub is behind the shared resources.mismo.org sign-in (Perry, 30 Sept 2026).
   Each Hub page marks <html data-rs-gate>, which keeps it hidden until this has decided: a person
   without access to the Hub sees the shared sign-in or refusal screen instead of the page.
   The sidebar's Work Requests group is shown to people who also have access to Work Requests.
   Opened from disk, where /assets/session.js is not there, the page simply shows. */
(function () {
  var RS = window.ResourcesSession;
  if (!RS) { document.documentElement.classList.remove('rs-wait'); return; }
  function whenReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  /* Ideas Inbox (Perry, 16 Oct 2026): for the same people as All Work Requests, just above it, made from that link so it
     takes each page's own look (the Hub's pages and the generated overviews differ). Its count is the ideas still
     waiting for someone to reach out, read quietly: if the read fails, the link simply has no count. */
  function ideasLink(all) {
    if (all.parentNode.querySelector('a[href$="#ideas"]')) return;
    var a = all.cloneNode(true);
    a.setAttribute('href', all.getAttribute('href').replace(/#all$/, '#ideas'));
    if (a.hasAttribute('title')) a.setAttribute('title', 'Ideas Inbox');
    a.removeAttribute('aria-current');
    var label = a.querySelector('span'); if (label) label.textContent = 'Ideas Inbox';
    var path = a.querySelector('svg path'); if (path) path.setAttribute('d', 'M4 13l2.5-8h11l2.5 8v6H4z M4 13h5l1 2h4l1-2h5');
    all.parentNode.insertBefore(a, all);
    var tok = RS.token && RS.token(); if (!tok || !window.fetch) return;
    fetch('https://rgvdi67cg27o5kcmiytcqbqnrm0hmztx.lambda-url.us-east-1.on.aws/hub-requests/data/ideas', { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + tok } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        var docs = b && b.data && b.data.docs, n = 0; if (!docs) return;
        Object.keys(docs).forEach(function (k) { if (docs[k] && docs[k].status === 'open') n++; });
        if (!n) return;
        var c = document.createElement('b'); c.textContent = n; c.setAttribute('aria-label', n + ' waiting');
        c.style.cssText = 'margin-left:auto;font-style:normal;font-size:11px;font-weight:700;background:#E0A83C;color:#06202f;border-radius:999px;padding:0 7px;line-height:18px';
        a.appendChild(c);
      }, function () {});
  }
  function showRequests() {
    var g = document.getElementById('wrGroup'); if (!g) return;
    var has = function () { return !!RS.role('hub-requests'); };
    /* All Work Requests is for the people who decide on them: Work Requests administrators
       and platform administrators. Everyone else sees their own, under My Work Requests. */
    var all = g.querySelector('a[href$="#all"]');
    var decides = RS.role('hub-requests') === 'admin' || (RS.isPlatformAdmin && RS.isPlatformAdmin());
    if (all && !decides) all.remove();
    if (all && decides) ideasLink(all);
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
