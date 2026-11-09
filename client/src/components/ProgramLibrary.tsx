// Saved programs, share codes, coach inbox, and import (code / screenshot / pasted text).
import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, Copy, Download, Share2, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useUI } from "@/App";
import { api } from "@/lib/api";
import { Seg, Sheet } from "./ui";
import { Tag, shortDate } from "./riso";
import { EX, allExercises, customExercisesIn, isKnownExercise, newId, registerCustomExercises } from "@/lib/exercises";
import { dateKey } from "@/lib/engine";
import { daysToProgram, ocrImage, parseProgramText, toProgramDays, type ParsedDay } from "@/lib/programImport";
import type { Exercise, Program, SavedProgram } from "@/lib/types";

const copyText = async (t: string) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };

/** "My programs" card: save a copy of the current one, load, share, delete. */
export function ProgramLibrary({ onImport }: { onImport: () => void }) {
  const { state, set } = useStore();
  const auth = useAuth();
  const ui = useUI();
  const [share, setShare] = useState<{ name: string; code: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const saved = state.savedPrograms ?? [];
  const live = auth.live && !auth.viewing && !auth.me?.isDemo;

  const saveCopy = () => {
    if (!state.program) return;
    const name = window.prompt("Name this program", state.program.name) ?? "";
    if (!name.trim()) return;
    const sp: SavedProgram = { id: newId("sp"), name: name.trim(), savedAt: Date.now(), source: "mine", program: { ...state.program, name: name.trim(), deloadUntil: null } };
    set((s) => ({ ...s, savedPrograms: [sp, ...(s.savedPrograms ?? [])].slice(0, 30) }));
    ui.toast("Saved to My programs");
  };
  const load = (sp: SavedProgram) => {
    if (!window.confirm(`Switch to "${sp.name}"? Your current program is replaced (save a copy first if you want it back). Logged history is kept.`)) return;
    set((s) => ({ ...s, program: { ...sp.program, name: sp.name, startDate: dateKey(), deloadUntil: null, days: sp.program.days.map((d) => ({ ...d, id: newId("day"), exercises: d.exercises.map((e) => ({ ...e, id: newId("pe") })) })) } }));
    ui.toast(`Now on ${sp.name}`);
  };
  const doShare = async (p: Program, name: string) => {
    if (!live) { ui.toast("Sign in to share programs"); return; }
    setBusy(name);
    try {
      // Custom exercises ride along so the friend gets them too.
      const custom = customExercisesIn(p).map(({ archived: _a, ...e }) => e);
      const program: Program = custom.length ? { ...p, customExercises: custom } : p;
      const r = await api<{ code: string; name: string }>("POST", "/api/programs/share", { program, name });
      setShare({ name: r.name, code: r.code });
    } catch (e) { ui.toast((e as Error).message || "Couldn't share"); } finally { setBusy(null); }
  };

  return (
    <div className="card mt-3" data-testid="card-program-library">
      <div className="flex items-start justify-between gap-2">
        <div><div className="label">My programs</div><p className="text-xs mt-1">Save what you're running, switch between programs, share with a code.</p></div>
        <Tag>{saved.length}</Tag>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        <button className="btn btn-sm" onClick={saveCopy} disabled={!state.program} data-testid="button-save-copy"><Download size={14} /> Save a copy</button>
        {state.program && <button className="btn btn-sm" onClick={() => doShare(state.program!, state.program!.name)} disabled={busy != null} data-testid="button-share-current"><Share2 size={14} /> Share current</button>}
        <button className="btn btn-sm" onClick={onImport} data-testid="button-import-program"><Upload size={14} /> Import</button>
      </div>
      {saved.length > 0 && (
        <div className="mt-3">
          {saved.map((sp) => (
            <div key={sp.id} className="flex items-center gap-2" style={{ minHeight: 48, borderTop: "1px solid var(--line)" }} data-testid={`row-saved-${sp.id}`}>
              <div className="min0 flex-1">
                <div className="font-semibold text-sm truncate">{sp.name}</div>
                <div className="mono text-[11px]">{sp.program.days.length} days · {sp.program.days.reduce((a, d) => a + d.exercises.length, 0)} exercises · {shortDate(new Date(sp.savedAt).toISOString().slice(0, 10))}{sp.source !== "mine" && ` · from ${sp.from ?? sp.source}`}</div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => load(sp)} data-testid={`button-load-saved-${sp.id}`}>Use</button>
              <button className="icon-btn" aria-label="Share" onClick={() => doShare(sp.program, sp.name)} data-testid={`button-share-saved-${sp.id}`}><Share2 size={15} /></button>
              <button className="icon-btn" aria-label="Delete" onClick={() => { if (window.confirm(`Delete "${sp.name}" from My programs?`)) set((s) => ({ ...s, savedPrograms: (s.savedPrograms ?? []).filter((x) => x.id !== sp.id) })); }} data-testid={`button-delete-saved-${sp.id}`}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {share && (
        <Sheet title="Share program" onClose={() => setShare(null)} testId="sheet-share-program">
          <p className="text-sm">Anyone with Corpus can load <b>{share.name}</b> with this code — Spotters, clients, your coach. It copies the exercises, sets, reps and starting weights; their history stays theirs.</p>
          <div className="card mt-3 flex items-center justify-between gap-3">
            <span className="display text-[40px]" data-testid="text-share-code">{share.code}</span>
            <button className="btn btn-sm" onClick={async () => ui.toast((await copyText(share.code)) ? "Code copied" : "Couldn't copy")} data-testid="button-copy-share-code"><Copy size={14} /> Copy</button>
          </div>
          <button className="btn btn-block btn-primary mt-3" onClick={async () => {
            const text = `Load my "${share.name}" program in Corpus: open Train → Program → Import and enter code ${share.code}. ${location.origin}`;
            if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
            ui.toast((await copyText(text)) ? "Message copied — paste it to your Spotters" : "Couldn't copy");
          }} data-testid="button-share-message"><Share2 size={16} /> Send to someone</button>
          <p className="text-xs mt-3">Codes you've shared keep working until you delete them (Profile → Data).</p>
        </Sheet>
      )}
    </div>
  );
}

/** Coach-sent programs waiting for a decision. */
export function ProgramInbox() {
  const { state, set } = useStore();
  const ui = useUI();
  const inbox = state.programInbox ?? [];
  if (!inbox.length) return null;
  const dismiss = (id: string) => set((s) => ({ ...s, programInbox: (s.programInbox ?? []).filter((x) => x.id !== id), programInboxDismissed: [...(s.programInboxDismissed ?? []), id].slice(-50) }));
  return (
    <>
      {inbox.map((it) => (
        <div key={it.id} className="warn hatch mb-3" data-testid={`card-inbox-${it.id}`}><div className="inner">
          <Tag signal>From your coach</Tag>
          <div className="font-semibold mt-1">{it.program.name}</div>
          <div className="mono text-[11px]">{it.from} · {it.program.days.length} days · {shortDate(new Date(it.ts).toISOString().slice(0, 10))}</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button className="btn btn-sm btn-primary" onClick={() => { const p = adoptCarriedExercises(it.program, state.customExercises, set); set((s) => ({ ...s, program: { ...p, startDate: dateKey(), deloadUntil: null, coachEditedAt: Date.now(), coachEditedBy: it.from } })); dismiss(it.id); ui.toast(`Now on ${it.program.name}`); }} data-testid={`button-inbox-use-${it.id}`}>Switch to it</button>
            <button className="btn btn-sm" onClick={() => { const p = adoptCarriedExercises(it.program, state.customExercises, set); set((s) => ({ ...s, savedPrograms: [{ id: newId("sp"), name: it.program.name, savedAt: Date.now(), source: "coach", from: it.from, program: p }, ...(s.savedPrograms ?? [])] })); dismiss(it.id); ui.toast("Saved to My programs"); }} data-testid={`button-inbox-save-${it.id}`}>Save for later</button>
            <button className="btn btn-sm btn-ghost" onClick={() => dismiss(it.id)} data-testid={`button-inbox-dismiss-${it.id}`}>Dismiss</button>
          </div>
        </div></div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ import sheet */
type Mode = "code" | "photo" | "text";

export function ImportProgramSheet({ onClose }: { onClose: () => void }) {
  const { state, set, profile } = useStore();
  const auth = useAuth();
  const ui = useUI();
  const [mode, setMode] = useState<Mode>("photo");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedDay[] | null>(null);
  const [preview, setPreview] = useState<{ name: string; program: Program; from?: string } | null>(null);
  const [how, setHow] = useState<"replace" | "add" | "save">("replace");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mode === "photo") setTimeout(() => fileRef.current?.focus(), 50); }, [mode]);

  const runText = (t: string) => {
    const d = parseProgramText(t, profile.units);
    if (!d.length) { ui.toast("Couldn't find any 'exercise  sets × reps' lines. Try pasting the text instead."); return; }
    setParsed(d);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy("Reading screenshot… 0%");
    try {
      const t = await ocrImage(f, (p) => setBusy(`Reading screenshot… ${p}%`));
      setText(t);
      runText(t);
    } catch (e) { ui.toast("Couldn't read that image. Paste the text instead."); console.error(e); } finally { setBusy(null); }
  };
  const lookup = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) { ui.toast("Codes are 6 letters/numbers"); return; }
    if (!auth.live) { ui.toast("Sign in to import by code"); return; }
    setBusy("Looking up…");
    try {
      const r = await api<{ name: string; program: Program; owner: { displayName: string } | null }>("GET", `/api/programs/${c}`);
      setPreview({ name: r.name, program: r.program, from: r.owner?.displayName });
    } catch (e) { ui.toast((e as Error).message || "Not found"); } finally { setBusy(null); }
  };

  const apply = (incoming: Program, from?: string) => {
    const program = adoptCarriedExercises(incoming, state.customExercises, set);
    const fresh: Program = { ...program, startDate: dateKey(), deloadUntil: null, days: program.days.map((d) => ({ ...d, id: newId("day"), exercises: d.exercises.map((e) => ({ ...e, id: newId("pe") })) })) };
    if (how === "save") {
      set((s) => ({ ...s, savedPrograms: [{ id: newId("sp"), name: fresh.name, savedAt: Date.now(), source: from ? "code" : "import", from, program: fresh }, ...(s.savedPrograms ?? [])] }));
      ui.toast("Saved to My programs");
    } else if (how === "add" && state.program) {
      const used = new Set(state.program.days.flatMap((d) => d.weekdays));
      const days = fresh.days.map((d) => { let wd = d.weekdays.filter((w) => !used.has(w)); if (!wd.length) { let k = 1; while (used.has(k % 7) && k < 14) k++; wd = [k % 7]; } wd.forEach((w) => used.add(w)); return { ...d, weekdays: wd }; });
      set((s) => ({ ...s, program: s.program ? { ...s.program, days: [...s.program.days, ...days] } : fresh }));
      ui.toast(`Added ${days.length} day${days.length === 1 ? "" : "s"} to ${state.program.name}`);
    } else {
      set((s) => ({ ...s, program: fresh }));
      ui.toast(`Now on ${fresh.name}`);
    }
    onClose();
  };

  // --- review step for parsed text/screenshot
  if (parsed) {
    const setRow = (di: number, ei: number, patch: Partial<ParsedDay["exercises"][number]>) => setParsed((p) => p!.map((d, i) => i !== di ? d : { ...d, exercises: d.exercises.map((e, j) => (j !== ei ? e : { ...e, ...patch })) }));
    const total = parsed.reduce((a, d) => a + d.exercises.filter((e) => e.exId).length, 0);
    const days = toProgramDays(parsed, profile.units);
    return (
      <Sheet title="Check the import" onClose={onClose} full testId="sheet-import-review">
        <p className="text-sm">I read {parsed.length} day{parsed.length === 1 ? "" : "s"} and {total} exercises. Fix anything I got wrong — tap a name to change it. Unmatched rows are skipped.</p>
        {parsed.map((d, di) => (
          <div key={di} className="card mt-3">
            <input className="input font-semibold" value={d.name} onChange={(e) => setParsed((p) => p!.map((x, i) => (i === di ? { ...x, name: e.target.value } : x)))} data-testid={`input-import-day-${di}`} />
            {d.exercises.map((e, ei) => (
              <div key={ei} className="mt-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }} data-testid={`row-import-${di}-${ei}`}>
                <div className="mono text-[11px] truncate">read: “{e.raw}”{e.weight != null && ` · ${e.weight} ${profile.units}`}</div>
                <div className="flex items-center gap-2 mt-1">
                  <select className="select flex-1 min0" value={e.exId ?? ""} onChange={(ev) => setRow(di, ei, { exId: ev.target.value || null, confidence: 1 })} data-testid={`select-import-${di}-${ei}`}>
                    <option value="">— skip this row —</option>
                    {allExercises().map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <span className="mono text-xs shrink-0">{e.sets}×{e.repMin}{e.repMax !== e.repMin ? `–${e.repMax}` : ""}</span>
                  {e.exId && e.confidence < 0.7 && <Tag signal>Check</Tag>}
                </div>
              </div>
            ))}
          </div>
        ))}
        <ApplyChoice how={how} setHow={setHow} hasProgram={!!state.program} />
        <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!days.length} onClick={() => apply(daysToProgram(days, state.program && how === "add" ? state.program.name : "Imported program", dateKey()))} data-testid="button-import-apply">
          {how === "save" ? "Save to My programs" : how === "add" ? `Add ${days.length} day${days.length === 1 ? "" : "s"}` : "Use this program"}
        </button>
        <button className="btn btn-ghost btn-block mt-2" onClick={() => setParsed(null)}>Back</button>
      </Sheet>
    );
  }

  if (preview) {
    return (
      <Sheet title={preview.name} onClose={onClose} testId="sheet-import-preview">
        <p className="text-sm">{preview.from ? `Shared by ${preview.from}. ` : ""}{preview.program.days.length} days.</p>
        {preview.program.days.map((d) => (
          <div key={d.id} className="card mt-2">
            <div className="font-semibold">{d.name}</div>
            <div className="mono text-[11px] mt-1">{d.exercises.map((e) => `${(isKnownExercise(e.exId) ? EX[e.exId].name : preview.program.customExercises?.find((c) => c.id === e.exId)?.name) ?? EX[e.exId].name} ${e.sets}×${e.repMin}${e.repMax !== e.repMin ? `–${e.repMax}` : ""}`).join(" · ")}</div>
          </div>
        ))}
        <ApplyChoice how={how} setHow={setHow} hasProgram={!!state.program} />
        <button className="btn btn-primary btn-lg btn-block mt-3" onClick={() => apply({ ...preview.program, name: preview.name }, preview.from)} data-testid="button-preview-apply">{how === "save" ? "Save to My programs" : how === "add" ? "Add these days" : "Use this program"}</button>
        <button className="btn btn-ghost btn-block mt-2" onClick={() => setPreview(null)}>Back</button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Import program" onClose={onClose} testId="sheet-import-program">
      <Seg value={mode} onChange={setMode} options={[{ v: "photo", l: "Screenshot" }, { v: "text", l: "Paste text" }, { v: "code", l: "Code" }]} testId="seg-import-mode" />
      {mode === "photo" && (
        <div className="mt-3">
          <p className="text-sm">Take or upload a screenshot of your current split — from notes, a spreadsheet or another app. I read the exercise names and sets × reps, then you check the result. Nothing is uploaded; reading happens on your phone.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-import-file" />
          <button className="btn btn-primary btn-lg btn-block mt-3" disabled={busy != null} onClick={() => fileRef.current?.click()} data-testid="button-pick-screenshot"><Camera size={18} /> {busy ?? "Choose screenshot"}</button>
          <p className="text-xs mt-2">Works best with clear text, one exercise per line (e.g. "Bench Press 4×8"). The first time takes a few seconds to download the reader.</p>
        </div>
      )}
      {mode === "text" && (
        <div className="mt-3">
          <p className="text-sm">Paste your plan, one exercise per line. Day names on their own line start a new day.</p>
          <textarea className="input mt-2" style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 13 }} placeholder={"Push\nBench press 4x6-8\nIncline DB press 3x10\nLateral raise 3x15\n\nPull\nDeadlift 3x5\nLat pulldown 3x10-12"} value={text} onChange={(e) => setText(e.target.value)} data-testid="textarea-import-text" />
          <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!text.trim()} onClick={() => runText(text)} data-testid="button-parse-text"><ClipboardPaste size={18} /> Read it</button>
        </div>
      )}
      {mode === "code" && (
        <div className="mt-3">
          <p className="text-sm">Enter the 6-character code a Spotter or coach shared with you.</p>
          <div className="flex gap-2 mt-2">
            <input className="input mono flex-1" style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 20 }} maxLength={6} placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} data-testid="input-program-code" />
            <button className="btn btn-primary" disabled={busy != null || code.length < 6} onClick={lookup} data-testid="button-lookup-code">{busy ? "…" : "Find"}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ApplyChoice({ how, setHow, hasProgram }: { how: "replace" | "add" | "save"; setHow: (h: "replace" | "add" | "save") => void; hasProgram: boolean }) {
  return (
    <div className="field mt-4"><span className="label">What to do with it</span>
      <Seg value={how} onChange={setHow} options={[{ v: "replace", l: hasProgram ? "Replace mine" : "Use it" }, ...(hasProgram ? [{ v: "add" as const, l: "Add days" }] : []), { v: "save", l: "Save only" }]} testId="seg-import-how" />
    </div>
  );
}

/** Codes you've shared (Profile → Data): see how often they were used, revoke them. */
export function SharedCodes() {
  const auth = useAuth();
  const ui = useUI();
  const [rows, setRows] = useState<{ code: string; name: string; createdAt: string; uses: number }[] | null>(null);
  const live = auth.live && !auth.viewing && !auth.me?.isDemo;
  useEffect(() => { if (!live) return; api<{ shared: typeof rows }>("GET", "/api/programs").then((r) => setRows(r.shared ?? [])).catch(() => setRows([])); }, [live]);
  if (!live || !rows || rows.length === 0) return null;
  return (
    <div className="card mt-3" data-testid="card-shared-codes">
      <div className="label">Program codes you've shared</div>
      {rows.map((r) => (
        <div key={r.code} className="flex items-center gap-2" style={{ minHeight: 44, borderTop: "1px solid var(--line)" }} data-testid={`row-shared-${r.code}`}>
          <span className="mono font-bold" style={{ letterSpacing: "0.1em" }}>{r.code}</span>
          <span className="text-sm flex-1 min0 truncate">{r.name}</span>
          <span className="mono text-[11px]">{r.uses} use{r.uses === 1 ? "" : "s"}</span>
          <button className="icon-btn" aria-label="Revoke code" onClick={async () => { try { await api("DELETE", `/api/programs/${r.code}`); setRows((x) => (x ?? []).filter((y) => y.code !== r.code)); ui.toast("Code revoked"); } catch (e) { ui.toast((e as Error).message); } }} data-testid={`button-revoke-${r.code}`}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/** Custom exercises that came with a shared or coach-sent program join this user's library. Ids already here are kept
 *  as they are (brought back if they'd been deleted, since the program uses them). Returns the program without them. */
export function adoptCarriedExercises(incoming: Program, mine: Exercise[] | undefined, set: ReturnType<typeof useStore>["set"]): Program {
  const { customExercises: carried, ...program } = incoming;
  const valid = (carried ?? []).filter((e) => e && typeof e.id === "string" && e.id.startsWith("cx_") && typeof e.name === "string" && Array.isArray(e.primary));
  if (!valid.length) return program;
  const have = new Map((mine ?? []).map((e) => [e.id, e]));
  const list: Exercise[] = [
    ...(mine ?? []).map((e) => (e.archived && valid.some((v) => v.id === e.id) ? { ...e, archived: false } : e)),
    ...valid.filter((e) => !have.has(e.id)).map((e) => ({ ...e, name: e.name.slice(0, 60), secondary: Array.isArray(e.secondary) ? e.secondary : [], ratio: 1, custom: true, archived: false })),
  ];
  registerCustomExercises(list);
  set((s) => ({ ...s, customExercises: list }));
  return program;
}
