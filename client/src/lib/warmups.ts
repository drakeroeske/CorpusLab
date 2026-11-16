// Pre-lift warm-ups: a small library (cardio, bands/activation, dynamic stretches), suggestions that match
// today's muscles, and the skip streak that drives the "you've been skipping" reminder.
import type { Muscle, Session } from "./types";
import { EX, muscleShares } from "./exercises";

export type WarmupKind = "cardio" | "bands" | "stretch";

export interface Warmup {
  id: string;
  name: string;
  kind: WarmupKind;
  /** What to do: "5 min", "15 reps", "30 s each side". */
  dose: string;
  /** One short how-to line. */
  cue: string;
  /** Muscles it prepares; empty = general (whole body). */
  muscles: Muscle[];
  /** Cardio only: default minutes. */
  min?: number;
  /** Joint prep for the big lifts (shoulders, hips, spine): ranked ahead of isolation-style moves. */
  key?: boolean;
}

const LEGS: Muscle[] = ["vasti", "rectus_femoris", "hamstrings", "glute_max", "gastrocnemius", "soleus"];
const HIPS: Muscle[] = ["glute_max", "glute_med", "adductors", "hip_flexors"];
const SHOULDERS: Muscle[] = ["front_delts", "side_delts", "rear_delts"];
const UPPER_BACK: Muscle[] = ["mid_back", "traps_upper", "rear_delts"];

export const WARMUPS: Warmup[] = [
  // cardio: raise heart rate and muscle temperature
  { id: "treadmill_walk", name: "Treadmill walk", kind: "cardio", dose: "5 min", min: 5, cue: "Brisk pace or a slight incline. You should be able to talk.", muscles: LEGS },
  { id: "bike", name: "Stationary bike", kind: "cardio", dose: "5 min", min: 5, cue: "Easy-to-moderate resistance, steady cadence.", muscles: ["vasti", "rectus_femoris", "glute_max"] },
  { id: "rower", name: "Rower", kind: "cardio", dose: "5 min", min: 5, cue: "Easy strokes: legs, then body, then arms. Good before upper and lower days.", muscles: ["lats", "mid_back", "vasti", "glute_max", "hamstrings"] },
  { id: "elliptical", name: "Elliptical", kind: "cardio", dose: "5 min", min: 5, cue: "Use the handles to bring in the upper body.", muscles: [...LEGS, "lats", "chest_mid"] },
  { id: "stairs", name: "Stair climber", kind: "cardio", dose: "5 min", min: 5, cue: "Slow, steady steps. Don't lean on the rails.", muscles: ["glute_max", "vasti", "gastrocnemius"] },
  { id: "jump_rope", name: "Jump rope", kind: "cardio", dose: "3 min", min: 3, cue: "Light bounces on the balls of the feet.", muscles: ["gastrocnemius", "soleus", "front_delts"] },
  { id: "light_jog", name: "Light jog", kind: "cardio", dose: "5 min", min: 5, cue: "Conversational pace.", muscles: LEGS },
  { id: "ski_erg", name: "Ski erg / arm bike", kind: "cardio", dose: "4 min", min: 4, cue: "Easy pace. Good before upper-body days.", muscles: ["lats", "triceps_long", "front_delts", "abs"] },

  // bands & activation: wake up the muscles that stabilise the big lifts
  { id: "band_pull_apart", key: true, name: "Band pull-aparts", kind: "bands", dose: "2 × 15", cue: "Arms straight, pull the band to your chest, squeeze the shoulder blades.", muscles: UPPER_BACK },
  { id: "band_dislocate", key: true, name: "Band pass-throughs", kind: "bands", dose: "10 reps", cue: "Wide grip, arms straight, take the band over your head and behind you.", muscles: [...SHOULDERS, "chest_upper"] },
  { id: "band_face_pull", key: true, name: "Band face pulls", kind: "bands", dose: "15 reps", cue: "Pull toward your eyes, elbows high, rotate the hands back.", muscles: ["rear_delts", "mid_back", "side_delts"] },
  { id: "band_external_rotation", key: true, name: "Band external rotations", kind: "bands", dose: "12 each side", cue: "Elbow tucked at 90°, rotate the forearm out slowly.", muscles: ["rear_delts", "front_delts", "side_delts"] },
  { id: "scap_pushup", name: "Scap push-ups", kind: "bands", dose: "12 reps", cue: "In a push-up position, arms straight, let the chest sink then push the floor away.", muscles: ["chest_mid", "front_delts", "mid_back"] },
  { id: "pushup_warmup", name: "Push-ups", kind: "bands", dose: "10 easy reps", cue: "Slow and controlled. On the knees is fine.", muscles: ["chest_mid", "chest_upper", "front_delts", "triceps_lateral"] },
  { id: "band_lateral_walk", key: true, name: "Band lateral walks", kind: "bands", dose: "10 steps each way", cue: "Band above the knees, half-squat, step wide without the feet touching.", muscles: ["glute_med", "glute_max"] },
  { id: "glute_bridge", key: true, name: "Glute bridges", kind: "bands", dose: "15 reps", cue: "Drive through the heels and squeeze at the top. Add a band above the knees for more.", muscles: ["glute_max", "hamstrings"] },
  { id: "bodyweight_squat", key: true, name: "Bodyweight squats", kind: "bands", dose: "15 reps", cue: "Full depth, chest up, pause at the bottom.", muscles: ["vasti", "glute_max", "adductors"] },
  { id: "band_good_morning", name: "Band good mornings", kind: "bands", dose: "12 reps", cue: "Band under the feet and behind the neck. Hinge at the hips, flat back.", muscles: ["hamstrings", "glute_max", "lower_back"] },
  { id: "dead_bug", name: "Dead bugs", kind: "bands", dose: "8 each side", cue: "Lower back pressed into the floor, reach the opposite arm and leg.", muscles: ["abs", "obliques", "hip_flexors"] },
  { id: "bird_dog", name: "Bird dogs", kind: "bands", dose: "8 each side", cue: "Reach long, keep the hips level, pause 2 s.", muscles: ["lower_back", "glute_max", "abs"] },
  { id: "band_curl", name: "Light band curls", kind: "bands", dose: "15 reps", cue: "Pump some blood into the elbows before heavy pulling or curls.", muscles: ["biceps_long", "biceps_short", "brachialis"] },
  { id: "band_pushdown", name: "Light band pushdowns", kind: "bands", dose: "15 reps", cue: "Warms the elbows before pressing.", muscles: ["triceps_lateral", "triceps_long"] },

  // dynamic stretches: move through the range you're about to load (hold stretches for after)
  { id: "leg_swings", key: true, name: "Leg swings", kind: "stretch", dose: "10 each way, each leg", cue: "Hold something, swing forward and back, then side to side.", muscles: ["hamstrings", "hip_flexors", "adductors", "glute_med"] },
  { id: "worlds_greatest", key: true, name: "World's greatest stretch", kind: "stretch", dose: "5 each side", cue: "Lunge, elbow to the instep, then rotate and reach up.", muscles: ["hip_flexors", "hamstrings", "glute_max", "mid_back", "adductors"] },
  { id: "hip_90_90", key: true, name: "90/90 hip switches", kind: "stretch", dose: "8 each side", cue: "Sit with both knees bent at 90°, rotate the knees side to side, chest tall.", muscles: ["glute_med", "glute_max", "hip_flexors", "adductors"] },
  { id: "cossack_squat", name: "Cossack squats", kind: "stretch", dose: "6 each side", cue: "Wide stance, sit into one hip, the other leg straight with the toes up.", muscles: ["adductors", "vasti", "glute_max"] },
  { id: "walking_lunge_twist", name: "Walking lunge with twist", kind: "stretch", dose: "8 each side", cue: "Lunge, then rotate the chest over the front leg.", muscles: ["vasti", "glute_max", "hip_flexors", "obliques"] },
  { id: "inchworm", name: "Inchworms", kind: "stretch", dose: "6 reps", cue: "Fold forward, walk the hands out to a plank, then walk the feet in.", muscles: ["hamstrings", "abs", "front_delts", "chest_mid"] },
  { id: "ankle_rocks", name: "Ankle rocks", kind: "stretch", dose: "10 each side", cue: "Half-kneel, push the knee forward over the toes, heel down.", muscles: ["gastrocnemius", "soleus"] },
  { id: "arm_circles", key: true, name: "Arm circles", kind: "stretch", dose: "15 each way", cue: "Small to big, forwards then backwards.", muscles: SHOULDERS },
  { id: "thoracic_open_book", key: true, name: "Open books", kind: "stretch", dose: "8 each side", cue: "Lie on your side, knees bent, rotate the top arm open and follow it with your eyes.", muscles: ["mid_back", "chest_mid", "obliques"] },
  { id: "cat_cow", key: true, name: "Cat-cow", kind: "stretch", dose: "10 reps", cue: "On hands and knees, round then arch the whole spine slowly.", muscles: ["lower_back", "mid_back", "abs"] },
  { id: "doorway_pec", name: "Doorway chest opener", kind: "stretch", dose: "2 × 20 s", cue: "Forearm on the door frame, step through gently. Keep it light before pressing.", muscles: ["chest_mid", "chest_upper", "front_delts"] },
  { id: "lat_reach", name: "Kneeling lat reach", kind: "stretch", dose: "5 slow reps", cue: "Hands on a bench, sit the hips back and let the chest sink.", muscles: ["lats", "triceps_long", "mid_back"] },
];

export const WARMUP = Object.fromEntries(WARMUPS.map((w) => [w.id, w])) as Record<string, Warmup>;
export const WARMUP_TABS: { v: WarmupKind; l: string }[] = [{ v: "cardio", l: "Cardio" }, { v: "bands", l: "Bands" }, { v: "stretch", l: "Stretches" }];

/** Muscles today's workout trains, weighted the way sets count (main 1, secondary 0.5, stabilizer 0.25). */
export function sessionMuscleWeights(exIds: string[]): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const id of exIds) {
    const ex = EX[id];
    if (!ex) continue;
    for (const [m, w] of muscleShares(ex)) out.set(m, (out.get(m) ?? 0) + w);
  }
  return out;
}

/** Warm-ups of one kind, best match for today's muscles first. `suggested` marks the top picks. */
export function rankWarmups(kind: WarmupKind, exIds: string[]): { w: Warmup; score: number; suggested: boolean }[] {
  const weights = sessionMuscleWeights(exIds);
  const scored = WARMUPS.filter((w) => w.kind === kind).map((w, i) => {
    // General picks (no muscles listed) get a small base score; ties keep library order.
    const fit = w.muscles.length ? w.muscles.reduce((a, m) => a + (weights.get(m) ?? 0), 0) / Math.sqrt(w.muscles.length) : 0.5;
    const score = fit * (w.key ? 1.6 : 1);
    return { w, score, i };
  }).sort((a, b) => b.score - a.score || a.i - b.i);
  const picks = kind === "cardio" ? 1 : 3;
  return scored.map((x, i) => ({ w: x.w, score: x.score, suggested: i < picks && (x.score > 0 || !weights.size) }));
}

/** Total warm-up minutes logged (cardio minutes; other items count ~1 min each). */
export function warmupMinutes(items: { id: string; min?: number }[]): number {
  return items.reduce((a, it) => a + (WARMUP[it.id]?.kind === "cardio" ? it.min ?? WARMUP[it.id].min ?? 5 : 1), 0);
}

/** "5 min bike + 3 more" */
export function warmupSummary(items: { id: string; min?: number }[]): string {
  if (!items.length) return "Warmed up";
  const cardio = items.find((it) => WARMUP[it.id]?.kind === "cardio");
  const first = cardio ? `${cardio.min ?? WARMUP[cardio.id].min} min ${WARMUP[cardio.id].name.toLowerCase()}` : WARMUP[items[0].id]?.name ?? "Warm-up";
  const rest = items.length - 1;
  return rest > 0 ? `${first} + ${rest} more` : first;
}

/** How many of the most recent finished workouts skipped the warm-up in a row (sessions without a record don't count either way). */
export function warmupSkipStreak(sessions: Session[]): number {
  const recorded = sessions.filter((s) => s.end && s.warmup).sort((a, b) => b.start - a.start);
  let n = 0;
  for (const s of recorded) { if (s.warmup!.status === "skipped") n++; else break; }
  return n;
}

/** Warm-up counts for a date range: { warmed, total } over finished workouts that recorded one. */
export function warmupRate(sessions: Session[], from: string, to: string) {
  const inRange = sessions.filter((s) => s.end && s.warmup && s.date >= from && s.date <= to);
  return { warmed: inRange.filter((s) => s.warmup!.status === "done").length, total: inRange.length };
}
