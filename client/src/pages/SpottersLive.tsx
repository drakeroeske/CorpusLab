import { useCallback, useEffect, useState } from "react";
import { Award, Check, Copy, Heart, MapPin, MessageCircle, RefreshCw, Send, Share, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { inviteLink } from "@/lib/invite";
import { PostCard } from "@/components/PostCard";
import { EngineHeader } from "@/components/riso";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { api } from "@/lib/api";
import { useAuth, type PubUser } from "@/lib/auth";
import { prWhyStat } from "@/lib/derived";
import { Empty, Seg, Sheet, initials } from "@/components/ui";
import { PRCardSheet, type PRData } from "@/components/PRCard";
import { dots, fmtW, fromKg, r1, sessionPRs } from "@/lib/engine";
import { EX } from "@/lib/exercises";
import type { PublicStats } from "@/lib/social";

type Sub = "feed" | "friends" | "gym" | "leaders";

interface LivePost {
  id: string; kind: "session" | "checkin"; ts: number; author: PubUser; mine: boolean; likes: number; liked: boolean;
  body: { sessionName?: string; topSets?: { name: string; weight: number; reps: number; units: string }[]; prs?: string[]; durationMin?: number; sessionId?: string; gym?: string };
  comments: { id: string; text: string; ts: number; author: PubUser }[];
}
interface FriendRow extends PubUser { stats: Partial<PublicStats> }

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

function Avatar({ name, me, size = 36 }: { name: string; me?: boolean; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, ...(me ? { borderColor: "var(--lime)", color: "var(--lime)" } : {}) }}>{initials(name)}</span>;
}

export default function SpottersLive() {
  const [sub, setSub] = useState<Sub>("feed");
  const [pending, setPending] = useState(0);
  useEffect(() => { api<{ incoming: unknown[] }>("GET", "/api/friends").then((r) => setPending(r.incoming.length)).catch(() => {}); }, [sub]);
  return (
    <div>
      <EngineHeader title="Spotters" section="FEED" brand="SPOTTER" />
      <nav className="subtabs" aria-label="Spotters sections">
        {([["feed", "Feed"], ["friends", pending ? `Friends · ${pending}` : "Friends"], ["gym", "Gym"], ["leaders", "Leaders"]] as const).map(([id, l]) => (
          <button key={id} aria-pressed={sub === id ? "true" : "false"} onClick={() => setSub(id)} data-testid={`subtab-spotters-${id}`}>{l}</button>
        ))}
      </nav>
      <div className="screen">
        {sub === "feed" && <Feed goFriends={() => setSub("friends")} />}
        {sub === "friends" && <Friends onChange={setPending} />}
        {sub === "gym" && <Gym />}
        {sub === "leaders" && <Leaders />}
      </div>
    </div>
  );
}

function useLoad<T>(path: string, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<T>("GET", path).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message)), [path]);
  useEffect(() => {
    load();
    if (!pollMs) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);
  return { data, err, reload: load };
}

/* ------------------------------------------------------------------ feed */
function Feed({ goFriends }: { goFriends: () => void }) {
  const { state, profile, targets } = useStore();
  const { me } = useAuth();
  const ui = useUI();
  const { data, err, reload } = useLoad<{ posts: LivePost[] }>("/api/feed", 20000);
  const [card, setCard] = useState<PRData | null>(null);
  const [posts, setPosts] = useState<LivePost[]>([]);
  useEffect(() => { if (data) setPosts(data.posts); }, [data]);

  const like = async (p: LivePost) => {
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)));
    try { await api("POST", `/api/posts/${p.id}/like`); } catch (e) { ui.toast((e as Error).message); reload(); }
  };
  const send = async (p: LivePost, txt: string) => {
    try { await api("POST", `/api/posts/${p.id}/comments`, { text: txt }); reload(); } catch (e) { ui.toast((e as Error).message); }
  };
  const remove = async (p: LivePost) => {
    setPosts((ps) => ps.filter((x) => x.id !== p.id));
    try { await api("DELETE", `/api/posts/${p.id}`); } catch (e) { ui.toast((e as Error).message); reload(); }
  };
  const prCard = (p: LivePost) => {
    const sess = state.sessions.find((s) => s.id === p.body.sessionId);
    if (!sess) return;
    const prs = sessionPRs(state.sessions, sess);
    if (!prs.length) return;
    const best = prs[0];
    setCard({ lift: EX[best.exId].name, weight: best.weight, reps: best.reps, e1rm: Math.round(best.e1rm), units: profile.units, why: prWhyStat(state, sess.date, targets.protein), name: profile.name, date: sess.date });
  };

  const prNos = new Map<string, number>();
  [...posts].reverse().filter((p) => (p.body.prs ?? []).length).forEach((p, i) => prNos.set(p.id, i + 1));
  if (!data && !err) return <p className="text-sm muted" data-testid="status-feed-loading">Loading feed…</p>;
  if (err && !data) return <div className="stack"><Empty>{err}</Empty><button className="btn btn-block" onClick={reload}><RefreshCw size={15} /> Try again</button></div>;
  return (
    <div className="stack" data-testid="view-feed">
      {!me?.shareFeed && <p className="text-xs orange">Your workouts aren't being shared. Turn on "Share workouts" in Profile to post them.</p>}
      {posts.length === 0 && (
        <>
          <Empty>No posts yet. Finished workouts post here automatically. Add friends to see theirs.</Empty>
          <button className="btn btn-primary btn-block" onClick={goFriends} data-testid="button-feed-add-friends"><UserPlus size={16} /> Add friends</button>
        </>
      )}
      {posts.map((p) => {
        const prs = p.body.prs ?? [];
        const sets = (p.body.topSets ?? []).map((t) => ({ ...t, pr: prs.includes(t.name) }));
        const title = p.kind === "checkin" ? `Checked in · ${p.body.gym ?? ""}` : p.body.sessionName ?? "Session";
        return (
          <PostCard key={p.id} id={p.id} author={p.author?.displayName ?? "?"} mine={p.mine} ts={p.ts} title={title} durationMin={p.kind === "session" ? p.body.durationMin : undefined}
            prNo={prNos.get(p.id)} sets={sets} prCount={prs.length} liked={p.liked} likes={p.likes}
            comments={p.comments.map((c) => ({ id: c.id, who: c.author?.id === me?.id ? "You" : c.author?.displayName.split(" ")[0] ?? "?", text: c.text }))}
            onLike={() => like(p)} onComment={(t) => send(p, t)}
            onChallenge={() => send(p, `[CHALLENGE] Coming for that ${prs[0] ?? sets[0]?.name ?? title}.`)}
            onPrCard={prs.length > 0 && p.body.sessionId && state.sessions.some((s) => s.id === p.body.sessionId) ? () => prCard(p) : undefined}
            onDelete={() => remove(p)} />
        );
      })}
      {card && <PRCardSheet data={card} onClose={() => setCard(null)} />}
    </div>
  );
}

/* --------------------------------------------------------------- friends */
function Friends({ onChange }: { onChange: (n: number) => void }) {
  const ui = useUI();
  const { data, err, reload } = useLoad<{ inviteCode: string; friends: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] }>("/api/friends");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<FriendRow | null>(null);
  useEffect(() => { if (data) onChange(data.incoming.length); }, [data, onChange]);

  const add = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ status: string; user: PubUser }>("POST", "/api/friends/request", { code });
      ui.toast(r.status === "accepted" ? `You and ${r.user.displayName} are now Spotters` : `Request sent to ${r.user.displayName}`);
      setCode(""); reload();
    } catch (e) { ui.toast((e as Error).message); } finally { setBusy(false); }
  };
  const act = async (method: string, path: string, msg: string) => {
    try { await api(method, path); ui.toast(msg); reload(); } catch (e) { ui.toast((e as Error).message); }
  };
  const auth = useAuth();
  const link = data ? inviteLink(data.inviteCode) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); ui.toast("Invite link copied"); } catch { ui.toast(link); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on RXS", text: `Spot me on RXS. Open this link to connect with ${auth.me?.displayName ?? "me"}:`, url: link }); } catch { /* cancelled */ }
    } else copy();
  };
  const [resetAsk, setResetAsk] = useState(false);
  const resetCode = async () => {
    try { auth.setMe(await api("POST", "/api/me/invite-code")); ui.toast("New invite link ready. Old links no longer work."); setResetAsk(false); reload(); }
    catch (e) { ui.toast((e as Error).message); }
  };

  if (!data) return err ? <Empty>{err}</Empty> : <p className="text-sm muted">Loading…</p>;
  return (
    <div className="stack" data-testid="view-friends">
      <div className="card" data-testid="card-invite">
        <div className="label">Invite friends</div>
        <p className="text-sm muted mt-1">Send your link. When a friend opens it and signs up, you're connected as Spotters right away.</p>
        <div className="mono text-[12px] muted mt-2 truncate" data-testid="text-invite-link">{link.replace(/^https?:\/\//, "")}</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="btn btn-primary" onClick={share} data-testid="button-share-invite"><Share size={16} /> Share link</button>
          <button className="btn btn-outline" onClick={copy} data-testid="button-copy-invite"><Copy size={16} /> Copy link</button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs muted">Code <span className="mono lime" style={{ letterSpacing: "0.1em" }} data-testid="text-invite-code">{data.inviteCode}</span></span>
          {!auth.me?.isDemo && <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => setResetAsk(true)} data-testid="button-reset-invite">Reset link</button>}
        </div>
      </div>
      {resetAsk && (
        <Sheet title="Reset your invite link?" onClose={() => setResetAsk(false)} testId="sheet-reset-invite">
          <p className="text-sm muted">Your old link and code stop working, so anyone you've sent them to can't use them. Spotters you already have stay connected.{auth.me?.role === "coach" ? " Clients who haven't linked yet will need your new code." : ""}</p>
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1" onClick={() => setResetAsk(false)}>Cancel</button>
            <button className="btn btn-warn flex-1" onClick={resetCode} data-testid="button-confirm-reset-invite">Reset link</button>
          </div>
        </Sheet>
      )}
      <div className="card">
        <div className="label mb-2">Add a Spotter</div>
        <div className="flex gap-2">
          <input className="input mono" placeholder="Code or username" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} autoCapitalize="characters" data-testid="input-friend-code" />
          <button className="btn btn-primary" disabled={busy || !code.trim()} onClick={add} data-testid="button-send-request"><UserPlus size={16} /></button>
        </div>
      </div>
      {data.incoming.length > 0 && (
        <>
          <div className="section-title"><h2>Requests</h2><span className="label">{data.incoming.length}</span></div>
          {data.incoming.map((u) => (
            <div key={u.id} className="card flex items-center gap-3" data-testid={`row-incoming-${u.username}`}>
              <Avatar name={u.displayName} />
              <div className="flex-1 min0"><div className="text-sm font-semibold">{u.displayName}</div><div className="mono text-[11px] muted">@{u.username}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => act("POST", `/api/friends/${u.id}/accept`, `${u.displayName} added`)} aria-label="Accept" data-testid={`button-accept-${u.username}`}><Check size={16} /></button>
              <button className="btn btn-sm" onClick={() => act("DELETE", `/api/friends/${u.id}`, "Request declined")} aria-label="Decline" data-testid={`button-decline-${u.username}`}><X size={16} /></button>
            </div>
          ))}
        </>
      )}
      <div className="section-title"><h2>Spotters</h2><span className="label">{data.friends.length}</span></div>
      {data.friends.length === 0 ? <Empty>No Spotters yet. Share your invite link, or enter a friend's code above.</Empty> : data.friends.map((u) => (
        <div key={u.id} className="card flex items-center gap-3" data-testid={`row-friend-${u.username}`}>
          <Avatar name={u.displayName} />
          <div className="flex-1 min0">
            <div className="text-sm font-semibold">{u.displayName}</div>
            <div className="mono text-[11px] muted truncate">@{u.username}{u.stats?.split ? ` · ${u.stats.split}` : ""}{u.stats?.streak ? ` · streak ${u.stats.streak}` : ""}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(u)} aria-label={`Remove ${u.displayName}`} data-testid={`button-remove-${u.username}`}><UserMinus size={15} /></button>
        </div>
      ))}
      {data.outgoing.length > 0 && (
        <>
          <div className="section-title"><h2>Sent</h2></div>
          {data.outgoing.map((u) => (
            <div key={u.id} className="rowline">
              <span className="text-sm">{u.displayName} <span className="mono text-[11px] muted">pending</span></span>
              <button className="btn btn-ghost btn-sm" onClick={() => act("DELETE", `/api/friends/${u.id}`, "Request cancelled")} data-testid={`button-cancel-${u.username}`}>Cancel</button>
            </div>
          ))}
        </>
      )}
      {confirm && (
        <Sheet title={`Remove ${confirm.displayName}?`} onClose={() => setConfirm(null)}>
          <p className="text-sm muted">You'll stop seeing each other's workouts, check-ins and leaderboard spots.</p>
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-warn flex-1" onClick={() => { act("DELETE", `/api/friends/${confirm.id}`, `Removed ${confirm.displayName}`); setConfirm(null); }} data-testid="button-confirm-remove">Remove</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- gym */
function Gym() {
  const { profile } = useStore();
  const ui = useUI();
  const { data, reload } = useLoad<{ me: { gym: string; ts: number } | null; friends: (PubUser & { gym: string; ts: number; split: string; streak: number })[] }>("/api/gym", 30000);
  const [gym, setGym] = useState(profile.gym || "");
  const ci = data?.me ?? null;
  const here = ci ? (data?.friends ?? []).filter((f) => f.gym.trim().toLowerCase() === ci.gym.trim().toLowerCase()) : [];
  const elsewhere = (data?.friends ?? []).filter((f) => !here.includes(f));
  const checkIn = async () => {
    try {
      await api("POST", "/api/gym/checkin", { gym: gym.trim() });
      ui.toast(`Checked in at ${gym.trim()}`); reload();
    } catch (e) { ui.toast((e as Error).message); }
  };
  const out = async () => { try { await api("DELETE", "/api/gym/checkin"); reload(); } catch (e) { ui.toast((e as Error).message); } };
  return (
    <div className="stack" data-testid="view-gym">
      <div className="card">
        <div className="label mb-2">Gym check-in</div>
        {ci ? (
          <>
            <div className="flex items-center gap-2"><MapPin size={18} className="lime" /><span className="font-semibold" data-testid="text-checked-in">I'm at {ci.gym}</span></div>
            <p className="mono text-xs muted mt-1">checked in {ago(ci.ts)} ago · visible to Spotters for 3h</p>
            <button className="btn btn-outline btn-block mt-3" onClick={out} data-testid="button-checkout">Check out</button>
          </>
        ) : (
          <>
            <input className="input" placeholder="Gym name" value={gym} onChange={(e) => setGym(e.target.value)} maxLength={60} data-testid="input-gym" />
            <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!gym.trim()} onClick={checkIn} data-testid="button-gym-checkin"><MapPin size={16} /> I'm at {gym.trim() || "the gym"}</button>
          </>
        )}
      </div>
      {ci && (
        <>
          <div className="section-title"><h2>Training here now</h2><span className="label">{here.length}</span></div>
          {here.length === 0 ? <Empty>No Spotters checked in here right now.</Empty> : here.map((s) => (
            <div key={s.id} className="card flex items-center gap-3" data-testid={`row-here-${s.username}`}>
              <Avatar name={s.displayName} />
              <div className="flex-1 min0"><div className="text-sm font-semibold">{s.displayName}</div><div className="mono text-[11px] muted">{s.split || "—"} · streak {s.streak}</div></div>
              <span className="chip chip-lime">{ago(s.ts)}</span>
            </div>
          ))}
        </>
      )}
      {elsewhere.length > 0 && (
        <>
          <div className="section-title"><h2>{ci ? "Training elsewhere" : "Spotters training now"}</h2></div>
          {elsewhere.map((s) => (
            <div key={s.id} className="rowline" data-testid={`row-elsewhere-${s.username}`}><span className="text-sm">{s.displayName}</span><span className="mono text-xs muted">{s.gym} · {ago(s.ts)}</span></div>
          ))}
        </>
      )}
      {!ci && elsewhere.length === 0 && data && <p className="text-xs faint">None of your Spotters are checked in right now.</p>}
    </div>
  );
}

/* --------------------------------------------------------------- leaders */
function Leaders() {
  const { profile } = useStore();
  const { data, err } = useLoad<{ rows: (PubUser & { me: boolean; stats: Partial<PublicStats> })[] }>("/api/leaderboard");
  const [lift, setLift] = useState("bench_press");
  const u = profile.units;
  const rows = (data?.rows ?? [])
    .filter((r) => r.stats?.lifts?.[lift] && r.stats.bodyWeightKg)
    .map((r) => ({ ...r, kg: r.stats.lifts![lift], bw: r.stats.bodyWeightKg!, d: dots(r.stats.lifts![lift], r.stats.bodyWeightKg!, r.stats.sex === "f" ? "f" : "m") }))
    .sort((a, b) => b.d - a.d);
  return (
    <div data-testid="view-leaders">
      <Seg options={[{ v: "bench_press", l: "Bench" }, { v: "back_squat", l: "Squat" }, { v: "deadlift", l: "Deadlift" }, { v: "ohp", l: "OHP" }]} value={lift} onChange={setLift} testId="seg-leader-lift" />
      {err && <Empty>{err}</Empty>}
      {data && rows.length === 0 && <div className="mt-3"><Empty>No one has logged this lift yet.</Empty></div>}
      {rows.length > 0 && (
        <div className="card mt-3" style={{ padding: "4px 14px" }}>
          <div className="grid label py-2" style={{ gridTemplateColumns: "22px 1fr 70px 52px" }}><span>#</span><span>Lifter</span><span className="text-right">e1RM</span><span className="text-right">DOTS</span></div>
          {rows.map((r, i) => (
            <div key={r.id} className="grid items-center" style={{ gridTemplateColumns: "22px 1fr 70px 52px", minHeight: 48, borderTop: "1px solid var(--border)", ...(r.me ? { color: "var(--lime)" } : {}) }} data-testid={`row-leader-${r.username}`}>
              <span className="mono text-xs">{i + 1}</span>
              <span className="text-sm min0 truncate">{r.me ? "You" : r.displayName} <span className="mono text-[10px] muted">{Math.round(fromKg(r.bw, u))}{u} bw</span></span>
              <span className="mono text-sm text-right">{Math.round(fromKg(r.kg, u))}</span>
              <span className="mono text-sm text-right font-semibold">{r1(r.d).toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] faint mt-2">You and your Spotters who share lifts. DOTS normalizes strength for body weight and sex. e1RM in {u}.</p>
    </div>
  );
}
