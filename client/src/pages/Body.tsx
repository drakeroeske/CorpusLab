import { useMemo, useRef, useState } from "react";
import { Camera, Lock, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { useToday } from "@/lib/derived";
import { BodyMap, FatigueLegend } from "@/components/BodyMap";
import { Bar, Empty, LineChart, Seg, Sheet } from "@/components/ui";
import { EngineHeader, FigCaption } from "@/components/riso";
import {
  addDays, avgSleep, bodyComp, bodyWeightSeries, daysBetween, e1rmSeries, fmtDate, mean, projection, proteinHitRate, r1,
  strengthTrendPct, weeklySets, whatIfMultiplier, VOLUME_RANGE,
} from "@/lib/engine";
import { EX, MAIN_LIFTS, MUSCLE_LABEL, MUSCLES, newId } from "@/lib/exercises";
import type { Measurement, Muscle } from "@/lib/types";

export default function Body() {
  const [sub, setSub] = useState<"fatigue" | "trends" | "vault">("fatigue");
  return (
    <div>
      <EngineHeader title="Body" section="BODY" />
      <nav className="subtabs" aria-label="Body sections">
        {([["fatigue", "Fatigue & volume"], ["trends", "Trends"], ["vault", "Private vault"]] as const).map(([id, l]) => (
          <button key={id} aria-pressed={sub === id ? "true" : "false"} onClick={() => setSub(id)} data-testid={`subtab-body-${id}`}>{l}</button>
        ))}
      </nav>
      <div className="screen">
        {sub === "fatigue" && <FatigueView />}
        {sub === "trends" && <TrendsView />}
        {sub === "vault" && <Vault />}
      </div>
    </div>
  );
}

function FatigueView() {
  const { state } = useStore();
  const t = useToday();
  const [sel, setSel] = useState<Muscle | null>(null);
  const sets = useMemo(() => weeklySets(state.sessions, addDays(t.today, -6), t.today), [state.sessions, t.today]);
  const top = [...MUSCLES].sort((a, b) => (t.fatigue[b] ?? 0) - (t.fatigue[a] ?? 0)).slice(0, 3);
  return (
    <div>
      <div className="card">
        <FigCaption n={1} title="Muscle fatigue · now" stat="T½ 48H" />
        <div className="grid grid-cols-2 gap-1">
          <BodyMap values={t.fatigue} view="front" onTap={setSel} selected={sel} testId="bodymap-front" height={260} />
          <BodyMap values={t.fatigue} view="back" onTap={setSel} selected={sel} testId="bodymap-back" height={260} />
        </div>
        <div className="mt-2"><FatigueLegend /></div>
        {sel ? (
          <div className="card-flat mt-3" data-testid="text-muscle-detail">
            <div className="flex justify-between"><span className="font-semibold">{MUSCLE_LABEL[sel]}</span><span className="mono">{t.fatigue[sel] ?? 0}%</span></div>
            <p className="text-xs muted mt-1">
              {r1(sets[sel])} hard sets in the last 7 days.{" "}
              {(t.fatigue[sel] ?? 0) > 60 ? "Above 60% — expect lower performance; train it lighter or wait a day." : (t.fatigue[sel] ?? 0) > 30 ? "Partially recovered." : "Recovered and ready to train."}
            </p>
          </div>
        ) : (
          <p className="text-xs muted mt-3">Tap a muscle for detail. Most fatigued: {top.map((m) => `${MUSCLE_LABEL[m]} ${t.fatigue[m] ?? 0}%`).join(" · ")}</p>
        )}
      </div>

      <div className="section-title"><h2>Weekly sets per muscle</h2><span className="label">target {VOLUME_RANGE.min}–{VOLUME_RANGE.max}</span></div>
      <div className="card" data-testid="card-weekly-sets">
        {MUSCLES.map((m) => {
          const v = sets[m];
          const low = v < VOLUME_RANGE.min, high = v > VOLUME_RANGE.max;
          return (
            <div key={m} className="grid items-center gap-3" style={{ gridTemplateColumns: "88px 1fr 36px 44px", minHeight: 28 }}>
              <span className="text-[13px]">{MUSCLE_LABEL[m]}</span>
              <div style={{ position: "relative" }}>
                <Bar pct={(v / 24) * 100} color={low ? "var(--orange)" : high ? "var(--blue)" : "var(--lime)"} />
                <i style={{ position: "absolute", top: -3, bottom: -3, left: `${(10 / 24) * 100}%`, width: 1, background: "var(--muted)" }} />
                <i style={{ position: "absolute", top: -3, bottom: -3, left: `${(20 / 24) * 100}%`, width: 1, background: "var(--muted)" }} />
              </div>
              <span className="mono text-xs text-right">{r1(v)}</span>
              <span className={`label text-right ${low ? "orange" : high ? "blue" : "lime"}`}>{low ? "low" : high ? "high" : "ok"}</span>
            </div>
          );
        })}
        <p className="text-[11px] faint mt-2">Primary muscle = 1 set, secondary = 0.5. Last 7 days.</p>
      </div>
    </div>
  );
}

function TrendsView() {
  const { state, profile, targets } = useStore();
  const t = useToday();
  const u = profile.units;
  const bw = bodyWeightSeries(state).filter((x) => daysBetween(x.date, t.today) <= 56);
  const avg7 = bw.map((x) => {
    const win = bw.filter((y) => y.date <= x.date && daysBetween(y.date, x.date) < 7);
    return { x: daysBetween(t.today, x.date), y: mean(win.map((y) => y.w)) };
  });
  const comp = bodyComp(bodyWeightSeries(state), strengthTrendPct(state.sessions, t.today), t.today);
  const [sleep8, setSleep8] = useState(false);
  const [protein, setProtein] = useState(false);
  const ctx = { avgSleep: avgSleep(state, t.today, 14) || 7, proteinHitRate: proteinHitRate(state, targets.protein, t.today, 14) };
  const mult = whatIfMultiplier({ sleep8, proteinDaily: protein }, ctx);
  const lifts = MAIN_LIFTS.filter((id) => e1rmSeries(state.sessions, id).length >= 3);
  const [lift, setLift] = useState(lifts[0] ?? "bench_press");
  const ser = e1rmSeries(state.sessions, lift).filter((x) => daysBetween(x.date, t.today) <= 56);
  const base = projection(e1rmSeries(state.sessions, lift), t.today, u, 1);
  const wi = projection(e1rmSeries(state.sessions, lift), t.today, u, mult);
  const toneColor = { good: "var(--lime)", warn: "var(--orange)", info: "var(--blue)" } as const;
  const last = bw[bw.length - 1];

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}><h2>Body weight</h2><span className="mono text-sm">{last ? `${r1(avg7[avg7.length - 1].y)} ${u}` : "—"} <span className="label">7d avg</span></span></div>
      <div className="card">
        {bw.length < 2 ? <Empty>Log body weight in your daily check-in to see the trend.</Empty> : (
          <LineChart testId="chart-bodyweight" height={160} yFmt={(v) => r1(v).toFixed(1)}
            series={[
              { points: bw.map((x) => ({ x: daysBetween(t.today, x.date), y: x.w })), color: "var(--faint)", dots: true, width: 1 },
              { points: avg7, color: "var(--lime)", width: 2 },
            ]}
            xLabels={[-56, -42, -28, -14, 0].map((x) => ({ x, label: x === 0 ? "today" : `${-x / 7}w` }))} />
        )}
        <div className="flex gap-4 mt-2 label"><span><i style={{ display: "inline-block", width: 10, height: 2, background: "var(--lime)", verticalAlign: "middle" }} /> 7-day avg</span><span><i style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: "var(--faint)", verticalAlign: "middle" }} /> daily</span></div>
      </div>

      <div className="section-title"><h2>Body composition</h2><span className="label">14-day trend</span></div>
      <div className="card" data-testid="card-bodycomp">
        {comp ? (
          <>
            <div className="font-semibold text-[17px]" style={{ color: toneColor[comp.tone] }} data-testid="text-bodycomp">{comp.label}</div>
            <div className="flex gap-4 mt-2 mono text-sm">
              <span>BW {comp.weightRatePct >= 0 ? "+" : ""}{comp.weightRatePct.toFixed(2)}%/wk</span>
              <span>Strength {comp.strengthPct >= 0 ? "+" : ""}{r1(comp.strengthPct)}%</span>
            </div>
            <p className="text-sm muted mt-2">{comp.advice}</p>
            <p className="text-[11px] faint mt-2">Inferred from weight and e1RM trends, not a body scan.</p>
          </>
        ) : <p className="text-sm muted">Needs 5+ weigh-ins and some training in the last 14 days.</p>}
      </div>

      <div className="section-title"><h2>Projections</h2><span className="chip chip-blue">estimate</span></div>
      <div className="card" data-testid="card-projection">
        {lifts.length === 0 ? <p className="text-sm muted">Log 3+ sessions of a main lift to project it.</p> : (
          <>
            <select className="select" value={lift} onChange={(e) => setLift(e.target.value)} data-testid="select-projection-lift">
              {lifts.map((id) => <option key={id} value={id}>{EX[id].name}</option>)}
            </select>
            {ser.length >= 2 && (
              <div className="mt-3">
                <LineChart height={130} testId="chart-e1rm"
                  series={[
                    { points: ser.map((x) => ({ x: daysBetween(t.today, x.date), y: x.e1rm })), color: "var(--lime)", dots: true, width: 2 },
                    ...(wi && wi.by ? [{ points: [{ x: 0, y: wi.fitNow }, { x: daysBetween(t.today, wi.by), y: wi.target }], color: "var(--blue)", dashed: true, width: 1.5 }] : []),
                  ]}
                  xLabels={[-42, -21, 0].map((x) => ({ x, label: x === 0 ? "today" : `${-x / 7}w` }))} />
              </div>
            )}
            <div className="mt-3" data-testid="text-projection">
              {base ? (
                <>
                  <div className="text-[15px]">At this rate: <span className="mono lime">{base.target} {u}</span> {EX[lift].name.toLowerCase()} {base.by ? <>by <span className="mono">{fmtDate(base.by, { month: "short", day: "numeric", year: "numeric" })}</span></> : <span className="orange">— not trending up</span>}</div>
                  <div className="mono text-xs muted mt-1">current e1RM {Math.round(base.current)} · {base.slopePerWeek >= 0 ? "+" : ""}{r1(base.slopePerWeek)} {u}/wk · fit r² {base.r2.toFixed(2)}</div>
                </>
              ) : <span className="text-sm muted">Not enough data in the last 6 weeks.</span>}
            </div>
            <div className="card-flat mt-3">
              <div className="label mb-2">What if…</div>
              <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                <span className="text-sm">Sleep 8h nightly <span className="mono text-xs muted">(now {r1(ctx.avgSleep)}h)</span></span>
                <input type="checkbox" className="toggle" checked={sleep8} onChange={(e) => setSleep8(e.target.checked)} data-testid="toggle-whatif-sleep" />
              </label>
              <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                <span className="text-sm">Hit protein daily <span className="mono text-xs muted">(now {Math.round(ctx.proteinHitRate * 100)}%)</span></span>
                <input type="checkbox" className="toggle" checked={protein} onChange={(e) => setProtein(e.target.checked)} data-testid="toggle-whatif-protein" />
              </label>
              <div className="rowline" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="text-sm">Rate multiplier</span><span className="mono">×{mult.toFixed(1)}</span>
              </div>
              {wi && (sleep8 || protein) && (
                <p className="text-sm mt-2" data-testid="text-whatif">
                  Estimate: <span className="mono blue">{wi.target} {u}</span> {wi.by ? <>by <span className="mono">{fmtDate(wi.by, { month: "short", day: "numeric" })}</span></> : "— not trending up"}
                  {base?.by && wi.by ? <span className="muted"> ({daysBetween(wi.by, base.by)} days sooner)</span> : null}
                </p>
              )}
              <p className="text-[11px] faint mt-2">Assumes +10% progression rate per factor. Illustrative estimate, not a prediction.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function resizeImage(file: File, max = 600): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = rej;
      img.src = r.result as string;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function Vault() {
  const { state, set, profile } = useStore();
  const ui = useUI();
  const t = useToday();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("Front");
  const [view, setView] = useState<string | null>(null);
  const lenU = profile.units === "lb" ? "in" : "cm";
  const latest = [...state.measurements].sort((a, b) => (a.date < b.date ? 1 : -1));
  const [m, setM] = useState<Measurement>({ date: t.today, waist: latest[0]?.waist ?? null, chest: latest[0]?.chest ?? null, arms: latest[0]?.arms ?? null, thighs: latest[0]?.thighs ?? null });
  const fields = ["waist", "chest", "arms", "thighs"] as const;

  const onFile = async (f?: File | null) => {
    if (!f) return;
    try {
      const dataUrl = await resizeImage(f);
      set((s) => ({ ...s, photos: [...s.photos, { id: newId("ph"), date: t.today, dataUrl, label }] }));
      ui.toast("Photo saved on this device");
    } catch { ui.toast("Couldn't read that image"); }
  };
  const photo = state.photos.find((p) => p.id === view);

  return (
    <div>
      <div className="card-flat flex gap-3 items-start" data-testid="text-vault-privacy">
        <Lock size={16} className="lime" style={{ flexShrink: 0, marginTop: 2 }} />
        <p className="text-xs muted">Photos and measurements stay on this device. They are never posted to Spotters or shared with a coach unless you export them yourself.</p>
      </div>

      <div className="section-title"><h2>Progress photos</h2><span className="label">{state.photos.length}</span></div>
      <div className="card">
        <Seg options={["Front", "Side", "Back"].map((v) => ({ v, l: v }))} value={label} onChange={setLabel} testId="seg-photo-label" />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-photo" />
        <button className="btn btn-block mt-3" onClick={() => fileRef.current?.click()} data-testid="button-add-photo"><Camera size={16} /> Add {label.toLowerCase()} photo</button>
        {state.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[...state.photos].reverse().map((p) => (
              <button key={p.id} onClick={() => setView(p.id)} style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", borderRadius: 6, border: "1px solid var(--border)" }} data-testid={`img-photo-${p.id}`}>
                <img src={p.dataUrl} alt={`${p.label} progress photo ${p.date}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <span className="mono" style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, background: "rgba(10,12,14,.75)", color: "#EEF0F2", padding: "1px 4px", borderRadius: 3 }}>{fmtDate(p.date)}</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs muted mt-3">Same light, same spot, every 2–4 weeks works best.</p>}
      </div>

      <div className="section-title"><h2>Measurements</h2><span className="label">{lenU}</span></div>
      <div className="card">
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <label key={f} className="block">
              <span className="label">{f}</span>
              <input className="input mono mt-1" type="number" inputMode="decimal" step="0.1" value={m[f] ?? ""} onChange={(e) => setM({ ...m, [f]: e.target.value === "" ? null : Number(e.target.value) })} data-testid={`input-measure-${f}`} />
            </label>
          ))}
        </div>
        <button className="btn btn-primary btn-block mt-3" onClick={() => {
          set((s) => ({ ...s, measurements: [...s.measurements.filter((x) => x.date !== t.today), { ...m, date: t.today }] }));
          ui.toast("Measurements saved");
        }} data-testid="button-save-measurements">Save for today</button>
        {latest.length > 0 && (
          <div className="mt-3" style={{ overflowX: "auto" }}>
            <table className="w-full mono text-xs" data-testid="table-measurements">
              <thead><tr className="label">{["date", ...fields].map((h) => <th key={h} className="text-left py-1 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {latest.slice(0, 8).map((x) => (
                  <tr key={x.date} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-2">{fmtDate(x.date)}</td>
                    {fields.map((f) => <td key={f}>{x[f] ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {photo && (
        <Sheet title={`${photo.label} · ${fmtDate(photo.date)}`} onClose={() => setView(null)}>
          <img src={photo.dataUrl} alt={`${photo.label} progress photo`} style={{ width: "100%", borderRadius: 8 }} />
          <button className="btn btn-ghost btn-block mt-3 orange" onClick={() => { set((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== photo.id) })); setView(null); }} data-testid="button-delete-photo"><Trash2 size={16} /> Delete photo</button>
        </Sheet>
      )}
    </div>
  );
}
