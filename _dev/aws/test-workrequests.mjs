/* Work Requests, each person's own (relay request 8). Run: node test-workrequests.mjs */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
process.env.GITHUB_TOKEN = 'ghp_test';
process.env.AUTH_SECRET = 'test-signing-secret';
process.env.PROJECTS_REPO = 'Org/Config';
const pb = pw => { const s = 'bb'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const files = {
  'Org/Config:projects.json': { sha: 'p'.repeat(40), data: {
    hub: { repo: 'Org/Hub', branch: 'main', origin: ORIGIN, writable: ['data/'] },
    'hub-requests': { repo: 'Org/Requests', branch: 'main', origin: ORIGIN, writable: ['data/'] } } },
  'Org/Config:_internal/access.json': { sha: 'a'.repeat(40), data: { people: {
    'perry@example.org':  { name: 'Perry Williams',  hash: pb('perry-pass-123456'),  access: { hub: 'admin', 'hub-requests': 'admin' }, platformAdmin: true },
    'jonna@example.org':  { name: 'Jonna Critchley', hash: pb('jonna-pass-123456'),  access: { hub: 'admin', 'hub-requests': 'admin' }, platformAdmin: true },
    'kellie@example.org': { name: 'Kellie Stoll',    hash: pb('kellie-pass-123456'), access: { hub: 'staff', 'hub-requests': 'staff' } },
    'erin@example.org':   { name: 'Erin B',          hash: pb('erin-pass-1234567'),  access: { hub: 'staff', 'hub-requests': 'staff' } },
    'amy@example.org':    { name: 'Amy Moses',       hash: pb('amy-pass-12345678'),  access: { hub: 'view',  'hub-requests': 'view' } } } } },
};
const req = (id, who, extra = {}) => ({ id, status: 'new', createdBy: { email: who + '@example.org', name: who }, req: { title: 'T ' + id }, wr: '', facilitator: '', ...extra });
files['Org/Requests:data/requests.json'] = { sha: 'r'.repeat(40), data: { docs: {
  'REQ-0001': req('REQ-0001', 'kellie'), 'REQ-0002': req('REQ-0002', 'erin'), 'REQ-0003': req('REQ-0003', 'perry', { status: 'assigned', assignedTo: 'MCD', wr: 'WR2026_1' }) } } };
files['Org/Requests:data/drafts.json'] = { sha: 'd'.repeat(40), data: { docs: {
  'd-k1': { by: { email: 'kellie@example.org', name: 'Kellie' }, r: { title: 'Kellie draft' } },
  'd-p1': { by: { email: 'perry@example.org', name: 'Perry' }, r: { title: 'Perry draft' } } } } };
let shaN = 1, raceOnce = false; const puts = [];
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return { status: 404, json: async () => ({}) };
  const key = m[1] + ':' + decodeURIComponent(m[2]);
  if (method === 'GET') { const f = files[key]; return f ? { status: 200, json: async () => ({ sha: f.sha, content: b64(f.data) }) } : { status: 404, json: async () => ({}) }; }
  const body = JSON.parse(opts.body), f = files[key];
  if (raceOnce && key.endsWith('requests.json')) {   // someone else saves first, once
    raceOnce = false; f.data.docs['REQ-0090'] = req('REQ-0090', 'erin'); f.sha = 'race'.padEnd(40, '0');
    return { status: 409, json: async () => ({ message: 'conflict' }) };
  }
  if ((f && body.sha !== f.sha) || (!f && body.sha)) return { status: 409, json: async () => ({ message: 'conflict' }) };
  files[key] = { sha: ('s' + shaN++).padEnd(40, '0'), data: JSON.parse(Buffer.from(body.content, 'base64').toString()) };
  puts.push(key); return { status: f ? 200 : 201, json: async () => ({ content: { sha: files[key].sha } }) };
};
const { handler } = await import('./index.mjs');
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const J = r => JSON.parse(r.body);
const call = (method, path, token, body) => handler({ rawPath: path, requestContext: { http: { method } },
  headers: { origin: ORIGIN, authorization: 'Bearer ' + token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
const login = async (email, pw) => J(await handler({ rawPath: '/hub/auth/login', requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN }, body: JSON.stringify({ email, password: pw }) })).token;
const perry = await login('perry@example.org', 'perry-pass-123456');
const jonna = await login('jonna@example.org', 'jonna-pass-123456');
const kellie = await login('kellie@example.org', 'kellie-pass-123456');
const amy = await login('amy@example.org', 'amy-pass-12345678');
const stored = name => files['Org/Requests:data/' + name + '.json'].data.docs;

/* reading */
let r = await call('GET', '/hub-requests/data/requests', perry);
ok('Perry (administrator) reads every request', r.statusCode === 200 && Object.keys(J(r).data.docs).length === 3 && J(r).scope === 'all');
r = await call('GET', '/hub-requests/data/requests', jonna);
ok('Jonna (administrator) reads every request', Object.keys(J(r).data.docs).length === 3);
r = await call('GET', '/hub-requests/data/requests', kellie);
ok('Kellie reads only her own', r.statusCode === 200 && Object.keys(J(r).data.docs).join() === 'REQ-0001' && J(r).scope === 'own');
const kellieSha = J(r).sha;
r = await call('GET', '/hub-requests/data/drafts', perry);
ok('drafts: Perry sees only his own, administrator or not', Object.keys(J(r).data.docs).join() === 'd-p1');
r = await call('GET', '/hub-requests/data/drafts', kellie);
ok('drafts: Kellie sees only hers', Object.keys(J(r).data.docs).join() === 'd-k1');

/* Kellie submits; her page thinks the next number is REQ-0002, which Erin holds */
let mine = { 'REQ-0001': req('REQ-0001', 'kellie'), 'REQ-0002': req('REQ-0002', 'kellie', { req: { title: 'Kellie new' } }) };
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: mine }, sha: kellieSha });
ok('Kellie submits: accepted', r.statusCode === 200);
ok('...given the next free number, reported back', J(r).ids['REQ-0002'] === 'REQ-0004' && stored('requests')['REQ-0004'].req.title === 'Kellie new' && stored('requests')['REQ-0004'].id === 'REQ-0004');
ok('...Erin\'s REQ-0002 untouched', stored('requests')['REQ-0002'].createdBy.email === 'erin@example.org');
ok('...the answer shows Kellie only her own', Object.keys(J(r).data.docs).sort().join() === 'REQ-0001,REQ-0004');

/* her page still has an old copy of REQ-0001 after Perry decides it */
r = await call('GET', '/hub-requests/data/requests', perry);
const all = J(r).data.docs; all['REQ-0001'] = { ...all['REQ-0001'], status: 'assigned', assignedTo: 'CCS', wr: 'WR2026_9' };
r = await call('PUT', '/hub-requests/data/requests', perry, { content: { docs: all }, sha: J(r).sha });
ok('Perry decides REQ-0001', r.statusCode === 200 && stored('requests')['REQ-0001'].status === 'assigned');
const stale = { 'REQ-0001': req('REQ-0001', 'kellie'), 'REQ-0004': stored('requests')['REQ-0004'], 'REQ-0005': req('REQ-0005', 'kellie', { req: { title: 'Kellie third' } }) };
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: stale }, sha: 'old'.padEnd(40, '0') });
ok('Kellie submits again from a page with a stale copy: accepted', r.statusCode === 200 && stored('requests')['REQ-0005']);
ok('...Perry\'s decision on REQ-0001 is kept, not her old copy', stored('requests')['REQ-0001'].status === 'assigned' && stored('requests')['REQ-0001'].wr === 'WR2026_9');

/* what Kellie may not do */
const n0 = Object.keys(stored('requests')).length;
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: { 'REQ-0001': { ...stored('requests')['REQ-0001'], status: 'new', wr: '' } } }, sha: null });
ok('she cannot undo a decision on her own request (kept as stored)', r.statusCode === 200 && stored('requests')['REQ-0001'].status === 'assigned');
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: {} }, sha: null });
ok('she cannot remove her requests (kept as stored)', Object.keys(stored('requests')).length === n0);
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: { 'REQ-0099': req('REQ-0099', 'erin') } }, sha: null });
ok('she cannot add a request in someone else\'s name', r.statusCode === 403 && J(r).error === 'NOT_ALLOWED');
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: { 'REQ-0098': req('REQ-0098', 'kellie', { status: 'assigned', wr: 'WR-fake' }) } }, sha: null });
ok('she cannot add one already decided', r.statusCode === 403);
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: { 'REQ-0097': req('REQ-0097', 'kellie', { wr: 'WR-fake', facilitator: 'Me' }) } }, sha: null });
ok('a new request\'s WR# and facilitator are cleared', r.statusCode === 200 && stored('requests')[J(r).ids['REQ-0097'] || 'REQ-0097'].wr === '' && stored('requests')[J(r).ids['REQ-0097'] || 'REQ-0097'].facilitator === '');
r = await call('PUT', '/hub-requests/data/requests', amy, { content: { docs: { 'REQ-0096': req('REQ-0096', 'amy') } }, sha: null });
ok('View access cannot submit', r.statusCode === 403);

/* drafts: hers change, Perry's are kept */
r = await call('PUT', '/hub-requests/data/drafts', kellie, { content: { docs: { 'd-k2': { by: { email: 'kellie@example.org' }, r: { title: 'second' } } } }, sha: null });
ok('drafts: Kellie replaces her own (removes one, adds one)', r.statusCode === 200 && !stored('drafts')['d-k1'] && stored('drafts')['d-k2']);
ok('...Perry\'s draft untouched', stored('drafts')['d-p1'] && stored('drafts')['d-p1'].r.title === 'Perry draft');
r = await call('PUT', '/hub-requests/data/drafts', kellie, { content: { docs: { 'd-p1': { by: { email: 'kellie@example.org' }, r: { title: 'hijack' } } } }, sha: null });
ok('drafts: she cannot take over Perry\'s draft', stored('drafts')['d-p1'].r.title === 'Perry draft');
r = await call('PUT', '/hub-requests/data/drafts', perry, { content: { docs: { 'd-p1': { by: { email: 'perry@example.org' }, r: { title: 'Perry edited' } } } }, sha: null });
ok('drafts: Perry saving his own leaves Kellie\'s', stored('drafts')['d-k2'] && stored('drafts')['d-p1'].r.title === 'Perry edited');

/* the whole-file routes are closed for this project */
r = await call('GET', '/hub-requests/file/data/requests.json', kellie);
ok('reading the whole file through /file is refused', r.statusCode === 403 && J(r).error === 'NOT_ALLOWED');
r = await call('POST', '/hub-requests/commit', perry, { files: [{ path: 'data/requests.json', content: '{}' }], parentSha: 'x'.repeat(40) });
ok('writing through /commit is refused, even for an administrator', r.statusCode === 403);

/* two people at once: someone else saves between Kellie's read and her write */
raceOnce = true;
r = await call('PUT', '/hub-requests/data/requests', kellie, { content: { docs: { 'REQ-0080': req('REQ-0080', 'kellie', { req: { title: 'Kellie race' } }) } }, sha: null });
const raceId = (J(r).ids && J(r).ids['REQ-0080']) || 'REQ-0080';
ok('a save that loses a race is merged again, not lost', r.statusCode === 200 && raceId && stored('requests')[raceId].req.title === 'Kellie race');
ok('...and the other person\'s new request survives', stored('requests')['REQ-0090'] && stored('requests')['REQ-0090'].createdBy.email === 'erin@example.org');

/* an administrator's whole-file save is still guarded by the version read */
r = await call('PUT', '/hub-requests/data/requests', perry, { content: { docs: {} }, sha: 'stale'.padEnd(40, '0') });
ok('an administrator saving over a newer version gets CONFLICT, nothing lost', r.statusCode === 409 && Object.keys(stored('requests')).length > 3);

/* other projects are unaffected */
r = await call('GET', '/hub/data/mcd', perry);
ok('other tools\' data routes are unchanged', r.statusCode === 200);
