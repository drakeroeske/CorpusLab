import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Minus, Plus, X } from "lucide-react";

export function Sheet({ title, onClose, children, full, right, testId }: { title: ReactNode; onClose: () => void; children: ReactNode; full?: boolean; right?: ReactNode; testId?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" data-testid={testId}>
      <div className={`sheet ${full ? "full" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          {right}
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="button-close-sheet"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ options, value, onChange, className = "", testId }: { options: { v: T; l: ReactNode }[]; value: T | null | undefined; onChange: (v: T) => void; className?: string; testId?: string }) {
  return (
    <div className={`seg ${className}`} role="group" data-testid={testId}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={value === o.v ? "true" : "false"} onClick={() => onChange(o.v)} data-testid={testId ? `${testId}-${o.v}` : undefined}>{o.l}</button>
      ))}
    </div>
  );
}

/** Number text box that can be cleared while typing. Commits valid numbers as you type, restores on blur if left empty. */
export function NumInput({ value, onChange, min = -Infinity, max = Infinity, decimals = 2, integer = false, allowEmpty = false, className = "input mono", ...rest }:
  { value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; decimals?: number; integer?: boolean; allowEmpty?: boolean; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const show = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? "" : String(v));
  const [txt, setTxt] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(show(value)); }, [value]);
  const parse = (t: string) => { const n = integer ? parseInt(t, 10) : parseFloat(t.replace(",", ".")); return Number.isNaN(n) ? null : Math.round(n * 10 ** decimals) / 10 ** decimals; };
  return (
    <input {...rest} className={className} type="text" inputMode={integer ? "numeric" : "decimal"} value={txt}
      onFocus={(e) => { focused.current = true; e.target.select(); rest.onFocus?.(e); }}
      onChange={(e) => {
        const t = e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, "");
        setTxt(t);
        if (t === "") { if (allowEmpty) onChange(null); return; }
        const n = parse(t);
        if (n !== null && n >= min && n <= max) onChange(n);
      }}
      onBlur={(e) => {
        focused.current = false;
        const n = parse(txt);
        if (n === null) { if (allowEmpty && txt === "") { onChange(null); setTxt(""); } else setTxt(show(value)); }
        else { const c = Math.min(max, Math.max(min, n)); onChange(c); setTxt(show(c)); }
        rest.onBlur?.(e);
      }} />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, unit, testId, decimals = 1 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; testId?: string; decimals?: number }) {
  const f = (x: number) => Math.round(x * 10 ** decimals) / 10 ** decimals;
  return (
    <div className="stepper" data-testid={testId}>
      <button type="button" aria-label="Decrease" onClick={() => onChange(f(Math.max(min, value - step)))} data-testid={testId ? `${testId}-minus` : undefined}><Minus size={18} /></button>
      <div className="flex flex-col items-center justify-center min0">
        <NumInput className="" value={value} min={min} max={max} decimals={decimals} integer={decimals === 0} aria-label={unit ?? "value"}
          onChange={(v) => v !== null && onChange(v)} data-testid={testId ? `${testId}-input` : undefined} />
        {unit && <span className="unit -mt-1">{unit}</span>}
      </div>
      <button type="button" aria-label="Increase" onClick={() => onChange(f(Math.min(max, value + step)))} data-testid={testId ? `${testId}-plus` : undefined}><Plus size={18} /></button>
    </div>
  );
}

export function Ring({ value, max, size = 92, stroke = 7, color = "var(--lime)", children, over }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode; over?: boolean }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? "var(--orange)" : color} strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray .5s" }} />
        {Array.from({ length: 20 }).map((_, i) => {
          const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
          const r1 = size / 2 - stroke - 3, r2 = r1 - 3;
          return <line key={i} x1={size / 2 + Math.cos(a) * r1} y1={size / 2 + Math.sin(a) * r1} x2={size / 2 + Math.cos(a) * r2} y2={size / 2 + Math.sin(a) * r2} stroke="var(--border-strong)" strokeWidth="1" />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function Bar({ pct, color = "var(--lime)" }: { pct: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast" role="status" data-testid="toast">{msg}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2200); return () => clearTimeout(t); }, [msg]);
  return { msg, show: setMsg };
}

export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

/* ---------------- charts ---------------- */
export interface Series { points: { x: number; y: number }[]; color: string; dashed?: boolean; width?: number; dots?: boolean; area?: boolean }

export function LineChart({ series, height = 150, xLabels, yFmt = (v: number) => String(Math.round(v)), band, testId, yPad = 0.08, markers }: {
  series: Series[]; height?: number; xLabels?: { x: number; label: string }[]; yFmt?: (v: number) => string;
  band?: { y0: number; y1: number }; testId?: string; yPad?: number; markers?: { x: number; y: number; label?: string; color?: string }[];
}) {
  const W = 340, H = height, L = 34, Rr = 8, T = 10, B = 20;
  const all = series.flatMap((s) => s.points).concat(markers ?? []);
  if (!all.length) return <div className="empty" style={{ height }}>No data yet</div>;
  let ymin = Math.min(...all.map((p) => p.y)), ymax = Math.max(...all.map((p) => p.y));
  if (band) { ymin = Math.min(ymin, band.y0); ymax = Math.max(ymax, band.y1); }
  const span = ymax - ymin || Math.max(1, Math.abs(ymax) * 0.1);
  ymin -= span * yPad; ymax += span * yPad;
  const xmin = Math.min(...all.map((p) => p.x)), xmax = Math.max(...all.map((p) => p.x));
  const xs = (x: number) => L + ((x - xmin) / (xmax - xmin || 1)) * (W - L - Rr);
  const ys = (y: number) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((t) => ymin + (ymax - ymin) * t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }} data-testid={testId} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - Rr} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={L - 6} y={ys(t) + 3} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="JetBrains Mono">{yFmt(t)}</text>
        </g>
      ))}
      {band && <rect x={L} width={W - L - Rr} y={ys(band.y1)} height={Math.max(0, ys(band.y0) - ys(band.y1))} fill="var(--lime)" opacity="0.07" />}
      {series.map((s, i) => {
        if (!s.points.length) return null;
        const d = s.points.map((p, j) => `${j ? "L" : "M"}${xs(p.x).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
        return (
          <g key={i}>
            {s.area && <path d={`${d} L${xs(s.points[s.points.length - 1].x)},${H - B} L${xs(s.points[0].x)},${H - B} Z`} fill={s.color} opacity="0.08" />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.6} strokeDasharray={s.dashed ? "4 4" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {s.dots && s.points.map((p, j) => <circle key={j} cx={xs(p.x)} cy={ys(p.y)} r="2.2" fill={s.color} />)}
          </g>
        );
      })}
      {markers?.map((m, i) => (
        <g key={i}>
          <circle cx={xs(m.x)} cy={ys(m.y)} r="4" fill="var(--bg)" stroke={m.color ?? "var(--lime)"} strokeWidth="1.5" />
          {m.label && <text x={xs(m.x) - 6} y={ys(m.y) - 8} textAnchor="end" fontSize="9" fill={m.color ?? "var(--lime)"} fontFamily="JetBrains Mono">{m.label}</text>}
        </g>
      ))}
      {xLabels?.map((l, i) => <text key={i} x={xs(l.x)} y={H - 4} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} fontSize="9" fill="var(--faint)" fontFamily="JetBrains Mono">{l.label}</text>)}
    </svg>
  );
}

export function Spark({ values, width = 72, height = 22, color = "var(--lime)" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), sp = max - min || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / sp) * (height - 4)).toFixed(1)}`).join(" ");
  return <svg width={width} height={height} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty text-sm">{children}</div>;
}

export function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="RXS" data-testid="wordmark">
      <span style={{ width: size * 0.62, height: size * 0.62, background: "var(--brown)", borderRadius: 2, display: "inline-block" }} />
      <span style={{ fontWeight: 700, fontSize: size, letterSpacing: "0.02em" }}>RXS</span>
    </span>
  );
}
