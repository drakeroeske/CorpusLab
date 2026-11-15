// Log a run, ride, swim, class, sport or CrossFit WOD (anything that isn't sets × reps).
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { Activity, ActivityType, WodFormat } from "@/lib/types";
import { newId } from "@/lib/exercises";
import { dateKey, fmtDate } from "@/lib/engine";
import {
  ACTIVITY, ACTIVITY_GROUPS, EFFORT, WOD_CARDIO, WOD_FORMAT_LABEL, WOD_QUICK, activitySummary, activityTitle, distUnit, effortLabel,
  fmtDistance, fmtDuration, fmtPace, fromKm, kmToSwim, movementName, parseDuration, swimToKm, swimUnit, toKm,
} from "@/lib/activities";
import { NumInput, Seg, Sheet, Stepper } from "./ui";
import { ExercisePicker } from "./ProgramEditor";

/** Start time for a log on `date`: now if it's today, otherwise midday so it sorts sensibly. */
const startFor = (date: string, durationSec: number) => (date === dateKey() ? Date.now() - durationSec * 1000 : Date.parse(`${date}T12:00:00`));

export function ActivitySheet({ activity, initialType, onClose }: { activity?: Activity; initialType?: ActivityType; onClose: () => void }) {
  const { set, profile } = useStore();
  const ui = useUI();
  const u = profile.units;
  const today = dateKey();
  const [type, setType] = useState<ActivityType | null>(activity?.type ?? initialType ?? null);
  const [date, setDate] = useState(activity?.date ?? today);
  const [dur, setDur] = useState(activity ? fmtDuration(activity.durationSec) : "");
  const [dist, setDist] = useState<number | null>(activity?.distanceKm ? (activity.type === "swim" ? Math.round(kmToSwim(activity.distanceKm, u)) : Math.round(fromKm(activity.distanceKm, u) * 100) / 100) : null);
  const [rpe, setRpe] = useState<number | null>(activity?.rpe ?? null);
  const [hr, setHr] = useState<number | null>(activity?.avgHr ?? null);
  const [name, setName] = useState(activity?.name ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  // WOD
  const w = activity?.wod;
  const [format, setFormat] = useState<WodFormat>(w?.format ?? "for_time");
  const [amrapMin, setAmrapMin] = useState<number>(activity?.type === "wod" && w?.format !== "for_time" ? Math.round(activity.durationSec / 60) : 12);
  const [rounds, setRounds] = useState<number | null>(w?.rounds ?? null);
  const [reps, setReps] = useState<number | null>(w?.reps ?? null);
  const [cap, setCap] = useState<number | null>(w?.capSec ? Math.round(w.capSec / 60) : null);
  const [score, setScore] = useState(w?.score ?? "");
  const [rx, setRx] = useState(w?.rx ?? true);
  const [moves, setMoves] = useState<string[]>(w?.movements ?? []);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  const meta = type ? ACTIVITY[type] : null;
  const isWod = type === "wod";
  const timedByFormat = isWod && format !== "for_time";
  const durSec = timedByFormat ? amrapMin * 60 : parseDuration(dur);
  const distKm = meta?.distance && dist ? (type === "swim" ? swimToKm(dist, u) : toKm(dist, u)) : null;
  const dUnit = type === "swim" ? swimUnit(u) : distUnit(u);
  const pace = type && durSec && distKm ? fmtPace({ type, durationSec: durSec, distanceKm: distKm }, u) : null;

  const missing = !type ? "Pick what you did." : !durSec || durSec <= 0 ? (isWod && format === "for_time" ? "Enter your time, like 7:45." : "Enter how long it took, like 45 or 42:30.") : date > today ? "The date can't be in the future." : null;

  const build = (): Activity | null => {
    if (!type || !durSec) return null;
    return {
      id: activity?.id ?? newId("act"), type, date, start: activity && activity.date === date ? activity.start : startFor(date, durSec), durationSec: durSec,
      ...(distKm ? { distanceKm: Math.round(distKm * 1000) / 1000 } : {}),
      ...(rpe != null ? { rpe } : {}), ...(hr ? { avgHr: hr } : {}),
      ...(name.trim() ? { name: name.trim().slice(0, 60) } : {}), ...(notes.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
      ...(isWod ? { wod: { format, rx, movements: moves, ...(format === "amrap" ? { rounds: rounds ?? 0, reps: reps ?? 0 } : format === "emom" && rounds ? { rounds } : {}), ...(format === "for_time" && cap ? { capSec: cap * 60 } : {}), ...(format === "other" && score.trim() ? { score: score.trim().slice(0, 60) } : {}) } } : {}),
    };
  };

  const save = () => {
    setTried(true);
    const a = build();
    if (missing || !a) return;
    set((s) => ({ ...s, activities: activity ? (s.activities ?? []).map((x) => (x.id === a.id ? a : x)) : [...(s.activities ?? []), a] }));
    ui.toast(activity ? "Updated" : `${activityTitle(a)} logged`);
    onClose();
  };
  const remove = () => {
    if (!activity) return;
    set((s) => ({ ...s, activities: (s.activities ?? []).filter((x) => x.id !== activity.id) }));
    ui.toast("Deleted");
    onClose();
  };

  if (picking) return <ExercisePicker title="Add a movement" onClose={() => setPicking(false)} onPick={(id) => { setMoves((m) => [...m, id]); setPicking(false); }} />;

  // Step 1: what did you do?
  if (!type) return (
    <Sheet title="Log an activity" onClose={onClose} testId="sheet-activity">
      {ACTIVITY_GROUPS.map((g) => (
        <div key={g.id} className="mb-4">
          <div className="label mb-2">{g.label}</div>
          <div className="flex flex-wrap gap-2">
            {g.types.map((t) => <button key={t} type="button" className="chip chip-pick" onClick={() => setType(t)} data-testid={`chip-activity-${t}`}>{ACTIVITY[t].label}</button>)}
          </div>
        </div>
      ))}
      <p className="text-xs faint">Lifting goes in a workout. Everything here counts toward recovery, streaks and goals.</p>
    </Sheet>
  );

  return (
    <Sheet title={activity ? `Edit ${ACTIVITY[type].label.toLowerCase()}` : ACTIVITY[type].label} onClose={onClose} full testId="sheet-activity"
      right={!activity ? <button className="btn btn-sm btn-ghost" onClick={() => setType(null)} data-testid="button-activity-change-type">Change</button> : undefined}>
      {(type === "sport" || type === "other") && (
        <label className="field">
          <span className="label">{type === "sport" ? "Sport" : "What"}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "sport" ? "e.g. Basketball, Tennis, Soccer" : "e.g. Climbing, Boxing"} maxLength={60} data-testid="input-activity-name" />
        </label>
      )}

      {isWod && (
        <>
          <label className="field">
            <span className="label">Name <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fran, Murph, Tuesday WOD" maxLength={60} data-testid="input-activity-name" />
          </label>
          <div className="label mt-4 mb-2">Format</div>
          <Seg value={format} onChange={setFormat} options={(Object.keys(WOD_FORMAT_LABEL) as WodFormat[]).map((f) => ({ v: f, l: WOD_FORMAT_LABEL[f] }))} testId="seg-wod-format" />
        </>
      )}

      <div className={`grid ${meta!.distance && !isWod ? "grid-cols-2" : "grid-cols-1"} gap-3 mt-4`}>
        {timedByFormat ? (
          <div className="field"><span className="label">{format === "amrap" ? "AMRAP minutes" : format === "emom" ? "EMOM minutes" : "Minutes"}</span>
            <Stepper value={amrapMin} onChange={(v) => setAmrapMin(Math.max(1, Math.round(v)))} min={1} max={240} decimals={0} unit="min" testId="stepper-wod-minutes" /></div>
        ) : (
          <label className="field">
            <span className="label">{isWod ? "Your time" : "Time"}</span>
            <input className="input mono" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value.replace(/[^0-9:.]/g, ""))} placeholder={isWod ? "mm:ss" : "min or h:mm:ss"} data-testid="input-activity-duration" />
          </label>
        )}
        {meta!.distance && !isWod && (
          <label className="field">
            <span className="label">Distance ({dUnit})</span>
            <NumInput value={dist} onChange={setDist} min={0} max={type === "swim" ? 50000 : 1000} decimals={type === "swim" ? 0 : 2} allowEmpty placeholder="optional" data-testid="input-activity-distance" />
          </label>
        )}
      </div>
      {!timedByFormat && <p className="text-xs faint mt-1.5" data-testid="text-activity-time-read">{durSec ? `${fmtDuration(durSec)}${pace ? ` · ${pace}` : ""}` : "Type 45 for 45 minutes, or 42:30, or 1:05:00."}</p>}

      {isWod && format === "amrap" && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="field"><span className="label">Rounds</span><Stepper value={rounds ?? 0} onChange={(v) => setRounds(Math.max(0, Math.round(v)))} min={0} max={999} decimals={0} testId="stepper-wod-rounds" /></div>
          <div className="field"><span className="label">+ Reps</span><Stepper value={reps ?? 0} onChange={(v) => setReps(Math.max(0, Math.round(v)))} min={0} max={999} decimals={0} testId="stepper-wod-reps" /></div>
        </div>
      )}
      {isWod && format === "emom" && (
        <div className="field mt-3"><span className="label">Rounds completed <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span><Stepper value={rounds ?? 0} onChange={(v) => setRounds(Math.max(0, Math.round(v)))} min={0} max={240} decimals={0} testId="stepper-wod-rounds" /></div>
      )}
      {isWod && format === "for_time" && (
        <label className="field mt-3"><span className="label">Time cap, min <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
          <NumInput value={cap} onChange={setCap} min={1} max={240} integer allowEmpty data-testid="input-wod-cap" /></label>
      )}
      {isWod && format === "other" && (
        <label className="field mt-3"><span className="label">Score</span>
          <input className="input" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 5 rounds + 12, 142 lb, 3:10 per round" maxLength={60} data-testid="input-wod-score" /></label>
      )}
      {isWod && (
        <>
          <div className="label mt-4 mb-2">Rx or scaled</div>
          <Seg value={rx ? "rx" : "scaled"} onChange={(v) => setRx(v === "rx")} options={[{ v: "rx", l: "Rx" }, { v: "scaled", l: "Scaled" }]} testId="seg-wod-rx" />
          <div className="label mt-4 mb-1">Movements</div>
          <p className="text-xs faint mb-2">Used to work out which muscles the WOD hit.</p>
          {moves.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2" data-testid="list-wod-movements">
              {moves.map((m, i) => (
                <span key={i} className="chip" style={{ gap: 6 }}>{movementName(m)}
                  <button type="button" aria-label={`Remove ${movementName(m)}`} onClick={() => setMoves(moves.filter((_, j) => j !== i))} data-testid={`button-remove-movement-${i}`}><X size={12} /></button></span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {WOD_QUICK.filter((m) => !moves.includes(m)).map((m) => (
              <button key={m} type="button" className="chip chip-pick" style={{ minHeight: 36 }} onClick={() => setMoves([...moves, m])} data-testid={`chip-wod-move-${m.replace(":", "-")}`}>+ {movementName(m)}</button>
            ))}
            {WOD_CARDIO.filter((c) => !WOD_QUICK.includes(`act:${c}`) && !moves.includes(`act:${c}`)).map((c) => (
              <button key={c} type="button" className="chip chip-pick" style={{ minHeight: 36 }} onClick={() => setMoves([...moves, `act:${c}`])} data-testid={`chip-wod-move-act-${c}`}>+ {ACTIVITY[c].label}</button>
            ))}
            <button type="button" className="chip chip-pick" style={{ minHeight: 36 }} onClick={() => setPicking(true)} data-testid="button-wod-more-movements"><Plus size={12} /> More…</button>
          </div>
        </>
      )}

      <div className="label mt-5 mb-2">Effort</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Effort">
        {EFFORT.map((e) => (
          <button key={e.rpe} type="button" className="chip chip-pick" aria-pressed={rpe != null && effortLabel(rpe) === e.label} onClick={() => setRpe(rpe != null && effortLabel(rpe) === e.label ? null : e.rpe)} data-testid={`chip-effort-${e.rpe}`}>{e.label}</button>
        ))}
      </div>
      <p className="text-xs faint mt-1.5">Harder sessions count more toward fatigue and readiness.{rpe == null ? ` If you skip this we assume ${effortLabel(ACTIVITY[type].defaultRpe)!.toLowerCase()}.` : ""}</p>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <label className="field"><span className="label">Date</span>
          <input type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} data-testid="input-activity-date" /></label>
        <label className="field"><span className="label">Avg heart rate</span>
          <NumInput value={hr} onChange={setHr} min={30} max={240} integer allowEmpty placeholder="optional" data-testid="input-activity-hr" /></label>
      </div>
      {!isWod && type !== "sport" && type !== "other" && (
        <label className="field mt-4"><span className="label">Name <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "run" ? "e.g. Long run, Tempo, Parkrun" : "e.g. Spin class"} maxLength={60} data-testid="input-activity-name" /></label>
      )}
      <label className="field mt-4"><span className="label">Notes <span className="faint" style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
        <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isWod ? "The workout as written, weights used" : "Route, how it felt"} maxLength={500} data-testid="textarea-activity-notes" /></label>

      {tried && missing && <p className="text-sm mt-4" role="alert" style={{ color: "var(--ink-deep)" }} data-testid="text-activity-error">{missing}</p>}
      <button className="btn btn-primary btn-block btn-lg mt-5" onClick={save} data-testid="button-save-activity">{activity ? "Save changes" : "Log it"}</button>
      {activity && (
        <div className="mt-5">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm flex-1">Delete this {ACTIVITY[activity.type].label.toLowerCase()}?</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)} data-testid="button-activity-delete-cancel">Keep</button>
              <button className="btn btn-sm btn-warn" onClick={remove} data-testid="button-activity-delete-confirm">Delete</button>
            </div>
          ) : <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setConfirmDelete(true)} data-testid="button-activity-delete">Delete</button>}
        </div>
      )}
    </Sheet>
  );
}

/** One activity as a list row (history, Today). Tap to edit. */
export function ActivityRow({ a, onOpen, showDate = true }: { a: Activity; onOpen: () => void; showDate?: boolean }) {
  const { profile } = useStore();
  const eff = effortLabel(a.rpe);
  return (
    <button className="card w-full text-left flex items-center gap-3" style={{ padding: "12px 14px", minHeight: 56 }} onClick={onOpen} data-testid={`row-activity-${a.id}`}>
      <div className="min0 flex-1">
        <div className="font-semibold text-sm">{activityTitle(a)}{a.type !== "sport" && a.name?.trim() && a.name.trim() !== ACTIVITY[a.type].label ? <span className="muted font-normal"> · {ACTIVITY[a.type].label}</span> : null}</div>
        <div className="mono text-[11px] muted">{showDate ? `${fmtDate(a.date, { weekday: "short", month: "short", day: "numeric" })} · ` : ""}{activitySummary(a, profile.units)}{eff ? ` · ${eff}` : ""}</div>
        {a.wod?.movements.length ? <div className="text-[11px] faint truncate">{a.wod.movements.map(movementName).join(" · ")}</div> : null}
      </div>
      <span className="chip shrink-0">{ACTIVITY[a.type].label}</span>
    </button>
  );
}
