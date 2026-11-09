// Readiness bands and training load: pure functions shared by the engine, the ring and the tests.
// No imports, so it runs anywhere (app, server-side render, Vitest).

export type ReadinessBand = "high" | "moderate" | "low";

export interface BandInfo {
  /** Shown under the ring, ALL CAPS. */
  label: string;
  /** The recommendation tag, e.g. [HOLD]. */
  tag: string;
  /** Arc color. Text never relies on it alone: the label names the band. */
  color: string;
  /** Lowest score in the band (inclusive). */
  min: number;
}

/** Same cutoffs the logger uses (readinessEffect), so the ring and the weights always agree. */
export const READINESS_BANDS: Record<ReadinessBand, BandInfo> = {
  high: { label: "HIGH", tag: "PUSH", color: "#E94191", min: 75 },
  moderate: { label: "MODERATE", tag: "HOLD", color: "#B8236A", min: 50 },
  low: { label: "LOW", tag: "EASE OFF", color: "#1A1A1A", min: 0 },
};

/** Clamp to a whole number 0–100. null, undefined, NaN and ±Infinity mean "no score". */
export function normalizeScore(value: number | null | undefined): number | null {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Band for a score, or null when there is no score. Out-of-range values are clamped first. */
export function readinessBand(value: number | null | undefined): ReadinessBand | null {
  const v = normalizeScore(value);
  if (v == null) return null;
  return v >= READINESS_BANDS.high.min ? "high" : v >= READINESS_BANDS.moderate.min ? "moderate" : "low";
}

/** Screen-reader text, e.g. "Readiness 58 percent, moderate. Hold." */
export function readinessAriaLabel(value: number | null | undefined, opts: { band?: ReadinessBand | null; lowConfidence?: boolean } = {}): string {
  const v = normalizeScore(value);
  if (v == null) return "Readiness, no check-in yet";
  const b = opts.band ?? readinessBand(v)!;
  const info = READINESS_BANDS[b];
  const tag = info.tag.charAt(0) + info.tag.slice(1).toLowerCase();
  return `Readiness ${v} percent, ${info.label.toLowerCase()}. ${tag}.${opts.lowConfidence ? " Low confidence." : ""}`;
}

/* ---------- training load ---------- */

/** Days of history needed before load counts. */
export const LOAD_MIN_HISTORY_DAYS = 14;

/**
 * Load sub-score 0–1 from hard sets in the last 2 days vs your usual 2 days.
 * At or below usual → 1. 50% or more above usual → 0. Straight line in between.
 * Returns null (load left out) when there's no usual to compare with.
 */
export function loadScore(recentSets: number, usualSets: number | null): number | null {
  if (usualSets == null || !Number.isFinite(usualSets) || usualSets <= 0 || !Number.isFinite(recentSets)) return null;
  const ratio = Math.max(0, recentSets) / usualSets;
  if (ratio <= 1) return 1;
  if (ratio >= 1.5) return 0;
  return 1 - (ratio - 1) / 0.5;
}

/** Minimal session shape so this module stays import-free. */
export interface LoadSession { date: string; end: number | null; exercises: { sets: unknown[] }[] }

const dayNum = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);

/**
 * Hard sets logged in the 2 days before `date`, and the usual for any 2 days over the 28 days before that.
 * usual is null with under 14 days of history.
 */
export function trainingLoadInputs(sessions: LoadSession[], date: string): { recent: number; usual: number | null } {
  const today = dayNum(date);
  let recent = 0, past = 0, first = Infinity;
  for (const s of sessions) {
    if (!s.end) continue;
    const d = dayNum(s.date);
    const ago = today - d;
    if (ago < 1) continue;
    first = Math.min(first, d);
    const sets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
    if (ago <= 2) recent += sets;
    else if (ago <= 30) past += sets;
  }
  const historyDays = today - first;
  const usual = historyDays >= LOAD_MIN_HISTORY_DAYS ? (past / Math.min(28, historyDays - 2)) * 2 : null;
  return { recent, usual };
}
