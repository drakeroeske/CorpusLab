// Personal goals: set a bodyweight, lift or habit target, see progress, ETA and whether the deadline holds.
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Target, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { ActivityType, PersonalGoal, GoalKind, HabitMetric, Units } from "@/lib/types";
import { EX, newId } from "@/lib/exercises";
import { addDays, dateKey, daysBetween, fmtDate, fmtW, nutritionTargets, roundTo, toKg, trainingDaysPerWeek } from "@/lib/engine";
import { HABIT_LABEL, RACES, activeGoals, bestSetAtReps, weightPlanGoal, currentBodyweight, finishedGoals, goalProgress, goalTitle, newlyAchieved, recentBestE1rm, type GoalCtx, type GoalProgress } from "@/lib/goals";
import { Bar, Empty, NumInput, Seg, Sheet, Stepper } from "./ui";
import { ExercisePicker } from "./ProgramEditor";
import { ACTIVITY, DISTANCE_TYPES, distUnit, fmtDuration, fromKm, kmToSwim, parseDuration, predictedTimes, swimToKm, swimUnit, toKm } from "@/lib/activities";

const KIND_LABEL: Record<GoalKind, string> = { bodyweight: "Bodyweight", lift: "Lift", cardio: "Cardio", habit: "Habit" };
const STATUS_TEXT: Record<GoalProgress["status"], string> = { achieved: "Done", on_track: "On track", behind: "Behind", in_progress: "In progress", no_data: "No data yet" };

function useGoalCtx(): GoalCtx {
  const { state, profile, targets } = useStore();
  const today = dateKey();
  return useMemo(() => ({ state, today, units: profile.units, proteinTarget: targets.protein }), [state, today, profile.units, targets.protein]);
}

/** Records goals the moment they're met and celebrates once. Mounted once, in the app shell. */
export function GoalWatcher() { useGoalAchievements(); return null; }

function useGoalAchievements() {
  const { set } = useStore();
  const ui = useUI();
  const ctx = useGoalCtx();
  const goals = ctx.state.goals ?? [];
  useEffect(() => {
    const hit = newlyAchieved(goals, ctx);
    if (!hit.length) return;
    const ids = new Set(hit.map((g) => g.id));
    set((s) => ({ ...s, goals: (s.goals ?? []).map((g) => (ids.has(g.id) && !g.achievedAt ? { ...g, achievedAt: ctx.today } : g)) }));
    ui.toast(hit.length === 1 ? `Goal reached: ${goalTitle(hit[0], ctx.units)}` : `${hit.length} goals reached`);
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps
}

function StatusChip({ p }: { p: GoalProgress }) {
  const cls = p.status === "behind" ? "chip-orange" : p.status === "achieved" || p.status === "on_track" ? "chip-blue" : "";
  return <span className={`chip ${cls}`} data-testid="chip-goal-status">{STATUS_TEXT[p.status]}</span>;
}

function WeekCells({ hits }: { hits: boolean[] }) {
  return (
    <div className="flex gap-1 mt-2" aria-label="Last 8 weeks" data-testid="goal-week-cells">
      {hits.map((h, i) => (
        <span key={i} title={i === hits.length - 1 ? "This week" : `${hits.length - 1 - i} weeks ago`}
          style={{ width: 14, height: 14, border: "1px solid var(--ink)", background: h ? "var(--ink)" : "transparent", opacity: i === hits.length - 1 ? 1 : 0.85 }} />
      ))}
      <span className="label ml-1" style={{ alignSelf: "center" }}>8 wk</span>
    </div>
  );
}

export function GoalCard({ goal, compact, onEdit }: { goal: PersonalGoal; compact?: boolean; onEdit?: () => void }) {
  const ctx = useGoalCtx();
  const p = goalProgress(goal, ctx);
  const title = goalTitle(goal, ctx.units);
  return (
    <div className={compact ? "py-2" : "card"} data-testid={`card-goal-${goal.id}`}>
      <div className="flex items-start gap-2">
        <div className="min0 flex-1">
          {!compact && <div className="label mb-0.5">{KIND_LABEL[goal.kind]}{goal.deadline ? ` · by ${fmtDate(goal.deadline)}` : ""}</div>}
          <div className={`font-semibold ${compact ? "text-[14px]" : "text-[15px]"} leading-snug`} data-testid="text-goal-title">{title}</div>
        </div>
        {!compact && <StatusChip p={p} />}
        {onEdit && <button className="icon-btn shrink-0" aria-label={`Edit ${title}`} onClick={onEdit} data-testid={`button-edit-goal-${goal.id}`}><Pencil size={15} /></button>}
      </div>
      <div className="mt-2"><Bar pct={p.pct * 100} /></div>
      <div className="flex justify-between gap-2 mt-1.5 text-xs">
        <span className="mono" data-testid="text-goal-current">{p.current}</span>
        <span className="mono muted">{Math.round(p.pct * 100)}% · {p.target}</span>
      </div>
      {!compact && p.note && <p className="text-xs muted mt-1.5" data-testid="text-goal-note">{p.note}</p>}
      {!compact && p.weeksHit && goal.kind === "habit" && <WeekCells hits={p.weeksHit} />}
    </div>
  );
}

/** Goals section under Progress: active goals, finished ones, and the button to add one. */
export function GoalsView() {
  const { state } = useStore();
  const ctx = useGoalCtx();
  const [editing, setEditing] = useState<PersonalGoal | "new" | null>(null);
  const active = activeGoals(state);
  const done = finishedGoals(state).sort((a, b) => ((a.achievedAt ?? "") < (b.achievedAt ?? "") ? 1 : -1));
  return (
    <div data-testid="view-goals">
      <p className="text-sm muted mb-3">Set a number to aim for. Corpus tracks it from your check-ins, workouts and meals, and tells you when you'll likely get there.</p>
      {active.length === 0 && <Empty>No goals yet. Add one: a bodyweight, a lift, or a weekly habit.</Empty>}
      {active.map((g) => <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />)}
      <button className="btn btn-primary btn-block mt-3" onClick={() => setEditing("new")} data-testid="button-new-goal"><Plus size={16} /> New goal</button>
      {done.length > 0 && (
        <>
          <div className="section-title"><h2>Reached</h2><span className="label">{done.length}</span></div>
          <div className="card" style={{ padding: "4px 14px" }}>
            {done.map((g) => (
              <button key={g.id} className="rowline w-full text-left" onClick={() => setEditing(g)} data-testid={`row-goal-done-${g.id}`}>
                <span className="flex items-center gap-2 min0"><Trophy size={15} className="shrink-0" /><span className="text-sm truncate">{goalTitle(g, ctx.units)}</span></span>
                <span className="mono text-xs muted shrink-0">{g.achievedAt ? fmtDate(g.achievedAt) : ""}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {editing && <GoalEditorSheet goal={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Compact goals block for Today: up to three active goals, or a nudge to set one. */
export function TodayGoals() {
  const { state } = useStore();
  const ui = useUI();
  const [adding, setAdding] = useState(false);
  const active = activeGoals(state);
  const openGoals = () => { ui.setSub("progress", "goals"); ui.setTab("progress"); };
  return (
    <>
      <div className="section-title"><h2>Goals</h2>{active.length > 0 && <button className="label" onClick={openGoals} data-testid="button-all-goals">All goals <ChevronRight size={12} style={{ display: "inline" }} /></button>}</div>
      {active.length === 0 ? (
        <button className="card w-full text-left flex items-center gap-3" onClick={() => setAdding(true)} data-testid="button-set-first-goal">
          <Target size={20} className="shrink-0" />
          <span className="min0 flex-1"><span className="font-semibold text-[15px] block">Set a goal</span><span className="text-sm muted">A bodyweight, a lift target, or a weekly habit.</span></span>
          <Plus size={18} />
        </button>
      ) : (
        <button className="card w-full text-left" style={{ paddingTop: 6, paddingBottom: 6 }} onClick={openGoals} data-testid="card-today-goals">
          {active.slice(0, 3).map((g, i) => (
            <div key={g.id} style={i ? { borderTop: "1px solid var(--line)" } : undefined}><GoalCard goal={g} compact /></div>
          ))}
          {active.length > 3 && <p className="text-xs muted py-1">+{active.length - 3} more</p>}
        </button>
      )}
      {adding && <GoalEditorSheet onClose={() => setAdding(false)} />}
    </>
  );
}

/* ---------------- editor ---------------- */

const DEADLINE_CHIPS = [{ l: "None", w: 0 }, { l: "4 wk", w: 4 }, { l: "8 wk", w: 8 }, { l: "12 wk", w: 12 }, { l: "6 mo", w: 26 }];
const liftStep = (u: Units) => (u === "lb" ? 5 : 2.5);

export function GoalEditorSheet({ goal, onClose }: { goal?: PersonalGoal; onClose: () => void }) {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const u = profile.units;
  const today = dateKey();
  const bw = currentBodyweight(state) ?? profile.bodyWeight;
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? "bodyweight");
  const [title, setTitle] = useState(goal?.title ?? "");
  const [deadline, setDeadline] = useState<string>(goal?.deadline ?? "");
  // bodyweight
  const [bwTarget, setBwTarget] = useState<number | null>(goal?.kind === "bodyweight" ? goal.target : Math.round(bw * (profile.goal === "fatloss" ? 0.95 : profile.goal === "muscle" ? 1.03 : 1)));
  // lift
  const [exId, setExId] = useState<string | null>(goal?.kind === "lift" ? goal.exId : null);
  const [weight, setWeight] = useState<number | null>(goal?.kind === "lift" ? goal.weight : null);
  const [reps, setReps] = useState<number>(goal?.kind === "lift" ? goal.reps : 1);
  const [picking, setPicking] = useState(false);
  // cardio
  const cg = goal?.kind === "cardio" ? goal : null;
  const [activity, setActivity] = useState<ActivityType>(cg?.activity ?? "run");
  const [cMetric, setCMetric] = useState<"time" | "weekly" | "longest">(cg?.metric ?? "time");
  const [cDistKm, setCDistKm] = useState<number | null>(cg?.distanceKm ?? 5);
  const [cTime, setCTime] = useState(cg?.timeSec ? fmtDuration(cg.timeSec) : "");
  const [cWeeks, setCWeeks] = useState<number | null>(cg?.weeks ?? null);
  // habit
  const [metric, setMetric] = useState<HabitMetric>(goal?.kind === "habit" ? goal.metric : "workouts");
  const [perWeek, setPerWeek] = useState<number>(goal?.kind === "habit" ? goal.perWeek : 4);
  const [weeks, setWeeks] = useState<number | null>(goal?.kind === "habit" ? goal.weeks ?? null : 8);
  const [sleepHours, setSleepHours] = useState<number>(goal?.kind === "habit" ? goal.sleepHours ?? 7 : 7);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const preds = kind === "cardio" && cMetric === "time" && cDistKm ? predictedTimes(state.activities, activity, cDistKm).filter((p) => daysBetween(p.date, today) <= 42) : [];
  const predNow = preds.length ? Math.round(Math.min(...preds.slice(-3).map((p) => p.sec))) : null;
  const bestE1 = exId ? recentBestE1rm(state.sessions, exId, today) : 0;
  const prevBest = exId && !goal ? bestSetAtReps(state.sessions, exId, reps) : null;
  const beaten = prevBest && weight && prevBest.weight >= weight ? prevBest : null;
  const pickLift = (id: string) => {
    setExId(id); setPicking(false);
    if (weight == null) {
      const best = recentBestE1rm(state.sessions, id, today);
      // Suggest the next round number a bit above today's estimated max.
      if (best > 0) setWeight(roundTo(best * 1.05 + liftStep(u) / 2, liftStep(u)));
    }
  };

  const missing = kind === "bodyweight" ? (bwTarget == null || bwTarget <= 0 ? "Enter a target weight." : null)
    : kind === "lift" ? (!exId ? "Pick the lift." : !weight || weight <= 0 ? "Enter the target weight." : null)
    : kind === "cardio" ? (!cDistKm || cDistKm <= 0 ? "Enter the distance." : cMetric === "time" && !parseDuration(cTime) ? "Enter a target time, like 25:00." : null)
    : null;
  const deadlineBad = deadline && deadline <= today && !goal ? "Pick a deadline in the future." : null;

  const build = (): PersonalGoal | null => {
    const base = { id: goal?.id ?? newId("goal"), createdAt: goal?.createdAt ?? today, ...(title.trim() ? { title: title.trim().slice(0, 60) } : {}), deadline: deadline || null, achievedAt: goal?.achievedAt ?? null, ...(goal?.archived ? { archived: true } : {}) };
    if (kind === "bodyweight" && bwTarget) return { ...base, kind, start: goal?.kind === "bodyweight" ? goal.start : bw, target: bwTarget };
    if (kind === "lift" && exId && weight) {
      const keepStart = goal?.kind === "lift" && goal.exId === exId;
      return { ...base, kind, exId, weight, reps, startE1rm: keepStart ? (goal as Extract<PersonalGoal, { kind: "lift" }>).startE1rm : bestE1 };
    }
    if (kind === "cardio" && cDistKm) {
      const timeSec = cMetric === "time" ? parseDuration(cTime) : null;
      const keep = cg && cg.activity === activity && cg.metric === cMetric && Math.abs(cg.distanceKm - cDistKm) < 1e-6;
      return { ...base, kind, activity, metric: cMetric, distanceKm: cDistKm, ...(timeSec ? { timeSec, startSec: keep ? cg!.startSec ?? predNow : predNow } : {}), ...(cMetric === "weekly" ? { weeks: cWeeks || null } : {}) };
    }
    if (kind === "habit") return { ...base, kind, metric, perWeek, weeks: weeks || null, ...(metric === "sleep" ? { sleepHours } : {}) };
    return null;
  };

  const save = () => {
    setTried(true);
    if (missing || deadlineBad) return;
    const g = build();
    if (!g) return;
    set((s) => ({ ...s, goals: goal ? (s.goals ?? []).map((x) => (x.id === g.id ? g : x)) : [...(s.goals ?? []), g] }));
    ui.toast(goal ? "Goal updated" : "Goal set");
    onClose();
  };
  const remove = () => {
    if (!goal) return;
    set((s) => ({ ...s, goals: (s.goals ?? []).filter((x) => x.id !== goal.id) }));
    ui.toast("Goal deleted");
    onClose();
  };
  const markDone = () => {
    if (!goal) return;
    set((s) => ({ ...s, goals: (s.goals ?? []).map((x) => (x.id === goal.id ? { ...x, achievedAt: today } : x)) }));
    ui.toast(`Goal reached: ${goalTitle(goal, u)}`);
    onClose();
  };
  const reopen = () => {
    if (!goal) return;
    set((s) => ({ ...s, goals: (s.goals ?? []).map((x) => (x.id === goal.id ? { ...x, achievedAt: null } : x)) }));
    onClose();
  };

  const preview = build();
  const gctx = useGoalCtx();
  const alreadyMet = !goal && preview && !missing && kind !== "lift" && goalProgress(preview, gctx).achieved;
  const deadlineWeeks = deadline ? Math.round(daysBetween(today, deadline) / 7) : 0;

  if (picking) return <ExercisePicker title="Pick the lift" onClose={() => setPicking(false)} onPick={pickLift} />;

  return (
    <Sheet title={goal ? "Edit goal" : "New goal"} onClose={onClose} full testId="sheet-goal-editor">
      {!goal && (
        <>
          <div className="label mb-2">Type</div>
          <Seg value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as GoalKind[]).map((k) => ({ v: k, l: KIND_LABEL[k] }))} testId="seg-goal-kind" />
        </>
      )}

      {kind === "bodyweight" && (
        <div className="mt-4">
          <div className="rowline"><span className="text-sm muted">Now</span><span className="mono text-sm" data-testid="text-goal-bw-now">{fmtW(currentBodyweight(state) ?? bw)} {u}</span></div>
          <label className="field mt-3">
            <span className="label">Target weight ({u})</span>
            <NumInput value={bwTarget} onChange={setBwTarget} min={50} max={1000} decimals={1} allowEmpty data-testid="input-goal-bw-target" />
          </label>
          <p className="text-xs faint mt-2">Tracked from the weight in your daily check-in.</p>
        </div>
      )}

      {kind === "lift" && (
        <div className="mt-4">
          <span className="label">Lift</span>
          <button className="card-flat w-full text-left flex items-center justify-between mt-1" onClick={() => setPicking(true)} data-testid="button-goal-pick-lift">
            <span className={exId ? "font-semibold" : "muted"}>{exId ? EX[exId].name : "Choose an exercise"}</span><ChevronRight size={16} />
          </button>
          {exId && <p className="text-xs muted mt-1.5" data-testid="text-goal-lift-best">{bestE1 > 0 ? `Your estimated max right now: ${fmtW(Math.round(bestE1))} ${u}` : "No recent sets logged for this lift."}</p>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="field">
              <span className="label">Weight ({u})</span>
              <NumInput value={weight} onChange={setWeight} min={0} max={2000} decimals={2} allowEmpty data-testid="input-goal-lift-weight" />
            </label>
            <div className="field">
              <span className="label">Reps</span>
              <Stepper value={reps} onChange={(v) => setReps(Math.max(1, Math.round(v)))} min={1} max={50} decimals={0} testId="stepper-goal-reps" />
            </div>
          </div>
          <p className="text-xs faint mt-2">Counts when you log a set of at least this weight for at least this many reps.</p>
          {beaten && <p className="text-sm mt-2" role="status" data-testid="text-goal-already-beaten">You've already done {fmtW(beaten.weight)} × {beaten.reps} ({fmtDate(beaten.date)}). Aim higher? Only sets from today on count toward this goal.</p>}
        </div>
      )}

      {kind === "cardio" && (
        <div className="mt-4">
          <div className="label mb-2">Activity</div>
          <div className="flex flex-wrap gap-2">
            {DISTANCE_TYPES.map((t) => <button key={t} type="button" className="chip chip-pick" aria-pressed={activity === t} onClick={() => setActivity(t)} data-testid={`chip-goal-activity-${t}`}>{ACTIVITY[t].label}</button>)}
          </div>
          <div className="label mt-4 mb-2">Goal</div>
          <Seg value={cMetric} onChange={setCMetric} options={[{ v: "time", l: "Time" }, { v: "weekly", l: "Weekly distance" }, { v: "longest", l: "Distance" }]} testId="seg-goal-cardio-metric" />
          <p className="text-xs faint mt-2">{cMetric === "time" ? "Cover a distance in a target time." : cMetric === "weekly" ? "Hit a total distance every week." : "Go this far in one session."}</p>
          {(activity === "run" || activity === "walk") && cMetric !== "weekly" && (
            <div className="flex flex-wrap gap-2 mt-3">
              {RACES.map((r) => <button key={r.name} type="button" className="chip chip-pick" style={{ minHeight: 36 }} aria-pressed={cDistKm != null && Math.abs(cDistKm - r.km) < 0.001} onClick={() => setCDistKm(r.km)} data-testid={`chip-goal-race-${r.name.replace(/\s+/g, "-")}`}>{r.name === "half marathon" ? "Half" : r.name === "marathon" ? "Marathon" : r.name}</button>)}
            </div>
          )}
          <div className={`grid ${cMetric === "time" ? "grid-cols-2" : "grid-cols-1"} gap-3 mt-3`}>
            <label className="field">
              <span className="label">{cMetric === "weekly" ? "Per week" : "Distance"} ({activity === "swim" ? swimUnit(u) : distUnit(u)})</span>
              <NumInput value={cDistKm == null ? null : activity === "swim" ? Math.round(kmToSwim(cDistKm, u)) : Math.round(fromKm(cDistKm, u) * 100) / 100}
                onChange={(v) => setCDistKm(v == null ? null : activity === "swim" ? swimToKm(v, u) : toKm(v, u))} min={0} max={activity === "swim" ? 100000 : 2000} decimals={activity === "swim" ? 0 : 2} allowEmpty data-testid="input-goal-cardio-distance" />
            </label>
            {cMetric === "time" && (
              <label className="field">
                <span className="label">Target time</span>
                <input className="input mono" inputMode="numeric" value={cTime} onChange={(e) => setCTime(e.target.value.replace(/[^0-9:]/g, ""))} placeholder="mm:ss or h:mm:ss" data-testid="input-goal-cardio-time" />
              </label>
            )}
          </div>
          {cMetric === "time" && <p className="text-xs muted mt-1.5" data-testid="text-goal-cardio-predicted">{predNow ? `Predicted from your recent ${ACTIVITY[activity].label.toLowerCase()}s: ${fmtDuration(predNow)}` : `Log a ${ACTIVITY[activity].label.toLowerCase()} of at least half the distance and we'll predict your time.`}</p>}
          {cMetric === "weekly" && (
            <>
              <div className="label mt-4 mb-2">How long</div>
              <Seg value={cWeeks ? "weeks" : "ongoing"} onChange={(v) => setCWeeks(v === "weeks" ? cWeeks || 8 : null)} options={[{ v: "weeks", l: "Weeks in a row" }, { v: "ongoing", l: "Ongoing" }]} testId="seg-goal-cardio-duration" />
              {cWeeks ? <div className="mt-3"><Stepper value={cWeeks} onChange={(v) => setCWeeks(Math.min(52, Math.max(1, Math.round(v))))} min={1} max={52} decimals={0} unit="weeks" testId="stepper-goal-cardio-weeks" /></div> : null}
            </>
          )}
        </div>
      )}

      {kind === "habit" && (
        <div className="mt-4">
          <div className="label mb-2">What</div>
          <Seg value={metric} onChange={setMetric} options={(Object.keys(HABIT_LABEL) as HabitMetric[]).map((m) => ({ v: m, l: HABIT_LABEL[m].noun }))} testId="seg-goal-metric" />
          <p className="text-xs faint mt-2">{HABIT_LABEL[metric].help}.</p>
          <div className={`grid ${metric === "sleep" ? "grid-cols-2" : "grid-cols-1"} gap-3 mt-3`}>
            <div className="field"><span className="label">Times per week</span><Stepper value={perWeek} onChange={(v) => setPerWeek(Math.min(7, Math.max(1, Math.round(v))))} min={1} max={7} decimals={0} testId="stepper-goal-perweek" /></div>
            {metric === "sleep" && <div className="field"><span className="label">Hours or more</span><Stepper value={sleepHours} onChange={setSleepHours} step={0.5} min={4} max={12} decimals={1} unit="h" testId="stepper-goal-sleep" /></div>}
          </div>
          <div className="label mt-4 mb-2">How long</div>
          <Seg value={weeks ? "weeks" : "ongoing"} onChange={(v) => setWeeks(v === "weeks" ? weeks || 8 : null)} options={[{ v: "weeks", l: "Weeks in a row" }, { v: "ongoing", l: "Ongoing" }]} testId="seg-goal-duration" />
          {weeks ? <div className="mt-3"><Stepper value={weeks} onChange={(v) => setWeeks(Math.min(52, Math.max(1, Math.round(v))))} min={1} max={52} decimals={0} unit="weeks" testId="stepper-goal-weeks" /></div> : null}
        </div>
      )}

      {!(kind === "habit" && !weeks) && !(kind === "cardio" && cMetric === "weekly" && !cWeeks) && (
        <>
          <div className="label mt-5 mb-2">Deadline <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
          <div className="flex flex-wrap gap-2">
            {DEADLINE_CHIPS.map((c) => {
              const v = c.w ? addDays(today, c.w * 7) : "";
              return <button key={c.l} type="button" className="chip chip-pick" aria-pressed={c.w ? deadlineWeeks === c.w && !!deadline : !deadline} onClick={() => setDeadline(v)} data-testid={`chip-goal-deadline-${c.w}`}>{c.l}</button>;
            })}
          </div>
          <input type="date" className="input mt-2" value={deadline} min={addDays(today, 1)} onChange={(e) => setDeadline(e.target.value)} aria-label="Deadline date" data-testid="input-goal-deadline" />
        </>
      )}

      <label className="field mt-5">
        <span className="label">Name <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={preview ? goalTitle({ ...preview, title: "" } as PersonalGoal, u) : "e.g. Summer cut"} maxLength={60} data-testid="input-goal-title" />
      </label>

      {preview && !missing && (
        <div className="card-flat mt-5" data-testid="card-goal-preview">
          <div className="label mb-1">Preview</div>
          <GoalPreview goal={preview} />
          {preview.kind === "bodyweight" && <TargetsPreview goal={preview} />}
        </div>
      )}
      {alreadyMet && <p className="text-sm mt-3" role="status" data-testid="text-goal-already-met">What you've already logged meets this target, so it would count as reached right away. Aim higher?</p>}
      {tried && (missing || deadlineBad) && <p className="text-sm mt-4" role="alert" style={{ color: "var(--ink-deep)" }} data-testid="text-goal-error">{missing ?? deadlineBad}</p>}
      <button className="btn btn-primary btn-block btn-lg mt-5" onClick={save} data-testid="button-save-goal">{goal ? "Save changes" : "Set goal"}</button>

      {goal && (
        <div className="flex flex-wrap items-center gap-2 mt-5">
          {!goal.achievedAt
            ? <button className="btn btn-sm btn-outline" onClick={markDone} data-testid="button-goal-mark-done"><Check size={14} /> Mark as reached</button>
            : <button className="btn btn-sm btn-outline" onClick={reopen} data-testid="button-goal-reopen">Not reached yet</button>}
          <div className="flex-1" />
          {confirmDelete ? (
            <>
              <span className="text-sm">Delete this goal?</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)} data-testid="button-goal-delete-cancel">Keep</button>
              <button className="btn btn-sm btn-warn" onClick={remove} data-testid="button-goal-delete-confirm">Delete</button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)} data-testid="button-goal-delete">Delete goal</button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function GoalPreview({ goal }: { goal: PersonalGoal }) {
  const ctx = useGoalCtx();
  const p = goalProgress(goal, ctx);
  return (
    <>
      <p className="text-sm font-semibold">{goalTitle(goal, ctx.units)}</p>
      <div className="mt-2"><Bar pct={p.pct * 100} /></div>
      <p className="text-xs muted mt-1.5">{p.current} → {p.target}{p.note ? ` · ${p.note}` : ""}</p>
    </>
  );
}

/* ---------------- goal-driven nutrition ---------------- */

const fmtRate = (kgPerWeek: number, u: Units) => `${fmtW(Math.round((u === "kg" ? kgPerWeek : kgPerWeek * 2.20462) * 10) / 10)} ${u}/week`;

/** One line explaining that (and how) a bodyweight goal is setting the calorie and protein targets. */
export function WeightPlanNote({ className = "" }: { className?: string }) {
  const { state, targets, profile } = useStore();
  const ui = useUI();
  const plan = targets.weightPlan;
  const goal = weightPlanGoal(state);
  if (!plan || !goal || goal.kind !== "bodyweight") return null;
  const u = profile.units;
  const title = goalTitle(goal, u);
  const today = dateKey();
  const cur = currentBodyweight(state) ?? goal.start;
  const gap = Math.abs(targets.goalAdj);
  let text: string;
  if (plan.dir === "hold") text = `Holding at maintenance: you're at your target.`;
  else {
    const verb = plan.dir === "lose" ? "lose" : "gain";
    text = `Planned to ${verb} about ${fmtRate(plan.kgPerWeek, u)}: ${gap.toLocaleString()} kcal a day ${plan.dir === "lose" ? "under" : "over"} maintenance.`;
    if (plan.defaultPace) text += " No deadline set, so this uses a steady default pace.";
    if (plan.capped) {
      const weeks = Math.abs(goal.target - cur) / (u === "kg" ? plan.kgPerWeek : plan.kgPerWeek * 2.20462);
      const eta = addDays(today, Math.ceil(weeks * 7));
      text += ` Your deadline would need a faster rate than is safe, so this is capped. At this pace you'd get there around ${fmtDate(eta)}.`;
    }
  }
  const open = () => { ui.setSub("progress", "goals"); ui.setTab("progress"); };
  return (
    <p className={`text-xs muted ${className}`} data-testid="text-weight-plan">
      <button className="underline" onClick={open} data-testid="button-weight-plan-goal">Set by your goal: {title}{goal.deadline ? ` by ${fmtDate(goal.deadline)}` : ""}</button>. {text}
    </p>
  );
}

/** In the goal editor: what the daily targets become if this bodyweight goal is saved. */
function TargetsPreview({ goal }: { goal: Extract<PersonalGoal, { kind: "bodyweight" }> }) {
  const { state, profile, targets } = useStore();
  const today = dateKey();
  const cur = currentBodyweight(state) ?? profile.bodyWeight;
  const left = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const next = nutritionTargets(profile, trainingDaysPerWeek(state.program), { currentKg: toKg(cur, profile.units), targetKg: toKg(goal.target, profile.units), daysLeft: left != null && left > 0 ? left : null });
  const same = next.cal === targets.cal && next.protein === targets.protein;
  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }} data-testid="card-goal-targets-preview">
      <div className="label mb-1">Your daily targets {same ? "stay" : "become"}</div>
      <p className="text-sm"><b className="mono">{next.cal.toLocaleString()}</b> kcal{!same && next.cal !== targets.cal ? <span className="muted"> (now {targets.cal.toLocaleString()})</span> : null} · <b className="mono">{next.protein}</b> g protein{!same && next.protein !== targets.protein ? <span className="muted"> (now {targets.protein})</span> : null}</p>
      {next.weightPlan?.capped && <p className="text-xs mt-1" data-testid="text-goal-capped">That deadline needs a faster rate than is safe, so calories are capped at {fmtRate(next.weightPlan.kgPerWeek, profile.units)}{next.weightPlan.dir === "lose" ? " and never below your BMR" : ""}. Consider a later deadline.</p>}
      <p className="text-xs faint mt-1">Calories follow your goal while it's active: about {profile.units === "kg" ? "7,700 kcal per kg" : "3,500 kcal per lb"} of change, spread over the time left.</p>
    </div>
  );
}
