/* Self-service passwords (relay request 8). Run: node test-passwords.mjs
 * A stand-in GitHub holds a public config repository and a private accounts repository, with
 * real versions (sha) so stale writes are refused; a stand-in Have I Been Pwned and a stand-in
 * Power Automate flow record what they were asked. */
import { createHash, pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
process.env.GITHUB_TOKEN = 'ghp_test';
process.env.AUTH_SECRET = 'test-signing-secret';
process.env.PROJECTS = JSON.stringify({ hub: { repo: 'Org/Hub', branch: 'main', origin: 'https://resources.example', writable: ['data/'] } });
const pb = (pw, salt = 'aa'.repeat(16)) => `pbkdf2$1000$${salt}$${pbkdf2Sync(pw, Buffer.from(salt, 'hex'), 1000, 32, 'sha256').toString('hex')}`;
const PERRY_PW = 'Original-Perry-Pass-1', JANE_PW = 'Original-Jane-Pass-22';
const files = {   // "repo:path" -> { data, sha }
  'Org/Config:projects.json': { sha: 'p1'.padEnd(40, '0'), data: { hub: { repo: 'Org/Hub', branch: 'main', origin: ORIGIN, writable: ['data/'] } } },
  'Org/Config:_internal/access.json': { sha: 'c1'.padEnd(40, '0'), data: { people: {
    'perry@example.org': { name: 'Perry Williams', hash: pb(PERRY_PW), access: { hub: 'admin' }, platformAdmin: true, group: 'staff' },
    'jane@example.org':  { name: 'Jane Stoll', hash: pb(JANE_PW), access: { hub: 'staff' }, group: 'contractor' } } } },
};
let shaN = 100; const nextSha = () => (shaN++).toString(16).padEnd(40, 'a');
const writes = [], mails = [], pwned = new Set();
let hibpDown = false, mailDown = false;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url.startsWith('https://api.pwnedpasswords.com/range/')) {
    if (hibpDown) throw new Error('down');
    const pre = url.slice(-5);
    const lines = [...pwned].map(p => createHash('sha1').update(p).digest('hex').toUpperCase()).filter(h => h.startsWith(pre)).map(h => h.slice(5) + ':42');
    return { status: 200, text: async () => lines.concat(['0000000000000000000000000000000000A:1']).join('\r\n') };
  }
  if (url === 'https://flow.example/mail') {
    if (mailDown) return { status: 500, json: async () => ({}) };
    mails.push(JSON.parse(opts.body)); return { status: 202, json: async () => ({}) };
  }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return { status: 404, json: async () => ({}) };
  const key = m[1] + ':' + decodeURIComponent(m[2]);
  if (method === 'GET') { const f = files[key]; return f ? { status: 200, json: async () => ({ sha: f.sha, content: b64(f.data) }) } : { status: 404, json: async () => ({}) }; }
  if (method === 'PUT') {
    const body = JSON.parse(opts.body), f = files[key];
    if (f && body.sha !== f.sha) return { status: 409, json: async () => ({ message: 'conflict' }) };
    if (!f && body.sha) return { status: 409, json: async () => ({ message: 'conflict' }) };
    const data = JSON.parse(Buffer.from(body.content, 'base64').toString());
    files[key] = { sha: nextSha(), data }; writes.push({ key, message: body.message });
    return { status: f ? 200 : 201, json: async () => ({ content: { sha: files[key].sha } }) };
  }
  return { status: 405, json: async () => ({}) };
};
const relay = await import('./index.mjs');
const { handler } = relay;
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const J = r => JSON.parse(r.body);
const post = (path, body, token) => handler({ rawPath: '/hub' + path, requestContext: { http: { method: 'POST' } },
  headers: { origin: ORIGIN, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
const get = (path, token) => handler({ rawPath: '/hub' + path, requestContext: { http: { method: 'GET' } }, headers: { origin: ORIGIN, ...(token ? { authorization: 'Bearer ' + token } : {}) } });
const login = (email, password) => post('/auth/login', { email, password });
const reset = () => { relay.__resetAccessCache(); relay.__resetUnknownTries(); };
const state = () => (files['Org/Accounts:auth-state.json'] || { data: { accounts: {} } }).data.accounts;
const linkSecret = mail => decodeURIComponent((mail.text.match(/#e=[^&]+&t=([A-Za-z0-9_-]+)/) || [])[1] || '');

/* ── off until DIRECTORY_REPO is set: sign-in exactly as before ── */
process.env.PROJECTS_REPO = 'Org/Config';
reset();
let r = await login('perry@example.org', 'wrong');
ok('off: a wrong password is the old plain refusal (no countdown)', r.statusCode === 401 && J(r).error === 'SIGNIN_FAILED' && J(r).remaining === undefined);
r = await login('perry@example.org', PERRY_PW);
ok('off: the right password signs in', r.statusCode === 200 && J(r).token);
r = await post('/auth/forgot', { email: 'perry@example.org' });
ok('off: the password routes say they are not switched on', r.statusCode === 503 && J(r).error === 'PASSWORDS_OFF');
ok('off: nothing was written', writes.length === 0);

/* ── on: the list is still in the public file; the private repository is empty ── */
process.env.DIRECTORY_REPO = 'Org/Accounts';
process.env.MAIL_FLOW_URL = 'https://flow.example/mail'; process.env.MAIL_FLOW_SECRET = 'flow-secret';
reset();
r = await login('perry@example.org', PERRY_PW);
ok('moving: until the private copy exists, the public list is read', r.statusCode === 200);
const perryToken = J(r).token;
r = await get('/access', perryToken);
ok('moving: GET /access reads it too, with no sha, and says auth is on', r.statusCode === 200 && J(r).sha === null && J(r).fields.includes('auth'));
let people = J(r).people;
r = await handler({ rawPath: '/hub/access', requestContext: { http: { method: 'PUT' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + perryToken }, body: JSON.stringify({ people, sha: null }) });
ok('moving: the first admin save creates access.json in the private repository', r.statusCode === 200 && files['Org/Accounts:access.json'] && files['Org/Accounts:access.json'].data.people['jane@example.org']);
ok('moving: the public file was not written', !writes.some(w => w.key === 'Org/Config:_internal/access.json'));
reset();
r = await get('/access', perryToken);
ok('moved: now read from the private repository, with its sha', r.statusCode === 200 && J(r).sha === files['Org/Accounts:access.json'].sha);

/* ── wrong guesses: a countdown, then a lock that the right password doesn't open ── */
reset();
const rem = [];
for (let i = 0; i < 4; i++) { r = await login('jane@example.org', 'not-it-' + i); rem.push(J(r).remaining); }
ok('four wrong guesses count down 4, 3, 2, 1', rem.join() === '4,3,2,1' && r.statusCode === 401);
ok('the warning says how many are left', /1 try left/.test(J(r).message));
r = await login('jane@example.org', 'not-it-again');
ok('the fifth locks the account (423 LOCKED)', r.statusCode === 423 && J(r).error === 'LOCKED');
ok('the lock is recorded', !!state()['jane@example.org'].lockedAt);
const lockMail = mails.at(-1);
ok('a lockout email with a reset link goes to her', lockMail && lockMail.kind === 'locked' && lockMail.to === 'jane@example.org' && linkSecret(lockMail).length > 20 && lockMail.secret === 'flow-secret');
ok('the link is stored only as a hash', state()['jane@example.org'].reset.hash.length === 64 && !JSON.stringify(state()).includes(linkSecret(lockMail)));
r = await login('jane@example.org', JANE_PW);
ok('locked: even the right password is refused', r.statusCode === 423);

/* ── unknown emails look the same, and write nothing ── */
const before = writes.length; const urem = [];
for (let i = 0; i < 4; i++) { r = await login('nobody@example.org', 'x' + i); urem.push(J(r).remaining); }
r = await login('nobody@example.org', 'x5');
ok('an email with no account counts down and locks the same way', urem.join() === '4,3,2,1' && r.statusCode === 423);
ok('...without writing anything or sending mail', writes.length === before && mails.at(-1) === lockMail);

/* ── forgot: the same answer for anyone; a link for real accounts; three an hour ── */
r = await post('/auth/forgot', { email: 'nobody@example.org' });
const r2 = await post('/auth/forgot', { email: 'perry@example.org' });
ok('forgot: identical answers for an account and a non-account', r.statusCode === 200 && r2.statusCode === 200 && r.body === r2.body);
const perryMail = mails.at(-1);
ok('forgot: Perry gets a reset email; nobody@ gets nothing', perryMail.kind === 'reset' && perryMail.to === 'perry@example.org');
await post('/auth/forgot', { email: 'perry@example.org' }); await post('/auth/forgot', { email: 'perry@example.org' });
const n = mails.length; await post('/auth/forgot', { email: 'perry@example.org' });
ok('forgot: a fourth request within the hour sends nothing', mails.length === n);
const perrySecret = linkSecret(mails.at(-1));

/* ── reset: the rules, the link used once, the lock lifted ── */
const janeSecret = linkSecret(lockMail);
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: 'Short-pass12' });
ok('reset: 12 characters is refused (13 needed)', r.statusCode === 400 && J(r).error === 'WEAK_PASSWORD' && J(r).problems[0].includes('13'));
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: 'jane-and-her-dog-2' });
ok('reset: a password containing her name is refused', r.statusCode === 400 && J(r).problems.some(p => /name/.test(p)));
pwned.add('correct horse battery staple');
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: 'correct horse battery staple' });
ok('reset: a breached password is refused (via the range lookup)', r.statusCode === 400 && J(r).problems.some(p => /breach/.test(p)));
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: JANE_PW });
ok('reset: her current password is refused', r.statusCode === 400 && J(r).problems.some(p => /haven/.test(p)));
r = await post('/auth/reset', { email: 'jane@example.org', token: 'x'.repeat(43), password: 'copper lantern river' });
ok('reset: a wrong link is refused', r.statusCode === 400 && J(r).error === 'BAD_LINK');
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: 'copper lantern river' });
ok('reset: 13+ characters, not breached, signs her straight in', r.statusCode === 200 && J(r).token && J(r).email === 'jane@example.org');
const janeNewToken = J(r).token;
reset();
const janeEntry = files['Org/Accounts:access.json'].data.people['jane@example.org'];
ok('reset: the new hash is saved, with the date', janeEntry.hash !== pb(JANE_PW) && !!janeEntry.passwordChangedAt);
ok('reset: lock, count and link are cleared; the old hash goes into history', !state()['jane@example.org'].lockedAt && !state()['jane@example.org'].failed && !state()['jane@example.org'].reset && state()['jane@example.org'].history.length === 1);
ok('reset: a "password changed" email goes to her', mails.at(-1).kind === 'changed' && mails.at(-1).to === 'jane@example.org');
r = await post('/auth/reset', { email: 'jane@example.org', token: janeSecret, password: 'another lantern river' });
ok('reset: the link works only once', r.statusCode === 400 && J(r).error === 'BAD_LINK');
r = await login('jane@example.org', 'copper lantern river');
ok('she signs in with the new password', r.statusCode === 200);

/* ── changing it while signed in; sessions from before a change end ── */
r = await post('/auth/password', { current: 'wrong', password: 'brand new river lantern' }, janeNewToken);
ok('change: a wrong current password is refused', r.statusCode === 400 && J(r).error === 'WRONG_PASSWORD');
r = await post('/auth/password', { current: 'copper lantern river', password: JANE_PW }, janeNewToken);
ok('change: an earlier password (from history) is refused', r.statusCode === 400 && J(r).problems.some(p => /haven/.test(p)));
await new Promise(res => setTimeout(res, 2500));   // a real gap: the relay allows a second for clock differences
r = await post('/auth/password', { current: 'copper lantern river', password: 'brand new river lantern' }, janeNewToken);
ok('change: a good one is accepted, with a fresh token', r.statusCode === 200 && J(r).token && J(r).token !== janeNewToken);
const janeFresh = J(r).token;
reset();
r = await get('/data/mcd', janeNewToken);
ok('a session from before the change is ended (TOKEN_STALE)', r.statusCode === 401 && J(r).error === 'TOKEN_STALE');
r = await get('/data/mcd', janeFresh);
ok('...the session that made the change carries on', r.statusCode !== 401);

/* ── administrators ── */
r = await post('/auth/admin-reset', { email: 'perry@example.org' }, janeFresh);
ok('admin reset: not for non-administrators', r.statusCode === 403);
r = await post('/auth/admin-reset', { email: 'jane@example.org' }, perryToken);
ok('admin reset: with the mail flow, the link is emailed and not shown', r.statusCode === 200 && J(r).emailed === true && !J(r).link && mails.at(-1).kind === 'reset');
delete process.env.MAIL_FLOW_URL;
r = await post('/auth/admin-reset', { email: 'jane@example.org', purpose: 'invite' }, perryToken);
ok('admin reset: without it, the administrator is given the link to pass on', r.statusCode === 200 && J(r).emailed === false && /reset-password\.html#e=jane/.test(J(r).link));
process.env.MAIL_FLOW_URL = 'https://flow.example/mail';
/* the admin panel's own save: a changed hash unlocks; an unchanged person keeps the date */
for (let i = 0; i < 5; i++) await login('jane@example.org', 'nope' + i);
ok('(Jane locked again)', !!state()['jane@example.org'].lockedAt);
reset();
r = await get('/access', perryToken); people = J(r);
ok('GET /access shows who is locked', people.auth['jane@example.org'].locked === true);
const keepDate = people.people['perry@example.org'].passwordChangedAt;
people.people['jane@example.org'] = { ...people.people['jane@example.org'], hash: pb('panel-made-password-XYZ') };
r = await handler({ rawPath: '/hub/access', requestContext: { http: { method: 'PUT' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + perryToken }, body: JSON.stringify({ people: people.people, sha: people.sha }) });
ok('a new password set from the panel unlocks her', r.statusCode === 200 && !state()['jane@example.org'].lockedAt);
const saved = files['Org/Accounts:access.json'].data.people;
ok('...and dates it; Perry\'s date is kept as it was', !!saved['jane@example.org'].passwordChangedAt && saved['perry@example.org'].passwordChangedAt === keepDate);

/* ── when the outside services fail ── */
hibpDown = true; reset();
r = await login('jane@example.org', 'panel-made-password-XYZ');
const janePanelToken = J(r).token;
r = await post('/auth/password', { current: 'panel-made-password-XYZ', password: 'password12345' }, janePanelToken);
ok('breach service down: the local list of common passwords still applies', r.statusCode === 400 && J(r).problems.some(p => /breach/.test(p)));
hibpDown = false; mailDown = true;
const mailsBefore = mails.length;
r = await post('/auth/forgot', { email: 'jane@example.org' });
ok('mail flow down: forgot still gives its usual answer', r.statusCode === 200);
mailDown = false;
ok('...and no email went out', mails.length === mailsBefore);
