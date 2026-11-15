import { describe, expect, it } from "vitest";
import { activityMuscleLoad, activitySummary, fmtPace, parseDuration, predictedTimes, riegel, toKm } from "./activities";
import { goalProgress, goalTitle } from "./goals";
import { muscleFatigue, trainingLoad, loadSessionsOf, userStreak, addDays, weekStart } from "./engine";
import { emptyState } from "./empty";
import type { Activity, AppState, PersonalGoal } from "./types";

const today = "2026-11-14";
const run = (date: string, km: number, sec: number, rpe = 6): Activity => ({ id: "a" + date + km, type: "run", date, start: Date.parse(date + "T07:00:00"), durationSec: sec, distanceKm: km, rpe });
const base = (): AppState => ({ ...emptyState(), profile: { name: "T", units: "lb", bodyWeight: 170, heightCm: 178, age: 30, sex: "f", experience: "intermediate", goal: "recomp", gym: "", coachMode: false, onboarded: true, barWeight: 45 } });
const ctx = (state: AppState, units: "lb" | "kg" = "lb") => ({ state, today, units, proteinTarget: 140 });

describe("durations and pace", () => {
  it("reads durations people type", () => {
    expect(parseDuration("25")).toBe(1500);
    expect(parseDuration("25:30")).toBe(1530);
    expect(parseDuration("1:05:00")).toBe(3900);
    expect(parseDuration("5:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
  it("formats pace per sport", () => {
    expect(fmtPace({ type: "run", durationSec: 1500, distanceKm: 5 }, "kg")).toBe("5:00 /km");
    expect(fmtPace({ type: "run", durationSec: 480 * 3, distanceKm: toKm(3, "lb") }, "lb")).toBe("8:00 /mi");
    expect(fmtPace({ type: "row", durationSec: 420, distanceKm: 2 }, "kg")).toBe("1:45 /500m");
    expect(fmtPace({ type: "cycle", durationSec: 3600, distanceKm: 30 }, "kg")).toBe("30 km/h");
  });
  it("summarises a WOD", () => {
    const a: Activity = { id: "w", type: "wod", date: today, start: 0, durationSec: 720, rpe: 9, name: "Cindy", wod: { format: "amrap", rounds: 18, reps: 7, rx: true, movements: ["pullup", "pushup", "air_squat"] } };
    expect(activitySummary(a, "lb")).toBe("AMRAP 12 · 18 rounds + 7 · Rx");
  });
});

describe("recovery", () => {
  it("a hard run loads calves and legs, not chest", () => {
    const load = Object.fromEntries(activityMuscleLoad(run(today, 10, 3000, 8)));
    expect(load.gastrocnemius).toBeGreaterThan(load.vasti);
    expect(load.vasti).toBeGreaterThan(0);
    expect(load.chest_mid ?? 0).toBe(0);
  });
  it("a WOD spreads load over its movements", () => {
    const a: Activity = { id: "w", type: "wod", date: today, start: 0, durationSec: 600, rpe: 9, wod: { format: "for_time", rx: true, movements: ["thruster", "pullup"] } };
    const load = Object.fromEntries(activityMuscleLoad(a));
    expect(load.lats).toBeGreaterThan(0);
    expect(load.front_delts).toBeGreaterThan(0);
    expect(load.vasti).toBeGreaterThan(0);
  });
  it("feeds muscle fatigue, training load and the streak", () => {
    const s = base();
    const now = Date.parse(today + "T09:00:00");
    s.activities = [run(today, 8, 2400, 8)];
    const f = muscleFatigue([], [], [], 140, now, s.activities);
    expect(f.gastrocnemius).toBeGreaterThan(2);
    expect(f.chest_mid).toBe(0);
    // 20 days of 40-min runs makes a usual load; a big day yesterday shows up as recent load
    s.activities = Array.from({ length: 20 }, (_, i) => run(addDays(today, -21 + i), 6, 2400, 6));
    expect(trainingLoad(loadSessionsOf(s), today)).not.toBeNull();
    s.program = { name: "p", startDate: addDays(today, -30), days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: "d" + d, name: "D", weekdays: [d], exercises: [] })) };
    s.activities = [run(addDays(today, -1), 5, 1800), run(addDays(today, -2), 5, 1800), run(today, 5, 1800)];
    expect(userStreak(s, today)).toBe(3);
  });
});

describe("cardio goals", () => {
  it("predicts a 5K time from recent runs and finishes when a fast enough run is logged", () => {
    const s = base();
    s.activities = [run(addDays(today, -21), 5, 1680), run(addDays(today, -14), 5, 1650), run(addDays(today, -7), 6, 1950)];
    const g: PersonalGoal = { id: "g", kind: "cardio", createdAt: addDays(today, -21), activity: "run", metric: "time", distanceKm: 5, timeSec: 1500, startSec: 1680 };
    expect(goalTitle(g, "lb")).toBe("Run 5K under 25:00");
    const p = goalProgress(g, ctx(s));
    expect(p.achieved).toBe(false);
    expect(p.current).toMatch(/^Predicted 2[56]:/);
    expect(p.pct).toBeGreaterThan(0.3);
    s.activities.push(run(today, 5.02, 1495));
    expect(goalProgress(g, ctx(s)).achieved).toBe(true);
    expect(predictedTimes(s.activities, "run", 5).length).toBe(4);
    expect(Math.round(riegel(1500, 5, 10))).toBe(3127);
  });
  it("tracks weekly distance and longest single run", () => {
    const s = base();
    const wk = weekStart(today);
    s.activities = [run(wk, 8, 2400), run(addDays(wk, 2), 8, 2400)];
    const weekly: PersonalGoal = { id: "w", kind: "cardio", createdAt: wk, activity: "run", metric: "weekly", distanceKm: toKm(15, "lb") };
    const pw = goalProgress(weekly, ctx(s));
    expect(pw.current).toBe("9.94 mi this week");
    expect(pw.achieved).toBe(false);
    const longest: PersonalGoal = { id: "l", kind: "cardio", createdAt: wk, activity: "run", metric: "longest", distanceKm: 10 };
    expect(goalProgress(longest, ctx(s, "kg")).current).toBe("Longest 8 km");
    s.activities.push(run(today, 10.05, 3300));
    expect(goalProgress(longest, ctx(s, "kg")).achieved).toBe(true);
  });
  it("counts activities as workouts for habit goals", () => {
    const s = base();
    const wk = weekStart(today);
    s.activities = [run(wk, 5, 1800), run(addDays(wk, 1), 5, 1800), run(addDays(wk, 3), 5, 1800)];
    const g: PersonalGoal = { id: "h", kind: "habit", createdAt: wk, metric: "workouts", perWeek: 3 };
    expect(goalProgress(g, ctx(s)).current).toBe("3 / 3 this week");
  });
});
