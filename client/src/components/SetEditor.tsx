import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { e1rm, fmtDate, fmtW, roundTo, sessionVolume } from "@/lib/engine";
import { freeLog } from "@/lib/derived";
import { EX } from "@/lib/exercises";
import type { ExerciseLog, Session, SetKind, SetLog, SetPart, Units } from "@/lib/types";
import { Seg, Sheet, Stepper } from "@/components/ui";
import { ExercisePicker } from "@/components/ProgramEditor";

export const KIND_LABEL: Record<SetKind, string> = { drop: "Drop set", restpause: "Rest-pause" };

/** "185 × 8 → 135 × 6" for drop sets, "185 × 8 + 3 + 2" for rest-pause, "185 × 8" otherwise. */
export function fmtSet(x: SetLog, sep = " × "): string {
  const main = `${fmtW(x.weight)}${sep}${x.reps}`;
  if (!x.kind || !x.parts?.length) return main;
  if (x.kind === "restpause") return `${main} + ${x.parts.map((p) => p.reps).join(" + ")}`;
  return [main, ...x.parts.map((p) => `${fmtW(p.weight)}${sep}${p.reps}`)].join(" → ");
}

const stepFor = (units: Units) => (units === "lb" ? 5 : 2.5);

/** Starting rows when someone switches a set to a drop set (one drop, ~25% lighter) or rest-pause (two mini-sets). */
export function defaultParts(kind: SetKind, weight: number, reps: number, inc: number): SetPart[] {
  if (kind === "drop") return [{ weight: Math.max(0, roundTo(weight * 0.75, inc)), reps }];
  return [{ weight, reps: Math.max(1, Math.round(reps / 3)) }, { weight, reps: Math.max(1, Math.round(reps / 4)) }];
}

function nextPart(kind: SetKind, parts: SetPart[], weight: number, reps: number, inc: number): SetPart {
  const last = parts[parts.length - 1] ?? { weight, reps };
  return kind === "drop" ? { weight: Math.max(0, roundTo(last.weight * 0.75, inc)), reps: last.reps } : { weight, reps: Math.max(1, last.reps - 1) };
}

/** Clean up before saving: rest-pause mini-sets use the main weight, empty rows go, and no rows left means a normal set. */
export function normalizeSet(x: SetLog): SetLog {
  const parts = (x.parts ?? []).filter((p) => p.reps > 0).map((p) => (x.kind === "restpause" ? { ...p, weight: x.weight } : p));
  if (!x.kind || parts.length === 0) { const { kind: _k, parts: _p, ...rest } = x; return rest; }
  return { ...x, parts };
}

/** Normal / Drop set / Rest-pause, plus one row per drop or mini-set. */
export function SetTypeFields({ kind, parts, weight, reps, inc, units, onChange, testId }: {
  kind: SetKind | null; parts: SetPart[]; weight: number; reps: number; inc: number; units: Units;
  onChange: (kind: SetKind | null, parts: SetPart[]) => void; testId: string;
}) {
  const pick = (k: "normal" | SetKind) => (k === "normal" ? onChange(null, []) : onChange(k, kind === k && parts.length ? parts : defaultParts(k, weight, reps, inc)));
  const upd = (i: number, p: Partial<SetPart>) => onChange(kind, parts.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const remove = (i: number) => { const next = parts.filter((_, j) => j !== i); onChange(next.length ? kind : null, next); };
  return (
    <div className="field">
      <span className="label">Set type</span>
      <Seg value={kind ?? "normal"} onChange={pick} options={[{ v: "normal", l: "Normal" }, { v: "drop", l: "Drop set" }, { v: "restpause", l: "Rest-pause" }]} testId={`${testId}-kind`} />
      {kind && (
        <div className="stack mt-2" style={{ gap: 10 }}>
          <p className="text-[13px] muted">{kind === "drop" ? "Right after your set, strip about 25% and keep going. One row per drop." : "Rest about 15 seconds, then squeeze out more reps at the same weight. One row per mini-set."}</p>
          {parts.map((p, i) => (
            <div key={i} data-testid={`${testId}-part-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{kind === "drop" ? `Drop ${i + 1}` : `Mini-set ${i + 1}`}{kind === "restpause" && <span className="muted font-normal"> · {fmtW(weight)} {units}</span>}</span>
                <button type="button" className="icon-btn" style={{ width: 40, height: 40, border: 0 }} aria-label={`Remove ${kind === "drop" ? "drop" : "mini-set"} ${i + 1}`} onClick={() => remove(i)} data-testid={`${testId}-part-remove-${i}`}><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {kind === "drop" && <Stepper value={p.weight} step={inc} unit={units} onChange={(v) => upd(i, { weight: v })} testId={`${testId}-part-weight-${i}`} />}
                <Stepper value={p.reps} step={1} min={0} max={100} decimals={0} unit="reps" onChange={(v) => upd(i, { reps: v })} testId={`${testId}-part-reps-${i}`} />
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline" onClick={() => onChange(kind, [...parts, nextPart(kind, parts, weight, reps, inc)])} data-testid={`${testId}-part-add`}>
            <Plus size={14} /> {kind === "drop" ? "Add a drop" : "Add a mini-set"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Fix a set that was logged wrong: weight, reps, set type, effort and quality, or delete it. */
export function EditSetSheet({ title, initial, units, inc, onSave, onDelete, onClose }: {
  title: string; initial: SetLog; units: Units; inc?: number; onSave: (s: SetLog) => void; onDelete?: () => void; onClose: () => void;
}) {
  const step = inc ?? stepFor(units);
  const [w, setW] = useState(initial.weight);
  const [reps, setReps] = useState(initial.reps);
  const [kind, setKind] = useState<SetKind | null>(initial.kind ?? null);
  const [parts, setParts] = useState<SetPart[]>(initial.parts ?? []);
  const [rir, setRir] = useState<number | null>(initial.rir ?? null);
  const [quality, setQuality] = useState<number | null>(initial.quality ?? null);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = () => { onSave(normalizeSet({ ...initial, weight: w, reps, kind, parts, rir, quality })); onClose(); };
  return (
    <Sheet title={title} onClose={onClose} testId="sheet-edit-set">
      <div className="stack" style={{ gap: 12 }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><span className="label">Weight ({units})</span><Stepper value={w} step={step} unit={units} onChange={setW} testId="stepper-edit-weight" /></div>
          <div className="field"><span className="label">Reps</span><Stepper value={reps} step={1} min={0} max={100} decimals={0} unit="reps" onChange={setReps} testId="stepper-edit-reps" /></div>
        </div>
        <SetTypeFields kind={kind} parts={parts} weight={w} reps={reps} inc={step} units={units} onChange={(k, p) => { setKind(k); setParts(p); }} testId="edit-set" />
        <div className="field"><span className="label">Reps in reserve (optional)</span>
          <Seg className="seg-num" value={rir ?? -1} onChange={(v) => setRir(v === -1 ? null : v)} options={[{ v: -1, l: "–" }, { v: 0, l: "0" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }]} testId="seg-edit-rir" />
        </div>
        <div className="field"><span className="label">Set quality (optional) · 1 grind → 5 crisp</span>
          <Seg className="seg-num seg-lime" value={quality ?? -1} onChange={(v) => setQuality(v === -1 ? null : v)} options={[{ v: -1, l: "–" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }, { v: 5, l: "5" }]} testId="seg-edit-quality" />
        </div>
        <button className="btn btn-primary btn-lg btn-block" onClick={save} data-testid="button-save-set">Save set</button>
        {onDelete && (confirmDel ? (
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setConfirmDel(false)} data-testid="button-delete-set-cancel">Keep it</button>
            <button className="btn btn-warn flex-1" onClick={() => { onDelete(); onClose(); }} data-testid="button-delete-set-confirm">Delete set</button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setConfirmDel(true)} data-testid="button-delete-set"><Trash2 size={15} /> Delete this set</button>
        ))}
      </div>
    </Sheet>
  );
}

/** One logged set as a tappable row. Tapping opens the editor. */
export function SetRow({ set: st, n, onEdit, testId }: { set: SetLog; n: number; onEdit: () => void; testId: string }) {
  return (
    <button type="button" className="w-full flex items-center gap-3 text-left text-[15px]" style={{ minHeight: 44, borderTop: "1px solid var(--line)" }} onClick={onEdit} aria-label={`Edit set ${n}`} data-testid={testId}>
      <span className="muted w-12 shrink-0">Set {n}</span>
      <span className="mono flex-1 min0">
        <b>{fmtSet(st)}</b>
        {st.kind && <span className="chip ml-2" style={{ fontFamily: "var(--font-sans)" }}>{KIND_LABEL[st.kind]}</span>}
        {st.rir != null && <span className="muted"> · {st.rir} RIR</span>}{st.quality != null && <span className="muted"> · Q{st.quality}</span>}
      </span>
      <Pencil size={14} className="faint shrink-0" />
    </button>
  );
}

/** Edit a finished workout: fix or delete sets, add a missed set or exercise, remove an exercise, or delete the whole workout. */
export function EditWorkoutSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const { set, state, profile } = useStore();
  const ui = useUI();
  const u = profile.units;
  const [draft, setDraft] = useState<Session>(session);
  const [editing, setEditing] = useState<{ e: number; s: number | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const updEx = (e: number, fn: (l: ExerciseLog) => ExerciseLog) => setDraft((d) => ({ ...d, exercises: d.exercises.map((l, i) => (i === e ? fn(l) : l)) }));
  const lastTs = () => Math.max(draft.start, ...draft.exercises.flatMap((l) => l.sets.map((x) => x.ts)));

  const save = () => {
    const done: Session = { ...draft, exercises: draft.exercises.filter((l) => l.sets.length) };
    if (!done.exercises.length) { setConfirmDel(true); ui.toast("No sets left. Delete the workout instead?"); return; }
    set((st) => ({
      ...st,
      sessions: st.sessions.map((x) => (x.id === session.id ? done : x)),
      // Keep this workout's own feed post in step with the fixed numbers.
      feed: st.feed.map((p) => (p.sessionId === session.id && p.author === "me" ? {
        ...p, sessionName: done.dayName,
        topSets: done.exercises.slice(0, 3).map((l) => { const b = l.sets.reduce((x, y) => (e1rm(y.weight, y.reps) > e1rm(x.weight, x.reps) ? y : x), l.sets[0]); return { name: EX[l.exId].name, weight: b.weight, reps: b.reps, units: u }; }),
      } : p)),
    }));
    ui.toast("Workout updated");
    onClose();
  };
  const remove = () => {
    set((st) => ({ ...st, sessions: st.sessions.filter((x) => x.id !== session.id), feed: st.feed.filter((p) => !(p.sessionId === session.id && p.author === "me")) }));
    ui.toast("Workout deleted");
    onClose();
  };

  const ed = editing ? draft.exercises[editing.e] : null;
  const blank = (l: ExerciseLog): SetLog => {
    const prev = l.sets[l.sets.length - 1];
    return { weight: prev?.weight ?? l.targetWeight, reps: prev?.reps ?? l.plan?.repMin ?? 8, ts: lastTs() + 60_000 };
  };

  return (
    <Sheet title="Edit workout" onClose={onClose} full testId="sheet-edit-workout">
      <div className="text-[13px] muted mb-3">{draft.dayName} · {fmtDate(draft.date, { weekday: "short", month: "short", day: "numeric" })} · {Math.round(sessionVolume(draft)).toLocaleString()} {u}</div>
      <div className="stack" style={{ gap: 12 }}>
        {draft.exercises.map((l, e) => (
          <div key={l.peId + l.exId + e} className="card" style={{ padding: "8px 12px" }} data-testid={`card-edit-exercise-${e}`}>
            <div className="flex items-center justify-between gap-2" style={{ minHeight: 40 }}>
              <span className="font-semibold min0">{EX[l.exId]?.name ?? l.exId}</span>
              <button className="icon-btn" style={{ width: 40, height: 40, border: 0 }} aria-label={`Remove ${EX[l.exId]?.name ?? "exercise"}`} onClick={() => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== e) }))} data-testid={`button-edit-remove-exercise-${e}`}><Trash2 size={15} /></button>
            </div>
            {l.sets.map((st, i) => <SetRow key={i} set={st} n={i + 1} onEdit={() => setEditing({ e, s: i })} testId={`row-edit-set-${e}-${i}`} />)}
            {l.sets.length === 0 && <p className="text-[13px] muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>No sets. Add one, or it's dropped when you save.</p>}
            <button className="btn btn-sm btn-ghost mt-1" style={{ paddingLeft: 0 }} onClick={() => setEditing({ e, s: null })} data-testid={`button-edit-add-set-${e}`}><Plus size={14} /> Add a set</button>
          </div>
        ))}
        <button className="btn btn-outline btn-block" onClick={() => setAdding(true)} data-testid="button-edit-add-exercise"><Plus size={16} /> Add an exercise you forgot</button>
        <button className="btn btn-primary btn-lg btn-block" onClick={save} data-testid="button-save-workout">Save changes</button>
        <button className="btn btn-ghost btn-block" onClick={onClose} data-testid="button-cancel-edit-workout">Cancel</button>
        {confirmDel ? (
          <div className="warn" data-testid="card-confirm-delete-workout"><div className="inner">
            <div className="font-bold">Delete this workout?</div>
            <p className="text-[13px] mt-1">Its sets come out of your history, progress and records. This can't be undone.</p>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)} data-testid="button-delete-workout-cancel">Keep it</button>
              <button className="btn btn-sm btn-warn" onClick={remove} data-testid="button-delete-workout-confirm">Delete workout</button>
            </div>
          </div></div>
        ) : (
          <button className="btn btn-ghost btn-block" style={{ color: "var(--muted)" }} onClick={() => setConfirmDel(true)} data-testid="button-delete-workout"><Trash2 size={15} /> Delete workout</button>
        )}
      </div>

      {editing && ed && (
        <EditSetSheet
          title={`${editing.s == null ? "Add set" : `Set ${editing.s + 1}`} · ${EX[ed.exId]?.name ?? ""}`}
          initial={editing.s == null ? blank(ed) : ed.sets[editing.s]}
          units={u}
          onSave={(x) => updEx(editing.e, (l) => ({ ...l, sets: editing.s == null ? [...l.sets, x] : l.sets.map((y, j) => (j === editing.s ? x : y)) }))}
          onDelete={editing.s == null ? undefined : () => updEx(editing.e, (l) => ({ ...l, sets: l.sets.filter((_, j) => j !== editing.s) }))}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <ExercisePicker title="Add exercise" onClose={() => setAdding(false)} onPick={(exId) => {
          const l = freeLog(state.sessions.filter((x) => x.id !== session.id), exId, null, u, { extra: true });
          setDraft((d) => ({ ...d, exercises: [...d.exercises, l] }));
          setAdding(false);
          setEditing({ e: draft.exercises.length, s: null });
        }} />
      )}
    </Sheet>
  );
}
