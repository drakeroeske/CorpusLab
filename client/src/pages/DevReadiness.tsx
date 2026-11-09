// Hidden preview of the readiness ring's states (#/dev/readiness). Not linked anywhere in the app.
import { useState } from "react";
import { ReadinessRing } from "@/components/ReadinessRing";

export const PREVIEW_STATES: { name: string; value: number | null }[] = [
  { name: "0", value: 0 },
  { name: "34", value: 34 },
  { name: "58", value: 58 },
  { name: "100", value: 100 },
  { name: "No data", value: null },
];

export default function DevReadiness({ onBack }: { onBack: () => void }) {
  const [run, setRun] = useState(0);
  return (
    <div className="surface-riso" style={{ minHeight: "100vh" }}>
      <div className="screen" style={{ paddingTop: 24 }}>
        <button className="btn btn-sm btn-outline" onClick={onBack} data-testid="button-dev-back">← Back to app</button>
        <h1 className="display text-[28px] mt-4">Readiness ring</h1>
        <p className="text-sm muted mt-1">Preview states. Not linked in the app.</p>
        <button className="btn btn-sm mt-3" onClick={() => setRun(run + 1)} data-testid="button-replay">Replay animation</button>
        {[112, 200].map((size) => (
          <section key={`${size}-${run}`} className="mt-6">
            <div className="label mb-3">{size}px on the page</div>
            <div className="flex flex-wrap gap-6">
              {PREVIEW_STATES.map((s) => <ReadinessRing key={s.name} value={s.value} size={size} testId={`preview-${size}-${s.name.replace(" ", "-").toLowerCase()}`} />)}
            </div>
            <div className="label mt-6 mb-3">{size}px on a card, tappable, low confidence</div>
            <div className="card flex flex-wrap gap-6">
              {PREVIEW_STATES.map((s) => <ReadinessRing key={s.name} value={s.value} size={size} lowConfidence onClick={() => {}} expanded={false} testId={`preview-card-${size}-${s.name.replace(" ", "-").toLowerCase()}`} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
