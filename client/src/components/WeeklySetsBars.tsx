// Sets per muscle as bars against the 10–20 weekly target. Used for what you did (Progress) and what a program schedules (program builder).
import { MuscleName } from "./Term";
import { Bar } from "./ui";
import { r1, VOLUME_RANGE } from "@/lib/engine";
import { MINOR_MUSCLES, MUSCLE_GROUPS } from "@/lib/exercises";
import type { Muscle } from "@/lib/types";

export type VolumeStatus = "low" | "high" | "ok" | "minor";
export const volumeStatus = (m: Muscle, v: number): VolumeStatus =>
  v > VOLUME_RANGE.max ? "high" : MINOR_MUSCLES.has(m) ? "minor" : v < VOLUME_RANGE.min ? "low" : "ok";

export function WeeklySetsBars({ sets, testPrefix = "weekly-sets" }: { sets: Record<Muscle, number>; testPrefix?: string }) {
  return (
    <>
      {MUSCLE_GROUPS.map((g) => (
        <div key={g.id} className="mb-2" data-testid={`group-${testPrefix}-${g.id}`}>
          <div className="label mt-1 mb-1">{g.label}</div>
          {g.muscles.map((m) => {
            const v = sets[m] ?? 0;
            const st = volumeStatus(m, v);
            return (
              <div key={m} className="grid items-center gap-3" style={{ gridTemplateColumns: "112px 1fr 36px 44px", minHeight: 30 }} data-testid={`row-${testPrefix}-${m}`}>
                <span className="text-[13px]" style={{ lineHeight: 1.15 }}><MuscleName m={m} /></span>
                <div style={{ position: "relative" }}>
                  <Bar pct={(v / 24) * 100} color={st === "low" ? "var(--orange)" : st === "high" ? "var(--blue)" : "var(--lime)"} />
                  <i style={{ position: "absolute", top: -3, bottom: -3, left: `${(10 / 24) * 100}%`, width: 1, background: "var(--muted)" }} />
                  <i style={{ position: "absolute", top: -3, bottom: -3, left: `${(20 / 24) * 100}%`, width: 1, background: "var(--muted)" }} />
                </div>
                <span className="mono text-xs text-right">{r1(v)}</span>
                <span className={`label text-right ${st === "low" ? "orange" : st === "high" ? "blue" : st === "minor" ? "faint" : "lime"}`}>{st === "minor" ? "—" : st}</span>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
