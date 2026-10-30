/* The MISMO Link AI beta signing route (relay request 11; Jonna, 30 Oct 2026).
 * Run: node test-agreements.mjs. A stand-in GitHub and mail flow, as in test-ideas.mjs. */
import { pbkdf2Sync } from 'node:crypto';
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'agr-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
const pb = pw => { const s = 'cc'.repeat(16); return `pbkdf2$1000$${s}$${pbkdf2Sync(pw, Buffer.from(s, 'hex'), 1000, 32, 'sha256').toString('hex')}`; };
const PW = 'A-Long-Enough-Pass-1';
const people = {
  'jonna@example.org': { name: 'Jonna Critchley', hash: pb(PW), access: { 'mismo-link': 'admin' } },
  'staff@example.org': { name: 'Staff Person', hash: pb(PW), access: { 'mismo-link': 'staff' } } };
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
put('Org/Config:projects.json', { 'mismo-link': { repo: 'Org/LinkData', origin: ORIGIN, writable: ['data/'] }, hub: { repo: 'Org/Hub', origin: ORIGIN, writable: ['data/'] } });
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
    const bytes = Buffer.from(JSON.stringify(v.data));
    if ((opts.headers || {}).Accept === 'application/vnd.github.raw') return { status: 200, ok: true, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    return R(200, { sha: v.sha, content: bytes.toString('base64') }); }
  if (method === 'PUT') { if (ghDown) return R(500, {}); const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(cur ? 200 : 201, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const relay = await import('./index.mjs'); const { handler } = relay;
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 300))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1', raw } = {}) => handler({ rawPath: path, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json' }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
const sigFile = () => (repo['Org/LinkData:data/signatures.json'] || []).at(-1)?.data;
const SUB = { kind: 'subscriber', form: 'MISMO Link AI SaaS Subscriber Agreement', agreementTitle: 'MISMO Link AI SaaS Subscriber Agreement', agreementVersion: '1.0 (updated 07/01/2026)',
  organization: 'NFTY Door', signerName: 'Erica Sands', signerTitle: 'VP of Product', signerEmail: 'erica.sands@nftydoor.example', signerPhone: '',
  typedSignature: 'erica sands', acceptanceStatement: 'I have read the MISMO Link AI SaaS Subscriber Agreement and agree on behalf of the company.',
  readToEnd: true, documentHash: 'a'.repeat(64), signedOnLocal: 'October 30, 2026 at 11:21 AM MDT', timeZone: 'America/Denver', pageUrl: 'https://resources.mismo.org/mismo-link/sign/', userAgent: 'test', website: '' };
const USER = { ...SUB, kind: 'user', form: 'MISMO Link AI User SaaS Agreement', agreementTitle: 'MISMO Link AI User SaaS Agreement', signerName: 'Ryan Morrison', typedSignature: 'Ryan Morrison', signerEmail: 'ryan@nftydoor.example', signerTitle: 'Strategic Initiatives' };
const send = (b, o = {}) => call('POST', '/mismo-link/agreements/submit', { body: { ...b, startedAt: Date.now() - 60_000 }, ...o });
let r, d;

/* ---------- with no Who Is Told list: MISMO Link admins are told ---------- */
mails.length = 0;
r = await send(SUB, { ip: '198.51.100.1' }); d = J(r);
ok('a company signs, no sign-in: accepted with a reference', r.statusCode === 200 && d.ok && d.reference === 'SIG-0001' && /^\d{4}-\d{2}-\d{2}$/.test(d.followUpBy), d);
const s1 = sigFile().docs['signatures/SIG-0001'];
ok('kept in the private mismo-link-data repository with what was signed, the IP, and no robot checks', s1 && s1.kind === 'subscriber' && s1.organization === 'NFTY Door' && s1.documentHash === 'a'.repeat(64) && s1.ip === '198.51.100.1' && s1.readToEnd === true && !('website' in s1) && !('startedAt' in s1), s1);
const copy = mails.find(x => x.kind === 'agreement-copy');
ok('the signer gets a copy: agreement, reference, kick-off next step', copy && copy.to === SUB.signerEmail && copy.subject.includes('SIG-0001') && copy.text.includes('kick-off call within 3 business days') && copy.text.includes('/mismo-link/sign/'), copy && copy.text);
ok('...which repeats nothing they typed', copy && !['NFTY', 'Erica', 'VP of Product'].some(t => (copy.subject + copy.text).includes(t)));
let alerts = mails.filter(x => x.kind === 'agreement-alert');
ok('no Who Is Told list yet: MISMO Link administrators are told (not staff)', JSON.stringify(alerts.map(x => x.to)) === '["jonna@example.org"]', alerts.map(x => x.to));

/* ---------- with Kellie on the list ---------- */
put('Org/LinkData:data/settings.json', { notify: [{ name: 'Kellie Stoll', email: 'kstoll@example.org' }, { name: 'Bad', email: 'not-an-email' }] });
mails.length = 0;
r = await send(SUB, { ip: '198.51.100.2' });
alerts = mails.filter(x => x.kind === 'agreement-alert');
ok('Subscriber Agreement: Kellie is told (and only valid addresses on the list)', JSON.stringify(alerts.map(x => x.to)) === '["kstoll@example.org"]', alerts.map(x => x.to));
ok('...to schedule the kick-off and send the User Agreement link, with the signer’s details', alerts[0] && /kick-off/.test(alerts[0].subject) && alerts[0].text.includes('Hello Kellie Stoll') && alerts[0].text.includes('/mismo-link/user/') && alerts[0].text.includes('Erica Sands, VP of Product') && alerts[0].text.includes(SUB.signerEmail), alerts[0] && alerts[0].text);
mails.length = 0;
r = await send(USER, { ip: '198.51.100.3' }); d = J(r);
ok('a tester signs the User Agreement: SIG-0003, kind user', d.reference === 'SIG-0003' && sigFile().docs['signatures/SIG-0003'].kind === 'user', d);
alerts = mails.filter(x => x.kind === 'agreement-alert'); const c3 = mails.find(x => x.kind === 'agreement-copy');
ok('...Kellie is told to set them up', alerts.length === 1 && alerts[0].to === 'kstoll@example.org' && /User Agreement signed: Ryan Morrison, NFTY Door/.test(alerts[0].subject) && /set them up/.test(alerts[0].text), alerts[0]);
ok('...and the tester’s copy says instructions and credentials within 3 business days', c3 && c3.text.includes('instructions and credentials'), c3 && c3.text);

/* ---------- what is refused ---------- */
const before = Object.keys(sigFile().docs).length; mails.length = 0;
r = await send(SUB, { origin: 'https://elsewhere.example', ip: '192.0.2.1' }); ok('from another site: refused', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await send({ ...SUB, website: 'x' }, { ip: '192.0.2.2' }); ok('the hidden field filled: as if accepted, no reference', J(r).reference === null);
r = await call('POST', '/mismo-link/agreements/submit', { body: { ...SUB, startedAt: Date.now() - 500 }, ip: '192.0.2.3' }); ok('signed under 3 seconds after opening: the same', J(r).reference === null);
ok('...none of those kept anything or emailed anyone', Object.keys(sigFile().docs).length === before && mails.length === 0);
r = await send({ ...SUB, typedSignature: 'Somebody Else' }, { ip: '192.0.2.4' }); ok('a typed signature that is not the signer’s name: refused', r.statusCode === 400 && J(r).problems.some(p => /must match/.test(p)), J(r));
r = await send({ ...SUB, readToEnd: false }, { ip: '192.0.2.5' }); ok('not read to the end: refused', r.statusCode === 400);
r = await send({ ...SUB, agreementTitle: 'Some Other Contract' }, { ip: '192.0.2.6' }); ok('an agreement that is not one of the two: refused', r.statusCode === 400 && J(r).problems.some(p => /not one of/.test(p)));
r = await send({ ...SUB, signerEmail: 'nope' }, { ip: '192.0.2.7' }); ok('no proper email: refused', r.statusCode === 400);
r = await send({ ...SUB, acceptanceStatement: 'x'.repeat(40_000) }, { ip: '192.0.2.8' }); ok('more than 32 kB: refused before reading', r.statusCode === 413);
r = await call('POST', '/hub/agreements/submit', { body: { ...SUB, startedAt: Date.now() - 60_000 }, ip: '192.0.2.9' }); ok('only MISMO Link takes agreements', r.statusCode === 404);
for (let i = 0; i < 5; i++) await send(SUB, { ip: '192.0.2.50' });
r = await send(SUB, { ip: '192.0.2.50' }); ok('a sixth in an hour from one address: asked to wait', r.statusCode === 429);
mailDown = true; r = await send(SUB, { ip: '192.0.2.60' }); mailDown = false;
ok('if the emails fail, the signature is still kept', r.statusCode === 200 && sigFile().docs['signatures/' + J(r).reference]);
ghDown = true; r = await send(SUB, { ip: '192.0.2.61' }); ghDown = false;
ok('if GitHub can’t save it, the signer is told to try again (and the page keeps a file)', r.statusCode === 502 && J(r).error === 'NOT_SAVED');
r = await call('OPTIONS', '/mismo-link/agreements/submit', { ip: '192.0.2.70' });
ok('the browser’s preflight is answered for the site', r.statusCode === 204 && JSON.stringify(r.headers || {}).includes(ORIGIN), r.headers);

/* ---------- the version in the signer's copy (Perry, 30 Oct 2026) ---------- */
ok('the signer’s copy names the version the pages send', copy && copy.text.includes('Subscriber Agreement, Version 1.0 (updated 07/01/2026), was signed'), copy && copy.text);
mails.length = 0;
r = await send({ ...SUB, agreementVersion: '1.0 call 555-0100 or see evil.example now' }, { ip: '192.0.2.80' }); d = J(r);
const odd = mails.find(x => x.kind === 'agreement-copy');
ok('a version that isn’t a plain version number: still accepted, never refused', r.statusCode === 200 && /^SIG-\d{4}$/.test(d.reference || ''), d);
ok('...but left out of the copy, which can’t carry someone’s own words to the address they typed', odd && !/evil\.example|555-0100/.test(odd.subject + odd.text) && odd.text.includes('SaaS Subscriber Agreement was signed electronically'), odd && odd.text);
ok('...and the record keeps the version as it was sent', sigFile().docs['signatures/' + d.reference].agreementVersion === '1.0 call 555-0100 or see evil.example now');
mails.length = 0;
r = await send({ ...SUB, agreementVersion: '2.1' }, { ip: '192.0.2.81' });
const v21 = mails.find(x => x.kind === 'agreement-copy');
ok('a later plain version (2.1) is named without a relay change', r.statusCode === 200 && v21 && v21.text.includes(', Version 2.1, was signed'), v21 && v21.text);

console.log(failed ? `\n${failed} FAILED` : '\nall passed'); process.exit(failed ? 1 : 0);
