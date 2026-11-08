import type { AppState } from "./types";

export const emptyState = (): AppState => ({
  version: 2, profile: null, program: null, sessions: [], checkins: [], meals: [], favorites: [], recentFoods: [],
  experiments: [], photos: [], measurements: [], spotters: [], feed: [], crews: [], gymCheckin: null,
  clients: [], chat: [], activeSession: null, restDefaults: { compound: 180, isolation: 90 }, demo: false,
});

/** Bring older saved states up to the current schema. Idempotent. */
export function upgradeState(raw: Partial<AppState> | null | undefined): AppState {
  const s: AppState = { ...emptyState(), ...(raw ?? {}) };
  const v = typeof s.version === "number" ? s.version : 1;
  if (v < 2) {
    // v1 soreness was 1 (none) → 5; v2 is 0/absent (none) → 5 so every heat color is reachable.
    s.checkins = (s.checkins ?? []).map((c) => {
      const soreness: typeof c.soreness = {};
      for (const [m, val] of Object.entries(c.soreness ?? {})) { const n = Math.max(0, (val ?? 1) - 1); if (n) (soreness as Record<string, number>)[m] = n; }
      return { ...c, soreness };
    });
  }
  s.version = 2;
  return s;
}
