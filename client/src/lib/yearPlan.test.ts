import { describe, expect, it } from "vitest";
import { applyDueBlocks, blockCovering, blockEnd, nextFreeStart, overlaps, upcomingSwitch } from "./yearPlan";
import { emptyState } from "./empty";
import type { AppState, PlanBlock, Program } from "./types";

const prog = (name: string): Program => ({ name, startDate: "2026-01-01", days: [{ id: "d_" + name, name: "Day", weekdays: [1], exercises: [{ id: "pe_" + name, exId: "bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 100, increment: 5, style: "double", technique: null }] }], rotation: ["d_" + name, null] });
const base = (): AppState => ({
  ...emptyState(),
  profile: { name: "T", units: "lb", bodyWeight: 200, heightCm: 180, age: 30, sex: "m", experience: "intermediate", goal: "fatloss", gym: "", coachMode: false, onboarded: true, barWeight: 45 },
  program: prog("Current"),
  savedPrograms: [{ id: "sp_b", name: "Program B", savedAt: 0, source: "mine", program: prog("B") }],
});
const bulk: PlanBlock = { id: "b1", name: "Winter bulk", start: "2026-12-01", weeks: 12, programId: "sp_b", diet: "muscle" };

describe("year plan", () => {
  it("computes block dates and where the next one goes", () => {
    expect(blockEnd(bulk)).toBe("2027-02-22");
    expect(blockCovering([bulk], "2027-01-10")?.id).toBe("b1");
    expect(nextFreeStart([bulk], "2026-11-24")).toBe("2027-02-23");
    expect(overlaps([bulk, { ...bulk, id: "b2", start: "2027-02-01" }]).size).toBe(2);
  });
  it("gives a heads-up the day before", () => {
    expect(upcomingSwitch({ ...base(), yearPlan: [bulk] }, "2026-11-30")?.text).toMatch(/Tomorrow Winter bulk starts: switching to Program B and bulk phase for 12 weeks/);
    expect(upcomingSwitch({ ...base(), yearPlan: [bulk] }, "2026-11-20")).toBeNull();
  });
  it("switches program and diet on the start date and keeps the old program", () => {
    const before = { ...base(), yearPlan: [bulk] };
    expect(applyDueBlocks(before, "2026-11-30").switched).toBeNull();
    const { state, switched } = applyDueBlocks(before, "2026-12-01");
    expect(switched?.program).toBe("Program B");
    expect(state.program?.name).toBe("Program B");
    expect(state.program?.startDate).toBe("2026-12-01");
    expect(state.program?.rotation?.[0]).toBe(state.program?.days[0].id); // rotation follows the new day ids
    expect(state.profile?.goal).toBe("muscle");
    expect(state.savedPrograms?.some((x) => x.name === "Current")).toBe(true);
    expect(applyDueBlocks(state, "2026-12-02").switched).toBeNull(); // only once
  });
  it("catches up after the app wasn't opened, applying only the block that's running now", () => {
    const cut: PlanBlock = { id: "b2", name: "Spring cut", start: "2027-02-23", weeks: 8, programId: null, diet: "fatloss" };
    const { state, switched } = applyDueBlocks({ ...base(), yearPlan: [bulk, cut] }, "2027-03-05");
    expect(switched?.block.id).toBe("b2");
    expect(state.program?.name).toBe("Current"); // the cut keeps whatever you're running
    expect(state.yearPlan?.every((b) => b.appliedAt)).toBe(true);
  });
});
