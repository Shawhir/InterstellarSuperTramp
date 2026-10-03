// Interstellar SuperTramp: score middleman (Cloudflare Worker).
//
// Lets players post a Moon landing with just a name, no GitHub account. The game
// POSTs the run here; this checks it and hands it to GitHub as a
// "repository_dispatch" event using a private token that players never see.
// The repo's "Record a score" workflow then saves it to scores.json.
//
// Settings (Cloudflare dashboard → the Worker → Settings → Variables and secrets):
//   GITHUB_TOKEN     (secret, required)  fine-grained token for this one repo with
//                                        "Contents: Read and write"
//   GITHUB_REPO      (optional)          defaults to Shawhir/InterstellarSuperTramp
//   ALLOWED_ORIGINS  (optional)          comma-separated sites allowed to post;
//                                        defaults to https://shawhir.github.io

const DEFAULT_REPO = 'Shawhir/InterstellarSuperTramp';
const DEFAULT_ORIGINS = 'https://shawhir.github.io';
const MIN_GAP_MS = 20000; // one post per 20 s per address (best effort)
const recent = new Map();

// A light filter for a family game; names that trip it are replaced, not rejected.
// Blocked anywhere in a name (rarely part of a real one):
const BLOCKED = ['fuck', 'shit', 'bitch', 'bastard', 'pussy', 'wank', 'twat', 'slut', 'whore', 'nigger', 'nigga', 'porn'];
// Blocked only as whole words, because they hide inside real names
// (Dickson, Hancock, Essex, Fagan, Grapes, Scunthorpe...):
const BLOCKED_WORDS = ['cunt', 'dick', 'cock', 'fag', 'faggot', 'rape', 'nazi', 'hitler', 'sex', 'sexy', 'cum', 'anal'];

function cleanName(raw) {
  const name = String(raw || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const plain = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  const squashed = plain.replace(/[^a-z]/g, '');
  const words = plain.match(/[a-z]+/g) || [];
  if (BLOCKED.some((w) => squashed.includes(w)) || words.some((w) => BLOCKED_WORDS.includes(w))) return 'Space Tramp';
  return name;
}

function checkRun(body) {
  const run = {
    name: cleanName(body && body.name),
    mode: body && body.mode,
    score: Math.round(Number((body && body.score) || 0)),
    time_ms: Math.round(Number(body && body.time_ms)),
    stars: Math.round(Number(body && body.stars)),
    total_stars: Math.round(Number(body && body.total_stars)),
    falls: Math.round(Number((body && body.falls) || 0)),
  };
  if (!run.name) return { error: 'Please type a name (letters and numbers).' };
  if (run.mode !== 'checkpoint' && run.mode !== 'uber') return { error: 'Unknown mode.' };
  if (!(run.time_ms >= 5000 && run.time_ms <= 3600000)) return { error: "That time doesn't look like a real run." };
  if (!(run.total_stars >= 1 && run.total_stars <= 200 && run.stars >= 0 && run.stars <= run.total_stars)) return { error: "Those stars don't add up." };
  if (!(run.falls >= 0 && run.falls <= 1000)) return { error: 'Too many falls to be real.' };
  if (!(run.score >= 0 && run.score <= 50000000)) return { error: "That score doesn't look real." };
  return { run };
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((s) => s.trim());
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const c = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    if (request.method === 'GET') return json({ ok: true, service: 'Interstellar SuperTramp scores' }, 200, c.headers);
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, c.headers);
    if (!c.ok) return json({ error: 'Posting is only allowed from the game.' }, 403, c.headers);
    if (!env.GITHUB_TOKEN) return json({ error: 'The scoreboard is not set up yet.' }, 503, c.headers);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'Bad request.' }, 400, c.headers); }
    const { run, error } = checkRun(body);
    if (error) return json({ error }, 400, c.headers);

    // One post every 20 s per player per connection, so family members on the
    // same Wi-Fi don't block each other.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const who = `${ip}|${run.name.toLowerCase()}`;
    const now = Date.now();
    if (recent.has(who) && now - recent.get(who) < MIN_GAP_MS) return json({ error: 'Slow down: one score every 20 seconds.' }, 429, c.headers);

    const repo = env.GITHUB_REPO || DEFAULT_REPO;
    const gh = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'supertramp-score-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'score', client_payload: run }),
    });
    if (gh.status !== 204) {
      return json({ error: `GitHub didn't accept the score (${gh.status}). Check the Worker's GITHUB_TOKEN.` }, 502, c.headers);
    }
    recent.set(who, now);
    if (recent.size > 5000) recent.clear();
    return json({ ok: true, name: run.name }, 202, c.headers);
  },
};
