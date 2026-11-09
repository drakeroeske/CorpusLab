import { useState } from "react";
import { Copy, Download, KeyRound } from "lucide-react";

/** Shows a freshly issued recovery code once. The user must confirm they saved it. */
export function RecoveryCodeView({ code, username, onDone, doneLabel = "Continue" }: { code: string; username: string; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const download = () => {
    const txt = `Corpus recovery code\n\nUsername: @${username}\nRecovery code: ${code}\n\nUse this on the sign-in screen (Forgot password?) to set a new password.\nEach code works once. After you use it you get a new one.\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = `corpus-recovery-${username}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div data-testid="view-recovery-code">
      <div className="flex items-center gap-2"><KeyRound size={18} className="lime" /><h2 className="display text-[20px]">Save your recovery code</h2></div>
      <p className="text-sm muted mt-2">If you forget your password, this code is the only way back into your account. Keep it somewhere safe, like your password manager, Notes or a screenshot.</p>
      <div className="card-flat mt-4 text-center" style={{ borderColor: "var(--lime)", background: "var(--lime-dim)" }}>
        <div className="label">Recovery code</div><div className="mono text-xs muted mt-1">for @{username}</div>
        <div className="mono font-semibold mt-2" style={{ fontSize: 22, letterSpacing: "0.06em", userSelect: "all", wordBreak: "break-all" }} data-testid="text-recovery-code">{code}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn btn-outline" onClick={copy} data-testid="button-copy-recovery"><Copy size={16} /> {copied ? "Copied" : "Copy"}</button>
        <button className="btn btn-outline" onClick={download} data-testid="button-download-recovery"><Download size={16} /> Save file</button>
      </div>
      <p className="text-[11px] faint mt-2">You won't be able to see this code again. You can make a new one anytime in Profile.</p>
      <label className="flex items-center gap-3 mt-4 text-sm" style={{ minHeight: 44 }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ width: 20, height: 20, accentColor: "#111418" }} data-testid="checkbox-saved-recovery" />
        I saved my recovery code
      </label>
      <button className="btn btn-primary btn-lg btn-block mt-2" disabled={!saved} onClick={onDone} data-testid="button-recovery-done">{doneLabel}</button>
    </div>
  );
}
