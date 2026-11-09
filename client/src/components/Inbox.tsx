import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { Empty, Sheet } from "@/components/ui";
import { applyDeepLink } from "@/components/Notifications";

export interface InboxItem { id: string; kind: string; title: string; body: string; url: string; read: boolean; ts: number }

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function useInbox(enabled: boolean) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await api<{ items: InboxItem[]; unread: number }>("GET", "/api/inbox");
      setItems(r.items); setUnread(r.unread);
    } catch { /* offline: keep what we have */ }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [enabled, load]);
  return { items, unread, reload: load, setItems, setUnread };
}

/** Bell with an unread count. Opens the in-app inbox. Live accounts only. */
export function InboxButton() {
  const { mode } = useStore();
  const { me, viewing } = useAuth();
  const enabled = mode === "remote" && !!me && !viewing;
  const inbox = useInbox(enabled);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <button className="icon-btn relative" aria-label={inbox.unread ? `Inbox, ${inbox.unread} unread` : "Inbox"} onClick={() => { setOpen(true); inbox.reload(); }} data-testid="button-open-inbox">
        <Bell size={18} />
        {inbox.unread > 0 && <span className="inbox-badge" data-testid="text-inbox-unread">{inbox.unread > 9 ? "9+" : inbox.unread}</span>}
      </button>
      {open && <InboxSheet inbox={inbox} onClose={() => setOpen(false)} />}
    </>
  );
}

function InboxSheet({ inbox, onClose }: { inbox: ReturnType<typeof useInbox>; onClose: () => void }) {
  const ui = useUI();
  const items = inbox.items ?? [];
  const markAll = async () => {
    inbox.setItems(items.map((x) => ({ ...x, read: true }))); inbox.setUnread(0);
    try { await api("POST", "/api/inbox/read", {}); } catch (e) { ui.toast((e as Error).message); }
  };
  const clear = async () => {
    inbox.setItems([]); inbox.setUnread(0);
    try { await api("DELETE", "/api/inbox"); } catch (e) { ui.toast((e as Error).message); inbox.reload(); }
  };
  const openItem = async (it: InboxItem) => {
    if (!it.read) {
      inbox.setItems(items.map((x) => (x.id === it.id ? { ...x, read: true } : x))); inbox.setUnread(Math.max(0, inbox.unread - 1));
      api("POST", "/api/inbox/read", { ids: [it.id] }).catch(() => {});
    }
    onClose();
    applyDeepLink(ui, it.url);
  };
  return (
    <Sheet title="Inbox" onClose={onClose} testId="sheet-inbox"
      right={items.some((x) => !x.read) ? <button className="btn btn-sm" onClick={markAll} data-testid="button-inbox-read-all"><Check size={14} /> Read all</button> : undefined}>
      <p className="text-xs muted mb-3">Spotter requests, respect, comments, crew adds and coach changes land here, whether or not phone notifications are on.</p>
      {inbox.items === null && <p className="text-sm muted">Loading…</p>}
      {inbox.items !== null && items.length === 0 && <Empty>Nothing yet. When a spotter or coach does something that involves you, it shows up here.</Empty>}
      <div className="stack-tight" data-testid="list-inbox">
        {items.map((it) => (
          <button key={it.id} className={`card-flat text-left w-full inbox-item ${it.read ? "" : "unread"}`} onClick={() => openItem(it)} data-testid={`inbox-item-${it.id}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold min0">{it.title}</span>
              <span className="mono text-[11px] muted shrink-0">{ago(it.ts)}</span>
            </div>
            {it.body && <div className="text-xs muted mt-1">{it.body}</div>}
          </button>
        ))}
      </div>
      {items.length > 0 && <button className="btn btn-ghost btn-sm mt-4" onClick={clear} data-testid="button-inbox-clear"><Trash2 size={14} /> Clear inbox</button>}
    </Sheet>
  );
}
