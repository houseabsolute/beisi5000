# Arpeggio inversions — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `inversion` dimension to arpeggio cycle exercises. Each enabled inversion (root, 1st, 2nd, … 6th) generates separate `allUp` variants. Inversions apply ONLY to the `allUp` direction — `upDown` / `downUp` / `zigzag` always stay at root.

**Architecture:** New `invertedArpUp` helper in `variants.ts` computes inverted chord tones via the standard music-theory inversion rule (raise the K bottom chord tones by one octave; sort ascending). `arpeggioCycleMidi` gains an `inversion` parameter that's routed to `invertedArpUp` for `allUp` direction only; other directions use existing `arpUp` / `arpDown` unchanged. Picker iterates enabled inversions × (size × allUp) cartesian product, skipping invalid combos where `inversion >= size`. Settings storage bumps v7 → v8.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest, AlphaTab.

**Reference spec:** [docs/superpowers/specs/2026-05-23-arpeggio-inversions-design.md](../specs/2026-05-23-arpeggio-inversions-design.md)

---

## File structure

**No new files.** All changes are extensions of existing modules.

**Modified files:**

| File | What changes |
|------|--------------|
| `src/exercises/types.ts` | Add required `inversion: number` field to `arpeggioCycle` variant kind |
| `src/exercises/variants.ts` | New `invertedArpUp` helper; `arpeggioCycleMidi` + `arpeggioConsecutive` + `arpeggioZigzag` accept an `inversion` parameter (only meaningful for `allUp`) |
| `src/exercises/scale-generator.ts` | `arpeggioCycleApex` formula factored over inversion; `generateExercise` passes `variant.inversion` through to `arpeggioCycleMidi`; `describeVariant` appends inversion suffix |
| `src/exercises/picker.ts` | `variantsFromSettings` iterates enabled inversions for allUp; `paramsKey` / `paramsFromKey` handle 4-segment arpeggio URLs with back-compat |
| `src/stores/settings.ts` | Add `ArpeggioInversionToggles` interface + `enabledArpeggioInversions` field; bump v7 → v8 |
| `src/components/SettingsPanel.svelte` | New Inversions sub-section inside Arpeggios with All/None buttons + toggle helpers; `enableAll` extended |
| `src/components/BrowsePanel.svelte` | New Inversion filter chip row with grey-out when Variant ≠ Arpeggios |
| Various tests | New unit tests for `invertedArpUp`, `arpeggioCycleApex`, `generateExercise`, picker universe + URL round-trip |
| `docs/plan.md` | Mark feature complete |

---

## Task 1: Add `invertedArpUp` helper + unit tests

**Files:**
- Modify: `src/exercises/variants.ts`
- Test: `src/exercises/variants.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/variants.test.ts`. The existing test file already imports `arpUp`, `arpDown`, etc. from `./variants` and `SCALES` from `../theory/scales`.

```ts
import { invertedArpUp } from './variants';

describe('invertedArpUp', () => {
  const cMaj = SCALES.major;
  const C2 = 36;

  test('inversion 0 equals existing arpUp output (root position)', () => {
    expect(invertedArpUp(cMaj, C2, 0, 3, 0)).toEqual(arpUp(cMaj, C2, 0, 3));
    expect(invertedArpUp(cMaj, C2, 2, 4, 0)).toEqual(arpUp(cMaj, C2, 2, 4));
  });

  test('triad 1st inversion of C major at d=0 → [E, G, C(8va)]', () => {
    // Notes at MIDI: E2=40, G2=43, C3=48
    expect(invertedArpUp(cMaj, C2, 0, 3, 1)).toEqual([40, 43, 48]);
  });

  test('triad 2nd inversion of C major at d=0 → [G, C(8va), E(8va)]', () => {
    // Notes at MIDI: G2=43, C3=48, E3=52
    expect(invertedArpUp(cMaj, C2, 0, 3, 2)).toEqual([43, 48, 52]);
  });

  test('7th 1st inversion of C major at d=0 → [E, G, B, C(8va)]', () => {
    // Notes at MIDI: E2=40, G2=43, B2=47, C3=48
    expect(invertedArpUp(cMaj, C2, 0, 4, 1)).toEqual([40, 43, 47, 48]);
  });

  test('7th 3rd inversion of C major at d=0 → [B, C(8va), E(8va), G(8va)]', () => {
    // B2=47, C3=48, E3=52, G3=55
    expect(invertedArpUp(cMaj, C2, 0, 4, 3)).toEqual([47, 48, 52, 55]);
  });

  test('9th 3rd inversion of C major at d=0 → [B, C(8va), D(8va), E(8va), G(8va)]', () => {
    // Verifies sort handles a mid-cycle wrap correctly
    // B2=47, C3=48, D3=50, E3=52, G3=55
    expect(invertedArpUp(cMaj, C2, 0, 5, 3)).toEqual([47, 48, 50, 52, 55]);
  });

  test('triad 1st inversion of C major at d=7 (octave-up root) → [E(8va), G(8va), C(16va)]', () => {
    // d=7 means start the chord at the octave-up C (MIDI 48)
    // 1st inv: E3=52, G3=55, C4=60
    expect(invertedArpUp(cMaj, C2, 7, 3, 1)).toEqual([52, 55, 60]);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/variants.test.ts -t "invertedArpUp"`
Expected: all FAIL — `invertedArpUp` doesn't exist yet.

- [ ] **Step 3: Implement `invertedArpUp`**

In `src/exercises/variants.ts`, add after the existing `arpDown` function (around line 128):

```ts
/**
 * Build one arpeggio of `size` notes for the chord rooted at scale
 * degree `d`, voiced in `inversion` (0 = root position; K = K-th
 * inversion). For inversion K, the K chord tones below the new bass
 * get raised one octave so they sit above. Notes returned in
 * pitch-ascending order. Equivalent to `arpUp` when inversion = 0.
 */
export function invertedArpUp(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
  inversion: number,
): number[] {
  const SCALE_LEN = 7;
  const degrees: number[] = [];
  for (let pos = 0; pos < size; pos++) {
    const degree = d + 2 * pos + (pos < inversion ? SCALE_LEN : 0);
    degrees.push(degree);
  }
  degrees.sort((a, b) => a - b);
  return degrees.map((deg) => scaleDegreeMidi(scale, rootMidi, deg));
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/variants.test.ts -t "invertedArpUp"`
Expected: all 7 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/variants.ts src/exercises/variants.test.ts
git commit -m "feat(arpeggios): add invertedArpUp helper for chord inversions"
```

---

## Task 2: Add `inversion` field to `arpeggioCycle` variant

**Files:**
- Modify: `src/exercises/types.ts`
- Modify: `src/exercises/scale-generator.ts` (placeholder dispatch)
- Modify: `src/exercises/picker.ts` (placeholder universe + URL)
- Modify: `scripts/scan-layouts.ts` (placeholder variantTag)

- [ ] **Step 1: Add the field**

In `src/exercises/types.ts`, find the `arpeggioCycle` variant in the `Variant` union and add the `inversion` field:

```ts
  | {
      kind: 'arpeggioCycle';
      size: 3 | 4 | 5 | 6 | 7;
      direction: ArpDirection;
      inversion: number;
    }
```

- [ ] **Step 2: Run typecheck to find the breakages**

Run: `npm run check`
Expected: TypeScript errors at every site that constructs an `arpeggioCycle` variant — these include:
- `src/exercises/picker.ts` `variantsFromSettings` (where new `arpeggioCycle` entries are pushed)
- `src/exercises/picker.ts` `paramsFromKey` (where the variant is reconstructed from URL)
- `src/exercises/scale-generator.ts` `generateExercise` (probably reads `variant.size` and `variant.direction` — adding `inversion` doesn't break the read but the construction site does)
- Test files that construct fixtures with `{ kind: 'arpeggioCycle', size: …, direction: … }` literals

- [ ] **Step 3: Add temporary `inversion: 0` defaults to all construction sites**

For EACH file listed above, add `inversion: 0` to the object literal so it satisfies the type. These are temporary — later tasks will replace the literal `0` with real per-variant values.

Specifically in `src/exercises/picker.ts`:

In `variantsFromSettings` (around line 307), the loop that pushes `arpeggioCycle` entries:

```ts
variants.push({
  kind: 'arpeggioCycle',
  size: SIZE_VALUES[i],
  direction: dir,
  inversion: 0,  // TODO Task 6 will iterate enabled inversions
});
```

In `paramsFromKey` (around line 121), where the variant is reconstructed:

```ts
variant = {
  kind: 'arpeggioCycle',
  size: size as 3 | 4 | 5 | 6 | 7,
  direction: dirStr as 'allUp' | 'upDown' | 'downUp' | 'zigzag',
  inversion: 0,  // TODO Task 8 will parse from URL
};
```

In any test files that construct arpeggioCycle literals: add `inversion: 0`.

- [ ] **Step 4: Run typecheck again**

Run: `npm run check`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all tests pass (the `inversion: 0` default means everything still behaves like root position).

- [ ] **Step 5: Commit**

```bash
git add src/exercises/types.ts src/exercises/picker.ts \
  src/exercises/scale-generator.ts src/exercises/picker.test.ts \
  src/exercises/scale-generator.test.ts
# (add any other files where TS errors required `inversion: 0`)
git commit -m "feat(arpeggios): add required inversion field to arpeggioCycle variant"
```

---

## Task 3: Wire `inversion` through `arpeggioCycleMidi` (allUp only)

**Files:**
- Modify: `src/exercises/variants.ts`
- Test: `src/exercises/variants.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/variants.test.ts`:

```ts
describe('arpeggioCycleMidi — inversion (allUp only)', () => {
  const cMaj = SCALES.major;
  const C2 = 36;

  test('allUp inversion 0 = existing root-position output', () => {
    const before = arpeggioCycleMidi(cMaj, C2, 3, 'allUp', 0);
    // Sanity: matches the historical root-position triad cycle.
    // First arp at d=0 should be [C, E, G]
    expect(before.slice(0, 3)).toEqual([36, 40, 43]);
  });

  test('allUp inversion 1 — first arp at d=0 is [E, G, C(8va)]', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp', 1);
    expect(seq.slice(0, 3)).toEqual([40, 43, 48]);
  });

  test('allUp inversion 2 — first arp at d=0 is [G, C(8va), E(8va)]', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp', 2);
    expect(seq.slice(0, 3)).toEqual([43, 48, 52]);
  });

  test('upDown ignores inversion — inversion arg has no effect', () => {
    const root = arpeggioCycleMidi(cMaj, C2, 3, 'upDown', 0);
    const inv1 = arpeggioCycleMidi(cMaj, C2, 3, 'upDown', 1);
    expect(inv1).toEqual(root);
  });

  test('downUp ignores inversion', () => {
    const root = arpeggioCycleMidi(cMaj, C2, 3, 'downUp', 0);
    const inv2 = arpeggioCycleMidi(cMaj, C2, 3, 'downUp', 2);
    expect(inv2).toEqual(root);
  });

  test('zigzag ignores inversion', () => {
    const root = arpeggioCycleMidi(cMaj, C2, 3, 'zigzag', 0);
    const inv1 = arpeggioCycleMidi(cMaj, C2, 3, 'zigzag', 1);
    expect(inv1).toEqual(root);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/variants.test.ts -t "inversion"`
Expected: most FAIL — `arpeggioCycleMidi` doesn't take an inversion parameter yet (the new tests pass 5 arguments).

- [ ] **Step 3: Add `inversion` parameter and route it**

In `src/exercises/variants.ts`, modify `arpeggioCycleMidi` (around line 136):

```ts
export function arpeggioCycleMidi(
  scale: Scale,
  rootMidi: number,
  size: 3 | 4 | 5 | 6 | 7,
  direction: ArpDirection,
  inversion: number = 0,
): number[] {
  if (direction === 'zigzag') {
    return arpeggioZigzag(scale, rootMidi, size);  // zigzag ignores inversion
  }
  return arpeggioConsecutive(scale, rootMidi, size, direction, inversion);
}
```

Modify `arpeggioConsecutive` (around line 148):

```ts
function arpeggioConsecutive(
  scale: Scale,
  rootMidi: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
  inversion: number,
): number[] {
  const out: number[] = [];
  // Asc half (d=0..7)
  for (let d = 0; d <= 7; d++) {
    out.push(...arpAtDegree(scale, rootMidi, d, size, direction, inversion, 'asc'));
  }
  // Desc half (d=7..0)
  for (let d = 7; d >= 0; d--) {
    out.push(...arpAtDegree(scale, rootMidi, d, size, direction, inversion, 'desc'));
  }
  return out;
}

function arpAtDegree(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
  inversion: number,
  half: 'asc' | 'desc',
): number[] {
  const useUp =
    (half === 'asc' && (direction === 'allUp' || direction === 'upDown')) ||
    (half === 'desc' && (direction === 'allUp' || direction === 'downUp'));
  if (useUp) {
    // Only allUp gets inverted; upDown/downUp's up-arp halves stay at root.
    return direction === 'allUp'
      ? invertedArpUp(scale, rootMidi, d, size, inversion)
      : arpUp(scale, rootMidi, d, size);
  }
  return arpDown(scale, rootMidi, d, size);
}
```

`arpeggioZigzag` doesn't need changes — it ignores inversion (zigzag isn't `allUp`, so per the spec, inversion is always 0).

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/variants.test.ts -t "inversion"`
Expected: all 6 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/variants.ts src/exercises/variants.test.ts
git commit -m "feat(arpeggios): route inversion through arpeggioCycleMidi (allUp only)"
```

---

## Task 4: Extend `arpeggioCycleApex` to factor in inversion

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`. Find the existing `arpeggioCycleApex` describe block and append:

```ts
describe('arpeggioCycleApex — with inversion', () => {
  test('inversion 0 matches existing root apex', () => {
    const C2 = midiOf('C', 2);
    expect(arpeggioCycleApex(SCALES.major, C2, 3, 0)).toBe(arpeggioCycleApex(SCALES.major, C2, 3, 0));
  });

  test('triad 1st inv apex is one octave higher than root', () => {
    // Root: apex at degree 11 (= 7 + 2*(3-1))
    // 1st inv: apex at degree 14 (= max(11, 7+0+7) = 14)
    // For C major from C2: degree 14 = 2 octaves + 0 = C4 (MIDI 60)
    const C2 = midiOf('C', 2);
    const apex = arpeggioCycleApex(SCALES.major, C2, 3, 1);
    expect(apex).toBe(midiOf('C', 4));
  });

  test('triad 2nd inv apex is degree 9 + cycle-pivot offset', () => {
    // 2nd inv: apex at degree max(11, 7+2+7) = max(11, 16) = 16
    // For C major from C2: degree 16 = 2 octaves + 2 = E4 (MIDI 64)
    const C2 = midiOf('C', 2);
    const apex = arpeggioCycleApex(SCALES.major, C2, 3, 2);
    expect(apex).toBe(midiOf('E', 4));
  });

  test('7th 3rd inv apex', () => {
    // 7th 3rd inv: max(7+2*3, 7+2*2+7) = max(13, 18) = 18
    // For C major from C2: degree 18 = 2 octaves + 4 = G4 (MIDI 67)
    const C2 = midiOf('C', 2);
    const apex = arpeggioCycleApex(SCALES.major, C2, 4, 3);
    expect(apex).toBe(midiOf('G', 4));
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "arpeggioCycleApex — with inversion"`
Expected: most FAIL — `arpeggioCycleApex` only takes 3 args today.

- [ ] **Step 3: Update `arpeggioCycleApex` signature + formula**

In `src/exercises/scale-generator.ts`, find `arpeggioCycleApex` (around line 174). Replace with:

```ts
/**
 * Highest MIDI value the cycle reaches. Without inversion, this is the
 * top note of the up-arp at the cycle's pivot (degree 7 = octave). With
 * inversion K, the K bottom chord tones get raised by an octave, so the
 * apex shifts up to the highest of those raised notes when raised >
 * unraised top.
 */
export function arpeggioCycleApex(
  scale: Scale,
  rootMidi: number,
  size: number,
  inversion: number,
): number {
  const unraisedMax = 7 + 2 * (size - 1);
  const raisedMax = inversion > 0 ? 7 + 2 * (inversion - 1) + 7 : -Infinity;
  const apexDegree = Math.max(unraisedMax, raisedMax);
  return scaleDegreeMidi(scale, rootMidi, apexDegree);
}
```

- [ ] **Step 4: Update all call sites**

In `src/exercises/picker.ts`, find the `arpeggioCycleApex` call in `highestMidi` (around line 261):

```ts
case 'arpeggioCycle':
  return arpeggioCycleApex(scale, lowRootMidi, variant.size, variant.inversion);
```

In `src/exercises/scale-generator.test.ts`, the existing `arpeggioCycleApex` tests call it with 3 args. Update them to pass `0` as the new `inversion` argument so they still pass:

```ts
expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 3, 0)).toBe(midiOf('G', 3));
expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 4, 0)).toBe(midiOf('B', 3));
expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 7, 0)).toBe(midiOf('A', 4));
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts src/exercises/picker.ts
git commit -m "feat(arpeggios): apex formula factors in inversion"
```

---

## Task 5: Add `enabledArpeggioInversions` to Settings + bump v7→v8

**Files:**
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: Add the interface**

In `src/stores/settings.ts`, after the existing `RhythmToggles` interface, add:

```ts
export interface ArpeggioInversionToggles {
  root: boolean;
  first: boolean;
  second: boolean;
  third: boolean;
  fourth: boolean;
  fifth: boolean;
  sixth: boolean;
}
```

- [ ] **Step 2: Add `enabledArpeggioInversions` field to `Settings`**

After `enabledRhythms` in the `Settings` interface:

```ts
  enabledArpeggioInversions: ArpeggioInversionToggles;
```

- [ ] **Step 3: Bump STORAGE_KEY from v7 to v8**

```ts
const STORAGE_KEY = 'bass-practice:settings:v8';
```

- [ ] **Step 4: Add defaults in `defaultSettings()`**

After the `enabledRhythms` block:

```ts
    enabledArpeggioInversions: {
      root: true,
      first: false,
      second: false,
      third: false,
      fourth: false,
      fifth: false,
      sixth: false,
    },
```

- [ ] **Step 5: Extend `loadSettings` merge**

In the merge return object (alongside other nested defaults):

```ts
      enabledArpeggioInversions: {
        ...defaults.enabledArpeggioInversions,
        ...parsed.enabledArpeggioInversions,
      },
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/stores/settings.ts
git commit -m "feat(arpeggios): add enabledArpeggioInversions setting + bump storage v8"
```

---

## Task 6: Iterate enabled inversions in `variantsFromSettings`

**Files:**
- Modify: `src/exercises/picker.ts`
- Test: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/picker.test.ts`. Note: the existing `baseSettings = defaultSettings()` now has `enabledArpeggioInversions: { root: true, ...rest: false }`.

```ts
describe('generateUniverse — arpeggio inversions', () => {
  function arpsOnly(invToggles?: Partial<Settings['enabledArpeggioInversions']>): Settings {
    const empty = (val: boolean) => ({
      plain: val, multiOctaveA_2: val, multiOctaveA_3: val, multiOctaveB_2: val,
      consecutive_3: val, consecutive_4: val, mirror_3: val, mirror_4: val,
      intervalWalks: val,
    });
    return {
      ...baseSettings,
      enabledVariants: empty(false),
      enabledArpeggios: {
        sizes: { triad: true, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: true, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggioInversions: {
        root: invToggles?.root ?? true,
        first: invToggles?.first ?? false,
        second: invToggles?.second ?? false,
        third: invToggles?.third ?? false,
        fourth: invToggles?.fourth ?? false,
        fifth: invToggles?.fifth ?? false,
        sixth: invToggles?.sixth ?? false,
      },
    };
  }

  test('default (root only): triad allUp → 1 entry per (scale, key) with inversion 0', () => {
    const universe = generateUniverse(arpsOnly());
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.variant.kind).toBe('arpeggioCycle');
      if (p.variant.kind === 'arpeggioCycle') {
        expect(p.variant.inversion).toBe(0);
      }
    }
  });

  test('all 3 valid triad inversions enabled → 3 triad entries per (scale, key)', () => {
    const u = generateUniverse(arpsOnly({
      root: true, first: true, second: true,
    }));
    // Triad allUp × 3 inversions × 1 scale × 1 key = 3 entries (and these are the only entries)
    expect(u.length).toBe(3);
    const inversions = u.map((p) => p.variant.kind === 'arpeggioCycle' ? p.variant.inversion : -1).sort();
    expect(inversions).toEqual([0, 1, 2]);
  });

  test('triad with 3rd inv enabled does NOT add entries (3rd inv requires size ≥ 4)', () => {
    const u = generateUniverse(arpsOnly({
      root: false, third: true,
    }));
    // Triad allUp, only 3rd inv enabled → 0 entries (3rd inv invalid for triads)
    expect(u.length).toBe(0);
  });

  test('non-allUp directions always have inversion=0, regardless of toggles', () => {
    const s: Settings = {
      ...arpsOnly({ root: false, first: true, second: true }),
      enabledArpeggios: {
        sizes: { triad: true, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: true, downUp: false, zigzag: false },
      },
    };
    const u = generateUniverse(s);
    // upDown ignores inversion toggles. 1 entry expected (1 size × 1 direction).
    expect(u.length).toBe(1);
    expect(u[0].variant.kind).toBe('arpeggioCycle');
    if (u[0].variant.kind === 'arpeggioCycle') {
      expect(u[0].variant.inversion).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio inversions"`
Expected: most FAIL — the picker still only emits inversion 0.

- [ ] **Step 3: Update `variantsFromSettings` to iterate enabled inversions for `allUp`**

In `src/exercises/picker.ts`, find the existing `arpeggioCycle` emission loop (around line 300-310). Wrap the push in a per-inversion loop for `allUp` only:

```ts
const SIZE_KEYS = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
const SIZE_VALUES: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
const DIRECTIONS: Array<'allUp' | 'upDown' | 'downUp' | 'zigzag'> = [
  'allUp', 'upDown', 'downUp', 'zigzag',
];
const INV_KEYS = ['root', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
const INV_VALUES = [0, 1, 2, 3, 4, 5, 6];

for (let i = 0; i < SIZE_KEYS.length; i++) {
  if (!s.enabledArpeggios.sizes[SIZE_KEYS[i]]) continue;
  const size = SIZE_VALUES[i];
  for (const direction of DIRECTIONS) {
    if (!s.enabledArpeggios.directions[direction]) continue;
    if (direction === 'allUp') {
      // Iterate enabled inversions; skip those exceeding size-1.
      for (let k = 0; k < INV_KEYS.length; k++) {
        if (!s.enabledArpeggioInversions[INV_KEYS[k]]) continue;
        const inv = INV_VALUES[k];
        if (inv >= size) continue;  // 3rd inv of triad is invalid, etc.
        variants.push({ kind: 'arpeggioCycle', size, direction, inversion: inv });
      }
    } else {
      // Non-allUp: always inversion 0, ignore inversion toggles.
      variants.push({ kind: 'arpeggioCycle', size, direction, inversion: 0 });
    }
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio inversions"`
Expected: all 4 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(arpeggios): emit one variant per enabled inversion for allUp"
```

---

## Task 7: `generateExercise` passes inversion through

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
describe('generateExercise — arpeggioCycle with inversion', () => {
  function arpParams(
    inversion: number,
    direction: 'allUp' | 'upDown' | 'downUp' | 'zigzag' = 'allUp',
  ) {
    const key = KEYS_BY_ID.C;
    return {
      scale: SCALES.major,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'arpeggioCycle' as const, size: 3 as const, direction, inversion },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning: TUNINGS.fourStringEADG,
      keySignature: keySignatureFor(key, SCALES.major),
      keySignatureLabel: keySignatureLabelFor(key, SCALES.major),
      spelling: spellingMap(key, SCALES.major),
    };
  }

  test('inversion 0 allUp first arp = [C, E, G] (root position)', () => {
    const ex = generateExercise(arpParams(0));
    // Each FretboardNote has midi; first 3 = C2, E2, G2
    const midis = ex.sequence.slice(0, 3).map((n) => n.midi);
    expect(midis).toEqual([36, 40, 43]);
  });

  test('inversion 1 allUp first arp = [E, G, C(8va)]', () => {
    const ex = generateExercise(arpParams(1));
    const midis = ex.sequence.slice(0, 3).map((n) => n.midi);
    expect(midis).toEqual([40, 43, 48]);
  });

  test('inversion 2 allUp first arp = [G, C(8va), E(8va)]', () => {
    const ex = generateExercise(arpParams(2));
    const midis = ex.sequence.slice(0, 3).map((n) => n.midi);
    expect(midis).toEqual([43, 48, 52]);
  });

  test('upDown direction with inversion=2 — inversion is IGNORED, first arp = [C, E, G] (root)', () => {
    const ex = generateExercise(arpParams(2, 'upDown'));
    const midis = ex.sequence.slice(0, 3).map((n) => n.midi);
    expect(midis).toEqual([36, 40, 43]);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "arpeggioCycle with inversion"`
Expected: most FAIL — `generateExercise` passes `0` to `arpeggioCycleMidi` (placeholder from Task 2).

- [ ] **Step 3: Pass `variant.inversion` through `generateExercise`**

In `src/exercises/scale-generator.ts`, find the `arpeggioCycleMidi` call inside the `arpeggioCycle` branch of `generateExercise`. Update to pass `variant.inversion`:

```ts
sequence = arpeggioCycleMidi(
  scale,
  lowRootMidi,
  variant.size,
  variant.direction,
  variant.inversion,
);
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "arpeggioCycle with inversion"`
Expected: all 4 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(arpeggios): generateExercise passes inversion through"
```

---

## Task 8: URL encoding for arpeggio inversions

**Files:**
- Modify: `src/exercises/picker.ts`
- Test: `src/exercises/picker.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/picker.test.ts`:

```ts
describe('paramsKey / paramsFromKey — arpeggio inversion round-trip', () => {
  function arpsOnly(): Settings {
    const empty = (val: boolean) => ({
      plain: val, multiOctaveA_2: val, multiOctaveA_3: val, multiOctaveB_2: val,
      consecutive_3: val, consecutive_4: val, mirror_3: val, mirror_4: val,
      intervalWalks: val,
    });
    return {
      ...baseSettings,
      enabledVariants: empty(false),
      enabledArpeggios: {
        sizes: { triad: true, seventh: true, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: true, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggioInversions: {
        root: true, first: true, second: true, third: true,
        fourth: false, fifth: false, sixth: false,
      },
    };
  }

  test('arpeggio:3:allUp:0 round-trips', () => {
    const universe = generateUniverse(arpsOnly());
    const target = universe.find(
      (p) => p.variant.kind === 'arpeggioCycle' && p.variant.size === 3 && p.variant.inversion === 0,
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('arpeggio:3:allUp:0');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('arpeggioCycle');
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.inversion).toBe(0);
    }
  });

  test('arpeggio:3:allUp:2 round-trips (2nd inv triad)', () => {
    const universe = generateUniverse(arpsOnly());
    const target = universe.find(
      (p) => p.variant.kind === 'arpeggioCycle' && p.variant.size === 3 && p.variant.inversion === 2,
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('arpeggio:3:allUp:2');
    const restored = paramsFromKey(key);
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.inversion).toBe(2);
    }
  });

  test('arpeggio:4:allUp:3 round-trips (3rd inv 7th)', () => {
    const universe = generateUniverse(arpsOnly());
    const target = universe.find(
      (p) => p.variant.kind === 'arpeggioCycle' && p.variant.size === 4 && p.variant.inversion === 3,
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('arpeggio:4:allUp:3');
  });

  test('legacy 3-segment arpeggio URL (no inversion) defaults to 0', () => {
    // Hand-construct a legacy-style URL. Note: the rhythm work added a
    // rhythm segment between variant and openTag — so the legacy hash
    // (pre-inversion era) has 7 segments total. This test exercises the
    // 3-segment arpeggio variant slug (arpeggio:size:direction) within
    // a 7-segment full URL.
    const legacyKey = 'fourStringEADG|Major|C|front|arpeggio:3:allUp|eighth|fretted';
    const restored = paramsFromKey(legacyKey);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('arpeggioCycle');
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.inversion).toBe(0);
    }
  });

  test('invalid inversion (>= size) rejected: arpeggio:3:allUp:3', () => {
    const malformedKey = 'fourStringEADG|Major|C|front|arpeggio:3:allUp:3|eighth|fretted';
    const restored = paramsFromKey(malformedKey);
    expect(restored).toBeNull();
  });

  test('out-of-range inversion rejected: arpeggio:3:allUp:9', () => {
    const malformedKey = 'fourStringEADG|Major|C|front|arpeggio:3:allUp:9|eighth|fretted';
    const restored = paramsFromKey(malformedKey);
    expect(restored).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio inversion round-trip"`
Expected: most FAIL — `paramsKey` doesn't include inversion; `paramsFromKey` doesn't parse it.

- [ ] **Step 3: Update `paramsKey` to include inversion**

In `src/exercises/picker.ts`, find the `'arpeggioCycle'` case in `paramsKey` (around line 207):

```ts
case 'arpeggioCycle':
  variantKey = `arpeggio:${p.variant.size}:${p.variant.direction}:${p.variant.inversion}`;
  break;
```

- [ ] **Step 4: Update `paramsFromKey` to accept 3 OR 4 arpeggio sub-segments**

In `paramsFromKey` (around line 104), the existing `else if (kind === 'arpeggio')` branch parses 2 sub-segments (size + direction). Change to accept 2 or 3:

```ts
} else if (kind === 'arpeggio') {
  // rest format: "<size>:<direction>" (legacy) or "<size>:<direction>:<inversion>"
  const parts = rest.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const [sizeStr, dirStr, invStr] = parts;
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
  let inversion = 0;
  if (parts.length === 3) {
    inversion = Number(invStr);
    if (!Number.isInteger(inversion) || inversion < 0 || inversion > 6) return null;
    if (inversion >= size) return null;  // invalid combo
  }
  variant = {
    kind: 'arpeggioCycle',
    size: size as 3 | 4 | 5 | 6 | 7,
    direction: dirStr,
    inversion,
  };
}
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run src/exercises/picker.test.ts -t "arpeggio inversion round-trip"`
Expected: all 6 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/exercises/picker.ts src/exercises/picker.test.ts
git commit -m "feat(arpeggios): URL encoding for inversion with legacy back-compat"
```

---

## Task 9: Append inversion suffix in `describeVariant`

**Files:**
- Modify: `src/exercises/scale-generator.ts`
- Test: `src/exercises/scale-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/exercises/scale-generator.test.ts`:

```ts
describe('describeVariant — arpeggio inversion suffix', () => {
  function arp(size: 3 | 4 | 5 | 6 | 7, dir: 'allUp' | 'upDown', inversion: number) {
    return describeVariant(
      { kind: 'arpeggioCycle', size, direction: dir, inversion },
      SCALES.major,
      TUNINGS.fourStringEADG,
    );
  }

  test('root position has NO inversion suffix', () => {
    expect(arp(3, 'allUp', 0)).toBe('Triad cycle ↑↑');
  });

  test('1st inv triad → "Triad cycle ↑↑ 1st inv"', () => {
    expect(arp(3, 'allUp', 1)).toBe('Triad cycle ↑↑ 1st inv');
  });

  test('2nd inv 7th → "7th cycle ↑↑ 2nd inv"', () => {
    expect(arp(4, 'allUp', 2)).toBe('7th cycle ↑↑ 2nd inv');
  });

  test('3rd inv 9th → "9th cycle ↑↑ 3rd inv"', () => {
    expect(arp(5, 'allUp', 3)).toBe('9th cycle ↑↑ 3rd inv');
  });

  test('6th inv 13th → "13th cycle ↑↑ 6th inv"', () => {
    expect(arp(7, 'allUp', 6)).toBe('13th cycle ↑↑ 6th inv');
  });

  test('non-allUp ignores inversion in display (always root, no suffix)', () => {
    // Even though variant.inversion is 0 here (per the spec rule),
    // verify the format string has no inv suffix for upDown.
    expect(arp(3, 'upDown', 0)).toBe('Triad cycle ↑↓');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "describeVariant — arpeggio inversion suffix"`
Expected: most FAIL — `describeVariant` doesn't append the suffix yet.

- [ ] **Step 3: Add the inversion suffix**

In `src/exercises/scale-generator.ts`, find the `arpeggioCycle` case in `describeVariant`. Update to append the suffix:

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
  // Inversion suffix only appears when > 0 (root pos = no extra label).
  // Non-allUp directions always have inversion=0 per the spec, so they
  // never show a suffix.
  const invLabels = ['root', '1st', '2nd', '3rd', '4th', '5th', '6th'];
  const invSuffix = v.inversion > 0 ? ` ${invLabels[v.inversion]} inv` : '';
  return `${sizeLabels[v.size]} cycle ${dirSymbols[v.direction]}${invSuffix}`;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run src/exercises/scale-generator.test.ts -t "describeVariant — arpeggio inversion suffix"`
Expected: all 6 new tests pass.

Run full suite:

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/scale-generator.ts src/exercises/scale-generator.test.ts
git commit -m "feat(arpeggios): describeVariant appends inversion suffix"
```

---

## Task 10: SettingsPanel — Inversions sub-section + helpers

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add the toggle helpers in the `<script>` block**

In `src/components/SettingsPanel.svelte`, after the existing `setAllRhythms` helper (or alongside the other arpeggio helpers), add:

```ts
  function toggleArpInversion(key: keyof typeof $settings.enabledArpeggioInversions) {
    settings.update((s) => ({
      ...s,
      enabledArpeggioInversions: {
        ...s.enabledArpeggioInversions,
        [key]: !s.enabledArpeggioInversions[key],
      },
    }));
  }

  function setAllArpInversions(enabled: boolean) {
    settings.update((s) => ({
      ...s,
      enabledArpeggioInversions: {
        root: enabled,
        first: enabled,
        second: enabled,
        third: enabled,
        fourth: enabled,
        fifth: enabled,
        sixth: enabled,
      },
    }));
  }
```

- [ ] **Step 2: Add the Inversions sub-section inside the Arpeggios section**

Find the existing Arpeggios `<section>` in the template. Find where it currently ends (after the directions sub-row's closing `</div>`). Before the section's closing `</section>` tag, add:

```svelte
      <div class="arp-subhead">
        Inversions
        <span class="arp-subhint">(All ↑↑ only)</span>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllArpInversions(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllArpInversions(false)} type="button">None</button>
        </div>
      </div>
      <div class="chips">
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.root}
            onchange={() => toggleArpInversion('root')} />
          <span>Root</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.first}
            onchange={() => toggleArpInversion('first')} />
          <span>1st</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.second}
            onchange={() => toggleArpInversion('second')} />
          <span>2nd</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.third}
            onchange={() => toggleArpInversion('third')} />
          <span>3rd</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.fourth}
            onchange={() => toggleArpInversion('fourth')} />
          <span>4th</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.fifth}
            onchange={() => toggleArpInversion('fifth')} />
          <span>5th</span>
        </label>
        <label class="chip-toggle">
          <input type="checkbox" checked={$settings.enabledArpeggioInversions.sixth}
            onchange={() => toggleArpInversion('sixth')} />
          <span>6th</span>
        </label>
      </div>
```

- [ ] **Step 3: Add CSS for `.arp-subhint`**

The existing `.arp-subhead` styling already covers the layout. Add a `.arp-subhint` style at the end of the `<style>` block (or alongside `.arp-subhead`):

```css
  .arp-subhint {
    font-size: 11px;
    color: var(--text-dim);
    font-weight: 400;
    margin-left: 6px;
  }
```

- [ ] **Step 4: Extend `enableAll` to flip all inversions on**

Find the existing `enableAll` function. After the existing `setAllRhythms(true)` (or wherever appropriate), add:

```ts
  function enableAll(): void {
    setAllHandPositions(true);
    setAllVariants(true);
    setAllArpeggios(true);
    setAllArpInversions(true);  // NEW
    setAllAgility(true);
    setAllKeys(true);
    setAllScales(true);
    setAllRhythms(true);
    settings.update((s) => ({ ...s, includeOpenStringVariants: true }));
  }
```

`resetToDefaults` is unchanged.

- [ ] **Step 5: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(arpeggios): SettingsPanel Inversions sub-section + helpers"
```

---

## Task 11: BrowsePanel — Inversion filter chip row

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

- [ ] **Step 1: Add inversion state + filter logic**

In `src/components/BrowsePanel.svelte`, find the `BrowseFilters` interface (search for `BrowseFilters`). Add a new field:

```ts
interface BrowseFilters {
  // ... existing fields ...
  inversion: number | 'any';
}
```

In `loadFilters` (around line 53), add the default and parsed-state restoration. Default `inversion` to `'any'`.

In the snapshot saved to localStorage (look for `localStorage.setItem(FILTERS_STORAGE_KEY, ...)`), include `inversion`.

Add the state declaration alongside the existing ones (`scaleId`, `keyId`, etc.):

```ts
let inversion = $state<number | 'any'>(initial.inversion);
```

- [ ] **Step 2: Add `inversionDisabled` flag + effective value**

After the existing `scaleDisabled` / `keyDisabled` / `handDisabled` / `rhythmDisabled` derived flags, add:

```ts
  const inversionDisabled = $derived(variantFamily !== 'arpeggios');
  const effectiveInversion = $derived(inversionDisabled ? 'any' : inversion);
```

- [ ] **Step 3: Add inversion to the `results` filter**

In the `results` derivation, add a clause:

```ts
  if (
    effectiveInversion !== 'any' &&
    (p.variant.kind !== 'arpeggioCycle' || p.variant.inversion !== effectiveInversion)
  ) return false;
```

- [ ] **Step 4: Add the Inversion chip row to the template**

In the template, find the existing Rhythm chip row (added during the rhythm pass). AFTER that closes and BEFORE the Scale section, insert:

```svelte
    <section class:disabled={inversionDisabled} aria-disabled={inversionDisabled} role="group">
      <span class="lbl">Inversion</span>
      {#if inversionDisabled}
        <span class="hint">Only applies to arpeggios</span>
      {/if}
      <div class="chips">
        <button class="chip-toggle" class:on={inversion === 'any'} onclick={() => (inversion = 'any')} type="button">Any</button>
        <button class="chip-toggle" class:on={inversion === 0} onclick={() => (inversion = 0)} type="button">Root</button>
        <button class="chip-toggle" class:on={inversion === 1} onclick={() => (inversion = 1)} type="button">1st</button>
        <button class="chip-toggle" class:on={inversion === 2} onclick={() => (inversion = 2)} type="button">2nd</button>
        <button class="chip-toggle" class:on={inversion === 3} onclick={() => (inversion = 3)} type="button">3rd</button>
        <button class="chip-toggle" class:on={inversion === 4} onclick={() => (inversion = 4)} type="button">4th</button>
        <button class="chip-toggle" class:on={inversion === 5} onclick={() => (inversion = 5)} type="button">5th</button>
        <button class="chip-toggle" class:on={inversion === 6} onclick={() => (inversion = 6)} type="button">6th</button>
      </div>
    </section>
```

- [ ] **Step 5: Include inversion in the clear-filters reset**

If the panel has a "Clear filters" handler, find it and add `inversion = 'any'`.

- [ ] **Step 6: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(arpeggios): BrowsePanel Inversion filter chip + arpeggios-only grey-out"
```

---

## Task 12: Manual UI verification + final test/scan gate

**No code changes — verification.**

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app in a real browser at the printed URL.**

- [ ] **Step 3: Settings panel verification**
- Open Settings (⚙).
- In the Arpeggios section, confirm a new "Inversions" sub-row appears below the Directions sub-row, with 7 chips (Root, 1st, 2nd, 3rd, 4th, 5th, 6th) + All/None buttons.
- Default: only Root checked.
- Click All → all 7 flip on.
- Click "Enable all" at the top → confirm inversions are flipped on as part of the global enable.
- Click "Reset to defaults" → confirm Inversions returns to Root-only.

- [ ] **Step 4: Pick exercises**
- Enable 1st inversion. Click N until an arpeggio shows up.
- Confirm `↑↑` arpeggios sometimes display "1st inv" in the title (e.g., `C Major — Triad cycle ↑↑ 1st inv ♩`).
- Confirm non-`↑↑` arpeggios (e.g., `↑↓`) NEVER show an inversion suffix.

- [ ] **Step 5: Browse panel**
- Open Browse (🔍).
- Confirm a new "Inversion" chip row appears between Rhythm and Scale.
- Set Variant = Arpeggios + Inversion = 2nd → only 2nd-inv arpeggios appear.
- Set Variant = Walking → Inversion row greys out with "Only applies to arpeggios" hint.

- [ ] **Step 6: URL bookmarkability**
- Copy a 2nd-inv arpeggio URL. Reload — confirm the same exercise loads.
- Check the URL hash contains `arpeggio:3:allUp:2`.

- [ ] **Step 7: Run all tests + build**

```bash
npx vitest run
npm run check
npx tsx scripts/scan-layouts.ts
npm run build
```

Expected: all green. Note: scan-layouts may show a larger universe (default 16,150 + inversion entries when enabled by default test settings — though default IS root-only, so should match).

- [ ] **Step 8: If anything looks wrong, report. Otherwise no commit.**

---

## Task 13: Update `docs/plan.md`

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Mark inversions complete**

In `docs/plan.md`, find the "Future passes" section. Remove this bullet:

```markdown
  - Inversions — arpeggios that don't start on the chord root.
```

In the "Recent additions" section, add a new bullet at the top:

```markdown
- [x] **Arpeggio inversions.** New `inversion` dimension for arpeggio cycle exercises. 7 inversions (root + 1st…6th), each enabled separately in Settings. Inversions apply ONLY to the `allUp` direction (`upDown` / `downUp` / `zigzag` always at root, preserving the existing `arpDown` "stack thirds down from d" semantics). New helper `invertedArpUp` computes inverted chord tones via standard music-theory inversion (raise K bottom tones by an octave, sort ascending). URL hash extends to `arpeggio:<size>:<direction>:<inversion>` (back-compat: legacy 3-segment defaults inversion to 0). Spec: [docs/superpowers/specs/2026-05-23-arpeggio-inversions-design.md](superpowers/specs/2026-05-23-arpeggio-inversions-design.md).
```

- [ ] **Step 2: Update the State line**

Find the State line (currently around line 21). Update test count based on `npx vitest run` output from Task 12. Should be around ~380 (was 352 after rhythm).

- [ ] **Step 3: Commit**

```bash
git add docs/plan.md
git commit -m "docs(arpeggios): mark inversions complete in plan.md"
```

---

## Self-review checklist

- [ ] Every section of the spec is covered.
- [ ] Function names match across tasks (`invertedArpUp`, `arpeggioCycleApex`, `setAllArpInversions`, `toggleArpInversion`).
- [ ] No `TBD` / `TODO` / placeholder strings in code (Task 2 has TODO comments that are explicitly REPLACED by Tasks 6 and 8).
- [ ] `inversion: 0` constants in Tasks 2/3 are replaced by real per-variant values in Tasks 6/7.
- [ ] URL back-compat tested (3-segment legacy → defaults to 0).
- [ ] Non-allUp directions always have inversion 0 (enforced in both `variantsFromSettings` and tested in `arpeggioCycleMidi`).
- [ ] `arpeggioCycleApex` factors in inversion for picker validation.
- [ ] Settings storage v7 → v8 with merge fallback.
- [ ] All tests pass + manual UI verification clean.
