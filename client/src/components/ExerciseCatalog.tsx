// Every exercise (built-in and your own), searchable and grouped by target muscle, equipment, or compound vs isolation.
// Used inline on Train → Exercises and inside the picker when adding an exercise to a program or workout.
import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import type { Equipment, Exercise, Muscle } from "@/lib/types";
import { EQUIPMENT_LABEL, EQUIPMENT_LIST, EXERCISES, MUSCLE_LABEL, MUSCLES, PATTERN_LABEL, customExercises, isCompound } from "@/lib/exercises";
import { e1rmSeries, fmtDate } from "@/lib/engine";
import { lastTopSet } from "@/lib/derived";
import { useStore } from "@/lib/store";
import { CustomExerciseSheet } from "./CustomExercise";
import { Seg, Sheet } from "./ui";

export type GroupBy = "muscle" | "equipment" | "type";
const STORE_KEY = "corpus.catalog.groupBy";

function ExerciseChips({ e }: { e: Exercise }) {
  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className={`chip ${isCompound(e) ? "chip-blue" : ""}`}>{isCompound(e) ? "Compound" : "Isolation"}</span>
      <span className="label">{EQUIPMENT_LABEL[e.equipment]}{e.custom ? " · custom" : ""}</span>
    </div>
  );
}

export function ExerciseCatalog({ onPick, embedded, initialQuery = "", onCreated }: {
  /** When set, tapping a row picks it (program editor / logger). Otherwise a row opens the exercise's details. */
  onPick?: (id: string) => void;
  /** Inline on a page (no autofocus on the search box). */
  embedded?: boolean;
  initialQuery?: string;
  onCreated?: (id: string) => void;
}) {
  const { state } = useStore(); // also re-renders when custom exercises change
  const [q, setQ] = useState(initialQuery);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => (localStorage.getItem(STORE_KEY) as GroupBy) || "muscle");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const pickGroup = (g: GroupBy) => { setGroupBy(g); setFilter("all"); localStorage.setItem(STORE_KEY, g); };

  const ql = q.trim().toLowerCase();
  const match = (e: Exercise) => ql === "" || e.name.toLowerCase().includes(ql) || e.primary.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(ql)) || EQUIPMENT_LABEL[e.equipment].toLowerCase().includes(ql);
  const mine = customExercises().filter(match);
  const lib = EXERCISES.filter(match);
  const all = [...mine, ...lib];

  // Chips under the Seg narrow the list to one group; "All" shows every group with a heading.
  const chips: { v: string; l: string }[] = groupBy === "muscle" ? MUSCLES.map((m) => ({ v: m, l: MUSCLE_LABEL[m] }))
    : groupBy === "equipment" ? EQUIPMENT_LIST.map((x) => ({ v: x, l: EQUIPMENT_LABEL[x] }))
    : [{ v: "compound", l: "Compound" }, { v: "isolation", l: "Isolation" }];

  const groups = useMemo(() => {
    const out: { id: string; label: string; items: Exercise[] }[] = [];
    const push = (id: string, label: string, items: Exercise[]) => { if (items.length && (filter === "all" || filter === id)) out.push({ id, label, items }); };
    if (groupBy === "muscle") {
      // An exercise appears under each main muscle it trains; secondary muscles only when filtering to that muscle.
      for (const m of MUSCLES) {
        const prim = all.filter((e) => e.primary.includes(m));
        const sec = filter === m ? all.filter((e) => !e.primary.includes(m) && e.secondary.includes(m)) : [];
        push(m, MUSCLE_LABEL[m], [...prim, ...sec]);
      }
    } else if (groupBy === "equipment") {
      for (const x of EQUIPMENT_LIST) push(x, EQUIPMENT_LABEL[x], all.filter((e) => e.equipment === x));
    } else {
      push("compound", "Compound", all.filter(isCompound));
      push("isolation", "Isolation", all.filter((e) => !isCompound(e)));
    }
    return out;
  }, [all.length, ql, groupBy, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) return (
    <CustomExerciseSheet exercise={editing === "new" ? undefined : editing} initialName={editing === "new" ? q.trim() : ""}
      onClose={() => setEditing(null)} onSaved={(id) => { if (editing === "new") { onCreated?.(id); onPick?.(id); } }} />
  );

  const row = (e: Exercise, m?: Muscle) => (
    <div key={e.id} className="flex items-center">
      <button className="rowline w-full text-left min0 flex-1" onClick={() => (onPick ? onPick(e.id) : setDetail(e))} data-testid={`pick-exercise-${e.id}`}>
        <div className="min0">
          <div className="font-semibold text-[15px]">{e.name}</div>
          <div className="text-xs muted mt-0.5">
            {e.primary.map((x) => MUSCLE_LABEL[x]).join(", ")}
            {e.secondary.length ? <span className="faint"> · {e.secondary.map((x) => MUSCLE_LABEL[x]).join(", ")}</span> : null}
            {m && !e.primary.includes(m) ? <span className="faint"> · secondary</span> : null}
          </div>
        </div>
        <ExerciseChips e={e} />
      </button>
      {e.custom && <button className="icon-btn shrink-0 ml-1" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)} data-testid={`button-edit-custom-${e.id}`}><Pencil size={15} /></button>}
    </div>
  );

  return (
    <div data-testid="exercise-catalog">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 faint" />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search name, muscle or equipment" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-exercise-search" autoFocus={!embedded} />
      </div>
      <Seg value={groupBy} onChange={pickGroup} options={[{ v: "muscle", l: "By muscle" }, { v: "equipment", l: "By equipment" }, { v: "type", l: "By type" }]} testId="seg-catalog-group" />
      <div className="scroll-x flex gap-2 mt-3 mb-3">
        <button className="chip chip-pick" aria-pressed={filter === "all"} onClick={() => setFilter("all")} data-testid="filter-all">All</button>
        {chips.map((c) => <button key={c.v} className="chip chip-pick" aria-pressed={filter === c.v} onClick={() => setFilter(filter === c.v ? "all" : c.v)} data-testid={`filter-${groupBy}-${c.v}`}>{c.l}</button>)}
      </div>

      {all.length === 0 && (
        <div className="empty mb-3" data-testid="text-no-exercise-match">
          <p className="text-sm">No exercise matches “{q}”.</p>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => setEditing("new")} data-testid="button-create-from-search"><Plus size={14} /> Create “{q.trim()}”</button>
        </div>
      )}
      {mine.length > 0 && filter === "all" && (
        <div className="mb-4" data-testid="group-your-exercises">
          <div className="label mb-2">Your exercises · {mine.length}</div>
          {mine.map((e) => row(e))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.id} className="mb-4" data-testid={`group-${g.id}`}>
          <div className="label mb-2 flex justify-between"><span>{g.label}</span><span>{g.items.length}</span></div>
          {g.items.map((e) => row(e, groupBy === "muscle" ? (g.id as Muscle) : undefined))}
        </div>
      ))}
      <div className="mt-4 mb-2 text-center">
        <p className="text-xs muted mb-2">{onPick ? "Can't find it?" : "Train something we don't list?"}</p>
        <button className="btn btn-outline btn-block" onClick={() => setEditing("new")} data-testid="button-create-exercise"><Plus size={16} /> Create exercise</button>
      </div>
      {detail && <ExerciseDetail e={detail} onClose={() => setDetail(null)} onEdit={() => { setDetail(null); setEditing(detail); }} sessions={state.sessions} units={state.profile?.units ?? "lb"} />}
    </div>
  );
}

function ExerciseDetail({ e, onClose, onEdit, sessions, units }: { e: Exercise; onClose: () => void; onEdit: () => void; sessions: Parameters<typeof lastTopSet>[0]; units: string }) {
  const last = lastTopSet(sessions, e.id);
  const ser = e1rmSeries(sessions, e.id);
  const times = sessions.filter((s) => s.end && s.exercises.some((l) => l.exId === e.id && l.sets.length)).length;
  const best = ser.length ? Math.max(...ser.map((x) => x.e1rm)) : null;
  return (
    <Sheet title={e.name} onClose={onClose} testId="sheet-exercise-detail" right={e.custom ? <button className="btn btn-sm" onClick={onEdit} data-testid="button-detail-edit"><Pencil size={14} /> Edit</button> : undefined}>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`chip ${isCompound(e) ? "chip-blue" : ""}`}>{isCompound(e) ? "Compound" : "Isolation"}</span>
        <span className="chip">{EQUIPMENT_LABEL[e.equipment]}</span>
        {isCompound(e) && <span className="chip">{PATTERN_LABEL[e.pattern]}</span>}
        {e.custom && <span className="chip chip-signal">Custom</span>}
      </div>
      <div className="rowline"><span className="text-sm muted">Main muscles</span><span className="text-sm text-right">{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</span></div>
      <div className="rowline"><span className="text-sm muted">Also works</span><span className="text-sm text-right">{e.secondary.length ? e.secondary.map((m) => MUSCLE_LABEL[m]).join(", ") : "—"}</span></div>
      {e.notes && <div className="card-flat mt-3"><div className="label mb-1">Notes</div><p className="text-sm" style={{ whiteSpace: "pre-wrap" }} data-testid="text-exercise-notes">{e.notes}</p></div>}
      <div className="section-title"><h2>Your history</h2></div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat"><div className="label">Sessions</div><div className="v">{times}</div><div className="s">logged</div></div>
        <div className="stat"><div className="label">Last top set</div><div className="v" style={{ fontSize: 22, whiteSpace: "nowrap" }}>{last ? `${last.weight} × ${last.reps}` : "—"}</div><div className="s">{last ? fmtDate(last.date) : units}</div></div>
        <div className="stat"><div className="label">Best e1RM</div><div className="v">{best ? Math.round(best) : "—"}</div><div className="s">{units}</div></div>
      </div>
    </Sheet>
  );
}
