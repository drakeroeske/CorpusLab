// Readiness ring: one circular gauge (track, colored arc, big percentage, band label underneath).
// Display only: the score comes in as a prop; the band logic lives in lib/readiness.ts.
import type { ReactNode } from "react";
import { READINESS_BANDS, normalizeScore, readinessAriaLabel, readinessBand, type ReadinessBand } from "@/lib/readiness";

export interface ReadinessRingProps {
  /** Score 0–100. Clamped and rounded; null (or NaN) shows the no-data state. */
  value: number | null | undefined;
  /** Override the band; normally worked out from value. */
  band?: ReadinessBand;
  /** Override the text under the ring (default: the band name, or NO CHECK-IN). */
  label?: string;
  /** Ring diameter in px (the label sits below it). */
  size?: number;
  /** Show the [PUSH] / [HOLD] / [EASE OFF] tag under the label. */
  tag?: boolean;
  /** Adds a "Low confidence" note under the label. */
  lowConfidence?: boolean;
  /** Makes the ring a button (e.g. to open the breakdown). */
  onClick?: () => void;
  /** With onClick: whether what it opens is currently open. */
  expanded?: boolean;
  /** Sweep the arc in on first render (skipped when the user prefers reduced motion). */
  animate?: boolean;
  testId?: string;
}

const R = 38; // ring radius in a 100×100 box; 10-wide stroke spans 33–43
const STROKE = 10;
const TICKS = Array.from({ length: 10 }, (_, i) => (i * 36 * Math.PI) / 180);

export function ReadinessRing({ value, band, label, size = 112, tag = true, lowConfidence = false, onClick, expanded, animate = true, testId = "readiness-ring" }: ReadinessRingProps) {
  const v = normalizeScore(value);
  const b = v == null ? null : band ?? readinessBand(v);
  const info = b ? READINESS_BANDS[b] : null;
  const text = label ?? (info ? info.label : "NO CHECK-IN");
  const aria = readinessAriaLabel(v, { band: b, lowConfidence }) + (onClick ? (expanded ? " Hide breakdown." : " Show breakdown.") : "");

  const ring: ReactNode = (
    <span className="rr-dial" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {TICKS.map((a, i) => (
          <line key={i} x1={50 + 45.5 * Math.sin(a)} y1={50 - 45.5 * Math.cos(a)} x2={50 + 49.5 * Math.sin(a)} y2={50 - 49.5 * Math.cos(a)} className="rr-tick" />
        ))}
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth={STROKE} className="rr-track" />
        {v != null && v > 0 && info && (
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth={STROKE} stroke={info.color} strokeLinecap="butt"
            pathLength={100} strokeDasharray={`${v} 100`} transform="rotate(-90 50 50)"
            className={animate ? "rr-arc rr-animate" : "rr-arc"} data-testid={`${testId}-arc`} />
        )}
      </svg>
      <span className="rr-center num-big" style={{ fontSize: Math.round(size * 0.25) }} data-testid={`${testId}-value`}>
        {v == null ? "—" : <>{v}<span className="rr-pct">%</span></>}
      </span>
    </span>
  );

  const under = (
    <span className="rr-under">
      <span className="rr-label" data-testid={`${testId}-label`}>{text}</span>
      {tag && info && <span className="rr-tag" data-testid={`${testId}-tag`}>[{info.tag}]</span>}
      {lowConfidence && v != null && <span className="rr-note">Low confidence</span>}
    </span>
  );

  return onClick ? (
    <button type="button" className="rr" style={{ width: Math.max(size, 44) }} onClick={onClick} aria-label={aria} aria-expanded={expanded} data-testid={testId} data-band={b ?? "none"}>
      {ring}{under}
    </button>
  ) : (
    <div className="rr" style={{ width: Math.max(size, 44) }} role="img" aria-label={aria} data-testid={testId} data-band={b ?? "none"}>
      {ring}{under}
    </div>
  );
}
