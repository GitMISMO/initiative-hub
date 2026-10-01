/* GET /auth/me (relay request 8). Run: node test-me.mjs */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
process.env.GITHUB_TOKEN = 'ghp_test'; process.env.AUTH_SECRET = 'test-signing-secret'; process.env.PROJECTS_REPO = 'Org/Config';
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const people = {
  'kellie@example.org': { name: 'Kellie Stoll', hash: pb('kellie-pass-123456'), access: { hub: 'staff', 'hub-requests': 'staff', qr: 'facilitator' } },
  'old@example.org':    { name: 'Old Timer', hash: pb('old-pass-123456789'), access: { hub: 'view' }, expires: '2020-01-01' } };
const files = { 'Org/Config:projects.json': { sha: 'p'.repeat(40), data: { hub: { repo: 'Org/Hub', branch: 'main', origin: ORIGIN, writable: ['data/'] } } },
                'Org/Config:_internal/access.json': { sha: 'a'.repeat(40), data: { people } } };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
globalThis.fetch = async (url) => { const m = url.match(/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/); const f = m && files[m[1] + ':' + decodeURIComponent(m[2])];
  return f ? { status: 200, json: async () => ({ sha: f.sha, content: b64(f.data) }) } : { status: 404, json: async () => ({}) }; };
const relay = await import('./index.mjs'); const { handler } = relay;
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n); const J = r => JSON.parse(r.body);
const me = (token, origin = ORIGIN) => handler({ rawPath: '/hub/auth/me', requestContext: { http: { method: 'GET' } }, headers: { origin, ...(token ? { authorization: 'Bearer ' + token } : {}) } });
const token = J(await handler({ rawPath: '/hub/auth/login', requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN }, body: JSON.stringify({ email: 'kellie@example.org', password: 'kellie-pass-123456' }) })).token;
let r = await me(token);
ok('signed in: her access, as stored, with roles normalised', r.statusCode === 200 && J(r).access.hub === 'staff' && J(r).access['hub-requests'] === 'staff' && J(r).access.qr === 'staff' && J(r).platformAdmin === false);
ok('...and nothing about anyone else', !('people' in J(r)) && J(r).email === 'kellie@example.org');
people['kellie@example.org'].access = { hub: 'staff', 'hub-requests': 'admin', 'summit-hq': 'view' }; relay.__resetAccessCache();
r = await me(token);
ok('an administrator\'s change shows at once, with the same session', J(r).access['hub-requests'] === 'admin' && J(r).access['summit-hq'] === 'view' && !J(r).access.qr);
r = await me(null); ok('no session: refused', r.statusCode === 401);
r = await me(token, 'https://evil.example'); ok('another site: refused', r.statusCode === 403);
delete people['kellie@example.org']; relay.__resetAccessCache();
r = await me(token); ok('removed from the list: NO_ACCOUNT (the page signs out)', r.statusCode === 401 && J(r).error === 'NO_ACCOUNT');
people['kellie@example.org'] = { name: 'Kellie Stoll', hash: pb('kellie-pass-123456'), access: { hub: 'staff' }, passwordChangedAt: new Date(Date.now() + 5000).toISOString() }; relay.__resetAccessCache();
r = await me(token); ok('a session from before a password change: TOKEN_STALE', r.statusCode === 401 && J(r).error === 'TOKEN_STALE');
