import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { dateKey, dayForDate } from "@/lib/engine";
import { newId } from "@/lib/exercises";
import { Ring, Sheet } from "@/components/ui";
import { logFavorite } from "./Today";

export function NutritionSheet({ onClose }: { onClose: () => void }) {
  const { state, set, targets } = useStore();
  const ui = useUI();
  const today = dateKey();
  const now = new Date();
  const [m, setM] = useState({ name: "", cal: "", p: "", c: "", f: "", time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
  const [fav, setFav] = useState(false);
  const meals = state.meals.filter((x) => x.date === today).sort((a, b) => a.time - b.time);
  const tot = meals.reduce((a, x) => ({ cal: a.cal + x.cal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { cal: 0, p: 0, c: 0, f: 0 });
  const training = !!dayForDate(state.program, today);
  const calT = training ? targets.trainingCal : targets.restCal;
  const session = state.sessions.find((s) => s.date === today) ?? state.activeSession;

  const add = () => {
    const [hh, mm] = m.time.split(":").map(Number);
    const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
    const meal = { id: newId("meal"), date: today, time: d.getTime(), name: m.name || "Meal", cal: +m.cal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0 };
    set((s) => ({ ...s, meals: [...s.meals, meal], favorites: fav ? [...s.favorites, { id: newId("fav"), name: meal.name, cal: meal.cal, p: meal.p, c: meal.c, f: meal.f }] : s.favorites }));
    ui.toast(fav ? "Logged and saved to favorites" : "Meal logged");
    setM({ ...m, name: "", cal: "", p: "", c: "", f: "" });
    setFav(false);
  };
  const autoCal = () => { const v = (+m.p || 0) * 4 + (+m.c || 0) * 4 + (+m.f || 0) * 9; if (v) setM({ ...m, cal: String(Math.round(v)) }); };

  return (
    <Sheet title="Nutrition log" onClose={onClose} testId="sheet-nutrition">
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center gap-1"><Ring value={tot.cal} max={calT} size={86} over={tot.cal > calT * 1.08}><span className="mono font-semibold">{Math.round(tot.cal)}</span><span className="mono text-[10px] muted">/{calT}</span></Ring><span className="label">kcal</span></div>
        <div className="flex flex-col items-center gap-1"><Ring value={tot.p} max={targets.protein} size={86} color="var(--blue)"><span className="mono font-semibold">{Math.round(tot.p)}</span><span className="mono text-[10px] muted">/{targets.protein}g</span></Ring><span className="label">protein</span></div>
        <div className="mono text-xs muted leading-6"><div>C {Math.round(tot.c)} g</div><div>F {Math.round(tot.f)} g</div><div>{meals.length} meals</div></div>
      </div>

      {state.favorites.length > 0 && (
        <>
          <div className="label mt-5 mb-2">Favorites · one tap</div>
          <div className="grid grid-cols-2 gap-2">
            {state.favorites.map((f) => (
              <div key={f.id} className="card-flat flex items-center gap-2" style={{ padding: 8 }}>
                <button className="flex-1 text-left min0" style={{ minHeight: 40 }} onClick={() => { set((s) => ({ ...s, meals: [...s.meals, logFavorite(f, today)] })); ui.toast(`Logged ${f.name}`); }} data-testid={`button-fav-${f.id}`}>
                  <div className="text-[13px] font-semibold truncate">{f.name}</div>
                  <div className="mono text-[11px] muted">{f.cal} kcal · {f.p}p</div>
                </button>
                <button className="faint" aria-label="Remove favorite" onClick={() => set((s) => ({ ...s, favorites: s.favorites.filter((x) => x.id !== f.id) }))} style={{ padding: 6 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="label mt-5 mb-2">Quick add</div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="flex gap-2">
          <input className="input" placeholder="Meal name" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} data-testid="input-meal-name" />
          <input className="input mono" type="time" style={{ width: 118 }} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} data-testid="input-meal-time" aria-label="Meal time" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {([["cal", "kcal"], ["p", "Protein"], ["c", "Carbs"], ["f", "Fat"]] as const).map(([k, l]) => (
            <label key={k} className="field min0"><span className="label">{l}</span><input className="input mono" inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} onBlur={k !== "cal" && !m.cal ? autoCal : undefined} data-testid={`input-meal-${k}`} /></label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm muted" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#C6F432" }} data-testid="checkbox-save-favorite" />
          <Star size={14} /> Save as favorite
        </label>
        <button className="btn btn-primary btn-block" onClick={add} disabled={!m.cal && !m.p} data-testid="button-add-meal"><Plus size={16} /> Log meal</button>
      </div>

      <div className="label mt-5 mb-1">Today · timeline</div>
      {meals.length === 0 ? <p className="text-sm faint py-3">Nothing logged yet.</p> : meals.map((x) => {
        const pre = session && x.time < session.start && session.start - x.time <= 3 * 3600000;
        return (
          <div key={x.id} className="rowline" data-testid={`row-meal-${x.id}`}>
            <div className="min0">
              <div className="text-sm font-semibold truncate">{x.name}</div>
              <div className="mono text-[11px] muted">{new Date(x.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {x.p}p {x.c}c {x.f}f {pre ? <span className="lime"> · pre-workout</span> : null}</div>
            </div>
            <div className="flex items-center gap-2"><span className="mono text-sm">{x.cal}</span>
              <button className="faint" style={{ padding: 8 }} aria-label="Delete meal" onClick={() => set((s) => ({ ...s, meals: s.meals.filter((y) => y.id !== x.id) }))}><Trash2 size={14} /></button></div>
          </div>
        );
      })}
      <p className="text-[11px] faint mt-3">Meal times feed the insights engine (e.g. carbs in the 3h before training).</p>
    </Sheet>
  );
}
