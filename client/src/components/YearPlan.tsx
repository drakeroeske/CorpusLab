// Year plan: lay out future blocks (a program and/or a bulk, cut or other phase) that switch on their own.
import { useEffect, useState } from "react";
import { useUI } from "@/App";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, dateKey, daysBetween, fmtDate } from "@/lib/engine";
import { newId } from "@/lib/exercises";
import { applyDueBlocks, blockCovering, blockEnd, DIET_LABEL, DIET_LONG, nextFreeStart, overlaps, sortedBlocks, upcomingSwitch } from "@/lib/yearPlan";
import type { Goal, PlanBlock } from "@/lib/types";
import { Seg, Sheet, Stepper } from "./ui";

const DIETS: Goal[] = ["muscle", "fatloss", "recomp", "strength"];
// One-ink brand: phases are told apart by fill, not hue. Bulk solid, cut hatched, other phases light, program-only outlined.
const dietFill = (g: Goal | null | undefined) =>
  g === "muscle" ? "var(--ink)"
  : g === "fatloss" ? "repeating-linear-gradient(135deg, var(--ink) 0 3px, transparent 3px 7px)"
  : g ? "color-mix(in srgb, var(--ink) 35%, transparent)"
  : "color-mix(in srgb, var(--ink) 12%, transparent)";
const md = (d: string) => fmtDate(d, { month: "short", day: "numeric" });

/** Next 12 months as a strip, each block placed by its dates. */
function Strip({ blocks, today }: { blocks: PlanBlock[]; today: string }) {
  const span = 365;
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(today + "T12:00:00"); d.setDate(1); d.setMonth(d.getMonth() + i + 1); return dateKey(d); }).filter((_, i) => i % 2 === 0);
  const pct = (d: string) => Math.max(0, Math.min(100, (daysBetween(today, d) / span) * 100));
  return (
    <div className="mt-3" data-testid="strip-year-plan">
      <div style={{ position: "relative", height: 22, border: "1px solid var(--border-strong)", borderRadius: 4, overflow: "hidden" }}>
        {blocks.map((b) => {
          const l = pct(b.start), r = pct(addDays(blockEnd(b), 1));
          if (r <= 0 || l >= 100) return null;
          return <div key={b.id} title={b.name} style={{ position: "absolute", top: 0, bottom: 0, left: `${l}%`, width: `${Math.max(0.8, r - l)}%`, background: dietFill(b.diet), borderRight: "2px solid var(--page)" }} />;
        })}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2, background: "var(--text)" }} />
      </div>
      <div className="mono text-[10px] faint mt-1" style={{ position: "relative", height: 14 }}>
        {months.map((m) => <span key={m} style={{ position: "absolute", left: `${pct(m)}%`, transform: "translateX(-50%)" }}>{fmtDate(m, { month: "short" })}</span>)}
      </div>
      <div className="flex gap-3 text-[10px] muted mt-1" data-testid="legend-year-plan">
        {([["muscle", "Bulk"], ["fatloss", "Cut"], ["recomp", "Other phase"], [null, "Program only"]] as [Goal | null, string][]).map(([g, l]) => (
          <span key={l} className="flex items-center gap-1"><i style={{ width: 12, height: 8, background: dietFill(g), border: "1px solid var(--ink)", display: "inline-block" }} />{l}</span>
        ))}
      </div>
    </div>
  );
}

function BlockSheet({ block, onClose }: { block: PlanBlock; onClose: () => void }) {
  const { state, set } = useStore();
  const [b, setB] = useState<PlanBlock>(block);
  const saved = state.savedPrograms ?? [];
  const exists = (state.yearPlan ?? []).some((x) => x.id === block.id);
  const started = b.start <= dateKey() && !!block.appliedAt;
  const save = () => {
    const clean: PlanBlock = { ...b, name: b.name.trim() || (b.diet ? DIET_LABEL[b.diet] : "Block"), appliedAt: b.start !== block.start ? null : b.appliedAt ?? null };
    set((s) => ({ ...s, yearPlan: exists ? (s.yearPlan ?? []).map((x) => (x.id === b.id ? clean : x)) : [...(s.yearPlan ?? []), clean] }));
    onClose();
  };
  return (
    <Sheet title={exists ? "Edit block" : "Plan a block"} onClose={onClose} testId="sheet-plan-block">
      <label className="field">
        <span className="label">Name</span>
        <input className="input" value={b.name} placeholder="e.g. Winter bulk" onChange={(e) => setB({ ...b, name: e.target.value })} data-testid="input-block-name" />
      </label>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <label className="field min0">
          <span className="label">Starts</span>
          <input type="date" className="input" value={b.start} onChange={(e) => e.target.value && setB({ ...b, start: e.target.value })} data-testid="input-block-start" />
        </label>
        <div className="field min0">
          <span className="label">Weeks</span>
          <Stepper value={b.weeks} onChange={(v) => setB({ ...b, weeks: Math.max(1, Math.min(52, Math.round(v))) })} step={1} min={1} max={52} decimals={0} testId="stepper-block-weeks" />
        </div>
      </div>
      <p className="text-xs muted mt-1" data-testid="text-block-dates">{md(b.start)} → {md(blockEnd(b))}</p>

      <div className="label mt-4 mb-2">Diet phase</div>
      <Seg value={b.diet ?? "keep"} onChange={(v) => setB({ ...b, diet: v === "keep" ? null : (v as Goal) })}
        options={[{ v: "keep", l: "Keep" }, ...DIETS.map((g) => ({ v: g, l: DIET_LABEL[g] }))]} testId="seg-block-diet" />
      <p className="text-xs faint mt-1">{b.diet ? `Switches your nutrition goal to ${DIET_LONG[b.diet].toLowerCase()}. An active bodyweight goal still sets the calories while it runs.` : "Leaves your nutrition goal as it is."}</p>

      <div className="label mt-4 mb-2">Program</div>
      <select className="input" value={b.programId ?? ""} onChange={(e) => setB({ ...b, programId: e.target.value || null })} data-testid="select-block-program">
        <option value="">Keep what I'm running</option>
        {saved.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
      </select>
      <p className="text-xs faint mt-1">{saved.length ? "Programs come from My programs. Build one for later there. The program you're leaving is saved to My programs when it switches." : "Save or build programs in My programs to schedule them here."}</p>
      {started && <p className="note mt-3">This block already started. Changes apply to the plan; the switch won't run again unless you move the start date.</p>}

      <button className="btn btn-primary btn-block mt-4" onClick={save} data-testid="button-save-block">{exists ? "Save" : "Add to plan"}</button>
      {exists && <button className="btn btn-ghost btn-block mt-1" onClick={() => { set((s) => ({ ...s, yearPlan: (s.yearPlan ?? []).filter((x) => x.id !== b.id) })); onClose(); }} data-testid="button-delete-block"><Trash2 size={14} /> Remove block</button>}
    </Sheet>
  );
}

export function YearPlanCard() {
  const { state } = useStore();
  const today = dateKey();
  const [edit, setEdit] = useState<PlanBlock | null>(null);
  const blocks = sortedBlocks(state.yearPlan);
  const visible = blocks.filter((b) => blockEnd(b) >= addDays(today, -30));
  const now = blockCovering(state.yearPlan, today);
  const clash = overlaps(state.yearPlan);
  const progName = (id?: string | null) => (id ? (state.savedPrograms ?? []).find((x) => x.id === id)?.name ?? "missing program" : null);
  const add = () => setEdit({ id: newId("blk"), name: "", start: nextFreeStart(state.yearPlan, today), weeks: 8, programId: null, diet: null });
  return (
    <div className="card mt-3" data-testid="card-year-plan">
      <div className="flex items-start justify-between gap-2">
        <div><div className="label flex items-center gap-1"><CalendarRange size={13} /> Year plan</div>
          <p className="text-xs mt-1">Schedule bulks, cuts and programs ahead. Each block switches on its start date, with a heads-up the day before.</p></div>
      </div>
      {blocks.length > 0 && <Strip blocks={blocks} today={today} />}
      {visible.length > 0 && (
        <div className="mt-2">
          {visible.map((b) => {
            const live = now?.id === b.id, past = blockEnd(b) < today;
            return (
              <button key={b.id} className="w-full text-left flex items-center gap-3" style={{ minHeight: 52, borderTop: "1px solid var(--line)", opacity: past ? 0.55 : 1 }} onClick={() => setEdit(b)} data-testid={`row-block-${b.id}`}>
                <span style={{ width: 8, alignSelf: "stretch", margin: "8px 0", background: dietFill(b.diet), border: "1px solid var(--ink)" }} />
                <div className="min0 flex-1">
                  <div className="font-semibold text-sm truncate">{b.name}{live && <span className="label lime"> · now</span>}{clash.has(b.id) && <span className="label orange"> · overlaps</span>}</div>
                  <div className="mono text-[11px] muted truncate">{md(b.start)} – {md(blockEnd(b))} · {b.weeks} wk{[b.diet && DIET_LABEL[b.diet], progName(b.programId)].filter(Boolean).map((x) => ` · ${x}`).join("")}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button className="btn btn-sm btn-block mt-3" onClick={add} data-testid="button-add-block"><Plus size={14} /> Plan a block</button>
      {edit && <BlockSheet block={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Applies year-plan blocks when their start date arrives (checked on open and every few minutes). */
export function YearPlanWatcher() {
  const { state, set } = useStore();
  const ui = useUI();
  const [today, setToday] = useState(dateKey());
  useEffect(() => { const id = setInterval(() => setToday(dateKey()), 5 * 60_000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!state.yearPlan?.some((b) => !b.appliedAt && b.start <= today)) return;
    let msg = "";
    set((s) => {
      const r = applyDueBlocks(s, today);
      if (r.switched) msg = `${r.switched.block.name} started${r.switched.program ? ` · now on ${r.switched.program}` : ""}${r.switched.diet ? ` · ${DIET_LABEL[r.switched.diet].toLowerCase()} targets` : ""}`;
      return r.state;
    });
    setTimeout(() => msg && ui.toast(msg), 0);
  }, [today, state.yearPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Today: the heads-up the day before a block, or the block you're in. */
export function YearPlanNote() {
  const { state } = useStore();
  const today = dateKey();
  const up = upcomingSwitch(state, today);
  const now = blockCovering(state.yearPlan, today);
  if (up) return <p className="note" data-testid="text-plan-headsup">{up.text}</p>;
  if (!now) return null;
  const left = daysBetween(today, blockEnd(now));
  return <p className="text-xs muted" data-testid="text-plan-now">{now.name} · week {Math.floor(daysBetween(now.start, today) / 7) + 1} of {now.weeks}{left <= 6 ? ` · ends ${left === 0 ? "today" : `in ${left} day${left === 1 ? "" : "s"}`}` : ""}</p>;
}
