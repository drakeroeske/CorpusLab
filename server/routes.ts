import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { barcodeLookup, foodPortions, foodsEnabled, searchFoods } from "./foods.js";
import { DEFAULT_PREFS, initPush, notify, pushEnabled, runReminders, sanitizePrefs, startReminderTimer, vapidPublicKey } from "./push.js";
import { hashPassword, newInviteCode, newRecoveryCode, newToken, recoveryHash, sameHash, sha256, USERNAME_RE, verifyPassword } from "./auth.js";

/* ------------------------------------------------------------------ setup */
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
// Every table has RLS on; the only policy requires this server-held key in a request header.
const CORPUS_DB_KEY = process.env.CORPUS_DB_KEY || "";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "x-corpus-key": CORPUS_DB_KEY } },
});
initPush(sb);
startReminderTimer();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COOKIE = "__Host-corpus_sess";
const SESSION_DAYS = 60;
const MAX_STATE_BYTES = 15 * 1024 * 1024;
const GYM_WINDOW_MS = 3 * 3600_000;

type Row = Record<string, any>;
interface DbUser {
  id: string; username: string; display_name: string; pass_hash: string; role: "athlete" | "coach";
  invite_code: string; share_feed: boolean; share_lifts: boolean; share_vault_with_coach: boolean;
  stats: Row; gym_checkin: { gym: string; ts: number } | null; is_demo: boolean;
  recovery_hash: string | null; recovery_set_at: string | null;
}
const pub = (u: Pick<DbUser, "id" | "username" | "display_name">) => ({ id: u.id, username: u.username, displayName: u.display_name });

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const bad = (msg: string) => new HttpError(400, msg);
function must<T>(r: { data: T | null; error: any }): T {
  if (r.error) { console.error("db error:", r.error.message); throw new HttpError(500, "Database error. Try again."); }
  return r.data as T;
}

/* ------------------------------------------------------------- rate limit */
const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h && hits.size > 50_000) hits.clear();
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  h.n++;
  return h.n > max;
}
setInterval(() => { const now = Date.now(); hits.forEach((v, k) => { if (v.reset < now) hits.delete(k); }); }, 60_000).unref();
// The hosting edge appends the real client address, then two internal proxy hops, to X-Forwarded-For.
// So the client is the 3rd entry from the right; anything further left is client-supplied and ignored.
const TRUSTED_PROXY_HOPS = Math.max(0, Number(process.env.TRUSTED_PROXY_HOPS ?? 2) | 0);
const ipOf = (req: Request) => {
  const parts = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return req.socket.remoteAddress || "?";
  return parts[Math.max(0, parts.length - 1 - TRUSTED_PROXY_HOPS)];
};
function limit(req: Request, name: string, max: number, windowMs: number) {
  if (limited(`${name}:${ipOf(req)}`, max, windowMs)) throw new HttpError(429, "Too many requests. Try again shortly.");
}

/* ---------------------------------------------------------------- cookies */
function readCookie(req: Request): string | null {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) { const val = decodeURIComponent(v.join("=")); return /^[a-f0-9]{64}$/.test(val) ? val : null; }
  }
  return null;
}
function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: SESSION_DAYS * 86400_000 });
}
function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: "none", path: "/" });
}

async function startSession(res: Response, userId: string): Promise<string> {
  const token = newToken();
  const hash = sha256(token);
  must(await sb.from("auth_sessions").insert({ token_hash: hash, user_id: userId, expires_at: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString() }));
  setSessionCookie(res, token);
  return hash;
}
/** Start a fresh session for this response, then revoke every other session for the user. */
async function rotateSessions(res: Response, userId: string) {
  const keep = await startSession(res, userId);
  must(await sb.from("auth_sessions").delete().eq("user_id", userId).neq("token_hash", keep));
}

async function currentUser(req: Request): Promise<DbUser | null> {
  const token = readCookie(req);
  if (!token) return null;
  const r = must(await sb.from("auth_sessions").select("expires_at, users(*)").eq("token_hash", sha256(token)).maybeSingle()) as Row | null;
  if (!r || !r.users || new Date(r.expires_at).getTime() < Date.now()) return null;
  return r.users as DbUser;
}

type H = (req: Request, res: Response, me: DbUser) => Promise<unknown>;
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch((e) => {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    next(e);
  });
};
const authed = (fn: H) => wrap(async (req, res) => {
  const me = await currentUser(req);
  if (!me) throw new HttpError(401, "Sign in required");
  return fn(req, res, me);
});

/* ---------------------------------------------------------------- helpers */
async function meResponse(me: DbUser) {
  const links = must(await sb.from("coach_links").select("coach_id, users!coach_links_coach_id_fkey(id, username, display_name)").eq("client_id", me.id)) as Row[];
  const clients = must(await sb.from("coach_links").select("client_id").eq("coach_id", me.id)) as Row[];
  return {
    id: me.id, username: me.username, displayName: me.display_name, role: me.role, inviteCode: me.invite_code,
    shareFeed: me.share_feed, shareLifts: me.share_lifts, shareVaultWithCoach: me.share_vault_with_coach,
    isDemo: me.is_demo, hasRecovery: !!me.recovery_hash, recoverySetAt: me.recovery_set_at,
    coaches: links.map((l) => pub(l.users)), clientCount: clients.length,
  };
}

async function friendIds(userId: string): Promise<string[]> {
  const rows = must(await sb.from("friendships").select("requester, addressee").eq("status", "accepted").or(`requester.eq.${userId},addressee.eq.${userId}`)) as Row[];
  return rows.map((r) => (r.requester === userId ? r.addressee : r.requester));
}

async function findByCode(codeOrName: string): Promise<DbUser | null> {
  const raw = codeOrName.trim().replace(/^@/, "");
  if (!raw) return null;
  const byCode = must(await sb.from("users").select("*").eq("invite_code", raw.toUpperCase()).maybeSingle()) as DbUser | null;
  if (byCode) return byCode;
  return must(await sb.from("users").select("*").eq("username", raw.toLowerCase()).maybeSingle()) as DbUser | null;
}

async function loadState(userId: string): Promise<{ state: Row | null; updatedAt: string | null }> {
  const r = must(await sb.from("user_state").select("state, updated_at").eq("user_id", userId).maybeSingle()) as Row | null;
  return { state: r?.state ?? null, updatedAt: r?.updated_at ?? null };
}
async function saveState(userId: string, state: Row) {
  must(await sb.from("user_state").upsert({ user_id: userId, state, updated_at: new Date().toISOString() }));
}

async function assertCoachOf(coach: DbUser, clientId: string) {
  if (coach.role !== "coach") throw new HttpError(403, "Coach mode is off");
  const link = must(await sb.from("coach_links").select("client_id").eq("coach_id", coach.id).eq("client_id", clientId).maybeSingle());
  if (!link) throw new HttpError(404, "Client not found");
}

function clientView(state: Row | null, shareVault: boolean): Row | null {
  if (!state) return null;
  const { chat: _chat, spotters: _s, feed: _f, crews: _c, clients: _cl, ...rest } = state;
  return { ...rest, chat: [], spotters: [], feed: [], crews: [], clients: [], photos: shareVault ? state.photos ?? [] : [], measurements: shareVault ? state.measurements ?? [] : [] };
}

function noDemo(me: { is_demo: boolean }) {
  if (me.is_demo) throw new HttpError(403, "Sample accounts can't change settings. Create your own account to try this.");
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ----------------------------------------------------------------- routes */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // CSRF hardening: state-changing API calls must be JSON (forces a CORS preflight cross-site)
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD" && !req.is("application/json")) return res.status(415).json({ message: "JSON required" });
    next();
  });

  app.param(["id", "coachId"], (_req, res, next, v) => (UUID_RE.test(String(v)) ? next() : res.status(400).json({ message: "Invalid id" })));

  app.get("/api/health", (_req, res) => res.json({ ok: true, db: !!SUPABASE_URL }));

  /* ---------- food database (USDA proxy; key never leaves the server) ---------- */
  const foodErr = (e: any) => { throw e?.status ? new HttpError(e.status, e.message) : new HttpError(502, "Food database unavailable"); };
  app.get("/api/foods/search", wrap(async (req, res) => {
    limit(req, "foods", 90, 60_000);
    limit(req, "foods-hr", 250, 3600_000); // one device can't drain the shared hourly USDA budget
    if (!foodsEnabled()) return res.json({ foods: [], live: false });
    const q = str(req.query.q, 80);
    if (q.length < 2) return res.json({ foods: [], live: true });
    const foods = await searchFoods(q).catch(foodErr);
    res.json({ foods, live: true });
  }));
  app.get("/api/foods/barcode/:code", wrap(async (req, res) => {
    limit(req, "foods", 90, 60_000);
    const code = String(req.params.code || "");
    if (!/^\d{8,14}$/.test(code)) throw bad("Invalid barcode");
    const food = await barcodeLookup(code);
    if (!food) return res.status(404).json({ message: "No product found for that barcode" });
    res.json({ food });
  }));
  app.get("/api/foods/:fdcId/portions", wrap(async (req, res) => {
    limit(req, "foods", 90, 60_000);
    const id = Number(req.params.fdcId);
    if (!Number.isInteger(id) || id <= 0 || id > 1e9) throw bad("Invalid food id");
    if (!foodsEnabled()) return res.json({ portions: [] });
    const portions = await foodPortions(id).catch(foodErr);
    res.json({ portions });
  }));

  /* ---------- auth ---------- */
  app.post("/api/auth/signup", wrap(async (req, res) => {
    limit(req, "signup", 20, 3600_000);
    const username = str(req.body?.username, 40).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const displayName = str(req.body?.displayName, 40) || username;
    const role = req.body?.role === "coach" ? "coach" : "athlete";
    if (!USERNAME_RE.test(username)) throw bad("Username must be 3–24 characters: lowercase letters, numbers, dots, underscores.");
    if (password.length < 8 || password.length > 200) throw bad("Password must be at least 8 characters.");
    const taken = must(await sb.from("users").select("id").eq("username", username).maybeSingle());
    if (taken) throw new HttpError(409, "That username is taken.");
    let user: DbUser | null = null;
    const recoveryCode = newRecoveryCode();
    for (let i = 0; i < 4 && !user; i++) {
      const r = await sb.from("users").insert({ username, display_name: displayName, pass_hash: hashPassword(password), role, invite_code: newInviteCode(), recovery_hash: recoveryHash(recoveryCode), recovery_set_at: new Date().toISOString() }).select("*").single();
      if (r.error && /invite_code/.test(r.error.message)) continue;
      if (r.error && /username/.test(r.error.message)) throw new HttpError(409, "That username is taken.");
      user = must(r) as DbUser;
    }
    if (!user) throw new HttpError(500, "Could not create account");
    await startSession(res, user.id);
    res.json({ ...(await meResponse(user)), recoveryCode });
  }));

  app.post("/api/auth/login", wrap(async (req, res) => {
    limit(req, "login", 40, 15 * 60_000);
    const username = str(req.body?.username, 40).toLowerCase().replace(/^@/, "");
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (limited(`login-user:${ipOf(req)}:${username}`, 10, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
    const user = must(await sb.from("users").select("*").eq("username", username).maybeSingle()) as DbUser | null;
    if (!user || !verifyPassword(password, user.pass_hash)) throw new HttpError(401, "Wrong username or password.");
    await startSession(res, user.id);
    res.json(await meResponse(user));
  }));

  // Reset a forgotten password with the one-time recovery code. Rotates the code and signs out every device.
  app.post("/api/auth/reset", wrap(async (req, res) => {
    limit(req, "reset", 20, 15 * 60_000);
    const username = str(req.body?.username, 40).toLowerCase().replace(/^@/, "");
    const code = typeof req.body?.code === "string" ? req.body.code.slice(0, 40) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    // Per-IP+account cap stops guessing; looser global per-account cap can't be used to lock the owner out cheaply.
    if (limited(`reset-user:${ipOf(req)}:${username}`, 10, 3600_000) || limited(`reset-user-all:${username}`, 60, 3600_000)) throw new HttpError(429, "Too many attempts for this account. Try again in an hour.");
    if (password.length < 8 || password.length > 200) throw bad("New password must be at least 8 characters.");
    const user = must(await sb.from("users").select("*").eq("username", username).maybeSingle()) as DbUser | null;
    const ok = !!user && !user.is_demo && !!user.recovery_hash && sameHash(recoveryHash(code), user.recovery_hash);
    if (!ok) throw new HttpError(401, "That username and recovery code don't match.");
    const recoveryCode = newRecoveryCode();
    const u = must(await sb.from("users").update({ pass_hash: hashPassword(password), recovery_hash: recoveryHash(recoveryCode), recovery_set_at: new Date().toISOString() })
      .eq("id", user!.id).eq("recovery_hash", user!.recovery_hash!).select("*").maybeSingle()) as DbUser | null;
    if (!u) throw new HttpError(409, "That recovery code was just used. Try again.");
    await rotateSessions(res, u.id);
    res.json({ ...(await meResponse(u)), recoveryCode });
  }));

  app.post("/api/auth/recovery-code", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "recovery-new", 10, 3600_000);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!verifyPassword(password, me.pass_hash)) throw new HttpError(401, "Wrong password.");
    const recoveryCode = newRecoveryCode();
    const u = must(await sb.from("users").update({ recovery_hash: recoveryHash(recoveryCode), recovery_set_at: new Date().toISOString() }).eq("id", me.id).select("*").single()) as DbUser;
    res.json({ ...(await meResponse(u)), recoveryCode });
  }));

  app.post("/api/auth/change-password", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "change-pw", 10, 15 * 60_000);
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.next === "string" ? req.body.next : "";
    if (!verifyPassword(current, me.pass_hash)) throw new HttpError(401, "Current password is wrong.");
    if (next.length < 8 || next.length > 200) throw bad("New password must be at least 8 characters.");
    must(await sb.from("users").update({ pass_hash: hashPassword(next) }).eq("id", me.id));
    await rotateSessions(res, me.id);
    res.json({ ok: true });
  }));

  app.post("/api/auth/logout", wrap(async (req, res) => {
    const token = readCookie(req);
    if (token) await sb.from("auth_sessions").delete().eq("token_hash", sha256(token));
    clearSessionCookie(res);
    res.json({ ok: true });
  }));

  app.get("/api/me", wrap(async (req, res) => {
    limit(req, "me", 240, 60_000);
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ message: "Signed out" });
    res.json(await meResponse(me));
  }));

  app.patch("/api/me", authed(async (req, res, me) => {
    noDemo(me);
    const b = req.body || {};
    const upd: Row = {};
    if (typeof b.displayName === "string" && b.displayName.trim()) upd.display_name = str(b.displayName, 40);
    if (b.role === "coach" || b.role === "athlete") upd.role = b.role;
    if (typeof b.shareFeed === "boolean") upd.share_feed = b.shareFeed;
    if (typeof b.shareLifts === "boolean") upd.share_lifts = b.shareLifts;
    if (typeof b.shareVaultWithCoach === "boolean") upd.share_vault_with_coach = b.shareVaultWithCoach;
    const u = must(await sb.from("users").update(upd).eq("id", me.id).select("*").single()) as DbUser;
    res.json(await meResponse(u));
  }));

  app.delete("/api/me", authed(async (req, res, me) => {
    noDemo(me);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!verifyPassword(password, me.pass_hash)) throw new HttpError(401, "Wrong password.");
    must(await sb.from("users").delete().eq("id", me.id));
    clearSessionCookie(res);
    res.json({ ok: true });
  }));

  /* ---------- personal state ---------- */
  app.get("/api/state", authed(async (_req, res, me) => {
    res.json(await loadState(me.id));
  }));

  app.put("/api/state", authed(async (req, res, me) => {
    limit(req, "put-state", 120, 60_000);
    const incoming = req.body?.state;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw bad("Expected { state: object }");
    if (JSON.stringify(incoming).length > MAX_STATE_BYTES) throw new HttpError(413, "Data too large to save. Remove some progress photos.");
    // Coach-owned fields win over the athlete's copy: session notes and coach-edited programs.
    const { state: existing } = await loadState(me.id);
    let merged = false;
    if (existing) {
      const notes = new Map<string, string>();
      for (const s of existing.sessions ?? []) if (s?.coachNote) notes.set(s.id, s.coachNote);
      if (notes.size && Array.isArray(incoming.sessions)) {
        incoming.sessions = incoming.sessions.map((s: Row) => {
          const n = notes.get(s?.id);
          if (n && s.coachNote !== n) { merged = true; return { ...s, coachNote: n }; }
          return s;
        });
      }
      const ex = existing.program?.coachEditedAt ?? 0;
      if (ex > (incoming.program?.coachEditedAt ?? 0)) { incoming.program = existing.program; merged = true; }
      // Programs a coach sent that the athlete's copy hasn't seen yet are kept (the athlete dismisses them explicitly).
      const seen = new Set((Array.isArray(incoming.programInbox) ? incoming.programInbox : []).map((x: Row) => x?.id));
      const dismissed = new Set(Array.isArray(incoming.programInboxDismissed) ? incoming.programInboxDismissed : []);
      const unseen = (Array.isArray(existing.programInbox) ? existing.programInbox : []).filter((x: Row) => x?.id && !seen.has(x.id) && !dismissed.has(x.id));
      if (unseen.length) { incoming.programInbox = [...unseen, ...(Array.isArray(incoming.programInbox) ? incoming.programInbox : [])].slice(0, 10); merged = true; }
    }
    await saveState(me.id, incoming);
    const stats = req.body?.stats;
    if (stats && typeof stats === "object" && JSON.stringify(stats).length < 4000) {
      must(await sb.from("users").update({ stats }).eq("id", me.id));
    }
    res.json(merged ? { ok: true, merged: true, state: incoming } : { ok: true });
  }));

  /* ---------- friends ---------- */
  app.get("/api/friends", authed(async (_req, res, me) => {
    const rows = must(await sb.from("friendships").select("requester, addressee, status, created_at").or(`requester.eq.${me.id},addressee.eq.${me.id}`)) as Row[];
    const ids = Array.from(new Set(rows.flatMap((r) => [r.requester, r.addressee]).filter((x) => x !== me.id)));
    const users = ids.length ? (must(await sb.from("users").select("id, username, display_name, stats, share_lifts, gym_checkin").in("id", ids)) as Row[]) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const view = (id: string) => { const u = byId.get(id); return u ? { ...pub(u as DbUser), stats: u.share_lifts ? u.stats : {} } : null; };
    res.json({
      inviteCode: me.invite_code,
      friends: rows.filter((r) => r.status === "accepted").map((r) => view(r.requester === me.id ? r.addressee : r.requester)).filter(Boolean),
      incoming: rows.filter((r) => r.status === "pending" && r.addressee === me.id).map((r) => view(r.requester)).filter(Boolean),
      outgoing: rows.filter((r) => r.status === "pending" && r.requester === me.id).map((r) => view(r.addressee)).filter(Boolean),
    });
  }));

  app.post("/api/friends/request", authed(async (req, res, me) => {
    limit(req, "friend-req", 30, 3600_000);
    const target = await findByCode(str(req.body?.code, 40));
    if (!target) throw new HttpError(404, "No one found with that code or username.");
    if (target.id === me.id) throw bad("That's your own code.");
    if (target.is_demo !== me.is_demo) throw new HttpError(404, "No one found with that code or username.");
    const existing = must(await sb.from("friendships").select("*").or(`and(requester.eq.${me.id},addressee.eq.${target.id}),and(requester.eq.${target.id},addressee.eq.${me.id})`)) as Row[];
    const reverse = existing.find((r) => r.requester === target.id);
    if (existing.some((r) => r.status === "accepted")) return res.json({ status: "accepted", user: pub(target) });
    if (reverse) {
      must(await sb.from("friendships").update({ status: "accepted" }).eq("requester", target.id).eq("addressee", me.id));
      void notify(target.id, "spotters", { title: "You're spotters", body: `${me.display_name} accepted your request. You'll see each other's finished workouts now.`, url: "/?go=social", tag: "spotter" });
      return res.json({ status: "accepted", user: pub(target) });
    }
    if (!existing.length) {
      must(await sb.from("friendships").insert({ requester: me.id, addressee: target.id }));
      void notify(target.id, "spotters", { title: "New spotter request", body: `${me.display_name} (@${me.username}) wants you as a spotter.`, url: "/?go=social&sub=friends", tag: "spotter" });
    }
    res.json({ status: "pending", user: pub(target) });
  }));

  /* ---------- invite links: /#/join/CODE ---------- */
  const INVITE_RE = /^[A-Z0-9]{6}$/;
  async function inviter(codeRaw: string): Promise<DbUser | null> {
    const code = codeRaw.toUpperCase();
    if (!INVITE_RE.test(code)) return null;
    const u = must(await sb.from("users").select("*").eq("invite_code", code).maybeSingle()) as DbUser | null;
    return u && !u.is_demo ? u : null;
  }
  // Public: lets the sign-up screen say who invited you. Only display name + username.
  app.get("/api/invite/:code", wrap(async (req, res) => {
    limit(req, "invite-peek", 30, 60_000);
    const u = await inviter(String(req.params.code || ""));
    if (!u) return res.status(404).json({ message: "This invite link isn't valid anymore." });
    res.json({ user: pub(u) });
  }));
  // Opening a friend's invite link connects you both as Spotters right away.
  app.post("/api/invite/:code/accept", authed(async (req, res, me) => {
    limit(req, "invite-accept", 30, 3600_000);
    if (me.is_demo) throw new HttpError(403, "Sample accounts can't accept invites.");
    const target = await inviter(String(req.params.code || ""));
    if (!target) throw new HttpError(404, "This invite link isn't valid anymore.");
    if (target.id === me.id) return res.json({ status: "self", user: pub(target) });
    const existing = must(await sb.from("friendships").select("*").or(`and(requester.eq.${me.id},addressee.eq.${target.id}),and(requester.eq.${target.id},addressee.eq.${me.id})`)) as Row[];
    if (existing.length) {
      for (const r of existing) must(await sb.from("friendships").update({ status: "accepted" }).eq("requester", r.requester).eq("addressee", r.addressee));
    } else {
      must(await sb.from("friendships").insert({ requester: target.id, addressee: me.id, status: "accepted" }));
    }
    void notify(target.id, "spotters", { title: "You're spotters", body: `${me.display_name} joined Corpus from your invite link.`, url: "/?go=social", tag: "spotter" });
    res.json({ status: "accepted", user: pub(target) });
  }));
  // New code = old links and codes stop working (friends you already have stay).
  app.post("/api/me/invite-code", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "invite-reset", 10, 3600_000);
    for (let i = 0; i < 5; i++) {
      const r = await sb.from("users").update({ invite_code: newInviteCode() }).eq("id", me.id).select("*").single();
      if (r.error && /invite_code/.test(r.error.message)) continue;
      return res.json(await meResponse(must(r) as DbUser));
    }
    throw new HttpError(500, "Could not make a new code. Try again.");
  }));

  // Safety check: shows how the hosting proxy forwards client IPs (hashed, never raw).
  app.get("/api/diag/ip", wrap(async (req, res) => {
    limit(req, "diag", 20, 60_000);
    const parts = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    const h = (v: string) => sha256(`corpus-ip:${v}`).slice(0, 10);
    res.json({ hops: parts.length, chain: parts.map(h), used: h(ipOf(req)), socket: h(req.socket.remoteAddress || "") });
  }));

  app.post("/api/friends/:id/accept", authed(async (req, res, me) => {
    must(await sb.from("friendships").update({ status: "accepted" }).eq("requester", String(req.params.id)).eq("addressee", me.id));
    void notify(String(req.params.id), "spotters", { title: "You're spotters", body: `${me.display_name} accepted your request.`, url: "/?go=social", tag: "spotter" });
    res.json({ ok: true });
  }));

  app.delete("/api/friends/:id", authed(async (req, res, me) => {
    const other = String(req.params.id);
    must(await sb.from("friendships").delete().eq("requester", me.id).eq("addressee", other));
    must(await sb.from("friendships").delete().eq("requester", other).eq("addressee", me.id));
    res.json({ ok: true });
  }));

  /* ---------- feed ---------- */
  app.get("/api/feed", authed(async (req, res, me) => {
    limit(req, "feed", 120, 60_000);
    const fids = await friendIds(me.id);
    const sharers = fids.length ? (must(await sb.from("users").select("id").in("id", fids).eq("share_feed", true)) as Row[]).map((u) => u.id) : [];
    const authors = [me.id, ...sharers];
    const posts = must(await sb.from("posts").select("id, user_id, kind, body, created_at").in("user_id", authors).order("created_at", { ascending: false }).limit(60)) as Row[];
    const pids = posts.map((p) => p.id);
    const [likes, comments, users] = pids.length ? await Promise.all([
      sb.from("post_likes").select("post_id, user_id").in("post_id", pids).then(must) as Promise<Row[]>,
      sb.from("post_comments").select("id, post_id, user_id, text, created_at").in("post_id", pids).order("created_at").then(must) as Promise<Row[]>,
      sb.from("users").select("id, username, display_name").in("id", authors).then(must) as Promise<Row[]>,
    ]) : [[], [], []];
    const names = new Map(users.map((u) => [u.id, pub(u as DbUser)]));
    const commenterIds = Array.from(new Set(comments.map((c) => c.user_id).filter((id) => !names.has(id))));
    if (commenterIds.length) (must(await sb.from("users").select("id, username, display_name").in("id", commenterIds)) as Row[]).forEach((u) => names.set(u.id, pub(u as DbUser)));
    res.json({
      posts: posts.map((p) => ({
        id: p.id, kind: p.kind, body: p.body, ts: new Date(p.created_at).getTime(), author: names.get(p.user_id), mine: p.user_id === me.id,
        likes: likes.filter((l) => l.post_id === p.id).length, liked: likes.some((l) => l.post_id === p.id && l.user_id === me.id),
        comments: comments.filter((c) => c.post_id === p.id).map((c) => ({ id: c.id, text: c.text, ts: new Date(c.created_at).getTime(), author: names.get(c.user_id) })),
      })),
    });
  }));

  async function visiblePost(me: DbUser, postId: string) {
    const p = must(await sb.from("posts").select("id, user_id").eq("id", postId).maybeSingle()) as Row | null;
    if (!p) throw new HttpError(404, "Post not found");
    if (p.user_id !== me.id) {
      if (!(await friendIds(me.id)).includes(p.user_id)) throw new HttpError(404, "Post not found");
      const author = must(await sb.from("users").select("share_feed").eq("id", p.user_id).maybeSingle()) as Row | null;
      if (!author?.share_feed) throw new HttpError(404, "Post not found");
    }
    return p;
  }

  app.post("/api/posts", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "post", 30, 3600_000);
    const kind = req.body?.kind === "checkin" ? "checkin" : "session";
    const body = req.body?.body;
    if (!body || typeof body !== "object" || JSON.stringify(body).length > 8000) throw bad("Invalid post");
    if (kind === "session" && body.sessionId) {
      const dup = must(await sb.from("posts").select("id").eq("user_id", me.id).eq("body->>sessionId", String(body.sessionId)).maybeSingle());
      if (dup) return res.json({ ok: true, duplicate: true });
    }
    const p = must(await sb.from("posts").insert({ user_id: me.id, kind, body }).select("id").single()) as Row;
    res.json({ ok: true, id: p.id });
  }));

  app.delete("/api/posts/:id", authed(async (req, res, me) => {
    must(await sb.from("posts").delete().eq("id", String(req.params.id)).eq("user_id", me.id));
    res.json({ ok: true });
  }));

  app.post("/api/posts/:id/like", authed(async (req, res, me) => {
    limit(req, "like", 300, 3600_000);
    const p = await visiblePost(me, String(req.params.id));
    const has = must(await sb.from("post_likes").select("post_id").eq("post_id", p.id).eq("user_id", me.id).maybeSingle());
    if (has) must(await sb.from("post_likes").delete().eq("post_id", p.id).eq("user_id", me.id));
    else {
      must(await sb.from("post_likes").insert({ post_id: p.id, user_id: me.id }));
      if (p.user_id !== me.id) void notify(p.user_id, "spotters", { title: "Respect", body: `${me.display_name} gave respect on your workout.`, url: "/?go=social", tag: "respect" });
    }
    res.json({ liked: !has });
  }));

  app.post("/api/posts/:id/comments", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "comment", 120, 3600_000);
    const text = str(req.body?.text, 280);
    if (!text) throw bad("Comment is empty");
    const p = await visiblePost(me, String(req.params.id));
    must(await sb.from("post_comments").insert({ post_id: p.id, user_id: me.id, text }));
    if (p.user_id !== me.id) void notify(p.user_id, "spotters", { title: `${me.display_name} commented`, body: text, url: "/?go=social", tag: "comment" });
    res.json({ ok: true });
  }));

  /* ---------- gym check-in ---------- */
  app.get("/api/gym", authed(async (_req, res, me) => {
    const fids = await friendIds(me.id);
    const users = fids.length ? (must(await sb.from("users").select("id, username, display_name, gym_checkin, stats").in("id", fids)) as Row[]) : [];
    const fresh = (c: Row | null) => c && Date.now() - Number(c.ts) < GYM_WINDOW_MS;
    res.json({
      me: fresh(me.gym_checkin) ? me.gym_checkin : null,
      friends: users.filter((u) => fresh(u.gym_checkin)).map((u) => ({ ...pub(u as DbUser), gym: u.gym_checkin.gym, ts: u.gym_checkin.ts, split: u.stats?.split ?? "", streak: u.stats?.streak ?? 0 })),
    });
  }));

  app.post("/api/gym/checkin", authed(async (req, res, me) => {
    limit(req, "gym", 30, 3600_000);
    const gym = str(req.body?.gym, 60);
    if (!gym) throw bad("Gym name required");
    must(await sb.from("users").update({ gym_checkin: { gym, ts: Date.now() } }).eq("id", me.id));
    res.json({ ok: true });
  }));

  app.delete("/api/gym/checkin", authed(async (_req, res, me) => {
    must(await sb.from("users").update({ gym_checkin: null }).eq("id", me.id));
    res.json({ ok: true });
  }));

  /* ---------- leaderboard ---------- */
  app.get("/api/leaderboard", authed(async (_req, res, me) => {
    const fids = await friendIds(me.id);
    const users = must(await sb.from("users").select("id, username, display_name, stats, share_lifts").in("id", [me.id, ...fids])) as Row[];
    res.json({ rows: users.filter((u) => u.id === me.id || u.share_lifts).map((u) => ({ ...pub(u as DbUser), me: u.id === me.id, stats: u.stats || {} })) });
  }));

  /* ---------- coaching ---------- */
  app.post("/api/coach/link", authed(async (req, res, me) => {
    limit(req, "coach-link", 20, 3600_000);
    const coach = await findByCode(str(req.body?.code, 40));
    if (!coach || coach.role !== "coach") throw new HttpError(404, "No coach found with that code.");
    if (coach.id === me.id) throw bad("You can't coach yourself.");
    if (coach.is_demo && !me.is_demo) throw new HttpError(403, "That's a sample coach account. Ask your coach for their own code.");
    const r = await sb.from("coach_links").upsert({ coach_id: coach.id, client_id: me.id });
    must(r);
    void notify(coach.id, "coach", { title: "New client", body: `${me.display_name} (@${me.username}) linked you as their coach.`, url: "/?go=me", tag: "coach" });
    res.json(await meResponse(me));
  }));

  app.delete("/api/coach/link/:coachId", authed(async (req, res, me) => {
    must(await sb.from("coach_links").delete().eq("coach_id", String(req.params.coachId)).eq("client_id", me.id));
    res.json(await meResponse(me));
  }));

  app.get("/api/coach/clients", authed(async (_req, res, me) => {
    if (me.role !== "coach") throw new HttpError(403, "Coach mode is off");
    const links = must(await sb.from("coach_links").select("client_id").eq("coach_id", me.id)) as Row[];
    const ids = links.map((l) => l.client_id);
    if (!ids.length) return res.json({ clients: [] });
    const [users, states, notes] = await Promise.all([
      sb.from("users").select("id, username, display_name, share_vault_with_coach").in("id", ids).then(must) as Promise<Row[]>,
      sb.from("user_state").select("user_id, state, updated_at").in("user_id", ids).then(must) as Promise<Row[]>,
      sb.from("coach_notes").select("id, client_id, text, date, created_at").eq("coach_id", me.id).in("client_id", ids).order("created_at", { ascending: false }).then(must) as Promise<Row[]>,
    ]);
    res.json({
      clients: users.map((u) => {
        const st = states.find((s) => s.user_id === u.id);
        return {
          ...pub(u as DbUser), sharesVault: u.share_vault_with_coach, updatedAt: st?.updated_at ?? null,
          state: clientView(st?.state ?? null, u.share_vault_with_coach),
          notes: notes.filter((n) => n.client_id === u.id).map((n) => ({ id: n.id, date: n.date, text: n.text })),
        };
      }),
    });
  }));

  app.post("/api/coach/clients/:id/notes", authed(async (req, res, me) => {
    const clientId = String(req.params.id);
    await assertCoachOf(me, clientId);
    const text = str(req.body?.text, 2000);
    if (!text) throw bad("Note is empty");
    must(await sb.from("coach_notes").insert({ coach_id: me.id, client_id: clientId, text, date: str(req.body?.date, 10) || new Date().toISOString().slice(0, 10) }));
    res.json({ ok: true });
  }));

  app.post("/api/coach/clients/:id/session-note", authed(async (req, res, me) => {
    const clientId = String(req.params.id);
    await assertCoachOf(me, clientId);
    const sessionId = str(req.body?.sessionId, 80);
    const note = str(req.body?.note, 1000);
    const { state } = await loadState(clientId);
    if (!state) throw new HttpError(404, "Client has no data yet");
    let found = false;
    state.sessions = (state.sessions ?? []).map((s: Row) => (s.id === sessionId ? ((found = true), { ...s, coachNote: note }) : s));
    if (!found) throw new HttpError(404, "Session not found");
    await saveState(clientId, state);
    if (note) void notify(clientId, "coach", { title: `Note from ${me.display_name}`, body: note.length > 120 ? note.slice(0, 117) + "..." : note, url: "/?go=train", tag: "coach-note" });
    res.json({ ok: true });
  }));

  app.put("/api/coach/clients/:id/program", authed(async (req, res, me) => {
    const clientId = String(req.params.id);
    await assertCoachOf(me, clientId);
    const program = req.body?.program;
    if (!program || typeof program !== "object" || !Array.isArray(program.days) || JSON.stringify(program).length > 200_000) throw bad("Invalid program");
    const { state } = await loadState(clientId);
    if (!state) throw new HttpError(404, "Client has no data yet");
    state.program = { ...program, coachEditedAt: Date.now(), coachEditedBy: me.display_name };
    await saveState(clientId, state);
    void notify(clientId, "coach", { title: "Your program changed", body: `${me.display_name} updated ${program.name || "your program"}. Open Train to see what's new.`, url: "/?go=train&sub=program", tag: "coach-program" });
    res.json({ ok: true });
  }));

  /* ------------------------------------------------------------ programs: save & share */
  const validProgram = (p: unknown) => !!p && typeof p === "object" && Array.isArray((p as Row).days) && (p as Row).days.length > 0 && (p as Row).days.length <= 14 && JSON.stringify(p).length <= 200_000;
  const PROGRAM_CODE_RE = /^[A-Z0-9]{6}$/;
  // Share the program you're on (or a saved one): returns a 6-character code anyone can import with.
  app.post("/api/programs/share", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "program-share", 30, 3600_000);
    const program = req.body?.program;
    if (!validProgram(program)) throw bad("Invalid program");
    const name = str(req.body?.name, 60) || str(program.name, 60) || "Program";
    const clean = { ...program, name, deloadUntil: null, coachEditedAt: undefined, coachEditedBy: undefined };
    // Keep each user to 20 shared programs (oldest drop off).
    const mine = must(await sb.from("shared_programs").select("code, created_at").eq("owner_id", me.id).order("created_at", { ascending: false })) as Row[];
    for (const old of mine.slice(19)) must(await sb.from("shared_programs").delete().eq("code", old.code));
    for (let i = 0; i < 5; i++) {
      const code = newInviteCode();
      const r = await sb.from("shared_programs").insert({ code, owner_id: me.id, name, program: clean }).select("code").single();
      if (r.error && /duplicate|unique/i.test(r.error.message)) continue;
      must(r);
      return res.json({ code, name });
    }
    throw new HttpError(500, "Could not make a share code. Try again.");
  }));
  // Look a shared program up by code (preview + import).
  app.get("/api/programs/:code", authed(async (req, res) => {
    limit(req, "program-peek", 60, 60_000);
    const code = String(req.params.code || "").toUpperCase();
    if (!PROGRAM_CODE_RE.test(code)) throw new HttpError(404, "That program code isn't valid.");
    const row = must(await sb.from("shared_programs").select("code, name, program, created_at, owner_id, uses, users!shared_programs_owner_id_fkey(id, username, display_name)").eq("code", code).maybeSingle()) as Row | null;
    if (!row) throw new HttpError(404, "No program with that code. Codes are 6 letters/numbers.");
    sb.from("shared_programs").update({ uses: (row.uses ?? 0) + 1 }).eq("code", code).then(() => {}, () => {});
    res.json({ code: row.code, name: row.name, program: row.program, owner: row.users ? pub(row.users as DbUser) : null, createdAt: row.created_at });
  }));
  // Your shared codes, so you can re-send or revoke them.
  app.get("/api/programs", authed(async (_req, res, me) => {
    const rows = must(await sb.from("shared_programs").select("code, name, created_at, uses").eq("owner_id", me.id).order("created_at", { ascending: false })) as Row[];
    res.json({ shared: rows.map((r) => ({ code: r.code, name: r.name, createdAt: r.created_at, uses: r.uses ?? 0 })) });
  }));
  app.delete("/api/programs/:code", authed(async (req, res, me) => {
    const code = String(req.params.code || "").toUpperCase();
    must(await sb.from("shared_programs").delete().eq("code", code).eq("owner_id", me.id));
    res.json({ ok: true });
  }));
  // Coach → client: drops a program into the client's inbox; the client chooses to switch to it.
  app.post("/api/coach/clients/:id/program-send", authed(async (req, res, me) => {
    const clientId = String(req.params.id);
    await assertCoachOf(me, clientId);
    const program = req.body?.program;
    if (!validProgram(program)) throw bad("Invalid program");
    const { state } = await loadState(clientId);
    if (!state) throw new HttpError(404, "Client has no data yet");
    const inbox: Row[] = Array.isArray(state.programInbox) ? state.programInbox : [];
    inbox.unshift({ id: `inbox_${Date.now()}`, from: me.display_name, fromId: me.id, ts: Date.now(), program: { ...program, deloadUntil: null } });
    state.programInbox = inbox.slice(0, 10);
    await saveState(clientId, state);
    void notify(clientId, "coach", { title: "New program from your coach", body: `${me.display_name} sent you "${program.name || "a program"}". Switch to it or save it for later.`, url: "/?go=train&sub=program", tag: "coach-program" });
    res.json({ ok: true });
  }));

  /* ------------------------------------------------------------ push notifications */
  app.get("/api/push/config", (_req, res) => res.json({ enabled: pushEnabled, publicKey: vapidPublicKey, defaults: DEFAULT_PREFS }));

  app.get("/api/push/subscriptions", authed(async (_req, res, me) => {
    const rows = must(await sb.from("push_subscriptions").select("id, endpoint, ua, created_at, prefs").eq("user_id", me.id)) as Row[];
    res.json({ devices: rows.map((r) => ({ id: r.id, endpoint: r.endpoint, ua: r.ua, createdAt: r.created_at })), prefs: rows[0] ? sanitizePrefs(rows[0].prefs) : null });
  }));

  // One row per device. Re-subscribing from the same device updates it in place.
  app.post("/api/push/subscribe", authed(async (req, res, me) => {
    noDemo(me);
    if (!pushEnabled) throw new HttpError(503, "Notifications aren't configured on this server.");
    limit(req, "push-sub", 60, 3600_000);
    const sub = req.body?.subscription;
    const endpoint = str(sub?.endpoint, 1000);
    const p256dh = str(sub?.keys?.p256dh, 300);
    const auth = str(sub?.keys?.auth, 100);
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw bad("Invalid subscription");
    const count = must(await sb.from("push_subscriptions").select("id").eq("user_id", me.id)) as Row[];
    if (count.length >= 10) {
      const exists = must(await sb.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle());
      if (!exists) throw bad("Too many devices. Turn notifications off on one you no longer use.");
    }
    const prefs = sanitizePrefs(req.body?.prefs ?? (count.length ? undefined : DEFAULT_PREFS));
    const ua = str(req.headers["user-agent"], 200);
    must(await sb.from("push_subscriptions").upsert({ user_id: me.id, endpoint, p256dh, auth, ua, prefs, last_seen_at: new Date().toISOString() }, { onConflict: "endpoint" }));
    if (req.body?.prefs) must(await sb.from("push_subscriptions").update({ prefs }).eq("user_id", me.id));
    res.json({ ok: true, prefs });
  }));

  app.put("/api/push/prefs", authed(async (req, res, me) => {
    noDemo(me);
    const prefs = sanitizePrefs(req.body?.prefs);
    must(await sb.from("push_subscriptions").update({ prefs }).eq("user_id", me.id));
    res.json({ ok: true, prefs });
  }));

  app.delete("/api/push/subscribe", authed(async (req, res, me) => {
    const endpoint = str(req.body?.endpoint, 1000);
    const q = sb.from("push_subscriptions").delete().eq("user_id", me.id);
    must(await (endpoint ? q.eq("endpoint", endpoint) : q));
    res.json({ ok: true });
  }));

  app.post("/api/push/test", authed(async (req, res, me) => {
    noDemo(me);
    limit(req, "push-test", 10, 3600_000);
    const sent = await notify(me.id, "test", { title: "Corpus notifications are on", body: "This is what a reminder looks like. You can change what you get under Profile → Notifications.", url: "/?go=me", tag: "test" });
    res.json({ sent });
  }));

  // For serverless hosts without a long-running process: call this every 10 minutes from a scheduler.
  app.post("/api/push/cron", wrap(async (req, res) => {
    if (!CORPUS_DB_KEY || req.headers["x-corpus-key"] !== CORPUS_DB_KEY) throw new HttpError(401, "Nope");
    res.json(await runReminders());
  }));

  return httpServer;
}
