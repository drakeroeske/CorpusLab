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

/** Hatch density by fatigue: blank → sparse → dense → solid ink. */
export function fatigueLevel(v: number): 0 | 1 | 2 | 3 | 4 {
  return v < 4 ? 0 : v < 25 ? 1 : v < 50 ? 2 : v < 70 ? 3 : 4;
}
export function fatigueColor(v: number) {
  const l = fatigueLevel(v);
  return l === 0 ? "transparent" : l === 4 ? "currentColor" : `url(#hatch${l})`;
}
function HatchDefs() {
  return (
    <defs>
      {[[1, 5], [2, 3], [3, 1.8]].map(([n, gap]) => (
        <pattern key={n} id={`hatch${n}`} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={gap} stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      ))}
    </defs>
  );
}

export function BodyMap({ values, view, onTap, selected, testId, height = 280 }: { values: Partial<Record<Muscle, number>>; view: "front" | "back"; onTap?: (m: Muscle) => void; selected?: Muscle | null; testId?: string; height?: number }) {
  const parts = view === "front" ? FRONT : BACK;
  return (
    <svg viewBox="0 0 120 244" height={height} style={{ display: "block", margin: "0 auto", maxWidth: "100%", color: "var(--ink)" }} data-testid={testId} role="img" aria-label={`${view} body diagram`}>
      <HatchDefs />
      <line x1="60" y1="0" x2="60" y2="244" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1.5 1.5" />
      <polygon points={pts(outline)} fill="none" stroke="currentColor" strokeWidth="1" />
      <path d={SIL} fill="none" stroke="currentColor" strokeWidth="1" />
      {parts.map(({ m, polys }) =>
        polys.flatMap((p, i) => [p, mir(p)].map((pp, j) => (
          <polygon key={`${m}-${i}-${j}`} points={pts(pp)} className="muscle"
            fill={fatigueColor(values[m] ?? 0)} stroke="currentColor" strokeWidth={selected === m ? 1.6 : 0.6}
            onClick={() => onTap?.(m)} data-testid={`muscle-${view}-${m}${j ? "-r" : ""}`}>
            <title>{MUSCLE_LABEL[m]}: {Math.round(values[m] ?? 0)}%</title>
          </polygon>
        ))),
      )}
      <text x="60" y="242" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" fontFamily="Space Mono" letterSpacing="1">{view.toUpperCase()}</text>
    </svg>
  );
}

export function FatigueLegend() {
  return (
    <div className="flex items-center gap-2 label">
      <span>0% recovered</span>
      <svg style={{ flex: 1, height: 10, color: "var(--ink)" }} preserveAspectRatio="none" viewBox="0 0 100 10">
        <HatchDefs />
        {[0, 1, 2, 3, 4].map((l) => <rect key={l} x={l * 20} y="0" width="20" height="10" fill={l === 0 ? "transparent" : l === 4 ? "currentColor" : `url(#hatch${l})`} stroke="currentColor" strokeWidth="0.6" />)}
      </svg>
      <span>100% fatigued</span>
    </div>
  );
}
