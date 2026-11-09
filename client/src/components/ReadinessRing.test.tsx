import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadinessRing } from "./ReadinessRing";
import { PREVIEW_STATES } from "@/pages/DevReadiness";

const html = (el: JSX.Element) => renderToStaticMarkup(el);
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/** Tags removed with nothing added, so "58<span>%</span>" reads "58%". */
const flat = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("ReadinessRing preview states", () => {
  const expected: Record<string, { center: string; label: string; tag: string | null; band: string; aria: string }> = {
    "0": { center: "0%", label: "LOW", tag: "[EASE OFF]", band: "low", aria: "Readiness 0 percent, low. Ease off." },
    "34": { center: "34%", label: "LOW", tag: "[EASE OFF]", band: "low", aria: "Readiness 34 percent, low. Ease off." },
    "58": { center: "58%", label: "MODERATE", tag: "[HOLD]", band: "moderate", aria: "Readiness 58 percent, moderate. Hold." },
    "100": { center: "100%", label: "HIGH", tag: "[PUSH]", band: "high", aria: "Readiness 100 percent, high. Push." },
    "No data": { center: "—", label: "NO CHECK-IN", tag: null, band: "none", aria: "Readiness, no check-in yet" },
  };

  it.each(PREVIEW_STATES.map((s) => [s.name, s.value] as const))("%s", (name, value) => {
    const e = expected[name];
    const m = html(<ReadinessRing value={value} />);
    const t = text(m);
    expect(flat(m).startsWith(e.center)).toBe(true);
    expect(t).toContain(e.label);
    if (e.tag) expect(t).toContain(e.tag); else expect(t).not.toContain("[");
    expect(m).toContain(`data-band="${e.band}"`);
    expect(m).toContain(`aria-label="${e.aria}"`);
  });
});

describe("ReadinessRing arc", () => {
  it("draws no arc at 0 or with no data", () => {
    expect(html(<ReadinessRing value={0} />)).not.toContain("readiness-ring-arc");
    expect(html(<ReadinessRing value={null} />)).not.toContain("readiness-ring-arc");
  });
  it("arc length matches the score, in the band color", () => {
    const m = html(<ReadinessRing value={58} />);
    expect(m).toContain('stroke-dasharray="58 100"');
    expect(m).toContain('stroke="#B8236A"');
  });
  it("clamps out-of-range values", () => {
    expect(html(<ReadinessRing value={-12} />)).toContain("0<span");
    const over = html(<ReadinessRing value={180} />);
    expect(over).toContain('stroke-dasharray="100 100"');
    expect(flat(over).startsWith("100%")).toBe(true);
  });
  it("treats NaN as no data", () => {
    expect(html(<ReadinessRing value={NaN} />)).toContain('data-band="none"');
  });
  it("animates unless told not to", () => {
    expect(html(<ReadinessRing value={58} />)).toContain("rr-animate");
    expect(html(<ReadinessRing value={58} animate={false} />)).not.toContain("rr-animate");
  });
});

describe("ReadinessRing props", () => {
  it("becomes a button that announces the breakdown when tappable", () => {
    const m = html(<ReadinessRing value={58} onClick={() => {}} expanded={false} />);
    expect(m.startsWith("<button")).toBe(true);
    expect(m).toContain('aria-label="Readiness 58 percent, moderate. Hold. Show breakdown."');
    expect(m).toContain('aria-expanded="false"');
  });
  it("is an image when not tappable", () => {
    expect(html(<ReadinessRing value={58} />)).toContain('role="img"');
  });
  it("shows low confidence only with a score", () => {
    expect(text(html(<ReadinessRing value={58} lowConfidence />))).toContain("Low confidence");
    expect(text(html(<ReadinessRing value={null} lowConfidence />))).not.toContain("Low confidence");
  });
  it("honors band, label, tag and size overrides", () => {
    const m = html(<ReadinessRing value={58} band="high" label="CUSTOM" tag={false} size={200} />);
    expect(m).toContain('data-band="high"');
    expect(text(m)).toContain("CUSTOM");
    expect(text(m)).not.toContain("[PUSH]");
    expect(m).toContain('width="200"');
  });
});
