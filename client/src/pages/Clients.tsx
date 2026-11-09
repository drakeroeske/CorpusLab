// Coach workspace: every client's readiness, adherence and progress, their program, and two-way messages.
// Shown as its own tab only for coach accounts (or offline Coach mode with demo clients).
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, MessageSquare, RefreshCw, UserCog } from "lucide-react";
import { useAuth, type PubUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { clientFromState } from "@/lib/social";
import { useStore } from "@/lib/store";
import { upgradeState } from "@/lib/empty";
import { useUI } from "@/App";
import { EngineHeader } from "@/components/riso";
import { Empty, LineChart, Seg, Sheet, Spark, initials } from "@/components/ui";
import { ProgramEditor } from "@/components/ProgramEditor";
import { MessageThread } from "@/components/MessageThread";
import {
  addDays, avgReadiness, bodyWeightSeries, dateKey, daysBetween, e1rmSeries, fmtDate, mean, phaseInfo, plateauFlags, projection,
  r1, readinessSeries, userStreak, weeklySets,
} from "@/lib/engine";
import { EX, MAIN_LIFTS, MUSCLE_LABEL, MUSCLES, customExercisesIn, newId } from "@/lib/exercises";
import type { AppState, Client, Program } from "@/lib/types";

export function clientFlags(c: Client): string[] {
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

/** Parse the Clients sub-state: "client:<id>:<section>" opens a client directly (used by deep links from messages). */
const parseSub = (s?: string): { id: string; section: Section } | null => {
  if (!s?.startsWith("client:")) return null;
  const [, id, section] = s.split(":");
  return id ? { id, section: (section as Section) || "overview" } : null;
};

export default function ClientsPage() {
  const auth = useAuth();
  const { mode } = useStore();
  const live = mode === "remote" && !!auth.me;
  return (
    <div>
      <EngineHeader title="Clients" testId="header-clients" />
      {live ? <LiveCoachDashboard /> : <CoachDashboard />}
    </div>
  );
}

/* ============================ shared list UI ============================ */

function ClientCard({ c, unread, last, onOpen, onMessages }: { c: Client; unread?: number; last?: { text: string; ts: number; mine: boolean } | null; onOpen: () => void; onMessages?: () => void }) {
  const today = c.readiness[c.readiness.length - 1];
  const flags = clientFlags(c);
  return (
    <div className="card" data-testid={`card-client-${c.id}`}>
      <button className="w-full text-left" onClick={onOpen} data-testid={`button-open-client-${c.id}`}>
        <div className="flex items-center gap-3">
          <span className="avatar" style={{ position: "relative" }}>{initials(c.name)}{unread ? <span className="inbox-badge" data-testid={`text-client-unread-${c.id}`}>{unread}</span> : null}</span>
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
      {onMessages && (
        <button className="flex items-center gap-2 w-full text-left mt-3 pt-3" style={{ borderTop: "1px solid var(--line)", minHeight: 44 }} onClick={onMessages} data-testid={`button-client-messages-${c.id}`}>
          <MessageSquare size={15} className={unread ? "" : "muted"} />
          <span className={`text-xs flex-1 min0 truncate ${unread ? "font-semibold" : "muted"}`}>{last ? `${last.mine ? "You: " : ""}${last.text}` : "No messages yet"}</span>
          <span className="text-[11px] faint">{last ? fmtDate(dateKey(new Date(last.ts))) : "Message"}</span>
        </button>
      )}
    </div>
  );
}

function Flags({ clients }: { clients: Client[] }) {
  const all = clients.flatMap((c) => clientFlags(c).map((f) => `${c.name.split(" ")[0]}: ${f}`));
  if (!all.length) return null;
  return (
    <div className="card" style={{ borderColor: "rgba(180,35,24,.4)" }}>
      <div className="label orange mb-2 flex items-center gap-2"><AlertTriangle size={13} /> Needs attention</div>
      {all.map((f, i) => <p key={i} className="text-sm py-1" data-testid={`text-coach-flag-${i}`}>{f}</p>)}
    </div>
  );
}

/* ============================ offline / demo ============================ */

function CoachDashboard() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const client = state.clients.find((c) => c.id === open);
  if (!state.clients.length) return <div className="card mt-3"><p className="text-sm muted">No clients yet. Sign in as a coach and share your coach code, or load demo data to see sample clients.</p></div>;
  return (
    <div data-testid="view-coach-dashboard">
      <Flags clients={state.clients} />
      <div className="stack mt-3">
        {state.clients.map((c) => <ClientCard key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
      </div>
      {client && <ClientSheet client={client} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ============================ live (server) ============================ */

interface LiveClient extends PubUser { sharesVault: boolean; updatedAt: string | null; state: AppState | null; notes: { id: string; date: string; text: string }[]; unread?: number; lastMessage?: { text: string; ts: number; mine: boolean } | null }

function LiveCoachDashboard() {
  const auth = useAuth();
  const ui = useUI();
  const [data, setData] = useState<LiveClient[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<{ id: string; section: Section } | null>(null);
  const load = useCallback(() => api<{ clients: LiveClient[] }>("GET", "/api/coach/clients").then((r) => { setData(r.clients); setErr(""); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  // Deep link (e.g. from a new-message notification): open that client's thread, then clear the sub so it doesn't re-trigger.
  const want = parseSub(ui.sub.clients);
  useEffect(() => { if (want) { setOpen(want); ui.setSub("clients", ""); } }, [want?.id, want?.section]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep unread counts fresh while the list is on screen.
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible" && !open) load(); }, 30_000); return () => clearInterval(t); }, [load, open]);

  if (err) return <div className="card mt-3"><p className="text-sm orange">{err}</p><button className="btn btn-sm mt-2" onClick={load}><RefreshCw size={14} /> Retry</button></div>;
  if (!data) return <p className="text-sm muted mt-3">Loading clients…</p>;
  const withState = data.filter((c) => c.state?.profile?.onboarded);
  const clients = withState.map((c) => clientFromState(c.id, c.displayName, upgradeState(c.state!), c.notes));
  const pendingSetup = data.filter((c) => !c.state?.profile?.onboarded);
  const raw = data.find((c) => c.id === open?.id);
  const client = clients.find((c) => c.id === open?.id);
  const totalUnread = data.reduce((a, c) => a + (c.unread ?? 0), 0);
  return (
    <div data-testid="view-coach-dashboard">
      <div className="section-title" style={{ marginTop: 0 }}><h2>{data.length} client{data.length === 1 ? "" : "s"}</h2>{totalUnread > 0 && <span className="chip chip-signal" data-testid="text-clients-unread-total">{totalUnread} unread</span>}</div>
      {data.length === 0 && <div className="card"><p className="text-sm muted">No clients yet. Share your coach code from your profile; clients who add it appear here.</p>
        <button className="btn btn-block mt-3" onClick={() => ui.setTab("profile")} data-testid="button-clients-go-profile">Find my coach code</button></div>}
      <Flags clients={clients} />
      <div className="stack mt-3">
        {clients.map((c) => {
          const r = data.find((x) => x.id === c.id);
          return <ClientCard key={c.id} c={c} unread={r?.unread} last={r?.lastMessage} onOpen={() => setOpen({ id: c.id, section: "overview" })} onMessages={() => setOpen({ id: c.id, section: "messages" })} />;
        })}
        {pendingSetup.map((c) => (
          <div key={c.id} className="card-flat flex items-center gap-3" data-testid={`card-client-pending-${c.id}`}><span className="avatar">{initials(c.displayName)}</span><span className="text-sm flex-1">{c.displayName}</span><span className="mono text-[11px] muted">setting up</span></div>
        ))}
      </div>
      {client && raw && open && (
        <ClientSheet key={client.id + (raw.updatedAt ?? "")} client={client} state={upgradeState(raw.state!)} initial={open.section} onClose={() => { setOpen(null); load(); }} actions={{
          saveSessionNote: async (sessionId, note) => { await api("POST", `/api/coach/clients/${client.id}/session-note`, { sessionId, note }); await load(); },
          saveProgram: async (program) => { await api("PUT", `/api/coach/clients/${client.id}/program`, { program }); await load(); },
          sendProgram: async (program) => {
            // The coach's own exercises travel with the program so the client sees real names.
            const custom = customExercisesIn(program).map(({ archived: _a, ...e }) => e);
            await api("POST", `/api/coach/clients/${client.id}/program-send`, { program: custom.length ? { ...program, customExercises: custom } : program });
          },
          addNote: async (text) => { await api("POST", `/api/coach/clients/${client.id}/notes`, { text, date: dateKey() }); await load(); },
          openAccount: () => { setOpen(null); auth.viewAs({ id: client.id, name: client.name, state: upgradeState(raw.state!) }); },
          messages: true,
        }} />
      )}
    </div>
  );
}

/* ============================ client detail ============================ */

type Section = "overview" | "progress" | "program" | "messages";

interface ClientActions {
  saveSessionNote: (sessionId: string, note: string) => Promise<void>;
  saveProgram: (p: Program) => Promise<void>;
  /** Drop a program into the client's inbox; they choose when to switch. */
  sendProgram?: (p: Program) => Promise<void>;
  addNote: (text: string) => Promise<void>;
  openAccount?: () => void;
  /** Two-way messages are only available for live accounts. */
  messages?: boolean;
}

export function ClientSheet({ client, state: cs, initial = "overview", onClose, actions }: { client: Client; state?: AppState; initial?: Section; onClose: () => void; actions?: ClientActions }) {
  const { set, profile, state } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<Section>(initial);
  const [prog, setProg] = useState<Program>(client.program);
  const [sendOpen, setSendOpen] = useState(false);
  const sendable = [...(state.program ? [{ id: "current", name: `${state.program.name} (what I'm running)`, program: state.program }] : []), ...(state.savedPrograms ?? []).map((sp) => ({ id: sp.id, name: sp.name, program: sp.program }))];
  const [note, setNote] = useState("");
  const [sessNotes, setSessNotes] = useState<Record<string, string>>(Object.fromEntries(client.recent.map((r) => [r.id, r.note])));
  const updClient = (f: (c: Client) => Client) => set((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? f(c) : c)) }));
  const flags = clientFlags(client);
  const first = client.name.split(" ")[0];
  const act: ClientActions = actions ?? {
    saveSessionNote: async (id, n) => updClient((c) => ({ ...c, recent: c.recent.map((x) => (x.id === id ? { ...x, note: n } : x)) })),
    saveProgram: async (p) => updClient((c) => ({ ...c, program: p })),
    addNote: async (text) => updClient((c) => ({ ...c, notes: [{ id: newId("n"), date: dateKey(), text }, ...c.notes] })),
  };
  const run = async (f: () => Promise<void>, msg?: string) => { try { await f(); if (msg) ui.toast(msg); } catch (e) { ui.toast((e as Error).message); } };
  const options: { v: Section; l: string }[] = [
    { v: "overview", l: "Overview" }, { v: "progress", l: "Progress" }, { v: "program", l: "Program" },
    ...(act.messages ? [{ v: "messages" as Section, l: "Messages" }] : []),
  ];
  const today = dateKey();
  const streak = cs ? userStreak(cs, today) : null;
  const phase = cs ? phaseInfo(cs.program, today, false) : null;
  const bw = cs ? bodyWeightSeries(cs) : [];
  const lastBw = bw[bw.length - 1];
  const bwWeekAgo = bw.filter((x) => daysBetween(x.date, today) >= 7).pop();

  return (
    <Sheet title={client.name} onClose={onClose} full testId="sheet-client" right={<UserCog size={18} className="muted" />}>
      <Seg value={tab} onChange={setTab} options={options} testId="seg-client-tab" />
      <div className="mt-3">
        {tab === "overview" && (
          <>
            {flags.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{flags.map((f) => <span key={f} className="chip chip-orange">{f}</span>)}</div>}
            <div className="stat-grid mb-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="stat"><div className="label">Readiness</div><div className="v">{client.readiness[client.readiness.length - 1]}</div><div className="s">7d avg {Math.round(mean(client.readiness))}</div></div>
              <div className="stat"><div className="label">Adherence</div><div className="v">{Math.round(client.adherence * 100)}%</div><div className="s">4 weeks</div></div>
              <div className="stat"><div className="label">Protein</div><div className="v">{Math.round(mean(client.protein))}%</div><div className="s">of target</div></div>
            </div>
            {cs && (
              <div className="stat-grid mb-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="stat"><div className="label">Streak</div><div className="v">{streak}</div><div className="s">planned days</div></div>
                <div className="stat"><div className="label">Program</div><div className="v">{phase?.week ? `wk ${phase.week}` : "—"}</div><div className="s">{phase?.phase ?? "No program"}</div></div>
                <div className="stat"><div className="label">Body weight</div><div className="v">{lastBw ? r1(lastBw.w) : "—"}</div><div className="s">{lastBw && bwWeekAgo ? `${lastBw.w - bwWeekAgo.w >= 0 ? "+" : ""}${r1(lastBw.w - bwWeekAgo.w)} ${profile.units} / wk` : profile.units}</div></div>
              </div>
            )}
            {act.openAccount && (
              <button className="btn btn-outline btn-block mb-3" onClick={act.openAccount} data-testid="button-open-client-account"><Eye size={16} /> Open {first}'s account (read-only)</button>
            )}
            <div className="section-title"><h2>Recent sessions</h2></div>
            <div className="stack">
              {client.recent.length === 0 && <p className="text-sm muted">No finished sessions yet.</p>}
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
            <div className="section-title"><h2>Private notes</h2><span className="label">only you see these</span></div>
            <textarea className="textarea" placeholder="Private coaching note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="textarea-client-note" />
            <button className="btn btn-primary btn-block mt-2" disabled={!note.trim()} onClick={() => { const t = note.trim(); setNote(""); run(() => act.addNote(t), "Note added"); }} data-testid="button-add-client-note">Add note</button>
            <div className="mt-3">
              {client.notes.length === 0 ? <p className="text-sm muted">No notes yet.</p> : client.notes.map((n) => (
                <div key={n.id} className="rowline" style={{ alignItems: "flex-start" }}><span className="text-sm">{n.text}</span><span className="mono text-xs muted">{fmtDate(n.date)}</span></div>
              ))}
            </div>
          </>
        )}
        {tab === "progress" && (cs ? <ClientProgress cs={cs} units={profile.units} /> : <Empty>Progress charts need a live client account.</Empty>)}
        {tab === "program" && (
          <>
            <ProgramEditor program={prog} units={profile.units} onChange={setProg} />
            <button className="btn btn-primary btn-lg btn-block mt-3" disabled={JSON.stringify(prog) === JSON.stringify(client.program)} onClick={() => run(() => act.saveProgram(prog), `Program updated for ${first}`)} data-testid="button-save-client-program">Save program for {first}</button>
            {act.sendProgram && sendable.length > 0 && (
              <button className="btn btn-block mt-2" onClick={() => setSendOpen(true)} data-testid="button-send-program-open">Send one of my programs</button>
            )}
            {sendOpen && (
              <Sheet title="Send a program" onClose={() => setSendOpen(false)} testId="sheet-send-program">
                <p className="text-sm">{first} gets it on their Program tab and chooses to switch to it or save it — nothing changes until they do.</p>
                {sendable.map((sp) => (
                  <button key={sp.id} className="card w-full text-left mt-2" onClick={() => { setSendOpen(false); run(() => act.sendProgram!({ ...sp.program, name: sp.program.name, deloadUntil: null }), `Sent to ${first}`); }} data-testid={`button-send-program-${sp.id}`}>
                    <div className="font-semibold">{sp.name}</div>
                    <div className="mono text-[11px] mt-1">{sp.program.days.length} days · {sp.program.days.map((d) => d.name).join(" · ")}</div>
                  </button>
                ))}
              </Sheet>
            )}
          </>
        )}
        {tab === "messages" && act.messages && (
          <>
            <p className="text-xs muted mb-2">{first} sees these under Profile, then My coach. New messages also reach their inbox.</p>
            <MessageThread otherId={client.id} otherName={client.name} height={360} />
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ============================ client progress ============================ */

function ClientProgress({ cs, units }: { cs: AppState; units: string }) {
  const today = dateKey();
  const lifts = MAIN_LIFTS.filter((id) => e1rmSeries(cs.sessions, id).length >= 2);
  const [lift, setLift] = useState(lifts[0] ?? "bench_press");
  const ser = e1rmSeries(cs.sessions, lift).filter((x) => daysBetween(x.date, today) <= 56);
  const proj = projection(e1rmSeries(cs.sessions, lift), today, units as "kg" | "lb", 1);
  const plateaus = useMemo(() => plateauFlags(cs, today), [cs, today]);
  const ready = readinessSeries(cs, today, 28).filter((x) => x.score != null) as { date: string; score: number }[];
  const avg7 = avgReadiness(cs, today, 7);
  const sets = weeklySets(cs.sessions, addDays(today, -6), today);
  const setsPrev = weeklySets(cs.sessions, addDays(today, -13), addDays(today, -7));
  const trained = MUSCLES.filter((m) => (sets[m] ?? 0) > 0 || (setsPrev[m] ?? 0) > 0);
  // Weekly volume (sets x reps x weight) over the last 8 weeks.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(today, -6 - (7 - i) * 7), to = addDays(from, 6);
    const vol = cs.sessions.filter((s) => s.end && s.date >= from && s.date <= to).reduce((a, s) => a + s.exercises.reduce((b, l) => b + l.sets.reduce((c, x) => c + x.weight * x.reps, 0), 0), 0);
    const n = cs.sessions.filter((s) => s.end && s.date >= from && s.date <= to).length;
    return { from, vol, n };
  });
  const maxVol = Math.max(1, ...weeks.map((w) => w.vol));
  const bw = bodyWeightSeries(cs).filter((x) => daysBetween(x.date, today) <= 56);

  return (
    <div data-testid="view-client-progress">
      <div className="section-title" style={{ marginTop: 0 }}><h2>Strength</h2><span className="label">estimated 1RM</span></div>
      <div className="card">
        {lifts.length === 0 ? <p className="text-sm muted">No main lifts logged twice yet.</p> : (
          <>
            <select className="select" value={lift} onChange={(e) => setLift(e.target.value)} data-testid="select-client-lift">
              {lifts.map((id) => <option key={id} value={id}>{EX[id].name}</option>)}
            </select>
            {ser.length >= 2 ? (
              <div className="mt-3">
                <LineChart height={130} testId="chart-client-e1rm"
                  series={[{ points: ser.map((x) => ({ x: daysBetween(today, x.date), y: x.e1rm })), color: "var(--lime)", dots: true, width: 2 }]}
                  xLabels={[-56, -28, 0].map((x) => ({ x, label: x === 0 ? "today" : `${-x / 7}w` }))} />
              </div>
            ) : <p className="text-sm muted mt-2">Not enough recent sessions for a chart.</p>}
            <div className="mono text-xs muted mt-2" data-testid="text-client-e1rm">
              {proj ? <>e1RM {Math.round(proj.current)} {units} · {proj.slopePerWeek >= 0 ? "+" : ""}{r1(proj.slopePerWeek)} {units}/wk</> : "Not enough data in the last 6 weeks."}
            </div>
          </>
        )}
        <div className="mt-3">
          {MAIN_LIFTS.map((id) => { const s = e1rmSeries(cs.sessions, id); if (!s.length) return null; const cur = s[s.length - 1].e1rm, prev = s.filter((x) => daysBetween(x.date, today) >= 28).pop();
            return <div key={id} className="rowline"><span className="text-sm">{EX[id].name}</span><span className="mono text-sm">{Math.round(cur)} {units} {prev && <span className={`text-xs ${cur >= prev.e1rm ? "lime" : "orange"}`}>{cur - prev.e1rm >= 0 ? "+" : ""}{Math.round(cur - prev.e1rm)} vs 4w</span>}</span></div>; })}
        </div>
      </div>

      {plateaus.length > 0 && (
        <>
          <div className="section-title"><h2>Plateaus</h2><span className="chip chip-orange">{plateaus.length}</span></div>
          <div className="card stack" data-testid="card-client-plateaus">
            {plateaus.map((p) => <div key={p.exId}><div className="text-sm font-semibold">{EX[p.exId]?.name ?? p.exId}</div><p className="text-xs muted mt-1">{p.fix}</p></div>)}
          </div>
        </>
      )}

      <div className="section-title"><h2>Weekly sets</h2><span className="label">this week vs last</span></div>
      <div className="card" data-testid="card-client-sets">
        {trained.length === 0 ? <p className="text-sm muted">No sets logged in the last two weeks.</p> : trained.map((m) => {
          const cur = sets[m] ?? 0, prev = setsPrev[m] ?? 0;
          return (
            <div key={m} className="rowline">
              <span className="text-sm">{MUSCLE_LABEL[m]}</span>
              <span className="flex items-center gap-3"><span className="bar" style={{ width: 90, display: "inline-block" }}><i style={{ width: `${Math.min(100, (cur / 20) * 100)}%` }} /></span><span className="mono text-sm" style={{ minWidth: 60, textAlign: "right" }}>{cur} <span className="text-xs muted">/ {prev}</span></span></span>
            </div>
          );
        })}
        <p className="text-[11px] faint mt-2">Bar fills at 20 hard sets a week. 10 to 20 is the usual growth range.</p>
      </div>

      <div className="section-title"><h2>Weekly volume</h2><span className="label">8 weeks</span></div>
      <div className="card" data-testid="card-client-volume">
        <div className="flex items-end gap-1" style={{ height: 90 }}>
          {weeks.map((w) => (
            <div key={w.from} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }} title={`${fmtDate(w.from)}: ${Math.round(w.vol)} ${units}`}>
              <div style={{ width: "100%", height: `${Math.max(2, (w.vol / maxVol) * 100)}%`, background: w.from === weeks[weeks.length - 1].from ? "var(--ink-deep)" : "var(--ink)" }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between label mt-1"><span>{fmtDate(weeks[0].from)}</span><span>this week</span></div>
        <div className="mono text-xs muted mt-2">{Math.round(weeks[weeks.length - 1].vol).toLocaleString()} {units} this week · {weeks[weeks.length - 1].n} session{weeks[weeks.length - 1].n === 1 ? "" : "s"}</div>
      </div>

      <div className="section-title"><h2>Readiness</h2><span className="mono text-sm">{avg7 != null ? Math.round(avg7) : "—"} <span className="label">7d avg</span></span></div>
      <div className="card">
        {ready.length < 2 ? <Empty>No check-ins in the last 4 weeks.</Empty> : (
          <LineChart height={120} testId="chart-client-readiness" band={{ y0: 50, y1: 75 }}
            series={[{ points: ready.map((x) => ({ x: daysBetween(today, x.date), y: x.score })), color: "var(--blue)", dots: true, width: 2 }]}
            xLabels={[-28, -14, 0].map((x) => ({ x, label: x === 0 ? "today" : `${-x / 7}w` }))} />
        )}
      </div>

      <div className="section-title"><h2>Body weight</h2><span className="label">8 weeks</span></div>
      <div className="card">
        {bw.length < 2 ? <Empty>No weigh-ins yet.</Empty> : (
          <LineChart height={120} testId="chart-client-bodyweight" yFmt={(v) => r1(v).toFixed(1)}
            series={[{ points: bw.map((x) => ({ x: daysBetween(today, x.date), y: x.w })), color: "var(--lime)", dots: true, width: 2 }]}
            xLabels={[-56, -28, 0].map((x) => ({ x, label: x === 0 ? "today" : `${-x / 7}w` }))} />
        )}
      </div>
    </div>
  );
}
