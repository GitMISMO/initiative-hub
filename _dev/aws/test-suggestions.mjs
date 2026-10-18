/* The public glossary's Suggest a Term route, and who may read the suggestions (relay request 10; Perry, 18 Oct 2026, asked
 * for by the glossary chat). Run: node test-suggestions.mjs. A stand-in GitHub and mail flow, as in test-ideas.mjs. */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'sugg-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = {
  'perry@example.org': { name: 'Perry Williams', hash: pb(PW), platformAdmin: true, access: { hub: 'admin' } },
  'gina@example.org': { name: 'Gina Glossary', hash: pb(PW), access: { glossary: 'admin', 'glossary-data': 'admin' } },
  'eddie@example.org': { name: 'Eddie Editor', hash: pb(PW), access: { glossary: 'staff', 'glossary-data': 'staff' } },
  'vic@example.org': { name: 'Vic Viewer', hash: pb(PW), access: { glossary: 'view', 'glossary-data': 'view' } },
  'amy@example.org': { name: 'Amy Moses', hash: pb(PW), access: { hub: 'staff' } },
  'old@example.org': { name: 'Old Admin', hash: pb(PW), access: { glossary: 'admin' }, expires: '2020-01-01' } };
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
put('Org/Config:projects.json', { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] }, 'hub-requests': { repo: 'Org/Requests', origin: ORIGIN, writable: ['data/'] },
  glossary: { repo: 'Org/Gloss', origin: ORIGIN, writable: ['data/', '.console/'] }, 'glossary-data': { repo: 'Org/GlossData', origin: ORIGIN, writable: ['data/', '.console/'] } });
put('Org/Accounts:access.json', { people });
put('Org/GlossData:.console/draft.json', { terms: {}, savedBy: 'seed' });
const mails = []; let mailDown = false, ghDown = false;
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { if (mailDown) return R(500, {}); mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/); if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1]; return v ? R(200, { sha: v.sha, content: Buffer.from(JSON.stringify(v.data)).toString('base64') }) : R(404, {}); }
  if (method === 'PUT') { if (ghDown && m[1] === 'Org/GlossData') return R(500, {}); const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(cur ? 200 : 201, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const relay = await import('./index.mjs'); const { handler } = relay;
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 260))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { token, body, origin = ORIGIN, ip = '203.0.113.1', raw, qs } = {}) => handler({ rawPath: path, rawQueryString: qs || '', requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
const reset = () => relay.__resetAccessCache && relay.__resetAccessCache();
const login = async e => { reset(); return J(await call('POST', '/hub/auth/login', { body: { email: e, password: PW } })).token; };
const T = {}; for (const e of ['perry', 'gina', 'eddie', 'vic', 'amy']) T[e] = await login(e + '@example.org');
const file = () => (repo['Org/GlossData:data/suggestions.json'] || []).at(-1)?.data || { docs: {} };
const UUID = '3f2a9c1e-7b4d-4e2a-9c1f-0a1b2c3d4e5f';
const SUG = { kind: 'new', term: 'Escrow Shortage Cushion', definition: 'The amount a servicer may hold beyond the computed escrow need to cover disbursement increases.', why: 'Servicers use it but the glossary has no entry.',
  sourceRef: 'RESPA, 12 CFR 1024.17', name: 'Dana Whitfield', email: 'dana@northbridge.example', organization: 'Northbridge Mortgage', website: '' };
const send = (extra = {}, o = {}) => call('POST', '/glossary-data/suggestions/submit', { body: { ...SUG, startedAt: Date.now() - 20_000, ...extra }, ...o });
let r, d;

/* ---------- a good suggestion ---------- */
mails.length = 0; r = await send({}, { ip: '198.51.100.1' }); d = J(r);
ok('a good suggestion, no sign-in: accepted as SUG-0001, with when', r.statusCode === 200 && d.ok === true && d.reference === 'SUG-0001' && !Number.isNaN(Date.parse(d.at)), d);
const s1 = file().docs['SUG-0001'];
ok('saved in data/suggestions.json of glossary-data, in the agreed shape', s1 && JSON.stringify(Object.keys(s1).sort()) === JSON.stringify(['at', 'definition', 'email', 'id', 'kind', 'name', 'organization', 'sourceRef', 'status', 'term', 'via', 'why'].sort())
  && s1.status === 'new' && s1.via === 'public form' && s1.at === d.at && s1.term === SUG.term, s1);
const rec = mails.find(x => x.kind === 'suggestion-receipt');
ok('the receipt has the agreed words and the reference', rec && rec.to === SUG.email && /The glossary team reviews every suggestion/.test(rec.text) && /Your reference is SUG-0001\. Mention it if you write to MISMO about this suggestion\./.test(rec.text), rec && rec.text);
ok('...and repeats nothing the sender typed', rec && ![SUG.term, SUG.name, SUG.organization, 'Escrow', 'Northbridge', 'RESPA', 'Dana'].some(t => (rec.subject + rec.text).includes(t)), rec);
const al = mails.filter(x => x.kind === 'suggestion-alert');
ok('the alert goes to the glossary console\u2019s administrators and the platform administrators only', JSON.stringify(al.map(x => x.to).sort()) === JSON.stringify(['gina@example.org', 'perry@example.org']), al.map(x => x.to));
ok('...with the term, new or better, name, organization, email, the start of the definition, and the link', al.every(x => x.subject.includes('SUG-0001') && x.subject.includes(SUG.term) && /a new term/.test(x.text)
  && x.text.includes('Dana Whitfield, Northbridge Mortgage (dana@northbridge.example)') && x.text.includes('The amount a servicer may hold') && x.text.includes('https://resources.mismo.org/glossary/console/#open=suggestions')));
r = await send({ kind: 'better', termId: UUID, term: 'Escrow\nAccount   Analysis' }, { ip: '198.51.100.2' }); const s2 = file().docs['SUG-0002'];
ok('the next is SUG-0002: "better" keeps its lowercase-UUID termId, and line breaks leave one-line fields', J(r).reference === 'SUG-0002' && s2.kind === 'better' && s2.termId === UUID && s2.term === 'Escrow Account Analysis', s2);
await send({ kind: 'better', termId: UUID.toUpperCase() }, { ip: '198.51.100.3' }); ok('...an uppercase ID isn\u2019t kept', !('termId' in file().docs['SUG-0003']));
await send({ kind: 'new', termId: UUID }, { ip: '198.51.100.4' }); ok('...nor an ID on a new term', !('termId' in file().docs['SUG-0004']));
const L = { ...SUG }; const long = await send({ definition: 'x'.repeat(30) + '\n\nSecond paragraph stays.' }, { ip: '198.51.100.5' });
ok('a definition keeps its paragraphs', file().docs[J(long).reference].definition.includes('\n\nSecond paragraph stays.'));

/* ---------- each field rule ---------- */
const bad = async (extra, re, label) => { const r2 = await send(extra, { ip: 'f-' + label }); const p = r2.statusCode === 400 && J(r2).error === 'INVALID' ? J(r2).problems : null; ok(`${label}: refused, saying so`, p && p.some(x => re.test(x)), r2.body.slice(0, 200)); };
await bad({ kind: '' }, /new term or a better definition/, 'no kind');
await bad({ kind: 'other' }, /new term or a better definition/, 'an unknown kind');
await bad({ term: 'X' }, /term is too short/, 'a one-letter term');
await bad({ term: 'x'.repeat(151) }, /term is too long/, 'a term over 150');
await bad({ definition: 'Too short' }, /definition is too short/, 'a definition under 10');
await bad({ definition: 'x'.repeat(4001) }, /definition is too long/, 'a definition over 4,000');
await bad({ why: 'x'.repeat(2001) }, /Why is too long/, 'a why over 2,000');
await bad({ sourceRef: 'x'.repeat(501) }, /source or reference is too long/, 'a source over 500');
await bad({ name: 'D' }, /Your name is too short/, 'a one-letter name');
await bad({ name: '' }, /Your name is needed/, 'no name');
await bad({ organization: '' }, /Your organization is needed/, 'no organization');
await bad({ organization: 'x'.repeat(151) }, /organization is too long/, 'an organization over 150');
await bad({ email: 'not-an-email' }, /email address we can reply to/, 'a bad email');

/* ---------- misuse ---------- */
const before = Object.keys(file().docs).length; mails.length = 0;
r = await send({}, { origin: 'https://elsewhere.example', ip: '192.0.2.10' }); ok('from another site: refused', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await send({}, { origin: null, ip: '192.0.2.11' }); ok('with no Origin at all: refused', r.statusCode === 403);
r = await send({ website: 'https://spam.example' }, { ip: '192.0.2.12' }); ok('the trap field filled: "accepted", no reference', r.statusCode === 200 && J(r).ok === true && J(r).reference === null);
r = await send({ startedAt: Date.now() - 900 }, { ip: '192.0.2.13' }); ok('under 3 seconds: the same', J(r).reference === null);
r = await send({ startedAt: undefined }, { ip: '192.0.2.14' }); ok('no opening time: the same', J(r).reference === null);
ok('...none of those kept anything or emailed anyone', Object.keys(file().docs).length === before && mails.length === 0);
r = await send({ why: 'x'.repeat(17_000) }, { ip: '192.0.2.15' }); ok('over 16 kB: refused', r.statusCode === 413 && J(r).error === 'TOO_LARGE');
r = await call('POST', '/glossary/suggestions/submit', { body: { ...SUG, startedAt: Date.now() - 20_000 }, ip: '192.0.2.16' }); ok('only through glossary-data', r.statusCode === 404);
mailDown = true; r = await send({}, { ip: '192.0.2.40' }); mailDown = false; ok('if the emails fail, it\u2019s still kept', r.statusCode === 200 && file().docs[J(r).reference]);
ghDown = true; r = await send({}, { ip: '192.0.2.41' }); ghDown = false; ok('if GitHub can\u2019t save it: 502, try again', r.statusCode === 502 && J(r).error === 'NOT_SAVED' && /try again/.test(J(r).message));
for (let i = 0; i < 3; i++) await send({}, { ip: '192.0.2.99' });
r = await send({}, { ip: '192.0.2.99' }); ok('a fourth in an hour from one address: TOO_MANY', r.statusCode === 429 && J(r).error === 'TOO_MANY');
r = await call('POST', '/hub-requests/ideas/submit', { body: { title: 'An idea from the same place', idea: 'An idea from the same address, with enough detail to pass the rules.', name: 'Someone', company: 'Example Co', email: 's@example.org', startedAt: Date.now() - 20_000 }, ip: '192.0.2.99' });
ok('...its counters are its own: an idea from the same address still goes through', r.statusCode === 200 && J(r).reference, r.body.slice(0, 160));
let last = 200, n = 0; for (let i = 0; i < 40 && last === 200; i++) { last = (await send({}, { ip: '10.9.0.' + i })).statusCode; if (last === 200) n++; }
ok('at most 30 an hour in all', last === 429 && n < 30, { n, last });

/* ---------- who may read and write data/suggestions.json ---------- */
r = await call('GET', '/glossary-data/data/suggestions', { token: T.vic }); ok('View on glossary-data can\u2019t read it', r.statusCode === 403 && !/Dana/.test(r.body));
r = await call('GET', '/glossary-data/data/suggestions', { token: T.amy }); ok('nor can someone without glossary-data', r.statusCode === 403 && !/Dana/.test(r.body));
r = await call('GET', '/glossary-data/data/suggestions'); ok('nor anyone signed out', r.statusCode === 401);
r = await call('GET', '/glossary-data/data/suggestions', { token: T.eddie }); d = J(r); ok('Edit can read it', r.statusCode === 200 && d.data.docs['SUG-0001'].name === 'Dana Whitfield');
ok('...and so can Admin, and a platform administrator', J(await call('GET', '/glossary-data/data/suggestions', { token: T.gina })).data && J(await call('GET', '/glossary-data/data/suggestions', { token: T.perry })).data);
const c = JSON.parse(JSON.stringify(d.data)); Object.assign(c.docs['SUG-0001'], { status: 'sent', decision: 'sent', decidedBy: 'Eddie Editor', decidedAt: new Date().toISOString() });
r = await call('PUT', '/glossary-data/data/suggestions', { token: T.vic, body: { content: c, sha: d.sha } }); ok('View can\u2019t write it', r.statusCode === 403);
r = await call('PUT', '/glossary-data/data/suggestions', { token: T.eddie, body: { content: c, sha: d.sha } }); ok('Edit writes a decision, with the version check', r.statusCode === 200 && file().docs['SUG-0001'].decision === 'sent', r.body.slice(0, 160));
r = await call('PUT', '/glossary-data/data/suggestions', { token: T.eddie, body: { content: c, sha: d.sha } }); ok('...a stale version is refused, not overwritten', r.statusCode === 409);
for (const pth of ['data/suggestions.json', './data//suggestions.json', 'data/./suggestions.json', encodeURIComponent('data/suggestions.json')]) {
  r = await call('GET', '/glossary-data/file/' + pth, { token: T.eddie }); ok(`the file route can\u2019t read it, even for Edit ("${pth}")`, r.statusCode === 403 && !/Dana/.test(r.body), r.statusCode); }
r = await call('POST', '/glossary-data/commit', { token: T.eddie, body: { message: 'x', files: [{ path: 'data/suggestions.json', content: { docs: {} } }] } }); ok('...nor can the commit route write it', r.statusCode === 403);
r = await call('GET', '/glossary-data/file/.console/draft.json', { token: T.eddie }); ok('the console\u2019s draft is still read through the file route (nothing else closed)', r.statusCode === 200, r.statusCode);

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
