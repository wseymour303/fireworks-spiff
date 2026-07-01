import { getStore } from "@netlify/blobs";

/* ============================================================
   Raise the Standard - Fireworks Spiff
   Shared state + server-authoritative draws via Netlify Blobs.
   All randomness happens here so a lit firework locks in fair.
   ============================================================ */

const TIERS = [20, 50, 100, 250];
const SHELLS = ["firecracker", "sparkler", "bottlerocket", "romancandle", "bigbang"];

// Ladder. Indices must match the front-end trade buttons.
const TRADES = [
  { cost: { firecracker: 2 }, gain: "bottlerocket" },
  { cost: { sparkler: 2 }, gain: "bottlerocket" },
  { cost: { bottlerocket: 2 }, gain: "romancandle" },
  { cost: { romancandle: 2 }, gain: "bigbang" },
];

const DEFAULT_ODDS = {
  firecracker:  { 20: 0.89, 50: 0.09, 100: 0.02, 250: 0.00 },
  bottlerocket: { 20: 0.52, 50: 0.37, 100: 0.10, 250: 0.01 },
  sparkler:     { 20: 0.84, 50: 0.13, 100: 0.03, 250: 0.00 },
  romancandle:  { 20: 0.17, 50: 0.37, 100: 0.38, 250: 0.08 },
  bigbang:      { 20: 0.00, 50: 0.00, 100: 0.45, 250: 0.55 },
};

const emptyState = () => ({
  period: "July 1 - 15, 2026",
  odds: DEFAULT_ODDS,
  hitlist: [],
  reps: {},
  seededAt: null,
  updatedAt: Date.now(),
});

function drawValue(odds) {
  let r = Math.random(), c = 0;
  for (const v of TIERS) { c += Number(odds?.[v] ?? 0); if (r <= c) return v; }
  return 0;
}
function sanitizeShelf(s) {
  const out = {};
  for (const k of SHELLS) out[k] = Math.max(0, parseInt(s?.[k] ?? 0) || 0);
  return out;
}
function publicState(state) {
  const reps = {};
  for (const [name, r] of Object.entries(state.reps)) {
    reps[name] = { shelf: r.shelf, lit: r.lit, total: r.total, hasPin: !!r.pin };
  }
  return { period: state.period, odds: state.odds, hitlist: state.hitlist || [], reps, seededAt: state.seededAt, updatedAt: state.updatedAt };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const store = getStore("fireworks-spiff");
  const MGR = process.env.MANAGER_KEY || "Standard2026";
  let state = (await store.get("state", { type: "json" })) || emptyState();

  if (req.method === "GET") return json(publicState(state));

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  /* ---------- manager actions ---------- */
  if (action === "seed") {
    if (body.key !== MGR) return json({ error: "Manager key does not match." }, 403);
    const reps = {};
    for (const r of body.reps || []) {
      if (!r.name) continue;
      const shelf = sanitizeShelf(r.shelf);
      reps[r.name] = { shelf, granted: { ...shelf }, lit: [], total: 0, pin: (r.pin || "").trim() };
    }
    state = {
      period: body.period || state.period,
      odds: body.odds || state.odds,
      hitlist: Array.isArray(body.hitlist) ? body.hitlist : (state.hitlist || []),
      reps,
      seededAt: Date.now(),
      updatedAt: Date.now(),
    };
    await store.setJSON("state", state);
    return json(publicState(state));
  }

  // incremental daily refresh: grant only the newly earned fireworks, keep lit + shelf
  if (action === "sync") {
    if (body.key !== MGR) return json({ error: "Manager key does not match." }, 403);
    if (!state.seededAt) { state.seededAt = Date.now(); state.reps = state.reps || {}; }
    if (body.period) state.period = body.period;
    if (body.odds) state.odds = body.odds;
    if (Array.isArray(body.hitlist)) state.hitlist = body.hitlist;
    const summary = [];
    for (const r of body.reps || []) {
      if (!r.name) continue;
      const earned = sanitizeShelf(r.earned);
      let rep = state.reps[r.name];
      if (!rep) {
        state.reps[r.name] = { shelf: { ...earned }, granted: { ...earned }, lit: [], total: 0, pin: (r.pin || "").trim() };
        summary.push({ name: r.name, added: earned, isNew: true });
        continue;
      }
      rep.granted = rep.granted || {};
      if ((r.pin || "").trim()) rep.pin = (r.pin || "").trim();
      const added = {};
      for (const k of SHELLS) {
        const g = rep.granted[k] || 0;
        const delta = Math.max(0, (earned[k] || 0) - g);
        if (delta > 0) { rep.shelf[k] = (rep.shelf[k] || 0) + delta; added[k] = delta; }
        rep.granted[k] = Math.max(g, earned[k] || 0);
      }
      summary.push({ name: r.name, added, isNew: false });
    }
    state.updatedAt = Date.now();
    await store.setJSON("state", state);
    return json({ ...publicState(state), summary });
  }

  if (action === "reset") {
    if (body.key !== MGR) return json({ error: "Manager key does not match." }, 403);
    state = emptyState();
    await store.setJSON("state", state);
    return json(publicState(state));
  }

  /* ---------- rep actions (locking) ---------- */
  const rep = state.reps[body.rep];
  if (!rep) return json({ error: "That rep is not on the board yet." }, 400);
  if (rep.pin && rep.pin !== String(body.pin || "").trim()) return json({ error: "Wrong PIN." }, 403);

  if (action === "trade") {
    const t = TRADES[body.tradeIndex];
    if (!t) return json({ error: "Unknown trade." }, 400);
    const k = Object.keys(t.cost)[0];
    if ((rep.shelf[k] || 0) < t.cost[k]) return json({ error: "Not enough to trade." }, 400);
    rep.shelf[k] -= t.cost[k];
    rep.shelf[t.gain] = (rep.shelf[t.gain] || 0) + 1;
    state.updatedAt = Date.now();
    await store.setJSON("state", state);
    return json(publicState(state));
  }

  if (action === "light") {
    const shell = body.shell;
    if (!SHELLS.includes(shell)) return json({ error: "Unknown shell." }, 400);
    if ((rep.shelf[shell] || 0) < 1) return json({ error: "None of those left to light." }, 400);
    const value = drawValue(state.odds[shell]);            // server draws, locks in
    rep.shelf[shell] -= 1;
    rep.lit.push({ shell, value, ts: Date.now() });
    rep.total += value;
    state.updatedAt = Date.now();
    await store.setJSON("state", state);
    return json({ ...publicState(state), justLit: { shell, value } });
  }

  if (action === "lightAll") {
    const results = [];
    for (const shell of SHELLS) {
      while ((rep.shelf[shell] || 0) > 0) {
        const value = drawValue(state.odds[shell]);
        rep.shelf[shell]--;
        rep.lit.push({ shell, value, ts: Date.now() });
        rep.total += value;
        results.push({ shell, value });
      }
    }
    state.updatedAt = Date.now();
    await store.setJSON("state", state);
    return json({ ...publicState(state), results });
  }

  return json({ error: "Unknown action." }, 400);
};

export const config = { path: "/api/spiff" };
