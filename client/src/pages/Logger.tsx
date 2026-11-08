import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Disc, Flame, Repeat, Timer, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { newSession, prescriptionsFor, prWhyStat, sessionSummary, useToday } from "@/lib/derived";
import { e1rm, fmtDate, fmtW, logsForPe, platesPerSide, prescribe, restDefault, substitutes, warmupSets, type Prescription } from "@/lib/engine";
import { EX, MUSCLE_LABEL, isCompound, newId } from "@/lib/exercises";
import type { ExerciseLog, FeedPost, ProgramExercise, Session } from "@/lib/types";
import { Seg, Sheet, Stepper } from "@/components/ui";
import { PRCardSheet, type PRData } from "@/components/PRCard";

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

function ExerciseCard({ log, idx, rx, pe, active, onActivate, session, fatigue, isFirstCompound }: {
  log: ExerciseLog; idx: number; rx: Prescription; pe: ProgramExercise; active: boolean; onActivate: () => void; session: Session; fatigue: Record<string, number>; isFirstCompound: boolean;
}) {
  const { set, profile, state } = useStore();
  const ui = useUI();
  const u = profile.units;
  const ex = EX[log.exId];
  const subbed = log.exId !== log.originalExId;
  const target = log.targetWeight;
  const last = log.sets[log.sets.length - 1];
  const [w, setW] = useState<number>(last?.weight ?? target);
  const [reps, setReps] = useState<number>(last?.reps ?? rx.repGoal);
  const [rir, setRir] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"warm" | "plates" | "sub" | null>(null);
  useEffect(() => { setW(last?.weight ?? target); }, [target]); // eslint-disable-line
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
        exercises: s.activeSession.exercises.map((l, i) => (i === idx ? { ...l, sets: [...l.sets, { weight: w, reps, rir, ts: Date.now() }] } : l)),
      },
    } : s);
    if (navigator.vibrate) try { navigator.vibrate(15); } catch { /* noop */ }
    setRir(null);
    const isTop = log.sets.length === 0;
    if (isTop) ui.toast(reps >= pe.repMax ? `Top of range — next time +${pe.increment} ${u}` : reps >= pe.repMin ? "In range — aim +1 rep next time" : "Below range — holding weight");
  };

  return (
    <section className="card" style={{ padding: 0, borderColor: active ? "var(--border-strong)" : undefined }} data-testid={`card-exercise-${idx}`}>
      <button className="w-full text-left flex items-start gap-3" style={{ padding: "12px 14px" }} onClick={onActivate} data-testid={`button-activate-exercise-${idx}`}>
        <span className="mono text-xs faint mt-1 w-4 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
        <div className="min0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{ex.name}</span>
            {subbed && <span className="chip chip-blue">sub for {EX[log.originalExId].name}</span>}
            {hot.length > 0 && <span className="chip chip-orange" data-testid={`badge-fatigue-${idx}`}><Flame size={11} />{MUSCLE_LABEL[hot[0]]} {fatigue[hot[0]]}%</span>}
          </div>
          <div className="mono text-[15px] mt-1" data-testid={`text-target-${idx}`}>
            <span className="lime">{target > 0 ? fmtW(target) : "BW"}</span>{target > 0 && <span className="muted"> {u}</span>} × {rx.repMin}–{rx.repMax} <span className="muted">· {rx.sets} sets · {rx.rir} RIR</span>
          </div>
          <div className="text-xs muted mt-1" data-testid={`text-why-${idx}`}>{rx.why}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {done ? <span className="chip chip-lime"><Check size={11} /> {log.sets.length}/{rx.sets}</span> : <span className="chip">{log.sets.length}/{rx.sets}</span>}
          {active ? <ChevronDown size={16} className="muted" /> : <ChevronRight size={16} className="muted" />}
        </div>
      </button>

      {active && (
        <div style={{ padding: "0 14px 14px" }}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {isFirstCompound && target > 0 && <button className="btn btn-sm btn-outline" onClick={() => setSheet("warm")} data-testid={`button-warmup-${idx}`}><Flame size={14} /> Warm-up</button>}
            {["barbell", "smith"].includes(ex.equipment) && <button className="btn btn-sm btn-outline" onClick={() => setSheet("plates")} data-testid={`button-plates-${idx}`}><Disc size={14} /> Plates</button>}
            <button className="btn btn-sm btn-outline" onClick={() => setSheet("sub")} data-testid={`button-sub-${idx}`}><Repeat size={14} /> Equipment busy?</button>
          </div>

          {log.sets.length > 0 && (
            <div className="mb-3">
              {log.sets.map((st, i) => (
                <div key={i} className="flex items-center gap-3 mono text-sm" style={{ minHeight: 36, borderTop: i ? "1px solid var(--border)" : undefined }} data-testid={`row-set-${idx}-${i}`}>
                  <span className="faint w-6">S{i + 1}</span>
                  <span className="flex-1">{fmtW(st.weight)} × {st.reps}{st.rir != null && <span className="muted"> @ {st.rir} RIR</span>}</span>
                  <span className="faint text-xs">e1RM {Math.round(e1rm(st.weight, st.reps))}</span>
                  <button aria-label="Delete set" className="faint" style={{ padding: 8 }} onClick={() => updLog((l) => ({ ...l, sets: l.sets.filter((_, j) => j !== i) }))} data-testid={`button-delete-set-${idx}-${i}`}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="field"><span className="label">Weight · ±{inc}</span><Stepper value={w} step={inc} unit={u} onChange={setW} testId={`stepper-weight-${idx}`} /></div>
            <div className="field"><span className="label">Reps · goal {rx.repGoal}</span><Stepper value={reps} step={1} min={0} max={100} unit="reps" decimals={0} onChange={setReps} testId={`stepper-reps-${idx}`} /></div>
          </div>
          <div className="field mt-2"><span className="label">Reps in reserve (optional)</span>
            <Seg className="seg-num" value={rir ?? -1} onChange={(v) => setRir(v === -1 ? null : v)} options={[{ v: -1, l: "–" }, { v: 0, l: "0" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }]} testId={`seg-rir-${idx}`} />
          </div>
          <button className={`btn btn-lg btn-block mt-3 ${done ? "btn-outline" : "btn-primary"}`} onClick={logSet} data-testid={`button-log-set-${idx}`}>
            <Check size={18} /> {done ? "Log extra set" : `Log set ${log.sets.length + 1}`} · <span className="mono">{fmtW(w)}×{reps}</span>
          </button>
          {pe.technique && log.sets.length === rx.sets - 1 && <p className="text-xs blue mt-2">Last set: {pe.technique === "drop" ? "drop set — strip ~25% and continue to near failure" : pe.technique === "restpause" ? "rest-pause — 15s rest, 2 mini-sets" : "take this set to failure"}.</p>}
        </div>
      )}

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
          {substitutes(log.originalExId, rx.weight, pe.increment || 5).filter((c) => c.ex.id !== log.exId).map((c) => (
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
  const [pick, setPick] = useState("");
  const u = profile.units;

  const day = s ? state.program?.days.find((d) => d.id === s.dayId) : null;
  const rxMap = useMemo(() => {
    const m: Record<string, { pe: ProgramExercise; rx: Prescription }> = {};
    if (!day) return m;
    day.exercises.forEach((pe) => (m[pe.id] = { pe, rx: prescribe(pe, logsForPe(state.sessions, pe.id), t.readiness.score, !!s?.deload, u) }));
    return m;
  }, [day, state.sessions, t.readiness.score, s?.deload, u]);

  useEffect(() => {
    if (!s) return;
    const i = s.exercises.findIndex((l) => l.sets.length < (rxMap[l.peId]?.rx.sets ?? 3));
    if (i >= 0 && s.exercises[active] && s.exercises[active].sets.length >= (rxMap[s.exercises[active].peId]?.rx.sets ?? 3)) setActive(i);
  }, [s?.exercises.map((l) => l.sets.length).join(",")]); // eslint-disable-line

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
        <button className="btn btn-lg btn-block" onClick={() => { setSummary(null); ui.setTab("today"); }} data-testid="button-summary-done">Done</button>
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
          <p className="text-sm muted mt-1">{t.day ? `${t.day.name} is planned today.` : "Rest day — you can still run any session."}</p>
          {t.day && <button className="btn btn-primary btn-lg btn-block mt-3" onClick={() => set((st) => ({ ...st, activeSession: newSession(st, t.day!, t.readiness.score, t.inDeload, u) }))} data-testid="button-start-planned">Start {t.day.name}</button>}
          <div className="flex gap-2 mt-3">
            <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} data-testid="select-other-day"><option value="">Run a different day…</option>{days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <button className="btn" disabled={!pick} onClick={() => { const d = days.find((x) => x.id === pick)!; set((st) => ({ ...st, activeSession: newSession(st, d, t.readiness.score, t.inDeload, u) })); }} data-testid="button-start-other">Start</button>
          </div>
        </div>
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

  return (
    <div data-testid="view-logger">
      <div className="flex items-center gap-3 mb-3">
        <div className="min0 flex-1">
          <div className="font-semibold">{s.dayName}{s.deload && <span className="chip chip-orange ml-2">deload</span>}</div>
          <div className="mono text-xs muted"><span data-testid="text-elapsed">{mmss(elapsed)}</span> · {totalSets} sets logged{t.readiness.score != null ? ` · readiness ${t.readiness.score}` : ""}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => set((st) => ({ ...st, activeSession: null }))} data-testid="button-discard-workout">Discard</button>
        <button className="btn btn-primary" disabled={totalSets === 0} onClick={finish} data-testid="button-finish-workout">Finish</button>
      </div>
      {t.readiness.effect !== "normal" && t.readiness.score != null && (
        <div className="card-flat text-xs mb-3 flex gap-2" style={{ borderColor: "rgba(92,58,33,.35)" }}><AlertTriangle size={14} className="blue shrink-0 mt-0.5" /><span className="muted">{t.readiness.reason}</span></div>
      )}
      <div className="stack">
        {s.exercises.map((log, i) => {
          const m = rxMap[log.peId];
          if (!m) return null;
          return <ExerciseCard key={log.peId + log.exId} log={log} idx={i} rx={m.rx} pe={m.pe} active={active === i} onActivate={() => setActive(active === i ? -1 : i)} session={s} fatigue={t.fatigue} isFirstCompound={i === firstCompound} />;
        })}
      </div>
      <div style={{ height: 70 }} />
      <RestBar session={s} />
    </div>
  );
}

export { prescriptionsFor };
