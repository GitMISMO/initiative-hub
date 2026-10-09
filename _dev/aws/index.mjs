/* MISMO Initiative Hub — save relay
 *
 * One Lambda, one job: accept a dashboard save from someone who holds a valid key, and
 * commit it to the repository with the single GitHub token that lives here and nowhere
 * else. Nobody but the AWS account holder ever sees that token.
 *
 * WHO CAN DO WHAT
 * Keys are managed in the repository, not here. The file facilitators.json at the repo
 * root holds one admin and any number of facilitators, each as a display name plus the
 * SHA-256 hash of a generated passcode. This function reads that file from GitHub on
 * each request (cached briefly), so adding or removing a person is a commit — made in
 * the GitHub web UI, or by the admin panel through this relay — and needs no AWS access.
 *
 * Access is held per tool, at one of three levels. The central directory
 * (_internal/access.json, described under THE DIRECTORY) is the source; a tool's own
 * facilitators.json is the fallback for anything that predates it.
 *
 *   view          read a tool. Every write route refuses them, whatever the page shows.
 *   staff         read and write
 *   admin         everything staff can do, plus read and write that tool's own settings
 *
 * No entry for a tool means no access to it; there is no fourth "none" value to store.
 * Platform administration — editing who holds what — is a separate flag on the person,
 * not a level, so nobody acquires it by being an admin of something.
 *
 * The file is public (the repo is), which is why it holds hashes and why passcodes must
 * be generated, never chosen. key-helper.html generates them.
 *
 * ENVIRONMENT VARIABLES (set once, by whoever owns the AWS account)
 *   GITHUB_TOKEN     Fine-grained PAT owned by the repository's owner. This repo only,
 *                    Contents: Read and write. The only secret in the system.
 *   GITHUB_REPO      e.g. YourOrg/initiative-hub
 *   GITHUB_BRANCH    e.g. main
 *   ALLOWED_ORIGIN   e.g. https://yourorg.github.io   (exactly, no trailing slash)
 *
 * ROUTES (all under the function URL; key in header X-Facilitator-Key as "Name:passcode")
 *   GET  /data/{id}       Fresh read of data/{id}.json with its blob SHA.   facilitator+
 *   PUT  /data/{id}       Commit a new version. Body: {content, sha}.       facilitator+
 *   GET  /facilitators    The list (with hashes — the panel resends them) + SHA. admin
 *   PUT  /facilitators    Replace the list. Body: {facilitators, sha}.      admin
 *                         The admin entry is preserved as-is; it cannot be changed
 *                         through this route, so the admin can't lock themselves out.
 *                         To rotate the admin key, edit facilitators.json directly.
 *   GET  /potential/{id}  Read data/potential/{id}.json with its SHA.       facilitator+
 *   PUT  /potential/{id}  Create or update one. Body: {content, sha}.       facilitator+
 *                         Validated (stage, engagement, stakeholder types against
 *                         stakeholder-types.json). On create, the id is added to
 *                         data/potential/index.json, which is what the hub lists.
 *   GET  /config/{name}   Read a global config file with its SHA.           admin
 *   PUT  /config/{name}   Replace it. Body: {content, sha}. Validated.      admin
 *                         Only names in CONFIG_FILES are served. For stakeholder-types,
 *                         the `usage` index is preserved from the current file, never
 *                         taken from the body — it is maintained by _dev/check-types.py.
 *   OPTIONS *             CORS preflight. Handled here — leave CORS DISABLED on the
 *                         function URL, or the browser gets duplicate headers.
 *
 * THE LOCK
 * Every PUT carries the SHA of the version the caller READ. It is forwarded to GitHub
 * untouched; GitHub refuses with 409 if anyone committed since, and that comes straight
 * back. This function must never fetch a fresh SHA on the caller's behalf.
 *
 * No AWS services are called and no data is stored here.
 */

import { createHash, createHmac, timingSafeEqual, pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* The fingerprint of the code actually running.
 *
 * Code changes only reach AWS when someone uploads them; nothing redeploys on push. That
 * once broke every sign-in: the account file changed to a format only newer code could
 * read, while older code was still running, and nothing said so. GET /version returns a
 * SHA-256 of this very file, so "is the deployed relay current?" is answered by comparing
 * it with the same hash of index.mjs in the repository — no version number to remember
 * to bump, because the file fingerprints itself. */
/* Normalised before hashing: Windows line endings become Unix ones and trailing blank
 * space at the very end is dropped. Pasting through the Lambda console on Windows does
 * both, and before this a correct deploy reported a different value from the one the
 * request predicted, and looked for twenty minutes like a failed one (Sept 2026). The
 * code is the same either way, so the fingerprint now is too. Compare with:
 *   python3 -c "import hashlib,re; t=open('_dev/aws/index.mjs',encoding='utf-8').read(); \
 *     print(hashlib.sha256(re.sub(r'\s+$','',t.replace('\r\n','\n')).encode()).hexdigest())" */
export function fingerprint(text) {
  return createHash('sha256').update(String(text).replace(/\r\n/g, '\n').replace(/\s+$/, ''), 'utf8').digest('hex');
}
let SOURCE_SHA256 = 'unknown';
try { SOURCE_SHA256 = fingerprint(readFileSync(fileURLToPath(import.meta.url), 'utf8')); }
catch (e) { /* unreadable in some test harnesses; the route then reports 'unknown' */ }

const GITHUB_API = 'https://api.github.com';
/* Under _internal/ so GitHub Pages does not serve it. Jekyll skips underscore-prefixed
 * paths, and the relay reads this through the GitHub API rather than over the web, so the
 * move is invisible to it. At the repository root the file was downloadable by anyone at
 * <site>/facilitators.json, which published the list of everyone holding edit access. */
const FACILITATORS_PATH = '_internal/facilitators.json';
const PBKDF2_ITERATIONS = 210000;        // OWASP's 2023 floor for PBKDF2-HMAC-SHA256
const PBKDF2_KEYLEN = 32;
const TOKEN_TTL_SECONDS = 4 * 60 * 60;
const VIEW_AS_SECONDS = 30 * 60;           // View as lasts half an hour (relay request 9)   // four hours; typical sessions run one to two
const ACCESS_PATH_DEFAULT = '_internal/access.json';
/* The sections of People & Access in the admin panel. Kept with each person, set by admins. */
const PEOPLE_GROUPS = new Set(['staff', 'facilitator', 'contractor', 'process']);   /* facilitator: relay request 9 (Perry, 6 Oct 2026) */
const ACCESS_CACHE_MS = 30000;           // a permission change lands within half a minute
const FACILITATORS_CACHE_MS = 30_000;              // revocation lands within half a minute
const PROJECTS_CACHE_MS = 60_000;                  // a newly added tool is live within a minute
const MAX_BODY_BYTES = 1_000_000;                  // dashboards are ~10 KB; 1 MB is generous
/* /commit carries whole files. Publishing the glossary sends data/glossary.json, 2.8 MB
 * and growing, plus the draft and reference files, all escaped inside a JSON body (about
 * 3.5 MB today), so 1 MB made publishing impossible (Sept 28, 2026). A Function URL accepts
 * at most 6 MB per request; this stays under that with room for the envelope. */
const MAX_COMMIT_BYTES = 5_500_000;
const DASHBOARD_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;   // data/<id>.json — no dots, no slashes
const RESERVED_IDS = new Set(['facilitators', 'stakeholder-types']);   // never dashboards
/* Global config files the admin may edit through /config/{name}, with a validator each. */
const CONFIG_FILES = {
  'stakeholder-types': {
    path: 'stakeholder-types.json',
    validate(body, current) {
      if (!body || !Array.isArray(body.types)) return { error: 'BAD_CONTENT' };
      const keys = new Set(), names = new Set(), types = [];
      for (const t of body.types) {
        const key = typeof t?.key === 'string' ? t.key.trim() : '';
        const name = typeof t?.name === 'string' ? t.name.trim() : '';
        if (!key || key.length > 80) return { error: 'BAD_KEY', key };
        if (!name || name.length > 80) return { error: 'BAD_NAME', key };
        if (keys.has(key)) return { error: 'DUPLICATE_KEY', key };
        if (names.has(name.toLowerCase())) return { error: 'DUPLICATE_NAME', key };
        keys.add(key); names.add(name.toLowerCase());
        types.push({ key, name });
      }
      // A type still referenced by a dashboard cannot be removed. usage comes from the
      // committed file, so the guard cannot be bypassed by editing the request.
      const usage = current?.usage && typeof current.usage === 'object' ? current.usage : {};
      for (const [dash, used] of Object.entries(usage)) {
        for (const k of used) if (!keys.has(k)) return { error: 'IN_USE', key: k, dashboard: dash };
      }
      return { content: { types, usage } };
    }
  }
};
const SHA256_HEX = /^[a-f0-9]{64}$/;
const PBKDF2_STORED = /^pbkdf2\$\d{4,}\$[a-f0-9]{16,}\$[a-f0-9]{64}$/;
const isStoredHash = (h) => PBKDF2_STORED.test(h) || SHA256_HEX.test(h);
const POTENTIAL_INDEX = 'data/potential/index.json';
const STAGES = new Set(['not-started', 'in-progress', 'in-approvals', 'kickoff-set', 'launched']);
const ENGAGEMENTS = new Set(['not-contacted', 'declined', 'contacted', 'interested', 'committed']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEADERSHIP_ROLES = new Set(['Chair', 'Vice-Chair', 'Architecture Representative', 'Information Management Representative', 'Education Representative']);

/* A potential-initiative record, checked field by field. Returns {content} or {error, …}.
 * `typeKeys` is the set of keys in stakeholder-types.json; anything else is refused so a
 * record can't reference a type the admin panel doesn't know about. */
function validatePotential(id, body, typeKeys) {
  if (!body || typeof body !== 'object') return { error: 'BAD_CONTENT' };
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = str(body.name, 160);
  if (!name) return { error: 'BAD_NAME' };
  const stage = str(body.stage, 20) || 'not-started';
  if (!STAGES.has(stage)) return { error: 'BAD_STAGE', stage };
  const dateLogged = str(body.dateLogged, 10);
  if (dateLogged && !ISO_DATE.test(dateLogged)) return { error: 'BAD_DATE' };

  const stakeholderTypes = [];
  for (const t of Array.isArray(body.stakeholderTypes) ? body.stakeholderTypes : []) {
    const k = str(t, 80);
    if (!typeKeys.has(k)) return { error: 'UNKNOWN_TYPE', type: k };
    if (!stakeholderTypes.includes(k)) stakeholderTypes.push(k);
  }
  const organizations = [];
  for (const o of Array.isArray(body.organizations) ? body.organizations : []) {
    const org = str(o?.org, 120), type = str(o?.type, 80), engagement = str(o?.engagement, 20) || 'not-contacted';
    if (!org) return { error: 'BAD_ORG' };
    if (!typeKeys.has(type)) return { error: 'UNKNOWN_TYPE', type, org };
    if (!ENGAGEMENTS.has(engagement)) return { error: 'BAD_ENGAGEMENT', org };
    organizations.push({ org, type, engagement, contact: str(o?.contact, 160), barrier: str(o?.barrier, 400), notes: str(o?.notes, 2000) });
  }
  const leadership = [];
  for (const l of Array.isArray(body.leadership) ? body.leadership : []) {
    const name = str(l?.name, 120), title = str(l?.title, 120), company = str(l?.company, 120), role = str(l?.role, 60);
    if (!name) return { error: 'BAD_LEADER' };
    if (!LEADERSHIP_ROLES.has(role)) return { error: 'BAD_ROLE', name, role };
    leadership.push({ name, title, company, role });
  }
  const potentialSolutions = [];
  for (const x of Array.isArray(body.potentialSolutions) ? body.potentialSolutions : []) {
    const t = str(x, 400); if (t) potentialSolutions.push(t);
  }
  const updates = [];
  for (const u of Array.isArray(body.updates) ? body.updates : []) {
    const text = str(u?.text, 2000), by = str(u?.by, 120), at = str(u?.at, 40);
    if (!text) return { error: 'BAD_UPDATE' };
    if (at && !Number.isFinite(Date.parse(at))) return { error: 'BAD_UPDATE_DATE' };
    updates.push({ text, by, at: at || new Date().toISOString() });
  }
  updates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { content: {
    id, name, domain: str(body.domain, 80), stage,
    summary: str(body.summary, 4000), whyRaised: str(body.whyRaised, 4000),
    broughtBy: str(body.broughtBy, 200), dateLogged,
    potentialSolutions, leadership, stakeholderTypes, organizations, updates
  } };
}
const BLOB_SHA = /^[0-9a-f]{40}$/;

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/* PROJECTS maps a project key to its repository, branch and allowed origin:
 *   {"hub":{"repo":"GitMISMO/initiative-hub","branch":"main","origin":"https://…"},
 *    "glossary":{"repo":"GitMISMO/glossary","branch":"main","origin":"https://…"}}
 *
 * Every route is prefixed with the project key, and ONE lookup resolves repo, branch,
 * origin and facilitator list together. That is deliberate: routing, the origin check and
 * the key check must never be able to disagree about which project a request belongs to,
 * or a key for one project could write to the other's repository. Nothing below may take
 * a repo from anywhere else. */
/* WHERE THE LIST LIVES. Two modes, and exactly one is authoritative at a time:
 *
 *   PROJECTS_REPO set  -> the list is projects.json in that repository. Adding a tool is
 *                         a commit, reviewable, attributable and revertible, and needs
 *                         nobody with AWS access.
 *   PROJECTS_REPO unset -> the list is the PROJECTS environment variable.
 *
 * There is deliberately no fallback from the first to the second. If the file cannot be
 * read we serve 503 rather than quietly using a stale copy from the environment: a stale
 * copy could still name a repo that has since been repointed, and writing to the wrong
 * repository is far worse than being briefly unavailable.
 *
 * This is NOT a weakening of access control. The relay's token only reaches repositories
 * it was explicitly granted, and that grant lives in GitHub under org-admin control. A
 * rogue entry here names a repo the token cannot write, and GitHub refuses it. The file
 * decides which repos the relay *knows about*; the token decides which it can *touch*. */
const projectsCache = { at: 0, value: null };
let currentProjectKey = null;   // set per request; a token is only valid for its own project
let lastKnownOrigin = null;   // see corsHeaders

/* Test hook only. Lambda never calls this — a real container simply ages out after
 * PROJECTS_CACHE_MS. It exists so the suite can simulate a cold start, which is the
 * only way to exercise the "list unreadable and nothing cached" path. */
export function __resetProjectsCache() { projectsCache.at = 0; projectsCache.value = null; lastKnownOrigin = null; __resetGithubCache(); }

function parseProjects(raw, source) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error(`${source} is not valid JSON`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON object of project keys`);
  }
  return parsed;
}

async function projects() {
  const configRepo = process.env.PROJECTS_REPO;
  if (!configRepo) {
    const value = parseProjects(env('PROJECTS'), 'PROJECTS');
    lastKnownOrigin = Object.values(value)[0]?.origin || lastKnownOrigin;
    return value;
  }

  const now = Date.now();
  if (projectsCache.value && now - projectsCache.at < PROJECTS_CACHE_MS) return projectsCache.value;

  const branch = process.env.PROJECTS_BRANCH || 'main';
  const path = process.env.PROJECTS_PATH || 'projects.json';
  const file = await readFile(configRepo, branch, path);
  let value = null;
  if (file.status === 200) {
    try { value = parseProjects(JSON.stringify(file.data), `${path} in ${configRepo}`); }
    catch (e) { console.error('projects list is the wrong shape:', e.message); }
  }
  if (value) {
    projectsCache.at = now;
    projectsCache.value = value;
    lastKnownOrigin = Object.values(value)[0]?.origin || lastKnownOrigin;
    return value;
  }

  /* Unreadable or broken. Two different failures, handled differently:
   *
   *   GitHub did not answer          -> the last good copy if this container has one.
   *   GitHub answered with a file    -> the same, and if this container is fresh, the
   *   that is not valid                most recent version in the file's history that is.
   *
   * The second exists because projects.json is edited by hand in GitHub's web editor. A
   * single trailing comma (Sept 2026) made it invalid, and every freshly started container
   * would have refused every tool until someone noticed. The previous commit is a list an
   * administrator already approved, so falling back to it is safe; the broken edit simply
   * has no effect until it is fixed. A GitHub outage is NOT given the history fallback: the
   * history would be unreachable too, and guessing would be worse than a clear 503.
   *
   * The time is updated in both cases so a broken file is re-checked once a minute, as a
   * good one is, rather than on every request. */
  const why = file.corrupt ? 'is not valid JSON' : file.status === 200 ? 'is the wrong shape' : `returned ${file.status}`;
  if (projectsCache.value) {
    console.error(`${path} in ${configRepo} ${why}; still using the last good copy`);
    projectsCache.at = now;
    return projectsCache.value;
  }
  if (file.status === 200 || file.corrupt) {
    const good = await lastGoodProjects(configRepo, branch, path);
    if (good) {
      console.error(`${path} in ${configRepo} ${why}; using the version from ${good.sha.slice(0, 7)}`);
      projectsCache.at = now;
      projectsCache.value = good.value;
      lastKnownOrigin = Object.values(good.value)[0]?.origin || lastKnownOrigin;
      return good.value;
    }
  }
  throw new Error(`CONFIG_UNAVAILABLE: ${path} in ${configRepo} ${why}`);
}

/* The newest earlier version of the project list that parses, or null. Looks back a
 * short way only: this is for a mistake made in the last edit or two, not a history
 * search, and each step is a round trip to GitHub on a request someone is waiting for. */
const PROJECTS_HISTORY_DEPTH = 5;
async function lastGoodProjects(repo, branch, path) {
  const list = await github('GET',
    `/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=${PROJECTS_HISTORY_DEPTH + 1}`);
  if (list.status !== 200 || !Array.isArray(list.json)) return null;
  /* The first entry is the current, broken version; start from the one before it. */
  for (const c of list.json.slice(1, PROJECTS_HISTORY_DEPTH + 1)) {
    const f = await readFile(repo, c.sha, path);
    if (f.status !== 200) continue;
    try { return { sha: c.sha, value: parseProjects(JSON.stringify(f.data), `${path}@${c.sha}`) }; }
    catch (e) { /* this one was broken too; keep looking */ }
  }
  return null;
}

/* Every project must live under the same owner as the config file itself. The token is
 * the real boundary, but this turns "someone added another org's repo" into a clear
 * refusal at the door instead of a 404 from GitHub three calls later. */
function sameOwner(repo, configRepo) {
  if (!configRepo) return true;
  return repo.split('/')[0].toLowerCase() === configRepo.split('/')[0].toLowerCase();
}

async function projectConfig(key) {
  const all = await projects();
  const p = all[key];
  if (!p || typeof p !== 'object') return null;
  if (typeof p.repo !== 'string' || !/^[^/]+\/[^/]+$/.test(p.repo)) return null;
  if (typeof p.origin !== 'string' || !p.origin || p.origin.endsWith('/')) return null;
  if (!sameOwner(p.repo, process.env.PROJECTS_REPO)) return null;
  /* 'writable' lists the path prefixes /commit may touch for this project. Absent or
   * empty means /commit refuses everything for it — a project has to declare what it
   * writes, rather than getting the whole repository by default. */
  const cleanPrefixes = list => Array.isArray(list)
    ? list.filter(w => typeof w === 'string' && w && !w.startsWith('/') && !w.includes('..'))
    : [];
  const writable = cleanPrefixes(p.writable);
  /* 'readable' lists prefixes this project may READ but not write. It is ADDITIVE: every
   * writable prefix stays readable, so a project that does not mention 'readable' behaves
   * exactly as it did before this existed. That is deliberate — the three tools live when
   * this was added (hub, glossary, hub-files) declare only 'writable', and none of them
   * changes by one byte.
   *
   * Why it exists: 'writable' governed reads as well, so anyone who could see a file could
   * also overwrite it. A contracting company reading its own service order could rewrite
   * its own rate. Two lists make read-only expressible.
   *
   * It deliberately cannot make a path writable-but-not-readable: nothing wants that, and
   * it would let a caller write a file it cannot read back to check. */
  const readable = Array.from(new Set([...writable, ...cleanPrefixes(p.readable)]));
  /* Relay request 9 (6 Oct 2026). 'ask': true lets the project use POST /{project}/ask, which spends money, so it is
   * opt-in per tool by a reviewed commit. 'membersOnly' names data files whose items carry a members list, each with
   * the emails that may see every item (see MEMBERS-ONLY FILES). */
  const membersOnly = {};
  if (p.membersOnly && typeof p.membersOnly === 'object' && !Array.isArray(p.membersOnly)) {
    for (const [file, all] of Object.entries(p.membersOnly)) {
      if (DASHBOARD_ID.test(file) && Array.isArray(all)) membersOnly[file] = all.filter(e => typeof e === 'string' && e.includes('@')).map(e => e.trim().toLowerCase());
    }
  }
  return { key, repo: p.repo, branch: p.branch || 'main', origin: p.origin, writable, readable, ask: p.ask === true, membersOnly };
}

/* ---------- what /commit may write ----------
 *
 * /commit writes through the Git Data API and would otherwise accept any path in the
 * repository. That is far wider than any tool needs, and it was reachable by every
 * account, not only admins. A staff account could have rewritten _internal/
 * facilitators.json — making itself an admin, or locking everyone else out — and in a
 * repository with a GitHub Actions workflow, could have rewritten the workflow and run
 * its own code in the build.
 *
 * Two layers, deliberately independent:
 *   1. The path must sit under a prefix the project declares in projects.json.
 *   2. Some locations are refused whatever a project declares: account and configuration
 *      files, CI workflows and git internals. A mistaken projects.json entry must not be
 *      able to reopen them. */
const NEVER_WRITABLE = ['_internal/', '.github/', '.git/'];

function pathAllowed(path, prefixes) {
  const p = String(path).replace(/^\.\//, '');
  if (NEVER_WRITABLE.some(n => p === n.slice(0, -1) || p.startsWith(n))) return false;
  if (!prefixes || !prefixes.length) return false;
  return prefixes.some(prefix => p.startsWith(prefix));
}

/* The write side keeps its own name. NEVER_WRITABLE applies to BOTH lists, so the account
 * list, the CI workflows and git internals stay unreadable as well as unwritable, whatever
 * either list declares. */
function commitPathAllowed(path, writable) { return pathAllowed(path, writable); }

/* ---------- GitHub ----------
 *
 * Every call to GitHub goes through github(). Reads (GET) get three things writes do not.
 *
 *   Asked, not fetched. Each answer is kept with its ETag, and the next read of the same
 *   address sends If-None-Match. An unchanged file comes back as 304, which GitHub does
 *   not count against the token's allowance of 5,000 requests an hour. Summit HQ and the
 *   Sponsorship Portal re-read their files every 20 to 30 seconds per open tab, and each
 *   container re-reads the access list and project list every 30 to 60 seconds; almost
 *   all of those find nothing new. In Sept 2026 the allowance ran out during the working
 *   day and every tool failed at once (the admin panel's "The save relay returned an
 *   error" was the part people saw).
 *
 *   One retry. A 5xx or a dropped connection is tried once more after a short pause. A
 *   rate-limit refusal is not: retrying it only spends more of what has run out.
 *
 *   The last good copy. If GitHub still refuses (5xx, no connection, or a rate limit), the
 *   read is answered from the copy last confirmed, if that was within GITHUB_STALE_MAX_MS.
 *   Not after a 401 or a permission 403, which mean the token is wrong and must surface;
 *   not for a 404; and not where the caller passes { stale: false } (the branch head read
 *   just before a commit, which must be current).
 *
 * Writes are never retried (one that timed out may have landed) and never kept. Copies
 * last only as long as the container, within GITHUB_CACHE_BYTES, so a freshly started
 * container still pays for its first read of each file. Saves are unaffected: they carry
 * the SHA the page read, and GitHub refuses a stale one whatever this layer served. */
const GITHUB_CACHE_BYTES = 64 * 1024 * 1024;        // well inside a 256 MB function
const GITHUB_CACHE_ENTRY_MAX = 8 * 1024 * 1024;     // larger answers are not kept
const GITHUB_STALE_MAX_MS = 60 * 60_000;            // covers one full rate-limit window
const GITHUB_RETRY_MS = 300;
const GITHUB_LOW_ALLOWANCE = 500;
const githubCache = new Map();                      // API path -> { etag, json, size, at }; oldest first
let githubCacheBytes = 0;
let lowAllowanceWarnedAt = 0;

/* Test hook, like __resetProjectsCache: a cold start has no copies. */
export function __resetGithubCache() { githubCache.clear(); githubCacheBytes = 0; lowAllowanceWarnedAt = 0; }

const headerOf = (res, name) => (res && res.headers && typeof res.headers.get === 'function') ? res.headers.get(name) : null;

function cacheDrop(path) {
  const hit = githubCache.get(path);
  if (hit) { githubCacheBytes -= hit.size; githubCache.delete(path); }
}
function cacheKeep(path, etag, json) {
  cacheDrop(path);
  const size = (typeof json?.content === 'string' ? json.content.length : 0) + 2048;
  if (!etag || size > GITHUB_CACHE_ENTRY_MAX) return;
  githubCache.set(path, { etag, json, size, at: Date.now() });
  githubCacheBytes += size;
  for (const [k, v] of githubCache) {
    if (githubCacheBytes <= GITHUB_CACHE_BYTES) break;
    githubCacheBytes -= v.size; githubCache.delete(k);
  }
}

function rateLimited(r) {
  if (r.status === 429) return true;
  if (r.status !== 403) return false;
  return headerOf(r.res, 'x-ratelimit-remaining') === '0' || /rate limit/i.test(r.json?.message || '');
}

/* Written to the function's log so IT can see the allowance running down before it runs out. */
function noteAllowance(res) {
  const left = headerOf(res, 'x-ratelimit-remaining');
  if (left === null || Number(left) >= GITHUB_LOW_ALLOWANCE) return;
  const now = Date.now();
  if (now - lowAllowanceWarnedAt < 60_000) return;
  lowAllowanceWarnedAt = now;
  const reset = Number(headerOf(res, 'x-ratelimit-reset')) * 1000;
  console.warn(`GitHub allowance low: ${left} requests left${reset ? ' until ' + new Date(reset).toISOString() : ''}`);
}

async function githubOnce(method, path, body, extra) {
  let res;
  const request = fetch(GITHUB_API + path, {
    method,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'mismo-initiative-hub-save-relay',
      ...(extra || {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (method !== 'GET') res = await request;       // a write that cannot connect throws, as before
  else {
    try { res = await request; }
    catch (e) { return { status: 0, json: { message: String(e && e.message || e) }, res: null }; }
  }
  let json = null;
  try { json = await res.json(); } catch { /* some errors have no body */ }
  return { status: res.status, json, res };
}

async function github(method, path, body, { stale = true } = {}) {
  if (method !== 'GET') {
    const { status, json } = await githubOnce(method, path, body);
    return { status, json };
  }
  const hit = githubCache.get(path);
  const ask = hit ? { 'If-None-Match': hit.etag } : null;
  let r = await githubOnce('GET', path, null, ask);
  if (r.status === 0 || r.status >= 500) {
    await new Promise(done => setTimeout(done, GITHUB_RETRY_MS));
    r = await githubOnce('GET', path, null, ask);
  }
  noteAllowance(r.res);

  if (r.status === 304 && hit) {                   // unchanged: free, and the copy is current
    hit.at = Date.now();
    githubCache.delete(path); githubCache.set(path, hit);
    return { status: 200, json: hit.json };
  }
  if (r.status === 200) { cacheKeep(path, headerOf(r.res, 'etag'), r.json); return { status: 200, json: r.json }; }
  if (r.status === 404) { cacheDrop(path); return { status: 404, json: r.json }; }

  const refused = r.status === 0 || r.status >= 500 || rateLimited(r);
  if (refused && stale && hit && Date.now() - hit.at < GITHUB_STALE_MAX_MS) {
    console.warn(`GitHub ${r.status || 'unreachable'} for ${path.split('?')[0]}; answering from the copy confirmed ${Math.round((Date.now() - hit.at) / 1000)}s ago`);
    return { status: 200, json: hit.json, stale: true };
  }
  return { status: r.status, json: r.json };
}

const decodeBase64Utf8 = (b64) => Buffer.from(b64.replace(/\n/g, ''), 'base64').toString('utf8');
const encodeBase64Utf8 = (obj) => Buffer.from(JSON.stringify(obj, null, 2) + '\n', 'utf8').toString('base64');

async function readFile(repo, branch, path) {
  const { status, json } = await github('GET', `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  if (status === 404) return { status, data: null, sha: null };
  if (status !== 200) return { status, data: null, sha: null, message: json?.message };
  let data;
  try { data = JSON.parse(decodeBase64Utf8(json.content)); } catch { return { status: 500, data: null, sha: null, corrupt: true }; }
  return { status, data, sha: json.sha };
}

/* ---------- facilitators ---------- */

/* Keyed BY REPOSITORY, not global. A single shared cache across projects would let a
 * cached facilitator list from one project authenticate a request for another — the exact
 * cross-project leak a shared relay has to prevent. Found by test, not by reading. */
/* ---------- the account directory ----------
 *
 * One file, in the same repository as projects.json, listing every person once:
 *
 *   { "people": {
 *       "jane@mismo.org": {
 *         "name": "Jane Facilitator",
 *         "hash": "pbkdf2$...",
 *         "expires": null,
 *         "access": { "hub": "admin", "glossary": "staff" }
 *       } } }
 *
 * Signing in is therefore global, and what you may do is per project. That is the whole
 * point: one account, permissions set per person.
 *
 * Permissions are read on EVERY request rather than written into the token. A token that
 * carried its role would keep working until it expired, so removing someone would take up
 * to TOKEN_TTL_SECONDS to take effect. Read per request, with this cache, a change lands
 * within ACCESS_CACHE_MS. The token proves who you are; the file decides what that means.
 */
const accessCache = { at: 0, value: null };

export function __resetAccessCache() { accessCache.at = 0; accessCache.value = null; }

async function loadAccess() {
  if (!directoryLoc().repo) return { error: 'NO_DIRECTORY' };
  const now = Date.now();
  if (accessCache.value && now - accessCache.at < ACCESS_CACHE_MS) return accessCache.value;

  /* From the private repository once DIRECTORY_REPO is set (see SELF-SERVICE PASSWORDS),
   * otherwise from PROJECTS_REPO as before. */
  const dir = await readDirectory();
  if (dir.error === 'NO_DIRECTORY') return { error: 'NO_DIRECTORY' };
  if (dir.error) {
    if (accessCache.value) return accessCache.value;   // ride out a brief GitHub failure
    return { error: 'DIRECTORY_UNREADABLE' };
  }
  const people = (dir.people && typeof dir.people === 'object' && dir.people) || {};
  const value = { people };
  accessCache.at = now;
  accessCache.value = value;
  return value;
}

/* Finds a person by email in the directory and checks their password. */
async function findPerson(email, password) {
  const dir = await loadAccess();
  if (dir.error) return { error: dir.error };
  const id = String(email).trim().toLowerCase();

  // Exactly one PBKDF2 per attempt — see findAccount. The comment this replaces claimed
  // walking every entry hid which emails exist; it did not, because the hash only ran on
  // a match, so a miss returned immediately.
  let found = null, matched = null;
  for (const [addr, person] of Object.entries(dir.people)) {
    if (!matched && person && addr.toLowerCase() === id) matched = { email: addr, ...person };
  }
  const ok = verifyPassword(password, matched ? matched.hash : DECOY_HASH);
  if (matched && ok) found = matched;
  if (!found) return { error: 'SIGNIN_FAILED' };
  if (isExpired(found)) return { error: 'ACCOUNT_EXPIRED' };
  return found;
}

/* What this person may do on this project, read fresh. Returns a role or null. */
/* Editing the directory is its own permission, not "admin of something".
 *
 * The directory spans every tool, so if any tool's admin could edit it, an admin of one
 * tool could grant themselves admin of another. It is marked explicitly instead, with
 * platformAdmin on the person. Nobody gets it by implication.
 *
 * If no one is marked, the directory cannot be edited through the relay at all and has to
 * be changed in the repository by hand. That is the safe failure: it locks the door rather
 * than opening it to whoever happens to be an admin somewhere. */
async function isPlatformAdmin(email) {
  const dir = await loadAccess();
  if (dir.error) return { error: dir.error };
  const person = Object.entries(dir.people)
    .find(([addr]) => addr.toLowerCase() === String(email).toLowerCase())?.[1];
  if (!person || person.platformAdmin !== true) return { error: 'NOT_PLATFORM_ADMIN' };
  if (isExpired(person)) return { error: 'ACCOUNT_EXPIRED' };
  return { ok: true };
}

async function roleFor(email, projectKey) {
  const dir = await loadAccess();
  if (dir.error) return { error: dir.error };
  const person = Object.entries(dir.people).find(([addr]) => addr.toLowerCase() === String(email).toLowerCase())?.[1];
  if (!person) return { error: 'NO_ACCOUNT' };
  if (isExpired(person)) return { error: 'ACCOUNT_EXPIRED' };
  /* Administrators have every tool, including ones added after their access was last saved (relay request 9; Perry,
   * 8 Oct 2026: a new tool, IIF Planning HQ, turned its own administrator away until People & Access was saved). */
  const role = person.platformAdmin === true ? 'admin' : normaliseRole(person.access && person.access[projectKey]);
  if (!role) return { error: 'NO_ACCESS' };
  return { name: person.name || email, role };
}

/* The three levels a person can hold on one tool, plus the one historical spelling.
 *
 *   admin   read and write, and edit that tool's own settings
 *   staff   read and write
 *   view    read only — every write route refuses them
 *
 * Anything else, including an absent entry, means no access at all. Returning null
 * rather than a default is deliberate: a typo in access.json must lock someone out,
 * never quietly grant them something. */
const ROLES = new Set(['admin', 'staff', 'view']);
function normaliseRole(role) {
  /* 'facilitator' is accepted as a synonym for 'staff'. The role was renamed in Sept
   * 2026 while access.json was still empty, so nothing needed migrating — this only
   * covers a hand-edited file that predates the rename. */
  if (role === 'facilitator') return 'staff';
  return ROLES.has(role) ? role : null;
}

const facilitatorsCache = new Map();

/* Test hook only, matching __resetProjectsCache. Lambda never calls it — a warm container
 * simply ages out after FACILITATORS_CACHE_MS. The suite needs it to swap the fixture
 * mid-run without waiting out the cache. */
export function __resetFacilitatorsCache() { facilitatorsCache.clear(); }

/* Reads facilitators.json from GitHub. Cached across invocations of a warm container for
 * FACILITATORS_CACHE_MS so a burst of saves doesn't burst the GitHub API; bypassed for
 * admin reads and after admin writes so the panel always sees the truth. */
async function loadFacilitators(repo, branch, { fresh = false } = {}) {
  const now = Date.now();
  const hit = facilitatorsCache.get(repo);
  if (!fresh && hit && now - hit.at < FACILITATORS_CACHE_MS) return hit.value;
  const file = await readFile(repo, branch, FACILITATORS_PATH);
  const value = {
    sha: file.sha,
    /* Two shapes are accepted. 'admins' is an array and is the one to use; 'admin' is a
     * single object kept working so an existing file does not have to be rewritten.
     * Everything downstream reads adminList, so the rest of the relay does not care
     * which shape the file used. */
    admin: file.data?.admin || null,
    rawAdmins: Array.isArray(file.data?.admins) ? file.data.admins : null,
    adminList: Array.isArray(file.data?.admins)
      ? file.data.admins
      : (file.data?.admin ? [file.data.admin] : []),
    facilitators: Array.isArray(file.data?.facilitators) ? file.data.facilitators : [],
    missing: file.status === 404,
    error: file.status !== 200 && file.status !== 404 ? (file.corrupt ? 'CORRUPT' : `HTTP ${file.status}`) : null
  };
  facilitatorsCache.set(repo, { at: now, value });
  return value;
}

const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/* ---------- passwords ----------
 *
 * Verified here and nowhere else: the browser sends the password over HTTPS and never
 * sees a hash. Stored as "pbkdf2$<iterations>$<salt-hex>$<hash-hex>".
 *
 * PBKDF2 rather than a bare SHA-256 because SHA-256 is fast. A commodity GPU tries
 * billions of candidates a second, so a stolen file of unsalted SHA-256 hashes of
 * human-chosen passwords falls in minutes. A per-account random salt stops the work being
 * shared across accounts, and the iteration count makes each guess expensive.
 *
 * Plain SHA-256 entries are still accepted so existing passcodes keep working through the
 * changeover. Those were only ever safe because key-helper.html generated them at high
 * entropy; reissue them as pbkdf2 and delete that branch. */
function pbkdf2Hex(password, saltHex, iterations) {
  return pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, PBKDF2_KEYLEN, 'sha256').toString('hex');
}

/* A stored hash that matches no password, at the same iteration count as real accounts.
 * When no account matches the identifier, the password is checked against this instead,
 * so a failed sign-in costs one full PBKDF2 whether or not the email exists.
 *
 * Without it, an unknown email skipped the hash entirely and returned several hundred
 * times faster than a known one — measured at 374x — which let anyone discover which MISMO
 * addresses have accounts simply by timing failed sign-ins. The salt and derived key are
 * arbitrary; only the iteration count matters, and it must track PBKDF2_ITERATIONS. */
const DECOY_HASH = 'pbkdf2$' + PBKDF2_ITERATIONS + '$' + '9f8e7d6c5b4a39281706f5e4d3c2b1a0' + '$' + '0'.repeat(64);

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored) return false;
  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltHex, hashHex] = stored.split('$');
    const iterations = Number(iterStr);
    if (!Number.isInteger(iterations) || iterations < 1000 || !saltHex || !hashHex) return false;
    return hashesMatch(hashHex, pbkdf2Hex(password, saltHex, iterations));
  }
  return hashesMatch(stored, sha256hex(password));   // legacy, remove once all are pbkdf2
}

/* ---------- session tokens ----------
 *
 * Signed with a secret held only by the Lambda, so a browser cannot mint one. Deliberately
 * the same shape as a JWT (header.payload.signature, base64url) so that swapping in Cognito
 * later changes how a token is VERIFIED and nothing about how it is carried. Every route
 * downstream reads the token, never the password. */
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

function signToken(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string') return { error: 'TOKEN_BAD' };
  const parts = token.split('.');
  if (parts.length !== 3) return { error: 'TOKEN_BAD' };
  const [head, body, sig] = parts;
  const expect = b64url(createHmac('sha256', secret).update(head + '.' + body).digest());
  if (sig.length !== expect.length) return { error: 'TOKEN_BAD' };
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return { error: 'TOKEN_BAD' };
  let payload;
  try { payload = JSON.parse(b64urlDecode(body)); } catch (e) { return { error: 'TOKEN_BAD' }; }
  if (!payload || typeof payload.exp !== 'number') return { error: 'TOKEN_BAD' };
  if (payload.exp * 1000 <= Date.now()) return { error: 'TOKEN_EXPIRED' };
  return payload;
}

/* Constant-time comparison of two hex digests, so a passcode can't be guessed one
 * character at a time by timing the response. */
function hashesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function isExpired(entry) {
  if (!entry.expires) return false;
  const t = Date.parse(entry.expires);
  return Number.isFinite(t) && t <= Date.now();
}

/* Resolves the caller to { email, name, role } or { error }.
 *
 * Two ways in, on purpose:
 *   Authorization: Bearer <token>   the new path. A token minted by /auth/login.
 *   X-Facilitator-Key: Name:pass    the old path, kept so nothing breaks mid-changeover.
 *
 * The token is checked first and costs no GitHub call, so the common case is fast. The
 * legacy path still reads facilitators.json on every request, which is the other reason
 * to retire it.
 *
 * A token carries the role it was minted with, so a revoked or demoted account keeps its
 * access until the token expires. TOKEN_TTL_SECONDS is the bound on that, and it is why
 * the TTL is a working day rather than a week. Removing someone urgently means rotating
 * AUTH_SECRET, which invalidates every token at once. */
async function authenticate(headers, repo, branch) {
  const auth = headers['authorization'] || headers['Authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return { error: 'NO_AUTH_SECRET' };
    const payload = verifyToken(auth.slice(7).trim(), secret);
    if (payload.error) return { error: payload.error };

    /* A token proves WHO. What they may do here is read fresh from the directory on every
     * request, so removing someone or changing their role takes effect within
     * ACCESS_CACHE_MS rather than waiting out the token's lifetime.
     *
     * Tokens minted before the directory existed carry a project and a role; those are
     * still honoured for their own project so nobody is signed out by this change. */
    if (currentProjectKey) {
      const perm = await roleFor(payload.sub, currentProjectKey);
      if (!perm.error) {
        const dirNow = await loadAccess();
        if (!dirNow.error && tokenIsStale(payload, personByEmail(dirNow.people, payload.sub))) return { error: 'TOKEN_STALE' };
        return { email: payload.sub, name: perm.name, role: perm.role, viewAs: payload.va || null };
      }
      if (perm.error === 'NO_DIRECTORY') {
        /* No directory yet. The token has already proved who this is, so the role comes
         * from whichever list does exist: the token's own claim if it was minted before
         * the change, otherwise this project's facilitators.json looked up by email. No
         * password is involved — identity was established at sign-in. */
        if (payload.project && payload.project === currentProjectKey && payload.role) {
          return { email: payload.sub, name: payload.name || payload.sub, role: payload.role };
        }
        const legacy = await roleFromFacilitators(repo, branch, payload.sub);
        if (legacy.error) return { error: legacy.error };
        return { email: payload.sub, name: legacy.name, role: legacy.role };
      }
      if (perm.error === 'DIRECTORY_UNREADABLE') return { error: perm.error };
      return { error: perm.error };
    }
    return { email: payload.sub, name: payload.name || payload.sub, role: payload.role };
  }

  const raw = headers['x-facilitator-key'] || '';
  const colon = raw.indexOf(':');
  if (colon <= 0) return { error: 'KEY_BAD' };
  const who = raw.slice(0, colon).trim();
  const pass = raw.slice(colon + 1).trim();
  if (!who || !pass) return { error: 'KEY_BAD' };

  const found = await findAccount(repo, branch, who, pass);
  if (found.error) return found;
  return { email: found.email, name: found.name, role: found.role };
}

/* Role for an already-authenticated email, from a project's own facilitators.json.
 * Used only while no central directory exists. */
async function roleFromFacilitators(repo, branch, email) {
  const list = await loadFacilitators(repo, branch);
  if (list.error) return { error: 'FACILITATORS_UNREADABLE' };
  const id = String(email).trim().toLowerCase();
  const candidates = [];
  for (const a of list.adminList) candidates.push({ ...a, role: 'admin' });
  for (const f of list.facilitators) candidates.push({ ...f, role: 'staff' });
  for (const c of candidates) {
    const matches = (c.email && c.email.toLowerCase() === id) || (c.name && c.name.toLowerCase() === id);
    if (matches) {
      if (isExpired(c)) return { error: 'ACCOUNT_EXPIRED' };
      return { name: c.name, role: c.role };
    }
  }
  return { error: 'NO_ACCESS' };
}

/* Shared by the legacy header and /auth/login. Matches on email, and on display name too
 * so existing keys keep working. Every candidate is checked even after a match, so the
 * response time does not reveal which account exists or where it sits in the list. */
async function findAccount(repo, branch, identifier, password) {
  const list = await loadFacilitators(repo, branch);
  if (list.error) return { error: 'FACILITATORS_UNREADABLE' };

  const candidates = [];
  for (const a of list.adminList) candidates.push({ ...a, role: 'admin' });
  for (const f of list.facilitators) candidates.push({ ...f, role: 'staff' });

  const id = String(identifier).trim().toLowerCase();
  let found = null;
  /* Exactly one PBKDF2 per attempt, whether or not the identifier matched. Resolve the
   * candidate first, then hash once — against the real hash on a match, the decoy on a
   * miss. Hashing inside the loop with && short-circuited on a miss, which is what made
   * unknown emails return hundreds of times faster than known ones. */
  let matched = null;
  for (const c of candidates) {
    const matchesId = (c.email && c.email.toLowerCase() === id) || (c.name && c.name.toLowerCase() === id);
    if (matchesId && !matched) matched = c;
  }
  const ok = verifyPassword(password, matched ? matched.hash : DECOY_HASH);
  if (matched && ok) found = matched;
  if (!found) return { error: 'KEY_BAD' };
  if (isExpired(found)) return { error: 'KEY_EXPIRED' };
  return { email: found.email || found.name, name: found.name, role: found.role };
}

/* ---------- HTTP ---------- */

function corsHeaders(origin) {
  return {
    // Echoes only an origin that a configured project declared. Never '*': these routes
    // are authenticated by a header, so a wildcard would let any site call them.
    // corsHeaders is synchronous and the project list is now an async read, so it uses
    // the origin remembered from the last successful load rather than looking one up.
    // Only matters for errors raised before a project is resolved (unknown project, or
    // the list being unreadable) — without it the browser hides the error body and the
    // page reports a generic network failure instead of the real reason.
    'Access-Control-Allow-Origin': origin || lastKnownOrigin || 'null',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Facilitator-Key, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}

let responseOrigin = null;   // set once the project is resolved, so CORS matches the caller
const respond = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders(responseOrigin) },
  body: JSON.stringify(body)
});

function parseBody(event, max = MAX_BODY_BYTES) {
  const text = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (Buffer.byteLength(text) > max) return { error: respond(413, { error: 'TOO_LARGE', max }) };
  try { return { body: JSON.parse(text) }; } catch { return { error: respond(400, { error: 'BAD_JSON' }) }; }
}

/* ---------- ASK (relay request 9, Jonna's spec, 5 Oct 2026) ----------
 * POST /{project}/ask {prompt, tier?: 'default'|'complex', files?: [{mediaType, data}]} passes one question, and up to
 * three pictures or PDFs, to Anthropic's Messages API with the key held here (ANTHROPIC_API_KEY), so no key sits in a
 * page. Checks in this order: signed in, project opted in ('ask': true), key set, a question present. An empty
 * question answers 400 NO_PROMPT with what the route can read: that is how a page learns the route is ready, at no
 * cost. View accounts may ask: asking writes nothing. Nothing is stored; logs hold counts only, never the question,
 * the answer or a file. ANTHROPIC_MODEL (default claude-sonnet-5-5), ANTHROPIC_MODEL_COMPLEX (default: the same),
 * ASK_PER_HOUR (default 40 a person, per container; the real ceiling is the console's monthly spend limit). */
const ASK_MAX_BODY = 6_500_000;                       // above the ~6 MB a Lambda function URL delivers, so the file-size check answers first
const ASK_MAX_PROMPT = 300_000;                       // characters; Team HQ's whole board is about 46,000
const ASK_MAX_FILES = 3, ASK_MAX_FILE_BYTES = 4.5 * 1024 * 1024;
const ASK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const askRecent = new Map();                          // email -> recent question times, this container
let currentContext = null;                            // the Lambda context, for the time left
const askPerHour = () => Math.max(1, Number(process.env.ASK_PER_HOUR) || 40);
const askTimeoutMs = () => {
  const left = currentContext && typeof currentContext.getRemainingTimeInMillis === 'function' ? currentContext.getRemainingTimeInMillis() : 30_000;
  return Math.max(1_000, left - 4_000);               // answer ASK_TIMEOUT a few seconds before the function's own timeout
};
async function askRoute(proj, who, event) {
  if (!proj.ask) return respond(403, { error: 'ASK_OFF', message: 'Asking Claude is not switched on for this application.' });
  if (who.viewAs) return respond(403, { error: 'VIEW_AS_READ_ONLY', message: 'Viewing as someone else is read-only.' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(503, { error: 'ASK_NOT_SET_UP', message: 'Asking Claude is not set up on the relay yet.' });
  const { body, error } = parseBody(event, ASK_MAX_BODY);
  if (error) return error;
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) return respond(400, { error: 'NO_PROMPT', images: true, pdf: true });
  if (prompt.length > ASK_MAX_PROMPT) return respond(413, { error: 'PROMPT_TOO_BIG', max: ASK_MAX_PROMPT });
  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length > ASK_MAX_FILES) return respond(400, { error: 'TOO_MANY_FILES', max: ASK_MAX_FILES });
  const blocks = []; let bytes = 0;
  for (const f of files) {
    if (!f || typeof f.data !== 'string' || !ASK_TYPES.has(f.mediaType)) return respond(400, { error: 'FILE_TYPE' });
    bytes += Math.floor(f.data.replace(/=+$/, '').length * 3 / 4);
    blocks.push(f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
  }
  if (bytes > ASK_MAX_FILE_BYTES) return respond(413, { error: 'FILE_TOO_BIG' });
  const me = lowerOf(who.email), now = Date.now(), recent = (askRecent.get(me) || []).filter(t => now - t < 3_600_000);
  if (recent.length >= askPerHour()) return respond(429, { error: 'RATE_LIMITED', message: 'That is a lot of questions this hour. Give it a little while.' });
  recent.push(now); askRecent.set(me, recent);
  const complex = body.tier === 'complex';
  const model = (complex && process.env.ANTHROPIC_MODEL_COMPLEX) || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), askTimeoutMs());
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: complex ? 1500 : 1000, messages: [{ role: 'user', content: [...blocks, { type: 'text', text: prompt }] }] }) });
  } catch (e) {
    clearTimeout(timer);
    return e && e.name === 'AbortError' ? respond(504, { error: 'ASK_TIMEOUT' }) : respond(502, { error: 'ASK_FAILED' });
  }
  clearTimeout(timer);
  if (res.status === 429 || res.status === 529) return respond(429, { error: 'RATE_LIMITED' });
  if (res.status === 401 || res.status === 403) return respond(502, { error: 'ASK_KEY', message: 'The relay\'s Anthropic key was refused. The site owner needs to check it.' });
  if (!res.ok) return respond(502, { error: 'ASK_FAILED', status: res.status });
  let j = {}; try { j = await res.json(); } catch {}
  const text = (Array.isArray(j.content) ? j.content : []).filter(c => c && c.type === 'text').map(c => c.text).join('\n');
  const usage = { in: (j.usage && j.usage.input_tokens) || 0, out: (j.usage && j.usage.output_tokens) || 0 };
  console.log(JSON.stringify({ ask: proj.key, email: me, model: j.model || model, tier: complex ? 'complex' : 'default', files: files.length, in: usage.in, out: usage.out }));   // counts only
  recordUsage(proj.key, j.model || model, usage.in, usage.out); await flushUsage(false);   /* spending by tool */
  return respond(200, { text, model: j.model || model, usage });
}


/* =====================================================================================
 * MEMBERS-ONLY FILES (relay request 9; Jonna's spec, 5 Oct 2026)
 *
 * A project's 'membersOnly' names data files of the form {docs: {<id>: {..., members: [email, ...]}}}, each with the
 * emails that may see every doc in it. A read returns the docs whose members include the caller (or every doc, for
 * someone on that file's list). A member's save changes only their own docs: anything they are in becomes what was
 * sent (left out: deleted); docs they are not in stay exactly as stored and can't be touched; a new doc must list
 * them; on an existing doc they may take only themselves off. A see-all save writes the whole file and must carry
 * the version it read. No administrator override: the one way in is BREAK GLASS below. View as sees none of them.
 * /file and /commit refuse these files, so they can't be read or written around the rules.
 * ===================================================================================== */
const docsOf = d => (d && typeof d.docs === 'object' && d.docs && !Array.isArray(d.docs)) ? d.docs : {};
const membersOf = doc => (doc && Array.isArray(doc.members) ? doc.members : []).map(lowerOf);
const DOC_ID = /^[^/\\]{1,120}$/;
const membersPaths = proj => new Set(Object.keys(proj.membersOnly || {}).map(f => `data/${f}.json`));
async function membersData(proj, all, method, id, event, who) {
  const me = lowerOf(who.email), path = `data/${id}.json`, seeAll = all.includes(me);
  if (method === 'GET') {
    const file = await readFile(proj.repo, proj.branch, path);
    if (file.status !== 200 && file.status !== 404) return respond(502, { error: 'GITHUB', status: file.status });
    const docs = file.status === 404 ? {} : docsOf(file.data);
    if (who.viewAs) return respond(200, { sha: file.sha || null, data: { docs: {} }, scope: 'members', hidden: true });
    let view = {}; const readOnly = [];
    if (seeAll) view = docs;
    else {
      const g = await bgGrants(proj.key, id, me);
      for (const [k, d] of Object.entries(docs)) {
        const m = membersOf(d);
        if (m.includes(me)) view[k] = d;
        else if (g.persons.some(x => m.includes(x))) { view[k] = d; readOnly.push(k); }   /* break glass: read-only */
      }
      if (readOnly.length) await bgOpened(g.ids, me, proj.key, id);
    }
    return respond(200, { sha: file.sha || null, data: { docs: view }, scope: 'members', ...(readOnly.length ? { readOnly } : {}) });
  }
  if (method !== 'PUT') return respond(405, { error: 'METHOD' });
  const { body, error } = parseBody(event); if (error) return error;
  const sent = docsOf(body && body.content);
  for (const [k, d] of Object.entries(sent)) if (!DOC_ID.test(k) || !d || typeof d !== 'object' || !Array.isArray(d.members)) return respond(400, { error: 'BAD_DOC', id: k });
  for (let tries = 0; tries < 4; tries++) {
    const file = await readFile(proj.repo, proj.branch, path);
    if (file.status !== 200 && file.status !== 404) return respond(502, { error: 'GITHUB', status: file.status });
    const stored = file.status === 404 ? {} : docsOf(file.data), sha = file.sha || null;
    let next;
    if (seeAll) {
      if ((body.sha || null) !== sha) return respond(409, { error: 'CONFLICT', message: 'Someone saved since you read this. Reload, then save again.' });
      next = sent;
    } else {
      next = {};
      for (const [k, d] of Object.entries(stored)) if (!membersOf(d).includes(me)) next[k] = d;        /* not theirs: exactly as stored */
      for (const [k, d] of Object.entries(sent)) {
        const old = stored[k], nm = membersOf(d);
        if (old && !membersOf(old).includes(me)) return respond(403, { error: 'NOT_A_MEMBER', id: k, message: 'That isn\u2019t yours to change.' });
        if (!old && !nm.includes(me)) return respond(403, { error: 'NOT_A_MEMBER', id: k, message: 'A new item has to include you.' });
        if (old && membersOf(old).some(x => x !== me && !nm.includes(x))) return respond(403, { error: 'MEMBERS_REMOVED', id: k, message: 'You can take yourself off, but not someone else.' });
        next[k] = d;
      }
    }
    const content = { ...((file.data && typeof file.data === 'object') ? file.data : {}), docs: next };
    const { status, json } = await github('PUT', `/repos/${proj.repo}/contents/${path}`, { message: `Save ${id} (${me})`, content: encodeBase64Utf8(content),
      branch: proj.branch, sha: sha || undefined, author: authorFor(who.name || me) });
    if (status === 200 || status === 201) {
      const view = seeAll ? next : Object.fromEntries(Object.entries(next).filter(([, d]) => membersOf(d).includes(me)));
      return respond(200, { sha: json && json.content && json.content.sha, data: { docs: view }, scope: 'members' });
    }
    if (seeAll || (status !== 409 && status !== 422)) return writeOutcome(status, json, !!sha);
  }
  return respond(409, { error: 'CONFLICT' });
}

/* =====================================================================================
 * BREAK GLASS (relay request 9; Perry and Jonna, 6 Oct 2026)
 *
 * One administrator asks to open one person's members-only items in one tool (Team HQ's Sync Ups), with a reason;
 * every other administrator is emailed; any one of them may approve or decline, never the one who asked. Approved:
 * read-only, for 24 hours. Unanswered for 3 days: lapsed. Every request, decision and opening is kept in
 * break-glass.json beside the account list. The item's members are not told.
 * ===================================================================================== */
const BG_LAPSE_MS = 3 * 24 * 3_600_000, BG_ACCESS_MS = 24 * 3_600_000;
const bgOpenSeen = new Map();
async function bgGrants(projectKey, file, me) {
  const r = await acctRead(BG_PATH); if (r.error) return { persons: [], ids: [] };
  const now = Date.now();
  const live = (Array.isArray(r.data.requests) ? r.data.requests : []).filter(q => q.status === 'approved' && lowerOf(q.by) === me && q.project === projectKey
    && Array.isArray(q.files) && q.files.includes(file) && Date.parse(q.expiresAt) > now);
  return { persons: live.map(q => lowerOf(q.person)), ids: live.map(q => q.id) };
}
async function bgOpened(ids, me, project, file) {
  const now = Date.now(), due = ids.filter(id => now - (bgOpenSeen.get(id) || 0) > 3_600_000);   /* recorded at most hourly */
  if (!due.length) return;
  due.forEach(id => bgOpenSeen.set(id, now));
  await acctUpdate(BG_PATH, d => { (d.requests || []).forEach(q => { if (due.includes(q.id)) (q.opened = q.opened || []).push(new Date(now).toISOString()); }); return d; },
    `Break glass: ${me} opened ${file} in ${project}`);
}
const ADMIN_URL = 'https://resources.mismo.org/initiative-hub/admin.html#requests';
function bgMail(kind, q) {
  const what = `${q.personName || q.person}\u2019s members-only items in ${q.project} (${(q.files || []).join(', ')})`;
  const m = kind === 'request'
    ? { subject: `Break glass: ${q.byName || q.by} asks to open ${q.personName || q.person}\u2019s items`,
        text: `${q.byName || q.by} has asked to open ${what}, read-only, for 24 hours.\n\nReason: \u201c${q.reason}\u201d\n\nApprove or decline it in the Admin Console: ${ADMIN_URL}\n\nAny administrator other than the one who asked can decide. If nobody does within 3 days, the request lapses. The item\u2019s members are not told.` }
    : { subject: `Break glass ${kind}: ${q.personName || q.person}\u2019s items`,
        text: kind === 'approved' ? `${q.decidedByName || q.decidedBy} approved your request to open ${what}. You can read it until ${new Date(q.expiresAt).toUTCString()}; it opens read-only in the tool itself.`
                                  : `${q.decidedByName || q.decidedBy} declined your request to open ${what}.` };
  return { subject: m.subject, text: m.text, html: htmlOf(m.text) };
}
async function breakGlass(method, subPath, event, who) {
  const me = lowerOf(who.email);
  const pa = await isPlatformAdmin(me);   /* { ok: true } or { error }: an object either way, so test .ok */
  if (!pa.ok) return respond(403, { error: pa.error || 'NOT_PLATFORM_ADMIN' });
  const id = (subPath.match(/^\/breakglass\/([A-Za-z0-9-]+)$/) || [])[1];
  if (method === 'GET' && !id) {
    const r = await acctRead(BG_PATH); if (r.error) return respond(502, { error: r.error });
    const now = Date.now();
    const list = (Array.isArray(r.data.requests) ? r.data.requests : []).map(q => ({ ...q,
      status: q.status === 'pending' && now - Date.parse(q.at) > BG_LAPSE_MS ? 'lapsed' : (q.status === 'approved' && Date.parse(q.expiresAt) <= now ? 'ended' : q.status) }));
    return respond(200, { requests: list.slice(0, 200), me });
  }
  if (method === 'POST' && !id) {
    const { body, error } = parseBody(event); if (error) return error;
    const project = String((body && body.project) || ''), reason = String((body && body.reason) || '').trim().slice(0, 500);
    const target = project ? await projectConfig(project) : null;
    const mo = Object.keys((target && target.membersOnly) || {});
    const files = (Array.isArray(body && body.files) ? body.files : mo).filter(f => mo.includes(f));
    if (!target || !files.length) return respond(400, { error: 'NOTHING_TO_OPEN', message: 'That tool has no members-only files.' });
    if (!reason) return respond(400, { error: 'NO_REASON', message: 'Give a reason.' });
    const dir = await loadAccess(); if (dir.error) return respond(502, { error: dir.error });
    const person = personByEmail(dir.people, lowerOf(body.person)); if (!person) return respond(404, { error: 'NO_ACCOUNT' });
    const others = Object.entries(dir.people).filter(([e, x]) => x.platformAdmin === true && lowerOf(e) !== me && !isExpired(x));
    if (!others.length) return respond(409, { error: 'NO_SECOND_ADMIN', message: 'Break glass needs a second administrator to approve it.' });
    const q = { id: 'bg-' + randomBytes(6).toString('hex'), project, files, person: person.email, personName: person.name || person.email, reason,
                by: me, byName: who.name || me, at: new Date().toISOString(), status: 'pending' };
    const w = await acctUpdate(BG_PATH, d => ({ ...d, requests: [q, ...(Array.isArray(d.requests) ? d.requests : [])].slice(0, 500) }), `Break glass requested by ${me}: ${project}, ${person.email}`);
    if (w.error) return respond(502, { error: w.error });
    for (const [e] of others) await sendMail({ kind: 'break-glass-request', to: e, ...bgMail('request', q) });
    return respond(200, { request: q });
  }
  if (method === 'POST' && id) {
    const { body, error } = parseBody(event); if (error) return error;
    const decision = body && body.decision; if (decision !== 'approve' && decision !== 'decline') return respond(400, { error: 'BAD_DECISION' });
    let decided = null;
    const w = await acctUpdate(BG_PATH, d => {
      const q = (Array.isArray(d.requests) ? d.requests : []).find(x => x.id === id);
      if (!q) return { __error: 'NOT_FOUND' };
      if (lowerOf(q.by) === me) return { __error: 'OWN_REQUEST' };
      if (q.status !== 'pending') return { __error: 'ALREADY_DECIDED' };
      if (Date.now() - Date.parse(q.at) > BG_LAPSE_MS) return { __error: 'LAPSED' };
      q.status = decision === 'approve' ? 'approved' : 'declined'; q.decidedBy = me; q.decidedByName = who.name || me; q.decidedAt = new Date().toISOString();
      if (decision === 'approve') q.expiresAt = new Date(Date.now() + BG_ACCESS_MS).toISOString();
      decided = q; return d;
    }, `Break glass ${decision === 'approve' ? 'approved' : 'declined'} by ${me}: ${id}`);
    if (w.error) return respond({ NOT_FOUND: 404, OWN_REQUEST: 403, ALREADY_DECIDED: 409, LAPSED: 409 }[w.error] || 502,
      { error: w.error, message: { OWN_REQUEST: 'Another administrator has to decide your own request.', ALREADY_DECIDED: 'Someone has already decided this.', LAPSED: 'This request lapsed after 3 days.' }[w.error] });
    await sendMail({ kind: 'break-glass-decision', to: decided.by, ...bgMail(decision === 'approve' ? 'approved' : 'declined', decided) });
    return respond(200, { request: decided });
  }
  return respond(405, { error: 'METHOD' });
}

/* =====================================================================================
 * ACTIVITY (relay request 9): GET /{project}/activity, platform administrators only. Every save of the account list,
 * turned into what changed (from the repository's own history: each version is read once and kept, since a commit
 * never changes), with View as, break glass and sign-in records beside it. Nothing new is stored.
 * ===================================================================================== */
const versionCache = new Map();
const LEVEL = r => ({ admin: 'Admin', staff: 'Edit', facilitator: 'Edit', view: 'View' }[r] || (r ? String(r) : ''));
function diffPeople(a, b) {
  const out = [], keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const e of keys) {
    const x = (a || {})[e], y = (b || {})[e], name = (y || x || {}).name || e;
    if (!x) { out.push({ person: e, name, change: 'added' }); continue; }
    if (!y) { out.push({ person: e, name, change: 'removed' }); continue; }
    for (const f of ['name', 'group', 'expires', 'platformAdmin']) if (JSON.stringify(x[f] ?? null) !== JSON.stringify(y[f] ?? null)) out.push({ person: e, name, field: f, before: x[f] ?? null, after: y[f] ?? null });
    const ax = x.access || {}, ay = y.access || {};
    for (const k of new Set([...Object.keys(ax), ...Object.keys(ay)])) if (LEVEL(ax[k]) !== LEVEL(ay[k])) out.push({ person: e, name, tool: k, before: LEVEL(ax[k]) || null, after: LEVEL(ay[k]) || null });
  }
  return out;
}
async function activity(event, who) {
  const pa = await isPlatformAdmin(lowerOf(who.email));
  if (!pa.ok) return respond(403, { error: pa.error || 'NOT_PLATFORM_ADMIN' });
  const loc = directoryLoc(); if (!loc.private) return respond(404, { error: 'NO_DIRECTORY' });
  const hist = await github('GET', `/repos/${loc.repo}/commits?path=${encodeURIComponent(loc.path)}&sha=${encodeURIComponent(loc.branch)}&per_page=25`);
  if (hist.status !== 200 || !Array.isArray(hist.json)) return respond(502, { error: 'HISTORY_UNREADABLE' });
  const at = async sha => { if (versionCache.has(sha)) return versionCache.get(sha);
    const f = await readFile(loc.repo, sha, loc.path); const v = f.status === 200 ? ((f.data && f.data.people) || {}) : (f.status === 404 ? {} : null);
    if (v) versionCache.set(sha, v); return v; };
  const entries = [];
  for (const c of hist.json) {
    const now = await at(c.sha); if (!now) continue;
    const before = c.parents && c.parents[0] ? await at(c.parents[0].sha) : {};
    const changes = diffPeople(before || {}, now);
    if (!changes.length) continue;
    entries.push({ kind: changes.some(x => x.change || x.field) ? 'Account' : 'Access', at: c.commit.author.date, by: c.commit.author.name, message: String(c.commit.message).split('\n')[0], changes });
  }
  const log = await acctRead(LOG_PATH);
  for (const v of (log.data && Array.isArray(log.data.entries) ? log.data.entries : [])) entries.push({ kind: 'View as', at: v.at, by: v.by, as: v.as, until: v.until });
  const bg = await acctRead(BG_PATH);
  for (const q of (bg.data && Array.isArray(bg.data.requests) ? bg.data.requests : [])) {
    entries.push({ kind: 'Break glass', at: q.at, by: q.by, event: 'requested', person: q.person, project: q.project, reason: q.reason, id: q.id });
    if (q.decidedAt) entries.push({ kind: 'Break glass', at: q.decidedAt, by: q.decidedBy, event: q.status === 'declined' ? 'declined' : 'approved', person: q.person, project: q.project, id: q.id });
    for (const o of (q.opened || [])) entries.push({ kind: 'Break glass', at: o, by: q.by, event: 'opened', person: q.person, project: q.project, id: q.id });
  }
  const st = await github('GET', `/repos/${loc.repo}/commits?path=${encodeURIComponent(process.env.AUTH_STATE_PATH || 'auth-state.json')}&sha=${encodeURIComponent(loc.branch)}&per_page=40`);
  if (st.status === 200 && Array.isArray(st.json)) for (const c of st.json) {
    const msg = String(c.commit.message).split('\n')[0];
    if (/^(Locked|Reset requested|Password (set|changed)|Unlocked|Reset link)/i.test(msg)) entries.push({ kind: 'Sign-in', at: c.commit.author.date, by: c.commit.author.name, message: msg });
  }
  entries.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  return respond(200, { entries: entries.slice(0, 200) });
}


/* =====================================================================================
 * SPENDING BY TOOL (relay request 9; Perry, 9 Oct 2026). Every Ask is counted against its tool: requests, and the
 * tokens Claude read and wrote (what Anthropic bills by), per tool, per model, per month, in ask-usage.json beside
 * the account list. Counts gather in this container and are written at most every ten minutes, and on the
 * five-minute keep-warm ping (/version), so a question doesn't mean a commit. GET /{project}/ask-usage shows them
 * to platform administrators, unwritten counts included. One key serves every tool; this is how spend splits.
 * ===================================================================================== */
const USAGE_PATH = 'ask-usage.json', USAGE_FLUSH_MS = 10 * 60_000;
const usagePending = new Map();
let usageFlushedAt = Date.now();
function recordUsage(project, model, inTok, outTok) {
  const k = `${new Date().toISOString().slice(0, 7)}|${project}|${model}`;
  const v = usagePending.get(k) || { requests: 0, in: 0, out: 0 };
  v.requests += 1; v.in += inTok || 0; v.out += outTok || 0; usagePending.set(k, v);
}
function addUsage(months, k, v) {
  const [month, project, model] = k.split('|');
  const p = ((months[month] = months[month] || {})[project] = months[month][project] || { requests: 0, in: 0, out: 0, models: {} });
  p.requests += v.requests; p.in += v.in; p.out += v.out;
  const m = (p.models[model] = p.models[model] || { requests: 0, in: 0, out: 0 });
  m.requests += v.requests; m.in += v.in; m.out += v.out;
}
async function flushUsage(force) {
  if (!usagePending.size || (!force && Date.now() - usageFlushedAt < USAGE_FLUSH_MS)) return;
  const pending = new Map(usagePending); usagePending.clear(); usageFlushedAt = Date.now();
  const n = [...pending.values()].reduce((s, v) => s + v.requests, 0);
  let w; try { w = await acctUpdate(USAGE_PATH, d => { d.months = d.months || {}; for (const [k, v] of pending) addUsage(d.months, k, v); return d; }, `Ask usage: ${n} request${n === 1 ? '' : 's'}`); } catch (e) { w = { error: 'THROWN' }; }
  if (w.error) for (const [k, v] of pending) {   /* not written: keep them for the next try */
    const c = usagePending.get(k) || { requests: 0, in: 0, out: 0 };
    usagePending.set(k, { requests: c.requests + v.requests, in: c.in + v.in, out: c.out + v.out });
  }
}
async function askUsage(who) {
  const pa = await isPlatformAdmin(lowerOf(who.email)); if (!pa.ok) return respond(403, { error: pa.error || 'NOT_PLATFORM_ADMIN' });
  const r = await acctRead(USAGE_PATH); if (r.error) return respond(502, { error: r.error });
  const months = JSON.parse(JSON.stringify(r.data.months || {}));
  for (const [k, v] of usagePending) addUsage(months, k, v);
  return respond(200, { months, unwritten: [...usagePending.values()].reduce((s, v) => s + v.requests, 0) });
}

/* Maps a GitHub write result to our response. */
function writeOutcome(status, json, hadSha) {
  // 409: the sha is stale. 422 with no sha: the file was created since the caller read a
  // 404. Both are the lock working; both go back as a conflict.
  if (status === 409 || (status === 422 && !hadSha)) return respond(409, { error: 'CONFLICT' });
  if (status === 422) return respond(422, { error: 'REJECTED', message: json?.message });
  if (status === 401 || status === 403) return respond(502, { error: 'TOKEN', message: "The relay's GitHub token was rejected. The site owner needs to check it." });
  if (status !== 200 && status !== 201) return respond(502, { error: 'GITHUB', status, message: json?.message });
  return null;
}

const authorFor = (name) => ({ name, email: `${name.replace(/\s+/g, '.').toLowerCase()}@facilitators.mismo-hub.invalid` });

/* =====================================================================================
 * SELF-SERVICE PASSWORDS (relay request 8, 30 Sept 2026)
 *
 * People choose their own passwords, reset them by email, and are locked after five wrong
 * guesses. Everything here is OFF until DIRECTORY_REPO names a PRIVATE repository: a
 * person-chosen password must never be hashed into a public file, where it could be guessed
 * offline with no lockout. Until then sign-in behaves exactly as before.
 *
 *   DIRECTORY_REPO     e.g. GitMISMO/GitMISMO-resources-accounts (private). The account list
 *                      (access.json) and the sign-in state (auth-state.json) live here.
 *   DIRECTORY_BRANCH   default main.   DIRECTORY_PATH default access.json.
 *   MAIL_FLOW_URL      a Power Automate "When an HTTP request is received" URL. Optional:
 *                      without it no email is sent, and an administrator is shown the
 *                      reset link to pass on instead.
 *   MAIL_FLOW_SECRET   sent with every email request; the flow checks it.
 *   PASSWORD_MIN_LENGTH default 13 (Perry, 30 Sept 2026).
 *
 * Moving the list: while DIRECTORY_REPO has no access.json yet, it is read from the old
 * public location, and the first save (an administrator's, or a password change) writes
 * it to the private repository. After that the public copy can be deleted.
 * ===================================================================================== */
const PASSWORD_MAX = 128;
const MAX_FAILED = 5;
const RESET_TTL_MS = 60 * 60_000;              // a reset link works for one hour
const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;    // a "set your password" link for a new person, one week
const RESET_REQUESTS_PER_HOUR = 3;
const HISTORY_KEEP = 5;                        // not one of the last five passwords
const UNKNOWN_TTL_MS = 60 * 60_000;
const passwordMin = () => Math.max(8, Number(process.env.PASSWORD_MIN_LENGTH) || 13);
const selfServiceOn = () => !!process.env.DIRECTORY_REPO;

function directoryLoc() {
  if (process.env.DIRECTORY_REPO) return { repo: process.env.DIRECTORY_REPO, branch: process.env.DIRECTORY_BRANCH || 'main',
                                           path: process.env.DIRECTORY_PATH || 'access.json', private: true };
  return { repo: process.env.PROJECTS_REPO, branch: process.env.PROJECTS_BRANCH || 'main',
           path: process.env.ACCESS_PATH || ACCESS_PATH_DEFAULT, private: false };
}
function legacyLoc() {
  return { repo: process.env.PROJECTS_REPO, branch: process.env.PROJECTS_BRANCH || 'main', path: process.env.ACCESS_PATH || ACCESS_PATH_DEFAULT };
}
/* The account list as it stands, fresh, with where it came from. `source` is 'private' once
 * it lives in DIRECTORY_REPO, 'legacy' while it is still being read from the public file. */
async function readDirectory() {
  const loc = directoryLoc();
  if (!loc.repo) return { status: 500, error: 'NO_DIRECTORY' };
  let file = await readFile(loc.repo, loc.branch, loc.path);
  if (file.status === 404 && loc.private) {
    const old = legacyLoc();
    file = await readFile(old.repo, old.branch, old.path);
    if (file.status === 200) return { status: 200, people: file.data?.people || {}, sha: null, source: 'legacy' };
  }
  if (file.status !== 200) return { status: file.status, error: file.status === 404 ? 'NO_DIRECTORY' : 'DIRECTORY_UNREADABLE' };
  return { status: 200, people: file.data?.people || {}, sha: file.sha, source: loc.private ? 'private' : 'public' };
}
async function writeDirectory(people, sha, message, author) {
  const loc = directoryLoc();
  return github('PUT', `/repos/${loc.repo}/contents/${loc.path}`, {
    message, content: encodeBase64Utf8({ people }), branch: loc.branch, sha: sha || undefined, author: authorFor(author)
  });
}
/* Change one person in the list, re-reading and retrying if someone else saved first. */
async function updatePerson(email, change, message, author) {
  const id = String(email).toLowerCase();
  for (let tries = 0; tries < 4; tries++) {
    const dir = await readDirectory();
    if (dir.error) return { error: dir.error };
    const key = Object.keys(dir.people).find(k => k.toLowerCase() === id);
    if (!key) return { error: 'NO_ACCOUNT' };
    const people = { ...dir.people, [key]: change({ ...dir.people[key] }) };
    const { status, json } = await writeDirectory(people, dir.sha, message, author);
    if (status === 200 || status === 201) { __resetAccessCache(); return { ok: true, sha: json?.content?.sha }; }
    if (status !== 409 && status !== 422) return { error: 'GITHUB', status };
  }
  return { error: 'CONFLICT' };
}

/* ---------- the sign-in state: wrong guesses, locks, reset links, password history ----------
 * auth-state.json beside the account list:  { "accounts": { "<email>": {
 *     "failed": 2, "lastFailedAt": "...", "lockedAt": "...",
 *     "reset": { "hash": "<sha256 of the link's secret>", "expires": "...", "purpose": "reset" },
 *     "resetRequests": ["<iso>", ...], "history": ["pbkdf2$...", ...] } } }
 * The secret in a reset link is never stored, only its SHA-256, so the file cannot be used to
 * reset anyone's password. */
async function readState() {
  const loc = directoryLoc();
  const file = await readFile(loc.repo, loc.branch, process.env.AUTH_STATE_PATH || 'auth-state.json');
  if (file.status === 404) return { accounts: {}, sha: null };
  if (file.status !== 200) return { error: 'STATE_UNREADABLE' };
  const accounts = (file.data && typeof file.data.accounts === 'object' && file.data.accounts) || {};
  return { accounts, sha: file.sha };
}
async function updateState(email, change, message) {
  const id = String(email).toLowerCase(), loc = directoryLoc(), path = process.env.AUTH_STATE_PATH || 'auth-state.json';
  for (let tries = 0; tries < 4; tries++) {
    const st = await readState();
    if (st.error) return { error: st.error };
    const accounts = { ...st.accounts };
    const next = change({ ...(accounts[id] || {}) });
    if (next === null || (next && !Object.keys(next).length)) delete accounts[id]; else accounts[id] = next;
    const { status } = await github('PUT', `/repos/${loc.repo}/contents/${path}`, {
      message, content: encodeBase64Utf8({ accounts }), branch: loc.branch, sha: st.sha || undefined
    });
    if (status === 200 || status === 201) return { ok: true };
    if (status !== 409 && status !== 422) return { error: 'GITHUB', status };
  }
  return { error: 'CONFLICT' };
}

/* Small JSON records beside the account list (relay request 9): break-glass.json and access-log.json. Read fresh;
 * changed by re-reading and retrying if someone else wrote first, as updateState does. */
async function acctRead(path) {
  const loc = directoryLoc(); if (!loc.private) return { error: 'NO_DIRECTORY' };
  const file = await readFile(loc.repo, loc.branch, path);
  if (file.status === 404) return { data: {}, sha: null };
  if (file.status !== 200) return { error: 'RECORD_UNREADABLE' };
  return { data: (file.data && typeof file.data === 'object') ? file.data : {}, sha: file.sha };
}
async function acctUpdate(path, change, message) {
  const loc = directoryLoc(); if (!loc.private) return { error: 'NO_DIRECTORY' };
  for (let tries = 0; tries < 4; tries++) {
    const cur = await acctRead(path); if (cur.error) return cur;
    const next = change(JSON.parse(JSON.stringify(cur.data)));
    if (next && next.__error) return { error: next.__error, detail: next.__detail };
    const { status } = await github('PUT', `/repos/${loc.repo}/contents/${path}`, { message, content: encodeBase64Utf8(next), branch: loc.branch, sha: cur.sha || undefined });
    if (status === 200 || status === 201) return { ok: true, data: next };
    if (status !== 409 && status !== 422) return { error: 'GITHUB', status };
  }
  return { error: 'CONFLICT' };
}
const BG_PATH = 'break-glass.json', LOG_PATH = 'access-log.json';

/* Emails that match no account still count down and lock, in this container's memory, so the
 * warnings look the same whether or not an account exists and cannot be used to find out. */
const unknownTries = new Map();
function unknownFailure(email) {
  const id = String(email).toLowerCase(), now = Date.now();
  for (const [k, v] of unknownTries) if (now - v.at > UNKNOWN_TTL_MS) unknownTries.delete(k);
  const e = unknownTries.get(id) || { failed: 0, at: now };
  e.failed++; e.at = now; unknownTries.set(id, e);
  return e.failed >= MAX_FAILED ? lockedResponse() : failedResponse(MAX_FAILED - e.failed);
}
export function __resetUnknownTries() { unknownTries.clear(); }
function failedResponse(remaining) {
  return respond(401, { error: 'SIGNIN_FAILED', remaining,
    message: `That email and password do not match an account. ${remaining} ${remaining === 1 ? 'try' : 'tries'} left before the account is locked.` });
}
function lockedResponse() {
  return respond(423, { error: 'LOCKED',
    message: `This account is locked after ${MAX_FAILED} incorrect passwords. Reset your password to unlock it.` });
}

/* ---------- the password rules ----------
 * NIST SP 800-63B rev. 4: length, no composition rules, and a check against passwords already
 * known to attackers. The minimum is PASSWORD_MIN_LENGTH (13, Perry's choice; NIST's figure for
 * a password used alone is 15). The breached-password check asks Have I Been Pwned with only
 * the first five characters of the password's SHA-1 (k-anonymity): the password, and even its
 * full hash, never leave the relay. If that service can't be reached, a short local list of the
 * most common choices is checked instead. */
const COMMON = new Set(('password passw0rd password1 password12 password123 password1234 password12345 qwertyuiop qwerty123456 ' +
  '1234567890123 12345678910 123456789012 iloveyou12345 welcome12345 letmein12345 admin1234567 changeme12345 ' +
  'mismo1234567 mortgage12345 baseball12345 football12345 monkey1234567 dragon1234567 sunshine12345 princess12345').split(' '));
export async function checkNewPassword(pw, { name, email, history = [], current } = {}) {
  const problems = [];
  const p = String(pw || '');
  if (p.length < passwordMin()) problems.push(`Use at least ${passwordMin()} characters.`);
  if (p.length > PASSWORD_MAX) problems.push(`Use no more than ${PASSWORD_MAX} characters.`);
  const low = p.toLowerCase();
  const parts = [String(email || '').split('@')[0], ...String(name || '').split(/\s+/), 'mismo'].map(s => s.toLowerCase()).filter(s => s.length >= 3);
  if (parts.some(s => low.includes(s))) problems.push('Don\u2019t include your name, your email or \u201cMISMO\u201d.');
  if (/^(.)\1+$/.test(p) || /^(0123456789|1234567890|abcdefghij)/i.test(p)) problems.push('Avoid repeated or sequential characters.');
  if (current && verifyPassword(p, current)) problems.push('Choose a password you haven\u2019t used before.');
  else if (history.some(h => verifyPassword(p, h))) problems.push('Choose a password you haven\u2019t used before.');
  if (!problems.length && await breached(p)) problems.push('That password has appeared in a data breach. Choose another.');
  return problems;
}
async function breached(p) {
  if (COMMON.has(p.toLowerCase())) return true;
  const sha1 = createHash('sha1').update(p, 'utf8').digest('hex').toUpperCase();
  try {
    const res = await fetch('https://api.pwnedpasswords.com/range/' + sha1.slice(0, 5), {
      method: 'GET', headers: { 'Add-Padding': 'true', 'User-Agent': 'mismo-save-relay' }, signal: AbortSignal.timeout(3000) });
    if (res.status !== 200) return false;
    const text = await res.text();
    return text.split('\n').some(line => { const [suffix, count] = line.trim().split(':'); return suffix === sha1.slice(5) && Number(count) > 0; });
  } catch (e) { return false; }   // unreachable: the local list above was the fallback
}
export function hashNewPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${pbkdf2Hex(pw, salt, PBKDF2_ITERATIONS)}`;
}

/* ---------- email, through Power Automate ---------- */
async function sendMail(msg) {
  const url = process.env.MAIL_FLOW_URL;
  if (!url) return { sent: false };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.MAIL_FLOW_SECRET || '', ...msg }), signal: AbortSignal.timeout(8000) });
    if (res.status >= 200 && res.status < 300) return { sent: true };
    console.error('mail flow answered', res.status, 'for', msg.kind);   // never the link
    return { sent: false };
  } catch (e) { console.error('mail flow unreachable for', msg.kind); return { sent: false }; }
}
function linkFor(origin, email, secret) {
  return `${origin || 'https://resources.mismo.org'}/reset-password.html#e=${encodeURIComponent(email)}&t=${secret}`;
}
const EMAILS = {
  reset: (name, link) => ({ subject: 'Reset your MISMO Resources password',
    text: `Hello ${name},\n\nUse this link to set a new password for MISMO Resources. It works once, for one hour:\n\n${link}\n\nIf you didn\u2019t ask for this, you can ignore this email; your password hasn\u2019t changed.\n\nMISMO Programs & Operations` }),
  invite: (name, link) => ({ subject: 'Set your MISMO Resources password',
    text: `Hello ${name},\n\nAn account has been set up for you on MISMO Resources. Use this link to choose your password. It works once, for one week:\n\n${link}\n\nMISMO Programs & Operations` }),
  locked: (name, link) => ({ subject: 'Your MISMO Resources account is locked',
    text: `Hello ${name},\n\nYour account was locked after ${MAX_FAILED} incorrect passwords. Use this link to set a new password and unlock it. It works once, for one hour:\n\n${link}\n\nIf this wasn\u2019t you, reset your password anyway and let Programs & Operations know.\n\nMISMO Programs & Operations` }),
  changed: (name) => ({ subject: 'Your MISMO Resources password was changed',
    text: `Hello ${name},\n\nThe password for your MISMO Resources account was just changed. If this was you, there\u2019s nothing to do.\n\nIf it wasn\u2019t, reset your password at https://resources.mismo.org and let Programs & Operations know right away.\n\nMISMO Programs & Operations` }),
};
const htmlOf = text => '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f314c">' +
  text.split('\n').map(l => l.startsWith('https://') ? `<p><a href="${l}" style="color:#2C74A6">${l.split('#')[0]}</a></p>` : (l ? `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` : '')).join('') + '</div>';
async function mailPerson(kind, email, name, link) {
  const m = EMAILS[kind](name || email, link);
  return sendMail({ kind, to: email, subject: m.subject, text: m.text, html: htmlOf(m.text) });
}
/* A new reset link: its secret goes into the email (or to the administrator), only its hash
 * into the state file. Requesting another replaces the last one. */
async function issueLink(email, purpose, origin) {
  const secret = b64url(randomBytes(32));
  const r = await updateState(email, s => ({ ...s, reset: { hash: sha256hex(secret), purpose,
    expires: new Date(Date.now() + (purpose === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS)).toISOString() } }), `Password link for ${email}`);
  if (r.error) return { error: r.error };
  return { link: linkFor(origin, email, secret) };
}
/* After a password is set: the new hash in the list, the old one into the history, and the
 * failed count, lock and link cleared. passwordChangedAt also ends every session that began
 * before the change (see tokenIsStale). */
async function setPassword(person, pw) {
  const email = person.email, now = new Date().toISOString();
  const hash = hashNewPassword(pw);
  const w = await updatePerson(email, p => ({ ...p, hash, passwordChangedAt: now }), `Password changed (${person.name || email})`, person.name || email);
  if (w.error) return w;
  await updateState(email, s => { const history = [person.hash, ...(s.history || [])].filter(Boolean).slice(0, HISTORY_KEEP);
    const { failed, lastFailedAt, lockedAt, reset, ...rest } = s; return { ...rest, history }; }, `Sign-in state cleared for ${email}`);
  mailPerson('changed', email, person.name).catch(() => {});
  return { ok: true, changedAt: now };
}
function tokenIsStale(payload, person) {
  if (!person || !person.passwordChangedAt) return false;
  return (payload.iat || 0) * 1000 < Date.parse(person.passwordChangedAt) - 1000;
}
function personByEmail(people, email) {
  const id = String(email || '').toLowerCase();
  const key = Object.keys(people || {}).find(k => k.toLowerCase() === id);
  return key ? { email: key, ...people[key] } : null;
}
function signedInBody(person, now) {
  const access = {};
  for (const [proj, role] of Object.entries(person.access || {})) { const r = normaliseRole(role); if (r) access[proj] = r; }
  const token = signToken({ sub: person.email, name: person.name, iat: now, exp: now + TOKEN_TTL_SECONDS }, process.env.AUTH_SECRET);
  return { token, name: person.name, email: person.email, access, platformAdmin: person.platformAdmin === true, passwords: true,
           expiresAt: new Date((now + TOKEN_TTL_SECONDS) * 1000).toISOString() };
}

/* ---------- the routes: /{project}/auth/forgot, /auth/reset, /auth/password, /auth/admin-reset ---------- */
async function passwordRoutes(method, subPath, event, headers, proj) {
  if (method !== 'POST') return null;
  const route = { '/auth/forgot': 'forgot', '/auth/reset': 'reset', '/auth/password': 'password', '/auth/admin-reset': 'admin-reset' }[subPath];
  if (!route) return null;
  if (!proj) return respond(404, { error: 'UNKNOWN_PROJECT' });
  const origin = headers['origin'];
  if (origin && origin !== proj.origin) return respond(403, { error: 'ORIGIN', message: 'This relay does not serve that site.' });
  if (!selfServiceOn()) return respond(503, { error: 'PASSWORDS_OFF', message: 'Setting your own password isn\u2019t switched on yet. Ask an administrator to reset it.' });
  if (!process.env.AUTH_SECRET) return respond(500, { error: 'NO_AUTH_SECRET' });
  const parsed = parseBody(event);
  if (parsed.error) return parsed.error;
  const body = parsed.body || {};
  const dir = await readDirectory();
  if (dir.error) return respond(502, { error: dir.error });

  if (route === 'forgot') {
    /* Always the same answer, so it cannot be used to find out who has an account. */
    const same = respond(200, { ok: true, message: 'If there\u2019s an account for that email, a reset link is on its way.' });
    const person = personByEmail(dir.people, body.email);
    if (!person || isExpired(person) || !person.hash) return same;
    const st = await readState(); if (st.error) return same;
    const recent = ((st.accounts[person.email.toLowerCase()] || {}).resetRequests || []).filter(t => Date.now() - Date.parse(t) < 60 * 60_000);
    if (recent.length >= RESET_REQUESTS_PER_HOUR) return same;
    const link = await issueLink(person.email, 'reset', proj.origin);
    if (link.error) return same;
    await updateState(person.email, s => ({ ...s, resetRequests: [...recent, new Date().toISOString()] }), `Reset requested for ${person.email}`);
    await mailPerson('reset', person.email, person.name, link.link);
    return same;
  }

  if (route === 'reset') {
    const person = personByEmail(dir.people, body.email);
    const st = person ? await readState() : { accounts: {} };
    const s = person && !st.error ? (st.accounts[person.email.toLowerCase()] || {}) : {};
    const good = person && !isExpired(person) && s.reset && typeof body.token === 'string' && body.token.length >= 20 &&
      Date.parse(s.reset.expires) > Date.now() && hashesMatch(s.reset.hash, sha256hex(body.token));
    if (!good) return respond(400, { error: 'BAD_LINK', message: 'This link has expired or has already been used. Ask for a new one.' });
    const problems = await checkNewPassword(body.password, { name: person.name, email: person.email, history: s.history || [], current: person.hash });
    if (problems.length) return respond(400, { error: 'WEAK_PASSWORD', problems });
    const set = await setPassword(person, body.password);
    if (set.error) return respond(502, { error: set.error });
    return respond(200, signedInBody(person, Math.floor(Date.now() / 1000) + 1));
  }

  /* The last two need a signed-in person. */
  const auth = headers['authorization'] || '';
  const payload = auth.startsWith('Bearer ') ? verifyToken(auth.slice(7).trim(), process.env.AUTH_SECRET) : { error: 'TOKEN_BAD' };
  if (payload.error) return respond(401, { error: payload.error });
  if (payload.va) return respond(403, { error: 'VIEW_AS_READ_ONLY', message: 'Viewing as someone else is read-only.' });   /* relay request 9 */
  const me = personByEmail(dir.people, payload.sub);
  if (!me || isExpired(me) || tokenIsStale(payload, me)) return respond(401, { error: 'TOKEN_STALE', message: 'Sign in again.' });

  if (route === 'password') {
    if (!verifyPassword(String(body.current || ''), me.hash)) return respond(400, { error: 'WRONG_PASSWORD', message: 'Your current password isn\u2019t right.' });
    const st = await readState();
    const problems = await checkNewPassword(body.password, { name: me.name, email: me.email, history: st.error ? [] : ((st.accounts[me.email.toLowerCase()] || {}).history || []), current: me.hash });
    if (problems.length) return respond(400, { error: 'WEAK_PASSWORD', problems });
    const set = await setPassword(me, body.password);
    if (set.error) return respond(502, { error: set.error });
    /* This session continues: a fresh token, issued after the change. */
    return respond(200, { ok: true, changedAt: set.changedAt, ...signedInBody(me, Math.floor(Date.now() / 1000) + 1) });
  }

  if (route === 'admin-reset') {
    if (me.platformAdmin !== true) return respond(403, { error: 'NOT_PLATFORM_ADMIN' });
    const person = personByEmail(dir.people, body.email);
    if (!person) return respond(404, { error: 'NO_ACCOUNT' });
    const purpose = body.purpose === 'invite' ? 'invite' : 'reset';
    const link = await issueLink(person.email, purpose, proj.origin);
    if (link.error) return respond(502, { error: link.error });
    const mail = await mailPerson(purpose, person.email, person.name, link.link);
    /* Without an email flow the administrator passes the link on; it is shown once. */
    return respond(200, mail.sent ? { emailed: true } : { emailed: false, link: link.link });
  }
  return null;
}

/* One sign-in attempt, once self-service is on: one PBKDF2 whatever happens, the lock checked
 * before the password matters, five wrong guesses lock the account and email a reset link. */
async function attemptSignIn(email, password, origin) {
  const dir = await loadAccess();
  if (dir.error) return { error: dir.error };
  const person = personByEmail(dir.people, email);
  const ok = verifyPassword(password, person ? person.hash : DECOY_HASH);
  if (!person || isExpired(person)) return { response: unknownFailure(email) };
  const id = person.email.toLowerCase(), now = new Date().toISOString();
  const st = await readState();
  if (st.error) return { error: 'DIRECTORY_UNREADABLE' };
  const s = st.accounts[id] || {};
  if (s.lockedAt) return { response: lockedResponse() };
  if (!ok) {
    const failed = (s.failed || 0) + 1;
    if (failed >= MAX_FAILED) {
      await updateState(id, x => ({ ...x, failed, lastFailedAt: now, lockedAt: now }), `Locked ${id} after ${MAX_FAILED} incorrect passwords`);
      const link = await issueLink(person.email, 'reset', origin);
      if (!link.error) await mailPerson('locked', person.email, person.name, link.link);
      return { response: lockedResponse() };
    }
    await updateState(id, x => ({ ...x, failed, lastFailedAt: now }), `Incorrect password for ${id}`);
    return { response: failedResponse(MAX_FAILED - failed) };
  }
  /* the last sign-in is recorded (relay request 9), at most once an hour so signing in doesn't mean a commit each time */
  const stale = !s.lastSignInAt || Date.parse(now) - Date.parse(s.lastSignInAt) > 3_600_000;
  if (s.failed || stale) await updateState(id, x => { const { failed, lastFailedAt, ...rest } = x; return { ...rest, lastSignInAt: now }; }, `Signed in: ${id}`);
  return { found: person };
}

/* =====================================================================================
 * WORK REQUESTS: EACH PERSON'S OWN (relay request 8, 30 Sept 2026)
 *
 * Project hub-requests keeps two files through /data/{id}. The relay, not the page, decides
 * who sees what:
 *   requests  Administrators of Work Requests and platform administrators read and change
 *             every request. Everyone else reads only the requests they created
 *             (createdBy.email), and may only ADD new ones, recorded as theirs, with no
 *             decision on them: a submitted request is not edited by its requester.
 *   drafts    Always each person's own (by.email), administrators included.
 * The page saves the whole file it was shown, so for anyone who sees only part of it, the
 * relay merges: everyone else's entries are kept exactly as stored. A new request whose
 * number another person already holds gets the next free number, reported back in `ids`.
 * /file and /commit are refused for this project, so the files cannot be read or written
 * whole around these rules.
 * ===================================================================================== */
const OWNED_FILES = {
  'hub-requests': {
    requests: { owner: d => d && d.createdBy && d.createdBy.email, adminsSeeAll: true, addOnly: true, prefix: 'REQ-',
                decisionFields: ['wr', 'facilitator', 'assignedTo', 'potentialId', 'potentialName', 'decidedBy', 'decidedAt'] },
    drafts:   { owner: d => d && d.by && d.by.email, adminsSeeAll: false }
  }
};
const lowerOf = s => String(s || '').trim().toLowerCase();
/* Key order can change on a round trip through a browser; compare content, not text. */
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
async function seesAll(rule, who) {
  if (!rule.adminsSeeAll) return false;
  if (who.role === 'admin') return true;
  const pa = await isPlatformAdmin(who.email);
  return !pa.error;
}
function ownView(rule, docs, me) {
  const out = {};
  for (const [id, d] of Object.entries(docs || {})) if (lowerOf(rule.owner(d)) === me) out[id] = d;
  return out;
}
/* The merge for someone who sees only their own entries. Returns { docs, ids } or { error }.
 *   requests (addOnly): every stored request is kept exactly as stored, whatever was sent
 *     for it (a page may hold an older copy of one that has since been decided). Only entries
 *     that are new are taken, and each must be created as the person saving it.
 *   drafts: the person's own entries become what was sent (added, changed or removed);
 *     everyone else's are kept exactly as stored. */
function mergeOwn(rule, stored, sent, me) {
  const docs = { ...stored }, ids = {};
  const isMine = d => lowerOf(rule.owner(d)) === me;
  if (!rule.addOnly) for (const id of Object.keys(stored)) if (isMine(stored[id]) && !(id in sent)) delete docs[id];
  let n = 0;
  if (rule.prefix) for (const k of Object.keys(stored)) { const m = new RegExp('^' + rule.prefix + '(\\d+)$').exec(k); if (m) n = Math.max(n, +m[1]); }
  for (const [id, d] of Object.entries(sent)) {
    const existing = Object.prototype.hasOwnProperty.call(stored, id) ? stored[id] : undefined;
    if (existing !== undefined && isMine(existing)) {
      if (!rule.addOnly) { if (!isMine(d)) return { error: 'NOT_ALLOWED', message: 'Drafts stay with the person who started them.' }; docs[id] = d; }
      continue;                                                   // a submitted request stays as stored
    }
    if (existing !== undefined && canon(existing) === canon(d)) continue;   // someone else's, sent back unchanged
    if (!isMine(d)) return { error: 'NOT_ALLOWED', message: 'You can only add your own.' };
    let entry = d;
    if (rule.addOnly) {
      if (d.status && d.status !== 'new') return { error: 'NOT_ALLOWED', message: 'A new work request starts as new.' };
      entry = { ...d, status: 'new' };
      for (const f of rule.decisionFields || []) if (entry[f]) entry[f] = f === 'decidedBy' ? null : '';
    }
    let newId = id;
    if (existing !== undefined || newId in docs || !/^[A-Za-z0-9-]{1,40}$/.test(id)) {
      if (!rule.prefix) return { error: 'BAD_ID' };
      do { n++; newId = rule.prefix + String(n).padStart(4, '0'); } while (newId in docs);
      ids[id] = newId;
    }
    if (rule.prefix && entry.id && entry.id !== newId) entry = { ...entry, id: newId };
    docs[newId] = entry;
  }
  return { docs, ids };
}
async function ownedData(rule, method, id, event, who, repo, branch) {
  const filePath = `data/${id}.json`, me = lowerOf(who.email);
  const all = await seesAll(rule, who);
  if (method === 'GET') {
    const file = await readFile(repo, branch, filePath);
    if (file.status === 404) return respond(200, { data: null, sha: null });
    if (file.corrupt) return respond(502, { error: 'CORRUPT', message: 'The committed data file is not valid JSON.' });
    if (file.status !== 200) return respond(502, { error: 'GITHUB', status: file.status, message: file.message });
    const docs = (file.data && file.data.docs) || {};
    return respond(200, { data: { docs: all ? docs : ownView(rule, docs, me) }, sha: file.sha, scope: all ? 'all' : 'own' });
  }
  if (method !== 'PUT') return respond(405, { error: 'METHOD' });
  const { body, error } = parseBody(event);
  if (error) return error;
  if (!body || typeof body.content !== 'object' || body.content === null) return respond(400, { error: 'BAD_CONTENT' });
  const sent = (body.content.docs && typeof body.content.docs === 'object') ? body.content.docs : {};
  for (let tries = 0; tries < 4; tries++) {
    const file = await readFile(repo, branch, filePath);
    if (file.status !== 200 && file.status !== 404) return respond(502, { error: 'GITHUB', status: file.status });
    const stored = (file.data && file.data.docs) || {};
    /* Someone who sees everything saves as before, guarded by the version they read. */
    if (all && body.sha && file.sha && body.sha !== file.sha) return respond(409, { error: 'CONFLICT', message: 'Someone else saved first.' });
    const merged = all ? { docs: sent, ids: {} } : mergeOwn(rule, stored, sent, me);
    if (merged.error) return respond(403, { error: merged.error, message: merged.message });
    const payload = { docs: merged.docs, savedBy: who.name, savedAt: new Date().toISOString() };
    const { status, json } = await github('PUT', `/repos/${repo}/contents/${filePath}`, {
      message: `Update ${id} (saved by ${who.name})`, content: encodeBase64Utf8(payload), branch,
      sha: file.sha || undefined, author: authorFor(who.name)
    });
    if (status === 200 || status === 201) {
      return respond(200, { sha: json.content?.sha, savedBy: who.name, ids: merged.ids,
        data: { docs: all ? merged.docs : ownView(rule, merged.docs, me) } });
    }
    if (status !== 409 && status !== 422) return writeOutcome(status, json, true) || respond(502, { error: 'GITHUB', status });
    /* Someone saved in between: read again and merge again; their entries are kept. */
  }
  return respond(409, { error: 'CONFLICT', message: 'Too many saves at once. Try again.' });
}

export async function handler(event, context) {
  currentContext = context || null;
  const method = (event.requestContext?.http?.method || 'GET').toUpperCase();
  const rawPath = event.rawPath || '/';
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));

  responseOrigin = null;

  // Every path starts with the project key. One lookup decides repo, branch and origin.
  const projMatch = rawPath.match(/^\/([a-z0-9-]+)(\/.*)?$/);
  let proj = null;
  try {
    proj = projMatch ? await projectConfig(projMatch[1]) : null;
  } catch (e) {
    // The project list could not be read at all. Refusing is the only safe answer: we do
    // not know which repository this request belongs to, and guessing writes to the wrong
    // one. 503 says "try again", not "your request was wrong".
    console.error('project config unavailable:', e.message);
    if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(null), body: '' };
    return respond(503, { error: 'CONFIG_UNAVAILABLE', message: 'Saving is briefly unavailable. Nothing was written — try again in a minute.' });
  }
  const subPath = projMatch ? (projMatch[2] || '/') : '/';
  currentProjectKey = proj ? proj.key : null;
  if (proj) responseOrigin = proj.origin;

  /* GET /version — no project, no credentials, reveals nothing that is not already in the
   * public repository. See SOURCE_SHA256 above. */
  if (method === 'GET' && (event.rawPath === '/version' || event.rawPath === '/version/')) {
    await flushUsage(true).catch(() => {});   /* the keep-warm ping writes out the Ask counts (spending by tool) */
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
             body: JSON.stringify({ sha256: SOURCE_SHA256 }) };
  }

  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(responseOrigin), body: '' };

  /* POST /{project}/auth/login  { email, password } -> { token, name, role, expiresAt }
   *
   * The only route that sees a password. Everything else takes the token it returns.
   * When Cognito replaces this, the page keeps calling something that returns a token and
   * the rest of the relay is untouched — which is the point of doing it this way now. */
  if (method === 'POST' && subPath === '/auth/login') {
    if (!proj) return respond(404, { error: 'UNKNOWN_PROJECT' });
    const secret = process.env.AUTH_SECRET;
    if (!secret) return respond(500, { error: 'NO_AUTH_SECRET', message: 'AUTH_SECRET is not set on the function.' });

    const parsed = parseBody(event);
    if (parsed.error) return parsed.error;
    const email = typeof parsed.body?.email === 'string' ? parsed.body.email.trim() : '';
    const password = typeof parsed.body?.password === 'string' ? parsed.body.password : '';
    if (!email || !password) return respond(400, { error: 'MISSING_CREDENTIALS' });

    /* The directory is the real source. The per-repository facilitators.json is tried only
     * if no directory exists yet, so this works before and after the migration. */
    let found;
    if (selfServiceOn()) {
      const a = await attemptSignIn(email, password, proj.origin);
      if (a.response) return a.response;
      found = a.found || { error: a.error };
    } else {
      found = await findPerson(email, password);
    }
    let access = null;
    if (!found.error) {
      /* Normalised here so the page only ever sees admin/staff/view. A hand-edited
       * entry with an unrecognised role is dropped rather than passed through, which
       * keeps the page's idea of access identical to what the relay will enforce. */
      access = {};
      for (const [proj, role] of Object.entries(found.access || {})) {
        const r = normaliseRole(role);
        if (r) access[proj] = r;
      }
    } else if (found.error === 'NO_DIRECTORY') {
      const legacy = await findAccount(proj.repo, proj.branch, email, password);
      if (legacy.error === 'FACILITATORS_UNREADABLE') return respond(502, { error: legacy.error });
      if (legacy.error) return respond(401, { error: 'SIGNIN_FAILED', message: 'That email and password do not match an account.' });
      found = legacy;
      access = { [proj.key]: legacy.role };
    } else if (found.error === 'DIRECTORY_UNREADABLE') {
      return respond(502, { error: 'DIRECTORY_UNREADABLE', message: 'The account directory could not be read.' });
    } else {
      /* One message for "no such account", "wrong password" and "expired", so the response
       * cannot be used to discover who holds an account. */
      return respond(401, { error: 'SIGNIN_FAILED', message: 'That email and password do not match an account.' });
    }

    const now = Math.floor(Date.now() / 1000);
    /* No project in the token: signing in once covers every tool the person has access to.
     * Which tools those are is decided per request, not here. */
    const token = signToken({
      sub: found.email, name: found.name, iat: now, exp: now + TOKEN_TTL_SECONDS
    }, secret);
    /* Reported so the page can show the People & access link to the people who can
     * actually use it. It is display only — the /access routes check the directory
     * themselves on every request and do not trust anything sent back here. */
    return respond(200, {
      token, name: found.name, email: found.email, access,
      platformAdmin: found.platformAdmin === true,
      passwords: selfServiceOn(),     // the account menu offers Change password only when this is true
      expiresAt: new Date((now + TOKEN_TTL_SECONDS) * 1000).toISOString()
    });
  }
  /* GET /{project}/auth/me -> what the signed-in person may reach NOW, read fresh from the
   * account list, so their account menu shows a change an administrator just made without
   * waiting for them to sign in again. Read-only; reveals nothing about anyone else. */
  if (method === 'GET' && subPath === '/auth/me') {
    if (!proj) return respond(404, { error: 'UNKNOWN_PROJECT' });
    const o = headers['origin'];
    if (o && o !== proj.origin) return respond(403, { error: 'ORIGIN', message: 'This relay does not serve that site.' });
    if (!process.env.AUTH_SECRET) return respond(500, { error: 'NO_AUTH_SECRET' });
    const auth = headers['authorization'] || '';
    const payload = auth.startsWith('Bearer ') ? verifyToken(auth.slice(7).trim(), process.env.AUTH_SECRET) : { error: 'TOKEN_BAD' };
    if (payload.error) return respond(401, { error: payload.error });
    const dir = await loadAccess();
    if (dir.error) return respond(dir.error === 'NO_DIRECTORY' ? 404 : 502, { error: dir.error });
    const me = personByEmail(dir.people, payload.sub);
    if (!me || isExpired(me)) return respond(401, { error: 'NO_ACCOUNT' });
    if (tokenIsStale(payload, me)) return respond(401, { error: 'TOKEN_STALE', message: 'Your password was changed. Sign in again.' });
    const access = {};
    for (const [k, role] of Object.entries(me.access || {})) { const r = normaliseRole(role); if (r) access[k] = r; }
    return respond(200, { name: me.name || me.email, email: me.email, access, platformAdmin: me.platformAdmin === true, passwords: selfServiceOn(),
      ...(payload.va ? { viewAs: { by: payload.va, until: new Date(payload.exp * 1000).toISOString() } } : {}) });
  }
  /* POST /{project}/auth/view-as {email} (relay request 9): a platform administrator sees the site as someone else,
   * read-only, for 30 minutes. Never as another administrator. Each use is recorded in access-log.json before the
   * token is issued (no record, no token). Every save made with the token is refused (see the guard below). */
  if (method === 'POST' && subPath === '/auth/view-as') {
    if (!proj) return respond(404, { error: 'UNKNOWN_PROJECT' });
    const o = headers['origin']; if (o && o !== proj.origin) return respond(403, { error: 'ORIGIN', message: 'This relay does not serve that site.' });
    if (!process.env.AUTH_SECRET) return respond(500, { error: 'NO_AUTH_SECRET' });
    const auth = headers['authorization'] || '';
    const payload = auth.startsWith('Bearer ') ? verifyToken(auth.slice(7).trim(), process.env.AUTH_SECRET) : { error: 'TOKEN_BAD' };
    if (payload.error) return respond(401, { error: payload.error });
    if (payload.va) return respond(403, { error: 'VIEW_AS_READ_ONLY', message: 'Viewing as someone else is read-only.' });
    const dir = await loadAccess(); if (dir.error) return respond(502, { error: dir.error });
    const me = personByEmail(dir.people, payload.sub);
    if (!me || isExpired(me) || tokenIsStale(payload, me)) return respond(401, { error: 'TOKEN_STALE', message: 'Sign in again.' });
    if (me.platformAdmin !== true) return respond(403, { error: 'NOT_PLATFORM_ADMIN' });
    const { body, error } = parseBody(event); if (error) return error;
    const target = personByEmail(dir.people, lowerOf(body && body.email));
    if (!target || isExpired(target)) return respond(404, { error: 'NO_ACCOUNT' });
    if (target.platformAdmin === true) return respond(403, { error: 'VIEW_AS_ADMIN', message: 'An administrator can\u2019t be viewed as.' });
    const now = Math.floor(Date.now() / 1000), until = now + VIEW_AS_SECONDS, untilIso = new Date(until * 1000).toISOString();
    const logged = await acctUpdate(LOG_PATH, d => ({ entries: [{ kind: 'view-as', by: me.email, as: target.email, at: new Date().toISOString(), until: untilIso },
      ...(Array.isArray(d.entries) ? d.entries : [])].slice(0, 500) }), `View as ${target.email} (by ${me.email})`);
    if (logged.error) return respond(502, { error: 'NOT_RECORDED', message: 'View as could not be recorded, so it wasn\u2019t started.' });
    const token = signToken({ sub: target.email, name: target.name || target.email, iat: now, exp: until, va: me.email }, process.env.AUTH_SECRET);
    const access = {}; for (const [k, role] of Object.entries(target.access || {})) { const r = normaliseRole(role); if (r) access[k] = r; }
    return respond(200, { token, name: target.name || target.email, email: target.email, access, platformAdmin: false, expiresAt: until * 1000, viewAs: { by: me.email, until: untilIso } });
  }
  const pwRoute = await passwordRoutes(method, subPath, event, headers, proj);
  if (pwRoute) return pwRoute;
  if (!proj) return respond(404, { error: 'UNKNOWN_PROJECT' });
  const origin = headers['origin'];
  if (origin && origin !== proj.origin) {
    return respond(403, { error: 'ORIGIN', message: 'This relay does not serve that site.' });
  }

  const repo = proj.repo;
  const branch = proj.branch;

  const dataMatch = subPath.match(/^\/data\/([^/]+)$/);
  const fileMatch = subPath.match(/^\/file\/(.+)$/);
  const isAccess = subPath === '/access';
  const potentialMatch = subPath.match(/^\/potential\/([^/]+)$/);
  const configMatch = subPath.match(/^\/config\/([a-z0-9-]+)$/);
  const commitMatch = subPath === '/commit';
  const isFacilitators = subPath === '/facilitators';
  const isAsk = subPath === '/ask';
  const isBreakglass = /^\/breakglass(\/[A-Za-z0-9-]+)?$/.test(subPath), isActivity = subPath === '/activity', isUsage = subPath === '/ask-usage';
  if (!dataMatch && !potentialMatch && !isFacilitators && !configMatch && !commitMatch && !fileMatch && !isAccess && !isAsk && !isBreakglass && !isActivity && !isUsage) return respond(404, { error: 'NOT_FOUND' });
  if (configMatch && !CONFIG_FILES[configMatch[1]]) return respond(404, { error: 'NOT_FOUND' });

  const who = await authenticate(headers, repo, branch);
  if (who.error === 'FACILITATORS_UNREADABLE') return respond(502, { error: 'FACILITATORS_UNREADABLE', message: 'facilitators.json could not be read. The site owner needs to check it.' });
  if (who.error === 'KEY_EXPIRED') return respond(401, { error: 'KEY_EXPIRED', message: 'That account has expired.' });
  if (who.error === 'NO_AUTH_SECRET') return respond(500, { error: 'NO_AUTH_SECRET', message: 'AUTH_SECRET is not set on the function.' });
  /* Token failures keep their own codes so the page can tell "sign in again" from
   * "that was refused" — an expired token means re-authenticate silently, a bad one
   * means something is wrong. Collapsing them into KEY_BAD would make an ordinary
   * eight-hour expiry look like a rejected credential. */
  if (who.error === 'TOKEN_EXPIRED') return respond(401, { error: 'TOKEN_EXPIRED', message: 'Your session has expired. Sign in again.' });
  if (who.error === 'TOKEN_STALE') return respond(401, { error: 'TOKEN_STALE', message: 'Your password was changed. Sign in again.' });
  if (who.error === 'TOKEN_WRONG_PROJECT') return respond(401, { error: 'TOKEN_WRONG_PROJECT', message: 'That session belongs to a different application.' });
  if (who.error === 'TOKEN_BAD') return respond(401, { error: 'TOKEN_BAD', message: 'That session could not be verified. Sign in again.' });
  if (who.error === 'NO_ACCESS') return respond(403, { error: 'NO_ACCESS', message: 'Your account does not have access to this application.' });
  if (who.error === 'NO_ACCOUNT') return respond(401, { error: 'NO_ACCOUNT', message: 'That account no longer exists. Sign in again.' });
  if (who.error === 'ACCOUNT_EXPIRED') return respond(401, { error: 'ACCOUNT_EXPIRED', message: 'That account has expired.' });
  if (who.error === 'DIRECTORY_UNREADABLE') return respond(502, { error: 'DIRECTORY_UNREADABLE', message: 'The account directory could not be read.' });
  if (who.error) return respond(401, { error: 'KEY_BAD', message: 'That email and password were not recognised.' });

  /* ----- view-only accounts cannot write -----
   *
   * One guard in front of every route rather than a check inside each, because the
   * routes that write are not a fixed list — /commit and /file were both added after
   * the first version, and a per-route check is a thing to remember. Anything that is
   * not a GET is refused here, so a new write route is covered the day it is written.
   *
   * /access is the exception and is left to its own gate below: it is the directory,
   * not this project's content, and it turns on whether the caller is a platform
   * administrator rather than on what they hold here. A platform administrator with
   * view access to one tool must still be able to manage people. */
  /* View as is read-only everywhere (relay request 9). Answered as VIEW_ONLY, which every page already handles (the
   * shared sign-in's access probe reads it as View), with viewAs set so a page can say why. */
  if (who.viewAs && method !== 'GET') return respond(403, { error: 'VIEW_ONLY', viewAs: true, message: 'Viewing as someone else is read-only.' });
  if (!isAccess && !isAsk && !isBreakglass && method !== 'GET' && who.role === 'view') {   /* asking writes nothing (relay request 9) */
    return respond(403, { error: 'VIEW_ONLY',
      message: 'Your account has view access to this application. You can read it but not save changes.' });
  }

  if (isAsk) return method === 'POST' ? askRoute(proj, who, event) : respond(405, { error: 'METHOD' });
  if (isBreakglass) return breakGlass(method, subPath, event, who);
  if (isActivity) return method === 'GET' ? activity(event, who) : respond(405, { error: 'METHOD' });
  if (isUsage) return method === 'GET' ? askUsage(who) : respond(405, { error: 'METHOD' });

  /* ----- dashboards: staff or admin ----- */
  /* GET  /{project}/access — the whole directory, for the admin panel.
   * PUT  /{project}/access — replaces it.
   *
   * The directory lives beside projects.json in the config repository, not in any
   * project's own repository, so this writes there rather than to proj.repo. */
  if (isAccess) {
    if (!directoryLoc().repo) return respond(500, { error: 'NO_DIRECTORY' });

    const may = await isPlatformAdmin(who.email);
    if (may.error === 'NOT_PLATFORM_ADMIN') {
      return respond(403, { error: 'NOT_PLATFORM_ADMIN',
        message: 'Only a platform administrator can view or change who has access.' });
    }
    if (may.error) return respond(502, { error: may.error });

    if (method === 'GET') {
      const dir = await readDirectory();
      if (dir.error) return respond(502, { error: 'GITHUB', status: dir.status });
      /* `fields` tells the admin panel which optional entries this relay keeps, so a control
       * for one is only shown once the relay that saves it is deployed. */
      /* 'auth' means people can set their own passwords: the panel then shows locks and
       * emails reset links instead of showing a new password. */
      const out = { people: dir.people, sha: dir.sha, fields: selfServiceOn() ? ['group', 'auth'] : ['group'], groups: [...PEOPLE_GROUPS] };   /* the sections it keeps: the panel moves facilitators over when it sees 'facilitator' */
      if (selfServiceOn()) {
        const st = await readState();
        if (!st.error) out.auth = Object.fromEntries(Object.entries(st.accounts).map(([e, s]) => [e, { locked: !!s.lockedAt, failed: s.failed || 0, lastSignInAt: s.lastSignInAt || null }]));
      }
      return respond(200, out);
    }

    if (method === 'PUT') {
      const parsed = parseBody(event);
      if (parsed.error) return parsed.error;
      const people = parsed.body?.people;
      if (!people || typeof people !== 'object' || Array.isArray(people)) {
        return respond(400, { error: 'BAD_BODY', message: 'people must be an object keyed by email.' });
      }
      const entries = Object.entries(people);
      if (entries.length > 500) return respond(400, { error: 'TOO_MANY' });
      const current = await readDirectory();
      if (current.error) return respond(502, { error: current.error });
      const rehashed = [];

      const clean = {};
      const seen = new Set();
      for (const [rawEmail, p] of entries) {
        const email = String(rawEmail).trim().toLowerCase();
        if (!email.includes('@') || email.length > 160) return respond(400, { error: 'BAD_EMAIL', email: rawEmail });
        if (seen.has(email)) return respond(400, { error: 'DUPLICATE_EMAIL', email });
        seen.add(email);
        if (!p || typeof p !== 'object') return respond(400, { error: 'BAD_PERSON', email });
        const name = String(p.name || '').trim();
        if (!name || name.length > 120) return respond(400, { error: 'BAD_NAME', email });
        if (!isStoredHash(p.hash)) return respond(400, { error: 'BAD_HASH', email });

        const access = {};
        for (const [proj, role] of Object.entries(p.access || {})) {
          if (!/^[a-z0-9-]{1,40}$/.test(proj)) return respond(400, { error: 'BAD_PROJECT', project: proj });
          /* No entry at all is how "no access" is stored, so a falsy role is simply
           * left out rather than saved as a third state. The panel sends the map it
           * wants; removing a tool from it removes the access. */
          if (!role) continue;
          const r = normaliseRole(role);
          if (!r) return respond(400, { error: 'BAD_ROLE', project: proj, role });
          access[proj] = r;
        }
        const entry = { name, hash: p.hash, access };
        /* When the password was last changed: kept from the stored list, never taken from the
         * panel, and set to now when the panel changes the hash. */
        const before = personByEmail(current.people, email);
        if (before && before.hash === p.hash) { if (before.passwordChangedAt) entry.passwordChangedAt = before.passwordChangedAt; }
        else { entry.passwordChangedAt = new Date().toISOString(); if (before) rehashed.push(email); }
        if (p.platformAdmin === true) entry.platformAdmin = true;
        /* The section the admin panel lists them in. Display only: it grants nothing. */
        if (p.group !== undefined && p.group !== null && p.group !== '') {
          if (!PEOPLE_GROUPS.has(p.group)) return respond(400, { error: 'BAD_GROUP', email, group: p.group });
          entry.group = p.group;
        }
        if (p.expires) {
          const d = String(p.expires).slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return respond(400, { error: 'BAD_DATE', email });
          entry.expires = d;
        }
        clean[email] = entry;
      }

      /* Two ways to lock everyone out, both refused rather than saved:
       * removing the last platform administrator, and removing your own. */
      const remaining = Object.entries(clean).filter(([, p]) => p.platformAdmin === true && !isExpired(p));
      if (!remaining.length) {
        return respond(400, { error: 'NO_PLATFORM_ADMIN',
          message: 'At least one platform administrator must remain.' });
      }
      if (!remaining.some(([email]) => email === String(who.email).toLowerCase())) {
        return respond(400, { error: 'WOULD_LOCK_SELF_OUT',
          message: 'You cannot remove your own platform administrator access here.' });
      }

      /* While the list is still being read from the old public file, this save is the one that
       * creates it in the private repository, so it is written there without a sha. */
      const writeSha = current.source === 'legacy' ? null : (parsed.body.sha || null);
      const { status, json } = await writeDirectory(clean, writeSha, `Update who has access (by ${who.name})`, who.name);
      const bad = writeOutcome(status, json, !!writeSha);
      if (bad) return bad;
      __resetAccessCache();          // the next request must see the change, not the cache
      /* An administrator who sets a new password for someone also unlocks them. */
      if (selfServiceOn()) for (const email of rehashed) {
        await updateState(email, s => { const { failed, lastFailedAt, lockedAt, reset, ...rest } = s; return rest; }, `Unlocked ${email} (new password from ${who.name})`);
      }
      return respond(200, { sha: json.content?.sha, savedBy: who.name, count: Object.keys(clean).length });
    }

    return respond(405, { error: 'METHOD' });
  }

  /* GET /{project}/file/{path} — hands one file back, base64, to a recognised account.
   *
   * Deliberately narrow. It reads only inside the folders the project declares as
   * writable, so it cannot be used to read the account list or anything else in the
   * repository, and it exists so that files kept in a PRIVATE repository can reach a
   * signed-in person without the repository being public. Anyone not signed in gets
   * nothing: the authentication above has already run. */
  /* A project whose files are each person's own is read and saved only through /data, so
   * neither route can be used to read or write those files whole. */
  if (OWNED_FILES[proj.key] && (fileMatch || commitMatch)) {
    return respond(403, { error: 'NOT_ALLOWED', message: 'Work requests are read and saved one person at a time.' });
  }
  if (membersPaths(proj).size && (fileMatch || commitMatch)) {
    const mp = membersPaths(proj); let paths = [];
    if (fileMatch) paths = [decodeURIComponent(fileMatch[1])];
    else { const pb = parseBody(event); paths = (pb.body && Array.isArray(pb.body.files) ? pb.body.files : []).map(f => String((f && f.path) || '')); }
    if (paths.some(x => mp.has(x.replace(/^\.?\/+/, '')))) return respond(403, { error: 'MEMBERS_ONLY', message: 'That file is read and saved one person at a time.' });
  }
  if (fileMatch && method === 'GET') {
    const wanted = decodeURIComponent(fileMatch[1]);
    if (wanted.includes('..') || wanted.startsWith('/')) return respond(400, { error: 'BAD_PATH' });
    if (!pathAllowed(wanted, proj.readable)) {
      return respond(403, { error: 'PATH_NOT_READABLE', path: wanted,
        message: 'That file is outside what this application holds.' });
    }
    const res = await github('GET', `/repos/${repo}/contents/${encodeURI(wanted)}?ref=${encodeURIComponent(branch)}`);
    if (res.status === 404) return respond(404, { error: 'NOT_FOUND', path: wanted });
    if (res.status !== 200) return respond(502, { error: 'GITHUB', status: res.status });
    /* Larger files come back without content and have to be fetched as a blob. */
    let content = res.json && res.json.content ? String(res.json.content).replace(/\s/g, '') : null;
    if (!content && res.json && res.json.sha) {
      const blob = await github('GET', `/repos/${repo}/git/blobs/${res.json.sha}`);
      if (blob.status !== 200) return respond(502, { error: 'GITHUB', status: blob.status });
      content = String(blob.json.content || '').replace(/\s/g, '');
    }
    if (!content) return respond(502, { error: 'EMPTY', path: wanted });
    return respond(200, { path: wanted, size: res.json.size || null, sha: res.json.sha, content: content });
  }

  if (dataMatch) {
    const id = dataMatch[1];
    if (!DASHBOARD_ID.test(id) || RESERVED_IDS.has(id)) return respond(400, { error: 'BAD_ID' });
    /* Work Requests: each person's own (see WORK REQUESTS: EACH PERSON'S OWN). */
    const ownRule = OWNED_FILES[proj.key] && OWNED_FILES[proj.key][id];
    if (ownRule) return ownedData(ownRule, method, id, event, who, repo, branch);
    if (proj.membersOnly && Object.prototype.hasOwnProperty.call(proj.membersOnly, id)) return membersData(proj, proj.membersOnly[id], method, id, event, who);
    const filePath = `data/${id}.json`;

    if (method === 'GET') {
      const file = await readFile(repo, branch, filePath);
      if (file.status === 404) return respond(200, { data: null, sha: null });
      if (file.corrupt) return respond(502, { error: 'CORRUPT', message: 'The committed data file is not valid JSON.' });
      if (file.status !== 200) return respond(502, { error: 'GITHUB', status: file.status, message: file.message });
      return respond(200, { data: file.data, sha: file.sha });
    }

    if (method === 'PUT') {
      const { body, error } = parseBody(event);
      if (error) return error;
      if (!body || typeof body.content !== 'object' || body.content === null) return respond(400, { error: 'BAD_CONTENT' });
      if (body.sha != null && !BLOB_SHA.test(body.sha)) return respond(400, { error: 'BAD_SHA' });

      const payload = { ...body.content, savedBy: who.name, savedAt: new Date().toISOString() };
      const { status, json } = await github('PUT', `/repos/${repo}/contents/${filePath}`, {
        message: `Update ${id.toUpperCase()} dashboard data (saved by ${who.name})`,
        content: encodeBase64Utf8(payload),
        branch,
        sha: body.sha || undefined,
        // The person is the author; the token owner is the committer. History shows who.
        author: authorFor(who.name)
      });
      const bad = writeOutcome(status, json, !!body.sha);
      if (bad) return bad;
      return respond(200, { sha: json.content?.sha, savedBy: who.name });
    }

    return respond(405, { error: 'METHOD' });
  }

  /* ----- arbitrary commit via the Git Data API: facilitator or admin -----
   * The Contents API used everywhere else refuses files over 1MB and writes one file per
   * call. The glossary's working copy is far larger than that and its content and metadata
   * must not be able to disagree, so it needs blobs -> tree -> commit -> ref instead.
   * parentSha is the commit the caller last read: the ref update is NOT forced, so if the
   * branch moved underneath, GitHub rejects it rather than discarding the other commit. */
  if (commitMatch) {
    if (method !== 'POST' && method !== 'PUT') return respond(405, { error: 'METHOD' });
    const { body, error } = parseBody(event, MAX_COMMIT_BYTES);
    if (error) return error;
    const files = Array.isArray(body?.files) ? body.files : null;
    if (!files || !files.length) return respond(400, { error: 'BAD_CONTENT' });
    if (files.length > 50) return respond(400, { error: 'TOO_MANY_FILES' });
    for (const f of files) {
      if (typeof f?.path !== 'string' || !f.path || f.path.includes('..') || f.path.startsWith('/')) {
        return respond(400, { error: 'BAD_PATH', path: f?.path });
      }
      /* Checked for every file before anything is written, so a single disallowed path
       * rejects the whole commit rather than writing the rest. */
      if (!commitPathAllowed(f.path, proj.writable)) {
        return respond(403, { error: 'PATH_NOT_WRITABLE', path: f.path,
          message: 'That file cannot be changed through saving. It is outside what this application is allowed to write.' });
      }
      if (typeof f?.content !== 'string') return respond(400, { error: 'BAD_FILE', path: f.path });
    }
    const message = typeof body.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 500) : 'Update';

    try {
      const ref = await github('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, null, { stale: false });
      if (ref.status !== 200) return respond(502, { error: 'GITHUB', status: ref.status });
      const head = ref.json.object.sha;
      // The caller tells us which commit it read. Mismatch means someone else committed.
      if (body.parentSha && body.parentSha !== head) return respond(409, { error: 'CONFLICT', head });

      const baseCommit = await github('GET', `/repos/${repo}/git/commits/${head}`);
      if (baseCommit.status !== 200) return respond(502, { error: 'GITHUB', status: baseCommit.status });

      const tree = [];
      for (const f of files) {
        /* Text is the default and is encoded here. A file with encoding:'base64' is
         * passed through untouched: treating a PDF as UTF-8 text would mangle every byte
         * that is not valid UTF-8, and the corruption would only show when someone tried
         * to open it. */
        const isB64 = f.encoding === 'base64';
        if (isB64 && !/^[A-Za-z0-9+/]*={0,2}$/.test(String(f.content).replace(/\s/g, ''))) {
          return respond(400, { error: 'BAD_BASE64', path: f.path });
        }
        const blob = await github('POST', `/repos/${repo}/git/blobs`, {
          content: isB64 ? String(f.content).replace(/\s/g, '') : Buffer.from(f.content, 'utf8').toString('base64'),
          encoding: 'base64'
        });
        if (blob.status !== 201) return respond(502, { error: 'GITHUB', status: blob.status, path: f.path });
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.json.sha });
      }
      const newTree = await github('POST', `/repos/${repo}/git/trees`, { base_tree: baseCommit.json.tree.sha, tree });
      if (newTree.status !== 201) return respond(502, { error: 'GITHUB', status: newTree.status });

      const commit = await github('POST', `/repos/${repo}/git/commits`, {
        message: `${message} [${who.name}]`, tree: newTree.json.sha, parents: [head], author: authorFor(who.name)
      });
      if (commit.status !== 201) return respond(502, { error: 'GITHUB', status: commit.status });

      const upd = await github('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        sha: commit.json.sha, force: false
      });
      if (upd.status === 422) return respond(409, { error: 'CONFLICT' });
      if (upd.status !== 200) return respond(502, { error: 'GITHUB', status: upd.status });

      return respond(200, { commit: commit.json.sha, savedBy: who.name });
    } catch (e) {
      return respond(502, { error: 'GITHUB', message: String(e && e.message || e) });
    }
  }

  /* ----- potential initiatives: facilitator or admin ----- */
  if (potentialMatch) {
    const id = potentialMatch[1];
    if (!DASHBOARD_ID.test(id) || id === 'index') return respond(400, { error: 'BAD_ID' });
    const filePath = `data/potential/${id}.json`;

    if (method === 'GET') {
      const file = await readFile(repo, branch, filePath);
      if (file.status === 404) return respond(200, { data: null, sha: null });
      if (file.corrupt) return respond(502, { error: 'CORRUPT' });
      if (file.status !== 200) return respond(502, { error: 'GITHUB', status: file.status, message: file.message });
      return respond(200, { data: file.data, sha: file.sha });
    }

    if (method === 'PUT') {
      const { body, error } = parseBody(event);
      if (error) return error;
      if (body?.sha != null && !BLOB_SHA.test(body.sha)) return respond(400, { error: 'BAD_SHA' });
      const typesFile = await readFile(repo, branch, 'stakeholder-types.json');
      const typeKeys = new Set((typesFile.data?.types || []).map(t => t.key));
      const v = validatePotential(id, body?.content, typeKeys);
      if (v.error) return respond(400, v);

      const payload = { ...v.content, savedBy: who.name, savedAt: new Date().toISOString() };
      const { status, json } = await github('PUT', `/repos/${repo}/contents/${filePath}`, {
        message: `${body.sha ? 'Update' : 'Create'} potential initiative "${v.content.name}" (saved by ${who.name})`,
        content: encodeBase64Utf8(payload), branch, sha: body.sha || undefined, author: authorFor(who.name)
      });
      const bad = writeOutcome(status, json, !!body.sha);
      if (bad) return bad;

      // Static hosting can't list a directory, so the hub reads an index. Add the id if
      // it's new. Read-modify-write with the index's own SHA; one retry on a race.
      let indexed = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        const idx = await readFile(repo, branch, POTENTIAL_INDEX);
        const ids = Array.isArray(idx.data?.ids) ? idx.data.ids : [];
        if (ids.includes(id)) break;
        const r = await github('PUT', `/repos/${repo}/contents/${POTENTIAL_INDEX}`, {
          message: `Index potential initiative "${v.content.name}"`,
          content: encodeBase64Utf8({ ids: [...ids, id] }), branch, sha: idx.sha || undefined, author: authorFor(who.name)
        });
        if (r.status === 200 || r.status === 201) break;
        if (attempt === 1) indexed = false;
      }
      return respond(200, { sha: json.content?.sha, savedBy: who.name, indexed });
    }
    return respond(405, { error: 'METHOD' });
  }

  /* ----- config + facilitators: admin only ----- */
  if (who.role !== 'admin') return respond(403, { error: 'ADMIN_ONLY', message: 'Only the admin key can do that.' });

  if (configMatch) {
    const cfg = CONFIG_FILES[configMatch[1]];
    if (method === 'GET') {
      const file = await readFile(repo, branch, cfg.path);
      if (file.status === 404) return respond(200, { content: null, sha: null });
      if (file.corrupt) return respond(502, { error: 'CORRUPT', message: `${cfg.path} is not valid JSON.` });
      if (file.status !== 200) return respond(502, { error: 'GITHUB', status: file.status, message: file.message });
      return respond(200, { content: file.data, sha: file.sha });
    }
    if (method === 'PUT') {
      const { body, error } = parseBody(event);
      if (error) return error;
      if (body?.sha != null && !BLOB_SHA.test(body.sha)) return respond(400, { error: 'BAD_SHA' });
      const current = await readFile(repo, branch, cfg.path);
      if (current.corrupt) return respond(502, { error: 'CORRUPT' });
      const v = cfg.validate(body?.content, current.data);
      if (v.error) return respond(400, v);
      const { status, json } = await github('PUT', `/repos/${repo}/contents/${cfg.path}`, {
        message: `Update ${configMatch[1]} (by ${who.name})`,
        content: encodeBase64Utf8(v.content),
        branch,
        sha: body.sha || undefined,
        author: authorFor(who.name)
      });
      const bad = writeOutcome(status, json, !!body.sha);
      if (bad) return bad;
      return respond(200, { sha: json.content?.sha });
    }
    return respond(405, { error: 'METHOD' });
  }

  if (method === 'GET') {
    const list = await loadFacilitators(repo, branch, { fresh: true });
    if (list.error) return respond(502, { error: 'FACILITATORS_UNREADABLE' });
    // Hashes are included because the panel replaces the whole list on save and must
    // resend the entries it did not change. They are pbkdf2 at 210,000 iterations, so a
    // copy is not usefully crackable, and this route is admin-only. The file itself is no
    // longer web-served — it moved to _internal/ so GitHub Pages does not publish it.
    // Admins' hashes are still withheld: the panel never writes the admin list.
    return respond(200, {
      sha: list.sha,
      admin: list.adminList.length ? { name: list.adminList[0].name } : null,
      admins: list.adminList.map(a => ({ name: a.name })),
      facilitators: list.facilitators.map(f => ({ name: f.name, email: f.email || '', hash: f.hash, expires: f.expires || null }))
    });
  }

  if (method === 'PUT') {
    const { body, error } = parseBody(event);
    if (error) return error;
    if (!body || !Array.isArray(body.facilitators)) return respond(400, { error: 'BAD_CONTENT' });
    if (body.sha != null && !BLOB_SHA.test(body.sha)) return respond(400, { error: 'BAD_SHA' });

    // Validate every entry before touching the file. A single bad entry rejects the whole
    // write rather than silently dropping it.
    const seen = new Set();
    const clean = [];
    for (const f of body.facilitators) {
      const name = typeof f?.name === 'string' ? f.name.trim() : '';
      const hash = typeof f?.hash === 'string' ? f.hash.trim().toLowerCase() : '';
      if (!name || name.length > 80) return respond(400, { error: 'BAD_NAME', name });
      /* pbkdf2$<iterations>$<salt>$<hash> is the current format. A bare SHA-256 is still
       * accepted so entries predating the change can be resent unmodified by the panel,
       * which sends back every row including ones it did not touch. */
      if (!isStoredHash(hash)) return respond(400, { error: 'BAD_HASH', name });
      if (seen.has(name)) return respond(400, { error: 'DUPLICATE_NAME', name });
      seen.add(name);
      const entry = { name, hash };
      /* Optional so an older entry without one still round-trips. Lower-cased because
       * sign-in matches case-insensitively and storing it mixed would be misleading. */
      if (f.email) {
        const email = String(f.email).trim().toLowerCase();
        if (email.length > 160 || !email.includes('@')) return respond(400, { error: 'BAD_EMAIL', name });
        if (seen.has(email)) return respond(400, { error: 'DUPLICATE_EMAIL', name });
        seen.add(email);
        entry.email = email;
      }
      if (f.expires) {
        if (!Number.isFinite(Date.parse(f.expires))) return respond(400, { error: 'BAD_EXPIRES', name });
        entry.expires = f.expires;
      }
      clean.push(entry);
    }

    // The admin entry is carried over from the current file, never taken from the body.
    const current = await loadFacilitators(repo, branch, { fresh: true });
    if (current.error) return respond(502, { error: 'FACILITATORS_UNREADABLE' });
    if (!current.adminList.length) return respond(500, { error: 'NO_ADMIN', message: 'facilitators.json has no admin entry; fix it directly in the repository.' });
    /* An admin's name cannot be reused for a facilitator: the two lists are searched
     * together, so a duplicate name would make which record wins depend on ordering. */
    const clash = current.adminList.find(a => clean.some(f => f.name === a.name));
    if (clash) return respond(400, { error: 'ADMIN_NAME_RESERVED', name: clash.name });

    const { status, json } = await github('PUT', `/repos/${repo}/contents/${FACILITATORS_PATH}`, {
      message: `Update facilitators (by ${who.name})`,
      /* Write back in whichever shape the file already used, so saving facilitators does
       * not silently rewrite an unrelated part of the file. */
      content: encodeBase64Utf8(
        Array.isArray(current.rawAdmins)
          ? { admins: current.adminList, facilitators: clean }
          : { admin: current.adminList[0], facilitators: clean }),
      branch,
      sha: body.sha || undefined,
      author: authorFor(who.name)
    });
    const bad = writeOutcome(status, json, !!body.sha);
    if (bad) return bad;
    facilitatorsCache.delete(repo);   // next auth for THIS project must see the new list
    return respond(200, { sha: json.content?.sha });
  }

  return respond(405, { error: 'METHOD' });
}
