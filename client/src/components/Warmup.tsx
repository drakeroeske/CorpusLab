// The warm-up step before lifting: pick cardio, band/activation work and dynamic stretches (suggested for today's
// muscles), then start lifting or skip. Saved on the session; skipping several in a row earns a reminder.
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Flame } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { Session } from "@/lib/types";
import { MUSCLE_REGION } from "@/lib/exercises";
import { WARMUP, WARMUP_TABS, rankWarmups, sessionMuscleWeights, warmupSkipStreak, warmupSummary, type WarmupKind } from "@/lib/warmups";
import { Seg, Stepper } from "./ui";

const setWarmup = (s: Session, warmup: Session["warmup"]): Session => ({ ...s, warmup });

export function WarmupStep({ session, onClose }: { session: Session; onClose?: () => void }) {
  const { state, set } = useStore();
  const ui = useUI();
  const exIds = session.exercises.map((l) => l.exId);
  const [tab, setTab] = useState<WarmupKind>("cardio");
  const [picked, setPicked] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries((session.warmup?.items ?? []).map((it) => [it.id, it.min])));
  const skipStreak = warmupSkipStreak(state.sessions);
  const ranked = useMemo(() => Object.fromEntries(WARMUP_TABS.map((t) => [t.v, rankWarmups(t.v, exIds)])) as Record<WarmupKind, ReturnType<typeof rankWarmups>>, [exIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Today: legs, hips, back": the body regions this workout leans on most.
  const regions = useMemo(() => {
    const byRegion = new Map<string, number>();
    for (const [m, w] of sessionMuscleWeights(exIds)) byRegion.set(MUSCLE_REGION[m], (byRegion.get(MUSCLE_REGION[m]) ?? 0) + w);
    return [...byRegion].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r.toLowerCase());
  }, [exIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = Object.keys(picked);
  const countIn = (k: WarmupKind) => ids.filter((id) => WARMUP[id]?.kind === k).length;
  const toggle = (id: string) => setPicked((p) => {
    const next = { ...p };
    if (id in next) delete next[id]; else next[id] = WARMUP[id].kind === "cardio" ? WARMUP[id].min : undefined;
    return next;
  });
  const items = ids.map((id) => (picked[id] != null ? { id, min: picked[id] } : { id }));
  const save = (status: "done" | "skipped") => {
    set((s) => (s.activeSession ? { ...s, activeSession: setWarmup(s.activeSession, { status, items: status === "done" ? items : [], ts: Date.now() }) } : s));
    if (status === "done") ui.toast(items.length ? `Warm-up logged: ${warmupSummary(items)}` : "Warm-up noted");
    onClose?.();
  };

  return (
    <div data-testid="view-warmup">
      <div className="card">
        <div className="flex items-center gap-2"><Flame size={18} /><div className="font-semibold text-[17px]">Warm up first</div></div>
        <p className="text-sm muted mt-1">5–10 minutes gets your joints and muscles ready, so your first working sets feel better and are less likely to tweak something.{regions.length ? ` Today leans on your ${regions.join(", ")}.` : ""}</p>
        {skipStreak >= 3 && (
          <div className="warn mt-3" data-testid="card-warmup-skip-streak"><div className="inner flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-[13px]">You've skipped your warm-up the last {skipStreak} workouts. Even 5 minutes on the bike and two band moves is enough.</p>
          </div></div>
        )}
      </div>

      <div className="mt-3">
        <Seg value={tab} onChange={setTab} options={WARMUP_TABS.map((t) => ({ v: t.v, l: countIn(t.v) ? `${t.l} · ${countIn(t.v)}` : t.l }))} testId="seg-warmup-tab" />
      </div>
      <p className="text-xs faint mt-2 mb-2">{tab === "cardio" ? "Pick one and set the minutes. Easy pace: you should be able to talk." : tab === "bands" ? "Light activation for the muscles that steady your lifts. No band? Most of these work with bodyweight." : "Moving stretches through the range you're about to lift. Save long holds for after."}</p>

      <div className="stack" style={{ gap: 8 }} role="list" aria-label={`${WARMUP_TABS.find((t) => t.v === tab)!.l} warm-ups`}>
        {ranked[tab].map(({ w, suggested }) => {
          const on = w.id in picked;
          return (
            <div key={w.id} role="listitem" className="card" style={{ padding: "10px 12px", borderColor: on ? "var(--ink)" : undefined, background: on ? "var(--tint)" : undefined }} data-testid={`row-warmup-${w.id}`}>
              <button className="w-full text-left flex items-start gap-3" onClick={() => toggle(w.id)} aria-pressed={on} data-testid={`button-warmup-${w.id}`}>
                <span className="shrink-0 grid place-items-center mt-0.5" style={{ width: 22, height: 22, border: "1.5px solid var(--ink)", background: on ? "var(--ink)" : "transparent", color: "var(--page)" }}>{on && <Check size={14} />}</span>
                <span className="min0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{w.name}</span>
                    {suggested && <span className="chip chip-blue" style={{ minHeight: 20, fontSize: 10, padding: "0 6px" }}>Suggested</span>}
                  </span>
                  <span className="block mono text-[11px] muted">{w.kind === "cardio" && on ? `${picked[w.id]} min` : w.dose}</span>
                  <span className="block text-xs faint mt-0.5">{w.cue}</span>
                </span>
              </button>
              {on && w.kind === "cardio" && (
                <div className="flex items-center justify-between gap-3 mt-2 pl-[34px]">
                  <span className="text-xs muted">Minutes</span>
                  <Stepper value={picked[w.id] ?? w.min ?? 5} onChange={(v) => setPicked((p) => ({ ...p, [w.id]: Math.min(30, Math.max(1, Math.round(v))) }))} min={1} max={30} decimals={0} unit="min" testId={`stepper-warmup-${w.id}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 stack" style={{ gap: 8 }}>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => save("done")} data-testid="button-warmup-done">
          <Check size={18} /> {items.length ? `Done · start lifting` : "I already warmed up"}
        </button>
        {items.length > 0 && <p className="text-xs muted text-center" data-testid="text-warmup-selection">{warmupSummary(items)}</p>}
        {session.warmup?.status !== "skipped" && <button className="btn btn-ghost btn-block" onClick={() => save("skipped")} data-testid="button-warmup-skip">Skip warm-up</button>}
        {onClose && session.warmup && <button className="btn btn-ghost btn-block" onClick={onClose} data-testid="button-warmup-cancel">Cancel</button>}
      </div>
    </div>
  );
}

/** Slim line at the top of a workout once the warm-up step is behind you: what you did, or that you skipped it. */
export function WarmupChip({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const w = session.warmup;
  return (
    <button className="w-full text-left flex items-center gap-2 mb-3 text-[13px]" onClick={onOpen} data-testid="button-warmup-chip">
      {w?.status === "done"
        ? <><Check size={14} className="shrink-0" /><span className="min0 truncate">Warm-up: {warmupSummary(w.items)}</span><span className="faint shrink-0 ml-auto">Edit</span></>
        : w?.status === "skipped"
          ? <><Flame size={14} className="shrink-0" /><span className="muted">Warm-up skipped</span><span className="underline shrink-0 ml-auto">Log one</span></>
          : <><Flame size={14} className="shrink-0" /><span className="muted">No warm-up logged</span><span className="underline shrink-0 ml-auto">Log warm-up</span></>}
    </button>
  );
}
