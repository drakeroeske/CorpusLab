// Tap-to-explain: a small ⓘ after a training term opens a short definition from the glossary.
import { MUSCLE_INFO, MUSCLE_LABEL } from "@/lib/exercises";
import type { Muscle } from "@/lib/types";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/** Just the ⓘ button. */
/**
 * A tap-to-open bubble anchored to its trigger (an ⓘ icon by default, or any inline content).
 * Closes on outside tap, scroll, resize or Escape.
 */
export function Tip({ label, testId, popTestId, trigger, className = "term-i", children }: {
  label: string; testId?: string; popTestId?: string; trigger?: ReactNode; className?: string; children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => { if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return; setPos(null); };
    const outside = (e: PointerEvent) => { if (!btn.current?.contains(e.target as Node)) setPos(null); };
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", close); window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close); window.removeEventListener("pointerdown", outside);
    };
  }, [pos]);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - 16 - w));
    const up = r.bottom + 180 > window.innerHeight;
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left, up });
  };

  return (
    <>
      <button ref={btn} type="button" className={className} onClick={toggle} aria-label={label} aria-expanded={!!pos} data-testid={testId}>
        {trigger ?? <InfoIcon size={14} />}
      </button>
      {pos && createPortal(
        <div role="tooltip" className="term-pop" style={{ top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }} data-testid={popTestId}>
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Info({ k, size = 14 }: { k: GlossaryKey; size?: number }) {
  const g = GLOSSARY[k];
  return (
    <Tip label={`What is ${("aria" in g && g.aria) || g.term}?`} testId={`info-${k}`} popTestId={`popover-${k}`} trigger={<InfoIcon size={size} />}>
      <b>{g.term}</b> {g.text}
    </Tip>
  );
}

/** A muscle's short name; tap it for the full anatomical name, where it is and what it does. */
export function MuscleName({ m, short = true }: { m: Muscle; short?: boolean }) {
  const i = MUSCLE_INFO[m];
  return (
    <Tip label={`${MUSCLE_LABEL[m]}: what is it?`} testId={`muscle-info-${m}`} popTestId={`popover-muscle-${m}`} className="muscle-name" trigger={short ? i.short : MUSCLE_LABEL[m]}>
      <b>{MUSCLE_LABEL[m]}</b>
      <span className="block mt-1" style={{ opacity: 0.8 }}>{i.full}</span>
      <span className="block mt-2"><b>Where:</b> {i.where}</span>
      <span className="block mt-1"><b>What it does:</b> {i.does}</span>
    </Tip>
  );
}

/** A term followed by its ⓘ. Defaults to the glossary's own spelling. */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  return <span className="term">{children ?? GLOSSARY[k].term}<Info k={k} /></span>;
}
