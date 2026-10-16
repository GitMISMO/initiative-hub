/* The public Submit an Idea form's relay route, and the Ideas Inbox rule (relay request 10; Perry, 16 Oct 2026).
 * Run: node test-ideas.mjs. A stand-in GitHub and mail flow, as in test-r9.mjs. */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'ideas-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = {
  'perry@example.org': { name: 'Perry Williams', hash: pb(PW), platformAdmin: true, access: { hub: 'admin', 'hub-requests': 'admin' } },
  'kellie@example.org': { name: 'Kellie Stoll', hash: pb(PW), access: { hub: 'staff', 'hub-requests': 'admin' } },
  'amy@example.org': { name: 'Amy Moses', hash: pb(PW), access: { hub: 'staff', 'hub-requests': 'staff' } },
  'ken@example.org': { name: 'Ken Kearns', hash: pb(PW), access: { hub: 'staff' } },
  'old@example.org': { name: 'Old Admin', hash: pb(PW), access: { 'hub-requests': 'admin' }, expires: '2020-01-01' } };
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
put('Org/Config:projects.json', { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] }, 'hub-requests': { repo: 'Org/Requests', origin: ORIGIN, writable: ['data/'] } });
put('Org/Accounts:access.json', { people });
const mails = []; let mailDown = false, ghDown = false;
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { if (mailDown) return R(500, {}); mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1]; return v ? R(200, { sha: v.sha, content: Buffer.from(JSON.stringify(v.data)).toString('base64') }) : R(404, {}); }
  if (method === 'PUT') { if (ghDown && m[1] === 'Org/Requests') return R(500, {}); const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(cur ? 200 : 201, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const relay = await import('./index.mjs'); const { handler } = relay;
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 260))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { token, body, origin = ORIGIN, ip = '203.0.113.1', raw } = {}) => handler({ rawPath: path, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
const reset = () => relay.__resetAccessCache && relay.__resetAccessCache();
const login = async e => { reset(); return J(await call('POST', '/hub/auth/login', { body: { email: e, password: PW } })).token; };
const T = {}; for (const e of ['perry', 'kellie', 'amy', 'ken']) T[e] = await login(e + '@example.org');
const ideasFile = () => (repo['Org/Requests:data/ideas.json'] || []).at(-1)?.data;
const IDEA = { title: 'Flood and climate risk data in the loan file', idea: 'A shared set of MISMO data points for flood and climate risk, carried with the loan.',
  who: ['Lenders', 'Appraisal and valuation', 'Not a real choice'], whoOther: 'The GSEs\u2019 data teams', why: 'Investors have begun asking for it at delivery.',
  name: 'Dana Whitfield', company: 'Northbridge Mortgage', email: 'dana@northbridge.example', phone: '', member: 'yes', website: '' };
const send = (extra = {}, o = {}) => call('POST', '/hub-requests/ideas/submit', { body: { ...IDEA, startedAt: Date.now() - 20_000, ...extra }, ...o });
let r, d;

/* ---------- a good idea ---------- */
mails.length = 0;
r = await send({}, { ip: '198.51.100.1' }); d = J(r);
ok('a good idea, no sign-in: accepted with a reference and a reply-by date', r.statusCode === 200 && d.ok === true && d.reference === 'IDEA-0001' && /^\d{4}-\d{2}-\d{2}$/.test(d.replyBy), d);
const doc = (ideasFile() || { docs: {} }).docs['IDEA-0001'];
ok('it is kept in the private Work Requests repository, open, with what was sent', doc && doc.status === 'open' && doc.title === IDEA.title && doc.email === IDEA.email && doc.source === 'public form' && doc.replyBy === d.replyBy, doc);
ok('...only the known "who" choices are kept, and nothing of the robot checks', doc && JSON.stringify(doc.who) === '["Lenders","Appraisal and valuation"]' && !('website' in doc) && !('startedAt' in doc), doc);
const rec = mails.find(x => x.kind === 'idea-receipt');
ok('the sender gets a receipt with the reference and the date', rec && rec.to === IDEA.email && rec.subject.includes('IDEA-0001') && /by \w+day, \w+ \d+/.test(rec.text), rec && rec.text);
ok('...which repeats nothing they typed (so the form can\u2019t send strangers words of someone\u2019s choosing)', rec && ![IDEA.title, IDEA.name, IDEA.company, 'Northbridge', 'Flood'].some(t => (rec.subject + rec.text).includes(t)), rec);
const alerts = mails.filter(x => x.kind === 'idea-alert');
ok('Work Requests administrators and platform administrators are alerted, nobody else (not staff, not an expired admin)', JSON.stringify(alerts.map(x => x.to).sort()) === JSON.stringify(['kellie@example.org', 'perry@example.org']), alerts.map(x => x.to));
ok('...with the idea, who sent it, how to reach them and where it is', alerts.length && alerts.every(x => x.subject.includes(IDEA.title) && x.text.includes('Dana Whitfield, Northbridge Mortgage') && x.text.includes(IDEA.email) && x.text.includes('#ideas') && x.text.includes('The GSEs')));
r = await send({ title: 'Second\nidea   with  line breaks' }, { ip: '198.51.100.2' });
ok('the next one is IDEA-0002, and line breaks are taken out of one-line answers', J(r).reference === 'IDEA-0002' && ideasFile().docs['IDEA-0002'].title === 'Second idea with line breaks', ideasFile().docs['IDEA-0002']);

/* ---------- reply by: two business days, weekends skipped ---------- */
const at = async iso => { const real = Date.now; Date.now = () => Date.parse(iso); try { return J(await send({ startedAt: Date.parse(iso) - 20_000 }, { ip: 'tz-' + iso })).replyBy; } finally { Date.now = real; } };
ok('sent on a Friday: reply by Tuesday', (await at('2026-10-16T15:00:00Z')) === '2026-10-20');
ok('sent on a Wednesday: reply by Friday', (await at('2026-10-14T15:00:00Z')) === '2026-10-16');
ok('sent on a Saturday: reply by Tuesday', (await at('2026-10-17T15:00:00Z')) === '2026-10-20');
ok('late Friday evening in Washington still counts as Friday', (await at('2026-10-17T02:30:00Z')) === '2026-10-20');

/* ---------- misuse ---------- */
const before = Object.keys(ideasFile().docs).length; mails.length = 0;
r = await send({}, { origin: 'https://elsewhere.example', ip: '192.0.2.10' }); ok('from another site: refused', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await send({}, { origin: null, ip: '192.0.2.11' }); ok('with no Origin at all (a script): refused', r.statusCode === 403);
r = await send({ website: 'https://spam.example' }, { ip: '192.0.2.12' }); d = J(r);
ok('the hidden field filled (a robot): answered as if accepted, with no reference', r.statusCode === 200 && d.ok === true && d.reference === null, d);
r = await send({ startedAt: Date.now() - 800 }, { ip: '192.0.2.13' }); ok('sent under 3 seconds after opening: the same', J(r).reference === null);
r = await send({ startedAt: undefined }, { ip: '192.0.2.14' }); ok('no opening time at all: the same', J(r).reference === null);
ok('...none of those kept anything or emailed anyone', Object.keys(ideasFile().docs).length === before && mails.length === 0, { kept: Object.keys(ideasFile().docs).length - before, mails: mails.length });
r = await send({ title: '', idea: 'short', name: '', email: 'not-an-email' }, { ip: '192.0.2.20' }); d = J(r);
ok('missing or wrong answers: refused, saying what to fix in plain words', r.statusCode === 400 && d.problems.length === 4 && d.problems.some(p => /name for your idea/.test(p)) && d.problems.some(p => /email address/.test(p)), d);
r = await send({ title: 'x'.repeat(151) }, { ip: '192.0.2.21' }); ok('an answer over its limit: refused', r.statusCode === 400 && /too long/.test(J(r).problems.join()));
r = await send({ why: 'x'.repeat(25_000) }, { ip: '192.0.2.22' }); ok('more than 24 kB: refused before reading', r.statusCode === 413);
r = await call('POST', '/hub-requests/ideas/submit', { raw: '{not json', ip: '192.0.2.23' }); ok('not JSON: refused', r.statusCode === 400);
r = await call('POST', '/hub/ideas/submit', { body: { ...IDEA, startedAt: Date.now() - 20_000 }, ip: '192.0.2.24' }); ok('only the Work Requests project takes ideas', r.statusCode === 404);
/* ---------- when something else fails ---------- */
mailDown = true; r = await send({}, { ip: '192.0.2.40' }); mailDown = false;
ok('if the emails fail, the idea is still kept and the sender still told it\u2019s in', r.statusCode === 200 && J(r).reference && ideasFile().docs[J(r).reference]);
ghDown = true; r = await send({}, { ip: '192.0.2.41' }); ghDown = false;
ok('if GitHub can\u2019t save it, the sender is told to try again (not that it went through)', r.statusCode === 502 && J(r).error === 'NOT_SAVED' && /try again/.test(J(r).message));

for (let i = 0; i < 3; i++) await send({}, { ip: '192.0.2.99' });
r = await send({}, { ip: '192.0.2.99' }); ok('a fourth idea in an hour from one address: asked to wait', r.statusCode === 429 && /try again in an hour/.test(J(r).message));
r = await send({}, { ip: '192.0.2.100' }); ok('...while another address is still fine', r.statusCode === 200 && J(r).reference);
let lastStatus = 200, sentAll = 0; for (let i = 0; i < 40 && lastStatus === 200; i++) { lastStatus = (await send({}, { ip: '10.0.0.' + i })).statusCode; if (lastStatus === 200) sentAll++; }
ok('at most 30 ideas an hour in all, from anywhere', lastStatus === 429 && sentAll < 30, { sentAll, lastStatus });

/* ---------- nothing is read back through the public route ---------- */
r = await call('GET', '/hub-requests/ideas/submit', { ip: '192.0.2.30' }); ok('GET on the public route reveals nothing', r.statusCode >= 400 && !/IDEA-0001|Dana/.test(r.body || ''), r.statusCode);
r = await call('GET', '/hub-requests/data/ideas', { ip: '192.0.2.31' }); ok('reading the ideas without signing in: refused', r.statusCode === 401 && !/Dana/.test(r.body || ''));

/* ---------- the Ideas Inbox: administrators only ---------- */
r = await call('GET', '/hub-requests/data/ideas', { token: T.amy }); ok('Work Requests staff (not admin) can\u2019t read the ideas', r.statusCode === 403 && J(r).error === 'ADMINS_ONLY' && !/Dana/.test(r.body));
r = await call('GET', '/hub-requests/data/ideas', { token: T.ken }); ok('someone without Work Requests can\u2019t either', r.statusCode === 403 && !/Dana/.test(r.body));
r = await call('GET', '/hub-requests/data/ideas', { token: T.kellie }); d = J(r);
ok('a Work Requests administrator reads them all', r.statusCode === 200 && d.data.docs['IDEA-0001'].name === 'Dana Whitfield', Object.keys(d.data?.docs || {}).length);
const pRead = J(await call('GET', '/hub-requests/data/ideas', { token: T.perry }));
ok('...and so does a platform administrator', !!pRead.data?.docs?.['IDEA-0001']);
const content = JSON.parse(JSON.stringify(d.data)); content.docs['IDEA-0001'].status = 'reached'; content.docs['IDEA-0001'].reachedOutAt = new Date().toISOString();
r = await call('PUT', '/hub-requests/data/ideas', { token: T.amy, body: { content, sha: d.sha } }); ok('staff can\u2019t change them', r.statusCode === 403);
r = await call('PUT', '/hub-requests/data/ideas', { token: T.kellie, body: { content, sha: d.sha } });
ok('an administrator marks one as reached out', r.statusCode === 200 && ideasFile().docs['IDEA-0001'].status === 'reached', r.body.slice(0, 160));
r = await call('GET', '/hub-requests/file/data/ideas.json', { token: T.kellie }); ok('the file can\u2019t be fetched whole around the rule', r.statusCode === 403);

await new Promise(done => setTimeout(done, 50));
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exitCode = failed ? 1 : 0;
