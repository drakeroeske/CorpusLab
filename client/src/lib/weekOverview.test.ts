import { describe, expect, it } from "vitest";
import { weekOverview, type NutritionTargets } from "./engine";
import { emptyState } from "./empty";
import type { AppState, Program } from "./types";

// Week of Mon 2026-11-23. Upper on Mon/Thu, Lower on Tue/Fri.
const program: Program = { name: "UL", startDate: "2026-11-01", days: [
  { id: "u", name: "Upper", weekdays: [1, 4], exercises: [] },
  { id: "l", name: "Lower", weekdays: [2, 5], exercises: [] },
] };
const t = { cal: 2500, highCal: 2500, lowCal: 2500, bmr: 1800, protein: 180, split: { mode: "flat", amount: 0 } } as unknown as NutritionTargets;
const meal = (date: string, cal: number, p: number) => ({ id: date + cal, date, time: 0, name: "m", cal, p, c: 0, f: 0 });

describe("week overview", () => {
  it("counts workouts, missed days, the calorie budget, protein and weight", () => {
    const s: AppState = {
      ...emptyState(), program,
      sessions: [{ id: "s1", dayId: "u", dayName: "Upper", date: "2026-11-23", start: 1, end: 2, exercises: [] }],
      meals: [meal("2026-11-23", 2800, 190), meal("2026-11-24", 2400, 150), meal("2026-11-25", 1000, 60)],
      checkins: [{ date: "2026-11-17", bodyWeight: 200 }, { date: "2026-11-24", bodyWeight: 199 }, { date: "2026-11-25", bodyWeight: 198.6 }],
    };
    const w = weekOverview(s, t, "2026-11-25");
    expect(w.days.map((d) => d.state)).toEqual(["done", "missed", "rest", "planned", "planned", "rest", "rest"]);
    expect([w.workoutsDone, w.workoutsPlanned]).toEqual([1, 4]);
    expect(w.kcalEaten).toBe(6200);
    expect(w.kcalWeekTarget).toBe(17500);
    expect(w.kcalPace).toBe(200); // Mon +300, Tue −100; today doesn't count yet
    expect([w.proteinHit, w.proteinLogged]).toEqual([1, 3]);
    expect(w.weightChange).toBeCloseTo(-1.2, 5);
  });
});
