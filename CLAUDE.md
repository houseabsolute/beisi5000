# Claude Code notes — bass practice app

A randomized bass-guitar practice app. Picks an exercise (scale + variant + key + hand position + bass type), renders it as standard notation + tab + a custom SVG fretboard, and runs a metronome alongside. Local-only — runs on the developer's machine and is reachable from a phone over the LAN.

**Roadmap & status:** [docs/plan.md](docs/plan.md). Read first if you're picking the project back up.

## Stack

TypeScript + Svelte 5 (runes) + Vite 6. AlphaTab renders notation/tab from AlphaTex emitted per exercise. Web Audio for the metronome. Custom SVG for the fretboard. localStorage for settings. Vitest for unit tests.

```
npm run dev      # vite dev server (defaults to :5173; auto-picks next free port)
npm test         # vitest run
npm run check    # svelte-check
npm run build    # production build → dist/
```

## Layout

```
src/theory/         # pitch classes, MIDI math, scales, keys+spelling, tunings, hand-position rules
src/exercises/      # variant MIDI generators, picker (universe), scale-generator (layout — the big file)
src/notation/       # AlphaTex emitter
src/audio/          # Web Audio metronome + skip-ticks / halving behaviors
src/stores/         # settings (localStorage), history (recent-pick exclusion)
src/components/     # ExerciseDisplay (AlphaTab host), Fretboard, MetronomeControls, SettingsPanel, AboutPanel, BrowsePanel
src/App.svelte      # app shell

scripts/            # one-off TS utilities you run with `npx tsx`
docs/               # roadmap, design notes
```

The heart of the project is [src/exercises/scale-generator.ts](src/exercises/scale-generator.ts). It picks the starting fretboard position and lays out a MIDI sequence onto it (note-by-note placement with a position cache, hand-window constraints, per-string note caps, and a lookahead-biased tail for walking exercises).

## Hand positions

| Position | Symbol | Required fret | Base window      | Stretch window    | Max notes on starting string |
|----------|--------|---------------|------------------|-------------------|------------------------------|
| front    | ☝️     | ≥ 0           | [root, root+4]   | same as base      | 3 (index, ring, pinky)       |
| mid      | 🖐️     | ≥ 2           | [root-1, root+2] | [root-2, root+3]  | 2 (middle, pinky)            |
| back     | 🤙     | ≥ 3           | [root-3, root]   | [root-4, root]    | 1 (pinky)                    |

After leaving the starting string, every string allows up to 3 notes (leading finger is always index).

## Layout rules (DON'T change without checking with the bassist)

These accumulated from specific feedback. The "why" matters — they encode physical-world constraints that aren't obvious from theory.

### Starting position
- **Lowest-string preference** for plain / mirror / consecutive variants. Start on the lowest-pitch string where the root is reachable in the hand window.
- **First-pair-fit for walking 2nds–6ths.** The lowest valid string can be at a very high fret when walking-down's `minMidi` constraint pushes the root up. `pickStartingPositionForWalking` ranks by closest-second-note-fit, then lowest fret.
- **Walking 7ths/octaves use the fixed 2-string-apart layout** (`pickStartingPositionForWalkingPairs` + `layWalkingPairsOnFretboard`).

### Walking-exercise structure
- **Append a root resolution** at the end so the exercise resolves to the tonic.
- **Boundary "double-root" insertion** — between asc and desc, push `[scaleDeg(len), scaleDeg(len + interval*ascSign)]`. The high root plays once in the asc direction (continuing the pattern) and then again as desc reverses direction.
- **Pin the FINAL note** to the start position so the exercise visually ends where it began. Don't pin intermediate root occurrences — that yanks the layout back mid-exercise.
- **DP-based lookahead** for the last 6 notes (`PIN_LOOKAHEAD=6`). `solveLookaheadDP` runs a layered DP over the candidate positions for those notes and forces the last layer to the pinned root. Per-step cost is squared so the DP minimizes L2 norm of movement — this distributes the inevitable string-crossing evenly across the window instead of landing it on the very last note. Walking, consecutive, and mirror variants all opt in via `applyPinLookahead: true`.

### Other variants
- **Multi-octave A uses the "spiral" pattern** intentionally — asc walks up through strings, desc walks back through DIFFERENT strings. Does NOT use lookahead bias. Cache wipes on every window shift.
- **Apex repeated only for the complex variants** (walking intervals, consecutive groups, mirrors). The simple scale variants — plain, multi-octave A, multi-octave B — play the apex once and descend through the same notes.

### Fall-back picker
- **Same-string slides up to ~9 frets are fine** — they're hand shifts. No same-string filter in the fall-back; the cost function alone decides. STRING_WEIGHT=4 means cross-string costs as much as a 4-fret slide.
- **Per-string cap enforced in fall-back, EXCEPT on the top string.** Without this the fall-back happily piles a 4th or 5th note onto a string just because the cost was lowest, breaking the spread. Top string skips the cap so multi-octave A's apex extension (which intentionally stays on the top string past 3 notes) still works.

### Mid hand specifics
- **Mid-hand same-string max from root is +2 frets** (middle-finger-to-pinky reach). Any larger interval from the root must cross strings, even if it means an index reach-back to root-2 on the next string. Enforced inside `fitSameWithStretchLimit` for the very first move off the starting root. Fixes minor pentatonic / blues fingerings.

### Walking picker tie-break
When `pickStartingPositionForWalking` has multiple candidates with the same first-pair fit, it sorts by `string * 4 + fret` (the same weighting as the layout's cost function). This balances "lower string preferred" against "lower fret preferred" — A2 wins over E7 for B, but E4 wins over G1 for A♭ since both are at the low end of the neck.

### Picker-side filters
- **Pentatonic 5-note walks capped at ±3.** Wider walks jump too aggressively through the limited note set. Blues (6 notes) keeps its own limit.
- **Range validation for walking exercises.** The full asc+desc range (`scaleDeg(-interval)` to `scaleDeg(topDegree+interval)`) must fit on the bass — `lowestDegreeOffsetSemitones` is applied for ALL walking, not just walking-down.
- **Root must fit on upperString** for walking 7ths/octaves layouts. Some scales (e.g. chromatic walk +6) span fewer semitones than the 10-semitone string-pair gap, and the root ends up at a negative fret on upperString without this check.

### Picker / generator alignment
Picker (universe build) and generator (single-exercise build) MUST agree on starting position. They share `startConstraintsForVariant`, and `pickStartingPositionForWalking[Pairs]` are the entry points. If you add a variant or change start logic, update BOTH sides.

## Spelling / key signatures

Implemented in [src/theory/keys.ts](src/theory/keys.ts).

- `keySignatureFor(key, scale)` → integer ks (-7..7) for AlphaTab.
- `keySignatureLabelFor(key, scale)` → AlphaTex `\ks` identifier (e.g. `"C#minor"`).
- `spellingMap(key, scale)` → `Map<PitchClass, AccidentalKind>` for forced spellings via `{acc forceSharp}` per note in the emitter.

Filtered out at the picker because they need impossible key signatures:
- Major: G♯, A♯, D♯ (would need 8–10 sharps).
- Minor: D♭ (8 flats), G♭ (9 flats). C♯ minor / F♯ minor are the enharmonic alternatives.

`spellingMap` returns an empty map when a forced letter sequence would need any double accidental (e.g. D♭ Locrian ♮2). AlphaTab uses its defaults in those cases.

## AlphaTab quirks (encoded in the emitter, but worth knowing)

- `\tuning` needs parens: `\tuning (G2 D2 A1 E1)`.
- `\ks` takes an identifier (`"Bb"`, `"C#minor"`), not a number.
- `\clef F4` for bass.
- AlphaTex string numbers are 1-indexed from HIGHEST pitch; the emitter flips our 0-indexed-from-low convention via `alphaTexString = tuning.stringCount - n.string`.
- Per-note accidentals: `{acc forceSharp|forceFlat|forceNatural|forceDoubleSharp|forceDoubleFlat}`.
- Pad incomplete measures with rests (`r`) so the meter stays 4/4.
- `notation.notationMode = SongBook` for proper multi-system spacing.

## Workflow when the user reports a layout bug

1. **Trace the exercise:** `npx tsx scripts/trace-exercise.ts <keyId> <scaleId> <variantSpec> <handPosition> [tuningId]`. Run with no args for usage.
2. **Identify the rule violation.** Compare against the layout rules above.
3. **Add a test** asserting the right behavior in `src/exercises/scale-generator.test.ts` (or `picker.test.ts` for universe-level issues).
4. **Fix the layout / picker / spelling** code.
5. **Sweep for regressions:** `npx tsx scripts/scan-layouts.ts` (add `walking` to limit to walking variants). Catches negative frets and cross-string ≥8 fret jumps across the entire universe.

## Memory persistence

Settings live in `localStorage` under `bass-practice:settings:v4`. Bumping the version invalidates old saves (no migration code). The store auto-saves on every change via `store.subscribe(persist)`.

History (for recent-pick exclusion) is in-memory only — resets on reload.

## Conventions

- Svelte 5 runes everywhere; no `$:` reactivity.
- `import type` for type-only imports.
- Comments explain WHY, not WHAT. No comments on obvious code.
- No emojis in code/UI unless explicitly asked (hand-position chips were a deliberate request).
- Strict TypeScript — no `any`, minimal `as` casts.
- Unicode music symbols (`♯`, `♭`, `𝄪`) in user-facing strings, not ASCII (`#`, `b`).
- File references in markdown: `[name](src/path.ts:line)`.

## Don't do without asking

- **Don't commit** — the user reviews before committing.
- **Don't change the layout rules above** — they encode the bassist's hard-won feedback. If a rule looks wrong, surface it.
- **Don't bypass picker/generator alignment** by special-casing one side.
