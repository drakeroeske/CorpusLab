import type { AppState, CheckIn, Client, Crew, ExerciseLog, FeedPost, Meal, Muscle, Profile, Session, Spotter } from "./types";
import { buildTemplate, EX, isCompound, newId } from "./exercises";
import {
  addDays, clamp, daysBetween as daysBetweenK, computeReadiness, dateKey, dayForDate, dayMuscles, e1rm, hrvBaseline, logsForPe,
  nutritionTargets, parseKey, prescribe, sessionPRs, toKg, trainingDaysPerWeek, weekdayOf,
} from "./engine";
import { emptyState } from "./empty";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const at = (date: string, h: number, m = 0) => { const d = parseKey(date); d.setHours(h, m, 0, 0); return d.getTime(); };

export interface DemoOpts {
  seed?: number; profile?: Partial<Profile>; template?: string; strength?: number; sleepShift?: number;
  proteinShift?: number; skipRate?: number; todaySleep?: number; todayHrv?: number; bwStart?: number; bwTrend?: number; recentSleepDrop?: number; recentSkipRate?: number;
}

export function buildDemo(o: DemoOpts = {}): AppState {
  const R = rng(o.seed ?? 42);
  const strength = o.strength ?? 1;
  const n = (mu: number, sd: number) => { const u = R() || 1e-9, v = R(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const today = dateKey();
  // program starts on the Monday 8 weeks back
  let start = addDays(today, -56);
  while (weekdayOf(start) !== 1) start = addDays(start, -1);

  const profile: Profile = {
    name: "Alex Rivera", units: "lb", bodyWeight: 183, heightCm: 180, age: 29, sex: "m", experience: "intermediate",
    goal: "muscle", gym: "Forge Athletic Club", coachMode: false, onboarded: true, barWeight: 45, ...o.profile,
  };
  const program = buildTemplate(o.template ?? "ul4", "lb", profile.experience, start);
  if (strength !== 1) program.days.forEach((d) => d.exercises.forEach((pe) => { if (pe.startWeight) pe.startWeight = Math.max(5, Math.round((pe.startWeight * strength) / 5) * 5); }));
  const targets = nutritionTargets({ ...profile, bodyWeight: profile.bodyWeight - 3 }, trainingDaysPerWeek(program));

  const sessions: Session[] = [];
  const checkins: CheckIn[] = [];
  const meals: Meal[] = [];
  const trueE1: Record<string, number> = {};
  program.days.forEach((d) => d.exercises.forEach((pe) => {
    const ex = EX[pe.exId];
    const base = pe.startWeight || (ex.equipment === "bodyweight" ? 25 : 20);
    trueE1[pe.id] = base * (1 + (pe.repMin + 4) / 30) * (pe.startWeight ? 1 : strength);
  }));
  const ohpPe = program.days.flatMap((d) => d.exercises).find((e) => e.exId === "ohp");

  let bw = o.bwStart ?? 179.6;
  const totalDays = daysBetweenK(start, today);
  const expStart = addDays(today, -23);
  const expLog: Record<string, boolean> = {};

  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(start, i);
    if (date > today) break;
    const isToday = date === today;
    const weekN = i / 7;
    // ---------- sleep (rough patch in week 5) ----------
    let sleep = n(7.55 + (o.sleepShift ?? 0), 0.55);
    if (weekN >= 4.2 && weekN < 5.2) sleep -= 1.1;
    if (weekdayOf(date) === 6) sleep += 0.5;
    if (i >= totalDays - 5) sleep -= o.recentSleepDrop ?? 0;
    if (isToday) sleep = o.todaySleep ?? 5.5;
    sleep = clamp(Math.round(sleep * 4) / 4, 4.5, 9.25);
    const sleepQ0 = clamp(Math.round(n(sleep >= 7.5 ? 4 : sleep >= 6.5 ? 3.2 : 2.3, 0.6)), 1, 5);
    const sleepQ = isToday ? 3 : sleepQ0;
    const hrvBase = 64;
    let hrv = Math.round(n(hrvBase + (sleep - 7.2) * 5, 4));
    if (isToday) { const b = hrvBaseline(checkins, date); hrv = Math.round((b ?? 64) * (o.todayHrv ?? 0.88)); }
    const rhr = Math.round(n(53 - (sleep - 7.2) * 1.5, 1.5));
    const energy = clamp(Math.round(n(2.5 + (sleep - 5.5) * 0.7, 0.5)), 1, 5);
    const stress = clamp(Math.round(n(weekN >= 4.2 && weekN < 5.2 ? 3.6 : 2.4, 0.8)), 1, 5);
    bw += n(o.bwTrend ?? 0.055, 0.05);
    const bodyWeight = Math.round((bw + n(0, 0.5)) * 10) / 10;
    // soreness from yesterday's session
    const soreness: Partial<Record<Muscle, number>> = {};
    const yday = sessions.find((s) => s.date === addDays(date, -1)) ?? sessions.find((s) => s.date === addDays(date, -2));
    if (yday) {
      const ms = new Set<Muscle>();
      yday.exercises.forEach((l) => EX[l.exId].primary.forEach((m) => ms.add(m)));
      ms.forEach((m) => { const v = clamp(Math.round(n(1.6, 0.9)), 0, 4); if (v) soreness[m] = v; });
    }
    if (isToday) { soreness.quads = 3; soreness.glutes = 2; soreness.hamstrings = 2; }
    const skipCheckin = !isToday && R() < 0.07;
    if (!skipCheckin) {
      checkins.push({
        date, bodyWeight: R() < 0.9 || isToday ? bodyWeight : null, sleepH: sleep, sleepQ, hrv, rhr, energy: isToday ? 4 : energy,
        stress: isToday ? 2 : stress, soreness, steps: Math.round(n(8600, 2200)),
        notes: "", experimentDone: date >= addDays(expStart, 14) ? R() < 0.92 : null,
      });
    }
    if (date >= addDays(expStart, 14) && date < today) expLog[date] = checkins[checkins.length - 1]?.experimentDone ?? true;

    // ---------- nutrition ----------
    const day = dayForDate(program, date);
    const lastWeek = i >= totalDays - 10;
    const proteinFactor = (o.proteinShift ?? 0) + (lastWeek ? (R() < 0.6 ? n(0.78, 0.05) : n(1.02, 0.04)) : weekN >= 4.2 && weekN < 5.2 ? n(0.86, 0.08) : n(1.0, 0.07));
    const calTarget = day ? targets.trainingCal : targets.restCal;
    const calFactor = n(1.0, 0.06);
    const preCarbs = day && R() < 0.55;
    const mealPlan = [
      { name: "Greek yogurt + oats", h: 7, m: 40, share: 0.22 },
      { name: "Chicken rice bowl", h: 12, m: 30, share: 0.3 },
      ...(preCarbs ? [{ name: "Bagel + banana", h: 15, m: 50, share: 0.12, carbBoost: true }] : [{ name: "Protein shake", h: 15, m: 30, share: 0.08 }]),
      { name: "Salmon, potatoes, greens", h: 19, m: 30, share: 0.36 },
    ];
    if (!isToday || true) {
      const shareSum = mealPlan.reduce((a, x) => a + x.share, 0);
      for (const mp of mealPlan) {
        if (isToday && mp.h > 13) continue;
        const cal = Math.round((calTarget * calFactor * mp.share) / shareSum / 5) * 5;
        const p = Math.round((targets.protein * proteinFactor * mp.share) / shareSum);
        const carbBoost = (mp as { carbBoost?: boolean }).carbBoost;
        const c = carbBoost ? Math.round(cal * 0.75 / 4) : Math.round((cal * 0.45) / 4);
        const f = Math.max(2, Math.round((cal - p * 4 - c * 4) / 9));
        meals.push({ id: newId("meal"), date, time: at(date, mp.h, mp.m), name: mp.name, cal, p, c, f });
      }
    }

    // ---------- training ----------
    if (!day || isToday) continue;
    if (i === 17 || i === 38 || R() < (i >= totalDays - 14 ? o.recentSkipRate ?? o.skipRate ?? 0 : o.skipRate ?? 0)) continue; // missed sessions
    const ci = checkins.find((c) => c.date === date);
    const rd = computeReadiness(ci, hrvBaseline(checkins, date), dayMuscles(day));
    const sStart = at(date, 17, 30 + Math.round(n(0, 10)));
    let t = sStart + 6 * 60000;
    const logs: ExerciseLog[] = [];
    const perfMod = 1 + ((rd.score ?? 75) - 75) / 1500 + (sleep - 7.4) * 0.01 + (preCarbs ? 0.01 : 0);
    for (const pe of day.exercises) {
      const ex = EX[pe.exId];
      const growth = pe.id === ohpPe?.id ? (weekN < 4 ? 0.02 : 0) : isCompound(ex) ? 0.021 : 0.014;
      trueE1[pe.id] *= 1 + growth;
      const prev = logsForPe(sessions, pe.id);
      const rx = prescribe(pe, prev, rd.score, false, "lb");
      const w = rx.weight > 0 ? rx.weight : 0;
      const sets = [];
      const cap = trueE1[pe.id] * perfMod * (pe.id === ohpPe?.id && weekN >= 4 ? 0.985 : 1);
      for (let k = 0; k < rx.sets; k++) {
        const eff = w > 0 ? w : 20;
        const maxReps = Math.max(1, Math.floor(30 * (cap / eff - 1)));
        const rir = rx.rir;
        let reps = clamp(maxReps - rir - k, Math.max(1, pe.repMin - 3), pe.repMax + 3);
        if (k === 0 && R() < 0.08) reps = Math.max(1, reps - 1);
        sets.push({ weight: w, reps, rir: clamp(maxReps - reps - k, 0, 4), ts: t });
        t += (isCompound(ex) ? 3 : 1.6) * 60000 + Math.round(R() * 40000);
      }
      logs.push({ peId: pe.id, exId: pe.exId, originalExId: pe.exId, equivFactor: 1, targetWeight: rx.weight, sets });
    }
    sessions.push({ id: newId("ses"), dayId: day.id, dayName: day.name, date, start: sStart, end: t + 3 * 60000, exercises: logs });
  }

  // ---------- spotters ----------
  const sp = (o: Partial<Spotter> & Pick<Spotter, "id" | "name">): Spotter => ({
    handle: "@" + o.name.split(" ")[0].toLowerCase(), gym: "Forge Athletic Club", split: "Upper/Lower", schedule: [1, 2, 4, 5],
    trainTime: "evening", sex: "m", bodyWeightKg: 80, lifts: {}, trainingNow: false, missedThisWeek: false, streak: 10, adherence: 0.9, friend: true, ...o,
  });
  const spotters: Spotter[] = [
    sp({ id: "maya", name: "Maya Chen", sex: "f", bodyWeightKg: 62, split: "Upper/Lower", schedule: [1, 2, 4, 5], trainTime: "evening", lifts: { bench_press: 72, back_squat: 112, deadlift: 138, ohp: 46 }, trainingNow: true, streak: 31, adherence: 0.96 }),
    sp({ id: "jordan", name: "Jordan Brooks", bodyWeightKg: 88, split: "Push/Pull/Legs", schedule: [1, 2, 3, 4, 5, 6], trainTime: "morning", lifts: { bench_press: 128, back_squat: 175, deadlift: 215, ohp: 78 }, streak: 18, adherence: 0.88 }),
    sp({ id: "sam", name: "Sam Okafor", bodyWeightKg: 76, gym: "Rogue Valley Barbell", split: "Full Body", schedule: [1, 3, 5], trainTime: "midday", lifts: { bench_press: 100, back_squat: 150, deadlift: 190, ohp: 62 }, trainingNow: true, streak: 9, adherence: 0.82 }),
    sp({ id: "priya", name: "Priya Nair", sex: "f", bodyWeightKg: 58, gym: "Forge Athletic Club", split: "Upper/Lower", schedule: [1, 2, 4, 6], trainTime: "evening", lifts: { bench_press: 55, back_squat: 95, deadlift: 120, ohp: 37 }, trainingNow: true, streak: 14, adherence: 0.91 }),
    sp({ id: "luis", name: "Luis Ortega", bodyWeightKg: 95, gym: "Anytime Fitness Downtown", split: "Push/Pull/Legs", schedule: [0, 2, 3, 5, 6], trainTime: "morning", lifts: { bench_press: 142, back_squat: 190, deadlift: 235, ohp: 85 }, streak: 4, adherence: 0.74, friend: false }),
  ];

  // ---------- feed ----------
  const feed: FeedPost[] = [];
  const kgLb = (kg: number) => Math.round((kg * 2.20462) / 5) * 5;
  const spotterSessions: Record<string, string[]> = { maya: ["Upper A", "Lower A", "Upper B"], jordan: ["Push", "Pull", "Legs"], sam: ["Full Body A", "Full Body B"], priya: ["Upper", "Lower"], luis: ["Push", "Legs"] };
  const comments = ["Clean.", "That bar speed though", "Strong week", "Spot me next time", "Let's go", "Sleep paying off", "Big PR"];
  spotters.forEach((s, si) => {
    for (let k = 0; k < 3; k++) {
      const ts = Date.now() - (k * 2.3 + si * 0.4 + 0.2) * 86400000;
      const lift = ["bench_press", "back_squat", "deadlift", "ohp"][(k + si) % 4];
      const top = s.lifts[lift] / (1 + 5 / 30);
      feed.push({
        id: newId("post"), author: s.id, ts, sessionName: spotterSessions[s.id][k % spotterSessions[s.id].length],
        topSets: [{ name: EX[lift].name, weight: kgLb(top), reps: 5, units: "lb" }, { name: EX[["barbell_row", "rdl", "lat_pulldown"][k % 3]].name, weight: kgLb(top * 0.75), reps: 8, units: "lb" }],
        prs: k === 0 && si % 2 === 0 ? [EX[lift].name] : [], durationMin: Math.round(55 + R() * 25),
        likes: spotters.filter((o) => o.id !== s.id && R() < 0.5).map((o) => o.id).concat(R() < 0.4 ? ["me"] : []),
        comments: R() < 0.6 ? [{ id: newId("c"), author: spotters[(si + 1) % 5].id, text: comments[(si + k) % comments.length], ts: ts + 3600000 }] : [],
      });
    }
  });
  const unitsOf = "lb" as const;
  sessions.slice(-6).forEach((s) => {
    const prs = sessionPRs(sessions, s).map((p) => EX[p.exId].name);
    feed.push({
      id: newId("post"), author: "me", ts: s.end!, sessionName: s.dayName, sessionId: s.id,
      topSets: s.exercises.slice(0, 3).map((l) => ({ name: EX[l.exId].name, weight: l.sets[0].weight, reps: l.sets[0].reps, units: unitsOf })),
      prs, durationMin: Math.round((s.end! - s.start) / 60000),
      likes: spotters.filter(() => R() < 0.5).map((o) => o.id),
      comments: prs.length ? [{ id: newId("c"), author: "maya", text: "PR machine", ts: s.end! + 1800000 }] : [],
    });
  });
  feed.sort((a, b) => b.ts - a.ts);

  const crews: Crew[] = [{ id: "crew1", name: "Forge 5:30 Crew", members: ["me", "maya", "jordan", "priya"], streak: 23, best: 41 }];

  // ---------- clients ----------
  const mkClient = (id: string, name: string, goal: Client["goal"], readiness: number[], adherence: number, missed: number, last: Client["lastSession"], tpl: string, protein: number[]): Client => ({
    id, name, goal, readiness, adherence, missedRecent: missed, lastSession: last,
    program: buildTemplate(tpl, "lb", "intermediate", start), notes: [], protein,
    recent: [0, 1, 2].map((k) => ({ id: newId("cs"), date: addDays(last.date, -k * 2 - (k ? 1 : 0)), name: k === 0 ? last.name : ["Upper B", "Lower B", "Push A"][k], topSet: k === 0 ? last.topSet : ["Bench Press 225×6", "Deadlift 365×3", "OHP 135×6"][k], note: "" })),
  });
  const clients: Client[] = [
    mkClient("jake", "Jake Morrison", "strength", [72, 68, 61, 55, 47, 44, 42], 0.9, 0, { date: addDays(today, -1), name: "Lower A", topSet: "Back Squat 315×4" }, "ul4", [96, 102, 88, 91, 99, 85, 93]),
    mkClient("maria", "Maria Santos", "fatloss", [78, 74, 80, 76, 71, 79, 77], 0.66, 2, { date: addDays(today, -5), name: "Full Body B", topSet: "Deadlift 205×5" }, "fb3", [82, 78, 90, 71, 85, 80, 76]),
    mkClient("devon", "Devon Park", "muscle", [81, 84, 79, 86, 83, 88, 85], 0.97, 0, { date: addDays(today, -1), name: "Pull B", topSet: "Barbell Row 205×8" }, "ppl6", [104, 98, 110, 101, 97, 105, 102]),
  ];
  clients[0].recent[0].note = "Squat depth looked good. Watch knees caving on rep 4+.";

  return {
    ...emptyState(),
    profile, program, sessions, checkins, meals,
    favorites: [
      { id: newId("fav"), name: "Protein shake", cal: 160, p: 30, c: 4, f: 2 },
      { id: newId("fav"), name: "Chicken rice bowl", cal: 680, p: 52, c: 78, f: 14 },
      { id: newId("fav"), name: "Greek yogurt + oats", cal: 420, p: 34, c: 52, f: 8 },
      { id: newId("fav"), name: "Bagel + banana", cal: 390, p: 12, c: 80, f: 3 },
    ],
    experiments: [{
      id: newId("exp"), template: "creatine", name: "Creatine 5 g/day", question: "Took 5 g creatine today?",
      startDate: expStart, baselineDays: 14, experimentDays: 28, log: expLog, status: "active",
    }],
    measurements: [
      { date: addDays(today, -49), waist: 32.5, chest: 41, arms: 14.6, thighs: 23.4 },
      { date: addDays(today, -28), waist: 32.6, chest: 41.5, arms: 14.9, thighs: 23.7 },
      { date: addDays(today, -6), waist: 32.7, chest: 41.9, arms: 15.1, thighs: 23.9 },
    ],
    spotters, feed, crews, clients,
    chat: [{ id: newId("m"), role: "coach", ts: Date.now(), text: "I read your check-ins, logs, and meals. Ask me why a lift stalled, whether to deload, or how your body composition is trending." }],
    demo: true,
    restDefaults: { compound: 180, isolation: 90 },
  };
}

export const kgToLb = (kg: number) => kg * 2.20462;
export { toKg };
