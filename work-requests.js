/* Work Requests for the MISMO Initiative Hub. Built from the approved prototype (Sept 30, 2026)
   by /home/claude/hubbuild/wr in the session that made it; see CLAUDE.md, "Work Requests". */
(function(){
'use strict';
const L = {"types": ["Aggregator/Investor", "AVM Provider", "Bank", "Compliance Vendor", "Document Provider", "eMortgage Technology Providers", "GSE", "Investors/Aggregators", "Law Firm", "Lender (3rd Party LOS)", "Lender (Proprietary LOS)", "LOS Provider", "Mortgage Originator", "Regulator", "Servicer", "Servicing System", "Third-Party Reviewer", "Title Agent", "Title Production System", "Title Underwriter", "Trade Association", "Warehouse Lenders"], "workgroups": ["AI Community of Practice", "API Community of Practice", "Architecture Workgroup", "Automated Valuation Model DWG", "Business Glossary CoP", "Business Process Model CoP", "Commercial & Other RE Digital Notes DWG", "Commercial CoP", "Credit Reporting CoP", "Data Governance & Management CoP", "Decision Modeling CoP", "Digital Interoperability CoP", "eHELOC DWG", "eMortgage CoP", "HERO CoP", "Housing Counseling DWG", "Information Management", "Loan Application Data Exchange DWG", "MI Claim Submission DWG", "Mortgage Compliance Dataset DWG", "Mortgage Insurance CoP", "Origination CoP", "Property & Valuation Services CoP", "Remote Online Notarization DWG", "Reverse Mortgage DWG", "Secondary CoP", "Servicing CoP", "Servicing Transfers DWG", "TIE (Technology Impact & Enablement) CoP", "Title & Closing CoP", "Title & Closing Docs to Data DWG", "Title Pricing API DWG", "VA Documents to Data DWG", "Verifiable Profile SMART Doc DWG"], "initiatives": ["Mortgage Compliance Dataset", "Common Confidence Score", "Title Order Dataset Specification", "AVM Testing Guidance and Best Practices", "AVM Fairness Testing Guidelines", "Property & Valuation Services Procurement Dataset", "MISMO FRAME", "Tri-Party eNote Bailee Agreement", "Investor Reporting Dataset", "Loan Boarding Dataset", "Commitment File Dataset", "Credit Score Implementation Guide", "MI Claim Submission Dataset"], "domains": ["Mortgage Compliance", "eMortgage", "Servicing", "Title & Closing", "Originations", "Valuation", "Artificial Intelligence", "Governance", "Mortgage Insurance", "Secondary", "Credit Reporting"], "facilitators": ["Erin Bittenbender", "Kathryn Williams", "Kellie Stoll", "Leeann Walker", "Meghan Tidgewell"], "initiativeDomains": {"Mortgage Compliance Dataset": ["Mortgage Compliance"], "Common Confidence Score": ["Originations", "Valuation"], "Title Order Dataset Specification": ["Title & Closing"], "AVM Testing Guidance and Best Practices": ["Valuation"], "AVM Fairness Testing Guidelines": ["Valuation"], "Property & Valuation Services Procurement Dataset": ["Valuation"], "MISMO FRAME": ["Artificial Intelligence", "Governance"], "Tri-Party eNote Bailee Agreement": ["eMortgage"], "Investor Reporting Dataset": ["Servicing"], "Loan Boarding Dataset": ["Servicing"], "Commitment File Dataset": ["Secondary"], "Credit Score Implementation Guide": ["Credit Reporting"], "MI Claim Submission Dataset": ["Mortgage Insurance"]}, "domainColors": {"Mortgage Compliance": "#0E9488", "eMortgage": "#D97706", "Servicing": "#2A4DFF", "Title & Closing": "#0891B2", "Originations": "#C2255C", "Valuation": "#7C3AED", "Artificial Intelligence": "#C026D3", "Governance": "#475569", "Mortgage Insurance": "#059669", "Secondary": "#4F46E5", "Credit Reporting": "#9F1239"}};
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4 M3 10h18"/></svg>';
const store = { get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

/* ─────────────── who is looking (a prototype switch; the real page knows from the sign-in) ─────────────── */
/* ─────────────── who is looking: the shared resources.mismo.org sign-in ─────────────── */
const RS = window.ResourcesSession || null;
const RELAY_URL = 'https://rgvdi67cg27o5kcmiytcqbqnrm0hmztx.lambda-url.us-east-1.on.aws';
const PROJECT = 'hub-requests';     // the private GitMISMO/initiative-hub-requests, through the relay
let ME = { email:'', name:'', short:'', role:null, decides:false, submits:false };
function refreshMe(){
  const s = RS && RS.current(), role = RS ? RS.role(PROJECT) : null;
  const email = s ? String(s.email || '').toLowerCase() : '', name = s ? (s.name || s.email || '') : '';
  ME = { email, name, short: name.split(/\s+/)[0] || name, role, decides: role === 'admin' || !!(RS && RS.isPlatformAdmin && RS.isPlatformAdmin()), submits: role === 'admin' || role === 'staff' };
}
/* Every request and draft records who created it (from the sign-in), so that once the relay can
   limit people to their own requests, sorting them by person needs nothing new. Until then
   everyone with access to Work Requests can read every request (Perry, 30 Sept 2026). */
const sponsorsText = r => r.sponsors.filter(s => String(s.name || '').trim()).map(s => s.name + (s.company ? ', ' + s.company : '')).join('; ');
const byMe = rec => !!(rec && rec.createdBy && String(rec.createdBy.email || '').toLowerCase() === ME.email);
const draftMine = d => !!(d && d.by && String(d.by.email || '').toLowerCase() === ME.email);

/* ─────────────── the store: one JSON file per collection, saved through the relay ───────────────
   data/requests.json and data/drafts.json, each {docs:{<id>:{...}}}. A save sends the version it
   last read; if someone else saved in between, the relay answers 409 and the change is re-applied
   on top of theirs, so two people working at once never overwrite each other. */
const FILES = {};
const fileOf = n => FILES[n] || (FILES[n] = { docs:{}, sha:null, loaded:false, queue:Promise.resolve(), saving:0 });
function call(method, name, body){
  const tok = RS && RS.token();
  if (!tok) return Promise.reject({ code:'SIGNED_OUT' });
  return fetch(`${RELAY_URL}/${PROJECT}/data/${name}`, { method, cache:'no-store',
    headers: Object.assign({ 'Authorization':'Bearer ' + tok }, body ? { 'Content-Type':'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(b => {
      if (r.ok) return b;
      if (r.status === 401 && RS) RS.signIn({ reason:'expired' }).catch(() => {});
      throw { status:r.status, code:(b && b.error) || ('HTTP_' + r.status), message: b && b.message };
    }), () => { throw { code:'OFFLINE' }; });
}
async function load(name){ const f = fileOf(name), b = await call('GET', name); f.docs = (b.data && typeof b.data.docs === 'object' && b.data.docs) || {}; f.sha = b.sha || null; f.loaded = true; return f; }
function mutate(name, fn){
  const f = fileOf(name); f.saving++;
  const job = f.queue.then(async function attempt(tries){
    tries = tries || 0;
    if (!f.loaded) await load(name);
    const next = JSON.parse(JSON.stringify(f.docs)); const out = fn(next);
    try { const b = await call('PUT', name, { content:{ docs:next }, sha:f.sha });
      /* The relay may send back what this person may see, and a new number for a request
         whose number someone else already held (relay request 8). */
      f.docs = (b.data && b.data.docs) || next; f.sha = b.sha || f.sha;
      return (b.ids && typeof out === 'string' && b.ids[out]) || out; }
    catch (e){ if (e && e.status === 409 && tries < 4){ await load(name); return attempt(tries + 1); } throw e; }
  });
  job.then(() => { f.saving--; }, () => { f.saving--; });
  f.queue = job.catch(() => {});
  return job;
}
function errText(e){
  const c = e && e.code;
  return c === 'SIGNED_OUT' ? 'you are signed out' : c === 'NO_ACCESS' || c === 'VIEW_ONLY' ? 'your account cannot save here' : c === 'OFFLINE' ? 'the connection dropped'
    : c === 'GONE' ? 'that request is no longer there' : (e && e.message) || 'something went wrong';
}


/* ─────────────── requests ─────────────── */
function blank(){
  return { isUpdate:'', standard:'', title:'', sponsors:[{name:'',company:''}], cop:'',
    maintenance:'', admin:'', discovery:'', segments:[], effort:'', effortWhy:'', completion:'',
    challenge:'', updates:'', solves:'', owner:'', parts:[], adoptionWhy:'',
    mandate:'', mandateDetails:'', staff:'', partners:'',
    inScope:[], outScope:[], phases:[[]], adoptionPlan:true, future:'', rec:'', recWhy:'',
    impact:{glossary:false,bpm:false,ldm:false,ldmDomain:false,ldmPiv:false,ldmPsv:false,xml:false,api:false,megs:false,smartdoc:false} };
}
function sampleRequest(kind){
  const r = blank(); r.isUpdate = 'yes';
  if (kind === 'maintenance'){
    Object.assign(r, { standard:'Mortgage Compliance Dataset', title:'MCD 2027 Annual Maintenance', sponsors:[{name:'Alex Rivera', company:'Example Compliance Co.'}],
      maintenance:'yes', discovery:'no', segments:['Residential'], effort:'xs', effortWhy:'Routine annual review; the workgroup already meets twice a month.', completion:'2027-01-29',
      inScope:['Enumeration updates','Definition clean-up'], outScope:['New data points'], phases:[['Maintenance release notes']], rec:'cop', recWhy:'Small, and already inside the workgroup\u2019s charter.' });
    r.impact.xml = true; r.impact.glossary = true;
  } else if (kind === 'admin'){
    Object.assign(r, { standard:'Title Order Dataset Specification', title:'Title Order Dataset: Typo and xPath Fixes', sponsors:[{name:'Jordan Lee', company:'Example Title Services'}],
      maintenance:'no', admin:'yes', discovery:'no', segments:['Residential'], effort:'xs', effortWhy:'Corrections only.', completion:'2026-12-15',
      updates:'Correct the typos and xPaths that implementers have reported.', solves:'Implementers stop working around the errors in their own mappings.',
      inScope:['Typos','xPath corrections'], outScope:[], phases:[['Corrected specification and xPath list']], rec:'cop', recWhy:'Fast track.' });
    r.impact.xml = true;
  } else {
    Object.assign(r, { standard:'Common Confidence Score', title:'CCS: Confidence Bands for Rural Properties', sponsors:[{name:'Sam Patel', company:'Example AVM Provider'},{name:'Casey Morgan', company:'Example Lender'}],
      maintenance:'no', admin:'no', discovery:'yes', segments:['Residential'], effort:'m', effortWhy:'New guidance plus testing with providers.', completion:'2027-06-30',
      challenge:'Scores for rural properties cluster at the low end because comparable sales are sparse, so lenders cannot compare providers there.',
      updates:'Add an optional confidence band and a sparse-market indicator to the score.', solves:'Lenders can see when a low score reflects sparse data rather than a weak valuation.',
      owner:'Automated Valuation Model DWG',
      parts:[{ type:'AVM Provider', orgs:[{ name:'Example AVM Provider', adopted:'yes' }, { name:'Second Example Valuations', adopted:'yes' }] },
             { type:'Bank', orgs:[{ name:'Example Lender', adopted:'partly' }] }],
      adoptionWhy:'Adoption among rural lenders is low because the score is least useful where they lend.', mandate:'no', staff:'Help recruit rural lenders to the testing group.',
      partners:'MBA Residential Board of Governors', inScope:['Confidence band definition','Sparse-market indicator'], outScope:['Changes to the core score'],
      phases:[['Draft specification','Provider testing results']], future:'A later phase could cover manufactured housing.', rec:'dwg', recWhy:'Needs new participants and a testing period.' });
    r.impact.ldm = true; r.impact.ldmDomain = true; r.impact.xml = true; r.impact.glossary = true;
  }
  return r;
}
let requests = [];
function refreshRequests(){ requests = Object.values(fileOf('requests').docs).sort((p, q) => String(q.submittedAt || '').localeCompare(String(p.submittedAt || ''))); }

/* drafts: kept in this browser for the prototype, one set per person */
/* drafts follow the sign-in: they are kept in the store, one per draft, marked with who started it */
const myDrafts = () => Object.entries(fileOf('drafts').docs).filter(([, d]) => draftMine(d)).sort((p, q) => q[1].savedAt - p[1].savedAt);

/* ─────────────── sections ─────────────── */
const EFFORT = [['xs','Extra-Small','3 months',3],['s','Small','6 months',6],['m','Medium','9 months',9],['l','Large','1 year',12]];
const ADOPT = [['yes','Adopted'],['partly','Partial Adoption'],['no','No Adoption']];
const IMPACT = [
  ['glossary','Business Glossary','The CoP or DWG will submit any terms that go into the Business Glossary.','Agreement'],
  ['bpm','Business Process Model','MISMO Life of Loan and narratives. The CoP or DWG will name a subject matter expert to work with the Business Process Model CoP.','Agreement'],
  ['ldm','Logical Data Model (LDM)','Choose which views the work will touch.',''],
  ['xml','XML Reference Model','Schema or ELDD.',''],
  ['api','API Toolkit','',''],
  ['megs','MISMO Engineering Guidelines (MEGS)','',''],
  ['smartdoc','SMART Doc\u00ae Conversion','',''],
];
const LDM_VIEWS = [['ldmDomain','Domain View(s)'],['ldmPiv','Platform Independent View'],['ldmPsv','Platform Specific View(s)']];
const adoptionLimited = r => r.parts.some(g => g.orgs.some(o => o.adopted === 'no' || o.adopted === 'partly'));
/* each phase that lists something, with the Adoption Plan in the last one for a full update */
function deliverables(r){
  return r.phases.map((items, i) => items.concat(i === r.phases.length - 1 && r.adoptionPlan && pathOf(r) === 'full' ? ['Adoption Plan'] : []))
    .map((items, i) => items.length ? `Phase ${i + 1}: ${items.join('; ')}` : '').filter(Boolean);
}
function pathOf(r){
  if (r.maintenance === 'yes') return 'maintenance';
  if (r.maintenance === 'no' && r.admin === 'yes') return 'admin';
  if (r.maintenance === 'no' && r.admin === 'no') return 'full';
  return '';
}
const PATH_LABEL = { maintenance:'Annual Maintenance', admin:'Administrative Change', full:'Full Update' };
const SECTIONS = [
  { id:'request', label:'The Request', lead:'Start here: the standard, what the request is called, and who is asking. Each part fills in on this page as you finish it.' },
  { id:'kind', label:'Kind of Update', lead:'This decides how much the rest of the request asks for.' },
  { id:'plan', label:'Planning', lead:'How big the work is and when it should be finished.' },
  { id:'status', label:'The Current Work Product', when: p => p === 'full' || p === 'admin', lead:'Why the standard needs to change.' },
  { id:'people', label:'Who\u2019s Involved', full:true, lead:'The stakeholders already represented in the group and committed to working on the updates.' },
  { id:'adoption', label:'Adoption and Support', full:true, lead:'What will influence adoption of the updated work product, and the help you need.' },
  { id:'scope', label:'Scope of Work', lead:'What the work will and will not cover.' },
  { id:'deliver', label:'Deliverables and Recommendation', lead:'What the group will produce, and where the work should happen.' },
  { id:'impact', label:'Areas of Impact', lead:'Choose every area the work will touch. This can change as more is learned.' },
];
const NEWSTD = { id:'newstd', label:'A New Standard', lead:'' };
function asked(r){
  if (r.isUpdate === 'no') return [SECTIONS[0], NEWSTD];
  const p = pathOf(r);
  return SECTIONS.filter(s => s.when ? (p === '' || s.when(p)) : (!s.full || p === 'full' || p === ''));
}

/* ─────────────── pickers: a searchable list, and a calendar (no native drop-downs) ─────────────── */
const PICK = {};          // id -> { options, value, onPick, kind }
let OPEN = null;          // the open popover
/* ─────────────── one picker for every list ───────────────
   You type straight into the field and the list opens below it: grouped, with matches
   highlighted, arrow keys and Enter to choose, Escape to close, and a clear button. Fields
   that take any text (the standard, the CoP sponsor) also offer "Use ..." for something
   not on the list; the others only accept a choice from the list. */
const ACS = {};           // id -> { value, options, placeholder, label, free, onPick, onType, clearOnPick }
let ACO = null;           // the open list: { id, items, active }
const DOMC = L.domainColors || {};
const initOpts = () => L.initiatives.map(n => { const d = (L.initiativeDomains || {})[n] || [];
  return { value:n, label:n, group:d[0] || 'Other', hint: d.length > 1 ? 'Also ' + d.slice(1).join(', ') : '', dot: DOMC[d[0]] }; })
  .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
const WG_ORDER = ['Communities of Practice', 'Development Workgroups', 'Other Workgroups'];
const wgKind = w => /\bDWG\b/.test(w) ? 'Development Workgroups' : /community of practice|\bcop\b/i.test(w) ? 'Communities of Practice' : 'Other Workgroups';
const wgOpts = () => L.workgroups.map(w => ({ value:w, label:w, group:wgKind(w) }))
  .sort((a, b) => WG_ORDER.indexOf(a.group) - WG_ORDER.indexOf(b.group) || a.label.localeCompare(b.label))
  .concat([{ value:'Not sure', label:'Not sure', group:'Other Workgroups', hint:'MISMO will find out' }]);
const domOpts = () => [{ value:'', label:'To Be Decided' }].concat(L.domains.slice().sort().map(d => ({ value:d, label:d, dot:DOMC[d] })));
function acHTML(id, o){
  ACS[id] = o;
  const cur = o.options.find(v => v.value === o.value && (v.value !== '' || v.label));
  const shown = cur ? cur.label : (o.free ? (o.value || '') : '');
  return `<div class="ac" id="ac-${id}"><input type="text" class="ac-in" id="f-${id}" data-ac="${id}" role="combobox" aria-expanded="false" aria-controls="lb-${id}" aria-autocomplete="list" autocomplete="off" spellcheck="false"
      value="${esc(shown)}" placeholder="${esc(o.placeholder || '')}"${o.label ? ` aria-label="${esc(o.label)}"` : ''}>
    ${o.clearOnPick ? '' : `<button type="button" class="ac-x" data-acclear="${id}" aria-label="Clear${o.label ? ' ' + esc(o.label.toLowerCase()) : ''}">\u00d7</button>`}
    <button type="button" class="ac-arrow" data-actoggle="${id}" tabindex="-1" aria-label="Show every choice">${CHEV}</button></div>`;
}
function acMatch(label, q){
  const i = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  return i < 0 ? esc(label) : esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + q.length)) + '</mark>' + esc(label.slice(i + q.length));
}
function acOpen(id, all){
  const o = ACS[id], inp = document.getElementById('f-' + id), host = document.getElementById('ac-' + id); if (!o || !inp || !host) return;
  if (ACO && ACO.id !== id) acClose(true);
  let ul = host.querySelector('.ac-list');
  if (!ul){ ul = document.createElement('ul'); ul.className = 'ac-list'; ul.id = 'lb-' + id; ul.setAttribute('role', 'listbox'); if (o.label) ul.setAttribute('aria-label', o.label); host.appendChild(ul); }
  inp.setAttribute('aria-expanded', 'true');
  const cur = o.options.find(v => v.value === o.value);
  const q = all || (cur && inp.value === cur.label) ? '' : inp.value.trim(), ql = q.toLowerCase();
  let items = o.options.filter(v => !q || v.label.toLowerCase().includes(ql) || (v.hint || '').toLowerCase().includes(ql) || (v.group || '').toLowerCase().includes(ql));
  const score = v => { const l = v.label.toLowerCase(); return l.startsWith(ql) ? 0 : new RegExp('(^|[\\s/(&-])' + ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(l) ? 1 : l.includes(ql) ? 2 : 3; };
  const grouped = items.some(v => v.group);
  if (q && !grouped) items = items.map((v, i) => [v, i]).sort((a, b) => score(a[0]) - score(b[0]) || a[1] - b[1]).map(a => a[0]);   // a plain list: best matches first
  if (o.free && q && !o.options.some(v => v.label.toLowerCase() === ql)) items = items.concat([{ value:q, label:q, free:true }]);
  let best = 0; if (q && grouped){ let s = 9; items.forEach((v, i) => { if (!v.free && score(v) < s){ s = score(v); best = i; } }); }   // a grouped list keeps its groups; Enter takes the best match
  ACO = { id, items, active: q ? best : Math.max(0, items.findIndex(v => v.value === o.value)) };
  let h = '', g = null;
  items.forEach((v, i) => {
    if (v.free) h += `<li class="ac-sep" role="presentation"></li>`;
    else if (v.group && v.group !== g){ h += `<li class="ac-g" role="presentation">${esc(v.group)}</li>`; g = v.group; }
    const sel = !v.free && v.value === o.value && !(v.value === '' && !cur);
    h += `<li role="option" id="${id}-o${i}" data-aci="${i}" aria-selected="${sel}">${v.dot ? `<i class="ac-dot" style="background:${v.dot}" aria-hidden="true"></i>` : ''}<span class="ac-t">${v.free ? `Use \u201c${esc(v.label)}\u201d` : acMatch(v.label, q)}</span>${v.free ? `<small>${esc(o.freeHint || 'Not on the list')}</small>` : v.hint ? `<small>${esc(v.hint)}</small>` : ''}</li>`;
  });
  ul.innerHTML = h || `<li class="ac-none" role="presentation">No matches. Try another word.</li>`;
  acMark();
}
function acMark(){
  const inp = document.getElementById('f-' + ACO.id), lis = document.querySelectorAll(`#lb-${ACO.id} li[data-aci]`);
  lis.forEach((li, i) => li.classList.toggle('active', i === ACO.active));
  const a = lis[ACO.active]; if (a){ inp.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block:'nearest' }); } else inp.removeAttribute('aria-activedescendant');
}
function acClose(revert){
  if (!ACO) return;
  const id = ACO.id, o = ACS[id], inp = document.getElementById('f-' + id), host = document.getElementById('ac-' + id); ACO = null;
  const ul = host && host.querySelector('.ac-list'); if (ul) ul.remove();
  if (inp){ inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant');
    if (revert && !o.free){ const cur = o.options.find(v => v.value === o.value); inp.value = o.clearOnPick ? '' : cur ? cur.label : ''; } }
}
function acPick(i){
  const id = ACO.id, o = ACS[id], v = ACO.items[i]; if (!v) return;
  const inp = document.getElementById('f-' + id); acClose(false);
  if (o.clearOnPick) inp.value = ''; else { inp.value = v.label; o.value = v.value; }
  o.onPick(v.value);
}
function combo(id, o){
  PICK[id] = Object.assign({ kind:'combo' }, o);
  const cur = o.options.find(x => x.value === o.value);
  return `<div class="combo" id="cb-${id}"><button type="button" class="combo-btn${cur ? '' : ' empty'}" id="f-${id}" data-pick="${id}" aria-haspopup="listbox" aria-expanded="false"${o.label ? ` aria-label="${esc(o.label)}${cur ? ': ' + esc(cur.label) : ''}"` : ''}>
    <span>${esc(cur ? cur.label : o.placeholder)}</span>${CHEV}</button></div>`;
}
const fmtLong = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '';
const fmtDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '';
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
function datepick(id, o){
  PICK[id] = Object.assign({ kind:'date' }, o);
  return `<div class="date" id="cb-${id}"><button type="button" class="date-btn${o.value ? '' : ' empty'}" id="f-${id}" data-pick="${id}" aria-haspopup="dialog" aria-expanded="false">${CAL}<span>${esc(o.value ? fmtLong(o.value) : 'Choose a Date')}</span></button></div>`;
}
function closePop(focusBack){
  if (!OPEN) return;
  const btn = OPEN.host.querySelector('[data-pick]'); if (btn) btn.setAttribute('aria-expanded', 'false');
  OPEN.pop.remove(); const o = OPEN; OPEN = null;
  if (focusBack && btn) btn.focus();
  return o;
}
function openPick(id){
  closePop();
  const p = PICK[id], host = document.getElementById('cb-' + id); if (!p || !host) return;
  const pop = document.createElement('div'); pop.className = 'pop' + (p.kind === 'date' ? ' cal' : '');
  host.appendChild(pop); host.querySelector('[data-pick]').setAttribute('aria-expanded', 'true');
  OPEN = { id, host, pop, active:0, items:[] };
  if (p.kind === 'date'){
    /* open on the chosen date, or on the earliest date allowed (never on a month with nothing to pick) */
    const today = iso(new Date()), start = p.value || (p.min && p.min > today ? p.min : today);
    const base = new Date(start + 'T12:00');
    OPEN.month = new Date(base.getFullYear(), base.getMonth(), 1); OPEN.focus = iso(base);
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a date');
    drawCal(true);
  } else {
    pop.innerHTML = `<input type="text" class="pop-q" placeholder="Search\u2026" role="combobox" aria-expanded="true" aria-controls="lb-${id}" aria-autocomplete="list" aria-label="Search ${esc(p.label || '')}">
      <ul class="pop-list" role="listbox" id="lb-${id}" aria-label="${esc(p.label || 'Options')}"></ul>`;
    fillList('');
    const q = pop.querySelector('.pop-q'); q.focus();
  }
}
function fillList(q){
  const p = PICK[OPEN.id], t = q.trim().toLowerCase();
  OPEN.items = p.options.filter(o => !t || o.label.toLowerCase().includes(t) || (o.hint || '').toLowerCase().includes(t));
  const sel = OPEN.items.findIndex(o => o.value === p.value);
  OPEN.active = t ? 0 : Math.max(0, sel);
  const ul = OPEN.pop.querySelector('.pop-list');
  ul.innerHTML = OPEN.items.length ? OPEN.items.map((o, i) => `<li role="option" id="${OPEN.id}-o${i}" data-i="${i}" aria-selected="${o.value === p.value}" class="${i === OPEN.active ? 'active' : ''}">${esc(o.label)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</li>`).join('')
    : `<li class="none" role="option" aria-disabled="true">No matches</li>`;
  markActive();
}
function markActive(){
  const q = OPEN.pop.querySelector('.pop-q'); const lis = OPEN.pop.querySelectorAll('li[data-i]');
  lis.forEach((li, i) => li.classList.toggle('active', i === OPEN.active));
  const a = lis[OPEN.active]; if (a){ q.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block:'nearest' }); } else q.removeAttribute('aria-activedescendant');
}
function choose(i){
  const p = PICK[OPEN.id], o = OPEN.items[i]; if (!o) return;
  const id = OPEN.id; closePop(); p.onPick(o.value);
  const b = document.getElementById('f-' + id), a = document.activeElement;
  if (b && (!a || a === document.body)) b.focus();
}
function drawCal(focusDay){
  const p = PICK[OPEN.id], m = OPEN.month, today = iso(new Date()), min = p.min || '';
  const first = new Date(m.getFullYear(), m.getMonth(), 1), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++){
    const v = iso(new Date(m.getFullYear(), m.getMonth(), d)), dis = min && v < min;
    cells += `<button type="button" data-day="${v}" tabindex="${v === OPEN.focus ? 0 : -1}" aria-pressed="${v === p.value}" class="${v === today ? 'today' : ''}"${dis ? ' disabled' : ''} aria-label="${esc(fmtLong(v))}">${d}</button>`;
  }
  OPEN.pop.innerHTML = `<div class="cal-h"><button type="button" data-mon="-1" aria-label="Previous month">\u2039</button>
      <b aria-live="polite">${m.toLocaleDateString('en-US', { month:'long', year:'numeric' })}</b><button type="button" data-mon="1" aria-label="Next month">\u203a</button></div>
    <div class="cal-g">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join('')}${cells}</div>`;
  if (focusDay){ const b = OPEN.pop.querySelector(`[data-day="${OPEN.focus}"]`) || OPEN.pop.querySelector('[data-day]:not(:disabled)'); if (b) b.focus(); }
}
function moveDay(delta){
  const d = new Date(OPEN.focus + 'T12:00'); d.setDate(d.getDate() + delta);
  const min = PICK[OPEN.id].min; if (min && iso(d) < min) return;          // a disabled day cannot take focus
  OPEN.focus = iso(d);
  if (d.getMonth() !== OPEN.month.getMonth() || d.getFullYear() !== OPEN.month.getFullYear()) OPEN.month = new Date(d.getFullYear(), d.getMonth(), 1);
  drawCal(true);
}

/* ─────────────── the questions ─────────────── */
let W = null;   // { id, r, step, done:Set, errs, savedAt, dirty }
function standardNoteHTML(v){
  const n = L.initiatives.find(i => i.toLowerCase() === String(v || '').trim().toLowerCase());
  if (n){ const d = ((L.initiativeDomains || {})[n] || [])[0]; return `<i style="background:${DOMC[d] || 'var(--ps)'}" aria-hidden="true"></i>On the Hub, under ${esc(d || 'its domain')}.`; }
  return String(v || '').trim() ? 'Not on the Hub. That\u2019s fine: any MISMO standard can be named.' : '';
}
function standardNote(){ const el = document.getElementById('note-standard'); if (el) el.innerHTML = standardNoteHTML(W.r.standard); }
function clearErr(k){ if (W && W.errs[k]){ delete W.errs[k]; const q = document.getElementById('q-' + k); if (q){ q.classList.remove('has-err'); const er = q.querySelector('.err'); if (er) er.remove(); } } }
function field(id, label, body, o = {}){
  const e = W.errs[id];
  return `<div class="q${e ? ' has-err' : ''}" id="q-${id}"><label class="qlabel" for="${o.for || 'f-' + id}">${label}${o.optional ? ' <span class="opt">(optional)</span>' : ''}</label>
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}${body}${e ? `<div class="err" role="alert">${esc(e)}</div>` : ''}</div>`;
}
function radios(id, label, options, o = {}){
  const e = W.errs[id], cur = W.r[id];
  return `<fieldset class="q${e ? ' has-err' : ''}" id="q-${id}"><legend>${label}</legend>${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
    <div class="${o.grid ? 'choices' : 'yn'}">${options.map(([v, t, s]) => `<label class="choice${cur === v ? ' on' : ''}">
      <input class="vh" type="radio" name="${id}" value="${v}" data-radio="${id}"${cur === v ? ' checked' : ''}><span class="ind" aria-hidden="true"></span><span><b>${t}</b>${s ? `<small>${s}</small>` : ''}</span></label>`).join('')}</div>
    ${e ? `<div class="err" role="alert">${esc(e)}</div>` : ''}</fieldset>`;
}
const YN = [['yes','Yes'],['no','No']];
const text = (k, ph = '', list = '') => `<input type="text" id="f-${k}" data-k="${k}" value="${esc(W.r[k])}" placeholder="${esc(ph)}"${list ? ` list="${list}"` : ''}>`;
const area = (k, ph = '') => `<textarea id="f-${k}" data-k="${k}" placeholder="${esc(ph)}">${esc(W.r[k])}</textarea>`;
function listBuilder(k, ph){
  return `<ul class="items">${W.r[k].map((t, i) => `<li><span>${esc(t)}</span><button type="button" class="x" data-del="${k}" data-i="${i}" aria-label="Remove ${esc(t)}">\u00d7</button></li>`).join('')}</ul>
    <div class="adder" style="margin-top:8px"><input type="text" id="f-${k}" data-adder="${k}" placeholder="${esc(ph)}"><button type="button" class="btn" data-add="${k}">Add</button></div>`;
}
const COPS = L.workgroups.filter(w => /community of practice|\bcop\b/i.test(w));
function suggested(r){
  const e = EFFORT.find(x => x[0] === r.effort); if (!e) return '';
  const d = new Date(); d.setMonth(d.getMonth() + e[3]); d.setHours(12, 0, 0, 0); return iso(d);
}
const ASK = {
  request(r){
    const top = radios('isUpdate','Is this an update to an existing standard?', YN);
    if (r.isUpdate === 'no') return top + `<div class="pathnote info">The intake for new standards is being built next. This prototype covers updates to existing standards.</div>`;
    if (r.isUpdate !== 'yes') return top;
    const rows = r.sponsors.map((s, i) => `<div class="rowf two">
      <input type="text" data-row="sponsors" data-i="${i}" data-f="name" value="${esc(s.name)}" placeholder="Name" aria-label="Sponsor ${i + 1} name">
      <input type="text" data-row="sponsors" data-i="${i}" data-f="company" value="${esc(s.company)}" placeholder="Company" aria-label="Sponsor ${i + 1} company">
      <button type="button" class="x" data-delrow="sponsors" data-i="${i}" aria-label="Remove sponsor ${i + 1}"${r.sponsors.length === 1 ? ' disabled' : ''}>\u00d7</button></div>`).join('');
    return top + field('standard','Which standard is being updated?',
        acHTML('standard', { value:r.standard, options:initOpts(), free:true, freeHint:'Not on the Hub', label:'Standard being updated', placeholder:'Search the Hub\u2019s initiatives, or type any standard',
          onType: v => { W.r.standard = v; dirty(); clearErr('standard'); standardNote(); }, onPick: v => { W.r.standard = v; dirty(); clearErr('standard'); standardNote(); } }) +
        `<p class="ac-note" id="note-standard" aria-live="polite">${standardNoteHTML(r.standard)}</p>`,
        { hint:'Any MISMO standard can be named. The Hub\u2019s initiatives are listed by domain.' }) +
      field('title','Work Request Name', text('title','For example: MCD 2027 Annual Maintenance'), { hint:'This becomes the headline of the request above.' }) +
      field('sponsors','Work Request Sponsor(s)', `<div class="rows">${rows}</div><button type="button" class="btn ghost add" data-addsponsor>+ Add Another Sponsor</button>`, { for:'x', hint:'Name and company for each sponsor.' }) +
      field('cop','Community of Practice Sponsor', acHTML('cop', { value:r.cop, options:COPS.map(c => ({ value:c, label:c })), free:true, freeHint:'Not in the calendar', label:'Community of Practice sponsor',
          placeholder:'Search communities of practice', onType: v => { W.r.cop = v; dirty(); }, onPick: v => { W.r.cop = v; dirty(); } }), { optional:true });
  },
  kind(r){
    let h = radios('maintenance','Is this Bi-Annual or Annual Maintenance?', YN);
    if (r.maintenance === 'no') h += radios('admin','Is this an administrative change only?', YN, { hint:'For instance typo fixes, formatting changes, or updated enumerations, definitions or xPaths.' });
    const p = pathOf(r);
    if (p === 'maintenance') h += `<div class="pathnote short">For annual maintenance, after planning you\u2019ll only be asked for the scope of work and the areas of impact.</div>`;
    if (p === 'admin') h += `<div class="pathnote short">For an administrative change, after planning you\u2019ll be asked what the updates are, then for the scope of work and the areas of impact.</div>`;
    if (p === 'full') h += `<div class="pathnote full">Because this is more than maintenance or an administrative change, the request also asks about the current work product, who\u2019s involved and adoption.</div>`;
    return h;
  },
  plan(r){
    const min = iso(new Date(Date.now() + 864e5)), sug = suggested(r);
    return radios('discovery','Is discovery needed?', YN) +
      `<fieldset class="q${W.errs.segments ? ' has-err' : ''}" id="q-segments"><legend>MISMO Segment</legend><p class="hint">Choose all that apply.</p><div class="yn">
        ${['Residential','Commercial/Multi-Family'].map(s => `<label class="choice${r.segments.includes(s) ? ' on' : ''}"><input class="vh" type="checkbox" data-arr="segments" value="${s}"${r.segments.includes(s) ? ' checked' : ''}><span class="ind box" aria-hidden="true"></span><span><b>${s}</b></span></label>`).join('')}
      </div>${W.errs.segments ? `<div class="err" role="alert">${esc(W.errs.segments)}</div>` : ''}</fieldset>` +
      radios('effort','Estimated Level of Effort to Complete', EFFORT, { grid:true, hint:'The time your workgroup will need to complete development of the work product.' }) +
      field('effortWhy','Reasoning for the Estimate', area('effortWhy')) +
      field('completion','Expected Product Completion Date',
        datepick('completion', { value:r.completion, min, onPick: v => { W.r.completion = v; delete W.errs.completion; dirty(); drawWizard(); } }) +
        (sug && sug !== r.completion ? `<div class="suggest">From your estimate: <button type="button" data-suggest="${sug}">${esc(fmtDate(sug))}</button></div>` : ''),
        { hint:'The group is seeking approval to work on this through that date. If it isn\u2019t finished by then, the group will need to ask the approval body for an extension.' });
  },
  status(){
    return field('updates','What updates to the work product are you requesting?', area('updates')) +
      field('solves','How do the updates solve the issues in the existing process?', area('solves'));
  },
  people(r){
    const wg = L.workgroups.map(w => ({ value:w, label:w })).concat([{ value:'Not sure', label:'Not sure' }]);
    const used = new Set(r.parts.map(g => g.type));
    const groups = r.parts.map((g, gi) => `<div class="group" id="grp-${gi}"><div class="group-h"><b>${esc(g.type)}</b><span class="n">${g.orgs.length} organization${g.orgs.length === 1 ? '' : 's'}</span>
        <button type="button" class="btn ghost" data-delgroup="${gi}">Remove Group</button></div>
      <ul class="orgs">${g.orgs.map((o, oi) => `<li class="org"><span class="oname">${esc(o.name)}</span>
        <span class="seg" role="group" aria-label="Has ${esc(o.name)} adopted the current work product?">${ADOPT.map(([v, t]) => `<button type="button" class="${v}" data-adopt="${gi}:${oi}:${v}" aria-pressed="${o.adopted === v}">${t}</button>`).join('')}</span>
        <button type="button" class="x" data-delorg="${gi}:${oi}" aria-label="Remove ${esc(o.name)}">\u00d7</button></li>`).join('')}</ul>
      <div class="adder"><input type="text" data-orgadder="${gi}" placeholder="Add an organization, then press Add" aria-label="Add an organization to ${esc(g.type)}"><button type="button" class="btn" data-addorg="${gi}">Add</button></div></div>`).join('');
    const limited = adoptionLimited(r);
    return field('owner','Which workgroup currently owns the work product?',
        acHTML('owner', { value:r.owner, options:wgOpts(), placeholder:'Search ' + L.workgroups.length + ' workgroups', label:'Owning workgroup', onPick: v => { W.r.owner = v; clearErr('owner'); dirty(); } })) +
      field('parts','Stakeholders Participating in the Effort', `<div class="groups">${groups}</div>
        <div class="addgroup">${acHTML('addgroup', { value:'', options:L.types.filter(t => !used.has(t)).map(t => ({ value:t, label:t })), clearOnPick:true, placeholder:'+ Add a stakeholder group: search ' + (L.types.length - used.size) + ' types', label:'Add a stakeholder group',
          onPick: v => { W.r.parts.push({ type:v, orgs:[] }); dirty(); drawWizard(); const a = document.querySelector(`[data-orgadder="${W.r.parts.length - 1}"]`); if (a) a.focus(); } })}</div>`,
        { for:'f-addgroup', hint:'Add each stakeholder group, then the organizations in it one at a time, with whether each has adopted the current work product.' }) +
      (limited ? field('adoptionWhy','Adoption is limited: why would a revision be valuable?', area('adoptionWhy'), { hint:'Describe how the revision would encourage broader industry implementation.' }) : '');
  },
  adoption(r){
    return radios('mandate','Is there a regulation or industry mandate?', YN) +
      (r.mandate === 'yes' ? field('mandateDetails','Details of the Mandate', area('mandateDetails')) : '') +
      field('staff','How can MISMO staff assist in supporting this effort?', area('staff'), { optional:true }) +
      field('partners','Partner Organizations', area('partners','For example: MBA committees; partner trade associations like ALTA, CSBS, Lenders One; government agencies'),
        { optional:true, hint:'External organizations or industry groups that could help support or advocate for adoption of this work.' });
  },
  scope(){
    return field('inScope','In Scope', listBuilder('inScope','Add an item, then press Add'), { for:'f-inScope', hint:'A brief description for each; keep each one independent of the others.' }) +
      field('outScope','Out of Scope', listBuilder('outScope','Add an item, then press Add'), { for:'f-outScope', optional:true });
  },
  deliver(r){
    const phases = r.phases.map((items, pi) => `<div class="phase"><h4>Phase ${pi + 1}${r.phases.length > 1 ? `<button type="button" class="btn ghost" data-delphase="${pi}">Remove Phase</button>` : ''}</h4>
      <ul class="items">${items.map((t, i) => `<li><span>${esc(t)}</span><button type="button" class="x" data-delph="${pi}" data-i="${i}" aria-label="Remove ${esc(t)}">\u00d7</button></li>`).join('')}
      ${pi === r.phases.length - 1 && pathOf(r) === 'full' ? `<li class="locked"><label class="choice${r.adoptionPlan ? ' on' : ''}" style="border:0;background:none;padding:0;min-width:0"><input class="vh" type="checkbox" data-plan${r.adoptionPlan ? ' checked' : ''}><span class="ind box" aria-hidden="true"></span><span>Adoption Plan</span></label><em>Required for Published Work Products</em></li>` : ''}</ul>
      <div class="adder" style="margin-top:8px"><input type="text" id="f-ph${pi}" data-phadder="${pi}" placeholder="Add a deliverable, then press Add"><button type="button" class="btn" data-addph="${pi}">Add</button></div></div>`).join('');
    return field('phases','Deliverables Requested', phases + `<button type="button" class="btn ghost add" data-addphase>+ Add a Phase</button>`, { for:'f-ph0', hint:'The deliverables the workgroup will produce, by phase.' }) +
      field('future','Possible Future Phases', area('future'), { optional:true }) +
      radios('rec','Work Group Recommendation', [['cop','Community of Practice','Fast track: the scope is small enough, or capacity exists, for an existing CoP'],['dwg','Development Work Group','Project: a new DWG is required']], { grid:true }) +
      field('recWhy','Reasoning for the Recommendation', area('recWhy'));
  },
  impact(r){
    const n = IMPACT.filter(([k]) => r.impact[k]).length;
    return `<div class="tiles-h"><span>Choose any that apply</span><b>${n} selected</b></div><div class="tiles" role="group" aria-label="Areas of impact">${IMPACT.map(([k, t, s, kw]) => {
      const on = r.impact[k];
      const views = k === 'ldm' && on ? `<div class="views" role="group" aria-label="Logical Data Model views">${LDM_VIEWS.map(([vk, vt]) => `<button type="button" data-view="${vk}" aria-pressed="${!!r.impact[vk]}">${vt}</button>`).join('')}</div>` : '';
      return `<div class="tile${on ? ' on' : ''}${k === 'ldm' && on ? ' wide' : ''}"><label><input class="vh" type="checkbox" data-imp="${k}"${on ? ' checked' : ''}><span class="ind" aria-hidden="true"></span>
        <span><b>${t}</b>${s ? `<small>${s}</small>` : ''}${kw && on ? `<span class="kw">By choosing this, the group agrees to it.</span>` : ''}</span></label>${views}</div>`;
    }).join('')}</div>`;
  },
  newstd(){ return `<div class="pathnote info" style="margin-top:0">The questions for a new standard come next. Go back to change your answer, or come back to this draft later.</div>`; },
};
function check(id, r){
  const e = {};
  const need = (k, msg) => { if (!String(r[k] || '').trim()) e[k] = msg; };
  if (id === 'request'){ if (!r.isUpdate) e.isUpdate = 'Choose Yes or No.';
    if (r.isUpdate === 'yes'){ need('standard', 'Name the standard being updated.'); need('title', 'Give the request a name.'); if (!r.sponsors.some(s => s.name.trim())) e.sponsors = 'Add at least one sponsor.'; } }
  if (id === 'kind'){ if (!r.maintenance) e.maintenance = 'Choose Yes or No.'; else if (r.maintenance === 'no' && !r.admin) e.admin = 'Choose Yes or No.'; }
  if (id === 'plan'){ if (!r.discovery) e.discovery = 'Choose Yes or No.'; if (!r.segments.length) e.segments = 'Choose at least one segment.';
    if (!r.effort) e.effort = 'Choose a level of effort.'; need('completion', 'Choose a completion date.'); }
  if (id === 'status'){ need('updates', 'Describe the updates you are requesting.'); }
  if (id === 'people'){ need('owner', 'Choose the workgroup, or Not sure.'); if (adoptionLimited(r)) need('adoptionWhy', 'Explain why a revision would be valuable, since adoption is limited.'); }
  if (id === 'adoption'){ if (!r.mandate) e.mandate = 'Choose Yes or No.'; }
  if (id === 'scope'){ if (!r.inScope.length) e.inScope = 'Add at least one thing that is in scope.'; }
  if (id === 'deliver'){ if (!r.rec) e.rec = 'Choose a recommendation.'; }
  return e;
}

/* ─────────────── the document ─────────────── */
function rows(id, r){
  const v = x => (x == null || x === '' || (Array.isArray(x) && !x.length)) ? '<span class="none">Not answered</span>' : esc(x);
  const yn = x => x === 'yes' ? 'Yes' : x === 'no' ? 'No' : '<span class="none">Not answered</span>';
  const list = a => a && a.length ? `<ul>${a.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="none">None</span>';
  const p = pathOf(r), ef = EFFORT.find(e => e[0] === r.effort);
  switch (id){
    case 'request': return [['Update to an Existing Standard', yn(r.isUpdate)], ['Standard', v(r.standard)], ['Sponsors', list(r.sponsors.filter(s => s.name.trim()).map(s => s.name + (s.company ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
    case 'kind': return [['Annual Maintenance', yn(r.maintenance)], ...(r.maintenance === 'no' ? [['Administrative Change Only', yn(r.admin)]] : [])];
    case 'plan': return [['Discovery Needed', yn(r.discovery)], ['MISMO Segment', r.segments.length ? r.segments.map(s => `<span class="pill">${esc(s)}</span>`).join('') : v('')],
      ['Level of Effort', ef ? `${ef[1]} (${ef[2]})` : v('')], ['Reasoning', v(r.effortWhy)], ['Expected Completion', v(fmtDate(r.completion))]];
    case 'status': return [['Updates Requested', v(r.updates)], ['How They Solve It', v(r.solves)]];
    case 'people': {
      const al = x => (ADOPT.find(a => a[0] === x) || [, 'Adoption Not Given'])[1];
      const g = r.parts.map(x => `<li><b>${esc(x.type)}</b>: ${x.orgs.length ? x.orgs.map(o => `${esc(o.name)} <span style="color:var(--sg)">(${al(o.adopted)})</span>`).join(', ') : '<span class="none">no organizations yet</span>'}</li>`);
      return [['Owning Workgroup', v(r.owner)], ['Stakeholders', g.length ? `<ul>${g.join('')}</ul>` : '<span class="none">None</span>'], ...(adoptionLimited(r) ? [['Why a Revision Helps Adoption', v(r.adoptionWhy)]] : [])]; }
    case 'adoption': return [['Regulation or Mandate', yn(r.mandate)], ...(r.mandate === 'yes' ? [['Details', v(r.mandateDetails)]] : []), ['MISMO Staff Support', v(r.staff)], ['Partner Organizations', v(r.partners)]];
    case 'scope': return [['In Scope', list(r.inScope)], ['Out of Scope', list(r.outScope)]];
    case 'deliver': return [['Deliverables', list(deliverables(r))],
      ['Future Phases', v(r.future)], ['Recommendation', r.rec === 'cop' ? 'Community of Practice (fast track)' : r.rec === 'dwg' ? 'Development Work Group (project)' : v('')], ['Reasoning', v(r.recWhy)]];
    case 'impact': {
      const imp = IMPACT.filter(([k]) => r.impact[k]).map(([k, t]) => t + (k === 'ldm' ? (LDM_VIEWS.filter(([vk]) => r.impact[vk]).map(([, vt]) => vt).join(', ').replace(/^/, ': ').replace(/^: $/, '')) : ''));
      return [['Areas', imp.length ? imp.map(t => `<span class="pill">${esc(t)}</span>`).join('') : '<span class="none">None chosen</span>']]; }
  }
  return [];
}
const kv = rs => `<dl class="kv">${rs.map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join('')}</dl>`;
const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
const fmtShort = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
/* Areas of Impact, finished: every area, with the chosen ones checked, so what is out is as clear as what is in */
function impactDone(r){
  return `<ul class="imp-done">${IMPACT.map(([k, t]) => {
    const on = r.impact[k], views = k === 'ldm' && on ? LDM_VIEWS.filter(([vk]) => r.impact[vk]).map(([, vt]) => vt).join(', ') : '';
    return `<li class="${on ? 'on' : ''}"><span class="ic" aria-hidden="true">${on ? CHECK : ''}</span><span><b>${t}</b>${views ? `<small>${esc(views)}</small>` : ''}<span class="vh">${on ? ', included' : ', not included'}</span></span></li>`;
  }).join('')}</ul>`;
}
function ringSVG(n, total){
  const c = 2 * Math.PI * 23, f = total ? n / total * c : 0;
  return `<svg class="ring" width="58" height="58" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="23" fill="none" stroke="var(--line-2)" stroke-width="5"/>${n ? `<circle cx="27" cy="27" r="23" fill="none" stroke="var(--ps)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 27 27)"/>` : ''}</svg>`;
}
function headHTML(r, o){
  return `<header class="wr-head"><div class="eyebrow">Care and Feeding Work Request \u00b7 ${o.mode === 'fill' ? 'Draft' : 'Submitted ' + esc(fmt(o.submitted))}</div>
    <h1 class="wr-title${r.title ? '' : ' placeholder'}">${esc(r.title || 'Untitled Work Request')}</h1>
    <div class="wr-sub">${r.standard ? `An update to <b>${esc(r.standard)}</b>` : 'An update to an existing MISMO standard'} \u00b7 ${o.wr ? 'WR# <b>' + esc(o.wr) + '</b>' : 'WR# set by MISMO'}${o.fac ? ' \u00b7 Facilitator <b>' + esc(o.fac) + '</b>' : ''}</div></header>`;
}
/* the timeline: finished sections as cards beside a check, the current one open, the rest waiting */
function timelineHTML(r, o){
  const mode = o.mode, secs = asked(r), p = pathOf(r);
  const skipped = [];                                   // a section that doesn't apply isn't part of the request
  const order = SECTIONS.concat(r.isUpdate === 'no' ? [NEWSTD] : []);
  const shownList = order.filter(s => secs.includes(s));
  const num = id => String(shownList.findIndex(s => s.id === id) + 1).padStart(2, '0');
  const fin = o.fin || {};
  let items = '', shown = 0, doneN = 0;
  order.forEach(s => {
    const visible = secs.includes(s), isSkip = skipped.includes(s);
    if (!visible && !isSkip) return;
    const isNow = mode === 'fill' && W.step === s.id, isDone = mode === 'view' ? !isSkip : W.done.has(s.id);
    const kind = isSkip ? 'skip' : isNow ? 'now' : isDone ? 'done' : 'later';
    shown++; if (kind === 'done' || kind === 'skip') doneN++;
    const state = { skip:'Not needed', now:'In progress', done:'Done', later:'To come' }[kind];
    let body = '';
    if (kind === 'skip') body = `<p class="skipnote">Not needed for ${p === 'maintenance' ? 'annual maintenance' : 'an administrative change'}.</p>`;
    else if (kind === 'now'){
      const i = secs.indexOf(s);
      body = `<div class="tl-card now">${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}${ASK[s.id](r)}
        <div class="nav">${i > 0 ? `<button type="button" class="btn" data-back>Back</button>` : ''}<span class="grow"></span>
          ${s.id === 'newstd' ? '' : `<button type="button" class="btn p" data-next>${nextLabel(s.id)}</button>`}</div></div>`;
    }
    else if (kind === 'done' && s.id !== 'newstd') body = `<div class="tl-card">${s.id === 'impact' ? impactDone(r) : kv(rows(s.id, r))}</div>`;
    items += `<li class="tl-item ${kind}" id="sec-${s.id}"><span class="tl-node" aria-hidden="true">${kind === 'done' ? CHECK : num(s.id)}</span><div class="tl-body">
      <div class="tl-head">${kind === 'done' ? `<span class="tl-num">${num(s.id)}</span>` : ''}<h2 id="h-${s.id}" tabindex="-1">${esc(s.label)}<span class="vh">: ${state}</span></h2>
        ${kind === 'done' ? `<span class="tl-meta">${fin[s.id] ? 'Finished ' + esc(fmtShort(fin[s.id])) : ''}${mode === 'fill' ? `<button type="button" class="btn ghost edit" data-goto="${s.id}">Edit</button>` : ''}</span>` : ''}</div>${body}</div></li>`;
  });
  if (mode === 'fill' && W.step === 'finish') items += `<li class="tl-item now finish" id="sec-finish"><span class="tl-node" aria-hidden="true">${CHECK}</span><div class="tl-body">
      <div class="tl-head"><h2 id="h-finish" tabindex="-1">Ready to Submit</h2></div>
      <div class="tl-card now"><p class="lead">Every part of the request is filled in above. Use Edit on any part to change it before you submit.</p>
        <div class="acts"><button type="button" class="btn p" data-submit>Submit Work Request</button><button type="button" class="btn" data-pdf="draft">Download PDF</button></div></div></div></li>`;
  const pct = shown ? Math.round(doneN / shown * 100) : 0;
  return `<ol class="tl" style="--tl-pct:${mode === 'view' ? 100 : pct}%">${items}</ol>`;
}
function glanceHTML(r){
  const pr = progress(), ef = EFFORT.find(e => e[0] === r.effort);
  const row = (k, v) => `<div class="row"><div class="k">${k}</div><div class="v${v ? '' : ' muted'}">${v || 'Not yet'}</div></div>`;
  const saved = W.dirty ? `<div class="saved dirty">Unsaved changes</div>` : W.savedAt ? `<div class="saved">Draft saved ${new Date(W.savedAt).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}</div>` : `<div class="saved">Not saved yet</div>`;
  const sponsors = r.sponsors.filter(s => s.name.trim()).map(s => esc(s.name + (s.company ? ', ' + s.company : ''))).join('<br>');
  return `<div class="card"><div class="prog">${ringSVG(pr.n, pr.total)}<div><b>${pr.n} of ${pr.total}</b><span>sections done</span></div></div>
    <h3>At a Glance</h3>${row('Standard', esc(r.standard))}${row('Level of Effort', ef ? `${ef[1]} (${ef[2]})` : '')}${row('Completion', esc(fmtDate(r.completion)))}${row('Sponsors', sponsors)}${pathOf(r) === 'full' ? row('Owning Workgroup', esc(r.owner)) : ''}
    <div class="acts">${W.step === 'finish' ? `<button type="button" class="btn p" data-submit>Submit Work Request</button>` : `<button type="button" class="btn p" data-savedraft>Save Draft</button>`}<button type="button" class="btn" data-exit>Save and Exit</button></div>${saved}</div>
    <p class="note">MISMO sets the WR# and facilitator after you submit.</p>`;
}
const LOGO_SM = '<svg role="img" aria-label="MISMO" viewBox="0 0 708 108"><use href="#mismo-logo"/></svg>';
function documentHTML(r, o){
  const mode = o.mode, secs = asked(r), p = pathOf(r);
  const skipped = (p === 'maintenance' || p === 'admin') ? SECTIONS.filter(s => s.full) : [];
  const order = SECTIONS.concat(r.isUpdate === 'no' ? [NEWSTD] : []);
  const num = id => String(order.findIndex(s => s.id === id) + 1).padStart(2, '0');
  let h = `<div class="dochead">${LOGO_SM}<span class="run">Care and Feeding Work Request</span></div>
    <div class="cover"><span class="tag"><b>WR</b><span>Work Request</span></span>
      <h1${r.title ? '' : ' class="placeholder"'}>${esc(r.title || 'Untitled Work Request')}</h1>
      <p class="lead">${r.standard ? `An update to <b>${esc(r.standard)}</b>.` : 'An update to an existing MISMO standard.'}${mode === 'fill' ? ' Each part appears here as you finish it.' : ''}</p>
      <dl class="meta">
        <div><dt>WR#</dt><dd${o.wr ? '' : ' class="muted"'}>${esc(o.wr || 'Set by MISMO')}</dd></div>
        <div><dt>MISMO Facilitator</dt><dd${o.fac ? '' : ' class="muted"'}>${esc(o.fac || 'Set by MISMO')}</dd></div>
        <div><dt>Path</dt><dd${p ? '' : ' class="muted"'}>${p ? PATH_LABEL[p] : 'Not decided'}</dd></div>
        <div><dt>Submitted</dt><dd${o.submitted ? '' : ' class="muted"'}>${o.submitted ? esc(fmtDate(o.submitted)) : 'Not yet'}</dd></div>
      </dl></div>`;
  order.forEach(s => {
    const visible = secs.includes(s), isSkip = skipped.includes(s);
    if (!visible && !isSkip) return;
    const isNow = mode === 'fill' && W.step === s.id, isDone = mode === 'view' || (W && W.done.has(s.id));
    const cls = isSkip ? 'skip' : isNow ? 'now' : isDone ? 'done' : 'later';
    const state = isSkip ? 'Not Needed' : isNow ? 'In Progress' : isDone ? 'Done' : 'To Come';
    h += `<section class="dsec ${cls}" id="sec-${s.id}" aria-labelledby="h-${s.id}"><header><span class="tag"><b>${num(s.id)}</b></span><span class="state">${state}</span>
      ${cls === 'done' && mode === 'fill' ? `<button type="button" class="btn ghost edit" data-goto="${s.id}">Edit</button>` : ''}
      <h2 id="h-${s.id}" tabindex="-1">${esc(s.label)}</h2></header>`;
    if (isSkip) h += `<p class="skipnote">Not needed for ${p === 'maintenance' ? 'annual maintenance' : 'an administrative change'}.</p>`;
    else if (isNow){
      const i = secs.indexOf(s);
      h += `<div class="ask">${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}${ASK[s.id](r)}
        <div class="nav">${i > 0 ? `<button type="button" class="btn" data-back>Back</button>` : ''}<span class="grow"></span>
          ${s.id === 'newstd' ? '' : `<button type="button" class="btn p" data-next>${nextLabel(s.id)}</button>`}</div></div>`;
    }
    else if (isDone && s.id !== 'newstd') h += kv(rows(s.id, r));
    h += `</section>`;
  });
  if (mode === 'fill' && W.step === 'finish') h += `<div class="finish" id="sec-finish"><h2 tabindex="-1" id="h-finish">Ready to Submit</h2>
      <p>Every part of the request is filled in above. Use Edit on any part to change it before you submit.</p>
      <div class="acts"><button type="button" class="btn p" data-submit>Submit Work Request</button>
        <button type="button" class="btn" disabled title="Coming next: a PDF of this document">Download PDF</button></div></div>`;
  return h + `<div class="docfoot"><span>Where our industry builds what\u2019s next.</span><span>MISMO</span></div>`;
}
function nextLabel(id){
  const secs = asked(W.r), rest = secs.slice(secs.findIndex(s => s.id === id) + 1).filter(s => !W.done.has(s.id));
  return rest.length ? 'Next' : 'Finish';
}

/* ─────────────── filling it in ─────────────── */
function progress(){ const secs = asked(W.r).filter(s => s.id !== 'newstd'); return { n: secs.filter(s => W.done.has(s.id)).length, total: secs.length }; }
function drawWizard(focus){
  closePop(); ACO = null;
  $('#wizard').innerHTML = `<div class="wr">${headHTML(W.r, { mode:'fill' })}<div class="wr-grid"><div>${timelineHTML(W.r, { mode:'fill', fin:W.fin })}</div>
    <aside class="glance" aria-label="At a glance">${glanceHTML(W.r)}</aside></div></div>`;
  if (focus === 'err'){ const q = document.querySelector('.has-err input:not(.vh),.has-err textarea,.has-err .date-btn,.has-err .choice input'); if (q) q.focus(); }
  else if (focus){
    const sec = document.getElementById(W.step === 'finish' ? 'sec-finish' : 'sec-' + W.step);
    if (sec){ sec.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block:'start' }); const hh = sec.querySelector('h2'); if (hh) hh.focus({ preventScroll:true }); }
  }
  drawRail();
}
function redraw(){
  const a = document.activeElement;
  const sel = !a ? null : a.dataset.radio ? `[data-radio="${a.dataset.radio}"][value="${a.value}"]` : a.dataset.arr ? `[data-arr="${a.dataset.arr}"][value="${a.value}"]`
    : a.dataset.imp ? `[data-imp="${a.dataset.imp}"]` : a.dataset.view ? `[data-view="${a.dataset.view}"]` : a.dataset.adopt ? `[data-adopt="${a.dataset.adopt}"]`
    : a.dataset.ac ? `[data-ac="${a.dataset.ac}"]` : a.dataset.k ? `[data-k="${a.dataset.k}"]` : a.dataset.row ? `[data-row="${a.dataset.row}"][data-i="${a.dataset.i}"][data-f="${a.dataset.f}"]` : a.hasAttribute('data-plan') ? '[data-plan]' : null;
  drawWizard(); if (sel){ const b = document.querySelector(sel); if (b) b.focus(); }
}
function goTo(id){ W.step = id; W.errs = {}; drawWizard(true); }
function nextSection(){
  const e = check(W.step, W.r); W.errs = e;
  if (Object.keys(e).length){ drawWizard('err'); return; }
  W.done.add(W.step); W.fin[W.step] = iso(new Date());
  const secs = asked(W.r), i = secs.findIndex(s => s.id === W.step);
  const after = secs.slice(i + 1).find(s => !W.done.has(s.id)) || secs.find(s => !W.done.has(s.id));
  W.step = after ? after.id : 'finish';
  saveDraft(true); drawWizard(true);
}
function back(){ const secs = asked(W.r), i = secs.findIndex(s => s.id === W.step); if (i > 0) goTo(secs[i - 1].id); }
function saveDraft(quiet){
  if (!W || !ME.submits) return Promise.resolve(false);
  const id = W.id, seq = W.editSeq || 0, now = Date.now();
  const snap = { by:{ email:ME.email, name:ME.name }, r: JSON.parse(JSON.stringify(W.r)), step: W.step, done: [...W.done], fin: Object.assign({}, W.fin), createdAt: W.createdAt, savedAt: now };
  setSaved('Saving\u2026');
  return mutate('drafts', d => { d[id] = snap; }).then(() => {
    if (W && W.id === id){ W.savedAt = now; if ((W.editSeq || 0) === seq) W.dirty = false; setSaved(); }
    drawRail(); if (!quiet) toast('Draft saved. It\u2019s under My Work Requests.'); return true;
  }, e => { if (W && W.id === id) setSaved('Not saved: ' + errText(e), true); toast('The draft could not be saved: ' + errText(e) + '.'); return false; });
}
function setSaved(text, bad){
  const el = document.querySelector('.glance .saved'); if (!el || !W) return;
  el.classList.toggle('dirty', !!bad || (!text && W.dirty));
  el.textContent = text || (W.dirty ? 'Unsaved changes' : W.savedAt ? 'Draft saved ' + new Date(W.savedAt).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : 'Not saved yet');
}
function startWizard(){
  if (!ME.submits){ toast('Your account can read work requests but not start one. Ask an administrator for Edit access.'); return; }
  W = { id:'d-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), r: blank(), step:'request', done:new Set(), fin:{}, errs:{}, savedAt:null, dirty:false, editSeq:0, createdAt:new Date().toISOString() };
  show('wizard'); drawWizard();
}
function resume(id){
  const d = fileOf('drafts').docs[id]; if (!d || !draftMine(d)) return;
  W = { id, r: Object.assign(blank(), d.r), step: d.step, done: new Set(d.done || []), fin: d.fin || {}, errs:{}, savedAt: d.savedAt, dirty:false, editSeq:0, createdAt: d.createdAt || new Date(d.savedAt).toISOString() };
  if (W.step !== 'finish' && !asked(W.r).some(s => s.id === W.step)) W.step = 'request';
  show('wizard'); drawWizard(true);
}
function nextReqId(docs){ let n = 0; Object.keys(docs).forEach(k => { const m = /^REQ-(\d+)$/.exec(k); if (m) n = Math.max(n, +m[1]); });
  let id; do { n++; id = 'REQ-' + String(n).padStart(4, '0'); } while (docs[id]); return id; }
async function submitRequest(){
  if (!W || W.submitting) return;
  W.submitting = true; document.querySelectorAll('[data-submit]').forEach(b => { b.disabled = true; });
  const draftId = W.id, now = new Date();
  const rec = { req: JSON.parse(JSON.stringify(W.r)), fin: Object.assign({}, W.fin), createdBy:{ email:ME.email, name:ME.name }, createdAt: W.createdAt || now.toISOString(),
    submitted: iso(now), submittedAt: now.toISOString(), status:'new', wr:'', facilitator:'', updatedAt: now.toISOString() };
  try {
    const id = await mutate('requests', d => { const nid = nextReqId(d); d[nid] = Object.assign({ id:nid }, rec); return nid; });
    await mutate('drafts', d => { delete d[draftId]; }).catch(() => {});      // a leftover draft can be deleted from My Work Requests
    refreshRequests();
    $('#doneText').innerHTML = `<b>${esc(rec.req.title)}</b> is submitted as ${id}. It\u2019s under My Work Requests, where you can follow it. MISMO will add a WR# and a facilitator, then assign it to an initiative or make it a potential initiative.`;
    W = null; show('done'); const h = document.querySelector('#view-done h2'); if (h) h.focus();
  } catch (e){
    if (W){ W.submitting = false; document.querySelectorAll('[data-submit]').forEach(b => { b.disabled = false; }); }
    toast('The request could not be submitted: ' + errText(e) + '.');
  }
}
/* the reviewer's changes to a submitted request */
function updateReq(id, patch, msg){
  return mutate('requests', d => { if (!d[id]) throw { code:'GONE' }; Object.assign(d[id], patch, { updatedAt:new Date().toISOString() }); })
    .then(() => { refreshRequests(); if (view === 'detail' && openId === id) drawDetail(); drawRail(); if (msg) toast(msg); return true; },
          e => { toast('Not saved: ' + errText(e) + '.'); return false; });
}
async function promote(x){
  const S = window.MismoStore; if (!S || !S.potential){ toast('The potential initiative tools could not load. Reload and try again.'); return; }
  const f = $('#decideForm'), r = x.req, name = ($('#p-name').value || '').trim() || r.title, now = new Date();
  try { if (S.types && S.types.load) await S.types.load(); } catch (e) {}
  const keys = S.typeKeys ? S.typeKeys() : new Set(L.types); const known = keys.size ? keys : new Set(L.types);
  const orgs = []; r.parts.forEach(g => g.orgs.forEach(o => { if (known.has(g.type)) orgs.push({ org:o.name, type:g.type, engagement:'committed',
    notes:'From work request ' + x.id + ': ' + ((ADOPT.find(a => a[0] === o.adopted) || [, 'adoption not given'])[1]) + ' of the current work product.' }); }));
  const raw = { name, domain: f.dataset.dom || '', stage:'not-started', broughtBy: sponsorsText(r), facilitator: x.facilitator || '', dateLogged: iso(now),
    summary: ($('#p-sum').value || '').trim(), whyRaised: r.solves || '', potentialSolutions: r.inScope.slice(), leadership: [],
    stakeholderTypes: [...new Set(r.parts.map(g => g.type))].filter(t => known.has(t)), organizations: orgs,
    updates: [{ text:'Logged from work request ' + x.id + ' (' + r.title + '), submitted by ' + (x.createdBy && x.createdBy.name || 'someone') + '.', by: ME.name, at: now.toISOString() }] };
  const v = S.potential.validate(raw, known);
  if (v.problems.length){ toast('The potential initiative could not be made: ' + v.problems[0]); return; }
  const btn = document.querySelector('[data-promote]'); if (btn) btn.disabled = true;
  let id = S.potential.slug(name);
  try { const list = await S.potential.list(); const taken = new Set((list.items || []).map(i => i.id)); const base = id.slice(0, 36); let n = 2; while (taken.has(id)) id = base + '-' + n++; } catch (e) {}
  const res = await S.potential.put(id, Object.assign({}, v.content, { updates: raw.updates }), null);
  if (!res.ok){ if (btn) btn.disabled = false; toast('The potential initiative could not be saved (' + res.reason + ').'); return; }
  await updateReq(x.id, { status:'potential', potentialId:id, potentialName:name, decidedBy:{ email:ME.email, name:ME.name }, decidedAt: now.toISOString() }, 'Potential initiative created: ' + name);
}
function dirty(){ if (W) W.editSeq = (W.editSeq || 0) + 1; if (W && !W.dirty){ W.dirty = true; const s = document.querySelector('.glance .saved'); if (s){ s.textContent = 'Unsaved changes'; s.classList.add('dirty'); } } }

/* ─────────────── the sidebar: the person's own list, and All for those allowed ─────────────── */
let view = 'mine', openId = null, filter = 'new';
const mine = () => requests.filter(byMe);
const byName = x => (x.createdBy && x.createdBy.name) || 'Someone';
const statusWord = x => x.status === 'assigned' ? 'Accepted' : x.status === 'potential' ? 'Accepted' : 'Submitted';
function drawRail(){
  const drafts = myDrafts(), subs = mine(), newN = requests.filter(x => x.status === 'new').length;
  const I = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const cur = k => (view === k || (k === 'mine' && view === 'detail' && openId && byMe(requests.find(q => q.id === openId) || {}))) ? ' aria-current="page"' : '';
  const items = drafts.map(([id, d]) => ({ key:'draft:' + id, t: d.r.title || 'Untitled Work Request', dot:'draft', label:'Draft' }))
    .concat(subs.map(x => ({ key:'req:' + x.id, t: x.req.title, dot: x.status, label: statusWord(x) })));
  const active = W ? 'draft:' + W.id : openId ? 'req:' + openId : '';
  $('#railNav').innerHTML = `
    <nav aria-label="Initiative Hub">
      <a href="index.html" title="MISMO Initiatives">${I('M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z')}<span>MISMO Initiatives</span></a>
      <a href="index.html#potential" title="Potential Initiatives">${I('M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z')}<span>Potential Initiatives</span></a>
      <a href="calendar.html" title="Meeting Calendar">${I('M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4 M3 10h18')}<span>Meeting Calendar</span></a>
    </nav>
    <div class="wr-group"><span>Work Requests</span>
      <nav aria-label="Work requests">
        ${ME.submits ? `<button type="button" data-newreq title="New Work Request"${view === 'wizard' && W && !W.savedAt ? ' aria-current="page"' : ''}>${I('M12 5v14 M5 12h14')}<span>New Work Request</span></button>` : ''}
        <button type="button" data-view-go="mine" title="My Work Requests"${cur('mine')}>${I('M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h5')}<span>My Work Requests</span><b class="count">${items.length}</b></button>
      </nav>
      ${items.length ? `<div class="mine" role="list" aria-label="My work requests">${items.map(it => `<button type="button" role="listitem" data-mine="${it.key}" title="${esc(it.t)}: ${it.label}"${active === it.key ? ' aria-current="true"' : ''}><i class="dot-${it.dot}" aria-hidden="true"></i><span>${esc(it.t)}</span></button>`).join('')}</div>` : ''}
      ${ME.decides ? `<nav aria-label="Everyone's work requests"><button type="button" data-view-go="all" title="All Work Requests"${cur('all') || (view === 'detail' && !cur('mine') ? ' aria-current="page"' : '')}>${I('M4 6h16 M4 12h16 M4 18h10')}<span>All Work Requests</span><b class="count${newN ? ' hot' : ''}">${newN}</b></button></nav>` : ''}
    </div>`;
}
/* ─────────────── My Work Requests ─────────────── */
function requesterStatus(x){
  if (x.status === 'assigned') return `Accepted. It\u2019s now part of <b>${esc(x.assignedTo)}</b>.`;
  if (x.status === 'potential') return `Accepted as a new potential initiative: <b>${esc(x.potentialName)}</b>.`;
  return 'Submitted, and waiting for MISMO to review it.';
}
function chipFor(x){
  if (x.status === 'assigned') return `<span class="chip assigned">Accepted</span>`;
  if (x.status === 'potential') return `<span class="chip potential">Accepted</span>`;
  return `<span class="chip new">Submitted</span>`;
}
const fmt = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
function drawMine(){
  const drafts = myDrafts(), subs = mine();
  $('#page').innerHTML = `<header class="mast"><div><div class="eyebrow">Work Requests</div><h1>My Work Requests</h1>
      <div class="sub">Your drafts, and every request you have submitted, with where each one stands.</div></div>
      ${ME.submits ? `<button type="button" class="btn p" data-newreq>+ New Work Request</button>` : ''}</header>
    <section class="drafts" aria-labelledby="h-d"><h2 id="h-d">Drafts</h2>${drafts.length ? `<div class="reqs">${drafts.map(([id, d]) => {
      const secs = asked(Object.assign(blank(), d.r)).filter(s => s.id !== 'newstd'), n = secs.filter(s => (d.done || []).includes(s.id)).length;
      return `<div class="card draft"><div class="t"><b>${esc(d.r.title || 'Untitled Work Request')}</b>
        <span>${d.r.standard ? 'Update to ' + esc(d.r.standard) + ' \u00b7 ' : ''}${n} of ${secs.length} sections done \u00b7 saved ${new Date(d.savedAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</span></div>
        <span class="mini" aria-hidden="true"><i style="width:${Math.round(n / secs.length * 100)}%"></i></span>
        <button type="button" class="btn p" data-resume="${id}">Resume</button><button type="button" class="btn" data-deldraft="${id}">Delete</button></div>`; }).join('')}</div>`
      : `<div class="card empty">No drafts. A request you start is saved here until you submit it, and follows your sign-in to any computer.</div>`}</section>
    <section class="mine-list" aria-labelledby="h-s"><h2 id="h-s" style="font-size:15px;margin:0 0 8px">Submitted</h2>${subs.length ? `<div class="reqs">${subs.map(x => `<button type="button" class="card req" data-open="${x.id}">
        <h3>${esc(x.req.title)}</h3><div class="meta"><span>Update to ${esc(x.req.standard)}</span><span>${x.id}${x.wr ? ' \u00b7 ' + esc(x.wr) : ''} \u00b7 submitted ${fmt(x.submitted)}</span></div>
        <div class="status">${requesterStatus(x)}</div><div class="right">${chipFor(x)}</div></button>`).join('')}</div>`
      : `<div class="card empty">Nothing submitted yet.</div>`}</section>`;
}
/* ─────────────── All Work Requests (only for people allowed to see all) ─────────────── */
function counts(){ return { new: requests.filter(x => x.status === 'new').length, assigned: requests.filter(x => x.status === 'assigned').length, potential: requests.filter(x => x.status === 'potential').length, all: requests.length }; }
function staffChip(x){
  if (x.status === 'assigned') return `<span class="chip assigned">Assigned to ${esc(x.assignedTo)}</span>`;
  if (x.status === 'potential') return `<span class="chip potential">Potential Initiative</span>`;
  return `<span class="chip new">New</span>`;
}
function drawAll(){
  const c = counts(), tabs = [['new','New'],['assigned','Assigned'],['potential','Potential Initiatives'],['all','All']];
  const shown = requests.filter(x => filter === 'all' || x.status === filter);
  $('#page').innerHTML = `<header class="mast"><div><div class="eyebrow">Work Requests</div><h1>All Work Requests</h1>
      <div class="sub">Every request submitted, until it is assigned to an existing initiative or becomes a potential initiative.${ME.decides ? ' Set the WR# and decide from each one.' : ''}</div></div>
      ${ME.submits ? `<button type="button" class="btn p" data-newreq>+ New Work Request</button>` : ''}</header>
    <div class="tabs" role="group" aria-label="Show">${tabs.map(([k, t]) => `<button type="button" class="tab" data-filter="${k}" aria-pressed="${filter === k}">${t}<span>${c[k]}</span></button>`).join('')}</div>
    <div class="reqs">${shown.length ? shown.map(x => `<button type="button" class="card req" data-open="${x.id}">
        <h3>${esc(x.req.title)}</h3>
        <div class="meta"><span>From ${esc(byName(x))}</span><span>Update to ${esc(x.req.standard)}</span><span>${x.id}${x.wr ? ' \u00b7 ' + esc(x.wr) : ''} \u00b7 ${fmt(x.submitted)}</span></div>
        <div class="right">${staffChip(x)}</div></button>`).join('') : `<div class="card empty">${requests.length ? 'Nothing here.' : 'No work requests yet.'}</div>`}</div>
    <div class="card seeall">Each person sees only the requests they created. Administrators of Work Requests and platform administrators see all of them.</div>`;
}
/* ─────────────── one request ─────────────── */
function drawDetail(){
  const x = requests.find(q => q.id === openId); if (!x) { show(ME.decides ? 'all' : 'mine'); return; }
  const r = x.req, mineToo = byMe(x);
  const pdfBtn = `<button type="button" class="btn" data-pdf="req:${x.id}" style="margin-top:12px">Download PDF</button>`;
  let side;
  if (ME.decides){
    const match = L.initiatives.find(n => n.toLowerCase() === (r.standard || '').toLowerCase());
    let decision;
    if (x.status === 'assigned') decision = `<div class="outcome assigned"><b>Assigned to ${esc(x.assignedTo)}.</b> The request is now part of that initiative\u2019s work.${x.decidedBy ? `<br><small>By ${esc(x.decidedBy.name)}, ${esc(fmt(String(x.decidedAt || '').slice(0, 10)))}</small>` : ''}</div><button type="button" class="btn ghost" data-undo style="margin-top:6px">Undo Decision</button>`;
    else if (x.status === 'potential') decision = `<div class="outcome potential"><b>Became a potential initiative:</b> ${esc(x.potentialName)}.${x.decidedBy ? `<br><small>By ${esc(x.decidedBy.name)}, ${esc(fmt(String(x.decidedAt || '').slice(0, 10)))}</small>` : ''}</div>${x.potentialId ? `<a class="btn ghost" href="potential.html?id=${encodeURIComponent(x.potentialId)}" style="margin-top:6px">Open the Potential Initiative \u2192</a>` : ''}`;
    else decision = `<div class="decide"><button type="button" class="btn p" data-mode="assign">Assign to an Existing Initiative</button>
        <button type="button" class="btn" data-mode="potential">Make a Potential Initiative</button></div><div id="decideForm"></div>`;
    side = `<div class="card"><h3>From ${esc(byName(x))}</h3><p style="margin:0;font-size:12.5px;color:var(--ink-3)">${x.id} \u00b7 submitted ${fmt(x.submitted)} \u00b7 ${staffChip(x)}</p>${pdfBtn}</div>
      <div class="card"><h3>MISMO Office</h3>
        <label for="d-wr">WR#</label><input type="text" id="d-wr" data-meta="wr" value="${esc(x.wr || '')}" placeholder="For example: WR2026_15">
        <label for="f-fac">MISMO Facilitator</label>${acHTML('fac', { value:x.facilitator || '', options:L.facilitators.map(f => ({ value:f, label:f })), placeholder:'Search facilitators', label:'MISMO facilitator',
          onPick: v => { updateReq(x.id, { facilitator:v }, v ? 'Facilitator saved' : 'Facilitator cleared'); } })}</div>
      <div class="card"><h3>Decision</h3>${decision}</div>
      ${match && x.status === 'new' ? `<p style="margin:0;font-size:12.5px;color:var(--ink-3)">\u201c${esc(r.standard)}\u201d matches an existing initiative on the Hub.</p>` : ''}`;
  } else {
    const steps = [['Submitted', fmt(x.submitted), 'ok'], ['Reviewed by MISMO', x.status === 'new' ? 'Not yet' : 'Done', x.status === 'new' ? 'now' : 'ok'],
      ['Outcome', x.status === 'new' ? 'Assigned to an initiative, or made a potential initiative' : x.status === 'assigned' ? 'Part of ' + x.assignedTo : 'New potential initiative: ' + x.potentialName, x.status === 'new' ? '' : 'ok']];
    side = `<div class="card"><h3>${mineToo ? 'Where It Stands' : 'From ' + esc(byName(x))}</h3><ol class="timeline">${steps.map(([t, s, c]) => `<li class="${c}"><b>${t}</b>${esc(s)}</li>`).join('')}</ol>${pdfBtn}</div>
      <p style="margin:0;font-size:12.5px;color:var(--ink-3)">MISMO adds the WR# and facilitator when it reviews the request.</p>`;
  }
  $('#page').innerHTML = `<button type="button" class="btn ghost" data-view-go="${mineToo ? 'mine' : 'all'}" style="margin-bottom:10px">\u2190 ${mineToo ? 'My Work Requests' : 'All Work Requests'}</button>
    <div class="wr">${headHTML(r, { mode:'view', wr:x.wr, fac:x.facilitator, submitted:x.submitted })}<div class="wr-grid"><div>${timelineHTML(r, { mode:'view', fin: x.fin || Object.fromEntries(SECTIONS.map(s => [s.id, x.submitted])) })}</div><aside class="side">${side}</aside></div></div>`;
}
function decideForm(mode){
  const x = requests.find(q => q.id === openId), r = x.req;
  const match = L.initiatives.find(n => n.toLowerCase() === (r.standard || '').toLowerCase());
  const f = $('#decideForm');
  if (mode === 'assign'){
    if (f.dataset.choice === undefined) f.dataset.choice = match || '';
    f.innerHTML = `<label for="f-assign">Initiative</label>${acHTML('assign', { value: f.dataset.choice, options:initOpts(), placeholder:'Search initiatives', label:'Initiative',
        onPick: v => { f.dataset.choice = v; } })}
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn p" data-assign>Assign</button><button type="button" class="btn" data-mode="">Cancel</button></div>`;
  } else {
    f.dataset.dom = f.dataset.dom || '';
    f.innerHTML = `<label for="p-name">Name</label><input type="text" id="p-name" value="${esc(r.title)}">
      <label for="f-dom">Proposed Domain</label>${acHTML('dom', { value:f.dataset.dom, options:domOpts(), placeholder:'Search domains', label:'Proposed domain',
        onPick: v => { f.dataset.dom = v; } })}
      <label for="p-sum">Summary</label><textarea id="p-sum">${esc(r.updates || r.inScope.join('; '))}</textarea>
      <p style="font-size:12px;color:var(--ink-3);margin:8px 0 0">Brought to MISMO by: ${esc(r.sponsors.filter(s => s.name).map(s => s.name + (s.company ? ', ' + s.company : '')).join('; '))}. Its stakeholder groups and organizations carry over.</p>
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn p" data-promote>Create Potential Initiative</button><button type="button" class="btn" data-mode="">Cancel</button></div>`;
  }
}

/* ─────────────── views ─────────────── */
function show(v){
  closePop(); ACO = null;
  view = v;
  ['page','wizard','done'].forEach(k => { document.getElementById('view-' + k).hidden = (k === 'page' ? !['mine','all','detail'].includes(v) : k !== v); });
  if (v !== 'wizard') $('#wizard').innerHTML = '';
  if (v === 'mine') drawMine(); else if (v === 'all') drawAll(); else if (v === 'detail') drawDetail();
  drawRail(); scrollTo({ top:0 });
}
function toast(t){ const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }


/* ─────────────── events ─────────────── */
document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.ac){ if (t.value) t.select(); acOpen(t.dataset.ac); } });
document.addEventListener('focusout', e => {
  const t = e.target; if (!t.dataset || !t.dataset.ac) return;
  setTimeout(() => { if (ACO && ACO.id === t.dataset.ac && !document.getElementById('ac-' + t.dataset.ac)?.contains(document.activeElement)) acClose(true); }, 0);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ac){ const o = ACS[t.dataset.ac]; if (o.free && o.onType) o.onType(t.value); acOpen(t.dataset.ac); return; }
  if (OPEN && t.classList.contains('pop-q')){ fillList(t.value); return; }
  if (!W || !t.closest('#wizard')) return;
  if (t.dataset.k){ W.r[t.dataset.k] = t.value; dirty();
    if (t.dataset.k === 'title'){ const h1 = document.querySelector('.wr-title'); if (h1){ h1.textContent = t.value || 'Untitled Work Request'; h1.classList.toggle('placeholder', !t.value); } }
    if (W.errs[t.dataset.k]){ delete W.errs[t.dataset.k]; const q = document.getElementById('q-' + t.dataset.k); if (q){ q.classList.remove('has-err'); const er = q.querySelector('.err'); if (er) er.remove(); } } }
  if (t.dataset.row){ W.r[t.dataset.row][+t.dataset.i][t.dataset.f] = t.value; dirty(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.meta){ const x = requests.find(q => q.id === openId); if (x && ME.decides) updateReq(x.id, { [t.dataset.meta]: t.value.trim() }, t.value.trim() ? 'WR# saved' : 'WR# cleared'); return; }
  if (!W || !t.closest('#wizard')) return;
  dirty();
  if (t.dataset.radio){ W.r[t.dataset.radio] = t.value; delete W.errs[t.dataset.radio]; if (t.dataset.radio === 'maintenance' && t.value === 'yes') W.r.admin = ''; redraw(); }
  else if (t.dataset.arr){ const a = W.r[t.dataset.arr]; const i = a.indexOf(t.value); if (t.checked && i < 0) a.push(t.value); if (!t.checked && i >= 0) a.splice(i, 1); delete W.errs[t.dataset.arr]; redraw(); }
  else if (t.dataset.imp){ W.r.impact[t.dataset.imp] = t.checked; if (t.dataset.imp === 'ldm' && !t.checked){ LDM_VIEWS.forEach(([vk]) => { W.r.impact[vk] = false; }); } redraw(); }
  else if (t.hasAttribute('data-plan')){ W.r.adoptionPlan = t.checked; redraw(); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.dataset && t.dataset.ac){
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp'){ e.preventDefault(); if (!ACO || ACO.id !== t.dataset.ac){ acOpen(t.dataset.ac, true); return; }
      ACO.active = Math.max(0, Math.min(ACO.items.length - 1, ACO.active + (k === 'ArrowDown' ? 1 : -1))); acMark(); return; }
    if (k === 'Enter'){ if (ACO && ACO.items.length){ e.preventDefault(); acPick(ACO.active); } else e.preventDefault(); return; }
    if (k === 'Escape'){ if (ACO){ e.preventDefault(); e.stopPropagation(); acClose(true); } return; }
    if (k === 'Tab'){ acClose(true); return; }
    return;
  }
  if (OPEN){
    const p = PICK[OPEN.id];
    if (e.key === 'Escape'){ e.preventDefault(); closePop(true); return; }
    if (p.kind === 'combo' && t.classList.contains('pop-q')){
      if (e.key === 'ArrowDown'){ e.preventDefault(); OPEN.active = Math.min(OPEN.items.length - 1, OPEN.active + 1); markActive(); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); OPEN.active = Math.max(0, OPEN.active - 1); markActive(); }
      else if (e.key === 'Enter'){ e.preventDefault(); choose(OPEN.active); }
      else if (e.key === 'Tab'){ closePop(); }
      return;
    }
    if (p.kind === 'date' && t.dataset.day){
      const k = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 }[e.key];
      if (k){ e.preventDefault(); moveDay(k); return; }
      if (e.key === 'PageUp' || e.key === 'PageDown'){ e.preventDefault(); const d = new Date(OPEN.focus + 'T12:00'); d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1)); OPEN.focus = iso(d); OPEN.month = new Date(d.getFullYear(), d.getMonth(), 1); drawCal(true); return; }
      if (e.key === 'Tab'){ closePop(); return; }
    }
  }
  if (e.key === 'Enter' && (t.dataset.adder || t.dataset.phadder !== undefined || t.dataset.orgadder !== undefined)){
    e.preventDefault();
    const sel = t.dataset.adder ? `[data-add="${t.dataset.adder}"]` : t.dataset.phadder !== undefined ? `[data-addph="${t.dataset.phadder}"]` : `[data-addorg="${t.dataset.orgadder}"]`;
    document.querySelector(sel).click();
  }
});
document.addEventListener('mousedown', e => { if (e.target.closest('.ac-list li[data-aci], .ac-arrow, .ac-x')) e.preventDefault();   // keep the focus in the field
  if (OPEN && !OPEN.host.contains(e.target)) closePop(); });
document.addEventListener('click', e => {
  const opt = e.target.closest('.ac-list li[data-aci]'); if (opt && ACO){ acPick(+opt.dataset.aci); return; }
  const tg = e.target.closest('[data-actoggle]'); if (tg){ const id = tg.dataset.actoggle, inp = document.getElementById('f-' + id); if (ACO && ACO.id === id) acClose(true); else { inp.focus(); acOpen(id, true); } return; }
  const cl = e.target.closest('[data-acclear]'); if (cl){ const id = cl.dataset.acclear, o = ACS[id], inp = document.getElementById('f-' + id);
    inp.value = ''; o.value = ''; if (o.free && o.onType) o.onType(''); else o.onPick(''); inp.focus(); acOpen(id, true); return; }
  if (OPEN){ const li = e.target.closest('.pop-list li[data-i]'); if (li){ choose(+li.dataset.i); return; } }
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.pick){ if (OPEN && OPEN.id === d.pick){ closePop(true); } else openPick(d.pick); return; }
  if (OPEN && d.mon){ OPEN.month = new Date(OPEN.month.getFullYear(), OPEN.month.getMonth() + (+d.mon), 1); const f = new Date(OPEN.focus + 'T12:00'); f.setMonth(f.getMonth() + (+d.mon)); OPEN.focus = iso(f); drawCal(false); return; }
  if (OPEN && d.day){ const p = PICK[OPEN.id]; closePop(); p.onPick(d.day); const f = document.getElementById('f-completion'); if (f) f.focus(); return; }
  if (d.viewGo){ if (W && W.dirty) saveDraft(true); W = null; openId = null; show(d.viewGo); return; }
  if (d.newreq !== undefined){ if (W && W.dirty) saveDraft(true); startWizard(); return; }
  if (d.mine){ const [k, id] = d.mine.split(':'); if (W && W.dirty) saveDraft(true); W = null; if (k === 'draft') resume(id); else { openId = id; show('detail'); } return; }
  if (b.id === 'themeBtn'){ const next = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('resources:hub:theme', next); } catch (err) {} paintTheme(); return; }
  if (d.resume){ resume(d.resume); return; }
  if (d.deldraft){ const id = d.deldraft; mutate('drafts', dd => { delete dd[id]; }).then(() => { show(view); toast('Draft deleted'); }, er => toast('The draft could not be deleted: ' + errText(er) + '.')); return; }
  if (d.filter){ filter = d.filter; drawAll(); return; }
  if (d.open){ openId = d.open; show('detail'); return; }
  if (d.mode !== undefined){ if (d.mode) decideForm(d.mode); else $('#decideForm').innerHTML = ''; return; }
  if (d.assign !== undefined){ const x0 = requests.find(q => q.id === openId), f = $('#decideForm'); if (!f.dataset.choice){ toast('Choose an initiative first.'); return; }
    b.disabled = true; updateReq(x0.id, { status:'assigned', assignedTo:f.dataset.choice, decidedBy:{ email:ME.email, name:ME.name }, decidedAt:new Date().toISOString() }, 'Assigned to ' + f.dataset.choice).then(ok => { if (!ok) b.disabled = false; }); return; }
  if (d.promote !== undefined){ const x0 = requests.find(q => q.id === openId); promote(x0); return; }
  if (d.undo !== undefined){ const x0 = requests.find(q => q.id === openId); updateReq(x0.id, { status:'new', assignedTo:'', decidedBy:null, decidedAt:null }, 'Decision undone'); return; }
  if (d.pdf){ makePDF(d.pdf); return; }
  if (d.again !== undefined){ startWizard(); return; }
  if (d.gomine !== undefined){ show('mine'); return; }
  if (!W) return;
  if (d.next !== undefined) nextSection();
  else if (d.back !== undefined) back();
  else if (d.savedraft !== undefined){ saveDraft(false); drawWizard(); }
  else if (d.exit !== undefined){ const p = saveDraft(true); W = null; show('mine'); p.then(ok => { if (ok){ show('mine'); toast('Draft saved. Resume it any time from My Work Requests.'); } }); }
  else if (d.goto){ goTo(d.goto); }
  else if (d.suggest){ W.r.completion = d.suggest; delete W.errs.completion; dirty(); drawWizard(); document.getElementById('f-completion').focus(); }
  else if (d.addsponsor !== undefined){ W.r.sponsors.push({ name:'', company:'' }); dirty(); drawWizard(); const rs = document.querySelectorAll('[data-row="sponsors"][data-f="name"]'); rs[rs.length - 1].focus(); }
  else if (d.delrow){ W.r[d.delrow].splice(+d.i, 1); dirty(); redraw(); }
  else if (d.add){ const inp = document.querySelector(`[data-adder="${d.add}"]`); const v = inp.value.trim(); if (v){ W.r[d.add].push(v); delete W.errs[d.add]; dirty(); drawWizard(); document.querySelector(`[data-adder="${d.add}"]`).focus(); } }
  else if (d.del){ W.r[d.del].splice(+d.i, 1); dirty(); drawWizard(); }
  else if (d.addorg !== undefined){ const gi = +d.addorg, inp = document.querySelector(`[data-orgadder="${gi}"]`), v = inp.value.trim(); if (v){ W.r.parts[gi].orgs.push({ name:v, adopted:'' }); dirty(); drawWizard(); document.querySelector(`[data-orgadder="${gi}"]`).focus(); } }
  else if (d.delorg){ const [gi, oi] = d.delorg.split(':').map(Number); W.r.parts[gi].orgs.splice(oi, 1); dirty(); drawWizard(); const a = document.querySelector(`[data-orgadder="${gi}"]`); if (a) a.focus(); }
  else if (d.delgroup !== undefined){ W.r.parts.splice(+d.delgroup, 1); dirty(); drawWizard(); document.getElementById('f-addgroup').focus(); }
  else if (d.adopt){ const [gi, oi, v] = d.adopt.split(':'); const o = W.r.parts[+gi].orgs[+oi]; o.adopted = o.adopted === v ? '' : v; dirty(); redraw(); }
  else if (d.view){ W.r.impact[d.view] = !W.r.impact[d.view]; dirty(); redraw(); }
  else if (d.addph !== undefined){ const inp = document.querySelector(`[data-phadder="${d.addph}"]`); const v = inp.value.trim(); if (v){ W.r.phases[+d.addph].push(v); dirty(); drawWizard(); document.querySelector(`[data-phadder="${d.addph}"]`).focus(); } }
  else if (d.delph !== undefined){ W.r.phases[+d.delph].splice(+d.i, 1); dirty(); drawWizard(); }
  else if (d.addphase !== undefined){ W.r.phases.push([]); dirty(); drawWizard(); document.querySelector(`[data-phadder="${W.r.phases.length - 1}"]`).focus(); }
  else if (d.delphase !== undefined){ W.r.phases.splice(+d.delphase, 1); dirty(); drawWizard(); }
  else if (d.submit !== undefined){ submitRequest(); }
});
/* a closing tab cannot wait for a save, so the browser is asked to warn about unsaved changes instead */
addEventListener('beforeunload', e => { if (W && W.dirty){ e.preventDefault(); e.returnValue = ''; } });


/* ─────────────── the PDF: the branded Work Request, built in the browser ───────────────
   Real text in the brand fonts (embedded, trimmed to Latin), US Letter, the MISMO logo and a
   running header on every page, page numbers, rows that never split across a page. Built with
   jsPDF; saved through the viewer's downloads capability inside claude.ai, and as a normal
   browser download on resources.mismo.org. */
const PDF_FONTS = new Proxy({}, { get: (t, k) => (window.WR_PDF && window.WR_PDF.fonts || {})[k] });   // from work-requests-pdf-assets.js
const pdfLogo = () => window.WR_PDF && window.WR_PDF.logo;
const PDF_FACES = { 'Archivo-ExtraBold.ttf':'A800', 'Archivo-Bold.ttf':'A700', 'LibreFranklin-Regular.ttf':'LF4', 'LibreFranklin-SemiBold.ttf':'LF6', 'LibreFranklin-Bold.ttf':'LF7', 'IBMPlexMono-Medium.sub.ttf':'MONO' };
function pdfRows(id, r){
  const t = x => String(x == null ? '' : x).trim();
  const v = x => t(x) ? { text: t(x) } : { text: 'Not answered', muted: true };
  const yn = x => x === 'yes' ? { text: 'Yes' } : x === 'no' ? { text: 'No' } : { text: 'Not answered', muted: true };
  const list = a => a && a.length ? { list: a } : { text: 'None', muted: true };
  const ef = EFFORT.find(e => e[0] === r.effort);
  switch (id){
    case 'request': return [['Update to an Existing Standard', yn(r.isUpdate)], ['Standard', v(r.standard)],
      ['Sponsors', list(r.sponsors.filter(s => t(s.name)).map(s => s.name + (t(s.company) ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
    case 'kind': return [['Annual Maintenance', yn(r.maintenance)], ...(r.maintenance === 'no' ? [['Administrative Change Only', yn(r.admin)]] : [])];
    case 'plan': return [['Discovery Needed', yn(r.discovery)], ['MISMO Segment', v(r.segments.join(', '))], ['Level of Effort', v(ef ? `${ef[1]} (${ef[2]})` : '')],
      ['Reasoning', v(r.effortWhy)], ['Expected Completion', v(fmtDate(r.completion))]];
    case 'status': return [['Updates Requested', v(r.updates)], ['How They Solve It', v(r.solves)]];
    case 'people': return [['Owning Workgroup', v(r.owner)], ['Stakeholders', r.parts.length ? { groups: r.parts } : { text: 'None', muted: true }],
      ...(adoptionLimited(r) ? [['Why a Revision Helps Adoption', v(r.adoptionWhy)]] : [])];
    case 'adoption': return [['Regulation or Mandate', yn(r.mandate)], ...(r.mandate === 'yes' ? [['Details', v(r.mandateDetails)]] : []), ['MISMO Staff Support', v(r.staff)], ['Partner Organizations', v(r.partners)]];
    case 'scope': return [['In Scope', list(r.inScope)], ['Out of Scope', list(r.outScope)]];
    case 'deliver': return [['Deliverables', list(deliverables(r))],
      ['Future Phases', v(r.future)], ['Recommendation', r.rec === 'cop' ? { text: 'Community of Practice (fast track)' } : r.rec === 'dwg' ? { text: 'Development Work Group (project)' } : { text: 'Not answered', muted: true }], ['Reasoning', v(r.recWhy)]];
    case 'impact': return [['Areas', { impact: IMPACT.map(([k, n]) => ({ name: n, on: !!r.impact[k], views: k === 'ldm' && r.impact[k] ? LDM_VIEWS.filter(([vk]) => r.impact[vk]).map(([, vt]) => vt).join(', ') : '' })) }]];
  }
  return [];
}
function buildPDF(r, meta){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter', compress:true });
  for (const [file, name] of Object.entries(PDF_FACES)){ doc.addFileToVFS(file, PDF_FONTS[file]); doc.addFont(file, name, 'normal'); }
  doc.setProperties({ title: r.title || 'Untitled Work Request', subject: 'Care and Feeding Work Request', author: 'MISMO', creator: 'MISMO Initiative Hub' });
  const PW = 612, PH = 792, ML = 54, MR = 54, CW = PW - ML - MR, TOP = 84, BOT = 62, LW = 150, VX = ML + LW + 12, VW = CW - LW - 12;
  const C = { dc:[15,49,76], ps:[80,164,219], sg:[75,75,75], mute:[150,152,150], ink:[15,49,76], soft:[69,97,121], good:[15,123,92], warn:[138,95,22], bad:[179,55,44], white:[255,255,255] };
  let y = 0;
  const font = (n, s, c) => { doc.setFont(n, 'normal'); doc.setFontSize(s); doc.setTextColor(...(c || C.ink)); };
  const lines = (text, width, n, s) => { doc.setFont(n, 'normal'); doc.setFontSize(s); return doc.splitTextToSize(String(text), width); };
  const dots = (x1, x2, yy) => { doc.setDrawColor(...C.ps); doc.setLineWidth(1); doc.setLineCap('round'); doc.setLineDashPattern([0.01, 2.6], 0); doc.line(x1, yy, x2, yy); doc.setLineDashPattern([], 0); doc.setLineCap('butt'); };
  const tag = (x, yy, txt, fill) => { doc.setFillColor(...(fill || C.dc)); const w = Math.max(20, doc.getStringUnitWidth(txt) * 7.5 + 10); doc.roundedRect(x, yy, w, 13, 2, 2, 'F'); font('MONO', 7.5, C.white); doc.text(txt, x + w / 2, yy + 9.2, { align:'center' }); return w; };
  function newPage(first){
    if (!first) doc.addPage();
    doc.addImage(pdfLogo(), 'PNG', ML, 34, 84, 12.8, 'logo', 'FAST');
    font('MONO', 7.5, C.mute); doc.text('Care and Feeding Work Request', PW - MR, 44, { align:'right' });
    y = TOP;
  }
  const room = h => y + h <= PH - BOT;
  /* the cover */
  newPage(true);
  const tw = tag(ML, y, 'WR'); font('MONO', 8, C.ps); doc.text('Work Request', ML + tw + 8, y + 9.2); y += 28;
  const tl = lines(r.title || 'Untitled Work Request', CW, 'A800', 24); font('A800', 24, C.dc); doc.text(tl, ML, y + 18, { lineHeightFactor: 1.08 }); y += tl.length * 24 * 1.08 + 8;
  font('LF4', 10.5, C.soft); const lead = lines(r.standard ? `An update to ${r.standard}.` : 'An update to an existing MISMO standard.', CW, 'LF4', 10.5); doc.text(lead, ML, y + 10); y += lead.length * 13 + 12;
  dots(ML, PW - MR, y); y += 16;
  const cols = [['WR#', meta.wr || 'Set by MISMO', !meta.wr], ['MISMO Facilitator', meta.fac || 'Set by MISMO', !meta.fac], ['Submitted', meta.submitted ? fmtDate(meta.submitted) : 'Not yet', !meta.submitted], ['Status', meta.status, false]];
  const cwid = CW / 4; let mh = 0;
  cols.forEach(([k, val, muted], i) => { font('LF6', 7.5, C.sg); doc.text(k, ML + i * cwid, y); const vl = lines(val, cwid - 12, muted ? 'LF4' : 'LF6', 9.5).slice(0, 3); font(muted ? 'LF4' : 'LF6', 9.5, muted ? C.mute : C.dc); doc.text(vl, ML + i * cwid, y + 13, { lineHeightFactor: 1.2 }); mh = Math.max(mh, vl.length); });
  y += 8 + mh * 11.5 + 8; dots(ML, PW - MR, y); y += 30;
  /* one answer row: measured first, so it never splits across a page */
  function measure(val){
    if (val.list) return val.list.reduce((h, s) => h + lines(s, VW - 12, 'LF4', 10).length * 13 + 3, 0);
    if (val.groups) return val.groups.reduce((h, g) => h + 15 + (g.orgs.length ? g.orgs.length * 14 : 14) + 4, 0);
    if (val.impact){ let h = 0; for (let i = 0; i < val.impact.length; i += 2) h += 18 + (val.impact.slice(i, i + 2).some(it => it.views) ? 11 : 0); return h; }
    return lines(val.text, VW, 'LF4', 10).length * 13;
  }
  function drawValue(val, yy){
    if (val.list){ val.list.forEach(s => { const l = lines(s, VW - 12, 'LF4', 10); doc.setFillColor(...C.ps); doc.circle(VX + 2.5, yy + 5.2, 1.7, 'F'); font('LF4', 10, C.ink); doc.text(l, VX + 12, yy + 8, { lineHeightFactor: 1.3 }); yy += l.length * 13 + 3; }); return; }
    if (val.groups){ val.groups.forEach(g => { font('LF7', 10, C.ink); doc.text(g.type, VX, yy + 8); yy += 15;
      if (!g.orgs.length){ font('LF4', 9.5, C.mute); doc.text('No organizations yet', VX + 12, yy + 8); yy += 14; }
      g.orgs.forEach(o => { const a = (ADOPT.find(x => x[0] === o.adopted) || [, 'Adoption Not Given'])[1]; const col = o.adopted === 'yes' ? C.good : o.adopted ? C.warn : C.mute;
        doc.setFillColor(...C.ps); doc.circle(VX + 14.5, yy + 5.2, 1.5, 'F'); font('LF4', 10, C.ink); doc.text(o.name, VX + 22, yy + 8);
        const nw = doc.getTextWidth(o.name); font('LF6', 8.5, col); doc.text(a, VX + 22 + nw + 8, yy + 8); yy += 14; });
      yy += 4; }); return; }
    if (val.impact){ const half = VW / 2; let rowY = yy;
      for (let i = 0; i < val.impact.length; i += 2){ const pair = val.impact.slice(i, i + 2);
      pair.forEach((it, j) => { const cx = VX + j * half, cy = rowY;
        if (it.on){ doc.setFillColor(...C.ps); doc.circle(cx + 5.5, cy + 5, 5.5, 'F'); doc.setDrawColor(...C.dc); doc.setLineWidth(1.3); doc.lines([[2, 2.2], [4.2, -4.6]], cx + 3, cy + 5.2); }
        else { doc.setDrawColor(200, 206, 212); doc.setLineWidth(1); doc.circle(cx + 5.5, cy + 5, 5, 'S'); }
        font(it.on ? 'LF6' : 'LF4', 9.5, it.on ? C.ink : C.mute); doc.text(it.name, cx + 16, cy + 8.3);
        if (it.views){ font('LF4', 8.5, C.soft); doc.text(it.views, cx + 16, cy + 19); } });
      rowY += 18 + (pair.some(it => it.views) ? 11 : 0); }
      return; }
    font('LF4', 10, val.muted ? C.mute : C.ink); doc.text(lines(val.text, VW, 'LF4', 10), VX, yy + 8, { lineHeightFactor: 1.3 });
  }
  /* the sections */
  const secs = asked(r), p = pathOf(r);
  const order = SECTIONS.filter(s => secs.includes(s)), num = id => String(order.findIndex(s => s.id === id) + 1).padStart(2, '0');
  order.forEach(s => {
    const skip = false;                                   // sections that don't apply are left out entirely
    if (skip){
      if (!room(20)) newPage();
      doc.setDrawColor(173, 196, 214); doc.setLineWidth(0.8); doc.setLineDashPattern([2, 2], 0); doc.roundedRect(ML, y, 20, 13, 2, 2, 'S'); doc.setLineDashPattern([], 0);
      font('MONO', 7.5, C.mute); doc.text(num(s.id), ML + 10, y + 9.2, { align:'center' });
      font('A700', 11, C.mute); doc.text(s.label, ML + 28, y + 9.8); const lw = doc.getTextWidth(s.label);
      font('LF4', 9, C.mute); doc.text(`Not needed for ${p === 'maintenance' ? 'annual maintenance' : 'an administrative change'}`, ML + 28 + lw + 10, y + 9.8);
      y += 26; return;
    }
    const rs = pdfRows(s.id, r);
    const rowH = ([k, val]) => Math.max(lines(k, LW, 'LF6', 8.5).length * 11, measure(val)) + 16;
    const head = cont => { tag(ML, y, num(s.id)); font('A700', 14, C.dc); doc.text(s.label + (cont ? ' (continued)' : ''), ML + 28, y + 10.5); y += 24; };
    const whole = 24 + rs.reduce((h, row) => h + rowH(row), 0);
    if (!room(whole) && whole <= PH - BOT - TOP) newPage();          // keep a section together when it fits on one page
    else if (!room(24 + rowH(rs[0]))) newPage();
    head(false);
    rs.forEach(([k, val], i) => {
      const h = rowH([k, val]);
      if (!room(h)){ newPage(); head(true); }
      else if (i > 0) dots(ML, PW - MR, y);
      font('LF6', 8.5, C.sg); doc.text(lines(k, LW, 'LF6', 8.5), ML, y + 16, { lineHeightFactor: 1.3 });
      drawValue(val, y + 8);
      y += h;
    });
    y += 16;
  });
  /* page numbers, once the count is known */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){ doc.setPage(i); font('MONO', 7, C.mute); doc.text('Where our industry builds what\u2019s next.', ML, PH - 32); doc.text(`Page ${i} of ${n}`, PW - MR, PH - 32, { align:'right' }); }
  return doc.output('blob');
}
const pdfName = (r, wr) => ((wr ? wr + ' ' : '') + (r.title || 'Untitled Work Request')).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
function statusLine(x){ return x.status === 'assigned' ? 'Assigned to ' + x.assignedTo : x.status === 'potential' ? 'Became a potential initiative' : 'Submitted, in review'; }
function loadScript(src){ return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); }); }
async function pdfReady(){ if (!window.jspdf) await loadScript('vendor/jspdf-2.5.1.umd.min.js'); if (!window.WR_PDF) await loadScript('work-requests-pdf-assets.js'); }
async function makePDF(key){
  try { await pdfReady(); } catch (e){ toast('The PDF tool could not load. Check the connection and try again.'); return; }
  let r, meta;
  if (key === 'draft'){ r = W.r; meta = { status:'Draft' }; }
  else { const x = requests.find(q => q.id === key.slice(4)); if (!x) return; r = x.req; meta = { wr:x.wr, fac:x.facilitator, submitted:x.submitted, status:statusLine(x) }; }
  let blob; try { blob = buildPDF(r, meta); } catch (e){ console.error(e); toast('The PDF could not be made.'); return; }
  const filename = pdfName(r, meta.wr);
  window.__lastPDF = { blob, filename };            // for the prototype's own tests
  const viaViewer = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads').catch(() => null) : null;
  if (viaViewer){
    try { await viaViewer.save({ filename, data: blob }); toast('PDF saved'); }
    catch (e){ toast(e && e.code === 'declined' ? 'Download cancelled' : e && e.code === 'rate_limited' ? 'A save is already waiting for you to confirm.' : 'The PDF could not be saved here.'); }
    return;
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  toast('PDF downloaded');
}

/* the theme button, as the Hub's */
const MOON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6.4 6.4 0 009 9 9 9 0 11-9-9z"/></svg>';
const SUN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.4v2.3M12 19.3v2.3M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.4 12h2.3M19.3 12h2.3M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>';
function isDark(){ const t = document.documentElement.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); }
function paintTheme(){ const dk = isDark(); $('#themeBtn').innerHTML = (dk ? SUN : MOON) + `<span>${dk ? 'Light Mode' : 'Dark Mode'}</span>`; }
new MutationObserver(paintTheme).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
paintTheme();
/* ─────────────── start ─────────────── */
function banner(html){ const b = $('#banner'); b.innerHTML = html; b.hidden = false; }
async function poll(){
  if (document.hidden || fileOf('requests').saving || fileOf('drafts').saving) return;
  try { await Promise.all([load('requests'), load('drafts')]); } catch (e) { return; }
  refreshRequests(); drawRail();
  const busy = document.activeElement && document.activeElement.closest && document.activeElement.closest('.side, #decideForm');
  if (view === 'mine') drawMine(); else if (view === 'all') drawAll(); else if (view === 'detail' && !busy && !($('#decideForm') && $('#decideForm').innerHTML)) drawDetail();
}
function boot(){
  if (!RS){ banner('<b>The sign-in couldn\u2019t load.</b> Reload the page. If it keeps happening, the page isn\u2019t being opened from resources.mismo.org.'); return; }
  RS.mount(document.getElementById('rs-account'));
  RS.onChange(s => { if (!s) location.reload(); });
  RS.requireAccess(PROJECT, { toolName:'Work Requests', eyebrow:'Programs & Operations' }).then(async () => {
    refreshMe();
    try { await Promise.all([load('requests'), load('drafts')]); }
    catch (e){ banner('<b>Work requests couldn\u2019t be read.</b> ' + esc(errText(e)) + '. Reload to try again; nothing you enter now can be saved until they load.'); }
    refreshRequests();
    try { const res = await fetch('data/facilitator-roster.json?t=' + Date.now(), { cache:'no-store' }); if (res.ok){ const j = await res.json(); const list = (j.facilitators || j || []).map(f => f.name).filter(Boolean); if (list.length) L.facilitators = list; } } catch (e) {}
    const h = location.hash.replace('#', '');
    if (h === 'new' && ME.submits) startWizard(); else show(h === 'all' && ME.decides ? 'all' : h === 'mine' ? 'mine' : (ME.decides ? 'all' : 'mine'));
    setInterval(poll, 30000); document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }, e => { if (e && e.code === 'OFFLINE') banner('<b>Work Requests couldn\u2019t reach the sign-in service.</b> Check your connection, then reload the page.'); });
}
boot();

})();
