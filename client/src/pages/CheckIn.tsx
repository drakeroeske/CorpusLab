import { useState } from "react";
import { Watch } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { CheckIn, Muscle } from "@/lib/types";
import { dateKey, experimentPhase, hrvBaseline, mean } from "@/lib/engine";
import { MUSCLE_LABEL } from "@/lib/exercises";
import { Seg, Sheet, Stepper } from "@/components/ui";
import { BodyMap, FatigueLegend } from "@/components/BodyMap";

const FIVE = [1, 2, 3, 4, 5].map((v) => ({ v, l: String(v) }));

export function CheckInSheet({ onClose }: { onClose: () => void }) {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const today = dateKey();
  const existing = state.checkins.find((c) => c.date === today);
  const lastBW = [...state.checkins].reverse().find((c) => c.bodyWeight != null)?.bodyWeight ?? profile.bodyWeight;
  const [c, setC] = useState<CheckIn>(existing ?? { date: today, bodyWeight: lastBW, sleepH: 7.5, sleepQ: 3, hrv: null, rhr: null, energy: 3, stress: 3, soreness: {}, steps: null, notes: "", experimentDone: null });
  const [view, setView] = useState<"front" | "back">("front");
  const [synced, setSynced] = useState(false);
  const upd = (x: Partial<CheckIn>) => setC((o) => ({ ...o, ...x }));
  const exp = state.experiments.find((e) => e.status === "active");
  const expPh = exp ? experimentPhase(exp, today) : null;

  const sync = () => {
    // simulated wearable values around personal baselines
    const base = hrvBaseline(state.checkins, today) ?? 58;
    const rhrs = state.checkins.slice(-7).map((x) => x.rhr).filter((x): x is number => x != null);
    const rhrBase = rhrs.length ? mean(rhrs) : 56;
    const sleepH = Math.round((6.2 + Math.random() * 2.2) * 4) / 4;
    upd({
      sleepH,
      hrv: Math.round(base * (0.86 + Math.random() * 0.24) + (sleepH - 7) * 2),
      rhr: Math.round(rhrBase + (Math.random() * 4 - 2) - (sleepH - 7)),
      steps: Math.round(5500 + Math.random() * 6500),
      sleepQ: sleepH >= 7.75 ? 4 : sleepH >= 6.75 ? 3 : 2,
    });
    setSynced(true);
  };

  const tapMuscle = (m: Muscle) => {
    const cur = c.soreness[m] ?? 0;
    const next = cur >= 5 ? 0 : cur + 1;
    const soreness = { ...c.soreness };
    if (next === 0) delete soreness[m]; else soreness[m] = next;
    upd({ soreness });
  };
  const soreVals = Object.fromEntries(Object.entries(c.soreness).map(([k, v]) => [k, (v ?? 0) * 20]));
  const sore = Object.entries(c.soreness).filter(([, v]) => (v ?? 0) > 0) as [Muscle, number][];

  const save = () => {
    set((s) => {
      const checkins = s.checkins.filter((x) => x.date !== today).concat([c]).sort((a, b) => (a.date < b.date ? -1 : 1));
      let experiments = s.experiments;
      if (exp && expPh?.phase === "experiment" && c.experimentDone != null) experiments = s.experiments.map((e) => (e.id === exp.id ? { ...e, log: { ...e.log, [today]: !!c.experimentDone } } : e));
      return { ...s, checkins, experiments, profile: s.profile && c.bodyWeight ? { ...s.profile, bodyWeight: c.bodyWeight } : s.profile };
    });
    ui.toast("Check-in saved · readiness updated");
    onClose();
  };

  return (
    <Sheet title="Check in" onClose={onClose} testId="sheet-checkin" right={<button className="btn btn-sm btn-outline" onClick={sync} data-testid="button-sync-watch"><Watch size={15} /> {synced ? "Synced" : "Sync from watch"}</button>}>
      {synced && <p className="text-xs blue mb-3 mono">Simulated sync · sleep, HRV, resting HR, steps filled. Health integrations coming later.</p>}
      <div className="stack">
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><span className="label">Body weight</span><Stepper value={c.bodyWeight ?? lastBW} step={profile.units === "lb" ? 0.2 : 0.1} unit={profile.units} onChange={(v) => upd({ bodyWeight: v })} testId="stepper-bodyweight" /></div>
          <div className="field"><span className="label">Sleep</span><Stepper value={c.sleepH ?? 7} step={0.25} max={14} unit="hours" decimals={2} onChange={(v) => upd({ sleepH: v })} testId="stepper-sleep" /></div>
        </div>
        <div className="field"><span className="label">Sleep quality · 1 poor → 5 great</span><Seg className="seg-num" value={c.sleepQ ?? null} onChange={(v) => upd({ sleepQ: v })} options={FIVE} testId="seg-sleepq" /></div>
        <div className="field"><span className="label">Energy · 1 drained → 5 sharp</span><Seg className="seg-num" value={c.energy ?? null} onChange={(v) => upd({ energy: v })} options={FIVE} testId="seg-energy" /></div>
        <div className="field"><span className="label">Stress · 1 calm → 5 high</span><Seg className="seg-num" value={c.stress ?? null} onChange={(v) => upd({ stress: v })} options={FIVE} testId="seg-stress" /></div>
        <div className="grid grid-cols-3 gap-2">
          <label className="field min0"><span className="label">HRV ms</span><input className="input mono" inputMode="numeric" placeholder="opt." value={c.hrv ?? ""} onChange={(e) => upd({ hrv: e.target.value ? parseInt(e.target.value) : null })} data-testid="input-hrv" /></label>
          <label className="field min0"><span className="label">Rest HR</span><input className="input mono" inputMode="numeric" placeholder="opt." value={c.rhr ?? ""} onChange={(e) => upd({ rhr: e.target.value ? parseInt(e.target.value) : null })} data-testid="input-rhr" /></label>
          <label className="field min0"><span className="label">Steps</span><input className="input mono" inputMode="numeric" placeholder="opt." value={c.steps ?? ""} onChange={(e) => upd({ steps: e.target.value ? parseInt(e.target.value) : null })} data-testid="input-steps" /></label>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="label">Soreness · tap to cycle</span>
            <Seg value={view} onChange={setView} options={[{ v: "front", l: "Front" }, { v: "back", l: "Back" }]} className="w-[140px]" testId="seg-soreness-view" />
          </div>
          <BodyMap values={soreVals} view={view} onTap={tapMuscle} height={240} testId="bodymap-soreness" />
          <div className="mt-2"><FatigueLegend left="None" right="Severe" /></div>
          <div className="flex flex-wrap gap-1.5 mt-2 min-h-[24px]">
            {sore.length ? sore.map(([m, v]) => <button key={m} className={`chip ${v >= 4 ? "chip-orange" : ""}`} onClick={() => { const soreness = { ...c.soreness }; delete soreness[m]; upd({ soreness }); }}>{MUSCLE_LABEL[m]} {v}</button>) : <span className="text-xs faint">No soreness logged</span>}
          </div>
        </div>
        {exp && expPh?.phase === "experiment" && (
          <div className="field"><span className="label">Experiment · {exp.question}</span>
            <Seg value={c.experimentDone == null ? null : c.experimentDone ? "y" : "n"} onChange={(v) => upd({ experimentDone: v === "y" })} options={[{ v: "y", l: "Yes" }, { v: "n", l: "No" }]} testId="seg-experiment" />
          </div>
        )}
        <label className="field"><span className="label">Notes</span><input className="input" value={c.notes ?? ""} onChange={(e) => upd({ notes: e.target.value })} placeholder="Anything unusual?" data-testid="input-notes" /></label>
        <button className="btn btn-primary btn-lg btn-block" onClick={save} data-testid="button-save-checkin">Save check-in</button>
      </div>
    </Sheet>
  );
}
