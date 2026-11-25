import { describe, expect, it } from "vitest";
import { balancedCalTarget, type NutritionTargets } from "./engine";

// 2,500 flat, BMR 1,800. 2026-11-23 is a Monday.
const t = { cal: 2500, highCal: 2500, lowCal: 2500, bmr: 1800, split: { mode: "flat", amount: 0 } } as unknown as NutritionTargets;
const flat = () => false;

describe("weekly calorie rebalancing", () => {
  it("spreads an over day across the rest of the week", () => {
    const b = balancedCalTarget(t, "2026-11-25", flat, { "2026-11-23": 2500, "2026-11-24": 3500 }); // Wed, Tue was +1,000
    expect(b.weekDiff).toBe(1000);
    expect(b.daysLeft).toBe(5);
    expect(b.adjust).toBe(-200);
    expect(b.target).toBe(2300);
  });
  it("gives back calories after an under day", () => {
    const b = balancedCalTarget(t, "2026-11-25", flat, { "2026-11-23": 2000, "2026-11-24": 2000 });
    expect(b.adjust).toBe(200);
  });
  it("ignores unlogged days and small differences", () => {
    expect(balancedCalTarget(t, "2026-11-25", flat, { "2026-11-24": 2560 }).adjust).toBe(0);
    expect(balancedCalTarget(t, "2026-11-25", flat, {}).weekDiff).toBe(0);
  });
  it("caps each day at 15% and never drops below BMR", () => {
    const b = balancedCalTarget(t, "2026-11-29", flat, { "2026-11-28": 6000 }); // Sunday after a huge Saturday
    expect(b.target).toBe(2130);
    expect(b.capped).toBe(true);
    const low = { ...t, cal: 1900, highCal: 1900, lowCal: 1900 } as NutritionTargets;
    expect(balancedCalTarget(low, "2026-11-29", flat, { "2026-11-28": 4000 }).target).toBe(1800);
  });
  it("starts fresh on Monday and can be turned off", () => {
    expect(balancedCalTarget(t, "2026-11-30", flat, { "2026-11-29": 4000 }).adjust).toBe(0);
    expect(balancedCalTarget(t, "2026-11-25", flat, { "2026-11-24": 3500 }, false).adjust).toBe(0);
  });
});
