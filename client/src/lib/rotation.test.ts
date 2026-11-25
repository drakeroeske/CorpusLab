import { describe, expect, it } from "vitest";
import { addDays, dayForDate, programWeeklySets, rotationPosition, trainingDaysPerWeek } from "./engine";
import type { Program, ProgramDay, Session } from "./types";

const day = (id: string): ProgramDay => ({ id, name: id.toUpperCase(), weekdays: [], exercises: [{ id: "pe_" + id, exId: "bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 100, increment: 5, style: "double", technique: null }] });
// 8-day split: A B rest C D rest E rest
const prog = (): Program => ({ name: "8-day", startDate: "2026-11-01", days: ["a", "b", "c", "d", "e"].map(day), rotation: ["a", "b", null, "c", "d", null, "e", null] });
const done = (date: string, dayId: string): Session => ({ id: date, dayId, dayName: dayId, date, start: Date.parse(date + "T10:00:00"), end: Date.parse(date + "T11:00:00"), exercises: [] });
const plan = (p: Program, sessions: Session[], today: string, from: string, n: number) =>
  Array.from({ length: n }, (_, i) => dayForDate(p, addDays(from, i), sessions, today)?.id ?? "-").join("");

describe("rotating split", () => {
  it("runs the cycle from the start date when you train on time", () => {
    expect(plan(prog(), [], "2026-11-01", "2026-11-01", 16)).toBe("ab-cd-e-ab-cd-e-");
  });
  it("a missed day pushes the cycle back instead of skipping", () => {
    const p = prog();
    const s = [done("2026-11-01", "a")]; // B was due on the 2nd and the 3rd, but you didn't train
    expect(dayForDate(p, "2026-11-02", s, "2026-11-04")?.id).toBe("b");
    expect(dayForDate(p, "2026-11-04", s, "2026-11-04")?.id).toBe("b"); // still B today
    expect(plan(p, s, "2026-11-04", "2026-11-05", 6)).toBe("-cd-e-");
  });
  it("rest days pass with the calendar, and training early moves the cycle", () => {
    const p = prog();
    const s = [done("2026-11-01", "a"), done("2026-11-02", "b"), done("2026-11-03", "c")]; // trained C on the rest day
    expect(plan(p, s, "2026-11-03", "2026-11-04", 4)).toBe("d-e-");
  });
  it("knows where today sits in the cycle", () => {
    const p = prog();
    expect(rotationPosition(p, [done("2026-11-01", "a")], "2026-11-02")).toEqual({ slot: 2, length: 8 });
  });
  it("training days per week and weekly sets scale by cycle length", () => {
    const p = prog();
    expect(trainingDaysPerWeek(p)).toBeCloseTo(4.4, 1);
    const weekly = programWeeklySets(p);
    // 5 days × 3 sets of bench each, every 8 days → 15 × 7/8 main-muscle sets a week for chest
    expect(weekly.chest_mid).toBeCloseTo(15 * 7 / 8, 5);
  });
  it("weekly programs still go by weekday", () => {
    const p: Program = { ...prog(), rotation: null, days: [{ ...day("a"), weekdays: [1, 3] }] };
    expect(dayForDate(p, "2026-11-02")?.id).toBe("a"); // a Monday
    expect(dayForDate(p, "2026-11-03")).toBeNull();
  });
});
