import { describe, expect, it } from "vitest";
import { KCAL_PER_KG, nutritionTargets } from "./engine";
import { weightPlanFor } from "./goals";
import { emptyState } from "./empty";
import type { AppState, Profile } from "./types";

const p: Profile = { name: "T", units: "lb", bodyWeight: 200, heightCm: 180, age: 30, sex: "m", experience: "intermediate", goal: "recomp", gym: "", coachMode: false, onboarded: true, barWeight: 45 };
const kg = (lb: number) => lb / 2.20462;

describe("nutrition targets from a bodyweight goal", () => {
  const base = nutritionTargets(p, 4);
  it("no goal: unchanged profile-goal behaviour", () => {
    expect(base.weightPlan ?? null).toBeNull();
    expect(base.goalAdj).toBe(-150);
  });
  it("sets the calorie gap from weight to lose and days left", () => {
    // 200 → 190 lb in 70 days: 10 lb ≈ 4.54 kg × 7700 / 70 ≈ 499 kcal/day
    const t = nutritionTargets(p, 4, { currentKg: kg(200), targetKg: kg(190), daysLeft: 70 });
    expect(t.weightPlan).toMatchObject({ dir: "lose", capped: false, defaultPace: false });
    expect(t.goalAdj).toBeCloseTo(-(kg(10) * KCAL_PER_KG) / 70, -1);
    expect(t.cal).toBe(Math.round((t.tdee + t.goalAdj) / 10) * 10);
    expect(t.protein).toBeGreaterThan(base.protein);
  });
  it("caps an unsafe deadline at ~1%/week and never below BMR", () => {
    const t = nutritionTargets(p, 4, { currentKg: kg(200), targetKg: kg(170), daysLeft: 28 });
    expect(t.weightPlan!.capped).toBe(true);
    expect(t.weightPlan!.kgPerWeek).toBeCloseTo(kg(200) * 0.01, 1);
    expect(t.cal).toBeGreaterThanOrEqual(t.bmr - 10);
  });
  it("gaining: surplus, capped at 0.5%/week", () => {
    const t = nutritionTargets(p, 4, { currentKg: kg(200), targetKg: kg(215), daysLeft: 30 });
    expect(t.weightPlan).toMatchObject({ dir: "gain", capped: true });
    expect(t.goalAdj).toBeGreaterThan(0);
  });
  it("no deadline: default pace (half the safe max)", () => {
    const t = nutritionTargets(p, 4, { currentKg: kg(200), targetKg: kg(180), daysLeft: null });
    expect(t.weightPlan).toMatchObject({ dir: "lose", defaultPace: true, capped: false });
    expect(t.weightPlan!.kgPerWeek).toBeCloseTo(kg(200) * 0.005, 2);
  });
  it("at the target: maintenance", () => {
    const t = nutritionTargets(p, 4, { currentKg: kg(200), targetKg: kg(200.5), daysLeft: 30 });
    expect(t.weightPlan!.dir).toBe("hold");
    expect(t.goalAdj).toBe(0);
  });
  it("weightPlanFor uses the newest active bodyweight goal and the latest weigh-in", () => {
    const s: AppState = { ...emptyState(), profile: p };
    s.checkins = [{ date: "2026-11-14", soreness: {}, bodyWeight: 198 }];
    s.goals = [
      { id: "old", kind: "bodyweight", createdAt: "2026-10-01", start: 205, target: 195, achievedAt: "2026-11-01" },
      { id: "new", kind: "bodyweight", createdAt: "2026-11-10", start: 200, target: 185, deadline: "2027-01-14" },
    ];
    const plan = weightPlanFor(s, "2026-11-15")!;
    expect(plan.currentKg).toBeCloseTo(kg(198), 3);
    expect(plan.targetKg).toBeCloseTo(kg(185), 3);
    expect(plan.daysLeft).toBe(60);
    s.goals = s.goals.slice(0, 1);
    expect(weightPlanFor(s, "2026-11-15")).toBeNull();
  });
});

describe("maintenance: logged activities and the user's own number", async () => {
  const { activityNetKcal, activityKcalPerDay } = await import("./activities");
  const run = (date: string, km: number, min: number, rpe = 6) => ({ id: date + km, type: "run" as const, date, start: 0, durationSec: min * 60, distanceKm: km, rpe });
  it("a 10 km run burns ~1 kcal per kg per km above rest", () => {
    expect(activityNetKcal(run("2026-11-20", 10, 55), 80)).toBe(800);
  });
  it("no distance: MET by effort, minus resting burn", () => {
    const yoga = { id: "y", type: "yoga" as const, date: "2026-11-20", start: 0, durationSec: 3600, rpe: 3 };
    expect(activityNetKcal(yoga, 70)).toBe(Math.round((2.3 - 1) * 70)); // easy yoga ≈ 91 kcal
    const wod = { id: "w", type: "wod" as const, date: "2026-11-20", start: 0, durationSec: 20 * 60, rpe: 10 };
    expect(activityNetKcal(wod, 80)).toBe(Math.round((10 - 1) * 80 / 3)); // all-out 20 min ≈ 240 kcal
  });
  it("averages over 4 weeks and ignores older activities", () => {
    const list = [run("2026-11-20", 7, 40), run("2026-11-13", 7, 40), run("2026-10-01", 20, 120)];
    expect(activityKcalPerDay(list, 80, "2026-11-21")).toBe(Math.round((560 * 2) / 28));
  });
  it("adds activity calories to maintenance", () => {
    const base = nutritionTargets(p, 4);
    const t = nutritionTargets(p, 4, null, { activityKcalPerDay: 210 });
    expect(t.tdee - base.tdee).toBe(210);
    expect(t.activityKcal).toBe(210);
    expect(t.cal - base.cal).toBeGreaterThanOrEqual(200);
  });
  it("the user's own maintenance replaces the estimate; goals still apply on top", () => {
    const own = { ...p, maintenanceKcal: 2600 };
    const t = nutritionTargets(own, 4, null, { activityKcalPerDay: 300 });
    expect(t.customMaintenance).toBe(true);
    expect(t.tdee).toBe(2600);
    expect(t.activityKcal).toBe(0);
    expect(t.cal).toBe(2600 - 150); // recomp −150
    const cut = nutritionTargets(own, 4, { currentKg: kg(200), targetKg: kg(190), daysLeft: 70 });
    expect(cut.tdee).toBe(2600);
    expect(cut.goalAdj).toBeLessThan(-400);
    // nonsense values are ignored
    expect(nutritionTargets({ ...p, maintenanceKcal: 300 }, 4).customMaintenance).toBe(false);
  });
});

describe("weekly calorie split", async () => {
  const { calTargetFor, splitDescription } = await import("./engine");
  const week = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]; // Mon..Sun
  const lift = new Set(["2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20"]); // 4 training days
  const total = (t: ReturnType<typeof nutritionTargets>) => week.reduce((a, d) => a + calTargetFor(t, d, lift.has(d)), 0);
  it("default is the original training/rest split (+150)", () => {
    const t = nutritionTargets(p, 4);
    expect(t.split).toEqual({ mode: "training", amount: 150 });
    expect(t.trainingCal - t.cal).toBe(150);
    expect(calTargetFor(t, "2026-11-16", true)).toBe(t.trainingCal);
    expect(calTargetFor(t, "2026-11-18", false)).toBe(t.restCal);
  });
  it("same every day", () => {
    const t = nutritionTargets({ ...p, calorieSplit: { mode: "flat", amount: 300 } }, 4);
    expect(week.every((d) => calTargetFor(t, d, lift.has(d)) === t.cal)).toBe(true);
    expect(splitDescription(t)).toBe(`${t.cal.toLocaleString()} every day`);
  });
  it("weekends higher, weekdays lower", () => {
    const t = nutritionTargets({ ...p, calorieSplit: { mode: "weekend", amount: 400 } }, 4);
    expect(calTargetFor(t, "2026-11-21", false)).toBe(t.cal + 400); // Sat
    expect(calTargetFor(t, "2026-11-22", false)).toBe(t.cal + 400); // Sun
    expect(calTargetFor(t, "2026-11-18", true)).toBe(t.cal - 160); // 800 / 5 = 160 off each weekday
  });
  it("every split keeps the weekly total (within rounding)", () => {
    const flat = total(nutritionTargets({ ...p, calorieSplit: { mode: "flat", amount: 0 } }, 4));
    for (const mode of ["training", "weekend"] as const) for (const amount of [100, 250, 500]) {
      expect(Math.abs(total(nutritionTargets({ ...p, calorieSplit: { mode, amount } }, 4)) - flat)).toBeLessThanOrEqual(30);
    }
  });
});
