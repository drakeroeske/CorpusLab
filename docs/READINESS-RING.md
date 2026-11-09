# Today cleanup, body font, readiness ring

Agreed 2026-11-09, on the `new-logo` branch.

## 1. Remove the experiment card from Today

- Delete the daily yes/no card (for example "Took 5 g creatine today?") from Today.
- The check-in sheet already asks the same question while an experiment runs, so nothing is lost.

## 2. Body font: Space Grotesk

- **Why:** Plex Mono looked like a typewriter or code, and its rounded shapes clashed with the blocky logo.
- **Space Grotesk** replaces IBM Plex Mono for all words: sentences, buttons, labels, chips and typed text. Weights 400, 500, 600 and 700.
- **Unchanged:** titles stay ALL CAPS Archivo Black, and numbers (including number boxes) stay bold Inter.
- IBM Plex Mono stops loading. The PR share image switches its words to Space Grotesk too.

## 3. Readiness ring

### Placement

- **Today:** the ring replaces the big "53" on the left of the readiness card, at 112 px. The headline ("Hold your weights today") stays on the right.
- The five-ring diagram in "Why?" is removed. The ring replaces it.
- **The pink "How are you today?" card goes away.** The readiness card always shows. Before you check in, the ring is empty and the card's button opens the check-in.

### Data (computed in the app, passed in as props)

The score is 0–100 and comes from the engine (`computeReadiness`). The component only displays what it's given.

| Input | Before | Now |
|---|---|---|
| Sleep hours | 30 | 25.5 |
| HRV vs 7-day baseline | 20 | 17 |
| Energy | 15 | 12.75 |
| Soreness in today's muscles | 15 | 12.75 |
| Sleep quality | 10 | 8.5 |
| Stress | 10 | 8.5 |
| **Training load (new)** | — | **15** |

- **Training load:** count hard sets logged in the last 2 days, and compare with your average for any 2 days over the past 4 weeks.
  - At or below your usual: full 15 points.
  - 50% or more above usual: 0 points.
  - In between: points shrink in a straight line.
  - With fewer than 2 weeks of history, load is left out.
- **Missing inputs:** as today, their weight is spread across the inputs that are present.
- **No check-in today:**
  - The ring shows an empty track with "—" in the middle.
  - The label reads NO CHECK-IN, and the card's button reads "Check in".
- **Few inputs** (low confidence, under 4): the score shows, with "Low confidence" under the label.

### Bands (same cutoffs as the engine, so the ring and the logger always agree)

| Score | Label | Tag | Arc color |
|---|---|---|---|
| 75–100 | HIGH | [PUSH] | Pink #E94191 |
| 50–74 | MODERATE | [HOLD] | Deep pink #B8236A |
| 0–49 | LOW | [EASE OFF] | Logo black #1A1A1A |

- EASE OFF means targets −10% and effort capped at 3 RIR. This is what the app already does, not a full deload.

### Ring style

- **Shape:** one ring for readiness only, starting at 12 o'clock and filling clockwise.
- **Arc:** a 10% stroke (relative to the ring's size), square line ends, solid fill.
- **Track:** one step darker than the surface it sits on, so it still shows on a darker-bone card.
- **Ticks:** 10 small marks just outside the ring, one every 10 points.
- **Center:** the big number with a % sign ("58%") in bold Inter. With no data it shows "—".
- **Under the ring:** the band label (MODERATE), with the [HOLD] tag below it, both ALL CAPS bold Space Grotesk.

### Behavior

- **Fill animation:** the arc sweeps from 0 to the score in about 0.8 s the first time it shows. With reduced motion on, it appears already filled.
- **Tap:** tapping the ring opens or closes the "Why?" breakdown: each input's points out of its max, plus confidence.
- **No change vs yesterday:** the ring doesn't show "↑ 6", since this wasn't chosen.

### Accessibility

- **Screen readers:**
  - The ring is a button labeled "Readiness 58 percent, moderate. Hold. Show breakdown".
  - With no data it reads "Readiness, no check-in yet".
  - Low confidence adds ", low confidence".
- **Color is never the only signal:** the label always names the band.
- **Contrast:**
  - The center number and the band text use logo black, which passes 4.5:1.
  - The pink arc on darker bone is about 2.7:1, under the 3:1 graphics guideline. That's acceptable because the text carries the meaning.
- **Tap target:** the whole ring is at least 44 × 44 px.

### Component

`<ReadinessRing value={58} band="moderate" label="MODERATE" size={112} />`

| Prop | Meaning |
|---|---|
| `value` | `number \| null`. Clamped to 0–100 and rounded. `null` means no data. |
| `band` | Optional. When left out, it comes from `readinessBand(value)`. |
| `label` | Optional text override. |
| `size` | Size in px. |
| `tag` | Shows the [PUSH]/[HOLD]/[EASE OFF] tag (on by default). |
| `lowConfidence` | Adds the "Low confidence" note. |
| `onClick` | Makes the ring tappable. |
| `animate` | Plays the fill animation (on by default). |

- No data is hard-coded. The band logic lives in one pure function, `readinessBand`, that the engine and the ring share.

### Previews and tests

- **Preview page:** `#/dev/readiness` (not linked in the app) shows 0, 34, 58, 100 and no data, at 112 px and 200 px.
- **Tests:** Vitest is added as a dev dependency, with an `npm test` script. The tests cover:
  - The band cutoffs: 0, 49, 50, 74, 75, 100.
  - Edge cases: null, negative numbers, over 100, NaN, decimals.
  - The training-load points.
  - That the ring shows the right number, label and screen-reader text for each preview state.

## As built (2026-11-09)

- Built as specced. The band logic, aria text and training load live in `client/src/lib/readiness.ts`, which has no imports. The engine's `readinessEffect` now calls `readinessBand`, so the logger and the ring can't disagree.
- The ring is `client/src/components/ReadinessRing.tsx`, styled in `index.css` (`.rr-*`). The fill animation is pure CSS, so it also renders server-side and turns off under reduced motion.
- **Scores shift a little:** load now takes 15 points and the other inputs shrink. The demo's readiness went from 53 to 60.
- **Tests:** `npm test` runs 54 Vitest tests, in `lib/readiness.test.ts` and `components/ReadinessRing.test.tsx`. They found one bug before launch: the screen-reader label had a double period ("Hold.. Show breakdown").
- **Preview page:** `#/dev/readiness`.
