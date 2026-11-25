import { describe, expect, it } from "vitest";
import { prescribe, progressionLogs, progressionState } from "./engine";
import { freeLog, freeRx } from "./derived";
import type { ExerciseLog, Program, ProgramExercise, Session } from "./types";

const pe: ProgramExercise = { id: "pe_bench", exId: "bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 135, increment: 5, style: "double", technique: null };
const log = (sets: [number, number, number?][], peId = "pe_bench", exId = "bench_press"): ExerciseLog => ({
  peId, exId, originalExId: exId, equivFactor: 1, targetWeight: 0,
  sets: sets.map(([weight, reps, quality]) => ({ weight, reps, quality: quality ?? null, ts: 0 })),
});
let n = 0;
const sess = (logs: ExerciseLog[], extra: Partial<Session> = {}): Session => {
  n++;
  return { id: "s" + n, dayId: "d", dayName: "x", date: `2026-11-${String(n).padStart(2, "0")}`, start: n * 1000, end: n * 1000 + 500, exercises: logs, ...extra };
};
const program: Program = { name: "P", startDate: "2026-11-01", days: [{ id: "d1", name: "Upper A", weekdays: [1], exercises: [pe, { ...pe, id: "pe_bench_b", repMin: 3, repMax: 5 }] }] };

describe("progression audit", () => {
  it("only adds weight when every working set reaches the top of the range", () => {
    const st = progressionState(pe, [log([[185, 10], [185, 8], [185, 7]])]);
    expect(st.decision).toBe("add_rep");
    expect(st.weight).toBe(185);
    expect(st.short).toEqual({ set: 3, reps: 7 });
    const rx = prescribe(pe, [log([[185, 10], [185, 8], [185, 7]])], null, false, "lb");
    expect(rx.why).toMatch(/set 3 got 7/);
    expect(progressionState(pe, [log([[185, 10], [185, 10], [185, 10]])]).weight).toBe(190);
  });
  it("ignores lighter back-off sets when judging", () => {
    expect(progressionState(pe, [log([[185, 10], [185, 10], [155, 7]])]).decision).toBe("increase");
  });
  it("a grind on any working set holds the weight", () => {
    const st = progressionState(pe, [log([[185, 10], [185, 10], [185, 10, 1]])]);
    expect(st.decision).toBe("add_rep");
    expect(st.note).toBe("grind");
  });
  it("rounds an odd weight down, not up, before adding the jump", () => {
    expect(progressionState(pe, [log([[137.5, 10], [137.5, 10]])]).weight).toBe(140);
  });
  it("skips deload sessions", () => {
    const sessions = [sess([log([[185, 8]])]), sess([log([[185, 4]])], { deload: true }), sess([log([[185, 4]])], { deload: true })];
    expect(progressionLogs(sessions, pe, program)).toHaveLength(1);
  });
  it("counts the same lift from free workouts, but not another slot or a heavy triple", () => {
    const sessions = [
      sess([log([[185, 8]])]),
      sess([log([[190, 9]], "pe_free123")]),           // freestyle, comparable reps → counts
      sess([log([[225, 3]], "pe_bench_b")]),          // other program slot → its own progression
      sess([log([[215, 3]], "pe_free456")]),          // heavy triple elsewhere → not comparable
    ];
    const hist = progressionLogs(sessions, pe, program);
    expect(hist.map((l) => l.sets[0].weight)).toEqual([185, 190]);
  });
  it("lifts outside the program now progress too", () => {
    const sessions = [sess([log([[50, 15], [50, 15], [50, 15]], "pe_x", "db_curl")])];
    const l = freeLog(sessions, "db_curl", null, "lb", { plan: { sets: 3, repMin: 10, repMax: 15 } });
    expect(l.targetWeight).toBe(55);
    expect(freeRx(sessions, l, null, "lb").rx.decision).toBe("increase");
  });
});
