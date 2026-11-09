// First-run spotlight tour: dims the app, cuts a hole around one real element at a time, and explains it.
// Shown once to new accounts (profile.tourDone === false); Skip or Done marks it finished. The pledge offer at the end only shows when PLEDGE_ENABLED. Replay from Profile → App.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useUI } from "@/App";
import { PLEDGE_ENABLED, PledgeSheet } from "@/components/Pledge";

interface Step {
  /** data-testids to look for, first one on screen wins. None (or none found) = centered card. */
  targets?: string[];
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { title: "Welcome to Corpus", text: "Here's a 30-second look around. You can skip anytime." },
  { targets: ["card-checkin-cta", "card-readiness"], title: "Start every day here", text: "A 20-second check-in on sleep, energy and soreness gives you a readiness score. It decides whether today's weights go up, hold or come down." },
  { targets: ["info-workingSets", "info-readiness", "info-rir"], title: "Not sure what a term means?", text: "Tap the ⓘ next to any training term, like RIR or Readiness, for a one-line explanation." },
  { targets: ["card-today-session", "card-empty-day", "card-rest-day", "card-no-program"], title: "Today's workout", text: "Your program picks the session and the weights. Tap Start workout and log each set as you go. On rest days you can still train anyway." },
  { targets: ["button-open-nutrition"], title: "Food", text: "Tap here to log meals. Calories and protein fill up against your daily targets." },
  { targets: ["tab-progress"], title: "Progress", text: "Muscle fatigue, strength trends and past workouts. The weekly report, experiments and photos are under More." },
  { targets: ["tab-social"], title: "Social", text: "Train with friends: share PRs, give respect, and keep streaks going together." },
  { targets: ["button-open-coach"], title: "Ask the Coach", text: "Questions about your training, sleep or food? The Coach answers from your own data." },
  { targets: ["button-open-profile"], title: "Profile & settings", text: "Your details, targets, notifications and data live here. So does Replay tour, if you want this again." },
];

const PAD = 6;
const GAP = 12;

function findTarget(step: Step): HTMLElement | null {
  for (const id of step.targets ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (el && el.getClientRects().length) return el;
  }
  return null;
}

export function Tour() {
  const { set, profile } = useStore();
  const ui = useUI();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [finished, setFinished] = useState(false);
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Start on Today with nothing open.
  useEffect(() => { ui.open(null); if (ui.tab !== "today") ui.setTab("today"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const done = useCallback(() => { set((s) => ({ ...s, profile: s.profile ? { ...s.profile, tourDone: true } : s.profile })); }, [set]);

  // Find, scroll to and measure the current target; keep it measured on scroll/resize.
  useLayoutEffect(() => {
    if (finished) return;
    const el = findTarget(step);
    if (!el) { setRect(null); return; }
    const fixed = getComputedStyle(el.closest(".tabbar") ?? el).position === "fixed";
    if (!fixed) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const t = window.setTimeout(measure, reduce ? 0 : 400);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [i, finished, step, reduce]);

  useEffect(() => { nextBtn.current?.focus({ preventScroll: true }); }, [i, finished]);

  const next = () => (last ? (PLEDGE_ENABLED && !profile.pledgedAt ? setFinished(true) : done()) : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); done(); return; }
    if (e.key === "ArrowRight" && !finished) { e.preventDefault(); next(); return; }
    if (e.key === "ArrowLeft" && !finished) { e.preventDefault(); back(); return; }
    if (e.key !== "Tab" || !card.current) return;
    const f = [...card.current.querySelectorAll<HTMLElement>("button")];
    if (!f.length) return;
    const idx = f.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    f[(idx + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  };

  if (pledgeOpen) return <PledgeSheet onClose={() => { setPledgeOpen(false); done(); }} />;

  // Caption placement: below the hole if there's room, otherwise above; centered when there's no target.
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(340, vw - 32);
  const hole = rect && !finished ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  let pos: CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: w };
  if (hole) {
    const left = Math.max(16, Math.min(hole.left + hole.width / 2 - w / 2, vw - 16 - w));
    const below = hole.top + hole.height + GAP;
    pos = vh - below > 200 ? { top: below, left, width: w } : { top: Math.max(16, hole.top - GAP), left, width: w, transform: "translateY(-100%)" };
  }

  return createPortal(
    <div className="tour" data-testid="tour" onKeyDown={onKey}>
      {/* Blocks taps on the app while the tour runs. */}
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {hole ? <div className="tour-hole" style={hole} aria-hidden /> : <div className="tour-dim" aria-hidden />}
      <div ref={card} className="tour-card" style={pos} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" data-testid="tour-card">
        {finished ? (
          <>
            <div className="label">All set</div>
            <h2 id="tour-title" className="display text-[20px] mt-1">You're ready for day one</h2>
            <p id="tour-text" className="text-sm mt-1">Want to make it official? The pledge is four promises to yourself. It's optional, and you can sign later in Profile.</p>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-sm btn-ghost" onClick={done} data-testid="button-tour-done">Maybe later</button>
              <div className="flex-1" />
              <button ref={nextBtn} className="btn btn-sm btn-primary" onClick={() => setPledgeOpen(true)} data-testid="button-tour-pledge">Sign the pledge</button>
            </div>
          </>
        ) : (
          <>
            <div className="label" aria-live="polite">{i + 1} of {STEPS.length}</div>
            <h2 id="tour-title" className="display text-[20px] mt-1">{step.title}</h2>
            <p id="tour-text" className="text-sm mt-1">{step.text}</p>
            <div className="flex items-center gap-2 mt-4">
              <button className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }} onClick={done} data-testid="button-tour-skip">Skip tour</button>
              <div className="flex-1" />
              {i > 0 && <button className="btn btn-sm btn-outline" onClick={back} data-testid="button-tour-back">Back</button>}
              <button ref={nextBtn} className="btn btn-sm btn-primary" onClick={next} data-testid="button-tour-next">{last ? "Done" : i === 0 ? "Show me" : "Next"}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
