/* Gym search: Google Places (New) when a key is configured, OpenStreetMap (Nominatim) as a fallback.
   The Google key never reaches the browser. Results are cached in memory. */

export interface PlaceOut {
  provider: "google" | "osm";
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceKm?: number;
}

const G_PROXY_URL = process.env.CUSTOM_CRED_PLACES_GOOGLEAPIS_COM_URL || "";
const G_PROXY_KEY = process.env.CUSTOM_CRED_PLACES_GOOGLEAPIS_COM_PROXY_AUTH_KEY || "";
const G_DIRECT_KEY = process.env.GOOGLE_PLACES_KEY || "";
export const googleEnabled = () => !!(G_PROXY_URL || G_DIRECT_KEY);
export const placesProvider = (): "google" | "osm" => (googleEnabled() ? "google" : "osm");

const UA = "Corpus/1.0 (fitness app; colischdaniel@gmail.com)";
const TTL = 6 * 3600_000;
const cache = new Map<string, { v: unknown; exp: number }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await fn();
  if (cache.size > 5000) cache.clear();
  cache.set(key, { v, exp: Date.now() + TTL });
  return v;
}

// Monthly budget so a leaked endpoint can't run up a bill. Google's free tier is
// 10k autocomplete + 10k details and 5k nearby per month; stay well under it.
const budgets: Record<string, { n: number; reset: number }> = {};
function spend(kind: string, max: number) {
  const b = budgets[kind] ?? (budgets[kind] = { n: 0, reset: 0 });
  if (b.reset < Date.now()) { b.n = 0; b.reset = Date.now() + 30 * 86400_000; }
  if (++b.n > max) throw Object.assign(new Error("Gym search is busy this month. Type the gym name instead."), { status: 503 });
}

const unavailable = () => Object.assign(new Error("Gym search is unavailable right now. Try again in a minute."), { status: 502 });

async function google(path: string, body: unknown, fieldMask: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Goog-FieldMask": fieldMask };
  let url: string;
  if (G_PROXY_URL) { url = `${G_PROXY_URL}${path}`; headers["x-api-key"] = G_PROXY_KEY; }
  else { url = `https://places.googleapis.com${path}`; headers["X-Goog-Api-Key"] = G_DIRECT_KEY; }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) { console.error("places", path, r.status, (await r.text()).slice(0, 300)); throw unavailable(); }
    return await r.json();
  } finally { clearTimeout(t); }
}

const GYM_TYPES = ["gym", "fitness_center"];
const km = (a: number, b: number, c: number, d: number) => {
  const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((d - b) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const withDist = (p: PlaceOut, lat?: number, lng?: number): PlaceOut =>
  lat !== undefined && lng !== undefined && p.lat !== null && p.lng !== null ? { ...p, distanceKm: Math.round(km(lat, lng, p.lat, p.lng) * 10) / 10 } : p;

/* ------------------------------------------------------------- google */
async function googleSearch(q: string, lat?: number, lng?: number): Promise<PlaceOut[]> {
  const near = lat !== undefined && lng !== undefined;
  if (!q) {
    if (!near) return [];
    // Nearby Search (Pro SKU, 5k free/month). Cache by ~1 km grid cell.
    const key = `g:near:${lat!.toFixed(2)},${lng!.toFixed(2)}`;
    const places = await cached(key, async () => {
      spend("google-nearby", 4000);
      const j = await google("/v1/places:searchNearby", {
        includedTypes: GYM_TYPES, maxResultCount: 12, rankPreference: "DISTANCE",
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 15000 } },
      }, "places.id,places.displayName,places.formattedAddress,places.location");
      return ((j.places ?? []) as any[]).map((p): PlaceOut => ({
        provider: "google", placeId: String(p.id), name: p.displayName?.text ?? "Gym", address: p.formattedAddress ?? "",
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
      }));
    });
    return places.map((p) => withDist(p, lat, lng));
  }
  // Autocomplete (Essentials SKU, 10k free/month). Returns name + address text, no coordinates.
  const key = `g:ac:${q.toLowerCase()}:${near ? `${lat!.toFixed(1)},${lng!.toFixed(1)}` : "-"}`;
  return cached(key, async () => {
    spend("google-autocomplete", 9000);
    const body: Record<string, unknown> = { input: q, includedPrimaryTypes: GYM_TYPES, includeQueryPredictions: false };
    if (near) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    const j = await google("/v1/places:autocomplete", body, "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat");
    return ((j.suggestions ?? []) as any[]).map((s) => s.placePrediction).filter(Boolean).map((p): PlaceOut => ({
      provider: "google", placeId: String(p.placeId), name: p.structuredFormat?.mainText?.text ?? "Gym",
      address: p.structuredFormat?.secondaryText?.text ?? "", lat: null, lng: null,
    }));
  });
}

/** Fills in coordinates for a Google place picked from autocomplete (Essentials details SKU, 10k free). */
export async function googleDetails(placeId: string): Promise<{ lat: number | null; lng: number | null; address: string }> {
  return cached(`g:det:${placeId}`, async () => {
    spend("google-details", 9000);
    const headers: Record<string, string> = { "X-Goog-FieldMask": "location,formattedAddress" };
    let url: string;
    const path = `/v1/places/${encodeURIComponent(placeId)}`;
    if (G_PROXY_URL) { url = `${G_PROXY_URL}${path}`; headers["x-api-key"] = G_PROXY_KEY; }
    else { url = `https://places.googleapis.com${path}`; headers["X-Goog-Api-Key"] = G_DIRECT_KEY; }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url, { headers, signal: ctl.signal });
      if (!r.ok) { console.error("places details", r.status); return { lat: null, lng: null, address: "" }; }
      const j = await r.json();
      return { lat: j.location?.latitude ?? null, lng: j.location?.longitude ?? null, address: j.formattedAddress ?? "" };
    } catch { return { lat: null, lng: null, address: "" }; }
    finally { clearTimeout(t); }
  });
}

/* ---------------------------------------------------------------- osm */
// Nominatim asks for at most one request per second; queue them.
let osmChain: Promise<unknown> = Promise.resolve();
function osmFetch(url: string): Promise<any> {
  const run = async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctl.signal });
      if (!r.ok) { console.error("nominatim", r.status); throw unavailable(); }
      return await r.json();
    } finally { clearTimeout(t); await new Promise((res) => setTimeout(res, 1100)); }
  };
  const p = osmChain.then(run, run);
  osmChain = p.catch(() => undefined);
  return p;
}

const GYM_WORDS = /\bgym\b|fitness|barbell|crossfit|athletic club|strength|iron\b|lifting|muscle|ymca|health club|powerlifting|weightlifting/i;
const GYM_TYPES_OSM = new Set(["fitness_centre", "sports_centre", "fitness_station", "gym"]);
function osmRow(r: any): PlaceOut | null {
  const name = r.name || r.display_name?.split(",")[0] || "";
  if (!name) return null;
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.hamlet || a.county || "";
  const address = [street, city, a.state].filter(Boolean).join(", ");
  return { provider: "osm", placeId: `${r.osm_type?.[0] ?? "n"}${r.osm_id}`, name, address, lat: Number(r.lat) || null, lng: Number(r.lon) || null };
}

async function osmSearch(q: string, lat?: number, lng?: number): Promise<PlaceOut[]> {
  const near = lat !== undefined && lng !== undefined;
  const key = `o:${q.toLowerCase()}:${near ? `${lat!.toFixed(2)},${lng!.toFixed(2)}` : "-"}`;
  const rows = await cached(key, async () => {
    // "Near me" with nothing typed runs a couple of generic words; a typed name runs as-is.
    const terms = q ? [q] : ["fitness", "gym"];
    const rowsAll: any[] = [];
    for (const term of terms) {
      const qs = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "12", q: term });
      if (near) {
        const d = q ? 0.6 : 0.25; // ~65 km when typing a name, ~25 km for "near me"
        qs.set("viewbox", `${lng! - d},${lat! + d},${lng! + d},${lat! - d}`);
        qs.set("bounded", "1");
      } else if (!q) return [];
      rowsAll.push(...((await osmFetch(`https://nominatim.openstreetmap.org/search?${qs}`)) as any[]));
    }
    const out: PlaceOut[] = [];
    for (const r of rowsAll) {
      // Only real gym-like places: tagged as a fitness/sports centre, or a named business whose name says gym.
      const name: string = r.name || "";
      const tagged = GYM_TYPES_OSM.has(r.type);
      const business = ["amenity", "shop", "leisure", "club", "building"].includes(r.category) && GYM_WORDS.test(name);
      if (!tagged && !business) continue;
      const p = osmRow(r); if (p) out.push(p);
    }
    return out;
  });
  const seen = new Set<string>();
  return rows.map((p) => withDist(p, lat, lng)).filter((p) => (seen.has(p.placeId) ? false : (seen.add(p.placeId), true)))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}

/* -------------------------------------------------------------- public */
export async function searchGyms(q: string, lat?: number, lng?: number): Promise<{ provider: "google" | "osm"; results: PlaceOut[] }> {
  if (googleEnabled()) {
    try { return { provider: "google", results: await googleSearch(q, lat, lng) }; }
    catch (e) { if ((e as any).status === 503) throw e; console.error("google places failed, falling back to osm:", (e as Error).message); }
  }
  return { provider: "osm", results: await osmSearch(q, lat, lng) };
}
