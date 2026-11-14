import { describe, expect, it } from "vitest";
import { afterSupersetSet, linkSuperset, supersetGroup, unlinkSuperset } from "./superset";
import { setVolume, sessionVolume, logsForPe, progressionState } from "./engine";
import { fmtSet, normalizeSet } from "@/components/SetEditor";
import type { ExerciseLog, ProgramExercise, Session, SetLog } from "./types";

const ex = (id: string, sets = 0, superset: string | null = null): ExerciseLog => ({
  peId: `pe_${id}`, exId: "bench_press", originalExId: "bench_press", equivFactor: 1, targetWeight: 100,
  sets: Array.from({ length: sets }, (_, i) => ({ weight: 100, reps: 8, ts: i })), superset,
});
const ids = (l: ExerciseLog[]) => l.map((x) => x.peId.slice(3));

describe("supersets", () => {
  it("links two exercises and moves the partner next to the current one", () => {
    const list = [ex("a"), ex("b"), ex("c"), ex("d")];
    const r = linkSuperset(list, 0, 2);
    expect(ids(r.exercises)).toEqual(["a", "c", "b", "d"]);
    expect(r.index).toBe(0);
    expect(r.exercises[0].superset).toBeTruthy();
    expect(r.exercises[0].superset).toBe(r.exercises[1].superset);
    expect(r.exercises[2].superset ?? null).toBeNull();
  });

  it("keeps the current exercise in view when it is the later one", () => {
    const r = linkSuperset([ex("a"), ex("b"), ex("c")], 2, 0);
    expect(ids(r.exercises)).toEqual(["a", "c", "b"]);
    expect(r.index).toBe(1);
  });

  it("joins an existing superset to make a tri-set", () => {
    const list = [ex("a", 0, "s1"), ex("b", 0, "s1"), ex("c"), ex("d")];
    const r = linkSuperset(list, 3, 0);
    expect(ids(r.exercises)).toEqual(["a", "b", "d", "c"]);
    expect(supersetGroup(r.exercises, 0)).toEqual([0, 1, 2]);
    expect(r.index).toBe(2);
  });

  it("unlinking leaves the rest together, and a lone member is released", () => {
    const tri = [ex("a", 0, "s"), ex("b", 0, "s"), ex("c", 0, "s")];
    const one = unlinkSuperset(tri, 2);
    expect(supersetGroup(one, 0)).toEqual([0, 1]);
    const none = unlinkSuperset(one, 0);
    expect(none.every((l) => !l.superset)).toBe(true);
  });

  it("goes A → B with no rest, then rests and returns to A", () => {
    const list = [ex("a", 0, "s"), ex("b", 0, "s"), ex("c")];
    const left = [3, 3, 3];
    expect(afterSupersetSet(list, 0, (i) => left[i])).toEqual({ goTo: 1, rest: false });
    expect(afterSupersetSet(list, 1, (i) => left[i])).toEqual({ goTo: 0, rest: true });
  });

  it("skips members that are done and ends when the superset is finished", () => {
    const list = [ex("a", 0, "s"), ex("b", 0, "s")];
    expect(afterSupersetSet(list, 0, (i) => [1, 0][i])).toEqual({ goTo: 0, rest: true });
    expect(afterSupersetSet(list, 0, () => 0)).toBeNull();
    expect(afterSupersetSet([ex("a"), ex("b")], 0, () => 3)).toBeNull();
  });
});

describe("drop sets and rest-pause", () => {
  const drop: SetLog = { weight: 100, reps: 8, kind: "drop", parts: [{ weight: 75, reps: 6 }, { weight: 50, reps: 5 }], ts: 1 };
  const rp: SetLog = { weight: 100, reps: 8, kind: "restpause", parts: [{ weight: 100, reps: 3 }, { weight: 100, reps: 2 }], ts: 1 };

  it("counts drops and mini-sets in volume", () => {
    expect(setVolume({ weight: 100, reps: 8, ts: 0 })).toBe(800);
    expect(setVolume(drop)).toBe(800 + 450 + 250);
    expect(setVolume(rp)).toBe(800 + 300 + 200);
    const s: Session = { id: "s", dayId: "d", dayName: "D", date: "2026-11-13", start: 0, end: 1, exercises: [{ ...ex("a"), sets: [drop, rp] }] };
    expect(sessionVolume(s)).toBe(1500 + 1300);
  });

  it("formats each kind for history and the logger", () => {
    expect(fmtSet(drop)).toBe("100 × 8 → 75 × 6 → 50 × 5");
    expect(fmtSet(rp)).toBe("100 × 8 + 3 + 2");
    expect(fmtSet({ weight: 100, reps: 8, ts: 0 }, "×")).toBe("100×8");
  });

  it("normalizes: rest-pause uses the main weight, empty rows go, no rows means a normal set", () => {
    expect(normalizeSet({ ...rp, weight: 110 }).parts!.every((p) => p.weight === 110)).toBe(true);
    const cleaned = normalizeSet({ ...drop, parts: [{ weight: 75, reps: 0 }] });
    expect(cleaned.kind).toBeUndefined();
    expect(cleaned.parts).toBeUndefined();
  });

  it("progression only reads the main part of the first set", () => {
    const pe: ProgramExercise = { id: "pe_a", exId: "bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 100, increment: 5, style: "double", technique: null };
    const withDrop: Session = { id: "s", dayId: "d", dayName: "D", date: "2026-11-13", start: 0, end: 1, exercises: [{ ...ex("a"), sets: [drop] }] };
    const plain: Session = { ...withDrop, exercises: [{ ...ex("a"), sets: [{ weight: 100, reps: 8, ts: 1 }] }] };
    expect(progressionState(pe, logsForPe([withDrop], "pe_a"))).toEqual(progressionState(pe, logsForPe([plain], "pe_a")));
  });
});
