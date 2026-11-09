import { useMemo } from "react";
import { useStore } from "./store";
import {
  computeReadiness, dateKey, dayForDate, dayMuscles, deloadCheck, hrvBaseline, logsForPe, muscleFatigue,
  phaseInfo, plateauFlags, prescribe, setProteinTarget, fatiguePct, sessionPRs, e1rmSeries, avgSleep, proteinHitRate,
  addDays, daysBetween, mean, r1, proteinByDate, fmtDate, fmtW, readinessEffect, roundTo, type Prescription,
} from "./engine";
import type { AppState, ExerciseLog, Muscle, ProgramDay, ProgramExercise, SavedWorkout, Session, Units } from "./types";
import { EX, isCompound, newId } from "./exercises";

export function useToday() {
  const { state, targets, profile } = useStore();
  setProteinTarget(targets.protein);
  const today = dateKey();
  return useMemo(() => {
    const day = dayForDate(state.program, today);
    const checkin = state.checkins.find((c) => c.date === today);
    const muscles = dayMuscles(day);
    const readiness = computeReadiness(checkin, hrvBaseline(state.checkins, today), muscles);
    const fatigueUnits = muscleFatigue(state.sessions, state.checkins, state.meals, targets.protein, Date.now());
    const fatigue = Object.fromEntries(Object.entries(fatigueUnits).map(([k, v]) => [k, fatiguePct(v)])) as Record<Muscle, number>;
    const flags = plateauFlags(state, today);
    const deload = deloadCheck(state, today);
    const inDeload = !!(state.program?.deloadUntil && today <= state.program.deloadUntil);
    const phase = phaseInfo(state.program, today, deload.recommend);
    // On a planned day only that day counts as done (a freestyle workout doesn't hide it); on rest days any workout does.
    const doneToday = state.sessions.find((s) => s.date === today && s.end && (!day || s.dayId === day.id));
    return { today, day, checkin, readiness, fatigue, flags, deload, inDeload, phase, doneToday, muscles };
  }, [state, targets.protein, today, profile]);
}

export function prescriptionsFor(state: AppState, day: ProgramDay, readiness: number | null, inDeload: boolean, units: Units) {
  return day.exercises.map((pe) => ({ pe, ex: EX[pe.exId], rx: prescribe(pe, logsForPe(state.sessions, pe.id), readiness, inDeload, units) }));
}

export function newSession(state: AppState, day: ProgramDay, readiness: number | null, inDeload: boolean, units: Units): Session {
  const rxs = prescriptionsFor(state, day, readiness, inDeload, units);
  return {
    id: newId("ses"), dayId: day.id, dayName: day.name, date: dateKey(), start: Date.now(), end: null, deload: inDeload,
    exercises: rxs.map(({ pe, rx }) => ({ peId: pe.id, exId: pe.exId, originalExId: pe.exId, equivFactor: 1, targetWeight: rx.weight, sets: [] })),
  };
}

/** True when the program day has changed since this session was built (exercises added, removed, or swapped). */
export function sessionStale(session: Session, day: ProgramDay | undefined): boolean {
  if (isFreeSession(session)) return false;
  if (!day) return true;
  session = { ...session, exercises: session.exercises.filter((l) => !l.extra) };
  const want = day.exercises.map((pe) => pe.id);
  const inDay = new Set(want);
  // Exercises removed from the program but already logged stay in the session on purpose; empty leftovers mean "stale".
  if (session.exercises.some((l) => !inDay.has(l.peId) && l.sets.length === 0)) return true;
  const have = session.exercises.filter((l) => inDay.has(l.peId)).map((l) => l.peId);
  if (want.length !== have.length) return true;
  return want.some((id, i) => id !== have[i]) || day.exercises.some((pe) => { const l = session.exercises.find((x) => x.peId === pe.id); return l && l.sets.length === 0 && l.originalExId !== pe.exId; });
}

/** Rebuild an in-progress session from the current program day. Logged sets are kept; removed exercises with sets stay at the end. */
export function syncSession(state: AppState, session: Session, day: ProgramDay, readiness: number | null, units: Units): Session {
  const rxs = prescriptionsFor(state, day, readiness, !!session.deload, units);
  const kept = new Set<string>();
  const exercises = rxs.map(({ pe, rx }) => {
    const old = session.exercises.find((l) => l.peId === pe.id);
    kept.add(pe.id);
    if (old && (old.sets.length > 0 || old.originalExId === pe.exId)) return old.sets.length > 0 ? old : { ...old, targetWeight: rx.weight };
    return { peId: pe.id, exId: pe.exId, originalExId: pe.exId, equivFactor: 1, targetWeight: rx.weight, sets: [] };
  });
  // Removed-from-program exercises with sets stay; so do exercises added during this workout.
  const orphans = session.exercises.filter((l) => !kept.has(l.peId) && (l.sets.length > 0 || l.extra));
  return { ...session, dayName: day.name, exercises: [...exercises, ...orphans] };
}

/** a data-driven "why" line for PR cards */
export function prWhyStat(state: AppState, date: string, proteinTarget: number): string {
  const sleep7 = avgSleep(state, date, 7);
  const sleepPrior = (() => {
    const v = state.checkins.filter((c) => c.sleepH != null && daysBetween(c.date, date) >= 7 && daysBetween(c.date, date) < 35).map((c) => c.sleepH as number);
    return v.length ? mean(v) : 0;
  })();
  if (sleep7 && sleepPrior && sleep7 >= sleepPrior + 0.2) return `PR after best sleep week: avg ${r1(sleep7)}h`;
  const p = proteinByDate(state.meals);
  let hit = 0;
  for (let i = 0; i < 7; i++) if ((p[addDays(date, -i)] ?? 0) >= proteinTarget * 0.95) hit++;
  if (hit >= 6) return `Protein on target ${hit} of 7 days`;
  const ph = proteinHitRate(state, proteinTarget, date, 14);
  if (sleep7 >= 7.5) return `Sleep avg ${r1(sleep7)}h this week`;
  if (ph >= 0.7) return `Protein hit ${Math.round(ph * 100)}% of days`;
  const sessions = state.sessions.filter((s) => s.end && daysBetween(s.date, date) <= 28).length;
  return `${sessions} sessions in 4 weeks`;
}

export function sessionSummary(state: AppState, s: Session) {
  const volume = s.exercises.reduce((a, l) => a + l.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);
  const sets: Partial<Record<Muscle, number>> = {};
  s.exercises.forEach((l) => EX[l.exId]?.primary.forEach((m) => (sets[m] = (sets[m] ?? 0) + l.sets.length)));
  const prs = sessionPRs([...state.sessions.filter((x) => x.id !== s.id), s], s);
  const dur = Math.round(((s.end ?? Date.now()) - s.start) / 60000);
  const totalSets = s.exercises.reduce((a, l) => a + l.sets.length, 0);
  return { volume, sets, prs, dur, totalSets };
}

export { e1rmSeries };

/* ---------- freestyle & saved workouts ---------- */

/** dayId for a workout started empty. Saved workouts use `saved:<id>`. Neither is a program day. */
export const FREE_DAY = "free";
export const isFreeSession = (s: Pick<Session, "dayId">) => s.dayId === FREE_DAY || s.dayId.startsWith("saved:");

/** Heaviest-by-e1RM set of the most recent finished session that did this exercise. */
export function lastTopSet(sessions: Session[], exId: string): { weight: number; reps: number; date: string } | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (!s.end) continue;
    const sets = s.exercises.filter((l) => l.exId === exId).flatMap((l) => l.sets);
    if (!sets.length) continue;
    const top = sets.reduce((a, b) => (e1rmOf(b) > e1rmOf(a) ? b : a), sets[0]);
    return { weight: top.weight, reps: top.reps, date: s.date };
  }
  return null;
}
const e1rmOf = (x: { weight: number; reps: number }) => x.weight * (1 + x.reps / 30);

const defaultPlan = (exId: string) => (isCompound(EX[exId]) ? { sets: 3, repMin: 6, repMax: 10 } : { sets: 3, repMin: 10, repMax: 15 });

/** Targets for an exercise outside the program: last time's top set, adjusted for today's readiness. New exercises start blank. */
export function freeRx(sessions: Session[], log: ExerciseLog, readiness: number | null, units: Units): { pe: ProgramExercise; rx: Prescription } {
  const plan = log.plan ?? defaultPlan(log.originalExId);
  const inc = units === "lb" ? 5 : 2.5;
  const pe: ProgramExercise = { id: log.peId, exId: log.originalExId, sets: plan.sets, repMin: plan.repMin, repMax: plan.repMax, startWeight: log.targetWeight, increment: inc, style: "double", technique: null };
  const last = lastTopSet(sessions, log.exId);
  const effect = readinessEffect(readiness);
  const rir = isCompound(EX[log.exId]) ? 2 : 1;
  let weight = log.targetWeight;
  let why = last ? `Last time: ${fmtW(last.weight)} × ${last.reps} (${fmtDate(last.date, { month: "short", day: "numeric" })})` : "First time: pick a weight you could do for a few more reps.";
  if (last && effect === "hold") why += ` · readiness ${Math.round(readiness!)}: same weight`;
  if (last && effect === "reduce") why += ` · readiness ${Math.round(readiness!)}: −10% today`;
  if (!last) weight = 0;
  return { pe, rx: { weight, sets: plan.sets, repMin: plan.repMin, repMax: plan.repMax, repGoal: last ? last.reps : plan.repMin, rir, why, decision: last ? "add_rep" : "start", effect, deload: false } };
}

/** A log for an exercise outside the program, pre-filled from history (−10% when readiness says reduce). */
export function freeLog(sessions: Session[], exId: string, readiness: number | null, units: Units, opts: { extra?: boolean; plan?: ExerciseLog["plan"] } = {}): ExerciseLog {
  const last = lastTopSet(sessions, exId);
  const inc = units === "lb" ? 5 : 2.5;
  let w = last?.weight ?? 0;
  if (last && readinessEffect(readiness) === "reduce") w = Math.max(0, roundTo(w * 0.9, inc));
  return { peId: newId("pe"), exId, originalExId: exId, equivFactor: 1, targetWeight: w, sets: [], extra: opts.extra, plan: opts.plan ?? defaultPlan(exId) };
}

/** Start a workout that isn't a program day: empty ("Freestyle") or from a saved workout. */
export function newFreeSession(name = "Freestyle", dayId = FREE_DAY, exercises: ExerciseLog[] = []): Session {
  return { id: newId("ses"), dayId, dayName: name, date: dateKey(), start: Date.now(), end: null, exercises };
}

/** Start a saved workout. Exercises that are also in the program use the program's progression; the rest use last time's weight. */
export function sessionFromSaved(state: AppState, w: SavedWorkout, readiness: number | null, inDeload: boolean, units: Units): Session {
  const programPe = (exId: string) => state.program?.days.flatMap((d) => d.exercises).find((pe) => pe.exId === exId);
  const exercises = w.exercises.map((sp) => {
    const plan = { sets: sp.sets, repMin: sp.repMin, repMax: sp.repMax };
    const log = freeLog(state.sessions, sp.exId, readiness, units, { plan });
    const pe = programPe(sp.exId);
    if (pe) log.targetWeight = prescribe(pe, logsForPe(state.sessions, pe.id), readiness, inDeload, units).weight;
    else if (!log.targetWeight && sp.startWeight) log.targetWeight = sp.startWeight;
    return log;
  });
  return newFreeSession(w.name, `saved:${w.id}`, exercises);
}

/** Turn a finished workout into a saved one: same exercises, sets as logged, rep range from the reps you did. */
export function savedFromSession(s: Session, name: string, units: Units): SavedWorkout {
  return {
    id: newId("sw"), name,
    exercises: s.exercises.filter((l) => l.sets.length).map((l) => {
      const reps = l.sets.map((x) => x.reps);
      return { id: newId("pe"), exId: l.exId, sets: l.sets.length, repMin: Math.max(1, Math.min(...reps)), repMax: Math.max(...reps), startWeight: Math.max(...l.sets.map((x) => x.weight)), increment: units === "lb" ? 5 : 2.5, style: "double" as const, technique: null };
    }),
  };
}
