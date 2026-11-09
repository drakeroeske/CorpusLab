// Saved workouts: reusable sessions outside the weekly schedule (e.g. "Arm day").
// Made three ways: from a finished workout, from a program day, or from scratch in the editor below.
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { newId } from "@/lib/exercises";
import type { SavedWorkout } from "@/lib/types";
import { Sheet } from "./ui";
import { DayExercises } from "./ProgramEditor";

const uniqueName = (name: string, taken: string[]) => {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} ${n}`)) n++;
  return `${name} ${n}`;
};

/** Ask for a name, then save. `make` builds the workout from the chosen name. */
export function SaveAsWorkoutSheet({ defaultName, make, onClose }: { defaultName: string; make: (name: string) => SavedWorkout; onClose: () => void }) {
  const { state, set } = useStore();
  const ui = useUI();
  const [name, setName] = useState(() => uniqueName(defaultName, (state.savedWorkouts ?? []).map((w) => w.name)));
  const save = () => {
    const w = make(name.trim() || defaultName);
    set((s) => ({ ...s, savedWorkouts: [...(s.savedWorkouts ?? []), w] }));
    ui.toast(`Saved "${w.name}". Start it from "Start a different workout".`);
    onClose();
  };
  return (
    <Sheet title="Save as workout" onClose={onClose} testId="sheet-save-as-workout">
      <p className="text-sm muted mb-3">Start it any time. It won't change your weekly program.</p>
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} autoFocus data-testid="input-saved-name" />
      </label>
      <button className="btn btn-primary btn-lg btn-block mt-4" onClick={save} data-testid="button-confirm-save-workout">Save workout</button>
    </Sheet>
  );
}

/** Create or edit a saved workout with the same exercise editor as program days. */
export function SavedWorkoutEditor({ workout, onClose }: { workout?: SavedWorkout; onClose: () => void }) {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const [draft, setDraft] = useState<SavedWorkout>(() => workout ?? { id: newId("sw"), name: uniqueName("My workout", (state.savedWorkouts ?? []).map((w) => w.name)), exercises: [] });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const empty = draft.exercises.length === 0;

  const save = () => {
    const w = { ...draft, name: draft.name.trim() || "My workout" };
    set((s) => {
      const list = s.savedWorkouts ?? [];
      return { ...s, savedWorkouts: list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [...list, w] };
    });
    ui.toast(workout ? "Workout updated" : `Saved "${w.name}"`);
    onClose();
  };
  const remove = () => {
    set((s) => ({ ...s, savedWorkouts: (s.savedWorkouts ?? []).filter((x) => x.id !== draft.id) }));
    ui.toast(`Deleted "${draft.name}"`);
    onClose();
  };

  return (
    <Sheet title={workout ? "Edit workout" : "New workout"} onClose={onClose} full testId="sheet-saved-workout">
      <label className="field mb-4">
        <span className="label">Name</span>
        <input className="input font-semibold" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="input-saved-workout-name" />
      </label>
      <DayExercises exercises={draft.exercises} units={profile.units} onChange={(x) => setDraft({ ...draft, exercises: x })} addTestId="button-saved-add-exercise" />
      <button className="btn btn-primary btn-lg btn-block mt-5" disabled={empty} onClick={save} data-testid="button-save-saved-workout">{empty ? "Add an exercise to save" : "Save workout"}</button>
      {workout && (
        <div className="mt-5">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">Delete "{workout.name}"? Past workouts keep their history.</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)} data-testid="button-saved-delete-cancel">Keep</button>
              <button className="btn btn-sm btn-warn" onClick={remove} data-testid="button-saved-delete-confirm">Delete</button>
            </div>
          ) : (
            <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setConfirmDelete(true)} data-testid="button-saved-delete">Delete workout</button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Train → Program: the list of saved workouts. */
export function SavedWorkoutsCard() {
  const { state } = useStore();
  const [editing, setEditing] = useState<SavedWorkout | "new" | null>(null);
  const list = state.savedWorkouts ?? [];
  return (
    <div data-testid="card-saved-workouts">
      <div className="section-title"><h2>Saved workouts</h2></div>
      <p className="text-sm muted mb-3">Workouts you can start any time, outside your weekly schedule.</p>
      {list.length > 0 && (
        <div className="card mb-3" style={{ padding: "4px 14px" }}>
          {list.map((w) => (
            <button key={w.id} className="rowline w-full text-left" onClick={() => setEditing(w)} data-testid={`button-edit-saved-${w.id}`}>
              <div className="min0">
                <div className="font-semibold text-[15px]">{w.name}</div>
                <div className="text-xs muted mt-0.5">{w.exercises.length} exercises · {w.exercises.reduce((a, e) => a + e.sets, 0)} sets</div>
              </div>
              <ChevronRight size={16} className="faint shrink-0" />
            </button>
          ))}
        </div>
      )}
      <button className="btn btn-outline btn-block" onClick={() => setEditing("new")} data-testid="button-new-saved-workout"><Plus size={16} /> New saved workout</button>
      {editing && <SavedWorkoutEditor workout={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
