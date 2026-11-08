/* Food search proxy: USDA FoodData Central (search + portions) and Open Food Facts (barcode fallback).
   The USDA key stays server-side. Results are cached in memory for 24h. */

type Per100 = { cal: number; p: number; c: number; f: number };
export interface FoodOut {
  id: string; fdcId?: number; name: string; brand?: string;
  per100: Per100; portions: { label: string; grams: number }[]; source: "usda" | "off";
}

const PROXY_URL = process.env.CUSTOM_CRED_API_NAL_USDA_GOV_URL || "";
const PROXY_KEY = process.env.CUSTOM_CRED_API_NAL_USDA_GOV_PROXY_AUTH_KEY || "";
const DIRECT_KEY = process.env.USDA_API_KEY || "";
export const foodsEnabled = () => !!(PROXY_URL || DIRECT_KEY);

const TTL = 24 * 3600_000;
const cache = new Map<string, { v: unknown; exp: number }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await fn();
  if (cache.size > 5000) cache.clear();
  cache.set(key, { v, exp: Date.now() + TTL });
  return v;
}

// Global budget so a single key can't be drained (USDA allows 3,600/hr on this key).
let budget = { n: 0, reset: Date.now() + 3600_000 };
function spend() {
  if (budget.reset < Date.now()) budget = { n: 0, reset: Date.now() + 3600_000 };
  if (++budget.n > 3000) throw Object.assign(new Error("Food search is busy. Try again later."), { status: 503 });
}

async function usda(path: string, params: Record<string, string>, body?: unknown): Promise<any> {
  spend();
  const qs = new URLSearchParams(params);
  let url: string; const headers: Record<string, string> = { Accept: "application/json" };
  if (PROXY_URL) { url = `${PROXY_URL}/fdc/v1${path}?${qs}`; headers["x-api-key"] = PROXY_KEY; }
  else { qs.set("api_key", DIRECT_KEY); url = `https://api.nal.usda.gov/fdc/v1${path}?${qs}`; }
  if (body) headers["Content-Type"] = "application/json";
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    if (!r.ok) { console.error("usda", r.status); throw Object.assign(new Error("Food database unavailable"), { status: 502 }); }
    return await r.json();
  } finally { clearTimeout(t); }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function nutrients(list: any[]): Per100 {
  const by: Record<number, number> = {};
  for (const n of list || []) {
    const id = n.nutrientId ?? n.nutrient?.id; const v = n.value ?? n.amount;
    if (id && typeof v === "number" && by[id] === undefined) by[id] = v;
  }
  const p = by[1003] ?? 0, f = by[1004] ?? 0, c = by[1005] ?? 0;
  const cal = by[1008] ?? by[2047] ?? by[2048] ?? (p * 4 + c * 4 + f * 9);
  return { cal: r1(cal), p: r1(p), c: r1(c), f: r1(f) };
}

function brandedServing(f: any): { label: string; grams: number }[] {
  const size = Number(f.servingSize); const unit = String(f.servingSizeUnit || "").toLowerCase();
  if (!size || !(unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt")) return [];
  const u = unit.startsWith("m") ? "ml" : "g";
  const hh = String(f.householdServingFullText || "").trim().toLowerCase().replace(/\bonz\b/g, "oz");
  const useful = hh && hh.length < 32 && !/^[\d.\s]+(g|grm|ml|mlt)$/.test(hh);
  const label = useful ? `${hh} (${Math.round(size)} ${u})` : `1 serving (${Math.round(size)} ${u})`;
  return [{ label, grams: r1(size) }];
}

function fromSearch(f: any): FoodOut {
  const branded = f.dataType === "Branded";
  const brand = branded ? titleCase(String(f.brandName || f.brandOwner || "")).slice(0, 60) || undefined : undefined;
  return {
    id: `usda:${f.fdcId}`, fdcId: f.fdcId, name: titleCase(String(f.description || "Food")).slice(0, 120), brand,
    per100: nutrients(f.foodNutrients), portions: branded ? brandedServing(f) : [], source: "usda",
  };
}

export async function searchFoods(qRaw: string): Promise<FoodOut[]> {
  const q = qRaw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  return cached(`s:${q}`, async () => {
    const [gen, br] = await Promise.allSettled([
      usda("/foods/search", { query: q, dataType: "Foundation,SR Legacy", pageSize: "12" }),
      usda("/foods/search", { query: q, dataType: "Branded", pageSize: "12" }),
    ]);
    if (gen.status === "rejected" && br.status === "rejected") throw gen.reason;
    const toks = q.split(" ");
    const score = (n: string) => { const l = n.toLowerCase(); return (l.startsWith(toks[0]) ? 3 : 0) + (toks.every((t) => l.includes(t)) ? 2 : 0) + (/\b(raw|cooked|roasted|boiled|baked|grilled|broiled)\b/.test(l) ? 1 : 0) - l.length / 80; };
    const g = gen.status === "fulfilled" ? (gen.value.foods || []).map(fromSearch).sort((a: FoodOut, b: FoodOut) => score(b.name) - score(a.name)) : [];
    const b = br.status === "fulfilled" ? (br.value.foods || []).map(fromSearch) : [];
    const seen = new Set<string>();
    return [...g, ...b].filter((x) => {
      const k = `${x.name.toLowerCase()}|${(x.brand || "").toLowerCase()}`;
      if (seen.has(k) || !(x.per100.cal > 0 || x.per100.p > 0)) return false;
      seen.add(k); return true;
    });
  });
}

export async function foodPortions(fdcId: number): Promise<FoodOut["portions"]> {
  return cached(`p:${fdcId}`, async () => {
    const d = await usda(`/food/${fdcId}`, {});
    const out: { label: string; grams: number }[] = [];
    const seen = new Set<string>();
    for (const p of d.foodPortions || []) {
      const g = Number(p.gramWeight); if (!g) continue;
      const amt = Number(p.amount) || 1;
      const desc = String(p.modifier || p.portionDescription || p.measureUnit?.name || "").replace(/\s*\((Includes|yield)[^)]*\)/g, "").trim();
      if (!desc || /^undetermined$/i.test(desc) || /^[\d.\s]+$/.test(desc)) continue;
      const label = `${+amt.toFixed(2)} ${desc}`.slice(0, 50);
      if (seen.has(label)) continue; seen.add(label);
      out.push({ label, grams: r1(g) });
    }
    if (!out.length) out.push(...brandedServing(d));
    return out.slice(0, 8);
  });
}

async function offLookup(code: string): Promise<FoodOut | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size`, {
      headers: { "User-Agent": "RXS/1.0 (rxs-lab.pplx.app)" }, signal: ctl.signal,
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = j?.product; if (!p || j.status !== 1) return null;
    const n = p.nutriments || {};
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
    const pr = num(n.proteins_100g), c = num(n.carbohydrates_100g), f = num(n.fat_100g);
    const cal = num(n["energy-kcal_100g"]) || (num(n.energy_100g) ? num(n.energy_100g) / 4.184 : pr * 4 + c * 4 + f * 9);
    const sq = num(p.serving_quantity);
    return {
      id: `off:${code}`, name: String(p.product_name || "Scanned product").slice(0, 120), brand: String(p.brands || "").split(",")[0].trim().slice(0, 60) || undefined,
      per100: { cal: r1(cal), p: r1(pr), c: r1(c), f: r1(f) },
      portions: sq ? [{ label: String(p.serving_size || `1 serving (${sq} g)`).slice(0, 40), grams: r1(sq) }] : [], source: "off",
    };
  } catch { return null; } finally { clearTimeout(t); }
}

export async function barcodeLookup(codeRaw: string): Promise<FoodOut | null> {
  const code = codeRaw.replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return null;
  return cached(`b:${code}`, async () => {
    const variants = Array.from(new Set([code, code.padStart(12, "0"), code.padStart(13, "0"), code.replace(/^0+/, "")]));
    try {
      const d = await usda("/foods/search", { query: code, dataType: "Branded", pageSize: "5" });
      const hit = (d.foods || []).find((f: any) => variants.includes(String(f.gtinUpc || "").replace(/^0+/, "")) || variants.includes(String(f.gtinUpc || "")));
      if (hit) return fromSearch(hit);
    } catch { /* fall through */ }
    return offLookup(code);
  });
}
