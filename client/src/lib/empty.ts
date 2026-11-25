import type { AppState } from "./types";
import { upgradeExerciseMuscles, upgradeMuscles } from "./exercises";

export const emptyState = (): AppState => ({
  version: 4, profile: null, program: null, sessions: [], checkins: [], meals: [], favorites: [], recentFoods: [],
  experiments: [], photos: [], measurements: [], spotters: [], feed: [], crews: [], gymCheckin: null,
  clients: [], chat: [], activeSession: null, restDefaults: { compound: 180, isolation: 90 }, demo: false,
});

/** Bring older saved states up to the current schema. Idempotent. */
export function upgradeState(raw: Partial<AppState> | null | undefined): AppState {
  const s: AppState = { ...emptyState(), ...(raw ?? {}) };
  // A state saved without a version predates nothing we can detect; treat it like the last unversioned schema (v2).
  const v = typeof raw?.version === "number" ? raw.version : raw ? 2 : 4;
  if (v < 2) {
    // v1 soreness was 1 (none) → 5; v2 is 0/absent (none) → 5 so every heat color is reachable.
    s.checkins = (s.checkins ?? []).map((c) => {
      const soreness: typeof c.soreness = {};
      for (const [m, val] of Object.entries(c.soreness ?? {})) { const n = Math.max(0, (val ?? 1) - 1); if (n) (soreness as Record<string, number>)[m] = n; }
      return { ...c, soreness };
    });
  }
  if (v < 3) {
    // v3 splits muscles into heads (shoulders → front + side delts, quads → vasti + rectus femoris, …).
    // Custom exercises keep their tiers; soreness on an old muscle carries to every part of it.
    s.customExercises = (s.customExercises ?? []).map((e) => upgradeExerciseMuscles(e));
    s.checkins = (s.checkins ?? []).map((c) => {
      const soreness: typeof c.soreness = {};
      for (const [m, val] of Object.entries(c.soreness ?? {})) {
        for (const x of upgradeMuscles([m])) soreness[x] = Math.max(soreness[x] ?? 0, val ?? 0);
      }
      return { ...c, soreness };
    });
    if (s.program?.customExercises) s.program = { ...s.program, customExercises: s.program.customExercises.map((e) => upgradeExerciseMuscles(e)) };
  }
  if (v < 4 && s.program && s.profile?.units !== "kg") {
    // v4: templates used a 10 lb minimum jump on squats, deadlifts, leg press and hip thrusts. Every barbell loads in
    // 5 lb steps, and the % rule already makes heavy lifts jump 10, so bring those to 5 lb.
    const BIG = new Set(["back_squat", "deadlift", "trap_bar_dl", "leg_press", "hip_thrust", "rdl"]);
    s.program = { ...s.program, days: s.program.days.map((d) => ({ ...d, exercises: d.exercises.map((pe) => (BIG.has(pe.exId) && pe.increment === 10 ? { ...pe, increment: 5 } : pe)) })) };
  }
  s.version = 4;
  return s;
}
