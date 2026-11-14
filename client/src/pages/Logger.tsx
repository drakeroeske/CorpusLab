import { Info, Term } from "@/components/Term";
import { useEffect, useMemo, useRef, useState, type TouchEvent as RTouchEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Disc, Flame, Link2, List as ListIcon, Plus, Repeat, Timer, Unlink, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { freeLog, freeRx, isFreeSession, newSession, savedFromSession, prescriptionsFor, prWhyStat, sessionStale, sessionSummary, syncSession, useToday } from "@/lib/derived";
import { StartWorkoutSheet } from "@/components/StartWorkout";
import { SaveAsWorkoutSheet } from "@/components/SavedWorkouts";
import { ExercisePicker } from "@/components/ProgramEditor";
import { Tag } from "@/components/riso";
import { e1rm, fmtDate, fmtW, jumpFor, logsForPe, platesPerSide, prescribe, restDefault, substitutes, warmupSets, type Prescription } from "@/lib/engine";
import { EX, MUSCLE_LABEL, isCompound, newId } from "@/lib/exercises";
import type { ExerciseLog, FeedPost, ProgramExercise, Session, SetKind, SetPart, Units } from "@/lib/types";
import { Seg, Sheet, Stepper } from "@/components/ui";
import { PRCardSheet, type PRData } from "@/components/PRCard";
import { EditSetSheet, KIND_LABEL, SetRow, SetTypeFields, defaultParts, normalizeSet } from "@/components/SetEditor";
import { afterSupersetSet, linkSuperset, supersetGroup, unlinkSuperset } from "@/lib/superset";

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.floor(s) % 60)).padStart(2, "0")}`;

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

export function PlateViz({ total, bar, units }: { total: number; bar: number; units: "lb" | "kg" }) {
  const { plates, remainder } = platesPerSide(total, bar, units);
  const maxP = units === "lb" ? 45 : 25;
  return (
    <div>
      <div className="flex items-center justify-center gap-[3px]" style={{ height: 96 }} data-testid="viz-plates">
        <div style={{ width: 54, height: 8, background: "var(--border-strong)", borderRadius: 2 }} />
        <div style={{ width: 8, height: 24, background: "var(--muted)", borderRadius: 2 }} />
        {plates.map((p, i) => (
          <div key={i} title={`${p}`} style={{ width: p >= maxP * 0.5 ? 16 : 11, height: 30 + (p / maxP) * 62, background: p >= maxP ? "var(--lime)" : p >= maxP * 0.5 ? "var(--brown)" : "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 3 }} />
        ))}
        <div style={{ width: 22, height: 8, background: "var(--border-strong)", borderRadius: 2 }} />
      </div>
      <div className="mono text-center text-sm mt-2" data-testid="text-plates">{plates.length ? `Per side: ${plates.join(" + ")}` : "Empty bar"}{remainder ? <span className="orange"> · {remainder} {units} can't be loaded</span> : null}</div>
    </div>
  );
}

/** Prescription stand-in for an exercise that was removed from the program mid-workout but already has sets. */
function orphanRx(log: ExerciseLog, readiness: number | null, deload: boolean, units: Units): { pe: ProgramExercise; rx: Prescription } {
  const pe: ProgramExercise = { id: log.peId, exId: log.originalExId, sets: Math.max(1, log.sets.length), repMin: 6, repMax: 12, startWeight: log.targetWeight, increment: units === "lb" ? 5 : 2.5, style: "double", technique: null };
  return { pe, rx: { ...prescribe(pe, [], readiness, deload, units), why: "Removed from program — logged sets still count" } };
}

const QUALITY_HINT: Record<number, string> = {
  1: "Grind — form broke down. A top set at 1–2 won't add weight next time.",
  2: "Hard — bar slowed a lot, form held. Same weight until it's cleaner.",
  3: "Solid — normal working set.",
  4: "Smooth — bar speed held through the set.",
  5: "Crisp — every rep looked the same. Ready for a jump.",
};

/** One exercise, full screen: target, logged sets, big inputs, Log set. Extras sit behind "More". */
function FocusExercise({ log, idx, rx, pe, fatigue, isFirstCompound, nextName, onNext, supersetWith, onLogged, onSuperset }: {
  log: ExerciseLog; idx: number; rx: Prescription; pe: ProgramExercise; fatigue: Record<string, number>; isFirstCompound: boolean; nextName: string | null; onNext: () => void;
  /** Names of the other exercises in this exercise's superset, or null. */
  supersetWith: string[] | null; onLogged: () => void; onSuperset: () => void;
}) {
  const { set, profile, state } = useStore();
  const ui = useUI();
  const u = profile.units;
  const ex = EX[log.exId];
  const subbed = log.exId !== log.originalExId;
  const subs = substitutes(log.originalExId, rx.weight, pe.increment || 5).filter((c) => c.ex.id !== log.exId);
  const target = log.targetWeight;
  const last = log.sets[log.sets.length - 1];
  const [w, setW] = useState<number>(last?.weight ?? target);
  const [reps, setReps] = useState<number>(last?.reps ?? rx.repGoal);
  const [rir, setRir] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<"warm" | "plates" | "sub" | null>(null);
  const [kind, setKind] = useState<SetKind | null>(null);
  const [parts, setParts] = useState<SetPart[]>([]);
  const [editSet, setEditSet] = useState<number | null>(null);
  useEffect(() => { setW(last?.weight ?? target); }, [target]); // eslint-disable-line
  // A program day can ask for a drop set or rest-pause on the last set: pick that type for you when you get there.
  const techKind: SetKind | null = pe.technique === "drop" ? "drop" : pe.technique === "restpause" ? "restpause" : null;
  useEffect(() => {
    if (techKind && log.sets.length === rx.sets - 1) { setKind(techKind); setParts(defaultParts(techKind, w, reps, inc)); }
  }, [log.sets.length]); // eslint-disable-line
  const hot = ex.primary.filter((m) => (fatigue[m] ?? 0) > 60);
  const done = log.sets.length >= rx.sets;
  const inc = subbed && ex.equipment === "dumbbell" ? (u === "lb" ? 5 : 2) : pe.increment || (u === "lb" ? 5 : 2.5);

  const updLog = (fn: (l: ExerciseLog) => ExerciseLog) => set((s) => s.activeSession ? { ...s, activeSession: { ...s.activeSession, exercises: s.activeSession.exercises.map((l, i) => (i === idx ? fn(l) : l)) } } : s);

  const logSet = () => {
    const rest = pe.restSec ?? restDefault(ex, state.restDefaults);
    set((s) => s.activeSession ? {
      ...s,
      activeSession: {
        ...s.activeSession, restEnd: Date.now() + rest * 1000, restTotal: rest,
        exercises: s.activeSession.exercises.map((l, i) => (i === idx ? { ...l, sets: [...l.sets, normalizeSet({ weight: w, reps, rir, quality, kind, parts, ts: Date.now() })] } : l)),
      },
    } : s);
    if (navigator.vibrate) try { navigator.vibrate(15); } catch { /* noop */ }
    setRir(null); setQuality(null); setKind(null); setParts([]);
    const isTop = log.sets.length === 0;
    onLogged();
    if (isTop && !supersetWith) ui.toast(reps >= pe.repMax ? (quality != null && quality <= 2 ? "Top of range but a grind — same weight next time, make it clean" : `Top of range — next time +${fmtW(jumpFor(pe, w))} ${u}`) : reps >= pe.repMin ? "In range — aim +1 rep next time" : "Below range — holding weight");
  };

  return (
    <section className="card" data-testid={`card-exercise-${idx}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] font-bold leading-tight min0" data-testid={`text-exercise-name-${idx}`}>{ex.name}</h2>
        {done ? <span className="chip chip-signal shrink-0"><Check size={12} /> Done</span> : <span className="chip shrink-0" data-testid={`text-set-count-${idx}`}>Set {log.sets.length + 1} of {rx.sets}</span>}
      </div>
      {subbed && <div className="text-[13px] muted mt-0.5">Swapped in for {EX[log.originalExId].name}</div>}
      {supersetWith && <div className="text-[13px] mt-1 flex items-center gap-1" data-testid={`text-superset-${idx}`}><Link2 size={13} /> Superset with {supersetWith.join(" and ")}</div>}
      <div className="mono text-[17px] mt-2" data-testid={`text-target-${idx}`}>
        <b>{target > 0 ? `${fmtW(target)} ${u}` : ex.equipment === "bodyweight" ? "Body weight" : rx.decision === "start" ? "Your pick" : "Body weight"}</b> × {rx.repMin}–{rx.repMax}
        <span className="muted text-[14px]" style={{ fontFamily: "var(--font-sans)" }}> · {rx.sets} sets · <Term k="rir">{rx.rir} RIR</Term></span>
      </div>

      {/* Tools that matter before or between sets. */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {isFirstCompound && target > 0 && log.sets.length === 0 && <button className="btn btn-sm btn-outline" onClick={() => setSheet("warm")} data-testid={`button-warmup-${idx}`}><Flame size={14} /> Warm-up</button>}
        {["barbell", "smith"].includes(ex.equipment) && <button className="btn btn-sm btn-outline" onClick={() => setSheet("plates")} data-testid={`button-plates-${idx}`}><Disc size={14} /> Plates</button>}
        <button className="btn btn-sm btn-outline" onClick={() => setSheet("sub")} data-testid={`button-sub-${idx}`}><Repeat size={14} /> Swap</button>
        <button className="btn btn-sm btn-outline" onClick={onSuperset} data-testid={`button-superset-${idx}`}><Link2 size={14} /> Superset</button>
      </div>

      {log.sets.length > 0 && (
        <div className="mt-3">
          {log.sets.map((st, i) => <SetRow key={i} set={st} n={i + 1} onEdit={() => setEditSet(i)} testId={`row-set-${idx}-${i}`} />)}
          <p className="text-[12px] faint mt-1">Tap a set to fix it or change its type.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="field"><span className="label">Weight ({u})</span><Stepper value={w} step={inc} unit={u} onChange={setW} testId={`stepper-weight-${idx}`} /></div>
        <div className="field"><span className="label">Reps · aim for {rx.repGoal}</span><Stepper value={reps} step={1} min={0} max={100} unit="reps" decimals={0} onChange={setReps} testId={`stepper-reps-${idx}`} /></div>
      </div>
      <div className="mt-3"><SetTypeFields kind={kind} parts={parts} weight={w} reps={reps} inc={inc} units={u} onChange={(k, p) => { setKind(k); setParts(p); }} testId={`set-type-${idx}`} /></div>

      <button className="btn btn-sm btn-ghost mt-2" style={{ paddingLeft: 0, whiteSpace: "normal", textAlign: "left" }} onClick={() => setMore(!more)} aria-expanded={more} data-testid={`button-more-${idx}`}>
        {more ? <ChevronDown size={16} /> : <ChevronRight size={16} />} More: effort, set quality, why this target
      </button>
      {more && (
        <div className="stack" style={{ gap: 10 }} data-testid={`panel-more-${idx}`}>
          <div className="field"><span className="label flex items-center">Reps in reserve (optional)<Info k="rir" /></span>
            <Seg className="seg-num" value={rir ?? -1} onChange={(v) => setRir(v === -1 ? null : v)} options={[{ v: -1, l: "–" }, { v: 0, l: "0" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }]} testId={`seg-rir-${idx}`} />
          </div>
          <div className="field"><span className="label">Set quality (optional) · 1 grind → 5 crisp</span>
            <Seg className="seg-num seg-lime" value={quality ?? -1} onChange={(v) => setQuality(v === -1 ? null : v)} options={[{ v: -1, l: "–" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }, { v: 5, l: "5" }]} testId={`seg-quality-${idx}`} />
            {quality != null && <p className="text-xs mt-1">{QUALITY_HINT[quality]}</p>}
          </div>
          <p className="text-[13px] muted" data-testid={`text-why-${idx}`}>{rx.why}</p>
          {hot.length > 0 && <p className="text-[13px] muted flex items-center flex-wrap" data-testid={`badge-fatigue-${idx}`}><Flame size={13} className="mr-1" /> {MUSCLE_LABEL[hot[0]]} is still {fatigue[hot[0]]}% fatigued <Info k="fatigue" size={13} /></p>}
        </div>
      )}

      <button className={`btn btn-lg btn-block mt-3 ${done ? "btn-outline" : "btn-primary"}`} onClick={logSet} data-testid={`button-log-set-${idx}`}>
        <Check size={18} /> {done ? (kind ? `Log an extra ${KIND_LABEL[kind].toLowerCase()}` : "Log an extra set") : kind ? `Log ${KIND_LABEL[kind].toLowerCase()}` : `Log set ${log.sets.length + 1}`} · <span className="mono">{fmtW(w)} × {reps}{kind && parts.length ? ` + ${parts.length} ${kind === "drop" ? (parts.length === 1 ? "drop" : "drops") : (parts.length === 1 ? "mini-set" : "mini-sets")}` : ""}</span>
      </button>
      {done && nextName && <button className="btn btn-lg btn-block btn-primary mt-2" onClick={onNext} data-testid="button-next-exercise">Next: {nextName} <ChevronRight size={18} /></button>}
      {pe.technique && !techKind && log.sets.length === rx.sets - 1 && <p className="text-xs blue mt-2">Last set: {pe.technique === "drop" ? "drop set — strip ~25% and continue to near failure" : pe.technique === "restpause" ? "rest-pause — 15s rest, 2 mini-sets" : "take this set to failure"}.</p>}

      {sheet === "warm" && (
        <Sheet title={`Warm-up · ${ex.name}`} onClose={() => setSheet(null)} testId="sheet-warmup">
          <div className="label mb-2">Working weight {fmtW(target)} {u}</div>
          {warmupSets(target, profile.barWeight, u === "lb" ? 5 : 2.5).map((r, i) => (
            <div key={i} className="rowline">
              <span className="chip">{r.label}</span>
              <span className="mono flex-1 text-[15px]">{fmtW(r.weight)} × {r.reps}</span>
              <span className="mono text-xs muted">{(() => { const p = platesPerSide(r.weight, profile.barWeight, u).plates; return p.length ? p.join("+") : "bar"; })()}</span>
            </div>
          ))}
          <p className="text-xs faint mt-3">Rest 60–90s between warm-ups. Plates shown per side.</p>
        </Sheet>
      )}
      {editSet != null && log.sets[editSet] && (
        <EditSetSheet title={`Set ${editSet + 1} · ${ex.name}`} initial={log.sets[editSet]} units={u} inc={inc}
          onSave={(x) => { updLog((l) => ({ ...l, sets: l.sets.map((y, j) => (j === editSet ? x : y)) })); ui.toast("Set updated"); }}
          onDelete={() => { updLog((l) => ({ ...l, sets: l.sets.filter((_, j) => j !== editSet) })); ui.toast("Set deleted"); }}
          onClose={() => setEditSet(null)} />
      )}
      {sheet === "plates" && <PlatesSheet initial={w || target} onClose={() => setSheet(null)} />}
      {sheet === "sub" && (
        <Sheet title="Equipment busy?" onClose={() => setSheet(null)} testId="sheet-substitute">
          <p className="text-sm muted mb-3">Same movement pattern and primary muscles. Weight converted with a rough strength ratio — your progression history stays on <span className="text-[color:var(--text)]">{EX[log.originalExId].name}</span>.</p>
          {log.sets.length > 0 && <p className="text-xs orange mb-3">You've logged sets already — new sets will use the substitute.</p>}
          {subbed && (
            <button className="card w-full text-left mb-2" onClick={() => { updLog((l) => ({ ...l, exId: l.originalExId, equivFactor: 1, targetWeight: rx.weight })); setSheet(null); }} data-testid="button-revert-sub">
              <div className="font-semibold">Back to {EX[log.originalExId].name}</div><div className="mono text-xs muted">{fmtW(rx.weight)} {u}</div>
            </button>
          )}
          {subs.length === 0 && (
            <p className="text-sm muted" data-testid="text-no-subs">{EX[log.originalExId].custom ? "Your own exercises don't get automatic swap suggestions, since the app can't convert their weights." : "No close swaps for this one."}</p>
          )}
          {subs.map((c) => (
            <button key={c.ex.id} className="card w-full text-left flex items-center justify-between gap-3" onClick={() => { updLog((l) => ({ ...l, exId: c.ex.id, equivFactor: c.equivFactor, targetWeight: c.weight })); setW(c.weight); setSheet(null); ui.toast(`Swapped to ${c.ex.name}`); }} data-testid={`button-sub-${c.ex.id}`}>
              <div className="min0"><div className="font-semibold">{c.ex.name}</div><div className="text-xs muted">{c.ex.equipment}{c.ex.equipment === "dumbbell" ? " · per hand" : ""} · {c.ex.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</div></div>
              <span className="mono text-[15px] shrink-0">{fmtW(c.weight)} {u}</span>
            </button>
          ))}
        </Sheet>
      )}
    </section>
  );
}

/** Every exercise in order: jump to one, or move it up/down (e.g. when a station is busy). */
function ExerciseList({ session, rxFor, current, onPick, onAdd, canRemove }: { session: Session; rxFor: (l: ExerciseLog) => { rx: Prescription }; current: number; onPick: (i: number) => void; onAdd: () => void; canRemove: (l: ExerciseLog) => boolean }) {
  const { set } = useStore();
  const move = (i: number, d: -1 | 1) => set((s) => {
    if (!s.activeSession) return s;
    const ex = [...s.activeSession.exercises];
    const j = i + d;
    if (j < 0 || j >= ex.length) return s;
    [ex[i], ex[j]] = [ex[j], ex[i]];
    return { ...s, activeSession: { ...s.activeSession, exercises: ex } };
  });
  const remove = (i: number) => set((s) => (s.activeSession ? { ...s, activeSession: { ...s.activeSession, exercises: s.activeSession.exercises.filter((_, k) => k !== i) } } : s));
  return (
    <div className="card" style={{ padding: "4px 12px" }} data-testid="list-exercises">
      {session.exercises.map((l, i) => {
        const { rx } = rxFor(l);
        const done = l.sets.length >= rx.sets;
        return (
          <div key={l.peId + l.exId} className={`rowline ${current === i ? "ex-active" : ""}`} style={{ gap: 6, ...(l.superset && session.exercises.filter((x) => x.superset === l.superset).length > 1 ? { boxShadow: "inset 3px 0 0 var(--signal)", paddingLeft: 6 } : {}) }} data-testid={`row-exercise-${i}`}>
            <button className="min0 flex-1 text-left flex items-center gap-3" style={{ minHeight: 44 }} onClick={() => onPick(i)} aria-current={current === i ? "step" : undefined} data-testid={`button-goto-exercise-${i}`}>
              <span className="w-5 shrink-0 flex justify-center">{done ? <Check size={16} style={{ color: "var(--ink)" }} /> : <span className="mono text-xs muted">{i + 1}</span>}</span>
              <span className="min0">
                <span className={`block text-[15px] ${current === i ? "font-bold" : "font-semibold"}`}>{EX[l.exId].name}</span>
                <span className="block text-[13px] muted">{l.sets.length} of {rx.sets} sets{l.superset && session.exercises.filter((x) => x.superset === l.superset).length > 1 ? " · superset" : ""}{current === i ? " · current" : ""}</span>
              </span>
            </button>
            <button className="icon-btn" style={{ width: 36, height: 36, border: 0 }} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${EX[l.exId].name} up`} data-testid={`button-move-up-${i}`}><ArrowUp size={16} /></button>
            <button className="icon-btn" style={{ width: 36, height: 36, border: 0 }} disabled={i === session.exercises.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${EX[l.exId].name} down`} data-testid={`button-move-down-${i}`}><ArrowDown size={16} /></button>
            {canRemove(l) && <button className="icon-btn" style={{ width: 36, height: 36, border: 0 }} onClick={() => remove(i)} aria-label={`Remove ${EX[l.exId].name}`} data-testid={`button-remove-exercise-${i}`}><X size={16} /></button>}
          </div>
        );
      })}
      <button className="btn btn-ghost btn-block" style={{ minHeight: 48 }} onClick={onAdd} data-testid="button-add-exercise-list"><Plus size={16} /> Add exercise</button>
    </div>
  );
}

function PlatesSheet({ initial, onClose }: { initial: number; onClose: () => void }) {
  const { profile } = useStore();
  const [v, setV] = useState(initial);
  const [bar, setBar] = useState(profile.barWeight);
  return (
    <Sheet title="Plate calculator" onClose={onClose} testId="sheet-plates">
      <Stepper value={v} step={profile.units === "lb" ? 5 : 2.5} unit={profile.units} onChange={setV} testId="stepper-plate-total" />
      <div className="field mt-3"><span className="label">Bar</span>
        <Seg className="seg-num" value={bar} onChange={setBar} options={(profile.units === "lb" ? [45, 35, 25, 15] : [20, 15, 10]).map((b) => ({ v: b, l: String(b) }))} />
      </div>
      <div className="card mt-3"><PlateViz total={v} bar={bar} units={profile.units} /></div>
    </Sheet>
  );
}

function RestBar({ session }: { session: Session }) {
  const { set, state } = useStore();
  const now = useNow(250);
  if (!session.restEnd) return null;
  const left = (session.restEnd - now) / 1000;
  const total = session.restTotal ?? 120;
  const doneR = left <= 0;
  const adj = (d: number) => set((s) => s.activeSession ? { ...s, activeSession: { ...s.activeSession, restEnd: (s.activeSession.restEnd ?? Date.now()) + d * 1000, restTotal: (s.activeSession.restTotal ?? 120) + d } } : s);
  void state;
  return (
    <div className="rest-bar" data-testid="bar-rest-timer">
      <Timer size={18} className={doneR ? "lime" : "muted"} />
      <div className="flex-1 min0">
        <div className="mono text-[20px] font-semibold" style={{ color: doneR ? "var(--lime)" : undefined }} data-testid="text-rest-time">{doneR ? "Go" : mmss(left)}</div>
        <div className="bar mt-1" style={{ height: 3 }}><i style={{ width: `${Math.min(100, (1 - Math.max(0, left) / total) * 100)}%` }} /></div>
      </div>
      <button className="btn btn-sm btn-outline mono" onClick={() => adj(-15)} data-testid="button-rest-minus">−15</button>
      <button className="btn btn-sm btn-outline mono" onClick={() => adj(15)} data-testid="button-rest-plus">+15</button>
      <button className="icon-btn" aria-label="Dismiss rest timer" onClick={() => set((s) => s.activeSession ? { ...s, activeSession: { ...s.activeSession, restEnd: null } } : s)} data-testid="button-rest-skip"><X size={16} /></button>
    </div>
  );
}

export default function Logger() {
  const { state, set, profile, targets } = useStore();
  const ui = useUI();
  const auth = useAuth();
  const t = useToday();
  const now = useNow(1000);
  const s = state.activeSession;
  const [active, setActive] = useState<number>(0);
  const [summary, setSummary] = useState<Session | null>(null);
  const [pr, setPr] = useState<PRData | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [ssOpen, setSsOpen] = useState(false);
  const [ssAdding, setSsAdding] = useState(false);
  const u = profile.units;

  const day = s ? state.program?.days.find((d) => d.id === s.dayId) : null;
  const stale = !!(s && sessionStale(s, day ?? undefined));
  const totalLogged = s ? s.exercises.reduce((a, l) => a + l.sets.length, 0) : 0;
  const resync = () => set((st) => {
    if (!st.activeSession) return st;
    const d = st.program?.days.find((x) => x.id === st.activeSession!.dayId);
    if (!d) return st;
    return { ...st, activeSession: syncSession(st, st.activeSession, d, t.readiness.score, u) };
  });
  // Program edited before the first set? Just follow the program — nothing to lose.
  useEffect(() => { if (stale && day && totalLogged === 0) resync(); }, [stale, day, totalLogged]); // eslint-disable-line
  const rxMap = useMemo(() => {
    const m: Record<string, { pe: ProgramExercise; rx: Prescription }> = {};
    if (!day) return m;
    day.exercises.forEach((pe) => (m[pe.id] = { pe, rx: prescribe(pe, logsForPe(state.sessions, pe.id), t.readiness.score, !!s?.deload, u) }));
    return m;
  }, [day, state.sessions, t.readiness.score, s?.deload, u]);

  const [listOpen, setListOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // Opening (or resuming) a workout lands on the first exercise that still has sets to do.
  // After that we never jump on our own: finishing an exercise shows a "Next" button instead.
  useEffect(() => {
    if (!s) return;
    const i = s.exercises.findIndex((l) => l.sets.length < (rxMap[l.peId]?.rx.sets ?? l.plan?.sets ?? 3));
    setActive(i >= 0 ? i : 0);
  }, [s?.id]); // eslint-disable-line

  if (summary) {
    const sum = sessionSummary(state, summary);
    return (
      <div className="stack" data-testid="view-session-summary">
        <div className="card">
          <div className="label">Session complete</div>
          <div className="text-lg font-semibold mt-1">{summary.dayName}</div>
          <div className="stat-grid mt-3">
            <div className="stat"><div className="label">Duration</div><div className="v" data-testid="text-summary-duration">{sum.dur} min</div></div>
            <div className="stat"><div className="label">Volume</div><div className="v" data-testid="text-summary-volume">{Math.round(sum.volume).toLocaleString()} <span className="text-xs muted">{u}</span></div></div>
            <div className="stat"><div className="label">Working sets</div><div className="v">{sum.totalSets}</div></div>
            <div className="stat"><div className="label">PRs</div><div className="v lime" data-testid="text-summary-prs">{sum.prs.length}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="label mb-2">Sets per muscle</div>
          {Object.entries(sum.sets).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([m, n]) => (
            <div key={m} className="flex items-center gap-3 mono text-sm" style={{ minHeight: 28 }}><span className="w-24 text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>{MUSCLE_LABEL[m as keyof typeof MUSCLE_LABEL]}</span><div className="flex-1 bar"><i style={{ width: `${Math.min(100, (n ?? 0) * 12)}%` }} /></div><span className="w-6 text-right">{n}</span></div>
          ))}
        </div>
        {sum.prs.length > 0 && (
          <div className="card">
            <div className="label mb-2">Personal records</div>
            {sum.prs.map((p) => (
              <div key={p.exId} className="rowline">
                <div className="min0"><div className="font-semibold text-sm">{EX[p.exId].name}</div><div className="mono text-xs muted">{fmtW(p.weight)} × {p.reps} · e1RM {Math.round(p.e1rm)} {u}</div></div>
                <button className="btn btn-sm btn-primary" onClick={() => setPr({ lift: EX[p.exId].name, weight: p.weight, reps: p.reps, e1rm: p.e1rm, units: u, why: prWhyStat(state, summary.date, targets.protein), name: profile.name, date: fmtDate(summary.date, { month: "short", day: "numeric", year: "numeric" }) })} data-testid={`button-pr-card-${p.exId}`}>PR card</button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs muted text-center">Posted to your Spotters feed.</p>
        {!summary.dayId.startsWith("saved:") && <button className="btn btn-outline btn-block" onClick={() => setSaveOpen(true)} data-testid="button-save-as-workout">Save as workout</button>}
        <button className="btn btn-lg btn-block" onClick={() => { setSummary(null); ui.setTab("today"); }} data-testid="button-summary-done">Done</button>
        {saveOpen && <SaveAsWorkoutSheet defaultName={summary.dayName === "Freestyle" ? "My workout" : summary.dayName} make={(name) => savedFromSession(summary, name, u)} onClose={() => setSaveOpen(false)} />}
        {pr && <PRCardSheet data={pr} onClose={() => setPr(null)} />}
      </div>
    );
  }

  if (!s) {
    const days = state.program?.days ?? [];
    return (
      <div className="stack">
        <div className="card">
          <div className="label">No active workout</div>
          <p className="text-sm muted mt-1">{t.doneToday && t.day ? `${t.doneToday.dayName} is done for today. You can still start another workout.` : t.day ? `${t.day.name} is planned today.` : days.length ? "Rest day. You can still train if you want to." : "No program yet. You can still log a workout."}</p>
          {t.day && !t.doneToday && <button className="btn btn-primary btn-lg btn-block mt-3" onClick={() => set((st) => ({ ...st, activeSession: newSession(st, t.day!, t.readiness.score, t.inDeload, u) }))} data-testid="button-start-planned">Start {t.day.name}</button>}
          <button className={`btn btn-block mt-3 ${t.day && !t.doneToday ? "btn-ghost" : "btn-primary btn-lg"}`} onClick={() => setStartOpen(true)} data-testid="button-start-different">{t.day && !t.doneToday ? "Start a different workout" : t.doneToday ? "Start another workout" : days.length ? "Start a workout" : "Start an empty workout"}</button>
        </div>
        {startOpen && <StartWorkoutSheet onClose={() => setStartOpen(false)} />}
        {t.readiness.score == null && <p className="text-xs faint">Tip: do your check-in first — targets adjust to readiness.</p>}
      </div>
    );
  }

  const elapsed = Math.floor((now - s.start) / 1000);
  const firstCompound = s.exercises.findIndex((l) => isCompound(EX[l.originalExId]));
  const totalSets = s.exercises.reduce((a, l) => a + l.sets.length, 0);

  const finish = () => {
    const done: Session = { ...s, end: Date.now(), restEnd: null, exercises: s.exercises.filter((l) => l.sets.length) };
    set((st) => {
      const sessions = [...st.sessions, done];
      const sum = sessionSummary({ ...st, sessions: st.sessions }, done);
      const post: FeedPost = {
        id: newId("post"), author: "me", ts: done.end!, sessionName: done.dayName, sessionId: done.id,
        topSets: done.exercises.slice(0, 3).map((l) => { const b = l.sets.reduce((x, y) => (e1rm(y.weight, y.reps) > e1rm(x.weight, x.reps) ? y : x), l.sets[0]); return { name: EX[l.exId].name, weight: b.weight, reps: b.reps, units: u }; }),
        prs: sum.prs.map((p) => EX[p.exId].name), durationMin: sum.dur, likes: [], comments: [],
      };
      if (auth.live && !auth.viewing && auth.me?.shareFeed) {
        const { likes: _l, comments: _c, author: _a, id: _i, ts: _t, ...body } = post;
        api("POST", "/api/posts", { kind: "session", body }).catch(() => ui.toast("Saved, but couldn't post to Spotters"));
      }
      return { ...st, sessions, activeSession: null, feed: [post, ...st.feed] };
    });
    setSummary(done);
  };

  const free = isFreeSession(s);
  // Program exercises get program targets; freestyle and added exercises get "last time" targets.
  const rxFor = (l: ExerciseLog) => rxMap[l.peId] ?? (free || l.extra ? freeRx(state.sessions, l, t.readiness.score, u) : orphanRx(l, t.readiness.score, !!s.deload, u));
  const addExercise = (exId: string) => {
    set((st) => (st.activeSession ? { ...st, activeSession: { ...st.activeSession, exercises: [...st.activeSession.exercises, freeLog(st.sessions, exId, t.readiness.score, u, { extra: !free })] } } : st));
    setAdding(false); setListOpen(false); setActive(s.exercises.length); window.scrollTo({ top: 0 });
  };
  const n = s.exercises.length;
  const cur = Math.min(Math.max(0, active), Math.max(0, n - 1));
  const log = s.exercises[cur];
  const go = (i: number) => { if (i >= 0 && i < n) { setActive(i); setListOpen(false); window.scrollTo({ top: 0 }); } };
  const remaining = (i: number) => (s.exercises[i] ? rxFor(s.exercises[i]).rx.sets - s.exercises[i].sets.length : 0);
  const group = supersetGroup(s.exercises, cur);
  const supersetWith = group.length > 1 ? group.filter((k) => k !== cur).map((k) => EX[s.exercises[k].exId].name) : null;
  // In a superset: straight to the next exercise in it, no rest; after the last one, rest and start the next round.
  const onLogged = () => {
    const next = afterSupersetSet(s.exercises, cur, (i) => remaining(i) - (i === cur ? 1 : 0));
    if (!next) return;
    if (!next.rest) set((st) => (st.activeSession ? { ...st, activeSession: { ...st.activeSession, restEnd: null } } : st));
    if (next.goTo !== cur) { go(next.goTo); ui.toast(next.rest ? `Round done. Rest, then ${EX[s.exercises[next.goTo].exId].name}` : `Superset: ${EX[s.exercises[next.goTo].exId].name} next, no rest`); }
  };
  const setExercises = (exercises: ExerciseLog[]) => set((st) => (st.activeSession ? { ...st, activeSession: { ...st.activeSession, exercises } } : st));
  const linkWith = (b: number, exs = s.exercises) => { const r = linkSuperset(exs, cur, b); setExercises(r.exercises); setActive(r.index); setSsOpen(false); ui.toast(`Superset: ${EX[exs[cur].exId].name} + ${EX[exs[b].exId].name}`); };
  const groupNext = group.length > 1 ? group.find((k) => k !== cur && remaining(k) > 0) : undefined;
  const nextIdx = groupNext != null ? groupNext : (() => { for (let k = 1; k < n; k++) { const j = (cur + k) % n; const l = s.exercises[j]; if (l.sets.length < rxFor(l).rx.sets) return j; } return cur + 1 < n ? cur + 1 : -1; })();

  // Swipe left/right on the exercise card to move between exercises (taps and vertical scrolls are ignored).
  const onTouchStart = (e: RTouchEvent) => { const p = e.touches[0]; swipe.current = { x: p.clientX, y: p.clientY }; };
  const onTouchEnd = (e: RTouchEvent) => {
    const st = swipe.current; swipe.current = null;
    if (!st) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - st.x, dy = p.clientY - st.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  };

  return (
    <div data-testid="view-logger">
      <div className="flex items-center gap-3 mb-3">
        <div className="min0 flex-1">
          <div className="font-semibold">{s.dayName}{s.deload && <span className="chip ml-2">Deload</span>}</div>
          <div className="text-[13px] muted"><span className="mono" data-testid="text-elapsed">{mmss(elapsed)}</span> · {totalSets} sets logged</div>
        </div>
        {confirmDiscard ? (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDiscard(false)} data-testid="button-discard-cancel">Keep</button>
            <button className="btn btn-sm btn-warn" onClick={() => { setConfirmDiscard(false); set((st) => ({ ...st, activeSession: null })); }} data-testid="button-discard-confirm">Discard workout</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => (totalSets ? setConfirmDiscard(true) : set((st) => ({ ...st, activeSession: null })))} data-testid="button-discard-workout">Discard</button>
            <button className="btn btn-primary" disabled={totalSets === 0} onClick={finish} data-testid="button-finish-workout">Finish</button>
          </>
        )}
      </div>
      {!day && !free && (
        <div className="warn mb-3" data-testid="card-day-missing"><div className="inner">
          <div className="font-bold">Program changed</div>
          <p className="text-[13px] mt-1">This day was removed from your program. You can keep logging what's here and finish, or discard the workout.</p>
        </div></div>
      )}
      {day && stale && (
        <div className="warn mb-3" data-testid="card-session-stale"><div className="inner">
          <div className="font-bold">Program changed</div>
          <p className="text-[13px] mt-1">{day.name} was edited after this workout started. Sets you've logged are kept.</p>
          <button className="btn btn-sm mt-2" onClick={resync} data-testid="button-sync-session">Update workout</button>
        </div></div>
      )}
      {t.readiness.effect !== "normal" && t.readiness.score != null && (
        <p className="text-[13px] muted mb-3 flex gap-2" data-testid="text-readiness-adjust"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>Readiness {t.readiness.score}: {t.readiness.effect === "hold" ? "weights held today" : "targets cut 10% today"}.</span></p>
      )}

      {n === 0 ? (
        <div className="card text-center" style={{ padding: "32px 18px" }} data-testid="card-empty-workout">
          <p className="text-sm muted">{free ? "Add your first exercise. If you've done it before, last time's weight is filled in." : "This workout has no exercises."}</p>
          <button className="btn btn-primary btn-lg btn-block mt-4" onClick={() => setAdding(true)} data-testid="button-add-first-exercise"><Plus size={18} /> Add exercise</button>
        </div>
      ) : (
        <>
          {/* Progress strip: one segment per exercise; filled = done, outlined = current. */}
          <div className="flex items-center gap-3 mb-2">
            <div className="text-[13px] font-semibold" aria-live="polite" data-testid="text-exercise-progress">{listOpen ? `${n} exercises` : `Exercise ${cur + 1} of ${n}`}</div>
            <div className="flex-1" />
            <button className="btn btn-sm btn-ghost" style={{ paddingRight: 0 }} onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen} data-testid="button-all-exercises">
              <ListIcon size={16} /> {listOpen ? "Back to exercise" : "All exercises"}
            </button>
          </div>
          <div className="flex gap-1 mb-3" aria-hidden data-testid="strip-exercises">
            {s.exercises.map((l, i) => {
              const done = l.sets.length >= rxFor(l).rx.sets;
              return <button key={l.peId + l.exId} tabIndex={-1} onClick={() => go(i)} style={{ flex: 1, height: 6, background: i === cur ? "var(--ink-deep)" : done ? "var(--ink)" : "var(--tint)", boxShadow: i === cur && !listOpen ? "0 0 0 2px var(--page), 0 0 0 3px var(--ink)" : undefined }} />;
            })}
          </div>

          {listOpen ? (
            <ExerciseList session={s} rxFor={rxFor} current={cur} onPick={go} onAdd={() => setAdding(true)} canRemove={(l) => (free || !!l.extra) && l.sets.length === 0} />
          ) : (
            <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <FocusExercise key={log.peId + log.exId} log={log} idx={cur} rx={rxFor(log).rx} pe={rxFor(log).pe} fatigue={t.fatigue} isFirstCompound={cur === firstCompound}
                nextName={nextIdx >= 0 && nextIdx !== cur ? EX[s.exercises[nextIdx].exId].name : null} onNext={() => go(nextIdx)}
                supersetWith={supersetWith} onLogged={onLogged} onSuperset={() => setSsOpen(true)} />
              <div className="flex items-center justify-between mt-2">
                <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} disabled={cur === 0} onClick={() => go(cur - 1)} data-testid="button-prev-exercise"><ChevronLeft size={16} /> Previous</button>
                <span className="text-[12px] faint">or swipe</span>
                <button className="btn btn-sm btn-ghost" style={{ paddingRight: 0 }} disabled={cur === n - 1} onClick={() => go(cur + 1)} data-testid="button-forward-exercise">Next <ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 70 }} />
      <RestBar session={s} />
      {adding && <ExercisePicker title="Add exercise" onClose={() => setAdding(false)} onPick={addExercise} />}
      {ssOpen && log && (
        <Sheet title={`Superset · ${EX[log.exId].name}`} onClose={() => setSsOpen(false)} testId="sheet-superset">
          <p className="text-sm muted mb-3">Do one set of each exercise back to back, then rest. After you log a set here, the next exercise in the superset opens with no rest timer.</p>
          {supersetWith && (
            <button className="btn btn-outline btn-block mb-3" onClick={() => { setExercises(unlinkSuperset(s.exercises, cur)); setSsOpen(false); ui.toast("Taken out of the superset"); }} data-testid="button-unlink-superset">
              <Unlink size={16} /> Take {EX[log.exId].name} out of the superset
            </button>
          )}
          <div className="label mb-1">{supersetWith ? "Add another exercise" : "Pair with"}</div>
          {s.exercises.map((l, i) => (i === cur || group.includes(i) ? null : (
            <button key={l.peId + l.exId} className="rowline w-full text-left" style={{ minHeight: 48 }} onClick={() => linkWith(i)} data-testid={`button-superset-with-${i}`}>
              <span className="min0 flex-1"><span className="block font-semibold text-[15px]">{EX[l.exId].name}</span><span className="block text-[13px] muted">{l.sets.length} of {rxFor(l).rx.sets} sets{l.superset ? " · already in a superset" : ""}</span></span>
              <Link2 size={16} className="muted" />
            </button>
          )))}
          <button className="btn btn-ghost btn-block mt-2" onClick={() => setSsAdding(true)} data-testid="button-superset-new"><Plus size={16} /> A new exercise</button>
        </Sheet>
      )}
      {ssAdding && (
        <ExercisePicker title="Superset with" onClose={() => setSsAdding(false)} onPick={(exId) => {
          const added = [...s.exercises, freeLog(state.sessions, exId, t.readiness.score, u, { extra: !free })];
          setSsAdding(false);
          linkWith(added.length - 1, added);
        }} />
      )}
    </div>
  );
}

export { prescriptionsFor };
