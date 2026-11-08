import { useState } from "react";
import { Download, Share, SquarePlus, Smartphone, X } from "lucide-react";
import { useInstall } from "@/lib/install";

function IOSSteps() {
  return (
    <ol className="stack mt-3" style={{ gap: 10 }} data-testid="list-ios-install-steps">
      <li className="flex items-start gap-3"><span className="mono lime w-5 shrink-0">1</span><span className="text-sm">Tap the <Share size={14} className="inline -mt-1" /> <b>Share</b> button in Safari's toolbar.</span></li>
      <li className="flex items-start gap-3"><span className="mono lime w-5 shrink-0">2</span><span className="text-sm">Scroll down and tap <SquarePlus size={14} className="inline -mt-1" /> <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
      <li className="flex items-start gap-3"><span className="mono lime w-5 shrink-0">3</span><span className="text-sm">Open RXS from your home screen and sign in once. iPhone keeps home screen apps separate from Safari.</span></li>
    </ol>
  );
}

/** Full card for Profile. Hidden once running as an installed app. */
export function InstallCard() {
  const ins = useInstall();
  if (ins.standalone) return (
    <div className="card flex items-center gap-3" data-testid="card-installed"><Smartphone size={18} className="lime" /><span className="text-sm">Running as a home screen app.</span></div>
  );
  return (
    <div className="card" data-testid="card-install">
      <div className="flex items-center gap-2"><Smartphone size={18} className="lime" /><span className="text-sm font-semibold">Add RXS to your home screen</span></div>
      <p className="text-xs muted mt-1">Opens full screen like a regular app, with its own icon, and loads even with a weak gym signal.</p>
      {ins.canPrompt ? (
        <button className="btn btn-primary btn-block mt-3" onClick={() => ins.prompt()} data-testid="button-install-app"><Download size={16} /> Install app</button>
      ) : ins.ios ? <IOSSteps /> : (
        <p className="text-sm muted mt-3">On iPhone: open rxs-lab.pplx.app in Safari, tap Share, then Add to Home Screen. On Android: open it in Chrome and choose Install app from the menu.</p>
      )}
    </div>
  );
}

const KEY = "corpus.installHint.dismissed";
/** One-time dismissible banner for the Today screen on phones. */
export function InstallBanner() {
  const ins = useInstall();
  const [gone, setGone] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } });
  const [open, setOpen] = useState(false);
  const mobile = ins.ios || ins.canPrompt || /Android/i.test(navigator.userAgent);
  if (gone || ins.standalone || ins.framed || !mobile) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setGone(true); };
  return (
    <div className="card mb-3" data-testid="banner-install">
      <div className="flex items-start gap-3">
        <Smartphone size={18} className="lime shrink-0 mt-0.5" />
        <div className="min0 flex-1">
          <div className="text-sm font-semibold">Put RXS on your home screen</div>
          <div className="text-xs muted">Full screen, one tap from your phone's home screen.</div>
        </div>
        <button className="faint shrink-0" aria-label="Dismiss" onClick={dismiss} style={{ padding: 10, margin: -10 }} data-testid="button-dismiss-install"><X size={16} /></button>
      </div>
      {ins.canPrompt
        ? <button className="btn btn-primary btn-block mt-3" onClick={async () => { if (await ins.prompt()) dismiss(); }} data-testid="button-banner-install"><Download size={16} /> Install app</button>
        : open ? <IOSSteps /> : <button className="btn btn-outline btn-block mt-3" onClick={() => setOpen(true)} data-testid="button-banner-show-steps">Show me how</button>}
    </div>
  );
}
