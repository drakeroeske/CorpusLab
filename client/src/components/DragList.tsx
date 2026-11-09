import { useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from "react";

/**
 * Drag-to-reorder for a vertical list. Attach `containerRef` to the list wrapper, spread
 * `itemProps(i)` on each row and `handleProps(i)` on the grab handle. Works with touch and mouse;
 * the handle should have `touch-action: none` (the `.drag-handle` class does).
 */
export function useDragReorder(onReorder: (from: number, to: number) => void): {
  containerRef: RefObject<HTMLDivElement>;
  dragging: number | null;
  itemProps: (i: number) => { "data-drag-item": string; className: string };
  handleProps: (i: number) => Record<string, unknown>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const live = useRef<{ from: number; to: number } | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const items = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-drag-item]") ?? []);
  const slotAt = (y: number) => {
    const els = items();
    for (let k = 0; k < els.length; k++) { const r = els[k].getBoundingClientRect(); if (y < r.top + r.height / 2) return k; }
    return els.length;
  };
  const update = (d: { from: number; to: number } | null) => { live.current = d; setDrag(d); };

  const handleProps = (i: number) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      update({ from: i, to: i });
    },
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      if (!live.current) return;
      const to = slotAt(e.clientY);
      if (to !== live.current.to) update({ ...live.current, to });
      // keep the page scrolling when dragging near the edges
      const vh = window.innerHeight;
      if (e.clientY < 90) window.scrollBy(0, -8); else if (e.clientY > vh - 110) window.scrollBy(0, 8);
    },
    onPointerUp: (e: RPointerEvent<HTMLElement>) => {
      const d = live.current;
      update(null);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!d) return;
      const dest = d.to > d.from ? d.to - 1 : d.to;
      if (dest !== d.from) onReorder(d.from, dest);
    },
    onPointerCancel: () => update(null),
    "aria-label": "Drag to reorder",
    role: "button",
    tabIndex: -1,
  });

  const itemProps = (i: number) => {
    let cls = "";
    if (drag) {
      if (i === drag.from) cls = "dragging";
      else if (drag.to === i && drag.to !== drag.from + 1) cls = "drop-before";
      else if (drag.to === i + 1 && i + 1 !== drag.from && drag.to === items().length) cls = "drop-after";
    }
    return { "data-drag-item": "", className: cls };
  };

  return { containerRef, dragging: drag?.from ?? null, itemProps, handleProps };
}

/** Pure helper: move an array item. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}
