# Manual exercise picker — design

The random picker covers the "throw something at me" use case. The
manual picker is for when the user wants to grind on something specific
("I want walking 6ths in A minor with my mid-hand position right now").

## The dimensions

| Dimension     | Count                                           | Notes                                                                  |
|---------------|-------------------------------------------------|------------------------------------------------------------------------|
| Scale         | ~30                                             | Grouped by category (major / minor / modes / modes-of-minor / pent / blues / chromatic / octatonic) |
| Key           | 17                                              | Reduced to ~7–14 depending on scale (some keys filtered for impossible spellings) |
| Variant       | plain, mo-A 2/3oct, mo-B 2oct, cons 3/4, mirror 3/4, walk ±N for N=1..7 | ~16 variants but many are scale-dependent (e.g. walk +7 unavailable on 5-note pentatonic) |
| Hand position | 3                                               | front, mid, back                                                       |
| Tuning        | 4                                               | 4-string EADG, 5-string BEADG, 5-string EADGC, 6-string BEADGC          |
| Open variant  | 0 or 1                                          | Only available for specific root + tuning + front-hand combos          |

Total universe with default settings: ~17,000 exercises. A flat list is
no good.

## Two proposals

### Proposal A — Browse with filters (recommended)

A single panel/screen titled **Browse exercises**. Top half is filter
chips; bottom half is a scrollable list of matching exercises, each a
single-line entry the user can tap to load.

```
┌─ Browse exercises ─────────────────┐
│ Scale     [Major] [Minor]…         │  ← multi-select chips by scale CATEGORY
│ Key       [C][Db][D][Eb]…          │  ← single tap = focus to that key
│ Variant   [Plain][1-2-3]…          │  ← grouped chips
│ Hand      [☝️][🖐️][🤙]              │
│ Tuning    [4-string EADG] ▾        │  ← dropdown (rare to change)
├────────────────────────────────────┤
│ C Major — scale ↕ — ☝️             │  ← tap to load + close panel
│ C Major — 1-2-3 ↕ — ☝️             │
│ C Major — Walking 3rds ↑ — ☝️      │
│ … (paginated or windowed)          │
└────────────────────────────────────┘
```

Filters narrow the list incrementally. Counter shows "234 exercises
match"; if user wants narrower, more filters. When the list is short
enough, they tap one.

Why this works:
- Mirrors how the settings panel already filters the random picker, so
  the mental model is shared.
- Lets users access via ANY dimension first (scale-first, key-first,
  variant-first).
- Discoverable — they see everything available without committing to a
  path.
- One click loads the exercise.

Downsides:
- A long list when no filters are applied. Use virtualized rendering
  if performance becomes a concern (currently 17K exercises is fine
  in-memory; rendering them all is the bottleneck).

### Proposal B — Wizard (alternative)

Stepper UI: tap through Scale → Key → Variant → Hand → done.

```
┌─ Pick an exercise (step 1/4) ──────┐
│ Choose a scale:                    │
│   [Major]  [Natural Minor]         │
│   [Harmonic Minor] [Dorian] …      │
├────────────────────────────────────┤
│             [Cancel] [Skip] [Next] │
└────────────────────────────────────┘
```

Each step's options are filtered by the previous choices ("what's
playable given prior selections"). Skip = "any" for that dimension and
go to the next step. Final step plays the resulting exercise.

Why this might work:
- Simple, linear, can't get lost.
- Maps nicely to a sentence: "Play me a Major scale in C with the mid
  hand."

Downsides:
- More clicks per pick.
- Doesn't let the user iterate easily ("show me the same scale in a
  different key" requires going through several steps again).
- Less discoverable — you don't see what's available until you commit.

## Recommendation

**Go with Proposal A** (Browse with filters).

It plays better with how the random picker already works
(filter-and-pick), it covers both "I want this specific exercise" and
"I want any walking-7ths exercise" use cases with the same UI, and it's
fewer taps to get to the exercise once you know what you want.

## Implementation sketch (Proposal A)

- **Component:** `src/components/BrowsePanel.svelte`. Slide-out panel
  like `SettingsPanel.svelte` and `AboutPanel.svelte`. Triggered from a
  topbar icon (e.g. a magnifying glass).
- **Filter state:** local to the component — does NOT touch the
  settings store (the random picker should remain independent). A
  `$state` object with the user's current filter selections.
- **Universe source:** call `generateUniverse(syntheticSettings)` where
  `syntheticSettings` is an all-enabled settings derived from the user's
  current `tuningId`. Then filter in-memory by the user's filter
  choices.
- **List rendering:** if list ≤ 200 items, render naïvely. If more, use
  a simple virtualized list (the browser's intersection observer is
  enough for our needs; no external dep).
- **Selection:** clicking an item calls a callback that hands the
  `ExerciseParams` back to `App.svelte`, which generates the exercise
  (`generateExercise(params)`) and pushes it onto the current-exercise
  state (similar to how the random `pickNext()` works today). Close the
  panel.
- **Result name:** title each entry with `formatDisplayName(params)`
  (already in scale-generator.ts) so the list reads exactly like the
  topbar shows once loaded.

### App-level wiring
- New state `browseOpen = $state(false)` in App.svelte.
- New topbar button (probably a 🔍 or "Browse" text).
- `<BrowsePanel open={browseOpen} onClose={() => (browseOpen=false)} onPick={(params) => { ... }} />`

### Mobile UX
The filter chips wrap naturally. The result list scrolls. The slide-out
panel is already mobile-friendly (it covers most of the viewport on
narrow widths via `width: min(420px, 92vw)`).

## Future enhancements (not for v1)

- **"More like this"** — given the current exercise, show a related-list
  (same key, different variants; or same variant, all keys; etc).
- **Save favorites** — pin specific exercises for quick access.
- **Progress tracking** — mark exercises as "comfortable" / "needs
  work" and let that influence the random picker's weighting.
