import { useMemo, useState } from "react";
import { Award, Heart, MapPin, MessageCircle, Plus, Send, UserMinus, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { useToday, prWhyStat } from "@/lib/derived";
import { Empty, Seg, Sheet, initials } from "@/components/ui";
import { PRCardSheet, type PRData } from "@/components/PRCard";
import { dateKey, dots, e1rmSeries, fmtW, fromKg, matchScore, r1, sessionPRs, toKg, trainingDaysPerWeek, userStreak } from "@/lib/engine";
import { EX, newId } from "@/lib/exercises";
import type { FeedPost, Spotter } from "@/lib/types";

type Sub = "feed" | "crews" | "gym" | "find" | "leaders";

export default function Spotters() {
  const [sub, setSub] = useState<Sub>("feed");
  return (
    <div>
      <header className="topbar"><h1>Spotters</h1></header>
      <nav className="subtabs" aria-label="Spotters sections">
        {([["feed", "Feed"], ["crews", "Crews"], ["gym", "Gym"], ["find", "Find"], ["leaders", "Leaders"]] as const).map(([id, l]) => (
          <button key={id} aria-pressed={sub === id ? "true" : "false"} onClick={() => setSub(id)} data-testid={`subtab-spotters-${id}`}>{l}</button>
        ))}
      </nav>
      <div className="screen">
        {sub === "feed" && <Feed />}
        {sub === "crews" && <Crews />}
        {sub === "gym" && <Gym />}
        {sub === "find" && <Find />}
        {sub === "leaders" && <Leaders />}
      </div>
    </div>
  );
}

function useNames() {
  const { state, profile } = useStore();
  return (id: string) => (id === "me" ? profile.name || "You" : state.spotters.find((s) => s.id === id)?.name ?? id);
}

function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, ...(id === "me" ? { borderColor: "var(--lime)", color: "var(--lime)" } : {}) }}>{initials(name)}</span>;
}

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

function Feed() {
  const { state, set, profile, targets } = useStore();
  const name = useNames();
  const [comment, setComment] = useState<Record<string, string>>({});
  const [openC, setOpenC] = useState<string | null>(null);
  const [card, setCard] = useState<PRData | null>(null);
  const friends = new Set(state.spotters.filter((s) => s.friend).map((s) => s.id));
  const posts = state.feed.filter((p) => p.author === "me" || friends.has(p.author)).sort((a, b) => b.ts - a.ts).slice(0, 40);

  const update = (id: string, f: (p: FeedPost) => FeedPost) => set((s) => ({ ...s, feed: s.feed.map((p) => (p.id === id ? f(p) : p)) }));
  const like = (p: FeedPost) => update(p.id, (x) => ({ ...x, likes: x.likes.includes("me") ? x.likes.filter((l) => l !== "me") : [...x.likes, "me"] }));
  const send = (p: FeedPost) => {
    const txt = (comment[p.id] || "").trim();
    if (!txt) return;
    update(p.id, (x) => ({ ...x, comments: [...x.comments, { id: newId("c"), author: "me", text: txt, ts: Date.now() }] }));
    setComment({ ...comment, [p.id]: "" });
  };
  const prCard = (p: FeedPost) => {
    const sess = state.sessions.find((s) => s.id === p.sessionId);
    if (!sess) return;
    const prs = sessionPRs(state.sessions, sess);
    if (!prs.length) return;
    const best = prs[0];
    setCard({ lift: EX[best.exId].name, weight: best.weight, reps: best.reps, e1rm: Math.round(best.e1rm), units: profile.units, why: prWhyStat(state, sess.date, targets.protein), name: profile.name, date: sess.date });
  };

  if (!posts.length) return <Empty>No posts yet. Finish a workout and it auto-posts here; add Spotters from Find.</Empty>;
  return (
    <div className="stack" data-testid="view-feed">
      {posts.map((p) => {
        const liked = p.likes.includes("me");
        const n = name(p.author);
        return (
          <article key={p.id} className="card" data-testid={`card-post-${p.id}`}>
            <div className="flex items-center gap-3">
              <Avatar id={p.author} name={n} />
              <div className="min0 flex-1">
                <div className="text-sm font-semibold">{p.author === "me" ? "You" : n}</div>
                <div className="mono text-[11px] muted">{p.sessionName} · {p.durationMin} min · {ago(p.ts)}</div>
              </div>
              {p.prs.length > 0 && <span className="chip chip-lime"><Award size={12} /> {p.prs.length} PR</span>}
            </div>
            <div className="mt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {p.topSets.map((t, i) => (
                <div key={i} className="rowline" style={{ minHeight: 34 }}>
                  <span className="text-[13px]">{t.name}{p.prs.includes(t.name) && <span className="lime mono text-[10px] ml-2">PR</span>}</span>
                  <span className="mono text-sm">{fmtW(t.weight)} × {t.reps} <span className="faint text-xs">{t.units}</span></span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <button className={`btn btn-ghost btn-sm ${liked ? "lime" : ""}`} onClick={() => like(p)} aria-pressed={liked ? "true" : "false"} data-testid={`button-like-${p.id}`}>
                <Heart size={16} fill={liked ? "currentColor" : "none"} /> <span className="mono">{p.likes.length}</span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpenC(openC === p.id ? null : p.id)} data-testid={`button-comments-${p.id}`}>
                <MessageCircle size={16} /> <span className="mono">{p.comments.length}</span>
              </button>
              <span className="flex-1" />
              {p.author === "me" && p.prs.length > 0 && p.sessionId && (
                <button className="btn btn-outline btn-sm" onClick={() => prCard(p)} data-testid={`button-prcard-${p.id}`}>PR card</button>
              )}
            </div>
            {(openC === p.id || (p.comments.length > 0 && p.comments.length <= 2)) && (
              <div className="mt-1">
                {p.comments.map((c) => (
                  <p key={c.id} className="text-[13px] py-1"><span className="font-semibold">{c.author === "me" ? "You" : name(c.author).split(" ")[0]}</span> <span className="muted">{c.text}</span></p>
                ))}
                {openC === p.id && (
                  <div className="flex gap-2 mt-2">
                    <input className="input" placeholder="Add a comment" value={comment[p.id] || ""} onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && send(p)} data-testid={`input-comment-${p.id}`} />
                    <button className="btn btn-primary" onClick={() => send(p)} aria-label="Send comment" data-testid={`button-send-comment-${p.id}`}><Send size={16} /></button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
      {card && <PRCardSheet data={card} onClose={() => setCard(null)} />}
    </div>
  );
}

function Crews() {
  const { state, set } = useStore();
  const ui = useUI();
  const name = useNames();
  const today = dateKey();
  const myStreak = userStreak(state, today);
  const [create, setCreate] = useState(false);
  const [cname, setCname] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const friends = state.spotters.filter((s) => s.friend);
  const missed = (id: string) => (id === "me" ? false : !!state.spotters.find((s) => s.id === id)?.missedThisWeek);
  const streakOf = (id: string) => (id === "me" ? myStreak : state.spotters.find((s) => s.id === id)?.streak ?? 0);
  const adherenceOf = (id: string) => {
    if (id !== "me") return state.spotters.find((s) => s.id === id)?.adherence ?? 0;
    const planned = trainingDaysPerWeek(state.program) * 4;
    const done = state.sessions.filter((s) => s.end && Date.now() - s.start < 28 * 86400000).length;
    return planned ? Math.min(1, done / planned) : 0;
  };

  return (
    <div className="stack" data-testid="view-crews">
      <p className="text-sm muted">Crews share one streak. It breaks if any member misses a planned session.</p>
      {state.crews.length === 0 && <Empty>No crews yet.</Empty>}
      {state.crews.map((c) => {
        const anyMissed = c.members.some(missed);
        const streak = anyMissed ? 0 : Math.min(c.streak, ...c.members.map(streakOf));
        const board = [...c.members].sort((a, b) => adherenceOf(b) - adherenceOf(a));
        return (
          <div key={c.id} className="card" data-testid={`card-crew-${c.id}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.name}</span>
              <span className="chip"><Users size={12} /> {c.members.length}</span>
            </div>
            <div className="flex items-end gap-4 mt-3">
              <div><div className="label">Shared streak</div><div className={`big-num ${streak ? "lime" : "orange"}`} data-testid={`text-crew-streak-${c.id}`}>{streak}<span className="text-sm muted"> sessions</span></div></div>
              <div><div className="label">Best</div><div className="mono text-lg">{Math.max(c.best, streak)}</div></div>
            </div>
            {anyMissed && <p className="text-xs orange mt-1">Streak broken — {c.members.filter(missed).map((m) => name(m).split(" ")[0]).join(", ")} missed a planned session this week.</p>}
            <div className="label mt-4 mb-1">Consistency leaderboard · 4 wk</div>
            {board.map((m, i) => (
              <div key={m} className="grid items-center gap-3" style={{ gridTemplateColumns: "18px 30px 1fr 50px", minHeight: 40 }}>
                <span className="mono text-xs muted">{i + 1}</span>
                <Avatar id={m} name={name(m)} size={28} />
                <span className="text-sm min0 truncate">{m === "me" ? "You" : name(m)}{missed(m) && <span className="orange text-[11px] ml-2">missed</span>}</span>
                <span className="mono text-sm text-right">{Math.round(adherenceOf(m) * 100)}%</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm mt-2" onClick={() => set((s) => ({ ...s, crews: s.crews.filter((x) => x.id !== c.id) }))} data-testid={`button-leave-crew-${c.id}`}>Leave crew</button>
          </div>
        );
      })}
      <button className="btn btn-primary btn-block" onClick={() => setCreate(true)} data-testid="button-create-crew"><Plus size={16} /> Create crew</button>
      {create && (
        <Sheet title="New crew" onClose={() => setCreate(false)} testId="sheet-create-crew">
          <input className="input" placeholder="Crew name" value={cname} onChange={(e) => setCname(e.target.value)} data-testid="input-crew-name" />
          <div className="label mt-4 mb-2">Members ({members.length + 1}/8, including you)</div>
          {friends.length === 0 && <p className="text-sm muted">Add Spotters first from Find.</p>}
          {friends.map((f) => {
            const on = members.includes(f.id);
            return (
              <label key={f.id} className="flex items-center gap-3" style={{ minHeight: 48 }}>
                <input type="checkbox" className="toggle" checked={on} disabled={!on && members.length >= 7} onChange={() => setMembers(on ? members.filter((m) => m !== f.id) : [...members, f.id])} data-testid={`toggle-crew-member-${f.id}`} />
                <span className="text-sm">{f.name}</span>
              </label>
            );
          })}
          <button className="btn btn-primary btn-lg btn-block mt-4" disabled={members.length < 1 || !cname.trim()} onClick={() => {
            set((s) => ({ ...s, crews: [...s.crews, { id: newId("crew"), name: cname.trim(), members: ["me", ...members], streak: 0, best: 0 }] }));
            setCreate(false); setCname(""); setMembers([]); ui.toast("Crew created");
          }} data-testid="button-save-crew">Create crew</button>
          <p className="text-[11px] faint mt-2 text-center">2–8 members.</p>
        </Sheet>
      )}
    </div>
  );
}

function Gym() {
  const { state, set, profile } = useStore();
  const [gym, setGym] = useState(state.gymCheckin?.gym || profile.gym || "");
  const ci = state.gymCheckin && Date.now() - state.gymCheckin.ts < 3 * 3600000 ? state.gymCheckin : null;
  const here = ci ? state.spotters.filter((s) => s.trainingNow && s.gym.toLowerCase() === ci.gym.toLowerCase()) : [];
  const elsewhere = state.spotters.filter((s) => s.trainingNow && s.friend && !here.includes(s));
  const gyms = Array.from(new Set([profile.gym, ...state.spotters.map((s) => s.gym)].filter(Boolean)));
  return (
    <div className="stack" data-testid="view-gym">
      <div className="card">
        <div className="label mb-2">Gym check-in</div>
        {ci ? (
          <>
            <div className="flex items-center gap-2"><MapPin size={18} className="lime" /><span className="font-semibold" data-testid="text-checked-in">I'm at {ci.gym}</span></div>
            <p className="mono text-xs muted mt-1">checked in {ago(ci.ts)} ago · expires after 3h</p>
            <button className="btn btn-outline btn-block mt-3" onClick={() => set((s) => ({ ...s, gymCheckin: null }))} data-testid="button-checkout">Check out</button>
          </>
        ) : (
          <>
            <input className="input" list="gym-list" placeholder="Gym name" value={gym} onChange={(e) => setGym(e.target.value)} data-testid="input-gym" />
            <datalist id="gym-list">{gyms.map((g) => <option key={g} value={g} />)}</datalist>
            <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!gym.trim()} onClick={() => set((s) => ({ ...s, gymCheckin: { gym: gym.trim(), ts: Date.now() } }))} data-testid="button-gym-checkin"><MapPin size={16} /> I'm at {gym.trim() || "the gym"}</button>
          </>
        )}
      </div>
      {ci && (
        <>
          <div className="section-title"><h2>Training here now</h2><span className="label">{here.length}</span></div>
          {here.length === 0 ? <Empty>No Spotters checked in here right now.</Empty> : here.map((s) => (
            <div key={s.id} className="card flex items-center gap-3" data-testid={`row-here-${s.id}`}>
              <Avatar id={s.id} name={s.name} />
              <div className="flex-1 min0"><div className="text-sm font-semibold">{s.name}</div><div className="mono text-[11px] muted">{s.split} · streak {s.streak}</div></div>
              <span className="chip chip-lime"><span className="pulse" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--lime)", display: "inline-block" }} /> now</span>
            </div>
          ))}
        </>
      )}
      {elsewhere.length > 0 && (
        <>
          <div className="section-title"><h2>Training elsewhere</h2></div>
          {elsewhere.map((s) => (
            <div key={s.id} className="rowline"><span className="text-sm">{s.name}</span><span className="mono text-xs muted">{s.gym}</span></div>
          ))}
        </>
      )}
    </div>
  );
}

function myDots(state: ReturnType<typeof useStore>["state"], profile: ReturnType<typeof useStore>["profile"], exId: string) {
  const ser = e1rmSeries(state.sessions, exId);
  if (!ser.length) return null;
  const best = Math.max(...ser.map((x) => x.e1rm));
  const kg = toKg(best, profile.units);
  return { kg, dots: dots(kg, toKg(profile.bodyWeight, profile.units), profile.sex === "f" ? "f" : "m") };
}

function Find() {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const t = useToday();
  void t;
  const lifts = ["bench_press", "back_squat", "deadlift"];
  const meTotal = lifts.reduce((a, id) => a + (myDots(state, profile, id)?.kg ?? 0), 0);
  const meDots = dots(meTotal, toKg(profile.bodyWeight, profile.units), profile.sex === "f" ? "f" : "m");
  const schedule = Array.from(new Set(state.program?.days.flatMap((d) => d.weekdays) ?? []));
  const split = state.program?.name ?? "";
  const hours = state.sessions.slice(-10).map((s) => new Date(s.start).getHours());
  const avgH = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 18;
  const time = avgH < 11 ? "morning" : avgH < 15 ? "midday" : "evening";
  const rows = useMemo(() => state.spotters.map((s) => {
    const total = lifts.reduce((a, id) => a + (s.lifts[id] ?? 0), 0);
    const sd = dots(total, s.bodyWeightKg, s.sex);
    return { s, m: matchScore({ gym: profile.gym, schedule, split, dots: meDots, time }, s, sd), sd };
  }).sort((a, b) => b.m.total - a.m.total), [state.spotters, profile.gym, meDots]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (s: Spotter) => {
    set((st) => ({ ...st, spotters: st.spotters.map((x) => (x.id === s.id ? { ...x, friend: !x.friend } : x)) }));
    ui.toast(s.friend ? `Removed ${s.name}` : `${s.name} added as a Spotter`);
  };
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="stack" data-testid="view-find">
      <p className="text-sm muted">Matched on gym, schedule overlap, split, strength level (DOTS), and training time.</p>
      {rows.map(({ s, m, sd }) => (
        <div key={s.id} className="card" data-testid={`card-match-${s.id}`}>
          <div className="flex items-center gap-3">
            <Avatar id={s.id} name={s.name} />
            <div className="flex-1 min0">
              <div className="text-sm font-semibold">{s.name} {s.friend && <span className="chip chip-lime ml-1">Spotter</span>}</div>
              <div className="text-[11px] muted truncate">{s.gym} · {s.split} · {s.trainTime}</div>
            </div>
            <div className="text-right"><div className="mono text-xl lime" data-testid={`text-match-${s.id}`}>{m.total}</div><div className="label">match</div></div>
          </div>
          <div className="flex gap-[3px] mt-3">
            {DAYS.map((d, i) => (
              <span key={i} className="mono text-[10px] text-center" style={{ flex: 1, padding: "3px 0", borderRadius: 3, background: s.schedule.includes(i) && schedule.includes(i) ? "var(--lime-dim)" : "var(--surface-2)", color: s.schedule.includes(i) ? (schedule.includes(i) ? "var(--lime)" : "var(--text)") : "var(--faint)" }}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1 mt-2 mono text-[10px] muted text-center">
            <span>gym {m.gym}</span><span>days {m.sched}</span><span>split {m.split}</span><span>str {m.strength}</span><span>time {m.time}</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="mono text-xs muted">DOTS {Math.round(sd)} · you {Math.round(meDots)}</span>
            <button className={`btn btn-sm ${s.friend ? "btn-ghost" : "btn-outline"}`} onClick={() => toggle(s)} data-testid={`button-friend-${s.id}`}>
              {s.friend ? <><UserMinus size={14} /> Remove</> : <><UserPlus size={14} /> Add Spotter</>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Leaders() {
  const { state, profile } = useStore();
  const [lift, setLift] = useState("bench_press");
  const [scope, setScope] = useState<"friends" | "all">("friends");
  const u = profile.units;
  const mine = myDots(state, profile, lift);
  const rows = [
    ...state.spotters.filter((s) => (scope === "all" || s.friend) && s.lifts[lift]).map((s) => ({ id: s.id, name: s.name, kg: s.lifts[lift], d: dots(s.lifts[lift], s.bodyWeightKg, s.sex), bw: s.bodyWeightKg })),
    ...(mine ? [{ id: "me", name: "You", kg: mine.kg, d: mine.dots, bw: toKg(profile.bodyWeight, u) }] : []),
  ].sort((a, b) => b.d - a.d);
  return (
    <div data-testid="view-leaders">
      <Seg options={[{ v: "bench_press", l: "Bench" }, { v: "back_squat", l: "Squat" }, { v: "deadlift", l: "Deadlift" }, { v: "ohp", l: "OHP" }]} value={lift} onChange={setLift} testId="seg-leader-lift" />
      <div className="flex justify-between items-center mt-3">
        <Seg options={[{ v: "friends" as const, l: "Spotters" }, { v: "all" as const, l: "Everyone" }]} value={scope} onChange={setScope} />
      </div>
      <div className="card mt-3" style={{ padding: "4px 14px" }}>
        <div className="grid label py-2" style={{ gridTemplateColumns: "22px 1fr 70px 52px" }}><span>#</span><span>Lifter</span><span className="text-right">e1RM</span><span className="text-right">DOTS</span></div>
        {rows.map((r, i) => (
          <div key={r.id} className="grid items-center" style={{ gridTemplateColumns: "22px 1fr 70px 52px", minHeight: 48, borderTop: "1px solid var(--border)", ...(r.id === "me" ? { color: "var(--lime)" } : {}) }} data-testid={`row-leader-${r.id}`}>
            <span className="mono text-xs">{i + 1}</span>
            <span className="text-sm min0 truncate">{r.name} <span className="mono text-[10px] muted">{Math.round(fromKg(r.bw, u))}{u} bw</span></span>
            <span className="mono text-sm text-right">{Math.round(fromKg(r.kg, u))}</span>
            <span className="mono text-sm text-right font-semibold">{r1(r.d).toFixed(0)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] faint mt-2">DOTS normalizes strength for body weight and sex so lifters of different sizes compare fairly. e1RM in {u}.</p>
    </div>
  );
}
