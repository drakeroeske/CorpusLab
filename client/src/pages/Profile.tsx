import { Info } from "@/components/Term";
import { EngineHeader, setGrain, setInk, useGrain, useInk } from "@/components/riso";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound, Lock, Copy, Database, Download, Eye, LogOut, MessageSquare, Upload, X } from "lucide-react";
import { useAuth, type PubUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { useStore, emptyState, storageAvailable, remoteAvailable } from "@/lib/store";
import { useUI } from "@/App";
import { NumInput, Seg, Sheet, Stepper, initials } from "@/components/ui";
import { MessageThread, useUnreadMessages } from "@/components/MessageThread";
import { SharedCodes } from "@/components/ProgramLibrary";
import { RecoveryCodeView } from "@/components/Recovery";
import { InstallCard } from "@/components/Install";
import { PLEDGE_ENABLED, PledgeSheet } from "@/components/Pledge";
import { NotificationsCard } from "@/components/Notifications";
import { buildDemo } from "@/lib/demo";
import { convertUnits, downloadText, sessionsCsv, shareOrDownload } from "@/lib/actions";
import { dateKey, fmtDate } from "@/lib/engine";
import { EX } from "@/lib/exercises";
import type { AppState, Experience, Goal, Profile as P, Sex } from "@/lib/types";

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
            {live ? (auth.me?.role === "coach" ? (
              <div className="card mt-3 flex items-center gap-3" data-testid="card-clients-link">
                <span className="text-sm flex-1">Your clients, their progress and messages now live on the Clients tab.</span>
                <button className="btn btn-sm" onClick={() => ui.setTab("clients")} data-testid="button-go-clients">Open</button>
              </div>
            ) : <MyCoachCard />) : profile.coachMode && (
              <div className="card mt-3 flex items-center gap-3"><span className="text-sm flex-1">Sample clients are on the Clients tab.</span><button className="btn btn-sm" onClick={() => ui.setTab("clients")} data-testid="button-go-clients">Open</button></div>
            )}
          </>
        )}

        <div className="section-title"><h2>Backup</h2></div>
        <BackupCard state={state} onMore={() => setExportOpen(true)} />

        <div className="section-title mt-6"><h2>Data</h2></div>
        <SharedCodes />
        <div className="card stack mt-3">
          <button className="btn btn-block" onClick={() => setImportOpen(true)} data-testid="button-import"><Upload size={16} /> Import a backup (.json)</button>
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

const BACKUP_KEY = "rxs.lastBackupAt";
function BackupCard({ state, onMore }: { state: AppState; onMore: () => void }) {
  const ui = useUI();
  const [last, setLast] = useState<string | null>(() => { try { return localStorage.getItem(BACKUP_KEY); } catch { return null; } });
  const [busy, setBusy] = useState<"json" | "csv" | null>(null);
  const mark = () => { const t = new Date().toISOString(); try { localStorage.setItem(BACKUP_KEY, t); } catch { /* ignore */ } setLast(t); };
  const sets = state.sessions.reduce((a, s) => a + s.exercises.reduce((b, l) => b + l.sets.length, 0), 0);
  const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const run = async (kind: "json" | "csv") => {
    setBusy(kind);
    try {
      const r = kind === "json"
        ? await shareOrDownload(`corpus-backup-${dateKey()}.json`, JSON.stringify(state), "application/json")
        : await shareOrDownload(`corpus-workouts-${dateKey()}.csv`, sessionsCsv(state, (id) => EX[id]?.name ?? id), "text/csv");
      if (r === "failed") ui.toast("Couldn't save the file. Use 'More options' to copy it instead.");
      else { if (kind === "json") mark(); ui.toast(kind === "json" ? (r === "shared" ? "Backup shared" : "Backup downloaded") : (r === "shared" ? "CSV shared" : "CSV downloaded")); }
    } finally { setBusy(null); }
  };
  return (
    <div className="card" data-testid="card-backup">
      <div className="flex items-start justify-between gap-3">
        <div className="min0">
          <div className="text-sm font-semibold">Your data, in your hands</div>
          <div className="text-xs muted mt-1">{state.sessions.length} sessions · {sets} sets · {state.checkins.length} check-ins · {state.meals.length} meals · {state.photos?.length ?? 0} photos</div>
        </div>
        <span className={`chip ${daysSince != null && daysSince <= 30 ? "chip-signal" : ""}`} data-testid="text-last-backup">{last ? (daysSince === 0 ? "Backed up today" : `Backup ${daysSince}d ago`) : "No backup yet"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn btn-primary" disabled={busy !== null} onClick={() => run("json")} data-testid="button-backup-now"><Download size={16} /> {busy === "json" ? "Saving…" : "Back up now"}</button>
        <button className="btn" disabled={busy !== null} onClick={() => run("csv")} data-testid="button-export-csv"><Download size={16} /> {busy === "csv" ? "Saving…" : "Workouts .csv"}</button>
      </div>
      <p className="text-[11px] faint mt-2">The backup is a full copy of this account's log that you can import later. On iPhone the share sheet opens so you can Save to Files. CSV opens in Numbers, Sheets or Excel.</p>
      <button className="btn btn-ghost btn-sm mt-1" onClick={onMore} data-testid="button-export">More options (copy as text)</button>
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
  const [chat, setChat] = useState<PubUser | null>(null);
  const { unread, reload } = useUnreadMessages(me.coaches.length > 0);
  // Deep link from a coach's message notification: open that thread straight away.
  useEffect(() => {
    const want = ui.sub.profile;
    if (want?.startsWith("coachmsg")) {
      const id = want.split(":")[1];
      const c = me.coaches.find((x) => x.id === id) ?? me.coaches[0];
      if (c) setChat(c);
      ui.setSub("profile", "");
    }
  }, [ui.sub.profile]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <div key={c.id} className="stack" style={{ gap: 10 }}>
            <div className="flex items-center gap-3">
              <span className="avatar">{initials(c.displayName)}</span>
              <div className="flex-1 min0"><div className="text-sm font-semibold">{c.displayName}</div><div className="mono text-[11px] muted">@{c.username} · can view your data</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(c)} aria-label={`Remove coach ${c.displayName}`} data-testid={`button-remove-coach-${c.username}`}><X size={15} /></button>
            </div>
            <button className="btn btn-block" style={{ position: "relative" }} onClick={() => setChat(c)} data-testid={`button-message-coach-${c.username}`}>
              <MessageSquare size={16} /> Messages with {c.displayName.split(" ")[0]}{unread[c.id] ? <span className="inbox-badge" data-testid={`text-coach-unread-${c.username}`}>{unread[c.id]}</span> : null}
            </button>
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
      {chat && (
        <Sheet title={`Messages with ${chat.displayName}`} onClose={() => { setChat(null); reload(); }} full testId="sheet-coach-messages">
          <p className="text-xs muted mb-2">Only you and {chat.displayName.split(" ")[0]} can see this conversation.</p>
          <MessageThread otherId={chat.id} otherName={chat.displayName} onRead={reload} height={380} />
        </Sheet>
      )}
    </>
  );
}

function GrainCard() {
  const g = useGrain();
  const ink = useInk();
  return (
    <div className="card mt-3" data-testid="card-grain">
      <div className="label mb-2">Ink</div>
      <Seg value={ink} onChange={(v) => setInk(v)} options={[{ v: "cobalt", l: "Pink" }, { v: "black", l: "Black · high contrast" }]} testId="seg-ink" />
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
