import type { AppState, Program, Units } from "./types";
import { LB_PER_KG, roundTo } from "./engine";

const incMap: Record<Units, Record<number, number>> = {
  kg: { 2.5: 1.25, 5: 2.5, 10: 5, 20: 10 },
  lb: { 1.25: 2.5, 2: 5, 2.5: 5, 5: 10, 10: 20 },
};

export function convertProgram(p: Program, from: Units, to: Units): Program {
  if (from === to) return p;
  const f = to === "kg" ? 1 / LB_PER_KG : LB_PER_KG;
  return {
    ...p,
    days: p.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        const inc = incMap[to][e.increment] ?? roundTo(e.increment * f, 0.25);
        return { ...e, increment: inc, startWeight: roundTo(e.startWeight * f, inc) };
      }),
    })),
  };
}

/** Convert every stored weight & length when the user switches units */
export function convertUnits(s: AppState, to: Units): AppState {
  const from = s.profile?.units ?? "lb";
  if (from === to || !s.profile) return s;
  const f = to === "kg" ? 1 / LB_PER_KG : LB_PER_KG;
  const len = to === "kg" ? 2.54 : 1 / 2.54; // inches <-> cm for measurements
  const w = (x: number) => Math.round(x * f * 2) / 2;
  const w1 = (x: number) => Math.round(x * f * 10) / 10;
  const l = (x?: number | null) => (x == null ? x : Math.round(x * len * 10) / 10);
  return {
    ...s,
    profile: { ...s.profile, units: to, bodyWeight: w1(s.profile.bodyWeight), barWeight: to === "kg" ? 20 : 45 },
    program: s.program ? convertProgram(s.program, from, to) : s.program,
    sessions: s.sessions.map((x) => ({ ...x, exercises: x.exercises.map((e) => ({ ...e, targetWeight: w(e.targetWeight), sets: e.sets.map((st) => ({ ...st, weight: w(st.weight) })) })) })),
    activeSession: s.activeSession ? { ...s.activeSession, exercises: s.activeSession.exercises.map((e) => ({ ...e, targetWeight: w(e.targetWeight), sets: e.sets.map((st) => ({ ...st, weight: w(st.weight) })) })) } : null,
    checkins: s.checkins.map((c) => ({ ...c, bodyWeight: c.bodyWeight != null ? w1(c.bodyWeight) : c.bodyWeight })),
    measurements: s.measurements.map((m) => ({ ...m, waist: l(m.waist), chest: l(m.chest), arms: l(m.arms), thighs: l(m.thighs) })),
    feed: s.feed.map((p) => (p.author === "me" ? { ...p, topSets: p.topSets.map((t) => ({ ...t, weight: w(t.weight), units: to })) } : p)),
  };
}

export function downloadText(name: string, text: string, mime = "application/json") {
  try {
    const url = "data:" + mime + ";charset=utf-8," + encodeURIComponent(text);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch { return false; }
}

export function downloadDataUrl(name: string, dataUrl: string) {
  try {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch { return false; }
}
