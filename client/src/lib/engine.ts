/**
 * Corpus Engine — pure logic. No React, no storage, no side effects.
 * Every function here takes plain data and returns plain data.
 */
import type {
  AppState, CheckIn, Exercise, ExerciseLog, Goal, Meal, Muscle, Profile, Program, ProgramDay,
  ProgramExercise, Session, Sex, Spotter, Units, Experiment,
} from "./types";
import { EX, EXERCISES, MUSCLES, MUSCLE_LABEL, MAIN_LIFTS, allExercises, isCompound } from "./exercises";

/* =========================== dates =========================== */
export const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (k: string, n: number) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);
export const weekdayOf = (k: string) => parseKey(k).getDay();
export const fmtDate = (k: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  parseKey(k).toLocaleDateString("en-US", opts);
/** Monday-start week key */
export const weekStart = (k: string) => { const wd = (weekdayOf(k) + 6) % 7; return addDays(k, -wd); };

/* =========================== math =========================== */
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const roundTo = (x: number, inc: number) => (inc > 0 ? Math.round(x / inc) * inc : x);
export const r1 = (x: number) => Math.round(x * 10) / 10;
export const LB_PER_KG = 2.20462;
export const toKg = (w: number, u: Units) => (u === "kg" ? w : w / LB_PER_KG);
export const fromKg = (w: number, u: Units) => (u === "kg" ? w : w * LB_PER_KG);

export function linreg(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
  const mx = mean(points.map((p) => p.x)), my = mean(points.map((p) => p.y));
  let num = 0, den = 0, ssTot = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; ssTot += (p.y - my) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0;
  for (const p of points) ssRes += (p.y - (slope * p.x + intercept)) ** 2;
  return { slope, intercept, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
}

/* =========================== strength =========================== */
/** Epley: weight × (1 + reps/30) */
export const e1rm = (w: number, reps: number) => (reps <= 0 ? 0 : reps === 1 ? w : w * (1 + reps / 30));

export const logBestE1rm = (log: ExerciseLog) =>
  log.sets.reduce((m, s) => Math.max(m, e1rm(s.weight * log.equivFactor, s.reps)), 0);

/* =========================== progression =========================== */
export type Decision = "start" | "increase" | "add_rep" | "hold" | "reduce";
export interface ProgressionState {
  weight: number;      // next target weight (original exercise units)
  repGoal: number;     // rep goal for first working set
  baseWeight: number;  // last weight actually used (equivalent)
  missStreak: number;
  decision: Decision;
  last?: { weight: number; reps: number };
}

export const DEFAULT_INC_PCT = 2.5;
/** Weight jump for an exercise at a given working weight: pct of weight, rounded to the plate step, at least one step. */
export function jumpFor(pe: ProgramExercise, weight: number): number {
  const step = pe.increment || 1;
  const pct = pe.incrementPct ?? DEFAULT_INC_PCT;
  if (!(weight > 0)) return step;
  return Math.max(step, roundTo((weight * pct) / 100, step));
}
/** Low set quality (≤ 2) on the top set means the weight was a grind: earn the reps again before adding load. */
export const grindy = (s: { quality?: number | null }) => s.quality != null && s.quality <= 2;

/**
 * Progression on the FIRST working set:
 * reps ≥ top → +increment · reps within range → same weight, +1 rep ·
 * below range → hold; below range 2 sessions in a row → −10% (rounded to increment)
 */
export function progressionState(pe: ProgramExercise, logs: ExerciseLog[]): ProgressionState {
  let st: ProgressionState = { weight: pe.startWeight, repGoal: pe.style === "straight" ? pe.repMax : pe.repMin, baseWeight: pe.startWeight, missStreak: 0, decision: "start" };
  for (const log of logs) {
    const s = log.sets[0];
    if (!s) continue;
    const w = roundTo(s.weight * log.equivFactor, pe.increment || 1) || s.weight * log.equivFactor;
    const reps = s.reps;
    st = { ...st, baseWeight: w, last: { weight: w, reps } };
    if (reps >= pe.repMax && grindy(s)) {
      st.weight = w; st.repGoal = pe.repMax; st.missStreak = 0; st.decision = "add_rep";
    } else if (reps >= pe.repMax) {
      st.weight = w + jumpFor(pe, w); st.repGoal = pe.style === "straight" ? pe.repMax : pe.repMin; st.missStreak = 0; st.decision = "increase";
    } else if (reps >= pe.repMin) {
      st.weight = w; st.repGoal = pe.style === "straight" ? pe.repMax : Math.min(pe.repMax, reps + 1); st.missStreak = 0; st.decision = "add_rep";
    } else {
      const miss = st.missStreak + 1;
      if (miss >= 2) { st.weight = Math.max(0, roundTo(w * 0.9, pe.increment || 1)); st.missStreak = 0; st.decision = "reduce"; st.repGoal = pe.style === "straight" ? pe.repMax : pe.repMin; }
      else { st.weight = w; st.missStreak = miss; st.decision = "hold"; st.repGoal = pe.style === "straight" ? pe.repMax : pe.repMin; }
    }
  }
  return st;
}

export type ReadinessEffect = "normal" | "hold" | "reduce";
export const readinessEffect = (score: number | null): ReadinessEffect =>
  score == null || score >= 75 ? "normal" : score >= 50 ? "hold" : "reduce";

export interface Prescription {
  weight: number;
  sets: number;
  repMin: number;
  repMax: number;
  repGoal: number;
  rir: number;
  why: string;
  decision: Decision;
  effect: ReadinessEffect;
  deload: boolean;
}

export function prescribe(pe: ProgramExercise, logs: ExerciseLog[], readiness: number | null, deload: boolean, units: Units): Prescription {
  const st = progressionState(pe, logs);
  const ex = EX[pe.exId];
  const effect = readinessEffect(readiness);
  let weight = st.weight;
  let rir = pe.technique === "failure" ? 0 : isCompound(ex) ? 2 : 1;
  const u = units;
  let why = "";
  const last = st.last ? `${fmtW(st.last.weight)}×${st.last.reps}` : "";
  switch (st.decision) {
    case "start": why = `First session — start conservative at ${fmtW(weight)} ${u}`; break;
    case "increase": why = `Hit ${last} (top of range) → +${fmtW(jumpFor(pe, st.baseWeight))} ${u} (${pe.incrementPct ?? DEFAULT_INC_PCT}%)`; break;
    case "add_rep": why = st.last && st.last.reps >= pe.repMax ? `Hit ${last} but it was a grind → same weight, make it clean first` : `Last ${last} within range → same weight, aim ${st.repGoal} reps`; break;
    case "hold": why = `Last ${last} below range → hold; one more miss triggers −10%`; break;
    case "reduce": why = `Below range 2 sessions running → reset −10% to ${fmtW(weight)} ${u}`; break;
  }
  if (effect === "hold" && st.decision === "increase") {
    weight = st.baseWeight;
    why = `Earned +${fmtW(jumpFor(pe, st.baseWeight))} ${u}, but readiness ${Math.round(readiness!)} → holding ${fmtW(weight)}`;
  } else if (effect === "hold") {
    why += ` · readiness ${Math.round(readiness!)}: hold`;
  } else if (effect === "reduce") {
    weight = Math.max(0, roundTo(Math.min(weight, st.baseWeight || weight) * 0.9, pe.increment || 1));
    rir = Math.max(rir, 3);
    why = `Readiness ${Math.round(readiness!)} < 50 → −10% and cap effort at 3 RIR`;
  }
  let sets = pe.sets;
  if (deload) { sets = Math.max(1, Math.round(pe.sets * 0.6)); why = `Deload week: ${sets} sets (60% volume), same weight`; }
  return { weight, sets, repMin: pe.repMin, repMax: pe.repMax, repGoal: st.repGoal, rir, why, decision: st.decision, effect, deload };
}

export const fmtW = (w: number) => (Math.round(w * 10) / 10).toString();

/* =========================== readiness =========================== */
export interface ReadinessResult {
  score: number | null;
  confidence: "high" | "medium" | "low";
  inputs: number;
  parts: { key: string; label: string; pts: number; max: number; present: boolean }[];
  reason: string;
  effect: ReadinessEffect;
  hrvDelta: number | null; // fraction vs baseline
}

const BASE_WEIGHTS = { sleepH: 30, sleepQ: 10, hrv: 20, energy: 15, soreness: 15, stress: 10 } as const;

export function hrvBaseline(checkins: CheckIn[], date: string): number | null {
  const vals = checkins
    .filter((c) => c.hrv != null && c.date < date && daysBetween(c.date, date) <= 7)
    .map((c) => c.hrv as number);
  return vals.length >= 3 ? mean(vals) : null;
}

export function computeReadiness(ci: CheckIn | undefined, baseline: number | null, targetMuscles: Muscle[]): ReadinessResult {
  const empty: ReadinessResult = { score: null, confidence: "low", inputs: 0, parts: [], reason: "No check-in yet today — log sleep and energy to get a readiness score.", effect: "normal", hrvDelta: null };
  if (!ci) return empty;
  const raw: Record<keyof typeof BASE_WEIGHTS, number | null> = {
    sleepH: ci.sleepH != null ? clamp((ci.sleepH - 4) / 4, 0, 1) : null,
    sleepQ: ci.sleepQ != null ? clamp((ci.sleepQ - 1) / 4, 0, 1) : null,
    hrv: null,
    energy: ci.energy != null ? clamp((ci.energy - 1) / 4, 0, 1) : null,
    soreness: null,
    stress: ci.stress != null ? clamp((5 - ci.stress) / 4, 0, 1) : null,
  };
  let hrvDelta: number | null = null;
  if (ci.hrv != null && baseline) {
    hrvDelta = ci.hrv / baseline - 1;
    raw.hrv = hrvDelta >= 0 ? 1 : clamp(1 - -hrvDelta / 0.15, 0, 1);
  }
  const soreVals = targetMuscles.map((m) => ci.soreness?.[m] ?? 0); // 0 none → 5 severe
  if (targetMuscles.length) raw.soreness = clamp(1 - mean(soreVals) / 5, 0, 1);
  else raw.soreness = 1;

  const presentKeys = (Object.keys(raw) as (keyof typeof BASE_WEIGHTS)[]).filter((k) => raw[k] != null);
  const presentWeight = presentKeys.reduce((a, k) => a + BASE_WEIGHTS[k], 0);
  if (presentWeight === 0) return empty;
  // redistribute missing weight proportionally across present inputs
  const scale = 100 / presentWeight;
  const labels: Record<string, string> = { sleepH: "Sleep duration", sleepQ: "Sleep quality", hrv: "HRV vs baseline", energy: "Energy", soreness: "Target-muscle soreness", stress: "Stress" };
  const parts = (Object.keys(BASE_WEIGHTS) as (keyof typeof BASE_WEIGHTS)[]).map((k) => {
    const max = raw[k] != null ? BASE_WEIGHTS[k] * scale : 0;
    return { key: k, label: labels[k], pts: raw[k] != null ? raw[k]! * max : 0, max, present: raw[k] != null };
  });
  const score = Math.round(parts.reduce((a, p) => a + p.pts, 0));
  const inputs = presentKeys.filter((k) => k !== "soreness" || targetMuscles.length).length;
  const confidence = inputs >= 6 ? "high" : inputs >= 4 ? "medium" : "low";
  const effect = readinessEffect(score);

  const bits: string[] = [];
  if (ci.sleepH != null && ci.sleepH < 7) bits.push(`${r1(ci.sleepH)}h sleep`);
  if (hrvDelta != null && hrvDelta < -0.05) bits.push(`HRV ${Math.round(-hrvDelta * 100)}% below baseline`);
  const sore = targetMuscles.filter((m) => (ci.soreness?.[m] ?? 0) >= 3);
  if (sore.length) bits.push(`sore ${sore.slice(0, 2).map((m) => MUSCLE_LABEL[m].toLowerCase()).join(" & ")}`);
  if (ci.energy != null && ci.energy <= 2) bits.push("low energy");
  if (ci.stress != null && ci.stress >= 4) bits.push("high stress");
  if (ci.sleepQ != null && ci.sleepQ <= 2 && !(ci.sleepH != null && ci.sleepH < 7)) bits.push("poor sleep quality");
  const good: string[] = [];
  if (ci.sleepH != null && ci.sleepH >= 7.5) good.push(`${r1(ci.sleepH)}h sleep`);
  if (hrvDelta != null && hrvDelta >= -0.02) good.push(hrvDelta > 0.03 ? `HRV ${Math.round(hrvDelta * 100)}% above baseline` : "HRV at baseline");
  if (ci.energy != null && ci.energy >= 4) good.push("high energy");
  const tail = effect === "normal" ? "normal progression" : effect === "hold" ? "holding weights today" : "−10% and capping effort at 3 RIR";
  const lead = effect === "normal" ? (good.length ? good : bits.length ? bits : ["inputs in range"]) : bits.length ? bits : ["several inputs below your usual"];
  const reason = `${lead.join(" + ")} → ${tail}`;
  return { score, confidence, inputs, parts, reason, effect, hrvDelta };
}

/* =========================== program helpers =========================== */
export function dayForDate(program: Program | null, date: string): ProgramDay | null {
  if (!program) return null;
  const wd = weekdayOf(date);
  return program.days.find((d) => d.weekdays.includes(wd)) ?? null;
}
export function dayMuscles(day: ProgramDay | null): Muscle[] {
  if (!day) return [];
  const s = new Set<Muscle>();
  day.exercises.forEach((pe) => EX[pe.exId]?.primary.forEach((m) => s.add(m)));
  return [...s];
}
export const trainingDaysPerWeek = (p: Program | null) => (p ? new Set(p.days.flatMap((d) => d.weekdays)).size : 3);

export function phaseInfo(program: Program | null, today: string, deloadRecommended: boolean) {
  if (!program) return { week: 0, phase: "No program", blockWeek: 0 };
  const week = Math.max(1, Math.floor(daysBetween(program.startDate, today) / 7) + 1);
  const blockWeek = ((week - 1) % 6) + 1;
  const inDeload = program.deloadUntil && today <= program.deloadUntil;
  const phase = inDeload ? "Deload" : blockWeek <= 3 ? "Accumulation" : blockWeek <= 5 ? "Intensification" : "Deload";
  return { week, phase: deloadRecommended && !inDeload ? `${phase} · deload advised` : phase, blockWeek };
}

/* =========================== exercise history =========================== */
export function logsForPe(sessions: Session[], peId: string): ExerciseLog[] {
  return sessions
    .filter((s) => s.end)
    .sort((a, b) => a.start - b.start)
    .flatMap((s) => s.exercises.filter((e) => e.peId === peId && e.sets.length));
}

/** e1RM per session for an exercise (by original exercise id) */
export function e1rmSeries(sessions: Session[], exId: string): { date: string; e1rm: number; ts: number }[] {
  const out: { date: string; e1rm: number; ts: number }[] = [];
  for (const s of [...sessions].filter((s) => s.end).sort((a, b) => a.start - b.start)) {
    const logs = s.exercises.filter((e) => e.originalExId === exId && e.sets.length);
    if (!logs.length) continue;
    out.push({ date: s.date, ts: s.start, e1rm: Math.max(...logs.map(logBestE1rm)) });
  }
  return out;
}

export function performedExerciseIds(sessions: Session[]): string[] {
  const s = new Set<string>();
  sessions.forEach((x) => x.exercises.forEach((e) => e.sets.length && s.add(e.originalExId)));
  return [...s];
}

/** PRs set in a session: exercises whose best e1RM beats every earlier session */
export function sessionPRs(sessions: Session[], session: Session): { exId: string; e1rm: number; weight: number; reps: number }[] {
  const earlier = sessions.filter((s) => s.end && s.start < session.start && s.id !== session.id);
  const out: { exId: string; e1rm: number; weight: number; reps: number }[] = [];
  const seen = new Set<string>();
  for (const log of session.exercises) {
    if (!log.sets.length || seen.has(log.originalExId)) continue;
    seen.add(log.originalExId);
    const prev = Math.max(0, ...earlier.flatMap((s) => s.exercises.filter((e) => e.originalExId === log.originalExId && e.sets.length).map(logBestE1rm)));
    const best = log.sets.reduce((b, s) => (e1rm(s.weight * log.equivFactor, s.reps) > e1rm(b.weight * log.equivFactor, b.reps) ? s : b), log.sets[0]);
    const v = e1rm(best.weight * log.equivFactor, best.reps);
    if (prev > 0 && v > prev + 0.01) out.push({ exId: log.originalExId, e1rm: v, weight: best.weight, reps: best.reps });
  }
  return out;
}

/* =========================== fatigue =========================== */
export function proteinByDate(meals: Meal[]): Record<string, number> {
  const out: Record<string, number> = {};
  meals.forEach((m) => (out[m.date] = (out[m.date] ?? 0) + m.p));
  return out;
}
export function caloriesByDate(meals: Meal[]): Record<string, number> {
  const out: Record<string, number> = {};
  meals.forEach((m) => (out[m.date] = (out[m.date] ?? 0) + m.cal));
  return out;
}

export function halfLifeHours(sleepAfter: number | null | undefined, proteinMissed: boolean) {
  if ((sleepAfter != null && sleepAfter < 6) || proteinMissed) return 60;
  if (sleepAfter != null && sleepAfter >= 7.5) return 36;
  return 48;
}

/**
 * Each working set adds 1.0 to primaries, 0.5 to secondaries; exponential decay.
 * Half-life 48h (36h if sleep ≥ 7.5h, 60h if sleep < 6h or protein target missed).
 */
export function muscleFatigue(sessions: Session[], checkins: CheckIn[], meals: Meal[], proteinTarget: number, now: number): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const ciBy = Object.fromEntries(checkins.map((c) => [c.date, c]));
  const prot = proteinByDate(meals);
  for (const s of sessions) {
    if (!s.end && s.exercises.every((e) => !e.sets.length)) continue;
    const ageH0 = (now - s.start) / 3600000;
    if (ageH0 < 0 || ageH0 > 24 * 12) continue;
    const sleepAfter = ciBy[addDays(s.date, 1)]?.sleepH ?? ciBy[s.date]?.sleepH;
    const loggedProtein = prot[s.date];
    const proteinMissed = loggedProtein != null && loggedProtein < proteinTarget * 0.9 && s.date !== dateKey(new Date(now));
    const hl = halfLifeHours(sleepAfter, proteinMissed);
    for (const log of s.exercises) {
      const ex = EX[log.exId];
      if (!ex) continue;
      for (const set of log.sets) {
        const age = Math.max(0, (now - set.ts) / 3600000);
        const decay = Math.pow(0.5, age / hl);
        ex.primary.forEach((m) => (out[m] += 1 * decay));
        ex.secondary.forEach((m) => (out[m] += 0.5 * decay));
      }
    }
  }
  return out;
}
export const fatiguePct = (units: number) => clamp(Math.round(units * 10), 0, 100);

/* =========================== volume =========================== */
export function weeklySets(sessions: Session[], from: string, to: string): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  sessions.filter((s) => s.date >= from && s.date <= to).forEach((s) =>
    s.exercises.forEach((log) => {
      const ex = EX[log.exId];
      if (!ex) return;
      const n = log.sets.length;
      ex.primary.forEach((m) => (out[m] += n));
      ex.secondary.forEach((m) => (out[m] += n * 0.5));
    }),
  );
  return out;
}
export const sessionVolume = (s: Session) => s.exercises.reduce((a, l) => a + l.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);
export const VOLUME_RANGE = { min: 10, max: 20 };

/* =========================== plateau & deload =========================== */
/** e1RM hasn't improved across 3 consecutive sessions */
export function isPlateau(series: { e1rm: number }[]): boolean {
  if (series.length < 4) return false;
  const last3 = series.slice(-3).map((s) => s.e1rm);
  const priorBest = Math.max(...series.slice(0, -3).map((s) => s.e1rm));
  return Math.max(...last3) <= priorBest * 1.002;
}

export interface PlateauFlag { exId: string; fix: string; kind: "deload" | "add_set" | "calories" | "protein" | "variation" }
let _proteinTarget = 0;
/** set by the app so plateau fixes can reference protein adherence */
export const setProteinTarget = (g: number) => { _proteinTarget = g; };

export function plateauFix(ctx: { avgReadiness7: number | null; weeklySetsPrimary: number; weightSlopePerWeek: number; proteinHit?: number }): Omit<PlateauFlag, "exId"> {
  if (ctx.avgReadiness7 != null && ctx.avgReadiness7 < 65) return { kind: "deload", fix: `Readiness has averaged ${Math.round(ctx.avgReadiness7)} — take a deload week (60% volume, same weights) to let fatigue clear.` };
  if (ctx.weeklySetsPrimary < 12) return { kind: "add_set", fix: `Only ${r1(ctx.weeklySetsPrimary)} hard sets/week for this muscle — add 1 working set.` };
  if (ctx.weightSlopePerWeek < -0.1) return { kind: "calories", fix: `Body weight is dropping while strength stalls — raise calories ~200 kcal/day.` };
  if (ctx.proteinHit != null && ctx.proteinHit < 0.6) return { kind: "protein", fix: `Protein hit only ${Math.round(ctx.proteinHit * 100)}% of days in the last 2 weeks — get protein to target daily before changing the program.` };
  return { kind: "variation", fix: "Recovery and volume look fine — swap to a close variation for 3 weeks or widen the rep range." };
}

/* =========================== projection =========================== */
export function projection(series: { date: string; e1rm: number }[], today: string, units: Units, multiplier = 1) {
  const recent = series.filter((s) => daysBetween(s.date, today) <= 42);
  if (recent.length < 3) return null;
  const pts = recent.map((s) => ({ x: daysBetween(today, s.date), y: s.e1rm }));
  const lr = linreg(pts);
  const slopeDay = lr.slope * multiplier;
  const current = Math.max(...series.slice(-3).map((s) => s.e1rm));
  const step = units === "lb" ? (current < 150 ? 10 : 25) : current < 70 ? 5 : 10;
  const target = Math.ceil((current + 0.01) / step) * step;
  const fitNow = lr.intercept;
  let days: number | null = null;
  if (slopeDay > 0.01) days = Math.ceil((target - Math.max(fitNow, current * 0.98)) / slopeDay);
  const by = days != null && days > 0 && days < 365 ? addDays(today, days) : null;
  return { slopePerWeek: slopeDay * 7, current, target, by, r2: lr.r2, fitNow };
}

/** what-if: +10% rate for each improved factor (estimate) */
export function whatIfMultiplier(opts: { sleep8: boolean; proteinDaily: boolean }, ctx: { avgSleep: number; proteinHitRate: number }) {
  let m = 1;
  if (opts.sleep8 && ctx.avgSleep < 8) m += 0.1;
  if (opts.proteinDaily && ctx.proteinHitRate < 0.99) m += 0.1;
  return m;
}

/* =========================== body composition =========================== */
export interface BodyCompResult { label: string; tone: "good" | "warn" | "info"; weightRatePct: number; strengthPct: number; advice: string }

export function bodyComp(weights: { date: string; w: number }[], strengthPct: number | null, today: string): BodyCompResult | null {
  const recent = weights.filter((x) => daysBetween(x.date, today) <= 14 && daysBetween(x.date, today) >= 0);
  if (recent.length < 5 || strengthPct == null) return null;
  const lr = linreg(recent.map((x) => ({ x: daysBetween(today, x.date), y: x.w })));
  const avg = mean(recent.map((x) => x.w));
  const ratePct = (lr.slope * 7) / avg * 100;
  const s = strengthPct;
  let label: string, tone: BodyCompResult["tone"], advice: string;
  if (ratePct > 0.15) {
    if (ratePct <= 0.5 && s > 1) { label = "Likely building muscle"; tone = "good"; advice = "Gain rate and strength both on track — keep calories where they are."; }
    else if (s > 1) { label = "Likely building muscle"; tone = "info"; advice = "Strength is climbing but weight is rising fast — trim ~150 kcal/day to limit fat gain."; }
    else { label = "Likely gaining fat"; tone = "warn"; advice = "Weight is rising without strength gains — cut ~200 kcal/day."; }
  } else if (ratePct < -0.15) {
    if (s >= -1) { label = "Likely losing fat"; tone = "good"; advice = "Strength is holding in a deficit — keep the deficit and protein at target."; }
    else { label = "Losing muscle risk"; tone = "warn"; advice = "Weight and strength are both falling — add ~200 kcal/day and push protein to 2.2 g/kg."; }
  } else {
    if (s > 1) { label = "Likely building muscle"; tone = "good"; advice = "Weight stable while strength rises — classic recomp. Hold calories."; }
    else if (s < -1) { label = "Losing muscle risk"; tone = "warn"; advice = "Strength trending down at stable weight — check sleep and protein, consider +150 kcal/day."; }
    else { label = "Maintaining"; tone = "info"; advice = "Weight and strength both flat — add ~200 kcal/day if the goal is muscle."; }
  }
  return { label, tone, weightRatePct: ratePct, strengthPct: s, advice };
}

/** average % change in e1RM across main lifts over the last N days */
export function strengthTrendPct(sessions: Session[], today: string, days = 14): number | null {
  const changes: number[] = [];
  const ids = performedExerciseIds(sessions).filter((id) => isCompound(EX[id]));
  for (const id of ids) {
    const ser = e1rmSeries(sessions, id).filter((s) => daysBetween(s.date, today) <= days + 7);
    if (ser.length < 3) continue;
    const lr = linreg(ser.map((s) => ({ x: daysBetween(today, s.date), y: s.e1rm })));
    const avg = mean(ser.map((s) => s.e1rm));
    changes.push(((lr.slope * days) / avg) * 100);
  }
  return changes.length ? mean(changes) : null;
}

/* =========================== nutrition =========================== */
export interface NutritionTargets { bmr: number; tdee: number; cal: number; trainingCal: number; restCal: number; protein: number; proteinPerKg: number; activity: number; goalAdj: number }

export function nutritionTargets(p: Profile, daysPerWeek: number): NutritionTargets {
  const kg = toKg(p.bodyWeight, p.units);
  const sexAdj = p.sex === "m" ? 5 : p.sex === "f" ? -161 : -78;
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * p.age + sexAdj;
  const activity = daysPerWeek <= 3 ? 1.375 : daysPerWeek <= 5 ? 1.55 : 1.725;
  const tdee = bmr * activity;
  const goalAdj: Record<Goal, number> = { muscle: p.experience === "beginner" ? 350 : 250, strength: 200, fatloss: -500, recomp: -150 };
  const cal = Math.round((tdee + goalAdj[p.goal]) / 10) * 10;
  const perKg: Record<Goal, number> = { muscle: 1.8, strength: 1.6, fatloss: 2.2, recomp: 2.0 };
  const protein = Math.round(kg * perKg[p.goal]);
  // training-day bump, rest-day trim, weekly average preserved
  const bump = 150;
  const restDays = 7 - daysPerWeek;
  const restTrim = restDays > 0 ? Math.round((bump * daysPerWeek) / restDays / 10) * 10 : 0;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), cal, trainingCal: cal + bump, restCal: cal - restTrim, protein, proteinPerKg: perKg[p.goal], activity, goalAdj: goalAdj[p.goal] };
}

/* =========================== DOTS =========================== */
export function dots(liftKg: number, bwKg: number, sex: "m" | "f" | Sex) {
  const male = sex !== "f";
  const [a, b, c, d, e] = male
    ? [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
    : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  const x = clamp(bwKg, 40, male ? 210 : 150);
  const den = a + b * x + c * x ** 2 + d * x ** 3 + e * x ** 4;
  return (liftKg * 500) / den;
}

/* =========================== gym math =========================== */
export function warmupSets(target: number, bar: number, inc: number) {
  const rows = [
    { label: "Bar", weight: bar, reps: 10 },
    { label: "40%", weight: roundTo(target * 0.4, inc), reps: 5 },
    { label: "60%", weight: roundTo(target * 0.6, inc), reps: 3 },
    { label: "80%", weight: roundTo(target * 0.8, inc), reps: 2 },
  ];
  return rows.filter((r, i) => i === 0 || r.weight > bar).map((r) => ({ ...r, weight: Math.max(bar, r.weight) }));
}

export const PLATES: Record<Units, number[]> = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
export function platesPerSide(total: number, bar: number, units: Units) {
  let side = (total - bar) / 2;
  const out: number[] = [];
  if (side <= 0) return { plates: out, remainder: 0 };
  for (const p of PLATES[units]) while (side >= p - 1e-6) { out.push(p); side -= p; }
  return { plates: out, remainder: r1(side * 2) };
}

/** Same movement pattern + overlapping primary muscles; weight converted by ratio */
export function substitutes(exId: string, target: number, inc: number) {
  const ex = EX[exId];
  // Custom exercises have no reliable strength ratio, so no automatic swaps to or from them.
  if (!ex || ex.custom) return [];
  return EXERCISES.filter((c) => c.id !== ex.id && c.pattern === ex.pattern && c.primary.some((m) => ex.primary.includes(m)))
    .map((c) => {
      const overlap = c.primary.filter((m) => ex.primary.includes(m)).length / Math.max(ex.primary.length, c.primary.length);
      const factor = c.ratio / ex.ratio;
      const subInc = c.equipment === "dumbbell" ? (inc >= 5 ? 5 : 2) : inc;
      return { ex: c, weight: Math.max(0, roundTo(target * factor, subInc)), equivFactor: ex.ratio / c.ratio, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || (a.ex.equipment === ex.equipment ? 1 : -1))
    .slice(0, 4);
}

export const restDefault = (ex: Exercise, d: { compound: number; isolation: number }) => (isCompound(ex) ? d.compound : d.isolation);

/* =========================== aggregate analytics =========================== */
export function readinessSeries(state: AppState, today: string, days = 56): { date: string; score: number | null }[] {
  const out: { date: string; score: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const ci = state.checkins.find((c) => c.date === d);
    const r = computeReadiness(ci, hrvBaseline(state.checkins, d), dayMuscles(dayForDate(state.program, d)));
    out.push({ date: d, score: r.score });
  }
  return out;
}

export function avgReadiness(state: AppState, today: string, days: number) {
  const s = readinessSeries(state, today, days).map((x) => x.score).filter((x): x is number => x != null);
  return s.length ? mean(s) : null;
}

export function bodyWeightSeries(state: AppState) {
  return state.checkins.filter((c) => c.bodyWeight != null).map((c) => ({ date: c.date, w: c.bodyWeight as number })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function weightSlopePerWeek(state: AppState, today: string) {
  const w = bodyWeightSeries(state).filter((x) => daysBetween(x.date, today) <= 14);
  if (w.length < 4) return 0;
  return linreg(w.map((x) => ({ x: daysBetween(today, x.date), y: x.w }))).slope * 7;
}

export function plateauFlags(state: AppState, today: string): PlateauFlag[] {
  const ar = avgReadiness(state, today, 7);
  const sets = weeklySets(state.sessions, addDays(today, -6), today);
  const ws = weightSlopePerWeek(state, today);
  const flags: PlateauFlag[] = [];
  const active = new Set(state.program?.days.flatMap((d) => d.exercises.map((e) => e.exId)) ?? []);
  for (const id of performedExerciseIds(state.sessions)) {
    if (!active.has(id) || !isCompound(EX[id])) continue; // isolation e1RMs are too noisy at small loads
    const ser = e1rmSeries(state.sessions, id);
    if (!isPlateau(ser)) continue;
    const prim = EX[id].primary[0];
    const proteinHit = _proteinTarget ? proteinHitRate(state, _proteinTarget, today, 14) : undefined;
    flags.push({ exId: id, ...plateauFix({ avgReadiness7: ar, weeklySetsPrimary: sets[prim], weightSlopePerWeek: ws, proteinHit }) });
  }
  return flags;
}

export function deloadCheck(state: AppState, today: string) {
  const series = readinessSeries(state, today, 5).map((x) => x.score).filter((x): x is number => x != null);
  const avg5 = series.length >= 5 ? mean(series) : null;
  const plateaus = plateauFlags(state, today).length;
  const reasons: string[] = [];
  if (avg5 != null && avg5 < 55) reasons.push(`readiness averaged ${Math.round(avg5)} over 5 days`);
  if (plateaus >= 3) reasons.push(`${plateaus} lifts in plateau`);
  return { recommend: reasons.length > 0, reasons, avg5, plateaus };
}

export function proteinHitRate(state: AppState, target: number, today: string, days = 14) {
  const p = proteinByDate(state.meals);
  let hit = 0, n = 0;
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, -i);
    if (p[d] == null) continue;
    n++;
    if (p[d] >= target * 0.95) hit++;
  }
  return n ? hit / n : 0;
}
export function avgSleep(state: AppState, today: string, days = 14) {
  const v = state.checkins.filter((c) => c.sleepH != null && daysBetween(c.date, today) < days && daysBetween(c.date, today) >= 0).map((c) => c.sleepH as number);
  return v.length ? mean(v) : 0;
}

/** session performance: mean ratio of session e1RM to prior best per exercise */
export function sessionPerformance(sessions: Session[], s: Session): number | null {
  const ratios: number[] = [];
  for (const log of s.exercises) {
    if (!log.sets.length || !isCompound(EX[log.originalExId])) continue;
    const prior = sessions.filter((x) => x.end && x.start < s.start && daysBetween(x.date, s.date) <= 28)
      .flatMap((x) => x.exercises.filter((e) => e.originalExId === log.originalExId && e.sets.length).map(logBestE1rm));
    if (!prior.length) continue;
    ratios.push(logBestE1rm(log) / Math.max(...prior));
  }
  return ratios.length ? mean(ratios) : null;
}

/* =========================== weekly lab report =========================== */
export interface WeeklyReport {
  from: string; to: string;
  planned: number; completed: number; volume: number;
  avgReadiness: number | null; avgSleep: number | null;
  proteinDays: number; calorieDays: number; loggedDays: number;
  prs: { exId: string; e1rm: number; weight: number; reps: number; date: string }[];
  liftChanges: { exId: string; from: number; to: number }[];
  insights: { text: string; tone: "good" | "warn" | "info" }[];
  focus: string;
  sets: Record<Muscle, number>;
}

export function weeklyReport(state: AppState, from: string, targets: NutritionTargets): WeeklyReport {
  const to = addDays(from, 6);
  const today = dateKey();
  const end = to < today ? to : today;
  const inWeek = state.sessions.filter((s) => s.end && s.date >= from && s.date <= to);
  let planned = 0;
  for (let i = 0; i <= daysBetween(from, end); i++) if (dayForDate(state.program, addDays(from, i))) planned++;
  const rs = readinessSeries(state, end, daysBetween(from, end) + 1).map((x) => x.score).filter((x): x is number => x != null);
  const sleeps = state.checkins.filter((c) => c.date >= from && c.date <= to && c.sleepH != null).map((c) => c.sleepH as number);
  const prot = proteinByDate(state.meals), cals = caloriesByDate(state.meals);
  let proteinDays = 0, calorieDays = 0, loggedDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (prot[d] == null) continue;
    loggedDays++;
    if (prot[d] >= targets.protein * 0.95) proteinDays++;
    const tgt = dayForDate(state.program, d) ? targets.trainingCal : targets.restCal;
    if (Math.abs(cals[d] - tgt) <= tgt * 0.1) calorieDays++;
  }
  const prs = inWeek.flatMap((s) => sessionPRs(state.sessions, s).map((p) => ({ ...p, date: s.date })));
  const liftChanges: WeeklyReport["liftChanges"] = [];
  for (const id of MAIN_LIFTS) {
    const ser = e1rmSeries(state.sessions, id);
    const before = ser.filter((x) => x.date < from);
    const during = ser.filter((x) => x.date >= from && x.date <= to);
    if (!during.length) continue;
    const fromV = before.length ? Math.max(...before.slice(-2).map((x) => x.e1rm)) : during[0].e1rm;
    liftChanges.push({ exId: id, from: fromV, to: Math.max(...during.map((x) => x.e1rm)) });
  }
  const sets = weeklySets(state.sessions, from, to);
  const insights: WeeklyReport["insights"] = [];
  const flags = plateauFlags(state, end);
  const proteinMiss = loggedDays - proteinDays;
  const pressing = flags.find((f) => ["horizontal_push", "vertical_push"].includes(EX[f.exId].pattern));
  if (proteinMiss >= 3) {
    insights.push({ tone: "warn", text: pressing ? `Protein under target ${proteinMiss} of ${loggedDays} days — matches your stalled ${EX[pressing.exId].name.toLowerCase()}.` : `Protein under target ${proteinMiss} of ${loggedDays} days — recovery between sessions is likely slower.` });
  } else if (loggedDays >= 5 && proteinMiss <= 1) {
    insights.push({ tone: "good", text: `Protein hit ${proteinDays} of ${loggedDays} days — muscle repair isn't the bottleneck.` });
  }
  // sleep vs performance over 4 weeks
  const ciBy = Object.fromEntries(state.checkins.map((c) => [c.date, c]));
  const recent = state.sessions.filter((s) => s.end && daysBetween(s.date, end) <= 28 && daysBetween(s.date, end) >= 0)
    .map((s) => ({ s, perf: sessionPerformance(state.sessions, s), sleep: ciBy[s.date]?.sleepH }))
    .filter((x) => x.perf != null && x.sleep != null) as { s: Session; perf: number; sleep: number }[];
  if (recent.length >= 6) {
    const sorted = [...recent].sort((a, b) => b.perf - a.perf);
    const top = sorted.slice(0, Math.ceil(sorted.length / 3));
    const rest = sorted.slice(Math.ceil(sorted.length / 3));
    const ts = mean(top.map((x) => x.sleep)), rsl = mean(rest.map((x) => x.sleep));
    if (ts - rsl >= 0.3) insights.push({ tone: "info", text: `Your best sessions followed ${r1(Math.min(...top.map((x) => x.sleep)) >= 7 ? Math.floor(ts * 2) / 2 : ts)}h+ sleep (avg ${r1(ts)}h vs ${r1(rsl)}h for the rest).` });
  }
  // pre-workout carbs
  const withCarbs: number[] = [], without: number[] = [];
  for (const x of recent) {
    const carbs = state.meals.filter((m) => m.date === x.s.date && m.time < x.s.start && x.s.start - m.time <= 3 * 3600000).reduce((a, m) => a + m.c, 0);
    (carbs >= 40 ? withCarbs : without).push(x.perf);
  }
  if (withCarbs.length >= 3 && without.length >= 3) {
    const diff = (mean(withCarbs) - mean(without)) * 100;
    if (Math.abs(diff) >= 0.8) insights.push({ tone: diff > 0 ? "info" : "warn", text: `Sessions with 40g+ carbs in the 3h before ran ${diff > 0 ? "+" : ""}${r1(diff)}% e1RM vs sessions without.` });
  }
  // volume
  const keyMuscles: Muscle[] = ["chest", "lats", "upper_back", "quads", "hamstrings", "shoulders", "glutes"];
  const low = keyMuscles.filter((m) => sets[m] < VOLUME_RANGE.min).sort((a, b) => sets[a] - sets[b]);
  if (low.length && inWeek.length) insights.push({ tone: "warn", text: `${MUSCLE_LABEL[low[0]]} volume ${r1(sets[low[0]])} sets/week — below the 10-set floor.` });
  const high = MUSCLES.filter((m) => sets[m] > VOLUME_RANGE.max);
  if (high.length) insights.push({ tone: "warn", text: `${MUSCLE_LABEL[high[0]]} at ${r1(sets[high[0]])} sets/week — above 20; extra sets likely add fatigue, not growth.` });
  // readiness vs last week
  const prevR = readinessSeries(state, addDays(from, -1), 7).map((x) => x.score).filter((x): x is number => x != null);
  if (rs.length >= 3 && prevR.length >= 3) {
    const d = mean(rs) - mean(prevR);
    if (Math.abs(d) >= 4) insights.push({ tone: d > 0 ? "good" : "warn", text: `Readiness ${d > 0 ? "up" : "down"} ${Math.round(Math.abs(d))} pts vs last week (${Math.round(mean(prevR))} → ${Math.round(mean(rs))}).` });
  }
  if (flags.length && insights.length < 5) insights.push({ tone: "warn", text: `Plateau risk: ${flags.map((f) => EX[f.exId].name).join(", ")} — e1RM flat 3 sessions.` });
  if (insights.length < 3 && prs.length) insights.push({ tone: "good", text: `${prs.length} PR${prs.length > 1 ? "s" : ""} this week — progression is working.` });
  if (insights.length < 3) insights.push({ tone: "info", text: `Log at least 5 check-ins and meals per week to unlock sharper insights.` });

  const dl = deloadCheck(state, end);
  const avgS = sleeps.length ? mean(sleeps) : null;
  let focus: string;
  if (dl.recommend) focus = `Deload: ${dl.reasons.join(" and ")}. Run 60% volume at the same weights.`;
  else if (flags.length) focus = `Break the ${EX[flags[0].exId].name.toLowerCase()} plateau: ${flags[0].fix}`;
  else if (proteinMiss >= 3) focus = `Hit ${targets.protein} g protein on at least 6 of 7 days.`;
  else if (avgS != null && avgS < 7) focus = `Get 7.5h+ sleep on 5 nights — your average was ${r1(avgS)}h.`;
  else if (low.length) focus = `Add 2–3 sets for ${MUSCLE_LABEL[low[0]].toLowerCase()} to reach 10+ per week.`;
  else focus = `Keep doing what's working — complete every planned session.`;
  return {
    from, to, planned, completed: inWeek.length, volume: inWeek.reduce((a, s) => a + sessionVolume(s), 0),
    avgReadiness: rs.length ? mean(rs) : null, avgSleep: avgS, proteinDays, calorieDays, loggedDays,
    prs, liftChanges, insights: insights.slice(0, 5), focus, sets,
  };
}

/* =========================== experiments =========================== */
export const EXPERIMENT_TEMPLATES = [
  { id: "creatine", name: "Creatine 5 g/day", question: "Took 5 g creatine today?" },
  { id: "morning", name: "Morning vs evening training", question: "Trained before noon today?" },
  { id: "protein", name: "Higher protein target", question: "Hit 2.2 g/kg protein today?" },
  { id: "caffeine", name: "Caffeine pre-workout", question: "Had 200 mg caffeine pre-workout?" },
  { id: "sleep", name: "Extra sleep (+45 min)", question: "In bed 45 min earlier last night?" },
  { id: "custom", name: "Custom variable", question: "Did the thing today?" },
];

export function experimentPhase(exp: Experiment, today: string) {
  const day = daysBetween(exp.startDate, today) + 1;
  const total = exp.baselineDays + exp.experimentDays;
  if (day <= exp.baselineDays) return { phase: "baseline" as const, day, of: exp.baselineDays, total };
  if (day <= total) return { phase: "experiment" as const, day: day - exp.baselineDays, of: exp.experimentDays, total };
  return { phase: "done" as const, day: exp.experimentDays, of: exp.experimentDays, total };
}

export function experimentReport(state: AppState, exp: Experiment, today: string) {
  const bStart = exp.startDate, bEnd = addDays(exp.startDate, exp.baselineDays - 1);
  const eStart = addDays(bEnd, 1);
  const eEndPlanned = addDays(eStart, exp.experimentDays - 1);
  const eEnd = eEndPlanned < today ? eEndPlanned : today;
  const window = (a: string, b: string) => {
    const rs = readinessSeries(state, b, daysBetween(a, b) + 1).map((x) => x.score).filter((x): x is number => x != null);
    const bw = bodyWeightSeries(state).filter((x) => x.date >= a && x.date <= b);
    const wSlope = bw.length >= 3 ? linreg(bw.map((x) => ({ x: daysBetween(a, x.date), y: x.w }))).slope * 7 : null;
    const rates: number[] = [];
    for (const id of MAIN_LIFTS) {
      const ser = e1rmSeries(state.sessions, id).filter((x) => x.date >= a && x.date <= b);
      if (ser.length < 2) continue;
      const lr = linreg(ser.map((x) => ({ x: daysBetween(a, x.date), y: x.e1rm })));
      rates.push((lr.slope * 7) / mean(ser.map((x) => x.e1rm)) * 100);
    }
    return { readiness: rs.length ? mean(rs) : null, n: rs.length, weightPerWeek: wSlope, e1rmRatePct: rates.length ? mean(rates) : null };
  };
  const base = window(bStart, bEnd);
  const expW = eStart <= eEnd ? window(eStart, eEnd) : { readiness: null, n: 0, weightPerWeek: null, e1rmRatePct: null };
  const expDays = eStart <= eEnd ? daysBetween(eStart, eEnd) + 1 : 0;
  const adhered = Object.entries(exp.log).filter(([d, v]) => v && d >= eStart && d <= eEnd).length;
  const adherence = expDays ? adhered / expDays : 0;
  let confidence = "Small sample — suggestive, not proof.";
  if (expDays < 14) confidence = "Too early — fewer than 14 experiment days. Treat as noise.";
  else if (adherence < 0.7) confidence = `Adherence ${Math.round(adherence * 100)}% — too inconsistent to attribute changes.`;
  return { base, exp: expW, expDays, adherence, adhered, confidence, eStart, eEnd: eEndPlanned };
}

/* =========================== social =========================== */
export function matchScore(me: { gym: string; schedule: number[]; split: string; dots: number; time?: string }, s: Spotter, sDots: number) {
  const gym = me.gym && s.gym.toLowerCase() === me.gym.toLowerCase() ? 35 : 0;
  const inter = me.schedule.filter((d) => s.schedule.includes(d)).length;
  const uni = new Set([...me.schedule, ...s.schedule]).size || 1;
  const sched = Math.round((inter / uni) * 25);
  const splitScore = me.split.toLowerCase().split(/[^a-z]/)[0] === s.split.toLowerCase().split(/[^a-z]/)[0] ? 15 : 6;
  const ratio = me.dots && sDots ? Math.min(me.dots, sDots) / Math.max(me.dots, sDots) : 0.5;
  const strength = Math.round(clamp((ratio - 0.6) / 0.4, 0, 1) * 15);
  const time = me.time && me.time === s.trainTime ? 10 : 4;
  return { total: gym + sched + splitScore + strength + time, gym, sched, split: splitScore, strength, time };
}

export function userStreak(state: AppState, today: string) {
  // consecutive planned days completed, counting back from yesterday (today counts if done)
  let streak = 0;
  const done = new Set(state.sessions.filter((s) => s.end).map((s) => s.date));
  for (let i = 0; i < 120; i++) {
    const d = addDays(today, -i);
    if (!dayForDate(state.program, d)) continue;
    if (done.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

/* =========================== coach chat (rule-based) =========================== */
export interface CoachCtx {
  state: AppState; today: string; targets: NutritionTargets;
  readiness: ReadinessResult; units: Units;
}

export function coachAnswer(q: string, ctx: CoachCtx): string {
  const { state, today, targets, readiness, units } = ctx;
  const ql = q.toLowerCase();
  const flags = plateauFlags(state, today);
  const ar7 = avgReadiness(state, today, 7);
  const sl = avgSleep(state, today, 14);
  const ph = proteinHitRate(state, targets.protein, today, 14);
  const sets = weeklySets(state.sessions, addDays(today, -6), today);
  const dl = deloadCheck(state, today);
  const mentioned = allExercises().find((e) => ql.includes(e.name.toLowerCase()) || ql.includes(e.id.replace(/_/g, " ")))
    ?? (ql.includes("bench") ? EX.bench_press : ql.includes("squat") ? EX.back_squat : ql.includes("deadlift") ? EX.deadlift : ql.includes("press") && (ql.includes("overhead") || ql.includes("ohp") || ql.includes("shoulder")) ? EX.ohp : ql.includes("row") ? EX.barbell_row : null);

  if (!state.sessions.length && !state.checkins.length) return "I don't have any of your data yet. Log a check-in and a workout (or load demo data from Profile) and I'll answer from your numbers.";

  if (mentioned && /(stall|plateau|stuck|why|not moving|progress|improv)/.test(ql)) {
    const ser = e1rmSeries(state.sessions, mentioned.id);
    if (ser.length < 2) return `I only have ${ser.length} session of ${mentioned.name}. Give it 3–4 sessions before reading trends.`;
    const flag = flags.find((f) => f.exId === mentioned.id);
    const last = ser.slice(-4).map((s) => `${fmtW(Math.round(s.e1rm))}`).join(" → ");
    const prim = mentioned.primary[0];
    const lines = [
      `${mentioned.name} e1RM, last 4 sessions: ${last} ${units}${ser.length > 3 ? ` (best before the last 3: ${Math.round(Math.max(...ser.slice(0, -3).map((s) => s.e1rm)))})` : ""}.`,
      flag ? `That's flagged as a plateau — no improvement across 3 sessions.` : `It isn't flagged as a plateau yet (needs 3 flat sessions).`,
      `What your data shows:`,
      `· Protein hit ${Math.round(ph * 100)}% of logged days (target ${targets.protein} g)${ph < 0.6 ? " — likely a limiter" : ""}.`,
      `· Sleep averaged ${r1(sl)}h over 14 days${sl < 7 ? " — below the 7h line where strength gains slow" : ""}.`,
      `· 7-day readiness ${ar7 != null ? Math.round(ar7) : "—"}${ar7 != null && ar7 < 65 ? " — you're carrying fatigue" : ""}.`,
      `· ${MUSCLE_LABEL[prim]} volume ${r1(sets[prim])} hard sets this week${sets[prim] < 10 ? " — under the 10-set floor" : ""}.`,
      flag ? `Recommended fix: ${flag.fix}` : `Keep running the progression; I'll flag it if it stalls.`,
    ];
    return lines.join("\n");
  }
  if (/deload/.test(ql)) {
    return dl.recommend ? `Yes — a deload is recommended: ${dl.reasons.join(" and ")}. Run one week at 60% of your sets with the same weights. You can start it from the Train tab.` : `No deload needed yet. 5-day readiness avg ${dl.avg5 != null ? Math.round(dl.avg5) : "—"} (trigger < 55) and ${dl.plateaus} lift${dl.plateaus === 1 ? "" : "s"} in plateau (trigger ≥ 3).`;
  }
  if (/(protein|eat|calorie|food|macro|nutrition|diet)/.test(ql)) {
    return `Your targets: ${targets.cal} kcal (${targets.trainingCal} on training days, ${targets.restCal} on rest days) and ${targets.protein} g protein (${targets.proteinPerKg} g/kg). Over 14 days you hit protein on ${Math.round(ph * 100)}% of logged days. ${ph < 0.7 ? "Closing that gap is the cheapest gain available — add one 40 g protein meal on days you're short." : "That's solid; keep it consistent."}`;
  }
  if (/(sleep|tired|hrv|recover)/.test(ql)) {
    const ins = weeklyReport(state, weekStart(today), targets).insights.find((i) => i.text.includes("sleep"));
    return `Sleep averaged ${r1(sl)}h over 14 days. ${ins ? ins.text + " " : ""}Sleep ≥ 7.5h also shortens muscle fatigue half-life from 48h to 36h in your model, so you recover between sessions faster. ${readiness.hrvDelta != null ? `Today's HRV is ${readiness.hrvDelta >= 0 ? "+" : ""}${Math.round(readiness.hrvDelta * 100)}% vs your 7-day baseline.` : ""}`;
  }
  if (/(readiness|today|should i|train today|ready)/.test(ql)) {
    if (readiness.score == null) return "No check-in today yet, so I can't score readiness. It takes under 20 seconds on the Today tab.";
    const worst = [...readiness.parts].filter((p) => p.present).sort((a, b) => a.pts / a.max - b.pts / b.max)[0];
    return `Readiness ${readiness.score} (${readiness.confidence} confidence, ${readiness.inputs} inputs). ${readiness.reason}. Biggest drag: ${worst.label.toLowerCase()} (${Math.round(worst.pts)}/${Math.round(worst.max)} pts).`;
  }
  if (/(fat|weight|bulk|cut|lean|muscle|body comp|recomp)/.test(ql)) {
    const bc = bodyComp(bodyWeightSeries(state), strengthTrendPct(state.sessions, today), today);
    if (!bc) return "I need ~5 body-weight entries in 14 days plus a few sessions to estimate body composition.";
    return `${bc.label}. Body weight is moving ${bc.weightRatePct >= 0 ? "+" : ""}${r1(bc.weightRatePct)}%/week while strength moved ${bc.strengthPct >= 0 ? "+" : ""}${r1(bc.strengthPct)}% over 14 days. ${bc.advice} (Estimate from trends, not a body scan.)`;
  }
  if (/(experiment|creatine|caffeine)/.test(ql)) {
    const exp = state.experiments.find((e) => e.status === "active");
    if (!exp) return "No experiment running. Start one from Progress → More → Experiments.";
    const ph2 = experimentPhase(exp, today);
    const rep = experimentReport(state, exp, today);
    return `${exp.name}: ${ph2.phase === "baseline" ? `baseline day ${ph2.day}/${ph2.of}` : `experiment day ${ph2.day}/${ph2.of}`}. So far readiness ${rep.base.readiness != null ? Math.round(rep.base.readiness) : "—"} baseline vs ${rep.exp.readiness != null ? Math.round(rep.exp.readiness) : "—"} during. ${rep.confidence}`;
  }
  if (/(project|when will|predict|goal|hit)/.test(ql)) {
    const id = mentioned?.id ?? "bench_press";
    const p = projection(e1rmSeries(state.sessions, id), today, units);
    if (!p) return `Not enough ${EX[id].name} data in the last 6 weeks to project.`;
    return p.by ? `At your current rate (+${r1(p.slopePerWeek)} ${units}/week), ${EX[id].name} e1RM reaches ${p.target} ${units} around ${fmtDate(p.by)}. That's a linear fit — rates usually slow as you get stronger.` : `${EX[id].name} isn't trending up right now, so there's no projected date. Fix the stall first.`;
  }
  const top = flags[0];
  return [
    `Here's where you stand:`,
    `· Readiness today: ${readiness.score ?? "—"}; 7-day avg ${ar7 != null ? Math.round(ar7) : "—"}.`,
    `· Sleep ${r1(sl)}h avg, protein hit ${Math.round(ph * 100)}% of days.`,
    top ? `· ${EX[top.exId].name} is in plateau — ${top.fix}` : `· No plateaus flagged.`,
    dl.recommend ? `· Deload recommended.` : `· No deload needed.`,
    `Try asking: "Why did my bench stall?", "Should I deload?", "Am I gaining fat?", or "When will I hit a 225 bench?"`,
  ].join("\n");
}
