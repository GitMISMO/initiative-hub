/* Relay request 10, the three changes rebuilt 16 Oct 2026: Activity reads side by side, links an administrator sends
 * appear in Activity, and the Ask cap (in test-ask.mjs). Run: node test-r10.mjs
 * The stand-in GitHub is request 9's, with a delay on every call and a count of how many are under way at once, so
 * "faster" is measured rather than assumed. (Pins, request 10's first change, are checked in test-r9.mjs.) */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'test-signing-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = {
  'perry@example.org': { name: 'Perry Williams', hash: pb(PW), platformAdmin: true, access: { hub: 'admin', 'team-hq': 'admin' }, group: 'staff' },
  'jonna@example.org': { name: 'Jonna Critchley', hash: pb(PW), platformAdmin: true, access: { hub: 'admin', 'team-hq': 'admin' }, group: 'staff' },
  'amy@example.org': { name: 'Amy Moses', hash: pb(PW), access: { hub: 'staff', 'team-hq': 'staff' }, group: 'staff' },
  'ken@example.org': { name: 'Ken Kearns', hash: pb(PW), access: { hub: 'staff', 'team-hq': 'staff' }, group: 'staff' },
  'vee@example.org': { name: 'Vee Rios', hash: pb(PW), access: { 'team-hq': 'staff' }, group: 'staff' },
  'val@example.org': { name: 'Val Viewer', hash: pb(PW), access: { 'team-hq': 'view' }, group: 'staff' } };
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const T0 = Date.parse('2026-10-07T12:00:00Z'); let tick = 0;
const repo = {};   // "repo:path" -> [{ sha, data, message, author, date }] newest last
const put = (key, data, message = 'seed', author = 'Seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message, author, date: new Date(T0 + (tick++) * 60000).toISOString() }); };
put('Org/Config:projects.json', { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] },
  'team-hq': { repo: 'Org/TeamHQ', origin: ORIGIN, writable: ['data/', 'receipts/', 'attachments/'], ask: true, membersOnly: { syncs: [], syncitems: [], expenses: ['jonna@example.org', 'vee@example.org'] } } });
put('Org/Accounts:access.json', { people });
put('Org/TeamHQ:data/syncs.json', { docs: {
  's1': { title: 'Amy and Ken', members: ['amy@example.org', 'ken@example.org'] },
  's2': { title: 'VPs and President', members: ['jonna@example.org', 'ken@example.org'] },
  's3': { title: 'Amy and Vee', members: ['amy@example.org', 'vee@example.org'] } } });
put('Org/TeamHQ:data/expenses.json', { docs: { 'e1': { amount: 10, members: ['amy@example.org'] }, 'e2': { amount: 20, members: ['ken@example.org'] } } });
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
const login = async e => { reset(); return J(await call('POST', 'hub', '/auth/login', null, { email: e, password: PW })).token; };
const latest = key => repo[key][repo[key].length - 1];
const T = {}; for (const e of Object.keys(people)) T[e.split('@')[0]] = await login(e);
let r, d;

/* ---------- Activity reads side by side ---------- */
const CHANGES = 25, LV = { staff: 'Edit', view: 'View' }, expected = [];
for (let i = 0; i < CHANGES; i++) {
  const acc = JSON.parse(JSON.stringify(latest('Org/Accounts:access.json').data));
  const who = i % 2 ? 'ken@example.org' : 'vee@example.org', was = acc.people[who].access['team-hq'], now = was === 'staff' ? 'view' : 'staff';
  acc.people[who].access['team-hq'] = now;
  const message = `Update who has access (change ${i + 1}, by Jonna Critchley)`;
  put('Org/Accounts:access.json', acc, message, 'Jonna Critchley');
  expected.push({ message, person: who, before: LV[was], after: LV[now] });
}
reset(); DELAY = 40; ghCalls = 0; maxInFlight = 0;
let t0 = Date.now(); r = await call('GET', 'hub', '/activity', T.perry); const ms = Date.now() - t0; d = J(r);
const floor = ghCalls * DELAY;
ok(`Activity answers in ${ms} ms, where the same ${ghCalls} reads one after another would take at least ${floor} ms`, r.statusCode === 200 && ms < floor / 2, { ms, floor, ghCalls });
ok(`several reads are under way at once (${maxInFlight}), and never more than eight`, maxInFlight > 1 && maxInFlight <= 8, maxInFlight);
const acE = d.entries.filter(x => x.kind === 'Access' && /^Update who has access \(change /.test(x.message));
ok(`every one of the ${CHANGES} access changes is listed`, acE.length === CHANGES, acE.length);
ok('each shows the right person, before and after', expected.every(e => acE.some(x => x.message === e.message && x.by === 'Jonna Critchley' && x.changes.length === 1 && x.changes[0].person === e.person && x.changes[0].tool === 'team-hq' && x.changes[0].before === e.before && x.changes[0].after === e.after)), acE.slice(0, 2));
ok('newest first', d.entries.every((x, i) => !i || String(d.entries[i - 1].at) >= String(x.at)));
ok('still for administrators only', (await call('GET', 'hub', '/activity', T.amy)).statusCode === 403);
if (process.env.COMPARE_WITH) {   /* optional: the same history through another relay file (e.g. request 9's), same answer? */
  const other = await import(process.env.COMPARE_WITH); other.__resetAccessCache && other.__resetAccessCache();
  ghCalls = 0; t0 = Date.now(); const ro = await callWith(other.handler)('GET', 'hub', '/activity', T.perry); const msOld = Date.now() - t0;
  ok(`the same entries as ${process.env.COMPARE_WITH.split('/').pop()} (which took ${msOld} ms)`, JSON.stringify(J(ro).entries) === JSON.stringify(d.entries));
}
DELAY = 0;

/* ---------- links an administrator sends appear in Activity ---------- */
mails.length = 0;
r = await call('POST', 'hub', '/auth/admin-reset', T.perry, { email: 'amy@example.org' });
ok('an administrator sends a reset link: it still goes out by email', r.statusCode === 200 && J(r).emailed === true && mails.at(-1) && mails.at(-1).to === 'amy@example.org', J(r));
r = await call('POST', 'hub', '/auth/admin-reset', T.perry, { email: 'ken@example.org', purpose: 'invite' });
ok('...and a set-password link for a new person', r.statusCode === 200 && J(r).emailed === true && mails.at(-1).to === 'ken@example.org', J(r));
await call('POST', 'hub', '/auth/forgot', null, { email: 'vee@example.org' });
for (let i = 0; i < 5; i++) await call('POST', 'hub', '/auth/login', null, { email: 'val@example.org', password: 'not-the-right-one-1' });
r = await call('POST', 'hub', '/auth/password', T.amy, { current: PW, password: 'A-brand-new-long-pass-7' });
ok('Amy changes her own password', r.statusCode === 200, J(r));
const kenSecret = (String(mails.find(m => m.to === 'ken@example.org').text).match(/[#&]t=([A-Za-z0-9_-]+)/) || [])[1];
r = await call('POST', 'hub', '/auth/reset', null, { email: 'ken@example.org', token: kenSecret, password: 'Harbor-lantern-quietly-9' });
ok('Ken sets his password with the link Perry sent', r.statusCode === 200, J(r));
reset(); r = await call('GET', 'hub', '/activity', T.perry); d = J(r);
const sign = d.entries.filter(x => x.kind === 'Sign-in').map(x => x.message);
ok('Activity shows the reset link Perry sent Amy, naming them both', sign.includes('Reset link for amy@example.org (sent by Perry Williams)'), sign);
ok("...and the set-password link he sent Ken", sign.includes('Set-password link for ken@example.org (sent by Perry Williams)'), sign);
ok("Vee's own reset request is listed once, with no second line for its link", sign.filter(m => m.includes('vee@example.org')).length === 1 && sign.some(m => m.startsWith('Reset requested for vee@')), sign);
ok("Val's lock is listed once, with no second line for the link it emailed", sign.filter(m => m.includes('val@example.org')).length === 1 && sign.some(m => m.startsWith('Locked val@')), sign);
ok("Amy's password change is listed, once, as a sign-in event", sign.filter(m => m === 'Password changed (Amy Moses)').length === 1, sign);
ok("...and so is Ken's, set with his link", sign.filter(m => m === 'Password changed (Ken Kearns)').length === 1, sign);
ok('a password change adds no access or account line', !d.entries.some(x => (x.kind === 'Access' || x.kind === 'Account') && /^Password changed/.test(x.message)));
const secrets = mails.map(m => (String(m.text).match(/[#&]t=([A-Za-z0-9_-]+)/) || [])[1]).filter(Boolean);
const state = JSON.stringify(repo['Org/Accounts:auth-state.json']);
ok(`the links' secrets are never stored or in a commit message (${secrets.length} links checked)`, secrets.length >= 4 && secrets.every(s => !state.includes(s)), secrets.length);

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
