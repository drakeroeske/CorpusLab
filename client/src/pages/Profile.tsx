import { Info } from "@/components/Term";
import { EngineHeader, setGrain, setInk, useGrain, useInk } from "@/components/riso";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound, Lock, Copy, Database, Download, Eye, LogOut, MessageSquare, RefreshCw, Upload, UserCog, X } from "lucide-react";
import { useAuth, type PubUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { clientFromState } from "@/lib/social";
import { useStore, emptyState, storageAvailable, remoteAvailable } from "@/lib/store";
import { upgradeState } from "@/lib/empty";
import { useUI } from "@/App";
import { NumInput, Seg, Sheet, Spark, Stepper, initials } from "@/components/ui";
import { ProgramEditor } from "@/components/ProgramEditor";
import { SharedCodes } from "@/components/ProgramLibrary";
import { RecoveryCodeView } from "@/components/Recovery";
import { InstallCard } from "@/components/Install";
import { PLEDGE_ENABLED, PledgeSheet } from "@/components/Pledge";
import { NotificationsCard } from "@/components/Notifications";
import { buildDemo } from "@/lib/demo";
import { convertUnits, downloadText } from "@/lib/actions";
import { dateKey, fmtDate, mean } from "@/lib/engine";
import { customExercisesIn, newId } from "@/lib/exercises";
import type { AppState, Client, Experience, Goal, Profile as P, Program, Sex } from "@/lib/types";

const GOALS: { v: Goal; l: string }[] = [{ v: "muscle", l: "Build muscle" }, { v: "strength", l: "Get stronger" }, { v: "fatloss", l: "Lose fat" }, { v: "recomp", l: "Recomp" }];

export default function Profile() {
  const { state, set, replace, profile, targets, saveError, mode } = useStore();
  const ui = useUI();
  const auth = useAuth();
  const live = auth.live && !auth.viewing;
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const upd = (p: Partial<P>) => set((s) => ({ ...s, profile: { ...(s.profile ?? profile), ...p } }));
  const u = profile.units;

  return (
    <div>
      <EngineHeader title="Profile" me={false} back={() => ui.setTab(ui.prevTab)} />
      <div className="screen">
        {(mode !== "readonly" && ((mode === "offline" && !storageAvailable() && !remoteAvailable()) || saveError)) && (
          <div className="card-flat flex gap-3 mb-3" style={{ borderColor: "var(--orange)" }} data-testid="text-storage-warning">
            <AlertTriangle size={16} className="orange" style={{ flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs">{saveError ? (mode === "remote" ? "Your latest changes couldn't be saved to your account. Check your connection; changes retry as you keep editing." : "Your latest changes could not be saved. Use Export to keep a copy.") : "Saving is unavailable here, so data lasts only while this tab is open. Use Export to keep a copy."}</p>
          </div>
        )}
        <div className="card flex items-center gap-3">
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>{initials(profile.name)}</span>
          <div className="flex-1 min0">
            <input className="input" style={{ fontWeight: 600 }} value={profile.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Name" data-testid="input-profile-name" />
          </div>
        </div>

        {live && <AccountCard />}

        <div className="section-title"><h2>App</h2></div>
        <InstallCard />
        {live && <NotificationsCard />}
        <GrainCard />
        {PLEDGE_ENABLED && mode !== "readonly" && <PledgeCard />}
        {mode !== "readonly" && (
          <button className="btn btn-outline btn-block mt-3" onClick={() => { set((s) => ({ ...s, profile: s.profile ? { ...s.profile, tourDone: false } : s.profile })); ui.setTab("today"); }} data-testid="button-replay-tour">Replay the app tour</button>
        )}
        <a href="#/privacy" className="btn btn-block mt-2" data-testid="link-profile-privacy">Privacy · what's stored and who sees it</a>

        <div className="section-title"><h2>Body & goal</h2></div>
        <div className="card stack">
          <div><div className="label mb-1">Units</div>
            <Seg value={u} onChange={(to) => { if (to !== u) { set((s) => convertUnits(s, to)); ui.toast(`Converted all data to ${to}`); } }} options={[{ v: "lb", l: "lb" }, { v: "kg", l: "kg" }]} testId="seg-profile-units" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="field"><span className="label">Body weight ({u})</span><NumInput value={profile.bodyWeight} min={0} onChange={(v) => v !== null && upd({ bodyWeight: v })} data-testid="input-profile-bw" /></label>
            <label className="field"><span className="label">Height (cm)</span><NumInput value={profile.heightCm} min={0} onChange={(v) => v !== null && upd({ heightCm: v })} data-testid="input-profile-height" /></label>
            <label className="field"><span className="label">Age</span><NumInput value={profile.age} min={0} onChange={(v) => v !== null && upd({ age: v })} data-testid="input-profile-age" /></label>
            <label className="field"><span className="label">Bar ({u})</span><NumInput value={profile.barWeight} min={0} onChange={(v) => v !== null && upd({ barWeight: v })} data-testid="input-profile-bar" /></label>
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
          <p className="mono text-[11px] muted mt-3">Mifflin–St Jeor BMR {targets.bmr} × activity {targets.activity} = TDEE {targets.tdee} {targets.goalAdj >= 0 ? "+" : ""}{targets.goalAdj} goal <Info k="tdee" size={13} /></p>
        </div>

        <div className="section-title"><h2>Rest timer defaults</h2></div>
        <div className="card stack">
          <div className="flex items-center justify-between gap-3"><span className="text-sm">Compounds</span><Stepper value={state.restDefaults.compound} step={15} min={30} max={600} decimals={0} unit="s" onChange={(v) => set((s) => ({ ...s, restDefaults: { ...s.restDefaults, compound: v } }))} testId="stepper-rest-compound" /></div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm">Isolation</span><Stepper value={state.restDefaults.isolation} step={15} min={30} max={600} decimals={0} unit="s" onChange={(v) => set((s) => ({ ...s, restDefaults: { ...s.restDefaults, isolation: v } }))} testId="stepper-rest-isolation" /></div>
        </div>

        {mode !== "readonly" && (
          <>
            <div className="section-title"><h2>Coaching</h2></div>
            <div className="card stack">
              <button className="btn btn-block" onClick={() => ui.open("coach")} data-testid="button-open-coach"><MessageSquare size={16} /> Ask the AI Coach</button>
              {live ? <LiveCoachToggle onChange={(c) => upd({ coachMode: c })} /> : (
                <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                  <span><span className="text-sm font-semibold block">Coach mode</span><span className="text-xs muted">Manage clients, programs, and session notes</span></span>
                  <input type="checkbox" className="toggle" checked={profile.coachMode} onChange={(e) => upd({ coachMode: e.target.checked })} data-testid="toggle-coach-mode" />
                </label>
              )}
            </div>
            {live ? (auth.me?.role === "coach" ? <LiveCoachDashboard /> : <MyCoachCard />) : profile.coachMode && <CoachDashboard />}
          </>
        )}

        <div className="section-title"><h2>Data</h2></div>
        <SharedCodes />
        <div className="card stack mt-3">
          <button className="btn btn-block" onClick={() => setExportOpen(true)} data-testid="button-export"><Download size={16} /> Export JSON</button>
          <button className="btn btn-block" onClick={() => setImportOpen(true)} data-testid="button-import"><Upload size={16} /> Import JSON</button>
          {mode !== "readonly" && <><button className="btn btn-outline btn-block" onClick={() => { replace(buildDemo()); ui.setTab("today"); ui.toast("Demo data loaded: 8 weeks of history"); }} data-testid="button-load-demo"><Database size={16} /> Load demo data</button>
          <button className="btn btn-ghost btn-block orange" onClick={() => setResetOpen(true)} data-testid="button-reset">Reset all data</button></>}
        </div>
        <p className="text-[11px] faint text-center mt-4">{mode === "remote" ? `Corpus · synced to @${auth.me?.username}` : mode === "readonly" ? "Corpus · read-only coach view" : "Corpus · all data stays on this device"}</p>
      </div>

      {exportOpen && <ExportSheet state={state} onClose={() => setExportOpen(false)} />}
      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} onImport={(s) => { replace(s); setImportOpen(false); ui.toast("Data imported"); }} />}
      {resetOpen && (
        <Sheet title="Reset all data?" onClose={() => setResetOpen(false)} testId="sheet-reset">
          <p className="text-sm muted">{mode === "remote" ? "This clears your profile, program, logs and photos from your account. Your login, Spotters and posts stay. Export first if you want a backup." : "This deletes your profile, program, logs, photos, and Spotters data on this device. Export first if you want a backup."}</p>
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
  const rs = c.readiness.filter((r) => r > 0);
  for (const r of rs) { run = r < 50 ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  const tail = (() => { let n = 0; for (let i = rs.length - 1; i >= 0 && rs[i] < 50; i--) n++; return n; })();
  if (tail >= 3) f.push(`readiness below 50 for ${tail} days`);
  else if (maxRun >= 3) f.push(`readiness dipped below 50 for ${maxRun} days this week`);
  else if (tail >= 1 && c.readiness[c.readiness.length - 1] > 0) f.push(`readiness ${c.readiness[c.readiness.length - 1]} today`);
  if (c.missedRecent >= 2) f.push(`missed ${c.missedRecent} sessions`);
  const p = mean(c.protein);
  if (c.protein.some((x) => x > 0) && p < 85) f.push(`protein averaging ${Math.round(p)}% of target`);
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
        <div className="card" style={{ borderColor: "rgba(180,35,24,.4)" }}>
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

interface ClientActions {
  saveSessionNote: (sessionId: string, note: string) => Promise<void>;
  saveProgram: (p: Program) => Promise<void>;
  /** Drop a program into the client's inbox; they choose when to switch. */
  sendProgram?: (p: Program) => Promise<void>;
  addNote: (text: string) => Promise<void>;
  openAccount?: () => void;
}

function ClientSheet({ client, onClose, actions }: { client: Client; onClose: () => void; actions?: ClientActions }) {
  const { set, profile, state } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<"sessions" | "program" | "notes">("sessions");
  const [prog, setProg] = useState<Program>(client.program);
  const [sendOpen, setSendOpen] = useState(false);
  const sendable = [...(state.program ? [{ id: "current", name: `${state.program.name} (what I'm running)`, program: state.program }] : []), ...(state.savedPrograms ?? []).map((sp) => ({ id: sp.id, name: sp.name, program: sp.program }))];
  const [note, setNote] = useState("");
  const [sessNotes, setSessNotes] = useState<Record<string, string>>(Object.fromEntries(client.recent.map((r) => [r.id, r.note])));
  const updClient = (f: (c: Client) => Client) => set((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? f(c) : c)) }));
  const flags = clientFlags(client);
  const act: ClientActions = actions ?? {
    saveSessionNote: async (id, n) => updClient((c) => ({ ...c, recent: c.recent.map((x) => (x.id === id ? { ...x, note: n } : x)) })),
    saveProgram: async (p) => updClient((c) => ({ ...c, program: p })),
    addNote: async (text) => updClient((c) => ({ ...c, notes: [{ id: newId("n"), date: dateKey(), text }, ...c.notes] })),
  };
  const run = async (f: () => Promise<void>, msg?: string) => { try { await f(); if (msg) ui.toast(msg); } catch (e) { ui.toast((e as Error).message); } };
  return (
    <Sheet title={client.name} onClose={onClose} full testId="sheet-client" right={<UserCog size={18} className="muted" />}>
      {act.openAccount && (
        <button className="btn btn-outline btn-block mb-3" onClick={act.openAccount} data-testid="button-open-client-account"><Eye size={16} /> Open {client.name.split(" ")[0]}'s account (read-only)</button>
      )}
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
                  <button className="btn" onClick={() => run(() => act.saveSessionNote(r.id, sessNotes[r.id] ?? ""), "Note saved")} data-testid={`button-save-session-note-${r.id}`}>Save</button>
                </div>
                {r.note && <p className="text-xs blue mt-2">Saved: {r.note}</p>}
              </div>
            ))}
          </div>
        )}
        {tab === "program" && (
          <>
            <ProgramEditor program={prog} units={profile.units} onChange={setProg} />
            <button className="btn btn-primary btn-lg btn-block mt-3" disabled={JSON.stringify(prog) === JSON.stringify(client.program)} onClick={() => run(() => act.saveProgram(prog), `Program updated for ${client.name.split(" ")[0]}`)} data-testid="button-save-client-program">Save program for {client.name.split(" ")[0]}</button>
            {act.sendProgram && sendable.length > 0 && (
              <button className="btn btn-block mt-2" onClick={() => setSendOpen(true)} data-testid="button-send-program-open">Send one of my programs</button>
            )}
            {sendOpen && (
              <Sheet title="Send a program" onClose={() => setSendOpen(false)} testId="sheet-send-program">
                <p className="text-sm">{client.name.split(" ")[0]} gets it on their Program tab and chooses to switch to it or save it — nothing changes until they do.</p>
                {sendable.map((sp) => (
                  <button key={sp.id} className="card w-full text-left mt-2" onClick={() => { setSendOpen(false); run(() => act.sendProgram!({ ...sp.program, name: sp.program.name, deloadUntil: null }), `Sent to ${client.name.split(" ")[0]}`); }} data-testid={`button-send-program-${sp.id}`}>
                    <div className="font-semibold">{sp.name}</div>
                    <div className="mono text-[11px] mt-1">{sp.program.days.length} days · {sp.program.days.map((d) => d.name).join(" · ")}</div>
                  </button>
                ))}
              </Sheet>
            )}
          </>
        )}
        {tab === "notes" && (
          <>
            <textarea className="textarea" placeholder="Private coaching note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="textarea-client-note" />
            <button className="btn btn-primary btn-block mt-2" disabled={!note.trim()} onClick={() => { const t = note.trim(); setNote(""); run(() => act.addNote(t), "Note added"); }} data-testid="button-add-client-note">Add note</button>
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

/* ============================ live account (server) ============================ */

function SecurityRows() {
  const auth = useAuth();
  const ui = useUI();
  const me = auth.me!;
  const [sheet, setSheet] = useState<null | "code" | "pw">(null);
  const [pw, setPw] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const close = () => { setSheet(null); setPw(""); setNext(""); setErr(""); setIssued(null); };
  const newCode = async () => {
    setBusy(true); setErr("");
    try { const { recoveryCode, ...m } = await api<any>("POST", "/api/auth/recovery-code", { password: pw }); auth.setMe(m); setIssued(recoveryCode); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const changePw = async () => {
    setBusy(true); setErr("");
    try { await api("POST", "/api/auth/change-password", { current: pw, next }); ui.toast("Password changed. Other devices were signed out."); close(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
        <span className="min0"><span className="text-sm font-semibold block">Recovery code</span>
          <span className={`text-xs ${me.hasRecovery ? "muted" : "orange"}`} data-testid="text-recovery-status">{me.hasRecovery ? `Set${me.recoverySetAt ? ` ${fmtDate(me.recoverySetAt.slice(0, 10))}` : ""} · lets you reset a forgotten password` : "Not set. Make one so you can't get locked out."}</span></span>
        <button className="btn btn-sm btn-outline shrink-0" style={{ minHeight: 44 }} onClick={() => setSheet("code")} data-testid="button-new-recovery"><KeyRound size={14} /> {me.hasRecovery ? "New code" : "Create"}</button>
      </div>
      <button className="btn btn-block" onClick={() => setSheet("pw")} data-testid="button-change-password"><Lock size={16} /> Change password</button>
      {sheet === "code" && (
        <Sheet title={issued ? "New recovery code" : "Make a new recovery code"} onClose={close} testId="sheet-recovery">
          {issued ? <RecoveryCodeView code={issued} username={me.username} onDone={close} doneLabel="Done" /> : (
            <>
              <p className="text-sm muted">{me.hasRecovery ? "Your old code will stop working." : "You'll get a code to keep somewhere safe."} Enter your password to continue.</p>
              <input className="input mt-3" type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} data-testid="input-recovery-password" />
              {err && <p className="text-xs orange mt-2">{err}</p>}
              <button className="btn btn-primary btn-block mt-4" disabled={!pw || busy} onClick={newCode} data-testid="button-confirm-new-recovery">{busy ? "Working…" : "Show my new code"}</button>
            </>
          )}
        </Sheet>
      )}
      {sheet === "pw" && (
        <Sheet title="Change password" onClose={close} testId="sheet-change-password">
          <div className="stack">
            <label className="field"><span className="label">Current password</span><input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} data-testid="input-current-password" /></label>
            <label className="field"><span className="label">New password · 8+ characters</span><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setErr(""); }} data-testid="input-new-password" /></label>
            {err && <p className="text-xs orange">{err}</p>}
            <p className="text-[11px] faint">Other phones and computers signed in to this account will be signed out.</p>
            <button className="btn btn-primary btn-block" disabled={!pw || next.length < 8 || busy} onClick={changePw} data-testid="button-confirm-change-password">{busy ? "Working…" : "Change password"}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function AccountCard() {
  const auth = useAuth();
  const ui = useUI();
  const me = auth.me!;
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const patch = async (b: Record<string, unknown>) => {
    try { auth.setMe(await api("PATCH", "/api/me", b)); } catch (e) { ui.toast((e as Error).message); }
  };
  return (
    <>
      <div className="section-title"><h2>Account</h2><span className="label">@{me.username}</span></div>
      <div className="card stack">
        <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
          <span><span className="text-sm font-semibold block">Share workouts</span><span className="text-xs muted">Finished sessions post to your Spotters' feed</span></span>
          <input type="checkbox" className="toggle" checked={me.shareFeed} onChange={(e) => patch({ shareFeed: e.target.checked })} data-testid="toggle-share-feed" />
        </label>
        <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
          <span><span className="text-sm font-semibold block">Share lifts on leaderboards</span><span className="text-xs muted">Best e1RMs, body weight and streak</span></span>
          <input type="checkbox" className="toggle" checked={me.shareLifts} onChange={(e) => patch({ shareLifts: e.target.checked })} data-testid="toggle-share-lifts" />
        </label>
        {!me.isDemo && <SecurityRows />}
        <button className="btn btn-block" onClick={() => auth.logout()} data-testid="button-sign-out"><LogOut size={16} /> Sign out</button>
        <button className="btn btn-ghost btn-sm orange" onClick={() => setDel(true)} data-testid="button-delete-account">Delete account</button>
      </div>
      {del && (
        <Sheet title="Delete your account?" onClose={() => setDel(false)} testId="sheet-delete-account">
          <p className="text-sm muted">This permanently deletes your login, training data, posts, Spotters and coach links. Export first if you want a copy.</p>
          <input className="input mt-3" type="password" placeholder="Password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} data-testid="input-delete-password" />
          {err && <p className="text-xs orange mt-2">{err}</p>}
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1" onClick={() => setDel(false)}>Cancel</button>
            <button className="btn btn-warn flex-1" disabled={!pw} onClick={async () => {
              try { await api("DELETE", "/api/me", { password: pw }); await auth.logout(); } catch (e) { setErr((e as Error).message); }
            }} data-testid="button-confirm-delete-account">Delete forever</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function LiveCoachToggle({ onChange }: { onChange: (coach: boolean) => void }) {
  const auth = useAuth();
  const ui = useUI();
  const me = auth.me!;
  const isCoach = me.role === "coach";
  return (
    <>
      <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
        <span><span className="text-sm font-semibold block">Coach mode</span><span className="text-xs muted">See clients who add your coach code</span></span>
        <input type="checkbox" className="toggle" checked={isCoach} onChange={async (e) => {
          const role = e.target.checked ? "coach" : "athlete";
          try { auth.setMe(await api("PATCH", "/api/me", { role })); onChange(role === "coach"); } catch (x) { ui.toast((x as Error).message); }
        }} data-testid="toggle-coach-mode" />
      </label>
      {isCoach && (
        <div className="card-flat flex items-center gap-3">
          <div className="flex-1 min0"><div className="label">Your coach code</div><div className="mono text-xl lime" style={{ letterSpacing: "0.12em" }} data-testid="text-coach-code">{me.inviteCode}</div></div>
          <button className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(me.inviteCode); ui.toast("Code copied"); } catch { ui.toast(`Code: ${me.inviteCode}`); } }}><Copy size={14} /> Copy</button>
        </div>
      )}
      {isCoach && <p className="text-[11px] faint">Clients enter this under Profile, then My coach. They can remove you at any time.</p>}
    </>
  );
}

function MyCoachCard() {
  const auth = useAuth();
  const ui = useUI();
  const me = auth.me!;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { auth.setMe(await api("POST", "/api/coach/link", { code })); setCode(""); ui.toast("Coach added"); } catch (e) { ui.toast((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (c: PubUser) => {
    try { auth.setMe(await api("DELETE", `/api/coach/link/${c.id}`)); ui.toast(`Removed ${c.displayName}`); } catch (e) { ui.toast((e as Error).message); }
  };
  return (
    <>
      <div className="section-title"><h2>My coach</h2></div>
      <div className="card stack" data-testid="card-my-coach">
        {me.coaches.length === 0 && <p className="text-sm muted">Add a coach with their code. They'll get read-only access to your training, check-ins and nutrition, and can edit your program and leave session notes.</p>}
        {me.coaches.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <span className="avatar">{initials(c.displayName)}</span>
            <div className="flex-1 min0"><div className="text-sm font-semibold">{c.displayName}</div><div className="mono text-[11px] muted">@{c.username} · can view your data</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(c)} aria-label={`Remove coach ${c.displayName}`} data-testid={`button-remove-coach-${c.username}`}><X size={15} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="input mono" placeholder="Coach code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && code.trim() && add()} autoCapitalize="characters" data-testid="input-coach-code" />
          <button className="btn btn-primary" disabled={busy || !code.trim()} onClick={add} data-testid="button-add-coach">Add</button>
        </div>
        {me.coaches.length > 0 && (
          <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
            <span><span className="text-sm font-semibold block">Share private vault</span><span className="text-xs muted">Progress photos and measurements</span></span>
            <input type="checkbox" className="toggle" checked={me.shareVaultWithCoach} onChange={async (e) => { try { auth.setMe(await api("PATCH", "/api/me", { shareVaultWithCoach: e.target.checked })); } catch (x) { ui.toast((x as Error).message); } }} data-testid="toggle-share-vault" />
          </label>
        )}
      </div>
    </>
  );
}

interface LiveClient extends PubUser { sharesVault: boolean; updatedAt: string | null; state: AppState | null; notes: { id: string; date: string; text: string }[] }

function LiveCoachDashboard() {
  const auth = useAuth();
  const [data, setData] = useState<LiveClient[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api<{ clients: LiveClient[] }>("GET", "/api/coach/clients").then((r) => { setData(r.clients); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (err) return <div className="card mt-3"><p className="text-sm orange">{err}</p><button className="btn btn-sm mt-2" onClick={load}><RefreshCw size={14} /> Retry</button></div>;
  if (!data) return <p className="text-sm muted mt-3">Loading clients…</p>;
  const withState = data.filter((c) => c.state?.profile?.onboarded);
  const clients = withState.map((c) => clientFromState(c.id, c.displayName, upgradeState(c.state!), c.notes));
  const pendingSetup = data.filter((c) => !c.state?.profile?.onboarded);
  const raw = data.find((c) => c.id === open);
  const client = clients.find((c) => c.id === open);
  const allFlags = clients.flatMap((c) => clientFlags(c).map((f) => `${c.name.split(" ")[0]}: ${f}`));
  return (
    <div className="mt-3" data-testid="view-coach-dashboard">
      <div className="section-title"><h2>Clients</h2><span className="label">{data.length}</span></div>
      {data.length === 0 && <div className="card"><p className="text-sm muted">No clients yet. Share your coach code; clients who add it appear here.</p></div>}
      {allFlags.length > 0 && (
        <div className="card" style={{ borderColor: "rgba(180,35,24,.4)" }}>
          <div className="label orange mb-2 flex items-center gap-2"><AlertTriangle size={13} /> Needs attention</div>
          {allFlags.map((f, i) => <p key={i} className="text-sm py-1" data-testid={`text-coach-flag-${i}`}>{f}</p>)}
        </div>
      )}
      <div className="stack mt-3">
        {clients.map((c) => {
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
        {pendingSetup.map((c) => (
          <div key={c.id} className="card-flat flex items-center gap-3"><span className="avatar">{initials(c.displayName)}</span><span className="text-sm flex-1">{c.displayName}</span><span className="mono text-[11px] muted">setting up</span></div>
        ))}
      </div>
      {client && raw && (
        <ClientSheet key={client.id + (raw.updatedAt ?? "")} client={client} onClose={() => setOpen(null)} actions={{
          saveSessionNote: async (sessionId, note) => { await api("POST", `/api/coach/clients/${client.id}/session-note`, { sessionId, note }); await load(); },
          saveProgram: async (program) => { await api("PUT", `/api/coach/clients/${client.id}/program`, { program }); await load(); },
          sendProgram: async (program) => {
            // The coach's own exercises travel with the program so the client sees real names.
            const custom = customExercisesIn(program).map(({ archived: _a, ...e }) => e);
            await api("POST", `/api/coach/clients/${client.id}/program-send`, { program: custom.length ? { ...program, customExercises: custom } : program });
          },
          addNote: async (text) => { await api("POST", `/api/coach/clients/${client.id}/notes`, { text, date: dateKey() }); await load(); },
          openAccount: () => { setOpen(null); auth.viewAs({ id: client.id, name: client.name, state: upgradeState(raw.state!) }); },
        }} />
      )}
    </div>
  );
}


function GrainCard() {
  const g = useGrain();
  const ink = useInk();
  return (
    <div className="card mt-3" data-testid="card-grain">
      <div className="label mb-2">Ink</div>
      <Seg value={ink} onChange={(v) => setInk(v)} options={[{ v: "cobalt", l: "Cobalt" }, { v: "black", l: "Black · high contrast" }]} testId="seg-ink" />
      <p className="text-xs mt-2 mb-3">Black ink is easier to read in bright gyms. Pink accents stay either way.</p>
      <div className="label mb-2">Paper grain</div>
      <Seg value={g} onChange={(v) => setGrain(v)} options={[{ v: "off", l: "Off" }, { v: "subtle", l: "Subtle" }, { v: "full", l: "Full" }]} testId="seg-grain" />
      <p className="text-xs mt-2">Photocopy texture over the app. Turn it off if you prefer a clean screen.</p>
    </div>
  );
}

/** The optional pledge: sign it any time, or see when you did. */
function PledgeCard() {
  const { profile } = useStore();
  const [open, setOpen] = useState(false);
  const signed = profile.pledgedAt;
  return (
    <div className="card flex items-center gap-3" data-testid="card-pledge">
      <div className="min0 flex-1">
        <div className="text-sm font-semibold">The pledge</div>
        <p className="text-xs muted">{signed ? `Signed ${fmtDate(signed, { month: "short", day: "numeric", year: "numeric" })}.` : "Four promises to yourself about training. Optional."}</p>
      </div>
      <button className="btn btn-sm btn-outline shrink-0" onClick={() => setOpen(true)} data-testid="button-open-pledge">{signed ? "View" : "Sign"}</button>
      {open && <PledgeSheet onClose={() => setOpen(false)} />}
    </div>
  );
}
