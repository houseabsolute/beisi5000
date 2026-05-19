# Big X and Spider — hand-agility drills design

**Date:** 2026-05-18
**Status:** Approved, ready for plan

## Goal

Add two chromatic hand-agility drills — **Big X** and **Spider** — that drill cross-string finger coordination up and down the neck. Unlike every existing exercise, these have no key, no scale, and no hand-position concept. They emit fretboard positions directly and the picker mixes them in alongside scale and arpeggio exercises.

## Exercise shapes

### Big X

Big X always plays across **exactly 4 adjacent strings** — the diagonals fit a comfortable hand window (4 frets, 4 fingers, 4 strings). On a 4-string bass there's only one choice. On 5/6-string basses, the picker emits separate Big X variants per 4-adjacent-string subset and rotates between them randomly — same model as Spider's string-pair rotation.

For a given start fret N and a starting string S (the lowest of the 4-adjacent set; so the set is strings S..S+3), one X is **8 notes**. Two directions:

**Forward** (each diagonal played ascending in pitch):
1. Rising diagonal — `(S, N), (S+1, N+1), (S+2, N+2), (S+3, N+3)`. Fingers 1, 2, 3, 4.
2. Falling diagonal — `(S+3, N), (S+2, N+1), (S+1, N+2), (S, N+3)`. Fingers 1, 2, 3, 4.

**Reverse** (each diagonal played descending in pitch — same notes, opposite order within each diagonal; diagonal pairing order preserved):
1. Rising diagonal reversed — `(S+3, N+3), (S+2, N+2), (S+1, N+1), (S, N)`. Fingers 4, 3, 2, 1.
2. Falling diagonal reversed — `(S, N+3), (S+1, N+2), (S+2, N+1), (S+3, N)`. Fingers 4, 3, 2, 1.

Visually on a tab both directions trace the same X on the 4-string × 4-fret block — only the playback order differs.

The full exercise plays the X at start frets 1, 2, …, 12, then 11, 10, …, 1. The fret-12 X plays once at the pivot (no doubling).

Total X count: **23** (12 up + 11 down).
Notes per X: always **8** (4 strings × 2 diagonals).
Total notes: always **184** regardless of bass.

### Spider

At any start fret N on a pair of adjacent strings (L, L+1, where L is the LOWER-pitch string), one Spider position is **8 notes**. Two directions:

**Forward** (each pass played ascending in fret order):
1. Normal pass: `(L, N), (L+1, N+1), (L, N+2), (L+1, N+3)` — fingers 1, 2, 3, 4.
2. Swap pass: `(L+1, N), (L, N+1), (L+1, N+2), (L, N+3)` — fingers 1, 2, 3, 4.

(The swap re-uses the same four frets but with the string pair flipped.)

**Reverse** (each pass played descending in fret order — same notes, opposite order within each pass; pass order preserved):
1. Normal pass reversed: `(L+1, N+3), (L, N+2), (L+1, N+1), (L, N)` — fingers 4, 3, 2, 1.
2. Swap pass reversed: `(L, N+3), (L+1, N+2), (L, N+1), (L+1, N)` — fingers 4, 3, 2, 1.

The full exercise plays Spider at start frets 1, 2, …, 12, then 11, 10, …, 1. Pivot at fret 12 plays once.

Total positions: **23**.
Total notes: **184**.

The Spider variant the picker chooses (which string pair, direction, and spelling) randomises naturally because each `(tuning, lowerString, direction, spelling)` is a SEPARATE entry in the universe — when the picker rolls Spider, it picks one at random.

### Note spelling

Both drills are chromatic — every fret in sequence visits every pitch class. The 5 "black-key" pitch classes (C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭) can be spelled either as sharps or flats. Each agility variant has a `spelling: 'sharp' | 'flat'` field. The emitter populates a per-pitch-class spelling map (5 entries) that forces the chosen accidental kind on every black-key note. The picker emits both spellings as separate variants so its random selection naturally rotates between them.

## Scope (what's in this pass)

### In scope

- **Big X** — one variant per 4-adjacent-string subset per tuning. Always frets 1 → 12 → 1.
- **Spider** — one variant per adjacent string pair per tuning. Always frets 1 → 12 → 1.
- **All 4 tunings** (4-string EADG, 5-string BEADG, 5-string EADGC, 6-string BEADGC).
- **Eighth-note durations** (matches every existing exercise).
- **No hand-position dimension** — both exercises span 12 frets along the neck; "front/mid/back" is moot.
- **No key, no scale** — exercises emit positions directly; AlphaTex emits as C / no accidentals.
- **Independent settings toggles** — Big X on/off, Spider on/off.

### Out of scope (deferred)

- Configurable start/end fret (always 1 → 12).
- Other agility patterns (e.g. Big O, alternate Spider shapes, three-string drills).
- Per-string-pair Spider toggles (just one Spider master toggle — all pairs participate).
- Tempo or duration overrides per exercise.
- Pretty-printing the fingering above the staff (we emit `finger` on each note for parity with other variants, but rendering depends on the existing `showFingerNumbers` setting).

## Data model

### `Variant` (in `src/exercises/types.ts`)

Extend the discriminated union:

```ts
export type AgilityDirection = 'forward' | 'reverse';
export type AgilitySpelling = 'sharp' | 'flat';

export type Variant =
  | { kind: 'plain' }
  | { kind: 'consecutive'; groupSize: number }
  | { kind: 'mirror'; peakSize: number }
  | { kind: 'intervalWalk'; interval: number; intervalDir: 'up' | 'down' }
  | { kind: 'multiOctaveA'; octaves: number }
  | { kind: 'multiOctaveB'; octaves: number }
  | { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection }
  | { kind: 'bigX'; startString: number; direction: AgilityDirection; spelling: AgilitySpelling }
  | { kind: 'spider'; lowerString: number; direction: AgilityDirection; spelling: AgilitySpelling };
```

`bigX.startString` is the 0-indexed lowest string of the 4-adjacent-string subset (so on a 4-string EADG, `startString: 0` = E,A,D,G; on a 5-string BEADG, `startString: 0` = B,E,A,D and `startString: 1` = E,A,D,G).

`spider.lowerString` is the 0-indexed lower-pitch string of the pair (so on a 4-string EADG, `lowerString: 0` = E+A pair, `lowerString: 1` = A+D, `lowerString: 2` = D+G).

`direction` controls within-pattern note order (see Big X and Spider sections above).

`spelling` controls how the 5 black-key pitch classes are notated (sharp or flat). The emitter forces the chosen accidental on every black-key note.

### Settings (`src/stores/settings.ts`)

```ts
export interface AgilityToggles {
  bigX: boolean;
  spider: boolean;
}
```

Add `enabledAgility: AgilityToggles` to `Settings`. Default both to `true`. Bumps storage key v5 → v6.

### `paramsKey` / `paramsFromKey`

New URL forms:
- `agility:bigX:<startString>:<dir>:<spelling>` (e.g., `agility:bigX:0:fwd:sharp`, `agility:bigX:1:rev:flat`)
- `agility:spider:<lowerString>:<dir>:<spelling>` (e.g., `agility:spider:0:fwd:sharp`)

Where `<dir>` is `fwd` or `rev`, and `<spelling>` is `sharp` or `flat`.

## Sequence generation

### New module `src/exercises/agility.ts`

Both functions return `FretboardNote[]` directly — they bypass `layOnFretboard` because the fretboard positions are explicit, not derived from MIDI placement.

```ts
export function bigXSequence(
  tuning: Tuning,
  startString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  const startFrets = [...range(1, 13), ...range(11, 0, -1)];  // 1..12, 11..1
  for (const startFret of startFrets) {
    result.push(...bigXAtFret(tuning, startString, startFret, direction));
  }
  return result;
}

function bigXAtFret(
  tuning: Tuning,
  startString: number,
  startFret: number,
  direction: AgilityDirection,
): FretboardNote[] {
  const notes: FretboardNote[] = [];
  // Always 4 adjacent strings (S, S+1, S+2, S+3) × 4 frets — fits a
  // comfortable hand window with fingers 1-2-3-4.
  if (direction === 'forward') {
    // Rising diagonal: (S, N), (S+1, N+1), (S+2, N+2), (S+3, N+3)
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + i, i + 1));
    }
    // Falling diagonal: (S+3, N), (S+2, N+1), (S+1, N+2), (S, N+3)
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + i, i + 1));
    }
  } else {
    // Reverse: each diagonal played backwards, pairing order preserved.
    // Rising reversed: (S+3, N+3), (S+2, N+2), (S+1, N+1), (S, N)
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + 3 - i, 4 - i));
    }
    // Falling reversed: (S, N+3), (S+1, N+2), (S+2, N+1), (S+3, N)
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + 3 - i, 4 - i));
    }
  }
  return notes;
}

export function spiderSequence(
  tuning: Tuning,
  lowerString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  const startFrets = [...range(1, 13), ...range(11, 0, -1)];
  for (const startFret of startFrets) {
    result.push(...spiderAtFret(tuning, lowerString, startFret, direction));
  }
  return result;
}

function spiderAtFret(
  tuning: Tuning,
  lowerString: number,
  startFret: number,
  direction: AgilityDirection,
): FretboardNote[] {
  const L = lowerString;
  const H = lowerString + 1;
  const notes: FretboardNote[] = [];
  if (direction === 'forward') {
    // Normal pass: (L, N), (H, N+1), (L, N+2), (H, N+3) with fingers 1..4
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    // Swap pass: strings flipped, same frets, fingers 1..4 again
    notes.push(makeNote(tuning, H, startFret + 0, 1));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 3, 4));
  } else {
    // Reverse: each pass played backwards, pass order preserved.
    // Normal pass reversed: (H, N+3), (L, N+2), (H, N+1), (L, N)
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    // Swap pass reversed: (L, N+3), (H, N+2), (L, N+1), (H, N)
    notes.push(makeNote(tuning, L, startFret + 3, 4));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 0, 1));
  }
  return notes;
}

function makeNote(
  tuning: Tuning,
  string: number,
  fret: number,
  finger: number,
): FretboardNote {
  return {
    string,
    fret,
    midi: tuning.openMidi[string] + fret,
    durationDenominator: 8,
    finger,
  };
}
```

(`range` is a small inline helper or just inline two `for` loops.)

### `generateExercise` dispatch

In `src/exercises/scale-generator.ts`, add two new branches in the variant switch:

```ts
} else if (variant.kind === 'bigX') {
  sequence = bigXSequence(tuning, variant.startString, variant.direction);
} else if (variant.kind === 'spider') {
  sequence = spiderSequence(tuning, variant.lowerString, variant.direction);
}
```

For these branches, the spelling map is built from `variant.spelling` (see `agilitySpellingMap` below). Other args to `emitAlphaTex`: `keySignature: 0`, `keySignatureLabel: 'C'`.

```ts
// In agility.ts:
const BLACK_KEY_PCS = [1, 3, 6, 8, 10] as const;  // C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭

export function agilitySpellingMap(spelling: AgilitySpelling): Map<PitchClass, AccidentalKind> {
  // AccidentalKind values 'sharp' / 'flat' are converted to AlphaTex
  // 'forceSharp' / 'forceFlat' by the emitter's ALPHATEX_ACCIDENTAL map.
  const acc: AccidentalKind = spelling === 'sharp' ? 'sharp' : 'flat';
  return new Map(BLACK_KEY_PCS.map((pc) => [pc as PitchClass, acc]));
}
```

The picker populates `ExerciseParams.spelling` with the result of `agilitySpellingMap(variant.spelling)`. Other params: `scale: SCALES.chromatic`, `rootPc: 0`, `handPosition: 'front'` as benign defaults — see the picker section.

### Validation

Big X and Spider always span frets 1 → 15 (fret 12 + 3 highest in the pattern) and use at most 4 adjacent strings. On any tuning the max fret is well within the 24-fret limit and the string range always fits. **No picker validation needed** — these always fit.

## Picker / universe

### `variantsFromSettings`

Append after the arpeggio loop:

```ts
const DIRECTIONS: AgilityDirection[] = ['forward', 'reverse'];
const SPELLINGS: AgilitySpelling[] = ['sharp', 'flat'];

if (s.enabledAgility.bigX) {
  // 4 adjacent strings × 2 directions × 2 spellings — emit one entry
  // per valid combo. Picker rotates among them randomly.
  for (let S = 0; S + 3 < tuning.stringCount; S++) {
    for (const dir of DIRECTIONS) {
      for (const sp of SPELLINGS) {
        variants.push({ kind: 'bigX', startString: S, direction: dir, spelling: sp });
      }
    }
  }
}
if (s.enabledAgility.spider) {
  for (let L = 0; L < tuning.stringCount - 1; L++) {
    for (const dir of DIRECTIONS) {
      for (const sp of SPELLINGS) {
        variants.push({ kind: 'spider', lowerString: L, direction: dir, spelling: sp });
      }
    }
  }
}
```

Big X entries per tuning: `(stringCount − 3) × 2 × 2` → 4-string=4, 5-string=8, 6-string=12 (total 4+8+8+12 = **32** across all 4 tunings).
Spider entries per tuning: `(stringCount − 1) × 2 × 2` → 4-string=12, 5-string=16, 6-string=20 (total 12+16+16+20 = **64**).
Total agility entries: **96** new universe entries.

### `generateUniverse`

For agility variants:
- Skip the key/scale/spelling iteration entirely — agility exercises only need `tuning + variant`.
- Skip the hand-position iteration — emit one entry per `(tuning, variant)`.
- Skip the open-string variant block.

The implementation can either (a) special-case agility variants at the top of the per-variant body and emit a single canonical params entry, or (b) iterate normally with a fixed `scale = SCALES.chromatic`, `rootPc = 0`, `enabledKeys[0]`, `enabledHandPositions[0]` and skip the open-string block. **Choose (a) for clarity** — agility variants short-circuit before the key/scale loop.

Canonical fields for agility entries:

```ts
{
  scale: SCALES.chromatic,
  rootPc: 0,
  rootName: 'C',
  variant,
  scaleDirection: 'updown',
  handPosition: 'front',
  tuning,
  useOpenStrings: false,
  keySignature: 0,
  keySignatureLabel: 'C',
  spelling: agilitySpellingMap(variant.spelling),
}
```

### Hand-position handling

Extend `isHandPositionMeaningful` to return `false` for `bigX` and `spider`. `canonicalHandPositionForVariant` returns `'front'` for both. `formatDisplayName` already drops the hand chip when `isHandPositionMeaningful` is false.

## UI changes

### `SettingsPanel.svelte`

New section after Arpeggios, titled **"Hand-agility drills"**:

```svelte
<section>
  <h3>Hand-agility drills</h3>
  <p class="hint">Chromatic finger-coordination patterns up the neck. No key — pure technique.</p>
  <label class="checkbox">
    <input type="checkbox" checked={...} onchange={...} />
    Big X — diagonals across 4 adjacent strings
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={...} onchange={...} />
    Spider — two-string crawl
  </label>
</section>
```

### `formatDisplayName` / `describeVariant`

Display names include the direction arrow and spelling chip:
- Big X → `"Big X E-A-D-G ↑ ♯"` / `"Big X B-E-A-D ↓ ♭"` / etc.
- Spider → `"Spider E-A ↑ ♯"` / `"Spider D-G ↓ ♭"` / etc.

Direction symbols: `↑` for forward, `↓` for reverse.
Spelling symbols: `♯` for sharp, `♭` for flat.

Both omit the key prefix (no `"C Major — "` prefix) because there's no key. `formatDisplayName` needs a special branch for agility variants:

```ts
const dirSym = (d: AgilityDirection) => d === 'forward' ? '↑' : '↓';
const spSym = (s: AgilitySpelling) => s === 'sharp' ? '♯' : '♭';

if (variant.kind === 'bigX') {
  const names = tuning.openNoteNames
    .slice(variant.startString, variant.startString + 4)
    .join('-');
  return `Big X ${names} ${dirSym(variant.direction)} ${spSym(variant.spelling)}`;
}
if (variant.kind === 'spider') {
  const lo = tuning.openNoteNames[variant.lowerString];
  const hi = tuning.openNoteNames[variant.lowerString + 1];
  return `Spider ${lo}-${hi} ${dirSym(variant.direction)} ${spSym(variant.spelling)}`;
}
```

(Place this BEFORE the existing `{Root} {Scale} — …` template.)

`describeVariant` (used inside the per-exercise meta chips in App.svelte) returns the same strings for the matching kinds. Since `describeVariant`'s signature takes `(variant, scale)`, agility's display needs the tuning — expand `describeVariant`'s signature to include `tuning: Tuning` as a third parameter. Update the existing scale-generator + App.svelte call sites (both already have `tuning` in scope).

### `BrowsePanel.svelte`

Variant-family chip: add `'agility'` to `VariantFamily`. `matchVariantFamily` returns `true` for `bigX` and `spider` when family is `'agility'`.

## Testing

### Unit tests

**`src/exercises/agility.test.ts`** (new file):

- **`bigXSequence`**:
  - 4-string EADG, startString=0, forward: total 184 notes (8 per X × 23 X's).
  - 5-string BEADG, startString=0, forward: total 184 notes (still 8 per X — Big X always uses 4 strings).
  - 5-string BEADG, startString=1, forward: total 184 notes, first note on string 1 (E).
  - 6-string BEADGC, startString=2, forward: total 184 notes, first note on string 2 (A).
  - First X forward (start fret 1, startString=0) on 4-string = `[(s0,f1), (s1,f2), (s2,f3), (s3,f4), (s3,f1), (s2,f2), (s1,f3), (s0,f4)]`.
  - First X reverse (start fret 1, startString=0) on 4-string = `[(s3,f4), (s2,f3), (s1,f2), (s0,f1), (s0,f4), (s1,f3), (s2,f2), (s3,f1)]`.
  - Last X (start fret 1, after descent) matches the first X position-for-position.
  - Top X is at start fret 12 (the 12th X = index 11; total 23 X's, index 11 is the middle one).
  - MIDI matches `tuning.openMidi[string] + fret` for sampled notes.
  - All `durationDenominator` = 8.
  - All `finger` values are 1-4 (no zero, no >4).

- **`spiderSequence`** (parameterised over each adjacent pair):
  - 4-string EADG, lowerString=0, forward (E+A): 184 notes.
  - First position forward (start fret 1) = `[(s0,f1), (s1,f2), (s0,f3), (s1,f4), (s1,f1), (s0,f2), (s1,f3), (s0,f4)]`.
  - First position reverse (start fret 1) = `[(s1,f4), (s0,f3), (s1,f2), (s0,f1), (s0,f4), (s1,f3), (s0,f2), (s1,f1)]`.
  - Last position matches the first.
  - Top position at start fret 12 (middle of the 23 positions).
  - 5-string tuning with lowerString=3 (D+G) works correctly.
  - All `finger` values are 1-4.

- **`agilitySpellingMap`**:
  - `agilitySpellingMap('sharp')` returns a map of 5 entries: `{1: 'sharp', 3: 'sharp', 6: 'sharp', 8: 'sharp', 10: 'sharp'}`.
  - `agilitySpellingMap('flat')` returns the same 5 keys mapped to `'flat'`.
  - White-key pitch classes (0, 2, 4, 5, 7, 9, 11) are NOT in the map.

**`src/exercises/scale-generator.test.ts`**:

- `generateExercise({ variant: { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' }, ... })` returns an exercise with `sequence.length === 184` for 4-string and matches the first/last notes.
- `generateExercise({ variant: { kind: 'spider', lowerString: 1, direction: 'reverse', spelling: 'flat' }, ... })` returns 184 notes.
- `formatDisplayName` for `bigX` on 4-string EADG with `startString: 0, direction: 'forward', spelling: 'sharp'` returns `'Big X E-A-D-G ↑ ♯'`.
- `formatDisplayName` for `bigX` on 5-string BEADG with `startString: 1, direction: 'reverse', spelling: 'flat'` returns `'Big X E-A-D-G ↓ ♭'`.
- `formatDisplayName` for `spider` on 4-string EADG with `lowerString: 0, direction: 'forward', spelling: 'sharp'` returns `'Spider E-A ↑ ♯'`.
- For sharp-spelled variants, the emitted AlphaTex contains `{acc forceSharp}` markers on black-key notes (verify via a spot check on one fretted note like fret 1 on E string = MIDI 29 = pitch class 5 = F natural — NO marker; fret 2 = MIDI 30 = pitch class 6 = F♯/G♭ — sharp marker).
- For flat-spelled variants, the same fret 2 note shows `{acc forceFlat}`.

**`src/exercises/picker.test.ts`**:

- Universe with only Big X enabled, 4-string EADG: 4 entries (1 startString × 2 directions × 2 spellings).
- Universe with only Big X enabled, 5-string BEADG: 8 entries (2 × 2 × 2).
- Universe with only Big X enabled, 6-string BEADGC: 12 entries (3 × 2 × 2).
- Universe with only Spider enabled, 4-string EADG: 12 entries (3 pairs × 2 directions × 2 spellings).
- Universe with only Spider enabled, 5-string BEADG: 16 entries (4 × 2 × 2).
- Universe with all variants disabled including agility: empty.
- Universe with agility on but `enabledKeys`, `enabledScales`, `enabledHandPositions` all empty: still emits agility entries (agility variants short-circuit before those loops).
- `paramsKey` round-trip for `bigX:0:fwd:sharp`, `bigX:1:rev:flat`, `spider:2:fwd:flat`.

### Universe scan

After implementation:

```
npx tsx scripts/scan-layouts.ts agility
```

with an `agility` filter argument added to `scan-layouts.ts`. Expected: 0 issues across all agility entries. The cross-string ≥8-fret heuristic is fine for these — agility never crosses by more than 1 string at a time + 1 fret, so the heuristic naturally never fires.

### Trace script

`scripts/trace-exercise.ts` gets new variant-spec forms:

- `bigx<S>-<dir>-<sp>` → `{ kind: 'bigX', startString: S, direction, spelling }` (e.g., `bigx0-fwd-sharp`, `bigx1-rev-flat`)
- `spider<L>-<dir>-<sp>` → `{ kind: 'spider', lowerString: L, direction, spelling }` (e.g., `spider0-fwd-sharp`)

Where `<dir>` is `fwd` or `rev`, and `<sp>` is `sharp` or `flat`.

Note: agility variants ignore the `<keyId> <scaleId>` arguments — the trace script can still accept them for invocation symmetry, just not use them.

## Risks and known concerns

- **`describeVariant` signature change** — adding `tuning: Tuning` touches the existing call sites in `formatDisplayName` and `App.svelte`. Both already have `tuning` in scope (`params.tuning` and `currentExercise.params.tuning`). Mechanical update.
- **Agility short-circuit in `generateUniverse`** — the existing variant-iteration loop is nested inside the keys × scales loops. Putting agility BEFORE those loops requires restructuring `variantsFromSettings`'s consumer slightly. Alternative: keep agility in the existing loop but skip the inner work (cheap; one extra iteration per scale/key but emits the same canonical entry). Both work; the spec assumes "short-circuit before the loop" for clarity, but the implementer can choose.
- **184-note exercises** are long compared to scales (~30 notes). At ♪ in 4/4 that's ~12 measures. Practitioner-driven decision — these are designed as longer drills.
- **`spider:lowerString` URL encoding** — `lowerString` is tuning-dependent (3 on a 4-string means the highest string D, but doesn't exist on a 1-string tuning). A bookmarked URL for `spider:3` on a 4-string will resolve correctly if the active tuning has ≥4 strings. If the user switches to a 4-string when the URL was for a 5-string `spider:3`, the entry resolves to the D-G pair on the 4-string — but that's a different exercise than what the URL was for. Accept as a minor URL portability quirk; tuning is part of `paramsKey` anyway so the URL round-trips inside one tuning.
- **App.svelte `describeVariant`** — recently refactored to import the shared one. Adding a `tuning` parameter ripples through both call sites cleanly; no need to re-fork.

## Implementation order

1. Extend `Variant` union (with `direction` + `spelling` fields) + `Settings.enabledAgility` + storage key bump (v5 → v6).
2. New `src/exercises/agility.ts` with `bigXSequence`, `spiderSequence`, `agilitySpellingMap` + unit tests.
3. Update `describeVariant` signature to include `tuning`. Update both call sites.
4. Wire `generateExercise` dispatch for both new variants (passing `direction` to sequence builders) + tests.
5. Extend `isHandPositionMeaningful` and `canonicalHandPositionForVariant` for agility.
6. Update `variantsFromSettings` and `generateUniverse` for agility (short-circuit canonical params, populate `spelling` via `agilitySpellingMap`) + tests.
7. Update `formatDisplayName` to handle agility (no key prefix, includes direction arrow + spelling chip).
8. Update `paramsKey` / `paramsFromKey` for new URL encodings (including `dir` + `spelling`) + round-trip tests.
9. Add Settings UI: "Hand-agility drills" section.
10. Add BrowsePanel: `agility` family chip.
11. Update `scripts/trace-exercise.ts` and `scripts/scan-layouts.ts` for agility.
12. Run full test suite + universe scan as the final gate.
13. Update `docs/plan.md` — move Big X and Spider from "Future passes" to "Recent additions".
