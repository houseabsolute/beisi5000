# Arpeggio cycle exercises — design

**Date:** 2026-05-17
**Status:** Approved, ready for plan

## Goal

Add **arpeggio cycle exercises** — a new exercise type alongside scales. For a chosen key + scale, the user practices walking through every scale degree, building a stack-of-thirds chord rooted on each degree, and playing through the cycle ascending and descending. Like the existing scale variants, each exercise corresponds to one `(scale, key, size, direction)` tuple.

## What's an arpeggio cycle

For a 7-note scale rooted on degree 1, build a chord on each scale degree by stacking thirds: rooted on `d`, the chord contains degrees `d, d+2, d+4, d+6, …` (mod 7) up to `size` notes.

The `down` form of an arpeggio rooted on `d` plays `d, d−2, d−4, d−6, …` (so a triad rooted on C in C major played `down` is `C–A–F`). This is a diatonic-third stack going **down** from the root, NOT the up-stacked chord reversed.

### Directions

Three of the four directions cycle through consecutive scale degrees as the arpeggio root. The fourth (zigzag) uses a different root-iteration rule.

#### Consecutive-root directions (`allUp`, `upDown`, `downUp`)

Ascending half walks arpeggios rooted on degrees 1 → 8. Descending half walks arpeggios rooted on degrees 8 → 1. High root (degree 8) is the pivot, played at end-of-asc and start-of-desc — same shape as the existing walking-interval exercises.

Per direction, what `up` vs `down` means *within* each arpeggio:

| Direction | Asc half | Desc half |
|-----------|----------|-----------|
| allUp     | every arp plays up   | every arp plays up   |
| upDown    | every arp plays up   | every arp plays down |
| downUp    | every arp plays down | every arp plays up   |

Example in C major, triad cycle, **allUp**:
```
asc: [C E G] [D F A] [E G B] [F A C] [G B D] [A C E] [B D F] [C E G]
desc: [C E G] [B D F] [A C E] [G B D] [F A C] [E G B] [D F A] [C E G]
```

Each consecutive-root half has exactly 8 arpeggios, so the full exercise is `16 × size` notes (pivot arp played once on each side of the turnaround).

#### Zigzag direction

Each arpeggio alternates direction (up, down, up, down, …) and starts **one scale step above where the previous arpeggio ended**. The roots are NOT consecutive scale degrees; they're driven by the connecting-step rule. For all sizes, this guarantees the interval between adjacent arpeggios is always a single scale step.

Algorithm for the asc half:
- Arp 0: root = degree 0 (low root), direction = up. Ends on degree `0 + 2 * (size − 1)`.
- Arp i+1: root = (previous arp's end degree) + 1, direction = opposite of arp i.

The asc half plays a fixed **8 arpeggios** regardless of size — matching the consecutive-root directions' note count. The desc half is `asc.reverse()` (the same MIDI sequence played backwards), so the full exercise reads cleanly as ascending then descending and the final note lands on the low root.

For C major triad zigzag, the asc half (using 0-indexed scale degrees; degree 7 = octave-up root):
```
[C E G] [A F D] [E G B] [C A F] [G B D] [E C A] [B D F] [G E C]
```
Roots (0-indexed): 0, 5, 2, 7, 4, 9, 6, 11. Last arp's top note = degree 11 = G in the second octave. Each boundary between adjacent arpeggios is a single scale step.

For larger sizes, the same algorithm applies; the connecting step is still preserved. The maximum scale degree reached during the cycle works out to `7 + 2*(size − 1)` for every direction (consecutive-root directions hit it at the end of the asc-half up-arp rooted at the octave; zigzag hits it at the start of its last down-arp). So the apex MIDI is identical across all four directions:

- Triad: degree 11 (octave + perfect 5th above root).
- 7th: degree 13 (octave + 7th).
- 9th: degree 15 (two octaves + 2nd).
- 11th: degree 17 (two octaves + 4th).
- 13th: degree 19 (two octaves + 6th).

For 13ths this is ~32 semitones above the low root. With the bottom-strings-only start constraint, some keys may not fit on a 4-string bass — see Risks.

## Scope (what's in this pass)

### In scope

- **5 chord sizes**: triad (3 notes), 7th (4), 9th (5), 11th (6), 13th (7).
- **4 directions**: allUp, upDown, downUp, zigzag.
- **14 scales** — diatonic 7-note scales only: Major, Natural/Harmonic/Melodic Minor, the 5 modes of major (dorian, phrygian, lydian, mixolydian, locrian), the 5 modes of minor (phrygianDominant, lydianDominant, altered, lydianSharp2, locrianNatural2), and Hungarian Minor (which is mis-categorized as `pentatonic` today but has 7 intervals).
- **All 17 keys** that currently exist.
- **All 4 tunings** (4-string EADG, 5-string BEADG, 5-string EADGC, 6-string BEADGC).
- **Picker emits one canonical entry per `(scale, key, size, direction)`** — no hand-position dimension.
- **Starting position constraint** — root must sit on one of the bottom 2 strings (4-string bass) or bottom 3 strings (5/6-string bass).
- **Eighth-note duration** for arpeggio sequences.
- **Pin lookahead** applied so the final note lands at the start position (same approach as walking variants).

### Out of scope (deferred — see `docs/plan.md`)

- Open-string arpeggio variants.
- Inversions (every arpeggio starts on its root note).
- Selecting which scale degrees to root on (always 1 through 8).
- Chord-progression exercises (ii–V–I, cycle of fifths, etc.) — a different exercise unit.
- Hand-position selection — the user does not pick hand position; algorithm chooses canonically.
- Arpeggios on non-diatonic scales (pentatonics, chromatic, octatonic).

## Data model

### `Variant` (in `src/exercises/types.ts`)

Extend the union with a new kind:

```ts
export type ArpDirection = 'allUp' | 'upDown' | 'downUp' | 'zigzag';

export type Variant =
  | { kind: 'plain' }
  | { kind: 'consecutive'; groupSize: number }
  | { kind: 'mirror'; peakSize: number }
  | { kind: 'intervalWalk'; interval: number; intervalDir: 'up' | 'down' }
  | { kind: 'multiOctaveA'; octaves: number }
  | { kind: 'multiOctaveB'; octaves: number }
  | { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection };
```

### `Settings.enabledVariants` extension

Add a parallel sub-structure for arpeggios (kept separate from `enabledVariants` for clarity in the UI):

```ts
export interface ArpeggioToggles {
  sizes: {
    triad: boolean;        // 3 notes
    seventh: boolean;      // 4 notes
    ninth: boolean;        // 5 notes
    eleventh: boolean;     // 6 notes
    thirteenth: boolean;   // 7 notes
  };
  directions: {
    allUp: boolean;
    upDown: boolean;
    downUp: boolean;
    zigzag: boolean;
  };
}
```

Add `enabledArpeggios: ArpeggioToggles` to `Settings`. The settings-version key bumps from `v4` to `v5` (no migration code, per the existing convention).

### `paramsKey` / `paramsFromKey`

New variant key form: `arpeggio:<size>:<direction>`, e.g. `arpeggio:3:allUp`, `arpeggio:7:zigzag`. Parse/emit in `picker.ts`.

## Sequence generation

### `variants.ts` — new `arpeggioCycleMidi`

```ts
export function arpeggioCycleMidi(
  scale: Scale,
  rootMidi: number,
  size: 3 | 4 | 5 | 6 | 7,
  direction: ArpDirection,
): number[]
```

**Helpers** — given a starting scale degree `d`, build one arpeggio:

- `arpUp(scale, rootMidi, d, size)` → `[scaleDegreeMidi(scale, rootMidi, d + 2*i) for i in 0..size-1]`
- `arpDown(scale, rootMidi, d, size)` → `[scaleDegreeMidi(scale, rootMidi, d − 2*i) for i in 0..size-1]`

`scaleDegreeMidi` already handles arbitrary positive and negative degrees across octaves, so `down` stacks (which produce negative degrees) work without modification.

**Consecutive-root directions (`allUp`, `upDown`, `downUp`)**:

```
for d in [0, 1, 2, 3, 4, 5, 6, 7]:    # asc half: 8 arpeggios
  emit arpUp or arpDown per direction's asc-half rule
for d in [7, 6, 5, 4, 3, 2, 1, 0]:    # desc half: 8 arpeggios
  emit arpUp or arpDown per direction's desc-half rule
```

| Direction | Asc half       | Desc half       |
|-----------|----------------|-----------------|
| allUp     | `arpUp`        | `arpUp`         |
| upDown    | `arpUp`        | `arpDown`       |
| downUp    | `arpDown`      | `arpUp`         |

**Zigzag direction**:

```
# asc half: 8 arpeggios, alternating direction, each starting a step above prev's end
d = 0
dir = up
asc = []
for i in 0..7:
  arp = arpUp(scale, rootMidi, d, size) if dir == up else arpDown(scale, rootMidi, d, size)
  asc.extend(arp)
  d = (last degree of arp) + 1
  dir = flip(dir)
# desc half: literal reverse of asc
desc = asc.reverse()
return asc + desc
```

The pivot doubling (asc's last note == desc's first note, since `desc = reverse(asc)`) is acceptable — it's a single note repeat, not a whole-arp repeat. If undesirable, the implementation can drop the first note of `desc` to match the consecutive-root directions' shape. **Decision: drop the duplicate** so zigzag's note count is `2 * 8 * size − 1` instead of `2 * 8 * size`. The final note still pins to the low root because `arpUp` for `d=0` starts on the low root, and `reverse(asc)` ends on it.

### `scale-generator.ts` — entry-point wiring

`generateExercise` adds a branch:

```ts
} else if (variant.kind === 'arpeggioCycle') {
  const midi = arpeggioCycleMidi(scale, lowRootMidi, variant.size, variant.direction);
  sequence = layOnFretboard(midi, tuning, lowRootPos, handPosition, {
    applyPinLookahead: true,
    avoidOpenStrings: true,
    durationDenominator: 8,
  });
}
```

`layOnFretboard` gains a `durationDenominator` option (default 4 for back-compat) so the existing variants keep their quarter-note default.

### Starting position — `maxStringIndex`

`startConstraintsForVariant` returns a new `maxStringIndex` field. For arpeggios:

```ts
{ minMidi: rootMidi, minStringIndex: 0, maxStringIndex: tuning.stringCount === 4 ? 1 : 2 }
```

`pickStartingPosition` is extended to filter candidate starting strings by `maxStringIndex` in addition to the existing `minStringIndex`. Non-arpeggio variants pass `maxStringIndex: undefined` and get the existing behavior.

## Picker / universe generation

### `variantsFromSettings`

Append arpeggio variants by iterating the enabled `(size, direction)` cartesian product:

```ts
const SIZE_KEYS = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
const SIZE_VALUES = [3, 4, 5, 6, 7] as const;
const DIRECTIONS = ['allUp', 'upDown', 'downUp', 'zigzag'] as const;

for (let i = 0; i < SIZE_KEYS.length; i++) {
  if (!s.enabledArpeggios.sizes[SIZE_KEYS[i]]) continue;
  for (const dir of DIRECTIONS) {
    if (!s.enabledArpeggios.directions[dir]) continue;
    variants.push({ kind: 'arpeggioCycle', size: SIZE_VALUES[i], direction: dir });
  }
}
```

### Per-scale filtering

In `generateUniverse`, skip arpeggios for scales whose `intervals.length !== 7`:

```ts
if (variant.kind === 'arpeggioCycle' && scale.intervals.length !== 7) continue;
```

### Hand-position handling

`isHandPositionMeaningful(scale, variant)` returns `false` for `arpeggioCycle`. `canonicalHandPositionForWideWalk` is reused (or renamed to drop the "walk" implication if it gains arpeggio responsibility) to pick a canonical hand position for arpeggio cycles. **Tentative canonical choice: `front`** — the lowest-fret choice; index-on-root keeps the starting reach minimal before the cycle climbs upward.

### Validation

Same fits-within-MAX_FRET check on the cycle's apex MIDI. As worked out in the Directions section, the apex scale degree is the same across all four directions:

```ts
const apexMidi = scaleDegreeMidi(scale, rootMidi, 7 + 2 * (size - 1));
```

A helper `arpeggioCycleApex(scale, rootMidi, size)` returns this MIDI value (no `direction` parameter needed — same answer for all four). The picker calls it to gate which `(scale, key, size, direction)` combos enter the universe.

## UI changes

### `SettingsPanel.svelte`

New section under "Variants" labeled "Arpeggios":

- Sub-row 1: 5 checkboxes for sizes (Triad / 7th / 9th / 11th / 13th).
- Sub-row 2: 4 checkboxes for directions (All ↑ / ↑↓ / ↓↑ / Zigzag), with the direction symbols matching the display-name format below.

### `formatDisplayName` / `describeVariant`

Arpeggio exercises display as:

```
{Root} {Scale} — {Size} cycle {direction-symbol}
```

Examples:
- `C Major — Triad cycle ↑↑`
- `E♭ Dorian — 9th cycle ↕`
- `B Phrygian Dominant — 7th cycle ↑↓`

Direction symbols:

| Direction | Symbol |
|-----------|--------|
| allUp     | `↑↑`   |
| upDown    | `↑↓`   |
| downUp    | `↓↑`   |
| zigzag    | `↕`    |

Size labels: `Triad`, `7th`, `9th`, `11th`, `13th`.

Hand-position chip is omitted (consistent with walking 7ths/octaves today).

### `BrowsePanel.svelte`

The variant-family filter chips gain a new entry: `arpeggios`. Matches any variant with `kind === 'arpeggioCycle'`.

### `paramsKey` URL encoding

New variant key form `arpeggio:<size>:<direction>`. The hash navigation continues to work since `paramsFromKey` parses the new form.

## Testing

### Unit tests

- **`variants.test.ts`** — `arpeggioCycleMidi`:
  - C major triad allUp: assert the exact MIDI sequence — 16 arpeggios × 3 notes = 48 notes.
  - C major 7th upDown: asc half plays up-stacked (8 arps), desc half plays down-stacked (8 arps).
  - C major triad zigzag: assert exact MIDI for asc half matches the worked example `[C E G][A F D][E G B][C A F][G B D][E C A][B D F][G E C]`. Assert desc = reverse(asc) with the first note dropped to avoid doubling the pivot. Total notes = `2 * 8 * 3 − 1 = 47`.
  - C major 9th zigzag: assert adjacent-arpeggio connecting interval is always one scale step (size > 3 case).
  - C minor (natural) 9th allUp: spot-check that the third on degree 1 is minor (E♭ in C minor).
  - D dorian triad downUp: spot-check at least one mode with the downUp direction.
  - C major 13th allUp: assert all 7 scale notes appear in each arpeggio (size == scale length).

- **`scale-generator.test.ts`** — placement:
  - For every direction × `size ∈ {3, 7}` × `tuning ∈ {4-string, 5-string BEADG}` × representative key (C, F♯, B♭): assert starting string index is ≤ `maxStringIndex` for the tuning.
  - Final note in the layout equals the start position (pin lookahead works).
  - No negative frets, no cross-string ≥8-fret jumps within the generated sequences (sampled).
  - Duration of every note is 8 (eighth-note).

- **`picker.test.ts`** — universe:
  - Arpeggios are EXCLUDED for scales with `intervals.length !== 7` (pentatonics, chromatic, octatonics).
  - The universe contains exactly one entry per `(scale, key, size, direction)` for the enabled combinations (no hand-position multiplication).
  - Disabling all sizes or all directions removes arpeggios entirely.

- **`SettingsPanel`** — render tests are not added (the existing panel doesn't have render tests). Behavior validated manually.

### Universe scan

`scripts/scan-layouts.ts` already iterates the full universe checking for negative frets and big cross-string jumps. Verify it accepts arpeggio variants (it iterates whatever the picker emits — no special-casing needed). Run after implementation:

```
npx tsx scripts/scan-layouts.ts arpeggio
```

with an optional `arpeggio` filter argument (mirrors the existing `walking` filter).

### Trace script

`scripts/trace-exercise.ts` should also accept arpeggio variant specs, e.g.:

```
npx tsx scripts/trace-exercise.ts C major arpeggio:3:allUp front fourStringEADG
```

The variant-spec parser in the script needs the same extension as `paramsFromKey`.

## Risks and known concerns

- **Cycle length.** Consecutive-root directions emit `16 * size` notes; zigzag emits `16 * size − 1`. A 13th-chord cycle = 112 notes × 1 eighth = 14 quarters per "half" × 2 = 7 measures total. Manageable but distinctly longer than scale exercises. If it feels like too much in practice, drop 13ths from the default-enabled sizes (still keep the toggle).
- **`allUp` pivot doubling.** Because asc and desc both play the high-root arp UP, that 3–7-note arpeggio plays twice in a row at the asc→desc boundary. Verified against the user's worked examples — this is the intended shape. For `upDown` and `downUp` the pivot arp is the same notes but ordered differently (up vs down) so there's no audible doubling. If `allUp` ends up feeling redundant in practice, the fix is local — drop the first arp from `desc` for `allUp` only.
- **13th-chord range on 4-string basses.** The apex is `scaleDegreeMidi(scale, rootMidi, 7 + 2*(size−1))`. For 13ths that's degree 19 ≈ 32 semitones above the low root. With the bottom-2-strings constraint on a 4-string EADG, the lowest reachable apex sits around fret 16–17 on the G string (depending on key). Most keys fit; expect the picker to filter out a few. Consider defaulting 13ths OFF in the initial settings if the resulting universe sparsity feels too uneven.
- **Triad note count vs eighth-note meter.** Triads = 3 notes per arpeggio = 1.5 quarters per arp at eighths. Doesn't align with the 4/4 metronome at the arp boundary. May feel unusual to play "across" beats — flagged for user feedback. If it's a problem, options: (a) emit triplets for triads only, (b) keep eighths but accept the cross-beat feel.
- **`hungarian` scale category.** Currently mis-categorized as `pentatonic` despite having 7 intervals. The filter uses `intervals.length === 7`, so Hungarian Minor is included in arpeggios regardless of the category label. Note this is consistent with how `keys.ts` handles it today.
- **Canonical hand position naming.** `canonicalHandPositionForWideWalk` is reused for arpeggios; consider renaming to `canonicalHandPositionForVariant` for clarity. This rename is in scope as part of the implementation pass.

## Implementation order

1. Extend `Variant` union + `Settings.enabledArpeggios` + persistence (settings v5).
2. Implement `arpeggioCycleMidi` in `variants.ts` + unit tests.
3. Add `maxStringIndex` to `pickStartingPosition` / `startConstraintsForVariant`.
4. Wire `generateExercise` arpeggio branch + `layOnFretboard` `durationDenominator` option + tests.
5. Extend `variantsFromSettings` and `generateUniverse` filter + tests.
6. Update `paramsKey` / `paramsFromKey` URL encoding.
7. Update `formatDisplayName` / `describeVariant`.
8. Rename `canonicalHandPositionForWideWalk` → `canonicalHandPositionForVariant`, update `isHandPositionMeaningful` to include arpeggios.
9. UI: `SettingsPanel.svelte` arpeggio section.
10. UI: `BrowsePanel.svelte` variant-family chip.
11. Update `scripts/trace-exercise.ts` and `scripts/scan-layouts.ts` to handle arpeggios.
12. Run full test suite + universe scan.
13. Update `docs/plan.md` — mark arpeggios done, leave deferred items as future passes.
