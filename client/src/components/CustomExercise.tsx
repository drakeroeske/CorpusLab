// Create or edit one of the user's own exercises: name, main and secondary muscles, equipment, compound vs isolation (+ movement pattern), notes.
import { useState } from "react";
import type { Equipment, Exercise, Muscle } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { EQUIPMENT_LABEL, EQUIPMENT_LIST, MUSCLES, MUSCLE_LABEL, PATTERN_LABEL, allExercises, guessPattern, newId, registerCustomExercises } from "@/lib/exercises";
import { Seg, Sheet } from "./ui";

const EQUIPMENT: { v: Equipment; l: string }[] = EQUIPMENT_LIST.map((v) => ({ v, l: EQUIPMENT_LABEL[v] }));
const COMPOUND_PATTERNS = (Object.keys(PATTERN_LABEL) as Exercise["pattern"][]).filter((p) => p !== "isolation");

/** Where a custom exercise is still in use (blocks deleting). */
export function customExerciseUses(state: ReturnType<typeof useStore>["state"], id: string): string[] {
  const uses: string[] = [];
  for (const d of state.program?.days ?? []) if (d.exercises.some((e) => e.exId === id)) uses.push(d.name);
  for (const w of state.savedWorkouts ?? []) if (w.exercises.some((e) => e.exId === id)) uses.push(w.name);
  return uses;
}

export function CustomExerciseSheet({ exercise, initialName = "", onClose, onSaved }: {
  /** Existing custom exercise to edit; omit to create a new one. */
  exercise?: Exercise;
  initialName?: string;
  onClose: () => void;
  /** Called with the saved exercise's id (new or edited). */
  onSaved?: (id: string) => void;
}) {
  const { state, set } = useStore();
  const ui = useUI();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [primary, setPrimary] = useState<Muscle[]>(exercise?.primary ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(exercise?.secondary ?? []);
  const [equipment, setEquipment] = useState<Equipment | null>(exercise?.equipment ?? null);
  const [notes, setNotes] = useState(exercise?.notes ?? "");
  // Compound vs isolation follows the muscles until the user picks; the finer movement pattern sits under Advanced.
  const [kind, setKind] = useState<"compound" | "isolation" | null>(exercise ? (exercise.pattern === "isolation" ? "isolation" : "compound") : null);
  const [pattern, setPattern] = useState<Exercise["pattern"] | null>(exercise && exercise.pattern !== "isolation" ? exercise.pattern : null);
  const [advanced, setAdvanced] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const trimmed = name.trim();
  const clash = allExercises().find((e) => e.id !== exercise?.id && e.name.toLowerCase() === trimmed.toLowerCase());
  const missing = !trimmed ? "Give it a name." : !primary.length ? "Pick at least one main muscle." : !equipment ? "Pick the equipment." : clash ? `"${clash.name}" already exists.` : null;
  const guessed = guessPattern(primary);
  const effKind = kind ?? (guessed === "isolation" ? "isolation" : "compound");
  const guessedCompound = guessed === "isolation" ? guessPattern(primary.filter((m) => !["biceps", "triceps", "forearms", "calves", "abs", "rear_delts"].includes(m))) : guessed;
  const effPattern: Exercise["pattern"] = effKind === "isolation" ? "isolation" : (pattern ?? (guessedCompound === "isolation" ? "horizontal_push" : guessedCompound));
  const uses = exercise ? customExerciseUses(state, exercise.id) : [];

  // Picking a main muscle also clears it from "Also works" so one muscle never counts twice.
  const toggle = (m: Muscle) => { setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m])); setSecondary((p) => p.filter((x) => x !== m)); };
  const toggleSec = (m: Muscle) => setSecondary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  const save = () => {
    setTried(true);
    if (missing || !equipment) return;
    const ex: Exercise = {
      id: exercise?.id ?? newId("cx"), name: trimmed, primary, secondary, equipment, pattern: effPattern,
      ratio: 1, custom: true, ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const prev = state.customExercises ?? [];
    const list = exercise ? prev.map((e) => (e.id === ex.id ? ex : e)) : [...prev, ex];
    // Register now so onSaved can add it to a program in the same tick (the store re-registers on its next render).
    registerCustomExercises(list);
    set((s) => ({ ...s, customExercises: list }));
    ui.toast(exercise ? "Exercise updated" : `Added ${ex.name}`);
    onSaved?.(ex.id);
    onClose();
  };

  const remove = () => {
    if (!exercise || uses.length) return;
    // Archived, not erased: past workouts still show its name.
    set((s) => ({ ...s, customExercises: (s.customExercises ?? []).map((e) => (e.id === exercise.id ? { ...e, archived: true } : e)) }));
    ui.toast(`Deleted ${exercise.name}`);
    onClose();
  };

  return (
    <Sheet title={exercise ? "Edit exercise" : "New exercise"} onClose={onClose} full testId="sheet-custom-exercise">
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" maxLength={60} autoFocus data-testid="input-custom-name" />
      </label>

      <div className="label mt-5 mb-2">Main muscles</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Main muscles">
        {MUSCLES.map((m) => (
          <button key={m} type="button" className="chip chip-pick" aria-pressed={primary.includes(m)} onClick={() => toggle(m)} data-testid={`chip-muscle-${m}`}>{MUSCLE_LABEL[m]}</button>
        ))}
      </div>
      <p className="text-xs faint mt-2">Used for muscle fatigue and weekly sets.</p>

      <div className="label mt-5 mb-2">Also works <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Secondary muscles">
        {MUSCLES.map((m) => (
          <button key={m} type="button" className="chip chip-pick alt" disabled={primary.includes(m)} title={primary.includes(m) ? "Already a main muscle" : undefined} aria-pressed={secondary.includes(m)} onClick={() => toggleSec(m)} data-testid={`chip-secondary-${m}`}>{MUSCLE_LABEL[m]}</button>
        ))}
      </div>
      <p className="text-xs faint mt-2">Secondary muscles count as half a set for fatigue.</p>

      <div className="label mt-5 mb-2">Equipment</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment">
        {EQUIPMENT.map((o) => (
          <button key={o.v} type="button" className="chip chip-pick" aria-pressed={equipment === o.v} onClick={() => setEquipment(o.v)} data-testid={`chip-equipment-${o.v}`}>{o.l}</button>
        ))}
      </div>

      <div className="label mt-5 mb-2">Type</div>
      <Seg value={effKind} onChange={(v) => setKind(v)} options={[{ v: "compound", l: "Compound" }, { v: "isolation", l: "Isolation" }]} testId="seg-custom-kind" />
      <p className="text-xs faint mt-2">{effKind === "compound" ? "Several joints move together, like a press, row or squat. Gets longer rest." : "One joint, one muscle doing most of the work, like a curl or fly."}{kind === null ? " We guessed from the muscles." : ""}</p>

      {effKind === "compound" && (
        <>
          <button type="button" className="btn btn-sm btn-ghost mt-3" style={{ paddingLeft: 0 }} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)} data-testid="button-custom-advanced">
            {advanced ? "Hide advanced" : "Advanced"} · {PATTERN_LABEL[effPattern]}
          </button>
          {advanced && (
            <div className="mt-1">
              <p className="text-xs muted mb-2">Movement pattern, used to suggest swaps and convert weights. Change it if our guess is wrong.</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Movement pattern">
                {COMPOUND_PATTERNS.map((p) => (
                  <button key={p} type="button" className="chip chip-pick" aria-pressed={effPattern === p} onClick={() => setPattern(p)} data-testid={`chip-pattern-${p}`}>{PATTERN_LABEL[p]}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <label className="field mt-5">
        <span className="label">Notes <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
        <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Setup, cues, which machine at your gym" maxLength={300} data-testid="textarea-custom-notes" />
      </label>

      <div className="card-flat mt-5" data-testid="text-custom-summary">
        <div className="label mb-1">Summary</div>
        <p className="text-sm">
          <b>{trimmed || "Unnamed exercise"}</b> · {primary.length ? primary.map((m) => MUSCLE_LABEL[m]).join(", ") : "no main muscle yet"}
          {secondary.length ? <span className="muted"> · also {secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span> : null}
          {equipment ? ` · ${EQUIPMENT_LABEL[equipment]}` : ""} · {effKind === "compound" ? `Compound (${PATTERN_LABEL[effPattern]})` : "Isolation"}
        </p>
      </div>
      {tried && missing && <p className="text-sm mt-4" role="alert" style={{ color: "var(--ink-deep)" }} data-testid="text-custom-error">{missing}</p>}
      <button className="btn btn-primary btn-block btn-lg mt-5" onClick={save} data-testid="button-save-custom">{exercise ? "Save changes" : "Create exercise"}</button>

      {exercise && (
        <div className="mt-6">
          {uses.length ? (
            <p className="text-xs muted" data-testid="text-custom-in-use">To delete it, remove it from {uses.join(", ")} first.</p>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">Delete {exercise.name}? Past workouts keep it.</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)} data-testid="button-custom-delete-cancel">Keep</button>
              <button className="btn btn-sm btn-warn" onClick={remove} data-testid="button-custom-delete-confirm">Delete</button>
            </div>
          ) : (
            <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setConfirmDelete(true)} data-testid="button-custom-delete">Delete exercise</button>
          )}
        </div>
      )}
    </Sheet>
  );
}
