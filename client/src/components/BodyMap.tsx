import type { Muscle } from "@/lib/types";
import { MUSCLE_LABEL } from "@/lib/exercises";

type Poly = [number, number][];
const mir = (p: Poly): Poly => p.map(([x, y]) => [120 - x, y]);
const pts = (p: Poly) => p.map(([x, y]) => `${x},${y}`).join(" ");

const FRONT: { m: Muscle; polys: Poly[] }[] = [
  { m: "shoulders", polys: [[[30, 40], [41, 37], [43, 47], [36, 57], [28, 55], [27, 46]]] },
  { m: "chest", polys: [[[43, 41], [59, 41], [59, 60], [50, 63], [42, 59], [41, 49]]] },
  { m: "biceps", polys: [[[27, 58], [35, 59], [34, 76], [30, 84], [24, 82], [24, 68]]] },
  { m: "forearms", polys: [[[23, 86], [30, 87], [28, 104], [24, 118], [18, 117], [18, 100]]] },
  { m: "abs", polys: [[[48, 65], [59, 64], [59, 104], [52, 108], [47, 100], [46, 78]]] },
  { m: "quads", polys: [[[42, 114], [58, 116], [57, 146], [54, 170], [46, 170], [41, 148], [40, 128]]] },
  { m: "calves", polys: [[[43, 180], [53, 180], [54, 200], [51, 226], [46, 226], [42, 202]]] },
];
const BACK: { m: Muscle; polys: Poly[] }[] = [
  { m: "upper_back", polys: [[[52, 32], [60, 34], [60, 72], [52, 66], [42, 50], [42, 42]]] },
  { m: "rear_delts", polys: [[[29, 41], [40, 38], [41, 48], [35, 56], [28, 54]]] },
  { m: "triceps", polys: [[[27, 58], [35, 59], [35, 76], [31, 85], [24, 82], [24, 68]]] },
  { m: "forearms", polys: [[[23, 86], [30, 87], [28, 104], [24, 118], [18, 117], [18, 100]]] },
  { m: "lats", polys: [[[41, 53], [51, 67], [59, 76], [58, 92], [48, 96], [41, 80], [38, 64]]] },
  { m: "lower_back", polys: [[[50, 94], [59, 92], [59, 108], [50, 108], [47, 101]]] },
  { m: "glutes", polys: [[[42, 108], [59, 109], [59, 128], [52, 134], [42, 130], [40, 118]]] },
  { m: "hamstrings", polys: [[[42, 136], [57, 136], [57, 152], [54, 172], [46, 172], [42, 154]]] },
  { m: "calves", polys: [[[42, 180], [54, 180], [55, 198], [51, 224], [46, 224], [41, 200]]] },
];

const SIL = "M60 7 a11 12 0 1 1 -0.01 0 Z M50 30 h20 v6 h-20 Z";
const OUT: Poly = [[52, 31], [42, 36], [28, 38], [22, 48], [22, 70], [16, 98], [14, 120], [20, 124], [26, 110], [33, 88], [38, 70], [40, 96], [38, 112], [38, 150], [41, 176], [40, 204], [43, 236], [55, 236], [56, 204], [58, 176], [60, 156]];
const outline = [...OUT, ...mir([...OUT].reverse())];

export function fatigueColor(v: number) {
  if (v < 4) return "#E1E5E8";
  const t = Math.min(1, v / 100);
  // tan (#B08A68) → red (#B42318)
  const a = [176, 138, 104], b = [180, 35, 24];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${0.28 + 0.62 * Math.min(1, v / 70)})`;
}

export function BodyMap({ values, view, onTap, selected, testId, height = 280 }: { values: Partial<Record<Muscle, number>>; view: "front" | "back"; onTap?: (m: Muscle) => void; selected?: Muscle | null; testId?: string; height?: number }) {
  const parts = view === "front" ? FRONT : BACK;
  return (
    <svg viewBox="0 0 120 244" height={height} style={{ display: "block", margin: "0 auto", maxWidth: "100%" }} data-testid={testId} role="img" aria-label={`${view} body diagram`}>
      <polygon points={pts(outline)} fill="none" stroke="var(--border-strong)" strokeWidth="0.8" />
      <path d={SIL} fill="none" stroke="var(--border-strong)" strokeWidth="0.8" />
      <line x1="60" y1="40" x2="60" y2="110" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
      {parts.map(({ m, polys }) =>
        polys.flatMap((p, i) => [p, mir(p)].map((pp, j) => (
          <polygon key={`${m}-${i}-${j}`} points={pts(pp)} className="muscle"
            fill={fatigueColor(values[m] ?? 0)} stroke={selected === m ? "var(--text)" : "var(--bg)"} strokeWidth={selected === m ? 1.2 : 0.8}
            onClick={() => onTap?.(m)} data-testid={`muscle-${view}-${m}${j ? "-r" : ""}`}>
            <title>{MUSCLE_LABEL[m]}: {Math.round(values[m] ?? 0)}%</title>
          </polygon>
        ))),
      )}
      <text x="60" y="242" textAnchor="middle" fontSize="6" fill="var(--faint)" fontFamily="JetBrains Mono" letterSpacing="1">{view.toUpperCase()}</text>
    </svg>
  );
}

export function FatigueLegend() {
  return (
    <div className="flex items-center gap-2 label" style={{ letterSpacing: ".08em" }}>
      <span>0%</span>
      <span style={{ display: "flex", flex: 1, height: 6, borderRadius: 3, overflow: "hidden" }}>
        {[0, 20, 40, 60, 80, 100].map((v) => <i key={v} style={{ flex: 1, background: fatigueColor(v || 5) }} />)}
      </span>
      <span>100%</span>
    </div>
  );
}
