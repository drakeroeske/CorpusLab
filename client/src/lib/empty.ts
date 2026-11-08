import type { AppState } from "./types";

export const emptyState = (): AppState => ({
  version: 1, profile: null, program: null, sessions: [], checkins: [], meals: [], favorites: [], recentFoods: [],
  experiments: [], photos: [], measurements: [], spotters: [], feed: [], crews: [], gymCheckin: null,
  clients: [], chat: [], activeSession: null, restDefaults: { compound: 180, isolation: 90 }, demo: false,
});
