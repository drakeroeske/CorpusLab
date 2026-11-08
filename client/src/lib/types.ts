export type Units = "lb" | "kg";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal = "muscle" | "strength" | "fatloss" | "recomp";
export type Sex = "m" | "f" | null;

export type Muscle =
  | "chest" | "shoulders" | "rear_delts" | "triceps" | "biceps" | "forearms" | "abs"
  | "lats" | "upper_back" | "lower_back" | "glutes" | "quads" | "hamstrings" | "calves";

export type Pattern =
  | "squat" | "hinge" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull" | "isolation";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "smith" | "kettlebell";

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
  /** strength ratio relative to the reference lift of its pattern (used for substitution weight conversion) */
  ratio: number;
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
}

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
}

export interface SetLog {
  weight: number;
  reps: number;
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
  topSets: { name: string; weight: number; reps: number; units: Units }[];
  prs: string[];
  durationMin: number;
  likes: string[];
  comments: FeedComment[];
  sessionId?: string;
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
  /** Programs saved for later (copies, templates you wrote, ones you imported). */
  savedPrograms?: SavedProgram[];
  /** Programs a coach sent you, waiting for a decision. */
  programInbox?: ProgramInboxItem[];
  /** Inbox ids you dismissed (so the server doesn't re-add them). */
  programInboxDismissed?: string[];
  restDefaults: { compound: number; isolation: number };
  demo: boolean;
}
