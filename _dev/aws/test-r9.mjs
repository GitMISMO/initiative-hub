/* Relay request 9: members-only files, break glass, View as, Activity, last sign-in. Run: node test-r9.mjs
 * A stand-in GitHub keeps every version of every file (for Activity), refuses stale writes, and lists commits by
 * path; a stand-in mail flow records what it was asked to send. */
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
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return { status: 202, json: async () => ({}) }; }
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
const relay = await import('./index.mjs'); const { handler } = relay;
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 240))); };
const J = r => JSON.parse(r.body);
const call = (m, project, path, token, body) => handler({ rawPath: `/${project}${path}`, requestContext: { http: { method: m } }, headers: { origin: ORIGIN, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
const reset = () => relay.__resetAccessCache && relay.__resetAccessCache();
const login = async e => { reset(); return J(await call('POST', 'hub', '/auth/login', null, { email: e, password: PW })).token; };
const latest = key => repo[key][repo[key].length - 1];
const T = {}; for (const e of Object.keys(people)) T[e.split('@')[0]] = await login(e);

/* ---------- members-only files ---------- */
let r = await call('GET', 'team-hq', '/data/syncs', T.amy); let d = J(r);
ok('a member sees only her spaces, with scope "members"', d.scope === 'members' && Object.keys(d.data.docs).sort().join() === 's1,s3', d);
r = await call('GET', 'team-hq', '/data/syncs', T.perry);
ok('an administrator who is not a member sees none (no override)', Object.keys(J(r).data.docs).length === 0, J(r));
r = await call('GET', 'team-hq', '/data/expenses', T.vee);
ok("someone on expenses' see-all list sees every expense", Object.keys(J(r).data.docs).length === 2);
r = await call('GET', 'team-hq', '/data/expenses', T.amy);
ok('anyone else sees only their own expenses', Object.keys(J(r).data.docs).join() === 'e1');
const amyView = J(await call('GET', 'team-hq', '/data/syncs', T.amy));
const mine = { ...amyView.data.docs, s1: { ...amyView.data.docs.s1, title: 'Amy and Ken, renamed' } }; delete mine.s3;
mine.s4 = { title: 'New, mine', members: ['amy@example.org', 'vee@example.org'] };
r = await call('PUT', 'team-hq', '/data/syncs', T.amy, { content: { docs: mine }, sha: amyView.sha });
let stored = latest('Org/TeamHQ:data/syncs.json').data.docs;
ok('a member saves: her change kept, her omission deleted, her new space added, the VP space untouched', r.statusCode === 200 && stored.s1.title === 'Amy and Ken, renamed' && !stored.s3 && stored.s4 && stored.s2.title === 'VPs and President', { s: r.statusCode, ids: Object.keys(stored) });
r = await call('PUT', 'team-hq', '/data/syncs', T.amy, { content: { docs: { s2: { title: 'hijack', members: ['amy@example.org', 'jonna@example.org', 'ken@example.org'] } } } });
ok("she can't change a space she isn't in", r.statusCode === 403 && J(r).error === 'NOT_A_MEMBER', J(r));
r = await call('PUT', 'team-hq', '/data/syncs', T.amy, { content: { docs: { s5: { title: 'not mine', members: ['ken@example.org'] } } } });
ok("a new space has to include her", r.statusCode === 403 && J(r).error === 'NOT_A_MEMBER');
r = await call('PUT', 'team-hq', '/data/syncs', T.amy, { content: { docs: { s1: { title: 'x', members: ['amy@example.org'] }, s4: stored.s4 } } });
ok("she can't take someone else off a space", r.statusCode === 403 && J(r).error === 'MEMBERS_REMOVED');
r = await call('PUT', 'team-hq', '/data/syncs', T.amy, { content: { docs: { s1: { ...stored.s1, members: ['ken@example.org'] }, s4: stored.s4 } } });
stored = latest('Org/TeamHQ:data/syncs.json').data.docs;
ok('she can take herself off a space, which stays for the others', r.statusCode === 200 && stored.s1 && stored.s1.members.join() === 'ken@example.org');
const veeView = J(await call('GET', 'team-hq', '/data/expenses', T.vee));
r = await call('PUT', 'team-hq', '/data/expenses', T.vee, { content: { docs: veeView.data.docs }, sha: 'stale'.padEnd(40, '0') });
ok('a see-all save with an old version is refused (409)', r.statusCode === 409);
r = await call('PUT', 'team-hq', '/data/expenses', T.vee, { content: { docs: { ...veeView.data.docs, e3: { amount: 5, members: ['ken@example.org'] } } }, sha: veeView.sha });
ok('a see-all save with the version she read writes the whole file', r.statusCode === 200 && Object.keys(latest('Org/TeamHQ:data/expenses.json').data.docs).length === 3);
r = await call('PUT', 'team-hq', '/data/syncs', T.val, { content: { docs: {} } });
ok('a View account still cannot save', r.statusCode === 403 && J(r).error === 'VIEW_ONLY');
r = await call('GET', 'team-hq', '/file/' + encodeURIComponent('data/syncs.json'), T.amy);
ok('/file refuses a members-only file', r.statusCode === 403 && J(r).error === 'MEMBERS_ONLY');
r = await call('POST', 'team-hq', '/commit', T.amy, { message: 'x', files: [{ path: 'data/syncs.json', content: b64({}) }] });
ok('/commit refuses a members-only file', r.statusCode === 403 && J(r).error === 'MEMBERS_ONLY');
r = await call('POST', 'team-hq', '/commit', T.amy, { message: 'receipt', files: [{ path: 'receipts/r1.json', content: Buffer.from('{}').toString('base64') }] });
ok('/commit is not refused for a receipt (the members-only guard lets it through)', J(r).error !== 'MEMBERS_ONLY', J(r));   /* the stand-in GitHub has no Git Data API, so the write itself isn't exercised here */

/* ---------- break glass ---------- */
mails.length = 0;
r = await call('POST', 'hub', '/breakglass', T.amy, { project: 'team-hq', person: 'ken@example.org', reason: 'x' });
ok('only an administrator can ask', r.statusCode === 403 && J(r).error === 'NOT_PLATFORM_ADMIN');
r = await call('POST', 'hub', '/breakglass', T.perry, { project: 'team-hq', person: 'ken@example.org', reason: '' });
ok('a reason is required', r.statusCode === 400 && J(r).error === 'NO_REASON');
r = await call('POST', 'hub', '/breakglass', T.perry, { project: 'team-hq', person: 'ken@example.org', reason: 'Annual review prep' });
const q = J(r).request;
ok("Perry asks to open Ken's items: pending, all of Team HQ's members-only files", r.statusCode === 200 && q.status === 'pending' && q.files.join() === 'syncs,syncitems,expenses', J(r));
ok('the other administrator is emailed, with the reason and where to decide', mails.length === 1 && mails[0].to === 'jonna@example.org' && /Annual review prep/.test(mails[0].text) && /admin\.html#requests/.test(mails[0].text), mails);
r = await call('GET', 'team-hq', '/data/syncs', T.perry);
ok('nothing opens before a decision', Object.keys(J(r).data.docs).length === 0);
r = await call('POST', 'hub', `/breakglass/${q.id}`, T.perry, { decision: 'approve' });
ok("Perry can't approve his own request", r.statusCode === 403 && J(r).error === 'OWN_REQUEST');
mails.length = 0;
r = await call('POST', 'hub', `/breakglass/${q.id}`, T.jonna, { decision: 'approve' });
const a = J(r).request;
ok('Jonna approves: for 24 hours, and Perry is told', r.statusCode === 200 && a.status === 'approved' && Math.abs(Date.parse(a.expiresAt) - Date.now() - 24 * 3600e3) < 60e3 && mails.length === 1 && mails[0].to === 'perry@example.org');
ok("Ken (the member) is not told", !mails.some(x => x.to === 'ken@example.org'));
r = await call('POST', 'hub', `/breakglass/${q.id}`, T.jonna, { decision: 'decline' });
ok('a decided request can\u2019t be decided again', r.statusCode === 409 && J(r).error === 'ALREADY_DECIDED');
r = await call('GET', 'team-hq', '/data/syncs', T.perry); d = J(r);
ok("Perry now reads Ken's spaces, marked read-only", Object.keys(d.data.docs).sort().join() === 's1,s2' && (d.readOnly || []).sort().join() === 's1,s2', d);
ok('the opening is recorded', (latest('Org/Accounts:break-glass.json').data.requests[0].opened || []).length === 1);
r = await call('PUT', 'team-hq', '/data/syncs', T.perry, { content: { docs: { s2: { title: 'changed', members: ['jonna@example.org', 'ken@example.org'] } } } });
ok("break glass can't change anything", r.statusCode === 403 && J(r).error === 'NOT_A_MEMBER');
{ const f = latest('Org/Accounts:break-glass.json'); const data = JSON.parse(JSON.stringify(f.data)); data.requests[0].expiresAt = new Date(Date.now() - 1000).toISOString(); put('Org/Accounts:break-glass.json', data); }
r = await call('GET', 'team-hq', '/data/syncs', T.perry);
ok('after 24 hours it closes again', Object.keys(J(r).data.docs).length === 0);
r = await call('POST', 'hub', '/breakglass', T.jonna, { project: 'team-hq', person: 'amy@example.org', reason: 'Old one' });
{ const f = latest('Org/Accounts:break-glass.json'); const data = JSON.parse(JSON.stringify(f.data)); data.requests[0].at = new Date(Date.now() - 4 * 24 * 3600e3).toISOString(); put('Org/Accounts:break-glass.json', data); }
const old = J(r).request.id;
r = await call('POST', 'hub', `/breakglass/${old}`, T.perry, { decision: 'approve' });
ok('a request nobody answered for 3 days lapses', r.statusCode === 409 && J(r).error === 'LAPSED');
r = await call('GET', 'hub', '/breakglass', T.perry); d = J(r);
ok('the list shows each request with its state', r.statusCode === 200 && d.requests.find(x => x.id === old).status === 'lapsed' && d.requests.find(x => x.id === q.id).status === 'ended', d.requests.map(x => [x.id, x.status]));

/* ---------- View as ---------- */
r = await call('POST', 'hub', '/auth/view-as', T.amy, { email: 'ken@example.org' });
ok('only an administrator can View as', r.statusCode === 403 && J(r).error === 'NOT_PLATFORM_ADMIN');
r = await call('POST', 'hub', '/auth/view-as', T.perry, { email: 'jonna@example.org' });
ok('never as another administrator', r.statusCode === 403 && J(r).error === 'VIEW_AS_ADMIN');
r = await call('POST', 'hub', '/auth/view-as', T.perry, { email: 'amy@example.org' }); d = J(r);
const VA = d.token;
ok("Perry views as Amy: her access, for 30 minutes", r.statusCode === 200 && d.email === 'amy@example.org' && d.access['team-hq'] && d.viewAs.by === 'perry@example.org' && Math.abs(Date.parse(d.viewAs.until) - Date.now() - 1800e3) < 60e3, d);
ok('the use is recorded', (latest('Org/Accounts:access-log.json').data.entries[0] || {}).as === 'amy@example.org');
r = await call('GET', 'hub', '/auth/me', VA);
ok('/auth/me says who is viewing', J(r).email === 'amy@example.org' && J(r).viewAs && J(r).viewAs.by === 'perry@example.org');
r = await call('GET', 'team-hq', '/data/syncs', VA);
ok("members-only items stay hidden while viewing as her", J(r).hidden === true && Object.keys(J(r).data.docs).length === 0);
r = await call('PUT', 'hub', '/data/somefile', VA, { content: {}, sha: null });
ok('every save is refused, as View (with viewAs)', r.statusCode === 403 && J(r).error === 'VIEW_ONLY' && J(r).viewAs === true);
r = await call('POST', 'hub', '/auth/password', VA, { current: PW, password: 'Another-Long-Pass-77' });
ok("her password can't be changed", r.statusCode === 403 && J(r).error === 'VIEW_AS_READ_ONLY');
r = await call('POST', 'hub', '/auth/view-as', VA, { email: 'ken@example.org' });
ok("View as can't start another View as", r.statusCode === 403);
r = await call('POST', 'hub', '/breakglass', VA, { project: 'team-hq', person: 'ken@example.org', reason: 'x' });
ok('nor ask for break glass', r.statusCode === 403);

/* ---------- Activity ---------- */
{ const acc = JSON.parse(JSON.stringify(latest('Org/Accounts:access.json').data)); acc.people['ken@example.org'].access['team-hq'] = 'view'; put('Org/Accounts:access.json', acc, 'Update who has access (by Jonna Critchley)', 'Jonna Critchley'); }
reset();
r = await call('GET', 'hub', '/activity', T.amy);
ok('Activity is for administrators', r.statusCode === 403);
r = await call('GET', 'hub', '/activity', T.perry); d = J(r);
const accE = d.entries.find(x => x.kind === 'Access');
ok("an access change shows who, what and before/after", accE && accE.by === 'Jonna Critchley' && accE.changes.some(c => c.person === 'ken@example.org' && c.tool === 'team-hq' && c.before === 'Edit' && c.after === 'View'), accE);
ok('View as and break glass appear too', d.entries.some(x => x.kind === 'View as' && x.as === 'amy@example.org') && d.entries.some(x => x.kind === 'Break glass' && x.event === 'approved') && d.entries.some(x => x.kind === 'Break glass' && x.event === 'opened'));
ok('newest first', d.entries.every((x, i) => !i || String(d.entries[i - 1].at) >= String(x.at)));

/* ---------- last sign-in ---------- */
const st = () => (latest('Org/Accounts:auth-state.json').data.accounts || {});
ok('signing in records the time', !!(st()['ken@example.org'] || {}).lastSignInAt);
const writesBefore = repo['Org/Accounts:auth-state.json'].length;
await login('ken@example.org');
ok('signing in again within the hour writes nothing', repo['Org/Accounts:auth-state.json'].length === writesBefore);
r = await call('GET', 'hub', '/access', T.perry);
ok('People & Access receives each last sign-in', !!(J(r).auth && J(r).auth['ken@example.org'] && J(r).auth['ken@example.org'].lastSignInAt), J(r).auth && J(r).auth['ken@example.org']);
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
