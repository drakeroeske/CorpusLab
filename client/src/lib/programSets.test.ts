import { describe, expect, it } from "vitest";
import { programWeeklySets } from "./engine";
import { EX, muscleShares } from "./exercises";
import type { Program } from "./types";

describe("scheduled sets per muscle", () => {
  it("multiplies each day's sets by how often it runs, with tier weights", () => {
    const p: Program = { name: "P", startDate: "2026-11-01", days: [
      { id: "a", name: "Upper", weekdays: [1, 4], exercises: [{ id: "x", exId: "bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 135, increment: 5, style: "double", technique: null }] },
      { id: "b", name: "Extra", weekdays: [], exercises: [{ id: "y", exId: "bench_press", sets: 2, repMin: 6, repMax: 10, startWeight: 135, increment: 5, style: "double", technique: null }] },
    ] };
    const sets = programWeeklySets(p);
    for (const [m, w] of muscleShares(EX.bench_press)) expect(sets[m]).toBeCloseTo((3 * 2 + 2) * w, 5);
  });
});
