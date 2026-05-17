# Arpeggio cycle exercises — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add arpeggio cycle exercises — for a chosen key + diatonic 7-note scale, cycle through stacked-thirds chords rooted on each scale degree, ascending then descending, with 5 chord sizes (triad → 13th) × 4 directions (allUp / upDown / downUp / zigzag).

**Architecture:** Extend the existing `Variant` discriminated union with a new `arpeggioCycle` kind. Reuse the existing `layOnFretboard` pipeline (with `applyPinLookahead`) so arpeggios flow through the same generator path as walking variants. Add a `maxStringIndex` start-constraint to keep the root on the bottom 2 strings (4-string) / bottom 3 strings (5+-string). Picker emits one canonical entry per `(scale, key, size, direction)` — no hand-position dimension, like walking 7ths/octaves today.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vite, Vitest, AlphaTab.

**Reference spec:** [docs/superpowers/specs/2026-05-17-arpeggios-design.md](../specs/2026-05-17-arpeggios-design.md)

---

## File structure

**New files:** none.

**Modified files:**

| File | Responsibility | What changes |
|------|---------------|--------------|
| `src/exercises/types.ts` | Variant union + Exercise types | Add `ArpDirection` type + `arpeggioCycle` variant kind |
| `src/exercises/variants.ts` | MIDI sequence generators per variant | Add `arpeggioCycleMidi` + `arpUp` / `arpDown` helpers; extend `variantSequenceMidi` switch |
| `src/exercises/scale-generator.ts` | Picker constraints + fretboard layout + `generateExercise` dispatch | Add `maxStringIndex` to constraints/picker; `arpeggioCycleApex`; `generateExercise` arpeggio branch; rename `canonicalHandPositionForWideWalk` → `canonicalHandPositionForVariant`; extend `isHandPositionMeaningful` |
| `src/exercises/picker.ts` | Universe build + URL encoding | Add arpeggio entries in `variantsFromSettings`; per-scale filter in `generateUniverse`; arpeggio `paramsKey` / `paramsFromKey` encoding |
| `src/stores/settings.ts` | Settings shape + defaults + persistence | Add `ArpeggioToggles` interface + `enabledArpeggios` field; bump storage key to `v5` |
| `src/components/SettingsPanel.svelte` | Settings UI | New "Arpeggios" section with size + direction checkboxes |
| `src/components/BrowsePanel.svelte` | Filter chips for the universe | Add `arpeggios` to variant-family chips |
| `scripts/trace-exercise.ts` | One-off exercise tracer | Extend `parseVariant` to accept `arpN-DIR` form |
| `scripts/scan-layouts.ts` | Universe-wide layout scan | Extend `variantTag` switch + add `arpeggio` filter argument |
| `src/exercises/variants.test.ts` | Variant MIDI tests | Add arpeggio cycle test suite |
| `src/exercises/scale-generator.test.ts` | Layout / placement tests | Add arpeggio placement test suite |
| `src/exercises/picker.test.ts` | Universe tests | Add arpeggio universe filter tests |
| `docs/plan.md` | Roadmap | Mark arpeggios complete |

---

## Task 1: Add `ArpDirection` type + extend `Variant` union

**Files:**
- Modify: `src/exercises/types.ts`

- [ ] **Step 1: Edit `src/exercises/types.ts` to add the new type and variant kind**

Replace the existing `Variant` type definition (lines 8-18) with:

```ts
export type ArpDirection = 'allUp' | 'upDown' | 'downUp' | 'zigzag';

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
  | { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection };
```

- [ ] **Step 2: Add placeholder cases to exhaustive switches so the codebase still compiles**

The new variant kind will break two specific exhaustive switches that have no default branch. Add a placeholder `arpeggioCycle` case to each:

**(a)** In `src/exercises/picker.ts`, find `paramsKey` (around line 120-139). Add before the final closing brace of the switch:

```ts
    case 'arpeggioCycle':
      variantKey = 'arpeggio:placeholder';
      break;
```

**(b)** In `src/exercises/scale-generator.ts`, find `describeVariant` (around line 1384-1418). Add a new case before the closing brace:

```ts
    case 'arpeggioCycle':
      return 'Arpeggio (placeholder)';
```

These will be REPLACED by Task 11 and Task 12, respectively, with the real implementations. They exist only to let intermediate tasks compile + run.

- [ ] **Step 3: Verify the typecheck is clean**

Run: `npm run check`
Expected: no new errors.

If new errors appear in other files (the `generateExercise` if/else chain uses a `throw new Error(...)` default branch — not exhaustive, so should be unaffected; the `highestMidi` switch in picker.ts:151-181 has a `default:` branch — unaffected; the `variantTag` switch in scripts/scan-layouts.ts:93-108 lacks a default — add the same placeholder pattern there: `case 'arpeggioCycle': return 'arp placeholder';`).

- [ ] **Step 4: Commit**

```bash
git add src/exercises/types.ts src/exercises/picker.ts src/exercises/scale-generator.ts scripts/scan-layouts.ts
git commit -m "feat(arpeggios): add ArpDirection type and arpeggioCycle variant kind"
```

---

## Task 2: Implement `arpUp` and `arpDown` helpers

**Files:**
- Modify: `src/exercises/variants.ts`
- Test: `src/exercises/variants.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/variants.test.ts`:

```ts
import {
  arpUp,
  arpDown,
} from './variants';

describe('arpUp', () => {
  test('triad on C major degree 0 = [C E G]', () => {
    expect(arpUp(cMaj, C2, 0, 3)).toEqual([
      midiOf('C', 2),
      midiOf('E', 2),
      midiOf('G', 2),
    ]);
  });

  test('7th-chord on C major degree 0 = [C E G B]', () => {
    expect(arpUp(cMaj, C2, 0, 4)).toEqual([
      midiOf('C', 2),
      midiOf('E', 2),
      midiOf('G', 2),
      midiOf('B', 2),
    ]);
  });

  test('triad on C major degree 7 (octave up) = [C(8va) E(8va) G(8va)]', () => {
    expect(arpUp(cMaj, C2, 7, 3)).toEqual([
      midiOf('C', 3),
      midiOf('E', 3),
      midiOf('G', 3),
    ]);
  });
});

describe('arpDown', () => {
  test('triad on C major degree 0 = [C, A(below), F(below)]', () => {
    expect(arpDown(cMaj, C2, 0, 3)).toEqual([
      midiOf('C', 2),
      midiOf('A', 1),
      midiOf('F', 1),
    ]);
  });

  test('triad on C major degree 7 = [C(8va) A F]', () => {
    expect(arpDown(cMaj, C2, 7, 3)).toEqual([
      midiOf('C', 3),
      midiOf('A', 2),
      midiOf('F', 2),
    ]);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run src/exercises/variants.test.ts`
Expected: 5 new tests FAIL with "arpUp is not a function" / "arpDown is not a function".

- [ ] **Step 3: Implement helpers in `src/exercises/variants.ts`**

Append after `intervalWalkAscMidi` (around line 88):

```ts
/**
 * Build one arpeggio of `size` notes by stacking thirds (every other
 * scale degree) UPWARD from starting degree `d`.
 *
 *   arpUp(majorScale, rootMidi=C2, d=0, size=3) → [C, E, G]
 *   arpUp(majorScale, rootMidi=C2, d=1, size=4) → [D, F, A, C(8va)]
 *
 * Used by arpeggioCycleMidi. The "stack of thirds" abstraction relies on
 * scaleDegreeMidi accepting arbitrary positive or negative degree
 * indices across octaves, which it already does.
 */
export function arpUp(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    out.push(scaleDegreeMidi(scale, rootMidi, d + 2 * i));
  }
  return out;
}

/**
 * Build one arpeggio of `size` notes by stacking thirds DOWNWARD from
 * starting degree `d`. This is NOT the up-stack reversed — it's the
 * stack going down from the root.
 *
 *   arpDown(majorScale, rootMidi=C2, d=0, size=3) → [C, A(below), F(below)]
 *   arpDown(majorScale, rootMidi=C2, d=7, size=3) → [C(8va), A, F]
 */
export function arpDown(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    out.push(scaleDegreeMidi(scale, rootMidi, d - 2 * i));
  }
  return out;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/variants.test.ts`
Expected: PASS for all 5 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/variants.ts src/exercises/variants.test.ts
git commit -m "feat(arpeggios): add arpUp and arpDown stack-of-thirds helpers"
```

---

## Task 3: Implement `arpeggioCycleMidi` — consecutive-root directions

**Files:**
- Modify: `src/exercises/variants.ts`
- Test: `src/exercises/variants.test.ts`

- [ ] **Step 1: Write failing tests for allUp / upDown / downUp**

Append to `src/exercises/variants.test.ts`:

```ts
import { arpeggioCycleMidi } from './variants';

describe('arpeggioCycleMidi — allUp', () => {
  test('triad in C major: 16 arpeggios × 3 notes = 48 notes', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp');
    expect(seq).toHaveLength(48);
    // First arp [C E G]
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
    // Last arp of asc half = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // First arp of desc half = high-root arp UP again (the pivot doubling)
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // Last arp of desc half = low-root arp UP [C E G]
    expect(seq.slice(45, 48)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
  });

  test('final note is the low root (pin will land here)', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp');
    expect(seq[seq.length - 1]).toBe(midiOf('G', 2));
    // Note: final is G (top of low-root arp UP), not the root itself.
    // The pinned-root landing belongs to layOnFretboard, not the MIDI.
  });
});

describe('arpeggioCycleMidi — upDown', () => {
  test('triad in C major: asc plays up, desc plays down', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'upDown');
    expect(seq).toHaveLength(48);
    // Asc first arp = [C E G] (up)
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
    // End of asc = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // Start of desc = high-root arp DOWN [C(8va) A F]
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('A', 2), midiOf('F', 2)]);
    // Last arp of desc = low-root arp DOWN [C A(below) F(below)]
    expect(seq.slice(45, 48)).toEqual([midiOf('C', 2), midiOf('A', 1), midiOf('F', 1)]);
  });
});

describe('arpeggioCycleMidi — downUp', () => {
  test('triad in C major: asc plays down, desc plays up', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'downUp');
    expect(seq).toHaveLength(48);
    // Asc first arp = [C A(below) F(below)] (down from low root)
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('A', 1), midiOf('F', 1)]);
    // End of asc = high-root arp DOWN [C(8va) A F]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('A', 2), midiOf('F', 2)]);
    // Start of desc = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
  });
});

describe('arpeggioCycleMidi — C minor allUp (third on degree 1 is minor)', () => {
  test('first arp in C natural minor is [C E♭ G]', () => {
    const seq = arpeggioCycleMidi(SCALES.naturalMinor, C2, 3, 'allUp');
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('E', 2) - 1); // E♭
    expect(seq[2]).toBe(midiOf('G', 2));
  });
});

describe('arpeggioCycleMidi — D dorian triad downUp', () => {
  test('first arp = D dorian triad played DOWN from D: [D, B(below), G(below)]', () => {
    const D2 = midiOf('D', 2);
    const seq = arpeggioCycleMidi(SCALES.dorian, D2, 3, 'downUp');
    expect(seq.slice(0, 3)).toEqual([midiOf('D', 2), midiOf('B', 1), midiOf('G', 1)]);
  });
});

describe('arpeggioCycleMidi — 13th-chord allUp (size = scale length)', () => {
  test('each arp in C major 13th allUp contains all 7 scale notes', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 7, 'allUp');
    // 16 arpeggios × 7 notes = 112
    expect(seq).toHaveLength(112);
    // First arp: degrees 0,2,4,6,8,10,12 in scaleDegreeMidi semantics
    // = C, E, G, B, D(8va), F(8va), A(8va)
    expect(seq.slice(0, 7)).toEqual([
      midiOf('C', 2), midiOf('E', 2), midiOf('G', 2),
      midiOf('B', 2),
      midiOf('D', 3), midiOf('F', 3), midiOf('A', 3),
    ]);
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `npx vitest run src/exercises/variants.test.ts`
Expected: new tests FAIL with "arpeggioCycleMidi is not a function".

- [ ] **Step 3: Implement consecutive-root branches in `variants.ts`**

First extend the existing imports at the top of `variants.ts` to include `ArpDirection`:

```ts
import type { Variant, ArpDirection } from './types';
```

(The existing `import type { Variant } from './types'` line just needs `ArpDirection` added.)

Then add to `variants.ts` after `arpDown`:

```ts
/**
 * Cycle through every diatonic-third arpeggio rooted on each scale
 * degree, ascending the scale then descending. Each arpeggio is `size`
 * notes (3=triad, 4=7th, 5=9th, 6=11th, 7=13th).
 *
 * `direction` controls the note ordering WITHIN each arpeggio and which
 * iteration shape the roots follow:
 *
 * - allUp / upDown / downUp: roots cycle 0..7 (asc) then 7..0 (desc),
 *   8 arpeggios per half. The pivot arp (root 7 = octave-up root) plays
 *   at the end of asc AND start of desc. Total notes = 16 * size.
 *
 * - zigzag: each arp starts a step above the previous arp's end,
 *   alternating up/down. Asc plays 8 arpeggios. Desc is reverse(asc)
 *   with the first note dropped to avoid doubling the pivot note.
 *   Total notes = 16 * size - 1.
 *
 * See docs/superpowers/specs/2026-05-17-arpeggios-design.md for the
 * worked example and the apex calculation.
 */
export function arpeggioCycleMidi(
  scale: Scale,
  rootMidi: number,
  size: 3 | 4 | 5 | 6 | 7,
  direction: ArpDirection,
): number[] {
  if (direction === 'zigzag') {
    return arpeggioZigzag(scale, rootMidi, size);
  }
  return arpeggioConsecutive(scale, rootMidi, size, direction);
}

function arpeggioConsecutive(
  scale: Scale,
  rootMidi: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
): number[] {
  const ascUp = direction === 'allUp' || direction === 'upDown';
  const descUp = direction === 'allUp' || direction === 'downUp';
  const out: number[] = [];
  // Asc: roots 0..7 (8 arpeggios). Root 7 = octave-up.
  for (let d = 0; d <= 7; d++) {
    out.push(...(ascUp ? arpUp(scale, rootMidi, d, size) : arpDown(scale, rootMidi, d, size)));
  }
  // Desc: roots 7..0 (8 arpeggios). Pivot (root 7) plays twice.
  for (let d = 7; d >= 0; d--) {
    out.push(...(descUp ? arpUp(scale, rootMidi, d, size) : arpDown(scale, rootMidi, d, size)));
  }
  return out;
}

function arpeggioZigzag(
  scale: Scale,
  rootMidi: number,
  size: number,
): number[] {
  // Asc half: 8 arpeggios, alternating UP/DOWN, each starting a step
  // above where the previous ended.
  const asc: number[] = [];
  let d = 0;
  let goingUp = true;
  for (let i = 0; i < 8; i++) {
    const arp = goingUp
      ? arpUp(scale, rootMidi, d, size)
      : arpDown(scale, rootMidi, d, size);
    asc.push(...arp);
    // Next arp starts a step above this arp's LAST degree.
    d = (goingUp ? d + 2 * (size - 1) : d - 2 * (size - 1)) + 1;
    goingUp = !goingUp;
  }
  // Desc = reverse(asc). Drop the first note of desc to avoid doubling
  // the pivot note (asc's last note == desc's first note).
  const desc = asc.slice().reverse().slice(1);
  return [...asc, ...desc];
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/variants.test.ts`
Expected: PASS for all consecutive-root tests + the C minor and dorian and 13th tests.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/variants.ts src/exercises/variants.test.ts
git commit -m "feat(arpeggios): add arpeggioCycleMidi for consecutive-root directions"
```

---

## Task 4: Test and verify the zigzag direction

**Files:**
- Test: `src/exercises/variants.test.ts`

- [ ] **Step 1: Write zigzag tests**

Append to `src/exercises/variants.test.ts`:

```ts
describe('arpeggioCycleMidi — zigzag (triad)', () => {
  test('asc half matches worked example [CEG][AFD][EGB][CAF][GBD][ECA][BDF][GEC]', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'zigzag');
    // Note count: 2 * 8 * 3 − 1 = 47 (desc drops first note to avoid pivot dupe).
    expect(seq).toHaveLength(47);

    // 8 arpeggios × 3 notes = 24 notes in asc half
    const ascExpected = [
      midiOf('C', 2), midiOf('E', 2), midiOf('G', 2),  // [C E G]
      midiOf('A', 2), midiOf('F', 2), midiOf('D', 2),  // [A F D]
      midiOf('E', 2), midiOf('G', 2), midiOf('B', 2),  // [E G B]
      midiOf('C', 3), midiOf('A', 2), midiOf('F', 2),  // [C(8va) A F]
      midiOf('G', 2), midiOf('B', 2), midiOf('D', 3),  // [G B D(8va)]
      midiOf('E', 3), midiOf('C', 3), midiOf('A', 2),  // [E(8va) C(8va) A]
      midiOf('B', 2), midiOf('D', 3), midiOf('F', 3),  // [B D(8va) F(8va)]
      midiOf('G', 3), midiOf('E', 3), midiOf('C', 3),  // [G(8va) E(8va) C(8va)]
    ];
    expect(seq.slice(0, 24)).toEqual(ascExpected);
  });

  test('desc is reverse(asc) with first note dropped', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'zigzag');
    const asc = seq.slice(0, 24);
    const desc = seq.slice(24);
    const expectedDesc = asc.slice().reverse().slice(1);
    expect(desc).toEqual(expectedDesc);
  });

  test('final note pins to low root', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'zigzag');
    expect(seq[seq.length - 1]).toBe(midiOf('C', 2));
  });
});

describe('arpeggioCycleMidi — zigzag (9th-chord, size > 3 case)', () => {
  test('every arp boundary connects by a single scale step', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 5, 'zigzag');
    // size=5 → 8 arps × 5 notes = 40 in asc half. Check arp boundaries
    // 0→1, 1→2, ..., 6→7. Boundary between arp i and arp i+1 is at
    // positions 5*(i+1)-1 (end of arp i) and 5*(i+1) (start of arp i+1).
    const ascNotes = seq.slice(0, 40);
    const scaleSemis = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (let i = 0; i < 7; i++) {
      const lastOfArp = ascNotes[5 * (i + 1) - 1];
      const firstOfNext = ascNotes[5 * (i + 1)];
      // A scale step up = 1 or 2 semitones (whole or half step in major).
      const diff = firstOfNext - lastOfArp;
      expect([1, 2]).toContain(diff);
    }
  });
});
```

- [ ] **Step 2: Run tests, verify they pass with the existing implementation**

Run: `npx vitest run src/exercises/variants.test.ts -t zigzag`
Expected: PASS (the implementation from Task 3 already handles zigzag).

If a test fails, debug by running the script (after Task 11 lands the parse extension):
```
npx tsx scripts/trace-exercise.ts C major arp3-zigzag fourStringEADG
```
Or call `arpeggioCycleMidi` directly from a one-off `npx tsx` REPL command.

- [ ] **Step 3: Commit**

```bash
git add src/exercises/variants.test.ts
git commit -m "test(arpeggios): cover zigzag direction (triad worked example + 9th step boundaries)"
```

---

## Task 5: Add `maxStringIndex` constraint to `pickStartingPosition`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write a failing test**

Append to `src/exercises/scale-generator.test.ts`:

```ts
describe('pickStartingPosition — maxStringIndex constraint', () => {
  test('respects maxStringIndex (excludes higher-pitched strings)', () => {
    // 4-string EADG. Pitch class for E (rootPc=4) is on string 0 (open) and
    // string 2 fret 2 (D string + 2 = E). With maxStringIndex=1, only the
    // lowest-2 strings are allowed → must pick string 0.
    const tuning = TUNINGS.fourStringEADG;
    const pos = pickStartingPosition(4 as PitchClass, 'front', tuning, {
      maxStringIndex: 1,
    });
    expect(pos).not.toBeNull();
    expect(pos!.string).toBeLessThanOrEqual(1);
  });

  test('returns null when no string ≤ maxStringIndex carries the root', () => {
    // Pitch class for B (rootPc=11). On a 4-string EADG (strings 0..3 =
    // E,A,D,G), B is reachable on string 0 fret 7, string 1 fret 2, etc.
    // Constrain to maxStringIndex=-1 (no strings allowed) and check null.
    const tuning = TUNINGS.fourStringEADG;
    const pos = pickStartingPosition(11 as PitchClass, 'front', tuning, {
      maxStringIndex: -1,
    });
    expect(pos).toBeNull();
  });
});
```

Make sure the necessary imports are present (`PitchClass`, `pickStartingPosition`, `TUNINGS`). If they aren't already imported in the test file, add them at the top.

- [ ] **Step 2: Run tests, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t maxStringIndex`
Expected: FAIL (the `maxStringIndex` option doesn't exist yet).

- [ ] **Step 3: Add `maxStringIndex` to `pickStartingPosition`**

In `src/exercises/scale-generator.ts`, edit the `options` parameter of `pickStartingPosition` (around line 65-81) — replace the entire `options` type with:

```ts
  options: {
    maxFret?: number;
    preferOpenStringRoot?: boolean;
    minMidi?: number;
    /**
     * Minimum string index (0 = lowest pitch). Used by walking-down
     * interval variants to ensure there's at least one string BELOW the
     * starting position so the lower note of each pair can land on an
     * adjacent lower string at the same fret.
     */
    minStringIndex?: number;
    /**
     * Maximum string index (inclusive). Used by arpeggio-cycle variants
     * to keep the root low on the neck so the cycle has room to climb.
     * 4-string basses: 1 (bottom 2 strings). 5/6-string: 2.
     */
    maxStringIndex?: number;
  } = {},
```

Then below the `minStringIndex` derivation (around line 84), add:

```ts
  const maxStringIndex = options.maxStringIndex ?? tuning.stringCount - 1;
```

And change the loop bound at line 86 from:

```ts
  for (let s = minStringIndex; s < tuning.stringCount; s++) {
```

to:

```ts
  for (let s = minStringIndex; s <= maxStringIndex; s++) {
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t maxStringIndex`
Expected: PASS for both new tests.

Then run all tests to ensure nothing regressed:

Run: `npx vitest run`
Expected: all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(arpeggios): add maxStringIndex constraint to pickStartingPosition"
```

---

## Task 6: Add `arpeggioCycleApex` helper + extend `startConstraintsForVariant`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
import { arpeggioCycleApex, startConstraintsForVariant } from './scale-generator';

describe('arpeggioCycleApex', () => {
  test('triad in C major rooted at C2 → degree 11 = G3', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 3)).toBe(midiOf('G', 3));
  });

  test('7th-chord in C major → degree 13 = B3', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 4)).toBe(midiOf('B', 3));
  });

  test('13th-chord in C major → degree 19 = A4', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 7)).toBe(midiOf('A', 4));
  });
});

describe('startConstraintsForVariant — arpeggio', () => {
  test('4-string tuning → maxStringIndex = 1', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 3, direction: 'allUp' },
      TUNINGS.fourStringEADG,
    );
    expect(c.maxStringIndex).toBe(1);
    expect(c.minStringIndex).toBe(0);
  });

  test('5-string tuning → maxStringIndex = 2', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 7, direction: 'zigzag' },
      TUNINGS.fiveStringBEADG,
    );
    expect(c.maxStringIndex).toBe(2);
  });

  test('6-string tuning → maxStringIndex = 2', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 3, direction: 'allUp' },
      TUNINGS.sixStringBEADGC,
    );
    expect(c.maxStringIndex).toBe(2);
  });

  test('non-arpeggio variants leave maxStringIndex undefined (back-compat)', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'plain' },
      TUNINGS.fourStringEADG,
    );
    expect(c.maxStringIndex).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "arpeggioCycleApex|startConstraintsForVariant — arpeggio"`
Expected: FAIL — `arpeggioCycleApex` is not exported.

- [ ] **Step 3: Implement `arpeggioCycleApex` and extend `startConstraintsForVariant`**

In `src/exercises/scale-generator.ts`, after `lowestDegreeOffsetSemitones` (around line 155), add:

```ts
/**
 * Highest MIDI value any arpeggio cycle reaches, irrespective of
 * direction. Apex sits at degree `7 + 2*(size − 1)` for all 4 directions
 * (consecutive-root directions hit it at the end of the asc-half up-arp
 * rooted at the octave; zigzag hits it at the start of its last
 * down-arp). See spec for the derivation.
 */
export function arpeggioCycleApex(
  scale: Scale,
  rootMidi: number,
  size: number,
): number {
  return scaleDegreeMidi(scale, rootMidi, 7 + 2 * (size - 1));
}
```

(Add `scaleDegreeMidi` to the imports at the top of the file if it isn't already imported. Check the existing imports — `variants.ts` exports it.)

Then change `startConstraintsForVariant` (around line 163) to handle arpeggios. Replace the entire function body:

```ts
export function startConstraintsForVariant(
  scale: Scale,
  variant: Variant,
  tuning: Tuning,
): { minMidi?: number; minStringIndex: number; maxStringIndex?: number } {
  if (variant.kind === 'arpeggioCycle') {
    return {
      minStringIndex: 0,
      maxStringIndex: tuning.stringCount === 4 ? 1 : 2,
    };
  }
  if (variant.kind !== 'intervalWalk') return { minStringIndex: 0 };
  const lowestOffset = lowestDegreeOffsetSemitones(scale, variant);
  const minMidi =
    lowestOffset < 0 ? tuning.openMidi[0] - lowestOffset : undefined;
  // Walking-down's first pair drops a string for the lower note; require
  // at least one string below the starting string.
  const minStringIndex = variant.intervalDir === 'down' ? 1 : 0;
  return { minMidi, minStringIndex };
}
```

- [ ] **Step 4: Wire `maxStringIndex` through both call sites of `pickStartingPosition`**

The function now returns `maxStringIndex` for arpeggios, but neither the picker nor `generateExercise` pass it through. Both call sites need updating.

In `src/exercises/picker.ts` (around line 307-311), update the picker's call:

```ts
        } else {
          startPos = pickStartingPosition(rootPc, hp, tuning, {
            minMidi: constraints.minMidi,
            minStringIndex: constraints.minStringIndex,
            maxStringIndex: constraints.maxStringIndex,
          });
        }
```

In `src/exercises/scale-generator.ts`, inside `generateExercise` (around line 1257-1261), update:

```ts
      : pickStartingPosition(rootPc, handPosition, tuning, {
          preferOpenStringRoot: !!useOpenStrings,
          minMidi: constraints.minMidi,
          minStringIndex: constraints.minStringIndex,
          maxStringIndex: constraints.maxStringIndex,
        });
```

- [ ] **Step 5: Run, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "arpeggioCycleApex|startConstraintsForVariant — arpeggio"`
Expected: PASS.

Then run all tests:

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts src/exercises/picker.ts
git commit -m "feat(arpeggios): add arpeggioCycleApex + maxStringIndex wired through generators"
```

---

## Task 7: Rename `canonicalHandPositionForWideWalk` and extend `isHandPositionMeaningful`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Modify: `src/exercises/picker.ts`

- [ ] **Step 1: Rename the function and extend logic**

In `src/exercises/scale-generator.ts`:

(a) Replace `isHandPositionMeaningful` (around line 328-334) with:

```ts
export function isHandPositionMeaningful(
  scale: Scale,
  variant: Variant,
): boolean {
  if (variant.kind === 'arpeggioCycle') return false;
  if (variant.kind !== 'intervalWalk') return true;
  return walkingPairMaxSemitones(scale, variant) < 7;
}
```

(b) Rename `canonicalHandPositionForWideWalk` → `canonicalHandPositionForVariant` (around line 342-347) and extend it:

```ts
/**
 * Canonical hand position for variants where the user's hand-position
 * choice is overridden by the variant shape — wide walking intervals
 * (5ths+) and all arpeggio cycles. Walking variants: scale-up + interval-up
 * leads with the index finger (front); inverse leads with the pinky (back).
 * Arpeggio cycles: always front (low root, hand climbs from there).
 */
export function canonicalHandPositionForVariant(
  variant: Variant,
): HandPosition {
  if (variant.kind === 'arpeggioCycle') return 'front';
  if (variant.kind !== 'intervalWalk') return 'front';
  return variant.intervalDir === 'down' ? 'back' : 'front';
}
```

- [ ] **Step 2: Update the only call site in `picker.ts`**

In `src/exercises/picker.ts`, change line 23 from:

```ts
  canonicalHandPositionForWideWalk,
```

to:

```ts
  canonicalHandPositionForVariant,
```

Then update the call site around line 269:

```ts
        if (!isHandPositionMeaningful(scale, variant)) {
          plan.push({ variant, hp: canonicalHandPositionForVariant(variant) });
        } else {
```

- [ ] **Step 3: Run typecheck + all tests**

Run: `npm run check && npx vitest run`
Expected: clean check, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/picker.ts
git commit -m "refactor(arpeggios): rename canonicalHandPositionForWideWalk to ...ForVariant"
```

---

## Task 8: Wire `generateExercise` arpeggio branch

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write a failing integration test**

Append to `src/exercises/scale-generator.test.ts`:

```ts
import { generateExercise } from './scale-generator';
import { KEYS_BY_ID, keySignatureFor, keySignatureLabelFor, spellingMap } from '../theory/keys';

describe('generateExercise — arpeggioCycle', () => {
  function makeParams(
    scaleId: 'major' | 'naturalMinor' | 'dorian',
    keyId: string,
    size: 3 | 4 | 5 | 6 | 7,
    direction: 'allUp' | 'upDown' | 'downUp' | 'zigzag',
    tuningId: 'fourStringEADG' | 'fiveStringBEADG' = 'fourStringEADG',
  ) {
    const key = KEYS_BY_ID[keyId];
    const scale = SCALES[scaleId];
    const tuning = TUNINGS[tuningId];
    return {
      scale,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'arpeggioCycle' as const, size, direction },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning,
      keySignature: keySignatureFor(key, scale),
      keySignatureLabel: keySignatureLabelFor(key, scale),
      spelling: spellingMap(key, scale),
    };
  }

  test('C major triad allUp on 4-string starts on string 0 or 1', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp'));
    expect(ex.sequence[0].string).toBeLessThanOrEqual(1);
  });

  test('C major triad allUp on 5-string starts on string 0, 1, or 2', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp', 'fiveStringBEADG'));
    expect(ex.sequence[0].string).toBeLessThanOrEqual(2);
  });

  test('final note pins to start position', () => {
    const ex = generateExercise(makeParams('major', 'G', 3, 'upDown'));
    const start = ex.sequence[0];
    const last = ex.sequence[ex.sequence.length - 1];
    expect(last.string).toBe(start.string);
    expect(last.fret).toBe(start.fret);
  });

  test('no negative frets across all 4 directions × triad / 7th / 9th on C major', () => {
    const directions = ['allUp', 'upDown', 'downUp', 'zigzag'] as const;
    const sizes = [3, 4, 5] as const;
    for (const d of directions) {
      for (const sz of sizes) {
        const ex = generateExercise(makeParams('major', 'C', sz, d));
        for (const n of ex.sequence) {
          expect(n.fret).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('every note uses eighth-note duration', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp'));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
    }
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "generateExercise — arpeggioCycle"`
Expected: FAIL with "arpeggioCycle not yet implemented" (the placeholder from Task 1).

- [ ] **Step 3: Implement the arpeggio branch in `generateExercise`**

In `src/exercises/scale-generator.ts`, find the placeholder `throw new Error('arpeggioCycle not yet implemented')` (added in Task 1 to whichever switch statement complained). It's likely in the `describeVariant` switch (around line 1384-1418) and `generateExercise`'s variant dispatch (around line 1305-1356).

In `generateExercise`, find the existing `else if (` branches that dispatch by variant kind (around line 1305-1356). Add a new branch BEFORE the final `} else {` error-throw:

```ts
  } else if (variant.kind === 'arpeggioCycle') {
    // Arpeggio cycles use the same multi-octave layout pipeline as
    // walking variants — apex drifts to high frets, pin lookahead pulls
    // the resolution back to the start position. Open strings are
    // avoided because they sound jumpy in the middle of an arp.
    const midi = arpeggioCycleMidi(scale, lowRootMidi, variant.size, variant.direction);
    sequence = layOnFretboard(midi, tuning, lowRootPos, handPosition, {
      applyPinLookahead: true,
      avoidOpenStrings: true,
    });
  } else {
```

Update the imports at the top of `scale-generator.ts` to include `arpeggioCycleMidi`:

```ts
import {
  // ... existing imports ...
  arpeggioCycleMidi,
} from './variants';
```

- [ ] **Step 4: Run the new tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "generateExercise — arpeggioCycle"`
Expected: PASS for all 5 new tests.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(arpeggios): wire generateExercise arpeggio branch (layOnFretboard + pin)"
```

---

## Task 9: Add `enabledArpeggios` to Settings + bump storage version

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Add `ArpeggioToggles` interface**

In `src/stores/settings.ts`, after the existing `VariantToggles` interface (around line 7-17), add:

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

- [ ] **Step 2: Add `enabledArpeggios` field to `Settings`**

In the `Settings` interface (around line 31-66), add a new field after `enabledVariants`:

```ts
  enabledArpeggios: ArpeggioToggles;
```

- [ ] **Step 3: Bump storage key from `v4` to `v5`**

Change line 68 from:

```ts
const STORAGE_KEY = 'bass-practice:settings:v4';
```

to:

```ts
const STORAGE_KEY = 'bass-practice:settings:v5';
```

- [ ] **Step 4: Add defaults in `defaultSettings`**

In `defaultSettings()` (around line 70-114), add `enabledArpeggios` to the returned object, after `enabledVariants`:

```ts
    enabledArpeggios: {
      sizes: {
        triad: true,
        seventh: true,
        ninth: true,
        eleventh: true,
        thirteenth: true,
      },
      directions: {
        allUp: true,
        upDown: true,
        downUp: true,
        zigzag: true,
      },
    },
```

- [ ] **Step 5: Extend `loadSettings` merge to cover `enabledArpeggios` sub-objects**

In `loadSettings` (around line 116-141), extend the merge object (currently around line 123-137) to include nested `enabledArpeggios` merging:

```ts
    return {
      ...defaults,
      ...parsed,
      enabledScales: { ...defaults.enabledScales, ...parsed.enabledScales },
      enabledVariants: {
        ...defaults.enabledVariants,
        ...parsed.enabledVariants,
      },
      enabledArpeggios: {
        sizes: {
          ...defaults.enabledArpeggios.sizes,
          ...parsed.enabledArpeggios?.sizes,
        },
        directions: {
          ...defaults.enabledArpeggios.directions,
          ...parsed.enabledArpeggios?.directions,
        },
      },
      displayToggles: {
        ...defaults.displayToggles,
        ...parsed.displayToggles,
      },
      metronome: { ...defaults.metronome, ...parsed.metronome },
    };
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/stores/settings.ts
git commit -m "feat(arpeggios): add enabledArpeggios settings + bump storage to v5"
```

---

## Task 10: Add arpeggio entries to `variantsFromSettings` + per-scale filter

**Files:**
- Modify: `src/exercises/picker.ts`
- Test: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/picker.test.ts`:

```ts
import type { ArpeggioToggles } from '../stores/settings';

function arpsOnly(overrides: Partial<ArpeggioToggles> = {}): Settings {
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
      sizes: {
        triad: true,
        seventh: false,
        ninth: false,
        eleventh: false,
        thirteenth: false,
      },
      directions: {
        allUp: true,
        upDown: false,
        downUp: false,
        zigzag: false,
      },
      ...overrides,
    },
  };
}

describe('generateUniverse — arpeggio universe', () => {
  test('arpeggios excluded for pentatonic scales', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { majorPentatonic: true } as Settings['enabledScales'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(0);
  });

  test('arpeggios excluded for chromatic scale', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { chromatic: true } as Settings['enabledScales'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(0);
  });

  test('arpeggios included for Major scale', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.variant.kind).toBe('arpeggioCycle');
    }
  });

  test('arpeggios included for Hungarian Minor (7 intervals, despite pentatonic category)', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { hungarian: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
  });

  test('one canonical entry per (scale, key, size, direction) — no hand-position multiplication', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front', 'mid', 'back'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(1); // triad × allUp × C major × 1 hp
  });

  test('disabling all sizes removes arpeggios entirely', () => {
    const settings: Settings = arpsOnly({
      sizes: {
        triad: false,
        seventh: false,
        ninth: false,
        eleventh: false,
        thirteenth: false,
      },
    });
    expect(generateUniverse(settings)).toHaveLength(0);
  });

  test('disabling all directions removes arpeggios entirely', () => {
    const settings: Settings = arpsOnly({
      directions: {
        allUp: false,
        upDown: false,
        downUp: false,
        zigzag: false,
      },
    });
    expect(generateUniverse(settings)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio universe"`
Expected: FAIL — arpeggios not yet emitted.

- [ ] **Step 3: Extend `variantsFromSettings`**

In `src/exercises/picker.ts`, find the `variantsFromSettings` function (around line 187-211). Add after the `intervalWalks` block, before the final `return variants;`:

```ts
  const SIZE_KEYS = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
  const SIZE_VALUES: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
  const DIRECTIONS: Array<'allUp' | 'upDown' | 'downUp' | 'zigzag'> = [
    'allUp',
    'upDown',
    'downUp',
    'zigzag',
  ];
  for (let i = 0; i < SIZE_KEYS.length; i++) {
    if (!s.enabledArpeggios.sizes[SIZE_KEYS[i]]) continue;
    for (const dir of DIRECTIONS) {
      if (!s.enabledArpeggios.directions[dir]) continue;
      variants.push({
        kind: 'arpeggioCycle',
        size: SIZE_VALUES[i],
        direction: dir,
      });
    }
  }
```

- [ ] **Step 4: Add per-scale filter in `generateUniverse`**

In `generateUniverse` (around line 218-365), find the variant iteration loop (around line 262). After the existing `if (variant.kind === 'intervalWalk') { ... }` check (around line 263-267), add:

```ts
        if (variant.kind === 'arpeggioCycle' && scale.intervals.length !== 7) {
          continue;
        }
```

- [ ] **Step 5: Wire the highestMidi function to use arpeggioCycleApex**

In `picker.ts`, the `highestMidi` function (around line 151-181) dispatches by variant kind. Add a new case before `default:`:

```ts
    case 'arpeggioCycle':
      return arpeggioCycleApex(scale, lowRootMidi, variant.size);
```

Add `arpeggioCycleApex` to the imports from `./scale-generator`:

```ts
import {
  // ... existing imports ...
  arpeggioCycleApex,
} from './scale-generator';
```

- [ ] **Step 6: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio universe"`
Expected: PASS for all 7 tests.

Then run the full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(arpeggios): emit arpeggio variants from picker + per-scale filter"
```

---

## Task 11: Add URL encoding for arpeggio variants

**Files:**
- Modify: `src/exercises/picker.ts`
- Test: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/picker.test.ts`:

```ts
import { paramsFromKey } from './picker';

describe('paramsKey / paramsFromKey — arpeggio round-trip', () => {
  test('triad allUp round-trips', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    const p = universe[0];
    const key = paramsKey(p);
    expect(key).toContain('arpeggio:3:allUp');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('arpeggioCycle');
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.size).toBe(3);
      expect(restored!.variant.direction).toBe('allUp');
    }
  });

  test('13th zigzag round-trips', () => {
    const settings: Settings = {
      ...arpsOnly({
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: true },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: true },
      }),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['Bb'],
    };
    const universe = generateUniverse(settings);
    if (universe.length === 0) {
      // 13th zigzag on B♭ may not fit the bass — skip in that case.
      return;
    }
    const p = universe[0];
    const key = paramsKey(p);
    expect(key).toContain('arpeggio:7:zigzag');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.size).toBe(7);
      expect(restored!.variant.direction).toBe('zigzag');
    }
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio round-trip"`
Expected: FAIL — `paramsKey` for arpeggio variants is unhandled (placeholder throw or wrong output).

- [ ] **Step 3: Replace the `paramsKey` placeholder with the real encoding**

In `src/exercises/picker.ts`, find the `case 'arpeggioCycle':` placeholder added in Task 1 (in the `paramsKey` switch). Replace its body:

```ts
    case 'arpeggioCycle':
      variantKey = `arpeggio:${p.variant.size}:${p.variant.direction}`;
      break;
```

- [ ] **Step 4: Extend `paramsFromKey`**

In `src/exercises/picker.ts`, find the variant parser inside `paramsFromKey` (around line 56-89). After the existing `else if (kind === 'walk')` branch (around line 76-85), add:

```ts
    } else if (kind === 'arpeggio') {
      // rest format: "<size>:<direction>", e.g. "3:allUp"
      const colon2 = rest.indexOf(':');
      if (colon2 < 0) return null;
      const sizeStr = rest.slice(0, colon2);
      const dirStr = rest.slice(colon2 + 1);
      const size = Number(sizeStr);
      if (![3, 4, 5, 6, 7].includes(size)) return null;
      if (
        dirStr !== 'allUp' &&
        dirStr !== 'upDown' &&
        dirStr !== 'downUp' &&
        dirStr !== 'zigzag'
      ) {
        return null;
      }
      variant = {
        kind: 'arpeggioCycle',
        size: size as 3 | 4 | 5 | 6 | 7,
        direction: dirStr as 'allUp' | 'upDown' | 'downUp' | 'zigzag',
      };
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio round-trip"`
Expected: PASS.

Full suite:

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(arpeggios): paramsKey / paramsFromKey URL encoding"
```

---

## Task 12: Update `formatDisplayName` / `describeVariant` for arpeggios

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
import { formatDisplayName } from './scale-generator';

describe('formatDisplayName — arpeggios', () => {
  function arpParams(
    keyId: string,
    scaleId: 'major' | 'naturalMinor' | 'dorian' | 'phrygianDominant',
    size: 3 | 4 | 5 | 6 | 7,
    direction: 'allUp' | 'upDown' | 'downUp' | 'zigzag',
  ) {
    const key = KEYS_BY_ID[keyId];
    const scale = SCALES[scaleId];
    return {
      scale,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'arpeggioCycle' as const, size, direction },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning: TUNINGS.fourStringEADG,
    };
  }

  test('C major triad allUp', () => {
    expect(formatDisplayName(arpParams('C', 'major', 3, 'allUp'))).toBe(
      'C Major — Triad cycle ↑↑',
    );
  });

  test('E♭ dorian 9th zigzag', () => {
    expect(formatDisplayName(arpParams('Eb', 'dorian', 5, 'zigzag'))).toBe(
      'E♭ Dorian — 9th cycle ↕',
    );
  });

  test('B♭ phrygian-dominant 7th upDown', () => {
    expect(formatDisplayName(arpParams('Bb', 'phrygianDominant', 4, 'upDown'))).toBe(
      'B♭ Phrygian Dominant — 7th cycle ↑↓',
    );
  });

  test('C natural-minor 11th downUp', () => {
    expect(formatDisplayName(arpParams('C', 'naturalMinor', 6, 'downUp'))).toBe(
      'C Natural Minor — 11th cycle ↓↑',
    );
  });

  test('no hand chip suffix (consistent with walking 7ths/octaves)', () => {
    const name = formatDisplayName(arpParams('C', 'major', 3, 'allUp'));
    expect(name).not.toContain('Front');
    expect(name).not.toContain('Mid');
    expect(name).not.toContain('Back');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — arpeggios"`
Expected: FAIL — `describeVariant` doesn't handle arpeggios yet (placeholder throw from Task 1).

- [ ] **Step 3: Update `describeVariant`**

In `src/exercises/scale-generator.ts`, find `describeVariant` (around line 1384-1418). Replace the placeholder `case 'arpeggioCycle':` (added in Task 1) with the real implementation:

```ts
    case 'arpeggioCycle': {
      const sizeLabels: Record<3 | 4 | 5 | 6 | 7, string> = {
        3: 'Triad',
        4: '7th',
        5: '9th',
        6: '11th',
        7: '13th',
      };
      const dirSymbols: Record<'allUp' | 'upDown' | 'downUp' | 'zigzag', string> = {
        allUp: '↑↑',
        upDown: '↑↓',
        downUp: '↓↑',
        zigzag: '↕',
      };
      return `${sizeLabels[v.size]} cycle ${dirSymbols[v.direction]}`;
    }
```

(The `formatDisplayName` function already produces `"{Root} {Scale} — {variantLabel}"` and skips the hand-position suffix when `!isHandPositionMeaningful` — which now returns false for arpeggios per Task 7. So no other changes needed.)

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "formatDisplayName — arpeggios"`
Expected: PASS.

Full suite:

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(arpeggios): display names for arpeggio cycles"
```

---

## Task 13: Add Arpeggios section to SettingsPanel.svelte

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add toggle helpers**

In `src/components/SettingsPanel.svelte`, find the `toggleVariant` function (around line 66-74). After it, add:

```ts
  function toggleArpSize(key: keyof typeof $settings.enabledArpeggios.sizes) {
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        ...s.enabledArpeggios,
        sizes: {
          ...s.enabledArpeggios.sizes,
          [key]: !s.enabledArpeggios.sizes[key],
        },
      },
    }));
  }

  function toggleArpDirection(
    key: keyof typeof $settings.enabledArpeggios.directions,
  ) {
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        ...s.enabledArpeggios,
        directions: {
          ...s.enabledArpeggios.directions,
          [key]: !s.enabledArpeggios.directions[key],
        },
      },
    }));
  }
```

- [ ] **Step 2: Add the Arpeggios section in the template**

Find the existing "Variants" section closing `</section>` (around line 223). Right after it, insert a new section:

```svelte
    <section>
      <h3>Arpeggios</h3>
      <p class="hint">Cycles diatonic chord arpeggios through the key. Only available on 7-note scales.</p>
      <div class="arp-subhead">Sizes</div>
      <div class="chips">
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.triad}
            onchange={() => toggleArpSize('triad')}
          />
          <span>Triad</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.seventh}
            onchange={() => toggleArpSize('seventh')}
          />
          <span>7th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.ninth}
            onchange={() => toggleArpSize('ninth')}
          />
          <span>9th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.eleventh}
            onchange={() => toggleArpSize('eleventh')}
          />
          <span>11th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.thirteenth}
            onchange={() => toggleArpSize('thirteenth')}
          />
          <span>13th</span>
        </label>
      </div>
      <div class="arp-subhead">Directions</div>
      <div class="chips">
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.allUp}
            onchange={() => toggleArpDirection('allUp')}
          />
          <span>↑↑ all up</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.upDown}
            onchange={() => toggleArpDirection('upDown')}
          />
          <span>↑↓ up then down</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.downUp}
            onchange={() => toggleArpDirection('downUp')}
          />
          <span>↓↑ down then up</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.zigzag}
            onchange={() => toggleArpDirection('zigzag')}
          />
          <span>↕ zigzag</span>
        </label>
      </div>
    </section>
```

- [ ] **Step 3: Add styles for `arp-subhead` and `hint`**

In the `<style>` block at the end of the file, after the existing styles, add:

```css
  .arp-subhead {
    margin: 10px 0 6px;
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 600;
  }
  .hint {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.4;
  }
```

- [ ] **Step 4: Manual verification — run the dev server**

Run: `npm run dev` (or note the port if 5173 is taken)

Then verify in the browser:
- Open the settings panel.
- Confirm the new "Arpeggios" section appears under "Variants".
- Toggle a size and direction off, then on; confirm new exercises in the picker reflect the changes.
- Refresh the page; confirm settings persist.

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(arpeggios): SettingsPanel section for sizes + directions"
```

---

## Task 14: Add `arpeggios` family chip to BrowsePanel.svelte

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

- [ ] **Step 1: Read the existing variant-family chip logic to understand the structure**

Run: `grep -n "variantFamily\|family" src/components/BrowsePanel.svelte | head -30`

This will show you the existing chip definitions and the filter function. The pattern is: a `variantFamily(variant)` helper that maps each `Variant.kind` to a family string (e.g. `'walking'`, `'mirror'`, `'plain'`), and a chip list that the user selects from.

- [ ] **Step 2: Add `arpeggios` to the family mapper**

In `src/components/BrowsePanel.svelte`, find the function that maps a variant to its family name. Add a new case for `arpeggioCycle`:

```ts
    case 'arpeggioCycle':
      return 'arpeggios';
```

(If the function uses an object literal map instead of a switch, add `arpeggioCycle: 'arpeggios'`.)

- [ ] **Step 3: Add the chip to the chip list**

Find the array of family chip labels (likely a `const FAMILIES = [...]` or similar). Add `'arpeggios'` to the list, in a sensible position (probably last since it's the newest variant family).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

Then:
- Open the browse panel (🔍 button).
- Confirm an "arpeggios" filter chip appears.
- Click it; confirm only arpeggio exercises appear in the result list.
- Click another chip (e.g. "walking"); confirm the chips are exclusive / combinable in the existing way.

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(arpeggios): BrowsePanel arpeggios family chip"
```

---

## Task 15: Extend `scripts/trace-exercise.ts` to parse arpeggio specs

**Files:**
- Modify: `scripts/trace-exercise.ts`

- [ ] **Step 1: Extend the variant grammar**

In `scripts/trace-exercise.ts`, update the usage comment at the top (lines 14-19) to add the arpeggio form. Change the grammar block:

```
// variantSpec grammar:
//   plain                       → plain 1-octave scale
//   walk<+|->N                  → walking N-th interval (e.g. walk+2, walk-3)
//   moA<N> | moB<N>             → multi-octave A or B, N octaves
//   cons<N>                     → consecutive groups of N (1-2-3 etc)
//   mirror<N>                   → mirror groups, peak size N
//   arp<size>-<direction>       → arpeggio cycle, e.g. arp3-allUp, arp7-zigzag
```

- [ ] **Step 2: Extend `parseVariant` to handle the new form**

In the `parseVariant` function (around line 73-92), add a new branch before the final `throw`:

```ts
  const arp = spec.match(/^arp(\d+)-(allUp|upDown|downUp|zigzag)$/);
  if (arp) {
    const size = Number(arp[1]);
    if (![3, 4, 5, 6, 7].includes(size)) {
      throw new Error(`Invalid arpeggio size: ${size} (must be 3-7)`);
    }
    return {
      kind: 'arpeggioCycle',
      size: size as 3 | 4 | 5 | 6 | 7,
      direction: arp[2] as 'allUp' | 'upDown' | 'downUp' | 'zigzag',
    };
  }
```

- [ ] **Step 3: Verify by running it on a known exercise**

Run: `npx tsx scripts/trace-exercise.ts C major arp3-allUp front`

Expected output (abridged): displays the C major triad allUp cycle on the 4-string EADG, with each note's MIDI + fretboard position. The first note should be on string 0 (low E) fret 8 = C. The last note should match the first.

- [ ] **Step 4: Commit**

```bash
git add scripts/trace-exercise.ts
git commit -m "feat(arpeggios): trace-exercise.ts accepts arpN-DIR specs"
```

---

## Task 16: Extend `scripts/scan-layouts.ts` to handle arpeggios

**Files:**
- Modify: `scripts/scan-layouts.ts`

- [ ] **Step 1: Add `arpeggio` filter flag and replace the `variantTag` placeholder**

In `scripts/scan-layouts.ts`, change line 20 from:

```ts
const onlyWalking = process.argv.includes('walking');
```

to:

```ts
const onlyWalking = process.argv.includes('walking');
const onlyArpeggio = process.argv.includes('arpeggio');
```

Update the comment at the top (lines 5-7) to document the new flag:

```
// Usage:
//   npx tsx scripts/scan-layouts.ts                  # all exercises
//   npx tsx scripts/scan-layouts.ts walking          # only interval-walk variants
//   npx tsx scripts/scan-layouts.ts arpeggio         # only arpeggio cycle variants
```

Change the filter check at line 30 from:

```ts
  if (onlyWalking && params.variant.kind !== 'intervalWalk') continue;
```

to:

```ts
  if (onlyWalking && params.variant.kind !== 'intervalWalk') continue;
  if (onlyArpeggio && params.variant.kind !== 'arpeggioCycle') continue;
```

Extend the summary line (around line 83) to mention the arpeggio filter:

```ts
console.log(
  `${totalIssues} issues out of ${totalChecked} exercises${onlyWalking ? ' (walking only)' : ''}${onlyArpeggio ? ' (arpeggio only)' : ''}`,
);
```

Replace the `arpeggioCycle` placeholder in `variantTag` (added in Task 1) with the real label:

```ts
    case 'arpeggioCycle':
      return `arp ${v.size}-${v.direction}`;
```

- [ ] **Step 2: Verify by running the scan**

Run: `npx tsx scripts/scan-layouts.ts arpeggio`

Expected: prints `N issues out of M exercises (arpeggio only)`. **Critically, M should be > 0** — if it's 0, the universe isn't producing arpeggios (back-trace to verify settings defaults from Task 9 took effect and the picker emits them).

Also expect 0 issues (no negative frets, no big cross-string jumps) — if issues appear, capture them and investigate before moving on. Use `scripts/trace-exercise.ts` to drill into specific exercises.

- [ ] **Step 3: Run the FULL scan to verify no regressions on existing variants**

Run: `npx tsx scripts/scan-layouts.ts`

Expected: same issue count as before this PR began (almost certainly 0, given the existing baseline).

- [ ] **Step 4: Commit**

```bash
git add scripts/scan-layouts.ts
git commit -m "feat(arpeggios): scan-layouts.ts accepts arpeggio filter"
```

---

## Task 17: Manual end-to-end UI verification

**No code changes — this is a verification gate.**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Note the URL (default `http://localhost:5173`).

- [ ] **Step 2: Verify the basic arpeggio user flow**

In a browser, open the URL. Then:

- Open the Settings panel (⚙ button).
- Scroll to the new "Arpeggios" section. Confirm it shows size + direction chips, defaulting all-on.
- Close settings. Pick the next exercise (`N` key or Next button). Repeat until an arpeggio exercise appears.
- Confirm the display name reads e.g. `C Major — Triad cycle ↑↑` with no hand chip.
- Confirm AlphaTab renders the notation + tab.
- Confirm the SVG fretboard shows the arpeggio notes (you can listen mentally — the first arp should sound like the chord rooted at the key).
- Start the metronome (Space). Confirm the eighth-note groove plays.

- [ ] **Step 3: Verify URL bookmarkability**

- With an arpeggio exercise loaded, copy the URL.
- Reload — confirm the exact same exercise re-loads.
- Manually change `arpeggio:3:allUp` in the hash to `arpeggio:5:zigzag`; confirm the displayed exercise updates (assuming the combo fits the bass — try a few keys if not).

- [ ] **Step 4: Verify BrowsePanel filter**

- Open the Browse panel (🔍 button).
- Click the "arpeggios" filter chip.
- Confirm the result list shows only arpeggio entries.
- Tap one — confirm it loads.

- [ ] **Step 5: Verify settings persistence**

- Open Settings, disable all but one direction (e.g. zigzag).
- Disable all but one size (e.g. triad).
- Close settings, reload the page.
- Open Settings again — confirm the toggles persisted.
- Pick a few exercises — confirm they're all triad-zigzag.

- [ ] **Step 6: Verify on a wider tuning (5-string)**

- In Settings, switch tuning to "5-string BEADG".
- Pick a few arpeggio exercises.
- Confirm the starting note sits on the B, E, or A string (string indexes 0-2).
- Confirm the layout uses the wider range gracefully.

- [ ] **Step 7: If anything looks wrong, file a regression and don't proceed.**

- [ ] **Step 8: Commit nothing (verification only).**

---

## Task 18: Run full test suite + universe scan as final gate

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL tests pass. Note the count (should be 214 + the new arpeggio tests added in Tasks 2-12).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 3: Run full universe scan**

Run: `npx tsx scripts/scan-layouts.ts`
Expected: 0 issues (matching the pre-PR baseline). The universe size should have grown substantially (was 17,058; arpeggios add up to ~14 scales × 17 keys × 5 sizes × 4 directions = ~4,760 new entries, minus the keys that don't fit per-tuning, so probably ~3,000-4,000 new entries).

- [ ] **Step 4: Run build to verify production bundle**

Run: `npm run build`
Expected: success, no warnings about unused exports or type errors.

- [ ] **Step 5: Commit nothing if all is well.**

If a test fails or the scan finds issues, fix them inline and add a test that catches the regression.

---

## Task 19: Update docs/plan.md

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Move arpeggios from "Future passes" to "Done" / "Recent additions"**

In `docs/plan.md`, find the "Future passes" section (around line 49). Remove the multi-line "Arpeggios — in progress (...)" bullet that was added during the spec phase. The deferred sub-items (open strings, inversions, chord progressions, etc.) should remain as future-pass bullets.

Then in the "Recent additions" section (or a new "Arpeggios" section), add:

```markdown
- [x] **Arpeggios — diatonic cycle exercises.** 5 chord sizes (triad → 13th) × 4 directions (allUp / upDown / downUp / zigzag) on 14 diatonic 7-note scales × 17 keys. Picker emits one canonical entry per `(scale, key, size, direction)`; root constrained to the bottom 2 strings (4-string) / bottom 3 strings (5/6-string). Spec: [docs/superpowers/specs/2026-05-17-arpeggios-design.md](superpowers/specs/2026-05-17-arpeggios-design.md). New helpers in [src/exercises/variants.ts](../src/exercises/variants.ts) (`arpUp`, `arpDown`, `arpeggioCycleMidi`) and [src/exercises/scale-generator.ts](../src/exercises/scale-generator.ts) (`arpeggioCycleApex`, `maxStringIndex` constraint). `canonicalHandPositionForWideWalk` renamed to `canonicalHandPositionForVariant`.
```

Verify the deferred-items bullet (also in "Future passes") still reads:

```markdown
- Arpeggios — **in progress** ...
  - Open-string arpeggio variants.
  - Inversions ...
  - ...
```

Edit it to remove the "in progress" framing — the current pass is done, only the sub-items remain deferred. Replace the bullet with:

```markdown
- Arpeggios — further passes:
  - Open-string arpeggio variants.
  - Inversions — arpeggios that don't start on the chord root.
  - Selecting which scale degrees to root on (current pass always cycles 1 → 8).
  - Chord-progression exercises — ii–V–I, cycle of fifths, diatonic 7ths chained, etc. — a different exercise unit (multi-key, not single-key cycle).
  - Arpeggios on non-diatonic scales (pentatonics, chromatic, octatonic) — would need a different chord-tone-selection convention.
  - User-selected hand position for arpeggios.
```

- [ ] **Step 2: Update the status counter at the top of `plan.md`**

Find the "State: 214 unit tests passing..." line (around line 21) and update the counts. Run `npx vitest run` to get the actual test count and `wc -l` style universe count from `scripts/scan-layouts.ts`.

Example revised line:

```markdown
State: ~280 unit tests passing, svelte-check clean. Universe currently ~20,000 exercises across 4 tunings. Walking-exercise and arpeggio layout scans: 0 cross-string ≥8 fret jumps.
```

(Use the actual numbers from your local run.)

- [ ] **Step 3: Commit**

```bash
git add docs/plan.md
git commit -m "docs(arpeggios): mark first pass complete in plan.md"
```

---

## Self-review checklist

After completing all tasks, verify these are true:

- [ ] Every section of the spec is covered by at least one task. (Spec sections: Goal, Cycle structure, Scope, Data model, Sequence generation, Picker, UI, Testing, Risks.)
- [ ] All function/method names used in later tasks match what was defined in earlier tasks (`arpeggioCycleMidi`, `arpUp`, `arpDown`, `arpeggioCycleApex`, `canonicalHandPositionForVariant`, `enabledArpeggios`).
- [ ] No "TBD" / "TODO" / placeholder strings remain in this plan or the code.
- [ ] No tasks defer "edge cases" or "error handling" without specifying what those are.
- [ ] All commit messages follow the existing convention (`feat(...)`, `test(...)`, `refactor(...)`, `docs(...)`).
- [ ] The "no hand-position chip" rule for arpeggios is enforced via `isHandPositionMeaningful` returning false (Task 7), and `formatDisplayName` already drops the chip in that case.

If any check fails, fix the plan before starting implementation.
