/* Relay request 11: two-step sign-in by emailed code (Perry, 16 Oct 2026). Run: node test-r11.mjs
 * Request 9's stand-in GitHub and mail flow; the clock is moved forward where a check needs time to pass. */
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
const setCodes = mode => put('Org/Accounts:sign-in.json', { codes: mode }, `Sign-in codes: ${mode}`, 'Perry Williams');
const signIn = (email, extra = {}, pw = PW) => call('POST', 'hub', '/auth/login', null, { email, password: pw, ...extra });
const codeFor = to => { const m = [...mails].reverse().find(x => x.to === to && x.kind === 'code'); return m && (String(m.text).match(/ is (\d{6})\./) || [])[1]; };
const enter = (ticket, code) => call('POST', 'hub', '/auth/code', null, { ticket, code });
const stateOf = e => { const h = repo['Org/Accounts:auth-state.json']; return (h && h[h.length - 1].data.accounts[e]) || {}; };
const clearSends = e => { const h = repo['Org/Accounts:auth-state.json'], a = JSON.parse(JSON.stringify(h[h.length - 1].data)); if (a.accounts[e]) delete a.accounts[e].codeSends; put('Org/Accounts:auth-state.json', a, 'test: forget code sends'); };
const later = async (ms, fn) => { const real = Date.now; Date.now = () => real() + ms; try { return await fn(); } finally { Date.now = real; } };
const DAY = 864e5;

/* ---------- off unless switched on ---------- */
r = await signIn('perry@example.org'); d = J(r);
ok('with no sign-in.json, the password alone signs in, as today', r.statusCode === 200 && d.token && !d.codeRequired, d);

/* ---------- administrators first ---------- */
setCodes('admins'); reset();
r = await signIn('amy@example.org'); d = J(r);
ok('"admins": someone who is not a platform administrator signs in with the password alone', r.statusCode === 200 && d.token && !d.codeRequired, d);
mails.length = 0;
r = await signIn('perry@example.org'); d = J(r);
ok('"admins": Perry is asked for a code instead of being signed in', r.statusCode === 200 && d.codeRequired === true && typeof d.ticket === 'string' && !d.token, d);
ok('...an older sign-in page would show a message that says what to do', /Reload this page/.test(d.message || ''), d.message);
const code1 = codeFor('perry@example.org'), mail1 = mails.at(-1);
ok('a six-digit code is emailed to him, in the subject and the body', /^\d{6}$/.test(code1 || '') && mail1.subject.startsWith(code1) && /10 minutes/.test(mail1.text), mail1 && mail1.subject);
const sc = stateOf('perry@example.org').code;
ok('only a fingerprint of the code is kept, and no commit message holds it', sc && Object.keys(sc).sort().join() === 'expires,h,n' && !JSON.stringify(sc).includes(code1) && repo['Org/Accounts:auth-state.json'].every(v => !String(v.message).includes(code1)), sc);
const ticket1 = d.ticket;
ok('the ticket is not a session: it opens nothing', (await call('GET', 'hub', '/activity', ticket1)).statusCode === 401);
const wrong = code1 === '000000' ? '111111' : '000000';
r = await enter(ticket1, wrong); d = J(r);
ok('a wrong code is refused, warning that one more locks the account', r.statusCode === 400 && d.error === 'WRONG_CODE' && d.remaining === 1 && /1 more wrong code locks/.test(d.message), d);
r = await enter(ticket1, code1); d = J(r);
ok('the right code signs him in, and remembers this browser', r.statusCode === 200 && d.token && typeof d.device === 'string' && d.platformAdmin === true, d);
const perryDevice = d.device, perrySession = d.token;
ok('...and that session works', (await call('GET', 'hub', '/activity', perrySession)).statusCode === 200);
ok('the remembered-browser token is not a session', (await call('GET', 'hub', '/activity', perryDevice)).statusCode === 401);
ok('the right code also cleared the wrong guess', !stateOf('perry@example.org').codeFailed && !stateOf('perry@example.org').code, stateOf('perry@example.org'));
r = await enter(ticket1, code1);
ok('a code works once', r.statusCode === 400 && J(r).error === 'CODE_EXPIRED', J(r));

/* ---------- a remembered browser ---------- */
mails.length = 0;
r = await signIn('perry@example.org', { device: perryDevice }); d = J(r);
ok('from the remembered browser, the password alone signs in, and no email is sent', r.statusCode === 200 && d.token && !d.codeRequired && mails.length === 0, d);
r = await signIn('perry@example.org', { device: perrySession }); d = J(r);
ok('a session token is not a remembered browser', d.codeRequired === true, d);
clearSends('perry@example.org');
r = await signIn('jonna@example.org', { device: perryDevice }); d = J(r);
ok("Perry's remembered browser does not excuse Jonna", d.codeRequired === true, d);
r = await later(29 * DAY, () => signIn('perry@example.org', { device: perryDevice })); d = J(r);
ok('29 days later, still remembered', r.statusCode === 200 && d.token && !d.codeRequired, d);
r = await later(31 * DAY, () => signIn('perry@example.org', { device: perryDevice })); d = J(r);
ok('31 days later, a code again', d.codeRequired === true, d);
clearSends('perry@example.org');

/* ---------- codes run out, and are replaced ---------- */
r = await signIn('perry@example.org'); const tA = J(r).ticket, cA = codeFor('perry@example.org');
r = await later(11 * 60_000, () => enter(tA, cA));
ok('a code stops working after 10 minutes', r.statusCode === 400 && J(r).error === 'CODE_EXPIRED', J(r));
r = await signIn('perry@example.org'); const tB = J(r).ticket, cB = codeFor('perry@example.org');
r = await signIn('perry@example.org'); const tC = J(r).ticket, cC = codeFor('perry@example.org');
r = await enter(tB, cB);
ok('asking again replaces the last code', r.statusCode === 400 && J(r).error === 'CODE_EXPIRED', J(r));
r = await enter(tB, cC);
ok("...and the new code can't be used with the old ticket", r.statusCode === 400 && J(r).error === 'CODE_EXPIRED', J(r));
r = await signIn('perry@example.org'); d = J(r);
ok('no more than three codes in 15 minutes', r.statusCode === 429 && d.error === 'TOO_MANY_CODES' && !d.token, d);
r = await enter(tC, cC);
ok('...the newest one still works', r.statusCode === 200 && J(r).token, J(r));
clearSends('perry@example.org');

/* ---------- guessing: two wrong codes lock, and every other administrator is told ---------- */
clearSends('jonna@example.org'); reset();
r = await signIn('jonna@example.org'); let tJ = J(r).ticket; const cJ1 = codeFor('jonna@example.org'), w = cJ1 === '000000' ? '111111' : '000000';
r = await enter(tJ, w); ok('first wrong code: refused, one more locks', r.statusCode === 400 && J(r).remaining === 1, J(r));
r = await signIn('jonna@example.org'); d = J(r);
ok('the right password again does not clear the wrong code: it only sends a new one', d.codeRequired === true && stateOf('jonna@example.org').codeFailed === 1, stateOf('jonna@example.org'));
tJ = d.ticket;
r = await enter(tJ, cJ1);
ok("typing the earlier email's code is recognised and not counted", r.statusCode === 400 && J(r).error === 'OLD_CODE' && /newest email/.test(J(r).message) && stateOf('jonna@example.org').codeFailed === 1, J(r));
mails.length = 0;
r = await enter(tJ, w);
ok('the second wrong code locks the account', r.statusCode === 423 && J(r).error === 'LOCKED' && /2 incorrect sign-in codes/.test(J(r).message), J(r));
const lockMail = mails.find(m => m.to === 'jonna@example.org' && m.kind === 'codeLocked');
ok('...emails her a reset link, saying why', !!lockMail && /2 incorrect sign-in codes/.test(lockMail.text) && /[#&]t=/.test(lockMail.text), mails.map(m => m.kind + ' ' + m.to));
const alerts = mails.filter(m => m.kind === 'code-lock-alert');
ok('...and emails every other platform administrator (Perry), not her and not anyone else', alerts.length === 1 && alerts[0].to === 'perry@example.org' && alerts[0].subject.includes('Jonna Critchley') && /may mean someone else knows their password/.test(alerts[0].text), alerts.map(m => m.to));
ok('wrong passwords still have their own count of five', stateOf('jonna@example.org').failed === undefined || stateOf('jonna@example.org').failed === 0, stateOf('jonna@example.org'));
r = await signIn('jonna@example.org'); ok('locked means locked, even with the right password', r.statusCode === 423, J(r));
r = await enter(tJ, codeFor('jonna@example.org'));
ok('...and no code works either', r.statusCode !== 200, J(r));
reset(); d = J(await call('GET', 'hub', '/activity', perrySession));
ok('Activity lists the lock, and why', d.entries.some(x => x.kind === 'Sign-in' && x.message === 'Locked jonna@example.org after 2 incorrect sign-in codes'), d.entries.filter(x => x.kind === 'Sign-in').map(x => x.message));
d = J(await call('GET', 'hub', '/access', perrySession));
ok('the console is told the account is locked by codes, and that codes are on for administrators', d.auth && d.auth['jonna@example.org'] && d.auth['jonna@example.org'].locked === true && d.auth['jonna@example.org'].lockedBy === 'codes' && d.codes === 'admins', { auth: d.auth && d.auth['jonna@example.org'], codes: d.codes });

/* ---------- a reset link proves the email ---------- */
const secret = (String(lockMail.text).match(/[#&]t=([A-Za-z0-9_-]+)/) || [])[1];
r = await call('POST', 'hub', '/auth/reset', null, { email: 'jonna@example.org', token: secret, password: 'Harbor-lantern-quietly-9' }); d = J(r);
ok('signing in through the reset link remembers that browser', r.statusCode === 200 && d.token && typeof d.device === 'string', d);
const js = stateOf('jonna@example.org');
ok('...and clears the lock completely', !js.lockedAt && !js.lockReason && !js.codeFailed && !js.code && !js.prevCode, js);
reset(); r = await signIn('jonna@example.org', { device: d.device }, 'Harbor-lantern-quietly-9');
ok('...so her next sign-in there needs no code', r.statusCode === 200 && J(r).token && !J(r).codeRequired, J(r));

/* ---------- a password change forgets other browsers ---------- */
reset(); clearSends('perry@example.org');
const fresh = J(await signIn('perry@example.org', { device: perryDevice })).token;
r = await call('POST', 'hub', '/auth/password', fresh, { current: PW, password: 'Copper-meadow-sunrise-4' }); d = J(r);
ok('a password change keeps the browser it was made in', r.statusCode === 200 && typeof d.device === 'string', d);
reset(); r = await signIn('perry@example.org', { device: perryDevice }, 'Copper-meadow-sunrise-4');
ok('...and forgets every other one', J(r).codeRequired === true, J(r));
r = await signIn('perry@example.org', { device: d.device }, 'Copper-meadow-sunrise-4');
ok('...while the one it was made in stays remembered', r.statusCode === 200 && J(r).token, J(r));

/* ---------- everyone, email trouble, and off again ---------- */
setCodes('everyone'); reset();
r = await signIn('amy@example.org'); ok('"everyone": Amy is asked for a code too', J(r).codeRequired === true, J(r));
const flow = process.env.MAIL_FLOW_URL; process.env.MAIL_FLOW_URL = 'https://flow.example/broken';
r = await signIn('ken@example.org'); d = J(r);
ok("if the code can't be emailed, sign-in says so and lets no one in", r.statusCode === 502 && d.error === 'CODE_NOT_SENT' && !d.token && /Try again/.test(d.message), d);
process.env.MAIL_FLOW_URL = flow;
r = await signIn('vee@example.org'); ok('wrong password with codes on: no code is sent, the usual refusal', r.statusCode === 401 || J(await signIn('vee@example.org', {}, 'not-it-at-all-77')).error === 'SIGNIN_FAILED');
mails.length = 0; r = await signIn('vee@example.org', {}, 'not-it-at-all-77');
ok('...and no email goes out for a wrong password', r.statusCode === 401 && mails.length === 0, { s: r.statusCode, mails: mails.length });
setCodes('off'); reset(); clearSends('amy@example.org');
r = await signIn('amy@example.org'); ok('"off": the password alone again', r.statusCode === 200 && J(r).token && !J(r).codeRequired, J(r));

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
