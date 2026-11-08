import { InstallBanner } from "@/components/Install";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardCheck, FlaskConical, MessageSquare, Play, Plus, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { newSession, prescriptionsFor, sessionSummary, useToday } from "@/lib/derived";
import { addDays, experimentPhase, fmtDate, fmtW, proteinByDate, caloriesByDate, r1 } from "@/lib/engine";
import { EX, MUSCLE_LABEL, newId } from "@/lib/exercises";
import { Bar, Ring, Wordmark } from "@/components/ui";
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
      <header className="topbar">
        <Wordmark />
        <span className="flex-1" />
        <span className="mono text-xs muted" data-testid="text-date">{fmtDate(t.today, { weekday: "short", month: "short", day: "numeric" })}</span>
        <button className="btn btn-sm btn-outline" onClick={() => ui.open("coach")} data-testid="button-open-coach"><MessageSquare size={15} /> Coach</button>
      </header>
      <div className="screen">
        <InstallBanner />
        <div className="flex items-center gap-2 mb-3 flex-wrap" data-testid="text-phase">
          <span className="chip">Week {t.phase.week}</span>
          <span className={`chip ${t.phase.phase.includes("Deload") ? "chip-orange" : ""}`}>{t.phase.phase}</span>
          {state.program && <span className="chip">{t.day ? t.day.name : "Rest day"}</span>}
        </div>

        {/* Readiness */}
        <section className="card" data-testid="card-readiness">
          <div className="flex items-start gap-4">
            <Ring value={r.score ?? 0} max={100} size={104} color={readinessColor(r.score)}>
              <span className="big-num text-[34px]" style={{ color: readinessColor(r.score) }} data-testid="text-readiness-score">{r.score ?? "—"}</span>
              <span className="label" style={{ fontSize: 9 }}>Readiness</span>
            </Ring>
            <div className="min0 flex-1">
              <div className="flex gap-2 flex-wrap">
                <span className={`chip ${r.confidence === "high" ? "chip-lime" : r.confidence === "medium" ? "chip-blue" : ""}`} data-testid="text-confidence">{r.confidence} confidence</span>
                {r.score != null && <span className={`chip ${r.effect === "normal" ? "chip-lime" : r.effect === "hold" ? "chip-blue" : "chip-orange"}`} data-testid="text-effect">{r.effect === "normal" ? "Progress" : r.effect === "hold" ? "Hold" : "−10%"}</span>}
              </div>
              <p className="text-[14px] mt-2 leading-snug" data-testid="text-readiness-reason">{r.reason}</p>
            </div>
          </div>
          {r.score != null && (
            <>
              <button className="flex items-center gap-1 label mt-3" style={{ minHeight: 32 }} onClick={() => setShowParts(!showParts)} data-testid="button-toggle-breakdown">
                {showParts ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Breakdown · {r.inputs}/6 inputs
              </button>
              {showParts && (
                <div className="mt-2 stack" style={{ gap: 8 }}>
                  {r.parts.map((p) => (
                    <div key={p.key} className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr 90px 54px" }}>
                      <span className={`text-[13px] ${p.present ? "" : "faint"}`}>{p.label}</span>
                      <Bar pct={p.max ? (p.pts / p.max) * 100 : 0} color={readinessColor(r.score)} />
                      <span className="mono text-xs text-right muted">{p.present ? `${Math.round(p.pts)}/${Math.round(p.max)}` : "n/a"}</span>
                    </div>
                  ))}
                  {r.parts.some((p) => !p.present) && <p className="text-xs faint">Missing inputs have their weight redistributed to the ones you logged.</p>}
                </div>
              )}
            </>
          )}
          <button className={`btn btn-block mt-3 ${t.checkin ? "btn-outline" : "btn-primary"}`} onClick={() => ui.open("checkin")} data-testid="button-open-checkin">
            <ClipboardCheck size={17} /> {t.checkin ? "Edit check-in" : "Daily check-in · 20 sec"}
          </button>
        </section>

        {/* Experiment daily item */}
        {exp && expPh && expPh.phase === "experiment" && (
          <section className="card flex items-center gap-3" data-testid="card-experiment-today">
            <FlaskConical size={18} className="blue shrink-0" />
            <div className="min0 flex-1">
              <div className="text-[13px] font-semibold">{exp.question}</div>
              <div className="mono text-[11px] muted">{exp.name} · day {expPh.day}/{expPh.of}</div>
            </div>
            <div className="seg" style={{ width: 112 }}>
              {[true, false].map((v) => (
                <button key={String(v)} aria-pressed={exp.log[t.today] === v ? "true" : "false"} onClick={() => set((s) => ({ ...s, experiments: s.experiments.map((e) => (e.id === exp.id ? { ...e, log: { ...e.log, [t.today]: v } } : e)) }))} data-testid={`button-exp-${v ? "yes" : "no"}`}>{v ? "Yes" : "No"}</button>
              ))}
            </div>
          </section>
        )}

        {/* Alerts */}
        {(t.deload.recommend && !t.inDeload) && (
          <section className="card" style={{ borderColor: "rgba(180,35,24,.45)" }} data-testid="card-deload">
            <div className="flex items-center gap-2 orange font-semibold text-sm"><TrendingDown size={16} /> Deload week recommended</div>
            <p className="text-sm muted mt-1">Because {t.deload.reasons.join(" and ")}. 60% volume, same weights, for 7 days.</p>
            <button className="btn btn-warn btn-block mt-3" onClick={() => { set((s) => ({ ...s, program: s.program ? { ...s.program, deloadUntil: addDays(t.today, 6) } : s.program })); ui.toast("Deload week started"); }} data-testid="button-start-deload">Start deload week</button>
          </section>
        )}
        {t.flags.map((f) => (
          <section key={f.exId} className="card" data-testid={`card-plateau-${f.exId}`}>
            <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={15} className="orange" /> Plateau risk · {EX[f.exId].name}</div>
            <p className="text-sm muted mt-1">{f.fix}</p>
          </section>
        ))}

        {/* Session */}
        <div className="section-title"><h2>Today's session</h2>{state.program && <span className="label">{state.program.name}</span>}</div>
        {!state.program ? (
          <div className="empty">No program yet. Build one in Train → Program.</div>
        ) : doneSum && t.doneToday ? (
          <section className="card" data-testid="card-session-done">
            <div className="flex items-center justify-between"><span className="font-semibold">{t.doneToday.dayName} complete</span><span className="chip chip-lime">Done</span></div>
            <div className="stat-grid cols-3 mt-3">
              <div className="stat"><div className="label">Duration</div><div className="v">{doneSum.dur}m</div></div>
              <div className="stat"><div className="label">Sets</div><div className="v">{doneSum.totalSets}</div></div>
              <div className="stat"><div className="label">PRs</div><div className="v lime">{doneSum.prs.length}</div></div>
            </div>
          </section>
        ) : day ? (
          <section className="card" style={{ padding: 0 }} data-testid="card-today-session">
            <div className="flex items-center justify-between" style={{ padding: "12px 14px" }}>
              <div><div className="font-semibold">{day.name}</div><div className="mono text-[11px] muted">{rxs.length} exercises · {rxs.reduce((a, x) => a + x.rx.sets, 0)} working sets{t.inDeload ? " · deload" : ""}</div></div>
              {r.score == null && <span className="chip">No readiness</span>}
            </div>
            {rxs.map(({ pe, ex, rx }) => {
              const hot = ex.primary.filter((m) => (t.fatigue[m] ?? 0) > 60);
              return (
                <div key={pe.id} style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }} data-testid={`row-rx-${pe.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-[14px] min0 truncate">{ex.name}</span>
                    <span className="mono text-[14px] shrink-0" data-testid={`text-rx-${pe.id}`}>{rx.weight > 0 ? `${fmtW(rx.weight)} × ${rx.repMin}–${rx.repMax}` : `BW × ${rx.repMin}–${rx.repMax}`}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <span className="text-xs muted min0">{rx.sets} sets · stop at {rx.rir} reps in reserve</span>
                    {hot.length > 0 && <span className="chip chip-orange shrink-0" title="Target muscle above 60% fatigue">{MUSCLE_LABEL[hot[0]]} {t.fatigue[hot[0]]}%</span>}
                  </div>
                </div>
              );
            })}
            <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-primary btn-lg btn-block" onClick={start} data-testid="button-start-workout"><Play size={18} /> {state.activeSession ? "Resume workout" : "Start workout"}</button>
            </div>
          </section>
        ) : (
          <section className="card" data-testid="card-rest-day">
            <div className="font-semibold">Rest day</div>
            <p className="text-sm muted mt-1">Fatigue is clearing. Hit your protein and sleep — that's today's training.</p>
            <div className="flex gap-2 mt-3">
              <select className="select" value={altDay} onChange={(e) => setAltDay(e.target.value)} data-testid="select-alt-day">
                <option value="">Train anyway…</option>
                {state.program.days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </section>
        )}

        {/* Nutrition */}
        <div className="section-title"><h2>Nutrition</h2><span className="label">{isTraining ? "Training day +150 kcal" : "Rest day"}</span></div>
        <section className="card" data-testid="card-nutrition">
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <Ring value={cal} max={calTarget} size={96} over={cal > calTarget * 1.08}>
                <span className="mono font-semibold text-[17px]" data-testid="text-cal-today">{Math.round(cal)}</span>
                <span className="mono text-[10px] muted">/ {calTarget}</span>
              </Ring>
              <span className="label">kcal</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Ring value={prot} max={targets.protein} size={96} color="var(--blue)">
                <span className="mono font-semibold text-[17px]" data-testid="text-protein-today">{Math.round(prot)}</span>
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
          <div><div className="font-semibold text-sm">Weekly lab report</div><div className="text-xs muted">Insights connecting sleep, food, and lifts</div></div>
          <ChevronRight size={18} className="muted" />
        </button>
        {state.checkins.length > 0 && <p className="text-[11px] faint mt-4 text-center mono">Avg sleep 7d · {r1(state.checkins.slice(-7).reduce((a, c) => a + (c.sleepH ?? 0), 0) / Math.max(1, state.checkins.slice(-7).filter((c) => c.sleepH != null).length))}h</p>}
      </div>
    </div>
  );
}
