import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { pendingInvite, clearInvite } from "@/lib/invite";
import { markInviteAuto } from "@/components/InviteHandler";
import type { PubUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { useAuth, type Me } from "@/lib/auth";
import { Seg, Wordmark } from "@/components/ui";
import { RecoveryCodeView } from "@/components/Recovery";

export default function AuthScreen() {
  const { signedIn } = useAuth();
  const [invite] = useState(() => pendingInvite());
  const [inviter, setInviter] = useState<PubUser | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(invite ? "signup" : "signin");
  useEffect(() => {
    if (!invite) return;
    api<{ user: PubUser }>("GET", `/api/invite/${invite}`).then((r) => setInviter(r.user)).catch(() => clearInvite());
  }, [invite]);
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{ me: Me; code: string; reset: boolean } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [coach, setCoach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "signin") { signedIn(await api<Me>("POST", "/api/auth/login", { username, password })); return; }
      if (mode === "signup" && inviter) markInviteAuto();
      const r = mode === "signup"
        ? await api<Me & { recoveryCode: string }>("POST", "/api/auth/signup", { username, password, displayName, role: coach ? "coach" : "athlete" })
        : await api<Me & { recoveryCode: string }>("POST", "/api/auth/reset", { username, code, password });
      const { recoveryCode, ...me } = r;
      setIssued({ me, code: recoveryCode, reset: mode === "reset" });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Something went wrong");
    } finally { setBusy(false); }
  };

  if (issued) return (
    <div className="app">
      <div className="topbar"><Wordmark /></div>
      <div className="screen" style={{ paddingBottom: 60 }}>
        {issued.reset && <p className="text-sm lime mt-4 mb-2" data-testid="text-reset-ok">Password updated. You're signed in, and any other devices were signed out. Your old recovery code no longer works, so here's a new one.</p>}
        <div className="mt-4"><RecoveryCodeView code={issued.code} username={issued.me.username} onDone={() => signedIn(issued.me)} /></div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="topbar"><Wordmark /></div>
      <div className="screen" style={{ paddingBottom: 60 }}>
        <p className="label mt-4">Training engine · v1</p>
        <h1 className="text-[28px] font-semibold leading-tight mt-2" style={{ letterSpacing: "-0.02em" }}>Every rep, meal, and night's sleep — connected.</h1>
        <p className="text-sm muted mt-3">Your account keeps your data synced across devices and connects you with Spotters and your coach.</p>

        {inviter && mode !== "reset" && (
          <div className="card mt-5 flex items-start gap-3" style={{ borderColor: "var(--lime)" }} data-testid="card-invited-by">
            <UserPlus size={18} className="lime shrink-0 mt-0.5" />
            <div className="min0"><div className="text-sm font-semibold">{inviter.displayName} invited you</div>
              <div className="text-xs muted">{mode === "signup" ? "Create an account and you'll be Spotters automatically." : "Sign in and we'll ask before adding them as a Spotter."}</div></div>
          </div>
        )}
        <div className="mt-6">
          {mode === "reset"
            ? <div><h2 className="text-lg font-semibold">Reset your password</h2><p className="text-sm muted mt-1">Enter your username, the recovery code you saved when you made your account, and a new password.</p></div>
            : <Seg value={mode} onChange={(m) => { setMode(m); setErr(""); }} options={[{ v: "signin", l: "Sign in" }, { v: "signup", l: "Create account" }]} testId="seg-auth-mode" />}
        </div>

        <form className="card stack mt-4" onSubmit={submit} data-testid="form-auth">
          {mode === "signup" && (
            <label className="field"><span className="label">Name</span>
              <input className="input" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Rivera" maxLength={40} data-testid="input-display-name" />
            </label>
          )}
          <label className="field"><span className="label">Username</span>
            <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="alex.lifts" maxLength={24} required data-testid="input-username" />
          </label>
          {mode === "reset" && (
            <label className="field"><span className="label">Recovery code</span>
              <input className="input mono" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} required data-testid="input-recovery-code" />
            </label>
          )}
          <label className="field"><span className="label">{mode === "reset" ? "New password" : "Password"}</span>
            <input className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password}
              onChange={(e) => setPassword(e.target.value)} minLength={mode !== "signin" ? 8 : undefined} required data-testid="input-password" />
          </label>
          {mode === "signup" && (
            <>
              <p className="text-[11px] faint -mt-1">3–24 characters for username: lowercase letters, numbers, dots, underscores. Password: 8+ characters.</p>
              <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                <span><span className="text-sm font-semibold block">I coach other lifters</span><span className="text-xs muted">Turns on coach mode. You can change this later.</span></span>
                <input type="checkbox" className="toggle" checked={coach} onChange={(e) => setCoach(e.target.checked)} data-testid="toggle-signup-coach" />
              </label>
            </>
          )}
          {err && <p className="text-xs orange" role="alert" data-testid="text-auth-error">{err}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !username || !password || (mode === "reset" && code.replace(/[^A-Z0-9]/gi, "").length < 16)} type="submit" data-testid="button-auth-submit">
            {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Set new password"}
          </button>
          {mode === "signin" && <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => { setMode("reset"); setErr(""); setPassword(""); }} data-testid="button-forgot-password">Forgot password?</button>}
          {mode === "reset" && <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => { setMode("signin"); setErr(""); setPassword(""); }} data-testid="button-back-signin">Back to sign in</button>}
        </form>
        <p className="text-[11px] faint text-center mt-4">Your training log, check-ins and meals are private. You choose what Spotters and coaches can see.</p>
        <p className="text-center mt-2"><a href="#/privacy" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} data-testid="link-privacy">Privacy</a></p>
      </div>
    </div>
  );
}
