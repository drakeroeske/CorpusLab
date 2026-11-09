import { InstallBanner } from "@/components/Install";
import { NotifNudge } from "@/components/Notifications";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { newSession, prescriptionsFor, sessionSummary, useToday } from "@/lib/derived";
import { addDays, experimentPhase, fmtDate, fmtW, proteinByDate, caloriesByDate, r1 } from "@/lib/engine";
import { EX, MUSCLE_LABEL, newId } from "@/lib/exercises";
import { Bar, Ring } from "@/components/ui";
import { EngineHeader, FigCaption, NoteLine, Rings, Tag } from "@/components/riso";
import type { Meal } from "@/lib/types";

export function readinessColor(score: number | null) {
  if (score == null) return "var(--muted)";
  return score >= 75 ? "var(--lime)" : score >= 50 ? "var(--blue)" : "var(--orange)";
}

export function logFavorite(fav: { name: string; cal: number; p: number; c: number; f: number; items?: Meal["items"] }, date: string): Meal {
  return { id: newId("meal"), date, time: Date.now(), name: fav.name, cal: fav.cal, p: fav.p, c: fav.c, f: fav.f, ...(fav.items ? { items: fav.items } : {}) };
}

export default function Today() {
  const { state, set, profile, targets } = useStore();
  const ui = useUI();
  const t = useToday();
  const [showParts, setShowParts] = useState(false);
  const [altDay, setAltDay] = useState<string>("");
  const u = profile.units;
  const r = t.readiness;
  const day = t.day ?? (altDay ? state.program?.days.find((d) => d.id === altDay) ?? null : null);
  const rxs = day ? prescriptionsFor(state, day, r.score, t.inDeload, u) : [];
  const isTraining = !!t.day;
  const calTarget = isTraining ? targets.trainingCal : targets.restCal;
  const cal = caloriesByDate(state.meals)[t.today] ?? 0;
  const prot = proteinByDate(state.meals)[t.today] ?? 0;
  const exp = state.experiments.find((e) => e.status === "active");
  const expPh = exp ? experimentPhase(exp, t.today) : null;

  const start = () => {
    if (!day) return;
    if (!state.activeSession) set((s) => ({ ...s, activeSession: newSession(s, day, r.score, t.inDeload, u) }));
    ui.setTrainSub("session");
    ui.setTab("train");
  };

  const doneSum = t.doneToday ? sessionSummary(state, t.doneToday) : null;

  return (
    <div>
      <EngineHeader title={state.activeSession ? state.activeSession.dayName : doneSum && t.doneToday ? `${t.doneToday.dayName} done` : day ? day.name : "Rest day"} testId="header-today"
        right={<button className="btn btn-sm" onClick={() => ui.open("coach")} data-testid="button-open-coach">Coach</button>}
        sub={<span className="flex gap-2 flex-wrap" data-testid="text-phase"><Tag>Week {t.phase.week}</Tag><Tag>{t.phase.phase}</Tag>{state.program && <Tag>{state.program.name}</Tag>}</span>} />
      <div className="screen">
        <InstallBanner />
        <NotifNudge onOpenSettings={() => ui.setTab("profile")} />

        {/* Readiness */}
        <section className="card" data-testid="card-readiness">
          <div className="flex items-center gap-4">
            <Rings value={r.score} size={130} label={r.score == null ? "No readiness score yet" : `Readiness ${r.score} of 100`}>
              <span className="display px-1 text-[44px]" style={{ background: "var(--page)" }} data-testid="text-readiness-score">{r.score ?? "—"}</span>
            </Rings>
            <div className="min0 flex-1">
              <div className="label">Readiness</div>
              <div className="flex gap-2 flex-wrap mt-1">
                <Tag testId="text-confidence">Confidence: {r.confidence}</Tag>
                {r.score != null && <Tag testId="text-effect">{r.effect === "normal" ? "Progress" : r.effect === "hold" ? "Hold" : "Targets −10%"}</Tag>}
              </div>
              <p className="text-[13px] mt-2 leading-snug" data-testid="text-readiness-reason">{r.reason}</p>
            </div>
          </div>
          <div className="mt-3 pt-2" style={{ borderTop: "1px dashed var(--ink)" }}>
            <NoteLine testId="text-readiness-note">
              {t.checkin ? <>Sleep {t.checkin.sleepH ?? "—"}h{t.checkin.hrv ? ` · HRV ${t.checkin.hrv}` : ""} · {r.inputs}/6 inputs — {r.effect === "normal" ? "targets held at 100%" : r.effect === "hold" ? "loads held, no progression today" : "targets cut 10%"}.</> : <>No check-in yet — log sleep and energy to get a readiness score.</>}
            </NoteLine>
          </div>
          {r.score != null && (
            <>
              <button className="flex items-center gap-1 label mt-3" style={{ minHeight: 44 }} onClick={() => setShowParts(!showParts)} data-testid="button-toggle-breakdown">
                {showParts ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Breakdown · {r.inputs}/6 inputs
              </button>
              {showParts && (
                <div className="mt-2 stack" style={{ gap: 8 }}>
                  {r.parts.map((p) => (
                    <div key={p.key} className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr 90px 54px" }}>
                      <span className={`text-[13px] ${p.present ? "" : "faint"}`}>{p.label}</span>
                      <Bar pct={p.max ? (p.pts / p.max) * 100 : 0} />
                      <span className="mono text-xs text-right muted">{p.present ? `${Math.round(p.pts)}/${Math.round(p.max)}` : "n/a"}</span>
                    </div>
                  ))}
                  {r.parts.some((p) => !p.present) && <p className="text-xs faint">Missing inputs have their weight redistributed to the ones you logged.</p>}
                </div>
              )}
            </>
          )}
          <button className={`btn btn-block mt-3 ${t.checkin ? "btn-outline" : "btn-primary"}`} onClick={() => ui.open("checkin")} data-testid="button-open-checkin">
            {t.checkin ? "Edit check-in" : "Daily check-in · 20 sec"}
          </button>
        </section>

        {/* Experiment daily item */}
        {exp && expPh && expPh.phase === "experiment" && (
          <section className="card" data-testid="card-experiment-today">
            <FigCaption n={1} title={`${exp.name} · day ${expPh.day}/${expPh.of}`} stat={<Tag>EXP</Tag>} />
            <div className="flex items-center gap-3">
              <div className="min0 flex-1 text-[13px] font-bold uppercase">{exp.question}</div>
              <div className="seg" style={{ width: 120 }}>
                {[true, false].map((v) => (
                  <button key={String(v)} aria-pressed={exp.log[t.today] === v ? "true" : "false"} onClick={() => set((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === exp.id ? { ...e, log: { ...e.log, [t.today]: v } } : e)) }))} data-testid={`button-exp-${v ? "yes" : "no"}`}>{v ? "Yes" : "No"}</button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Alerts */}
        {(t.deload.recommend && !t.inDeload) && (
          <section className="warn hatch" data-testid="card-deload">
            <div className="inner">
              <Tag signal>Deload</Tag>
              <p className="text-[13px] mt-1">{t.deload.reasons.join(" and ")}. Deload week: 60% of your usual sets, same weights, 7 days.</p>
              <button className="btn btn-block mt-3" onClick={() => { set((s) => ({ ...s, program: s.program ? { ...s.program, deloadUntil: addDays(t.today, 6) } : s.program })); ui.toast("Deload week started"); }} data-testid="button-start-deload">Start deload week</button>
            </div>
          </section>
        )}
        {t.flags.length > 0 && (
          <section className="warn hatch" data-testid="card-plateaus">
            <div className="inner">
              <Tag signal>Plateau</Tag>
              {t.flags.map((f) => (
                <p key={f.exId} className="text-[13px] mt-1" data-testid={`card-plateau-${f.exId}`}>{EX[f.exId].name}: no e1RM gain in 3 sessions → <b className="uppercase">{f.fix}</b></p>
              ))}
            </div>
          </section>
        )}

        {/* Session */}
        <div className="section-title"><h2>Session</h2>{state.program && <span className="label">{t.day ? t.day.name : "Rest day"}</span>}</div>
        {!state.program ? (
          <div className="empty">No program yet. Build one in Train → Program.</div>
        ) : doneSum && t.doneToday ? (
          <section className="card" data-testid="card-session-done">
            <div className="flex items-center justify-between"><span className="font-bold uppercase text-sm">{t.doneToday.dayName}</span><Tag>Done</Tag></div>
            <div className="stat-grid cols-3 mt-3">
              <div className="stat"><div className="label">Duration</div><div className="v">{doneSum.dur}<small className="text-sm">m</small></div></div>
              <div className="stat"><div className="label">Sets</div><div className="v">{doneSum.totalSets}</div></div>
              <div className="stat"><div className="label">PRs</div><div className="v">{doneSum.prs.length}</div></div>
            </div>
          </section>
        ) : day ? (
          <section data-testid="card-today-session">
            <div className="flex items-baseline justify-between gap-2 label mb-1">
              <span>{rxs.length} exercises · {rxs.reduce((a, x) => a + x.rx.sets, 0)} working sets{t.inDeload ? " · [DELOAD]" : ""}</span>
              {r.score == null && <Tag>No readiness</Tag>}
            </div>
            <table className="labtable">
              <thead><tr><th>Nº</th><th>Exercise</th><th className="r">Next</th></tr></thead>
              <tbody>
                {rxs.map(({ pe, ex, rx }, i) => {
                  const hot = ex.primary.filter((m) => (t.fatigue[m] ?? 0) > 60);
                  return (
                    <tr key={pe.id} data-testid={`row-rx-${pe.id}`}>
                      <td style={{ width: 28 }}>{String(i + 1).padStart(2, "0")}</td>
                      <td><div className="font-bold text-[13px]">{ex.name}</div><div className="text-[11px] uppercase">{rx.sets} sets · {rx.rir} RIR{hot.length > 0 && <> · <Tag>{MUSCLE_LABEL[hot[0]]} {t.fatigue[hot[0]]}%</Tag></>}</div></td>
                      <td className="r font-bold" data-testid={`text-rx-${pe.id}`}>{rx.weight > 0 ? `${fmtW(rx.weight)} × ${rx.repMin}–${rx.repMax}` : `BW × ${rx.repMin}–${rx.repMax}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="btn btn-primary btn-lg btn-block mt-3" onClick={start} data-testid="button-start-workout">{state.activeSession ? "Resume workout" : "Start workout"}</button>
          </section>
        ) : (
          <section className="card" data-testid="card-rest-day">
            <NoteLine>Fatigue is clearing. Hit your protein and sleep — that's today's training.</NoteLine>
            <div className="flex gap-2 mt-3">
              <select className="select" value={altDay} onChange={(e) => setAltDay(e.target.value)} data-testid="select-alt-day">
                <option value="">Train anyway…</option>
                {state.program.days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </section>
        )}

        {/* Nutrition */}
        <div className="section-title"><h2>Fuel</h2><span className="label">{isTraining ? "Training day +150 kcal" : "Rest day"}</span></div>
        <section className="card" data-testid="card-nutrition">
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <Ring value={cal} max={calTarget} size={96} over={cal > calTarget * 1.08}>
                <span className="display text-[26px]" data-testid="text-cal-today">{Math.round(cal)}</span>
                <span className="mono text-[10px] muted">/ {calTarget}</span>
              </Ring>
              <span className="label">kcal</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Ring value={prot} max={targets.protein} size={96}>
                <span className="display text-[26px]" data-testid="text-protein-today">{Math.round(prot)}</span>
                <span className="mono text-[10px] muted">/ {targets.protein} g</span>
              </Ring>
              <span className="label">protein</span>
            </div>
          </div>
          {state.favorites.length > 0 && (
            <div className="scroll-x flex gap-2 mt-4">
              {state.favorites.map((f) => (
                <button key={f.id} className="btn btn-sm btn-outline shrink-0" onClick={() => { set((s) => ({ ...s, meals: [...s.meals, logFavorite(f, t.today)] })); ui.toast(`Logged ${f.name}`); }} data-testid={`button-quick-fav-${f.id}`}>
                  <Plus size={14} /> {f.name} <span className="mono faint">{f.p}g</span>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-block mt-3" onClick={() => ui.open("nutrition")} data-testid="button-open-nutrition">Log meal</button>
        </section>

        <button className="card w-full text-left flex items-center justify-between mt-3" onClick={() => { ui.setTrainSub("lab"); ui.setTab("train"); }} data-testid="link-weekly-report">
          <div><div className="font-bold text-sm uppercase">Weekly lab report</div><div className="text-xs">Insights connecting sleep, food, and lifts</div></div>
          <ChevronRight size={18} />
        </button>
        {state.checkins.length > 0 && <p className="text-[11px] faint mt-4 text-center mono">Avg sleep 7d · {r1(state.checkins.slice(-7).reduce((a, c) => a + (c.sleepH ?? 0), 0) / Math.max(1, state.checkins.slice(-7).filter((c) => c.sleepH != null).length))}h</p>}
      </div>
    </div>
  );
}
