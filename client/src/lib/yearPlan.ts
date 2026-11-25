// Year plan: dated blocks (program + diet phase) that switch automatically when they start.
import { addDays, daysBetween } from "./engine";
import { newId } from "./exercises";
import type { AppState, Goal, PlanBlock, Program, SavedProgram } from "./types";

export const DIET_LABEL: Record<Goal, string> = { muscle: "Bulk", strength: "Strength", fatloss: "Cut", recomp: "Recomp" };
export const DIET_LONG: Record<Goal, string> = { muscle: "Bulk (build muscle)", strength: "Get stronger", fatloss: "Cut (lose fat)", recomp: "Recomp" };

export const blockEnd = (b: PlanBlock) => addDays(b.start, b.weeks * 7 - 1);
export const sortedBlocks = (plan: PlanBlock[] | undefined) => [...(plan ?? [])].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
export const blockCovering = (plan: PlanBlock[] | undefined, date: string) =>
  sortedBlocks(plan).filter((b) => b.start <= date && blockEnd(b) >= date).pop() ?? null;
export const nextBlock = (plan: PlanBlock[] | undefined, date: string) => sortedBlocks(plan).find((b) => b.start > date) ?? null;
/** Where a new block should start: the day after the last one ends, or tomorrow. */
export const nextFreeStart = (plan: PlanBlock[] | undefined, today: string) => {
  const last = sortedBlocks(plan).filter((b) => blockEnd(b) >= today).pop();
  return last ? addDays(blockEnd(last), 1) : addDays(today, 1);
};
/** Blocks that overlap another one (the later start wins on overlapping days). */
export function overlaps(plan: PlanBlock[] | undefined): Set<string> {
  const s = sortedBlocks(plan), out = new Set<string>();
  for (let i = 1; i < s.length; i++) if (s[i].start <= blockEnd(s[i - 1])) { out.add(s[i].id); out.add(s[i - 1].id); }
  return out;
}

/** A saved program as a fresh running program: new ids (history is matched by exercise), starting on `startDate`. */
export function programFromSaved(sp: SavedProgram, startDate: string): Program {
  const ids = new Map<string, string>();
  const days = sp.program.days.map((d) => { const id = newId("day"); ids.set(d.id, id); return { ...d, id, exercises: d.exercises.map((e) => ({ ...e, id: newId("pe") })) }; });
  return { ...sp.program, name: sp.name, startDate, deloadUntil: null, days, rotation: sp.program.rotation ? sp.program.rotation.map((x) => (x ? ids.get(x) ?? null : null)) : sp.program.rotation };
}

/** Keep the program you're leaving in My programs: update the saved copy with the same name, or add one. */
export function stashCurrentProgram(state: AppState): SavedProgram[] {
  const saved = state.savedPrograms ?? [];
  const p = state.program;
  if (!p || !p.days.some((d) => d.exercises.length)) return saved;
  const i = saved.findIndex((x) => x.name === p.name);
  const copy: SavedProgram = { id: i >= 0 ? saved[i].id : newId("sp"), name: p.name, savedAt: Date.now(), source: "mine", program: { ...p, deloadUntil: null } };
  return i >= 0 ? saved.map((x, j) => (j === i ? copy : x)) : [copy, ...saved].slice(0, 30);
}

export interface PlanSwitch { block: PlanBlock; program?: string; diet?: Goal }

/**
 * Run the plan for `today`: the newest block that has started and not been applied gets applied (program switched,
 * the outgoing program saved to My programs, diet goal set). Older unapplied blocks that already ended are marked done.
 */
export function applyDueBlocks(state: AppState, today: string): { state: AppState; switched: PlanSwitch | null } {
  const plan = state.yearPlan ?? [];
  const due = sortedBlocks(plan).filter((b) => !b.appliedAt && b.start <= today);
  if (!due.length) return { state, switched: null };
  const now = Date.now();
  const current = due.filter((b) => blockEnd(b) >= today).pop() ?? null;
  let s: AppState = { ...state, yearPlan: plan.map((b) => (due.some((d) => d.id === b.id) ? { ...b, appliedAt: now } : b)) };
  if (!current) return { state: s, switched: null };
  const sw: PlanSwitch = { block: current };
  const sp = current.programId ? (s.savedPrograms ?? []).find((x) => x.id === current.programId) : null;
  if (sp) {
    const savedPrograms = stashCurrentProgram(s);
    s = { ...s, savedPrograms, program: programFromSaved(sp, current.start), activeSession: s.activeSession };
    sw.program = sp.name;
  }
  if (current.diet && s.profile) { s = { ...s, profile: { ...s.profile, goal: current.diet } }; sw.diet = current.diet; }
  return { state: s, switched: sw };
}

/** "Tomorrow: Program B · Cut (12 weeks)" for the heads-up the day before a block starts. */
export function upcomingSwitch(state: AppState, today: string): { block: PlanBlock; inDays: number; text: string } | null {
  const b = nextBlock(state.yearPlan, today);
  if (!b || b.appliedAt) return null;
  const inDays = daysBetween(today, b.start);
  if (inDays > 1) return null;
  const prog = b.programId ? (state.savedPrograms ?? []).find((x) => x.id === b.programId)?.name : null;
  const bits = [prog && `switching to ${prog}`, b.diet && `${DIET_LABEL[b.diet].toLowerCase()} phase`].filter(Boolean).join(" and ");
  return { block: b, inDays, text: `Tomorrow ${b.name} starts${bits ? `: ${bits}` : ""} for ${b.weeks} weeks.` };
}
