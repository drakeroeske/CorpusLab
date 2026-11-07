import { buildDemo } from "../client/src/lib/demo";
import * as E from "../client/src/lib/engine";
import { EX } from "../client/src/lib/exercises";
const s = buildDemo();
const today = E.dateKey();
console.log("sessions", s.sessions.length, "checkins", s.checkins.length, "meals", s.meals.length);
for (const id of E.performedExerciseIds(s.sessions)) {
  const ser = E.e1rmSeries(s.sessions, id);
  console.log(id.padEnd(20), ser.map(x=>Math.round(x.e1rm)).join(" "), E.isPlateau(ser)?"PLATEAU":"");
}
console.log(E.plateauFlags(s, today));
const t = E.nutritionTargets(s.profile!, 4); E.setProteinTarget(t.protein);
const day = E.dayForDate(s.program, today); console.log("today", day?.name);
const ci = s.checkins.find(c=>c.date===today);
const r = E.computeReadiness(ci, E.hrvBaseline(s.checkins, today), E.dayMuscles(day)); console.log(r.score, r.confidence, r.reason);
const rep = E.weeklyReport(s, E.weekStart(E.addDays(today,-7)), t); console.log(rep.insights, rep.focus, rep.completed, rep.planned, rep.prs.length);
const rep2 = E.weeklyReport(s, E.weekStart(today), t); console.log(rep2.insights, rep2.focus);
console.log(E.deloadCheck(s, today));
console.log(E.projection(E.e1rmSeries(s.sessions,"bench_press"), today, "lb"));
console.log(E.bodyComp(E.bodyWeightSeries(s), E.strengthTrendPct(s.sessions, today), today));
const exp = s.experiments[0]; console.log(E.experimentPhase(exp,today), E.experimentReport(s,exp,today));
const f = E.muscleFatigue(s.sessions, s.checkins, s.meals, t.protein, Date.now()); console.log(Object.fromEntries(Object.entries(f).map(([k,v])=>[k,E.fatiguePct(v)])));
for (const pe of day!.exercises) { const rx = E.prescribe(pe, E.logsForPe(s.sessions, pe.id), r.score, false, "lb"); console.log(EX[pe.exId].name, rx.weight, rx.repMin+"-"+rx.repMax, rx.rir, rx.why); }
console.log(E.coachAnswer("why did my overhead press stall?", {state:s,today,targets:t,readiness:r,units:"lb"}));
console.log(JSON.stringify(s).length);
console.log("hit", E.proteinHitRate(s, t.protein, today, 14));
