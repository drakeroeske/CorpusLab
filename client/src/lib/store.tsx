import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState, Profile } from "./types";
import { getLocalStore } from "./persist-local";
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

export const emptyState = (): AppState => ({
  version: 1, profile: null, program: null, sessions: [], checkins: [], meals: [], favorites: [],
  experiments: [], photos: [], measurements: [], spotters: [], feed: [], crews: [], gymCheckin: null,
  clients: [], chat: [], activeSession: null, restDefaults: { compound: 180, isolation: 90 }, demo: false,
});

function load(): AppState {
  const raw = readRaw();
  if (!raw) return emptyState();
  try { return { ...emptyState(), ...JSON.parse(raw) }; } catch { return emptyState(); }
}

interface Ctx {
  state: AppState;
  set: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  profile: Profile;
  targets: NutritionTargets;
  saveError: boolean;
}

const StoreCtx = createContext<Ctx | null>(null);

const FALLBACK_PROFILE: Profile = {
  name: "", units: "lb", bodyWeight: 180, heightCm: 178, age: 30, sex: null, experience: "intermediate",
  goal: "muscle", gym: "", coachMode: false, onboarded: false, barWeight: 45,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const ok = writeRaw(JSON.stringify(state));
      setSaveError(!ok && storageOK);
    }, 120);
    return () => clearTimeout(t);
  }, [state]);
  const set = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const replace = useCallback((s: AppState) => setState({ ...emptyState(), ...s }), []);
  const profile = state.profile ?? FALLBACK_PROFILE;
  const targets = useMemo(() => nutritionTargets(profile, trainingDaysPerWeek(state.program)), [profile, state.program]);
  return <StoreCtx.Provider value={{ state, set, replace, profile, targets, saveError }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
