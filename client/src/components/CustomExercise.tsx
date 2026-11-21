// Create or edit one of the user's own exercises: name, main / secondary / stabilizer muscles, equipment, compound vs isolation (+ movement pattern), notes.
import { useState } from "react";
import type { Equipment, Exercise, Muscle } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { EQUIPMENT_LABEL, EQUIPMENT_LIST, MUSCLE_GROUPS, MUSCLE_LABEL, PATTERN_LABEL, SMALL_MUSCLES, allExercises, guessPattern, newId, registerCustomExercises } from "@/lib/exercises";
import { Seg, Sheet } from "./ui";

const EQUIPMENT: { v: Equipment; l: string }[] = EQUIPMENT_LIST.map((v) => ({ v, l: EQUIPMENT_LABEL[v] }));
type Tier = "primary" | "secondary" | "stabilizer";
const TIERS: { v: Tier; l: string; help: string }[] = [
  { v: "primary", l: "Main", help: "Main: the muscles doing the lift. Each set counts as 1 set." },
  { v: "secondary", l: "Secondary", help: "Secondary: muscles that assist. Each set counts as half a set." },
  { v: "stabilizer", l: "Stabilizer", help: "Stabilizer: muscles holding you steady without moving, like abs and lower back in a squat. Each set counts as a quarter set." },
];
const TIER_NAME: Record<Tier, string> = { primary: "main", secondary: "secondary", stabilizer: "stabilizer" };
const COMPOUND_PATTERNS = (Object.keys(PATTERN_LABEL) as Exercise["pattern"][]).filter((p) => p !== "isolation" && p !== "hold");

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
  const [stabilizers, setStabilizers] = useState<Muscle[]>(exercise?.stabilizers ?? []);
  const [tier, setTier] = useState<Tier>("primary");
  const [equipment, setEquipment] = useState<Equipment | null>(exercise?.equipment ?? null);
  const [notes, setNotes] = useState(exercise?.notes ?? "");
  // Compound vs isolation follows the muscles until the user picks; the finer movement pattern sits under Advanced.
  // Timed exercises (carries, planks, hangs) log weight × seconds instead of reps.
  const [measure, setMeasure] = useState<"reps" | "time">(exercise?.measure === "time" ? "time" : "reps");
  const [kind, setKind] = useState<"compound" | "isolation" | null>(exercise ? (exercise.pattern === "isolation" ? "isolation" : "compound") : null);
  const [pattern, setPattern] = useState<Exercise["pattern"] | null>(exercise && exercise.pattern !== "isolation" && exercise.pattern !== "hold" ? exercise.pattern : null);
  const [advanced, setAdvanced] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const trimmed = name.trim();
  const clash = allExercises().find((e) => e.id !== exercise?.id && e.name.toLowerCase() === trimmed.toLowerCase());
  const missing = !trimmed ? "Give it a name." : !primary.length ? "Pick at least one main muscle." : !equipment ? "Pick the equipment." : clash ? `"${clash.name}" already exists.` : null;
  const guessed = guessPattern(primary);
  const effKind = kind ?? (guessed === "isolation" ? "isolation" : "compound");
  const guessedCompound = guessed === "isolation" ? guessPattern(primary.filter((m) => !SMALL_MUSCLES.includes(m))) : guessed;
  const effPattern: Exercise["pattern"] = measure === "time" ? "hold" : effKind === "isolation" ? "isolation" : (pattern ?? (guessedCompound === "isolation" ? "horizontal_push" : guessedCompound));
  const uses = exercise ? customExerciseUses(state, exercise.id) : [];

  // A muscle sits in exactly one level, so it never counts twice. Tapping it in another level moves it there.
  const tierList = (t: Tier) => (t === "primary" ? primary : t === "secondary" ? secondary : stabilizers);
  const tierOf = (m: Muscle): Tier | null => (primary.includes(m) ? "primary" : secondary.includes(m) ? "secondary" : stabilizers.includes(m) ? "stabilizer" : null);
  const tap = (m: Muscle) => {
    const was = tierOf(m);
    const without = (p: Muscle[]) => p.filter((x) => x !== m);
    setPrimary(without); setSecondary(without); setStabilizers(without);
    if (was === tier) return;
    (tier === "primary" ? setPrimary : tier === "secondary" ? setSecondary : setStabilizers)((p) => [...without(p), m]);
  };

  const save = () => {
    setTried(true);
    if (missing || !equipment) return;
    const ex: Exercise = {
      id: exercise?.id ?? newId("cx"), name: trimmed, primary, secondary, ...(stabilizers.length ? { stabilizers } : {}), equipment, pattern: effPattern, ...(measure === "time" ? { measure: "time" as const } : {}),
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

      <div className="label mt-5 mb-2">Muscles worked</div>
      <p className="text-xs muted mb-2">Pick a level, then tap every muscle it applies to. Tap again to remove. Add as many as the movement uses.</p>
      <Seg value={tier} onChange={setTier} options={TIERS.map((t) => ({ v: t.v, l: `${t.l} · ${tierList(t.v).length}` }))} testId="seg-muscle-tier" />
      <p className="text-xs faint mt-2 mb-1">{TIERS.find((t) => t.v === tier)!.help}</p>
      {MUSCLE_GROUPS.map((g) => (
        <div key={g.id} className="mt-3">
          <div className="label mb-1">{g.label}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${g.label} muscles`}>
            {g.muscles.map((m) => {
              const at = tierOf(m);
              return (
                <button key={m} type="button" className={`chip chip-pick ${at === "secondary" ? "alt" : at === "stabilizer" ? "stab" : ""}`} aria-pressed={!!at}
                  aria-label={`${MUSCLE_LABEL[m]}${at ? `: ${TIER_NAME[at]}` : ""}`} onClick={() => tap(m)} data-testid={`chip-muscle-${m}`}>
                  {MUSCLE_LABEL[m]}{at && at !== "primary" ? <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75 }}>{at === "secondary" ? "2nd" : "stab"}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="label mt-5 mb-2">Equipment</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment">
        {EQUIPMENT.map((o) => (
          <button key={o.v} type="button" className="chip chip-pick" aria-pressed={equipment === o.v} onClick={() => setEquipment(o.v)} data-testid={`chip-equipment-${o.v}`}>{o.l}</button>
        ))}
      </div>

      <div className="label mt-5 mb-2">Logged as</div>
      <Seg value={measure} onChange={(v) => setMeasure(v)} options={[{ v: "reps", l: "Weight × reps" }, { v: "time", l: "Weight × time" }]} testId="seg-custom-measure" />
      <p className="text-xs faint mt-2">{measure === "time" ? "For carries, holds and hangs: log the weight and how many seconds you lasted." : "The usual: weight and how many reps."}</p>

      {measure === "reps" && (<>
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
      </>)}

      <label className="field mt-5">
        <span className="label">Notes <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
        <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Setup, cues, which machine at your gym" maxLength={300} data-testid="textarea-custom-notes" />
      </label>

      <div className="card-flat mt-5" data-testid="text-custom-summary">
        <div className="label mb-1">Summary</div>
        <p className="text-sm">
          <b>{trimmed || "Unnamed exercise"}</b> · {primary.length ? primary.map((m) => MUSCLE_LABEL[m]).join(", ") : "no main muscle yet"}
          {secondary.length ? <span className="muted"> · also {secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span> : null}
          {stabilizers.length ? <span className="muted"> · stabilizes with {stabilizers.map((m) => MUSCLE_LABEL[m]).join(", ")}</span> : null}
          {equipment ? ` · ${EQUIPMENT_LABEL[equipment]}` : ""} · {measure === "time" ? "Weight × time" : effKind === "compound" ? `Compound (${PATTERN_LABEL[effPattern]})` : "Isolation"}
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
