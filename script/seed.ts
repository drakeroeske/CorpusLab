/* Seed sample accounts: one coach + three linked clients, all Spotters with each other.
   Idempotent: deletes existing demo usernames first. Run: npx tsx script/seed.ts */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "../server/auth";
import { buildDemo, type DemoOpts } from "../client/src/lib/demo";
import { computePublicStats } from "../client/src/lib/social";
import { sessionPRs } from "../client/src/lib/engine";
import { EX } from "../client/src/lib/exercises";
import type { AppState } from "../client/src/lib/types";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false }, global: { headers: { "x-corpus-key": process.env.CORPUS_DB_KEY || "" } } });
const PASSWORD = "spotme2026";
const must = <T>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; };

interface Seed { username: string; name: string; role: "athlete" | "coach"; code: string; vault: boolean; opts: DemoOpts }
const SEEDS: Seed[] = [
  { username: "coach.demo", name: "Morgan Reyes", role: "coach", code: "MRGN26", vault: false,
    opts: { seed: 7, profile: { name: "Morgan Reyes", sex: "f", bodyWeight: 148, heightCm: 168, age: 34, experience: "advanced", goal: "strength", coachMode: true }, strength: 0.62, bwStart: 146, bwTrend: 0.01, todaySleep: 7.75, todayHrv: 1.02 } },
  { username: "jake.demo", name: "Jake Morrison", role: "athlete", code: "JAKE26", vault: true,
    opts: { seed: 11, profile: { name: "Jake Morrison", bodyWeight: 205, heightCm: 185, age: 27, experience: "advanced", goal: "strength" }, strength: 0.95, bwStart: 201, bwTrend: 0.06, sleepShift: -0.3, recentSleepDrop: 1.8, todaySleep: 4.75, todayHrv: 0.8 } },
  { username: "maria.demo", name: "Maria Santos", role: "athlete", code: "MRSA26", vault: false,
    opts: { seed: 23, template: "fb3", profile: { name: "Maria Santos", sex: "f", bodyWeight: 158, heightCm: 165, age: 38, experience: "beginner", goal: "fatloss" }, strength: 0.6, bwStart: 163, bwTrend: -0.09, proteinShift: -0.22, skipRate: 0.15, recentSkipRate: 0.6, todaySleep: 7, todayHrv: 0.97 } },
  { username: "devon.demo", name: "Devon Park", role: "athlete", code: "DEVN26", vault: true,
    opts: { seed: 31, template: "ppl6", profile: { name: "Devon Park", bodyWeight: 172, heightCm: 178, age: 24, experience: "intermediate", goal: "muscle" }, strength: 1.05, bwStart: 168, bwTrend: 0.05, sleepShift: 0.25, todaySleep: 8, todayHrv: 1.05 } },
];

async function main() {
  // wipe previous demo accounts (FKs cascade)
  const old = must(await sb.from("users").select("id").in("username", SEEDS.map((s) => s.username))) as { id: string }[];
  if (old.length) {
    const ids = old.map((u) => u.id);
    for (const t of ["post_comments", "post_likes"]) must(await sb.from(t).delete().in("user_id", ids));
    const posts = must(await sb.from("posts").select("id").in("user_id", ids)) as { id: string }[];
    if (posts.length) for (const t of ["post_comments", "post_likes"]) must(await sb.from(t).delete().in("post_id", posts.map((p) => p.id)));
    must(await sb.from("posts").delete().in("user_id", ids));
    must(await sb.from("coach_notes").delete().in("client_id", ids));
    must(await sb.from("coach_notes").delete().in("coach_id", ids));
    must(await sb.from("coach_links").delete().in("client_id", ids));
    must(await sb.from("coach_links").delete().in("coach_id", ids));
    must(await sb.from("friendships").delete().in("requester", ids));
    must(await sb.from("friendships").delete().in("addressee", ids));
    must(await sb.from("auth_sessions").delete().in("user_id", ids));
    must(await sb.from("user_state").delete().in("user_id", ids));
    must(await sb.from("users").delete().in("id", ids));
  }

  const made: { seed: Seed; id: string; state: AppState }[] = [];
  for (const seed of SEEDS) {
    const state: AppState = { ...buildDemo(seed.opts), spotters: [], feed: [], crews: [], clients: [], demo: false };
    const stats = computePublicStats(state);
    const u = must(await sb.from("users").insert({
      username: seed.username, display_name: seed.name, pass_hash: hashPassword(PASSWORD), role: seed.role, invite_code: seed.code,
      share_feed: true, share_lifts: true, share_vault_with_coach: seed.vault, stats, is_demo: true,
    }).select("id").single()) as { id: string };
    made.push({ seed, id: u.id, state });
  }
  const [coach, jake, maria, devon] = made;

  // Coach session note on Jake's latest session + a coach note
  const jl = jake.state.sessions[jake.state.sessions.length - 1];
  jl.coachNote = "Bar speed slowed on the last two squat sets. Keep RIR honest at 2 this week.";
  for (const m of made) must(await sb.from("user_state").insert({ user_id: m.id, state: m.state, updated_at: new Date().toISOString() }));

  for (const c of [jake, maria, devon]) must(await sb.from("coach_links").insert({ coach_id: coach.id, client_id: c.id }));
  const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  must(await sb.from("coach_notes").insert([
    { coach_id: coach.id, client_id: jake.id, text: "Readiness trending down 5 days. Sleep under 6 h most nights. Consider a deload if it continues.", date: day(1) },
    { coach_id: coach.id, client_id: maria.id, text: "Missed two sessions. Protein averaging well under target. Check in about schedule.", date: day(2) },
    { coach_id: coach.id, client_id: devon.id, text: "Great adherence. Add a set to lateral raises next block.", date: day(4) },
  ]));

  // Everyone is Spotters with everyone
  const pairs: [string, string][] = [];
  for (let i = 0; i < made.length; i++) for (let j = i + 1; j < made.length; j++) pairs.push([made[i].id, made[j].id]);
  must(await sb.from("friendships").insert(pairs.map(([a, b]) => ({ requester: a, addressee: b, status: "accepted" }))));

  // Posts from each athlete's last 4 sessions
  const comments = ["Clean.", "Bar speed looked good", "Strong week", "Let's go", "Sleep is paying off", "Big PR", "Save me a rack tomorrow"];
  let ci = 0;
  for (const m of made) {
    const sess = m.state.sessions.filter((s) => s.end).slice(-4);
    for (const s of sess) {
      const prs = sessionPRs(m.state.sessions, s).map((p) => EX[p.exId].name);
      const body = {
        sessionName: s.dayName, sessionId: s.id, durationMin: Math.round((s.end! - s.start) / 60000), prs,
        topSets: s.exercises.slice(0, 3).map((l) => ({ name: EX[l.exId].name, weight: l.sets[0]?.weight ?? 0, reps: l.sets[0]?.reps ?? 0, units: m.state.profile.units })),
      };
      const p = must(await sb.from("posts").insert({ user_id: m.id, kind: "session", body, created_at: new Date(s.end!).toISOString() }).select("id").single()) as { id: string };
      const others = made.filter((o) => o.id !== m.id);
      const likers = others.filter((_, k) => (k + ci) % 3 !== 0);
      if (likers.length) must(await sb.from("post_likes").insert(likers.map((o) => ({ post_id: p.id, user_id: o.id }))));
      if (prs.length || ci % 2 === 0) {
        const o = others[ci % others.length];
        must(await sb.from("post_comments").insert({ post_id: p.id, user_id: o.id, text: prs.length ? "PR machine" : comments[ci % comments.length], created_at: new Date(s.end! + 3600000).toISOString() }));
      }
      ci++;
    }
  }

  // Gym check-ins (fresh: within the 3 h window)
  const gym = jake.state.profile.gym || "Forge Athletic Club";
  must(await sb.from("users").update({ gym_checkin: { gym, ts: Date.now() - 25 * 60000 } }).eq("id", devon.id));
  must(await sb.from("users").update({ gym_checkin: { gym, ts: Date.now() - 50 * 60000 } }).eq("id", maria.id));

  console.log("Seeded:", made.map((m) => `${m.seed.username} (${m.seed.role}, code ${m.seed.code}, ${m.state.sessions.length} sessions)`).join("; "));
}

main().catch((e) => { console.error(e); process.exit(1); });
