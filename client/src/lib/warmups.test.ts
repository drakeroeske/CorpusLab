import { describe, expect, it } from "vitest";
import { WARMUPS, rankWarmups, warmupMinutes, warmupRate, warmupSkipStreak, warmupSummary } from "./warmups";
import { isMuscle } from "./exercises";
import type { Session } from "./types";

const sess = (date: string, status?: "done" | "skipped"): Session => ({
  id: date, dayId: "d", dayName: "x", date, start: Date.parse(date + "T10:00:00"), end: Date.parse(date + "T11:00:00"), exercises: [],
  ...(status ? { warmup: { status, items: status === "done" ? [{ id: "bike", min: 6 }] : [], ts: 0 } } : {}),
});

describe("warm-up library", () => {
  it("every warm-up lists valid muscles and has a cue", () => {
    for (const w of WARMUPS) {
      expect(w.muscles.every(isMuscle), w.id).toBe(true);
      expect(w.cue.length).toBeGreaterThan(10);
    }
    expect(new Set(WARMUPS.map((w) => w.id)).size).toBe(WARMUPS.length);
  });
  it("suggests leg and hip work for a squat day, shoulder work for a press day", () => {
    const legs = rankWarmups("stretch", ["back_squat", "rdl", "leg_curl"]).filter((x) => x.suggested).map((x) => x.w.id);
    expect(legs).toHaveLength(3);
    expect(legs).toContain("worlds_greatest");
    const press = rankWarmups("bands", ["bench_press", "ohp", "lateral_raise"]).filter((x) => x.suggested).map((x) => x.w.id);
    expect(press.some((id) => ["band_dislocate", "band_external_rotation", "pushup_warmup", "band_face_pull"].includes(id))).toBe(true);
    expect(press).not.toContain("band_lateral_walk");
    expect(rankWarmups("cardio", ["bench_press"]).filter((x) => x.suggested)).toHaveLength(1);
  });
  it("still suggests something for an empty (freestyle) workout", () => {
    expect(rankWarmups("bands", []).filter((x) => x.suggested).length).toBe(3);
  });
  it("summarises and totals", () => {
    const items = [{ id: "bike", min: 6 }, { id: "leg_swings" }, { id: "glute_bridge" }];
    expect(warmupSummary(items)).toBe("6 min stationary bike + 2 more");
    expect(warmupMinutes(items)).toBe(8);
  });
});

describe("skip tracking", () => {
  it("counts the current run of skipped warm-ups, ignoring workouts from before the feature", () => {
    const s = [sess("2026-11-01"), sess("2026-11-03", "done"), sess("2026-11-05", "skipped"), sess("2026-11-07", "skipped"), sess("2026-11-09", "skipped")];
    expect(warmupSkipStreak(s)).toBe(3);
    expect(warmupSkipStreak([...s, sess("2026-11-11", "done")])).toBe(0);
    expect(warmupRate(s, "2026-11-01", "2026-11-09")).toEqual({ warmed: 1, total: 4 });
  });
});

describe("joint prep first", () => {
  it("an upper day with rows and curls still leads with shoulder prep", () => {
    const top = rankWarmups("bands", ["bench_press", "barbell_row", "ohp", "lat_pulldown", "barbell_curl", "pushdown"]).filter((x) => x.suggested).map((x) => x.w.id);
    expect(top.filter((id) => ["band_pull_apart", "band_dislocate", "band_external_rotation", "band_face_pull"].includes(id)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("muscle reference", async () => {
  const { MUSCLES, MUSCLE_INFO } = await import("./exercises");
  it("every muscle has a short name that fits the list column, a full name, location and function", () => {
    for (const m of MUSCLES) {
      const i = MUSCLE_INFO[m];
      expect(i, m).toBeTruthy();
      expect(i.short.length, m).toBeLessThanOrEqual(15);
      expect(i.full.length && i.where.length > 5 && i.does.length > 20, m).toBe(true);
    }
  });
});
