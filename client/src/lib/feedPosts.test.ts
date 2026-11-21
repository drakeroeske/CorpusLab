import { describe, expect, it } from "vitest";
import { activityPost, goalPost } from "./feedPosts";
import { toKm } from "./activities";
import type { Activity, PersonalGoal } from "./types";

describe("feed posts for activities and goals", () => {
  it("a run shows distance as the headline and the summary underneath", () => {
    const a: Activity = { id: "a1", type: "run", date: "2026-11-21", start: 0, durationSec: 2530, distanceKm: toKm(5.02, "lb"), rpe: 7 };
    const p = activityPost(a, "lb");
    expect(p).toMatchObject({ type: "activity", sessionId: "a1", sessionName: "Run", badge: "RUN", headline: "5.02 MI", durationMin: 42 });
    expect(p.detail).toMatch(/^5\.02 mi · 42:10 · 8:24 \/mi$/);
  });
  it("a WOD shows its format", () => {
    const a: Activity = { id: "w", type: "wod", date: "2026-11-21", start: 0, durationSec: 720, name: "Cindy", wod: { format: "amrap", rounds: 18, reps: 7, rx: true, movements: [] } };
    expect(activityPost(a, "lb")).toMatchObject({ headline: "AMRAP 12", sessionName: "Cindy", badge: "WOD" });
  });
  it("bodyweight goals post without the numbers; others show the goal", () => {
    const bw: PersonalGoal = { id: "g1", kind: "bodyweight", createdAt: "2026-10-01", start: 200, target: 185 };
    const p = goalPost(bw, "lb");
    expect(p.detail).toBe("Reached a bodyweight goal");
    expect(JSON.stringify(p)).not.toMatch(/185|200/);
    const lift: PersonalGoal = { id: "g2", kind: "lift", createdAt: "2026-10-01", exId: "bench_press", weight: 225, reps: 1, startE1rm: 200 };
    expect(goalPost(lift, "lb")).toMatchObject({ type: "goal", sessionId: "goal:g2", badge: "GOAL REACHED", detail: "Bench Press: 225 lb × 1" });
  });
});
