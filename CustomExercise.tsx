// Create or edit one of the user's own exercises: name, main muscles, equipment (+ movement pattern under Advanced).
import { useState } from "react";
import type { Equipment, Exercise, Muscle } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { MUSCLES, MUSCLE_LABEL, PATTERN_LABEL, allExercises, guessPattern, newId, registerCustomExercises } from "@/lib/exercises";
import { Sheet } from "./ui";

const EQUIPMENT: { v: Equipment; l: string }[] = [
  { v: "barbell", l: "Barbell" }, { v: "dumbbell", l: "Dumbbell" }, { v: "machine", l: "Machine" }, { v: "cable", l: "Cable" },
  { v: "bodyweight", l: "Bodyweight" }, { v: "smith", l: "Smith machine" }, { v: "kettlebell", l: "Kettlebell" },
];
const PATTERNS = Object.keys(PATTERN_LABEL) as Exercise["pattern"][];

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
  const [equipment, setEquipment] = useState<Equipment | null>(exercise?.equipment ?? null);
  // Pattern follows the muscles until the user picks one under Advanced.
  const [pattern, setPattern] = useState<Exercise["pattern"] | null>(exercise?.pattern ?? null);
  const [advanced, setAdvanced] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const trimmed = name.trim();
  const clash = allExercises().find((e) => e.id !== exercise?.id && e.name.toLowerCase() === trimmed.toLowerCase());
  const missing = !trimmed ? "Give it a name." : !primary.length ? "Pick at least one main muscle." : !equipment ? "Pick the equipment." : clash ? `"${clash.name}" already exists.` : null;
  const effPattern = pattern ?? guessPattern(primary);
  const uses = exercise ? customExerciseUses(state, exercise.id) : [];

  const toggle = (m: Muscle) => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  const save = () => {
    setTried(true);
    if (missing || !equipment) return;
    const ex: Exercise = {
      id: exercise?.id ?? newId("cx"), name: trimmed, primary, secondary: [], equipment, pattern: effPattern,
      ratio: 1, custom: true,
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
          <button key={m} type="button" className={`chip ${primary.includes(m) ? "chip-lime" : ""}`} style={{ height: 34 }} aria-pressed={primary.includes(m)} onClick={() => toggle(m)} data-testid={`chip-muscle-${m}`}>{MUSCLE_LABEL[m]}</button>
        ))}
      </div>
      <p className="text-xs faint mt-2">Used for muscle fatigue and weekly sets.</p>

      <div className="label mt-5 mb-2">Equipment</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment">
        {EQUIPMENT.map((o) => (
          <button key={o.v} type="button" className={`chip ${equipment === o.v ? "chip-lime" : ""}`} style={{ height: 34 }} aria-pressed={equipment === o.v} onClick={() => setEquipment(o.v)} data-testid={`chip-equipment-${o.v}`}>{o.l}</button>
        ))}
      </div>

      <button type="button" className="btn btn-sm btn-ghost mt-4" style={{ paddingLeft: 0 }} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)} data-testid="button-custom-advanced">
        {advanced ? "Hide advanced" : "Advanced"} · {PATTERN_LABEL[effPattern]}
      </button>
      {advanced && (
        <div className="mt-1">
          <p className="text-xs muted mb-2">Movement type. Compound lifts get longer rest. We guessed from the muscles; change it if it's wrong.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Movement type">
            {PATTERNS.map((p) => (
              <button key={p} type="button" className={`chip ${effPattern === p ? "chip-lime" : ""}`} style={{ height: 32 }} aria-pressed={effPattern === p} onClick={() => setPattern(p)} data-testid={`chip-pattern-${p}`}>{PATTERN_LABEL[p]}</button>
            ))}
          </div>
        </div>
      )}

      {tried && missing && <p className="text-sm mt-4" role="alert" style={{ color: "var(--signal)" }} data-testid="text-custom-error">{missing}</p>}
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
