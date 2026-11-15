import { describe, expect, it } from "vitest";
import { goalProgress, goalTitle, newlyAchieved, recentBestE1rm } from "./goals";
import { emptyState } from "./empty";
import { addDays, weekStart } from "./engine";
import type { AppState, CheckIn, PersonalGoal, Session } from "./types";

const today = "2026-11-14"; // a Saturday
const base = (): AppState => ({ ...emptyState(), profile: { name: "T", units: "lb", bodyWeight: 200, heightCm: 180, age: 30, sex: "m", experience: "intermediate", goal: "fatloss", gym: "", coachMode: false, onboarded: true, barWeight: 45 } });
const ci = (date: string, extra: Partial<CheckIn>): CheckIn => ({ date, soreness: {}, ...extra });
const sess = (date: string, exId: string, sets: [number, number][]): Session => ({
  id: "s" + date + exId, dayId: "d", dayName: "x", date, start: Date.parse(date + "T10:00:00"), end: Date.parse(date + "T11:00:00"),
  exercises: [{ peId: "p", exId, originalExId: exId, equivFactor: 1, targetWeight: 0, sets: sets.map(([weight, reps]) => ({ weight, reps, ts: 0 })) }],
});
const ctx = (state: AppState) => ({ state, today, units: "lb" as const, proteinTarget: 180 });

describe("bodyweight goals", () => {
  it("tracks progress from the start weight and projects an ETA from the trend", () => {
    const s = base();
    // 200 → 197 over two weeks: about −1.5 lb/week
    s.checkins = Array.from({ length: 15 }, (_, i) => ci(addDays(today, -14 + i), { bodyWeight: 200 - (3 * i) / 14 }));
    const g: PersonalGoal = { id: "g", kind: "bodyweight", createdAt: addDays(today, -14), start: 200, target: 190 };
    const p = goalProgress(g, ctx(s));
    expect(p.achieved).toBe(false);
    expect(p.pct).toBeCloseTo(0.3, 1);
    expect(p.eta).toBeTruthy();
    expect(p.eta! > today).toBe(true);
    expect(goalTitle(g, "lb")).toBe("Get down to 190 lb");
  });
  it("is achieved once a weigh-in reaches the target", () => {
    const s = base();
    s.checkins = [ci(today, { bodyWeight: 189.5 })];
    const g: PersonalGoal = { id: "g", kind: "bodyweight", createdAt: today, start: 200, target: 190 };
    expect(goalProgress(g, ctx(s)).achieved).toBe(true);
    expect(newlyAchieved([g], ctx(s))).toHaveLength(1);
  });
  it("flags a deadline that would need an unhealthy rate", () => {
    const s = base();
    s.checkins = [ci(today, { bodyWeight: 200 })];
    const g: PersonalGoal = { id: "g", kind: "bodyweight", createdAt: today, start: 200, target: 180, deadline: addDays(today, 28) };
    const p = goalProgress(g, ctx(s));
    expect(p.status).toBe("behind");
    expect(p.note).toMatch(/faster than recommended/);
  });
});

describe("lift goals", () => {
  it("is achieved only by a real set at or above the target weight and reps", () => {
    const s = base();
    s.sessions = [sess(addDays(today, -7), "bench_press", [[215, 3]]), sess(today, "bench_press", [[225, 1]])];
    const g: PersonalGoal = { id: "g", kind: "lift", createdAt: addDays(today, -10), exId: "bench_press", weight: 225, reps: 1, startE1rm: 200 };
    expect(goalProgress(g, ctx(s)).achieved).toBe(true);
    const g5: PersonalGoal = { ...g, reps: 5 };
    expect(goalProgress(g5, ctx(s)).achieved).toBe(false);
  });
  it("shows partial progress by estimated max", () => {
    const s = base();
    s.sessions = [0, 1, 2, 3].map((i) => sess(addDays(today, -21 + i * 7), "back_squat", [[275 + i * 5, 5]]));
    const start = 300;
    const g: PersonalGoal = { id: "g", kind: "lift", createdAt: addDays(today, -21), exId: "back_squat", weight: 315, reps: 5, startE1rm: start };
    const p = goalProgress(g, ctx(s));
    expect(p.achieved).toBe(false);
    expect(p.pct).toBeGreaterThan(0.3);
    expect(p.pct).toBeLessThan(1);
    expect(p.eta).toBeTruthy();
    expect(recentBestE1rm(s.sessions, "back_squat", today)).toBeCloseTo(290 * (1 + 5 / 30), 3);
  });
  it("asks for data when the lift was never logged", () => {
    const g: PersonalGoal = { id: "g", kind: "lift", createdAt: today, exId: "deadlift", weight: 405, reps: 1, startE1rm: 0 };
    expect(goalProgress(g, ctx(base())).status).toBe("no_data");
  });
});

describe("habit goals", () => {
  it("counts this week and the streak of weeks met", () => {
    const s = base();
    const wk = weekStart(today);
    // last two weeks: 4 workouts each; this week: 2 so far
    const dates = [-14, -13, -11, -9, -7, -6, -4, -2].map((d) => addDays(wk, d)).concat([addDays(wk, 0), addDays(wk, 2)]);
    s.sessions = dates.map((d) => sess(d, "bench_press", [[100, 5]]));
    const g: PersonalGoal = { id: "g", kind: "habit", createdAt: addDays(wk, -14), metric: "workouts", perWeek: 4, weeks: 4 };
    const p = goalProgress(g, ctx(s));
    expect(p.achieved).toBe(false);
    expect(p.current).toMatch(/^2 weeks in a row · 2\/4 this week/);
    expect(p.weeksHit!.slice(-3)).toEqual([true, true, false]);
  });
  it("finishes a weeks-in-a-row goal", () => {
    const s = base();
    const wk = weekStart(today);
    s.checkins = Array.from({ length: 21 }, (_, i) => ci(addDays(wk, -14 + i), { sleepH: 7.5 })).filter((c) => c.date <= today);
    const g: PersonalGoal = { id: "g", kind: "habit", createdAt: addDays(wk, -14), metric: "sleep", perWeek: 5, weeks: 3, sleepHours: 7 };
    expect(goalProgress(g, ctx(s)).achieved).toBe(true);
    expect(goalTitle(g, "lb")).toBe("7h+ sleep: 5×/week for 3 weeks");
  });
});

describe("unit switch", () => {
  it("converts goal weights to kg", async () => {
    const { convertUnits } = await import("./actions");
    const s = base();
    s.goals = [
      { id: "a", kind: "bodyweight", createdAt: today, start: 200, target: 180 },
      { id: "b", kind: "lift", createdAt: today, exId: "bench_press", weight: 225, reps: 1, startE1rm: 205 },
      { id: "c", kind: "habit", createdAt: today, metric: "workouts", perWeek: 4 },
    ];
    const k = convertUnits(s, "kg").goals!;
    expect(k[0]).toMatchObject({ start: 90.7, target: 81.6 });
    expect(k[1]).toMatchObject({ weight: 102 });
    expect(k[2]).toEqual(s.goals[2]);
  });
});
