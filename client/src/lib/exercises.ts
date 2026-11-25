import type { Exercise, LegacyMuscle, Muscle, Program, ProgramDay, ProgramExercise, Units } from "./types";

const E = (
  id: string, name: string, primary: Muscle[], secondary: Muscle[], stabilizers: Muscle[],
  equipment: Exercise["equipment"], pattern: Exercise["pattern"], ratio: number,
): Exercise => ({ id, name, primary, secondary, ...(stabilizers.length ? { stabilizers } : {}), equipment, pattern, ratio });

/** A carry or hold: logged as weight × seconds. */
const T = (id: string, name: string, primary: Muscle[], secondary: Muscle[], stabilizers: Muscle[], equipment: Exercise["equipment"], ratio: number): Exercise =>
  ({ ...E(id, name, primary, secondary, stabilizers, equipment, "hold", ratio), measure: "time" });

// Shorthands for muscles that always move together in a lift.
const BI: Muscle[] = ["biceps_long", "biceps_short"];
const ELBOW_FLEX: Muscle[] = [...BI, "brachialis"];
const BRACE: Muscle[] = ["abs", "obliques"];

/*
 * Every muscle a lift uses, in three tiers:
 *   primary (1 set) · secondary (0.5) · stabilizers (0.25, isometric bracing/holding)
 * ratio = rough working-load relative to the pattern's reference lift (dumbbells are per hand)
 */
export const EXERCISES: Exercise[] = [
  // squat
  E("back_squat", "Back Squat", ["vasti", "glute_max", "adductors"], ["rectus_femoris"], ["lower_back", ...BRACE, "hamstrings", "glute_med", "mid_back"], "barbell", "squat", 1),
  E("front_squat", "Front Squat", ["vasti"], ["glute_max", "adductors", "rectus_femoris"], [...BRACE, "lower_back", "mid_back", "traps_upper"], "barbell", "squat", 0.8),
  E("hack_squat", "Hack Squat", ["vasti"], ["glute_max", "adductors", "rectus_femoris"], [], "machine", "squat", 1.1),
  E("leg_press", "Leg Press", ["vasti", "glute_max"], ["adductors", "rectus_femoris"], [], "machine", "squat", 1.9),
  E("goblet_squat", "Goblet Squat", ["vasti", "glute_max"], ["adductors", "rectus_femoris"], [...BRACE, "lower_back", "mid_back", "biceps_short", "front_delts"], "dumbbell", "squat", 0.35),
  E("bulgarian_split", "Bulgarian Split Squat", ["vasti", "glute_max"], ["adductors", "glute_med", "rectus_femoris"], ["obliques", "hamstrings", "forearms"], "dumbbell", "squat", 0.25),
  E("smith_squat", "Smith Machine Squat", ["vasti", "glute_max"], ["adductors", "rectus_femoris"], [...BRACE, "lower_back"], "smith", "squat", 0.9),
  E("walking_lunge", "Walking Lunge", ["vasti", "glute_max"], ["adductors", "glute_med", "rectus_femoris"], ["hamstrings", "gastrocnemius", "soleus", "obliques", "forearms"], "dumbbell", "squat", 0.22),
  // hinge
  E("deadlift", "Deadlift", ["glute_max", "hamstrings", "lower_back"], ["vasti", "adductors", "forearms", "traps_upper"], ["lats", "mid_back", ...BRACE], "barbell", "hinge", 1),
  E("rdl", "Romanian Deadlift", ["hamstrings", "glute_max"], ["lower_back", "adductors", "forearms"], ["lats", "traps_upper", "mid_back", ...BRACE], "barbell", "hinge", 0.7),
  E("db_rdl", "Dumbbell RDL", ["hamstrings", "glute_max"], ["lower_back", "adductors", "forearms"], ["lats", "traps_upper", "mid_back", ...BRACE], "dumbbell", "hinge", 0.3),
  E("trap_bar_dl", "Trap Bar Deadlift", ["vasti", "glute_max", "hamstrings"], ["lower_back", "adductors", "forearms", "traps_upper"], ["lats", "mid_back", ...BRACE], "barbell", "hinge", 1.05),
  E("hip_thrust", "Barbell Hip Thrust", ["glute_max"], ["hamstrings", "glute_med", "adductors"], ["vasti", "abs"], "barbell", "hinge", 1.0),
  E("good_morning", "Good Morning", ["hamstrings", "lower_back"], ["glute_max", "adductors"], [...BRACE, "mid_back"], "barbell", "hinge", 0.45),
  E("kb_swing", "Kettlebell Swing", ["glute_max", "hamstrings"], ["lower_back", "adductors"], [...BRACE, "forearms", "mid_back", "front_delts"], "kettlebell", "hinge", 0.2),
  E("back_extension", "45° Back Extension", ["lower_back", "glute_max"], ["hamstrings"], ["adductors"], "bodyweight", "hinge", 0.15),
  // horizontal push
  E("bench_press", "Bench Press", ["chest_mid"], ["chest_upper", "front_delts", "triceps_lateral"], ["triceps_long", "lats", "mid_back"], "barbell", "horizontal_push", 1),
  E("incline_bench", "Incline Bench Press", ["chest_upper", "front_delts"], ["chest_mid", "triceps_lateral"], ["triceps_long", "side_delts", "mid_back"], "barbell", "horizontal_push", 0.82),
  E("db_bench", "Dumbbell Bench Press", ["chest_mid"], ["chest_upper", "front_delts", "triceps_lateral"], ["triceps_long", "side_delts", "biceps_short"], "dumbbell", "horizontal_push", 0.38),
  E("incline_db_press", "Incline Dumbbell Press", ["chest_upper", "front_delts"], ["chest_mid", "triceps_lateral"], ["triceps_long", "side_delts", "biceps_short"], "dumbbell", "horizontal_push", 0.33),
  E("machine_chest_press", "Machine Chest Press", ["chest_mid"], ["chest_upper", "front_delts", "triceps_lateral"], ["triceps_long"], "machine", "horizontal_push", 0.95),
  E("smith_bench", "Smith Machine Bench", ["chest_mid"], ["chest_upper", "front_delts", "triceps_lateral"], ["triceps_long", "mid_back"], "smith", "horizontal_push", 0.9),
  E("dips", "Weighted Dip", ["chest_mid", "triceps_lateral"], ["triceps_long", "front_delts"], ["abs", "lats"], "bodyweight", "horizontal_push", 0.3),
  E("pushup", "Push-up (weighted)", ["chest_mid"], ["chest_upper", "front_delts", "triceps_lateral"], [...BRACE, "triceps_long", "glute_max", "vasti"], "bodyweight", "horizontal_push", 0.2),
  // vertical push
  E("ohp", "Overhead Press", ["front_delts"], ["side_delts", "triceps_lateral", "triceps_long", "chest_upper", "traps_upper"], [...BRACE, "lower_back", "glute_max"], "barbell", "vertical_push", 1),
  E("db_shoulder_press", "Seated DB Shoulder Press", ["front_delts"], ["side_delts", "triceps_lateral", "triceps_long", "chest_upper"], ["traps_upper", "abs"], "dumbbell", "vertical_push", 0.42),
  E("machine_shoulder_press", "Machine Shoulder Press", ["front_delts"], ["side_delts", "triceps_lateral", "triceps_long"], ["chest_upper", "traps_upper"], "machine", "vertical_push", 1.05),
  E("landmine_press", "Landmine Press", ["front_delts", "chest_upper"], ["triceps_lateral", "side_delts"], ["triceps_long", ...BRACE, "glute_max"], "barbell", "vertical_push", 0.55),
  E("arnold_press", "Arnold Press", ["front_delts"], ["side_delts", "triceps_lateral", "triceps_long", "chest_upper"], ["traps_upper", "abs"], "dumbbell", "vertical_push", 0.36),
  // horizontal pull
  E("barbell_row", "Barbell Row", ["mid_back", "lats"], ["rear_delts", ...ELBOW_FLEX, "lower_back"], ["hamstrings", "glute_max", "forearms", "traps_upper", ...BRACE], "barbell", "horizontal_pull", 1),
  E("db_row", "One-Arm Dumbbell Row", ["lats", "mid_back"], ["rear_delts", ...ELBOW_FLEX], ["forearms", "obliques", "traps_upper"], "dumbbell", "horizontal_pull", 0.45),
  E("cable_row", "Seated Cable Row", ["mid_back", "lats"], ["rear_delts", ...ELBOW_FLEX], ["forearms", "lower_back", "traps_upper"], "cable", "horizontal_pull", 0.9),
  E("chest_supported_row", "Chest-Supported Row", ["mid_back", "lats"], ["rear_delts", ...ELBOW_FLEX], ["forearms", "traps_upper"], "machine", "horizontal_pull", 0.85),
  E("tbar_row", "T-Bar Row", ["mid_back", "lats"], ["rear_delts", ...ELBOW_FLEX, "lower_back"], ["hamstrings", "glute_max", "forearms", "traps_upper", ...BRACE], "barbell", "horizontal_pull", 0.8),
  E("pendlay_row", "Pendlay Row", ["mid_back", "lats"], ["rear_delts", ...ELBOW_FLEX, "lower_back"], ["hamstrings", "glute_max", "forearms", "traps_upper", ...BRACE], "barbell", "horizontal_pull", 0.95),
  E("inverted_row", "Inverted Row", ["mid_back"], ["lats", "rear_delts", ...ELBOW_FLEX], [...BRACE, "glute_max", "forearms"], "bodyweight", "horizontal_pull", 0.2),
  // vertical pull
  E("lat_pulldown", "Lat Pulldown", ["lats"], [...ELBOW_FLEX, "mid_back"], ["rear_delts", "triceps_long", "forearms", "abs"], "cable", "vertical_pull", 1),
  E("pullup", "Pull-up (weighted)", ["lats"], [...ELBOW_FLEX, "mid_back", "forearms"], ["rear_delts", "triceps_long", ...BRACE, "hip_flexors"], "bodyweight", "vertical_pull", 0.25),
  E("chinup", "Chin-up (weighted)", ["lats", ...BI], ["brachialis", "mid_back", "forearms"], ["rear_delts", "triceps_long", ...BRACE, "hip_flexors"], "bodyweight", "vertical_pull", 0.28),
  E("neutral_pulldown", "Neutral-Grip Pulldown", ["lats"], [...ELBOW_FLEX, "mid_back"], ["rear_delts", "triceps_long", "forearms", "abs"], "cable", "vertical_pull", 1.05),
  E("machine_pulldown", "Machine Pulldown", ["lats"], [...ELBOW_FLEX, "mid_back"], ["rear_delts", "forearms"], "machine", "vertical_pull", 1.1),
  E("assisted_pullup", "Assisted Pull-up", ["lats"], [...ELBOW_FLEX, "mid_back"], ["rear_delts", "forearms", "abs"], "machine", "vertical_pull", 0.6),
  // isolation — chest
  E("cable_fly", "Cable Fly", ["chest_mid"], ["chest_upper", "front_delts"], ["biceps_short", "abs"], "cable", "isolation", 1),
  E("pec_deck", "Pec Deck", ["chest_mid"], ["chest_upper", "front_delts"], [], "machine", "isolation", 1.6),
  E("db_fly", "Dumbbell Fly", ["chest_mid"], ["chest_upper", "front_delts"], [...BI], "dumbbell", "isolation", 0.5),
  // isolation — shoulders
  E("lateral_raise", "Dumbbell Lateral Raise", ["side_delts"], ["front_delts", "traps_upper"], ["forearms"], "dumbbell", "isolation", 1),
  E("cable_lateral", "Cable Lateral Raise", ["side_delts"], ["front_delts", "traps_upper"], ["obliques"], "cable", "isolation", 0.75),
  E("machine_lateral", "Machine Lateral Raise", ["side_delts"], ["front_delts", "traps_upper"], [], "machine", "isolation", 2.0),
  E("face_pull", "Face Pull", ["rear_delts"], ["mid_back", "side_delts"], ["traps_upper", "forearms"], "cable", "isolation", 1),
  E("reverse_fly", "Reverse Pec Deck", ["rear_delts"], ["mid_back"], ["side_delts", "traps_upper"], "machine", "isolation", 1.1),
  // isolation — arms
  E("barbell_curl", "Barbell Curl", [...BI], ["brachialis", "forearms"], ["front_delts", "abs"], "barbell", "isolation", 1),
  E("db_curl", "Dumbbell Curl", [...BI], ["brachialis", "forearms"], ["front_delts"], "dumbbell", "isolation", 0.45),
  E("hammer_curl", "Hammer Curl", ["brachialis", "forearms"], [...BI], ["front_delts"], "dumbbell", "isolation", 0.5),
  E("cable_curl", "Cable Curl", [...BI], ["brachialis", "forearms"], ["front_delts"], "cable", "isolation", 0.9),
  E("pushdown", "Triceps Pushdown", ["triceps_lateral"], ["triceps_long"], ["forearms", "abs"], "cable", "isolation", 1),
  E("skullcrusher", "EZ-Bar Skullcrusher", ["triceps_long", "triceps_lateral"], [], ["forearms"], "barbell", "isolation", 0.8),
  E("oh_triceps_ext", "Overhead Cable Extension", ["triceps_long"], ["triceps_lateral"], [...BRACE], "cable", "isolation", 0.85),
  // isolation — legs/hips/core
  E("leg_extension", "Leg Extension", ["vasti", "rectus_femoris"], [], [], "machine", "isolation", 1),
  E("leg_curl", "Seated Leg Curl", ["hamstrings"], ["gastrocnemius"], [], "machine", "isolation", 1),
  E("lying_leg_curl", "Lying Leg Curl", ["hamstrings"], ["gastrocnemius"], ["glute_max"], "machine", "isolation", 0.85),
  E("hip_abduction", "Hip Abduction Machine", ["glute_med"], ["glute_max"], [], "machine", "isolation", 1),
  E("hip_adduction", "Hip Adduction Machine", ["adductors"], [], [], "machine", "isolation", 1),
  E("calf_raise", "Standing Calf Raise", ["gastrocnemius"], ["soleus"], [], "machine", "isolation", 1),
  E("seated_calf", "Seated Calf Raise", ["soleus"], ["gastrocnemius"], [], "machine", "isolation", 0.7),
  E("hanging_leg_raise", "Hanging Leg Raise", ["abs", "hip_flexors"], ["obliques"], ["forearms", "lats"], "bodyweight", "isolation", 1),
  E("cable_crunch", "Cable Crunch", ["abs"], ["obliques"], ["lats"], "cable", "isolation", 1),
  E("cable_woodchop", "Cable Woodchop", ["obliques"], ["abs"], ["front_delts", "glute_max"], "cable", "isolation", 0.5),
  // CrossFit / Olympic lifting
  E("power_clean", "Power Clean", ["glute_max", "hamstrings", "traps_upper"], ["vasti", "lower_back", "side_delts", "mid_back", "forearms"], ["abs", "obliques", "gastrocnemius", "biceps_long"], "barbell", "hinge", 0.6),
  E("clean_and_jerk", "Clean & Jerk", ["glute_max", "vasti", "front_delts"], ["hamstrings", "traps_upper", "triceps_lateral", "lower_back", "side_delts", "adductors"], [...BRACE, "mid_back", "forearms", "gastrocnemius"], "barbell", "hinge", 0.55),
  E("snatch", "Snatch", ["glute_max", "hamstrings", "traps_upper"], ["vasti", "side_delts", "mid_back", "lower_back", "adductors"], [...BRACE, "front_delts", "triceps_long", "forearms", "gastrocnemius"], "barbell", "hinge", 0.45),
  E("thruster", "Thruster", ["vasti", "glute_max", "front_delts"], ["adductors", "triceps_lateral", "triceps_long", "side_delts", "rectus_femoris"], [...BRACE, "lower_back", "mid_back", "traps_upper"], "barbell", "squat", 0.45),
  E("wall_ball", "Wall Ball", ["vasti", "glute_max", "front_delts"], ["adductors", "triceps_lateral", "rectus_femoris"], [...BRACE, "lower_back", "side_delts"], "bodyweight", "squat", 0.08),
  E("air_squat", "Air Squat", ["vasti", "glute_max"], ["adductors", "rectus_femoris"], [...BRACE, "lower_back"], "bodyweight", "squat", 0.05),
  E("box_jump", "Box Jump", ["vasti", "glute_max"], ["gastrocnemius", "soleus", "hamstrings", "rectus_femoris"], [...BRACE, "adductors"], "bodyweight", "squat", 0.05),
  E("burpee", "Burpee", ["chest_mid", "vasti"], ["front_delts", "triceps_lateral", "glute_max", "abs", "hip_flexors"], ["obliques", "gastrocnemius", "triceps_long"], "bodyweight", "isolation", 1),
  E("toes_to_bar", "Toes-to-Bar", ["abs", "hip_flexors"], ["obliques", "lats", "forearms"], ["triceps_long", "mid_back"], "bodyweight", "isolation", 1),
  E("double_under", "Double-Under", ["gastrocnemius", "soleus"], ["front_delts", "forearms"], [...BRACE, "vasti"], "bodyweight", "isolation", 1),
  // Carries & holds: weight × time. A set's reps field holds seconds.
  T("farmers_carry", "Farmer's Carry", ["forearms", "traps_upper"], ["glute_med", "obliques", "abs", "mid_back"], ["vasti", "glute_max", "lower_back", "gastrocnemius"], "dumbbell", 1),
  T("trap_bar_carry", "Trap Bar Carry", ["forearms", "traps_upper"], ["glute_med", "obliques", "abs", "vasti", "glute_max"], ["lower_back", "mid_back", "gastrocnemius"], "barbell", 2.2),
  T("suitcase_carry", "Suitcase Carry", ["obliques", "forearms"], ["glute_med", "traps_upper", "abs"], ["lower_back", "mid_back"], "dumbbell", 0.8),
  T("overhead_carry", "Overhead Carry", ["front_delts", "side_delts"], ["triceps_lateral", "traps_upper", "abs", "obliques"], ["forearms", "mid_back", "triceps_long"], "dumbbell", 0.4),
  T("sled_push", "Sled Push", ["vasti", "glute_max"], ["gastrocnemius", "soleus", "hamstrings", "rectus_femoris"], [...BRACE, "front_delts", "triceps_lateral"], "machine", 3),
  T("plank", "Plank", ["abs"], ["obliques"], ["front_delts", "glute_max", "vasti", "chest_mid"], "bodyweight", 1),
  T("side_plank", "Side Plank", ["obliques"], ["glute_med", "abs"], ["side_delts", "adductors"], "bodyweight", 1),
  T("dead_hang", "Dead Hang", ["forearms"], ["lats"], ["rear_delts", "mid_back", "abs"], "bodyweight", 1),
  T("wall_sit", "Wall Sit", ["vasti"], ["glute_max", "rectus_femoris"], ["adductors", "abs"], "bodyweight", 1),
  T("hollow_hold", "Hollow Body Hold", ["abs", "hip_flexors"], ["obliques"], ["rectus_femoris"], "bodyweight", 1),
  E("shrug", "Dumbbell Shrug", ["traps_upper"], ["forearms"], ["mid_back"], "dumbbell", "isolation", 1),
];

/* ---------- how much each muscle gets from one set ---------- */
export const TIER_WEIGHT = { primary: 1, secondary: 0.5, stabilizer: 0.25 } as const;

/** Every muscle the exercise trains with its share of one working set. A muscle listed twice keeps its highest tier. */
export function muscleShares(ex: Exercise): [Muscle, number][] {
  const out = new Map<Muscle, number>();
  const add = (list: Muscle[] | undefined, w: number) => list?.forEach((m) => { if (isMuscle(m) && (out.get(m) ?? 0) < w) out.set(m, w); });
  add(ex.primary, TIER_WEIGHT.primary);
  add(ex.secondary, TIER_WEIGHT.secondary);
  add(ex.stabilizers, TIER_WEIGHT.stabilizer);
  return [...out];
}

const BUILT_IN: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
const REGISTRY: Record<string, Exercise> = { ...BUILT_IN };
let CUSTOM: Exercise[] = [];

/** Stand-in for an id we don't know (e.g. a custom exercise from a program that wasn't imported). Never crashes a lookup. */
const unknownExercise = (id: string): Exercise => ({ id, name: "Unknown exercise", primary: [], secondary: [], equipment: "machine", pattern: "isolation", ratio: 1, custom: true });

/** Every exercise by id: the built-in catalog plus the user's own. Unknown ids return a harmless placeholder. */
export const EX: Record<string, Exercise> = new Proxy(REGISTRY, {
  get: (t, k) => (typeof k === "string" ? t[k] ?? unknownExercise(k) : undefined),
});

/** Swap the user's custom exercises into the lookup. Called by the store whenever they change. Idempotent. */
export function registerCustomExercises(list: Exercise[] | undefined) {
  const next = list ?? [];
  if (next === CUSTOM) return;
  for (const e of CUSTOM) if (!BUILT_IN[e.id]) delete REGISTRY[e.id];
  for (const e of next) if (!BUILT_IN[e.id]) REGISTRY[e.id] = { ...upgradeExerciseMuscles(e), custom: true };
  CUSTOM = next;
}

/** Built-in catalog plus the user's live (not deleted) custom exercises. */
export const allExercises = (): Exercise[] => [...CUSTOM.filter((e) => !e.archived).map((e) => REGISTRY[e.id]), ...EXERCISES];
export const customExercises = (): Exercise[] => CUSTOM.filter((e) => !e.archived).map((e) => REGISTRY[e.id]);
export const isKnownExercise = (id: string) => id in REGISTRY;

/** Muscles that, trained on their own, mean a single-joint (isolation) exercise. */
export const SMALL_MUSCLES: Muscle[] = [
  "biceps_long", "biceps_short", "brachialis", "triceps_long", "triceps_lateral", "forearms",
  "side_delts", "rear_delts", "traps_upper", "abs", "obliques", "hip_flexors", "glute_med", "adductors", "gastrocnemius", "soleus",
];

/** Best guess at the movement pattern from the main muscles (the user can change it). */
export function guessPattern(primary: Muscle[]): Exercise["pattern"] {
  if (primary.length && primary.every((m) => SMALL_MUSCLES.includes(m))) return "isolation";
  const has = (...ms: Muscle[]) => ms.some((m) => primary.includes(m));
  if (has("vasti")) return "squat";
  if (has("hamstrings", "glute_max", "lower_back")) return "hinge";
  if (has("chest_mid", "chest_upper")) return "horizontal_push";
  if (has("front_delts")) return "vertical_push";
  if (has("lats")) return "vertical_pull";
  if (has("mid_back")) return "horizontal_pull";
  return "isolation";
}

/** Custom exercises a program uses, so a shared copy can carry them. */
export function customExercisesIn(p: Program): Exercise[] {
  const ids = new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exId)));
  return CUSTOM.filter((e) => ids.has(e.id));
}

/** Muscles grouped by body region, in display order. */
export const MUSCLE_GROUPS: { id: string; label: string; muscles: Muscle[] }[] = [
  { id: "chest", label: "Chest", muscles: ["chest_upper", "chest_mid"] },
  { id: "shoulders", label: "Shoulders", muscles: ["front_delts", "side_delts", "rear_delts"] },
  { id: "arms", label: "Arms", muscles: ["biceps_long", "biceps_short", "brachialis", "triceps_long", "triceps_lateral", "forearms"] },
  { id: "back", label: "Back", muscles: ["lats", "traps_upper", "mid_back", "lower_back"] },
  { id: "core", label: "Core", muscles: ["abs", "obliques"] },
  { id: "hips", label: "Hips", muscles: ["glute_max", "glute_med", "hip_flexors", "adductors"] },
  { id: "legs", label: "Legs", muscles: ["rectus_femoris", "vasti", "hamstrings", "gastrocnemius", "soleus"] },
];

export const MUSCLES: Muscle[] = MUSCLE_GROUPS.flatMap((g) => g.muscles);
const MUSCLE_SET = new Set<string>(MUSCLES);
export const isMuscle = (m: unknown): m is Muscle => typeof m === "string" && MUSCLE_SET.has(m);

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest_upper: "Upper chest", chest_mid: "Mid/lower chest",
  front_delts: "Front delts", side_delts: "Side delts", rear_delts: "Rear delts",
  biceps_long: "Biceps long head", biceps_short: "Biceps short head", brachialis: "Brachialis",
  triceps_long: "Triceps long head", triceps_lateral: "Triceps lat/med head", forearms: "Forearms",
  lats: "Lats", traps_upper: "Upper traps", mid_back: "Mid traps/rhomboids", lower_back: "Lower back",
  abs: "Abs", obliques: "Obliques",
  glute_max: "Glute max", glute_med: "Glute medius", hip_flexors: "Hip flexors", adductors: "Adductors",
  rectus_femoris: "Rectus femoris", vasti: "Quads (vasti)", hamstrings: "Hamstrings", gastrocnemius: "Calves (gastroc)", soleus: "Soleus",
};

/** Muscle reference: a short label for tight lists, the anatomical name, where it is and what it does. */
export const MUSCLE_INFO: Record<Muscle, { short: string; full: string; where: string; does: string }> = {
  chest_upper: { short: "Upper chest", full: "Pectoralis major, clavicular head", where: "Upper chest, from the collarbone to the upper arm.", does: "Raises the arm forward and brings it across the body. Works most in incline presses and low-to-high flyes." },
  chest_mid: { short: "Mid chest", full: "Pectoralis major, sternal head", where: "Middle and lower chest, from the breastbone and ribs to the upper arm.", does: "Brings the arm across and down the body. The main mover in flat bench, dips and flyes." },
  front_delts: { short: "Front delts", full: "Anterior deltoid", where: "Front of the shoulder.", does: "Raises the arm forward. Works hard in overhead and incline pressing." },
  side_delts: { short: "Side delts", full: "Lateral (medial) deltoid", where: "Outside of the shoulder.", does: "Raises the arm out to the side and gives the shoulders their width. Lateral raises are its main exercise." },
  rear_delts: { short: "Rear delts", full: "Posterior deltoid", where: "Back of the shoulder.", does: "Pulls the arm back and turns it outward. Works in rows, face pulls and reverse flyes." },
  biceps_long: { short: "Biceps long", full: "Biceps brachii, long head", where: "Outer side of the front of the upper arm.", does: "Bends the elbow and turns the palm up. It crosses the shoulder, so curls with the arm behind you (incline curls) stretch it most." },
  biceps_short: { short: "Biceps short", full: "Biceps brachii, short head", where: "Inner side of the front of the upper arm.", does: "Bends the elbow and turns the palm up. Works hardest with the arm in front of the body (preacher curls)." },
  brachialis: { short: "Brachialis", full: "Brachialis", where: "Under the biceps, low on the front of the upper arm.", does: "The strongest elbow bender in any grip. Hammer and reverse curls target it." },
  triceps_long: { short: "Triceps long", full: "Triceps brachii, long head", where: "Back of the upper arm, inner side.", does: "Straightens the elbow and pulls the arm down. It crosses the shoulder, so overhead extensions stretch it most." },
  triceps_lateral: { short: "Triceps lat/med", full: "Triceps brachii, lateral and medial heads", where: "Back of the upper arm, outer side and deep near the elbow.", does: "Straighten the elbow. They carry most of the load in pushdowns, presses and lockouts." },
  forearms: { short: "Forearms", full: "Forearm flexors and extensors, incl. brachioradialis", where: "Between the elbow and the wrist.", does: "Grip, wrist control, and elbow bending with a thumbs-up grip." },
  lats: { short: "Lats", full: "Latissimus dorsi", where: "Sides of the back, from the lower spine and hips up to the upper arm.", does: "Pulls the arm down and back. The main mover in pull-ups, pulldowns and rows." },
  traps_upper: { short: "Upper traps", full: "Trapezius, upper fibers", where: "Between the neck and the shoulders.", does: "Lifts the shoulder blades (shrugs) and helps rotate them as the arm goes overhead. Holds heavy loads in deadlifts and carries." },
  mid_back: { short: "Mid back", full: "Middle and lower trapezius, rhomboids", where: "Between the shoulder blades.", does: "Squeezes the shoulder blades together and holds them steady. Key in rows and for a stable bench press." },
  lower_back: { short: "Lower back", full: "Erector spinae", where: "Along both sides of the lower spine.", does: "Keeps the spine straight under load. Works in deadlifts, squats, rows and every hinge." },
  abs: { short: "Abs", full: "Rectus abdominis", where: "Front of the stomach.", does: "Curls the trunk forward and braces the spine, keeping you rigid under heavy lifts." },
  obliques: { short: "Obliques", full: "Internal and external obliques", where: "Sides of the waist.", does: "Twist and side-bend the trunk, and resist twisting. Brace during one-sided and overhead work." },
  glute_max: { short: "Glute max", full: "Gluteus maximus", where: "The buttocks.", does: "Extends the hip: standing up out of a squat, locking out a deadlift. The body's biggest muscle." },
  glute_med: { short: "Glute med", full: "Gluteus medius", where: "Upper outer hip.", does: "Moves the leg out to the side and keeps the pelvis level on one leg. Stops the knees caving in on squats and lunges." },
  hip_flexors: { short: "Hip flexors", full: "Iliopsoas, plus rectus femoris and others", where: "Front of the hip, where the thigh meets the trunk.", does: "Lift the knee toward the chest. Work in leg raises, sprinting and sit-ups." },
  adductors: { short: "Adductors", full: "Adductor group, incl. adductor magnus", where: "Inner thigh.", does: "Pull the legs together. Adductor magnus also extends the hip, so wide squats and deadlifts work it hard." },
  rectus_femoris: { short: "Rectus fem.", full: "Rectus femoris", where: "Center of the front of the thigh.", does: "The one quad muscle that crosses the hip: straightens the knee and lifts the thigh. Leg extensions train it best." },
  vasti: { short: "Quads", full: "Vastus lateralis, medialis and intermedius", where: "Front and sides of the thigh.", does: "Straighten the knee. The main movers in squats, leg press and lunges." },
  hamstrings: { short: "Hamstrings", full: "Biceps femoris, semitendinosus, semimembranosus", where: "Back of the thigh.", does: "Bend the knee and extend the hip. Romanian deadlifts and leg curls train them best." },
  gastrocnemius: { short: "Calves", full: "Gastrocnemius", where: "Upper calf, the visible bulge.", does: "Points the foot and helps bend the knee. Trained with straight-leg calf raises." },
  soleus: { short: "Soleus", full: "Soleus", where: "Lower calf, underneath the gastrocnemius.", does: "Points the foot, especially with the knee bent. Seated calf raises target it, and it does much of the work in running." },
};

/** Region name for a muscle, e.g. front_delts → "Shoulders". Lets searches like "shoulders" or "quads" still match. */
export const MUSCLE_REGION: Record<Muscle, string> = Object.fromEntries(MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.label]))) as Record<Muscle, string>;
const SEARCH_ALIASES: Partial<Record<Muscle, string>> = {
  vasti: "quads quadriceps", rectus_femoris: "quads quadriceps", gastrocnemius: "calves", soleus: "calves",
  glute_max: "glutes", glute_med: "glutes", biceps_long: "biceps", biceps_short: "biceps", brachialis: "biceps arms",
  triceps_long: "triceps", triceps_lateral: "triceps", front_delts: "delts", side_delts: "delts", rear_delts: "delts",
  traps_upper: "upper back", mid_back: "upper back", chest_upper: "pecs", chest_mid: "pecs", obliques: "core", abs: "core",
};
/** Text a search box can match for a muscle: its label, region and common names. */
export const muscleSearchText = (m: Muscle) => `${MUSCLE_LABEL[m]} ${MUSCLE_REGION[m]} ${SEARCH_ALIASES[m] ?? ""}`.toLowerCase();

/** Small or supporting muscles: no "low volume" warning, since few programs train them directly. */
export const MINOR_MUSCLES = new Set<Muscle>(["brachialis", "forearms", "hip_flexors", "obliques", "soleus", "glute_med", "adductors", "rectus_femoris", "traps_upper"]);

/** Old (v2) muscle ids → the muscles they split into. */
export const LEGACY_MUSCLE: Record<LegacyMuscle, Muscle[]> = {
  chest: ["chest_mid", "chest_upper"],
  shoulders: ["front_delts", "side_delts"],
  triceps: ["triceps_long", "triceps_lateral"],
  biceps: ["biceps_long", "biceps_short"],
  upper_back: ["mid_back", "traps_upper"],
  glutes: ["glute_max", "glute_med"],
  quads: ["vasti", "rectus_femoris"],
  calves: ["gastrocnemius", "soleus"],
};

/** Map a list of possibly-old muscle ids onto the current ones (duplicates and unknown ids dropped). */
export function upgradeMuscles(list: unknown): Muscle[] {
  if (!Array.isArray(list)) return [];
  const out: Muscle[] = [];
  for (const m of list) {
    const next = isMuscle(m) ? [m] : LEGACY_MUSCLE[m as LegacyMuscle] ?? [];
    for (const x of next) if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** Bring a stored custom exercise up to the current muscle ids. A muscle stays in its highest tier only. */
export function upgradeExerciseMuscles<T extends Exercise>(e: T): T {
  const primary = upgradeMuscles(e.primary);
  const secondary = upgradeMuscles(e.secondary).filter((m) => !primary.includes(m));
  const stabilizers = upgradeMuscles(e.stabilizers).filter((m) => !primary.includes(m) && !secondary.includes(m));
  const { stabilizers: _drop, ...rest } = e;
  return { ...rest, primary, secondary, ...(stabilizers.length ? { stabilizers } : {}) } as T;
}

export const PATTERN_LABEL: Record<Exercise["pattern"], string> = {
  squat: "Squat", hinge: "Hinge", horizontal_push: "Horizontal push", vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull", vertical_pull: "Vertical pull", isolation: "Isolation", hold: "Carries & holds",
};

export const isCompound = (ex: Exercise) => ex.pattern !== "isolation" && ex.pattern !== "hold";

/** Logged as weight × seconds (carries, planks, hangs): a set's reps field holds seconds. */
export const isTimed = (ex: Exercise | string | undefined | null): boolean => {
  const e = typeof ex === "string" ? REGISTRY[ex] ?? BUILT_IN[ex] : ex;
  return e?.measure === "time";
};
/** "45 s" for timed exercises, "8" for reps; long holds read "1:30". */
export function fmtReps(ex: Exercise | string | undefined | null, n: number): string {
  if (!isTimed(ex)) return String(n);
  return n >= 90 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : `${n} s`;
}
/** The unit word for the rep field: "reps" or "s". */
export const repUnit = (ex: Exercise | string | undefined | null) => (isTimed(ex) ? "s" : "reps");
export const EQUIPMENT_LABEL: Record<Exercise["equipment"], string> = {
  barbell: "Barbell", dumbbell: "Dumbbell", machine: "Machine", cable: "Cable", bodyweight: "Bodyweight", smith: "Smith machine", kettlebell: "Kettlebell",
};
export const EQUIPMENT_LIST = Object.keys(EQUIPMENT_LABEL) as Exercise["equipment"][];

/* ---------- templates ---------- */
let uid = 0;
export const newId = (p = "id") => `${p}_${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** starting weights expressed in lb; converted when units = kg */
type Spec = [exId: string, sets: number, repMin: number, repMax: number, startLb: number];

function pe(spec: Spec, units: Units, scale: number): ProgramExercise {
  const [exId, sets, repMin, repMax, startLb] = spec;
  const ex = EX[exId];
  const compound = isCompound(ex);
  let inc: number;
  if (units === "lb") inc = 5; // 2.5 lb a side; the % rule makes heavy lifts jump more
  else inc = ex.equipment === "dumbbell" ? 2 : 2.5;
  const raw = startLb * scale;
  const w = units === "lb" ? raw : raw * 0.4536;
  const startWeight = Math.max(0, Math.round(w / inc) * inc);
  return {
    id: newId("pe"), exId, sets, repMin, repMax, startWeight, increment: inc,
    style: "double", technique: null,
  };
}

const T_UPPER_LOWER: { name: string; weekdays: number[]; ex: Spec[] }[] = [
  { name: "Upper A", weekdays: [1], ex: [["bench_press", 3, 6, 8, 185], ["barbell_row", 3, 6, 8, 155], ["ohp", 3, 6, 8, 115], ["lat_pulldown", 3, 8, 12, 140], ["lateral_raise", 3, 12, 15, 20], ["barbell_curl", 2, 8, 12, 65], ["pushdown", 2, 10, 15, 60]] },
  { name: "Lower A", weekdays: [2], ex: [["back_squat", 3, 5, 8, 245], ["rdl", 3, 8, 10, 185], ["leg_press", 3, 10, 15, 360], ["leg_curl", 3, 10, 15, 100], ["calf_raise", 3, 10, 15, 160], ["hanging_leg_raise", 3, 10, 15, 0]] },
  { name: "Upper B", weekdays: [4], ex: [["incline_db_press", 3, 8, 10, 60], ["chest_supported_row", 3, 8, 12, 130], ["db_shoulder_press", 3, 8, 12, 50], ["pullup", 3, 6, 10, 0], ["cable_fly", 3, 12, 15, 30], ["hammer_curl", 2, 10, 12, 30], ["oh_triceps_ext", 2, 10, 15, 50]] },
  { name: "Lower B", weekdays: [5], ex: [["deadlift", 3, 4, 6, 315], ["front_squat", 3, 6, 8, 165], ["bulgarian_split", 3, 8, 12, 40], ["lying_leg_curl", 3, 10, 15, 80], ["seated_calf", 3, 12, 15, 110], ["cable_crunch", 3, 10, 15, 80]] },
];

const T_PPL: { name: string; weekdays: number[]; ex: Spec[] }[] = [
  { name: "Push A", weekdays: [1], ex: [["bench_press", 4, 5, 8, 185], ["ohp", 3, 6, 8, 115], ["incline_db_press", 3, 8, 12, 55], ["lateral_raise", 3, 12, 15, 20], ["pushdown", 3, 10, 15, 60]] },
  { name: "Pull A", weekdays: [2], ex: [["deadlift", 3, 4, 6, 315], ["pullup", 3, 6, 10, 0], ["cable_row", 3, 8, 12, 150], ["face_pull", 3, 12, 15, 40], ["barbell_curl", 3, 8, 12, 65]] },
  { name: "Legs A", weekdays: [3], ex: [["back_squat", 4, 5, 8, 245], ["rdl", 3, 8, 10, 185], ["leg_extension", 3, 10, 15, 120], ["leg_curl", 3, 10, 15, 100], ["calf_raise", 4, 10, 15, 160]] },
  { name: "Push B", weekdays: [4], ex: [["incline_bench", 4, 6, 10, 155], ["db_shoulder_press", 3, 8, 12, 50], ["dips", 3, 8, 12, 25], ["cable_lateral", 3, 12, 15, 15], ["oh_triceps_ext", 3, 10, 15, 50]] },
  { name: "Pull B", weekdays: [5], ex: [["barbell_row", 4, 6, 10, 155], ["lat_pulldown", 3, 8, 12, 140], ["reverse_fly", 3, 12, 15, 60], ["hammer_curl", 3, 10, 12, 30], ["shrug", 3, 10, 15, 70]] },
  { name: "Legs B", weekdays: [6], ex: [["front_squat", 3, 6, 8, 165], ["hip_thrust", 3, 8, 12, 225], ["leg_press", 3, 10, 15, 360], ["lying_leg_curl", 3, 10, 15, 80], ["seated_calf", 3, 12, 15, 110], ["cable_crunch", 3, 10, 15, 80]] },
];

const T_FULL: { name: string; weekdays: number[]; ex: Spec[] }[] = [
  { name: "Full Body A", weekdays: [1], ex: [["back_squat", 3, 5, 8, 225], ["bench_press", 3, 6, 8, 175], ["barbell_row", 3, 6, 10, 145], ["lateral_raise", 2, 12, 15, 20], ["barbell_curl", 2, 8, 12, 60]] },
  { name: "Full Body B", weekdays: [3], ex: [["deadlift", 3, 4, 6, 295], ["ohp", 3, 6, 8, 105], ["lat_pulldown", 3, 8, 12, 130], ["leg_curl", 2, 10, 15, 90], ["pushdown", 2, 10, 15, 55]] },
  { name: "Full Body C", weekdays: [5], ex: [["front_squat", 3, 6, 8, 155], ["incline_db_press", 3, 8, 12, 55], ["cable_row", 3, 8, 12, 140], ["calf_raise", 3, 10, 15, 150], ["hanging_leg_raise", 2, 10, 15, 0]] },
];

export const TEMPLATES = [
  { id: "ul4", name: "Upper / Lower", desc: "4 days · Mon Tue Thu Fri", days: T_UPPER_LOWER },
  { id: "ppl6", name: "Push / Pull / Legs", desc: "6 days · Mon–Sat", days: T_PPL },
  { id: "fb3", name: "Full Body", desc: "3 days · Mon Wed Fri", days: T_FULL },
] as const;

export function buildTemplate(id: string, units: Units, experience: string, startDate: string): Program {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  const scale = experience === "beginner" ? 0.6 : experience === "advanced" ? 1.2 : 0.85;
  const days: ProgramDay[] = t.days.map((d) => ({
    id: newId("day"), name: d.name, weekdays: [...d.weekdays],
    exercises: d.ex.map((s) => pe(s, units, scale)),
  }));
  return { name: t.name, startDate, days, deloadUntil: null };
}

export const MAIN_LIFTS = ["bench_press", "back_squat", "deadlift", "ohp", "barbell_row", "incline_db_press"];
