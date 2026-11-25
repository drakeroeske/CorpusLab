// Home tab: Monday–Sunday at a glance. Workouts planned vs done, calories against the week's budget, protein, weight.
import { Check, Plus } from "lucide-react";
import { useUI } from "@/App";
import { useStore } from "@/lib/store";
import { fmtDate, weekOverview, type WeekDayOverview } from "@/lib/engine";

const LETTER = ["M", "T", "W", "T", "F", "S", "S"];
const n = (x: number) => Math.round(x).toLocaleString();
const k = (x: number) => (x >= 10000 ? `${(x / 1000).toFixed(1)}k` : n(x));
const signed = (x: number) => `${x > 0 ? "+" : "−"}${n(Math.abs(x))}`;

function DayCell({ d, today }: { d: WeekDayOverview; today: string }) {
  const isToday = d.date === today;
  const box = { width: "100%", aspectRatio: "1 / 1", maxWidth: 38, margin: "0 auto", display: "grid", placeItems: "center" } as const;
  const title = d.done.length ? `${d.done.map((s) => s.dayName).join(", ")} done` : d.planned ? `${d.planned.name}${d.state === "missed" ? " (missed)" : ""}` : "Rest";
  const mark =
    d.state === "done" || d.state === "extra" ? (
      <div style={{ ...box, background: "var(--ink)", color: "var(--page)" }}>{d.state === "done" ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}</div>
    ) : d.state === "today" ? (
      <div style={{ ...box, border: "2px solid var(--ink)" }}><span className="mono text-[11px] font-bold" style={{ color: "var(--ink)" }}>NOW</span></div>
    ) : d.state === "planned" ? (
      <div style={{ ...box, border: "1.5px dashed var(--ink)" }} />
    ) : d.state === "missed" ? (
      <div style={{ ...box, border: "1.5px solid var(--line-strong)", color: "var(--faint)" }}><span className="text-[13px]">×</span></div>
    ) : (
      <div style={box}><span style={{ width: 5, height: 5, background: "var(--line-strong)", display: "block" }} /></div>
    );
  const pct = d.kcal != null && d.kcalTarget ? Math.min(130, (d.kcal / d.kcalTarget) * 100) : 0;
  return (
    <div className="text-center min0" title={title} data-testid={`week-day-${d.date}`} data-state={d.state}>
      <div className={`mono text-[11px] mb-1 ${isToday ? "font-bold" : "muted"}`} style={isToday ? { color: "var(--ink)" } : undefined}>{LETTER[(new Date(d.date + "T12:00:00").getDay() + 6) % 7]}</div>
      {mark}
      <div style={{ height: 3, marginTop: 6, background: "var(--line)", position: "relative" }} aria-label={d.kcal != null ? `${n(d.kcal)} of ${n(d.kcalTarget)} kcal` : "No food logged"}>
        {d.kcal != null && <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, pct)}%`, background: pct > 108 ? "var(--fg)" : "var(--ink)" }} />}
      </div>
      <div style={{ height: 6, marginTop: 3, display: "flex", justifyContent: "center" }}>{d.activities > 0 && <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ink)" }} title={`${d.activities} activit${d.activities === 1 ? "y" : "ies"}`} />}</div>
    </div>
  );
}

export function WeekOverviewCard({ today }: { today: string }) {
  const { state, targets, profile } = useStore();
  const ui = useUI();
  const w = weekOverview(state, targets, today);
  const left = w.kcalWeekTarget - w.kcalEaten;
  const missed = w.days.filter((d) => d.state === "missed").length;
  const nextUp = w.days.find((d) => d.date > today && d.planned && !d.done.length);
  return (
    <div data-testid="card-week-overview">
      <div className="section-title">
        <h2>This week</h2>
        <button className="mono text-[12px] muted" onClick={() => { ui.setSub("progress", "lab"); ui.setTab("progress"); }} data-testid="button-week-report">
          {fmtDate(w.from, { month: "short", day: "numeric" })} – {fmtDate(w.to, { month: "short", day: "numeric" })} · Report ›
        </button>
      </div>
      <section className="card">
        <div className="grid grid-cols-7 gap-1.5">{w.days.map((d) => <DayCell key={d.date} d={d} today={today} />)}</div>
        <div className="stat-grid mt-3">
          <div className="stat" data-testid="stat-week-workouts">
            <div className="label">Workouts</div>
            <div className="v">{w.workoutsDone}<span className="muted text-sm"> / {w.workoutsPlanned}</span></div>
            <div className="s">{[missed ? `${missed} missed` : null, w.activities ? `${w.activities} activit${w.activities === 1 ? "y" : "ies"}` : null, nextUp ? `next ${fmtDate(nextUp.date, { weekday: "short" })}` : null].filter(Boolean).join(" · ") || "planned this week"}</div>
          </div>
          <div className="stat" data-testid="stat-week-calories">
            <div className="label">Calories</div>
            <div className="v whitespace-nowrap">{k(w.kcalEaten)}<span className="muted text-sm"> / {k(w.kcalWeekTarget)}</span></div>
            <div className="s">{Math.abs(w.kcalPace) >= 100 ? `${signed(w.kcalPace)} vs plan so far` : "on plan so far"} · {n(Math.max(0, left))} left</div>
          </div>
          <div className="stat" data-testid="stat-week-protein">
            <div className="label">Protein</div>
            <div className="v">{w.proteinHit}<span className="muted text-sm"> / {w.proteinLogged || 0}</span></div>
            <div className="s">days at {n(targets.protein)} g{w.proteinLogged ? "" : " · none logged yet"}</div>
          </div>
          <div className="stat" data-testid="stat-week-weight">
            <div className="label">Weight</div>
            <div className="v">{w.weightAvg != null ? (Math.round(w.weightAvg * 10) / 10).toFixed(1) : "—"}{w.weightAvg != null && <span className="muted text-sm"> {profile.units}</span>}</div>
            <div className="s">{w.weightChange != null ? `${w.weightChange > 0 ? "+" : w.weightChange < 0 ? "−" : "±"}${Math.abs(Math.round(w.weightChange * 10) / 10).toFixed(1)} vs last week` : w.weightAvg != null ? "this week's average" : "log a weigh-in"}</div>
          </div>
        </div>
        <p className="text-[11px] faint mt-3">Filled = done · dashed = coming up · × = missed · line = calories vs that day's target · dot = activity</p>
      </section>
    </div>
  );
}
