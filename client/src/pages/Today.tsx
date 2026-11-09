import { InstallBanner } from "@/components/Install";
import { NotifNudge, useNotifNudgeVisible } from "@/components/Notifications";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { newSession, prescriptionsFor, sessionSummary, useToday } from "@/lib/derived";
import { StartWorkoutSheet } from "@/components/StartWorkout";
import { addDays, experimentPhase, fmtDate, fmtW, proteinByDate, caloriesByDate } from "@/lib/engine";
import { EX, MUSCLE_LABEL, newId } from "@/lib/exercises";
import { Bar } from "@/components/ui";
import { EngineHeader, Rings, Tag } from "@/components/riso";
import { Info, Term } from "@/components/Term";
import { InboxButton } from "@/components/Inbox";
import type { Meal } from "@/lib/types";

export function readinessColor(score: number | null) {
  if (score == null) return "var(--muted)";
  return score >= 75 ? "var(--lime)" : score >= 50 ? "var(--blue)" : "var(--orange)";
}

export function logFavorite(fav: { name: string; cal: number; p: number; c: number; f: number; items?: Meal["items"] }, date: string): Meal {
  return { id: newId("meal"), date, time: Date.now(), name: fav.name, cal: fav.cal, p: fav.p, c: fav.c, f: fav.f, ...(fav.items ? { items: fav.items } : {}) };
}

const EFFECT_HEADLINE = { normal: "Good to progress today", hold: "Hold your weights today", reduce: "Go lighter today: targets −10%" } as const;
/** Rough session length: ~2.5 min per working set plus a 5-min warm-up, rounded to 5. */
const estMinutes = (sets: number) => Math.max(10, Math.round((sets * 2.5 + 5) / 5) * 5);
const n = (x: number) => Math.round(x).toLocaleString();

export default function Today() {
  const { state, set, profile, targets } = useStore();
  const ui = useUI();
  const t = useToday();
  const notifNudge = useNotifNudgeVisible();
  const [why, setWhy] = useState(false);
  const [showList, setShowList] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const u = profile.units;
  const r = t.readiness;
  const day = t.day;
  const rxs = day ? prescriptionsFor(state, day, r.score, t.inDeload, u) : [];
  const totalSets = rxs.reduce((a, x) => a + x.rx.sets, 0);
  const isTraining = !!t.day;
  const calTarget = isTraining ? targets.trainingCal : targets.restCal;
  const cal = caloriesByDate(state.meals)[t.today] ?? 0;
  const prot = proteinByDate(state.meals)[t.today] ?? 0;
  const exp = state.experiments.find((e) => e.status === "active");
  const expPh = exp ? experimentPhase(exp, t.today) : null;
  const doneSum = t.doneToday ? sessionSummary(state, t.doneToday) : null;

  const start = () => {
    if (!state.activeSession) {
      if (!day) return;
      set((s) => ({ ...s, activeSession: newSession(s, day, r.score, t.inDeload, u) }));
    }
    ui.setSub("train", "session");
    ui.setTab("train");
  };

  const dateLine = fmtDate(t.today, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div>
      <EngineHeader title="Today" testId="header-today"
        right={<><InboxButton /><button className="btn btn-sm btn-outline" onClick={() => ui.open("coach")} data-testid="button-open-coach">Coach</button></>}
        sub={<span className="muted" data-testid="text-phase">{dateLine}{state.program ? ` · Week ${t.phase.week}` : ""}</span>} />
      <div className="screen">

        {/* 1. Check-in first; once done it becomes the readiness result. */}
        {!t.checkin ? (
          <section className="card" style={{ background: "var(--ink)", color: "var(--page)" }} data-testid="card-checkin-cta">
            <div className="text-[20px] font-bold leading-tight">How are you today?</div>
            <p className="text-sm mt-1" style={{ opacity: 0.85 }}>Sleep, energy and soreness. Takes 20 seconds and sets today's weights.</p>
            <button className="btn btn-lg btn-block mt-4" style={{ background: "var(--page)", color: "var(--ink)", borderColor: "var(--page)" }} onClick={() => ui.open("checkin")} data-testid="button-open-checkin">Start check-in</button>
          </section>
        ) : (
          <section className="card" data-testid="card-readiness">
            <div className="flex items-center gap-4">
              <span className="display text-[52px] leading-none" data-testid="text-readiness-score">{r.score ?? "—"}</span>
              <div className="min0 flex-1">
                <div className="label flex items-center"><Term k="readiness" /></div>
                <div className="font-bold text-[16px] leading-snug mt-0.5" data-testid="text-effect">{r.score == null ? "Not enough check-in data" : EFFECT_HEADLINE[r.effect]}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setWhy(!why)} aria-expanded={why} data-testid="button-toggle-breakdown">
                {why ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Why?
              </button>
              <div className="flex-1" />
              <button className="btn btn-sm btn-ghost" onClick={() => ui.open("checkin")} data-testid="button-open-checkin">Edit check-in</button>
            </div>
            {why && (
              <div className="mt-2 pt-3" style={{ borderTop: "1px solid var(--line)" }} data-testid="panel-readiness-why">
                <div className="flex items-center gap-4">
                  <Rings value={r.score} size={96} label={r.score == null ? "No readiness score yet" : `Readiness ${r.score} of 100`} />
                  <div className="min0 flex-1">
                    <p className="text-sm leading-snug" data-testid="text-readiness-reason">{r.reason}</p>
                    <div className="flex items-center gap-1 mt-2"><Tag testId="text-confidence">Confidence: {r.confidence}</Tag><Info k="confidence" /></div>
                  </div>
                </div>
                <div className="mt-3 stack" style={{ gap: 8 }}>
                  {r.parts.map((p) => (
                    <div key={p.key} className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr 90px 54px" }}>
                      <span className={`text-[13px] ${p.present ? "" : "faint"}`}>{p.label}</span>
                      <Bar pct={p.max ? (p.pts / p.max) * 100 : 0} />
                      <span className="mono text-xs text-right muted">{p.present ? `${Math.round(p.pts)}/${Math.round(p.max)}` : "n/a"}</span>
                    </div>
                  ))}
                  <p className="text-xs faint">Based on {r.inputs} of 6 inputs.{r.parts.some((p) => !p.present) ? " Missing ones are left out and the rest weighted up." : ""}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2. Alerts, only when they apply. */}
        {(t.deload.recommend && !t.inDeload) && (
          <section className="warn" data-testid="card-deload">
            <div className="inner">
              <div className="font-bold flex items-center">Time for a <Term k="deload">deload</Term></div>
              <p className="text-sm mt-1">{t.deload.reasons.join(" and ")}. One lighter week: 60% of your usual sets, same weights.</p>
              <button className="btn btn-sm mt-3" onClick={() => { set((s) => ({ ...s, program: s.program ? { ...s.program, deloadUntil: addDays(t.today, 6) } : s.program })); ui.toast("Deload week started"); }} data-testid="button-start-deload">Start deload week</button>
            </div>
          </section>
        )}
        {t.flags.length > 0 && (
          <section className="warn" data-testid="card-plateaus">
            <div className="inner">
              <div className="font-bold flex items-center"><Term k="plateau">{t.flags.length === 1 ? "1 lift has stalled" : `${t.flags.length} lifts have stalled`}</Term></div>
              {t.flags.map((f) => (
                <p key={f.exId} className="text-sm mt-1" data-testid={`card-plateau-${f.exId}`}><b>{EX[f.exId].name}.</b> {f.fix}</p>
              ))}
            </div>
          </section>
        )}

        {/* Experiment yes/no for today */}
        {exp && expPh && expPh.phase === "experiment" && (
          <section className="card" data-testid="card-experiment-today">
            <div className="label">{exp.name} · day {expPh.day} of {expPh.of}</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="min0 flex-1 text-[15px] font-semibold">{exp.question}</div>
              <div className="seg" style={{ width: 120 }}>
                {[true, false].map((v) => (
                  <button key={String(v)} aria-pressed={exp.log[t.today] === v ? "true" : "false"} onClick={() => set((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === exp.id ? { ...e, log: { ...e.log, [t.today]: v } } : e)) }))} data-testid={`button-exp-${v ? "yes" : "no"}`}>{v ? "Yes" : "No"}</button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 3. Workout */}
        <div className="section-title"><h2>Workout</h2></div>
        {!state.program ? (
          <section className="card" data-testid="card-no-program">
            <p className="text-sm">No program yet.</p>
            <button className="btn btn-primary btn-block mt-3" onClick={() => { ui.setSub("train", "program"); ui.setTab("train"); }} data-testid="button-setup-program">Set up a program</button>
            <button className="btn btn-ghost btn-block mt-1" onClick={() => setStartOpen(true)} data-testid="button-start-empty-today">Or start an empty workout</button>
          </section>
        ) : doneSum && t.doneToday ? (
          <section className="card" data-testid="card-session-done">
            <div className="flex items-center justify-between"><span className="font-bold text-[17px]">{t.doneToday.dayName}</span><Tag>Done</Tag></div>
            <div className="stat-grid cols-3 mt-3">
              <div className="stat"><div className="label">Duration</div><div className="v">{doneSum.dur}<small className="text-sm">m</small></div></div>
              <div className="stat"><div className="label">Sets</div><div className="v">{doneSum.totalSets}</div></div>
              <div className="stat"><div className="label">PRs</div><div className="v">{doneSum.prs.length}</div></div>
            </div>
          </section>
        ) : day && day.exercises.length === 0 && !state.activeSession ? (
          <section className="card" data-testid="card-empty-day">
            <div className="font-bold text-[17px]">{day.name}</div>
            <p className="text-sm muted mt-1">No exercises yet. Add them once and every {day.name} after that is planned for you.</p>
            <button className="btn btn-primary btn-lg btn-block mt-3" onClick={() => { ui.setSub("train", "program"); ui.setTab("train"); }} data-testid="button-add-exercises-day">Add exercises to {day.name}</button>
            <button className="btn btn-sm btn-ghost btn-block mt-1" onClick={() => setStartOpen(true)} data-testid="button-start-empty-day">Or start an empty workout</button>
          </section>
        ) : day ? (
          <section className="card" data-testid="card-today-session">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-[17px]">{day.name}</div>
              {t.inDeload && <Tag>Deload week</Tag>}
            </div>
            <div className="text-sm muted mt-0.5 flex items-center flex-wrap">
              {rxs.length} exercises ·&nbsp;<Term k="workingSets">{totalSets} working sets</Term>&nbsp;· ~{estMinutes(totalSets)} min
            </div>
            {!t.checkin && <p className="text-[13px] faint mt-2">Check in first so the weights match how you feel today.</p>}
            <button className="btn btn-sm btn-ghost mt-2" style={{ paddingLeft: 0 }} onClick={() => setShowList(!showList)} aria-expanded={showList} data-testid="button-toggle-exercises">
              {showList ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {showList ? "Hide exercises" : "See exercises"}
            </button>
            {showList && (
              <table className="labtable mt-1">
                <thead><tr><th><span className="flex items-center">Exercise · sets ·&nbsp;<Term k="rir" /></span></th><th className="r">Target</th></tr></thead>
                <tbody>
                  {rxs.map(({ pe, ex, rx }) => {
                    const hot = ex.primary.filter((m) => (t.fatigue[m] ?? 0) > 60);
                    return (
                      <tr key={pe.id} data-testid={`row-rx-${pe.id}`}>
                        <td>
                          <div className="font-semibold text-[14px]">{ex.name}</div>
                          <div className="text-[12px] muted flex items-center flex-wrap">{rx.sets} sets · {rx.rir} RIR{hot.length > 0 && <>&nbsp;· {MUSCLE_LABEL[hot[0]]} still {t.fatigue[hot[0]]}% fatigued</>}</div>
                        </td>
                        <td className="r font-bold" data-testid={`text-rx-${pe.id}`}>{rx.weight > 0 ? `${fmtW(rx.weight)} × ${rx.repMin}–${rx.repMax}` : `BW × ${rx.repMin}–${rx.repMax}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <button className="btn btn-primary btn-lg btn-block mt-3" onClick={start} data-testid="button-start-workout">{state.activeSession ? "Resume workout" : "Start workout"}</button>
            {!state.activeSession && <button className="btn btn-sm btn-ghost btn-block mt-1" onClick={() => setStartOpen(true)} data-testid="button-start-different-today">Start a different workout</button>}
          </section>
        ) : (
          <section className="card" data-testid="card-rest-day">
            <div className="font-bold text-[17px]">Rest day</div>
            <p className="text-sm muted mt-1">Fatigue is clearing. Hitting your protein and sleep is today's training.</p>
            <button className="btn btn-outline btn-block mt-3" onClick={() => (state.activeSession ? start() : setStartOpen(true))} data-testid="button-train-anyway">{state.activeSession ? "Resume workout" : "Train anyway"}</button>
          </section>
        )}
        {startOpen && <StartWorkoutSheet onClose={() => setStartOpen(false)} />}

        {/* 4. Food: one slim row; tap to log. */}
        <div className="section-title"><h2>Food</h2></div>
        <button className="card w-full text-left flex items-center gap-3" onClick={() => ui.open("nutrition")} data-testid="button-open-nutrition" aria-label="Log a meal">
          <div className="min0 flex-1 grid grid-cols-2 gap-4">
            <div data-testid="text-cal-today">
              <div className="label">Calories</div>
              <div className="text-[15px] whitespace-nowrap"><b className="mono">{n(cal)}</b><span className="muted"> / {n(calTarget)}</span></div>
              <div className="mt-1.5"><Bar pct={calTarget ? (cal / calTarget) * 100 : 0} over={cal > calTarget * 1.08} /></div>
            </div>
            <div data-testid="text-protein-today">
              <div className="label">Protein</div>
              <div className="text-[15px] whitespace-nowrap"><b className="mono">{n(prot)}</b><span className="muted"> / {n(targets.protein)} g</span></div>
              <div className="mt-1.5"><Bar pct={targets.protein ? (prot / targets.protein) * 100 : 0} /></div>
            </div>
          </div>
          <span className="icon-btn" aria-hidden style={{ width: 40, height: 40 }}><Plus size={18} /></span>
        </button>

        {/* Setup nudges: at most one, at the bottom so they never push the day down. */}
        <div className="mt-6">{notifNudge ? <NotifNudge onOpenSettings={() => ui.setTab("profile")} /> : <InstallBanner />}</div>
      </div>
    </div>
  );
}
