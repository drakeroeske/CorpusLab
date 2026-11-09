import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Empty, Sheet } from "@/components/ui";

export interface GymPlace {
  provider: "google" | "osm";
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceKm?: number;
  members?: number;
}
export interface GymRef { id: string; name: string; address: string; lat: number | null; lng: number | null; provider: string }

const LOC_KEY = "corpus.gym.loc";
type Loc = { lat: number; lng: number; ts: number };
const savedLoc = (): Loc | null => { try { const v = JSON.parse(localStorage.getItem(LOC_KEY) || "null"); return v && typeof v.lat === "number" ? v : null; } catch { return null; } };

/** Asks the phone for its position. Resolves null when denied or unavailable. */
export function locate(): Promise<Loc | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { const l = { lat: p.coords.latitude, lng: p.coords.longitude, ts: Date.now() }; try { localStorage.setItem(LOC_KEY, JSON.stringify(l)); } catch { /* private mode */ } resolve(l); },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 },
    );
  });
}

const fmtDist = (km?: number) => km === undefined ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;

/** Searches real gyms (Google Places, or OpenStreetMap when no key is configured) and returns the pick. */
export function GymPicker({ title = "Find your gym", onPick, onClose, cta = "Pick" }: { title?: string; onPick: (p: GymPlace) => void | Promise<void>; onClose: () => void; cta?: string }) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState<Loc | null>(savedLoc());
  const [locating, setLocating] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [results, setResults] = useState<GymPlace[] | null>(null);
  const [provider, setProvider] = useState<"google" | "osm" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async (query: string, at: Loc | null) => {
    const n = ++seq.current;
    if (!query.trim() && !at) { setResults(null); return; }
    setBusy(true); setErr("");
    try {
      const qs = new URLSearchParams({ q: query.trim() });
      if (at) { qs.set("lat", String(at.lat)); qs.set("lng", String(at.lng)); }
      const r = await api<{ provider: "google" | "osm"; results: GymPlace[] }>("GET", `/api/gyms/search?${qs}`);
      if (n !== seq.current) return;
      setResults(r.results); setProvider(r.provider);
    } catch (e) { if (n === seq.current) { setErr((e as Error).message); setResults([]); } }
    finally { if (n === seq.current) setBusy(false); }
  };

  // Debounced search as you type.
  useEffect(() => {
    if (!q.trim()) { if (!loc) setResults(null); return; }
    const t = setTimeout(() => search(q, loc), 350);
    return () => clearTimeout(t);
  }, [q, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  // On open: use a recent saved position, or fetch one silently if the phone already allows location.
  useEffect(() => {
    inputRef.current?.focus();
    if (loc && Date.now() - loc.ts < 30 * 60_000) { search("", loc); return; }
    let cancelled = false;
    const tryQuiet = async () => {
      try {
        const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (st?.state !== "granted") return;
      } catch { return; }
      setLocating(true);
      const l = await locate();
      if (cancelled) return;
      setLocating(false);
      if (l) { setLoc(l); search(qRef.current, l); }
    };
    void tryQuiet();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const qRef = useRef(q); qRef.current = q;

  const nearMe = async () => {
    setLocating(true); setLocDenied(false);
    const l = await locate();
    setLocating(false);
    if (!l) { setLocDenied(true); return; }
    setLoc(l); setQ(""); search("", l);
  };

  const pick = async (p: GymPlace) => {
    setPicking(p.placeId);
    try { await onPick(p); } finally { setPicking(null); }
  };

  const showing = q.trim() ? "Matches" : loc ? "Gyms near you" : "";
  return (
    <Sheet title={title} onClose={onClose} testId="sheet-gym-picker">
      <div className="stack">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input ref={inputRef} className="input" style={{ paddingLeft: 36 }} placeholder="Gym name or city" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} autoCapitalize="words" data-testid="input-gym-search" />
          </div>
          <button className={`btn ${loc ? "btn-primary" : "btn-outline"}`} onClick={nearMe} disabled={locating} aria-label="Use my location" data-testid="button-gym-near-me" style={{ minWidth: 44 }}>
            <LocateFixed size={18} />{locating ? "…" : loc ? "" : " Near me"}
          </button>
        </div>
        {locDenied && <p className="text-xs muted" data-testid="text-location-denied">Location is off for this app. Type the gym name instead, or allow location in your phone's settings.</p>}
        {!loc && !q.trim() && !locDenied && <p className="text-xs muted">Type the gym's name, or tap Near me to list gyms around you.</p>}
        {err && <Empty>{err}</Empty>}
        {showing && results && !err && (
          <>
            <div className="section-title"><h2>{showing}</h2>{busy && <span className="label">searching…</span>}</div>
            {results.length === 0 && !busy && <Empty>{q.trim() ? "No gyms match. Try fewer words or the city name." : "No gyms found nearby. Try typing the name."}</Empty>}
            <div className="card" style={{ padding: "0 12px" }} data-testid="list-gym-results">
              {results.map((p) => (
                <button key={p.placeId} className="rowline w-full text-left" style={{ background: "none", border: 0, borderTop: "1px solid var(--line)" }} onClick={() => pick(p)} disabled={picking !== null} data-testid={`pick-gym-${p.placeId}`}>
                  <MapPin size={18} className="muted shrink-0" />
                  <span className="flex-1 min0">
                    <span className="text-sm font-semibold block truncate">{p.name}</span>
                    <span className="text-xs muted block truncate">{[p.address, fmtDist(p.distanceKm)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.members ? <span className="chip chip-lime shrink-0" title="Corpus members who train here"><Users size={12} /> {p.members}</span> : null}
                  <span className="text-xs font-semibold shrink-0" style={{ color: "var(--ink)" }}>{picking === p.placeId ? "…" : cta}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {provider && results && results.length > 0 && (
          <p className="text-[11px] faint text-right" data-testid="text-gym-attribution">{provider === "google" ? "Powered by Google" : "Map data from OpenStreetMap contributors"}</p>
        )}
      </div>
    </Sheet>
  );
}
