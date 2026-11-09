/**
 * Web Push for Corpus.
 * - Subscriptions live in Supabase `push_subscriptions` (one row per device).
 * - Event pushes (spotter requests, coach changes, respect/comments) are fired from routes via `notify()`.
 * - Reminders (check-in, meals, streak) run on an in-process timer; each user's `plan` (timezone,
 *   planned training dates, protein target) is computed by the client and stored in state.notifPlan.
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, any>;

export interface NotifPrefs {
  spotters: boolean;   // requests, accepts, respect, comments
  coach: boolean;      // program changes, notes, new client
  checkin: boolean;    // morning readiness reminder
  checkinHour: number; // local hour 0–23
  meals: boolean;      // midday "nothing logged" + evening protein gap
  streak: boolean;     // planned training day not done yet
  streakHour: number;
}
export const DEFAULT_PREFS: NotifPrefs = { spotters: true, coach: true, checkin: true, checkinHour: 8, meals: true, streak: true, streakHour: 18 };

export interface NotifPlan { tz: string; plannedDates: string[]; proteinTarget: number; streak: number; updatedAt: string }

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:colischdaniel@gmail.com";
export const pushEnabled = !!(PUBLIC_KEY && PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
export const vapidPublicKey = PUBLIC_KEY;

export function sanitizePrefs(raw: unknown): NotifPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Row;
  const b = (k: keyof NotifPrefs) => (typeof r[k] === "boolean" ? r[k] : DEFAULT_PREFS[k]) as boolean;
  const h = (k: "checkinHour" | "streakHour") => (Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 23 ? r[k] : DEFAULT_PREFS[k]) as number;
  return { spotters: b("spotters"), coach: b("coach"), checkin: b("checkin"), checkinHour: h("checkinHour"), meals: b("meals"), streak: b("streak"), streakHour: h("streakHour") };
}

export interface PushMessage { title: string; body: string; url?: string; tag?: string }

let sbRef: SupabaseClient | null = null;
export function initPush(sb: SupabaseClient) { sbRef = sb; }

async function sendTo(row: Row, msg: PushMessage): Promise<"ok" | "gone" | "fail"> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/", tag: msg.tag ?? "rxs" }),
      { TTL: 6 * 3600, urgency: "normal" },
    );
    return "ok";
  } catch (e: any) {
    const code = e?.statusCode;
    if (code === 404 || code === 410) return "gone"; // subscription expired or unsubscribed
    console.error("push error:", code, e?.body || e?.message);
    return "fail";
  }
}

async function rowsFor(userId: string): Promise<Row[]> {
  if (!sbRef) return [];
  const r = await sbRef.from("push_subscriptions").select("*").eq("user_id", userId);
  if (r.error) { console.error("db error:", r.error.message); return []; }
  return (r.data ?? []) as Row[];
}

async function dropRow(id: string) { if (sbRef) await sbRef.from("push_subscriptions").delete().eq("id", id); }

/** In-app inbox copy of an event. Kept to the latest 200 rows per user. */
async function inbox(userId: string, kind: string, msg: PushMessage) {
  if (!sbRef) return;
  const ins = await sbRef.from("notifications").insert({ user_id: userId, kind, title: msg.title, body: msg.body, url: msg.url ?? "/" });
  if (ins.error) { console.error("db error:", ins.error.message); return; }
  const old = await sbRef.from("notifications").select("id").eq("user_id", userId).order("created_at", { ascending: false }).range(200, 400);
  if (!old.error && old.data?.length) await sbRef.from("notifications").delete().in("id", old.data.map((r: Row) => r.id));
}

/** Send to every device of a user whose prefs allow `kind`, and file a copy in their in-app inbox. Never throws; failures are logged. */
export async function notify(userId: string, kind: "spotters" | "coach" | "test", msg: PushMessage): Promise<number> {
  if (kind !== "test") await inbox(userId, kind, msg).catch((e) => console.error("inbox:", e));
  if (!pushEnabled || !sbRef) return 0;
  let sent = 0;
  for (const row of await rowsFor(userId)) {
    const prefs = sanitizePrefs(row.prefs);
    if (kind !== "test" && !prefs[kind]) continue;
    const r = await sendTo(row, msg);
    if (r === "ok") sent++;
    else if (r === "gone") await dropRow(row.id);
  }
  return sent;
}

/* ---------------------------------------------------------------- reminders */

function localParts(tz: string, now = new Date()): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: parseInt(g("hour"), 10) % 24 };
  } catch {
    return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  }
}

interface Due { key: string; msg: PushMessage }

/** Decide which reminders are due for one user right now. Pure, so it is easy to test. */
export function dueReminders(prefs: NotifPrefs, plan: NotifPlan | null, state: Row | null, sent: Row, now = new Date()): Due[] {
  const tz = plan?.tz || "UTC";
  const { date, hour } = localParts(tz, now);
  const out: Due[] = [];
  const already = (k: string) => sent?.[k] === date;
  const sessions: Row[] = state?.sessions ?? [];
  const checkins: Row[] = state?.checkins ?? [];
  const meals: Row[] = state?.meals ?? [];
  const trainedToday = sessions.some((s) => s.date === date && s.end);
  const checkedIn = checkins.some((c) => c.date === date);
  const mealsToday = meals.filter((m) => m.date === date);
  const protein = mealsToday.reduce((a, m) => a + (Number(m.protein) || 0), 0);

  // Morning check-in: fires in the hour chosen, once per day, only if nothing logged yet.
  if (prefs.checkin && hour === prefs.checkinHour && !checkedIn && !already("checkin")) {
    out.push({ key: "checkin", msg: { title: "Morning check-in", body: "Sleep, soreness, energy: 30 seconds and today's weights adjust to how you actually feel.", url: "/?go=today&open=checkin", tag: "checkin" } });
  }
  // Nutrition: 1 pm nothing logged; 7 pm protein well short of target.
  if (prefs.meals) {
    if (hour === 13 && mealsToday.length === 0 && !already("meals-noon")) {
      out.push({ key: "meals-noon", msg: { title: "Nothing logged yet today", body: "Log breakfast and lunch now so tonight's protein number is real.", url: "/?go=today&open=fuel", tag: "meals" } });
    }
    const target = plan?.proteinTarget ?? 0;
    if (hour === 19 && target > 0 && protein < target * 0.6 && !already("meals-evening")) {
      const gap = Math.max(0, Math.round(target - protein));
      out.push({ key: "meals-evening", msg: { title: `${Math.round(protein)} g of ${Math.round(target)} g protein`, body: `About ${gap} g to go. Dinner plus a shake closes it.`, url: "/?go=today&open=fuel", tag: "meals" } });
    }
  }
  // Streak: a planned training day that is not done yet by the chosen hour.
  if (prefs.streak && hour === prefs.streakHour && !trainedToday && (plan?.plannedDates ?? []).includes(date) && !already("streak")) {
    const streak = Number(plan?.streak) || 0;
    out.push({ key: "streak", msg: { title: streak > 1 ? `${streak}-day streak on the line` : "Training day", body: streak > 1 ? "Today is a planned session and it isn't logged yet. Even a short one keeps the streak." : "Today's session is planned and not logged yet. Start it from the Train tab.", url: "/?go=train", tag: "streak" } });
  }
  return out;
}

let running = false;
/** One pass over every subscribed user. Called by the timer and by POST /api/push/cron. */
export async function runReminders(): Promise<{ users: number; sent: number }> {
  if (!pushEnabled || !sbRef || running) return { users: 0, sent: 0 };
  running = true;
  let sent = 0; let users = 0;
  try {
    const r = await sbRef.from("push_subscriptions").select("*");
    if (r.error) { console.error("db error:", r.error.message); return { users: 0, sent: 0 }; }
    const byUser = new Map<string, Row[]>();
    for (const row of (r.data ?? []) as Row[]) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
    for (const [userId, rows] of byUser) {
      users++;
      const prefs = sanitizePrefs(rows[0].prefs);
      if (!prefs.checkin && !prefs.meals && !prefs.streak) continue;
      const st = await sbRef.from("user_state").select("state").eq("user_id", userId).maybeSingle();
      const state = (st.data?.state ?? null) as Row | null;
      const plan = (state?.notifPlan ?? null) as NotifPlan | null;
      if (!plan?.tz) continue; // client has not reported a timezone yet
      const sentMap = (rows[0].sent ?? {}) as Row;
      const due = dueReminders(prefs, plan, state, sentMap);
      if (!due.length) continue;
      const { date } = localParts(plan.tz);
      for (const d of due) {
        for (const row of rows) {
          const res = await sendTo(row, d.msg);
          if (res === "ok") sent++;
          else if (res === "gone") await dropRow(row.id);
        }
        sentMap[d.key] = date;
      }
      await sbRef.from("push_subscriptions").update({ sent: sentMap }).eq("user_id", userId);
    }
  } finally { running = false; }
  return { users, sent };
}

let timer: NodeJS.Timeout | null = null;
export function startReminderTimer(everyMs = 10 * 60_000) {
  if (!pushEnabled || timer || process.env.VERCEL) return; // serverless: hit POST /api/push/cron from a scheduler instead
  timer = setInterval(() => { runReminders().catch((e) => console.error("reminders:", e)); }, everyMs);
  timer.unref?.();
}
