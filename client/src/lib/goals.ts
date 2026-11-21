// Personal goals: how far along each one is, when it will likely land, and whether that beats the deadline.
import type { ActivityType, AppState, PersonalGoal, HabitMetric, Session, Units } from "./types";
import type { WeightPlan } from "./engine";
import { EX } from "./exercises";
import { ACTIVITY, fmtDistance, fmtDuration, predictedTimes } from "./activities";
import { addDays, toKg, daysBetween, e1rm, fmtDate, fmtW, linreg, proteinByDate, r1, weekStart } from "./engine";

export type GoalStatus = "achieved" | "on_track" | "behind" | "in_progress" | "no_data";

export interface GoalProgress {
  /** 0–1 */
  pct: number;
  achieved: boolean;
  /** Short "where you are" and "where you're going" values, already formatted. */
  current: string;
  target: string;
  status: GoalStatus;
  /** One line under the bar: ETA, pace needed, or what to do next. */
  note: string;
  /** Projected finish date (YYYY-MM-DD), when there's a trend to go on. */
  eta?: string | null;
  /** Habit goals: last 8 weeks, oldest first (true = target hit). */
  weeksHit?: boolean[];
}

export interface GoalCtx {
  state: AppState;
  today: string;
  units: Units;
  proteinTarget: number;
}

export const HABIT_LABEL: Record<HabitMetric, { noun: string; unit: string; help: string }> = {
  workouts: { noun: "Workouts", unit: "workouts", help: "Finished lifting workouts plus runs, rides, classes and WODs" },
  protein: { noun: "Protein days", unit: "days hitting protein", help: "Days your logged protein reaches 95% of your target" },
  sleep: { noun: "Sleep", unit: "nights", help: "Nights your check-in sleep reaches the hours you set" },
  checkins: { noun: "Check-ins", unit: "check-ins", help: "Days you complete the morning check-in" },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* ---------------- inputs ---------------- */

/** Latest weigh-in from check-ins, falling back to the profile weight. */
export function currentBodyweight(state: AppState): number | null {
  const ws = state.checkins.filter((c) => c.bodyWeight != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  return ws.length ? (ws[ws.length - 1].bodyWeight as number) : state.profile?.bodyWeight ?? null;
}

/** Best estimated 1RM per session for an exercise (only sets done on that exact exercise, not swaps). */
function liftSeries(sessions: Session[], exId: string) {
  const out: { date: string; e1rm: number }[] = [];
  for (const s of sessions) {
    if (!s.end) continue;
    let best = 0;
    for (const l of s.exercises) if (l.exId === exId) for (const st of l.sets) best = Math.max(best, e1rm(st.weight, st.reps));
    if (best > 0) out.push({ date: s.date, e1rm: best });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Best estimated 1RM in the last 8 weeks: the starting point for a new lift goal. */
export function recentBestE1rm(sessions: Session[], exId: string, today: string): number {
  const ser = liftSeries(sessions, exId).filter((x) => daysBetween(x.date, today) <= 56);
  return ser.length ? Math.max(...ser.map((x) => x.e1rm)) : 0;
}

/** Heaviest set that meets the rep target, since a given date (default: ever). */
export function bestSetAtReps(sessions: Session[], exId: string, reps: number, since = "0000-00-00") {
  let best: { weight: number; reps: number; date: string } | null = null;
  for (const s of sessions) {
    if (!s.end || s.date < since) continue;
    for (const l of s.exercises) if (l.exId === exId) for (const st of l.sets) {
      if (st.reps >= reps && (!best || st.weight > best.weight)) best = { weight: st.weight, reps: st.reps, date: s.date };
    }
  }
  return best;
}

/** How many times a habit happened in each Mon–Sun week. */
function habitCounts(g: Extract<PersonalGoal, { kind: "habit" }>, ctx: GoalCtx): Record<string, number> {
  const { state } = ctx;
  const out: Record<string, number> = {};
  const add = (date: string) => { const w = weekStart(date); out[w] = (out[w] ?? 0) + 1; };
  if (g.metric === "workouts") {
    for (const s of state.sessions) if (s.end && s.exercises.some((e) => e.sets.length)) add(s.date);
    for (const a of state.activities ?? []) add(a.date);
  } else if (g.metric === "protein") {
    for (const [d, p] of Object.entries(proteinByDate(state.meals))) if (ctx.proteinTarget && p >= ctx.proteinTarget * 0.95) add(d);
  } else if (g.metric === "sleep") {
    const h = g.sleepHours ?? 7;
    for (const c of state.checkins) if (c.sleepH != null && c.sleepH >= h) add(c.date);
  } else {
    for (const c of state.checkins) add(c.date);
  }
  return out;
}

/** Weekly totals → this week, streak of weeks met since the goal began, last 8 weeks. */
function weekStreak(totals: Record<string, number>, target: number, createdAt: string, today: string) {
  const thisWeek = weekStart(today);
  const weeksHit: boolean[] = [];
  for (let i = 7; i >= 0; i--) {
    const w = addDays(thisWeek, -7 * i);
    weeksHit.push((totals[w] ?? 0) >= target && w >= weekStart(createdAt));
  }
  const nowMet = (totals[thisWeek] ?? 0) >= target;
  let streak = 0;
  for (let w = nowMet ? thisWeek : addDays(thisWeek, -7); w >= weekStart(createdAt); w = addDays(w, -7)) {
    if ((totals[w] ?? 0) >= target) streak++; else break;
  }
  return { thisWeek, now: totals[thisWeek] ?? 0, nowMet, streak, weeksHit };
}

/** Standard race names for running distances (1 mile, 5K, 10K, half, marathon). */
export const RACES: { km: number; name: string }[] = [
  { km: 1.609344, name: "1 mile" }, { km: 5, name: "5K" }, { km: 10, name: "10K" }, { km: 21.0975, name: "half marathon" }, { km: 42.195, name: "marathon" },
];
export function raceName(type: ActivityType, km: number): string | null {
  if (type !== "run" && type !== "walk") return null;
  return RACES.find((r) => Math.abs(r.km - km) / r.km < 0.005)?.name ?? null;
}

/* ---------------- titles ---------------- */

export function goalTitle(g: PersonalGoal, units: Units): string {
  if (g.title?.trim()) return g.title.trim();
  if (g.kind === "bodyweight") return `${g.target < g.start ? "Get down to" : g.target > g.start ? "Get up to" : "Hold"} ${fmtW(g.target)} ${units}`;
  if (g.kind === "lift") return `${EX[g.exId].name}: ${fmtW(g.weight)} ${units} × ${g.reps}`;
  if (g.kind === "cardio") {
    const A = ACTIVITY[g.activity].label;
    const d = raceName(g.activity, g.distanceKm) ?? fmtDistance(g.distanceKm, g.activity, units);
    if (g.metric === "time") return `${A} ${d} under ${fmtDuration(g.timeSec ?? 0)}`;
    if (g.metric === "weekly") return `${A} ${d} a week${g.weeks ? ` for ${plural(g.weeks, "week")}` : ""}`;
    return `${A} ${d} in one go`;
  }
  const L = HABIT_LABEL[g.metric];
  const what = g.metric === "sleep" ? `${g.sleepHours ?? 7}h+ sleep` : L.noun.toLowerCase();
  return `${what[0].toUpperCase()}${what.slice(1)}: ${g.perWeek}×/week${g.weeks ? ` for ${plural(g.weeks, "week")}` : ""}`;
}

/* ---------------- progress ---------------- */

/** Date a straight-line trend reaches `target`, or null if it's heading the wrong way / too far out. */
function etaFromTrend(points: { date: string; y: number }[], target: number, current: number, today: string): string | null {
  if (points.length < 3) return null;
  const lr = linreg(points.map((p) => ({ x: daysBetween(today, p.date), y: p.y })));
  const need = target - current;
  if (Math.abs(need) < 1e-9) return today;
  if (lr.slope === 0 || Math.sign(lr.slope) !== Math.sign(need)) return null;
  const days = Math.ceil(need / lr.slope);
  return days > 0 && days <= 730 ? addDays(today, days) : null;
}

function deadlineStatus(eta: string | null, deadline: string | null | undefined, today: string): { status: GoalStatus; text: string } {
  if (!deadline) return { status: eta ? "on_track" : "in_progress", text: eta ? `At this rate: ${fmtDate(eta)}` : "" };
  const left = daysBetween(today, deadline);
  if (left < 0) return { status: "behind", text: `Deadline passed ${fmtDate(deadline)}` };
  if (!eta) return { status: "behind", text: `${plural(left, "day")} left · no trend toward it yet` };
  return eta <= deadline
    ? { status: "on_track", text: `On track: ${fmtDate(eta)}, ${plural(daysBetween(eta, deadline), "day")} before your deadline` }
    : { status: "behind", text: `At this rate: ${fmtDate(eta)}, ${plural(daysBetween(deadline, eta), "day")} after your deadline` };
}

export function goalProgress(g: PersonalGoal, ctx: GoalCtx): GoalProgress {
  const { state, today, units } = ctx;
  const done = (current: string, target: string, note: string, extra: Partial<GoalProgress> = {}): GoalProgress =>
    ({ pct: 1, achieved: true, current, target, status: "achieved", note, ...extra });

  if (g.kind === "bodyweight") {
    const cur = currentBodyweight(state);
    const target = `${fmtW(g.target)} ${units}`;
    if (cur == null) return { pct: 0, achieved: false, current: "—", target, status: "no_data", note: "Log your weight in a check-in to track this." };
    const curS = `${fmtW(cur)} ${units}`;
    const losing = g.target < g.start;
    const reached = losing ? cur <= g.target : g.target > g.start ? cur >= g.target : Math.abs(cur - g.target) <= Math.max(1, g.target * 0.01);
    if (reached || g.achievedAt) return done(curS, target, g.achievedAt ? `Reached ${fmtDate(g.achievedAt)}` : "Goal reached");
    const span = g.target - g.start;
    const pct = span === 0 ? 0 : clamp01((cur - g.start) / span);
    const pts = state.checkins.filter((c) => c.bodyWeight != null && daysBetween(c.date, today) <= 21 && daysBetween(c.date, today) >= 0)
      .map((c) => ({ date: c.date, y: c.bodyWeight as number }));
    const eta = etaFromTrend(pts, g.target, cur, today);
    const ds = deadlineStatus(eta, g.deadline, today);
    const toGo = `${fmtW(r1(Math.abs(g.target - cur)))} ${units} to go`;
    let note = [toGo, ds.text].filter(Boolean).join(" · ");
    if (g.deadline && daysBetween(today, g.deadline) > 0) {
      const perWeek = Math.abs(g.target - cur) / (daysBetween(today, g.deadline) / 7);
      // Faster than ~1%/week down or ~0.5%/week up is hard to do without losing muscle or adding mostly fat.
      const cap = losing ? cur * 0.01 : cur * 0.005;
      if (perWeek > cap) note += ` · needs ${fmtW(r1(perWeek))} ${units}/week, faster than recommended`;
    }
    return { pct, achieved: false, current: curS, target, status: pts.length < 3 && !g.deadline ? "in_progress" : ds.status, note, eta };
  }

  if (g.kind === "lift") {
    const target = `${fmtW(g.weight)} × ${g.reps}`;
    const best = bestSetAtReps(state.sessions, g.exId, g.reps, g.createdAt);
    if ((best && best.weight >= g.weight) || g.achievedAt) {
      return done(best ? `${fmtW(best.weight)} × ${best.reps}` : target, target, g.achievedAt ? `Hit ${fmtDate(g.achievedAt)}` : best ? `Hit ${fmtDate(best.date)}` : "Goal reached");
    }
    const ser = liftSeries(state.sessions, g.exId);
    const goalE1 = e1rm(g.weight, g.reps);
    const recent = ser.filter((x) => daysBetween(x.date, today) <= 42);
    const curE1 = recent.length ? Math.max(...recent.slice(-3).map((x) => x.e1rm)) : 0;
    const current = best ? `${fmtW(best.weight)} × ${best.reps}` : curE1 ? `Est. max ${fmtW(Math.round(curE1))} ${units}` : "—";
    if (!ser.length) return { pct: 0, achieved: false, current, target, status: "no_data", note: `Log ${EX[g.exId].name} to start tracking this.` };
    const span = goalE1 - g.startE1rm;
    const pct = span <= 0 ? (curE1 >= goalE1 ? 0.99 : 0) : clamp01((curE1 - g.startE1rm) / span);
    if (curE1 >= goalE1) {
      return { pct: Math.max(pct, 0.95), achieved: false, current, target, status: "on_track", note: `Your estimated max (${fmtW(Math.round(curE1))} ${units}) says you're ready. Test ${target} next session.`, eta: today };
    }
    const eta = etaFromTrend(recent.map((x) => ({ date: x.date, y: x.e1rm })), goalE1, curE1, today);
    const ds = deadlineStatus(eta, g.deadline, today);
    const gap = `${fmtW(Math.round(goalE1 - curE1))} ${units} of estimated max to go`;
    return { pct, achieved: false, current, target, status: recent.length < 3 && !g.deadline ? "in_progress" : ds.status, note: [gap, ds.text].filter(Boolean).join(" · "), eta };
  }

  if (g.kind === "cardio") {
    const acts = (state.activities ?? []).filter((a) => a.type === g.activity);
    const since = acts.filter((a) => a.date >= g.createdAt);
    const dist = (km: number) => fmtDistance(km, g.activity, units);
    if (g.metric === "time") {
      const T = g.timeSec ?? 0;
      const target = fmtDuration(T);
      // Done: a logged effort at least this long, at a pace that covers the distance in time.
      const hit = since.find((a) => a.distanceKm && a.distanceKm >= g.distanceKm * 0.99 && a.durationSec * (g.distanceKm / a.distanceKm) <= T);
      if (hit || g.achievedAt) return done(hit ? fmtDuration(hit.durationSec * (g.distanceKm / hit.distanceKm!)) : target, target, g.achievedAt ? `Done ${fmtDate(g.achievedAt)}` : `Done ${fmtDate(hit!.date)}`);
      const preds = predictedTimes(acts, g.activity, g.distanceKm);
      const recent = preds.filter((p) => daysBetween(p.date, today) <= 42);
      if (!recent.length) return { pct: 0, achieved: false, current: "—", target, status: "no_data", note: `Log a ${ACTIVITY[g.activity].label.toLowerCase()} of at least ${dist(g.distanceKm * 0.5)} to get a predicted time.` };
      const cur = Math.min(...recent.slice(-3).map((p) => p.sec));
      const start = g.startSec ?? preds[0].sec;
      const pct = start <= T ? (cur <= T ? 0.99 : 0) : clamp01((start - cur) / (start - T));
      const current = `Predicted ${fmtDuration(cur)}`;
      if (cur <= T) return { pct: Math.max(pct, 0.95), achieved: false, current, target, status: "on_track", note: `Your recent efforts predict ${fmtDuration(cur)}. Race it to make it count.`, eta: today };
      const eta = etaFromTrend(recent.map((p) => ({ date: p.date, y: p.sec })), T, cur, today);
      const ds = deadlineStatus(eta, g.deadline, today);
      return { pct, achieved: false, current, target, status: recent.length < 3 && !g.deadline ? "in_progress" : ds.status, note: [`${fmtDuration(cur - T)} to cut`, ds.text].filter(Boolean).join(" · "), eta };
    }
    if (g.metric === "longest") {
      const target = dist(g.distanceKm);
      const best = since.reduce((m, a) => Math.max(m, a.distanceKm ?? 0), 0);
      if (best >= g.distanceKm * 0.99 || g.achievedAt) return done(dist(Math.max(best, g.distanceKm)), target, g.achievedAt ? `Done ${fmtDate(g.achievedAt)}` : "Goal reached");
      const allBest = acts.reduce((m, a) => Math.max(m, a.distanceKm ?? 0), 0);
      const ds = deadlineStatus(null, g.deadline, today);
      return {
        pct: clamp01(best / g.distanceKm), achieved: false, current: best ? `Longest ${dist(best)}` : "—", target,
        status: best ? (g.deadline ? ds.status : "in_progress") : "no_data",
        note: best ? [`${dist(g.distanceKm - best)} to go`, g.deadline ? ds.text : ""].filter(Boolean).join(" · ") : allBest ? `Longest before this goal: ${dist(allBest)}` : `Log a ${ACTIVITY[g.activity].label.toLowerCase()} to start.`,
      };
    }
    // weekly distance
    const totals: Record<string, number> = {};
    for (const a of acts) totals[weekStart(a.date)] = (totals[weekStart(a.date)] ?? 0) + (a.distanceKm ?? 0);
    const w = weekStreak(totals, g.distanceKm * 0.995, g.createdAt, today);
    const target = `${dist(g.distanceKm)}/week`;
    if (g.weeks) {
      if (w.streak >= g.weeks || g.achievedAt) return done(`${plural(Math.max(w.streak, g.weeks), "week")} in a row`, plural(g.weeks, "week"), g.achievedAt ? `Done ${fmtDate(g.achievedAt)}` : "Goal reached", { weeksHit: w.weeksHit });
      const left = g.weeks - w.streak;
      const eta = addDays(w.thisWeek, 7 * (left - (w.nowMet ? 0 : 1)) + 6);
      const ds = deadlineStatus(eta, g.deadline, today);
      return {
        pct: clamp01((w.streak + (w.nowMet ? 0 : Math.min(1, w.now / g.distanceKm) * 0.999)) / g.weeks), achieved: false,
        current: `${plural(w.streak, "week")} in a row · ${dist(w.now)} this week`, target: plural(g.weeks, "week"), status: g.deadline ? ds.status : "in_progress",
        note: `${plural(left, "more week")} at ${target}${g.deadline ? ` · ${ds.text}` : ""}`, eta, weeksHit: w.weeksHit,
      };
    }
    return {
      pct: clamp01(w.now / g.distanceKm), achieved: false, current: `${dist(w.now)} this week`, target, status: w.nowMet ? "on_track" : "in_progress",
      note: w.nowMet ? `Met this week${w.streak > 1 ? ` · ${w.streak}-week streak` : ""}` : `${dist(g.distanceKm - w.now)} to go this week${w.streak ? ` · ${w.streak}-week streak` : ""}`,
      weeksHit: w.weeksHit,
    };
  }

  // habit
  const counts = habitCounts(g, ctx);
  const { thisWeek, nowMet, streak, weeksHit } = weekStreak(counts, g.perWeek, g.createdAt, today);
  const n = counts[thisWeek] ?? 0;
  const current = `${n} / ${g.perWeek} this week`;
  const L = HABIT_LABEL[g.metric];
  if (g.weeks) {
    const target = plural(g.weeks, "week");
    if (streak >= g.weeks || g.achievedAt) return done(`${plural(Math.max(streak, g.weeks), "week")} in a row`, target, g.achievedAt ? `Done ${fmtDate(g.achievedAt)}` : "Goal reached", { weeksHit });
    const left = g.weeks - streak;
    const eta = addDays(thisWeek, 7 * (left - (nowMet ? 0 : 1)) + 6);
    const ds = deadlineStatus(eta, g.deadline, today);
    return {
      pct: clamp01((streak + (nowMet ? 0 : Math.min(1, n / g.perWeek) * 0.999)) / g.weeks), achieved: false,
      current: `${plural(streak, "week")} in a row · ${n}/${g.perWeek} this week`, target, status: g.deadline ? ds.status : "in_progress",
      note: `${plural(left, "more week")} at ${g.perWeek}+ ${L.unit}${g.deadline ? ` · ${ds.text}` : ""}`, eta, weeksHit,
    };
  }
  return {
    pct: clamp01(n / g.perWeek), achieved: false, current, target: `${g.perWeek} ${L.unit}/week`, status: nowMet ? "on_track" : "in_progress",
    note: nowMet ? `Met this week${streak > 1 ? ` · ${streak}-week streak` : ""}` : `${plural(g.perWeek - n, L.unit.replace(/s$/, ""))} to go this week${streak ? ` · ${streak}-week streak` : ""}`,
    weeksHit,
  };
}

/** Goals that are met now but not yet marked: the caller records achievedAt (and celebrates). */
export function newlyAchieved(goals: PersonalGoal[], ctx: GoalCtx): PersonalGoal[] {
  return goals.filter((g) => !g.achievedAt && !g.archived && goalProgress(g, ctx).achieved);
}

export const activeGoals = (state: AppState) => (state.goals ?? []).filter((g) => !g.archived && !g.achievedAt);
export const finishedGoals = (state: AppState) => (state.goals ?? []).filter((g) => !g.archived && g.achievedAt);

/**
 * The bodyweight goal that should drive nutrition: the newest active one. Converted to kg for the
 * calorie math. null when there's no active bodyweight goal (the profile goal sets targets then).
 */
export function weightPlanFor(state: AppState, today: string): WeightPlan | null {
  const units = state.profile?.units ?? "lb";
  const g = (state.goals ?? []).filter((x): x is Extract<PersonalGoal, { kind: "bodyweight" }> => x.kind === "bodyweight" && !x.archived && !x.achievedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!g) return null;
  const cur = currentBodyweight(state);
  if (cur == null) return null;
  const left = g.deadline ? daysBetween(today, g.deadline) : null;
  return { currentKg: toKg(cur, units), targetKg: toKg(g.target, units), daysLeft: left != null && left > 0 ? left : null };
}

/** Which goal is driving nutrition, for "why these numbers" text. */
export function weightPlanGoal(state: AppState): PersonalGoal | null {
  return (state.goals ?? []).filter((x) => x.kind === "bodyweight" && !x.archived && !x.achievedAt).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
}
