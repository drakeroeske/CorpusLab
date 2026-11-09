import { Info } from "@/components/Term";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Database } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { Experience, Goal, Profile, Program, Sex, Units } from "@/lib/types";
import { TEMPLATES, buildTemplate, newId } from "@/lib/exercises";
import { dateKey, nutritionTargets, trainingDaysPerWeek } from "@/lib/engine";
import { NumInput, Seg, Wordmark } from "@/components/ui";
import { buildDemo } from "@/lib/demo";
import { useAuth } from "@/lib/auth";

const STEPS = ["About you", "Your goal", "Pick a program"];
const OWN = "own";
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Account setup: 3 short steps. Custom programs and the finer settings come later. */
export default function Onboarding() {
  const { set, replace, mode } = useStore();
  const ui = useUI();
  const [step, setStep] = useState(0);
  const { me } = useAuth();
  const [p, setP] = useState<Profile>({ name: me?.displayName ?? "", units: "lb", bodyWeight: 175, heightCm: 178, age: 30, sex: null, experience: "intermediate", goal: "muscle", gym: "", coachMode: me?.role === "coach", onboarded: false, barWeight: 45 });
  const [ft, setFt] = useState({ ft: 5, inch: 10 });
  const [tpl, setTpl] = useState<string>("ul4");
  const [howOpen, setHowOpen] = useState(false);
  const [ownDays, setOwnDays] = useState<number[]>([1, 3, 5]);

  const upd = (x: Partial<Profile>) => setP((o) => ({ ...o, ...x }));
  const heightCm = p.units === "lb" ? Math.round((ft.ft * 12 + ft.inch) * 2.54) : p.heightCm;
  const prof = { ...p, heightCm };
  // "Build my own": one empty day per chosen weekday; exercises get added after setup.
  const program: Program = tpl === OWN
    ? { name: "My program", startDate: dateKey(), days: ownDays.map((w, i) => ({ id: newId("day"), name: `Day ${i + 1}`, weekdays: [w], exercises: [] })) }
    : buildTemplate(tpl, p.units, p.experience, dateKey());
  const targets = nutritionTargets(prof, trainingDaysPerWeek(program));

  const finish = () => {
    set((s) => ({ ...s, profile: { ...prof, onboarded: true, tourDone: false, name: prof.name || "Athlete", barWeight: p.units === "lb" ? 45 : 20 }, program, chat: [{ id: newId("m"), role: "coach", ts: Date.now(), text: "I'll learn from every check-in, set, and meal you log. Ask me anything once you have a few days of data." }] }));
    ui.toast(tpl === OWN ? "You're set. Add exercises to your days in Train → Program." : "You're set. Start with today's check-in.");
  };

  return (
    <div className="app surface-riso">
      <div className="topbar">
        {step > 0 ? <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="Back" data-testid="button-onboard-back"><ArrowLeft size={18} /></button> : <Wordmark />}
        <div className="flex-1" />
        {step > 0 && <span className="label">Step {step} of {STEPS.length} · {STEPS[step - 1]}</span>}
      </div>
      <div className="screen" style={{ paddingBottom: 120 }}>
        {step === 0 && (
          <div className="pt-6">
            <div className="card" style={{ padding: 20 }}>
              <div className="label">Training engine · v1</div>
              <h1 className="display mt-3" style={{ fontSize: "clamp(40px, 13vw, 56px)" }}>Every rep. Every meal. Every night.</h1>
              <p className="mt-3 text-sm">Corpus reads your sleep, recovery, and nutrition, then tells you exactly what to lift today. It learns from every set you log.</p>
              <p className="mt-3 text-sm muted">Setup takes about a minute: 3 quick steps.</p>
            </div>
            <button className="btn btn-primary btn-lg btn-block mt-6" onClick={() => setStep(1)} data-testid="button-start-setup">Set up my program <ArrowRight size={18} /></button>
            <button className="btn btn-outline btn-lg btn-block mt-3" onClick={() => { replace(buildDemo()); ui.toast("Demo loaded: 8 weeks of history"); }} data-testid="button-load-demo"><Database size={18} /> Load demo data</button>
            <p className="text-xs faint mt-4 text-center">{mode === "remote" ? "Saved to your account and synced across devices. Export anytime from Profile." : "Everything stays on this device. Export anytime from Profile."}</p>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <h2 className="display text-[24px]">About you</h2>
            <label className="field"><span className="label">Name</span><input className="input" value={p.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Your name" data-testid="input-name" /></label>
            <div className="field"><span className="label">Units</span>
              <Seg value={p.units} onChange={(u: Units) => upd({ units: u, bodyWeight: u === "kg" ? Math.round(p.bodyWeight / 2.20462) : Math.round(p.bodyWeight * 2.20462) })} options={[{ v: "lb", l: "lb / ft" }, { v: "kg", l: "kg / cm" }]} testId="seg-units" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="field"><span className="label">Body weight ({p.units})</span><NumInput value={p.bodyWeight} min={0} onChange={(v) => v !== null && upd({ bodyWeight: v })} data-testid="input-bodyweight" /></label>
              <label className="field"><span className="label">Age</span><NumInput value={p.age} min={0} onChange={(v) => v !== null && upd({ age: v })} data-testid="input-age" /></label>
            </div>
            {p.units === "lb" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="field"><span className="label">Height ft</span><NumInput integer value={ft.ft} min={0} onChange={(v) => v !== null && setFt({ ...ft, ft: v })} data-testid="input-height-ft" /></label>
                <label className="field"><span className="label">Height in</span><NumInput integer value={ft.inch} min={0} onChange={(v) => v !== null && setFt({ ...ft, inch: v })} data-testid="input-height-in" /></label>
              </div>
            ) : (
              <label className="field"><span className="label">Height (cm)</span><NumInput value={p.heightCm} min={0} onChange={(v) => v !== null && upd({ heightCm: v })} data-testid="input-height-cm" /></label>
            )}
            <div className="field"><span className="label">Sex (optional, used for the calorie estimate)</span>
              <Seg value={p.sex ?? "na"} onChange={(v) => upd({ sex: v === "na" ? null : (v as Sex) })} options={[{ v: "m", l: "Male" }, { v: "f", l: "Female" }, { v: "na", l: "Skip" }]} testId="seg-sex" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <h2 className="display text-[24px]">Your goal</h2>
            <div className="field"><span className="label">What do you want most?</span>
              <div className="grid grid-cols-2 gap-2">
                {([["muscle", "Build muscle"], ["strength", "Get stronger"], ["fatloss", "Lose fat"], ["recomp", "Lose fat & build muscle"]] as [Goal, string][]).map(([g, l]) => (
                  <button key={g} className={`card-flat text-left pick ${p.goal === g ? "picked" : ""}`} style={{ minHeight: 64 }} onClick={() => upd({ goal: g })} aria-pressed={p.goal === g ? "true" : "false"} data-testid={`goal-${g}`}>
                    <div className="font-semibold">{l}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><span className="label">How long have you been lifting?</span>
              <Seg value={p.experience} onChange={(v: Experience) => upd({ experience: v })} options={[{ v: "beginner", l: "< 1 year" }, { v: "intermediate", l: "1–4 years" }, { v: "advanced", l: "4+ years" }]} testId="seg-experience" />
              <p className="text-xs muted">{p.experience === "beginner" ? "Lighter starting weights and faster progress." : p.experience === "intermediate" ? "Weights go up most weeks on most lifts." : "Slower, more deliberate progression."}</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="display text-[24px]">Pick a program</h2>
            <p className="text-sm muted mt-1 mb-3">Start from a ready-made program or build your own. You can change it anytime in Train → Program.</p>
            <div className="stack">
              {TEMPLATES.map((t) => (
                <button key={t.id} className={`card w-full text-left pick ${tpl === t.id ? "picked" : ""}`} onClick={() => setTpl(t.id)} aria-pressed={tpl === t.id ? "true" : "false"} data-testid={`template-${t.id}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{t.name}</span><span className="chip">{t.desc}</span></div>
                  <div className="text-xs muted mt-2">{t.days.map((d) => d.name).join(" · ")}</div>
                </button>
              ))}
              <button className={`card w-full text-left pick ${tpl === OWN ? "picked" : ""}`} onClick={() => setTpl(OWN)} aria-pressed={tpl === OWN ? "true" : "false"} data-testid="template-own">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">Build my own</span><span className="chip">{ownDays.length} day{ownDays.length === 1 ? "" : "s"}</span></div>
                <div className="text-xs muted mt-2">Pick your training days now and add exercises after setup.</div>
              </button>
              {tpl === OWN && (
                <div className="card" data-testid="card-own-days">
                  <div className="label mb-2">Which days do you train?</div>
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label="Training days">
                    {WD.map((w, i) => {
                      const on = ownDays.includes(i);
                      return (
                        <button key={i} type="button" aria-pressed={on ? "true" : "false"} aria-label={WD_LONG[i]} onClick={() => setOwnDays((cur) => (cur.includes(i) ? cur.filter((d) => d !== i) : [...cur, i].sort()))}
                          className="text-sm font-semibold" data-testid={`own-day-${i}`}
                          style={{ minHeight: 44, borderRadius: 6, border: "1px solid var(--line-strong)", background: on ? "var(--ink)" : "transparent", color: on ? "var(--page)" : "var(--fg)" }}>{w}</button>
                      );
                    })}
                  </div>
                  {ownDays.length === 0 && <p className="text-xs mt-2" style={{ color: "var(--ink-deep)" }} role="alert">Pick at least one day.</p>}
                </div>
              )}
            </div>
            <div className="card mt-4" data-testid="card-targets-summary">
              <p className="text-[15px]">You'll aim for <b className="mono" data-testid="text-target-calories">{targets.cal.toLocaleString()}</b> kcal and <b className="mono" data-testid="text-target-protein">{targets.protein}</b> g protein a day.</p>
              <button className="btn btn-sm btn-ghost mt-1" style={{ paddingLeft: 0 }} onClick={() => setHowOpen(!howOpen)} aria-expanded={howOpen} data-testid="button-targets-how">
                {howOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />} How is this worked out?
              </button>
              {howOpen && (
                <div className="text-sm muted mt-1 stack" style={{ gap: 6 }}>
                  <p>Your body burns about <b>{targets.tdee.toLocaleString()}</b> kcal a day <Info k="tdee" size={13} />, estimated from your size, age and training days. Your goal adjusts that by {targets.goalAdj >= 0 ? "+" : "−"}{Math.abs(targets.goalAdj)} kcal.</p>
                  <p>Training days: {targets.trainingCal.toLocaleString()} kcal · rest days: {targets.restCal.toLocaleString()} kcal.</p>
                  <p>Protein: {targets.proteinPerKg} g per kg of body weight. You can change all of this later in Profile.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {step > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "var(--page)", borderTop: "1px solid var(--line)" }}>
          {step < 3 ? (
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(step + 1)} data-testid="button-onboard-next">Continue <ArrowRight size={18} /></button>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" disabled={tpl === OWN && ownDays.length === 0} onClick={finish} data-testid="button-finish-onboarding">Start training <ArrowRight size={18} /></button>
          )}
        </div>
      )}
    </div>
  );
}
