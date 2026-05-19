# Big X and Spider — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two chromatic hand-agility drills — **Big X** (cross-diagonal X across 4 adjacent strings × 4 frets) and **Spider** (two-string interleaved crawl) — that scan up and down the neck (frets 1 → 12 → 1). Each exercise has 4 variants: 2 directions (forward / reverse) × 2 spellings (sharp / flat). Picker rotates randomly across all variants for the active tuning.

**Architecture:** New variant kinds (`bigX`, `spider`) with a fresh `agility.ts` module that emits `FretboardNote[]` directly — bypassing the existing `layOnFretboard` pipeline since fretboard positions are explicit, not derived from MIDI placement. Picker short-circuits these variants before the keys × scales loop (agility has no key/scale concept). Spelling map forces flat vs sharp on the 5 black-key pitch classes.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vite, Vitest, AlphaTab.

**Reference spec:** [docs/superpowers/specs/2026-05-18-agility-drills-design.md](../specs/2026-05-18-agility-drills-design.md)

---

## File structure

**New files:**

| File | Responsibility |
|------|----------------|
| `src/exercises/agility.ts` | `bigXSequence`, `spiderSequence`, `agilitySpellingMap` — pure functions emitting `FretboardNote[]` |
| `src/exercises/agility.test.ts` | Unit tests for the sequence builders + spelling map |

**Modified files:**

| File | Responsibility | What changes |
|------|---------------|--------------|
| `src/exercises/types.ts` | Variant union | Add `AgilityDirection`, `AgilitySpelling`, `bigX` and `spider` variant kinds |
| `src/exercises/scale-generator.ts` | `generateExercise` dispatch + display name + helpers | New dispatch branches; `describeVariant` signature change (add `tuning`); extend `isHandPositionMeaningful` + `canonicalHandPositionForVariant`; update `formatDisplayName` to skip key prefix for agility |
| `src/exercises/picker.ts` | Universe build + URL encoding | `variantsFromSettings` emits agility variants; `generateUniverse` short-circuits agility before keys × scales loop; `paramsKey` / `paramsFromKey` encode/decode new format |
| `src/stores/settings.ts` | Settings shape | Add `AgilityToggles` interface + `enabledAgility` field; bump storage key v5 → v6 |
| `src/components/SettingsPanel.svelte` | Settings UI | New "Hand-agility drills" section with Big X and Spider toggles |
| `src/components/BrowsePanel.svelte` | Filter chips | Add `agility` to `VariantFamily` + chip list |
| `src/App.svelte` | Per-exercise meta chip | Pass `tuning` to `describeVariant` call |
| `scripts/trace-exercise.ts` | One-off exercise tracer | Parse `bigxS-DIR-SP` and `spiderL-DIR-SP` forms |
| `scripts/scan-layouts.ts` | Universe-wide layout scan | Extend `variantTag` switch + add `agility` filter argument |
| `src/exercises/scale-generator.test.ts` | Integration tests | `generateExercise` returns correct output for bigX + spider; `formatDisplayName` for agility |
| `src/exercises/picker.test.ts` | Universe tests | Agility filter counts, URL round-trip, short-circuit behavior |
| `docs/plan.md` | Roadmap | Move Big X and Spider from "Future passes" to "Recent additions" |

---

## Task 1: Extend `Variant` union with bigX + spider + placeholder switches

**Files:**
- Modify: `src/exercises/types.ts`
- Modify: `src/exercises/picker.ts`
- Modify: `src/exercises/scale-generator.ts`
- Modify: `scripts/scan-layouts.ts`

- [ ] **Step 1: Add the new variant kinds to `types.ts`**

In `src/exercises/types.ts`, after the existing `ArpDirection` definition (around line 8), add:

```ts
export type AgilityDirection = 'forward' | 'reverse';
export type AgilitySpelling = 'sharp' | 'flat';
```

Replace the existing `Variant` union with:

```ts
export type Variant =
  | { kind: 'plain' }
  | { kind: 'consecutive'; groupSize: number }
  | { kind: 'mirror'; peakSize: number }
  | {
      kind: 'intervalWalk';
      interval: number;
      intervalDir: 'up' | 'down';
    }
  | { kind: 'multiOctaveA'; octaves: number }
  | { kind: 'multiOctaveB'; octaves: number }
  | { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection }
  | { kind: 'bigX'; startString: number; direction: AgilityDirection; spelling: AgilitySpelling }
  | { kind: 'spider'; lowerString: number; direction: AgilityDirection; spelling: AgilitySpelling };
```

- [ ] **Step 2: Add placeholder cases to exhaustive switches**

The new variant kinds will break three exhaustive switches that have no default branch. Add placeholders to each (these will be REPLACED by later tasks).

**(a)** In `src/exercises/picker.ts`, find `paramsKey` (around line 120-140). Add before the closing brace of the switch:

```ts
    case 'bigX':
      variantKey = 'agility:bigX:placeholder';
      break;
    case 'spider':
      variantKey = 'agility:spider:placeholder';
      break;
```

**(b)** In `src/exercises/scale-generator.ts`, find `describeVariant` (around line 1444). Add new cases before the closing brace:

```ts
    case 'bigX':
      return 'Big X (placeholder)';
    case 'spider':
      return 'Spider (placeholder)';
```

**(c)** In `scripts/scan-layouts.ts`, find `variantTag` (around line 95). Add new cases:

```ts
    case 'bigX':
      return 'bigX placeholder';
    case 'spider':
      return 'spider placeholder';
```

- [ ] **Step 3: Verify typecheck is clean**

Run: `npm run check`
Expected: 0 errors. (If new errors appear in a file not listed above, that file has its own exhaustive switch — add the same placeholder pattern there.)

- [ ] **Step 4: Commit**

```bash
git add src/exercises/types.ts src/exercises/picker.ts src/exercises/scale-generator.ts scripts/scan-layouts.ts
git commit -m "feat(agility): add bigX and spider variant kinds with placeholders"
```

---

## Task 2: Implement `agility.ts` — `bigXSequence`, `spiderSequence`, `agilitySpellingMap`

**Files:**
- Create: `src/exercises/agility.ts`
- Create: `src/exercises/agility.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/exercises/agility.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import {
  bigXSequence,
  spiderSequence,
  agilitySpellingMap,
} from './agility';
import { TUNINGS } from '../theory/tunings';
import type { PitchClass } from '../theory/notes';

describe('bigXSequence', () => {
  test('4-string EADG startString=0 forward — 184 notes (8 per X × 23 X\'s)', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'forward');
    expect(seq).toHaveLength(184);
  });

  test('First X forward (startFret=1, startString=0) on 4-string', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'forward');
    const first = seq.slice(0, 8).map(n => ({ string: n.string, fret: n.fret }));
    expect(first).toEqual([
      { string: 0, fret: 1 }, // rising diagonal
      { string: 1, fret: 2 },
      { string: 2, fret: 3 },
      { string: 3, fret: 4 },
      { string: 3, fret: 1 }, // falling diagonal
      { string: 2, fret: 2 },
      { string: 1, fret: 3 },
      { string: 0, fret: 4 },
    ]);
  });

  test('First X reverse (startFret=1, startString=0) on 4-string', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'reverse');
    const first = seq.slice(0, 8).map(n => ({ string: n.string, fret: n.fret }));
    expect(first).toEqual([
      { string: 3, fret: 4 }, // rising reversed
      { string: 2, fret: 3 },
      { string: 1, fret: 2 },
      { string: 0, fret: 1 },
      { string: 0, fret: 4 }, // falling reversed
      { string: 1, fret: 3 },
      { string: 2, fret: 2 },
      { string: 3, fret: 1 },
    ]);
  });

  test('Last X matches first X position-for-position (4-string forward)', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'forward');
    const first = seq.slice(0, 8);
    const last = seq.slice(-8);
    for (let i = 0; i < 8; i++) {
      expect(last[i].string).toBe(first[i].string);
      expect(last[i].fret).toBe(first[i].fret);
    }
  });

  test('Top X is at startFret=12 (12th X = indices 88..95)', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'forward');
    // 12th X (0-indexed=11): starts at byte offset 11*8 = 88
    const topX = seq.slice(88, 96);
    expect(topX[0]).toMatchObject({ string: 0, fret: 12 });
    expect(topX[3]).toMatchObject({ string: 3, fret: 15 });
  });

  test('5-string BEADG startString=0 forward — 184 notes (uses lowest 4 strings = B,E,A,D)', () => {
    const seq = bigXSequence(TUNINGS.fiveStringBEADG, 0, 'forward');
    expect(seq).toHaveLength(184);
    // First note: string 0 (open B = MIDI 23) fret 1
    expect(seq[0]).toMatchObject({ string: 0, fret: 1, midi: 24 });
  });

  test('5-string BEADG startString=1 forward — first note on string 1 (E)', () => {
    const seq = bigXSequence(TUNINGS.fiveStringBEADG, 1, 'forward');
    expect(seq).toHaveLength(184);
    expect(seq[0]).toMatchObject({ string: 1, fret: 1, midi: 29 });
  });

  test('6-string BEADGC startString=2 forward — first note on string 2 (A)', () => {
    const seq = bigXSequence(TUNINGS.sixStringBEADGC, 2, 'forward');
    expect(seq).toHaveLength(184);
    expect(seq[0]).toMatchObject({ string: 2, fret: 1, midi: 34 });
  });

  test('All notes have durationDenominator=8 and finger 1-4', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'forward');
    for (const n of seq) {
      expect(n.durationDenominator).toBe(8);
      expect(n.finger).toBeGreaterThanOrEqual(1);
      expect(n.finger).toBeLessThanOrEqual(4);
    }
  });

  test('MIDI matches tuning.openMidi[string] + fret for sampled notes', () => {
    const tuning = TUNINGS.fourStringEADG;
    const seq = bigXSequence(tuning, 0, 'forward');
    for (let i = 0; i < seq.length; i += 17) {
      const n = seq[i];
      expect(n.midi).toBe(tuning.openMidi[n.string] + n.fret);
    }
  });
});

describe('spiderSequence', () => {
  test('4-string EADG lowerString=0 forward — 184 notes', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'forward');
    expect(seq).toHaveLength(184);
  });

  test('First position forward (startFret=1, lowerString=0) on 4-string', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'forward');
    const first = seq.slice(0, 8).map(n => ({ string: n.string, fret: n.fret }));
    expect(first).toEqual([
      // Normal pass
      { string: 0, fret: 1 },
      { string: 1, fret: 2 },
      { string: 0, fret: 3 },
      { string: 1, fret: 4 },
      // Swap pass
      { string: 1, fret: 1 },
      { string: 0, fret: 2 },
      { string: 1, fret: 3 },
      { string: 0, fret: 4 },
    ]);
  });

  test('First position reverse (startFret=1, lowerString=0) on 4-string', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'reverse');
    const first = seq.slice(0, 8).map(n => ({ string: n.string, fret: n.fret }));
    expect(first).toEqual([
      // Normal reversed
      { string: 1, fret: 4 },
      { string: 0, fret: 3 },
      { string: 1, fret: 2 },
      { string: 0, fret: 1 },
      // Swap reversed
      { string: 0, fret: 4 },
      { string: 1, fret: 3 },
      { string: 0, fret: 2 },
      { string: 1, fret: 1 },
    ]);
  });

  test('Last position matches first (4-string forward)', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'forward');
    const first = seq.slice(0, 8);
    const last = seq.slice(-8);
    for (let i = 0; i < 8; i++) {
      expect(last[i].string).toBe(first[i].string);
      expect(last[i].fret).toBe(first[i].fret);
    }
  });

  test('Top position is at startFret=12 (12th position = indices 88..95)', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'forward');
    const top = seq.slice(88, 96);
    expect(top[0]).toMatchObject({ string: 0, fret: 12 });
    expect(top[3]).toMatchObject({ string: 1, fret: 15 });
  });

  test('5-string BEADG lowerString=3 (D+G) forward — first note on string 3', () => {
    const seq = spiderSequence(TUNINGS.fiveStringBEADG, 3, 'forward');
    expect(seq).toHaveLength(184);
    expect(seq[0]).toMatchObject({ string: 3, fret: 1, midi: 39 });
  });

  test('All notes have durationDenominator=8 and finger 1-4', () => {
    const seq = spiderSequence(TUNINGS.fourStringEADG, 0, 'forward');
    for (const n of seq) {
      expect(n.durationDenominator).toBe(8);
      expect(n.finger).toBeGreaterThanOrEqual(1);
      expect(n.finger).toBeLessThanOrEqual(4);
    }
  });
});

describe('agilitySpellingMap', () => {
  test("'sharp' maps the 5 black-key pitch classes to 'sharp'", () => {
    const m = agilitySpellingMap('sharp');
    expect(m.size).toBe(5);
    expect(m.get(1 as PitchClass)).toBe('sharp');
    expect(m.get(3 as PitchClass)).toBe('sharp');
    expect(m.get(6 as PitchClass)).toBe('sharp');
    expect(m.get(8 as PitchClass)).toBe('sharp');
    expect(m.get(10 as PitchClass)).toBe('sharp');
  });

  test("'flat' maps the same 5 keys to 'flat'", () => {
    const m = agilitySpellingMap('flat');
    expect(m.size).toBe(5);
    expect(m.get(1 as PitchClass)).toBe('flat');
    expect(m.get(10 as PitchClass)).toBe('flat');
  });

  test('white-key pitch classes are not in the map', () => {
    const m = agilitySpellingMap('sharp');
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) {
      expect(m.has(pc as PitchClass)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/exercises/agility.test.ts`
Expected: all FAIL with "Cannot find module './agility'".

- [ ] **Step 3: Create `src/exercises/agility.ts`**

```ts
import type { Tuning } from '../theory/tunings';
import type { PitchClass } from '../theory/notes';
import type { AccidentalKind } from '../theory/keys';
import type {
  FretboardNote,
  NoteSequence,
  AgilityDirection,
  AgilitySpelling,
} from './types';

// The 5 black-key pitch classes — C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭.
const BLACK_KEY_PCS = [1, 3, 6, 8, 10] as const;

const ASCENDING_START_FRETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DESCENDING_START_FRETS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const START_FRETS = [...ASCENDING_START_FRETS, ...DESCENDING_START_FRETS];

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

/**
 * Build the full Big X drill — 23 X's (12 ascending the neck + 11
 * descending) on the 4 adjacent strings starting at `startString`.
 * Each X is 8 notes (rising + falling diagonal, each played either
 * forward or reverse per `direction`).
 */
export function bigXSequence(
  tuning: Tuning,
  startString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  for (const startFret of START_FRETS) {
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
  if (direction === 'forward') {
    // Rising diagonal: (S+i, N+i) for i = 0..3, fingers 1..4
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + i, i + 1));
    }
    // Falling diagonal: (S+3-i, N+i) for i = 0..3, fingers 1..4
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + i, i + 1));
    }
  } else {
    // Reverse: each diagonal played backwards, pairing order preserved.
    // Rising reversed: (S+3-i, N+3-i) for i = 0..3, fingers 4..1
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + 3 - i, 4 - i));
    }
    // Falling reversed: (S+i, N+3-i) for i = 0..3, fingers 4..1
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + 3 - i, 4 - i));
    }
  }
  return notes;
}

/**
 * Build the full Spider drill — 23 positions (12 ascending the neck +
 * 11 descending) on the two adjacent strings `lowerString` (L) and
 * `lowerString + 1` (H). Each position is 8 notes (normal pass + swap
 * pass, each played either forward or reverse per `direction`).
 */
export function spiderSequence(
  tuning: Tuning,
  lowerString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  for (const startFret of START_FRETS) {
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
    // Normal pass — fingers 1..4
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    // Swap pass — same fret pattern, swapped strings, fingers 1..4 again
    notes.push(makeNote(tuning, H, startFret + 0, 1));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 3, 4));
  } else {
    // Reverse: each pass played backwards, pass order preserved.
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    notes.push(makeNote(tuning, L, startFret + 3, 4));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 0, 1));
  }
  return notes;
}

/**
 * Build the per-pitch-class accidental override map for an agility
 * exercise. Forces every black-key note to render as sharp or flat
 * per the variant's `spelling` field; white-key notes stay natural.
 */
export function agilitySpellingMap(
  spelling: AgilitySpelling,
): Map<PitchClass, AccidentalKind> {
  const acc: AccidentalKind = spelling === 'sharp' ? 'sharp' : 'flat';
  const m = new Map<PitchClass, AccidentalKind>();
  for (const pc of BLACK_KEY_PCS) {
    m.set(pc as PitchClass, acc);
  }
  return m;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/agility.test.ts`
Expected: all tests pass.

Then full suite:

Run: `npx vitest run`
Expected: all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/agility.ts src/exercises/agility.test.ts
git commit -m "feat(agility): add bigXSequence, spiderSequence, agilitySpellingMap"
```

---

## Task 3: Update `describeVariant` signature to take `tuning`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/App.svelte`

The agility variants need the tuning to format their display name (string names come from `tuning.openNoteNames`). Extend the signature and update the call sites.

- [ ] **Step 1: Update `describeVariant` signature in scale-generator.ts**

In `src/exercises/scale-generator.ts`, find `describeVariant` (around line 1444). Change the signature:

```ts
export function describeVariant(
  v: ExerciseParams['variant'],
  scale: Scale,
  tuning: Tuning,
): string {
```

Add `Tuning` to the imports if it isn't already (check the existing `import type { ... }` block — it imports `Tuning` from `../theory/tunings` already).

- [ ] **Step 2: Update the call site in `formatDisplayName`**

In the same file, find `formatDisplayName` (around line 1428-1442). Change the `describeVariant` call:

```ts
  const variantLabel = describeVariant(params.variant, params.scale, params.tuning);
```

- [ ] **Step 3: Update the call site in App.svelte**

In `src/App.svelte`, find the `describeVariant(...)` call (around line 300). It currently passes 2 args:

```svelte
<span class="chip"
  >{describeVariant(
    currentExercise.params.variant,
    currentExercise.params.scale,
  )}</span
>
```

Change to:

```svelte
<span class="chip"
  >{describeVariant(
    currentExercise.params.variant,
    currentExercise.params.scale,
    currentExercise.params.tuning,
  )}</span
>
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all tests pass (no behavior change yet for non-agility variants).

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/App.svelte
git commit -m "refactor(agility): extend describeVariant signature with tuning"
```

---

## Task 4: Wire `generateExercise` dispatch for bigX + spider

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/scale-generator.test.ts`. Check existing imports — `bigXSequence` will need to be referenced for tests; `KEYS_BY_ID` may already be imported.

```ts
describe('generateExercise — agility (bigX)', () => {
  test('Big X 4-string EADG, startString=0, forward, sharp — 184 notes', () => {
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: 0 as const,
      rootName: 'C',
      variant: { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      spelling: undefined,
    });
    expect(ex.sequence).toHaveLength(184);
    expect(ex.sequence[0]).toMatchObject({ string: 0, fret: 1 });
  });

  test('Big X reverse — first note matches reverse pattern', () => {
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: 0 as const,
      rootName: 'C',
      variant: { kind: 'bigX', startString: 0, direction: 'reverse', spelling: 'sharp' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      spelling: undefined,
    });
    expect(ex.sequence[0]).toMatchObject({ string: 3, fret: 4 });
  });
});

describe('generateExercise — agility (spider)', () => {
  test('Spider 4-string EADG, lowerString=1, forward, flat — 184 notes', () => {
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: 0 as const,
      rootName: 'C',
      variant: { kind: 'spider', lowerString: 1, direction: 'forward', spelling: 'flat' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      spelling: undefined,
    });
    expect(ex.sequence).toHaveLength(184);
    // First note: string 1 (A), fret 1
    expect(ex.sequence[0]).toMatchObject({ string: 1, fret: 1 });
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "agility"`
Expected: FAIL — `generateExercise` doesn't yet dispatch the new variants. The placeholder branches throw or fall through to the final `else { throw }`.

- [ ] **Step 3: Add the dispatch branches in `generateExercise`**

In `src/exercises/scale-generator.ts`, find `generateExercise`. Add `bigXSequence` and `spiderSequence` to the imports from `./agility`:

```ts
import { bigXSequence, spiderSequence } from './agility';
```

Find the existing variant-dispatch chain in `generateExercise` (the series of `} else if (...) {` branches ending in `} else { throw ... }`). Add two new branches BEFORE the final `} else {`:

```ts
  } else if (variant.kind === 'bigX') {
    sequence = bigXSequence(tuning, variant.startString, variant.direction);
  } else if (variant.kind === 'spider') {
    sequence = spiderSequence(tuning, variant.lowerString, variant.direction);
  } else {
```

These bypass the `lowRootPos` / `layOnFretboard` pipeline because they generate `FretboardNote[]` directly. **Important:** the existing code at the top of `generateExercise` calls `pickStartingPosition` which will throw for agility variants (no valid scale-degree-based start). The dispatch branches must run BEFORE that call OR the throw must be guarded.

Look at the structure — `lowRootPos` is computed at the top of `generateExercise` before the variant dispatch. For agility variants this computation is irrelevant and may fail. Guard it:

Find the line that throws when `lowRootPos` is null (around line 1313):

```ts
if (!lowRootPos) {
  throw new Error(
    `No valid starting position for root pc ${rootPc} with ${handPosition} hand`,
  );
}
```

Restructure: skip the `pickStartingPosition` call entirely for agility variants. Add an early-return-ish branch at the very top of `generateExercise` (right after destructuring params):

```ts
export function generateExercise(params: ExerciseParams): Exercise {
  const { scale, rootPc, variant, handPosition, tuning, useOpenStrings } = params;

  // Agility drills emit FretboardNote[] directly — no scale/key/hand-position
  // lookup needed. Short-circuit before pickStartingPosition.
  if (variant.kind === 'bigX' || variant.kind === 'spider') {
    const sequence =
      variant.kind === 'bigX'
        ? bigXSequence(tuning, variant.startString, variant.direction)
        : spiderSequence(tuning, variant.lowerString, variant.direction);
    const displayName = formatDisplayName(params);
    const alphaTex = emitAlphaTex(sequence, tuning, {
      title: displayName,
      keySignature: params.keySignature,
      keySignatureLabel: params.keySignatureLabel,
      spelling: params.spelling,
    });
    return { params, sequence, alphaTex, displayName };
  }

  // ... existing body (the lowRootPos computation onward) ...
```

This avoids modifying the existing dispatch chain — agility short-circuits entirely. The `else if` branches you'd otherwise add are unnecessary.

- [ ] **Step 4: Run the new tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "agility"`
Expected: PASS.

Then full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(agility): wire generateExercise short-circuit for bigX + spider"
```

---

## Task 5: Extend `isHandPositionMeaningful` and `canonicalHandPositionForVariant`

**Files:**
- Modify: `src/exercises/scale-generator.ts`

- [ ] **Step 1: Update both functions**

In `src/exercises/scale-generator.ts`, find `isHandPositionMeaningful` (around line 374):

```ts
export function isHandPositionMeaningful(
  scale: Scale,
  variant: Variant,
): boolean {
  if (variant.kind === 'arpeggioCycle') return false;
  if (variant.kind === 'bigX' || variant.kind === 'spider') return false;
  if (variant.kind !== 'intervalWalk') return true;
  return walkingPairMaxSemitones(scale, variant) < 7;
}
```

Find `canonicalHandPositionForVariant` (around line 390):

```ts
export function canonicalHandPositionForVariant(
  variant: Variant,
): HandPosition {
  if (variant.kind === 'arpeggioCycle') return 'front';
  if (variant.kind === 'bigX' || variant.kind === 'spider') return 'front';
  if (variant.kind !== 'intervalWalk') return 'front';
  return variant.intervalDir === 'down' ? 'back' : 'front';
}
```

- [ ] **Step 2: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean check, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/exercises/scale-generator.ts
git commit -m "feat(agility): mark bigX/spider as hand-position-irrelevant"
```

---

## Task 6: Add `enabledAgility` to Settings + bump storage version

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Add the `AgilityToggles` interface and Settings field**

In `src/stores/settings.ts`, after the existing `ArpeggioToggles` interface, add:

```ts
export interface AgilityToggles {
  bigX: boolean;
  spider: boolean;
}
```

In the `Settings` interface, add a new field after `enabledArpeggios`:

```ts
  enabledAgility: AgilityToggles;
```

- [ ] **Step 2: Bump storage key from `v5` to `v6`**

Find the `STORAGE_KEY` constant and change:

```ts
const STORAGE_KEY = 'bass-practice:settings:v6';
```

- [ ] **Step 3: Add defaults in `defaultSettings`**

In `defaultSettings()`, add after `enabledArpeggios`:

```ts
    enabledAgility: {
      bigX: true,
      spider: true,
    },
```

- [ ] **Step 4: Extend `loadSettings` merge for the new sub-object**

In `loadSettings`, add to the merged return object (alongside `enabledArpeggios`):

```ts
      enabledAgility: {
        ...defaults.enabledAgility,
        ...parsed.enabledAgility,
      },
```

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/stores/settings.ts
git commit -m "feat(agility): add enabledAgility settings + bump storage to v6"
```

---

## Task 7: Emit agility variants from the picker

**Files:**
- Modify: `src/exercises/picker.ts`
- Modify: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/picker.test.ts`. Add `AgilityToggles` to the imports from `../stores/settings` if needed.

```ts
describe('generateUniverse — agility universe', () => {
  function agilityOnly(toggles: { bigX?: boolean; spider?: boolean } = {}): Settings {
    const empty = (val: boolean) => ({
      plain: val,
      multiOctaveA_2: val,
      multiOctaveA_3: val,
      multiOctaveB_2: val,
      consecutive_3: val,
      consecutive_4: val,
      mirror_3: val,
      mirror_4: val,
      intervalWalks: val,
    });
    return {
      ...baseSettings,
      enabledVariants: empty(false),
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: {
        bigX: toggles.bigX ?? true,
        spider: toggles.spider ?? true,
      },
    };
  }

  test('Big X only, 4-string EADG: 4 entries (1 startString × 2 directions × 2 spellings)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    expect(universe).toHaveLength(4);
    for (const p of universe) {
      expect(p.variant.kind).toBe('bigX');
    }
  });

  test('Big X only, 5-string BEADG: 8 entries (2 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fiveStringBEADG',
    };
    expect(generateUniverse(s)).toHaveLength(8);
  });

  test('Big X only, 6-string BEADGC: 12 entries (3 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'sixStringBEADGC',
    };
    expect(generateUniverse(s)).toHaveLength(12);
  });

  test('Spider only, 4-string EADG: 12 entries (3 pairs × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: false, spider: true }),
      tuningId: 'fourStringEADG',
    };
    expect(generateUniverse(s)).toHaveLength(12);
  });

  test('Spider only, 5-string BEADG: 16 entries (4 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: false, spider: true }),
      tuningId: 'fiveStringBEADG',
    };
    expect(generateUniverse(s)).toHaveLength(16);
  });

  test('agility on with no enabled keys/scales/handPositions still emits entries', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
      enabledScales: {} as Settings['enabledScales'],
      enabledKeys: [],
      enabledHandPositions: [],
    };
    expect(generateUniverse(s)).toHaveLength(4);
  });

  test('agility entries use chromatic scale + C root + front hand', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    for (const p of universe) {
      expect(p.scale.name).toBe('Chromatic');
      expect(p.rootPc).toBe(0);
      expect(p.rootName).toBe('C');
      expect(p.handPosition).toBe('front');
      expect(p.useOpenStrings).toBe(false);
    }
  });

  test('agility entries have a populated spelling map (5 entries)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    for (const p of universe) {
      expect(p.spelling).toBeDefined();
      expect(p.spelling!.size).toBe(5);
    }
  });

  test('disabling both agility toggles removes agility entries', () => {
    const s: Settings = agilityOnly({ bigX: false, spider: false });
    expect(generateUniverse(s)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "agility universe"`
Expected: FAIL — no agility entries yet.

- [ ] **Step 3: Extend `variantsFromSettings`**

In `src/exercises/picker.ts`, find `variantsFromSettings` (around line 214). After the existing arpeggio block, append:

```ts
  const AGILITY_DIRECTIONS: Array<'forward' | 'reverse'> = ['forward', 'reverse'];
  const AGILITY_SPELLINGS: Array<'sharp' | 'flat'> = ['sharp', 'flat'];
  if (s.enabledAgility.bigX) {
    // 4 adjacent strings × 2 directions × 2 spellings per valid startString.
    for (let startString = 0; startString + 3 < stringCount; startString++) {
      for (const direction of AGILITY_DIRECTIONS) {
        for (const spelling of AGILITY_SPELLINGS) {
          variants.push({ kind: 'bigX', startString, direction, spelling });
        }
      }
    }
  }
  if (s.enabledAgility.spider) {
    for (let lowerString = 0; lowerString < stringCount - 1; lowerString++) {
      for (const direction of AGILITY_DIRECTIONS) {
        for (const spelling of AGILITY_SPELLINGS) {
          variants.push({ kind: 'spider', lowerString, direction, spelling });
        }
      }
    }
  }
```

- [ ] **Step 4: Short-circuit agility variants in `generateUniverse`**

In `src/exercises/picker.ts`, find `generateUniverse` (around line 264). The existing structure iterates scales × keys × variants. For agility variants we need to short-circuit BEFORE the keys × scales loop because they don't depend on key/scale.

Add `agilitySpellingMap` to the imports:

```ts
import { agilitySpellingMap } from './agility';
import { SCALES, ... } from '../theory/scales';
```

Inside `generateUniverse`, BEFORE the existing `for (const scaleId of enabledScaleIds)` loop, add:

```ts
  const result: ExerciseParams[] = [];

  // Agility variants don't depend on key/scale/handPosition — short-circuit
  // before the keys × scales × handPositions iteration.
  const agilityVariants = variants.filter(
    (v) => v.kind === 'bigX' || v.kind === 'spider',
  );
  const nonAgilityVariants = variants.filter(
    (v) => v.kind !== 'bigX' && v.kind !== 'spider',
  );
  for (const variant of agilityVariants) {
    if (variant.kind !== 'bigX' && variant.kind !== 'spider') continue;
    result.push({
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
    });
  }
```

Then change the existing variant loop to iterate `nonAgilityVariants` instead of `variants` (so agility entries aren't re-processed by the key/scale/hand-position iteration). Find the `for (const variant of variants) {` line inside the per-key body and change to:

```ts
      for (const variant of nonAgilityVariants) {
```

Note: the existing `const result: ExerciseParams[] = [];` declaration is BEFORE the scale loop. Make sure the agility short-circuit runs after `result` is initialized but before the scale loop iterates.

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "agility universe"`
Expected: PASS for all 9 tests.

Then full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(agility): emit bigX + spider variants from picker (short-circuit)"
```

---

## Task 8: URL encoding for agility variants

**Files:**
- Modify: `src/exercises/picker.ts`
- Modify: `src/exercises/picker.test.ts`

Task 1 added placeholders to `paramsKey` (`'agility:bigX:placeholder'` and `'agility:spider:placeholder'`). This task replaces them with the real encoding and adds the parser branch in `paramsFromKey`.

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/picker.test.ts`. Add `paramsFromKey` to the import from `./picker` if not present.

```ts
describe('paramsKey / paramsFromKey — agility round-trip', () => {
  function makeAgilitySettings(opts: { bigX: boolean; spider: boolean }) {
    return {
      ...baseSettings,
      enabledVariants: {
        plain: false, multiOctaveA_2: false, multiOctaveA_3: false,
        multiOctaveB_2: false, consecutive_3: false, consecutive_4: false,
        mirror_3: false, mirror_4: false, intervalWalks: false,
      },
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: opts,
    } as Settings;
  }

  test('bigX:0:fwd:sharp round-trips', () => {
    const s = makeAgilitySettings({ bigX: true, spider: false });
    const universe = generateUniverse(s);
    const target = universe.find(
      (p) =>
        p.variant.kind === 'bigX' &&
        p.variant.startString === 0 &&
        p.variant.direction === 'forward' &&
        p.variant.spelling === 'sharp',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:bigX:0:fwd:sharp');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('bigX');
    if (restored!.variant.kind === 'bigX') {
      expect(restored!.variant.startString).toBe(0);
      expect(restored!.variant.direction).toBe('forward');
      expect(restored!.variant.spelling).toBe('sharp');
    }
  });

  test('bigX:1:rev:flat round-trips', () => {
    const s = makeAgilitySettings({ bigX: true, spider: false });
    const universe = generateUniverse({ ...s, tuningId: 'fiveStringBEADG' });
    const target = universe.find(
      (p) =>
        p.variant.kind === 'bigX' &&
        p.variant.startString === 1 &&
        p.variant.direction === 'reverse' &&
        p.variant.spelling === 'flat',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:bigX:1:rev:flat');
    const restored = paramsFromKey(key);
    expect(restored!.variant.kind).toBe('bigX');
  });

  test('spider:2:fwd:flat round-trips', () => {
    const s = makeAgilitySettings({ bigX: false, spider: true });
    const universe = generateUniverse(s);
    const target = universe.find(
      (p) =>
        p.variant.kind === 'spider' &&
        p.variant.lowerString === 2 &&
        p.variant.direction === 'forward' &&
        p.variant.spelling === 'flat',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:spider:2:fwd:flat');
    const restored = paramsFromKey(key);
    expect(restored!.variant.kind).toBe('spider');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "agility round-trip"`
Expected: FAIL — placeholders produce wrong keys.

- [ ] **Step 3: Replace the `paramsKey` placeholders**

In `src/exercises/picker.ts`, find the placeholder cases added in Task 1 (in `paramsKey`'s switch). Replace them:

```ts
    case 'bigX':
      variantKey = `agility:bigX:${p.variant.startString}:${
        p.variant.direction === 'forward' ? 'fwd' : 'rev'
      }:${p.variant.spelling}`;
      break;
    case 'spider':
      variantKey = `agility:spider:${p.variant.lowerString}:${
        p.variant.direction === 'forward' ? 'fwd' : 'rev'
      }:${p.variant.spelling}`;
      break;
```

- [ ] **Step 4: Extend `paramsFromKey`**

In `src/exercises/picker.ts`, find `paramsFromKey` (around line 38). The parser splits on `:` to get `kind` and `rest`. Add new branches for `agility`:

Find the existing `else if (kind === 'arpeggio')` block. After it (still in the variant parsing chain), add:

```ts
    } else if (kind === 'agility') {
      // rest format: "<subkind>:<index>:<dir>:<spelling>"
      // e.g., "bigX:0:fwd:sharp" or "spider:2:rev:flat"
      const parts = rest.split(':');
      if (parts.length !== 4) return null;
      const [subkind, indexStr, dirStr, spellingStr] = parts;
      const index = Number(indexStr);
      if (!Number.isFinite(index)) return null;
      const direction = dirStr === 'fwd' ? 'forward' : dirStr === 'rev' ? 'reverse' : null;
      if (direction === null) return null;
      if (spellingStr !== 'sharp' && spellingStr !== 'flat') return null;
      if (subkind === 'bigX') {
        variant = {
          kind: 'bigX',
          startString: index,
          direction,
          spelling: spellingStr as 'sharp' | 'flat',
        };
      } else if (subkind === 'spider') {
        variant = {
          kind: 'spider',
          lowerString: index,
          direction,
          spelling: spellingStr as 'sharp' | 'flat',
        };
      } else {
        return null;
      }
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "agility round-trip"`
Expected: PASS.

Full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(agility): paramsKey / paramsFromKey URL encoding for bigX + spider"
```

---

## Task 9: Update `formatDisplayName` + `describeVariant` for agility

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
describe('formatDisplayName — agility', () => {
  function agilityParams(
    variant: Variant,
    tuning: Tuning = TUNINGS.fourStringEADG,
  ) {
    return {
      scale: SCALES.chromatic,
      rootPc: 0 as const,
      rootName: 'C',
      variant,
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning,
      keySignature: 0,
      keySignatureLabel: 'C',
    };
  }

  test('bigX 4-string EADG startString=0 fwd sharp → "Big X E-A-D-G ↑ ♯"', () => {
    const name = formatDisplayName(agilityParams({
      kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp',
    }));
    expect(name).toBe('Big X E-A-D-G ↑ ♯');
  });

  test('bigX 5-string BEADG startString=1 rev flat → "Big X E-A-D-G ↓ ♭"', () => {
    const name = formatDisplayName(agilityParams(
      { kind: 'bigX', startString: 1, direction: 'reverse', spelling: 'flat' },
      TUNINGS.fiveStringBEADG,
    ));
    expect(name).toBe('Big X E-A-D-G ↓ ♭');
  });

  test('bigX 5-string BEADG startString=0 fwd sharp → "Big X B-E-A-D ↑ ♯"', () => {
    const name = formatDisplayName(agilityParams(
      { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' },
      TUNINGS.fiveStringBEADG,
    ));
    expect(name).toBe('Big X B-E-A-D ↑ ♯');
  });

  test('spider 4-string EADG lowerString=0 fwd sharp → "Spider E-A ↑ ♯"', () => {
    const name = formatDisplayName(agilityParams({
      kind: 'spider', lowerString: 0, direction: 'forward', spelling: 'sharp',
    }));
    expect(name).toBe('Spider E-A ↑ ♯');
  });

  test('spider 4-string EADG lowerString=2 rev flat → "Spider D-G ↓ ♭"', () => {
    const name = formatDisplayName(agilityParams({
      kind: 'spider', lowerString: 2, direction: 'reverse', spelling: 'flat',
    }));
    expect(name).toBe('Spider D-G ↓ ♭');
  });

  test('agility names do not contain key/scale prefix', () => {
    const name = formatDisplayName(agilityParams({
      kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp',
    }));
    expect(name).not.toContain('Chromatic');
    expect(name).not.toContain('C ');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — agility"`
Expected: FAIL — `describeVariant` returns the placeholder strings.

- [ ] **Step 3: Update `formatDisplayName` to skip the key prefix for agility**

In `src/exercises/scale-generator.ts`, find `formatDisplayName` (around line 1428). Add a check at the top to short-circuit for agility variants:

```ts
export function formatDisplayName(params: ExerciseParams): string {
  // Agility drills have no key/scale/hand-position concept — display name
  // is just the variant label.
  if (params.variant.kind === 'bigX' || params.variant.kind === 'spider') {
    return describeVariant(params.variant, params.scale, params.tuning);
  }
  const root = params.rootName ?? pitchClassName(params.rootPc, 'sharp');
  // ... existing body unchanged ...
```

- [ ] **Step 4: Update `describeVariant` to render the new agility variants**

In the same file, find the `describeVariant` switch. Replace the placeholder cases added in Task 1 with the real implementations:

```ts
    case 'bigX': {
      const names = tuning.openNoteNames
        .slice(v.startString, v.startString + 4)
        .join('-');
      const dirSym = v.direction === 'forward' ? '↑' : '↓';
      const spSym = v.spelling === 'sharp' ? '♯' : '♭';
      return `Big X ${names} ${dirSym} ${spSym}`;
    }
    case 'spider': {
      const lo = tuning.openNoteNames[v.lowerString];
      const hi = tuning.openNoteNames[v.lowerString + 1];
      const dirSym = v.direction === 'forward' ? '↑' : '↓';
      const spSym = v.spelling === 'sharp' ? '♯' : '♭';
      return `Spider ${lo}-${hi} ${dirSym} ${spSym}`;
    }
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — agility"`
Expected: PASS for all 6 tests.

Full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(agility): display names for bigX + spider variants"
```

---

## Task 10: Add "Hand-agility drills" section to SettingsPanel.svelte

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add toggle helpers**

In `src/components/SettingsPanel.svelte`, find the arpeggio toggle helpers (`toggleArpSize`, `toggleArpDirection`). After them, add:

```ts
  function toggleAgility(key: keyof typeof $settings.enabledAgility) {
    settings.update((s) => ({
      ...s,
      enabledAgility: {
        ...s.enabledAgility,
        [key]: !s.enabledAgility[key],
      },
    }));
  }
```

- [ ] **Step 2: Add the section in the template**

Find the existing "Arpeggios" section's closing `</section>` tag. Right after it, insert:

```svelte
    <section>
      <h3>Hand-agility drills</h3>
      <p class="hint">Chromatic finger-coordination patterns up the neck. No key — pure technique.</p>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledAgility.bigX}
          onchange={() => toggleAgility('bigX')}
        />
        Big X — diagonals across 4 adjacent strings
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledAgility.spider}
          onchange={() => toggleAgility('spider')}
        />
        Spider — two-string crawl
      </label>
    </section>
```

(The `.hint` CSS class was added during the arpeggio implementation in Task 13. Reuse it.)

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: clean.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(agility): SettingsPanel toggles for Big X and Spider"
```

---

## Task 11: Add `agility` filter chip to BrowsePanel.svelte

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

- [ ] **Step 1: Read the existing variant-family structure**

Run: `grep -n "VariantFamily\|matchVariantFamily\|arpeggios" src/components/BrowsePanel.svelte | head -10`

This shows where the `VariantFamily` union and the `matchVariantFamily` switch live, plus the chip array.

- [ ] **Step 2: Extend `VariantFamily`**

Add `'agility'` to the `VariantFamily` union (find the type declaration in BrowsePanel.svelte and add it as a new member).

- [ ] **Step 3: Extend `matchVariantFamily`**

Add a new case to the switch:

```ts
    case 'agility':
      return v.kind === 'bigX' || v.kind === 'spider';
```

- [ ] **Step 4: Add the chip to the chip array**

Find the array literal that defines the chips (likely an inline `{#each [{ id: 'all', label: 'All' }, ...] as ...}` or similar). Add a new entry at the end:

```ts
{ id: 'agility', label: 'Agility' }
```

- [ ] **Step 5: Typecheck**

Run: `npm run check && npx vitest run`
Expected: clean check, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(agility): BrowsePanel agility family chip"
```

---

## Task 12: Extend `trace-exercise.ts` and `scan-layouts.ts` for agility

**Files:**
- Modify: `scripts/trace-exercise.ts`
- Modify: `scripts/scan-layouts.ts`

- [ ] **Step 1: Extend `trace-exercise.ts` grammar and parser**

In `scripts/trace-exercise.ts`, update the usage comment block at the top to add the agility forms:

```
//   bigx<S>-<dir>-<sp>          → Big X, e.g. bigx0-fwd-sharp
//   spider<L>-<dir>-<sp>        → Spider, e.g. spider2-rev-flat
//     <dir> = fwd | rev, <sp> = sharp | flat
```

In `parseVariant`, add new branches before the final `throw`:

```ts
  const bigx = spec.match(/^bigx(\d+)-(fwd|rev)-(sharp|flat)$/);
  if (bigx) {
    return {
      kind: 'bigX',
      startString: Number(bigx[1]),
      direction: bigx[2] === 'fwd' ? 'forward' : 'reverse',
      spelling: bigx[3] as 'sharp' | 'flat',
    };
  }
  const spider = spec.match(/^spider(\d+)-(fwd|rev)-(sharp|flat)$/);
  if (spider) {
    return {
      kind: 'spider',
      lowerString: Number(spider[1]),
      direction: spider[2] === 'fwd' ? 'forward' : 'reverse',
      spelling: spider[3] as 'sharp' | 'flat',
    };
  }
```

- [ ] **Step 2: Verify trace-exercise works**

Run: `npx tsx scripts/trace-exercise.ts C major bigx0-fwd-sharp front`
Expected: prints the 184-note Big X sequence. The `<keyId> <scaleId>` arguments are ignored by agility variants but the script still requires them.

Run: `npx tsx scripts/trace-exercise.ts C major spider1-rev-flat front`
Expected: prints the 184-note Spider sequence.

- [ ] **Step 3: Replace `variantTag` placeholders in scan-layouts.ts**

In `scripts/scan-layouts.ts`, find the `variantTag` placeholders added in Task 1. Replace them:

```ts
    case 'bigX':
      return `bigX ${v.startString}-${v.direction === 'forward' ? 'fwd' : 'rev'}-${v.spelling}`;
    case 'spider':
      return `spider ${v.lowerString}-${v.direction === 'forward' ? 'fwd' : 'rev'}-${v.spelling}`;
```

- [ ] **Step 4: Add an `agility` filter flag**

Find the existing `onlyWalking` / `onlyArpeggio` flags and add an `agility` filter:

```ts
const onlyWalking = process.argv.includes('walking');
const onlyArpeggio = process.argv.includes('arpeggio');
const onlyAgility = process.argv.includes('agility');
```

Update the comment block at the top to document it:

```
//   npx tsx scripts/scan-layouts.ts agility           # only agility (Big X + Spider)
```

In the filter check, add:

```ts
  if (
    onlyAgility &&
    params.variant.kind !== 'bigX' &&
    params.variant.kind !== 'spider'
  ) continue;
```

Update the summary line to include the agility flag:

```ts
console.log(
  `${totalIssues} issues out of ${totalChecked} exercises${onlyWalking ? ' (walking only)' : ''}${onlyArpeggio ? ' (arpeggio only)' : ''}${onlyAgility ? ' (agility only)' : ''}`,
);
```

- [ ] **Step 5: Verify scan-layouts works**

Run: `npx tsx scripts/scan-layouts.ts agility`
Expected: prints `0 issues out of N exercises (agility only)` where N is non-zero (24 with default 4-string tuning).

Run: `npx tsx scripts/scan-layouts.ts`
Expected: full scan still works, total issue count unchanged.

- [ ] **Step 6: Commit**

```bash
git add scripts/trace-exercise.ts scripts/scan-layouts.ts
git commit -m "feat(agility): trace-exercise and scan-layouts support bigX + spider"
```

---

## Task 13: Manual end-to-end verification

**No code changes — verification gate.**

The preview tool's Electron context doesn't fully render AlphaTab (verified during the arpeggio implementation). User to verify visually in a real browser.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app in a real browser** at the printed URL.

- [ ] **Step 3: Verify in Settings**
- Open the Settings panel (⚙ button).
- Confirm the new "Hand-agility drills" section appears below "Arpeggios" with two checkboxes (Big X, Spider).
- Both default ON.

- [ ] **Step 4: Pick an exercise via N key until an agility drill comes up**
- Confirm the display name reads e.g. `"Big X E-A-D-G ↑ ♯"` or `"Spider D-G ↓ ♭"` (no key/scale prefix, no hand position chip).
- Confirm AlphaTab renders the notation as a long chromatic sequence with proper accidentals (sharps for `♯` variants, flats for `♭`).
- Confirm the SVG fretboard shows the agility notes correctly.
- Start the metronome (Space); confirm it ticks against the long exercise.

- [ ] **Step 5: Verify URL bookmarkability**
- Copy the URL of a loaded agility exercise.
- Reload — confirm the same exercise loads.

- [ ] **Step 6: Verify BrowsePanel**
- Open the Browse panel (🔍 button).
- Click the new "Agility" filter chip.
- Confirm only agility entries appear; tap one and confirm it loads.

- [ ] **Step 7: Verify on a 5-string tuning**
- In Settings, switch to 5-string BEADG.
- Pick a few exercises until a Big X comes up.
- Confirm at least one Big X has the lowest 4 strings (B-E-A-D) and at least one has the upper 4 (E-A-D-G).

- [ ] **Step 8: Verify settings persistence**
- Disable Spider in Settings; reload; confirm it's still disabled.
- Re-enable it.

- [ ] **Step 9: If anything looks wrong, report and don't proceed. Otherwise no commit.**

---

## Task 14: Final test suite + universe scan + build

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: all tests pass. Note the count for the plan.md update (will be ~275 + new agility tests).

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 3: Full universe scan**

Run: `npx tsx scripts/scan-layouts.ts`
Expected: 0 issues. Note the new total exercise count (was 16,134 + ~24 agility per tuning).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: If all gates pass, no commit; otherwise fix and add regression tests.**

---

## Task 15: Update `docs/plan.md`

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Move Big X and Spider entries from "Future passes" to "Recent additions"**

In `docs/plan.md`, find the "Future passes" section. Remove these bullets:

```markdown
- Big X — hand-agility exercise.
- Spider — two-string crawl.
```

In the "Recent additions" section, add a new bullet at the top:

```markdown
- [x] **Hand-agility drills — Big X and Spider.** Chromatic finger-coordination patterns scanning frets 1 → 12 → 1. Both have 4 variants: 2 directions (forward / reverse) × 2 spellings (sharp / flat). Big X plays diagonals across 4 adjacent strings (random 4-subset rotated by picker on 5/6-string basses). Spider plays interleaved patterns on adjacent string pairs (rotated by picker). 96 agility universe entries across 4 tunings. Spec: [docs/superpowers/specs/2026-05-18-agility-drills-design.md](superpowers/specs/2026-05-18-agility-drills-design.md). New module: [src/exercises/agility.ts](../src/exercises/agility.ts).
```

- [ ] **Step 2: Update the "State:" line**

Find the line that currently says something like "State: 272 unit tests passing... Universe currently 16,134 exercises...". Update with the new counts from Task 14.

- [ ] **Step 3: Commit**

```bash
git add docs/plan.md
git commit -m "docs(agility): mark Big X and Spider complete in plan.md"
```

---

## Self-review checklist

After completing all tasks:

- [ ] Every section of the spec is covered.
- [ ] Function names match across tasks (`bigXSequence`, `spiderSequence`, `agilitySpellingMap`, `AgilityDirection`, `AgilitySpelling`).
- [ ] No `'agility:bigX:placeholder'` or `'agility:spider:placeholder'` strings remain anywhere in `src/` (search to confirm).
- [ ] No `'Big X (placeholder)'` / `'Spider (placeholder)'` strings remain in `src/`.
- [ ] No `'bigX placeholder'` / `'spider placeholder'` strings remain in `scripts/`.
- [ ] Manual UI verification passed.
- [ ] All tests pass + scan shows 0 issues.
