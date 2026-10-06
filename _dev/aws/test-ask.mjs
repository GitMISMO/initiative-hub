/* POST /{project}/ask (relay request 9). Run: node test-ask.mjs */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'test-signing-secret', PROJECTS_REPO: 'Org/Config', ASK_PER_HOUR: '3' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const people = { 'kellie@example.org': { name: 'Kellie Stoll', hash: pb('kellie-pass-123456'), access: { hub: 'staff', 'team-hq': 'staff' } },
                 'viewer@example.org': { name: 'Vi Ewer', hash: pb('viewer-pass-123456'), access: { 'team-hq': 'view' } } };
const files = { 'Org/Config:projects.json': { sha: 'p'.repeat(40), data: { hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] }, 'team-hq': { repo: 'Org/TeamHQ', origin: ORIGIN, writable: ['data/'], ask: true } } },
                'Org/Config:_internal/access.json': { sha: 'a'.repeat(40), data: { people } } };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
let anth = { status: 200, body: { model: 'claude-sonnet-5-5-x', content: [{ type: 'text', text: 'Three tasks are late.' }], usage: { input_tokens: 1200, output_tokens: 40 } } }, sent = null, hang = false;
globalThis.fetch = async (url, opts = {}) => {
  if (url.startsWith('https://api.anthropic.com/')) { sent = { url, headers: opts.headers, body: JSON.parse(opts.body) };
    if (hang) return new Promise((_, rej) => opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
    return { status: anth.status, ok: anth.status < 300, json: async () => anth.body }; }
  const m = url.match(/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/); const f = m && files[m[1] + ':' + decodeURIComponent(m[2])];
  return f ? { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ sha: f.sha, content: b64(f.data) }) } : { status: 404, ok: false, headers: { get: () => null }, json: async () => ({}) };
};
const logs = []; const log0 = console.log; console.log = (...a) => logs.push(a.join(' '));
const { handler } = await import('./index.mjs');
const ok = (n, c) => log0((c ? 'PASS ' : 'FAIL ') + n); const J = r => JSON.parse(r.body);
const login = async (email, password) => J(await handler({ rawPath: '/hub/auth/login', requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN }, body: JSON.stringify({ email, password }) })).token;
const ask = (project, token, body, ctx) => handler({ rawPath: `/${project}/ask`, requestContext: { http: { method: 'POST' } }, headers: { origin: ORIGIN, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }, ctx);
const kt = await login('kellie@example.org', 'kellie-pass-123456'), vt = await login('viewer@example.org', 'viewer-pass-123456');
let r = await ask('team-hq', null, { prompt: 'hi' }); ok('signed out: refused', r.statusCode === 401);
r = await ask('hub', kt, { prompt: 'hi' }); ok('a tool without ask: 403 ASK_OFF', r.statusCode === 403 && J(r).error === 'ASK_OFF');
r = await ask('team-hq', kt, { prompt: 'hi' }); ok('no key yet: 503 ASK_NOT_SET_UP (after the opt-in check)', r.statusCode === 503 && J(r).error === 'ASK_NOT_SET_UP');
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
r = await ask('team-hq', kt, { prompt: '' }); ok('empty question: 400 NO_PROMPT, says it reads images and PDFs, costs nothing', r.statusCode === 400 && J(r).error === 'NO_PROMPT' && J(r).images === true && J(r).pdf === true && sent === null);
r = await ask('team-hq', vt, { prompt: 'What is late?' }); ok('a View account may ask: 200 with the answer, model and counts', r.statusCode === 200 && J(r).text === 'Three tasks are late.' && J(r).model === 'claude-sonnet-5-5-x' && J(r).usage.in === 1200 && J(r).usage.out === 40);
ok('...the call: the key in the header, the version, Sonnet by default, 1000 tokens, the question last', sent.headers['x-api-key'] === 'sk-ant-test' && sent.headers['anthropic-version'] === '2023-06-01' && sent.body.model === 'claude-sonnet-5-5' && sent.body.max_tokens === 1000 && sent.body.messages[0].content.at(-1).text === 'What is late?');
process.env.ANTHROPIC_MODEL_COMPLEX = 'claude-opus-5-5';
r = await ask('team-hq', kt, { prompt: 'Plan my day', tier: 'complex' }); ok('complex: 1500 tokens and the complex model when set', sent.body.max_tokens === 1500 && sent.body.model === 'claude-opus-5-5');
delete process.env.ANTHROPIC_MODEL_COMPLEX; process.env.ASK_PER_HOUR = '50';
r = await ask('team-hq', kt, { prompt: 'Read this receipt', files: [{ mediaType: 'image/jpeg', data: 'AAAA' }, { mediaType: 'application/pdf', data: 'BBBB' }] });
const c = sent.body.messages[0].content; ok('receipts: a picture and a PDF as blocks, the question after them', r.statusCode === 200 && c[0].type === 'image' && c[0].source.media_type === 'image/jpeg' && c[1].type === 'document' && c[2].type === 'text');
r = await ask('team-hq', kt, { prompt: 'x', files: [{ mediaType: 'text/html', data: 'AA' }] }); ok('another file type: 400 FILE_TYPE', r.statusCode === 400 && J(r).error === 'FILE_TYPE');
r = await ask('team-hq', kt, { prompt: 'x', files: [1, 2, 3, 4].map(() => ({ mediaType: 'image/png', data: 'AA' })) }); ok('four files: refused', r.statusCode === 400 && J(r).error === 'TOO_MANY_FILES');
r = await ask('team-hq', kt, { prompt: 'x', files: [{ mediaType: 'image/png', data: 'A'.repeat(6_300_000) }] }); ok('over 4.5 MB of files: 413 FILE_TOO_BIG', r.statusCode === 413 && J(r).error === 'FILE_TOO_BIG');
for (const [st, code, label] of [[429, 'RATE_LIMITED', 'Anthropic 429'], [529, 'RATE_LIMITED', 'Anthropic 529 (overloaded)'], [401, 'ASK_KEY', 'key refused (401)'], [500, 'ASK_FAILED', 'Anthropic 500']]) {
  anth.status = st; r = await ask('team-hq', kt, { prompt: 'x' }); ok(`${label}: ${code}`, J(r).error === code && r.statusCode === (st === 429 || st === 529 ? 429 : 502)); }
anth.status = 200; hang = true;
r = await ask('team-hq', kt, { prompt: 'slow' }, { getRemainingTimeInMillis: () => 5_200 }); ok('no answer before the function times out: 504 ASK_TIMEOUT', r.statusCode === 504 && J(r).error === 'ASK_TIMEOUT');
hang = false; process.env.ASK_PER_HOUR = '1';
const v2 = vt; r = await ask('team-hq', v2, { prompt: 'again' }); ok('over the hourly limit per person: 429 RATE_LIMITED', r.statusCode === 429 && J(r).error === 'RATE_LIMITED');
ok('logs hold counts only, never the question or the answer', !logs.some(l => /What is late|Three tasks|Read this receipt|Plan my day/.test(l)) && logs.some(l => l.includes('"ask":"team-hq"')));
r = await handler({ rawPath: '/team-hq/data/board', requestContext: { http: { method: 'PUT' } }, headers: { origin: ORIGIN, authorization: 'Bearer ' + vt }, body: JSON.stringify({ content: {}, sha: null }) });
ok('a View account still cannot save', r.statusCode === 403 && J(r).error === 'VIEW_ONLY');
