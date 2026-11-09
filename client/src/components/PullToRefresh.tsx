import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Pull-to-refresh for a scrolling screen. Drag down from the very top of the page by 70px+
 * and release to call onRefresh. Shows a one-line status while refreshing.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown> | void; children: ReactNode }) {
  const [state, setState] = useState<"idle" | "pull" | "ready" | "busy">("idle");
  const start = useRef<number | null>(null);
  const stRef = useRef(state); stRef.current = state;
  const cb = useRef(onRefresh); cb.current = onRefresh;
  useEffect(() => {
    const down = (e: TouchEvent) => { start.current = window.scrollY <= 0 && stRef.current !== "busy" ? e.touches[0].clientY : null; };
    const move = (e: TouchEvent) => {
      if (start.current == null || stRef.current === "busy") return;
      const dy = e.touches[0].clientY - start.current;
      if (dy < 10) { if (stRef.current !== "idle") setState("idle"); return; }
      setState(dy > 70 ? "ready" : "pull");
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      if (stRef.current !== "ready") { setState("idle"); return; }
      setState("busy");
      try { await cb.current(); } finally { setState("idle"); }
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); window.removeEventListener("touchcancel", up); };
  }, []);
  return (
    <>
      <div className={`ptr ${state === "idle" ? "" : "active"}`} aria-live="polite" data-testid="status-ptr">
        {state === "pull" && "Pull to refresh"}{state === "ready" && "Release to refresh"}{state === "busy" && "Refreshing…"}
      </div>
      {children}
    </>
  );
}
