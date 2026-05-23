# Rhythm variations — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "rhythm" axis to exercise variation — each exercise plays one of 6 rhythms (Quarter, Eighth, Triplet, 8ss, s8s, ss8). Picker rotates rhythms × other axes; default is Quarter notes only. Hand-agility drills (Big X, Spider) opt out and always use eighth notes.

**Architecture:** New `Rhythm` type and `applyRhythm(sequence, rhythm)` helper in `src/exercises/rhythm.ts`. Existing variant generators continue to emit notes as today; `generateExercise` calls `applyRhythm` after the variant dispatch to overwrite per-note `durationDenominator` (and add `tuplet` for triplets). Picker `generateUniverse` multiplies non-agility entries × enabled rhythms; agility stays at one entry per `(tuning, variant)` with `rhythm: 'eighth'`. AlphaTex emitter is rewritten to track per-note duration changes and tuplet markers, with bar splitting by summed beat-fraction instead of note count. `ExerciseParams.rhythm` is OPTIONAL — defaults to `'eighth'` when unset so existing test fixtures and scripts keep working without churn.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest, AlphaTab.

**Reference spec:** [docs/superpowers/specs/2026-05-22-rhythm-variations-design.md](../specs/2026-05-22-rhythm-variations-design.md)

---

## File structure

**New files:**

| File | Responsibility |
|------|----------------|
| `src/exercises/rhythm.ts` | `Rhythm` type, `RHYTHM_PATTERNS`, `applyRhythm` |
| `src/exercises/rhythm.test.ts` | Unit tests for `applyRhythm` |

**Modified files:**

| File | What changes |
|------|--------------|
| `src/exercises/types.ts` | Add `Rhythm` import + optional `rhythm?: Rhythm` field on `ExerciseParams`; add `tuplet?: number` field on `FretboardNote` |
| `src/stores/settings.ts` | Add `RhythmToggles` interface + `enabledRhythms` field; bump storage key v6 → v7; update `defaultSettings` + `loadSettings` merge |
| `src/exercises/scale-generator.ts` | `generateExercise` calls `applyRhythm` after variant dispatch (agility opt-out forces `'eighth'`); `formatDisplayName` appends rhythm glyph |
| `src/exercises/picker.ts` | `generateUniverse` multiplies non-agility entries by enabled rhythms; agility entries explicitly set `rhythm: 'eighth'`; `paramsKey` and `paramsFromKey` include rhythm segment with back-compat for 6-segment URLs |
| `src/notation/alphatex-emitter.ts` | Per-note duration tracking; tuplet markers (`{tu N}`); mixed-duration bar splitting by summed beat fractions; `computePerBarClefs` adapts to bar-index iteration |
| `src/components/SettingsPanel.svelte` | New "Rhythms" section with 6 toggles + All/None buttons + helpers; extend `enableAll` and `resetToDefaults` to cover rhythms |
| `src/components/BrowsePanel.svelte` | New Rhythm filter chip row between Variant and Scale; greys out when Variant filter is Agility |
| Various tests | Update fixtures where universe size or AlphaTex output changes |
| `docs/plan.md` | Mark feature complete |

---

## Task 1: Add `Rhythm` type, `applyRhythm` helper, and `tuplet` field

**Files:**
- Create: `src/exercises/rhythm.ts`
- Create: `src/exercises/rhythm.test.ts`
- Modify: `src/exercises/types.ts`

- [ ] **Step 1: Add `tuplet?: number` to `FretboardNote` and export the Rhythm type from types.ts**

In `src/exercises/types.ts`, find the `FretboardNote` interface (around line 61). Add a new optional field:

```ts
export interface FretboardNote {
  string: number;
  fret: number;
  midi: number;
  /** 1=whole, 2=half, 4=quarter, 8=eighth, 16=sixteenth. */
  durationDenominator: number;
  /**
   * Fretting-hand finger: 1=index, 2=middle, 3=ring, 4=pinky.
   * Derived from the active hand window at placement time.
   */
  finger?: number;
  /**
   * Tuplet ratio (e.g., 3 = "3 in the time of 2"). When set, the
   * AlphaTex emitter emits `{tu N}` for the note so it renders with
   * the appropriate tuplet bracket. Used by triplet rhythms.
   */
  tuplet?: number;
}
```

Then add the `Rhythm` type export anywhere in the same file (e.g., after `ArpDirection`):

```ts
export type Rhythm = 'quarter' | 'eighth' | 'triplet' | '8ss' | 's8s' | 'ss8';
```

- [ ] **Step 2: Write the failing tests**

Create `src/exercises/rhythm.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { applyRhythm } from './rhythm';
import type { NoteSequence, FretboardNote } from './types';

function makeSeq(n: number): NoteSequence {
  const out: FretboardNote[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ string: 0, fret: i, midi: 28 + i, durationDenominator: 999 });
  }
  return out;
}

describe('applyRhythm — quarter', () => {
  test('all notes get durationDenominator 4, no tuplet', () => {
    const seq = applyRhythm(makeSeq(12), 'quarter');
    expect(seq).toHaveLength(12);
    for (const n of seq) {
      expect(n.durationDenominator).toBe(4);
      expect(n.tuplet).toBeUndefined();
    }
  });
});

describe('applyRhythm — eighth', () => {
  test('all notes get durationDenominator 8, no tuplet', () => {
    const seq = applyRhythm(makeSeq(12), 'eighth');
    for (const n of seq) {
      expect(n.durationDenominator).toBe(8);
      expect(n.tuplet).toBeUndefined();
    }
  });
});

describe('applyRhythm — triplet', () => {
  test('all notes get durationDenominator 8 AND tuplet 3', () => {
    const seq = applyRhythm(makeSeq(12), 'triplet');
    for (const n of seq) {
      expect(n.durationDenominator).toBe(8);
      expect(n.tuplet).toBe(3);
    }
  });
});

describe('applyRhythm — 8ss', () => {
  test('pattern [8,16,16] repeats across 12 notes', () => {
    const seq = applyRhythm(makeSeq(12), '8ss');
    const durations = seq.map((n) => n.durationDenominator);
    expect(durations).toEqual([8, 16, 16, 8, 16, 16, 8, 16, 16, 8, 16, 16]);
    for (const n of seq) expect(n.tuplet).toBeUndefined();
  });
});

describe('applyRhythm — s8s', () => {
  test('pattern [16,8,16] repeats across 9 notes', () => {
    const seq = applyRhythm(makeSeq(9), 's8s');
    const durations = seq.map((n) => n.durationDenominator);
    expect(durations).toEqual([16, 8, 16, 16, 8, 16, 16, 8, 16]);
  });
});

describe('applyRhythm — ss8', () => {
  test('pattern [16,16,8] repeats across 9 notes', () => {
    const seq = applyRhythm(makeSeq(9), 'ss8');
    const durations = seq.map((n) => n.durationDenominator);
    expect(durations).toEqual([16, 16, 8, 16, 16, 8, 16, 16, 8]);
  });
});

describe('applyRhythm — partial pattern at end', () => {
  test('5-note sequence with 8ss uses first 5 slots of repeated pattern', () => {
    const seq = applyRhythm(makeSeq(5), '8ss');
    const durations = seq.map((n) => n.durationDenominator);
    expect(durations).toEqual([8, 16, 16, 8, 16]);
  });
});

describe('applyRhythm — preserves other note fields', () => {
  test('string, fret, midi, finger are unchanged', () => {
    const input: NoteSequence = [
      { string: 1, fret: 5, midi: 50, durationDenominator: 4, finger: 2 },
    ];
    const out = applyRhythm(input, 'eighth');
    expect(out[0].string).toBe(1);
    expect(out[0].fret).toBe(5);
    expect(out[0].midi).toBe(50);
    expect(out[0].finger).toBe(2);
    expect(out[0].durationDenominator).toBe(8);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npx vitest run src/exercises/rhythm.test.ts`
Expected: all FAIL with "Cannot find module './rhythm'".

- [ ] **Step 4: Create `src/exercises/rhythm.ts`**

```ts
import type { NoteSequence, Rhythm } from './types';

interface RhythmSlot {
  duration: number;     // 4 (quarter), 8 (eighth), or 16 (sixteenth)
  tuplet?: number;       // 3 for eighth-note triplets
}

// Each rhythm fills one quarter beat with a sequence of slots.
// applyRhythm cycles through these slots, assigning one per note in
// the exercise sequence. Beats accumulate across the sequence.
const RHYTHM_PATTERNS: Record<Rhythm, readonly RhythmSlot[]> = {
  quarter: [{ duration: 4 }],
  eighth:  [{ duration: 8 }, { duration: 8 }],
  triplet: [
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
  ],
  '8ss':   [{ duration: 8 },  { duration: 16 }, { duration: 16 }],
  's8s':   [{ duration: 16 }, { duration: 8 },  { duration: 16 }],
  'ss8':   [{ duration: 16 }, { duration: 16 }, { duration: 8 }],
};

/**
 * Overwrite each note's `durationDenominator` (and optionally `tuplet`)
 * based on the rhythm's per-beat slot pattern. Notes cycle through the
 * pattern modulo its length, so a 12-note sequence with the `8ss`
 * pattern produces [8,16,16, 8,16,16, 8,16,16, 8,16,16]. Other fields
 * (string, fret, midi, finger) are preserved.
 */
export function applyRhythm(
  sequence: NoteSequence,
  rhythm: Rhythm,
): NoteSequence {
  const pattern = RHYTHM_PATTERNS[rhythm];
  return sequence.map((note, i) => {
    const slot = pattern[i % pattern.length];
    const withDuration = { ...note, durationDenominator: slot.duration };
    if (slot.tuplet !== undefined) {
      withDuration.tuplet = slot.tuplet;
    } else {
      // Explicitly drop any inherited tuplet from the input note.
      delete withDuration.tuplet;
    }
    return withDuration;
  });
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/rhythm.test.ts`
Expected: all 8 tests pass.

Then full suite:

Run: `npx vitest run`
Expected: all pre-existing tests still pass (the new optional `tuplet` field on `FretboardNote` is backward-compatible).

- [ ] **Step 6: Commit**

```bash
git add src/exercises/rhythm.ts src/exercises/rhythm.test.ts src/exercises/types.ts
git commit -m "feat(rhythm): add Rhythm type, applyRhythm helper, tuplet field"
```

---

## Task 2: Add `enabledRhythms` to Settings + bump storage to v7

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Add `RhythmToggles` interface**

In `src/stores/settings.ts`, after the existing `AgilityToggles` interface, add:

```ts
export interface RhythmToggles {
  quarter: boolean;
  eighth: boolean;
  triplet: boolean;
  '8ss': boolean;
  's8s': boolean;
  'ss8': boolean;
}
```

- [ ] **Step 2: Add `enabledRhythms` field to `Settings`**

In the `Settings` interface, after `enabledAgility`:

```ts
  enabledRhythms: RhythmToggles;
```

- [ ] **Step 3: Bump STORAGE_KEY from v6 to v7**

Find the constant and change:

```ts
const STORAGE_KEY = 'bass-practice:settings:v7';
```

- [ ] **Step 4: Add defaults in `defaultSettings`**

After the `enabledAgility` block:

```ts
    enabledRhythms: {
      quarter: true,
      eighth: false,
      triplet: false,
      '8ss': false,
      's8s': false,
      'ss8': false,
    },
```

- [ ] **Step 5: Extend `loadSettings` merge**

In the merge return object (alongside `enabledAgility`):

```ts
      enabledRhythms: {
        ...defaults.enabledRhythms,
        ...parsed.enabledRhythms,
      },
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/stores/settings.ts
git commit -m "feat(rhythm): add enabledRhythms settings + bump storage to v7"
```

---

## Task 3: Add `rhythm?: Rhythm` to `ExerciseParams`

**Files:**
- Modify: `src/exercises/types.ts`

- [ ] **Step 1: Add the optional `rhythm` field**

In `src/exercises/types.ts`, find the `ExerciseParams` interface (around line 28). Add a new OPTIONAL field at the end:

```ts
export interface ExerciseParams {
  scale: Scale;
  rootPc: PitchClass;
  variant: Variant;
  scaleDirection: ScaleDirection;
  handPosition: HandPosition;
  tuning: Tuning;
  useOpenStrings?: boolean;
  rootName?: string;
  keySignature?: number;
  keySignatureLabel?: string | null;
  spelling?: Map<PitchClass, import('../theory/keys').AccidentalKind>;
  /**
   * Rhythmic pattern applied to the exercise's notes. When unset,
   * defaults to 'eighth' inside the generator (the historical default
   * for the app). The picker always sets this explicitly so URL hashes
   * round-trip cleanly.
   */
  rhythm?: Rhythm;
}
```

Keeping it OPTIONAL prevents needing to update every test fixture or script that constructs `ExerciseParams` directly. The picker will always set it explicitly.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors. All existing tests still pass (no changes to test fixtures needed).

Run: `npx vitest run`
Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/exercises/types.ts
git commit -m "feat(rhythm): add optional rhythm field to ExerciseParams"
```

---

## Task 4: Wire `applyRhythm` into `generateExercise`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/scale-generator.test.ts`. The existing test file already imports `SCALES`, `TUNINGS`, `KEYS_BY_ID`, etc.

```ts
describe('generateExercise — rhythm application', () => {
  function plainParams(rhythm?: 'quarter' | 'eighth' | 'triplet' | '8ss' | 's8s' | 'ss8') {
    const key = KEYS_BY_ID.C;
    return {
      scale: SCALES.major,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'plain' as const },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning: TUNINGS.fourStringEADG,
      keySignature: keySignatureFor(key, SCALES.major),
      keySignatureLabel: keySignatureLabelFor(key, SCALES.major),
      spelling: spellingMap(key, SCALES.major),
      rhythm,
    };
  }

  test('rhythm=quarter sets durationDenominator=4 on every note', () => {
    const ex = generateExercise(plainParams('quarter'));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(4);
      expect(n.tuplet).toBeUndefined();
    }
  });

  test('rhythm=eighth sets durationDenominator=8 on every note', () => {
    const ex = generateExercise(plainParams('eighth'));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
    }
  });

  test('rhythm=triplet sets tuplet=3 on every note', () => {
    const ex = generateExercise(plainParams('triplet'));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
      expect(n.tuplet).toBe(3);
    }
  });

  test('rhythm undefined defaults to eighth (historical default)', () => {
    const ex = generateExercise(plainParams(undefined));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
    }
  });

  test('agility bigX always uses eighth regardless of rhythm param', () => {
    const key = KEYS_BY_ID.C;
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: key.pc,
      rootName: 'C',
      variant: { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      rhythm: 'quarter',  // ← user says quarter, but agility forces eighth
    });
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
      expect(n.tuplet).toBeUndefined();
    }
  });

  test('agility spider always uses eighth regardless of rhythm param', () => {
    const key = KEYS_BY_ID.C;
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: key.pc,
      rootName: 'C',
      variant: { kind: 'spider', lowerString: 1, direction: 'forward', spelling: 'flat' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      rhythm: 'triplet',
    });
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
      expect(n.tuplet).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "rhythm application"`
Expected: most FAIL — `applyRhythm` isn't wired into `generateExercise` yet.

- [ ] **Step 3: Wire `applyRhythm` into `generateExercise`**

In `src/exercises/scale-generator.ts`, add the import at the top:

```ts
import { applyRhythm } from './rhythm';
```

Find `generateExercise` (around line 1284). The function currently ends with:

```ts
const displayName = formatDisplayName(params);
const alphaTex = emitAlphaTex(sequence, tuning, {
  title: displayName,
  keySignature: params.keySignature,
  keySignatureLabel: params.keySignatureLabel,
  spelling: params.spelling,
});
return { params, sequence, alphaTex, displayName };
```

(The actual position depends on where the variant dispatch ends. There's likely an agility short-circuit at the top that has its own return.)

For BOTH return paths (the agility short-circuit AND the bottom of the function), insert a `sequence = applyRhythm(sequence, effectiveRhythm)` call BEFORE the `emitAlphaTex` call.

The agility short-circuit is at the very top of `generateExercise`. Its sequence is from `bigXSequence` / `spiderSequence`. Modify it to apply 'eighth' rhythm:

```ts
if (variant.kind === 'bigX' || variant.kind === 'spider') {
  let sequence =
    variant.kind === 'bigX'
      ? bigXSequence(tuning, variant.startString, variant.direction)
      : spiderSequence(tuning, variant.lowerString, variant.direction);
  // Agility drills opt out of the rhythm dimension — always eighth.
  sequence = applyRhythm(sequence, 'eighth');
  const displayName = formatDisplayName(params);
  const alphaTex = emitAlphaTex(sequence, tuning, {
    title: displayName,
    keySignature: params.keySignature,
    keySignatureLabel: params.keySignatureLabel,
    spelling: params.spelling,
  });
  return { params, sequence, alphaTex, displayName };
}
```

For the main (non-agility) return path, find the variable assignment that builds `sequence` (it's reassigned across several `} else if` branches), then add the rhythm application BEFORE `formatDisplayName`:

```ts
// Apply rhythm to the variant-generated sequence. Defaults to 'eighth'
// (the historical default) when the caller didn't specify, so existing
// test fixtures and scripts continue to work without churn.
sequence = applyRhythm(sequence, params.rhythm ?? 'eighth');

const displayName = formatDisplayName(params);
// ... existing emitAlphaTex + return ...
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "rhythm application"`
Expected: all 6 tests pass.

Then full suite:

Run: `npx vitest run`
Expected: all tests still pass.

If any pre-existing test breaks because it expected `durationDenominator: 8` but now gets the default (which IS 8), the test should still pass — no change. If a test FAILS, investigate: maybe a fixture has an unset `rhythm` and was expecting some specific behavior.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(rhythm): wire applyRhythm into generateExercise (agility opt-out)"
```

---

## Task 5: Multiply universe by enabled rhythms in `generateUniverse`

**Files:**
- Modify: `src/exercises/picker.ts`
- Modify: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/picker.test.ts`. Note: `baseSettings` in this file is `defaultSettings()` which now includes `enabledRhythms: { quarter: true, ...others: false }` — so the universe size with default settings should match the historical universe size (each entry now has `rhythm: 'quarter'` instead of being un-multiplied).

```ts
describe('generateUniverse — rhythm multiplication', () => {
  function nonAgilityScales(): Settings['enabledScales'] {
    // Use 1 scale to keep counts predictable; non-agility entries multiply by enabled rhythms.
    return { major: true } as Settings['enabledScales'];
  }

  test('default settings (quarter only) keep non-agility universe size = base × 1', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: nonAgilityScales(),
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      // enabledRhythms defaults from baseSettings: quarter only.
    };
    const universe = generateUniverse(s);
    // C Major front-hand: 1 plain + 2 mo-A + 0 mo-B + 2 consecutive (3,4) + 1 mirror (3) + 0 mirror (4) +
    // 7 walking-up + 7 walking-down = 20 entries; doubled where walk 5ths+ are wide-hand (just 1 canonical).
    // Don't pin the exact count — just verify all entries have rhythm = 'quarter'.
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.rhythm).toBe('quarter');
    }
  });

  test('all 6 rhythms enabled: non-agility entries × 6', () => {
    const s1: Settings = {
      ...baseSettings,
      enabledScales: nonAgilityScales(),
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      // enabledRhythms: quarter only (default)
    };
    const u1 = generateUniverse(s1);

    const s6: Settings = {
      ...s1,
      enabledRhythms: {
        quarter: true,
        eighth: true,
        triplet: true,
        '8ss': true,
        's8s': true,
        'ss8': true,
      },
    };
    const u6 = generateUniverse(s6);
    expect(u6.length).toBe(u1.length * 6);
  });

  test('agility entries always set rhythm = eighth, ignore enabledRhythms', () => {
    const s: Settings = {
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
      enabledAgility: { bigX: true, spider: false },
      // Even with all 6 rhythms enabled:
      enabledRhythms: {
        quarter: true, eighth: true, triplet: true, '8ss': true, 's8s': true, 'ss8': true,
      },
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    // 4-string Big X: 1 startString × 2 directions × 2 spellings = 4 entries. No rhythm multiplication.
    expect(universe.length).toBe(4);
    for (const p of universe) {
      expect(p.rhythm).toBe('eighth');
    }
  });

  test('disabling all rhythms: non-agility universe empty; agility still emits', () => {
    const s: Settings = {
      ...baseSettings,
      enabledKeys: ['C'],
      enabledRhythms: {
        quarter: false, eighth: false, triplet: false, '8ss': false, 's8s': false, 'ss8': false,
      },
    };
    const universe = generateUniverse(s);
    // Non-agility should be 0 entries; agility entries (with default tuning) still present.
    const nonAgility = universe.filter((p) => p.variant.kind !== 'bigX' && p.variant.kind !== 'spider');
    expect(nonAgility.length).toBe(0);
    const agility = universe.filter((p) => p.variant.kind === 'bigX' || p.variant.kind === 'spider');
    expect(agility.length).toBeGreaterThan(0);
    for (const p of agility) {
      expect(p.rhythm).toBe('eighth');
    }
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "rhythm multiplication"`
Expected: most FAIL — `generateUniverse` doesn't multiply by rhythms yet.

- [ ] **Step 3: Update `generateUniverse` to multiply by enabled rhythms**

In `src/exercises/picker.ts`, find the existing `generateUniverse` function (around line 324). At the top (after `variantsFromSettings` returns), add a helper to compute the enabled rhythm list:

```ts
import type { Rhythm } from './types';

function enabledRhythmsList(t: RhythmToggles): Rhythm[] {
  const out: Rhythm[] = [];
  if (t.quarter) out.push('quarter');
  if (t.eighth) out.push('eighth');
  if (t.triplet) out.push('triplet');
  if (t['8ss']) out.push('8ss');
  if (t['s8s']) out.push('s8s');
  if (t['ss8']) out.push('ss8');
  return out;
}
```

(Or place the helper at the top of `picker.ts` near `variantsFromSettings`.) Add `RhythmToggles` to the import from `../stores/settings`.

In the agility short-circuit branch of `generateUniverse` (which currently pushes one canonical entry per agility variant), ADD `rhythm: 'eighth'` to the pushed object:

```ts
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
  rhythm: 'eighth',
});
```

For the main keys × scales × variants iteration (the non-agility path), find every `result.push(...)` call and wrap the push in a rhythm loop. For each pushed entry, multiply by enabled rhythms:

```ts
const rhythms = enabledRhythmsList(s.enabledRhythms);
// ... inside the existing nested loop, where you currently do `result.push(entry)`:
for (const rhythm of rhythms) {
  result.push({ ...entry, rhythm });
}
```

Concretely, look for the two pushes inside the non-agility branch (one for the fretted variant, one for the open-string variant). For each, wrap with the rhythm loop.

If `rhythms.length === 0`, the inner loop doesn't fire and no entries are pushed — exactly the behavior we want (non-agility universe goes empty when all rhythms are disabled).

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "rhythm multiplication"`
Expected: all 4 tests pass.

Then full suite:

Run: `npx vitest run`
Expected: all tests pass. Some pre-existing tests check universe size — they should still match since the default settings have only `quarter` enabled, which produces the same count as the un-multiplied historical universe.

If a pre-existing test asserting an exact universe count fails because rhythm multiplication changed it: the count IS still the same with default settings (1 rhythm). If a test was using settings that didn't set `enabledRhythms`, the merge logic in `loadSettings` should default to `{ quarter: true, ...rest: false }`. But test fixtures may bypass `loadSettings` and create a `Settings` object directly. In that case, the test needs `enabledRhythms` added.

Look for test files that construct `Settings` literally (not via `defaultSettings()`):

```bash
grep -rn "enabledScales:\|enabledVariants:" src/exercises/picker.test.ts | head -20
```

For any such fixture, add `enabledRhythms` from `baseSettings` or hardcode `{ quarter: true, eighth: false, ... }`.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(rhythm): multiply universe by enabled rhythms (agility opt-out)"
```

---

## Task 6: Update `paramsKey` / `paramsFromKey` to include rhythm segment

**Files:**
- Modify: `src/exercises/picker.ts`
- Modify: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/exercises/picker.test.ts`:

```ts
describe('paramsKey / paramsFromKey — rhythm round-trip', () => {
  test('quarter rhythm round-trips through 7-segment URL', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledRhythms: { quarter: true, eighth: false, triplet: false, '8ss': false, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p).toBeDefined();
    expect(p!.rhythm).toBe('quarter');
    const key = paramsKey(p!);
    expect(key).toContain('|quarter|');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.rhythm).toBe('quarter');
  });

  test('triplet rhythm round-trips', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledRhythms: { quarter: false, eighth: false, triplet: true, '8ss': false, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p!.rhythm).toBe('triplet');
    const key = paramsKey(p!);
    expect(key).toContain('|triplet|');
    expect(paramsFromKey(key)!.rhythm).toBe('triplet');
  });

  test('8ss rhythm round-trips', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledRhythms: { quarter: false, eighth: false, triplet: false, '8ss': true, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p!.rhythm).toBe('8ss');
    const key = paramsKey(p!);
    expect(key).toContain('|8ss|');
    expect(paramsFromKey(key)!.rhythm).toBe('8ss');
  });

  test('legacy 6-segment URL (no rhythm) defaults to eighth', () => {
    // Hand-construct a legacy URL string in the OLD format
    const legacyKey = 'fourStringEADG|Major|C|front|plain|fretted';
    const restored = paramsFromKey(legacyKey);
    expect(restored).not.toBeNull();
    expect(restored!.rhythm).toBe('eighth');
  });

  test('agility URL still encodes rhythm = eighth', () => {
    const s: Settings = {
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
      enabledAgility: { bigX: true, spider: false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'bigX');
    expect(p!.rhythm).toBe('eighth');
    const key = paramsKey(p!);
    expect(key).toContain('|eighth|');
    expect(paramsFromKey(key)!.rhythm).toBe('eighth');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "rhythm round-trip"`
Expected: FAIL — `paramsKey` doesn't include rhythm yet.

- [ ] **Step 3: Update `paramsKey` to append the rhythm segment**

In `src/exercises/picker.ts`, find `paramsKey` (around line 171). The current return is:

```ts
return [
  p.tuning.id,
  p.scale.name,
  p.rootName ?? String(p.rootPc),
  p.handPosition,
  variantKey,
  p.useOpenStrings ? 'open' : 'fretted',
].join('|');
```

Change to insert `rhythm` between `variantKey` and the open tag:

```ts
return [
  p.tuning.id,
  p.scale.name,
  p.rootName ?? String(p.rootPc),
  p.handPosition,
  variantKey,
  p.rhythm ?? 'eighth',
  p.useOpenStrings ? 'open' : 'fretted',
].join('|');
```

- [ ] **Step 4: Update `paramsFromKey` to accept 6 or 7 segments**

In `paramsFromKey` (around line 40), the current parse:

```ts
const parts = key.split('|');
if (parts.length !== 6) return null;
const [tuningId, scaleName, rootName, handPosition, variantKey, openTag] = parts;
```

Change to:

```ts
const parts = key.split('|');
if (parts.length !== 6 && parts.length !== 7) return null;
// 7-segment: tuningId|scale|root|hand|variant|rhythm|openTag
// 6-segment: tuningId|scale|root|hand|variant|openTag (legacy, rhythm defaults to 'eighth')
const tuningId = parts[0];
const scaleName = parts[1];
const rootName = parts[2];
const handPosition = parts[3];
const variantKey = parts[4];
const rhythmStr = parts.length === 7 ? parts[5] : 'eighth';
const openTag = parts[parts.length - 1];

if (
  rhythmStr !== 'quarter' &&
  rhythmStr !== 'eighth' &&
  rhythmStr !== 'triplet' &&
  rhythmStr !== '8ss' &&
  rhythmStr !== 's8s' &&
  rhythmStr !== 'ss8'
) {
  return null;
}
const rhythm: Rhythm = rhythmStr;
```

Then at the end of `paramsFromKey`, add `rhythm` to the returned object:

```ts
return {
  scale: scaleEntry,
  rootPc: keyEntry.pc,
  rootName: keyEntry.name,
  variant,
  scaleDirection: 'updown',
  handPosition,
  tuning,
  useOpenStrings,
  keySignature,
  keySignatureLabel,
  spelling: spellingMap(keyEntry, scaleEntry),
  rhythm,
};
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "rhythm round-trip"`
Expected: PASS for all 5 tests.

Run full suite:

Run: `npx vitest run`
Expected: all pre-existing tests still pass. The existing `paramsKey` round-trip tests should now produce URLs with `|eighth|` segments (the default when rhythm is unset) and parse back cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(rhythm): paramsKey / paramsFromKey URL encoding with back-compat"
```

---

## Task 7: Update `formatDisplayName` to append rhythm glyph

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
describe('formatDisplayName — rhythm glyph', () => {
  function plainParams(rhythm?: 'quarter' | 'eighth' | 'triplet' | '8ss' | 's8s' | 'ss8') {
    const key = KEYS_BY_ID.C;
    return {
      scale: SCALES.major,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'plain' as const },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning: TUNINGS.fourStringEADG,
      keySignature: keySignatureFor(key, SCALES.major),
      keySignatureLabel: keySignatureLabelFor(key, SCALES.major),
      rhythm,
    };
  }

  test('quarter rhythm appends ♩ glyph', () => {
    expect(formatDisplayName(plainParams('quarter'))).toContain('♩');
  });
  test('eighth rhythm appends ♫ glyph', () => {
    expect(formatDisplayName(plainParams('eighth'))).toContain('♫');
  });
  test('triplet rhythm appends ♫₃ glyph', () => {
    expect(formatDisplayName(plainParams('triplet'))).toContain('♫₃');
  });
  test('8ss appends "(8ss)" label', () => {
    expect(formatDisplayName(plainParams('8ss'))).toContain('(8ss)');
  });
  test('s8s appends "(s8s)" label', () => {
    expect(formatDisplayName(plainParams('s8s'))).toContain('(s8s)');
  });
  test('ss8 appends "(ss8)" label', () => {
    expect(formatDisplayName(plainParams('ss8'))).toContain('(ss8)');
  });

  test('undefined rhythm does NOT append a rhythm glyph', () => {
    const name = formatDisplayName(plainParams(undefined));
    expect(name).not.toContain('♩');
    expect(name).not.toContain('♫');
    expect(name).not.toContain('(8ss)');
  });

  test('agility variant does NOT show a rhythm glyph even when rhythm is set', () => {
    const key = KEYS_BY_ID.C;
    const name = formatDisplayName({
      scale: SCALES.chromatic,
      rootPc: key.pc,
      rootName: 'C',
      variant: { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      keySignature: 0,
      keySignatureLabel: 'C',
      rhythm: 'eighth',
    });
    expect(name).not.toContain('♫');
    expect(name).not.toContain('♩');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — rhythm glyph"`
Expected: most FAIL — no glyph appended yet.

- [ ] **Step 3: Add a `rhythmGlyph` helper + update `formatDisplayName`**

In `src/exercises/scale-generator.ts`, after the existing helpers (or just above `formatDisplayName`), add:

```ts
function rhythmGlyph(rhythm: Rhythm): string {
  switch (rhythm) {
    case 'quarter': return '♩';
    case 'eighth':  return '♫';
    case 'triplet': return '♫₃';
    case '8ss':     return '(8ss)';
    case 's8s':     return '(s8s)';
    case 'ss8':     return '(ss8)';
  }
}
```

Add `Rhythm` to the imports from `./types`.

In `formatDisplayName` (around line 1448), the existing function returns either the non-meaningful-hand path or the meaningful-hand path. For BOTH paths, append the rhythm glyph BEFORE the hand suffix (or at the end if hand isn't shown). And skip the glyph for agility variants and for undefined rhythm.

The cleanest refactor: build the variant label, then APPEND the rhythm glyph, then optionally append the hand suffix.

Current `formatDisplayName`:

```ts
export function formatDisplayName(params: ExerciseParams): string {
  if (params.variant.kind === 'bigX' || params.variant.kind === 'spider') {
    return describeVariant(params.variant, params.scale, params.tuning);
  }
  const root = params.rootName ?? pitchClassName(params.rootPc, 'sharp');
  const variantLabel = describeVariant(params.variant, params.scale, params.tuning);
  const openTag = params.useOpenStrings ? ' (open)' : '';
  if (!isHandPositionMeaningful(params.scale, params.variant)) {
    return `${root} ${params.scale.name}${openTag} — ${variantLabel}`;
  }
  const handLabel = handPositionLabel(params.handPosition);
  const handEmoji = handPositionEmoji(params.handPosition);
  return `${root} ${params.scale.name}${openTag} — ${variantLabel} — ${handLabel} ${handEmoji}`;
}
```

Change to:

```ts
export function formatDisplayName(params: ExerciseParams): string {
  if (params.variant.kind === 'bigX' || params.variant.kind === 'spider') {
    return describeVariant(params.variant, params.scale, params.tuning);
  }
  const root = params.rootName ?? pitchClassName(params.rootPc, 'sharp');
  const variantLabel = describeVariant(params.variant, params.scale, params.tuning);
  const openTag = params.useOpenStrings ? ' (open)' : '';
  // Rhythm glyph appears between the variant label and the hand suffix
  // (or at the end when hand isn't shown). Omitted for agility (above)
  // and when rhythm is unset (test fixtures, scripts).
  const rhythmSuffix = params.rhythm ? ` ${rhythmGlyph(params.rhythm)}` : '';
  if (!isHandPositionMeaningful(params.scale, params.variant)) {
    return `${root} ${params.scale.name}${openTag} — ${variantLabel}${rhythmSuffix}`;
  }
  const handLabel = handPositionLabel(params.handPosition);
  const handEmoji = handPositionEmoji(params.handPosition);
  return `${root} ${params.scale.name}${openTag} — ${variantLabel}${rhythmSuffix} — ${handLabel} ${handEmoji}`;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — rhythm glyph"`
Expected: PASS for all 8 tests.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass. Note: pre-existing `formatDisplayName` tests assume specific format strings (e.g., `"C Major — scale ↕ — Front ☝️"`). When those tests' input fixtures don't set `rhythm`, the glyph is omitted, so the format is unchanged — those tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(rhythm): append rhythm glyph to formatDisplayName"
```

---

## Task 8: Update AlphaTex emitter for per-note durations + tuplets + mixed-duration bar splitting

**Files:**
- Modify: `src/notation/alphatex-emitter.ts`
- Modify: `src/notation/alphatex-emitter.test.ts`

This is the most complex single task. The current emitter assumes uniform duration. The new emitter walks the sequence, summing each note's beat contribution, and inserts `:N` prefixes only when the duration changes. Bar splitting becomes "when summed beats reach 4."

- [ ] **Step 1: Write failing tests**

Append to `src/notation/alphatex-emitter.test.ts`. The existing imports cover what's needed.

```ts
describe('emitAlphaTex — mixed durations', () => {
  test('uniform quarter notes emit a single :4 prefix', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 4 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 4 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 4 },
      { string: 1, fret: 8, midi: 41, durationDenominator: 4 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    expect(tex).toContain(':4 ');
    // Should have only ONE :4 (no per-note duration changes).
    const matches = tex.match(/:4\s/g) || [];
    expect(matches.length).toBe(1);
  });

  test('uniform eighth notes emit a single :8 prefix', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 8 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    const matches = tex.match(/:8\s/g) || [];
    expect(matches.length).toBe(1);
  });

  test('mixed 8ss pattern emits :8 then :16 then :8 etc.', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8 },
      { string: 1, fret: 4, midi: 37, durationDenominator: 16 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 16 },
      { string: 1, fret: 6, midi: 39, durationDenominator: 8 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 16 },
      { string: 1, fret: 8, midi: 41, durationDenominator: 16 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    // Body should contain at least one :8 and at least one :16
    expect(tex).toContain(':8');
    expect(tex).toContain(':16');
  });

  test('triplet notes emit {tu 3} on every note', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8, tuplet: 3 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 8, tuplet: 3 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 8, tuplet: 3 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    const matches = tex.match(/\{tu 3\}/g) || [];
    expect(matches.length).toBe(3);
  });

  test('triplet combined with spelling — both properties in one {} block', () => {
    const spelling = new Map<number, AccidentalKind>();
    spelling.set(1, 'sharp');
    const seq: NoteSequence = [
      // MIDI 37 → pitch class 1 = C♯ → forceSharp
      { string: 1, fret: 4, midi: 37, durationDenominator: 8, tuplet: 3 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG, { spelling });
    // Should have BOTH acc and tu inside ONE {} block (not two separate blocks)
    expect(tex).toMatch(/\{[^}]*acc\s+forceSharp[^}]*tu\s+3[^}]*\}|\{[^}]*tu\s+3[^}]*acc\s+forceSharp[^}]*\}/);
    // And should NOT have two separate {} blocks
    expect(tex).not.toMatch(/\}\s*\{/);
  });
});
```

Import `AccidentalKind` at the top of the test file if not already (from `../theory/keys`).

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/notation/alphatex-emitter.test.ts -t "mixed durations"`
Expected: most FAIL — emitter still uses uniform duration.

- [ ] **Step 3: Rewrite the duration + token logic in `emitAlphaTex`**

In `src/notation/alphatex-emitter.ts`, find the existing token-building loop (around line 184-213) and the bar-emission loop (around line 226-247).

Replace the entire body from `const dur = sequence[0].durationDenominator;` down to the `const body = ksToken + …;` line. New logic:

```ts
  if (sequence.length === 0) {
    return headerLines.join('\n') + '\n.\n';
  }

  const spelling = options.spelling;
  const showFingers = options.showFingerNumbers ?? false;

  // Build per-note tokens. Each token carries its own optional duration
  // prefix — the emitter inserts a `:N ` only when the duration changes
  // from the previous note.
  let currentDur = -1;
  const tokens = sequence.map((n) => {
    let prefix = '';
    if (n.durationDenominator !== currentDur) {
      prefix = `:${n.durationDenominator} `;
      currentDur = n.durationDenominator;
    }
    const alphaTexString = tuning.stringCount - n.string;
    const props: string[] = [];
    if (spelling) {
      const pc = ((n.midi % 12) + 12) % 12;
      const acc = spelling.get(pc);
      if (acc) props.push(`acc ${ALPHATEX_ACCIDENTAL[acc]}`);
    }
    if (showFingers && n.finger !== undefined) {
      props.push(`lf ${n.finger + 1}`);
    }
    if (n.tuplet !== undefined) {
      props.push(`tu ${n.tuplet}`);
    }
    let token = `${n.fret}.${alphaTexString}`;
    if (props.length > 0) token += `{${props.join(' ')}}`;
    return prefix + token;
  });

  // Bar splitting by summed beat fraction. Each note contributes
  //   (4 / durationDenominator) * (tuplet ? 2/tuplet : 1)
  // beats. When we reach 4 beats, close the bar and start a new one.
  const BAR_BEATS = 4;
  const EPS = 0.0001;
  const beatsPerNote = (n: FretboardNote): number => {
    const raw = 4 / n.durationDenominator;
    return n.tuplet ? (raw * 2) / n.tuplet : raw;
  };

  const autoClef = options.autoClef ?? false;

  // Walk the sequence, building bar-index-arrays for the autoClef helper
  // and bar-string lists for the body.
  const barNoteIndices: number[][] = [[]];
  let beatsInBar = 0;
  for (let i = 0; i < sequence.length; i++) {
    barNoteIndices[barNoteIndices.length - 1].push(i);
    beatsInBar += beatsPerNote(sequence[i]);
    if (beatsInBar >= BAR_BEATS - EPS) {
      beatsInBar = 0;
      if (i < sequence.length - 1) barNoteIndices.push([]);
    }
  }

  // If the last bar has leftover beats, pad with rests matching the
  // last note's duration (simple approach — see spec).
  const lastBar = barNoteIndices[barNoteIndices.length - 1];
  if (lastBar.length > 0 && beatsInBar > EPS) {
    const lastNote = sequence[lastBar[lastBar.length - 1]];
    const restBeats = BAR_BEATS - beatsInBar;
    const restBeatsPerSlot = beatsPerNote(lastNote);
    const restCount = Math.max(1, Math.round(restBeats / restBeatsPerSlot));
    // Push rest tokens directly into the tokens array; they share the
    // last note's duration so no prefix needed.
    for (let r = 0; r < restCount; r++) {
      tokens.push('r');
      lastBar.push(tokens.length - 1);
    }
  }

  const barClefs = autoClef
    ? computePerBarClefs(sequence, barNoteIndices)
    : null;

  const measures: string[] = [];
  let activeClef: 'bass' | 'treble' = 'bass';
  for (let m = 0; m < barNoteIndices.length; m++) {
    const indices = barNoteIndices[m];
    const slice = indices.map((i) => tokens[i]);
    let prefix = '';
    if (barClefs) {
      const desired: 'bass' | 'treble' = barClefs[m] ?? activeClef;
      if (desired !== activeClef) {
        prefix = `\\clef ${desired === 'treble' ? 'G2' : 'F4'} `;
        activeClef = desired;
      }
    }
    measures.push(prefix + slice.join(' '));
  }

  const body = ksToken + measures.join(' | ');
  return headerLines.join('\n') + '\n.\n' + body;
}
```

Note: this changes `computePerBarClefs`'s signature from `(sequence, notesPerBeat, beatsPerMeasure)` to `(sequence, barNoteIndices: number[][])`. Update the helper.

- [ ] **Step 4: Adapt `computePerBarClefs` to the new signature**

In `src/notation/alphatex-emitter.ts`, find `computePerBarClefs` (around line 73). Replace its signature and body:

```ts
function computePerBarClefs(
  sequence: NoteSequence,
  barNoteIndices: number[][],
): ('bass' | 'treble')[] {
  // A bar counts as "H" (high) if it contains any note above A3
  // (MIDI 56) — same threshold as before, just keyed by bar instead
  // of beat. Then apply the 3-bar run rule to decide when to flip
  // clefs; short excursions stay in the current clef.
  const barClass: ('H' | 'L')[] = barNoteIndices.map((indices) => {
    const hasHigh = indices.some((i) => sequence[i] && sequence[i].midi >= 57);
    return hasHigh ? 'H' : 'L';
  });

  const RUN = 3;
  const result: ('bass' | 'treble')[] = [];
  let cur: 'bass' | 'treble' = 'bass';
  for (let b = 0; b < barClass.length; b++) {
    const oppType = cur === 'bass' ? 'H' : 'L';
    if (b + RUN <= barClass.length) {
      let allOpp = true;
      for (let k = 0; k < RUN; k++) {
        if (barClass[b + k] !== oppType) {
          allOpp = false;
          break;
        }
      }
      if (allOpp) cur = cur === 'bass' ? 'treble' : 'bass';
    }
    result.push(cur);
  }
  return result;
}
```

(The "shift one bar earlier" logic from the existing impl is dropped — we kept the threshold at `>= 57` per the previous treble-clef fix, but the bar-shift was already removed in commit `d4cbb33`.)

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/notation/alphatex-emitter.test.ts`
Expected: all tests pass (new + pre-existing).

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

If any pre-existing emitter test fails because the new bar-splitting produces a slightly different rest count, update its expectations or relax them. The "uniform eighth notes, pad incomplete final measure" test in particular may shift — the new logic computes rests from beat fractions, which should produce the SAME count for uniform-duration sequences but verify.

- [ ] **Step 6: Commit**

```bash
git add src/notation/alphatex-emitter.ts src/notation/alphatex-emitter.test.ts
git commit -m "feat(rhythm): emitter handles mixed durations + tuplets + bar splitting"
```

---

## Task 9: Add Rhythms section to SettingsPanel.svelte

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add toggle helpers**

In `src/components/SettingsPanel.svelte`, after the existing `setAllAgility` helper, add:

```ts
  function toggleRhythm(key: keyof typeof $settings.enabledRhythms) {
    settings.update((s) => ({
      ...s,
      enabledRhythms: {
        ...s.enabledRhythms,
        [key]: !s.enabledRhythms[key],
      },
    }));
  }

  function setAllRhythms(enabled: boolean) {
    settings.update((s) => ({
      ...s,
      enabledRhythms: {
        quarter: enabled,
        eighth: enabled,
        triplet: enabled,
        '8ss': enabled,
        's8s': enabled,
        'ss8': enabled,
      },
    }));
  }
```

- [ ] **Step 2: Add the new Rhythms section in the template**

Find the existing Hand-agility section's closing `</section>` tag (around line 365). After it, insert:

```svelte
    <section>
      <div class="section-header">
        <h3>Rhythms</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllRhythms(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllRhythms(false)} type="button">None</button>
        </div>
      </div>
      <p class="hint">Each enabled rhythm is a separate exercise variation. Hand-agility drills always use eighth notes.</p>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms.quarter}
          onchange={() => toggleRhythm('quarter')}
        />
        ♩ Quarter notes
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms.eighth}
          onchange={() => toggleRhythm('eighth')}
        />
        ♫ Eighth notes
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms.triplet}
          onchange={() => toggleRhythm('triplet')}
        />
        ♫₃ Eighth-note triplets
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms['8ss']}
          onchange={() => toggleRhythm('8ss')}
        />
        ♪♬ Eighth + two sixteenths (8ss)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms['s8s']}
          onchange={() => toggleRhythm('s8s')}
        />
        ♬♪♬ Sixteenth + eighth + sixteenth (s8s)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledRhythms['ss8']}
          onchange={() => toggleRhythm('ss8')}
        />
        ♬♬♪ Two sixteenths + eighth (ss8)
      </label>
    </section>
```

- [ ] **Step 3: Extend `enableAll` to set all rhythm toggles ON**

Find `enableAll` (added during the previous QoL pass). The current body composes from `setAll*` helpers. Add a call to `setAllRhythms(true)` before the `includeOpenStringVariants` update:

```ts
  function enableAll(): void {
    setAllHandPositions(true);
    setAllVariants(true);
    setAllArpeggios(true);
    setAllAgility(true);
    setAllKeys(true);
    setAllScales(true);
    setAllRhythms(true);
    settings.update((s) => ({ ...s, includeOpenStringVariants: true }));
  }
```

`resetToDefaults` doesn't need changes — it just calls `defaultSettings()` which already has the right default rhythm toggles.

- [ ] **Step 4: Typecheck**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(rhythm): SettingsPanel Rhythms section + bulk helpers"
```

---

## Task 10: Add Rhythm filter chip to BrowsePanel.svelte

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

- [ ] **Step 1: Add a `rhythm` filter state + storage**

In `src/components/BrowsePanel.svelte`, find the existing state declarations (around line 73-79). Add a new state variable + initial loader, and import `Rhythm`:

```ts
import type { Rhythm } from '../exercises/types';
```

Add to the `BrowseFilters` interface (or wherever the persisted filter shape lives — search for `BrowseFilters` to find it):

```ts
  rhythm: Rhythm | 'any';
```

In `loadFilters`, default `rhythm` to `'any'`. In the snapshot saved to localStorage, include `rhythm`.

Add state declaration:

```ts
let rhythm = $state<Rhythm | 'any'>(initial.rhythm);
```

- [ ] **Step 2: Add `rhythmDisabled` flag and effective filter value**

After the existing `scaleDisabled` / `keyDisabled` / `handDisabled` derived flags, add:

```ts
  const rhythmDisabled = $derived(variantFamily === 'agility');
  const effectiveRhythm = $derived(rhythmDisabled ? 'any' : rhythm);
```

- [ ] **Step 3: Add rhythm to the results filter**

In the `results` derivation, add a clause:

```ts
  if (effectiveRhythm !== 'any' && p.rhythm !== effectiveRhythm) return false;
```

(Place it next to the other filter clauses.)

- [ ] **Step 4: Add the Rhythm chip row to the template**

Find the Variant section in the template (it's at position 2 after the QoL reorder). After the Variant section closes, add a new section BEFORE Scale:

```svelte
    <section class:disabled={rhythmDisabled} aria-disabled={rhythmDisabled} role="group">
      <span class="lbl">Rhythm</span>
      {#if rhythmDisabled}
        <span class="hint">Not applicable for {variantFamily}</span>
      {/if}
      <div class="chips">
        <button class="chip-toggle" class:on={rhythm === 'any'} onclick={() => (rhythm = 'any')} type="button">Any</button>
        <button class="chip-toggle" class:on={rhythm === 'quarter'} onclick={() => (rhythm = 'quarter')} type="button">♩ Quarter</button>
        <button class="chip-toggle" class:on={rhythm === 'eighth'} onclick={() => (rhythm = 'eighth')} type="button">♫ Eighth</button>
        <button class="chip-toggle" class:on={rhythm === 'triplet'} onclick={() => (rhythm = 'triplet')} type="button">♫₃ Triplet</button>
        <button class="chip-toggle" class:on={rhythm === '8ss'} onclick={() => (rhythm = '8ss')} type="button">8ss</button>
        <button class="chip-toggle" class:on={rhythm === 's8s'} onclick={() => (rhythm = 's8s')} type="button">s8s</button>
        <button class="chip-toggle" class:on={rhythm === 'ss8'} onclick={() => (rhythm = 'ss8')} type="button">ss8</button>
      </div>
    </section>
```

- [ ] **Step 5: Include rhythm in the `clearFilters` reset**

If the panel has a "Clear filters" button, find its handler and add `rhythm = 'any'`.

- [ ] **Step 6: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(rhythm): BrowsePanel Rhythm filter chip + Agility grey-out"
```

---

## Task 11: Manual UI verification

**No code changes — verification gate.**

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Settings panel**
- Open Settings.
- Confirm new "Rhythms" section appears between Hand-agility and Keys.
- Default: only Quarter checked.
- Click All — all 6 flip on. Click None — all 6 flip off.
- Click "Enable all" at top — Rhythms section flips all 6 on.
- Click "Reset to defaults" — Rhythms returns to Quarter only.

- [ ] **Step 3: Pick exercises**
- Reset to defaults (Quarter only). Click N a few times — every exercise should show `♩` glyph in the title.
- Enable Eighth too. Click N — some exercises show `♫`.
- Enable all rhythms. Click N — see all 6 glyphs/labels appear over time.
- Pick an agility exercise (filter via Browse → Variant=Agility) — title should NOT have a rhythm glyph; renders as eighth notes (current behavior).

- [ ] **Step 4: Browse panel**
- Open Browse. Confirm new "Rhythm" filter row appears after Variant, before Scale.
- Set Rhythm=Triplet — only triplet exercises appear.
- Set Variant=Agility — Rhythm row greys out with "Not applicable for agility" hint.
- Click an entry to load.

- [ ] **Step 5: URL bookmarkability**
- Pick a Triplet exercise. Copy URL.
- Reload — same triplet exercise loads.
- Modify the URL's rhythm segment manually (`|triplet|` → `|quarter|`) — exercise renders as quarter notes.

- [ ] **Step 6: Visual confirmation in notation**
- For a Quarter exercise — notation shows quarter notes.
- For a Triplet exercise — notation shows three eighth notes per beat with a triplet bracket ("3" above).
- For an 8ss exercise — notation shows the mixed eighth/sixteenth pattern.

- [ ] **Step 7: If anything looks wrong, report. Otherwise no commit.**

---

## Task 12: Final test suite + build gate

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: all tests pass. Note the count for the plan.md update.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 3: Universe scan**

Run: `npx tsx scripts/scan-layouts.ts`
Expected: 0 issues. Note the new total exercise count (was 16,150 with quarter-only default; should be the same since default is unchanged).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: If all gates pass, no commit. Otherwise fix and add regression tests.**

---

## Task 13: Update `docs/plan.md`

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Add a "Recent additions" bullet**

In `docs/plan.md`, find the "Recent additions (post-MVP polish)" section. Add a new bullet at the top:

```markdown
- [x] **Rhythm variations.** 6 rhythms — Quarter (♩, new default), Eighth (♫), Triplet (♫₃), 8ss, s8s, ss8 (eighth + two sixteenths in three permutations). Picker rotates rhythms × other axes; default is Quarter only, all others opt-in via Settings. Hand-agility drills (Big X, Spider) always use eighth notes regardless of settings. URL hash gains a rhythm segment (back-compat: legacy 6-segment URLs default to eighth). AlphaTex emitter rewritten to handle mixed per-note durations + triplet markers + summed-beat bar splitting. Spec: [docs/superpowers/specs/2026-05-22-rhythm-variations-design.md](superpowers/specs/2026-05-22-rhythm-variations-design.md). New module: [src/exercises/rhythm.ts](../src/exercises/rhythm.ts).
```

- [ ] **Step 2: Update the State line**

Find the State line and update test/exercise counts based on what `npx vitest run` and `scan-layouts.ts` reported. Example new line:

```markdown
State: ~340 unit tests passing, svelte-check clean. Universe currently ~16,150 exercises across 4 tunings (default: Quarter rhythm only; enabling other rhythms multiplies the non-agility universe). Walking-exercise, arpeggio, and agility layout scans: 0 cross-string ≥8 fret jumps.
```

(Use actual numbers from your local run.)

- [ ] **Step 3: Commit**

```bash
git add docs/plan.md
git commit -m "docs(rhythm): mark rhythm variations complete in plan.md"
```

---

## Self-review checklist

- [ ] All 6 rhythms covered: applyRhythm tests, generateExercise tests, formatDisplayName tests, paramsKey round-trip.
- [ ] Agility opt-out tested explicitly: generateExercise + universe + display name.
- [ ] Storage v6 → v7 with proper merge for legacy saves.
- [ ] URL backward compat: 6-segment legacy URLs default rhythm to 'eighth'.
- [ ] Triplets emit `{tu 3}` per note; tuplet preserved through emitter.
- [ ] Mixed-duration bar splitting works for 8ss/s8s/ss8 sequences.
- [ ] BrowsePanel: Rhythm chip row added, greys out for Agility.
- [ ] SettingsPanel: Rhythms section with All/None + integrates with Enable all / Reset to defaults.
- [ ] No `TBD` / `TODO` / `placeholder` strings in code.
- [ ] All function names match across tasks (`applyRhythm`, `rhythmGlyph`, `enabledRhythmsList`, etc.).
