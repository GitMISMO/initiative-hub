/* Relay request 11: the MMS's admin-only rules (the MMS's Claude, 8 Nov 2026; Perry, 13 Nov 2026). Run: node test-mms.mjs
 * For project mms: People and Roles, Notifications, Process and the Daily Digest change only for an MMS administrator;
 * deleting a work request too; prefs only your own; /mms/commit can't get round it. Everything else as before.
 * The stand-in GitHub is request 10's (test-r10.mjs). */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'test-signing-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = {
  'perry@example.org': { name: 'Perry Williams', hash: pb(PW), platformAdmin: true, access: {}, group: 'staff' },
  'mia@example.org':   { name: 'Mia Admin', hash: pb(PW), access: { mms: 'admin', hub: 'staff' }, group: 'staff' },
  'fred@example.org':  { name: 'Fred Facilitator', hash: pb(PW), access: { mms: 'staff', hub: 'staff' }, group: 'facilitator' },
  'val@example.org':   { name: 'Val Viewer', hash: pb(PW), access: { mms: 'view', hub: 'view' }, group: 'facilitator' } };
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
put('Org/Config:projects.json', { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] }, mms: { repo: 'Org/MMS', origin: ORIGIN, writable: ['data/'] } });
put('Org/Accounts:access.json', { people });
const CONFIG = () => ({ docs: {
  'config/people': { roles: { 'mia@example.org': 'admin', 'fred@example.org': 'facilitator' } }, 'config/notify': { from: 'workrequests@mismo.org', holdUntil: '2026-11-20' },
  'config/process': { active: 'standard' }, 'config/digest': { on: false, hour: 7 }, 'config/leaders': { list: ['A'] }, 'config/feed': { tried: null } } });
put('Org/MMS:data/config.json', CONFIG());
put('Org/MMS:data/tickets-2026.json', { docs: { 'tickets/WR-2026-001': { title: 'One', stage: 'Approved' }, 'tickets/WR-2026-002': { title: 'Two', stage: 'Drafting' } } });
put('Org/MMS:data/prefs.json', { docs: { 'prefs/fred_example.org': { off: {} }, 'prefs/mia_example.org': { off: { digest: true } } } });
put('Org/MMS:data/outbox.json', { docs: { 'outbox/m1': { to: 'x@example.org' } } });
put('Org/Hub:data/config.json', { docs: { 'config/people': { a: 1 }, 'tickets/x': { b: 2 } } });

const login = async e => { reset(); return J(await call('POST', 'hub', '/auth/login', null, { email: e, password: PW })).token; };
const T = { perry: await login('perry@example.org'), mia: await login('mia@example.org'), fred: await login('fred@example.org'), val: await login('val@example.org') };
const get = async (tok, id, project = 'mms') => J(await call('GET', project, '/data/' + id, tok));
const save = async (tok, id, change, project = 'mms') => { const cur = await get(tok, id, project); const content = JSON.parse(JSON.stringify(cur.data)); delete content.savedBy; delete content.savedAt; change(content.docs); return call('PUT', project, '/data/' + id, tok, { content, sha: cur.sha }); };
const head = id => repo['Org/MMS:data/' + id + '.json'].at(-1);
let r, before;

/* settings: only an MMS administrator */
for (const [k, label] of [['config/people', 'People and Roles'], ['config/notify', 'Notifications'], ['config/process', 'Process'], ['config/digest', 'the Daily Digest']]) {
  before = head('config').sha;
  r = await save(T.fred, 'config', d => { d[k] = { ...d[k], changed: true }; });
  ok(`a facilitator with Edit can't change ${label}: 403, nothing written`, r.statusCode === 403 && J(r).error === 'MMS_ADMIN_ONLY' && J(r).message.includes(label) && head('config').sha === before, J(r));
}
r = await save(T.fred, 'config', d => { delete d['config/digest']; });
ok('...nor take one of them out', r.statusCode === 403 && J(r).error === 'MMS_ADMIN_ONLY');
r = await save(T.fred, 'config', d => { d['config/leaders'] = { list: ['A', 'B'] }; d['config/feed'] = { tried: '2026-11-13T10:00:00Z' }; });
ok('...but the documents the page saves as people work (leaders, feed) still save for Edit', r.statusCode === 200 && head('config').data.docs['config/leaders'].list.length === 2, J(r));
r = await save(T.fred, 'config', d => { const p = d['config/people']; d['config/people'] = { roles: Object.fromEntries(Object.entries(p.roles).reverse()) }; d['config/leaders'] = { list: ['C'] }; });
ok('...and the same settings written in another order aren\u2019t taken for a change', r.statusCode === 200, J(r));
r = await save(T.mia, 'config', d => { d['config/people'].roles['new@example.org'] = 'staff'; d['config/digest'] = { on: true, hour: 8 }; });
ok('an MMS administrator (Admin on the MMS) can change People and Roles and the Daily Digest', r.statusCode === 200 && head('config').data.docs['config/digest'].on === true, J(r));
r = await save(T.perry, 'config', d => { d['config/notify'].holdUntil = '2026-11-21'; });
ok('...and so can a platform administrator', r.statusCode === 200 && head('config').data.docs['config/notify'].holdUntil === '2026-11-21', J(r));

/* a copy that's out of date is a conflict, as always, not a refusal */
const stale = await get(T.fred, 'config');
await save(T.mia, 'config', d => { d['config/process'] = { active: 'fast-track' }; });
const content = JSON.parse(JSON.stringify(stale.data)); content.docs['config/leaders'] = { list: ['D'] };
r = await call('PUT', 'mms', '/data/config', T.fred, { content, sha: stale.sha });
ok('a facilitator\u2019s save from a copy older than an administrator\u2019s change: 409 CONFLICT, so the page re-reads, not a refusal', r.statusCode === 409 && J(r).error === 'CONFLICT', J(r));
r = await save(T.fred, 'config', d => { d['config/leaders'] = { list: ['D'] }; });
ok('...re-read and re-applied, it saves, and the administrator\u2019s change stands', r.statusCode === 200 && head('config').data.docs['config/process'].active === 'fast-track', J(r));

/* work requests: deleting only for an administrator */
before = head('tickets-2026').sha;
r = await save(T.fred, 'tickets-2026', d => { delete d['tickets/WR-2026-002']; });
ok('a facilitator can\u2019t delete a work request: 403, nothing written', r.statusCode === 403 && J(r).error === 'MMS_ADMIN_ONLY' && /delete a work request/.test(J(r).message) && head('tickets-2026').sha === before, J(r));
r = await save(T.fred, 'tickets-2026', d => { d['tickets/WR-2026-001'].stage = 'Drafting'; d['tickets/WR-2026-003'] = { title: 'Three', stage: 'Approved' }; });
ok('...but can change one and add one, as before', r.statusCode === 200 && Object.keys(head('tickets-2026').data.docs).length === 3, J(r));
r = await save(T.mia, 'tickets-2026', d => { delete d['tickets/WR-2026-003']; });
ok('an administrator can delete one', r.statusCode === 200 && !head('tickets-2026').data.docs['tickets/WR-2026-003'], J(r));

/* prefs: your own only */
r = await save(T.fred, 'prefs', d => { d['prefs/fred_example.org'] = { off: { digest: true } }; });
ok('a facilitator can change their own email choices', r.statusCode === 200 && head('prefs').data.docs['prefs/fred_example.org'].off.digest === true, J(r));
before = head('prefs').sha;
r = await save(T.fred, 'prefs', d => { d['prefs/mia_example.org'] = { off: {} }; });
ok('...not someone else\u2019s: 403 MMS_OWN_PREFS, nothing written', r.statusCode === 403 && J(r).error === 'MMS_OWN_PREFS' && head('prefs').sha === before, J(r));
r = await save(T.fred, 'prefs', d => { d['prefs/someone_example.org'] = { off: { stage: true } }; });
ok('...nor add one for someone else', r.statusCode === 403 && J(r).error === 'MMS_OWN_PREFS');
r = await save(T.fred, 'prefs', d => { delete d['prefs/mia_example.org']; });
ok('...nor remove someone else\u2019s', r.statusCode === 403 && J(r).error === 'MMS_OWN_PREFS');
r = await save(T.mia, 'prefs', d => { d['prefs/fred_example.org'] = { off: {} }; });
ok('an administrator can change anyone\u2019s', r.statusCode === 200, J(r));

/* the commit route can't get round it */
r = await call('POST', 'mms', '/commit', T.fred, { message: 'x', files: [{ path: 'data/config.json', content: '{"docs":{}}' }] });
ok('/mms/commit: a facilitator can\u2019t write the settings file that way', r.statusCode === 403 && J(r).error === 'MMS_ADMIN_ONLY', J(r));
r = await call('POST', 'mms', '/commit', T.fred, { message: 'x', files: [{ path: 'data/notes.json', content: '{}' }, { path: 'data/tickets-2026.json', content: '{"docs":{}}' }] });
ok('...nor a work requests file, even alongside another file', r.statusCode === 403 && J(r).error === 'MMS_ADMIN_ONLY' && J(r).path === 'data/tickets-2026.json', J(r));
r = await call('POST', 'mms', '/commit', T.mia, { message: 'x', files: [{ path: 'data/config.json', content: '{"docs":{}}' }] });
ok('...an administrator isn\u2019t stopped by this rule', J(r).error !== 'MMS_ADMIN_ONLY', J(r));

/* everything else as before */
r = await save(T.fred, 'outbox', d => { delete d['outbox/m1']; });
ok('other MMS files are unchanged: a facilitator can still take an email out of the outbox', r.statusCode === 200, J(r));
r = await save(T.val, 'prefs', d => { d['prefs/val_example.org'] = { off: {} }; });
ok('View-only accounts still can\u2019t save at all (VIEW_ONLY)', r.statusCode === 403 && J(r).error === 'VIEW_ONLY', J(r));
r = await save(T.fred, 'config', d => { d['config/people'] = { gone: true }; delete d['tickets/x']; }, 'hub');
ok('another tool\u2019s files with the same names aren\u2019t affected', r.statusCode === 200, J(r));

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
