import { describe, expect, it } from "vitest";
import { READINESS_BANDS, loadScore, normalizeScore, readinessAriaLabel, readinessBand, trainingLoadInputs, type LoadSession } from "./readiness";
import { computeReadiness, readinessEffect } from "./engine";

describe("normalizeScore", () => {
  it("passes whole numbers in range through", () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(58)).toBe(58);
    expect(normalizeScore(100)).toBe(100);
  });
  it("rounds decimals", () => {
    expect(normalizeScore(57.4)).toBe(57);
    expect(normalizeScore(74.5)).toBe(75);
  });
  it("clamps negatives to 0 and >100 to 100", () => {
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(-0.4)).toBe(0);
    expect(normalizeScore(140)).toBe(100);
  });
  it("treats null, undefined, NaN and Infinity as no score", () => {
    expect(normalizeScore(null)).toBeNull();
    expect(normalizeScore(undefined)).toBeNull();
    expect(normalizeScore(NaN)).toBeNull();
    expect(normalizeScore(Infinity)).toBeNull();
    expect(normalizeScore(-Infinity)).toBeNull();
  });
});

describe("readinessBand", () => {
  it.each([
    [0, "low"], [34, "low"], [49, "low"],
    [50, "moderate"], [58, "moderate"], [74, "moderate"],
    [75, "high"], [100, "high"],
  ] as const)("%s → %s", (v, band) => {
    expect(readinessBand(v)).toBe(band);
  });
  it("uses the rounded score at the edges", () => {
    expect(readinessBand(49.4)).toBe("low");
    expect(readinessBand(49.5)).toBe("moderate");
    expect(readinessBand(74.6)).toBe("high");
  });
  it("clamps out-of-range values", () => {
    expect(readinessBand(-20)).toBe("low");
    expect(readinessBand(250)).toBe("high");
  });
  it("returns null with no score", () => {
    expect(readinessBand(null)).toBeNull();
    expect(readinessBand(undefined)).toBeNull();
    expect(readinessBand(NaN)).toBeNull();
  });
  it("has the agreed labels, tags and colors", () => {
    expect(READINESS_BANDS.high).toMatchObject({ label: "HIGH", tag: "PUSH", color: "#E94191" });
    expect(READINESS_BANDS.moderate).toMatchObject({ label: "MODERATE", tag: "HOLD", color: "#B8236A" });
    expect(READINESS_BANDS.low).toMatchObject({ label: "LOW", tag: "EASE OFF", color: "#1A1A1A" });
  });
});

describe("readinessEffect agrees with the bands", () => {
  it.each([[0, "reduce"], [49, "reduce"], [50, "hold"], [74, "hold"], [75, "normal"], [100, "normal"], [null, "normal"]] as const)("%s → %s", (v, effect) => {
    expect(readinessEffect(v)).toBe(effect);
  });
});

describe("readinessAriaLabel", () => {
  it("reads score, band and recommendation", () => {
    expect(readinessAriaLabel(58)).toBe("Readiness 58 percent, moderate. Hold.");
    expect(readinessAriaLabel(34)).toBe("Readiness 34 percent, low. Ease off.");
    expect(readinessAriaLabel(100)).toBe("Readiness 100 percent, high. Push.");
  });
  it("says when there's no data", () => {
    expect(readinessAriaLabel(null)).toBe("Readiness, no check-in yet");
  });
  it("adds low confidence", () => {
    expect(readinessAriaLabel(58, { lowConfidence: true })).toBe("Readiness 58 percent, moderate. Hold. Low confidence.");
  });
  it("reads the clamped value", () => {
    expect(readinessAriaLabel(-3)).toBe("Readiness 0 percent, low. Ease off.");
    expect(readinessAriaLabel(120)).toBe("Readiness 100 percent, high. Push.");
  });
});

describe("loadScore", () => {
  it("is full at or below usual", () => {
    expect(loadScore(0, 20)).toBe(1);
    expect(loadScore(20, 20)).toBe(1);
  });
  it("drops in a straight line to zero at 50% above usual", () => {
    expect(loadScore(25, 20)).toBeCloseTo(0.5);
    expect(loadScore(30, 20)).toBe(0);
    expect(loadScore(60, 20)).toBe(0);
  });
  it("is left out with no usual to compare with", () => {
    expect(loadScore(10, null)).toBeNull();
    expect(loadScore(10, 0)).toBeNull();
    expect(loadScore(NaN, 20)).toBeNull();
  });
  it("treats negative counts as zero", () => {
    expect(loadScore(-4, 20)).toBe(1);
  });
});

describe("trainingLoadInputs", () => {
  const s = (date: string, sets: number, done = true): LoadSession => ({ date, end: done ? 1 : null, exercises: [{ sets: Array(sets).fill({}) }] });
  it("counts the 2 days before today, not today", () => {
    const r = trainingLoadInputs([s("2026-11-09", 50), s("2026-11-08", 10), s("2026-11-07", 12), s("2026-10-01", 1)], "2026-11-09");
    expect(r.recent).toBe(22);
  });
  it("ignores unfinished sessions", () => {
    const r = trainingLoadInputs([s("2026-11-08", 10, false), s("2026-10-01", 1)], "2026-11-09");
    expect(r.recent).toBe(0);
  });
  it("needs 2 weeks of history", () => {
    expect(trainingLoadInputs([s("2026-11-08", 10), s("2026-11-01", 10)], "2026-11-09").usual).toBeNull();
    expect(trainingLoadInputs([s("2026-11-08", 10), s("2026-10-20", 10)], "2026-11-09").usual).not.toBeNull();
  });
  it("averages the 28 days before the window into a 2-day usual", () => {
    // 14 sets on each of 14 days within days 3–30 back → 196 sets / 28 days × 2 = 14
    const back = (n: number) => new Date(Date.UTC(2026, 10, 9 - n)).toISOString().slice(0, 10);
    const past = Array.from({ length: 14 }, (_, i) => s(back(3 + i * 2), 14)); // days 3, 5 … 29 back
    const r = trainingLoadInputs([...past, s("2026-10-01", 0)], "2026-11-09");
    expect(r.usual).toBeCloseTo(14);
  });
});

describe("computeReadiness with training load", () => {
  // Every check-in input present (HRV at its baseline), so the weights are exactly as listed.
  const ci = { date: "2026-11-09", sleepH: 8, sleepQ: 5, energy: 5, stress: 1, hrv: 60, soreness: {} };
  it("scores 100 with everything maxed, load included", () => {
    expect(computeReadiness(ci, 60, [], 1).score).toBe(100);
  });
  it("a heavy 2 days costs 15 points", () => {
    const fresh = computeReadiness(ci, 60, [], 1);
    const heavy = computeReadiness(ci, 60, [], 0);
    expect(fresh.score! - heavy.score!).toBe(15);
    expect(heavy.parts.find((p) => p.key === "load")?.pts).toBe(0);
  });
  it("a missing input spreads its points across the rest", () => {
    const heavy = computeReadiness({ ...ci, hrv: null }, null, [], 0);
    expect(heavy.parts.find((p) => p.key === "load")?.max).toBeCloseTo((15 * 100) / 83);
  });
  it("leaves load out when unknown, and the rest still adds to 100", () => {
    const r = computeReadiness(ci, 60, [], null);
    expect(r.score).toBe(100);
    expect(r.parts.find((p) => p.key === "load")?.present).toBe(false);
  });
  it("has no score without a check-in", () => {
    expect(computeReadiness(undefined, 60, [], 1).score).toBeNull();
  });
});
