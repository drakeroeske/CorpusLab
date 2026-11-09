import { Info } from "@/components/Term";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FlaskConical, Lightbulb, Target } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import Logger from "./Logger";
import { ProgramEditor } from "@/components/ProgramEditor";
import { SaveAsWorkoutSheet, SavedWorkoutsCard } from "@/components/SavedWorkouts";
import { ImportProgramSheet, ProgramInbox, ProgramLibrary } from "@/components/ProgramLibrary";
import { Bar, Empty, Seg, Sheet } from "@/components/ui";
import { EngineHeader } from "@/components/riso";
import { Sectioned } from "@/components/Sections";
import {
  addDays, dateKey, EXPERIMENT_TEMPLATES, experimentPhase, experimentReport, fmtDate, fmtW, r1, weekStart, weeklyReport, VOLUME_RANGE,
  sessionVolume, sessionPRs,
} from "@/lib/engine";
import { EX, MUSCLE_LABEL, MUSCLES, TEMPLATES, buildTemplate, newId } from "@/lib/exercises";
import { convertProgram } from "@/lib/actions";
import type { Experiment, Program, ProgramDay } from "@/lib/types";

export default function Train() {
  const ui = useUI();
  return (
    <div>
      <EngineHeader title="Train" />
      <Sectioned name="Train" value={ui.sub.train ?? "session"} onChange={(s) => ui.setSub("train", s)}
        sections={[{ id: "session", label: "Workout" }, { id: "program", label: "Program" }]}
        render={(id) => (id === "program" ? <ProgramTab /> : <Logger />)} />
    </div>
  );
}

function ProgramTab() {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const [tplOpen, setTplOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const program = state.program;
  // Edits save straight into your program (no separate Save step), so the next workout always follows what you see here.
  const [saveDay, setSaveDay] = useState<ProgramDay | null>(null);
  const update = (p: Program) => { set((s) => ({ ...s, program: p })); setSavedAt(Date.now()); };
  useEffect(() => { if (savedAt == null) return; const id = setTimeout(() => setSavedAt(null), 1800); return () => clearTimeout(id); }, [savedAt]);
  const today = dateKey();
  const inDeload = program?.deloadUntil && today <= program.deloadUntil;
  const live = state.activeSession && program?.days.some((d) => d.id === state.activeSession!.dayId);
  return (
    <div>
      <ProgramInbox />
      {!program ? (
        <Empty>No program yet. <div className="flex gap-2 justify-center mt-3"><button className="btn btn-sm" onClick={() => setTplOpen(true)}>Choose or build one</button><button className="btn btn-sm" onClick={() => setImportOpen(true)}>Import</button></div></Empty>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <button className="btn btn-outline btn-sm flex-1" onClick={() => setTplOpen(true)} data-testid="button-load-template">Change program</button>
            {inDeload
              ? <button className="btn btn-warn btn-sm flex-1" onClick={() => update({ ...program, deloadUntil: null })} data-testid="button-end-deload">End deload</button>
              : <button className="btn btn-outline btn-sm flex-1" onClick={() => { update({ ...program, deloadUntil: addDays(today, 6) }); ui.toast("Deload week: 60% volume, same weights"); }} data-testid="button-deload-now">Start deload week</button>}
          </div>
          {live && <p className="note mb-2" data-testid="text-live-edit-hint">A workout is in progress. Changes here show up in it — tap "Update workout" on the Workout tab, or they apply automatically if you haven't logged a set yet.</p>}
          <div className="flex items-center justify-between mb-1" style={{ minHeight: 20 }}>
            <span className="label">Program</span>
            <span className="mono text-[11px]" aria-live="polite" data-testid="text-autosave">{savedAt ? "Saved" : "Edits save automatically"}</span>
          </div>
          <ProgramEditor program={program} units={profile.units} onChange={update} onSaveDay={setSaveDay} />
        </>
      )}
      <div className="mt-6 mb-6"><SavedWorkoutsCard /></div>
      <ProgramLibrary onImport={() => setImportOpen(true)} />
      {tplOpen && (
        <Sheet title="Choose a program" onClose={() => setTplOpen(false)}>
          <p className="text-sm muted mb-3">Replaces your current program (save a copy first in My programs if you want it back). Logged history is kept.</p>
          {TEMPLATES.map((t) => (
            <button key={t.id} className="card w-full text-left" onClick={() => { update(buildTemplate(t.id, profile.units, profile.experience, dateKey())); setTplOpen(false); }} data-testid={`button-template-${t.id}`}>
              <div className="flex justify-between"><span className="font-semibold">{t.name}</span><span className="chip">{t.desc}</span></div>
              <div className="text-xs muted mt-1">{t.days.map((d) => d.name).join(" · ")}</div>
            </button>
          ))}
          <button className="btn btn-outline btn-block mt-3" onClick={() => { update({ name: "My Program", startDate: dateKey(), days: [{ id: newId("day"), name: "Day 1", weekdays: [1], exercises: [] }] }); setTplOpen(false); }} data-testid="button-build-scratch">Build my own</button>
        </Sheet>
      )}
      {importOpen && <ImportProgramSheet onClose={() => setImportOpen(false)} />}
      {saveDay && <SaveAsWorkoutSheet defaultName={saveDay.name} make={(name) => ({ id: newId("sw"), name, exercises: saveDay.exercises.map((e) => ({ ...e, id: newId("pe") })) })} onClose={() => setSaveDay(null)} />}
    </div>
  );
}
void convertProgram;

export function LabReport() {
  const { state, targets, profile } = useStore();
  const [offset, setOffset] = useState(0);
  const from = addDays(weekStart(dateKey()), -7 * offset);
  const rep = useMemo(() => weeklyReport(state, from, targets), [state, from, targets]);
  const u = profile.units;
  const toneColor = { good: "var(--lime)", warn: "var(--orange)", info: "var(--blue)" } as const;
  return (
    <div data-testid="view-lab-report">
      <div className="flex items-center gap-2 mb-3">
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} aria-label="Previous week" data-testid="button-prev-week"><ChevronLeft size={18} /></button>
        <div className="flex-1 text-center">
          <div className="label">Weekly lab report</div>
          <div className="mono text-sm" data-testid="text-report-range">{fmtDate(rep.from)} – {fmtDate(rep.to)}{offset === 0 ? " · in progress" : ""}</div>
        </div>
        <button className="icon-btn" disabled={offset === 0} onClick={() => setOffset(offset - 1)} aria-label="Next week" data-testid="button-next-week"><ChevronRight size={18} /></button>
      </div>
      <div className="stat-grid">
        <div className="stat"><div className="label">Sessions</div><div className="v" data-testid="text-report-sessions">{rep.completed}<span className="muted text-sm">/{rep.planned}</span></div><div className="s">completed vs planned</div></div>
        <div className="stat"><div className="label">Volume</div><div className="v">{Math.round(rep.volume / 1000)}k</div><div className="s">{u} lifted</div></div>
        <div className="stat"><div className="label">Readiness</div><div className="v">{rep.avgReadiness != null ? Math.round(rep.avgReadiness) : "—"}</div><div className="s">average</div></div>
        <div className="stat"><div className="label">Sleep</div><div className="v">{rep.avgSleep != null ? `${r1(rep.avgSleep)}h` : "—"}</div><div className="s">average</div></div>
        <div className="stat"><div className="label">Protein</div><div className="v">{rep.proteinDays}<span className="muted text-sm">/{rep.loggedDays || 7}</span></div><div className="s">days on target</div></div>
        <div className="stat"><div className="label">Calories</div><div className="v">{rep.calorieDays}<span className="muted text-sm">/{rep.loggedDays || 7}</span></div><div className="s">days within ±10%</div></div>
      </div>

      <div className="section-title"><h2>Insights</h2><span className="label">auto-generated</span></div>
      <div className="card" style={{ padding: 0 }}>
        {rep.insights.map((i, k) => (
          <div key={k} className="flex gap-3" style={{ padding: "12px 14px", borderTop: k ? "1px solid var(--border)" : undefined }} data-testid={`text-insight-${k}`}>
            <Lightbulb size={16} style={{ color: toneColor[i.tone], flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm">{i.text}</p>
          </div>
        ))}
      </div>

      <div className="card mt-3" style={{ borderColor: "rgba(92,58,33,.45)" }} data-testid="card-focus">
        <div className="flex items-center gap-2 label lime"><Target size={14} /> Focus for next week</div>
        <p className="mt-2 text-[15px]">{rep.focus}</p>
      </div>

      <div className="section-title"><h2 className="flex items-center gap-1">Main lifts · e1RM <Info k="e1rm" /></h2></div>
      <div className="card" style={{ padding: "4px 14px" }}>
        {rep.liftChanges.length === 0 ? <p className="text-sm muted py-3">No main lifts trained this week.</p> : rep.liftChanges.map((l) => {
          const d = l.to - l.from;
          return (
            <div key={l.exId} className="rowline">
              <span className="text-sm">{EX[l.exId].name}</span>
              <span className="mono text-sm">{Math.round(l.from)} → {Math.round(l.to)} <span className={d > 0.5 ? "lime" : d < -0.5 ? "orange" : "muted"}>{d >= 0 ? "+" : ""}{r1(d)}</span></span>
            </div>
          );
        })}
      </div>

      <div className="section-title"><h2>PRs this week</h2><span className="label">{rep.prs.length}</span></div>
      <div className="card" style={{ padding: "4px 14px" }}>
        {rep.prs.length === 0 ? <p className="text-sm muted py-3">No PRs this week.</p> : rep.prs.map((p, i) => (
          <div key={i} className="rowline"><span className="text-sm">{EX[p.exId].name}</span><span className="mono text-sm">{fmtW(p.weight)}×{p.reps} <span className="lime">e1RM {Math.round(p.e1rm)}</span></span></div>
        ))}
      </div>

      <div className="section-title"><h2>Hard sets per muscle</h2><span className="label">target 10–20</span></div>
      <div className="card">
        {MUSCLES.filter((m) => rep.sets[m] > 0 || ["chest", "lats", "quads", "hamstrings", "shoulders"].includes(m)).map((m) => (
          <div key={m} className="grid items-center gap-3" style={{ gridTemplateColumns: "92px 1fr 34px", minHeight: 26 }}>
            <span className="text-[13px]">{MUSCLE_LABEL[m]}</span>
            <Bar pct={(rep.sets[m] / 24) * 100} color={rep.sets[m] < VOLUME_RANGE.min ? "var(--orange)" : rep.sets[m] > VOLUME_RANGE.max ? "var(--blue)" : "var(--lime)"} />
            <span className="mono text-xs text-right">{r1(rep.sets[m])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Experiments() {
  const { state, set } = useStore();
  const ui = useUI();
  const today = dateKey();
  const [newOpen, setNewOpen] = useState(false);
  const [tpl, setTpl] = useState("creatine");
  const [custom, setCustom] = useState({ name: "", question: "" });
  const [report, setReport] = useState<Experiment | null>(null);
  const active = state.experiments.filter((e) => e.status === "active");
  const done = state.experiments.filter((e) => e.status !== "active");

  const start = () => {
    const t = EXPERIMENT_TEMPLATES.find((x) => x.id === tpl)!;
    const exp: Experiment = { id: newId("exp"), template: tpl, name: tpl === "custom" ? custom.name || "Custom" : t.name, question: tpl === "custom" ? custom.question || "Did it today?" : t.question, startDate: today, baselineDays: 14, experimentDays: 28, log: {}, status: "active" };
    set((s) => ({ ...s, experiments: [...s.experiments.map((e) => (e.status === "active" ? { ...e, status: "abandoned" as const } : e)), exp] }));
    setNewOpen(false);
    ui.toast("Baseline started — 14 days of normal routine");
  };

  return (
    <div data-testid="view-experiments">
      <p className="text-sm muted mb-3">Test one variable at a time: 2-week baseline, then 4 weeks tracking it daily. Corpus compares readiness, strength rate, and body weight between the two windows.</p>
      {active.map((e) => <ExperimentCard key={e.id} exp={e} onReport={() => setReport(e)} />)}
      {active.length === 0 && <Empty>No experiment running.</Empty>}
      <button className="btn btn-primary btn-block mt-3" onClick={() => setNewOpen(true)} data-testid="button-new-experiment"><FlaskConical size={16} /> Start new experiment</button>
      {done.length > 0 && (
        <>
          <div className="section-title"><h2>Past experiments</h2></div>
          {done.map((e) => (
            <button key={e.id} className="card w-full text-left flex justify-between" onClick={() => setReport(e)}><span className="font-semibold text-sm">{e.name}</span><span className="chip">{e.status}</span></button>
          ))}
        </>
      )}
      {newOpen && (
        <Sheet title="New experiment" onClose={() => setNewOpen(false)} testId="sheet-new-experiment">
          <div className="stack" style={{ gap: 8 }}>
            {EXPERIMENT_TEMPLATES.map((t) => (
              <button key={t.id} className="card-flat w-full text-left" style={{ borderColor: tpl === t.id ? "var(--lime)" : undefined, background: tpl === t.id ? "var(--lime-dim)" : undefined }} onClick={() => setTpl(t.id)} aria-pressed={tpl === t.id ? "true" : "false"} data-testid={`exp-template-${t.id}`}>
                <div className="font-semibold text-sm">{t.name}</div><div className="text-xs muted">Daily: “{t.question}”</div>
              </button>
            ))}
          </div>
          {tpl === "custom" && (
            <div className="stack mt-3">
              <input className="input" placeholder="Variable name (e.g. Ashwagandha)" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} data-testid="input-exp-name" />
              <input className="input" placeholder="Daily yes/no question" value={custom.question} onChange={(e) => setCustom({ ...custom, question: e.target.value })} data-testid="input-exp-question" />
            </div>
          )}
          {active.length > 0 && <p className="text-xs orange mt-3">Starting a new one ends “{active[0].name}”.</p>}
          <button className="btn btn-primary btn-lg btn-block mt-4" onClick={start} data-testid="button-start-experiment">Start 2-week baseline</button>
        </Sheet>
      )}
      {report && <ExperimentReportSheet exp={report} onClose={() => setReport(null)} />}
    </div>
  );
}

function ExperimentCard({ exp, onReport }: { exp: Experiment; onReport: () => void }) {
  const { set } = useStore();
  const today = dateKey();
  const ph = experimentPhase(exp, today);
  const dayN = ph.phase === "baseline" ? ph.day : ph.phase === "experiment" ? exp.baselineDays + ph.day : ph.total;
  return (
    <div className="card" data-testid={`card-experiment-${exp.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{exp.name}</span>
        <span className={`chip ${ph.phase === "experiment" ? "chip-blue" : ph.phase === "done" ? "chip-lime" : ""}`}>{ph.phase === "baseline" ? `Baseline ${ph.day}/${ph.of}` : ph.phase === "experiment" ? `Experiment ${ph.day}/${ph.of}` : "Complete"}</span>
      </div>
      <div className="flex gap-[2px] mt-3" aria-label="Timeline">
        {Array.from({ length: ph.total }).map((_, i) => {
          const d = addDays(exp.startDate, i);
          const isExp = i >= exp.baselineDays;
          const past = i < dayN;
          const v = exp.log[d];
          return <i key={i} title={d} style={{ flex: 1, height: 18, borderRadius: 1, background: !past ? "var(--border)" : !isExp ? "var(--faint)" : v === true ? "var(--lime)" : v === false ? "var(--orange)" : "var(--border-strong)" }} />;
        })}
      </div>
      <div className="flex justify-between label mt-1"><span>baseline</span><span>experiment · 28d</span></div>
      <p className="text-xs muted mt-2">Daily check-in item: “{exp.question}”</p>
      <div className="flex gap-2 mt-3">
        <button className="btn btn-sm flex-1" onClick={onReport} data-testid="button-exp-report">{ph.phase === "done" ? "Final report" : "Interim report"}</button>
        {ph.phase === "done"
          ? <button className="btn btn-sm btn-primary flex-1" onClick={() => set((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === exp.id ? { ...e, status: "complete" } : e)) }))}>Mark complete</button>
          : <button className="btn btn-sm btn-ghost" onClick={() => set((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === exp.id ? { ...e, status: "abandoned" } : e)) }))} data-testid="button-exp-stop">Stop</button>}
      </div>
    </div>
  );
}

function ExperimentReportSheet({ exp, onClose }: { exp: Experiment; onClose: () => void }) {
  const { state, profile } = useStore();
  const rep = experimentReport(state, exp, dateKey());
  const row = (label: string, a: number | null, b: number | null, fmt: (x: number) => string, higherBetter = true) => {
    const d = a != null && b != null ? b - a : null;
    const good = d != null && (higherBetter ? d > 0 : d < 0);
    return (
      <div className="grid items-center" style={{ gridTemplateColumns: "1fr 72px 72px 64px", minHeight: 44, borderTop: "1px solid var(--border)" }}>
        <span className="text-[13px]">{label}</span>
        <span className="mono text-sm text-right">{a != null ? fmt(a) : "—"}</span>
        <span className="mono text-sm text-right">{b != null ? fmt(b) : "—"}</span>
        <span className={`mono text-xs text-right ${d == null ? "faint" : good ? "lime" : "orange"}`}>{d != null ? `${d >= 0 ? "+" : ""}${fmt(d)}` : ""}</span>
      </div>
    );
  };
  return (
    <Sheet title={`${exp.name} · report`} onClose={onClose} testId="sheet-exp-report">
      <div className="grid label" style={{ gridTemplateColumns: "1fr 72px 72px 64px" }}><span>Metric</span><span className="text-right">Baseline</span><span className="text-right">With it</span><span className="text-right">Δ</span></div>
      {row("Avg readiness", rep.base.readiness, rep.exp.readiness, (x) => String(Math.round(x)))}
      {row("e1RM rate %/wk", rep.base.e1rmRatePct, rep.exp.e1rmRatePct, (x) => r1(x).toFixed(1))}
      {row(`Weight ${profile.units}/wk`, rep.base.weightPerWeek, rep.exp.weightPerWeek, (x) => r1(x).toFixed(1), profile.goal === "muscle")}
      <div className="card-flat mt-4 text-sm">
        <div className="mono text-xs muted mb-1">{rep.expDays} experiment days · adherence {Math.round(rep.adherence * 100)}% ({rep.adhered} yes)</div>
        <div className="font-semibold" data-testid="text-exp-confidence">{rep.confidence}</div>
        <p className="text-xs muted mt-2">One person, one variable, a few weeks. Sleep, stress, and normal training progress also move these numbers. Use this to decide whether to keep going, not as proof.</p>
      </div>
    </Sheet>
  );
}

export function History() {
  const { state, profile } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const list = [...state.sessions].filter((s) => s.end).sort((a, b) => b.start - a.start);
  if (!list.length) return <Empty>No sessions yet. Finish a workout and it shows here.</Empty>;
  return (
    <div className="stack" data-testid="view-history">
      {list.slice(0, 40).map((s) => {
        const prs = sessionPRs(state.sessions, s);
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="card" style={{ padding: 0 }}>
            <button className="w-full text-left flex items-center gap-3" style={{ padding: "12px 14px", minHeight: 56 }} onClick={() => setOpen(isOpen ? null : s.id)} data-testid={`row-history-${s.id}`}>
              <div className="min0 flex-1">
                <div className="font-semibold text-sm">{s.dayName}</div>
                <div className="mono text-[11px] muted">{fmtDate(s.date, { weekday: "short", month: "short", day: "numeric" })} · {Math.round((s.end! - s.start) / 60000)} min · {Math.round(sessionVolume(s)).toLocaleString()} {profile.units}</div>
              </div>
              {prs.length > 0 && <span className="chip chip-lime">{prs.length} PR</span>}
              {isOpen ? <ChevronLeft size={16} className="muted rotate-[-90deg]" /> : <ChevronRight size={16} className="muted" />}
            </button>
            {isOpen && (
              <div style={{ padding: "0 14px 12px" }}>
                {s.exercises.map((l, i) => (
                  <div key={i} className="rowline" style={{ alignItems: "flex-start" }}>
                    <span className="text-[13px] min0">{EX[l.exId].name}</span>
                    <span className="mono text-xs text-right muted">{l.sets.map((x) => `${fmtW(x.weight)}×${x.reps}`).join("  ")}</span>
                  </div>
                ))}
                {s.coachNote && <p className="text-xs blue mt-2">Coach: {s.coachNote}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { Seg };
