import { describe, expect, it } from "vitest";
import { addDays, isCutting, plateauFix, plateauFlags } from "./engine";
import { emptyState } from "./empty";
import type { AppState, Profile, Session } from "./types";

const today = "2026-11-21";
const prof = (goal: Profile["goal"]): Profile => ({ name: "T", units: "lb", bodyWeight: 200, heightCm: 180, age: 30, sex: "m", experience: "intermediate", goal, gym: "", coachMode: false, onboarded: true, barWeight: 45 });
const bench = (date: string, w: number): Session => ({
  id: "s" + date, dayId: "d", dayName: "Upper", date, start: Date.parse(date + "T10:00:00"), end: Date.parse(date + "T11:00:00"),
  exercises: [{ peId: "p", exId: "bench_press", originalExId: "bench_press", equivFactor: 1, targetWeight: w, sets: [1, 2, 3, 4].map(() => ({ weight: w, reps: 5, ts: 0 })) }],
});
// six bench sessions, the last three no better than before: a classic stall
const state = (goal: Profile["goal"], weights = [200, 205, 210, 210, 205, 210], lastDaysAgo = 2): AppState => {
  const s: AppState = { ...emptyState(), profile: prof(goal) };
  s.program = { name: "p", startDate: addDays(today, -60), days: [{ id: "d", name: "Upper", weekdays: [1, 4], exercises: [{ id: "p", exId: "bench_press", sets: 4, repLow: 5, repHigh: 8 } as never] }] };
  s.sessions = weights.map((w, i) => bench(addDays(today, -lastDaysAgo - (weights.length - 1 - i) * 3), w));
  // losing ~1 lb a week
  s.checkins = Array.from({ length: 15 }, (_, i) => ({ date: addDays(today, -14 + i), soreness: {}, bodyWeight: 202 - i * 0.15 }));
  return s;
};

describe("stall advice", () => {
  it("not cutting: a stall with weight dropping suggests more calories (unchanged)", () => {
    const s = state("muscle");
    expect(isCutting(s)).toBe(false);
    const f = plateauFix({ avgReadiness7: 80, weeklySetsPrimary: 14, weightSlopePerWeek: -0.5, proteinHit: 0.9 });
    expect(f.kind).toBe("calories");
  });
  it("cutting: a flat lift is NOT flagged (holding strength is the goal)", () => {
    const s = state("fatloss");
    expect(isCutting(s)).toBe(true);
    expect(plateauFlags(s, today)).toHaveLength(0);
  });
  it("cutting: a clearly dropping lift is flagged, and never told to eat more", () => {
    const s = state("fatloss", [225, 225, 230, 215, 210, 210]);
    const flags = plateauFlags(s, today);
    expect(flags).toHaveLength(1);
    expect(flags[0].kind).toBe("cut_dropping");
    expect(flags[0].fix).not.toMatch(/raise calories/i);
    expect(plateauFix({ avgReadiness7: 80, weeklySetsPrimary: 14, weightSlopePerWeek: -0.5, proteinHit: 0.9, cutting: true }).kind).toBe("cut_dropping");
  });
  it("an active bodyweight goal overrides the profile goal", () => {
    const s = state("muscle");
    s.goals = [{ id: "g", kind: "bodyweight", createdAt: addDays(today, -10), start: 202, target: 185 }];
    expect(isCutting(s)).toBe(true);
    const gaining = state("fatloss");
    gaining.goals = [{ id: "g", kind: "bodyweight", createdAt: addDays(today, -10), start: 200, target: 210 }];
    expect(isCutting(gaining)).toBe(false);
  });
  it("lifts not trained in the last 2 weeks aren't flagged", () => {
    expect(plateauFlags(state("muscle", undefined, 20), today)).toHaveLength(0);
    expect(plateauFlags(state("muscle", undefined, 2), today).length).toBeGreaterThan(0);
  });
  it("never says 0 sets a week", () => {
    const f = plateauFix({ avgReadiness7: 80, weeklySetsPrimary: 0.4, weightSlopePerWeek: 0 });
    expect(f.fix).not.toMatch(/\b0 hard sets/);
  });
});
