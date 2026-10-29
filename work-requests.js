/* Work Requests for the MISMO Initiative Hub. Built from the approved prototype (Sept 30, 2026)
   by /home/claude/hubbuild/wr in the session that made it; see CLAUDE.md, "Work Requests". */
(function(){
'use strict';
const L = {"types": ["Aggregator/Investor", "AVM Provider", "Bank", "Compliance Vendor", "Document Provider", "eMortgage Technology Providers", "GSE", "Investors/Aggregators", "Law Firm", "Lender (3rd Party LOS)", "Lender (Proprietary LOS)", "LOS Provider", "Mortgage Originator", "Regulator", "Servicer", "Servicing System", "Third-Party Reviewer", "Title Agent", "Title Production System", "Title Underwriter", "Trade Association", "Warehouse Lenders"], "workgroups": ["AI Community of Practice", "API Community of Practice", "Architecture Workgroup", "Automated Valuation Model DWG", "Business Glossary CoP", "Business Process Model CoP", "Commercial & Other RE Digital Notes DWG", "Commercial CoP", "Credit Reporting CoP", "Data Governance & Management CoP", "Decision Modeling CoP", "Digital Interoperability CoP", "eHELOC DWG", "eMortgage CoP", "eNote Master Control Agreement DWG", "HERO CoP", "Housing Counseling DWG", "Information Management", "Loan Application Data Exchange DWG", "MI Claim Submission DWG", "Mortgage Compliance Dataset DWG", "Mortgage Insurance CoP", "Origination CoP", "Property & Valuation Services CoP", "Remote Online Notarization DWG", "Reverse Mortgage DWG", "Secondary CoP", "Servicing CoP", "Servicing Transfers DWG", "TIE (Technology Impact & Enablement) CoP", "Title & Closing CoP", "Title & Closing Docs to Data DWG", "Title Pricing API DWG", "VA Documents to Data DWG", "Verifiable Profile SMART Doc DWG"], "initiatives": ["Mortgage Compliance Dataset", "Common Confidence Score", "Title Order Dataset Specification", "AVM Testing Guidance and Best Practices", "AVM Fairness Testing Guidelines", "Property & Valuation Services Procurement Dataset", "MISMO FRAME", "eNote Master Control Agreement", "Investor Reporting Dataset", "Loan Boarding Dataset", "Commitment File Dataset", "Credit Score Implementation Guide", "MI Claim Submission Dataset"], "domains": ["Mortgage Compliance", "eMortgage", "Servicing", "Title & Closing", "Originations", "Valuation", "Artificial Intelligence", "Governance", "Mortgage Insurance", "Secondary", "Credit Reporting"], "facilitators": ["Erin Bittenbender", "Kathryn Williams", "Kellie Stoll", "Leeann Walker", "Meghan Tidgewell"], "initiativeDomains": {"Mortgage Compliance Dataset": ["Mortgage Compliance"], "Common Confidence Score": ["Originations", "Valuation"], "Title Order Dataset Specification": ["Title & Closing"], "AVM Testing Guidance and Best Practices": ["Valuation"], "AVM Fairness Testing Guidelines": ["Valuation"], "Property & Valuation Services Procurement Dataset": ["Valuation"], "MISMO FRAME": ["Artificial Intelligence", "Governance"], "eNote Master Control Agreement": ["eMortgage"], "Investor Reporting Dataset": ["Servicing"], "Loan Boarding Dataset": ["Servicing"], "Commitment File Dataset": ["Secondary"], "Credit Score Implementation Guide": ["Credit Reporting"], "MI Claim Submission Dataset": ["Mortgage Insurance"]}, "domainColors": {"Mortgage Compliance": "#0E9488", "eMortgage": "#D97706", "Servicing": "#2A4DFF", "Title & Closing": "#0891B2", "Originations": "#C2255C", "Valuation": "#7C3AED", "Artificial Intelligence": "#C026D3", "Governance": "#475569", "Mortgage Insurance": "#059669", "Secondary": "#4F46E5", "Credit Reporting": "#9F1239"}};
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
const PROJECT = 'hub-requests';     // the private GitMISMO/GitMISMO-initiative-hub-requests, through the relay
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
      throw { status:r.status, code:(b && b.error) || ('HTTP_' + r.status), message: b && b.message, gh: b && b.status };
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
    : c === 'GONE' ? 'that request is no longer there'
    : c === 'GITHUB' && e.gh === 404 ? 'the saving service can\u2019t reach the requests repository. An administrator needs to check its access'
    : (e && e.message) || 'something went wrong';
}


/* ─────────────── requests ─────────────── */
function blank(){
  return { isUpdate:'', standard:'', title:'', sponsors:[{name:'',company:''}], cop:'',
    maintenance:'', admin:'', discovery:'', segments:[], effort:'', effortWhy:'', completion:'',
    challenge:'', updates:'', solves:'', owner:'', parts:[], adoptionWhy:'',
    mandate:'', mandateDetails:'', staff:'', partners:'',
    inScope:[], outScope:[], phases:[[]], adoptionPlan:true, future:'', rec:'', recWhy:'',
    impact:{glossary:false,bpm:false,ldm:false,ldmDomain:false,ldmPiv:false,ldmPsv:false,xml:false,api:false,megs:false,smartdoc:false},
    /* a new standard (the "No" path), started from an idea: challenge (above), today, pains; vision, costs, success; stake (rows), engaged; market, tech, consumer */
    today:'', pains:'', vision:'', costs:'', success:'', stake:[], engaged:[], market:'', tech:'', consumer:'', fromIdea:null };
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
  return r.phases.map((items, i) => items.concat(i === r.phases.length - 1 && r.adoptionPlan && (pathOf(r) === 'full' || r.isUpdate === 'no') ? ['Adoption Plan'] : []))
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
/* A new standard's own sections (Perry, 16 Oct 2026). New standards start as an idea from the public Submit an Idea form:
   staff turn one into a Work Request from the Ideas Inbox (r.fromIdea) and complete it. Without an idea, "No" points there. */
const NSEC = { current:{ id:'current', label:'Current State', lead:'The business challenge the proposed standard is meant to address, and how things work today.' },
  future:{ id:'future', label:'Future State', lead:'What the process looks like with a standard in place.' },
  stake:{ id:'stake', label:'Implementation Stakeholders', lead:'Who needs to take part to develop, adopt and implement the standard, and what each would gain.' } };
const SIZE = [['low','Low','Minimal process updates'],['medium','Medium','Non-breaking updates'],['high','High','Full process redesign']];
function asked(r){
  if (r.isUpdate === 'no'){ if (!r.fromIdea) return [SECTIONS[0], NEWSTD]; const by = id => SECTIONS.find(s => s.id === id);
    return [SECTIONS[0], by('plan'), NSEC.current, NSEC.future, NSEC.stake, by('adoption'), by('scope'), by('deliver'), by('impact')]; }
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
    <div class="adder" style="margin-top:8px"><input type="text" id="f-${k}" data-adder="${k}" placeholder="${esc(ph)}"><button type="button" class="btn" data-add="${k}">+ Add</button></div><p class="adder-hint" aria-live="polite">Press Enter or <b>+ Add</b> to put it on the list.</p>`;
}
const COPS = L.workgroups.filter(w => /community of practice|\bcop\b/i.test(w));
function suggested(r){
  const e = EFFORT.find(x => x[0] === r.effort); if (!e) return '';
  const d = new Date(); d.setMonth(d.getMonth() + e[3]); d.setHours(12, 0, 0, 0); return iso(d);
}
const ASK = {
  request(r){
    const top = radios('isUpdate','Is this an update to an existing standard?', YN);
    if (r.isUpdate === 'no' && !r.fromIdea) return top + `<div class="pathnote info">New standards start as an idea. Share it through the <a href="/submit-an-idea/" target="_blank" rel="noopener">Submit an Idea</a> form; once MISMO staff have talked it through, they turn it into a Work Request and complete it.${ME.decides ? ' Administrators: open the <b>Ideas Inbox</b> and choose <b>Turn into a Work Request</b>.' : ''}</div>`;
    if (r.isUpdate !== 'yes' && r.isUpdate !== 'no') return top;
    const rows = r.sponsors.map((s, i) => `<div class="rowf two">
      <input type="text" data-row="sponsors" data-i="${i}" data-f="name" value="${esc(s.name)}" placeholder="Name" aria-label="Sponsor ${i + 1} name">
      <input type="text" data-row="sponsors" data-i="${i}" data-f="company" value="${esc(s.company)}" placeholder="Company" aria-label="Sponsor ${i + 1} company">
      <button type="button" class="x" data-delrow="sponsors" data-i="${i}" aria-label="Remove sponsor ${i + 1}"${r.sponsors.length === 1 ? ' disabled' : ''}>\u00d7</button></div>`).join('');
    const sponsorsF = field('sponsors','Work Request Sponsor(s)', `<div class="rows">${rows}</div><button type="button" class="btn ghost add" data-addsponsor>+ Add Another Sponsor</button>`, { for:'x', hint:'Name and company for each sponsor.' });
    if (r.isUpdate === 'no'){ const f = r.fromIdea;
      return top + `<div class="pathnote info">Started from idea <b>${esc(f.id)}</b>, sent by ${esc(f.name)}${f.company ? ', ' + esc(f.company) : ''} (<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>). What they sent is filled in where it fits; change anything.</div>` +
        field('title','Work Request Name', text('title','For example: Climate Risk Data Standard'), { hint:'This becomes the headline of the request above.' }) + sponsorsF +
        field('cop','Community of Practice Sponsor', acHTML('cop', { value:r.cop, options:COPS.map(c => ({ value:c, label:c })), free:true, freeHint:'Not in the calendar', label:'Community of Practice sponsor',
          placeholder:'Search communities of practice', onType: v => { W.r.cop = v; dirty(); }, onPick: v => { W.r.cop = v; dirty(); } }), { optional:true }); }
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
      <div class="adder"><input type="text" data-orgadder="${gi}" placeholder="Type an organization, then press Enter" aria-label="Add an organization to ${esc(g.type)}"><button type="button" class="btn" data-addorg="${gi}">+ Add</button></div><p class="adder-hint" aria-live="polite">Press Enter or <b>+ Add</b> to put it on the list.</p></div>`).join('');
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
      (r.isUpdate === 'no' ? field('market','Market Condition Impacts', area('market','For example: origination volumes decreasing; a change in administration'), { optional:true, hint:'Foreseeable changes in market conditions that could influence development or adoption.' }) +
        field('tech','Related Technologies', area('tech'), { optional:true, hint:'Technologies or related solutions that connect with or influence this effort.' }) : '') +
      field('staff','How can MISMO staff assist in supporting this effort?', area('staff'), { optional:true }) +
      field('partners','Partner Organizations', area('partners','For example: MBA committees; partner trade associations like ALTA, CSBS, Lenders One; government agencies'),
        { optional:true, hint:'External organizations or industry groups that could help support or advocate for adoption of this work.' }) +
      (r.isUpdate === 'no' ? field('consumer','Consumer Benefit', area('consumer'), { optional:true, hint:'How the standard would ultimately benefit consumers: greater transparency, improved accuracy, faster processes or cost savings.' }) : '');
  },
  scope(){
    return field('inScope','In Scope', listBuilder('inScope','Type an item, then press Enter'), { for:'f-inScope', hint:'A brief description for each; keep each one independent of the others.' }) +
      field('outScope','Out of Scope', listBuilder('outScope','Type an item, then press Enter'), { for:'f-outScope', optional:true });
  },
  deliver(r){
    const phases = r.phases.map((items, pi) => `<div class="phase"><h4>Phase ${pi + 1}${r.phases.length > 1 ? `<button type="button" class="btn ghost" data-delphase="${pi}">Remove Phase</button>` : ''}</h4>
      <ul class="items">${items.map((t, i) => `<li><span>${esc(t)}</span><button type="button" class="x" data-delph="${pi}" data-i="${i}" aria-label="Remove ${esc(t)}">\u00d7</button></li>`).join('')}
      ${pi === r.phases.length - 1 && (pathOf(r) === 'full' || r.isUpdate === 'no') ? `<li class="locked"><label class="choice${r.adoptionPlan ? ' on' : ''}" style="border:0;background:none;padding:0;min-width:0"><input class="vh" type="checkbox" data-plan${r.adoptionPlan ? ' checked' : ''}><span class="ind box" aria-hidden="true"></span><span>Adoption Plan</span></label><em>Required for Published Work Products</em></li>` : ''}</ul>
      <div class="adder" style="margin-top:8px"><input type="text" id="f-ph${pi}" data-phadder="${pi}" placeholder="Type a deliverable, then press Enter"><button type="button" class="btn" data-addph="${pi}">+ Add</button></div><p class="adder-hint" aria-live="polite">Press Enter or <b>+ Add</b> to put it on the list.</p></div>`).join('');
    return field('phases','Deliverables Requested', phases + `<button type="button" class="btn ghost add" data-addphase>+ Add a Phase</button>`, { for:'f-ph0', hint:'The deliverables the workgroup will produce, by phase. Phase 1 needs at least one.' }) +
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
  newstd(){ return `<div class="pathnote info" style="margin-top:0">A new standard begins as an idea (see above). Go back to change your answer.</div>`; },
  current(){
    return field('challenge','What business challenge is this proposed standard meant to address?', area('challenge'), { hint:'A clear, concise explanation.' }) +
      field('today','How does the process work today?', area('today'), { hint:'The key steps involved.' }) +
      field('pains','What inefficiencies, inconsistencies or risks does today\u2019s process create for stakeholders?', area('pains'));
  },
  future(){
    return field('vision','How should the process work in the future?', area('vision'), { hint:'Your proposed approach or recommendation.' }) +
      field('costs','Would adopting this standard lower costs for key stakeholders?', area('costs'), { optional:true, hint:'Which costs would be reduced, and how the future process would support that.' }) +
      field('success','How should success be evaluated once the future process is in place?', area('success'));
  },
  stake(r){
    const st = r.stake || [];
    const cards = st.map((g, i) => `<div class="group" id="stk-${i}"><div class="group-h"><b>Stakeholder group ${i + 1}</b><button type="button" class="btn ghost" data-delrow="stake" data-i="${i}">Remove</button></div>
      <div class="stk">
        <label class="stk-f"><span>Stakeholder group</span>${acHTML('stk' + i, { value:g.type, options:L.types.map(t => ({ value:t, label:t })), free:true, freeHint:'Not a listed type', label:'Stakeholder group ' + (i + 1),
          placeholder:'For example: IMBs, credit unions, LOS providers, servicers, GSEs', onType: v => { W.r.stake[i].type = v; dirty(); }, onPick: v => { W.r.stake[i].type = v; dirty(); delete W.errs.stake; } })}</label>
        <label class="stk-f"><span>Problem statement</span><textarea data-row="stake" data-i="${i}" data-f="problem" placeholder="The challenges this group has today">${esc(g.problem)}</textarea></label>
        <label class="stk-f"><span>Expected benefit</span><textarea data-row="stake" data-i="${i}" data-f="benefit" placeholder="What this group would gain">${esc(g.benefit)}</textarea></label>
        <label class="stk-f"><span>Primary participant roles</span><input type="text" data-row="stake" data-i="${i}" data-f="roles" value="${esc(g.roles)}" placeholder="For example: business analysts, product owners, compliance officers"></label>
        <div class="stk-f"><span>Implementation size</span><span class="seg" role="group" aria-label="Implementation size for stakeholder group ${i + 1}">${SIZE.map(([v, t, d]) => `<button type="button" data-ssize="${i}:${v}" aria-pressed="${g.size === v}" title="${d}">${t}</button>`).join('')}</span></div>
      </div></div>`).join('');
    return field('stake','Stakeholder Groups', `<div class="groups">${cards}</div><button type="button" class="btn ghost add" data-addstake>+ Add a Stakeholder Group</button>`,
        { for:'x', hint:'For each group: the problem it has today, the benefit it would gain, the roles that should join the workgroup, and how big implementation would be (Low: minimal process updates; Medium: non-breaking updates; High: full process redesign).' }) +
      field('engaged','Organizations Already Engaged', listBuilder('engaged','Type an organization, then press Enter'), { for:'f-engaged', optional:true, hint:'Organizations already interested in taking part.' });
  },
};
function check(id, r){
  const e = {};
  const need = (k, msg) => { if (!String(r[k] || '').trim()) e[k] = msg; };
  if (id === 'request'){ if (!r.isUpdate) e.isUpdate = 'Choose Yes or No.';
    if (r.isUpdate === 'yes'){ need('standard', 'Name the standard being updated.'); need('title', 'Give the request a name.'); if (!r.sponsors.some(s => s.name.trim())) e.sponsors = 'Add at least one sponsor.'; }
    if (r.isUpdate === 'no' && r.fromIdea){ need('title', 'Give the request a name.'); if (!r.sponsors.some(s => String(s.name || '').trim())) e.sponsors = 'Add at least one sponsor.'; } }
  if (id === 'current'){ need('challenge', 'Describe the business challenge.'); need('today', 'Describe how the process works today.'); need('pains', 'Describe the inefficiencies, inconsistencies or risks.'); }
  if (id === 'future'){ need('vision', 'Describe how the process should work in the future.'); need('success', 'Say how success should be evaluated.'); }
  if (id === 'stake'){ if (!(r.stake || []).some(g => String(g.type || '').trim())) e.stake = 'Add at least one stakeholder group.'; }
  if (id === 'kind'){ if (!r.maintenance) e.maintenance = 'Choose Yes or No.'; else if (r.maintenance === 'no' && !r.admin) e.admin = 'Choose Yes or No.'; }
  if (id === 'plan'){ if (!r.discovery) e.discovery = 'Choose Yes or No.'; if (!r.segments.length) e.segments = 'Choose at least one segment.';
    if (!r.effort) e.effort = 'Choose a level of effort.'; need('completion', 'Choose a completion date.'); }
  if (id === 'status'){ need('updates', 'Describe the updates you are requesting.'); }
  if (id === 'people'){ need('owner', 'Choose the workgroup, or Not sure.'); if (adoptionLimited(r)) need('adoptionWhy', 'Explain why a revision would be valuable, since adoption is limited.'); }
  if (id === 'adoption'){ if (!r.mandate) e.mandate = 'Choose Yes or No.'; }
  if (id === 'scope'){ if (!r.inScope.length) e.inScope = 'Add at least one thing that is in scope.'; }
  if (id === 'deliver'){ if (!(r.phases[0] || []).length) e.phases = 'Add at least one Phase 1 deliverable.'; if (!r.rec) e.rec = 'Choose a recommendation.'; }
  return e;
}

/* ─────────────── the document ─────────────── */
function rows(id, r){
  const v = x => (x == null || x === '' || (Array.isArray(x) && !x.length)) ? '<span class="none">Not answered</span>' : esc(x);
  const yn = x => x === 'yes' ? 'Yes' : x === 'no' ? 'No' : '<span class="none">Not answered</span>';
  const list = a => a && a.length ? `<ul>${a.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="none">None</span>';
  const p = pathOf(r), ef = EFFORT.find(e => e[0] === r.effort);
  switch (id){
    case 'request': if (r.isUpdate === 'no') return [['Update to an Existing Standard', yn(r.isUpdate)], ['From Idea', v(r.fromIdea ? r.fromIdea.id + ', sent by ' + r.fromIdea.name + (r.fromIdea.company ? ', ' + r.fromIdea.company : '') + ' (' + r.fromIdea.email + ')' : '')],
      ['Sponsors', list(r.sponsors.filter(s => String(s.name || '').trim()).map(s => s.name + (s.company ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
      return [['Update to an Existing Standard', yn(r.isUpdate)], ['Standard', v(r.standard)], ['Sponsors', list(r.sponsors.filter(s => s.name.trim()).map(s => s.name + (s.company ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
    case 'kind': return [['Annual Maintenance', yn(r.maintenance)], ...(r.maintenance === 'no' ? [['Administrative Change Only', yn(r.admin)]] : [])];
    case 'plan': return [['Discovery Needed', yn(r.discovery)], ['MISMO Segment', r.segments.length ? r.segments.map(s => `<span class="pill">${esc(s)}</span>`).join('') : v('')],
      ['Level of Effort', ef ? `${ef[1]} (${ef[2]})` : v('')], ['Reasoning', v(r.effortWhy)], ['Expected Completion', v(fmtDate(r.completion))]];
    case 'status': return [['Updates Requested', v(r.updates)], ['How They Solve It', v(r.solves)]];
    case 'people': {
      const al = x => (ADOPT.find(a => a[0] === x) || [, 'Adoption Not Given'])[1];
      const g = r.parts.map(x => `<li><b>${esc(x.type)}</b>: ${x.orgs.length ? x.orgs.map(o => `${esc(o.name)} <span style="color:var(--sg)">(${al(o.adopted)})</span>`).join(', ') : '<span class="none">no organizations yet</span>'}</li>`);
      return [['Owning Workgroup', v(r.owner)], ['Stakeholders', g.length ? `<ul>${g.join('')}</ul>` : '<span class="none">None</span>'], ...(adoptionLimited(r) ? [['Why a Revision Helps Adoption', v(r.adoptionWhy)]] : [])]; }
    case 'adoption': return [['Regulation or Mandate', yn(r.mandate)], ...(r.mandate === 'yes' ? [['Details', v(r.mandateDetails)]] : []), ['MISMO Staff Support', v(r.staff)], ['Partner Organizations', v(r.partners)], ...(r.isUpdate === 'no' ? [['Market Condition Impacts', v(r.market)], ['Related Technologies', v(r.tech)], ['Consumer Benefit', v(r.consumer)]] : [])];
    case 'current': return [['Business Challenge', v(r.challenge)], ['How It Works Today', v(r.today)], ['Inefficiencies and Risks', v(r.pains)]];
    case 'future': return [['Proposed Approach', v(r.vision)], ['Lower Costs', v(r.costs)], ['Evaluating Success', v(r.success)]];
    case 'stake': return [['Stakeholder Groups', list((r.stake || []).filter(g => String(g.type || '').trim()).map(g => g.type + (g.size ? ' (' + { low:'Low', medium:'Medium', high:'High' }[g.size] + ' implementation)' : '')
        + (g.problem ? '. Problem: ' + g.problem : '') + (g.benefit ? '. Benefit: ' + g.benefit : '') + (g.roles ? '. Roles: ' + g.roles : '')))], ['Organizations Already Engaged', list(r.engaged || [])]];
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
    <div class="wr-sub">${r.isUpdate === 'no' ? `A new standard${r.fromIdea ? `, from idea <b>${esc(r.fromIdea.id)}</b>` : ''}` : r.standard ? `An update to <b>${esc(r.standard)}</b>` : 'An update to an existing MISMO standard'} \u00b7 ${o.wr ? 'WR# <b>' + esc(o.wr) + '</b>' : 'WR# set by MISMO'}${o.fac ? ' \u00b7 Facilitator <b>' + esc(o.fac) + '</b>' : ''}</div></header>`;
}
/* the timeline: finished sections as cards beside a check, the current one open, the rest waiting */
function timelineHTML(r, o){
  const mode = o.mode, secs = asked(r), p = pathOf(r);
  const skipped = [];                                   // a section that doesn't apply isn't part of the request
  const order = r.isUpdate === 'no' ? asked(r) : SECTIONS;   /* a new standard has its own sections, in its own order (Perry, 16 Oct 2026) */
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
          ${s.id === 'newstd' || (s.id === 'request' && W.r.isUpdate === 'no' && !W.r.fromIdea) ? '' : `<button type="button" class="btn p" data-next>${nextLabel(s.id)}</button>`}</div></div>`;
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
    <h3>At a Glance</h3>${row('Standard', r.isUpdate === 'no' ? 'A new standard' : esc(r.standard))}${row('Level of Effort', ef ? `${ef[1]} (${ef[2]})` : '')}${row('Completion', esc(fmtDate(r.completion)))}${row('Sponsors', sponsors)}${pathOf(r) === 'full' ? row('Owning Workgroup', esc(r.owner)) : ''}
    <div class="acts">${W.step === 'finish' ? `<button type="button" class="btn p" data-submit>Submit Work Request</button>` : `<button type="button" class="btn p" data-savedraft>Save Draft</button>`}<button type="button" class="btn" data-exit>Save and Exit</button></div>${saved}</div>
    <p class="note">MISMO sets the WR# and facilitator after you submit.</p>`;
}
const LOGO_SM = '<svg role="img" aria-label="MISMO" viewBox="0 0 708 108"><use href="#mismo-logo"/></svg>';
function documentHTML(r, o){
  const mode = o.mode, secs = asked(r), p = pathOf(r);
  const skipped = (p === 'maintenance' || p === 'admin') ? SECTIONS.filter(s => s.full) : [];
  const order = r.isUpdate === 'no' ? asked(r) : SECTIONS;   /* a new standard has its own sections, in its own order (Perry, 16 Oct 2026) */
  const num = id => String(order.findIndex(s => s.id === id) + 1).padStart(2, '0');
  let h = `<div class="dochead">${LOGO_SM}<span class="run">Care and Feeding Work Request</span></div>
    <div class="cover"><span class="tag"><b>WR</b><span>Work Request</span></span>
      <h1${r.title ? '' : ' class="placeholder"'}>${esc(r.title || 'Untitled Work Request')}</h1>
      <p class="lead">${r.isUpdate === 'no' ? 'A new standard.' : r.standard ? `An update to <b>${esc(r.standard)}</b>.` : 'An update to an existing MISMO standard.'}${mode === 'fill' ? ' Each part appears here as you finish it.' : ''}</p>
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
          ${s.id === 'newstd' || (s.id === 'request' && W.r.isUpdate === 'no' && !W.r.fromIdea) ? '' : `<button type="button" class="btn p" data-next>${nextLabel(s.id)}</button>`}</div></div>`;
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
  /* Text typed into an add box but not yet added survives the redraw (choosing an answer
     elsewhere in the section redraws it). Adding an item empties its box first, so it isn't carried over (facilitator, 23 Oct 2026). */
  const pending = [...document.querySelectorAll('#wizard [data-adder], #wizard [data-phadder], #wizard [data-orgadder]')]
    .filter(i => i.value.trim()).map(i => [i.dataset.adder ? `[data-adder="${i.dataset.adder}"]` : i.dataset.phadder !== undefined ? `[data-phadder="${i.dataset.phadder}"]` : `[data-orgadder="${i.dataset.orgadder}"]`, i.value]);
  $('#wizard').innerHTML = `<div class="wr">${headHTML(W.r, { mode:'fill' })}<div class="wr-grid"><div>${timelineHTML(W.r, { mode:'fill', fin:W.fin })}</div>
    <aside class="glance" aria-label="At a glance">${glanceHTML(W.r)}</aside></div></div>`;
  pending.forEach(([sel, v]) => { const i = document.querySelector('#wizard ' + sel); if (i){ i.value = v; const a = i.closest('.adder'); if (a) a.classList.add('typing'); } });
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
/* Anything typed into an add box but not yet added is added, so it is never lost. */
function takePending(){
  let took = false;
  document.querySelectorAll('#wizard [data-adder], #wizard [data-phadder], #wizard [data-orgadder]').forEach(inp => {
    const v = inp.value.trim(); if (!v) return;
    if (inp.dataset.adder) W.r[inp.dataset.adder].push(v);
    else if (inp.dataset.phadder !== undefined) W.r.phases[+inp.dataset.phadder].push(v);
    else W.r.parts[+inp.dataset.orgadder].orgs.push({ name:v, adopted:'' });
    inp.value = ''; took = true;
  });
  if (took) dirty();
  return took;
}
function nextSection(){
  takePending();
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
    if (rec.req.fromIdea && ME.decides) await saveIdea(rec.req.fromIdea.id, { reqId:id }, null);   /* the idea now points at its request */
    refreshRequests();
    $('#doneText').innerHTML = `<b>${esc(rec.req.title)}</b> is submitted as ${id}. It\u2019s under My Work Requests, where you can follow it. MISMO will confirm it, give it a WR#, and send it to the executive team for approval.`;
    W = null; show('done'); const h = document.querySelector('#view-done h2'); if (h) h.focus();
  } catch (e){
    if (W){ W.submitting = false; document.querySelectorAll('[data-submit]').forEach(b => { b.disabled = false; }); }
    toast('The request could not be submitted: ' + errText(e) + '.');
  }
}
/* the reviewer's changes to a submitted request */
/* The initiatives with an overview page, and the overview's data file (data/<id>.json in the Hub). */
const OVERVIEWS = { 'Mortgage Compliance Dataset':'mcd', 'Common Confidence Score':'ccs', 'Title Order Dataset Specification':'title-order',
  'AVM Testing Guidance and Best Practices':'avm-testing', 'eNote Master Control Agreement':'tpa', 'Loan Boarding Dataset':'lbds' };
function hubCall(method, id, body){
  const tok = RS && RS.token();
  if (!tok) return Promise.reject({ code:'SIGNED_OUT' });
  return fetch(`${RELAY_URL}/hub/data/${id}`, { method, cache:'no-store',
    headers: Object.assign({ 'Authorization':'Bearer ' + tok }, body ? { 'Content-Type':'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(b => { if (r.ok) return b; throw { status:r.status, code:(b && b.error) || ('HTTP_' + r.status), message: b && b.message, gh: b && b.status }; }), () => { throw { code:'OFFLINE' }; });
}
/* A request assigned to an initiative becomes one of its overview's deliverables, once. */
async function addToOverview(x, initiative){
  const id = OVERVIEWS[initiative];
  if (!id) return 'That initiative has no overview page yet, so it wasn\u2019t added to any deliverables.';
  for (let tries = 0; tries < 3; tries++){
    try {
      const got = await hubCall('GET', id);
      const data = (got && got.data) || { dashboard:id };
      const list = Array.isArray(data.wrDeliverables) ? data.wrDeliverables : [];
      if (list.some(d => d.id === x.id)) return 'It was already in that overview\u2019s deliverables.';
      list.push({ id:x.id, wr:x.wr || '', name:(x.req && x.req.title) || x.id, status:'notstarted', date:'', addedAt:new Date().toISOString() });
      data.wrDeliverables = list;
      await hubCall('PUT', id, { content:data, sha:(got && got.sha) || null });
      return 'It\u2019s now in that overview\u2019s deliverables.';
    } catch (e){
      if (!(e && (e.status === 409 || e.code === 'CONFLICT'))) return 'Adding it to the overview\u2019s deliverables didn\u2019t work (' + errText(e) + '), so add it there by hand.';
    }
  }
  return 'The overview kept changing while this was saved, so add it to its deliverables by hand.';
}
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
  await changeReq(x.id, dd => { Object.assign(dd, { status:'potential', potentialId:id, potentialName:name }); logIt(dd, 'potential', { to:name }); }, 'Potential initiative created: ' + name);
}
function dirty(){ if (W) W.editSeq = (W.editSeq || 0) + 1; if (W && !W.dirty){ W.dirty = true; const s = document.querySelector('.glance .saved'); if (s){ s.textContent = 'Unsaved changes'; s.classList.add('dirty'); } } }

/* ─────────────── the sidebar: the person's own list, and All for those allowed ─────────────── */
let view = 'mine', openId = null, filter = null;   /* filter: the All Work Requests tab; null = the one it opens on */

/* ─────────────── Ideas Inbox (Perry, 16 Oct 2026; design E2) ───────────────
   Ideas sent through the public Submit an Idea form (GitMISMO.github.io/submit-an-idea/), kept by the relay in
   data/ideas.json, which only administrators of Work Requests and platform administrators can open (relay request 10).
   Each idea is one line until opened. Open = still to reach out ('open') or reached out ('reached'); Done = made a
   potential initiative ('potential'), closed with a note ('closed'), or turned into a Work Request ('workrequest': a new-standard
   request staff complete, pre-filled from the idea; draftId while in progress, reqId once submitted; Perry, 16 Oct 2026). */
let ideas = [], itab = 'open', ICLOSE = null;
const IOPEN = new Set(), IDEA_DONE = new Set(['potential', 'closed', 'workrequest']);
function refreshIdeas(){ ideas = Object.values(fileOf('ideas').docs || {}).filter(x => x && x.id)
  .sort((a, b) => (IDEA_DONE.has(a.status) - IDEA_DONE.has(b.status)) || String(b.at).localeCompare(String(a.at))); }
const ideasToReach = () => ideas.filter(x => x.status === 'open').length;
const todayDC = () => new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const dayShort = ymd => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' });
const onDay = at => at ? new Date(at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';
const whenAt = at => { const d = new Date(at), t = new Date(); return d.toDateString() === t.toDateString() ? 'today, ' + d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
  : d.toLocaleDateString('en-US', Object.assign({ month:'short', day:'numeric' }, d.getFullYear() === t.getFullYear() ? {} : { year:'numeric' })); };
function ideaChip(x){
  if (x.status === 'open'){ const late = x.replyBy && x.replyBy < todayDC(); return `<span class="chip ${late ? 'late' : 'due'}">${late ? 'Overdue: reply by ' : 'Reply by '}${esc(dayShort(x.replyBy))}</span>`; }
  if (x.status === 'reached') return `<span class="chip assigned">Reached out ${esc(onDay(x.reachedOutAt))}</span>`;
  if (x.status === 'potential') return `<span class="chip potential">Potential Initiative</span>`;
  if (x.status === 'workrequest') return `<span class="chip new">Work Request${x.reqId ? ' ' + esc(x.reqId) : ', in progress'}</span>`;
  return `<span class="chip path">Closed</span>`;
}
const IB_CHEV = '<svg class="ib-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>';
function ideaRow(x){
  const on = IOPEN.has(x.id), first = String(x.name || '').split(/\s+/)[0] || 'them';
  const who = (x.who || []).concat(x.whoOther ? [x.whoOther] : []).join(', ');
  const head = `<button type="button" class="ib-head" data-iopen="${esc(x.id)}" aria-expanded="${on}">${IB_CHEV}<b>${esc(x.title)}</b>
    <span class="ib-from">${esc(x.name)}${x.company ? ', ' + esc(x.company) : ''}</span><span class="ib-when">${esc(whenAt(x.at))}</span>${ideaChip(x)}</button>`;
  if (!on) return `<div class="card ib">${head}</div>`;
  const member = { yes:'MISMO member', no:'Not a MISMO member', unsure:'Not sure if a MISMO member' }[x.member] || '';
  const hist = [`Received ${esc(whenAt(x.at))} \u00b7 ${esc(x.id)}`];
  if (x.reachedOutAt) hist.push(`Reached out ${esc(onDay(x.reachedOutAt))}${x.reachedOutBy ? ' by ' + esc(x.reachedOutBy.name) : ''}`);
  if (x.status === 'potential') hist.push(`Made a potential initiative, <b>${esc(x.potentialName || '')}</b>, ${esc(onDay(x.decidedAt))}${x.decidedBy ? ' by ' + esc(x.decidedBy.name) : ''}`);
  if (x.status === 'workrequest') hist.push(`Turned into a Work Request${x.reqId ? ', <b>' + esc(x.reqId) + '</b>,' : ''} ${esc(onDay(x.decidedAt))}${x.decidedBy ? ' by ' + esc(x.decidedBy.name) : ''}`);
  if (x.status === 'closed') hist.push(`Closed ${esc(onDay(x.decidedAt))}${x.decidedBy ? ' by ' + esc(x.decidedBy.name) : ''}${x.closeNote ? ': \u201c' + esc(x.closeNote) + '\u201d' : ''}`);
  const mail = `mailto:${encodeURIComponent(x.email)}?subject=${encodeURIComponent('Your idea for MISMO (' + x.id + ')')}`;
  let acts = '';
  if (!IDEA_DONE.has(x.status)) acts = ICLOSE === x.id
    ? `<div class="ib-close"><label for="ib-note">Why is it being closed? <span>(kept with the idea)</span></label><textarea id="ib-note" maxlength="1000"></textarea>
        <div class="ib-acts"><button type="button" class="btn p" data-iclosego="${esc(x.id)}">Close idea</button><button type="button" class="btn" data-iclosex>Cancel</button></div></div>`
    : `<div class="ib-acts"><a class="btn" href="${mail}">Email ${esc(first)}</a>${x.status === 'open' ? `<button type="button" class="btn" data-ireach="${esc(x.id)}">Mark as reached out</button>` : ''}<span class="grow"></span>
        <button type="button" class="btn" data-iclose="${esc(x.id)}">Close, with a note</button><button type="button" class="btn" data-ipot="${esc(x.id)}">Make a Potential Initiative</button><button type="button" class="btn p" data-iwr="${esc(x.id)}">Turn into a Work Request</button></div>`;
  else if (x.status === 'workrequest') acts = x.reqId ? `<div class="ib-acts"><button type="button" class="btn" data-ireq="${esc(x.reqId)}">Open ${esc(x.reqId)}</button></div>`
    : fileOf('drafts').docs[x.draftId] ? `<div class="ib-acts"><button type="button" class="btn p" data-iresume="${esc(x.draftId)}">Continue the Work Request</button></div>` : '';
  return `<div class="card ib on">${head}<div class="ib-body"><dl class="ib-kv"><dt>The idea</dt><dd class="pre">${esc(x.idea)}</dd>${who ? `<dt>Who\u2019s involved</dt><dd>${esc(who)}</dd>` : ''}
    ${x.why ? `<dt>Why it matters</dt><dd class="pre">${esc(x.why)}</dd>` : ''}<dt>Contact</dt><dd><a href="${mail}">${esc(x.email)}</a>${x.phone ? ' \u00b7 ' + esc(x.phone) : ''}${member ? ' \u00b7 ' + member : ''}</dd>
    ${(x.files || []).length ? `<dt>Attachments</dt><dd class="ib-files">${x.files.map((f, i) => `<button type="button" class="linkish" data-ifile="${esc(x.id)}:${i}">${esc(f.name)}</button> <span class="ib-sz">${f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB'}</span>`).join('<br>')}</dd>` : ''}</dl>
    <p class="ib-hist">${hist.join('<br>')}</p>${acts}</div></div>`;
}
function drawIdeas(){
  const open = ideas.filter(x => !IDEA_DONE.has(x.status)), done = ideas.filter(x => IDEA_DONE.has(x.status)), list = itab === 'open' ? open : done;
  $('#page').innerHTML = `<header class="mast"><div><div class="eyebrow">Work Requests</div><h1>Ideas Inbox</h1>
      <div class="sub">Ideas sent through the public Submit an Idea form. Reach out within two business days, then turn each into a Work Request, make it a potential initiative, or close it with a note.</div></div>
      <a class="btn p" href="/submit-an-idea/" target="_blank" rel="noopener" title="Opens the public form in a new tab, to send an idea on someone\u2019s behalf">+ Submit an Idea</a></header>
    <div class="ib-bar"><div class="tabs" role="group" aria-label="Show">${[['open', 'Open', open.length], ['done', 'Done', done.length]].map(([k, t, c]) =>
      `<button type="button" class="tab" data-itab="${k}" aria-pressed="${itab === k}">${t}<span>${c}</span></button>`).join('')}</div>
      ${list.length ? `<span class="ib-all"><button type="button" class="linkish" data-iall="1">Expand all</button> \u00b7 <button type="button" class="linkish" data-iall="0">Collapse all</button></span>` : ''}</div>
    <div class="ideas">${list.length ? list.map(ideaRow).join('') : `<div class="card empty">${itab === 'done' ? 'Nothing done yet.' : ideas.length ? 'Nothing waiting: every idea has been dealt with.' : 'No ideas yet. They arrive here from the public Submit an Idea form.'}</div>`}</div>`;
}
function saveIdea(id, patch, msg){
  return mutate('ideas', d => { if (!d[id]) throw { code:'GONE' }; Object.assign(d[id], patch); })
    .then(() => { refreshIdeas(); if (view === 'ideas') drawIdeas(); drawRail(); if (msg) toast(msg); return true; }, e => { toast('Not saved: ' + errText(e) + '.'); return false; });
}
/* Turn into a Work Request: a new-standard request (the "No" path), pre-filled from the idea, opened for the staff member to
   complete and submit as their own. The idea is marked with the draft now and the request number once it's submitted. */
async function ideaToRequest(x){
  if (!ME.submits){ toast('Your account can read work requests but not start one.'); return; }
  const now = new Date().toISOString();
  const r = Object.assign(blank(), { isUpdate:'no', title: x.title || '', sponsors:[{ name: x.name || '', company: x.company || '' }], challenge: x.idea || '', pains: x.why || '',
    stake: (x.who || []).concat(x.whoOther ? [x.whoOther] : []).map(t => ({ type:t, problem:'', benefit:'', roles:'', size:'' })), engaged: x.company ? [x.company] : [],
    fromIdea:{ id:x.id, name: x.name || '', company: x.company || '', email: x.email || '', at: x.at || '' } });
  const w = { id:'d-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), r, step:'request', done:new Set(), fin:{}, errs:{}, savedAt:null, dirty:true, editSeq:0, createdAt:now };
  if (!(await saveIdea(x.id, { status:'workrequest', draftId:w.id, decidedBy:{ email:ME.email, name:ME.name }, decidedAt:now }, null))) return;
  W = w; show('wizard'); drawWizard(); saveDraft(true);
  toast(`A Work Request is started from ${x.id}. Complete it, then submit.`);
}
/* An idea's attachment, for administrators (relay request 10): read through the relay from the private repository, saved as a file. */
async function ideaDownload(ref, i, btn){
  const tok = RS && RS.token(); if (!tok){ toast('Sign in again to download attachments.'); return; }
  if (btn) btn.disabled = true;
  try {
    const r = await fetch(`${RELAY_URL}/${PROJECT}/ideas/file?ref=${encodeURIComponent(ref)}&i=${i}`, { cache:'no-store', headers:{ 'Authorization':'Bearer ' + tok } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.data){ toast(r.status === 403 ? 'Attachments are for Work Requests administrators.' : 'That attachment couldn\u2019t be downloaded just now.'); return; }
    const bytes = Uint8Array.from(atob(b.data), c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: b.type || 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = b.name || 'attachment'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { toast('That attachment couldn\u2019t be downloaded just now.'); }
  finally { if (btn) btn.disabled = false; }
}
async function ideaPromote(x){
  const S = window.MismoStore; if (!S || !S.potential){ toast('The potential initiative tools could not load. Reload and try again.'); return; }
  const btn = document.querySelector(`[data-ipot="${x.id}"]`); if (btn) btn.disabled = true;
  try { if (S.types && S.types.load) await S.types.load(); } catch (e) {}
  const keys = S.typeKeys ? S.typeKeys() : new Set(L.types), now = new Date();
  const updates = [{ text:`Logged from idea ${x.id}, sent through the public Submit an Idea form by ${x.name}${x.company ? ', ' + x.company : ''} (${x.email}).`, by: ME.name, at: now.toISOString() }];
  const raw = { name: x.title, domain:'', stage:'not-started', broughtBy: x.name + (x.company ? ', ' + x.company : ''), facilitator:'', dateLogged: iso(now), summary: x.idea, whyRaised: x.why || '',
    potentialSolutions: [], leadership: [], stakeholderTypes: [], organizations: [], updates };
  const v = S.potential.validate(raw, keys.size ? keys : new Set(L.types));
  if (v.problems.length){ if (btn) btn.disabled = false; toast('The potential initiative could not be made: ' + v.problems[0]); return; }
  let id = S.potential.slug(x.title);
  try { const list = await S.potential.list(); const taken = new Set((list.items || []).map(i => i.id)); const base = id.slice(0, 36); let n = 2; while (taken.has(id)) id = base + '-' + n++; } catch (e) {}
  const res = await S.potential.put(id, Object.assign({}, v.content, { updates }), null);
  if (!res.ok){ if (btn) btn.disabled = false; toast('The potential initiative could not be saved (' + res.reason + ').'); return; }
  await saveIdea(x.id, { status:'potential', potentialId:id, potentialName:x.title, decidedBy:{ email:ME.email, name:ME.name }, decidedAt: now.toISOString() }, 'Potential initiative created: ' + x.title);
}
document.addEventListener('click', e => {
  if (view !== 'ideas') return;
  const t = e.target.closest('[data-itab],[data-iall],[data-iopen],[data-ireach],[data-iclose],[data-iclosex],[data-iclosego],[data-ipot],[data-iwr],[data-iresume],[data-ireq],[data-ifile]'); if (!t) return;
  const d = t.dataset, find = id => ideas.find(x => x.id === id);
  if (d.itab){ itab = d.itab; ICLOSE = null; drawIdeas(); return; }
  if (d.iall){ const list = ideas.filter(x => IDEA_DONE.has(x.status) === (itab === 'done')); list.forEach(x => d.iall === '1' ? IOPEN.add(x.id) : IOPEN.delete(x.id)); drawIdeas(); return; }
  if (d.iopen){ const id = d.iopen; IOPEN.has(id) ? IOPEN.delete(id) : IOPEN.add(id); if (ICLOSE === id) ICLOSE = null; drawIdeas();
    const h = document.querySelector(`[data-iopen="${id}"]`); if (h) h.focus(); return; }
  if (d.ireach){ t.disabled = true; saveIdea(d.ireach, { status:'reached', reachedOutAt: new Date().toISOString(), reachedOutBy:{ email:ME.email, name:ME.name } }, 'Marked as reached out'); return; }
  if (d.iclose){ ICLOSE = d.iclose; drawIdeas(); const n = $('#ib-note'); if (n) n.focus(); return; }
  if (t.hasAttribute('data-iclosex')){ ICLOSE = null; drawIdeas(); return; }
  if (d.iclosego){ const note = ($('#ib-note').value || '').trim(); if (!note){ toast('Add a few words on why it\u2019s being closed.'); $('#ib-note').focus(); return; }
    t.disabled = true; const id = d.iclosego; saveIdea(id, { status:'closed', closeNote: note, decidedBy:{ email:ME.email, name:ME.name }, decidedAt: new Date().toISOString() }, 'Idea closed').then(okd => { if (okd) ICLOSE = null; if (okd && view === 'ideas') drawIdeas(); }); return; }
  if (d.ipot){ const x = find(d.ipot); if (x) ideaPromote(x); return; }
  if (d.iwr){ const x = find(d.iwr); if (x){ t.disabled = true; ideaToRequest(x); } return; }
  if (d.iresume){ resume(d.iresume); return; }
  if (d.ifile){ const [ref, i] = d.ifile.split(':'); ideaDownload(ref, +i, t); return; }
  if (d.ireq){ openId = d.ireq; show('detail'); }
});
const mine = () => requests.filter(byMe);
const byName = x => (x.createdBy && x.createdBy.name) || 'Someone';
const statusWord = x => ({ awaiting:'Awaiting Approval', info:'Needs More Information', approved:'Approved', assigned:'Approved', potential:'Approved', declined:'Declined' })[x.status] || 'Submitted';
function drawRail(){
  const drafts = myDrafts(), subs = mine(), toConfirm = inStage('confirm').length, allN = toConfirm || inStage('queue').length;
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
      ${ME.decides ? `<nav aria-label="Everyone's work requests"><button type="button" data-view-go="ideas" title="Ideas Inbox"${view === 'ideas' ? ' aria-current="page"' : ''}>${I('M4 13l2.5-8h11l2.5 8v6H4z M4 13h5l1 2h4l1-2h5')}<span>Ideas Inbox</span><b class="count${ideasToReach() ? ' warn' : ''}">${ideasToReach()}</b></button><button type="button" data-view-go="all" title="All Work Requests"${cur('all') || (view === 'detail' && !cur('mine') ? ' aria-current="page"' : '')}>${I('M4 6h16 M4 12h16 M4 18h10')}<span>All Work Requests</span><b class="count${toConfirm ? ' warn' : ''}" title="${toConfirm ? 'To confirm' : 'In the Approval Queue'}">${allN}</b></button></nav>` : ''}
    </div>`;
}
/* ─────────────── My Work Requests ─────────────── */
function requesterStatus(x){
  const s = x.status;
  if (s === 'awaiting') return `Confirmed as <b>${esc(x.wr)}</b>, and with the executive team for approval.${x.scheduledFor ? ' Scheduled for ' + esc(fmtDate(x.scheduledFor)) + '.' : ''}`;
  if (s === 'info') return `The executive team needs more information${x.infoNote ? ': \u201c' + esc(x.infoNote) + '\u201d' : '.'}`;
  if (s === 'approved') return 'Approved by the executive team.';
  if (s === 'assigned') return `Approved, and now part of <b>${esc(x.assignedTo)}</b>.`;
  if (s === 'potential') return `Approved, and now a potential initiative: <b>${esc(x.potentialName)}</b>.`;
  if (s === 'declined') return `Declined${x.declineReason ? ': \u201c' + esc(x.declineReason) + '\u201d' : '.'}`;
  return 'Submitted, and waiting for MISMO to confirm it.';
}
function chipFor(x){
  const s = x.status;
  if (s === 'awaiting') return `<span class="chip new">${x.scheduledFor ? 'Scheduled ' + esc(md(x.scheduledFor)) : 'Awaiting Approval'}</span>`;
  if (s === 'info') return `<span class="chip wait">Needs More Information</span>`;
  if (s === 'approved' || s === 'assigned' || s === 'potential') return `<span class="chip ready">Approved</span>`;
  if (s === 'declined') return `<span class="chip no">Declined</span>`;
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
        <h3>${esc(x.req.title)}</h3><div class="meta"><span>${esc(reqLine(x))}</span><span>${x.id}${x.wr ? ' \u00b7 ' + esc(x.wr) : ''} \u00b7 submitted ${fmt(x.submitted)}</span></div>
        <div class="status">${requesterStatus(x)}</div><div class="right">${chipFor(x)}</div></button>`).join('')}</div>`
      : `<div class="card empty">Nothing submitted yet.</div>`}</section>`;
}
/* ─────────────── All Work Requests, a tab for each step (Perry, 28 Oct 2026; design B on the canvas) ───────────────
   To Confirm ('new') → Approval Queue ('awaiting', 'info') → Approved ('approved'; 'assigned' and 'potential' once it is
   in the Hub) · Archive ('declined') · All. The page opens on To Confirm when anything waits there, else on the Approval
   Queue, else To Confirm; coming back from a request keeps the tab (B2).
   Confirm gives the next WR#: WR<year>_<n>, the year it is confirmed in (Eastern time), the count going up within that
   year and starting again at 1 on January 1, never reused (a declined request keeps its number). It is worked out on the
   copy being saved, so two people confirming at once can't take the same number: the second save is re-applied on top
   of the first and takes the next one. A request that already has a WR# (typed in before this change) keeps it.
   The facilitator is the person who sent the request when they are on the facilitator roster; otherwise staff choose one
   before Confirm is allowed. The relay clears decision fields on a facilitator's own submission (relay request 8), so the
   automatic facilitator is shown from the sender and saved at Confirm.
   Staff record the executive team's decision (Perry, 28 Oct 2026): Awaiting Approval (where every request starts, with
   the date it is scheduled for approval), Needs More Information (a note for the facilitator; stays in the queue),
   Approved (moves to Approved, then into the Hub: those steps are still to be worked out), Declined (a reason; moves to
   the Archive). Every step is kept in the request's log, shown as its History.
   Emails (MAIL_ON): the relay sends them, not the page, so the hints about who is emailed show only once the relay
   update is live. Scheduled and Approved also go to the sponsor who sent the idea, when they are still listed as a
   sponsor (Perry, 28 Oct 2026). */
const MAIL_ON = window.WR_MAIL_ON === true;
const STAGES = [['confirm', 'To Confirm', 'Step 2'], ['queue', 'Approval Queue', 'Step 3'], ['approved', 'Approved', 'Step 4'], ['archive', 'Archive', 'Declined'], ['all', 'All', 'Every Step']];
const stageOf = x => x.status === 'awaiting' || x.status === 'info' ? 'queue' : ['approved', 'assigned', 'potential'].includes(x.status) ? 'approved' : x.status === 'declined' ? 'archive' : 'confirm';
const inStage = k => requests.filter(x => k === 'all' || stageOf(x) === k);
const firstTab = () => inStage('confirm').length ? 'confirm' : inStage('queue').length ? 'queue' : 'confirm';
const norm = s => String(s || '').trim().toLowerCase();
const isFac = n => !!norm(n) && L.facilitators.some(f => norm(f) === norm(n));
const sentByFac = x => !!(x.createdBy && isFac(x.createdBy.name));
const autoFac = x => x.facilitator || (sentByFac(x) ? x.createdBy.name : '');
const yearET = d => +new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', year:'numeric' }).format(d || new Date());
function nextWR(docs, year){
  let n = 0; const re = new RegExp('^WR' + year + '_(\\d+)$', 'i');
  Object.values(docs || {}).forEach(d => { const m = re.exec(String((d && d.wr) || '').trim()); if (m) n = Math.max(n, +m[1]); });
  return 'WR' + year + '_' + (n + 1);
}
const wrKey = wr => { const m = /^WR(\d{4})_(\d+)$/i.exec(String(wr || '').trim()); return m ? +m[1] * 100000 + +m[2] : 9e9; };
/* the sponsor who sent the idea the request came from, while they are still listed as a sponsor */
const ideaSponsor = r => r && r.fromIdea && r.fromIdea.email && (r.sponsors || []).some(s => norm(s.name) && norm(s.name) === norm(r.fromIdea.name)) ? r.fromIdea : null;
const ME_BY = () => ({ email:ME.email, name:ME.name });
const logIt = (d, kind, extra) => { d.log = (d.log || []).concat([Object.assign({ kind, at:new Date().toISOString(), by:ME_BY() }, extra || {})]); };
const md = ymd => ymd ? new Date(ymd + 'T12:00').toLocaleDateString('en-US', Object.assign({ month:'short', day:'numeric' }, +ymd.slice(0, 4) === yearET() ? {} : { year:'numeric' })) : '';
const reqLine = x => x.req.isUpdate === 'no' ? 'A new standard' + (x.req.fromIdea ? ', from idea ' + x.req.fromIdea.id : '') : 'Update to ' + (x.req.standard || 'an existing standard');
const DL = '<svg class="i dl" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11 M7 10l5 5 5-5 M5 20h14"/></svg>';
const WOPEN = new Set(), DEC = {}, SCHED = {};
let qf = 'all', DLM = false;

function stChip(x){
  const s = x.status;
  if (s === 'new') return autoFac(x) ? `<span class="chip ready">Ready to Confirm</span>` : `<span class="chip wait">Needs a Facilitator</span>`;
  if (s === 'awaiting') return `<span class="chip new">Awaiting Approval</span>`;
  if (s === 'info') return `<span class="chip wait">Needs More Information</span>`;
  if (s === 'declined') return `<span class="chip no">Declined</span>`;
  if (s === 'assigned' || s === 'potential') return `<span class="chip ready">Approved, in the Hub</span>`;
  if (s === 'approved') return `<span class="chip ready">Approved</span>`;
  return `<span class="chip path">${esc(s || 'Submitted')}</span>`;
}
const COLS = { confirm:['WR#', 'Request', 'From', 'Submitted', 'Status'], queue:['WR#', 'Request', 'Facilitator', 'Scheduled For', 'Status'],
  approved:['WR#', 'Request', 'Facilitator', 'Approved', 'Status'], archive:['WR#', 'Request', 'From', 'Declined', 'Status'], all:['WR#', 'Request', 'From', 'Submitted', 'Step'] };
function sortFor(k, list){
  const by = (f, dir) => list.slice().sort((a, b) => dir * String(f(a) || '').localeCompare(String(f(b) || '')));
  if (k === 'confirm') return by(x => x.submittedAt || x.submitted, 1);
  if (k === 'queue') return list.slice().sort((a, b) => wrKey(a.wr) - wrKey(b.wr));
  if (k === 'approved' || k === 'archive') return by(x => x.decidedAt, -1);
  return by(x => x.submittedAt || x.submitted, -1);
}
function wlRow(x, k){
  const on = WOPEN.has(x.id), s = x.status;
  const wr = x.wr ? `<span class="wl-wr">${esc(x.wr)}</span>` : `<span class="wl-wr next">${s === 'new' ? 'Set on Confirm' : 'None'}</span>`;
  const person = k === 'queue' || k === 'approved' ? (autoFac(x) || 'Not chosen') : byName(x);
  const date = k === 'queue' ? (s === 'awaiting' && x.scheduledFor ? md(x.scheduledFor) : 'Not yet') : (k === 'approved' || k === 'archive') ? onDay(x.decidedAt) : md(x.submitted);
  const head = `<button type="button" class="wl-head" data-wopen="${esc(x.id)}" aria-expanded="${on}">${IB_CHEV}${wr}<b>${esc(x.req.title || 'Untitled Work Request')}</b><span class="wl-p">${esc(person)}</span><span class="wl-d">${esc(date)}</span>${stChip(x)}</button>`;
  const pdf = k === 'queue' ? `<button type="button" class="btn ic" data-pdf="req:${esc(x.id)}" aria-label="Download PDF for ${esc(x.wr || x.id)}" title="Download PDF">${DL}</button>` : '';
  if (!on) return `<div class="card ib wl" data-row="${esc(x.id)}"><div class="wl-top">${head}${pdf}</div></div>`;
  const r = x.req;
  return `<div class="card ib wl on" data-row="${esc(x.id)}"><div class="wl-top">${head}${pdf}</div><div class="ib-body">
    <dl class="ib-kv"><dt>Request</dt><dd>${esc(reqLine(x))}</dd><dt>Sponsors</dt><dd>${esc(sponsorsText(r) || 'None listed')}</dd>
      <dt>Submitted</dt><dd>${esc(fmt(x.submitted))}, by ${esc(byName(x))} \u00b7 ${esc(x.id)}</dd></dl>
    ${stepHTML(x, 'row')}<ul class="wl-hist" aria-label="History">${historyLines(x).map(h => `<li>${h}</li>`).join('')}</ul></div></div>`;
}
function drawAll(){
  if (!filter || !STAGES.some(s => s[0] === filter)) filter = firstTab();
  const k = filter, all = inStage(k), list = sortFor(k, all.filter(x => k !== 'queue' || qf === 'all' || x.status === qf));
  const n = key => inStage(key).length;
  const chev = `<span class="st-chev" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>`;
  const st = ([key, t, small]) => `<button type="button" class="st${n(key) ? '' : ' zero'}" data-st="${key}" aria-pressed="${filter === key}"><small>${small}</small><b>${t}<span>${n(key)}</span></b></button>`;
  const strip = st(STAGES[0]) + chev + st(STAGES[1]) + chev + st(STAGES[2]) + `<span class="st-gap" aria-hidden="true"></span>` + st(STAGES[3]) + st(STAGES[4]);
  let bar = '';
  if (k === 'queue'){
    const c = v => all.filter(x => v === 'all' || x.status === v).length;
    bar = `<div class="tabs" role="group" aria-label="Status">${[['all', 'All'], ['awaiting', 'Awaiting Approval'], ['info', 'Needs More Information']].map(([v, t]) =>
      `<button type="button" class="tab" data-qf="${v}" aria-pressed="${qf === v}">${t}<span>${c(v)}</span></button>`).join('')}</div>`;
  } else bar = `<span class="wl-count">${list.length} ${list.length === 1 ? 'request' : 'requests'}${k === 'confirm' && list.length ? ', oldest first' : ''}</span>`;
  const tools = list.length ? `<span class="ib-all"><button type="button" class="linkish" data-wall="1">Expand All</button> \u00b7 <button type="button" class="linkish" data-wall="0">Collapse All</button></span>` : '';
  const dl = k === 'queue' && list.length ? `<div class="dlm"><button type="button" class="btn" data-dlmenu aria-haspopup="menu" aria-expanded="${DLM}">${DL}Download All PDFs (${list.length})${CHEV}</button>${DLM ? `<div class="dlm-pop" role="menu" aria-label="Download all">
      <button type="button" role="menuitem" data-dlall="one"><b>One PDF, with a Contents Page</b><small>All ${list.length} in WR# order, ready to send to the executive team.</small></button>
      <button type="button" role="menuitem" data-dlall="zip"><b>Separate PDFs in a .zip File</b><small>One file per request, each named by its WR#.</small></button></div>` : ''}</div>` : '';
  const empty = { confirm:'Nothing to confirm. New Work Requests arrive here.', queue: all.length ? 'Nothing here with that status.' : 'Nothing is waiting on the executive team.', approved:'Nothing approved yet.', archive:'Nothing declined.', all:'No Work Requests yet.' }[k];
  const foot = { confirm:'Confirm stays off until a request has a facilitator. The WR# can\u2019t be typed: the Hub gives the next number at the moment you confirm.',
    queue:'Sorted by WR#. Needs More Information keeps a request here until it\u2019s set back to Awaiting Approval or decided.',
    approved:'How an approved request moves into the Hub is still to be worked out. Today\u2019s two choices are on each request\u2019s own page.',
    archive:'Nothing here is deleted. A declined request keeps its WR#, and can go back to the Approval Queue if it was declined by mistake.', all:'' }[k];
  $('#page').innerHTML = `<header class="mast"><div><div class="eyebrow">Work Requests</div><h1>All Work Requests</h1>
      <div class="sub">Every Work Request, step by step: confirmed by MISMO, then decided by the executive team.</div></div>
      ${ME.submits ? `<button type="button" class="btn p" data-newreq>+ New Work Request</button>` : ''}</header>
    <div class="stages" role="group" aria-label="Show">${strip}</div>
    <div class="wl-bar">${bar}<span class="grow"></span>${tools}${dl}</div>
    ${list.length ? `<div class="wl-cols${k === 'queue' ? ' pdf' : ''}" aria-hidden="true"><span></span>${COLS[k].map(t => `<span>${t}</span>`).join('')}</div>` : ''}
    <div class="ideas wl-list">${list.length ? list.map(x => wlRow(x, k)).join('') : `<div class="card empty">${empty}</div>`}</div>
    ${foot && list.length ? `<p class="wl-foot">${foot}</p>` : ''}`;
}
/* what the request's current step asks of staff: in its line on the list ('row') and beside it on its own page ('side') */
function stepHTML(x, where){
  const k = stageOf(x);
  const acts = more => `<div class="ib-acts">${where === 'row' ? `<button type="button" class="btn" data-pdf="req:${esc(x.id)}">${DL}Download PDF</button><button type="button" class="btn" data-open="${esc(x.id)}">Open the Full Request</button>` : ''}<span class="grow"></span>${more || ''}</div>`;
  if (k === 'confirm') return confirmHTML(x, acts);
  if (k === 'queue') return queueHTML(x, acts);
  if (k === 'approved') return approvedHTML(x, acts, where);
  return archiveHTML(x, acts);
}
function confirmHTML(x, acts){
  const id = x.id, fac = autoFac(x), by = byName(x), first = by.split(/\s+/)[0] || by;
  const facNote = !fac ? `<div class="wl-note warn">${esc(by)} isn\u2019t a facilitator, so choose one before confirming.</div>`
    : sentByFac(x) && norm(fac) === norm(x.createdBy.name) ? `<small class="wl-hint">Set automatically: ${esc(first)} sent it.</small>` : '';
  const wr = x.wr || nextWR(fileOf('requests').docs, yearET());
  return `<div class="wl-step"><div class="wl-f"><label for="f-fac-${esc(id)}">MISMO Facilitator</label>${acHTML('fac-' + id, { value:fac, options:L.facilitators.map(f => ({ value:f, label:f })),
      placeholder:'Search facilitators', label:'MISMO facilitator', onPick: v => setFac(id, v) })}${facNote}</div>
    <div class="wl-f"><span class="wl-lbl" id="wrl-${esc(id)}">WR#</span><div class="wl-wrbox" aria-labelledby="wrl-${esc(id)}">${esc(wr)}</div><small class="wl-hint">${x.wr ? 'Given before this change, so it keeps this number.' : 'Given when you confirm: the next number for ' + yearET() + '.'}</small></div></div>
    ${acts(`${fac ? '' : '<span class="wl-why">Choose a facilitator first.</span>'}<button type="button" class="btn p" data-confirm="${esc(id)}"${fac ? '' : ' disabled'}>Confirm and Send for Approval</button>`)}
    ${MAIL_ON && fac ? `<small class="wl-hint">Confirming emails ${esc(fac)}${x.createdBy && norm(x.createdBy.name) !== norm(fac) ? ' and ' + esc(by) : ''}.</small>` : ''}`;
}
const DEC_OPTS = [['awaiting', 'Awaiting Approval', 'Stays here. Where every request starts.'], ['info', 'Needs More Information', 'Stays here, with a note for the facilitator.'],
  ['approved', 'Approved', 'Moves to Approved, ready for the Hub.'], ['declined', 'Declined', 'Moves to the Archive, with the reason.']];
function mailTo(x, kind){
  const fac = autoFac(x), sp = ideaSponsor(x.req), sender = x.createdBy && x.createdBy.name, who = [];
  if (fac) who.push(fac);
  if ((kind === 'approved' || kind === 'declined') && sender && norm(sender) !== norm(fac)) who.push(sender);
  if ((kind === 'scheduled' || kind === 'approved') && sp && norm(sp.name) !== norm(fac) && norm(sp.name) !== norm(sender)) who.push(sp.name + ' (the sponsor who sent the idea)');
  return who.length < 3 ? who.join(' and ') : who.slice(0, -1).join(', ') + ', and ' + who[who.length - 1];
}
function queueHTML(x, acts){
  const id = x.id, P = DEC[id] || { status:x.status, note:'' }, s = P.status, changing = s !== x.status;
  let sched = '';
  if (x.status === 'awaiting'){
    const pend = SCHED[id];
    if (x.scheduledFor && pend === undefined) sched = `<div class="wl-sched"><div class="t"><b>Scheduled for Approval</b><span>${esc(fmtLong(x.scheduledFor))}</span></div>
        <button type="button" class="btn" data-schedchange="${esc(id)}">Change Date</button><button type="button" class="btn ghost" data-schedclear="${esc(id)}">Remove the Date</button></div>`;
    else sched = `<div class="wl-sched"><div class="t"><b id="schl-${esc(id)}">Scheduled for Approval</b><span>${x.scheduledFor ? 'Now ' + esc(fmtLong(x.scheduledFor)) + '. Choose the new date.' : 'Not scheduled yet. Choose the date of the executive team\u2019s meeting.'}</span></div>
        ${datepick('sch-' + id, { value: pend || '', min: todayDC(), onPick: v => { SCHED[id] = v; redrawWR(); const sb = document.querySelector(`[data-schedsave="${id}"]`); if (sb) sb.focus(); } })}
        <button type="button" class="btn p" data-schedsave="${esc(id)}"${pend && pend !== x.scheduledFor ? '' : ' disabled'}>Save Date</button>${pend !== undefined && x.scheduledFor ? `<button type="button" class="btn ghost" data-schedx="${esc(id)}">Cancel</button>` : ''}
        ${MAIL_ON ? `<small class="wl-hint" style="flex-basis:100%">Saving the date emails ${esc(mailTo(x, 'scheduled'))}.</small>` : ''}</div>`;
  }
  const info = x.status === 'info' && x.infoNote ? `<div class="wl-note warn"><b>Needs More Information.</b> \u201c${esc(x.infoNote)}\u201d${x.infoBy ? `<br><small>${esc(x.infoBy.name)}, ${esc(onDay(x.infoAt))}</small>` : ''}</div>` : '';
  const opts = DEC_OPTS.map(([v, t, h]) => `<label class="choice${s === v ? ' on' : ''}"><input type="radio" name="dec-${esc(id)}" value="${v}" data-dec="${esc(id)}"${s === v ? ' checked' : ''}><span><b>${t}</b><small>${h}</small></span></label>`).join('');
  let follow = '';
  if (changing && (s === 'info' || s === 'declined')){
    const lab = s === 'info' ? 'What Does the Executive Team Need?' : 'Reason';
    const hint = s === 'info' ? (MAIL_ON ? autoFac(x) + ' gets this by email.' : 'Kept with the request, for the facilitator.') : (MAIL_ON ? 'Kept in the Archive, and emailed to ' + mailTo(x, 'declined') + '.' : 'Kept with the request in the Archive.');
    follow = `<div class="wl-f"><label for="dn-${esc(id)}">${lab}</label><textarea id="dn-${esc(id)}" data-decnote="${esc(id)}" maxlength="2000" placeholder="${esc(hint)}">${esc(P.note || '')}</textarea></div>`;
  } else if (changing && s === 'approved') follow = `<p class="wl-hint">It moves to Approved${MAIL_ON ? ', and ' + esc(mailTo(x, 'approved')) + ' get an email' : ''}.</p>`;
  else if (changing && s === 'awaiting') follow = `<p class="wl-hint">It goes back to waiting for the executive team.</p>`;
  return `${sched}${info}<fieldset class="wl-dec"><legend>Executive Team\u2019s Decision</legend><div class="choices">${opts}</div></fieldset>${follow}
    ${acts(changing ? `<button type="button" class="btn" data-deccancel="${esc(id)}">Cancel</button><button type="button" class="btn p" data-decsave="${esc(id)}">Save Status</button>` : '')}`;
}
function approvedHTML(x, acts, where){
  const r = x.req, back = `<button type="button" class="btn" data-reopen="${esc(x.id)}">Move Back to the Approval Queue</button>`;
  if (x.status === 'assigned') return `<div class="outcome assigned"><b>In the Hub: part of ${esc(x.assignedTo)}.</b></div>${acts(`<button type="button" class="btn" data-undo="${esc(x.id)}">Undo</button>`)}`;
  if (x.status === 'potential') return `<div class="outcome potential"><b>In the Hub: a potential initiative, ${esc(x.potentialName)}.</b></div>${x.potentialId ? `<a class="btn ghost" href="potential.html?id=${encodeURIComponent(x.potentialId)}">Open the Potential Initiative \u2192</a>` : ''}${acts(`<button type="button" class="btn" data-undo="${esc(x.id)}">Undo</button>`)}`;
  const match = L.initiatives.find(n => n.toLowerCase() === (r.standard || '').toLowerCase());
  const box = `<div class="wl-next"><b>Next: Into the Hub <span class="chip wait">To Be Worked Out</span></b>
    <span class="wl-hint" style="margin:0">The steps for moving an approved request into the Hub are still to be worked out. ${where === 'side' ? 'Today\u2019s two choices are here as a starting point.' : 'Today\u2019s two choices are on the request\u2019s own page.'}</span>
    ${where === 'side' ? `<div class="decide"><button type="button" class="btn" data-mode="assign">Assign to an Existing Initiative</button><button type="button" class="btn" data-mode="potential">Make a Potential Initiative</button></div><div id="decideForm"></div>` : ''}
    ${match ? `<span class="wl-hint" style="margin:0">\u201c${esc(r.standard)}\u201d matches an existing initiative on the Hub.</span>` : ''}</div>`;
  return `${box}${acts(back)}`;
}
function archiveHTML(x, acts){
  return `<div class="wl-note bad"><b>Declined.</b> ${x.declineReason ? '\u201c' + esc(x.declineReason) + '\u201d' : ''}${x.decidedBy ? `<br><small>${esc(x.decidedBy.name)}, ${esc(onDay(x.decidedAt))}</small>` : ''}</div>
    ${acts(`<button type="button" class="btn" data-reopen="${esc(x.id)}">Move Back to the Approval Queue</button>`)}`;
}
function historyLines(x){
  const by = e => e.by && e.by.name ? ' by ' + esc(e.by.name) : '';
  const out = [`Submitted ${esc(fmt(x.submitted))} by ${esc(byName(x))} \u00b7 ${esc(x.id)}`];
  const log = x.log || [];
  if (x.confirmedAt && !log.some(e => e.kind === 'confirmed')) out.push(`Confirmed as <b>${esc(x.wr)}</b> ${esc(onDay(x.confirmedAt))}${by({ by:x.confirmedBy })}`);
  log.forEach(e => {
    const t = { confirmed:`Confirmed as <b>${esc(e.wr || '')}</b>`, scheduled:`Scheduled for approval on <b>${esc(fmtDate(e.date))}</b>`, unscheduled:'Approval date removed',
      info:`Needs More Information: \u201c${esc(e.note || '')}\u201d`, awaiting:'Set back to Awaiting Approval', approved:'<b>Approved</b>', declined:`<b>Declined</b>: \u201c${esc(e.note || '')}\u201d`,
      reopened:'Moved back to the Approval Queue', assigned:`Moved into the Hub: part of ${esc(e.to || '')}`, potential:`Moved into the Hub: a potential initiative, ${esc(e.to || '')}`, undone:'Move into the Hub undone' }[e.kind];
    if (t) out.push(`${t} \u00b7 ${esc(onDay(e.at))}${by(e)}`);
  });
  return out;
}
function redrawWR(){
  refreshRequests(); drawRail();
  if (view === 'all') drawAll(); else if (view === 'detail') drawDetail(); else if (view === 'mine') drawMine();
}
function changeReq(id, fn, msg){
  return mutate('requests', docs => { const d = docs[id]; if (!d) throw { code:'GONE' }; const out = fn(d, docs); d.updatedAt = new Date().toISOString(); return out; })
    .then(out => { redrawWR(); if (msg) toast(typeof msg === 'function' ? msg(out) : msg); return out === undefined ? true : out; },
          e => { toast('Not saved: ' + errText(e) + '.'); return false; });
}
function setFac(id, v){
  return changeReq(id, d => { d.facilitator = v; }, v ? 'Facilitator saved: ' + v : 'Facilitator cleared')
    .then(ok => { const c = document.querySelector(`[data-confirm="${id}"]`); if (ok && c && !c.disabled) c.focus(); return ok; });
}
async function confirmReq(id){
  const x = requests.find(q => q.id === id); if (!x) return;
  if (!autoFac(x)){ toast('Choose a facilitator first.'); return; }
  const fac = autoFac(x), keepAt = refocusNext(id);
  const wr = await changeReq(id, (d, docs) => {
    if (d.status !== 'new') return d.wr;                                    // someone else confirmed it meanwhile
    const now = new Date();
    d.wr = String(d.wr || '').trim() || nextWR(docs, yearET(now));
    d.facilitator = d.facilitator || autoFac(d) || fac;
    d.status = 'awaiting'; d.confirmedBy = ME_BY(); d.confirmedAt = now.toISOString();
    logIt(d, 'confirmed', { wr:d.wr });
    return d.wr;
  }, w => `Confirmed as ${w} and moved to the Approval Queue.`);
  if (wr) { WOPEN.delete(id); keepAt(); }
}
/* after a request leaves the list, the focus goes to the next line (or the tabs), not to the top of the page */
function refocusNext(id){
  const rows = [...document.querySelectorAll('.wl-list [data-row]')].map(e => e.dataset.row), i = rows.indexOf(id);
  return () => { if (view !== 'all'){ return; } const left = [...document.querySelectorAll('.wl-list [data-wopen]')];
    const t = left[Math.min(i, left.length - 1)] || document.querySelector('.stages [aria-pressed="true"]'); if (t) t.focus(); };
}
function saveSched(id, date){
  return changeReq(id, d => {
    if (d.status !== 'awaiting') throw { code:'MOVED', message:'its status changed meanwhile' };
    d.scheduledFor = date || ''; d.scheduledBy = ME_BY(); d.scheduledAt = new Date().toISOString();
    logIt(d, date ? 'scheduled' : 'unscheduled', date ? { date } : {});
  }, date ? 'Scheduled for approval on ' + fmtDate(date) + '.' : 'Approval date removed.').then(ok => { if (ok){ delete SCHED[id]; redrawWR(); } return ok; });
}
const DEC_MSG = { awaiting:'Set back to Awaiting Approval.', info:'Marked Needs More Information. It stays in the Approval Queue.', approved:'Approved. It\u2019s now under Approved.', declined:'Declined. It\u2019s now in the Archive.' };
async function saveDecision(id){
  const x = requests.find(q => q.id === id), P = DEC[id]; if (!x || !P || P.status === x.status) return;
  const note = String(P.note || '').trim(), ta = document.getElementById('dn-' + id);
  if (P.status === 'info' && !note){ toast('Add a note on what the executive team needs.'); if (ta) ta.focus(); return; }
  if (P.status === 'declined' && !note){ toast('Add the reason it was declined.'); if (ta) ta.focus(); return; }
  const leaving = P.status === 'approved' || P.status === 'declined', keepAt = refocusNext(id);
  const ok = await changeReq(id, d => {
    const now = new Date().toISOString();
    if (d.status !== 'awaiting' && d.status !== 'info') throw { code:'MOVED', message:'its status changed meanwhile' };
    d.status = P.status;
    if (P.status === 'info'){ d.infoNote = note; d.infoBy = ME_BY(); d.infoAt = now; d.scheduledFor = ''; logIt(d, 'info', { note }); }
    if (P.status === 'awaiting') logIt(d, 'awaiting');
    if (P.status === 'approved'){ d.decidedBy = ME_BY(); d.decidedAt = now; logIt(d, 'approved'); }
    if (P.status === 'declined'){ d.declineReason = note; d.decidedBy = ME_BY(); d.decidedAt = now; logIt(d, 'declined', { note }); }
  }, DEC_MSG[P.status]);
  if (ok){ delete DEC[id]; if (leaving) WOPEN.delete(id); redrawWR(); if (leaving) keepAt(); }
}
function reopenReq(id){
  return changeReq(id, d => { d.status = 'awaiting'; d.decidedBy = null; d.decidedAt = null; d.declineReason = ''; logIt(d, 'reopened'); }, 'Moved back to the Approval Queue.');
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.dec) return;
  const id = t.dataset.dec, x = requests.find(q => q.id === id); if (!x) return;
  DEC[id] = { status:t.value, note:(DEC[id] && DEC[id].note) || '' }; if (DEC[id].status === x.status) delete DEC[id];
  redrawWR(); const r = document.querySelector(`input[name="dec-${id}"][value="${t.value}"]`); if (r) r.focus();
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.decnote && DEC[t.dataset.decnote]) DEC[t.dataset.decnote].note = t.value; });
document.addEventListener('click', e => {
  if (view !== 'all' && view !== 'detail') return;
  if (DLM && !e.target.closest('.dlm')){ DLM = false; if (view === 'all') drawAll(); }
  const t = e.target.closest('[data-st],[data-qf],[data-wopen],[data-wall],[data-confirm],[data-schedsave],[data-schedchange],[data-schedclear],[data-schedx],[data-decsave],[data-deccancel],[data-reopen],[data-undo],[data-dlmenu],[data-dlall]'); if (!t) return;
  const d = t.dataset;
  if (d.st){ filter = d.st; DLM = false; drawAll(); const b = document.querySelector(`[data-st="${d.st}"]`); if (b) b.focus(); return; }
  if (d.qf){ qf = d.qf; drawAll(); const b = document.querySelector(`[data-qf="${d.qf}"]`); if (b) b.focus(); return; }
  if (d.wall){ inStage(filter).forEach(x => d.wall === '1' ? WOPEN.add(x.id) : WOPEN.delete(x.id)); drawAll(); return; }
  if (d.wopen){ const id = d.wopen; WOPEN.has(id) ? WOPEN.delete(id) : WOPEN.add(id); drawAll(); const h = document.querySelector(`[data-wopen="${id}"]`); if (h) h.focus(); return; }
  if (d.confirm){ t.disabled = true; confirmReq(d.confirm); return; }
  if (d.schedsave){ const v = SCHED[d.schedsave]; if (v){ t.disabled = true; saveSched(d.schedsave, v); } return; }
  if (d.schedchange){ const x = requests.find(q => q.id === d.schedchange); SCHED[d.schedchange] = (x && x.scheduledFor) || ''; redrawWR(); const p = document.getElementById('f-sch-' + d.schedchange); if (p) p.focus(); return; }
  if (d.schedx){ delete SCHED[d.schedx]; redrawWR(); return; }
  if (d.schedclear){ t.disabled = true; saveSched(d.schedclear, ''); return; }
  if (d.deccancel){ delete DEC[d.deccancel]; redrawWR(); return; }
  if (d.decsave){ saveDecision(d.decsave); return; }
  if (d.reopen){ t.disabled = true; reopenReq(d.reopen); return; }
  if (d.undo){ t.disabled = true; changeReq(d.undo, x => { x.status = 'approved'; x.assignedTo = ''; x.potentialId = ''; x.potentialName = ''; logIt(x, 'undone'); }, 'Undone. It\u2019s back under Approved, waiting to move into the Hub.'); return; }
  if (d.dlmenu !== undefined){ DLM = !DLM; drawAll(); const f = DLM ? document.querySelector('.dlm-pop button') : document.querySelector('[data-dlmenu]'); if (f) f.focus(); return; }
  if (d.dlall){ DLM = false; drawAll(); downloadAll(d.dlall); return; }
});
document.addEventListener('keydown', e => {
  if (!DLM || view !== 'all') return;
  const items = [...document.querySelectorAll('.dlm-pop button')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape'){ e.preventDefault(); DLM = false; drawAll(); const b = document.querySelector('[data-dlmenu]'); if (b) b.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus(); }
});
/* ─────────────── one request ─────────────── */
const SIDE_TITLE = { confirm:'Confirm', queue:'Executive Team\u2019s Decision', approved:'Approved', archive:'Declined' };
function drawDetail(){
  const x = requests.find(q => q.id === openId); if (!x) { show(ME.decides ? 'all' : 'mine'); return; }
  const r = x.req, mineToo = byMe(x), k = stageOf(x);
  const pdfBtn = `<button type="button" class="btn" data-pdf="req:${x.id}" style="margin-top:12px">${DL}Download PDF</button>`;
  let side;
  if (ME.decides){
    side = `<div class="card"><h3>From ${esc(byName(x))}</h3><p style="margin:0;font-size:12.5px;color:var(--ink-3)">${x.id} \u00b7 submitted ${fmt(x.submitted)}</p><div style="margin-top:8px">${stChip(x)}</div>${pdfBtn}</div>
      <div class="card wl-side"><h3>${SIDE_TITLE[k]}</h3>${stepHTML(x, 'side')}</div>
      <div class="card"><h3>History</h3><ul class="wl-hist">${historyLines(x).map(h => `<li>${h}</li>`).join('')}</ul></div>`;
  } else {
    const done = k === 'approved' || k === 'archive';
    const team = k === 'queue' ? (x.status === 'info' ? 'Needs more information' + (x.infoNote ? ': \u201c' + x.infoNote + '\u201d' : '') : 'Awaiting approval' + (x.scheduledFor ? ', scheduled for ' + fmtDate(x.scheduledFor) : ''))
      : done ? 'Done' : 'Not yet';
    const outcome = k === 'approved' ? (x.status === 'assigned' ? 'Approved, and now part of ' + x.assignedTo : x.status === 'potential' ? 'Approved, and now a potential initiative: ' + x.potentialName : 'Approved')
      : k === 'archive' ? 'Declined' + (x.declineReason ? ': \u201c' + x.declineReason + '\u201d' : '') : 'Approved or declined';
    const steps = [['Submitted', fmt(x.submitted), 'ok'], ['Confirmed by MISMO', k === 'confirm' ? 'Not yet' : (x.wr || 'Done'), k === 'confirm' ? 'now' : 'ok'],
      ['With the Executive Team', team, k === 'queue' ? 'now' : done ? 'ok' : ''], ['Decision', outcome, k === 'approved' ? 'ok' : k === 'archive' ? 'bad' : '']];
    side = `<div class="card"><h3>${mineToo ? 'Where It Stands' : 'From ' + esc(byName(x))}</h3><ol class="timeline">${steps.map(([t, s, c]) => `<li class="${c}"><b>${t}</b>${esc(s)}</li>`).join('')}</ol>${pdfBtn}</div>
      <p style="margin:0;font-size:12.5px;color:var(--ink-3)">MISMO confirms the request, gives it a WR#, and sends it to the executive team for approval.</p>`;
  }
  const back = mineToo && !ME.decides ? 'mine' : ME.decides ? 'all' : 'mine';
  $('#page').innerHTML = `<button type="button" class="btn ghost" data-view-go="${back}" data-keep style="margin-bottom:10px">\u2190 ${back === 'mine' ? 'My Work Requests' : 'All Work Requests'}</button>
    <div class="wr">${headHTML(r, { mode:'view', wr:x.wr, fac:autoFac(x), submitted:x.submitted })}<div class="wr-grid"><div>${timelineHTML(r, { mode:'view', fin: x.fin || Object.fromEntries(SECTIONS.map(s => [s.id, x.submitted])) })}</div><aside class="side">${side}</aside></div></div>`;
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
  ['page','wizard','done'].forEach(k => { document.getElementById('view-' + k).hidden = (k === 'page' ? !['mine','all','detail','ideas'].includes(v) : k !== v); });
  if (v !== 'wizard') $('#wizard').innerHTML = '';
  if (v === 'mine') drawMine(); else if (v === 'all') drawAll(); else if (v === 'detail') drawDetail(); else if (v === 'ideas') drawIdeas();
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
  if (t.dataset.adder || t.dataset.phadder !== undefined || t.dataset.orgadder !== undefined){ const a = t.closest('.adder'); if (a) a.classList.toggle('typing', !!t.value.trim()); }
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
  if (d.viewGo){ if (W && W.dirty) saveDraft(true); W = null; openId = null; if (d.viewGo === 'all' && d.keep === undefined){ filter = null; qf = 'all'; WOPEN.clear(); } show(d.viewGo); return; }
  if (d.newreq !== undefined){ if (W && W.dirty) saveDraft(true); startWizard(); return; }
  if (d.mine){ const [k, id] = d.mine.split(':'); if (W && W.dirty) saveDraft(true); W = null; if (k === 'draft') resume(id); else { openId = id; show('detail'); } return; }
  if (b.id === 'themeBtn'){ const next = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('resources:hub:theme', next); } catch (err) {} paintTheme(); return; }
  if (d.resume){ resume(d.resume); return; }
  if (d.deldraft){ const id = d.deldraft; mutate('drafts', dd => { delete dd[id]; }).then(() => { show(view); toast('Draft deleted'); }, er => toast('The draft could not be deleted: ' + errText(er) + '.')); return; }
  if (d.open){ openId = d.open; show('detail'); return; }
  if (d.mode !== undefined){ if (d.mode) decideForm(d.mode); else $('#decideForm').innerHTML = ''; return; }
  if (d.assign !== undefined){ const x0 = requests.find(q => q.id === openId), f = $('#decideForm'); if (!f.dataset.choice){ toast('Choose an initiative first.'); return; }
    b.disabled = true; const choice = f.dataset.choice;
    changeReq(x0.id, dd => { Object.assign(dd, { status:'assigned', assignedTo:choice }); logIt(dd, 'assigned', { to:choice }); }, null)
      .then(ok => { if (!ok){ b.disabled = false; return; } return addToOverview(x0, choice).then(m => toast('Assigned to ' + choice + '. ' + m)); }); return; }
  if (d.promote !== undefined){ const x0 = requests.find(q => q.id === openId); promote(x0); return; }
  if (d.pdf){ makePDF(d.pdf); return; }
  if (d.again !== undefined){ startWizard(); return; }
  if (d.gomine !== undefined){ show('mine'); return; }
  if (!W) return;
  if (d.next !== undefined) nextSection();
  else if (d.back !== undefined) back();
  else if (d.savedraft !== undefined){ takePending(); saveDraft(false); drawWizard(); }
  else if (d.exit !== undefined){ takePending(); const p = saveDraft(true); W = null; show('mine'); p.then(ok => { if (ok){ show('mine'); toast('Draft saved. Resume it any time from My Work Requests.'); } }); }
  else if (d.goto){ goTo(d.goto); }
  else if (d.suggest){ W.r.completion = d.suggest; delete W.errs.completion; dirty(); drawWizard(); document.getElementById('f-completion').focus(); }
  else if (d.addsponsor !== undefined){ W.r.sponsors.push({ name:'', company:'' }); dirty(); drawWizard(); const rs = document.querySelectorAll('[data-row="sponsors"][data-f="name"]'); rs[rs.length - 1].focus(); }
  else if (d.addstake !== undefined){ (W.r.stake = W.r.stake || []).push({ type:'', problem:'', benefit:'', roles:'', size:'' }); delete W.errs.stake; dirty(); drawWizard();
    const f = document.querySelector(`#stk-${W.r.stake.length - 1} input`); if (f) f.focus(); }
  else if (d.ssize){ const [i, v] = d.ssize.split(':'); W.r.stake[+i].size = W.r.stake[+i].size === v ? '' : v; dirty(); redraw(); }
  else if (d.delrow){ W.r[d.delrow].splice(+d.i, 1); dirty(); redraw(); }
  else if (d.add){ const inp = document.querySelector(`[data-adder="${d.add}"]`); const v = inp.value.trim(); if (v){ W.r[d.add].push(v); inp.value = ''; delete W.errs[d.add]; dirty(); drawWizard(); document.querySelector(`[data-adder="${d.add}"]`).focus(); } }
  else if (d.del){ W.r[d.del].splice(+d.i, 1); dirty(); drawWizard(); }
  else if (d.addorg !== undefined){ const gi = +d.addorg, inp = document.querySelector(`[data-orgadder="${gi}"]`), v = inp.value.trim(); if (v){ W.r.parts[gi].orgs.push({ name:v, adopted:'' }); inp.value = ''; dirty(); drawWizard(); document.querySelector(`[data-orgadder="${gi}"]`).focus(); } }
  else if (d.delorg){ const [gi, oi] = d.delorg.split(':').map(Number); W.r.parts[gi].orgs.splice(oi, 1); dirty(); drawWizard(); const a = document.querySelector(`[data-orgadder="${gi}"]`); if (a) a.focus(); }
  else if (d.delgroup !== undefined){ W.r.parts.splice(+d.delgroup, 1); dirty(); drawWizard(); document.getElementById('f-addgroup').focus(); }
  else if (d.adopt){ const [gi, oi, v] = d.adopt.split(':'); const o = W.r.parts[+gi].orgs[+oi]; o.adopted = o.adopted === v ? '' : v; dirty(); redraw(); }
  else if (d.view){ W.r.impact[d.view] = !W.r.impact[d.view]; dirty(); redraw(); }
  else if (d.addph !== undefined){ const inp = document.querySelector(`[data-phadder="${d.addph}"]`); const v = inp.value.trim(); if (v){ W.r.phases[+d.addph].push(v); inp.value = ''; dirty(); drawWizard(); document.querySelector(`[data-phadder="${d.addph}"]`).focus(); } }
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
    case 'request': if (r.isUpdate === 'no') return [['Update to an Existing Standard', yn(r.isUpdate)], ['From Idea', v(r.fromIdea ? r.fromIdea.id + ', sent by ' + r.fromIdea.name + (r.fromIdea.company ? ', ' + r.fromIdea.company : '') + ' (' + r.fromIdea.email + ')' : '')],
      ['Sponsors', list(r.sponsors.filter(s => t(s.name)).map(s => s.name + (t(s.company) ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
      return [['Update to an Existing Standard', yn(r.isUpdate)], ['Standard', v(r.standard)],
      ['Sponsors', list(r.sponsors.filter(s => t(s.name)).map(s => s.name + (t(s.company) ? ', ' + s.company : '')))], ['Community of Practice Sponsor', v(r.cop)]];
    case 'kind': return [['Annual Maintenance', yn(r.maintenance)], ...(r.maintenance === 'no' ? [['Administrative Change Only', yn(r.admin)]] : [])];
    case 'plan': return [['Discovery Needed', yn(r.discovery)], ['MISMO Segment', v(r.segments.join(', '))], ['Level of Effort', v(ef ? `${ef[1]} (${ef[2]})` : '')],
      ['Reasoning', v(r.effortWhy)], ['Expected Completion', v(fmtDate(r.completion))]];
    case 'status': return [['Updates Requested', v(r.updates)], ['How They Solve It', v(r.solves)]];
    case 'people': return [['Owning Workgroup', v(r.owner)], ['Stakeholders', r.parts.length ? { groups: r.parts } : { text: 'None', muted: true }],
      ...(adoptionLimited(r) ? [['Why a Revision Helps Adoption', v(r.adoptionWhy)]] : [])];
    case 'adoption': return [['Regulation or Mandate', yn(r.mandate)], ...(r.mandate === 'yes' ? [['Details', v(r.mandateDetails)]] : []), ['MISMO Staff Support', v(r.staff)], ['Partner Organizations', v(r.partners)], ...(r.isUpdate === 'no' ? [['Market Condition Impacts', v(r.market)], ['Related Technologies', v(r.tech)], ['Consumer Benefit', v(r.consumer)]] : [])];
    case 'current': return [['Business Challenge', v(r.challenge)], ['How It Works Today', v(r.today)], ['Inefficiencies and Risks', v(r.pains)]];
    case 'future': return [['Proposed Approach', v(r.vision)], ['Lower Costs', v(r.costs)], ['Evaluating Success', v(r.success)]];
    case 'stake': return [['Stakeholder Groups', list((r.stake || []).filter(g => String(g.type || '').trim()).map(g => g.type + (g.size ? ' (' + { low:'Low', medium:'Medium', high:'High' }[g.size] + ' implementation)' : '')
        + (g.problem ? '. Problem: ' + g.problem : '') + (g.benefit ? '. Benefit: ' + g.benefit : '') + (g.roles ? '. Roles: ' + g.roles : '')))], ['Organizations Already Engaged', list(r.engaged || [])]];
    case 'scope': return [['In Scope', list(r.inScope)], ['Out of Scope', list(r.outScope)]];
    case 'deliver': return [['Deliverables', list(deliverables(r))],
      ['Future Phases', v(r.future)], ['Recommendation', r.rec === 'cop' ? { text: 'Community of Practice (fast track)' } : r.rec === 'dwg' ? { text: 'Development Work Group (project)' } : { text: 'Not answered', muted: true }], ['Reasoning', v(r.recWhy)]];
    case 'impact': return [['Areas', { impact: IMPACT.map(([k, n]) => ({ name: n, on: !!r.impact[k], views: k === 'ldm' && r.impact[k] ? LDM_VIEWS.filter(([vk]) => r.impact[vk]).map(([, vt]) => vt).join(', ') : '' })) }]];
  }
  return [];
}
function pdfDoc(title){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter', compress:true });
  for (const [file, name] of Object.entries(PDF_FACES)){ doc.addFileToVFS(file, PDF_FONTS[file]); doc.addFont(file, name, 'normal'); }
  doc.setProperties({ title, subject: 'Care and Feeding Work Request', author: 'MISMO', creator: 'MISMO Initiative Hub' });
  return doc;
}
/* the page footers, once the count is known */
function numberPages(doc){
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){ doc.setPage(i); doc.setFont('MONO', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 152, 150);
    doc.text('Where our industry builds what\u2019s next.', 54, 792 - 32); doc.text(`Page ${i} of ${n}`, 612 - 54, 792 - 32, { align:'right' }); }
}
/* One request as a PDF. With ctx ({ doc }), it is added to that PDF instead, starting on a new page (Download All). */
function buildPDF(r, meta, ctx){
  const doc = ctx ? ctx.doc : pdfDoc(r.title || 'Untitled Work Request');
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
  newPage(!ctx);
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
  const order = r.isUpdate === 'no' ? secs.filter(s => s.id !== 'newstd') : SECTIONS.filter(s => secs.includes(s)), num = id => String(order.findIndex(s => s.id === id) + 1).padStart(2, '0');
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
  if (ctx) return;
  numberPages(doc);
  return doc.output('blob');
}
/* Download All, as one PDF: a contents page (WR#, request, facilitator, status, the page it starts on), then each
   request as it downloads on its own (Perry, 28 Oct 2026). */
function buildPacket(list){
  const doc = pdfDoc('Work Requests for Approval');
  const PW = 612, ML = 54, MR = 54, PER = 16, cpages = Math.max(1, Math.ceil(list.length / PER)), starts = [];
  for (let i = 1; i < cpages; i++) doc.addPage();
  list.forEach(x => { starts.push(doc.getNumberOfPages() + 1); buildPDF(x.req, metaOf(x), { doc }); });
  const ink = [15, 49, 76], soft = [69, 97, 121], sky = [80, 164, 219], mute = [150, 152, 150];
  const font = (n, z, c) => { doc.setFont(n, 'normal'); doc.setFontSize(z); doc.setTextColor(...(c || ink)); };
  const cols = [[ML, 70, 'WR#'], [ML + 78, 200, 'Request'], [ML + 286, 100, 'Facilitator'], [ML + 394, 82, 'Status']];
  const short = x => x.status === 'awaiting' ? (x.scheduledFor ? 'Scheduled ' + md(x.scheduledFor) : 'Awaiting Approval') : x.status === 'info' ? 'Needs More Information' : statusLine(x);
  for (let pg = 0; pg < cpages; pg++){
    doc.setPage(pg + 1);
    doc.addImage(pdfLogo(), 'PNG', ML, 34, 84, 12.8, 'logo', 'FAST');
    font('MONO', 7.5, mute); doc.text('Work Requests for Approval', PW - MR, 44, { align:'right' });
    let y = 84;
    if (pg === 0){
      font('A800', 24, ink); doc.text('Work Requests for Approval', ML, y + 18); y += 34;
      font('LF4', 10.5, soft); doc.text(`From the Approval Queue, ${fmtDate(todayDC())}. ${list.length} ${list.length === 1 ? 'request' : 'requests'}, in WR# order.`, ML, y + 6); y += 26;
    }
    doc.setDrawColor(...ink); doc.setLineWidth(1.2); doc.line(ML, y + 14, PW - MR, y + 14);
    cols.forEach(([cx, , t]) => { font('LF6', 8, soft); doc.text(t, cx, y + 9); }); font('LF6', 8, soft); doc.text('Page', PW - MR, y + 9, { align:'right' });
    y += 24;
    list.slice(pg * PER, pg * PER + PER).forEach((x, i) => {
      const at = pg * PER + i, t = doc.splitTextToSize(x.req.title || 'Untitled Work Request', cols[1][1]).slice(0, 2), st = doc.splitTextToSize(short(x), cols[3][1]).slice(0, 2);
      const h = Math.max(t.length, st.length) * 12 + 12;
      font('MONO', 9, ink); doc.text(x.wr || x.id, cols[0][0], y + 10);
      font('LF6', 9.5, ink); doc.text(t, cols[1][0], y + 10, { lineHeightFactor:1.25 });
      font('LF4', 9, soft); doc.text(doc.splitTextToSize(autoFac(x) || 'Not chosen', cols[2][1]).slice(0, 2), cols[2][0], y + 10, { lineHeightFactor:1.25 });
      font('LF4', 9, soft); doc.text(st, cols[3][0], y + 10, { lineHeightFactor:1.25 });
      font('MONO', 9, ink); doc.text(String(starts[at]), PW - MR, y + 10, { align:'right' });
      doc.setDrawColor(...sky); doc.setLineWidth(0.5); doc.line(ML, y + h - 2, PW - MR, y + h - 2);
      y += h;
    });
  }
  numberPages(doc);
  return doc.output('blob');
}
const pdfName = (r, wr) => ((wr ? wr + ' ' : '') + (r.title || 'Untitled Work Request')).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
function statusLine(x){ const s = x.status;
  return s === 'awaiting' ? 'Awaiting Approval' + (x.scheduledFor ? ', scheduled for ' + fmtDate(x.scheduledFor) : '') : s === 'info' ? 'Needs More Information' : s === 'approved' ? 'Approved'
    : s === 'assigned' ? 'Approved; part of ' + x.assignedTo : s === 'potential' ? 'Approved; a potential initiative' : s === 'declined' ? 'Declined' : 'Waiting to be confirmed'; }
const metaOf = x => ({ wr:x.wr, fac:autoFac(x), submitted:x.submitted, status:statusLine(x) });
function loadScript(src){ return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); }); }
async function pdfReady(){ if (!window.jspdf) await loadScript('vendor/jspdf-2.5.1.umd.min.js'); if (!window.WR_PDF) await loadScript('work-requests-pdf-assets.js'); }
async function makePDF(key){
  try { await pdfReady(); } catch (e){ toast('The PDF tool could not load. Check the connection and try again.'); return; }
  let r, meta;
  if (key === 'draft'){ r = W.r; meta = { status:'Draft' }; }
  else { const x = requests.find(q => q.id === key.slice(4)); if (!x) return; r = x.req; meta = metaOf(x); }
  let blob; try { blob = buildPDF(r, meta); } catch (e){ console.error(e); toast('The PDF could not be made.'); return; }
  await saveFile(blob, pdfName(r, meta.wr), 'PDF');
}
async function saveFile(blob, filename, what){
  window.__lastPDF = { blob, filename };            // for the page's own tests
  const viaViewer = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads').catch(() => null) : null;
  if (viaViewer){
    try { await viaViewer.save({ filename, data: blob }); toast(what + ' saved'); }
    catch (e){ toast(e && e.code === 'declined' ? 'Download cancelled' : e && e.code === 'rate_limited' ? 'A save is already waiting for you to confirm.' : 'The ' + what + ' could not be saved here.'); }
    return;
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  toast(what + ' downloaded');
}
/* Download All PDFs, from the Approval Queue (what its status tab shows, in WR# order): one PDF with a contents page,
   or each request's own PDF in one .zip file (JSZip 3.10.1, MIT, in vendor/, loaded only when first used). */
async function downloadAll(kind){
  const list = sortFor('queue', inStage('queue').filter(x => qf === 'all' || x.status === qf)); if (!list.length) return;
  try { await pdfReady(); if (kind === 'zip' && !window.JSZip) await loadScript('vendor/jszip-3.10.1.min.js'); }
  catch (e){ toast('The download tool could not load. Check the connection and try again.'); return; }
  toast(`Making ${list.length === 1 ? 'the PDF' : 'the ' + list.length + ' PDFs'}\u2026`);
  const stem = 'Approval Queue, ' + fmtDate(todayDC()).replace(',', '');
  try {
    if (kind === 'zip'){
      const zip = new window.JSZip(), used = new Set();
      list.forEach(x => { let n = pdfName(x.req, x.wr || x.id); while (used.has(n)) n = n.replace(/\.pdf$/, ' (' + x.id + ').pdf'); used.add(n); zip.file(n, buildPDF(x.req, metaOf(x))); });
      const blob = await zip.generateAsync({ type:'blob' });
      window.__lastZip = { names:[...used] };
      await saveFile(blob, stem + '.zip', 'Zip file');
    } else await saveFile(buildPacket(list), stem + '.pdf', 'PDF');
  } catch (e){ console.error(e); toast('The download could not be made.'); }
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
  if (ME.decides && !fileOf('ideas').saving){ try { await load('ideas'); refreshIdeas(); } catch (e) {} }
  refreshRequests(); drawRail();
  if (view === 'ideas' && !ICLOSE) drawIdeas();
  const busy = document.activeElement && document.activeElement.closest && document.activeElement.closest('.side, #decideForm');
  const busyAll = OPEN || ACO || DLM || Object.keys(DEC).length || Object.keys(SCHED).length || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.wl .ib-body'));
  if (view === 'mine') drawMine(); else if (view === 'all' && !busyAll) drawAll(); else if (view === 'detail' && !busy && !busyAll && !($('#decideForm') && $('#decideForm').innerHTML)) drawDetail();
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
    if (ME.decides){ try { await load('ideas'); } catch (e) { /* none yet, or this relay predates the Ideas Inbox */ } refreshIdeas(); }
    try { const got = await hubCall('GET', 'facilitator-roster'); const j = got && got.data; if (j){ const list = (j.facilitators || j || []).map(f => f.name).filter(Boolean); if (list.length) L.facilitators = list; } } catch (e) {}
    const h = location.hash.replace('#', '');
    if (h === 'ideas' && ME.decides) show('ideas'); else if (h === 'new' && ME.submits) startWizard(); else show(h === 'all' && ME.decides ? 'all' : h === 'mine' ? 'mine' : (ME.decides ? 'all' : 'mine'));
    setInterval(poll, 30000); document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }, e => { if (e && e.code === 'OFFLINE') banner('<b>Work Requests couldn\u2019t reach the sign-in service.</b> Check your connection, then reload the page.'); });
}
boot();

})();
