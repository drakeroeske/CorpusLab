import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import type { Pattern, Program, ProgramDay, ProgramExercise, Units } from "@/lib/types";
import { EX, EXERCISES, MUSCLE_LABEL, PATTERN_LABEL, isCompound, newId } from "@/lib/exercises";
import { NumInput, Seg, Sheet } from "./ui";
import { DEFAULT_INC_PCT, fmtW, jumpFor } from "@/lib/engine";

const WD = ["S", "M", "T", "W", "T", "F", "S"];
const WD_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ExercisePicker({ onPick, onClose, title = "Exercise library" }: { onPick: (id: string) => void; onClose: () => void; title?: string }) {
  const [q, setQ] = useState("");
  const [pat, setPat] = useState<Pattern | "all">("all");
  const list = useMemo(() => EXERCISES.filter((e) => (pat === "all" || e.pattern === pat) && (q === "" || e.name.toLowerCase().includes(q.toLowerCase()) || e.primary.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q.toLowerCase())))), [q, pat]);
  return (
    <Sheet title={title} onClose={onClose} full testId="sheet-exercise-picker">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 faint" />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search name or muscle" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-exercise-search" autoFocus />
      </div>
      <div className="scroll-x flex gap-2 mb-3">
        {(["all", "squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "isolation"] as const).map((p) => (
          <button key={p} className={`chip ${pat === p ? "chip-lime" : ""}`} style={{ height: 32 }} onClick={() => setPat(p)} data-testid={`filter-pattern-${p}`}>{p === "all" ? "All" : PATTERN_LABEL[p]}</button>
        ))}
      </div>
      <div className="label mb-2">{list.length} exercises</div>
      <div>
        {list.map((e) => (
          <button key={e.id} className="rowline w-full text-left" onClick={() => onPick(e.id)} data-testid={`pick-exercise-${e.id}`}>
            <div className="min0">
              <div className="font-semibold text-[15px]">{e.name}</div>
              <div className="text-xs muted mt-0.5">{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}{e.secondary.length ? <span className="faint"> · {e.secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span> : null}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="chip">{PATTERN_LABEL[e.pattern]}</span>
              <span className="label">{e.equipment}</span>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function NumField({ label, value, onChange, step = 1, testId }: { label: string; value: number; onChange: (v: number) => void; step?: number; testId: string }) {
  return (
    <label className="field min0">
      <span className="label">{label}</span>
      <NumInput value={value} min={0} integer={step >= 1 && Number.isInteger(step)} onChange={(v) => v !== null && onChange(v)} data-testid={testId} />
    </label>
  );
}

function ExerciseRow({ pe, units, onChange, onRemove, onMove, idx, total }: { pe: ProgramExercise; units: Units; onChange: (p: ProgramExercise) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; idx: number; total: number }) {
  const [open, setOpen] = useState(false);
  const ex = EX[pe.exId];
  return (
    <div className="card-flat" style={{ padding: 0 }} data-testid={`program-exercise-${pe.id}`}>
      <button className="w-full flex items-center gap-3 text-left" style={{ padding: "10px 12px", minHeight: 52 }} onClick={() => setOpen(!open)} data-testid={`toggle-exercise-${pe.id}`}>
        {open ? <ChevronDown size={16} className="muted shrink-0" /> : <ChevronRight size={16} className="muted shrink-0" />}
        <div className="min0 flex-1">
          <div className="font-semibold truncate">{ex.name}</div>
          <div className="mono text-xs muted">{pe.sets} × {pe.repMin}–{pe.repMax} · {pe.startWeight} {units} · +{pe.incrementPct ?? DEFAULT_INC_PCT}% (≈{fmtW(jumpFor(pe, pe.startWeight))} {units}){pe.technique ? ` · ${pe.technique}` : ""}</div>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px" }} className="stack">
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Sets" value={pe.sets} onChange={(v) => onChange({ ...pe, sets: Math.max(1, Math.round(v)) })} testId={`input-sets-${pe.id}`} />
            <NumField label="Rep min" value={pe.repMin} onChange={(v) => onChange({ ...pe, repMin: Math.max(1, Math.round(v)) })} testId={`input-repmin-${pe.id}`} />
            <NumField label="Rep max" value={pe.repMax} onChange={(v) => onChange({ ...pe, repMax: Math.max(pe.repMin, Math.round(v)) })} testId={`input-repmax-${pe.id}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label={`Start weight (${units})`} value={pe.startWeight} step={0.5} onChange={(v) => onChange({ ...pe, startWeight: v })} testId={`input-start-${pe.id}`} />
            <NumField label="Jump · % of weight" value={pe.incrementPct ?? DEFAULT_INC_PCT} step={0.5} onChange={(v) => onChange({ ...pe, incrementPct: v })} testId={`input-incpct-${pe.id}`} />
            <NumField label={`Plate step (${units})`} value={pe.increment} step={0.25} onChange={(v) => onChange({ ...pe, increment: v })} testId={`input-inc-${pe.id}`} />
          </div>
          <div className="field"><span className="label">Progression</span>
            <Seg value={pe.style} onChange={(v) => onChange({ ...pe, style: v })} options={[{ v: "double", l: "Double progression" }, { v: "straight", l: "Straight sets" }]} testId={`seg-style-${pe.id}`} />
          </div>
          <div className="field"><span className="label">Intensity technique (optional)</span>
            <Seg value={pe.technique ?? "none"} onChange={(v) => onChange({ ...pe, technique: v === "none" ? null : (v as ProgramExercise["technique"]) })} options={[{ v: "none", l: "None" }, { v: "drop", l: "Drop" }, { v: "restpause", l: "Rest-pause" }, { v: "failure", l: "Failure" }]} testId={`seg-tech-${pe.id}`} />
          </div>
          <div className="flex gap-2">
            <button className="icon-btn" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp size={16} /></button>
            <button className="icon-btn" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown size={16} /></button>
            <span className="flex-1" />
            <button className="btn btn-warn btn-sm" onClick={onRemove} data-testid={`button-remove-${pe.id}`}><Trash2 size={14} /> Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProgramEditor({ program, units, onChange }: { program: Program; units: Units; onChange: (p: Program) => void }) {
  const [picking, setPicking] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(program.days[0]?.id ?? null);
  const setDay = (id: string, fn: (d: ProgramDay) => ProgramDay) => onChange({ ...program, days: program.days.map((d) => (d.id === id ? fn(d) : d)) });
  const usedWeekdays = (except: string) => new Set(program.days.filter((d) => d.id !== except).flatMap((d) => d.weekdays));

  const addExercise = (dayId: string, exId: string) => {
    const ex = EX[exId];
    const comp = isCompound(ex);
    const pe: ProgramExercise = {
      id: newId("pe"), exId, sets: 3, repMin: comp ? 6 : 10, repMax: comp ? 10 : 15, startWeight: 0,
      increment: units === "lb" ? (["back_squat", "deadlift", "leg_press", "hip_thrust"].includes(exId) ? 10 : 5) : (comp ? 2.5 : 1.25),
      style: "double", technique: null,
    };
    setDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, pe] }));
    setPicking(null);
  };

  return (
    <div>
      <label className="field mb-3">
        <span className="label">Program name</span>
        <input className="input" value={program.name} onChange={(e) => onChange({ ...program, name: e.target.value })} data-testid="input-program-name" />
      </label>
      <div className="stack">
        {program.days.map((d) => {
          const taken = usedWeekdays(d.id);
          const open = openDay === d.id;
          return (
            <div key={d.id} className="card" data-testid={`program-day-${d.id}`}>
              <div className="flex items-center gap-2">
                <button className="icon-btn" onClick={() => setOpenDay(open ? null : d.id)} aria-label="Toggle day" data-testid={`toggle-day-${d.id}`}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                <input className="input font-semibold" value={d.name} onChange={(e) => setDay(d.id, (x) => ({ ...x, name: e.target.value }))} data-testid={`input-day-name-${d.id}`} />
                <button className="icon-btn" aria-label="Delete day" onClick={() => onChange({ ...program, days: program.days.filter((x) => x.id !== d.id) })} data-testid={`button-delete-day-${d.id}`}><Trash2 size={16} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mt-3">
                {WD.map((w, i) => {
                  const on = d.weekdays.includes(i);
                  const dis = taken.has(i);
                  return (
                    <button key={i} disabled={dis} aria-pressed={on ? "true" : "false"} aria-label={WD_LONG[i]}
                      onClick={() => setDay(d.id, (x) => ({ ...x, weekdays: on ? x.weekdays.filter((y) => y !== i) : [...x.weekdays, i].sort() }))}
                      className="mono text-sm" data-testid={`weekday-${d.id}-${i}`}
                      style={{ minHeight: 40, borderRadius: 6, border: "1px solid var(--border-strong)", background: on ? "var(--lime)" : "transparent", color: on ? "var(--bg)" : dis ? "var(--border-strong)" : "var(--muted)", fontWeight: 600 }}>{w}</button>
                  );
                })}
              </div>
              {!open && <div className="text-xs muted mt-2">{d.exercises.length} exercises · {d.exercises.reduce((a, e) => a + e.sets, 0)} sets</div>}
              {open && (
                <div className="stack mt-3">
                  {d.exercises.map((pe, i) => (
                    <ExerciseRow key={pe.id} pe={pe} units={units} idx={i} total={d.exercises.length}
                      onChange={(np) => setDay(d.id, (x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === pe.id ? np : e)) }))}
                      onRemove={() => setDay(d.id, (x) => ({ ...x, exercises: x.exercises.filter((e) => e.id !== pe.id) }))}
                      onMove={(dir) => setDay(d.id, (x) => { const a = [...x.exercises]; const j = i + dir; [a[i], a[j]] = [a[j], a[i]]; return { ...x, exercises: a }; })} />
                  ))}
                  <button className="btn btn-outline btn-block" onClick={() => setPicking(d.id)} data-testid={`button-add-exercise-${d.id}`}><Plus size={16} /> Add exercise</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn btn-block mt-3" onClick={() => { const id = newId("day"); onChange({ ...program, days: [...program.days, { id, name: `Day ${program.days.length + 1}`, weekdays: [], exercises: [] }] }); setOpenDay(id); }} data-testid="button-add-day"><Plus size={16} /> Add training day</button>
      {picking && <ExercisePicker onClose={() => setPicking(null)} onPick={(id) => addExercise(picking, id)} />}
    </div>
  );
}
