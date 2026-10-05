/* The Initiative Hub's search (Perry, 5 Oct 2026): the home page's design and its way of reading
   what people mean (assets/search-core.js), over the Hub's own contents. Initiatives are searched
   by everything written about them, so "regulator exams" finds the Mortgage Compliance Dataset and
   "Erin" finds the initiatives she facilitates. Domains, potential initiatives (read live),
   workgroups and the Hub's tasks are searched too. The sidebar box feeds this one on this page. */
(function () {
  'use strict';
  const MS = window.MismoSearch, RS = window.ResourcesSession;
  const mast = document.querySelector('#view-initiatives > header.mast');
  if (!MS || !mast || typeof initiatives === 'undefined') return;

  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const text = v => { const el = document.createElement('div'); el.innerHTML = String(v == null ? '' : v); return el.textContent; };
  const I = d => `<svg class="ha-i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const P = { search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M20 20l-4-4', arrow: 'M5 12h14 M13 6l6 6-6 6', bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
    team: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M17 11a3 3 0 1 0 0-6 M21 20c0-2.6-1.7-4.8-4-5.6',
    plus: 'M12 5v14 M5 12h14', cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4 M3 10h18', grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z' };

  /* ---------- the box ---------- */
  const style = document.createElement('style');
  style.textContent = `
  .hub-ask{max-width:860px;margin:4px 0 26px}
  .ha-box{display:flex;align-items:center;gap:12px;background:var(--surface);border:2px solid var(--sky);border-radius:16px;padding:0 18px;box-shadow:0 18px 40px -26px rgba(15,49,76,.55)}
  .ha-box > .ha-i{color:var(--sky);width:22px;height:22px}
  .ha-box input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:17px;padding:17px 0}
  .ha-box input::placeholder{color:var(--ink-3)}
  .ha-box input::-webkit-search-cancel-button,.ha-box input::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}
  .ha-box kbd{font:600 11px var(--font);color:var(--ink-3);border:1px solid var(--line-2);border-radius:5px;padding:1px 6px}
  .ha-clear{border:0;background:var(--sunk);color:var(--ink-2);border-radius:999px;width:26px;height:26px;cursor:pointer;font-size:15px}
  .ha-i{width:1em;height:1em;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .ha-res{margin-top:12px;background:var(--surface);border:1px solid var(--line-2);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
  .ha-best{display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--accent-soft)}
  .ha-lbl{font-size:12px;font-weight:700;color:var(--accent)}
  .ha-t{font-size:16.5px;font-weight:700;color:var(--ink)} .ha-s{font-size:13px;color:var(--ink-2);margin-top:2px}
  .ha-go{margin-left:auto;flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;border:0;border-radius:8px;padding:9px 15px;font:inherit;font-size:13.5px;font-weight:700;background:var(--btn);color:var(--btn-ink);cursor:pointer;text-decoration:none}
  .ha-grp{padding:12px 18px 2px;font-size:12px;font-weight:700;color:var(--ink-3);border-top:1px solid var(--line)}
  .ha-best + .ha-grp{border-top:0}
  .ha-list{list-style:none;margin:0;padding:4px 0}
  .ha-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 18px;background:none;border:0;font:inherit;text-align:left;color:inherit;cursor:pointer;text-decoration:none}
  .ha-row:hover,.ha-row:focus-visible{background:var(--sunk)}
  .ha-row .ha-t{font-size:14px} .ha-row .ha-s{font-size:12.5px;margin:0}
  .ha-ico{flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--sunk);color:var(--accent)}
  .ha-ico svg{width:18px;height:18px}
  .ha-best .ha-ico{width:46px;height:46px;border-radius:12px;background:var(--surface)} .ha-best .ha-ico svg{width:22px;height:22px}
  .ha-why{display:inline-flex;flex-wrap:wrap;gap:4px;margin-top:4px}
  .ha-why span{font-size:11.5px;color:var(--ink-3);border:1px solid var(--line-2);border-radius:999px;padding:0 8px}
  .ha-none{padding:16px 18px;font-size:13.5px;color:var(--ink-2)}
  .ha-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`;
  document.head.appendChild(style);
  const wrap = document.createElement('div');
  wrap.className = 'hub-ask';
  wrap.innerHTML = `<label class="ha-box">${I(P.search)}<span class="ha-vh">Search the Initiative Hub</span>
      <input id="hubQ" type="search" placeholder="Search initiatives, workgroups, people and topics" autocomplete="off" aria-controls="hubResults" aria-describedby="hubQnote">
      <button type="button" class="ha-clear" id="hubQclear" aria-label="Clear the search" hidden>&times;</button><kbd aria-hidden="true">/</kbd></label>
    <div class="ha-vh" id="hubQnote" aria-live="polite"></div>
    <div class="ha-res" id="hubResults" hidden></div>`;
  mast.insertAdjacentElement('afterend', wrap);
  const q = document.getElementById('hubQ'), box = document.getElementById('hubResults'), clearBtn = document.getElementById('hubQclear');

  /* ---------- what it searches ---------- */
  const abbr = d => ((typeof domainMeta !== 'undefined' && domainMeta[d]) || {}).abbr || '';
  const strings = o => Object.entries(o || {}).filter(([k]) => !/^(href|sample|lifecycle|status|id)$/.test(k)).flatMap(([, v]) => Array.isArray(v) ? v : [v]).filter(v => typeof v === 'string').map(text).join(' ');
  const items = [];
  initiatives.forEach(i => items.push({ kind: 'Initiative', t: text(i.title), a: [].concat(i.domains || [], (i.domains || []).map(abbr), i.facilitator || '').join(' '), d: strings(i), w: .9,
    href: i.href || '', domain: (i.domains || [])[0], sub: [(i.domains || []).join(', '), i.facilitator ? 'Facilitator: ' + i.facilitator : ''].filter(Boolean).join(' \u00b7 ') }));
  (typeof domainOrder !== 'undefined' ? domainOrder : []).forEach(d => items.push({ kind: 'Domain', t: d, a: abbr(d), d: (domainMeta[d] || {}).desc || '', w: .6, domain: d, sub: (domainMeta[d] || {}).desc || '' }));
  const TASKS = [
    ['Submit a work request', 'request change update revise fix amend correction standard specification dataset work request propose', 'work-requests.html#new', 'hub-requests'],
    ['Log a potential initiative', 'log new idea propose proposal potential initiative add suggest record', 'potential-edit.html'],
    ['See the meeting calendar', 'meeting meetings calendar schedule when dates agenda workgroup times', 'calendar.html'],
    ['Browse potential initiatives', 'potential ideas proposals under consideration pipeline', '#potential'],
  ];
  TASKS.forEach(([t, a, href, key]) => { if (!key || !RS || RS.isPlatformAdmin && RS.isPlatformAdmin() || (RS.role && RS.role(key))) items.push({ kind: 'Things to do', t, a, d: '', w: .5, href, sub: '' }); });
  /* potential initiatives and workgroups: loaded on the first search */
  let more = 'none';
  function loadMore() {
    if (more !== 'none') return; more = 'loading';
    const get = u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([get('/assets/home-index.json'), get('data/potential/index.json')]).then(([idx, pot]) => {
      ((idx && idx.items) || []).filter(x => x.k === 'Workgroup').forEach(w => items.push({ kind: 'Workgroup', t: w.t, a: w.x || '', d: '', w: .3, href: 'calendar.html', sub: 'Meetings on the Initiative Hub calendar' }));
      return Promise.all(((pot && pot.ids) || []).map(id => get('data/potential/' + encodeURIComponent(id) + '.json').then(p => p && items.push({ kind: 'Potential initiative', t: p.name || id,
        a: [p.domain || '', abbr(p.domain), p.facilitator || ''].join(' '), d: strings(p), w: .7, href: 'potential.html?id=' + encodeURIComponent(id), sub: p.summary || p.domain || '' }))));
    }).then(() => { more = 'ready'; if (q.value.trim()) draw(); });
  }

  /* ---------- results ---------- */
  const ORDER = ['Initiative', 'Potential initiative', 'Domain', 'Workgroup', 'Things to do'];
  const iconOf = it => {
    if ((it.kind === 'Initiative' || it.kind === 'Domain') && typeof domainIcons !== 'undefined' && domainIcons[it.domain]) {
      const m = domainMeta[it.domain] || {}; return `<span class="ha-ico" style="color:${m.color || 'var(--accent)'};background:${m.soft || 'var(--sunk)'}">${domainIcons[it.domain]}</span>`; }
    return `<span class="ha-ico">${I(it.kind === 'Potential initiative' ? P.bulb : it.kind === 'Workgroup' ? P.team : it.kind === 'Things to do' ? (it.href === 'calendar.html' ? P.cal : P.plus) : P.grid)}</span>`;
  };
  const why = h => h.why.length ? `<span class="ha-why">${h.why.slice(0, 3).map(w => `<span>${esc(w)}</span>`).join('')}</span>` : '';
  /* What a result does: open its page, or its domain on this page. */
  const actionAttrs = it => it.href ? `href="${esc(it.href)}"` : `data-domain="${esc(it.domain)}"`;
  const tagFor = it => it.href ? 'a' : 'button type="button"';
  const closeTag = it => it.href ? 'a' : 'button';
  let best = null;
  function draw() {
    const query = q.value;
    clearBtn.hidden = !query;
    if (!query.trim()) { box.hidden = true; box.innerHTML = ''; best = null; document.getElementById('hubQnote').textContent = ''; return; }
    const hits = MS.rank(items, query);
    best = hits[0] || null;
    let html = '';
    if (best) {
      const it = best.it, verb = it.href ? (it.kind === 'Things to do' ? 'Start' : 'Open') : 'Show';
      html += `<div class="ha-best">${iconOf(it)}<div style="min-width:0"><div class="ha-lbl">Best match \u00b7 ${esc(it.kind)}</div><div class="ha-t">${esc(it.t)}</div>${it.sub ? `<div class="ha-s">${esc(it.sub)}</div>` : ''}${why(best)}</div>
        <${tagFor(it)} class="ha-go" ${actionAttrs(it)}>${verb} ${I(P.arrow)}</${closeTag(it)}></div>`;
      for (const kind of ORDER) {
        const rows = hits.slice(1).filter(h => h.it.kind === kind).slice(0, 5);
        if (!rows.length) continue;
        html += `<div class="ha-grp">${kind === 'Things to do' ? kind : kind + (rows.length > 1 ? 's' : '')}</div><ul class="ha-list">${rows.map(h => `<li><${tagFor(h.it)} class="ha-row" ${actionAttrs(h.it)}>${iconOf(h.it)}
          <span style="min-width:0"><span class="ha-t" style="display:block">${esc(h.it.t)}</span>${h.it.sub ? `<span class="ha-s" style="display:block">${esc(h.it.sub)}</span>` : ''}${why(h)}</span></${closeTag(h.it)}></li>`).join('')}</ul>`;
      }
    } else {
      html = `<div class="ha-none">Nothing in the Hub matches \u201c${esc(query.trim())}\u201d${more === 'loading' ? ' yet; still loading potential initiatives and workgroups' : ''}. Try part of a name, a topic, a domain or a person.</div>`;
    }
    box.hidden = false; box.innerHTML = html;
    document.getElementById('hubQnote').textContent = best ? `Best match: ${best.it.t}. Press Enter to open it, or the down arrow to go through the results.` : 'No results.';
  }
  function go(it) {
    if (!it) return;
    if (it.href) { location.href = it.href; return; }
    if (it.domain && typeof renderTiles === 'function') {   /* the domain's panel, as if its tile were clicked */
      activeDomain = it.domain; renderTiles(); renderPanel();
      const pa = document.getElementById('panelArea'); if (pa) pa.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  let timer = null;
  q.addEventListener('focus', loadMore);
  q.addEventListener('input', () => { loadMore(); clearTimeout(timer); timer = setTimeout(draw, q.value.trim() ? 90 : 0); });
  clearBtn.addEventListener('click', () => { q.value = ''; draw(); q.focus(); });
  box.addEventListener('click', e => { const b = e.target.closest('[data-domain]'); if (b) { go({ domain: b.dataset.domain }); } });
  document.addEventListener('keydown', e => {
    const a = document.activeElement, typing = a && /input|textarea|select/i.test(a.tagName) || (a && a.isContentEditable);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.getElementById('view-initiatives').hidden) { e.preventDefault(); q.focus(); return; }
    if (e.key === 'Escape' && (a === q || box.contains(a)) && q.value) { q.value = ''; draw(); q.focus(); return; }
    if (e.key === 'Enter' && a === q && best) { e.preventDefault(); go(best.it); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (a === q || box.contains(a)) && !box.hidden) {
      const links = [...box.querySelectorAll('a, button')]; if (!links.length) return;
      e.preventDefault();
      const i = links.indexOf(a);
      if (e.key === 'ArrowDown') (links[i + 1] || links[0]).focus(); else if (i <= 0) q.focus(); else links[i - 1].focus();
    }
  });
  /* The sidebar's box feeds this search on this page (on Potential Initiatives it still filters the cards). */
  const railQ = document.getElementById('railQ');
  if (railQ) railQ.addEventListener('input', () => {
    if (typeof currentView !== 'undefined' && currentView === 'potential') return;
    query = ''; if (typeof renderSearch === 'function') renderSearch();
    q.value = railQ.value; loadMore(); draw();
  });
})();
