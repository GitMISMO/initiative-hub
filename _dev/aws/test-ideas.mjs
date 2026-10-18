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
  if (method === 'GET') { const v = h && h[h.length - 1]; if (!v) return R(404, {});
    const bytes = v.raw ? Buffer.from(v.raw, 'base64') : Buffer.from(JSON.stringify(v.data));
    if ((opts.headers || {}).Accept === 'application/vnd.github.raw') return { status: 200, ok: true, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    return R(200, { sha: v.sha, content: bytes.toString('base64') }); }
  if (method === 'PUT') { if (ghDown && m[1] === 'Org/Requests') return R(500, {}); const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    let data = null, raw = null; try { data = JSON.parse(Buffer.from(body.content, 'base64').toString()); } catch (e) { raw = body.content; }
    put(key, data, body.message); if (raw) repo[key].at(-1).raw = raw; return R(cur ? 200 : 201, { content: { sha: repo[key].at(-1).sha } }); }
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

/* ---------- company, and enough detail (Perry, 18 Oct 2026) ---------- */
r = await send({ company: '' }, { ip: '192.0.2.50' }); ok('Company is needed', r.statusCode === 400 && J(r).problems.some(p => /Your company is needed/.test(p)), J(r));
r = await send({ idea: 'Make documents standard.' }, { ip: '192.0.2.51' }); ok('a one-line idea is asked for a little more detail', r.statusCode === 400 && J(r).problems.some(p => /a little more about the idea/.test(p)), J(r));

/* ---------- attachments ---------- */
r = await send({}, { ip: '192.0.2.60' }); d = J(r); const ref = d.reference, ticket = d.attach;
ok('a saved idea\u2019s answer carries a ticket for attachments', r.statusCode === 200 && typeof ticket === 'string' && ticket.split('.').length === 3, d);
const attach = (name, bytes, o = {}) => call('POST', '/hub-requests/ideas/attach', { body: { ticket: o.ticket === undefined ? ticket : o.ticket, name, data: Buffer.from(bytes).toString('base64') }, origin: o.origin === undefined ? ORIGIN : o.origin, ip: '192.0.2.61' });
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 65)]);
r = await attach('Fraud proposal.pdf', PDF);
const files = () => (ideasFile().docs[ref].files || []);
ok('a PDF is attached: saved under the idea in the private repository, and listed on the idea', r.statusCode === 200 && files().length === 1 && files()[0].path === `data/idea-files/${ref}/1-Fraud-proposal.pdf` && files()[0].size === PDF.length && files()[0].type === 'application/pdf' && !!repo['Org/Requests:' + files()[0].path], files());
r = await attach('sheet.xlsx', Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(500, 1)])); ok('an Excel file (its zip start) too', r.statusCode === 200 && files().length === 2);
r = await attach('photo.jpg', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 2)])); ok('a JPEG too', r.statusCode === 200);
r = await attach('notes.txt', Buffer.from('Plain notes, line one.\nLine two.')); ok('and plain text', r.statusCode === 200 && files().length === 4);
r = await attach('setup.exe', Buffer.from('MZ\x90\x00')); ok('a program is refused: only the listed kinds of file', r.statusCode === 400 && J(r).error === 'TYPE' && /PDF, Word, Excel/.test(J(r).message));
r = await attach('invoice.pdf', Buffer.from('MZ\x90\x00 this is really a program')); ok('a file pretending to be a PDF is refused', r.statusCode === 400 && J(r).error === 'CONTENT');
r = await attach('data.csv', Buffer.from([0x61, 0x00, 0x62])); ok('...and so is "text" with binary in it', r.statusCode === 400 && J(r).error === 'CONTENT');
r = await attach('empty.pdf', Buffer.alloc(0)); ok('an empty file is refused', r.statusCode === 400 && J(r).error === 'EMPTY');
r = await attach('three-mb.pdf', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024, 66)])); ok('a 3 MB PDF goes through (the usual 1 MB request limit doesn\u2019t apply here)', r.statusCode === 200, { s: r.statusCode, b: (r.body || '').slice(0, 120) });
ideasFile().docs[ref].files.pop();   /* keep the count for the checks after */
r = await attach('big.pdf', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(4 * 1024 * 1024)])); ok('over 4 MB is refused, with what to do instead', r.statusCode === 413 && /Email a larger one/.test(J(r).message), { s: r.statusCode, b: (r.body || '').slice(0, 160) });
r = await call('POST', '/hub-requests/ideas/attach', { raw: 'x'.repeat(5_900_000), ip: '192.0.2.62' }); ok('a body over the limit is refused before it\u2019s read', r.statusCode === 413);
r = await attach('x.pdf', PDF, { origin: 'https://elsewhere.example' }); ok('from another site: refused', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await attach('x.pdf', PDF, { ticket: 'not.a.ticket' }); ok('without a real ticket: refused', r.statusCode === 403 && J(r).error === 'TICKET');
r = await attach('x.pdf', PDF, { ticket: T.kellie }); ok('a sign-in session is not a ticket', r.statusCode === 403 && J(r).error === 'TICKET');
{ const real = Date.now; Date.now = () => real() + 31 * 60_000; try { r = await attach('late.pdf', PDF); } finally { Date.now = real; } }
ok('after 30 minutes the ticket has run out', r.statusCode === 403 && J(r).error === 'TICKET');
r = await attach('../../access.json.pdf', PDF);
ok('a name can\u2019t climb out of the idea\u2019s folder', r.statusCode === 200 && files().at(-1).path.startsWith(`data/idea-files/${ref}/5-`) && !files().at(-1).path.includes('..'), files().at(-1));
r = await attach('sixth.pdf', PDF); ok('at most five files', r.statusCode === 400 && J(r).error === 'TOO_MANY_FILES');
/* downloads: administrators only */
r = await call('GET', '/hub-requests/ideas/file', { token: T.amy, ip: '192.0.2.63' }); ok('Work Requests staff can\u2019t download attachments', r.statusCode === 403);
r = await call('GET', '/hub-requests/ideas/file', { ip: '192.0.2.64' }); ok('nor can someone not signed in', r.statusCode === 401);
r = await handler({ rawPath: '/hub-requests/ideas/file', rawQueryString: `ref=${ref}&i=0`, requestContext: { http: { method: 'GET', sourceIp: '192.0.2.65' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + T.kellie } });
ok('a Work Requests administrator downloads the PDF, byte for byte', r.statusCode === 200 && J(r).name === 'Fraud proposal.pdf' && Buffer.from(J(r).data, 'base64').equals(PDF), r.statusCode);
r = await handler({ rawPath: '/hub-requests/ideas/file', rawQueryString: `ref=${ref}&i=9`, requestContext: { http: { method: 'GET', sourceIp: '192.0.2.66' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + T.perry } });
ok('...and asking for one that isn\u2019t there finds nothing', r.statusCode === 404);
r = await handler({ rawPath: '/hub/ideas/file', rawQueryString: `ref=${ref}&i=0`, requestContext: { http: { method: 'GET', sourceIp: '192.0.2.67' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + T.perry } });
ok('only through the Work Requests project', r.statusCode === 404);

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
