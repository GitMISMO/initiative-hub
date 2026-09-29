/* GitHub reads: asked with If-None-Match, retried once, and answered from the last good
 * copy when GitHub refuses. See the "GitHub" section of index.mjs.
 *
 *   cd _dev/aws && node test-github-reads.mjs
 *
 * GitHub is simulated here, with ETags, 304s and rate-limit headers, so nothing leaves
 * this machine. The case that prompted it (Sept 2026): the allowance ran out, and the admin
 * panel's first read, GET /hub/facilitators, answered 502. */
import { createHash } from 'node:crypto';
process.env.GITHUB_TOKEN = 'ghp_test';
process.env.PROJECTS = JSON.stringify({
  hub:      { repo: 'Org/Repo',     branch: 'main', origin: 'https://org.github.io', writable: ['data/'] },
  glossary: { repo: 'Org/Glossary', branch: 'main', origin: 'https://org.github.io', writable: ['data/'] }
});
const h = s => createHash('sha256').update(s).digest('hex');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');

/* ---------- a small GitHub ---------- */
const files = new Map();            // url fragment -> { etag, json }
let version = 0;
function setFile(fragment, json) { version += 1; files.set(fragment, { etag: `"v${version}"`, json }); }
const setContents = (fragment, obj) => setFile(fragment, { sha: String(version + 1).padEnd(40, 'a'), content: b64(obj) });

let mode = 'ok';                    // ok | ratelimit | 429 | perm403 | 401 | down | down-once | throw
let lowHeader = null;               // x-ratelimit-remaining to report on successful answers
const calls = [];
const reply = (status, json, headers = {}) => ({
  status,
  headers: { get: k => headers[k.toLowerCase()] ?? null },
  json: async () => { if (json === undefined) throw new Error('no body'); return json; }
});
globalThis.fetch = async (url, opts) => {
  const cond = opts.headers?.['If-None-Match'] || null;
  calls.push({ url, method: opts.method, cond });
  if (opts.method !== 'GET') {
    if (mode === 'down') return reply(502, {});
    return reply(200, { content: { sha: 'n'.repeat(40) } });
  }
  if (mode === 'throw') throw new TypeError('fetch failed');
  if (mode === 'down') return reply(502, {});
  if (mode === 'down-once') { mode = 'ok'; return reply(503, {}); }
  if (mode === 'ratelimit') return reply(403, { message: 'API rate limit exceeded for user ID 1.' },
                                         { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790710000' });
  if (mode === '429') return reply(429, { message: 'You have exceeded a secondary rate limit.' });
  if (mode === 'perm403') return reply(403, { message: 'Resource not accessible by personal access token' });
  if (mode === '401') return reply(401, { message: 'Bad credentials' });
  for (const [fragment, f] of files) {
    if (!url.includes(fragment)) continue;
    const extra = lowHeader ? { 'x-ratelimit-remaining': String(lowHeader), 'x-ratelimit-reset': '1790710000' } : {};
    if (cond && cond === f.etag) return reply(304, undefined, { etag: f.etag, ...extra });
    return reply(200, f.json, { etag: f.etag, ...extra });
  }
  return reply(404, { message: 'Not Found' });
};

const warnings = [];
const realWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };

const { handler, __resetGithubCache: coldStart, __resetFacilitatorsCache: facBust } = await import('./index.mjs');

setContents('/facilitators.json', { admin: { name: 'Paul Admin', hash: h('adminpass-XYZ') },
  facilitators: [{ name: 'Jane Facilitator', hash: h('k7Qm-2vXp') }] });
setContents('/data/mcd.json', { rosterData: [1] });

const JANE = 'Jane Facilitator:k7Qm-2vXp', ADMIN = 'Paul Admin:adminpass-XYZ';
const ev = (method, path, key, body, project = 'hub') => ({ rawPath: `/${project}${path}`, requestContext: { http: { method } },
  headers: { origin: 'https://org.github.io', ...(key ? { 'x-facilitator-key': key } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined });
const J = r => JSON.parse(r.body);
let failed = 0;
const ok = (name, cond) => { if (!cond) failed += 1; console.log((cond ? 'PASS ' : 'FAIL ') + name); };
const readsOf = fragment => calls.filter(c => c.method === 'GET' && c.url.includes(fragment));
const fresh = () => { coldStart(); facBust(); calls.length = 0; mode = 'ok'; };

console.log('-- asked, not fetched --');
fresh();
let r = await handler(ev('GET', '/data/mcd', JANE));
const firstSha = J(r).sha;
ok('first read is a plain read', r.statusCode === 200 && J(r).data.rosterData[0] === 1 && readsOf('/data/mcd.json')[0].cond === null);
r = await handler(ev('GET', '/data/mcd', JANE));
ok('second read asks "has it changed?" with the ETag', readsOf('/data/mcd.json')[1].cond === files.get('/data/mcd.json').etag);
ok('an unchanged file is served from the copy, same data and same SHA', r.statusCode === 200 && J(r).data.rosterData[0] === 1 && J(r).sha === firstSha);
setContents('/data/mcd.json', { rosterData: [2] });
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a changed file is read in full', r.statusCode === 200 && J(r).data.rosterData[0] === 2 && J(r).sha !== firstSha);

console.log('-- one retry --');
fresh();
mode = 'down-once';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a brief GitHub failure is retried once and succeeds', r.statusCode === 200 && J(r).data.rosterData[0] === 2);
fresh();
await handler(ev('GET', '/data/mcd', JANE));           // a copy to fall back on
calls.length = 0; mode = 'ratelimit';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a rate-limit refusal is not retried', readsOf('/data/mcd.json').length === 1);

console.log('-- the last good copy --');
ok('rate-limited: answered from the last good copy', r.statusCode === 200 && J(r).data.rosterData[0] === 2);
ok('...and the function log says so', warnings.some(w => /answering from the copy confirmed/.test(w)));
mode = '429';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('secondary rate limit (429): answered from the copy', r.statusCode === 200 && J(r).data.rosterData[0] === 2);
mode = 'down';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('GitHub down (502 twice): answered from the copy', r.statusCode === 200);
mode = 'throw';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('no connection to GitHub: answered from the copy', r.statusCode === 200);

mode = 'perm403';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a permission 403 is NOT covered up (the token is wrong)', r.statusCode !== 200);
mode = '401';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a 401 is NOT covered up (the token was rejected)', r.statusCode !== 200);

fresh();
mode = 'ratelimit';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('a fresh container with no copy still refuses, as before', r.statusCode !== 200);
fresh();
mode = 'throw';
r = await handler(ev('GET', '/data/mcd', JANE));
ok('no connection and no copy: a proper error the page can read, not a crash', r.statusCode >= 500 && r.headers['Access-Control-Allow-Origin'] === 'https://org.github.io');

fresh();
await handler(ev('GET', '/data/mcd', JANE));
const realNow = Date.now;
Date.now = () => realNow() + 61 * 60_000;
facBust(); mode = 'ratelimit';
r = await handler(ev('GET', '/data/mcd', JANE));
Date.now = realNow;
ok('a copy more than an hour old is not used', r.statusCode !== 200);

fresh();
await handler(ev('GET', '/data/mcd', JANE));
const kept = files.get('/data/mcd.json'); files.delete('/data/mcd.json');
r = await handler(ev('GET', '/data/mcd', JANE));
mode = 'ratelimit';
const after = await handler(ev('GET', '/data/mcd', JANE));
files.set('/data/mcd.json', kept); mode = 'ok';
ok('a deleted file drops its copy: nothing deleted is served later', J(r).data === null && after.statusCode !== 200);

console.log('-- the case that prompted this: the admin panel opening --');
fresh();
r = await handler(ev('GET', '/facilitators', ADMIN));
ok('admin panel opens normally', r.statusCode === 200 && J(r).facilitators.length === 1);
mode = 'ratelimit';
r = await handler(ev('GET', '/facilitators', ADMIN));
ok('admin panel still opens while the allowance is spent', r.statusCode === 200 && J(r).facilitators[0].name === 'Jane Facilitator');
mode = 'ok';
setContents('/facilitators.json', { admin: { name: 'Paul Admin', hash: h('adminpass-XYZ') },
  facilitators: [{ name: 'Jane Facilitator', hash: h('k7Qm-2vXp') }, { name: 'New Person', hash: h('x-1') }] });
r = await handler(ev('GET', '/facilitators', ADMIN));
ok('...and sees a change as soon as GitHub answers again', r.statusCode === 200 && J(r).facilitators.length === 2);

console.log('-- writes and the commit check are untouched --');
fresh();
mode = 'ok';
await handler(ev('GET', '/data/mcd', JANE));
calls.length = 0; mode = 'down';
r = await handler(ev('PUT', '/data/mcd', JANE, { content: { a: 1 }, sha: 'd'.repeat(40) }));
ok('a failed write is not retried', calls.filter(c => c.method === 'PUT').length === 1 && r.statusCode === 502);
ok('writes never send If-None-Match', calls.filter(c => c.method !== 'GET').every(c => !c.cond));

fresh();
setFile('/git/ref/heads/main', { object: { sha: 'h'.repeat(40) } });
const commitBody = { files: [{ path: 'data/x.json', content: '{}' }], parentSha: 'p'.repeat(40) };
r = await handler(ev('POST', '/commit', JANE, commitBody, 'glossary'));
ok('commit compares against the branch head (someone else committed -> CONFLICT)', r.statusCode === 409);
mode = 'ratelimit';
r = await handler(ev('POST', '/commit', JANE, commitBody, 'glossary'));
ok('the branch head before a commit is never taken from a copy', r.statusCode === 502 && J(r).error === 'GITHUB');

console.log('-- limits and the log --');
fresh();
setContents('/data/big.json', { s: 'x'.repeat(7 * 1024 * 1024) });
r = await handler(ev('GET', '/data/big', JANE));
mode = 'ratelimit';
const bigAgain = await handler(ev('GET', '/data/big', JANE));
ok('an answer over 8 MB is served but not kept', r.statusCode === 200 && bigAgain.statusCode !== 200);
fresh();
warnings.length = 0; lowHeader = 120;
await handler(ev('GET', '/data/mcd', JANE));
lowHeader = null;
ok('a low allowance is written to the function log', warnings.some(w => /GitHub allowance low: 120 requests left/.test(w)));

console.warn = realWarn;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
