# UI redesign + first-run tour — spec

Decided in an interview on 2026-11-08. Goal: make RXS calm and easy to understand for lifters of **mixed experience**.

## Problems we're fixing

1. **Too much on each screen.** Today stacks readiness rings, a score breakdown, alerts, the exercise table, calorie/protein rings, favorites and a report link.
2. **Jargon.** RIR, e1RM, FIG. 01, [NOTE], SESSION 004, "Confidence", "Lab report".
3. **Too many places.** 5 tabs, 13 sub-tabs and 3 sheets, so it's hard to know where things live.

## 1. Visual style: calm it down (keep the identity)

- Keep the cobalt/bone colors, logo, and Archivo Black, but only for the main page title.
- Use a readable sans-serif (for example Inter or Archivo) for body text and labels. Keep Space Mono only for numbers (weights, reps, kcal).
- Use sentence case everywhere. Drop forced `text-transform: uppercase` on `.label`, `.corner`, tabs and buttons.
- Thin the rules: 3px down to 1px, and 2px tab dividers down to none. Use spacing to separate things instead of borders.
- Pink (`--signal`) is only for highlights (PRs, alerts). Remove it from the page header background.
- Turn grain **off** by default. It stays available as an option in Me → App.
- Remove the corner metadata (`RXS // ENGINE`, `SESSION 004 · 11.08.26`, `[TODAY]`) from `PageHeader`. Keep the title plus at most one short subtitle.
- Remove the `FIG. 0x` captions and the `[NOTE]` prefixes. Plain sentences say the same thing.

## 2. Navigation: 4 tabs

| Tab | Contains | Moved from |
|---|---|---|
| **Today** | Check-in, readiness, today's workout, alerts, nutrition row | Today |
| **Train** | Workout (logger), Program | Train (History moves to Progress) |
| **Progress** | Body (fatigue), Trends, History · "More": Lab report, Experiments, Photos (Vault) | Body + Train subs |
| **Social** | Feed, Crews · "More": Gym, Find, Leaderboards | Spotters |

- **Me** becomes an avatar button in the top-right of every page header. It opens the profile and settings page.
- **Coach** stays a sheet, opened from a header button on Today.
- Each tab has at most **2–3 sub-tabs**. Tucked-away features (Experiments, Leaderboards/Gym/Find, Vault, Lab report) go into a "More" list at the bottom of their tab. They stay one tap away but are never shown as main sub-tabs.
- Update deep links in `Notifications.tsx`/`sw.js` (`?go=train&sub=lab` etc.) so they point to the new locations.

## 3. Today screen

Order, top to bottom:

1. **Check-in card (until done today).** A big primary card reading "How are you today? · 20 sec" that opens the check-in sheet. Once the check-in is done, it shrinks into item 2.
2. **Readiness.** Shows the number and one plain line of meaning (e.g. "72 — good to progress today"). The rings, breakdown, confidence and input count move behind a "Why?" tap.
3. **Alerts.** Deload and plateau warnings appear only when they apply, one compact card each.
4. **Workout card.** Shows the day name, "6 exercises · ~55 min" and a **Start workout** button. The full exercise table collapses behind "See exercises". On rest days it shows one line plus "Train anyway".
5. **Nutrition row.** One slim line, `1,240 / 2,600 kcal · 98 / 180 g protein  [+]`. Tapping it opens Log meal. Favorites live inside the meal sheet, not on Today.

The install banner and notification nudge should show at most one at a time and be dismissible for good.

## 4. Jargon: tooltips

Keep the current terms, but add an info icon (ⓘ) after each one. Tapping the icon opens a short explanation in a popover. Put all the definitions in one glossary file (`client/src/lib/glossary.ts`) so the wording stays the same everywhere. Initial terms:

- **RIR**: Reps in reserve, meaning how many more reps you could have done. 2 RIR = 2 left in the tank.
- **e1RM**: Estimated one-rep max, worked out from your logged sets.
- **Readiness**: A 0–100 score from your check-in (sleep, energy, soreness…) that adjusts today's targets.
- **Confidence**: How many check-in inputs the readiness score is based on.
- **Deload**: A lighter week (about 60% of usual sets) that lets fatigue clear.
- **Plateau**: No e1RM gain on a lift in 3 sessions.
- **Fatigue %**: How much recent training load a muscle is still recovering from.
- **Working sets**: Sets that count toward progress, not counting warm-ups.

## 5. Workout logger: one exercise at a time

- A focus view shows the current exercise name, its target (e.g. "135 lb × 8–10 · 2 RIR"), large weight and rep inputs, and a "Log set" button.
- The rest timer starts automatically after each logged set.
- Swipe left or right, or use Next/Prev, to move between exercises. A thin progress strip at the top shows "Exercise 3 of 6".
- An "All exercises" button opens the list view for reordering or jumping around.
- Secondary details (fatigue tags, set quality, notes) sit behind a "More" toggle on each set.

## 6. Onboarding: trim to the essentials

Setup goes from 6 steps to **3**:

1. **About you.** Name, units, weight, height, age, sex (optional).
2. **Goal & experience.** As today.
3. **Pick a program.** Template cards only. "Customize" and "Build from scratch" move to Train → Program after setup.

- Calorie and protein targets appear as one summary line on the final step ("You'll aim for 2,600 kcal and 180 g protein a day"), with a link that explains how they're calculated.
- The pledge becomes optional. It's offered after the tour or in Me, not as a required step.
- Keep "Load demo data" on the welcome screen.

## 7. First-run spotlight tour

**When it shows:** once, right after a **new** account finishes onboarding. It doesn't show for existing accounts. It is not shown in demo mode or when a coach is viewing a client's account.

**How it works:** the screen is dimmed except for a cut-out around the real element being explained. A caption card sits next to it with **Next**, **Back**, **Skip tour** and a step count ("2 of 8"). The tour switches tabs itself when a step needs it. Each step targets an element by its existing `data-testid`.

| # | Target | Caption |
|---|---|---|
| 1 | — (centered) | Welcome to RXS. Here's a 30-second look around. |
| 2 | `button-open-checkin` | Start every day here. Your 20-second check-in sets your readiness score. |
| 3 | readiness card | Readiness adjusts today's weights. Tap ⓘ on any term you don't know. |
| 4 | `button-start-workout` | Your workout for today. Tap Start and log each set as you go. |
| 5 | nutrition row | Log meals here to track calories and protein against your targets. |
| 6 | `tab-progress` | See fatigue, trends, history and your weekly report. |
| 7 | `tab-social` | Train with friends: share PRs, join crews, keep streaks. |
| 8 | Coach button / avatar | Ask the Coach anything. Settings and "Replay tour" live under your avatar. |

**State:**

- Add `tourDone?: boolean` to `Profile` in `client/src/lib/types.ts`. It's saved with the account state, so the tour doesn't repeat on other devices.
- Set it to `true` on finish **or** skip.
- New accounts start with `tourDone: false`. Existing accounts treat the missing field as "done", so they never see the tour.

**Replay:** a "Replay tour" button in Me → App sets `tourDone: false` and goes to Today.

**Implementation:**

- Write a small `components/Tour.tsx`: a fixed overlay, a box-shadow cut-out around `getBoundingClientRect()` of the target, scroll-into-view, and a reposition on resize.
- Skip any step whose target isn't on the page.
- Escape key and Skip both end the tour. Focus stays inside the caption card.
- With `prefers-reduced-motion`, the cut-out jumps between targets instead of animating.

## Suggested build order

1. Style pass: fonts, case, borders, header, grain default. The look changes everywhere at once with little code.
2. Navigation restructure to 4 tabs, the avatar button for Me, the "More" lists and the deep-link updates.
3. Today screen rework, plus the glossary tooltips.
4. Onboarding trim.
5. Spotlight tour. This comes after steps 2–3 so it targets the final layout.
6. Focus-mode workout logger. This is the largest change, so it ships on its own.
