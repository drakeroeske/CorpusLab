# Rename, pledge, and custom workouts

Decided in an interview on 2026-11-09. Three changes: rename the app back to **Corpus**, hide the pledge, and let people train beyond the built-in catalog.

## 1. Rename RXS → Corpus

- **Wordmark and display headers:** `CORPUS`, in the all-caps display font. In running text it's "Corpus".
- **Scope: everywhere users can see it.**
  - `client/index.html`: title, meta description, `apple-mobile-web-app-title`.
  - Wordmark in `components/ui.tsx`.
  - The PR share image (`PRCard.tsx`: "VERIFIED BY CORPUS" and the footer wordmark) and the "Verified by" line in `PostCard.tsx`.
  - Install hints, notification copy, recovery-code file, program share text, Privacy page, Coach, Experiments, Profile footer, Onboarding welcome, Tour step 1.
  - Server: push titles and invite copy in `server/routes.ts`, the comment in `push.ts`, and the food lookup User-Agent in `foods.ts`.
  - The `README.md` heading.
- **Keep the tagline:** "Every rep, meal, and night's sleep — connected."
- **Leave internal names alone:** storage keys, cookies and env vars already use `corpus`.
- **Export file check:** `Profile.tsx` rejects imports with the error "Not an RXS export". The check itself never looks for the brand, so only the error text changes.

## 2. Hide the pledge

Hide it, don't delete it, so it can come back later.

- Remove the Profile `PledgeCard` and the tour's end-of-tour pledge offer. The tour's last step becomes **Done**, and that just ends it.
- Keep `components/Pledge.tsx` and `profile.pledgedAt` in the code, but nothing renders them. Put a single `PLEDGE_ENABLED = false` flag next to the component so it's easy to turn back on.
- Drop "the pledge" from the onboarding comment.

## 3. Custom workouts

### 3a. Your own exercises

- **Create one** from the exercise picker with **Create exercise** at the bottom of the list. It's also offered when a search finds nothing, with the search text pre-filled as the name.
- **Fields:**
  - Name.
  - One or more **main muscles**, picked from the existing muscle list.
  - **Equipment**, picked from the existing list.
  - Everything else is derived: secondary muscles are empty; the movement pattern is a best guess from the muscles (shown under "Advanced" so it can be changed); the strength ratio is 1.
  - That keeps fatigue, weekly sets and plate math working.
- **Picker:** a **Your exercises** group sits at the top, and each one has an edit button. Custom exercises show a small "Custom" chip wherever they're listed.
- **Editing:** renaming and changing muscles are always allowed. Delete is blocked while the exercise is in the program or a saved workout ("Remove it from X first"). Past history is always kept.
- **Data:** add `customExercises: Exercise[]` to `AppState`, with ids prefixed `cx_`. `EX` is looked up in about 50 places, so custom exercises are merged into the `EX` registry whenever the store loads or changes (`registerCustomExercises`), and existing `EX[id]` lookups keep working. Unknown ids fall back to "Unknown exercise" instead of crashing.
- **Sharing:** shared programs carry the custom exercises they use. Importing adds them to the friend's library, skipping any whose id is already there.

### 3b. Building a program from scratch

- **Signup, step 3 (Pick a program):** add **Build my own** as an equal option next to the three ready-made programs. Choosing it shows a day picker (which weekdays you train). Finishing creates empty days named "Day 1", "Day 2"…
- **After signup:** Today's workout card says "Add exercises to Day 1" and links to Train → Program. The tour's workout step already accepts the no-program card; add an empty-day state too.
- **Train → Program:** the existing "Start from a blank program" stays. Rename the sheet's choice to **Build my own** so the two places use the same words.

### 3c. Freestyle workouts

- **Where to start one:**
  - **Train → Workout:** next to today's planned session, a **Start a different workout** link opens a sheet listing **Empty workout** and the saved workouts.
  - **Today:** the same link on the workout card. On rest days it sits next to "Train anyway".
- **An empty workout** opens the focus logger with an **Add exercise** button. With no exercises yet, the screen shows only that button. Exercises can be added at any time from the All exercises list.
- **Weights:** if you've done the exercise before, the logger prefills your last top set's weight and reps and applies today's readiness adjustment (hold or −10%). If you haven't, it starts blank. No double-progression bump, since there's no program target.
- **Data:** `Session.dayId` becomes `"free"` for empty workouts and `"saved:<id>"` for saved ones. `dayName` is "Freestyle" or the saved workout's name. Freestyle sets count toward history, PRs, fatigue and weekly sets like any other. Program progression (plateaus, next week's targets) only reads sessions whose `dayId` is a program day.

### 3d. Saved workouts

- **Data:** `savedWorkouts: { id; name; exercises: ProgramExercise[] }[]` in `AppState`.
- **Three ways to create one:**
  1. **After a workout:** the session summary gets **Save as workout**, which takes a name. It captures the exercises and set counts, with rep ranges taken from what was logged.
  2. **Editor:** Train → Program gets a **Saved workouts** list, edited with the same editor as a program day.
  3. **From a program day:** each day's menu gets **Save as workout**.
- **Starting one** follows the freestyle flow and uses the program's weight suggestions when the exercise is in the program, otherwise the last-session weights.
- Saved workouts never change the weekly schedule.

## Build order

1. Rename (quick, low risk).
2. Hide the pledge.
3. Custom exercises: data, registry, picker, create and edit sheet, sharing.
4. Freestyle workouts: start sheet, empty logger, weight suggestions.
5. Saved workouts: data, the three ways to create one, starting one.
6. Build my own in signup, plus the empty-day state on Today.

## Not in scope

- Exercise videos or notes on custom exercises.
- Sharing saved workouts on their own (only whole programs share).
- Scheduling saved workouts onto calendar days.
