"""Builds initiative-hub/help.html (Perry, 6 Nov 2026): Help for the Initiative Hub and Work Requests, in Jonna's pattern
(a guide for each kind of user: what you do here, good to know, what this is, how work moves). It takes the library
page's frame (styles, top bar, sidebar) from index.html so the two always match; run it again after changing either.
    python3 _dev/make-help.py
"""
import os, re, json, html
HERE = os.path.dirname(os.path.abspath(__file__)); HUB = os.path.dirname(HERE)
src = open(os.path.join(HUB, 'index.html'), encoding='utf-8').read()
e = lambda s: html.escape(s, quote=True)
head, rest = src.split('<body>', 1)
chrome = rest.split('<main>', 1)[0]
head = re.sub(r'<title>[^<]*</title>', '<title>Help — MISMO Initiative Hub</title>', head, count=1)
# the sidebar: the two library sections become links back to the library; no search box here; no Color Tour
chrome = chrome.replace('<button type="button" data-view="initiatives" title="MISMO Initiatives">', '<a href="index.html" title="MISMO Initiatives">')
chrome = chrome.replace('<button type="button" data-view="potential" title="Potential Initiatives">', '<a href="index.html#potential" title="Potential Initiatives">')
chrome = chrome.replace('<span>MISMO Initiatives</span><b class="count" id="countActive"></b></button>', '<span>MISMO Initiatives</span></a>')
chrome = chrome.replace('<span>Potential Initiatives</span><b class="count" id="countPotential"></b></button>', '<span>Potential Initiatives</span></a>')
chrome = re.sub(r'\s*<div class="railfind">.*?</div>', '', chrome, count=1, flags=re.S)
chrome = re.sub(r'\s*<button type="button" class="theme-btn" id="replayTourBtn".*?</button>', '', chrome, count=1, flags=re.S)
assert 'data-view=' not in chrome and 'railQ' not in chrome and 'replayTourBtn' not in chrome
GUIDES = {
 'hub': {'name': 'the Initiative Hub', 'what': 'The Initiative Hub keeps MISMO’s initiatives in one place: the library of MISMO and potential initiatives by lifecycle domain, each initiative’s dashboard, potential initiatives’ pages, and the Meeting Calendar.',
  'flowTitle': 'How an Initiative Comes Together',
  'flow': [['An Idea', 'Ideas Inbox', ''], ['A Work Request', 'confirmed, then approved', ''], ['Potential Initiative', 'Not Started → In Progress → In Approvals → Kick Off Set', 'ask'], ['Launched', '', ''], ['MISMO Initiative', 'In Development → Published', 'dk']],
  'roles': [
   ['Facilitator', 'You lead one or more initiatives for MISMO and keep their pages current.',
    ['Open your initiative from the Initiative Library: each lifecycle domain opens to its initiatives, and Pin keeps yours at the top.',
     'On its dashboard, keep the roster current: each organization’s engagement, contact and notes. Update deliverables and meetings as the work moves.',
     'For a potential initiative, add status updates as things happen, and fill in its stakeholders and potential leaders on the Stakeholders & Leadership tab.',
     'Move its stage when it’s ready: In Approvals and Kick Off Set ask for the date, which shows beside the facilitator.',
     'Start a new one from + New Potential Initiative in the library.'],
    ['Every change saves itself a moment later. “All changes saved” in the corner says it’s done; there is no Save button.',
     'If someone else saves the same page while you’re editing, you’ll be asked to reload, so nobody’s work is overwritten.',
     'Search the library by stakeholder type, like “LOS Provider,” to find every initiative that involves one.',
     'Files on a potential initiative open only for people signed in with access.']],
   ['Anyone with View Access', 'You follow MISMO’s initiatives. You can read everything here; changing it needs edit access.',
    ['Open MISMO Initiatives in the sidebar for the Initiative Library. Each lifecycle domain is one line; open one to see its initiatives.',
     'Search by name, description, facilitator or stakeholder type, or pick a stakeholder type to see every initiative that involves it.',
     'Pin the initiatives you follow; they gather at the top of the library.',
     'Open a card for its dashboard: what the initiative is building, who leads it, its stakeholders and when it meets.',
     'See every workgroup meeting in the Meeting Calendar.'],
    ['“View only” shows on pages you can read but not change.', 'Pins are kept in this browser.', 'Ask Perry Williams if you need edit access.']],
   ['Hub Admin', 'You look after the Hub itself: who can use it, and the lists every page relies on.',
    ['Give people access in People & Access in the Admin Console: view, edit or admin.',
     'Keep the facilitator list and the stakeholder types current; every dashboard and potential initiative uses them.',
     'Review new potential initiatives and Work Requests as they come in.'],
    ['Every change saves itself a moment later, on every page.', 'Questions, or something not working: tell Perry Williams.']]]},
 'work-requests': {'name': 'Work Requests', 'what': 'Work Requests is how new work reaches MISMO. Facilitators send them; Programs & Operations confirms each one, and the executive team decides.',
  'flowTitle': 'How a Work Request Moves',
  'flow': [['An Idea', 'Ideas Inbox', ''], ['Work Request Sent', 'To Confirm', ''], ['Confirmed', 'gets its WR number', ''], ['Approval Queue', 'with the executive team', ''],
           [['Approved', '', 'go'], ['More Information', '', 'ask'], ['Declined', 'to the Archive, with the reason', 'no']], [['A New Potential Initiative', '', 'dk'], ['Part of an Existing Initiative', '', 'dk']]],
  'roles': [
   ['Facilitator', 'Sending Work Requests is a core part of your role: it’s how your workgroup’s new work, or a change to a standard, reaches MISMO.',
    ['When your workgroup has new work to propose, choose New Work Request in the sidebar.',
     'Fill in each section of the form: what the work is, why it matters and who supports it. Your draft is saved, so you can finish it after your next call.',
     'Send it. It appears in My Work Requests, where you can follow it every step of the way.',
     'Programs & Operations confirms it and gives it its Work Request number, like WR2026_12, then it goes to the executive team.',
     'If the executive team needs more information, My Work Requests shows what they asked. Once it’s decided, you’ll see the outcome and where the work goes next.'],
    ['My Work Requests lists every request you’ve sent and where each one stands.',
     'An approved request becomes a new potential initiative, or joins an initiative already under way.',
     'Not ready for a full request? Send an idea instead; Programs & Operations reaches out about it.']],
   ['Programs & Operations', 'You confirm each Work Request, take it to the executive team and record what they decide.',
    ['Open All Work Requests. To Confirm lists the requests that have just come in.',
     'Confirm a request to give it its Work Request number, like WR2026_12. It moves to the Approval Queue.',
     'Set the date it goes to the executive team.',
     'After they meet, record the decision: approved, more information needed, or declined with the reason.',
     'For an approved request, choose where it goes: a new potential initiative or an existing initiative.',
     'Check the Ideas Inbox for ideas people have sent, reach out, and turn good ones into Work Requests.'],
    ['Declined requests move to the Archive with their reason.', 'Every Step shows all the requests at once, wherever they are.']]]}}
CSS = """
<style>
/* Help (Perry, 6 Nov 2026): Jonna's pattern, in the library's header */
.view.help{gap:0;padding:0}
.hp-switch{position:relative;display:inline-flex;gap:4px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:3px;margin-top:14px}
.hp-switch button{all:unset;cursor:pointer;font-size:12.5px;font-weight:700;color:#cfe3f1;padding:5px 14px;border-radius:999px}
.hp-switch button[aria-pressed="true"]{background:#fff;color:#0F314C} .hp-switch button:focus-visible{outline:2px solid #74BFEB}
.lb-tabs .lbl{align-self:center;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94C8E9;margin-right:6px}
.hp-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;margin-top:18px}
.hp-card{background:var(--surface);border:1px solid var(--line-2);border-radius:14px;padding:18px 20px;box-shadow:0 1px 2px rgba(15,49,76,.06),0 10px 26px -20px rgba(15,49,76,.45)}
.hp-card h2{font-family:Archivo,sans-serif;font-size:16.5px;margin:0 0 6px;color:var(--ink)} .hp-card h2.more{margin-top:18px}
.hp-who{color:var(--ink-2);margin:0 0 12px;font-size:14px}
.hp-steps{list-style:none;margin:0;padding:0;counter-reset:s}
.hp-steps li{counter-increment:s;display:grid;grid-template-columns:30px 1fr;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14px;line-height:1.5}
.hp-steps li::before{content:counter(s);width:26px;height:26px;border-radius:50%;background:#0F314C;color:#fff;font-weight:800;font-size:12.5px;display:flex;align-items:center;justify-content:center}
html[data-theme="dark"] .hp-steps li::before{background:#50A4DB;color:#0F314C}
.hp-good{margin:0;padding-left:18px;font-size:14px;line-height:1.55} .hp-good li{margin:4px 0}
.hp-what{margin:0;font-size:14px;line-height:1.6;color:var(--ink-2)}
.hp-q{margin-top:14px;padding:10px 12px;border-radius:10px;background:var(--sunk);font-size:13px;color:var(--ink-2)} .hp-q b{color:var(--ink)} .hp-q a{color:var(--accent)}
.hp-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}
.hp-node{border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;background:var(--sunk);color:var(--ink);border:1px solid var(--line-2);text-align:center}
.hp-node small{display:block;font-weight:600;font-size:11px;color:var(--ink-3)}
.hp-node.go{background:#E3F3EC;border-color:#BFE3D2;color:#0b5c44} .hp-node.no{background:#FBE9E7;border-color:#F1C9C4;color:#8a2a20} .hp-node.ask{background:#FBF1DE;border-color:#EBD7AE;color:#7a5413}
.hp-node.go small,.hp-node.no small,.hp-node.ask small{color:inherit;opacity:.8}
.hp-node.dk{background:#0F314C;color:#fff;border-color:#0F314C} .hp-node.dk small{color:#a9c7dc}
.hp-arr{color:var(--ink-3);font-weight:800} .hp-split{display:flex;flex-direction:column;gap:6px}
@media (max-width:900px){ .hp-grid{grid-template-columns:1fr} }
#hubHelpBtn[aria-current="page"]{background:rgba(116,191,235,.18);color:#fff;box-shadow:inset 3px 0 0 #74BFEB;font-weight:600}
</style>
"""
MAIN = """<main>
  <section class="view lib help" id="view-help" aria-label="Help"></section>
</main>
"""
SCRIPT = """<script>
  /* Help (Perry, 6 Nov 2026): one guide per kind of user, for the Hub and for Work Requests (#work-requests).
     Built by _dev/make-help.py from index.html's frame; the wording lives there. */
  const GUIDES = __GUIDES__;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const WAVES = '<svg class="waves" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true"><path d="M0 200 C 300 120, 600 260, 1200 150" stroke="#94C8E9" stroke-width="1.5" fill="none"/><path d="M0 230 C 350 160, 700 280, 1200 190" stroke="#94C8E9" stroke-width="1.5" fill="none"/></svg>';
  const view = document.getElementById('view-help');
  let guide = location.hash.slice(1) === 'work-requests' ? 'work-requests' : 'hub', role = {};
  const node = n => `<div class="hp-node ${n[2] || ''}">${esc(n[0])}${n[1] ? `<small>${esc(n[1])}</small>` : ''}</div>`;
  function render(focus){
    const G = GUIDES[guide], r = Math.min(role[guide] || 0, G.roles.length - 1), R = G.roles[r];
    view.innerHTML = `<header class="lb-band">${WAVES}<div class="lb-eyebrow" style="position:relative">Help</div><h1 style="position:relative">How ${esc(G.name.replace(/^the /, 'the '))} Works</h1>
        <p class="lb-sub">For each person who uses it: pick who you are. Questions: Perry Williams.</p>
        <div class="hp-switch" role="group" aria-label="Which guide">${[['hub', 'Initiative Hub'], ['work-requests', 'Work Requests']].map(([k, l]) => `<button type="button" data-guide="${k}" aria-pressed="${k === guide}">${l}</button>`).join('')}</div>
        <div class="lb-tabs" role="tablist" aria-label="Who are you?"><span class="lbl" aria-hidden="true">Who Are You?</span>${G.roles.map((x, i) =>
          `<button type="button" class="lb-tab" role="tab" data-role="${i}" aria-selected="${i === r}" tabindex="${i === r ? 0 : -1}">${esc(x[0])}</button>`).join('')}</div></header>
      <div class="lb-body"><div class="hp-grid">
        <section class="hp-card" aria-labelledby="hpDo"><h2 id="hpDo">${esc(R[0])}: What You Do Here</h2><p class="hp-who">${esc(R[1])}</p><ol class="hp-steps">${R[2].map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ol></section>
        <section class="hp-card" aria-labelledby="hpGood"><h2 id="hpGood">Good to Know</h2><ul class="hp-good">${R[3].map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          <h2 class="more">What This Is</h2><p class="hp-what">${esc(G.what)}</p>
          <div class="hp-q">Something missing or unclear? Tell <b>Perry Williams</b> (<a href="mailto:pwilliams@mba.org">pwilliams@mba.org</a>).</div></section></div>
        <section class="hp-card" style="margin-top:16px" aria-labelledby="hpFlow"><h2 id="hpFlow">${esc(G.flowTitle)}</h2><div class="hp-flow">${G.flow.map(n =>
          Array.isArray(n[0]) ? `<div class="hp-split">${n.map(node).join('')}</div>` : node(n)).join('<span class="hp-arr" aria-hidden="true">→</span>')}</div></section></div>`;
    view.querySelectorAll('[data-guide]').forEach(b => b.addEventListener('click', () => { guide = b.dataset.guide;
      try { history.replaceState(null, '', location.pathname + (guide === 'hub' ? '' : '#work-requests')); } catch (e) {} render('[data-guide="' + guide + '"]'); }));
    view.querySelectorAll('[data-role]').forEach(b => { b.addEventListener('click', () => { role[guide] = +b.dataset.role; render('[data-role="' + b.dataset.role + '"]'); });
      b.addEventListener('keydown', ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault();
        const n = G.roles.length; role[guide] = (r + (ev.key === 'ArrowRight' ? 1 : n - 1)) % n; render('[data-role="' + role[guide] + '"]'); }); });
    if (focus) { const f = view.querySelector(focus); if (f) f.focus(); }
  }
  addEventListener('hashchange', () => { guide = location.hash.slice(1) === 'work-requests' ? 'work-requests' : 'hub'; render(); });
  render();

  /* the sidebar: narrowing (the button or backslash), as on the library page */
  const railHide = document.getElementById('railHide');
  function setMini(on){ document.documentElement.classList.toggle('railmini', on); railHide.setAttribute('aria-label', on ? 'Widen the sections' : 'Narrow the sections');
    try { localStorage.setItem('resources:hub:rail', on ? 'mini' : 'full'); } catch (e) {} }
  railHide.addEventListener('click', () => setMini(!document.documentElement.classList.contains('railmini')));
  document.addEventListener('keydown', ev => { if (ev.key !== '\\\\' || ev.metaKey || ev.ctrlKey || ev.altKey) return; const t = ev.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; ev.preventDefault(); setMini(!document.documentElement.classList.contains('railmini')); });
  if (document.documentElement.classList.contains('railmini')) setMini(true);
  /* light or dark: the Hub's one saved choice, light unless chosen */
  const themeBtn = document.getElementById('themeToggleBtn');
  const MOON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6.4 6.4 0 009 9 9 9 0 11-9-9z"/></svg>';
  const SUN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.4v2.3M12 19.3v2.3M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.4 12h2.3M19.3 12h2.3M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>';
  function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); const d = t === 'dark';
    themeBtn.innerHTML = (d ? SUN : MOON) + `<span>${d ? 'Light Mode' : 'Dark Mode'}</span>`; themeBtn.title = d ? 'Switch to light mode' : 'Switch to dark mode'; }
  let saved = 'light'; try { saved = localStorage.getItem('resources:hub:theme') || 'light'; } catch (e) {}
  applyTheme(saved);
  themeBtn.addEventListener('click', () => { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme(next);
    try { localStorage.setItem('resources:hub:theme', next); } catch (e) {} });
</script>
""".replace('__GUIDES__', json.dumps(GUIDES, ensure_ascii=False))
head = head.replace('</head>', CSS + '</head>', 1)
out = head + '<body>' + chrome + MAIN + SCRIPT + '\n</body>\n</html>\n'
open(os.path.join(HUB, 'help.html'), 'w', encoding='utf-8').write(out)
print('help.html', round(len(out) / 1024), 'KB')
