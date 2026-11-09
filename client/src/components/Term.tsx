// Tap-to-explain: a small ⓘ after a training term opens a short definition from the glossary.
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info as InfoIcon } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/** Just the ⓘ button. */
export function Info({ k, size = 14 }: { k: GlossaryKey; size?: number }) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const g = GLOSSARY[k];

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
    const up = r.bottom + 160 > window.innerHeight;
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left, up });
  };

  return (
    <>
      <button ref={btn} type="button" className="term-i" onClick={toggle} aria-label={`What is ${g.term}?`} aria-expanded={!!pos} data-testid={`info-${k}`}>
        <InfoIcon size={size} />
      </button>
      {pos && createPortal(
        <div role="tooltip" className="term-pop" style={{ top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }} data-testid={`popover-${k}`}>
          <b>{g.term}</b> {g.text}
        </div>,
        document.body,
      )}
    </>
  );
}

/** A term followed by its ⓘ. Defaults to the glossary's own spelling. */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  return <span className="term">{children ?? GLOSSARY[k].term}<Info k={k} /></span>;
}
