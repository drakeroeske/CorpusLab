import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState, Profile } from "./types";
import { getLocalStore } from "./persist-local";
import { emptyState, upgradeState } from "./empty";
import { registerCustomExercises } from "./exercises";
import { api, ApiError } from "./api";
import { computePublicStats } from "./social";
import { nutritionTargets, trainingDaysPerWeek, type NutritionTargets } from "./engine";

const KEY = "corpus.v1";

/* persistence: localStorage when built for standalone hosting, memory otherwise */
const memory: Record<string, string> = {};
const ls: Storage | null = import.meta.env.VITE_PERSIST === "local" ? getLocalStore() : null;
const storageOK = !!ls;
export const storageAvailable = () => storageOK;
function readRaw(): string | null {
  try { return ls ? ls.getItem(KEY) : memory[KEY] ?? null; } catch { return memory[KEY] ?? null; }
}
function writeRaw(v: string): boolean {
  memory[KEY] = v;
  if (!ls) return false;
  try { ls.setItem(KEY, v); return true; } catch { return false; }
}

export { emptyState };

function load(): AppState {
  const raw = readRaw();
  if (!raw) return emptyState();
  try { return upgradeState(JSON.parse(raw)); } catch { return emptyState(); }
}

interface Ctx {
  state: AppState;
  set: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  profile: Profile;
  targets: NutritionTargets;
  saveError: boolean;
  mode: StoreMode;
}

const StoreCtx = createContext<Ctx | null>(null);

const FALLBACK_PROFILE: Profile = {
  name: "", units: "lb", bodyWeight: 180, heightCm: 178, age: 30, sex: null, experience: "intermediate",
  goal: "muscle", gym: "", coachMode: false, onboarded: false, barWeight: 45,
};

let remoteOK = false;
export const remoteAvailable = () => remoteOK;

export type StoreMode = "offline" | "remote" | "readonly";

export function StoreProvider({ children, mode = "offline", initial, onAuthLost }: { children: ReactNode; mode?: StoreMode; initial?: AppState; onAuthLost?: () => void }) {
  const [state, setState] = useState<AppState>(() => (initial ? upgradeState(initial) : mode === "offline" ? load() : emptyState()));
  // Custom exercises live in state; keep the global EX lookup in step before any child renders.
  registerCustomExercises(state.customExercises);
  const [saveError, setSaveError] = useState(false);
  const [ready, setReady] = useState(mode !== "remote");
  const skipNext = useRef(true);
  const saving = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    if (mode !== "remote") return;
    let alive = true;
    api<{ state: AppState | null }>("GET", "/api/state")
      .then((r) => {
        if (!alive) return;
        remoteOK = true;
        if (r.state) { skipNext.current = true; setState(upgradeState(r.state)); }
        setReady(true);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) { onAuthLost?.(); return; }
        setSaveError(true); setReady(true);
      });
    return () => { alive = false; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (mode === "readonly") return;
    const t = setTimeout(async () => {
      if (mode === "offline") { const ok = writeRaw(JSON.stringify(state)); setSaveError(!ok && storageOK); return; }
      const p = api<{ merged?: boolean; state?: AppState }>("PUT", "/api/state", { state, stats: computePublicStats(state) });
      saving.current = p;
      try {
        const r = await p;
        setSaveError(false);
        if (r.merged && r.state) { skipNext.current = true; setState(upgradeState(r.state)); }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) onAuthLost?.();
        else setSaveError(true);
      }
    }, mode === "offline" ? 120 : 700);
    return () => clearTimeout(t);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const replace = useCallback((s: AppState) => setState(upgradeState(s)), []);
  const profile = state.profile ?? FALLBACK_PROFILE;
  const targets = useMemo(() => nutritionTargets(profile, trainingDaysPerWeek(state.program)), [profile, state.program]);
  if (!ready) return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--muted)" }} className="mono text-xs" data-testid="status-loading">Loading</div>;
  return <StoreCtx.Provider value={{ state, set, replace, profile, targets, saveError, mode }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
