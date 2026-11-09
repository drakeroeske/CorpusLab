// Riso-style feed post: handle + PR CARD Nº header, silhouette, headline load, top sets, Respect / Challenge.
import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Silhouette, Tag, pad3 } from "@/components/riso";
import { fmtW } from "@/lib/engine";

export interface PostSet { name: string; weight: number; reps: number; units: string; pr?: boolean }
export interface PostComment { id: string; who: string; text: string }

export const handle = (name: string) => "@" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
export const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}M`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}H` : `${Math.round(h / 24)}D`;
};

export function PostCard({ id, author, mine, ts, title, durationMin, prNo, sets, prCount, liked, likes, comments, onLike, onComment, onChallenge, onPrCard, onDelete, extra, pending }: {
  id: string; author: string; mine: boolean; ts: number; title: string; durationMin?: number; prNo?: number;
  sets: PostSet[]; prCount: number; liked: boolean; likes: number; comments: PostComment[];
  onLike: () => void; onComment: (text: string) => void; onChallenge?: () => void; onPrCard?: () => void; onDelete?: () => void; extra?: ReactNode; pending?: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const top = sets.find((s) => s.pr) ?? sets[0];
  const shown = open ? comments : comments.slice(-2);
  return (
    <article className="card" style={{ padding: 0 }} data-testid={`card-post-${id}`}>
      <div className="flex justify-between gap-2 px-3 py-2 label" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="truncate">{mine ? "@YOU" : handle(author)} · {pending ? "SENDING…" : ago(ts)}</span>
        <span className="shrink-0">{prNo ? `PR CARD Nº ${pad3(prNo)}` : durationMin != null ? `${durationMin} MIN` : "CHECK-IN"}</span>
      </div>
      <div className="flex items-center gap-3 px-3 pt-3">
        <div className="shrink-0" style={{ border: "1px solid var(--line)", padding: 4, background: prCount ? "var(--signal)" : "transparent" }}>
          <Silhouette height={88} marks />
        </div>
        <div className="min0">
          <div className="text-xs font-bold">{title} {prCount > 0 && <Tag signal>PR</Tag>}</div>
          {top && <div className="display mt-1" style={{ fontSize: 44 }} data-testid={`text-headline-${id}`}>{top.weight > 0 ? `${fmtW(top.weight)} ${top.units.toUpperCase()}` : `BW × ${top.reps}`}</div>}
          {top && <div className="text-xs">{top.name}</div>}
        </div>
      </div>
      <div className="px-3 pt-2 text-xs">
        {sets.map((t, i) => (
          <div key={i} className={`flex justify-between gap-2 ${t.pr ? "font-bold" : ""}`}>
            <span className="truncate">{t.name}{t.pr ? " · VERIFIED BY CORPUS" : ""}</span>
            <span className="shrink-0">{t.weight > 0 ? `${fmtW(t.weight)} ${t.units} × ${t.reps}` : `BW × ${t.reps}`}</span>
          </div>
        ))}
        {extra}
      </div>
      <div className="flex gap-2 px-3 pt-3">
        <button className="btn btn-social flex-1" onClick={onLike} aria-pressed={liked ? "true" : "false"} data-testid={`button-like-${id}`}>
          {liked ? "Respected" : "Respect"} ↑ {likes}
        </button>
        {!mine && onChallenge && <button className="btn" onClick={onChallenge} data-testid={`button-challenge-${id}`}>Challenge</button>}
        {mine && onPrCard && <button className="btn" onClick={onPrCard} data-testid={`button-prcard-${id}`}>PR card</button>}
        {mine && onDelete && <button className="icon-btn" onClick={onDelete} aria-label="Delete post" data-testid={`button-delete-post-${id}`}><Trash2 size={15} /></button>}
      </div>
      <div className="px-3 pt-2 pb-3">
        {comments.length > 2 && !open && <button className="label underline" style={{ minHeight: 28 }} onClick={() => setOpen(true)} data-testid={`button-comments-${id}`}>All {comments.length} comments</button>}
        {shown.map((c) => (
          <div key={c.id} className="py-1 text-[13px]" style={{ borderTop: "1px solid var(--line)" }}><span className="font-bold">{c.who}</span> {c.text}</div>
        ))}
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onComment(text.trim()); setText(""); }}>
          <input className="input" placeholder="Comment" maxLength={280} value={text} onChange={(e) => setText(e.target.value)} data-testid={`input-comment-${id}`} />
          <button type="submit" className="btn" disabled={!text.trim()} data-testid={`button-send-comment-${id}`}>Send</button>
        </form>
      </div>
    </article>
  );
}
