import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Star, Trash2, Search, ScanLine, X, ChevronDown, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { dateKey, dayForDate } from "@/lib/engine";
import { newId } from "@/lib/exercises";
import { api } from "@/lib/api";
import { LOCAL_FOODS } from "@/lib/foods";
import type { FoodDef } from "@/lib/foodTypes";
import type { MealItem } from "@/lib/types";
import { NumInput, Ring, Sheet } from "@/components/ui";
import { logFavorite } from "./Today";

const r1 = (n: number) => Math.round(n * 10) / 10;
export function qtyLabel(qty: number, unit: string) {
  if (unit === "g" || unit === "oz") return `${qty} ${unit}`;
  const m = unit.match(/^1 (.+)$/);
  return m ? (qty === 1 ? unit : `${qty} × ${m[1]}`) : `${qty} × ${unit}`;
}
const OZ = 28.3495;

function mealNameFor(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 4) return "Late snack";
  if (h < 10.5) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 17) return "Snack";
  if (h < 21) return "Dinner";
  return "Late snack";
}

type Unit = { key: string; label: string; grams: number };
function unitsFor(f: FoodDef): Unit[] {
  return [
    ...f.portions.map((p, i) => ({ key: `p${i}:${p.label}`, label: p.label, grams: p.grams })),
    { key: "g", label: "g", grams: 1 },
    { key: "oz", label: "oz", grams: OZ },
  ];
}
function itemFor(f: FoodDef, qty: number, unit: Unit): MealItem {
  const grams = r1(qty * unit.grams); const k = grams / 100;
  return {
    foodId: f.id, name: f.name, ...(f.brand ? { brand: f.brand } : {}), qty, unit: unit.label, grams,
    cal: Math.round(f.per100.cal * k), p: r1(f.per100.p * k), c: r1(f.per100.c * k), f: r1(f.per100.f * k),
  };
}
function localSearch(q: string, extra: FoodDef[]): FoodDef[] {
  const toks = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!toks.length) return [];
  const pool = [...extra, ...LOCAL_FOODS];
  const seen = new Set<string>();
  return pool.filter((f) => {
    if (seen.has(f.id)) return false;
    const hay = `${f.name} ${f.brand || ""}`.toLowerCase();
    const ok = toks.every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, "")));
    if (ok) seen.add(f.id);
    return ok;
  }).slice(0, 8);
}

export function NutritionSheet({ onClose }: { onClose: () => void }) {
  const { state, set, targets } = useStore();
  const ui = useUI();
  const today = dateKey();
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const meals = state.meals.filter((x) => x.date === today).sort((a, b) => a.time - b.time);
  const tot = meals.reduce((a, x) => ({ cal: a.cal + x.cal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { cal: 0, p: 0, c: 0, f: 0 });
  const training = !!dayForDate(state.program, today);
  const calT = training ? targets.trainingCal : targets.restCal;
  const session = state.sessions.find((s) => s.date === today) ?? state.activeSession;
  const recents = state.recentFoods ?? [];

  // search
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<FoodDef[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "offline">("idle");
  const reqId = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRemote([]); setStatus("idle"); return; }
    setStatus("loading");
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ foods: FoodDef[]; live: boolean }>("GET", `/api/foods/search?q=${encodeURIComponent(term)}`, undefined, { timeoutMs: 12000 });
        if (id !== reqId.current) return;
        setRemote(r.foods.map((f) => ({ ...f, source: "usda" as const })));
        setStatus(r.live ? "live" : "offline");
      } catch {
        if (id === reqId.current) { setRemote([]); setStatus("offline"); }
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const local = useMemo(() => localSearch(q, recents.map((r) => r.food)), [q, recents]);
  const remoteGeneric = remote.filter((f) => !f.brand);
  const remoteBranded = remote.filter((f) => f.brand);

  // picker + basket
  const [pick, setPick] = useState<{ food: FoodDef; qty: number; unit?: string } | null>(null);
  const [basket, setBasket] = useState<MealItem[]>([]);
  const [basketFoods, setBasketFoods] = useState<FoodDef[]>([]);
  const [name, setName] = useState("");
  const [time, setTime] = useState(hhmm(new Date()));
  const [fav, setFav] = useState(false);
  const [scan, setScan] = useState(false);

  const openFood = (food: FoodDef, qty?: number, unit?: string) => setPick({ food, qty: qty ?? (food.portions.length ? 1 : 100), unit });
  const addToBasket = (food: FoodDef, item: MealItem) => {
    setBasket((b) => [...b, item]);
    setBasketFoods((b) => [...b, food]);
    setPick(null); setQ("");
  };

  const logMeal = () => {
    if (!basket.length) return;
    const [hh, mm] = time.split(":").map(Number);
    const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
    const sum = basket.reduce((a, x) => ({ cal: a.cal + x.cal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { cal: 0, p: 0, c: 0, f: 0 });
    const mName = name.trim() || mealNameFor(d);
    const meal = { id: newId("meal"), date: today, time: d.getTime(), name: mName, cal: Math.round(sum.cal), p: r1(sum.p), c: r1(sum.c), f: r1(sum.f), items: basket };
    const now = Date.now();
    set((s) => {
      const rec = [...basket.map((it, i) => ({ food: basketFoods[i], qty: it.qty, unit: it.unit, ts: now })), ...(s.recentFoods ?? [])];
      const seen = new Set<string>();
      const recentFoods = rec.filter((r) => r.food && !seen.has(r.food.id) && seen.add(r.food.id)).slice(0, 40);
      return {
        ...s, meals: [...s.meals, meal], recentFoods,
        favorites: fav ? [...s.favorites, { id: newId("fav"), name: mName, cal: meal.cal, p: meal.p, c: meal.c, f: meal.f, items: basket }] : s.favorites,
      };
    });
    ui.toast(fav ? "Logged and saved to favorites" : `${mName} logged`);
    setBasket([]); setBasketFoods([]); setName(""); setFav(false); setTime(hhmm(new Date()));
  };
  const bsum = basket.reduce((a, x) => ({ cal: a.cal + x.cal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { cal: 0, p: 0, c: 0, f: 0 });

  return (
    <Sheet title="Fuel" onClose={onClose} testId="sheet-nutrition">
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-1"><Ring value={tot.cal} max={calT} size={86} over={tot.cal > calT * 1.08}><span className="mono font-semibold">{Math.round(tot.cal)}</span><span className="mono text-[10px] muted">/{calT}</span></Ring><span className="label">kcal</span></div>
        <div className="flex flex-col items-center gap-1"><Ring value={tot.p} max={targets.protein} size={86} color="var(--blue)"><span className="mono font-semibold">{Math.round(tot.p)}</span><span className="mono text-[10px] muted">/{targets.protein}g</span></Ring><span className="label">protein</span></div>
        <div className="mono text-xs muted leading-6"><div>C {Math.round(tot.c)} g</div><div>F {Math.round(tot.f)} g</div><div>{meals.length} meals</div></div>
      </div>

      {/* ---- search ---- */}
      <div className="label mt-5 mb-2">Add food</div>
      <div className="flex gap-2">
        <div className="relative flex-1 min0">
          <Search size={16} className="faint" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: 36, paddingRight: q ? 40 : undefined }} placeholder="Search foods, e.g. chicken breast" value={q}
            onChange={(e) => { setQ(e.target.value); setPick(null); }} data-testid="input-food-search" enterKeyHint="search" autoComplete="off" />
          {q && <button className="faint" aria-label="Clear search" onClick={() => setQ("")} style={{ position: "absolute", right: 2, top: 0, bottom: 0, width: 40 }}><X size={16} /></button>}
        </div>
        <button className="btn btn-outline" style={{ width: 48, padding: 0 }} aria-label="Scan barcode" onClick={() => setScan(true)} data-testid="button-scan-barcode"><ScanLine size={18} /></button>
      </div>

      {pick && <PortionPicker key={pick.food.id} init={pick} onCancel={() => setPick(null)} onAdd={addToBasket} />}

      {!pick && q.trim().length >= 2 && (
        <div className="mt-2" data-testid="list-food-results">
          {local.map((f) => <FoodRow key={f.id} f={f} onPick={() => openFood(f)} />)}
          {remoteGeneric.map((f) => <FoodRow key={f.id} f={f} onPick={() => openFood(f)} />)}
          {remoteBranded.length > 0 && <div className="label mt-3 mb-1">Brands</div>}
          {remoteBranded.map((f) => <FoodRow key={f.id} f={f} onPick={() => openFood(f)} />)}
          <p className="text-[11px] faint mt-2" data-testid="text-food-status">
            {status === "loading" ? "Searching USDA FoodData Central..." : status === "offline" ? "Food database unreachable. Showing built-in foods only." : status === "live" ? (local.length + remote.length === 0 ? "No matches. Try a simpler term, or use quick add below." : "Nutrition data: USDA FoodData Central. Values per 100 g unless noted.") : ""}
          </p>
        </div>
      )}

      {!pick && q.trim().length < 2 && recents.length > 0 && (
        <>
          <div className="label mt-3 mb-2">Recent</div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {recents.slice(0, 12).map((r) => (
              <button key={r.food.id} className="btn btn-sm btn-outline shrink-0" style={{ minHeight: 44 }} onClick={() => openFood(r.food, r.qty, r.unit)} data-testid={`button-recent-${r.food.id}`}>
                <Plus size={14} /> <span className="truncate" style={{ maxWidth: 160 }}>{r.food.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---- basket ---- */}
      {basket.length > 0 && (
        <div className="card-flat mt-4" data-testid="card-basket">
          <div className="flex items-center justify-between mb-1"><span className="label">This meal</span><span className="mono text-xs muted">{Math.round(bsum.cal)} kcal · {Math.round(bsum.p)}p {Math.round(bsum.c)}c {Math.round(bsum.f)}f</span></div>
          {basket.map((it, i) => (
            <div key={i} className="rowline" data-testid={`row-basket-${i}`}>
              <div className="min0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="mono text-[11px] muted">{qtyLabel(it.qty, it.unit)}{it.unit !== "g" ? ` · ${Math.round(it.grams)} g` : ""} · {Math.round(it.p)}p</div>
              </div>
              <div className="flex items-center gap-1"><span className="mono text-sm">{it.cal}</span>
                <button className="faint" style={{ padding: 10 }} aria-label={`Remove ${it.name}`} onClick={() => { setBasket((b) => b.filter((_, j) => j !== i)); setBasketFoods((b) => b.filter((_, j) => j !== i)); }}><X size={14} /></button></div>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input className="input" placeholder={mealNameFor()} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-basket-name" aria-label="Meal name" />
            <input className="input mono" type="time" style={{ width: 132 }} value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-basket-time" aria-label="Meal time" />
          </div>
          <label className="flex items-center gap-2 text-sm muted" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#111418" }} data-testid="checkbox-basket-favorite" />
            <Star size={14} /> Save as favorite
          </label>
          <button className="btn btn-primary btn-block" onClick={logMeal} data-testid="button-log-basket"><Check size={16} /> Log meal</button>
        </div>
      )}

      {state.favorites.length > 0 && (
        <>
          <div className="label mt-5 mb-2">Favorites · one tap</div>
          <div className="grid grid-cols-2 gap-2">
            {state.favorites.map((f) => (
              <div key={f.id} className="card-flat flex items-center gap-2" style={{ padding: 8 }}>
                <button className="flex-1 text-left min0" style={{ minHeight: 44 }} onClick={() => { set((s) => ({ ...s, meals: [...s.meals, logFavorite(f, today)] })); ui.toast(`Logged ${f.name}`); }} data-testid={`button-fav-${f.id}`}>
                  <div className="text-[13px] font-semibold truncate">{f.name}</div>
                  <div className="mono text-[11px] muted">{f.cal} kcal · {Math.round(f.p)}p</div>
                </button>
                <button className="faint" aria-label="Remove favorite" onClick={() => set((s) => ({ ...s, favorites: s.favorites.filter((x) => x.id !== f.id) }))} style={{ padding: 10 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <QuickAdd />

      <div className="label mt-5 mb-1">Today · timeline</div>
      {meals.length === 0 ? <p className="text-sm faint py-3">Nothing logged yet.</p> : meals.map((x) => {
        const pre = session && x.time < session.start && session.start - x.time <= 3 * 3600000;
        return (
          <div key={x.id} className="rowline" data-testid={`row-meal-${x.id}`}>
            <div className="min0">
              <div className="text-sm font-semibold truncate">{x.name}</div>
              {x.items?.length ? <div className="text-[12px] muted truncate">{x.items.map((i) => i.name.split(",")[0]).join(", ")}</div> : null}
              <div className="mono text-[11px] muted">{new Date(x.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {Math.round(x.p)}p {Math.round(x.c)}c {Math.round(x.f)}f {pre ? <span className="lime"> · pre-workout</span> : null}</div>
            </div>
            <div className="flex items-center gap-2"><span className="mono text-sm">{x.cal}</span>
              <button className="faint" style={{ padding: 10 }} aria-label="Delete meal" onClick={() => set((s) => ({ ...s, meals: s.meals.filter((y) => y.id !== x.id) }))}><Trash2 size={14} /></button></div>
          </div>
        );
      })}
      <p className="text-[11px] faint mt-3">Meal times feed the insights engine (e.g. carbs in the 3h before training). Food data from USDA FoodData Central and Open Food Facts.</p>

      {scan && createPortal(<BarcodeSheet onClose={() => setScan(false)} onFound={(f) => { setScan(false); setQ(""); openFood(f); }} />, document.body)}
    </Sheet>
  );
}

function FoodRow({ f, onPick }: { f: FoodDef; onPick: () => void }) {
  return (
    <button className="rowline w-full text-left" style={{ minHeight: 52 }} onClick={onPick} data-testid={`row-food-${f.id}`}>
      <div className="min0 flex-1">
        <div className="text-sm font-semibold truncate">{f.name}</div>
        <div className="mono text-[11px] muted truncate">{f.brand ? `${f.brand} · ` : ""}{Math.round(f.per100.cal)} kcal · {Math.round(f.per100.p)}p per 100 g</div>
      </div>
      <Plus size={16} className="lime shrink-0" />
    </button>
  );
}

function PortionPicker({ init, onCancel, onAdd }: { init: { food: FoodDef; qty: number; unit?: string }; onCancel: () => void; onAdd: (f: FoodDef, it: MealItem) => void }) {
  const [food, setFood] = useState(init.food);
  const [qty, setQty] = useState<number | null>(init.qty);
  const units = unitsFor(food);
  const [unitKey, setUnitKey] = useState(() => (init.unit && units.find((u) => u.label === init.unit)?.key) || units[0].key);
  // USDA generic foods: fetch household portions (cup, slice, ...) on demand
  useEffect(() => {
    if (food.source === "usda" && food.fdcId && !food.brand && food.portions.length === 0) {
      api<{ portions: FoodDef["portions"] }>("GET", `/api/foods/${food.fdcId}/portions`).then((r) => {
        if (r.portions.length) {
          const nf = { ...food, portions: r.portions };
          setFood(nf);
          if (unitKey === "g" && qty === 100 && !init.unit) { setUnitKey(unitsFor(nf)[0].key); setQty(1); }
        }
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const item = qty && qty > 0 ? itemFor(food, qty, unit) : null;
  return (
    <div className="card-flat mt-3" data-testid="card-portion-picker" style={{ borderColor: "var(--border-strong)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min0"><div className="text-sm font-semibold">{food.name}</div>{food.brand && <div className="text-[12px] muted">{food.brand}</div>}</div>
        <button className="faint shrink-0" aria-label="Cancel" onClick={onCancel} style={{ padding: 10, margin: -10 }}><X size={16} /></button>
      </div>
      <div className="flex gap-2 mt-3">
        <label className="field" style={{ width: 96 }}><span className="label">Amount</span>
          <NumInput value={qty} onChange={setQty} min={0} max={5000} decimals={2} allowEmpty data-testid="input-portion-qty" /></label>
        <label className="field flex-1 min0"><span className="label">Unit</span>
          <div className="relative">
            <select className="input" style={{ appearance: "none", paddingRight: 32 }} value={unit.key} onChange={(e) => setUnitKey(e.target.value)} data-testid="select-portion-unit">
              {units.map((u) => <option key={u.key} value={u.key}>{u.label}{u.key.startsWith("p") && !/\d\s*(g|ml)\)?$/i.test(u.label) ? ` (${Math.round(u.grams)} g)` : ""}</option>)}
            </select>
            <ChevronDown size={14} className="faint" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
        </label>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3 text-center" data-testid="text-portion-macros">
        {([["kcal", item?.cal], ["Protein", item?.p], ["Carbs", item?.c], ["Fat", item?.f]] as const).map(([l, v]) => (
          <div key={l}><div className="mono font-semibold">{v === undefined ? "-" : l === "kcal" ? v : Math.round(v as number)}</div><div className="label">{l}</div></div>
        ))}
      </div>
      <button className="btn btn-primary btn-block mt-3" disabled={!item} onClick={() => item && onAdd(food, item)} data-testid="button-add-to-meal"><Plus size={16} /> Add to meal</button>
    </div>
  );
}

function QuickAdd() {
  const { set } = useStore();
  const ui = useUI();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [m, setM] = useState({ name: "", cal: "", p: "", c: "", f: "", time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
  const [fav, setFav] = useState(false);
  const add = () => {
    const [hh, mm] = m.time.split(":").map(Number);
    const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
    const meal = { id: newId("meal"), date: dateKey(), time: d.getTime(), name: m.name || "Meal", cal: +m.cal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0 };
    set((s) => ({ ...s, meals: [...s.meals, meal], favorites: fav ? [...s.favorites, { id: newId("fav"), name: meal.name, cal: meal.cal, p: meal.p, c: meal.c, f: meal.f }] : s.favorites }));
    ui.toast(fav ? "Logged and saved to favorites" : "Meal logged");
    setM({ ...m, name: "", cal: "", p: "", c: "", f: "" });
    setFav(false);
  };
  const autoCal = () => { const v = (+m.p || 0) * 4 + (+m.c || 0) * 4 + (+m.f || 0) * 9; if (v) setM({ ...m, cal: String(Math.round(v)) }); };
  return (
    <>
      <button className="flex items-center justify-between w-full mt-5" style={{ minHeight: 44 }} onClick={() => setOpen(!open)} aria-expanded={open} data-testid="button-toggle-quickadd">
        <span className="label">Quick add · enter macros manually</span><ChevronDown size={16} className="faint" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="flex gap-2">
            <input className="input" placeholder="Meal name" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} data-testid="input-meal-name" />
            <input className="input mono" type="time" style={{ width: 132 }} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} data-testid="input-meal-time" aria-label="Meal time" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([["cal", "kcal"], ["p", "Protein"], ["c", "Carbs"], ["f", "Fat"]] as const).map(([k, l]) => (
              <label key={k} className="field min0"><span className="label">{l}</span><input className="input mono" inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} onBlur={k !== "cal" && !m.cal ? autoCal : undefined} data-testid={`input-meal-${k}`} /></label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm muted" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#111418" }} data-testid="checkbox-save-favorite" />
            <Star size={14} /> Save as favorite
          </label>
          <button className="btn btn-outline btn-block" onClick={add} disabled={!m.cal && !m.p} data-testid="button-add-meal"><Plus size={16} /> Log meal</button>
        </div>
      )}
    </>
  );
}

function BarcodeSheet({ onClose, onFound }: { onClose: () => void; onFound: (f: FoodDef) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string>("Starting camera...");
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  const lookup = async (c: string) => {
    const digits = c.replace(/\D/g, "");
    if (digits.length < 8) { setMsg("Barcodes are 8 to 14 digits."); return; }
    setBusy(true); setMsg(`Looking up ${digits}...`);
    try {
      const r = await api<{ food: FoodDef }>("GET", `/api/foods/barcode/${digits}`);
      done.current = true;
      onFound(r.food);
    } catch (e: any) {
      setMsg(e?.status === 404 ? `No product found for ${digits}. Try searching by name.` : e?.message || "Lookup failed.");
      done.current = false;
    } finally { setBusy(false); }
  };

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setMsg("Camera not available here. Type the barcode below."); return; }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !video.current) return;
        controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current, (res) => {
          if (res && !done.current) { done.current = true; const t = res.getText(); setCode(t); lookup(t); }
        });
        if (cancelled) controls.stop();
        else setMsg("Point the camera at the barcode.");
      } catch {
        setMsg("Camera blocked or unavailable. Type the barcode below.");
      }
    })();
    return () => { cancelled = true; controls?.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet title="Scan barcode" onClose={onClose} testId="sheet-barcode">
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "#000", aspectRatio: "4 / 3" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} data-testid="video-barcode" />
        <div style={{ position: "absolute", left: "12%", right: "12%", top: "42%", height: 2, background: "#E4DAD1", opacity: 0.9 }} />
      </div>
      <p className="text-sm muted mt-3" data-testid="text-barcode-status">{msg}</p>
      <div className="label mt-4 mb-2">Or type the number under the barcode</div>
      <div className="flex gap-2">
        <input className="input mono" inputMode="numeric" placeholder="e.g. 041196910759" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))}
          onKeyDown={(e) => { if (e.key === "Enter") lookup(code); }} data-testid="input-barcode" />
        <button className="btn btn-primary" disabled={busy || code.length < 8} onClick={() => lookup(code)} data-testid="button-barcode-lookup">Look up</button>
      </div>
    </Sheet>
  );
}
