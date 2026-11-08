// Riso Lab building blocks: Surface, Grain, PageHeader, Tag, NoteLine, FigCaption, LabTable, Rings, diagrams.
import { useEffect, useId, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { dateKey } from "@/lib/engine";

export type SurfaceStyle = "lab" | "riso";

/** Switches ink/page/display font for everything inside: lab = black on paper, riso = cobalt on bone. */
export function Surface({ style, children, className = "" }: { style: SurfaceStyle; children: ReactNode; className?: string }) {
  return <div className={`surface-${style} ${className}`}>{children}</div>;
}

export const pad3 = (n: number) => String(Math.max(0, n)).padStart(3, "0");
export const shortDate = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}.${d.slice(2, 4)}`;

// ---------- grain ----------
export type GrainSetting = "off" | "subtle" | "full";
const GRAIN_KEY = "rxs.grain";
export function getGrain(): GrainSetting {
  try { const v = localStorage.getItem(GRAIN_KEY); if (v === "off" || v === "subtle" || v === "full") return v; } catch { /* ignore */ }
  const mq = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
  return mq("(prefers-contrast: more)") || mq("(prefers-reduced-transparency: reduce)") ? "off" : "subtle";
}
export function setGrain(v: GrainSetting) {
  try { localStorage.setItem(GRAIN_KEY, v); } catch { /* ignore */ }
  window.dispatchEvent(new Event("rxs:grain"));
}
export function useGrain(): GrainSetting {
  const [g, setG] = useState<GrainSetting>(getGrain);
  useEffect(() => { const f = () => setG(getGrain()); window.addEventListener("rxs:grain", f); return () => window.removeEventListener("rxs:grain", f); }, []);
  return g;
}
/** Photocopy grain over the whole app. Never heavy: readability first. */
export function GrainOverlay() {
  const id = useId().replace(/:/g, "");
  const g = useGrain();
  if (g === "off") return null;
  return (
    <svg aria-hidden className="grain" style={{ opacity: g === "full" ? 0.38 : 0.2 }} width="100%" height="100%">
      <filter id={`g${id}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#g${id})`} />
    </svg>
  );
}

// ---------- tags & labels ----------
/** Bracket tag: [PR], [DELOAD], [HOLD]. `signal` puts it on pink (PRs / social only). */
export function Tag({ children, signal, className = "", testId }: { children: ReactNode; signal?: boolean; className?: string; testId?: string }) {
  return <span className={`chip ${signal ? "chip-signal" : ""} ${className}`} data-testid={testId}>{children}</span>;
}

export function CornerLabels({ left, center, right }: { left: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div className="corner">
      <span>{left}</span>
      {center !== undefined && <span className="text-center">{center}</span>}
      <span className="text-right">{right}</span>
    </div>
  );
}

/** Real header metadata: completed session count + date, and today's program day. */
export function useHeaderMeta() {
  const { state } = useStore();
  const today = dateKey();
  const count = state.sessions.filter((s) => s.end).length;
  const day = state.program ? state.program.days.find((d) => d.weekdays?.includes(new Date(today + "T12:00:00").getDay())) : null;
  const live = state.activeSession ? `${state.activeSession.dayName.toUpperCase()} [LIVE]` : null;
  return { center: `SESSION ${pad3(count)} · ${shortDate(today)}`, status: live ?? (day ? `${day.name.toUpperCase()} [TODAY]` : "REST DAY") };
}

/** Screen header: corner metadata, huge display title with a full stop, optional sub line. */
export function PageHeader({ title, section = "ENGINE", brand = "RXS", status, center, sub, right, back, testId }: {
  title: string; section?: string; brand?: string; status?: string; center?: string; sub?: ReactNode; right?: ReactNode; back?: () => void; testId?: string;
}) {
  const t = title.toUpperCase().replace(/[.!?]$/, "");
  return (
    <div className="pagehead" data-testid={testId}>
      <CornerLabels left={`${brand} // ${section}`} center={center} right={status} />
      {back && <button className="btn btn-sm mt-3" onClick={back} data-testid="button-back">← Back</button>}
      <div className="flex items-end justify-between gap-3">
        <h1 className={`display min0 ${t.length > 12 ? "xlong" : t.length > (right ? 5 : 7) ? "long" : ""}`}>{t}.</h1>
        {right && <div className="shrink-0 pb-2">{right}</div>}
      </div>
      {sub && <div className="mt-2 mono text-xs uppercase">{sub}</div>}
    </div>
  );
}

/** Header that fills in session/date/status from the store. */
export function EngineHeader(p: Omit<Parameters<typeof PageHeader>[0], "center" | "status"> & { status?: string }) {
  const m = useHeaderMeta();
  return <PageHeader {...p} center={m.center} status={p.status ?? m.status} />;
}

export function FigCaption({ n, title, stat }: { n: number; title: string; stat?: ReactNode }) {
  return (
    <div className="fig">
      <span>FIG. {String(n).padStart(2, "0")} — {title}</span>
      {stat !== undefined && <span className="text-right">{stat}</span>}
    </div>
  );
}

/** [NOTE] line: engine reasoning in one mono line. */
export function NoteLine({ children, tag = "NOTE", testId }: { children: ReactNode; tag?: string; testId?: string }) {
  return <p className="note" data-testid={testId}><b>[{tag}]</b> {children}</p>;
}

// ---------- lab table ----------
export interface LabRow { key: string; cells: ReactNode[]; onClick?: () => void; testId?: string }
/** 3px top rule, mono column headers, dashed row dividers. */
export function LabTable({ head, rows, align = [], bold = [], className = "" }: { head: string[]; rows: LabRow[]; align?: ("l" | "r" | "c")[]; bold?: number[]; className?: string }) {
  const cls = (i: number) => `${align[i] === "r" ? "r" : align[i] === "c" ? "c" : ""} ${bold.includes(i) ? "font-bold" : ""}`;
  return (
    <table className={`labtable ${className}`}>
      <thead><tr>{head.map((h, i) => <th key={i} className={cls(i)}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} onClick={r.onClick} data-click={r.onClick ? "" : undefined} data-testid={r.testId} style={r.onClick ? { cursor: "pointer" } : undefined}>
            {r.cells.map((c, i) => <td key={i} className={cls(i)}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- diagrams (all draw in currentColor) ----------
/** Concentric rings that fill by value (0–100): one solid ring per 20 points, the rest dashed. Crosshair behind. */
export function Rings({ value, size = 140, label, children }: { value: number | null; size?: number; label?: string; children?: ReactNode }) {
  const n = 5;
  const filled = value == null ? 0 : Math.round((Math.max(0, Math.min(100, value)) / 100) * n);
  const c = 50;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <line x1="0" y1={c} x2="100" y2={c} stroke="currentColor" strokeWidth="0.4" />
        <line x1={c} y1="0" x2={c} y2="100" stroke="currentColor" strokeWidth="0.4" />
        {value != null && <rect x={c - 13} y={c - 13} width="26" height="26" fill="var(--signal)" />}
        {Array.from({ length: n }, (_, i) => {
          const r = 14 + i * 8.5; const on = i < filled;
          return <circle key={i} cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={on ? 3 : 0.6} strokeDasharray={on ? undefined : "1.5 2"} />;
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

/** Crosshair bars with corner brackets (PR cards, scanner). */
export function Crosshair({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 75" preserveAspectRatio="none" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke">
        <path d="M6 18V6h12M82 6h12v12M94 57v12H82M18 69H6V57" strokeWidth="3" />
        <line x1="50" y1="26" x2="50" y2="49" /><line x1="34" y1="37.5" x2="66" y2="37.5" />
        <line x1="12" y1="37.5" x2="28" y2="37.5" strokeDasharray="2 2" /><line x1="72" y1="37.5" x2="88" y2="37.5" strokeDasharray="2 2" />
      </g>
    </svg>
  );
}

/** Orbit ellipses around a hub (loading / empty states). */
export function Orbit({ size = 72, spin }: { size?: number; spin?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={spin ? "animate-spin [animation-duration:6s]" : ""}>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <ellipse cx="50" cy="50" rx="44" ry="16" /><ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)" />
        <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)" strokeDasharray="2 2" />
      </g>
      <rect x="45" y="45" width="10" height="10" fill="currentColor" /><rect x="90" y="47" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

/** Standing silhouette in line art, optional chest crosshair. */
export function Silhouette({ height = 160, marks }: { height?: number; marks?: boolean }) {
  return (
    <svg viewBox="0 0 100 200" height={height} width={height / 2} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter">
        <circle cx="50" cy="20" r="12" />
        <path d="M50 32v8M30 44h40l6 52-8 2-4-40M30 44l-6 52 8 2 4-40M36 58v40l-4 90h12l6-70 6 70h12l-4-90V58" />
      </g>
      {marks && <g stroke="currentColor" strokeWidth="1"><line x1="8" y1="70" x2="92" y2="70" strokeDasharray="2 2" /><line x1="8" y1="120" x2="92" y2="120" strokeDasharray="2 2" /><circle cx="50" cy="70" r="6" fill="none" /></g>}
    </svg>
  );
}

/** Geometry of the connected-node mark in a 100×100 box: nodes on an open arc, a hub, and links. */
export function logoGeometry() {
  const nodes = Array.from({ length: 7 }, (_, i) => { const a = ((50 + (i * 260) / 6) * Math.PI) / 180; return [50 + 36 * Math.cos(a), 50 - 36 * Math.sin(a)] as [number, number]; });
  const hub: [number, number] = [50, 50];
  const links: [[number, number], [number, number]][] = [];
  for (let i = 0; i < nodes.length - 1; i++) links.push([nodes[i], nodes[i + 1]]);
  for (const i of [0, 2, 4, 6]) links.push([hub, nodes[i]]);
  return { nodes, hub, links };
}

/** Connected-node logo mark. Ink follows the surface. */
export function Logo({ size = 40 }: { size?: number }) {
  const g = logoGeometry();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="square">{g.links.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}</g>
      <g fill="currentColor">{g.nodes.map(([x, y], i) => <rect key={i} x={x - 6} y={y - 6} width="12" height="12" />)}<rect x={g.hub[0] - 9} y={g.hub[1] - 9} width="18" height="18" /></g>
    </svg>
  );
}

/** Streak cells: filled = trained, dashed = planned but missed, blank = rest. */
export function StreakCells({ log, testId }: { log: { date: string; planned: boolean; done: boolean }[]; testId?: string }) {
  return (
    <div className="streak" aria-label={`${log.filter((d) => d.done).length} sessions in ${log.length} days`} data-testid={testId}>
      {log.map((d) => <i key={d.date} className={d.done ? "done" : d.planned ? "missed" : "rest"} />)}
    </div>
  );
}
