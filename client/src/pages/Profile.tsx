import { useRef, useState } from "react";
import { AlertTriangle, Database, Download, MessageSquare, Upload, UserCog } from "lucide-react";
import { useStore, emptyState, storageAvailable } from "@/lib/store";
import { useUI } from "@/App";
import { Seg, Sheet, Spark, Stepper, initials } from "@/components/ui";
import { ProgramEditor } from "@/components/ProgramEditor";
import { buildDemo } from "@/lib/demo";
import { convertUnits, downloadText } from "@/lib/actions";
import { dateKey, fmtDate, mean } from "@/lib/engine";
import { newId } from "@/lib/exercises";
import type { AppState, Client, Experience, Goal, Profile as P, Program, Sex } from "@/lib/types";

const GOALS: { v: Goal; l: string }[] = [{ v: "muscle", l: "Build muscle" }, { v: "strength", l: "Get stronger" }, { v: "fatloss", l: "Lose fat" }, { v: "recomp", l: "Recomp" }];

export default function Profile() {
  const { state, set, replace, profile, targets, saveError } = useStore();
  const ui = useUI();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const upd = (p: Partial<P>) => set((s) => ({ ...s, profile: { ...(s.profile ?? profile), ...p } }));
  const u = profile.units;

  return (
    <div>
      <header className="topbar"><h1>Profile</h1></header>
      <div className="screen">
        {(!storageAvailable() || saveError) && (
          <div className="card-flat flex gap-3 mb-3" style={{ borderColor: "var(--orange)" }} data-testid="text-storage-warning">
            <AlertTriangle size={16} className="orange" style={{ flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs">Browser storage is unavailable here, so data lasts only while this tab is open. Use Export to keep a copy.</p>
          </div>
        )}
        <div className="card flex items-center gap-3">
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 17, borderColor: "var(--lime)", color: "var(--lime)" }}>{initials(profile.name)}</span>
          <div className="flex-1 min0">
            <input className="input" style={{ fontWeight: 600 }} value={profile.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Name" data-testid="input-profile-name" />
          </div>
        </div>

        <div className="section-title"><h2>Body & goal</h2></div>
        <div className="card stack">
          <div><div className="label mb-1">Units</div>
            <Seg value={u} onChange={(to) => { if (to !== u) { set((s) => convertUnits(s, to)); ui.toast(`Converted all data to ${to}`); } }} options={[{ v: "lb", l: "lb" }, { v: "kg", l: "kg" }]} testId="seg-profile-units" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="field"><span className="label">Body weight ({u})</span><input className="input mono" type="number" inputMode="decimal" value={profile.bodyWeight} onChange={(e) => upd({ bodyWeight: Number(e.target.value) || 0 })} data-testid="input-profile-bw" /></label>
            <label className="field"><span className="label">Height (cm)</span><input className="input mono" type="number" value={profile.heightCm} onChange={(e) => upd({ heightCm: Number(e.target.value) || 0 })} data-testid="input-profile-height" /></label>
            <label className="field"><span className="label">Age</span><input className="input mono" type="number" value={profile.age} onChange={(e) => upd({ age: Number(e.target.value) || 0 })} data-testid="input-profile-age" /></label>
            <label className="field"><span className="label">Bar ({u})</span><input className="input mono" type="number" value={profile.barWeight} onChange={(e) => upd({ barWeight: Number(e.target.value) || 0 })} data-testid="input-profile-bar" /></label>
          </div>
          <div><div className="label mb-1">Sex (optional, for BMR & DOTS)</div>
            <Seg value={profile.sex ?? "na"} onChange={(v) => upd({ sex: v === "na" ? null : (v as Sex) })} options={[{ v: "m", l: "Male" }, { v: "f", l: "Female" }, { v: "na", l: "Skip" }]} />
          </div>
          <div><div className="label mb-1">Experience</div>
            <Seg value={profile.experience} onChange={(v: Experience) => upd({ experience: v })} options={[{ v: "beginner", l: "Beginner" }, { v: "intermediate", l: "Inter." }, { v: "advanced", l: "Advanced" }]} />
          </div>
          <div><div className="label mb-1">Goal</div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => <button key={g.v} className={`btn btn-sm ${profile.goal === g.v ? "btn-primary" : ""}`} onClick={() => upd({ goal: g.v })} data-testid={`button-goal-${g.v}`}>{g.l}</button>)}
            </div>
          </div>
          <label className="field"><span className="label">Home gym</span><input className="input" value={profile.gym} onChange={(e) => upd({ gym: e.target.value })} data-testid="input-profile-gym" /></label>
        </div>

        <div className="section-title"><h2>Nutrition targets</h2><span className="label">auto</span></div>
        <div className="card">
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat"><div className="label">Training day</div><div className="v">{targets.trainingCal}</div><div className="s">kcal</div></div>
            <div className="stat"><div className="label">Rest day</div><div className="v">{targets.restCal}</div><div className="s">kcal</div></div>
            <div className="stat"><div className="label">Protein</div><div className="v">{targets.protein}g</div><div className="s">{targets.proteinPerKg} g/kg</div></div>
          </div>
          <p className="mono text-[11px] muted mt-3">Mifflin–St Jeor BMR {targets.bmr} × activity {targets.activity} = TDEE {targets.tdee} {targets.goalAdj >= 0 ? "+" : ""}{targets.goalAdj} goal</p>
        </div>

        <div className="section-title"><h2>Rest timer defaults</h2></div>
        <div className="card stack">
          <div className="flex items-center justify-between gap-3"><span className="text-sm">Compounds</span><Stepper value={state.restDefaults.compound} step={15} min={30} max={600} decimals={0} unit="s" onChange={(v) => set((s) => ({ ...s, restDefaults: { ...s.restDefaults, compound: v } }))} testId="stepper-rest-compound" /></div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm">Isolation</span><Stepper value={state.restDefaults.isolation} step={15} min={30} max={600} decimals={0} unit="s" onChange={(v) => set((s) => ({ ...s, restDefaults: { ...s.restDefaults, isolation: v } }))} testId="stepper-rest-isolation" /></div>
        </div>

        <div className="section-title"><h2>Coaching</h2></div>
        <div className="card stack">
          <button className="btn btn-block" onClick={() => ui.open("coach")} data-testid="button-open-coach"><MessageSquare size={16} /> Ask the AI Coach</button>
          <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
            <span><span className="text-sm font-semibold block">Coach mode</span><span className="text-xs muted">Manage clients, programs, and session notes</span></span>
            <input type="checkbox" className="toggle" checked={profile.coachMode} onChange={(e) => upd({ coachMode: e.target.checked })} data-testid="toggle-coach-mode" />
          </label>
        </div>
        {profile.coachMode && <CoachDashboard />}

        <div className="section-title"><h2>Data</h2></div>
        <div className="card stack">
          <button className="btn btn-block" onClick={() => setExportOpen(true)} data-testid="button-export"><Download size={16} /> Export JSON</button>
          <button className="btn btn-block" onClick={() => setImportOpen(true)} data-testid="button-import"><Upload size={16} /> Import JSON</button>
          <button className="btn btn-outline btn-block" onClick={() => { replace(buildDemo()); ui.setTab("today"); ui.toast("Demo data loaded: 8 weeks of history"); }} data-testid="button-load-demo"><Database size={16} /> Load demo data</button>
          <button className="btn btn-ghost btn-block orange" onClick={() => setResetOpen(true)} data-testid="button-reset">Reset all data</button>
        </div>
        <p className="text-[11px] faint text-center mt-4">Corpus · all data stays on this device</p>
      </div>

      {exportOpen && <ExportSheet state={state} onClose={() => setExportOpen(false)} />}
      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} onImport={(s) => { replace(s); setImportOpen(false); ui.toast("Data imported"); }} />}
      {resetOpen && (
        <Sheet title="Reset all data?" onClose={() => setResetOpen(false)} testId="sheet-reset">
          <p className="text-sm muted">This deletes your profile, program, logs, photos, and Spotters data on this device. Export first if you want a backup.</p>
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1" onClick={() => setResetOpen(false)}>Cancel</button>
            <button className="btn btn-warn flex-1" onClick={() => { replace(emptyState()); setResetOpen(false); ui.setTab("today"); }} data-testid="button-confirm-reset">Delete everything</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ExportSheet({ state, onClose }: { state: AppState; onClose: () => void }) {
  const text = JSON.stringify(state, null, 1);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <Sheet title="Export data" onClose={onClose} testId="sheet-export">
      <p className="mono text-xs muted">{(text.length / 1024).toFixed(0)} KB · {state.sessions.length} sessions · {state.checkins.length} check-ins · {state.meals.length} meals</p>
      <button className="btn btn-primary btn-lg btn-block mt-3" onClick={() => downloadText(`corpus-${dateKey()}.json`, text)} data-testid="button-download-json"><Download size={16} /> Download .json</button>
      <button className="btn btn-block mt-2" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch { ref.current?.select(); document.execCommand?.("copy"); setCopied(true); }
      }} data-testid="button-copy-json">{copied ? "Copied" : "Copy to clipboard"}</button>
      <textarea ref={ref} className="textarea mono mt-3" style={{ height: 160, fontSize: 10 }} readOnly value={text} onFocus={(e) => e.target.select()} data-testid="textarea-export" />
      <p className="text-[11px] faint mt-2">If the download is blocked in this preview, copy the text and save it as a .json file.</p>
    </Sheet>
  );
}

function ImportSheet({ onClose, onImport }: { onClose: () => void; onImport: (s: AppState) => void }) {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const parse = (raw: string) => {
    try {
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object" || !Array.isArray(s.sessions)) throw new Error("Not a Corpus export");
      onImport(s as AppState);
    } catch (e) { setErr(e instanceof Error ? e.message : "Invalid JSON"); }
  };
  return (
    <Sheet title="Import data" onClose={onClose} testId="sheet-import">
      <p className="text-sm muted">Replaces everything on this device with the file's contents.</p>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) parse(await f.text()); }} data-testid="input-import-file" />
      <button className="btn btn-block mt-3" onClick={() => fileRef.current?.click()} data-testid="button-choose-file"><Upload size={16} /> Choose file</button>
      <div className="label mt-4 mb-1">Or paste JSON</div>
      <textarea className="textarea mono" style={{ height: 140, fontSize: 11 }} value={txt} onChange={(e) => { setTxt(e.target.value); setErr(""); }} data-testid="textarea-import" />
      {err && <p className="text-xs orange mt-2" data-testid="text-import-error">{err}</p>}
      <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!txt.trim()} onClick={() => parse(txt)} data-testid="button-import-paste">Import</button>
    </Sheet>
  );
}

function clientFlags(c: Client): string[] {
  const f: string[] = [];
  let run = 0, maxRun = 0;
  for (const r of c.readiness) { run = r < 50 ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  const tail = (() => { let n = 0; for (let i = c.readiness.length - 1; i >= 0 && c.readiness[i] < 50; i--) n++; return n; })();
  if (tail >= 3) f.push(`readiness below 50 for ${tail} days`);
  else if (maxRun >= 3) f.push(`readiness dipped below 50 for ${maxRun} days this week`);
  if (c.missedRecent >= 2) f.push(`missed ${c.missedRecent} sessions`);
  const p = mean(c.protein);
  if (p < 85) f.push(`protein averaging ${Math.round(p)}% of target`);
  if (c.adherence < 0.75) f.push(`adherence ${Math.round(c.adherence * 100)}%`);
  return f;
}

function CoachDashboard() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const client = state.clients.find((c) => c.id === open);
  if (!state.clients.length) return <div className="card mt-3"><p className="text-sm muted">No clients yet. Load demo data to see three sample clients.</p></div>;
  const allFlags = state.clients.flatMap((c) => clientFlags(c).map((f) => `${c.name.split(" ")[0]}: ${f}`));
  return (
    <div className="mt-3" data-testid="view-coach-dashboard">
      {allFlags.length > 0 && (
        <div className="card" style={{ borderColor: "rgba(255,106,43,.4)" }}>
          <div className="label orange mb-2 flex items-center gap-2"><AlertTriangle size={13} /> Needs attention</div>
          {allFlags.map((f, i) => <p key={i} className="text-sm py-1" data-testid={`text-coach-flag-${i}`}>{f}</p>)}
        </div>
      )}
      <div className="stack mt-3">
        {state.clients.map((c) => {
          const today = c.readiness[c.readiness.length - 1];
          const flags = clientFlags(c);
          return (
            <button key={c.id} className="card w-full text-left" onClick={() => setOpen(c.id)} data-testid={`card-client-${c.id}`}>
              <div className="flex items-center gap-3">
                <span className="avatar">{initials(c.name)}</span>
                <div className="flex-1 min0">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-[11px] muted truncate">Last: {c.lastSession.name} · {fmtDate(c.lastSession.date)} · {c.lastSession.topSet}</div>
                </div>
                <div className="text-right">
                  <div className={`mono text-lg ${today < 50 ? "orange" : today >= 75 ? "lime" : "blue"}`}>{today}</div>
                  <div className="label">ready</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Spark values={c.readiness} color={today < 50 ? "var(--orange)" : "var(--lime)"} width={90} />
                <span className="mono text-xs muted">adherence {Math.round(c.adherence * 100)}%</span>
                {flags.length > 0 ? <span className="chip chip-orange">{flags.length} flag{flags.length > 1 ? "s" : ""}</span> : <span className="chip chip-lime">on track</span>}
              </div>
            </button>
          );
        })}
      </div>
      {client && <ClientSheet client={client} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ClientSheet({ client, onClose }: { client: Client; onClose: () => void }) {
  const { set, profile } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<"sessions" | "program" | "notes">("sessions");
  const [prog, setProg] = useState<Program>(client.program);
  const [note, setNote] = useState("");
  const [sessNotes, setSessNotes] = useState<Record<string, string>>(Object.fromEntries(client.recent.map((r) => [r.id, r.note])));
  const updClient = (f: (c: Client) => Client) => set((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? f(c) : c)) }));
  const flags = clientFlags(client);
  return (
    <Sheet title={client.name} onClose={onClose} full testId="sheet-client" right={<UserCog size={18} className="muted" />}>
      {flags.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{flags.map((f) => <span key={f} className="chip chip-orange">{f}</span>)}</div>}
      <div className="stat-grid mb-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat"><div className="label">Readiness</div><div className="v">{client.readiness[client.readiness.length - 1]}</div><div className="s">7d avg {Math.round(mean(client.readiness))}</div></div>
        <div className="stat"><div className="label">Adherence</div><div className="v">{Math.round(client.adherence * 100)}%</div><div className="s">4 weeks</div></div>
        <div className="stat"><div className="label">Protein</div><div className="v">{Math.round(mean(client.protein))}%</div><div className="s">of target</div></div>
      </div>
      <Seg value={tab} onChange={setTab} options={[{ v: "sessions", l: "Sessions" }, { v: "program", l: "Program" }, { v: "notes", l: "Notes" }]} testId="seg-client-tab" />
      <div className="mt-3">
        {tab === "sessions" && (
          <div className="stack">
            {client.recent.map((r) => (
              <div key={r.id} className="card-flat">
                <div className="flex justify-between"><span className="text-sm font-semibold">{r.name}</span><span className="mono text-xs muted">{fmtDate(r.date)}</span></div>
                <div className="mono text-xs muted mt-1">Top set {r.topSet}</div>
                <div className="flex gap-2 mt-2">
                  <input className="input" placeholder="Leave a note on this session" value={sessNotes[r.id] ?? ""} onChange={(e) => setSessNotes({ ...sessNotes, [r.id]: e.target.value })} data-testid={`input-session-note-${r.id}`} />
                  <button className="btn" onClick={() => { updClient((c) => ({ ...c, recent: c.recent.map((x) => (x.id === r.id ? { ...x, note: sessNotes[r.id] ?? "" } : x)) })); ui.toast("Note saved"); }} data-testid={`button-save-session-note-${r.id}`}>Save</button>
                </div>
                {r.note && <p className="text-xs blue mt-2">Saved: {r.note}</p>}
              </div>
            ))}
          </div>
        )}
        {tab === "program" && (
          <>
            <ProgramEditor program={prog} units={profile.units} onChange={setProg} />
            <button className="btn btn-primary btn-lg btn-block mt-3" disabled={JSON.stringify(prog) === JSON.stringify(client.program)} onClick={() => { updClient((c) => ({ ...c, program: prog })); ui.toast(`Program updated for ${client.name.split(" ")[0]}`); }} data-testid="button-save-client-program">Save program for {client.name.split(" ")[0]}</button>
          </>
        )}
        {tab === "notes" && (
          <>
            <textarea className="textarea" placeholder="Private coaching note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="textarea-client-note" />
            <button className="btn btn-primary btn-block mt-2" disabled={!note.trim()} onClick={() => { updClient((c) => ({ ...c, notes: [{ id: newId("n"), date: dateKey(), text: note.trim() }, ...c.notes] })); setNote(""); }} data-testid="button-add-client-note">Add note</button>
            <div className="mt-3">
              {client.notes.length === 0 ? <p className="text-sm muted">No notes yet.</p> : client.notes.map((n) => (
                <div key={n.id} className="rowline" style={{ alignItems: "flex-start" }}><span className="text-sm">{n.text}</span><span className="mono text-xs muted">{fmtDate(n.date)}</span></div>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
