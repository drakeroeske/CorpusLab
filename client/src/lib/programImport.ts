// Turn a screenshot or pasted text of a workout plan into program days.
// OCR runs in the browser (tesseract.js, loaded on demand) — the image never leaves the phone.
import type { Program, ProgramDay, ProgramExercise, Units } from "./types";
import { EX, EXERCISES, allExercises, isCompound, newId } from "./exercises";

/* ------------------------------------------------------------------ matching */
// Common names people write that differ from our catalog names. Lower-case, loose.
const ALIASES: Record<string, string[]> = {
  back_squat: ["squat", "barbell squat", "bb squat", "high bar squat", "low bar squat", "back squats"],
  front_squat: ["front squats"],
  hack_squat: ["hack"],
  leg_press: ["leg press", "legpress", "45 leg press"],
  goblet_squat: ["goblet"],
  bulgarian_split: ["bulgarian", "split squat", "bss", "rear foot elevated split squat", "rfess"],
  smith_squat: ["smith squat"],
  walking_lunge: ["lunge", "lunges", "walking lunges", "db lunge", "reverse lunge"],
  deadlift: ["conventional deadlift", "dl", "deads", "deadlifts", "sumo deadlift"],
  rdl: ["rdl", "romanian", "rdls", "stiff leg deadlift", "sldl", "stiff legged deadlift", "bb rdl"],
  db_rdl: ["db rdl", "dumbbell romanian deadlift"],
  trap_bar_dl: ["trap bar", "hex bar deadlift", "hex bar"],
  hip_thrust: ["hip thrust", "hip thrusts", "glute bridge", "barbell glute bridge"],
  good_morning: ["good mornings"],
  kb_swing: ["kettlebell swings", "kb swings", "swings"],
  back_extension: ["back extension", "hyperextension", "hyper", "hypers", "45 degree back extension"],
  bench_press: ["bench", "flat bench", "barbell bench", "bb bench", "flat barbell bench press", "bench press"],
  incline_bench: ["incline bench", "incline barbell", "incline bb bench", "incline press"],
  db_bench: ["db bench", "dumbbell bench", "flat db press", "db press", "dumbbell press", "flat dumbbell press"],
  incline_db_press: ["incline db press", "incline db", "incline dumbbell", "incline dumbbell press", "incline db bench", "incline dumbbell bench press"],
  machine_chest_press: ["chest press", "machine press", "hammer strength press"],
  smith_bench: ["smith bench"],
  dips: ["dip", "dips", "weighted dips", "chest dips", "tricep dips"],
  pushup: ["push up", "push ups", "pushups", "push-ups"],
  ohp: ["overhead press", "ohp", "military press", "shoulder press", "barbell shoulder press", "standing press", "strict press", "press"],
  db_shoulder_press: ["db shoulder press", "dumbbell shoulder press", "seated db press", "db ohp", "seated dumbbell press"],
  machine_shoulder_press: ["machine shoulder press"],
  landmine_press: ["landmine"],
  arnold_press: ["arnold", "arnolds"],
  barbell_row: ["bent over row", "barbell rows", "bb row", "bent-over row", "row", "rows", "bent row"],
  db_row: ["db row", "dumbbell row", "one arm row", "single arm row", "1 arm row", "kroc row"],
  cable_row: ["seated row", "cable row", "seated cable row", "low row"],
  chest_supported_row: ["chest supported row", "incline db row", "seal row", "machine row"],
  tbar_row: ["t bar row", "t-bar", "tbar"],
  pendlay_row: ["pendlay"],
  inverted_row: ["inverted rows", "australian pull up", "body row"],
  lat_pulldown: ["pulldown", "pulldowns", "lat pull down", "lat pulldowns", "wide grip pulldown"],
  pullup: ["pull up", "pull ups", "pullups", "pull-ups", "weighted pull ups"],
  chinup: ["chin up", "chin ups", "chinups", "chin-ups"],
  neutral_pulldown: ["neutral grip pulldown", "close grip pulldown", "v bar pulldown"],
  machine_pulldown: ["machine pulldown"],
  assisted_pullup: ["assisted pull up", "assisted pullup", "assisted chin up"],
  cable_fly: ["cable fly", "cable flye", "cable flys", "cable flyes", "cable crossover", "crossover", "crossovers"],
  pec_deck: ["pec dec", "pec deck", "machine fly", "chest fly machine", "butterfly"],
  db_fly: ["db fly", "dumbbell fly", "db flye", "flys", "flyes", "incline fly", "incline db fly"],
  lateral_raise: ["lateral raise", "lateral raises", "side raise", "side raises", "db lateral", "laterals", "side laterals", "lat raise", "lat raises"],
  cable_lateral: ["cable lateral", "cable laterals", "cable side raise"],
  machine_lateral: ["machine lateral", "machine lateral raise"],
  face_pull: ["face pull", "face pulls", "facepull", "facepulls"],
  reverse_fly: ["reverse fly", "reverse flys", "rear delt fly", "rear delt flye", "rear delts", "reverse pec deck", "rear delt raise", "bent over raise"],
  barbell_curl: ["bb curl", "barbell curls", "ez bar curl", "ez curl", "curl", "curls", "bicep curl", "bicep curls", "biceps curl"],
  db_curl: ["db curl", "db curls", "dumbbell curls", "alternating curl", "incline curl", "incline db curl", "supinated curl"],
  hammer_curl: ["hammer", "hammers", "hammer curls", "rope hammer curl", "cross body curl"],
  cable_curl: ["cable curls", "bayesian curl", "rope curl"],
  pushdown: ["pushdown", "pushdowns", "tricep pushdown", "triceps pushdown", "rope pushdown", "tricep extension", "cable tricep extension", "rope extension", "tricep press down", "press down", "pressdown"],
  skullcrusher: ["skull crusher", "skull crushers", "skullcrushers", "lying tricep extension", "lying triceps extension", "french press", "ez skull"],
  oh_triceps_ext: ["overhead tricep extension", "overhead extension", "overhead triceps", "oh tricep", "oh extension", "cable overhead extension", "overhead rope extension"],
  leg_extension: ["leg extensions", "leg ext", "quad extension", "extensions"],
  leg_curl: ["leg curl", "leg curls", "seated leg curls", "hamstring curl", "ham curl", "ham curls"],
  lying_leg_curl: ["lying leg curl", "lying leg curls", "lying ham curl", "prone leg curl"],
  calf_raise: ["calf raise", "calf raises", "calves", "standing calf", "standing calves", "calf"],
  seated_calf: ["seated calf", "seated calves", "seated calf raise"],
  hanging_leg_raise: ["leg raise", "leg raises", "hanging leg raises", "hanging knee raise", "knee raises", "toes to bar"],
  cable_crunch: ["cable crunch", "cable crunches", "crunch", "crunches", "rope crunch", "ab crunch", "sit ups", "sit up", "situps", "plank", "ab wheel", "abs"],
  shrug: ["shrugs", "db shrug", "barbell shrug", "bb shrug", "trap shrug"],
};

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9°]+/g, " ").replace(/\b(the|a|an|with|w|on|for)\b/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

interface Candidate { exId: string; score: number }

/** Best catalog match for a free-text exercise name (0–1 confidence). */
export function matchExercise(raw: string): Candidate | null {
  const q = norm(raw);
  if (!q) return null;
  const qt = tokens(raw);
  let best: Candidate | null = null;
  const consider = (exId: string, phrase: string, weight: number) => {
    const p = norm(phrase);
    if (!p) return;
    let score = 0;
    if (p === q) score = 1;
    else if (q.includes(p) || p.includes(q)) score = 0.9 * Math.min(p.length, q.length) / Math.max(p.length, q.length) + 0.1;
    else {
      const pt = p.split(" ");
      const hit = pt.filter((t) => qt.includes(t)).length;
      if (hit) score = (hit / Math.max(pt.length, qt.length)) * 0.85;
    }
    score *= weight;
    if (score > 0 && (!best || score > best.score)) best = { exId, score };
  };
  for (const ex of allExercises()) {
    consider(ex.id, ex.name, 1);
    for (const a of ALIASES[ex.id] ?? []) consider(ex.id, a, 0.97);
  }
  return best && (best as Candidate).score >= 0.4 ? best : null;
}

/* ------------------------------------------------------------------ parsing */
export interface ParsedExercise {
  raw: string;
  exId: string | null;
  confidence: number;
  sets: number;
  repMin: number;
  repMax: number;
  weight: number | null;
}
export interface ParsedDay { name: string; weekdays: number[]; exercises: ParsedExercise[] }

const WEEKDAYS: [RegExp, number][] = [[/\bsun(day)?\b/i, 0], [/\bmon(day)?\b/i, 1], [/\btue(s|sday)?\b/i, 2], [/\bwed(nesday)?\b/i, 3], [/\bthu(r|rs|rsday)?\b/i, 4], [/\bfri(day)?\b/i, 5], [/\bsat(urday)?\b/i, 6]];
const DAY_WORDS = /^(day\s*\d+|d\s*\d+|week\s*\d+\s*[-–:]?\s*day\s*\d+|push|pull|legs?|upper|lower|full\s*body|chest|back|shoulders|arms|glutes?|hamstrings?|quads?|workout\s*[a-z0-9]?|session\s*[a-z0-9]?|[a-z ]*\bday\b[a-z ]*)\b/i;

// "3x8", "3 x 8-12", "4×10", "3 sets of 10", "3 sets x 8 reps", "5x5 @ 185", "3x8 135 lb", "8-12 reps x 3 sets"
const SETS_REPS = [
  /(\d{1,2})\s*(?:sets?)?\s*[x×*]\s*(\d{1,3})(?:\s*[-–to]+\s*(\d{1,3}))?\s*(?:reps?)?/i,
  /(\d{1,2})\s*sets?\s*(?:of|x|×)?\s*(\d{1,3})(?:\s*[-–to]+\s*(\d{1,3}))?\s*(?:reps?)?/i,
  /(\d{1,3})(?:\s*[-–to]+\s*(\d{1,3}))?\s*reps?\s*(?:[x×*]|for)\s*(\d{1,2})\s*sets?/i,
];
const WEIGHT = /(?:@|at)?\s*(\d{2,4}(?:\.\d)?)\s*(lbs?|kg|kgs|#|pounds?)\b/i;

export function parseProgramText(text: string, units: Units): ParsedDay[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const days: ParsedDay[] = [];
  let cur: ParsedDay | null = null;
  const ensure = () => { if (!cur) { cur = { name: `Day ${days.length + 1}`, weekdays: [], exercises: [] }; days.push(cur); } return cur; };
  for (const line of lines) {
    const noBullet = line.replace(/^[\s\-•·*>\d.)]+(?=[A-Za-z])/, "").trim();
    let m: RegExpMatchArray | null = null; let idx = -1;
    for (let i = 0; i < SETS_REPS.length && !m; i++) { m = noBullet.match(SETS_REPS[i]); idx = i; }
    if (m) {
      let sets: number, repMin: number, repMax: number;
      if (idx === 2) { repMin = +m[1]; repMax = m[2] ? +m[2] : repMin; sets = +m[3]; }
      else { sets = +m[1]; repMin = +m[2]; repMax = m[3] ? +m[3] : repMin; }
      if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
      if (sets < 1 || sets > 12 || repMin < 1 || repMax > 100) continue;
      const name = noBullet.slice(0, m.index).replace(/[:\-–—]\s*$/, "").trim() || noBullet.slice((m.index ?? 0) + m[0].length).replace(/^[\s:\-–—]+/, "").replace(WEIGHT, "").trim();
      if (!name) continue;
      const tail = noBullet.slice((m.index ?? 0) + m[0].length);
      const wm = tail.match(WEIGHT) ?? noBullet.match(WEIGHT);
      const bare = !wm ? tail.match(/(?:@|at)?\s*(\d{2,4}(?:\.\d)?)\s*$/) : null;
      let weight: number | null = wm ? parseFloat(wm[1]) : bare ? parseFloat(bare[1]) : null;
      if (weight != null && wm) { const u = wm[2].toLowerCase(); if (u.startsWith("kg") && units === "lb") weight = Math.round(weight * 2.2046 / 5) * 5; else if (!u.startsWith("kg") && units === "kg") weight = Math.round(weight * 0.4536 / 2.5) * 2.5; }
      const match = matchExercise(name.replace(WEIGHT, ""));
      ensure().exercises.push({ raw: name, exId: match?.exId ?? null, confidence: match?.score ?? 0, sets, repMin, repMax, weight });
      continue;
    }
    // Header line? Short, no sets×reps, looks like a day label (or any short line right before exercises).
    const wd = WEEKDAYS.filter(([re]) => re.test(noBullet)).map(([, d]) => d);
    const looksHeader = noBullet.length <= 40 && (DAY_WORDS.test(noBullet) || wd.length > 0 || /^[A-Z][A-Z0-9 /&+-]{2,}$/.test(noBullet));
    if (looksHeader) {
      if (cur && cur.exercises.length === 0) { cur.name = tidyName(noBullet) || cur.name; cur.weekdays = wd.length ? wd : cur.weekdays; continue; }
      cur = { name: tidyName(noBullet) || `Day ${days.length + 1}`, weekdays: wd, exercises: [] };
      days.push(cur);
    }
  }
  return days.filter((d) => d.exercises.length > 0);
}

function tidyName(s: string) {
  const t = s.replace(/[:\-–—]+$/, "").replace(/\s+/g, " ").trim();
  return t.length > 24 ? t.slice(0, 24).trim() : t;
}

/** Build program days from parsed rows (skips rows the user left unmatched). */
export function toProgramDays(parsed: ParsedDay[], units: Units, usedWeekdays: Set<number> = new Set()): ProgramDay[] {
  const out: ProgramDay[] = [];
  let nextFree = 1;
  for (const d of parsed) {
    const exercises: ProgramExercise[] = [];
    for (const r of d.exercises) {
      if (!r.exId) continue;
      const ex = EX[r.exId];
      const comp = isCompound(ex);
      const big = ["back_squat", "deadlift", "trap_bar_dl", "leg_press", "hip_thrust", "rdl"].includes(r.exId);
      const step = units === "lb" ? (big ? 10 : 5) : big ? 5 : ex.equipment === "dumbbell" ? 2 : 2.5;
      exercises.push({ id: newId("pe"), exId: r.exId, sets: r.sets, repMin: r.repMin, repMax: Math.max(r.repMin, r.repMax), startWeight: r.weight ?? 0, increment: step, style: r.repMin === r.repMax ? "straight" : "double", technique: null });
    }
    if (!exercises.length) continue;
    let weekdays = d.weekdays.filter((w) => !usedWeekdays.has(w));
    if (!weekdays.length) { while (usedWeekdays.has(nextFree % 7) && nextFree < 14) nextFree++; weekdays = [nextFree % 7]; nextFree++; }
    weekdays.forEach((w) => usedWeekdays.add(w));
    out.push({ id: newId("day"), name: d.name, weekdays, exercises });
  }
  return out;
}

export function daysToProgram(days: ProgramDay[], name: string, startDate: string): Program {
  return { name, startDate, days, deloadUntil: null };
}

/* ------------------------------------------------------------------ OCR */
/** Read text from an image file in the browser. Downloads the OCR engine (~4 MB) the first time. */
export async function ocrImage(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); },
  });
  try {
    const url = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(url);
      return data.text;
    } finally { URL.revokeObjectURL(url); }
  } finally { await worker.terminate(); }
}
