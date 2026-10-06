/* People & Access sections (relay request 9): 'facilitator' is kept, and GET /access says which sections are. */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'test-signing-secret', PROJECTS_REPO: 'Org/Config' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const people = { 'perry@example.org': { name: 'Perry Williams', hash: pb('perry-pass-1234567'), platformAdmin: true, access: { hub: 'admin' }, group: 'staff' },
                 'kellie@example.org': { name: 'Kellie Stoll', hash: pb('kellie-pass-123456'), access: { hub: 'staff' }, group: 'contractor' } };
const files = { 'Org/Config:projects.json': { sha: 'p'.repeat(40), data: { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] } } },
                'Org/Config:_internal/access.json': { sha: 'a'.repeat(40), data: { people } } };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64'); let written = null;
globalThis.fetch = async (url, opts = {}) => { const m = url.match(/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/); const f = m && files[m[1] + ':' + decodeURIComponent(m[2])];
  if ((opts.method || 'GET') === 'PUT') { written = JSON.parse(Buffer.from(JSON.parse(opts.body).content, 'base64').toString()); return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ content: { sha: 'n'.repeat(40) } }) }; }
  return f ? { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ sha: f.sha, content: b64(f.data) }) } : { status: 404, ok: false, headers: { get: () => null }, json: async () => ({}) }; };
const { handler } = await import('./index.mjs');
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n); const J = r => JSON.parse(r.body);
const tok = J(await handler({ rawPath: '/hub/auth/login', requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN }, body: JSON.stringify({ email: 'perry@example.org', password: 'perry-pass-1234567' }) })).token;
const call = (m, body) => handler({ rawPath: '/hub/access', requestContext: { http: { method: m } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
let r = await call('GET'); ok('GET /access lists the sections the relay keeps, facilitator among them', r.statusCode === 200 && J(r).groups.join() === 'staff,facilitator,contractor,process');
const ppl = J(r).people; ppl['kellie@example.org'].group = 'facilitator';
r = await call('PUT', { people: ppl, sha: J(await call('GET')).sha }); ok('saving someone as a facilitator is accepted and stored', r.statusCode === 200 && written.people['kellie@example.org'].group === 'facilitator');
ppl['kellie@example.org'].group = 'wizard'; r = await call('PUT', { people: ppl, sha: 'a'.repeat(40) }); ok('a section it does not keep is still refused', r.statusCode === 400 && J(r).error === 'BAD_GROUP');
