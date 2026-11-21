import { describe, expect, it } from "vitest";
import { EX, fmtReps, isCompound, isTimed, repUnit } from "./exercises";
import { e1rmSeries, logBestE1rm, prescribe, sessionPRs, sessionVolume } from "./engine";
import { goalProgress, goalTitle } from "./goals";
import { emptyState } from "./empty";
import type { AppState, ExerciseLog, PersonalGoal, ProgramExercise, Session } from "./types";

const today = "2026-11-21";
const log = (exId: string, sets: [number, number][]): ExerciseLog => ({ peId: "p", exId, originalExId: exId, equivFactor: 1, targetWeight: 0, sets: sets.map(([weight, reps]) => ({ weight, reps, ts: 0 })) });
const sess = (date: string, logs: ExerciseLog[]): Session => ({
  id: "s" + date, dayId: "d", dayName: "x", date, start: Date.parse(date + "T10:00:00"), end: Date.parse(date + "T11:00:00"), exercises: logs,
});

describe("timed exercises", () => {
  it("catalog marks carries and holds as timed, not compound", () => {
    expect(isTimed("farmers_carry")).toBe(true);
    expect(isTimed("plank")).toBe(true);
    expect(isTimed("bench_press")).toBe(false);
    expect(isCompound(EX.farmers_carry)).toBe(false);
    expect(repUnit("dead_hang")).toBe("s");
  });
  it("formats seconds, switching to m:ss from 90 s", () => {
    expect(fmtReps("farmers_carry", 45)).toBe("45 s");
    expect(fmtReps("plank", 90)).toBe("1:30");
    expect(fmtReps("plank", 125)).toBe("2:05");
    expect(fmtReps("bench_press", 8)).toBe("8");
  });
  it("never feeds e1RM or tonnage", () => {
    const l = log("farmers_carry", [[100, 45], [100, 40]]);
    expect(logBestE1rm(l)).toBe(0);
    const s = sess(today, [l, log("bench_press", [[200, 5]])]);
    expect(sessionVolume(s)).toBe(1000);
    expect(e1rmSeries([s], "farmers_carry")).toEqual([]);
  });
  it("a PR is heavier at the same time, or longer at the same weight", () => {
    const old = sess("2026-11-10", [log("farmers_carry", [[100, 45]])]);
    const same = sess("2026-11-14", [log("farmers_carry", [[90, 40]])]);
    expect(sessionPRs([old, same], same)).toHaveLength(0);
    const longer = sess("2026-11-17", [log("farmers_carry", [[100, 60]])]);
    expect(sessionPRs([old, longer], longer)).toHaveLength(1);
    const heavier = sess("2026-11-21", [log("farmers_carry", [[120, 30]])]);
    expect(sessionPRs([old, heavier], heavier)).toHaveLength(1);
  });
  it("prescribes in seconds and adds weight once the top of the range is hit", () => {
    const pe: ProgramExercise = { id: "p", exId: "farmers_carry", sets: 3, repMin: 30, repMax: 60, startWeight: 70, increment: 5, style: "double", technique: null };
    const rx = prescribe(pe, [log("farmers_carry", [[70, 60], [70, 60], [70, 60]])], null, false, "lb");
    expect(rx.weight).toBeGreaterThan(70);
    expect(rx.why).not.toMatch(/reps/);
  });
  it("a timed lift goal tracks the longest hold at the target weight", () => {
    const s: AppState = { ...emptyState(), profile: { name: "T", units: "lb", bodyWeight: 200, heightCm: 180, age: 30, sex: "m", experience: "intermediate", goal: "fatloss", gym: "", coachMode: false, onboarded: true, barWeight: 45 } };
    s.sessions = [sess("2026-11-18", [log("farmers_carry", [[100, 45], [80, 90]])])];
    const g: PersonalGoal = { id: "g", kind: "lift", createdAt: "2026-11-01", exId: "farmers_carry", weight: 100, reps: 60, startE1rm: 0 };
    expect(goalTitle(g, "lb")).toContain("60 s");
    const p = goalProgress(g, { state: s, today, units: "lb", proteinTarget: 180 });
    expect(p.achieved).toBe(false);
    expect(p.pct).toBeCloseTo(0.75, 2);
  });
});
