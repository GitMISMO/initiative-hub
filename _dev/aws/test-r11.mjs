/* Relay request 11: the public forms may be sent from mismo.org (formOrigins). Run: node test-r11.mjs
 * The Business Glossary chat's change (13 Nov 2026), rebuilt in the relay chat from its second patch, byte-identical
 * (fingerprint 76e5e515…); these checks are the relay chat's own. Only Suggest a Term, Submit an Idea and its files
 * read a project's formOrigins; MISMO Link and everything behind a sign-in keep the one origin.
 * The stand-in GitHub is request 10's (test-r10.mjs). */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example', SITE = 'https://collaborate.mismo.org', WWW = 'https://www.mismo.org';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'test-signing-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = { 'perry@example.org': { name: 'Perry Williams', hash: pb(PW), platformAdmin: true, access: {}, group: 'staff' },
  'kellie@example.org': { name: 'Kellie Stoll', hash: pb(PW), access: { glossary: 'staff', 'glossary-data': 'staff', 'hub-requests': 'staff' }, group: 'staff' } };
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const T0 = Date.parse('2026-10-07T12:00:00Z'); let tick = 0;
const repo = {};   // "repo:path" -> [{ sha, data, message, author, date }] newest last
const put = (key, data, message = 'seed', author = 'Seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message, author, date: new Date(T0 + (tick++) * 60000).toISOString() }); };
const mails = []; const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
let DELAY = 0, inFlight = 0, maxInFlight = 0, ghCalls = 0;
const stub = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return { status: 202, json: async () => ({}) }; }
  if (url === 'https://api.anthropic.com/v1/messages') return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ content: [{ type: 'text', text: 'Hello' }], model: 'claude-sonnet-5-5', usage: { input_tokens: 120, output_tokens: 30 } }) };
  const cm = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/commits\?(.*)$/);
  if (cm) { const q = new URLSearchParams(cm[2]); const h = repo[cm[1] + ':' + q.get('path')] || [];
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => h.map((v, i) => ({ sha: v.sha, commit: { message: v.message, author: { name: v.author, date: v.date } }, parents: i ? [{ sha: h[i - 1].sha }] : [] })).reverse() }; }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)(?:\?ref=([^&]+))?/);
  if (!m) return { status: 404, ok: false, headers: { get: () => null }, json: async () => ({}) };
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key], ref = m[3] && decodeURIComponent(m[3]);
  if (method === 'GET') { const v = h && (ref && ref.length === 40 ? h.find(x => x.sha === ref) : h[h.length - 1]);
    return v ? { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ sha: v.sha, content: b64(v.data) }) } : { status: 404, ok: false, headers: { get: () => null }, json: async () => ({}) }; }
  if (method === 'PUT') { const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return { status: 409, ok: false, headers: { get: () => null }, json: async () => ({ message: 'conflict' }) };
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message, (body.author && body.author.name) || 'Relay');
    return { status: cur ? 200 : 201, ok: true, headers: { get: () => null }, json: async () => ({ content: { sha: repo[key][repo[key].length - 1].sha } }) }; }
  return { status: 405, ok: false, headers: { get: () => null }, json: async () => ({}) };
};
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith('https://api.github.com/')) return stub(url, opts);
  ghCalls++; inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  try { if (DELAY) await new Promise(done => setTimeout(done, DELAY)); return await stub(url, opts); } finally { inFlight--; }
};
const relay = await import(process.env.RELAY_FILE || './index.mjs'); const { handler } = relay;
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 300))); };
const J = r => JSON.parse(r.body);
const callWith = h => (m, project, path, token, body) => h({ rawPath: `/${project}${path}`, requestContext: { http: { method: m } }, headers: { origin: ORIGIN, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const call = callWith(handler);
const reset = () => relay.__resetAccessCache && relay.__resetAccessCache();
const PROJECTS = extra => ({ hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] },
  'glossary-data': { repo: 'Org/Gloss', origin: ORIGIN, writable: ['data/'], formOrigins: [SITE, 'HTTPS://WWW.MISMO.ORG', 'http://plain.example', 'https://slash.example/', 'https://path.example/x', 'https://a.example', 'https://b.example', 'https://c.example', 'https://sixth.example'] },
  'hub-requests': { repo: 'Org/Req', origin: ORIGIN, writable: ['data/'], formOrigins: [SITE] },
  'mismo-link': { repo: 'Org/Link', origin: ORIGIN, writable: ['data/'], formOrigins: [SITE] }, ...extra });
put('Org/Config:projects.json', PROJECTS());
put('Org/Accounts:access.json', { people });

const ACAO = r => r.headers && (r.headers['Access-Control-Allow-Origin'] || r.headers['access-control-allow-origin']);
const send = (project, path, origin, body, m = 'POST') => handler({ rawPath: `/${project}${path}`, requestContext: { http: { method: m, sourceIp: '198.51.100.' + (++ipN) } }, headers: { origin, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
let ipN = 0;
const term = () => ({ kind: 'new', term: 'Rate Lock Extension Fee', definition: 'A fee the borrower pays to keep a locked rate past its expiry.', why: '', sourceRef: '', name: 'Jordan Park', organization: 'Example Lending', email: 'jordan@example.com', website: '', startedAt: Date.now() - 60000 });
let r;

/* Suggest a Term from a listed website */
r = await send('glossary-data', '/suggestions/submit', SITE, term());
ok('Suggest a Term sent from a listed website (collaborate.mismo.org) is taken, and answered to that site', r.statusCode === 200 && J(r).ok === true && /^SUG-/.test(J(r).reference || '') && ACAO(r) === SITE, { s: r.statusCode, b: J(r), a: ACAO(r) });
r = await send('glossary-data', '/suggestions/submit', SITE, undefined, 'OPTIONS');
ok('...and its preflight answers that site, so the browser lets the page send', r.statusCode === 204 && ACAO(r) === SITE, { s: r.statusCode, a: ACAO(r) });
r = await send('glossary-data', '/suggestions/submit', WWW, term());
ok('a listed address is matched however it was capitalised in projects.json (www.mismo.org)', r.statusCode === 200 && ACAO(r) === WWW, { s: r.statusCode, a: ACAO(r) });
r = await send('glossary-data', '/suggestions/submit', ORIGIN, term());
ok('resources.mismo.org itself still works, as before', r.statusCode === 200 && ACAO(r) === ORIGIN);
r = await send('glossary-data', '/suggestions/submit', 'https://evil.example', term());
ok('an unlisted website: 403 ORIGIN, and the answer names resources.mismo.org, not it', r.statusCode === 403 && J(r).error === 'ORIGIN' && ACAO(r) === ORIGIN, { s: r.statusCode, a: ACAO(r) });
r = await send('glossary-data', '/suggestions/submit', 'https://evil.example', undefined, 'OPTIONS');
ok('...and its preflight doesn\u2019t name it either, so a browser won\u2019t send from there', ACAO(r) !== 'https://evil.example', ACAO(r));
for (const [o, why] of [['http://plain.example', 'not https'], ['https://slash.example', 'listed with a trailing slash'], ['https://path.example', 'listed with a path'], ['https://sixth.example', 'the sixth valid entry (five at most)']]) {
  r = await send('glossary-data', '/suggestions/submit', o, term());
  ok(`an entry that isn\u2019t valid is ignored: ${why}`, r.statusCode === 403 && J(r).error === 'ORIGIN', r.statusCode);
}
r = await send('glossary-data', '/suggestions/submit', 'https://c.example', term());
ok('...while the fifth valid entry is kept', r.statusCode === 200);

/* Submit an Idea and its files */
r = await send('hub-requests', '/ideas/submit', SITE, { title: 'x' });
ok('Submit an Idea from a listed website gets past the website check (the form\u2019s own checks still apply)', J(r).error !== 'ORIGIN' && ACAO(r) === SITE, { s: r.statusCode, b: J(r) });
r = await send('hub-requests', '/ideas/attach', SITE, { ticket: 'x' });
ok('...and so does attaching a file', J(r).error !== 'ORIGIN' && ACAO(r) === SITE, { s: r.statusCode, b: J(r) });
r = await send('hub-requests', '/ideas/submit', 'https://evil.example', { title: 'x' });
ok('an idea from an unlisted website: 403 ORIGIN', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await send('hub-requests', '/ideas/attach', 'https://evil.example', { ticket: 'x' });
ok('...and a file from one too', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await send('hub-requests', '/ideas/submit', 'https://a.example', { title: 'x' });
ok('each project lists its own: a site listed on glossary-data opens nothing on hub-requests', r.statusCode === 403 && J(r).error === 'ORIGIN');

/* nothing else answers another site */
r = await send('mismo-link', '/agreements/submit', SITE, { kind: 'subscriber' });
ok('MISMO Link\u2019s signing pages aren\u2019t a listed form, even with formOrigins on its project: 403 ORIGIN', r.statusCode === 403 && J(r).error === 'ORIGIN' && ACAO(r) !== SITE, { s: r.statusCode, b: J(r), a: ACAO(r) });
reset(); const tok = J(await handler({ rawPath: '/hub/auth/login', requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'kellie@example.org', password: PW }) })).token;
r = await handler({ rawPath: '/glossary-data/data/suggestions', requestContext: { http: { method: 'GET' } }, headers: { origin: SITE, authorization: 'Bearer ' + tok } });
ok('a signed-in route (Kellie\u2019s console reading suggestions) never answers a listed website', ACAO(r) !== SITE, ACAO(r));
r = await send('glossary-data', '/suggestions/submit', SITE, undefined, 'OPTIONS');
const pre = ACAO(r);
r = await handler({ rawPath: '/glossary-data/data/suggestions', requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: SITE } });
ok('...nor does its preflight', ACAO(r) !== SITE && pre === SITE, ACAO(r));

/* the first commit's setting name does nothing */
put('Org/Config:projects.json', PROJECTS({ 'glossary-data': { repo: 'Org/Gloss', origin: ORIGIN, writable: ['data/'], suggestOrigins: [SITE] } }));
relay.__resetProjectsCache();
r = await send('glossary-data', '/suggestions/submit', SITE, term());
ok('the old setting name, suggestOrigins, does nothing (only formOrigins counts)', r.statusCode === 403 && J(r).error === 'ORIGIN', r.statusCode);
put('Org/Config:projects.json', PROJECTS({ 'glossary-data': { repo: 'Org/Gloss', origin: ORIGIN, writable: ['data/'] } }));
relay.__resetProjectsCache();
r = await send('glossary-data', '/suggestions/submit', SITE, term());
ok('with formOrigins left out, as it ships, only resources.mismo.org works', r.statusCode === 403 && J(r).error === 'ORIGIN');

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
