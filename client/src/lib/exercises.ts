import type { Exercise, Muscle, Program, ProgramDay, ProgramExercise, Units } from "./types";

const E = (
  id: string, name: string, primary: Muscle[], secondary: Muscle[],
  equipment: Exercise["equipment"], pattern: Exercise["pattern"], ratio: number,
): Exercise => ({ id, name, primary, secondary, equipment, pattern, ratio });

/* ratio = rough working-load relative to the pattern's reference lift (dumbbells are per hand) */
export const EXERCISES: Exercise[] = [
  // squat
  E("back_squat", "Back Squat", ["quads", "glutes"], ["hamstrings", "lower_back", "abs"], "barbell", "squat", 1),
  E("front_squat", "Front Squat", ["quads"], ["glutes", "upper_back", "abs"], "barbell", "squat", 0.8),
  E("hack_squat", "Hack Squat", ["quads"], ["glutes"], "machine", "squat", 1.1),
  E("leg_press", "Leg Press", ["quads", "glutes"], ["hamstrings"], "machine", "squat", 1.9),
  E("goblet_squat", "Goblet Squat", ["quads", "glutes"], ["abs"], "dumbbell", "squat", 0.35),
  E("bulgarian_split", "Bulgarian Split Squat", ["quads", "glutes"], ["hamstrings"], "dumbbell", "squat", 0.25),
  E("smith_squat", "Smith Machine Squat", ["quads", "glutes"], ["hamstrings"], "smith", "squat", 0.9),
  E("walking_lunge", "Walking Lunge", ["quads", "glutes"], ["hamstrings", "calves"], "dumbbell", "squat", 0.22),
  // hinge
  E("deadlift", "Deadlift", ["hamstrings", "glutes", "lower_back"], ["upper_back", "forearms", "quads"], "barbell", "hinge", 1),
  E("rdl", "Romanian Deadlift", ["hamstrings", "glutes"], ["lower_back", "forearms"], "barbell", "hinge", 0.7),
  E("db_rdl", "Dumbbell RDL", ["hamstrings", "glutes"], ["lower_back", "forearms"], "dumbbell", "hinge", 0.3),
  E("trap_bar_dl", "Trap Bar Deadlift", ["quads", "glutes", "hamstrings"], ["upper_back", "forearms"], "barbell", "hinge", 1.05),
  E("hip_thrust", "Barbell Hip Thrust", ["glutes"], ["hamstrings"], "barbell", "hinge", 1.0),
  E("good_morning", "Good Morning", ["hamstrings", "lower_back"], ["glutes"], "barbell", "hinge", 0.45),
  E("kb_swing", "Kettlebell Swing", ["glutes", "hamstrings"], ["lower_back"], "kettlebell", "hinge", 0.2),
  E("back_extension", "45° Back Extension", ["lower_back", "glutes"], ["hamstrings"], "bodyweight", "hinge", 0.15),
  // horizontal push
  E("bench_press", "Bench Press", ["chest"], ["triceps", "shoulders"], "barbell", "horizontal_push", 1),
  E("incline_bench", "Incline Bench Press", ["chest", "shoulders"], ["triceps"], "barbell", "horizontal_push", 0.82),
  E("db_bench", "Dumbbell Bench Press", ["chest"], ["triceps", "shoulders"], "dumbbell", "horizontal_push", 0.38),
  E("incline_db_press", "Incline Dumbbell Press", ["chest", "shoulders"], ["triceps"], "dumbbell", "horizontal_push", 0.33),
  E("machine_chest_press", "Machine Chest Press", ["chest"], ["triceps", "shoulders"], "machine", "horizontal_push", 0.95),
  E("smith_bench", "Smith Machine Bench", ["chest"], ["triceps", "shoulders"], "smith", "horizontal_push", 0.9),
  E("dips", "Weighted Dip", ["chest", "triceps"], ["shoulders"], "bodyweight", "horizontal_push", 0.3),
  E("pushup", "Push-up (weighted)", ["chest"], ["triceps", "shoulders", "abs"], "bodyweight", "horizontal_push", 0.2),
  // vertical push
  E("ohp", "Overhead Press", ["shoulders"], ["triceps", "upper_back"], "barbell", "vertical_push", 1),
  E("db_shoulder_press", "Seated DB Shoulder Press", ["shoulders"], ["triceps"], "dumbbell", "vertical_push", 0.42),
  E("machine_shoulder_press", "Machine Shoulder Press", ["shoulders"], ["triceps"], "machine", "vertical_push", 1.05),
  E("landmine_press", "Landmine Press", ["shoulders", "chest"], ["triceps"], "barbell", "vertical_push", 0.55),
  E("arnold_press", "Arnold Press", ["shoulders"], ["triceps"], "dumbbell", "vertical_push", 0.36),
  // horizontal pull
  E("barbell_row", "Barbell Row", ["upper_back", "lats"], ["biceps", "rear_delts", "lower_back"], "barbell", "horizontal_pull", 1),
  E("db_row", "One-Arm Dumbbell Row", ["lats", "upper_back"], ["biceps", "rear_delts"], "dumbbell", "horizontal_pull", 0.45),
  E("cable_row", "Seated Cable Row", ["upper_back", "lats"], ["biceps", "rear_delts"], "cable", "horizontal_pull", 0.9),
  E("chest_supported_row", "Chest-Supported Row", ["upper_back", "lats"], ["rear_delts", "biceps"], "machine", "horizontal_pull", 0.85),
  E("tbar_row", "T-Bar Row", ["upper_back", "lats"], ["biceps", "rear_delts"], "barbell", "horizontal_pull", 0.8),
  E("pendlay_row", "Pendlay Row", ["upper_back", "lats"], ["biceps", "lower_back"], "barbell", "horizontal_pull", 0.95),
  E("inverted_row", "Inverted Row", ["upper_back"], ["biceps", "rear_delts"], "bodyweight", "horizontal_pull", 0.2),
  // vertical pull
  E("lat_pulldown", "Lat Pulldown", ["lats"], ["biceps", "upper_back"], "cable", "vertical_pull", 1),
  E("pullup", "Pull-up (weighted)", ["lats"], ["biceps", "upper_back", "forearms"], "bodyweight", "vertical_pull", 0.25),
  E("chinup", "Chin-up (weighted)", ["lats", "biceps"], ["upper_back"], "bodyweight", "vertical_pull", 0.28),
  E("neutral_pulldown", "Neutral-Grip Pulldown", ["lats"], ["biceps", "upper_back"], "cable", "vertical_pull", 1.05),
  E("machine_pulldown", "Machine Pulldown", ["lats"], ["biceps"], "machine", "vertical_pull", 1.1),
  E("assisted_pullup", "Assisted Pull-up", ["lats"], ["biceps", "upper_back"], "machine", "vertical_pull", 0.6),
  // isolation — chest
  E("cable_fly", "Cable Fly", ["chest"], ["shoulders"], "cable", "isolation", 1),
  E("pec_deck", "Pec Deck", ["chest"], ["shoulders"], "machine", "isolation", 1.6),
  E("db_fly", "Dumbbell Fly", ["chest"], ["shoulders"], "dumbbell", "isolation", 0.5),
  // isolation — shoulders
  E("lateral_raise", "Dumbbell Lateral Raise", ["shoulders"], [], "dumbbell", "isolation", 1),
  E("cable_lateral", "Cable Lateral Raise", ["shoulders"], [], "cable", "isolation", 0.75),
  E("machine_lateral", "Machine Lateral Raise", ["shoulders"], [], "machine", "isolation", 2.0),
  E("face_pull", "Face Pull", ["rear_delts"], ["upper_back"], "cable", "isolation", 1),
  E("reverse_fly", "Reverse Pec Deck", ["rear_delts"], ["upper_back"], "machine", "isolation", 1.1),
  // isolation — arms
  E("barbell_curl", "Barbell Curl", ["biceps"], ["forearms"], "barbell", "isolation", 1),
  E("db_curl", "Dumbbell Curl", ["biceps"], ["forearms"], "dumbbell", "isolation", 0.45),
  E("hammer_curl", "Hammer Curl", ["biceps", "forearms"], [], "dumbbell", "isolation", 0.5),
  E("cable_curl", "Cable Curl", ["biceps"], ["forearms"], "cable", "isolation", 0.9),
  E("pushdown", "Triceps Pushdown", ["triceps"], [], "cable", "isolation", 1),
  E("skullcrusher", "EZ-Bar Skullcrusher", ["triceps"], [], "barbell", "isolation", 0.8),
  E("oh_triceps_ext", "Overhead Cable Extension", ["triceps"], [], "cable", "isolation", 0.85),
  // isolation — legs/core
  E("leg_extension", "Leg Extension", ["quads"], [], "machine", "isolation", 1),
  E("leg_curl", "Seated Leg Curl", ["hamstrings"], [], "machine", "isolation", 1),
  E("lying_leg_curl", "Lying Leg Curl", ["hamstrings"], [], "machine", "isolation", 0.85),
  E("calf_raise", "Standing Calf Raise", ["calves"], [], "machine", "isolation", 1),
  E("seated_calf", "Seated Calf Raise", ["calves"], [], "machine", "isolation", 0.7),
  E("hanging_leg_raise", "Hanging Leg Raise", ["abs"], [], "bodyweight", "isolation", 1),
  E("cable_crunch", "Cable Crunch", ["abs"], [], "cable", "isolation", 1),
  E("shrug", "Dumbbell Shrug", ["upper_back"], ["forearms"], "dumbbell", "isolation", 1),
];

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
  for (const e of next) if (!BUILT_IN[e.id]) REGISTRY[e.id] = { ...e, custom: true };
  CUSTOM = next;
}

/** Built-in catalog plus the user's live (not deleted) custom exercises. */
export const allExercises = (): Exercise[] => [...CUSTOM.filter((e) => !e.archived).map((e) => REGISTRY[e.id]), ...EXERCISES];
export const customExercises = (): Exercise[] => CUSTOM.filter((e) => !e.archived).map((e) => REGISTRY[e.id]);
export const isKnownExercise = (id: string) => id in REGISTRY;

/** Best guess at the movement pattern from the main muscles (the user can change it). */
export function guessPattern(primary: Muscle[]): Exercise["pattern"] {
  const small: Muscle[] = ["biceps", "triceps", "forearms", "calves", "abs", "rear_delts"];
  if (primary.length === 1 && small.includes(primary[0])) return "isolation";
  const has = (m: Muscle) => primary.includes(m);
  if (has("quads")) return "squat";
  if (has("hamstrings") || has("glutes") || has("lower_back")) return "hinge";
  if (has("chest")) return "horizontal_push";
  if (has("shoulders")) return "vertical_push";
  if (has("lats")) return "vertical_pull";
  if (has("upper_back")) return "horizontal_pull";
  return "isolation";
}

/** Custom exercises a program uses, so a shared copy can carry them. */
export function customExercisesIn(p: Program): Exercise[] {
  const ids = new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exId)));
  return CUSTOM.filter((e) => ids.has(e.id));
}

export const MUSCLES: Muscle[] = [
  "chest", "shoulders", "rear_delts", "triceps", "biceps", "forearms", "abs",
  "lats", "upper_back", "lower_back", "glutes", "quads", "hamstrings", "calves",
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest", shoulders: "Shoulders", rear_delts: "Rear delts", triceps: "Triceps", biceps: "Biceps",
  forearms: "Forearms", abs: "Abs", lats: "Lats", upper_back: "Upper back", lower_back: "Lower back",
  glutes: "Glutes", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves",
};

export const PATTERN_LABEL: Record<Exercise["pattern"], string> = {
  squat: "Squat", hinge: "Hinge", horizontal_push: "Horizontal push", vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull", vertical_pull: "Vertical pull", isolation: "Isolation",
};

export const isCompound = (ex: Exercise) => ex.pattern !== "isolation";
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
  const big = ["back_squat", "deadlift", "trap_bar_dl", "leg_press", "hip_thrust", "rdl"].includes(exId);
  let inc: number;
  if (units === "lb") inc = big ? 10 : ex.equipment === "dumbbell" ? 5 : compound ? 5 : 5;
  else inc = big ? 5 : ex.equipment === "dumbbell" ? 2 : 2.5;
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
