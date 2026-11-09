// "Start a different workout": an empty (freestyle) workout, a saved workout, or any day of the program.
import { ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { newFreeSession, newSession, sessionFromSaved, useToday } from "@/lib/derived";
import type { Session } from "@/lib/types";
import { Sheet } from "./ui";

export function StartWorkoutSheet({ onClose }: { onClose: () => void }) {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const t = useToday();
  const days = state.program?.days ?? [];
  const saved = state.savedWorkouts ?? [];

  const begin = (make: () => Session) => {
    set((s) => (s.activeSession ? s : { ...s, activeSession: make() }));
    onClose();
    ui.setSub("train", "session");
    ui.setTab("train");
  };

  return (
    <Sheet title="Start a workout" onClose={onClose} testId="sheet-start-workout">
      <button className="card w-full text-left flex items-center gap-3" onClick={() => begin(() => newFreeSession())} data-testid="button-start-empty">
        <Plus size={18} className="shrink-0" />
        <div className="min0 flex-1">
          <div className="font-semibold">Empty workout</div>
          <div className="text-[13px] muted">Add exercises as you go. Weights come from your last time.</div>
        </div>
        <ChevronRight size={16} className="faint shrink-0" />
      </button>

      {saved.length > 0 && (
        <>
          <div className="label mt-5 mb-2">Saved workouts</div>
          {saved.map((w) => (
            <button key={w.id} className="rowline w-full text-left" onClick={() => begin(() => sessionFromSaved(state, w, t.readiness.score, t.inDeload, profile.units))} data-testid={`button-start-saved-${w.id}`}>
              <div className="min0">
                <div className="font-semibold text-[15px]">{w.name}</div>
                <div className="text-xs muted mt-0.5">{w.exercises.length} exercises</div>
              </div>
              <ChevronRight size={16} className="faint shrink-0" />
            </button>
          ))}
        </>
      )}

      {days.length > 0 && (
        <>
          <div className="label mt-5 mb-2">From your program</div>
          {days.map((d) => (
            <button key={d.id} className="rowline w-full text-left" onClick={() => begin(() => newSession(state, d, t.readiness.score, t.inDeload, profile.units))} data-testid={`button-start-day-${d.id}`}>
              <div className="min0">
                <div className="font-semibold text-[15px]">{d.name}{t.day?.id === d.id && <span className="chip ml-2">Today</span>}</div>
                <div className="text-xs muted mt-0.5">{d.exercises.length ? `${d.exercises.length} exercises` : "No exercises yet"}</div>
              </div>
              <ChevronRight size={16} className="faint shrink-0" />
            </button>
          ))}
        </>
      )}
    </Sheet>
  );
}
