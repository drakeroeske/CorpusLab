import { newId } from "./exercises";
import type { ExerciseLog } from "./types";

/** Indexes of every exercise in the same superset as exercises[i], in workout order. Just [i] if it isn't in one. */
export function supersetGroup(exercises: ExerciseLog[], i: number): number[] {
  const id = exercises[i]?.superset;
  if (!id) return [i];
  return exercises.map((l, k) => (l.superset === id ? k : -1)).filter((k) => k >= 0);
}

/**
 * Put exercises[a] and exercises[b] in one superset (joining whichever superset either is already in),
 * and move the members next to each other, starting where the first member was.
 * Returns the new list and the new index of exercises[a] so the screen can stay on it.
 */
export function linkSuperset(exercises: ExerciseLog[], a: number, b: number): { exercises: ExerciseLog[]; index: number } {
  if (a === b || !exercises[a] || !exercises[b]) return { exercises, index: a };
  const ida = exercises[a].superset, idb = exercises[b].superset;
  const id = ida ?? idb ?? newId("ss");
  const marked = exercises.map((l, k) =>
    k === a || k === b || (ida && l.superset === ida) || (idb && l.superset === idb) ? { ...l, superset: id } : l,
  );
  const members = marked.filter((l) => l.superset === id);
  const first = marked.findIndex((l) => l.superset === id);
  const rest = marked.filter((l) => l.superset !== id);
  const before = marked.slice(0, first).filter((l) => l.superset !== id).length;
  const out = [...rest.slice(0, before), ...members, ...rest.slice(before)];
  return { exercises: out, index: out.indexOf(marked[a]) };
}

/** Take exercises[i] out of its superset. A superset left with one exercise is dissolved. */
export function unlinkSuperset(exercises: ExerciseLog[], i: number): ExerciseLog[] {
  const id = exercises[i]?.superset;
  if (!id) return exercises;
  const out = exercises.map((l, k) => (k === i ? { ...l, superset: null } : l));
  const left = out.filter((l) => l.superset === id).length;
  return left <= 1 ? out.map((l) => (l.superset === id ? { ...l, superset: null } : l)) : out;
}

/**
 * Where to go after logging a set on exercises[cur], given how many sets each exercise still needs.
 * Inside a superset: move straight to the next member that still has sets, with no rest.
 * After the last member (end of a round): rest, then go back to the first member with sets left.
 * Returns null when not in a superset or when nothing in it has sets left.
 */
export function afterSupersetSet(exercises: ExerciseLog[], cur: number, remaining: (i: number) => number): { goTo: number; rest: boolean } | null {
  const group = supersetGroup(exercises, cur);
  if (group.length < 2) return null;
  const pos = group.indexOf(cur);
  const later = group.slice(pos + 1).find((k) => remaining(k) > 0);
  if (later != null) return { goTo: later, rest: false };
  const first = group.find((k) => remaining(k) > 0);
  return first != null ? { goTo: first, rest: true } : null;
}
