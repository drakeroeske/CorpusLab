// Non-lifting workouts: what each type works, how hard it hits recovery, and how to show distance, pace and time.
import type { Activity, ActivityType, Muscle, Units, WodFormat } from "./types";
import { EX, muscleShares } from "./exercises";
import type { LoadSession } from "./readiness";

export type ActivityGroup = "cardio" | "crossfit" | "class";

interface ActivityMeta {
  label: string;
  verb: string;
  group: ActivityGroup;
  /** Has a distance worth logging. */
  distance: boolean;
  /** Muscles worked and how much (1 = main), per unit of effort. */
  muscles: [Muscle, number][];
  /** Effort when the user doesn't give one (RPE). */
  defaultRpe: number;
}

const LEGS_RUN: [Muscle, number][] = [["gastrocnemius", 1], ["soleus", 1], ["vasti", 0.6], ["rectus_femoris", 0.6], ["hamstrings", 0.6], ["glute_max", 0.6], ["hip_flexors", 0.6], ["glute_med", 0.4], ["adductors", 0.3], ["abs", 0.2], ["obliques", 0.2]];

export const ACTIVITY: Record<ActivityType, ActivityMeta> = {
  run: { label: "Run", verb: "Ran", group: "cardio", distance: true, muscles: LEGS_RUN, defaultRpe: 6 },
  walk: { label: "Walk", verb: "Walked", group: "cardio", distance: true, muscles: LEGS_RUN.map(([m, w]) => [m, w * 0.3]), defaultRpe: 3 },
  hike: { label: "Hike", verb: "Hiked", group: "cardio", distance: true, muscles: [["glute_max", 0.8], ["vasti", 0.8], ["gastrocnemius", 0.7], ["soleus", 0.7], ["hamstrings", 0.5], ["glute_med", 0.5], ["lower_back", 0.3], ["abs", 0.2]], defaultRpe: 5 },
  cycle: { label: "Cycle", verb: "Rode", group: "cardio", distance: true, muscles: [["vasti", 1], ["rectus_femoris", 0.8], ["glute_max", 0.6], ["hamstrings", 0.4], ["gastrocnemius", 0.4], ["soleus", 0.4], ["hip_flexors", 0.3]], defaultRpe: 5 },
  row: { label: "Row", verb: "Rowed", group: "cardio", distance: true, muscles: [["lats", 0.8], ["mid_back", 0.8], ["vasti", 0.7], ["glute_max", 0.6], ["hamstrings", 0.5], ["rear_delts", 0.5], ["biceps_long", 0.4], ["biceps_short", 0.4], ["brachialis", 0.4], ["lower_back", 0.4], ["forearms", 0.4], ["abs", 0.3]], defaultRpe: 6 },
  swim: { label: "Swim", verb: "Swam", group: "cardio", distance: true, muscles: [["lats", 1], ["front_delts", 0.7], ["side_delts", 0.5], ["triceps_long", 0.5], ["triceps_lateral", 0.5], ["chest_mid", 0.4], ["mid_back", 0.4], ["abs", 0.3], ["obliques", 0.3], ["glute_max", 0.3], ["hip_flexors", 0.3]], defaultRpe: 6 },
  elliptical: { label: "Elliptical", verb: "Did elliptical", group: "cardio", distance: true, muscles: [["vasti", 0.6], ["glute_max", 0.6], ["hamstrings", 0.4], ["gastrocnemius", 0.4], ["soleus", 0.4], ["chest_mid", 0.1], ["lats", 0.1]], defaultRpe: 5 },
  stairs: { label: "Stairs", verb: "Climbed", group: "cardio", distance: false, muscles: [["glute_max", 1], ["vasti", 1], ["gastrocnemius", 0.7], ["soleus", 0.7], ["hamstrings", 0.4], ["glute_med", 0.4]], defaultRpe: 6 },
  wod: { label: "WOD", verb: "Did", group: "crossfit", distance: false, muscles: [["vasti", 0.6], ["glute_max", 0.6], ["front_delts", 0.4], ["lats", 0.4], ["abs", 0.4], ["hamstrings", 0.4], ["chest_mid", 0.3], ["triceps_lateral", 0.3], ["gastrocnemius", 0.3]], defaultRpe: 8 },
  hiit: { label: "HIIT", verb: "Did", group: "class", distance: false, muscles: [["vasti", 0.7], ["glute_max", 0.6], ["abs", 0.5], ["obliques", 0.4], ["gastrocnemius", 0.5], ["soleus", 0.4], ["hip_flexors", 0.4], ["front_delts", 0.3], ["chest_mid", 0.3], ["triceps_lateral", 0.2]], defaultRpe: 8 },
  yoga: { label: "Yoga", verb: "Did", group: "class", distance: false, muscles: [["abs", 0.3], ["obliques", 0.3], ["glute_med", 0.3], ["front_delts", 0.2], ["hamstrings", 0.2], ["lower_back", 0.2], ["triceps_lateral", 0.2], ["vasti", 0.2]], defaultRpe: 3 },
  pilates: { label: "Pilates", verb: "Did", group: "class", distance: false, muscles: [["abs", 0.8], ["obliques", 0.7], ["hip_flexors", 0.5], ["glute_med", 0.5], ["glute_max", 0.4], ["adductors", 0.4], ["lower_back", 0.3]], defaultRpe: 5 },
  sport: { label: "Sport", verb: "Played", group: "class", distance: false, muscles: [["vasti", 0.6], ["glute_max", 0.5], ["gastrocnemius", 0.6], ["soleus", 0.5], ["hamstrings", 0.5], ["adductors", 0.4], ["glute_med", 0.4], ["abs", 0.2], ["obliques", 0.3]], defaultRpe: 6 },
  other: { label: "Other", verb: "Did", group: "class", distance: false, muscles: [["vasti", 0.3], ["glute_max", 0.3], ["abs", 0.2]], defaultRpe: 5 },
};

export const ACTIVITY_GROUPS: { id: ActivityGroup; label: string; types: ActivityType[] }[] = [
  { id: "cardio", label: "Cardio", types: ["run", "walk", "cycle", "row", "swim", "hike", "elliptical", "stairs"] },
  { id: "crossfit", label: "CrossFit", types: ["wod"] },
  { id: "class", label: "Classes & sports", types: ["hiit", "yoga", "pilates", "sport", "other"] },
];

/** Distance types that make sense as cardio goals. */
export const DISTANCE_TYPES: ActivityType[] = ACTIVITY_GROUPS[0].types.filter((t) => ACTIVITY[t].distance);

export const WOD_FORMAT_LABEL: Record<WodFormat, string> = { for_time: "For time", amrap: "AMRAP", emom: "EMOM", other: "Other" };

/** Cardio pieces that show up inside WODs (stored as "act:<type>"). */
export const WOD_CARDIO: ActivityType[] = ["run", "row", "cycle"];
/** Common WOD movements offered as one-tap chips. */
export const WOD_QUICK = ["thruster", "pullup", "burpee", "wall_ball", "box_jump", "double_under", "kb_swing", "deadlift", "power_clean", "toes_to_bar", "pushup", "air_squat", "act:run", "act:row"];

export const movementName = (id: string) => (id.startsWith("act:") ? ACTIVITY[id.slice(4) as ActivityType]?.label ?? id : EX[id].name.replace(/ \((weighted)\)$/, ""));

/* ---------------- units & formatting ---------------- */

const KM_PER_MI = 1.609344;
export const distUnit = (u: Units) => (u === "kg" ? "km" : "mi");
export const toKm = (d: number, u: Units) => (u === "kg" ? d : d * KM_PER_MI);
export const fromKm = (km: number, u: Units) => (u === "kg" ? km : km / KM_PER_MI);
/** Swims are logged in metres (kg users) or yards (lb users). */
export const swimUnit = (u: Units) => (u === "kg" ? "m" : "yd");
export const swimToKm = (d: number, u: Units) => (u === "kg" ? d / 1000 : (d * 0.9144) / 1000);
export const kmToSwim = (km: number, u: Units) => (u === "kg" ? km * 1000 : (km * 1000) / 0.9144);

export function fmtDistance(km: number, type: ActivityType, u: Units): string {
  if (type === "swim") return `${Math.round(kmToSwim(km, u)).toLocaleString()} ${swimUnit(u)}`;
  const d = fromKm(km, u);
  return `${d >= 100 ? Math.round(d) : Math.round(d * 100) / 100} ${distUnit(u)}`;
}

/** 3725 → "1:02:05", 754 → "12:34". */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

/** "25", "25:30", "1:05:00" → seconds. A bare number is minutes. null when it can't be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((x) => !/^\d+$/.test(x))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x >= 60)) return null;
  return n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
}

/** Pace (run/walk/hike: per mi or km; row: per 500 m; swim: per 100 m/yd) or speed (cycling). */
export function fmtPace(a: Pick<Activity, "type" | "durationSec" | "distanceKm">, u: Units): string | null {
  if (!a.distanceKm || a.distanceKm <= 0 || !a.durationSec) return null;
  if (a.type === "cycle") return `${Math.round((fromKm(a.distanceKm, u) / (a.durationSec / 3600)) * 10) / 10} ${u === "kg" ? "km/h" : "mph"}`;
  if (a.type === "row") return `${fmtDuration(a.durationSec / (a.distanceKm * 2))} /500m`;
  if (a.type === "swim") return `${fmtDuration(a.durationSec / (kmToSwim(a.distanceKm, u) / 100))} /100${swimUnit(u)}`;
  return `${fmtDuration(a.durationSec / fromKm(a.distanceKm, u))} /${distUnit(u)}`;
}

export const EFFORT = [
  { rpe: 3, label: "Easy" }, { rpe: 5, label: "Moderate" }, { rpe: 7, label: "Hard" }, { rpe: 8.5, label: "Very hard" }, { rpe: 10, label: "All out" },
];
export const effortLabel = (rpe: number | null | undefined) => (rpe == null ? null : [...EFFORT].reverse().find((e) => rpe >= e.rpe - 0.75)?.label ?? "Easy");

export function activityTitle(a: Activity): string {
  const L = ACTIVITY[a.type];
  if (a.type === "sport") return a.name?.trim() || "Sport";
  if (a.name?.trim()) return a.name.trim();
  return L.label;
}

/** One-line result: "5.02 mi · 42:10 · 8:24 /mi", "AMRAP 12 · 7 rounds + 4 · Rx", "Yoga · 60 min". */
export function activitySummary(a: Activity, u: Units): string {
  const parts: string[] = [];
  if (a.type === "wod" && a.wod) {
    const w = a.wod;
    if (w.format === "for_time") parts.push(`For time · ${fmtDuration(a.durationSec)}${w.capSec ? ` (cap ${Math.round(w.capSec / 60)})` : ""}`);
    else if (w.format === "amrap") parts.push(`AMRAP ${Math.round(a.durationSec / 60)} · ${w.rounds ?? 0} rounds${w.reps ? ` + ${w.reps}` : ""}`);
    else if (w.format === "emom") parts.push(`EMOM ${Math.round(a.durationSec / 60)}${w.rounds ? ` · ${w.rounds} rounds` : ""}`);
    else parts.push(`${Math.round(a.durationSec / 60)} min${w.score ? ` · ${w.score}` : ""}`);
    parts.push(w.rx ? "Rx" : "Scaled");
  } else {
    if (a.distanceKm) parts.push(fmtDistance(a.distanceKm, a.type, u));
    parts.push(a.distanceKm ? fmtDuration(a.durationSec) : `${Math.round(a.durationSec / 60)} min`);
    const pace = fmtPace(a, u);
    if (pace) parts.push(pace);
  }
  return parts.join(" · ");
}

/* ---------------- recovery ---------------- */

const intensity = (a: Activity) => (a.rpe ?? ACTIVITY[a.type].defaultRpe) / 10;

/**
 * Muscle fatigue from one activity, in the same units as one working set (1 = a set for a main muscle).
 * Roughly: 10 hard minutes ≈ 1.2 sets on the muscles a sport leans on most. A WOD spreads that over its movements.
 */
export function activityMuscleLoad(a: Activity): [Muscle, number][] {
  const mins = a.durationSec / 60;
  const eq = (mins / 10) * intensity(a) * 1.2;
  const moves = a.type === "wod" ? a.wod?.movements ?? [] : [];
  if (!moves.length) return ACTIVITY[a.type].muscles.map(([m, w]) => [m, w * eq]);
  const out = new Map<Muscle, number>();
  // A WOD is dense work: count it a bit higher than steady cardio, split across movements.
  const per = (eq * 1.6) / moves.length;
  for (const id of moves) {
    const shares = id.startsWith("act:") ? ACTIVITY[id.slice(4) as ActivityType]?.muscles ?? [] : muscleShares(EX[id]);
    for (const [m, w] of shares) out.set(m, (out.get(m) ?? 0) + w * per);
  }
  return [...out];
}

/** Training-load "hard sets" for readiness: an hour all-out ≈ a full lifting session (~20 sets). */
export const activityLoadSets = (a: Activity) => Math.round((a.durationSec / 60) * intensity(a) * 0.4);

/** Activities as load entries the readiness model already understands. */
export function activityLoadSessions(list: Activity[] | undefined): LoadSession[] {
  return (list ?? []).map((a) => ({ date: a.date, end: a.start + a.durationSec * 1000, exercises: [{ sets: new Array(activityLoadSets(a)).fill(0) }] }));
}

/** Days with any finished workout: lifting sessions or activities. */
export function trainedDates(sessions: { date: string; end: number | null }[], activities: Activity[] | undefined): Set<string> {
  const out = new Set(sessions.filter((s) => s.end).map((s) => s.date));
  for (const a of activities ?? []) out.add(a.date);
  return out;
}

/* ---------------- running predictions (for cardio time goals) ---------------- */

/** Riegel: time over a new distance from a known effort. t2 = t1 × (d2/d1)^1.06 */
export const riegel = (sec: number, km: number, targetKm: number) => sec * Math.pow(targetKm / km, 1.06);

/** Best predicted time for `targetKm` from each activity of a type (only efforts at least half the distance count). */
export function predictedTimes(list: Activity[] | undefined, type: ActivityType, targetKm: number): { date: string; sec: number }[] {
  return (list ?? [])
    .filter((a) => a.type === type && a.distanceKm && a.distanceKm >= targetKm * 0.5 && a.durationSec > 0)
    .map((a) => ({ date: a.date, sec: riegel(a.durationSec, a.distanceKm!, targetKm) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
