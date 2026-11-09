// Two-way messages between a coach and a client. Either side renders the same thread; `otherId` is the person on the far side.
import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import { useUI } from "@/App";

export interface Msg { id: string; text: string; ts: number; mine: boolean; read: boolean }

const when = (ts: number) => {
  const d = new Date(ts); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
};

const READ_EVENT = "corpus:messages-read";

/** Unread message counts per linked user (coach or client), polled while the app is visible. */
export function useUnreadMessages(enabled: boolean, everyMs = 30_000) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const load = useCallback(() => { if (enabled) api<{ unread: Record<string, number> }>("GET", "/api/messages").then((r) => setUnread(r.unread)).catch(() => {}); }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, everyMs);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener(READ_EVENT, load);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener(READ_EVENT, load); };
  }, [enabled, everyMs, load]);
  const total = Object.values(unread).reduce((a, b) => a + b, 0);
  return { unread, total, reload: load };
}

export function MessageThread({ otherId, otherName, onRead, emptyHint, height = 320 }: { otherId: string; otherName: string; onRead?: () => void; emptyHint?: string; height?: number }) {
  const ui = useUI();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const first = (n: string) => n.split(" ")[0];

  const markRead = useCallback(async (list: Msg[]) => {
    if (!list.some((m) => !m.mine && !m.read)) return;
    try { await api("POST", `/api/messages/${otherId}/read`); onRead?.(); window.dispatchEvent(new Event(READ_EVENT)); } catch { /* ignore */ }
  }, [otherId, onRead]);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[] }>("GET", `/api/messages/${otherId}`);
      setMsgs(r.messages); setErr("");
      void markRead(r.messages);
    } catch (e) { setErr((e as Error).message); }
  }, [otherId, markRead]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs?.length]);

  const send = async () => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    try {
      const r = await api<{ message: Msg }>("POST", `/api/messages/${otherId}`, { text: t });
      setMsgs((m) => [...(m ?? []), r.message]); setText("");
    } catch (e) { ui.toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div data-testid="thread">
      <div ref={listRef} className="card" style={{ height, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }} data-testid="thread-list">
        {msgs === null && !err && <p className="text-sm muted">Loading…</p>}
        {err && <p className="text-sm orange">{err}</p>}
        {msgs?.length === 0 && <p className="text-sm muted" style={{ margin: "auto", textAlign: "center" }}>{emptyHint ?? `No messages with ${first(otherName)} yet. Say hello.`}</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={`msg ${m.mine ? "mine" : ""}`} data-testid={`msg-${m.id}`}>
            <div className="msg-body">{m.text}</div>
            <div className="msg-meta">{m.mine ? "You" : first(otherName)} · {when(m.ts)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2 items-end">
        <textarea className="textarea flex-1" rows={2} style={{ minHeight: 44 }} placeholder={`Message ${first(otherName)}`} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} data-testid="input-message" />
        <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={!text.trim() || busy} onClick={send} aria-label="Send message" data-testid="button-send-message"><Send size={16} /> Send</button>
      </div>
    </div>
  );
}
