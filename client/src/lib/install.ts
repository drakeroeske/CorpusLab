import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; subs.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; subs.forEach((f) => f()); });
}

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
export const isIOS = () =>
  typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

export function registerSW() {
  const secure = location.protocol === "https:" || location.hostname === "localhost";
  if (!("serviceWorker" in navigator) || !secure || inFrame()) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}); });
}

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const standalone = isStandalone();
  return {
    standalone,
    ios: isIOS(),
    canPrompt: !!deferred,
    framed: inFrame(),
    prompt: async () => { if (!deferred) return false; await deferred.prompt(); const r = await deferred.userChoice; deferred = null; tick((n) => n + 1); return r.outcome === "accepted"; },
  };
}
