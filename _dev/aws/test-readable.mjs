/* Tests for the readable / writable split.
 *
 * Run:  node test-readable.mjs
 *
 * Kept in its own file so test-relay.mjs stays exactly as Perry wrote it. Same harness
 * conventions: GitHub is mocked, the legacy X-Facilitator-Key path is used to sign in.
 *
 * What has to be true:
 *   1. A project that declares only `writable` behaves EXACTLY as before. This is the one
 *      that protects hub, glossary and hub-files.
 *   2. A `readable` prefix can be read and CANNOT be written.
 *   3. A `writable` prefix can still be both.
 *   4. A path in neither list is refused both ways.
 *   5. NEVER_WRITABLE (_internal/, .github/, .git/) is refused even if a project is
 *      misconfigured to declare it readable. A mistaken entry must not reopen the
 *      account list.
 */
import { createHash } from 'node:crypto';

process.env.GITHUB_TOKEN = 'ghp_test';
process.env.PROJECTS = JSON.stringify({
  // Unchanged shape: no `readable` key at all. Must behave as it always did.
  legacy: { repo: 'Org/Legacy', branch: 'main', origin: 'https://org.github.io', writable: ['data/'] },

  // The service-orders contractor shape: reads its orders, writes only its signatures.
  contractor: {
    repo: 'Org/SoPhoenix', branch: 'main', origin: 'https://org.github.io',
    writable: ['signatures/', 'notify/'],
    readable: ['orders/', 'agreements/']
  },

  // A deliberately misconfigured project, to prove the hard refusals still hold.
  bad: {
    repo: 'Org/Bad', branch: 'main', origin: 'https://org.github.io',
    writable: ['data/'],
    readable: ['_internal/', '.github/']
  }
});

const h = s => createHash('sha256').update(s).digest('hex');
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64');

const facFile = { facilitators: [{ name: 'Becky Griswold', hash: h('pw-becky') }] };

globalThis.fetch = async (url, opts) => {
  if (opts.method === 'GET' && url.includes('/facilitators.json')) {
    return { status: 200, json: async () => ({ sha: 'fac'.padEnd(40, '0'), content: b64(facFile) }) };
  }
  if (opts.method === 'GET' && url.includes('/contents/')) {
    return { status: 200, json: async () => ({ sha: 'a'.repeat(40), size: 12, content: b64('{"ok":true}') }) };
  }
  return { status: 404, json: async () => ({}) };
};

const { handler } = await import('./index.mjs');

const KEY = 'Becky Griswold:pw-becky';
let failures = 0;
const ok = (n, c) => { if (!c) failures++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
const J = r => { try { return JSON.parse(r.body); } catch { return {}; } };

const read = (proj, path) => handler({
  rawPath: `/${proj}/file/${path}`,
  requestContext: { http: { method: 'GET' } },
  headers: { origin: 'https://org.github.io', 'x-facilitator-key': KEY }
});

const write = (proj, path) => handler({
  rawPath: `/${proj}/commit`,
  requestContext: { http: { method: 'POST' } },
  headers: { origin: 'https://org.github.io', 'x-facilitator-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'test', files: [{ path, content: '{}' }] })
});

let r;

/* ---------- 1. nothing changes for a project that never heard of `readable` ---------- */
console.log('\n-- a project declaring only writable (hub, glossary, hub-files) --');
r = await read('legacy', 'data/thing.json');
ok('it can still read inside its writable folder', r.statusCode === 200);
r = await write('legacy', 'data/thing.json');
ok('it can still write inside its writable folder', J(r).error !== 'PATH_NOT_WRITABLE');
r = await read('legacy', 'index.html');
ok('it still cannot read outside it', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');
r = await write('legacy', 'index.html');
ok('it still cannot write outside it', r.statusCode === 403 && J(r).error === 'PATH_NOT_WRITABLE');
r = await read('legacy', '_internal/facilitators.json');
ok('it still cannot read the account list', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');

/* ---------- 2. the point of the change ---------- */
console.log('\n-- a contractor: reads its orders, writes only its signatures --');
r = await read('contractor', 'orders/phoenixteam.json');
ok('it CAN read its own service orders', r.statusCode === 200);
r = await write('contractor', 'orders/phoenixteam.json');
ok('it CANNOT overwrite its own service orders', r.statusCode === 403 && J(r).error === 'PATH_NOT_WRITABLE');
ok('and the refusal names the path it refused', J(r).path === 'orders/phoenixteam.json');

r = await read('contractor', 'signatures/phoenixteam.json');
ok('it can read its signatures', r.statusCode === 200);
r = await write('contractor', 'signatures/phoenixteam.json');
ok('it can write its signatures', J(r).error !== 'PATH_NOT_WRITABLE');

r = await write('contractor', 'notify/phoenixteam.json');
ok('it can raise a question or a hold', J(r).error !== 'PATH_NOT_WRITABLE');

r = await read('contractor', 'agreements/phoenixteam.json');
ok('it can read its executed agreements', r.statusCode === 200);
r = await write('contractor', 'agreements/phoenixteam.json');
ok('it cannot alter an executed agreement', r.statusCode === 403 && J(r).error === 'PATH_NOT_WRITABLE');

/* ---------- 3. a path in neither list ---------- */
console.log('\n-- a path in neither list --');
r = await read('contractor', 'secret/rates.json');
ok('cannot be read', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');
r = await write('contractor', 'secret/rates.json');
ok('cannot be written', r.statusCode === 403 && J(r).error === 'PATH_NOT_WRITABLE');

/* ---------- 4. the hard refusals survive a misconfigured project ---------- */
console.log('\n-- a project that wrongly declares _internal/ and .github/ readable --');
r = await read('bad', '_internal/access.json');
ok('the account list is STILL refused', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');
r = await read('bad', '_internal/facilitators.json');
ok('so is facilitators.json', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');
r = await read('bad', '.github/workflows/deploy.yml');
ok('so are the CI workflows', r.statusCode === 403 && J(r).error === 'PATH_NOT_READABLE');
r = await read('bad', 'data/fine.json');
ok('while its legitimate folder still reads', r.statusCode === 200);

/* ---------- 5. traversal is still refused ---------- */
console.log('\n-- path traversal --');
r = await read('contractor', 'orders/../_internal/access.json');
ok('climbing out of a readable folder is refused', r.statusCode === 400 || r.statusCode === 403);

/* ---------- 6. reading is still gated on being signed in ---------- */
console.log('\n-- no account --');
r = await handler({
  rawPath: '/contractor/file/orders/phoenixteam.json',
  requestContext: { http: { method: 'GET' } },
  headers: { origin: 'https://org.github.io' }
});
ok('a readable folder is not public', r.statusCode === 401);

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
