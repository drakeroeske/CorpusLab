import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, type PubUser } from "@/lib/auth";
import { clearInvite, pendingInvite, watchInvites } from "@/lib/invite";
import { Sheet } from "@/components/ui";

const AUTO = "corpus.inviteAuto";
export const markInviteAuto = () => { try { sessionStorage.setItem(AUTO, "1"); } catch { /* ignore */ } };

/** After sign-in, finishes a pending invite link. New sign-ups connect automatically; existing users confirm first. */
export function InviteHandler() {
  const { status, me, viewing } = useAuth();
  const [ask, setAsk] = useState<{ code: string; user: PubUser } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => watchInvites(() => setTick((t) => t + 1)), []);

  const accept = async (code: string) => {
    setBusy(true);
    try {
      const r = await api<{ status: string; user: PubUser }>("POST", `/api/invite/${code}/accept`);
      setNote(r.status === "self" ? "That's your own invite link." : `You and ${r.user.displayName} are now Spotters.`);
    } catch (e) { setNote((e as Error).message); }
    finally { clearInvite(); setAsk(null); setBusy(false); try { sessionStorage.removeItem(AUTO); } catch { /* ignore */ } }
  };

  useEffect(() => {
    if (status !== "authed" || !me || viewing) return;
    const code = pendingInvite();
    if (!code) return;
    let auto = false; try { auto = sessionStorage.getItem(AUTO) === "1"; } catch { /* ignore */ }
    if (auto) { accept(code); return; }
    api<{ user: PubUser }>("GET", `/api/invite/${code}`)
      .then((r) => { if (r.user.id === me.id) { clearInvite(); } else setAsk({ code, user: r.user }); })
      .catch((e) => { clearInvite(); setNote((e as Error).message); });
  }, [status, me?.id, viewing, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 4500); return () => clearTimeout(t); }, [note]);

  return (
    <>
      {ask && (
        <Sheet title="Spotter invite" onClose={() => { clearInvite(); setAsk(null); }} testId="sheet-invite">
          <div className="flex items-center gap-3">
            <span className="avatar" style={{ width: 44, height: 44 }}>{ask.user.displayName.slice(0, 2).toUpperCase()}</span>
            <div className="min0"><div className="font-semibold">{ask.user.displayName}</div><div className="mono text-xs muted">@{ask.user.username}</div></div>
          </div>
          <p className="text-sm muted mt-3">Add {ask.user.displayName} as a Spotter? You'll see each other's shared workouts, gym check-ins and leaderboard lifts. You can remove them anytime.</p>
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1" onClick={() => { clearInvite(); setAsk(null); }} data-testid="button-invite-decline">Not now</button>
            <button className="btn btn-primary flex-1" disabled={busy} onClick={() => accept(ask.code)} data-testid="button-invite-accept"><UserPlus size={16} /> Add Spotter</button>
          </div>
        </Sheet>
      )}
      {note && <div className="toast" role="status" data-testid="toast-invite">{note}</div>}
    </>
  );
}
