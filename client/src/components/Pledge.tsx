// Optional pledge (Riso): a four-line manifesto signed by holding a button for 1.5 s.
import { useEffect, useRef, useState } from "react";
import { Rings, Tag, shortDate } from "@/components/riso";
import { dateKey, fmtDate } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { Sheet } from "@/components/ui";

/** The pledge is hidden for now (2026-11-09). Set to true to bring back the Profile card and the end-of-tour offer. */
export const PLEDGE_ENABLED = false;

export const PLEDGE = ["I will log every session.", "I will not skip legs.", "I will sleep like it's training.", "I will trust the data."];
const HOLD_MS = 1500;

/** Hold-to-sign button: fills over 1.5 s, cancels on release. */
export function HoldToSign({ onSigned, label = "Hold to sign" }: { onSigned: () => void; label?: string }) {
  const [p, setP] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const done = useRef(false);
  const tick = () => {
    if (start.current === null) return;
    const k = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setP(k);
    if (k >= 1) { start.current = null; done.current = true; navigator.vibrate?.(60); onSigned(); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => { if (done.current) return; start.current = performance.now(); raf.current = requestAnimationFrame(tick); };
  const cancel = () => { if (start.current === null) return; start.current = null; cancelAnimationFrame(raf.current); setP(0); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button type="button" className="btn btn-lg btn-block relative overflow-hidden select-none" style={{ touchAction: "none" }}
      onPointerDown={begin} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!done.current) { done.current = true; onSigned(); } } }}
      aria-label={`${label}. Hold for ${HOLD_MS / 1000} seconds, or press Enter.`} data-testid="button-hold-sign">
      <span className="absolute inset-y-0 left-0" style={{ width: `${p * 100}%`, background: "var(--ink)", transition: p === 0 ? "width .15s" : "none" }} aria-hidden />
      <span className="relative" style={{ color: p > 0.5 ? "var(--page)" : "var(--ink)", mixBlendMode: "normal" }}>{p > 0 && p < 1 ? `Signing… ${Math.round(p * 100)}%` : label}</span>
    </button>
  );
}

export function PledgeStep({ name, onSigned, hint = "Hold the button for 1.5 seconds to sign." }: { name: string; onSigned: () => void; hint?: string }) {
  const today = dateKey();
  return (
    <div data-testid="view-pledge">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm muted">Four promises to yourself. Signing is optional.</p>
        <Rings value={100} size={72} />
      </div>
      <ol className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
        {PLEDGE.map((line, i) => (
          <li key={i} className="py-3" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="label">0{i + 1} /</div>
            <div className="display mt-1" style={{ fontSize: 28 }}>{line}</div>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-2 mt-4 label">
        <span>Signed: {(name || "Athlete").toUpperCase()}</span>
        <Tag>{shortDate(today)}</Tag>
      </div>
      <div className="mt-4"><HoldToSign onSigned={onSigned} /></div>
      <p className="text-[12px] muted mt-3 text-center">{hint}</p>
    </div>
  );
}

/** The pledge in a sheet: sign it (saves the date on the profile), or read it back once signed. */
export function PledgeSheet({ onClose }: { onClose: () => void }) {
  const { profile, set } = useStore();
  const ui = useUI();
  const signed = profile.pledgedAt;
  return (
    <Sheet title="The pledge" onClose={onClose} testId="sheet-pledge">
      {signed
        ? <><ol className="stack" style={{ gap: 8 }}>{PLEDGE.map((l) => <li key={l} className="display" style={{ fontSize: 24 }}>{l}</li>)}</ol><p className="text-sm muted mt-4">Signed {fmtDate(signed, { month: "long", day: "numeric", year: "numeric" })}.</p></>
        : <PledgeStep name={profile.name} onSigned={() => { set((s) => ({ ...s, profile: { ...(s.profile ?? profile), pledgedAt: dateKey() } })); onClose(); ui.toast("Pledge signed"); }} />}
    </Sheet>
  );
}
