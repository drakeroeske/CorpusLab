import { useState } from "react";
import { ArrowLeft, ArrowRight, Database } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import type { Experience, Goal, Profile, Program, Sex, Units } from "@/lib/types";
import { TEMPLATES, buildTemplate, newId } from "@/lib/exercises";
import { dateKey, nutritionTargets, trainingDaysPerWeek } from "@/lib/engine";
import { NumInput, Seg, Wordmark } from "@/components/ui";
import { ProgramEditor } from "@/components/ProgramEditor";
import { buildDemo } from "@/lib/demo";
import { useAuth } from "@/lib/auth";

export default function Onboarding() {
  const { set, replace, mode } = useStore();
  const ui = useUI();
  const [step, setStep] = useState(0);
  const { me } = useAuth();
  const [p, setP] = useState<Profile>({ name: me?.displayName ?? "", units: "lb", bodyWeight: 175, heightCm: 178, age: 30, sex: null, experience: "intermediate", goal: "muscle", gym: "", coachMode: me?.role === "coach", onboarded: false, barWeight: 45 });
  const [ft, setFt] = useState({ ft: 5, inch: 10 });
  const [tpl, setTpl] = useState<string>("ul4");
  const [program, setProgram] = useState<Program | null>(null);

  const upd = (x: Partial<Profile>) => setP((o) => ({ ...o, ...x }));
  const heightCm = p.units === "lb" ? Math.round((ft.ft * 12 + ft.inch) * 2.54) : p.heightCm;
  const prof = { ...p, heightCm };
  const finalProgram = program ?? buildTemplate(tpl, p.units, p.experience, dateKey());
  const targets = nutritionTargets(prof, trainingDaysPerWeek(finalProgram));

  const finish = () => {
    set((s) => ({ ...s, profile: { ...prof, onboarded: true, name: prof.name || "Athlete", barWeight: p.units === "lb" ? 45 : 20 }, program: finalProgram, chat: [{ id: newId("m"), role: "coach", ts: Date.now(), text: "I'll learn from every check-in, set, and meal you log. Ask me anything once you have a few days of data." }] }));
    ui.toast("Program ready. Do your first check-in.");
  };

  const steps = ["Welcome", "Profile", "Goal", "Program", "Targets"];
  return (
    <div className="app">
      <div className="topbar">
        {step > 0 ? <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="Back" data-testid="button-onboard-back"><ArrowLeft size={18} /></button> : <Wordmark />}
        <div className="flex-1" />
        {step > 0 && <span className="label">Step {step}/4 · {steps[step]}</span>}
      </div>
      <div className="screen" style={{ paddingBottom: 120 }}>
        {step === 0 && (
          <div className="pt-6">
            <div className="tick-grid card" style={{ padding: 20, background: "var(--bg)" }}>
              <div className="label">Training engine · v1</div>
              <h1 className="text-[28px] leading-tight font-semibold mt-3" style={{ letterSpacing: "-0.02em" }}>Every rep, meal, and night's sleep — connected.</h1>
              <p className="muted mt-3">RXS reads your sleep, recovery, and nutrition, then tells you exactly what to lift today. It learns from every set you log.</p>
              <div className="grid grid-cols-3 gap-2 mt-5">
                {[["Readiness", "0–100"], ["Progress", "per set"], ["Fatigue", "14 groups"]].map(([a, b]) => (
                  <div key={a} className="card-flat" style={{ padding: 10, background: "var(--surface)" }}><div className="label">{a}</div><div className="mono text-sm mt-1">{b}</div></div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-lg btn-block mt-6" onClick={() => setStep(1)} data-testid="button-start-setup">Set up my program <ArrowRight size={18} /></button>
            <button className="btn btn-outline btn-lg btn-block mt-3" onClick={() => { replace(buildDemo()); ui.toast("Demo loaded: 8 weeks of history"); }} data-testid="button-load-demo"><Database size={18} /> Load demo data</button>
            <p className="text-xs faint mt-4 text-center">{mode === "remote" ? "Saved to your account and synced across devices. Export anytime from Profile." : "Everything stays on this device. Export anytime from Profile."}</p>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
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
            <div className="field"><span className="label">Sex (optional — used for calorie estimate)</span>
              <Seg value={p.sex ?? "na"} onChange={(v) => upd({ sex: v === "na" ? null : (v as Sex) })} options={[{ v: "m", l: "Male" }, { v: "f", l: "Female" }, { v: "na", l: "Skip" }]} testId="seg-sex" />
            </div>
            <label className="field"><span className="label">Home gym (optional)</span><input className="input" value={p.gym} onChange={(e) => upd({ gym: e.target.value })} placeholder="e.g. Forge Athletic Club" data-testid="input-gym" /></label>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div className="field"><span className="label">Training experience</span>
              <Seg value={p.experience} onChange={(v: Experience) => upd({ experience: v })} options={[{ v: "beginner", l: "Beginner" }, { v: "intermediate", l: "Intermediate" }, { v: "advanced", l: "Advanced" }]} testId="seg-experience" />
              <p className="text-xs muted">{p.experience === "beginner" ? "< 1 year consistent lifting. Faster progress, lighter start weights." : p.experience === "intermediate" ? "1–4 years. Weekly progression on most lifts." : "4+ years. Slower, more deliberate progression."}</p>
            </div>
            <div className="field"><span className="label">Goal</span>
              <div className="grid grid-cols-2 gap-2">
                {([["muscle", "Build muscle", "+250 kcal · 1.8 g/kg"], ["strength", "Get stronger", "+200 kcal · 1.6 g/kg"], ["fatloss", "Lose fat", "−500 kcal · 2.2 g/kg"], ["recomp", "Recomp", "−150 kcal · 2.0 g/kg"]] as [Goal, string, string][]).map(([g, l, s]) => (
                  <button key={g} className="card-flat text-left" style={{ borderColor: p.goal === g ? "var(--lime)" : undefined, background: p.goal === g ? "var(--lime-dim)" : undefined, minHeight: 72 }} onClick={() => upd({ goal: g })} aria-pressed={p.goal === g ? "true" : "false"} data-testid={`goal-${g}`}>
                    <div className="font-semibold">{l}</div><div className="mono text-[11px] muted mt-1">{s}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            {!program ? (
              <>
                <div className="label mb-2">Start from a template</div>
                <div className="stack">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} className="card text-left w-full" style={{ borderColor: tpl === t.id ? "var(--lime)" : undefined }} onClick={() => setTpl(t.id)} aria-pressed={tpl === t.id ? "true" : "false"} data-testid={`template-${t.id}`}>
                      <div className="flex items-center justify-between"><span className="font-semibold">{t.name}</span><span className="chip">{t.desc}</span></div>
                      <div className="text-xs muted mt-2">{t.days.map((d) => d.name).join(" · ")}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-outline flex-1" onClick={() => setProgram(buildTemplate(tpl, p.units, p.experience, dateKey()))} data-testid="button-customize-template">Customize template</button>
                  <button className="btn btn-outline flex-1" onClick={() => setProgram({ name: "My Program", startDate: dateKey(), days: [{ id: newId("day"), name: "Day 1", weekdays: [1], exercises: [] }] })} data-testid="button-build-scratch">Build from scratch</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3"><span className="label">Program builder</span><button className="btn btn-ghost btn-sm" onClick={() => setProgram(null)}>Back to templates</button></div>
                <ProgramEditor program={program} units={p.units} onChange={setProgram} />
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <div className="card">
              <div className="label">Daily calories</div>
              <div className="big-num text-[40px] mt-2" data-testid="text-target-calories">{targets.cal}<span className="text-base muted ml-1">kcal</span></div>
              <div className="mono text-xs muted mt-2">BMR {targets.bmr} (Mifflin–St Jeor) × {targets.activity} activity = {targets.tdee} TDEE {targets.goalAdj >= 0 ? "+" : "−"} {Math.abs(targets.goalAdj)} goal</div>
              <div className="divider" />
              <div className="flex justify-between mono text-sm"><span className="muted">Training days</span><span>{targets.trainingCal}</span></div>
              <div className="flex justify-between mono text-sm mt-1"><span className="muted">Rest days</span><span>{targets.restCal}</span></div>
            </div>
            <div className="card">
              <div className="label">Daily protein</div>
              <div className="big-num text-[40px] mt-2" data-testid="text-target-protein">{targets.protein}<span className="text-base muted ml-1">g</span></div>
              <div className="mono text-xs muted mt-2">{targets.proteinPerKg} g/kg body weight (range 1.6–2.2)</div>
            </div>
            <div className="card-flat text-sm muted">{finalProgram.name} · {finalProgram.days.length} days/week · {finalProgram.days.reduce((a, d) => a + d.exercises.length, 0)} exercises</div>
          </div>
        )}
      </div>
      {step > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
          {step < 4 ? (
            <button className="btn btn-primary btn-lg btn-block" disabled={step === 3 && program != null && program.days.every((d) => !d.exercises.length || !d.weekdays.length)} onClick={() => setStep(step + 1)} data-testid="button-onboard-next">Continue <ArrowRight size={18} /></button>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" onClick={finish} data-testid="button-finish-onboarding">Start training</button>
          )}
        </div>
      )}
    </div>
  );
}
