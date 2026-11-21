export type Units = "lb" | "kg";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal = "muscle" | "strength" | "fatloss" | "recomp";
export type Sex = "m" | "f" | null;

/** Tracked individually, down to the head where heads train differently (e.g. front vs side delts). */
export type Muscle =
  | "chest_upper" | "chest_mid"
  | "front_delts" | "side_delts" | "rear_delts"
  | "biceps_long" | "biceps_short" | "brachialis" | "triceps_long" | "triceps_lateral" | "forearms"
  | "lats" | "traps_upper" | "mid_back" | "lower_back"
  | "abs" | "obliques"
  | "glute_max" | "glute_med" | "hip_flexors" | "adductors"
  | "rectus_femoris" | "vasti" | "hamstrings" | "gastrocnemius" | "soleus";

/** Muscle ids from before the split (v2 data). Only read by the migration. */
export type LegacyMuscle = "chest" | "shoulders" | "triceps" | "biceps" | "upper_back" | "glutes" | "quads" | "calves";

export type Pattern =
  | "squat" | "hinge" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull" | "isolation"
  /** Loaded carries and isometric holds, logged as weight × time. */
  | "hold";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "smith" | "kettlebell";

export interface Exercise {
  id: string;
  name: string;
  /** Prime movers: each working set counts as 1 set. */
  primary: Muscle[];
  /** Assist the movement: 0.5 set. */
  secondary: Muscle[];
  /** Hold position isometrically (e.g. abs and lower back in a squat): 0.25 set. */
  stabilizers?: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
  /** Made by the user (id starts with cx_). Never offered as an automatic swap. */
  custom?: boolean;
  /** Custom exercise the user deleted: hidden from pickers, kept so history still has a name. */
  archived?: boolean;
  /** strength ratio relative to the reference lift of its pattern (used for substitution weight conversion) */
  ratio: number;
  /** Optional cues or setup notes on a custom exercise. */
  notes?: string;
  /** "time": logged as weight × seconds (carries, planks, hangs). A set's `reps` then holds seconds. Missing = reps. */
  measure?: "reps" | "time";
}

export type ProgressionStyle = "double" | "straight";
export type Technique = "drop" | "restpause" | "failure" | null;

export interface ProgramExercise {
  id: string;
  exId: string;
  sets: number;
  repMin: number;
  repMax: number;
  startWeight: number;
  /** Smallest plate step you can load (lb: 5 barbell / 2.5 micro, kg: 2.5 / 1.25). Jumps are rounded to this. */
  increment: number;
  /** Jump size as % of working weight (default 2.5). The engine rounds weight × pct to the plate step, never below one step. */
  incrementPct?: number;
  style: ProgressionStyle;
  technique: Technique;
  restSec?: number;
}

export interface ProgramDay {
  id: string;
  name: string;
  weekdays: number[]; // 0 = Sunday
  exercises: ProgramExercise[];
}

export interface Program {
  name: string;
  startDate: string; // YYYY-MM-DD
  days: ProgramDay[];
  deloadUntil?: string | null;
  /** set by the server when a coach edits this program */
  coachEditedAt?: number;
  coachEditedBy?: string;
  /** Only on shared copies: the custom exercises this program uses, so they arrive with it. */
  customExercises?: Exercise[];
}

export type CalorieSplitMode = "flat" | "training" | "weekend";

export interface Profile {
  name: string;
  units: Units;
  bodyWeight: number;
  heightCm: number;
  age: number;
  sex: Sex;
  experience: Experience;
  goal: Goal;
  gym: string;
  coachMode: boolean;
  onboarded: boolean;
  barWeight: number;
  /** When the optional pledge was signed (YYYY-MM-DD). */
  pledgedAt?: string | null;
  /** First-run tour: false = show it on Today; missing or true = done. Only new accounts start at false. */
  tourDone?: boolean;
  /** The user's own maintenance calories (kcal/day). Replaces the BMR × activity estimate when set. */
  maintenanceKcal?: number | null;
  /**
   * How daily calories vary across the week (the weekly total stays the same):
   * flat = same every day · training = more on training days, less on rest days · weekend = more Sat–Sun, less Mon–Fri.
   * amount = kcal added on the higher days. Missing = training, +150 (the original behaviour).
   */
  calorieSplit?: { mode: CalorieSplitMode; amount: number };
}

/** A drop set strips weight and keeps going; a rest-pause set rests ~15s and squeezes out mini-sets at the same weight. */
export type SetKind = "drop" | "restpause";
/** One drop (drop set) or one mini-set (rest-pause) after the main part of a set. */
export interface SetPart { weight: number; reps: number }

export interface SetLog {
  /** The main (first) part of the set. Progression, e1RM and PRs only look at this. */
  weight: number;
  reps: number;
  /** Missing or null = a normal straight set. */
  kind?: SetKind | null;
  /** Drops or mini-sets done right after the main part. Counted in volume, not in progression. */
  parts?: SetPart[];
  rir?: number | null;
  /** Set quality 1–5: 1 grind / form broke down … 5 crisp, bar speed held. Optional. */
  quality?: number | null;
  ts: number;
}

export interface ExerciseLog {
  peId: string;
  exId: string; // exercise actually performed
  originalExId: string;
  /** multiply logged weight by this to convert to original-exercise equivalent */
  equivFactor: number;
  targetWeight: number;
  sets: SetLog[];
  /** Added during the workout (not from the program day). Kept when the session re-syncs with the program. */
  extra?: boolean;
  /** Planned sets/reps for exercises outside the program (freestyle, saved workouts, added mid-workout). */
  plan?: { sets: number; repMin: number; repMax: number };
  /** Exercises in the same workout sharing this id are a superset: do one set of each back to back, then rest. */
  superset?: string | null;
}

/** What the user did to warm up before lifting (or that they skipped it). */
export interface SessionWarmup {
  status: "done" | "skipped";
  /** Warm-up ids from the library; cardio items carry minutes. */
  items: { id: string; min?: number }[];
  ts: number;
}

export interface Session {
  id: string;
  dayId: string;
  dayName: string;
  date: string;
  start: number;
  end: number | null;
  exercises: ExerciseLog[];
  coachNote?: string;
  deload?: boolean;
  restEnd?: number | null;
  restTotal?: number;
  warmup?: SessionWarmup;
}

export interface CheckIn {
  date: string;
  bodyWeight?: number | null;
  sleepH?: number | null;
  sleepQ?: number | null;
  hrv?: number | null;
  rhr?: number | null;
  energy?: number | null;
  stress?: number | null;
  soreness: Partial<Record<Muscle, number>>;
  steps?: number | null;
  notes?: string;
  experimentDone?: boolean | null;
}

export interface Meal {
  id: string;
  date: string;
  time: number;
  name: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  items?: MealItem[];
}

export interface MealItem {
  foodId: string;
  name: string;
  brand?: string;
  qty: number;
  unit: string;
  grams: number;
  cal: number;
  p: number;
  c: number;
  f: number;
}

export interface Favorite {
  id: string;
  name: string;
  cal: number;
  p: number;
  c: number;
  f: number;
  items?: MealItem[];
}

export interface RecentFood {
  food: import("./foodTypes").FoodDef;
  qty: number;
  unit: string;
  ts: number;
}

export interface Experiment {
  id: string;
  template: string;
  name: string;
  question: string; // yes/no check-in prompt
  startDate: string; // baseline start
  baselineDays: number;
  experimentDays: number;
  log: Record<string, boolean>;
  status: "active" | "complete" | "abandoned";
}

export interface Photo {
  id: string;
  date: string;
  dataUrl: string;
  label: string;
}

export interface Measurement {
  date: string;
  waist?: number | null;
  chest?: number | null;
  arms?: number | null;
  thighs?: number | null;
}

export interface Spotter {
  id: string;
  name: string;
  handle: string;
  gym: string;
  split: string;
  schedule: number[]; // weekdays
  trainTime: "morning" | "midday" | "evening";
  sex: "m" | "f";
  bodyWeightKg: number;
  lifts: Record<string, number>; // exId -> best e1RM kg
  trainingNow: boolean;
  missedThisWeek: boolean;
  streak: number;
  adherence: number; // 0-1
  friend: boolean;
}

export interface FeedComment {
  id: string;
  author: string; // spotter id or "me"
  text: string;
  ts: number;
}

export interface FeedPost {
  id: string;
  author: string; // spotter id or "me"
  ts: number;
  sessionName: string;
  /** timed: reps holds seconds (carries, holds). */
  topSets: { name: string; weight: number; reps: number; units: Units; timed?: boolean }[];
  prs: string[];
  durationMin: number;
  likes: string[];
  comments: FeedComment[];
  sessionId?: string;
  /** Non-lifting posts: a run/ride/class/WOD, or a reached goal. Missing = a lifting workout. */
  type?: "activity" | "goal";
  /** Big line on the card ("5.02 MI", "AMRAP 12") and the line under it. */
  headline?: string;
  detail?: string;
  /** Short badge in the card header ("RUN", "WOD", "GOAL"). */
  badge?: string;
}

export interface Crew {
  id: string;
  name: string;
  members: string[]; // includes "me"
  streak: number;
  best: number;
}

export interface ClientNote {
  id: string;
  date: string;
  text: string;
}

export interface Client {
  id: string;
  name: string;
  goal: Goal;
  readiness: number[]; // last 7 days, oldest first
  adherence: number; // 0-1 last 4 weeks
  missedRecent: number;
  lastSession: { date: string; name: string; topSet: string };
  program: Program;
  notes: ClientNote[];
  protein: number[]; // last 7 days % of target
  recent: { id: string; date: string; name: string; topSet: string; note: string }[];
}

export interface ChatMsg {
  id: string;
  role: "user" | "coach";
  text: string;
  ts: number;
}

export interface SavedProgram {
  id: string;
  name: string;
  savedAt: number;
  /** Where it came from: "mine" (saved copy), "code" (imported by share code), "coach", "import" (screenshot / text). */
  source: "mine" | "code" | "coach" | "import";
  from?: string;
  program: Program;
}

export interface ProgramInboxItem {
  id: string;
  from: string;
  fromId: string;
  ts: number;
  program: Program;
}

/** A workout you can start any time; it never changes the weekly schedule. */
export interface SavedWorkout {
  id: string;
  name: string;
  exercises: ProgramExercise[];
}

/* ---------- non-lifting workouts ---------- */
export type ActivityType =
  | "run" | "walk" | "hike" | "cycle" | "row" | "swim" | "elliptical" | "stairs"
  | "wod" | "hiit" | "yoga" | "pilates" | "sport" | "other";
export type WodFormat = "for_time" | "amrap" | "emom" | "other";

/** A run, ride, class, sport or CrossFit WOD. Distance is stored in km whatever the display units. */
export interface Activity {
  id: string;
  type: ActivityType;
  date: string; // YYYY-MM-DD
  start: number; // ms
  durationSec: number;
  distanceKm?: number | null;
  /** Effort 1–10 (RPE). */
  rpe?: number | null;
  avgHr?: number | null;
  /** e.g. "Morning 5K", "Fran", or the sport for type "sport" ("Basketball"). */
  name?: string;
  notes?: string;
  wod?: {
    format: WodFormat;
    /** AMRAP: full rounds + extra reps. */
    rounds?: number | null;
    reps?: number | null;
    /** For time: the time cap, if any. */
    capSec?: number | null;
    /** Free-text score for other formats ("5 rounds + 12", "142 lb"). */
    score?: string;
    rx: boolean;
    /** Exercise ids from the catalog, or "act:run" / "act:row" / "act:cycle" for cardio pieces. */
    movements: string[];
  };
}

export type HabitMetric = "workouts" | "protein" | "sleep" | "checkins";

interface GoalBase {
  id: string;
  /** Optional name the user gave it; otherwise one is generated from the target. */
  title?: string;
  createdAt: string; // YYYY-MM-DD
  deadline?: string | null;
  /** Set when the goal is first met (or the user marks it done). */
  achievedAt?: string | null;
  /** Hidden from the active list (deleted goals are removed outright). */
  archived?: boolean;
}

/** A personal target with a number to hit. Weights are in the profile's units. */
export type PersonalGoal = GoalBase & (
  | { kind: "bodyweight"; start: number; target: number }
  | { kind: "lift"; exId: string; weight: number; reps: number; /** best estimated 1RM when the goal was set */ startE1rm: number }
  | {
      kind: "cardio"; activity: ActivityType;
      /** time: cover distanceKm in timeSec or less · weekly: distanceKm per week · longest: one session of distanceKm */
      metric: "time" | "weekly" | "longest";
      distanceKm: number; timeSec?: number | null; weeks?: number | null;
      /** time goals: predicted time for the distance when the goal was set */
      startSec?: number | null;
    }
  | { kind: "habit"; metric: HabitMetric; perWeek: number; /** weeks in a row to finish it; none = ongoing */ weeks?: number | null; /** sleep metric only */ sleepHours?: number }
);
export type GoalKind = PersonalGoal["kind"];

export interface AppState {
  version: number;
  profile: Profile | null;
  program: Program | null;
  sessions: Session[];
  checkins: CheckIn[];
  meals: Meal[];
  favorites: Favorite[];
  recentFoods?: RecentFood[];
  experiments: Experiment[];
  photos: Photo[];
  measurements: Measurement[];
  spotters: Spotter[];
  feed: FeedPost[];
  crews: Crew[];
  gymCheckin: { gym: string; ts: number } | null;
  clients: Client[];
  chat: ChatMsg[];
  activeSession: Session | null;
  /** Reusable workouts outside the weekly schedule (e.g. "Arm day"). */
  savedWorkouts?: SavedWorkout[];
  /** Show the warm-up step before each workout (default on). */
  warmupPrompt?: boolean;
  /** Runs, rides, classes, sports and WODs (lifting lives in sessions). */
  activities?: Activity[];
  /** Personal goals: bodyweight, lift targets, cardio, weekly habits. */
  goals?: PersonalGoal[];
  /** Exercises the user made themselves (merged into EX at load). */
  customExercises?: Exercise[];
  /** Programs saved for later (copies, templates you wrote, ones you imported). */
  savedPrograms?: SavedProgram[];
  /** Programs a coach sent you, waiting for a decision. */
  programInbox?: ProgramInboxItem[];
  /** Inbox ids you dismissed (so the server doesn't re-add them). */
  programInboxDismissed?: string[];
  /** Notification preferences (mirrors what the server has for this account). */
  notifPrefs?: { spotters: boolean; coach: boolean; checkin: boolean; checkinHour: number; meals: boolean; streak: boolean; streakHour: number };
  /** What the reminder scheduler needs from the client: timezone, upcoming planned training dates, protein target. */
  notifPlan?: { tz: string; plannedDates: string[]; proteinTarget: number; streak: number; updatedAt: string };
  /** Dismissed the "turn on notifications" nudge on Today. */
  notifNudgeDismissed?: boolean;
  restDefaults: { compound: number; isolation: number };
  demo: boolean;
}
