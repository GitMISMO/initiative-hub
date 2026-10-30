/* The Scheduler's outside-guest routes (relay request 10; sent as request 11). Run: node test-scheduler.mjs. A stand-in GitHub and mail flow, as in test-ideas.mjs. */
const ORIGIN = 'https://resources.example';
Object.assign(process.env, { GITHUB_TOKEN: 'ghp_test', AUTH_SECRET: 'sched-test-secret', PROJECTS_REPO: 'Org/Config', DIRECTORY_REPO: 'Org/Accounts', MAIL_FLOW_URL: 'https://flow.example/mail' });
let N = 100; const sha = () => (N++).toString(16).padEnd(40, 'b'); const repo = {};
const put = (key, data, message = 'seed') => { (repo[key] = repo[key] || []).push({ sha: sha(), data, message }); };
put('Org/Config:projects.json', { scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], ask: true }, 'hub-requests': { repo: 'Org/Requests', origin: ORIGIN, writable: ['data/'] } });
put('Org/Accounts:access.json', { people: {} });
const CODE_B = 'AbCdEfGhIjKlMnOpQrStUvWx', CODE_J = 'ZyXwVuTsRqPoNmLkJiHgFeDc';
const T0 = Date.now() + 5 * 86400000;
const REQ = { id: 'vq7m2k9p4a', title: 'MISMO Membership Info_VeriQual', purpose: 'Membership benefits.', owner: 'vrios@mismo.org', ownerName: 'Vanessa Rios', duration: 30, where: 'Zoom',
  internal: ['kelly'], source: 'SECRET EMAIL TEXT', log: [{ at: 1, by: 'Vanessa', what: 'Started' }],
  slots: [{ id: 'v0', s: T0, e: T0 + 1800000 }, { id: 'v1', s: T0 + 7200000, e: T0 + 9000000 }, { id: 'old', s: Date.now() - 86400000, e: Date.now() - 84600000 }],
  guests: [{ id: 'g1', code: CODE_B, name: 'Bryan Crosby', email: 'bryan@veriqual.co', org: 'VeriQual', sentAt: 1 }, { id: 'g2', code: CODE_J, name: 'John McNeely', email: 'john@veriqual.co', org: 'VeriQual', sentAt: 1 }] };
put('Org/Sched:data/requests.json', { docs: { [REQ.id]: REQ } });
const mails = [];
const R = (status, j) => ({ status, ok: status < 300, headers: { get: () => null }, json: async () => j, text: async () => '' });
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (url === 'https://flow.example/mail') { mails.push(JSON.parse(opts.body)); return R(202, {}); }
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)/);
  if (!m) return R(404, {});
  const key = m[1] + ':' + decodeURIComponent(m[2]), h = repo[key];
  if (method === 'GET') { const v = h && h[h.length - 1]; if (!v) return R(404, {}); return R(200, { sha: v.sha, content: Buffer.from(JSON.stringify(v.data)).toString('base64') }); }
  if (method === 'PUT') { const body = JSON.parse(opts.body), cur = h && h[h.length - 1];
    if ((cur ? cur.sha : undefined) !== (body.sha || undefined)) return R(409, {});
    put(key, JSON.parse(Buffer.from(body.content, 'base64').toString()), body.message); return R(200, { content: { sha: repo[key].at(-1).sha } }); }
  return R(405, {});
};
const { handler, __resetProjectsCache } = await import('./index.mjs');
let failed = 0; const ok = (n, c, d) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 300))); };
const J = r => JSON.parse(r.body);
const call = (m, path, { body, origin = ORIGIN, ip = '203.0.113.1' } = {}) => handler({ rawPath: path, requestContext: { http: { method: m, sourceIp: ip } },
  headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const file = () => repo['Org/Sched:data/requests.json'].at(-1).data.docs[REQ.id];
let r, d;

/* ---------- switched off until projects.json says guestLinks: true (Perry, 30 Oct 2026) ---------- */
{
  const before = repo['Org/Sched:data/requests.json'].length; mails.length = 0;
  r = await call('GET', '/scheduler/poll/ready'); ok('off by default: ready answers 404, so the live page keeps guest links off', r.statusCode === 404 && J(r).error === 'NOT_FOUND', J(r));
  r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B } }); ok('...a right link can\u2019t view', r.statusCode === 404);
  r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g1.' + CODE_B, yes: ['v0'], startedAt: Date.now() - 9000 } });
  ok('...or answer: nothing written, nobody emailed', r.statusCode === 404 && repo['Org/Sched:data/requests.json'].length === before && mails.length === 0);
  put('Org/Config:projects.json', { scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], ask: true, guestLinks: 'yes' }, 'hub-requests': { repo: 'Org/Requests', origin: ORIGIN, writable: ['data/'] } });
  __resetProjectsCache();
  r = await call('GET', '/scheduler/poll/ready'); ok('anything but exactly true stays off', r.statusCode === 404);
  put('Org/Config:projects.json', { scheduler: { repo: 'Org/Sched', origin: ORIGIN, writable: ['data/'], ask: true, guestLinks: true }, 'hub-requests': { repo: 'Org/Requests', origin: ORIGIN, writable: ['data/'], guestLinks: true } });
  __resetProjectsCache();
}
/* ---------- switched on: the rest of this suite ---------- */

r = await call('GET', '/scheduler/poll/ready'); ok('ready: 200 ok, no sign-in', r.statusCode === 200 && J(r).ok === true, J(r));
r = await call('GET', '/hub-requests/poll/ready'); ok('...only on the scheduler project', r.statusCode === 404);

r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B } }); d = J(r);
ok('view with the right link: the meeting and the future times', r.statusCode === 200 && d.title === REQ.title && d.status === 'open' && d.slots.length === 2 && d.guest === 'Bryan Crosby', d);
const txt = r.body;
ok('...and nothing about anyone else or the request’s insides', !/john|McNeely|kelly|SECRET|code|AbCd|ZyXw|Started/i.test(txt), txt);
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_J } }); ok('another guest’s code for this guest: 404', r.statusCode === 404 && J(r).error === 'NOT_FOUND');
r = await call('POST', '/scheduler/poll/view', { body: { r: 'zzzzzzzz', g: 'g1.' + CODE_B } }); ok('unknown request: the same 404', r.statusCode === 404 && J(r).error === 'NOT_FOUND');
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.short' } }); ok('malformed code: 404', r.statusCode === 404);
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B }, origin: 'https://evil.example' }); ok('another site: refused', r.statusCode === 403 && J(r).error === 'ORIGIN');
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B }, origin: null }); ok('no Origin: refused', r.statusCode === 403);

mails.length = 0;
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g1.' + CODE_B, yes: ['v0', 'nope', 'v0'], maybe: ['v1', 'v0'], note: 'Mornings  best.\r\nThanks', startedAt: Date.now() - 10000, website: '' } });
ok('answer: saved', r.statusCode === 200 && J(r).ok === true, J(r));
const g1 = file().guests[0];
ok('...only known times, no duplicates, a time not both yes and maybe', JSON.stringify(g1.answer.yes) === '["v0"]' && JSON.stringify(g1.answer.maybe) === '["v1"]' && g1.answer.via === 'link', g1.answer);
ok('...note kept with line breaks normalised', g1.answer.note === 'Mornings  best.\nThanks', g1.answer.note);
ok('...the code, the other guest, times and source untouched', g1.code === CODE_B && !file().guests[1].answer && file().slots.length === 3 && file().source === 'SECRET EMAIL TEXT');
ok('...a line in the log', file().log.at(-1).what === 'Answered through their link' && file().log.at(-1).by === 'Bryan Crosby');
const mail = mails.find(x => x.kind === 'scheduler-answer');
ok('the organizer is emailed, with who is still to answer', mail && mail.to === 'vrios@mismo.org' && /1 of 3 work, 1 maybe/.test(mail.text) && /Still waiting on: John McNeely/.test(mail.text) && /#r=vq7m2k9p4a/.test(mail.text), mail && mail.text);
ok('nothing is emailed to the guest', !mails.some(x => /veriqual/.test(x.to)));
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B } }); ok('view afterwards shows their own answer back', J(r).answer && J(r).answer.yes[0] === 'v0');

const before = repo['Org/Sched:data/requests.json'].length;
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_J, yes: ['v0'], startedAt: Date.now() - 10000, website: 'http://spam' } });
ok('a robot (hidden field filled): looks accepted, nothing kept', r.statusCode === 200 && repo['Org/Sched:data/requests.json'].length === before);
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_J, yes: ['v0'], startedAt: Date.now() } });
ok('sent too fast: looks accepted, nothing kept', r.statusCode === 200 && repo['Org/Sched:data/requests.json'].length === before);
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_B, yes: ['v0'], startedAt: Date.now() - 9000 } });
ok('wrong code on answer: 404 and nothing kept', r.statusCode === 404 && repo['Org/Sched:data/requests.json'].length === before);
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_J, yes: [], note: 'x'.repeat(1001), startedAt: Date.now() - 9000 } });
ok('a note over 1,000 characters: refused', r.statusCode === 400);

/* booked: closed */
const booked = JSON.parse(JSON.stringify(file())); booked.status = 'booked'; booked.chosen = 'v1'; put('Org/Sched:data/requests.json', { docs: { [REQ.id]: booked } });
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g2.' + CODE_J } }); d = J(r);
ok('view once booked: the booked time, no times to pick', d.status === 'booked' && d.chosen && d.chosen.id === 'v1' && d.slots.length === 0, d);
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_J, yes: ['v0'], startedAt: Date.now() - 9000 } });
ok('answer once booked: 409 CLOSED', r.statusCode === 409 && J(r).error === 'CLOSED');
ok('...saying booked', J(r).status === 'booked' && /already booked/.test(J(r).message), J(r));
/* cancelled: closed too, and says so (Perry, 30 Oct 2026) */
const cancelled = JSON.parse(JSON.stringify(booked)); cancelled.status = 'cancelled'; delete cancelled.chosen; put('Org/Sched:data/requests.json', { docs: { [REQ.id]: cancelled } });
r = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.' + CODE_J, yes: ['v0'], startedAt: Date.now() - 9000 }, ip: '198.51.100.20' });
ok('answer once cancelled: still 409 CLOSED (the live page knows it), but says cancelled, not booked', r.statusCode === 409 && J(r).error === 'CLOSED' && J(r).status === 'cancelled' && !/booked/.test(J(r).message), J(r));
put('Org/Sched:data/requests.json', { docs: { [REQ.id]: booked } });

/* rate limit */
let last; for (let i = 0; i < 12; i++) last = await call('POST', '/scheduler/poll/answer', { body: { r: REQ.id, g: 'g2.bad', startedAt: Date.now() - 9000 }, ip: '198.51.100.9' });
ok('more than 10 answers an hour from one address: 429', last.statusCode === 429);
r = await call('POST', '/scheduler/poll/view', { body: { r: REQ.id, g: 'g1.' + CODE_B }, ip: '198.51.100.10' }); ok('...another address is unaffected', r.statusCode === 200);
r = await call('PUT', '/scheduler/poll/answer', { body: {} }); ok('wrong method: 405', r.statusCode === 405);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed'); process.exit(failed ? 1 : 0);
