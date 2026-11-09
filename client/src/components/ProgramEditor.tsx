import { useState } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, ChevronRight, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { moveItem, useDragReorder } from "./DragList";
import type { Program, ProgramDay, ProgramExercise, Units } from "@/lib/types";
import { EX, isCompound, newId } from "@/lib/exercises";
import { ExerciseCatalog } from "./ExerciseCatalog";
import { NumInput, Seg, Sheet } from "./ui";
import { DEFAULT_INC_PCT, fmtW, jumpFor } from "@/lib/engine";

const WD = ["S", "M", "T", "W", "T", "F", "S"];
const WD_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ExercisePicker({ onPick, onClose, title = "Exercise library" }: { onPick: (id: string) => void; onClose: () => void; title?: string }) {
  return (
    <Sheet title={title} onClose={onClose} full testId="sheet-exercise-picker">
      <ExerciseCatalog onPick={onPick} />
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

function ExerciseRow({ pe, units, onChange, onRemove, onMove, idx, total, itemProps, handleProps }: {
  pe: ProgramExercise; units: Units; onChange: (p: ProgramExercise) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; idx: number; total: number;
  itemProps: { "data-drag-item": string; className: string }; handleProps: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const ex = EX[pe.exId];
  return (
    <div {...itemProps} className={`card-flat ${itemProps.className}`} style={{ padding: 0 }} data-testid={`program-exercise-${pe.id}`}>
      <div className="flex items-center">
        <span className="drag-handle shrink-0" {...handleProps} data-testid={`drag-exercise-${pe.id}`}><GripVertical size={18} /></span>
        <button className="flex-1 min0 flex items-center gap-3 text-left" style={{ padding: "10px 12px 10px 0", minHeight: 52 }} onClick={() => setOpen(!open)} data-testid={`toggle-exercise-${pe.id}`}>
          <div className="min0 flex-1">
            <div className="font-semibold truncate">{ex.name}</div>
            <div className="mono text-xs muted">{pe.sets} × {pe.repMin}–{pe.repMax} · {pe.startWeight} {units} · +{pe.incrementPct ?? DEFAULT_INC_PCT}% (≈{fmtW(jumpFor(pe, pe.startWeight))} {units}){pe.technique ? ` · ${pe.technique}` : ""}</div>
          </div>
          {open ? <ChevronDown size={16} className="muted shrink-0" /> : <ChevronRight size={16} className="muted shrink-0" />}
        </button>
      </div>
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

/** Default settings for an exercise newly added to a program day or saved workout. */
export function newProgramExercise(exId: string, units: Units): ProgramExercise {
  const comp = isCompound(EX[exId]);
  return {
    id: newId("pe"), exId, sets: 3, repMin: comp ? 6 : 10, repMax: comp ? 10 : 15, startWeight: 0,
    increment: units === "lb" ? (["back_squat", "deadlift", "leg_press", "hip_thrust"].includes(exId) ? 10 : 5) : (comp ? 2.5 : 1.25),
    style: "double", technique: null,
  };
}

/** The exercises of one program day or saved workout: edit, drag to reorder, remove, add from the library. */
export function DayExercises({ exercises, units, onChange, addTestId }: { exercises: ProgramExercise[]; units: Units; onChange: (x: ProgramExercise[]) => void; addTestId: string }) {
  const [picking, setPicking] = useState(false);
  const drag = useDragReorder((from, to) => onChange(moveItem(exercises, from, to)));
  return (
    <div className="stack" ref={drag.containerRef}>
      {exercises.map((pe, i) => (
        <ExerciseRow key={pe.id} pe={pe} units={units} idx={i} total={exercises.length} itemProps={drag.itemProps(i)} handleProps={drag.handleProps(i)}
          onChange={(np) => onChange(exercises.map((e) => (e.id === pe.id ? np : e)))}
          onRemove={() => onChange(exercises.filter((e) => e.id !== pe.id))}
          onMove={(dir) => { const a = [...exercises]; const j = i + dir; [a[i], a[j]] = [a[j], a[i]]; onChange(a); }} />
      ))}
      <button className="btn btn-outline btn-block" onClick={() => setPicking(true)} data-testid={addTestId}><Plus size={16} /> Add exercise</button>
      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={(id) => { onChange([...exercises, newProgramExercise(id, units)]); setPicking(false); }} />}
    </div>
  );
}

export function ProgramEditor({ program, units, onChange, onSaveDay }: { program: Program; units: Units; onChange: (p: Program) => void; onSaveDay?: (d: ProgramDay) => void }) {
  const [openDay, setOpenDay] = useState<string | null>(program.days[0]?.id ?? null);
  const setDay = (id: string, fn: (d: ProgramDay) => ProgramDay) => onChange({ ...program, days: program.days.map((d) => (d.id === id ? fn(d) : d)) });
  const usedWeekdays = (except: string) => new Set(program.days.filter((d) => d.id !== except).flatMap((d) => d.weekdays));

  const duplicateDay = (d: ProgramDay) => {
    const copy: ProgramDay = { ...d, id: newId("day"), name: `${d.name} copy`, weekdays: [], exercises: d.exercises.map((e) => ({ ...e, id: newId("pe") })) };
    const i = program.days.findIndex((x) => x.id === d.id);
    onChange({ ...program, days: [...program.days.slice(0, i + 1), copy, ...program.days.slice(i + 1)] });
    setOpenDay(copy.id);
  };
  const dayDrag = useDragReorder((from, to) => onChange({ ...program, days: moveItem(program.days, from, to) }));

  return (
    <div>
      <label className="field mb-3">
        <span className="label">Program name</span>
        <input className="input" value={program.name} onChange={(e) => onChange({ ...program, name: e.target.value })} data-testid="input-program-name" />
      </label>
      {program.days.length > 1 && <p className="text-xs muted mb-2">Hold the grip to drag days or exercises into a new order.</p>}
      <div className="stack" ref={dayDrag.containerRef}>
        {program.days.map((d, di) => {
          const taken = usedWeekdays(d.id);
          const open = openDay === d.id;
          const ip = dayDrag.itemProps(di);
          return (
            <div key={d.id} {...ip} className={`card ${ip.className}`} data-testid={`program-day-${d.id}`}>
              <div className="flex items-center gap-1">
                <span className="drag-handle" {...dayDrag.handleProps(di)} data-testid={`drag-day-${d.id}`}><GripVertical size={18} /></span>
                <button className="icon-btn" onClick={() => setOpenDay(open ? null : d.id)} aria-label="Toggle day" data-testid={`toggle-day-${d.id}`}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                <input className="input font-semibold min0" value={d.name} onChange={(e) => setDay(d.id, (x) => ({ ...x, name: e.target.value }))} data-testid={`input-day-name-${d.id}`} />
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
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs muted">{d.exercises.length} exercises · {d.exercises.reduce((a, e) => a + e.sets, 0)} sets</span>
                <span className="flex items-center gap-1">
                  {onSaveDay && <button className="icon-btn" aria-label={`Save ${d.name} as a workout`} title="Save as workout" disabled={!d.exercises.length} onClick={() => onSaveDay(d)} data-testid={`button-save-day-${d.id}`}><BookmarkPlus size={16} /></button>}
                  <button className="icon-btn" aria-label="Duplicate day" title="Duplicate day" onClick={() => duplicateDay(d)} data-testid={`button-duplicate-day-${d.id}`}><Copy size={16} /></button>
                  <button className="icon-btn" aria-label="Delete day" title="Delete day" onClick={() => { if (!d.exercises.length || confirm(`Delete ${d.name}?`)) onChange({ ...program, days: program.days.filter((x) => x.id !== d.id) }); }} data-testid={`button-delete-day-${d.id}`}><Trash2 size={16} /></button>
                </span>
              </div>
              {open && (
                <div className="mt-3"><DayExercises exercises={d.exercises} units={units} onChange={(x) => setDay(d.id, (dd) => ({ ...dd, exercises: x }))} addTestId={`button-add-exercise-${d.id}`} /></div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn btn-block mt-3" onClick={() => { const id = newId("day"); onChange({ ...program, days: [...program.days, { id, name: `Day ${program.days.length + 1}`, weekdays: [], exercises: [] }] }); setOpenDay(id); }} data-testid="button-add-day"><Plus size={16} /> Add training day</button>
    </div>
  );
}
