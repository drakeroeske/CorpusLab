# Brand pass: bone, logo in the app, new type

Agreed 2026-11-09. This builds on the `new-logo` branch, where the logo and pink #E94191 are already in.

## Colors

| Use | Color |
|---|---|
| Page background | Bone `#ECE8DF` |
| Cards, sheets, inputs, menus | Darker bone, about `#E0DACD` |
| Text on pink buttons, toasts, anything that was white | Bone `#ECE8DF` |
| Body text and typed text | Logo black `#1A1A1A` |
| Titles, buttons, charts, active states, logo square | Pink `#E94191` |

- No pure white or near-white (`#FFF`, `#F2F1EC`, white mixes) left in the app UI.
- **Highlights:** alert and PR cards lose the light pink `#E9A6D8` background. They use darker bone with a pink line down the left edge.
- The toast keeps its dark background, with bone text.

## Type

| Text | Font |
|---|---|
| Page titles, section titles, sheet titles | Archivo Black, ALL CAPS |
| Everything else in words: sentences, notes, buttons, tabs, chips, labels, exercise names, list rows | IBM Plex Mono, logo black |
| Typed text in inputs and text areas | IBM Plex Mono, logo black |
| Every number: big stats (readiness, weights), small numbers, and the weight and rep boxes you type into | Inter, bold, tabular figures |

- Space Mono is removed. Inter stays only for numbers.
- Google Fonts adds IBM Plex Mono (400, 500, 600, 700).
- Buttons stay sentence case ("Start workout"), not caps.

## Logo in the app

- **All four tabs** (Today, Train, Progress, Social): small logo top-left in the top bar, with the tab's title (TODAY, TRAIN…) under it. The tab's own buttons, like Coach and the avatar, stay on the right.
- **Loading screen:** a centered logo on bone while the app first loads, before the app's code has run, so it lives in `index.html`.
- Sign-in, onboarding and privacy already show the logo.

## Build steps

1. **Colors:** bone and darker-bone tokens, remove whites, darker-bone highlight cards with a pink edge.
2. **Fonts:** load IBM Plex Mono. Point reading text, buttons, labels and inputs at Plex Mono, titles at caps Archivo, and numbers at bold Inter. Sweep for numbers still styled with the old classes.
3. **Logo:** top bar on all four tabs, plus the loading screen.
4. **Check:** typecheck, build, and look at every tab on a phone-sized screen, including sheets and the workout logger.

## Open risk

- Plex Mono is wider than Inter. Long labels, buttons and chips may wrap or truncate on narrow phones, so step 4 checks the logger, segmented controls and chips closely.

> **Update:** body text later moved from IBM Plex Mono to Space Grotesk (see READINESS-RING.md).

## As built (2026-11-09)

All four steps are done. Differences from the plan above:

- **Sheets stay bone**, not darker bone, so the darker-bone cards inside them still show.
- **Input boxes inside a darker-bone card are plain bone**, so they still read as fields (for example the logger's weight and rep boxes).
- **Text color moved in step 1:** body text became logo black (#1A1A1A) along with the bone colors.
- **Profile keeps its old header** (Back button and title, no logo). Every other screen header shows the logo.
- **Number boxes:** any box marked as a number field (weight, reps, age, targets) types in bold Inter.
- **Exercise names stay in Plex Mono**, including the big name at the top of the logger.

Checked at phone width (375 px): sign-up, onboarding, tour, every tab and sub-tab, Profile, Privacy, Coach, check-in, start-workout, plate calculator, swap, warm-up, the exercise picker, new custom exercise, the workout logger and its summary. No sideways scrolling, nothing cut off, no white.
