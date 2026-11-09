import { Term } from "@/components/Term";
import { useCallback, useEffect, useRef, useState } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { StreakCells, Tag } from "@/components/riso";
import { Award, Check, Copy, Heart, MapPin, MessageCircle, RefreshCw, Send, Share, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { inviteLink } from "@/lib/invite";
import { PostCard } from "@/components/PostCard";
import { EngineHeader } from "@/components/riso";
import { Sectioned } from "@/components/Sections";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { api } from "@/lib/api";
import { useAuth, type PubUser } from "@/lib/auth";
import { prWhyStat } from "@/lib/derived";
import { Empty, Seg, Sheet, initials } from "@/components/ui";
import { PRCardSheet, type PRData } from "@/components/PRCard";
import { addDays, dateKey, dayForDate, dots, fmtW, fromKg, r1, sessionPRs } from "@/lib/engine";
import { EX } from "@/lib/exercises";
import type { PublicStats } from "@/lib/social";


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
  const ui = useUI();
  const sub = ui.sub.social ?? "feed";
  const setSub = (s: string) => ui.setSub("social", s);
  const [pending, setPending] = useState(0);
  useEffect(() => { api<{ incoming: unknown[] }>("GET", "/api/friends").then((r) => setPending(r.incoming.length)).catch(() => {}); }, [sub]);
  return (
    <div>
      <EngineHeader title="Social" />
      <Sectioned name="Social" value={sub} onChange={setSub}
        sections={[
          { id: "feed", label: "Feed" }, { id: "crews", label: "Crews" }, { id: "friends", label: pending ? `Friends · ${pending}` : "Friends", title: "Friends" },
          { id: "gym", label: "Gym", title: "Your gym", more: true, hint: "Who trains where you do" },
          { id: "leaders", label: "Leaders", title: "Leaderboards", more: true, hint: "Strength rankings among your spotters" },
        ]}
        render={(id) => (id === "friends" ? <Friends onChange={setPending} /> : id === "crews" ? <Crews goFriends={() => setSub("friends")} /> : id === "gym" ? <Gym /> : id === "leaders" ? <Leaders /> : <Feed goFriends={() => setSub("friends")} />)} />
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
  const [held, setHeld] = useState<LivePost[] | null>(null); // fresh posts from others, waiting while you read
  const seen = useRef(false);
  useEffect(() => {
    if (!data) return;
    const fresh = data.posts;
    if (!seen.current) { seen.current = true; setPosts(fresh); return; }
    setPosts((cur) => {
      const have = new Set(cur.map((p) => p.id));
      const incoming = fresh.filter((p) => !have.has(p.id) && !p.mine);
      if (incoming.length && window.scrollY > 160) { setHeld(fresh); return cur.map((p) => fresh.find((f) => f.id === p.id) ?? p); }
      setHeld(null);
      return fresh;
    });
  }, [data]);
  const showHeld = () => { if (held) { setPosts(held); setHeld(null); } window.scrollTo({ top: 0, behavior: "smooth" }); };
  const heldCount = held ? held.filter((p) => !posts.some((q) => q.id === p.id)).length : 0;

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
    <PullToRefresh onRefresh={async () => { await reload(); setHeld(null); }}>
    <div className="stack" data-testid="view-feed">
      {heldCount > 0 && <div className="new-posts-pill"><button onClick={showHeld} data-testid="button-new-posts">{heldCount} new {heldCount === 1 ? "post" : "posts"} · tap to show</button></div>}
      <div className="flex items-center justify-between">
        <span className="label">Feed · pull down to refresh</span>
        <button className="btn btn-sm" onClick={() => { reload(); setHeld(null); }} aria-label="Refresh feed" data-testid="button-feed-refresh"><RefreshCw size={14} /> Refresh</button>
      </div>
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
    </PullToRefresh>
  );
}

/* ----------------------------------------------------------------- crews */
interface CrewMember extends PubUser { me: boolean; streak: number; adherence: number; missedThisWeek: boolean }
interface Crew { id: string; name: string; ownerId: string; streak: number; best: number; members: CrewMember[] }

function Crews({ goFriends }: { goFriends: () => void }) {
  const { state } = useStore();
  const { me } = useAuth();
  const ui = useUI();
  const { data, err, reload } = useLoad<{ crews: Crew[] }>("/api/crews", 30000);
  const friends = useLoad<{ friends: FriendRow[] }>("/api/friends");
  const [crews, setCrews] = useState<Crew[]>([]);
  useEffect(() => { if (data) setCrews(data.crews); }, [data]);
  const [create, setCreate] = useState(false);
  const [addTo, setAddTo] = useState<Crew | null>(null);
  const [cname, setCname] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const today = dateKey();
  const myLog = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    const planned = !!dayForDate(state.program, date);
    const done = state.sessions.some((x) => x.date === date && x.end);
    return { date, planned: planned && !done && date < today, done };
  });
  const flist = friends.data?.friends ?? [];
  const run = async (fn: () => Promise<{ crews: Crew[] }>, okMsg: string) => {
    setBusy(true);
    try { const r = await fn(); setCrews(r.crews); ui.toast(okMsg); return true; } catch (e) { ui.toast((e as Error).message); return false; } finally { setBusy(false); }
  };
  const first = (n: string) => n.split(" ")[0];

  if (!data && !err) return <p className="text-sm muted">Loading crews…</p>;
  if (err && !data) return <div className="stack"><Empty>{err}</Empty><button className="btn btn-block" onClick={reload}><RefreshCw size={15} /> Try again</button></div>;
  return (
    <div className="stack" data-testid="view-crews">
      <p className="text-sm muted">Crews share one streak. It resets to zero if any member misses a planned session this week, and it can never be higher than the lowest member's streak.</p>
      {crews.length === 0 && <Empty>No crews yet. Make one with your spotters.</Empty>}
      {crews.map((c) => {
        const missed = c.members.filter((m) => m.missedThisWeek);
        return (
          <div key={c.id} className="card" data-testid={`card-crew-${c.id}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[20px] font-bold min0 truncate">{c.name}</span>
              {c.streak > 0 ? <Tag signal>{c.streak} session streak</Tag> : <Tag>No streak</Tag>}
            </div>
            <div className="flex items-end gap-4 mt-3">
              <div><div className="label">Shared streak</div><div className="big-num text-[40px]" data-testid={`text-crew-streak-${c.id}`}>{c.streak}</div></div>
              <div><div className="label">Best</div><div className="big-num text-[40px]">{Math.max(c.best, c.streak)}</div></div>
              <div className="flex-1 min0"><div className="label">Last 14 days · you</div><div className="mt-1"><StreakCells log={myLog} testId={`streak-${c.id}`} /></div></div>
            </div>
            {missed.length > 0 && <p className="text-xs orange mt-1">Streak broken — {missed.map((m) => (m.me ? "you" : first(m.displayName))).join(", ")} missed a planned session this week.</p>}
            <div className="label mt-4 mb-1">Consistency leaderboard · 4 wk</div>
            {c.members.map((m, i) => (
              <div key={m.id} className="grid items-center gap-3" style={{ gridTemplateColumns: "18px 30px 1fr 50px", minHeight: 44 }}>
                <span className="mono text-xs muted">{i + 1}</span>
                <Avatar name={m.displayName} me={m.me} size={28} />
                <span className="text-sm min0 truncate">{m.me ? "You" : m.displayName}{m.missedThisWeek && <span className="orange text-[11px] ml-2">missed</span>}</span>
                <span className="mono text-sm text-right">{Math.round(m.adherence * 100)}%</span>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              {c.members.length < 8 && <button className="btn btn-sm" onClick={() => { setAddTo(c); setPicked([]); }} data-testid={`button-crew-add-${c.id}`}><UserPlus size={14} /> Add spotter</button>}
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (confirm(`Leave ${c.name}?`)) run(() => api("DELETE", `/api/crews/${c.id}/members/me`), "Left crew"); }} data-testid={`button-leave-crew-${c.id}`}><UserMinus size={14} /> Leave</button>
            </div>
          </div>
        );
      })}
      {me?.isDemo
        ? <p className="text-xs faint">Sample accounts can't make crews. Create your own account to try it.</p>
        : <button className="btn btn-primary btn-block" onClick={() => { setCreate(true); setCname(""); setPicked([]); }} data-testid="button-create-crew">Create crew</button>}

      {(create || addTo) && (
        <Sheet title={addTo ? `Add to ${addTo.name}` : "New crew"} onClose={() => { setCreate(false); setAddTo(null); }} testId="sheet-create-crew">
          {create && <input className="input" placeholder="Crew name" maxLength={32} value={cname} onChange={(e) => setCname(e.target.value)} data-testid="input-crew-name" />}
          <div className="label mt-4 mb-2">{addTo ? "Your spotters" : `Members (${picked.length + 1}/8, including you)`}</div>
          {flist.length === 0 && <div className="stack"><Empty>You need spotters first.</Empty><button className="btn btn-block" onClick={() => { setCreate(false); setAddTo(null); goFriends(); }}>Add spotters</button></div>}
          {flist.filter((f) => !addTo || !addTo.members.some((m) => m.id === f.id)).map((f) => {
            const on = picked.includes(f.id);
            const cap = addTo ? picked.length >= 1 && !on : !on && picked.length >= 7;
            return (
              <label key={f.id} className="flex items-center justify-between gap-3" style={{ minHeight: 48 }}>
                <span className="flex items-center gap-2 min0"><Avatar name={f.displayName} size={28} /><span className="text-sm truncate">{f.displayName}</span><span className="mono text-[11px] muted">@{f.username}</span></span>
                <input type="checkbox" className="toggle" checked={on} disabled={cap} onChange={() => setPicked(on ? picked.filter((x) => x !== f.id) : addTo ? [f.id] : [...picked, f.id])} data-testid={`toggle-crew-member-${f.id}`} />
              </label>
            );
          })}
          {flist.length > 0 && (
            <button className="btn btn-primary btn-block mt-4" disabled={busy || (create ? cname.trim().length < 2 : picked.length !== 1)} onClick={async () => {
              const ok = addTo
                ? await run(() => api("POST", `/api/crews/${addTo.id}/members`, { userId: picked[0] }), "Spotter added")
                : await run(() => api("POST", "/api/crews", { name: cname.trim(), memberIds: picked }), "Crew created");
              if (ok) { setCreate(false); setAddTo(null); }
            }} data-testid="button-save-crew">{addTo ? "Add to crew" : "Create crew"}</button>
          )}
        </Sheet>
      )}
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
      try { await navigator.share({ title: "Join me on Corpus", text: `Spot me on Corpus. Open this link to connect with ${auth.me?.displayName ?? "me"}:`, url: link }); } catch { /* cancelled */ }
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
          <div className="grid label py-2" style={{ gridTemplateColumns: "22px 1fr 70px 52px" }}><span>#</span><span>Lifter</span><span className="text-right"><Term k="e1rm" /></span><span className="text-right"><Term k="dots" /></span></div>
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
