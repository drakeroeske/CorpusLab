import { useMemo } from "react";
import { useStore } from "./store";
import {
  computeReadiness, dateKey, dayForDate, dayMuscles, deloadCheck, hrvBaseline, logsForPe, muscleFatigue,
  phaseInfo, plateauFlags, prescribe, setProteinTarget, fatiguePct, sessionPRs, e1rmSeries, avgSleep, proteinHitRate,
  addDays, daysBetween, mean, r1, proteinByDate,
} from "./engine";
import type { AppState, Muscle, ProgramDay, Session, Units } from "./types";
import { EX, newId } from "./exercises";

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
    const doneToday = state.sessions.find((s) => s.date === today && s.end);
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
  if (!day) return true;
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
  const orphans = session.exercises.filter((l) => !kept.has(l.peId) && l.sets.length > 0);
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
