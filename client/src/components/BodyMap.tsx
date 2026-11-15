import type { Muscle } from "@/lib/types";
import { MUSCLE_LABEL } from "@/lib/exercises";

type Poly = [number, number][];
const mir = (p: Poly): Poly => p.map(([x, y]) => [120 - x, y]);
const pts = (p: Poly) => p.map(([x, y]) => `${x},${y}`).join(" ");

// Left half of the figure (x < 60, outer edge = small x); each polygon is mirrored for the right side.
const FRONT: { m: Muscle; polys: Poly[] }[] = [
  { m: "side_delts", polys: [[[30, 40], [35.5, 38.6], [36, 57], [28, 55], [27, 46]]] },
  { m: "front_delts", polys: [[[35.5, 38.6], [41, 37], [43, 47], [36, 57]]] },
  { m: "chest_upper", polys: [[[43, 41], [59, 41], [59, 49], [41, 49]]] },
  { m: "chest_mid", polys: [[[41, 49], [59, 49], [59, 60], [50, 63], [42, 59]]] },
  { m: "biceps_long", polys: [[[27, 58], [31, 58.5], [30, 74], [26, 78], [24, 80], [24, 68]]] },
  { m: "biceps_short", polys: [[[31, 58.5], [35, 59], [34, 76], [30, 74]]] },
  { m: "brachialis", polys: [[[24, 80], [26, 78], [30, 74], [34, 76], [30, 84], [24, 82]]] },
  { m: "forearms", polys: [[[23, 86], [30, 87], [28, 104], [24, 118], [18, 117], [18, 100]]] },
  { m: "obliques", polys: [[[42, 62], [50, 65], [50, 80], [51, 98], [53, 107], [48, 104], [42, 96], [40, 80]]] },
  { m: "abs", polys: [[[50, 65], [59, 64], [59, 104], [53, 107], [51, 98], [50, 80]]] },
  { m: "hip_flexors", polys: [[[43, 106], [51, 109], [50, 115], [46, 116], [42, 114]]] },
  { m: "vasti", polys: [
    [[42, 114], [46, 116], [48, 150], [50, 168], [46, 170], [41, 148], [40, 128]],
    [[53, 116], [56, 117], [56, 146], [54, 170], [50, 168], [52, 148]],
  ] },
  { m: "rectus_femoris", polys: [[[46, 116], [53, 116], [52, 148], [50, 168], [48, 150]]] },
  { m: "adductors", polys: [[[56, 117], [60, 120], [60, 152], [56, 146]]] },
  { m: "gastrocnemius", polys: [[[43, 180], [53, 180], [54, 200], [42, 202]]] },
  { m: "soleus", polys: [[[42, 202], [54, 200], [51, 226], [46, 226]]] },
];
const BACK: { m: Muscle; polys: Poly[] }[] = [
  { m: "traps_upper", polys: [[[52, 32], [60, 34], [60, 46], [48, 44], [42, 42]]] },
  { m: "mid_back", polys: [[[42, 42], [48, 44], [60, 46], [60, 72], [52, 66], [42, 50]]] },
  { m: "side_delts", polys: [[[29, 41], [34.5, 39.5], [35, 56], [28, 54]]] },
  { m: "rear_delts", polys: [[[34.5, 39.5], [40, 38], [41, 48], [35, 56]]] },
  { m: "triceps_lateral", polys: [[[27, 58], [31, 58.5], [30, 74], [31, 85], [24, 82], [24, 68]]] },
  { m: "triceps_long", polys: [[[31, 58.5], [35, 59], [35, 76], [31, 85], [30, 74]]] },
  { m: "forearms", polys: [[[23, 86], [30, 87], [28, 104], [24, 118], [18, 117], [18, 100]]] },
  { m: "lats", polys: [[[41, 53], [51, 67], [59, 76], [58, 92], [48, 96], [41, 80], [38, 64]]] },
  { m: "lower_back", polys: [[[50, 94], [59, 92], [59, 108], [50, 108], [47, 101]]] },
  { m: "glute_med", polys: [[[42, 108], [52, 108.6], [47, 116], [40, 118]]] },
  { m: "glute_max", polys: [[[52, 108.6], [59, 109], [59, 128], [52, 134], [42, 130], [40, 118], [47, 116]]] },
  { m: "hamstrings", polys: [[[42, 136], [55, 136], [55, 154], [54, 172], [46, 172], [42, 154]]] },
  { m: "adductors", polys: [[[55, 136], [60, 136], [60, 154], [55, 154]]] },
  { m: "gastrocnemius", polys: [[[42, 180], [54, 180], [55, 198], [48, 206], [41, 200]]] },
  { m: "soleus", polys: [[[41, 200], [48, 206], [55, 198], [51, 224], [46, 224]]] },
];

const SIL = "M60 7 a11 12 0 1 1 -0.01 0 Z M50 30 h20 v6 h-20 Z";
const OUT: Poly = [[52, 31], [42, 36], [28, 38], [22, 48], [22, 70], [16, 98], [14, 120], [20, 124], [26, 110], [33, 88], [38, 70], [40, 96], [38, 112], [38, 150], [41, 176], [40, 204], [43, 236], [55, 236], [56, 204], [58, 176], [60, 156]];
const outline = [...OUT, ...mir([...OUT].reverse())];

/** Heat scale: 0 = rested (dark blue), then 1 yellow → 5 bright red. Input is 0–100 (fatigue %) or soreness × 20. */
export const HEAT = ["#1B2A6B", "#F7D417", "#F9AE1B", "#F6861F", "#EF5323", "#E3132B"] as const;
export const HEAT_LABEL = ["Rested", "Light", "Mild", "Moderate", "Heavy", "Fried"] as const;
export function heatLevel(v: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!(v >= 4)) return 0;
  return Math.min(5, Math.max(1, Math.ceil(v / 20))) as 1 | 2 | 3 | 4 | 5;
}
export function heatColor(v: number) { return HEAT[heatLevel(v)]; }
/** @deprecated use heatLevel */
export const fatigueLevel = heatLevel;
export const fatigueColor = heatColor;

export function BodyMap({ values, view, onTap, selected, testId, height = 280 }: { values: Partial<Record<Muscle, number>>; view: "front" | "back"; onTap?: (m: Muscle) => void; selected?: Muscle | null; testId?: string; height?: number }) {
  const parts = view === "front" ? FRONT : BACK;
  return (
    <svg viewBox="0 0 120 244" height={height} style={{ display: "block", margin: "0 auto", maxWidth: "100%", color: "var(--ink)" }} data-testid={testId} role="img" aria-label={`${view} body diagram`}>
      <line x1="60" y1="0" x2="60" y2="244" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1.5 1.5" />
      <polygon points={pts(outline)} fill="none" stroke="currentColor" strokeWidth="1" />
      <path d={SIL} fill="none" stroke="currentColor" strokeWidth="1" />
      {parts.map(({ m, polys }) =>
        polys.flatMap((p, i) => [p, mir(p)].map((pp, j) => (
          <polygon key={`${m}-${i}-${j}`} points={pts(pp)} className="muscle"
            fill={heatColor(values[m] ?? 0)} stroke={selected === m ? "#ECE8DF" : "currentColor"} strokeWidth={selected === m ? 2 : 0.6} style={selected === m ? { paintOrder: "stroke", filter: "drop-shadow(0 0 0.6px var(--ink))" } : undefined}
            onClick={() => onTap?.(m)} data-testid={`muscle-${view}-${m}${j ? "-r" : ""}`}>
            <title>{MUSCLE_LABEL[m]}: {Math.round(values[m] ?? 0)}%</title>
          </polygon>
        ))),
      )}
      <text x="60" y="242" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" fontFamily="Space Grotesk" letterSpacing="1">{view.toUpperCase()}</text>
    </svg>
  );
}

export function FatigueLegend({ left = "Rested", right = "Fatigued" }: { left?: string; right?: string }) {
  return (
    <div className="flex items-center gap-2 label" data-testid="legend-heat">
      <span>{left}</span>
      <svg style={{ flex: 1, height: 12, color: "var(--ink)" }} preserveAspectRatio="none" viewBox="0 0 120 12">
        {HEAT.map((c, l) => <rect key={l} x={l * 20} y="0" width="20" height="12" fill={c} stroke="currentColor" strokeWidth="0.6"><title>{HEAT_LABEL[l]}</title></rect>)}
      </svg>
      <span>{right}</span>
    </div>
  );
}
