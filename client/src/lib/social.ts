import type { AppState, Client, ClientNote, Session } from "./types";
import { EX } from "./exercises";
import {
  addDays, dateKey, dayForDate, e1rm, e1rmSeries, fmtW, nutritionTargets, proteinByDate, readinessSeries, toKg,
  trainingDaysPerWeek, userStreak,
} from "./engine";

export const LEADER_LIFTS = ["bench_press", "back_squat", "deadlift", "ohp"] as const;

/** Public summary shared with Spotters (leaderboards, matching, gym). Never includes the vault. */
export interface PublicStats {
  units: "lb" | "kg";
  bodyWeightKg: number;
  sex: "m" | "f" | null;
  lifts: Record<string, number>; // exId -> best e1RM in kg
  streak: number;
  adherence: number;
  missedThisWeek: boolean; // a planned day earlier this week (Mon-based) with no finished session
  split: string;
  schedule: number[];
  gym: string;
  lastSessionAt: number | null;
  updatedAt: number;
}

export function adherence4w(state: AppState, today = dateKey()): number {
  const planned = trainingDaysPerWeek(state.program) * 4;
  const from = addDays(today, -28);
  const done = state.sessions.filter((s) => s.end && s.date > from && s.date <= today).length;
  return planned ? Math.min(1, done / planned) : 0;
}

export function computePublicStats(state: AppState): PublicStats | null {
  const p = state.profile;
  if (!p?.onboarded) return null;
  const today = dateKey();
  const lifts: Record<string, number> = {};
  for (const id of LEADER_LIFTS) {
    const ser = e1rmSeries(state.sessions, id);
    if (ser.length) lifts[id] = Math.round(toKg(Math.max(...ser.map((x) => x.e1rm)), p.units) * 10) / 10;
  }
  const last = [...state.sessions].filter((s) => s.end).sort((a, b) => b.start - a.start)[0];
  return {
    units: p.units, bodyWeightKg: Math.round(toKg(p.bodyWeight, p.units) * 10) / 10, sex: p.sex,
    lifts, streak: userStreak(state, today), adherence: Math.round(adherence4w(state, today) * 100) / 100,
    missedThisWeek: missedPlannedThisWeek(state, today),
    split: state.program?.name ?? "", schedule: Array.from(new Set(state.program?.days.flatMap((d) => d.weekdays) ?? [])).sort(),
    gym: p.gym || "", lastSessionAt: last?.end ?? null, updatedAt: Date.now(),
  };
}

/** True when a planned training day earlier this week (Monday start) has no finished session. */
export function missedPlannedThisWeek(state: AppState, today: string): boolean {
  const dow = new Date(today + "T12:00:00").getDay();
  const back = (dow + 6) % 7; // days since Monday
  const done = new Set(state.sessions.filter((s) => s.end).map((s) => s.date));
  for (let i = 1; i <= back; i++) {
    const d = addDays(today, -i);
    if (dayForDate(state.program, d) && !done.has(d)) return true;
  }
  return false;
}

export function topSetLabel(s: Session): string {
  let best: { name: string; w: number; r: number; e: number } | null = null;
  for (const l of s.exercises) for (const st of l.sets) {
    const e = e1rm(st.weight, st.reps);
    if (!best || e > best.e) best = { name: EX[l.exId]?.name ?? l.exId, w: st.weight, r: st.reps, e };
  }
  return best ? `${best.name} ${fmtW(best.w)}×${best.r}` : "—";
}

/** Turn a client's real account data into the coach dashboard summary. */
export function clientFromState(id: string, name: string, state: AppState, notes: ClientNote[]): Client {
  const today = dateKey();
  const rs = readinessSeries(state, today, 7).map((x) => x.score);
  const known = rs.filter((x): x is number => x != null);
  const fill = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : 0;
  const readiness = rs.map((x) => (x == null ? fill : x));
  let missed = 0;
  const done = new Set(state.sessions.filter((s) => s.end).map((s) => s.date));
  for (let i = 1; i <= 7; i++) { const d = addDays(today, -i); if (dayForDate(state.program, d) && !done.has(d)) missed++; }
  const ended = state.sessions.filter((s) => s.end).sort((a, b) => b.start - a.start);
  const last = ended[0];
  const target = state.profile ? nutritionTargets(state.profile, trainingDaysPerWeek(state.program)).protein : 0;
  const prot = proteinByDate(state.meals);
  const protein = Array.from({ length: 7 }, (_, k) => { const d = addDays(today, k - 6); return target ? Math.round(((prot[d] ?? 0) / target) * 100) : 0; });
  return {
    id, name, goal: state.profile?.goal ?? "muscle", readiness, adherence: adherence4w(state, today), missedRecent: missed,
    lastSession: last ? { date: last.date, name: last.dayName, topSet: topSetLabel(last) } : { date: today, name: "No sessions yet", topSet: "—" },
    program: state.program ?? { name: "No program", startDate: today, days: [] },
    notes, protein,
    recent: ended.slice(0, 6).map((s) => ({ id: s.id, date: s.date, name: s.dayName, topSet: topSetLabel(s), note: s.coachNote ?? "" })),
  };
}
