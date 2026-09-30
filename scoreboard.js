// Interstellar SuperTramp: shared scoreboard.
// Two backends, whichever this copy of the game can reach:
//  - "artifact": the claude.ai artifact's shared db. Names come from people's
//    claude.ai profiles; nothing but their opaque id is stored.
//  - "supabase": a free Supabase table, for the public web version. Switched
//    on by filling in scoreboard-config.js (see README). Players pick a nickname.
// Otherwise the scoreboard is off and the game keeps its on-device records.
// Exposes window.SuperTrampBoard.
(() => {
  'use strict';

  const cfg = window.SUPERTRAMP_SCOREBOARD || {};
  const TABLE = cfg.table || 'scores';
  const board = { kind: 'none', ready: null, needsName: false };
  let db = null, user = null, myId = null;

  const clean = (name) => String(name || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16);

  async function initArtifact() {
    if (!window.claude || typeof window.claude.use !== 'function') return false;
    db = await window.claude.use('db');
    if (!db) return false;
    user = await window.claude.use('user');
    myId = user ? await user.id() : null;
    return true;
  }

  function initSupabase() {
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  board.ready = (async () => {
    try {
      if (await initArtifact()) { board.kind = 'artifact'; return board.kind; }
    } catch (e) { /* fall through */ }
    if (initSupabase()) { board.kind = 'supabase'; board.needsName = true; }
    return board.kind;
  })();

  // ---- Supabase (REST, no library) ----------------------------------------
  const sbHeaders = () => ({
    apikey: cfg.supabaseAnonKey,
    Authorization: `Bearer ${cfg.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  });
  const sbUrl = (q) => `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/${TABLE}${q}`;

  async function sbTop(mode, limit) {
    const res = await fetch(sbUrl(`?select=name,time_ms,stars,total_stars,falls&mode=eq.${mode}&order=time_ms.asc,stars.desc&limit=${limit}`), { headers: sbHeaders() });
    if (!res.ok) throw new Error(`scoreboard ${res.status}`);
    const rows = await res.json();
    // Best run per name
    const seen = new Set(), out = [];
    for (const r of rows) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: r.name, timeMs: r.time_ms, stars: r.stars, total: r.total_stars, falls: r.falls });
    }
    return out;
  }

  async function sbSubmit(run) {
    const body = { name: clean(run.name), mode: run.mode, time_ms: Math.round(run.timeMs), stars: run.stars, total_stars: run.total, falls: run.falls };
    if (!body.name) throw new Error('name');
    const res = await fetch(sbUrl(''), { method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`scoreboard ${res.status}`);
    const top = await sbTop(run.mode, 500);
    const i = top.findIndex((r) => r.name.toLowerCase() === body.name.toLowerCase());
    return { rank: i >= 0 ? i + 1 : null, of: top.length };
  }

  // ---- Artifact db: scores/<viewer id> holds that person's best per mode ------
  async function artTop(mode) {
    const snap = await db.collection('scores').get();
    const rows = [];
    for (const d of snap.docs) {
      const m = d.data() && d.data()[mode];
      if (m && typeof m.timeMs === 'number') rows.push({ id: d.id, timeMs: m.timeMs, stars: m.stars, total: m.total, falls: m.falls });
    }
    rows.sort((a, b) => a.timeMs - b.timeMs || b.stars - a.stars);
    const people = user && rows.length ? await user.profiles(rows.map((r) => r.id)) : {};
    return rows.map((r) => ({ ...r, name: (people[r.id] && people[r.id].name) || 'Someone', isMe: r.id === myId }));
  }

  async function artSubmit(run) {
    if (!myId) throw new Error('signed-out');
    const ref = db.collection('scores').doc(myId);
    const cur = await ref.get();
    const body = cur.exists ? { ...cur.data() } : {};
    const prev = body[run.mode];
    const entry = { timeMs: Math.round(run.timeMs), stars: run.stars, total: run.total, falls: run.falls, at: Date.now() };
    const better = !prev || entry.timeMs < prev.timeMs || (entry.timeMs === prev.timeMs && entry.stars > prev.stars);
    if (better) { body[run.mode] = entry; await ref.set(body); }
    const top = await artTop(run.mode);
    const i = top.findIndex((r) => r.isMe);
    return { rank: i >= 0 ? i + 1 : null, of: top.length, kept: !better };
  }

  board.top = async (mode, limit = 10) => {
    await board.ready;
    if (board.kind === 'artifact') return (await artTop(mode)).slice(0, limit);
    if (board.kind === 'supabase') return (await sbTop(mode, 200)).slice(0, limit);
    return [];
  };
  board.submit = async (run) => {
    await board.ready;
    if (board.kind === 'artifact') return artSubmit(run);
    if (board.kind === 'supabase') return sbSubmit(run);
    return null;
  };
  board.cleanName = clean;
  board.where = () => (board.kind === 'artifact'
    ? 'Everyone who opens this page on claude.ai'
    : board.kind === 'supabase' ? 'Everyone playing online' : '');

  window.SuperTrampBoard = board;
})();
