# Arpeggio inversions — design

**Date:** 2026-05-23
**Status:** Approved, ready for plan

## Goal

Add **inversion** as a new dimension for arpeggio cycle exercises. Each enabled inversion (root, 1st, 2nd, … 6th) generates a separate set of `allUp` variants — the same chord cycle but with a different chord tone on the bottom. Inversions ONLY apply to the `allUp` direction; `upDown` / `downUp` / `zigzag` always stay at root position (preserves the existing `arpDown` "stack thirds down from d" semantics).

## What's an inversion

The K-th inversion of an N-note chord puts the (K+1)-th chord tone on the bottom. The K notes that were originally below get raised by an octave so they sit ABOVE the new bottom.

C major triad chord tones: `{C, E, G}`.
- Root position: `[C, E, G]`
- 1st inversion: `[E, G, C(8va)]`
- 2nd inversion: `[G, C(8va), E(8va)]`

Same pitch classes, different octave placement, different starting note.

In scale-degree terms, the inverted chord tones are:
```
for pos in 0..N-1:
  degree = d + 2*pos + (pos < K ? 7 : 0)
sort ascending
```

Examples (in C major, `d = 0`):

| Chord    | K | Computation                            | Sorted degrees | Notes              |
|----------|---|----------------------------------------|----------------|---------------------|
| Triad    | 0 | [0, 2, 4]                              | [0, 2, 4]      | C, E, G            |
| Triad    | 1 | [7, 2, 4]                              | [2, 4, 7]      | E, G, C(8va)       |
| Triad    | 2 | [7, 9, 4]                              | [4, 7, 9]      | G, C(8va), E(8va)  |
| 7th      | 1 | [7, 2, 4, 6]                           | [2, 4, 6, 7]   | E, G, B, C(8va)    |
| 7th      | 3 | [7, 9, 11, 6]                          | [6, 7, 9, 11]  | B, C(8va), E(8va), G(8va) |
| 9th      | 3 | [7, 9, 11, 6, 8]                       | [6, 7, 8, 9, 11] | B, C(8va), D(8va), E(8va), G(8va) |

## Scope

### In scope

- New `inversion` field on `arpeggioCycle` variant kind. Valid range: `0..6`. Constraint: `inversion < size`.
- Inversions only apply to direction `allUp`. For other directions, `inversion` is always `0`.
- New `enabledArpeggioInversions` Settings toggles (7 booleans: root + 1st..6th).
- Defaults: root position ON; others OFF (preserves current behavior).
- Each enabled inversion generates `allUp` variants for all valid chord sizes (size ≥ inversion + 1).
- New helper `invertedArpUp(scale, rootMidi, d, size, inversion)` replaces the existing `arpUp` call inside the allUp path of `arpeggioCycleMidi` when inversion > 0. For inversion = 0 it produces identical output to today.
- Apex calculation extended to factor in inversion (inverted arps reach higher).
- URL encoding: `arpeggio:<size>:<direction>:<inversion>` (3 → 4 segments). Back-compat: 3-segment legacy URLs default inversion to 0.
- Display name appends `" 1st inv"` / `" 2nd inv"` / ... after the direction. Omitted for root.
- BrowsePanel gets an Inversion filter chip row (Any / Root / 1st / 2nd / 3rd / 4th / 5th / 6th).
- Storage version v7 → v8.

### Out of scope (deferred)

- Inversions for non-`allUp` directions (per user choice — preserves existing `arpDown` semantics).
- Per-size inversion toggles (single shared group is simpler).
- Specifying which scale degrees to root the cycle on (always cycles 1→8).
- Drop-2 / drop-3 voicings (different concept; could be future).
- Spread voicings.

## Data model

### `Variant` (in `src/exercises/types.ts`)

Extend the `arpeggioCycle` variant:

```ts
| { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection; inversion: number };
```

`inversion: number` is required. Range `0..6`. The picker enforces `inversion < size`.

### Settings (`src/stores/settings.ts`)

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

Add `enabledArpeggioInversions: ArpeggioInversionToggles` to `Settings`. Defaults: `root: true`, all others `false`. Bumps storage v7 → v8.

### URL encoding

`paramsKey` arpeggio variant segment grows from `arpeggio:<size>:<direction>` to `arpeggio:<size>:<direction>:<inversion>`:

- `arpeggio:3:allUp:0` (root, current default)
- `arpeggio:3:allUp:1` (1st inv triad)
- `arpeggio:7:allUp:6` (6th inv 13th)
- `arpeggio:3:upDown:0` (non-allUp — inversion always 0)

`paramsFromKey` accepts both forms:
- 3-segment (legacy): defaults inversion to `0`.
- 4-segment (new): parses inversion as integer, validates `0 ≤ inversion ≤ 6` and `inversion < size`. Invalid → return null.

## Sequence generation

### New `invertedArpUp` helper (in `src/exercises/variants.ts`)

```ts
/**
 * Build one arpeggio of `size` notes for the chord rooted at scale
 * degree `d`, voiced in `inversion` (0 = root pos; K = K-th inversion).
 * For inversion K, the K chord tones below the new bass get raised an
 * octave so they sit above. Notes returned in pitch-ascending order.
 *
 * Equivalent to existing `arpUp` when inversion = 0.
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

### `arpeggioCycleMidi` integration

Add an `inversion: number` parameter to `arpeggioCycleMidi`. Default to 0 for back-compat.

For `direction === 'allUp'` (the only direction that uses inversions), call `invertedArpUp(scale, rootMidi, d, size, inversion)` instead of `arpUp(scale, rootMidi, d, size)` for each arp in the cycle.

For other directions (`upDown` / `downUp` / `zigzag`), ignore the `inversion` parameter — use existing `arpUp` and `arpDown` as today.

```ts
function arpeggioConsecutive(
  scale: Scale,
  rootMidi: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
  inversion: number,
): number[] {
  // ...
  for (let d = 0; d <= 7; d++) {
    if (direction === 'allUp') {
      out.push(...invertedArpUp(scale, rootMidi, d, size, inversion));
    } else if (direction === 'upDown') {
      out.push(...arpUp(scale, rootMidi, d, size));  // asc half: up at root
    } else if (direction === 'downUp') {
      out.push(...arpDown(scale, rootMidi, d, size));  // asc half: down at root
    }
  }
  for (let d = 7; d >= 0; d--) {
    if (direction === 'allUp') {
      out.push(...invertedArpUp(scale, rootMidi, d, size, inversion));
    } else if (direction === 'upDown') {
      out.push(...arpDown(scale, rootMidi, d, size));  // desc half: down at root
    } else if (direction === 'downUp') {
      out.push(...arpUp(scale, rootMidi, d, size));  // desc half: up at root
    }
  }
}
```

Zigzag also takes the `inversion` parameter but only applies it on up-arpeggio slots (which become `invertedArpUp` calls); down-arpeggio slots use existing `arpDown` at root. **Wait** — zigzag direction is NOT `allUp`, so per the rule above, inversion is always 0 for zigzag. Simplify: zigzag passes inversion=0 to its arpUp slots too. Effectively the inversion parameter only matters when direction === 'allUp'.

### `generateExercise` dispatch

In `src/exercises/scale-generator.ts`, the `arpeggioCycleMidi` call gains the inversion argument:

```ts
sequence = arpeggioCycleMidi(
  scale,
  lowRootMidi,
  variant.size,
  variant.direction,
  variant.inversion,  // NEW
);
```

### Apex calculation

`arpeggioCycleApex` in `src/exercises/scale-generator.ts` needs to account for inversion. New formula:

```ts
export function arpeggioCycleApex(
  scale: Scale,
  rootMidi: number,
  size: number,
  inversion: number,
): number {
  // The highest note in any arpeggio of the cycle is the highest note
  // of the arp rooted at degree 7 (the cycle's pivot at the top). With
  // inversion K, the highest note is max of:
  //   - unraised chord tones (positions K..size-1): max degree 7 + 2*(size-1)
  //   - raised chord tones (positions 0..K-1): max degree 7 + 2*(K-1) + 7
  const unraisedMax = 7 + 2 * (size - 1);
  const raisedMax = inversion > 0 ? 7 + 2 * (inversion - 1) + 7 : -Infinity;
  const apexDegree = Math.max(unraisedMax, raisedMax);
  return scaleDegreeMidi(scale, rootMidi, apexDegree);
}
```

Note: apex doesn't depend on direction. Even for `allUp` at any inversion, the topmost note across all 8 cycle steps is in the arp rooted at degree 7. For non-allUp directions where inversion is 0, the formula reduces to the existing one.

## Picker / universe

### `variantsFromSettings`

Replace the existing arpeggio variant emission. For each (size × direction) combination, also iterate enabled inversions:

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
      // Iterate enabled inversions; skip those that exceed size-1.
      for (let k = 0; k < INV_KEYS.length; k++) {
        if (!s.enabledArpeggioInversions[INV_KEYS[k]]) continue;
        const inv = INV_VALUES[k];
        if (inv >= size) continue;  // skip 3rd inv of triad, etc.
        variants.push({ kind: 'arpeggioCycle', size, direction, inversion: inv });
      }
    } else {
      // Non-allUp: always inversion 0, ignore inversion toggles.
      variants.push({ kind: 'arpeggioCycle', size, direction, inversion: 0 });
    }
  }
}
```

Universe size per (scale, key, tuning) with all inversion toggles enabled:
- `allUp`: sum over sizes of valid inversions = 3+3+3+4+5+6+7... wait let me redo.
  - size 3 (triad): inversions 0,1,2 (skip 3+) = 3
  - size 4 (7th): 0,1,2,3 = 4
  - size 5 (9th): 0,1,2,3,4 = 5
  - size 6 (11th): 0,1,2,3,4,5 = 6
  - size 7 (13th): 0,1,2,3,4,5,6 = 7
  - Total allUp: 3+4+5+6+7 = 25 entries
- Other 3 directions × 5 sizes = 15 entries
- Total: 40 entries per (scale, key, tuning). Current: 20. 2× increase.

Default (root only): 5 + 15 = 20 entries per (scale, key, tuning). Same as current.

### Apex validation

`generateUniverse` already calls `arpeggioCycleApex` to filter out combos whose apex exceeds fret 24. The new apex formula factors in inversion, so high-inversion-on-large-chords combos automatically get filtered when they don't fit. Expected: 13th 6th inv on 4-string EADG won't fit for most keys (apex around fret 30+); picker drops those.

## UI changes

### `SettingsPanel.svelte` — Inversions section

Add inside the existing Arpeggios `<section>`, after the directions row. The header reads "Inversions (allUp only)" with All/None buttons:

```svelte
<div class="arp-subhead">
  Inversions
  <span class="arp-subhint">(applied to All ↑↑ direction only)</span>
  <div class="bulk-section">
    <button class="bulk-section-btn" onclick={() => setAllArpInversions(true)} type="button">All</button>
    <button class="bulk-section-btn" onclick={() => setAllArpInversions(false)} type="button">None</button>
  </div>
</div>
<div class="chips">
  <label class="chip-toggle">
    <input type="checkbox" checked={$settings.enabledArpeggioInversions.root}
      onchange={() => toggleArpInversion('root')} />
    <span>Root position</span>
  </label>
  <label class="chip-toggle">
    <input type="checkbox" checked={$settings.enabledArpeggioInversions.first}
      onchange={() => toggleArpInversion('first')} />
    <span>1st</span>
  </label>
  <!-- ... 2nd through 6th ... -->
</div>
```

Helper functions:

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
      root: enabled, first: enabled, second: enabled, third: enabled,
      fourth: enabled, fifth: enabled, sixth: enabled,
    },
  }));
}
```

The `enableAll` global helper extends to call `setAllArpInversions(true)`. `resetToDefaults` is unchanged (it calls `defaultSettings()` which already returns the right inversion defaults).

### Display name

In `describeVariant` for `arpeggioCycle`, append the inversion label after the direction. Omit for root position:

```ts
case 'arpeggioCycle': {
  const sizeLabels: Record<3|4|5|6|7, string> = {
    3: 'Triad', 4: '7th', 5: '9th', 6: '11th', 7: '13th',
  };
  const dirSymbols: Record<'allUp'|'upDown'|'downUp'|'zigzag', string> = {
    allUp: '↑↑', upDown: '↑↓', downUp: '↓↑', zigzag: '↕',
  };
  const invSuffix = v.inversion > 0 ? ` ${ordinalInv(v.inversion)} inv` : '';
  return `${sizeLabels[v.size]} cycle ${dirSymbols[v.direction]}${invSuffix}`;
}

function ordinalInv(k: number): string {
  return ['root', '1st', '2nd', '3rd', '4th', '5th', '6th'][k] ?? `${k}th`;
}
```

(`ordinalInv` only used for `k > 0` so the `'root'` case is never returned; included for completeness.)

Example display names:
- `C Major — Triad cycle ↑↑ ♩` (root pos, unchanged from today)
- `C Major — Triad cycle ↑↑ 1st inv ♩`
- `C Major — 9th cycle ↑↑ 3rd inv ♫`
- `C Major — 13th cycle ↑↑ 6th inv (8ss)`
- `C Major — Triad cycle ↑↓ ♩` (non-allUp — always root, no suffix)

### `BrowsePanel.svelte` — Inversion filter

Add a new Inversion chip row between Rhythm and Scale (or wherever makes sense). Greys out when Variant filter is not `arpeggios`:

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

State + derived:

```ts
let inversion = $state<number | 'any'>(initial.inversion);
const inversionDisabled = $derived(variantFamily !== 'arpeggios');
const effectiveInversion = $derived(inversionDisabled ? 'any' : inversion);
```

In the results filter:

```ts
if (
  effectiveInversion !== 'any' &&
  (p.variant.kind !== 'arpeggioCycle' || p.variant.inversion !== effectiveInversion)
) return false;
```

The persisted `BrowseFilters` gets `inversion: number | 'any'`, default `'any'`. The clear-filters helper resets it.

## Testing

### Unit tests

**`src/exercises/variants.test.ts`** (additions):
- `invertedArpUp(cMaj, C2, 0, 3, 0)` returns `[C2, E2, G2]` (root, identical to existing `arpUp`).
- `invertedArpUp(cMaj, C2, 0, 3, 1)` returns `[E2, G2, C3]` (1st inv triad).
- `invertedArpUp(cMaj, C2, 0, 3, 2)` returns `[G2, C3, E3]` (2nd inv triad).
- `invertedArpUp(cMaj, C2, 0, 4, 3)` returns `[B2, C3, E3, G3]` (3rd inv 7th).
- `invertedArpUp(cMaj, C2, 0, 5, 3)` returns `[B2, C3, D3, E3, G3]` (3rd inv 9th — verifies sort produces correct order with mid-cycle wrap).
- Inversion 0 for any size = same as existing `arpUp`.

**`arpeggioCycleMidi` tests** (additions in same file):
- `arpeggioCycleMidi(cMaj, C2, 3, 'allUp', 1)` first arp = `[E2, G2, C3]`; cycle continues with 1st inv at each degree.
- `arpeggioCycleMidi(cMaj, C2, 3, 'upDown', 1)` IGNORES inversion (inversion only applies to allUp). Asserts that the result equals `arpeggioCycleMidi(cMaj, C2, 3, 'upDown', 0)` exactly.
- Same for `downUp` and `zigzag`.

**`src/exercises/scale-generator.test.ts`** (additions):
- `arpeggioCycleApex(cMaj, C2, 3, 0)` = existing apex (degree 11).
- `arpeggioCycleApex(cMaj, C2, 3, 1)` shifts up to degree 14 (since K=1 raises the K=1 lower notes by an octave).
- `generateExercise({ ..., variant: { kind: 'arpeggioCycle', size: 3, direction: 'allUp', inversion: 1 } })` returns an exercise whose first three notes spell out the 1st-inv triad.

**`src/exercises/picker.test.ts`** (additions):
- Default settings (root only): universe contains arpeggio entries with `inversion: 0` only; total arpeggio count unchanged from current.
- All inversion toggles enabled: allUp variants multiply by valid inversions (3+4+5+6+7 = 25 vs current 5 per (scale, key, tuning) for allUp).
- 3rd inversion triad is filtered out (inversion >= size).
- Non-allUp variants always have `inversion: 0` regardless of toggle state.
- URL round-trip: `arpeggio:3:allUp:1` parses back with inversion=1.
- URL legacy: `arpeggio:3:allUp` (3-segment) parses with inversion=0.

### Manual UI verification gate

1. Settings: new Inversions section appears inside Arpeggios; defaults are Root ON, others OFF; All/None work.
2. Enable 1st inversion. Pick exercises until an arpeggio shows up — those with `↑↑` direction should sometimes display "1st inv" in the name; others (`↑↓` / `↓↑` / `↕`) never show inversion.
3. Browse: new Inversion chip row; greys out when Variant filter isn't "Arpeggios."
4. URL hash round-trips with 4-segment arpeggio form.
5. Reset to defaults → Inversions returns to Root-only.

## Risks and known concerns

- **`describeVariant` line length.** Display names for 13ths 6th inversion at non-default rhythm get long: `"C Major — 13th cycle ↑↑ 6th inv (8ss) — Front ☝️"`. Should still fit comfortably on mobile (the existing display already wraps when needed).
- **High-inversion 13th arpeggios mostly won't fit on a 4-string EADG.** Apex of 13th 6th inv is degree 24 = ~41 semitones above the bass's lowest root. Picker filters these out automatically. Universe coverage is uneven across (size, inversion, key) combos for higher inversions — expected. Note in the spec that the Inversions filter chip will sometimes show 0 results.
- **`computePerBarClefs` was rewritten in the rhythm pass** and is unaffected by this change (inversion doesn't change note count or duration).
- **Storage v7 → v8 wipes user settings** — same convention as past bumps.
- **The `'root'` value in `ordinalInv` is unreachable** (only called for `k > 0` to produce the suffix); kept defensive in case the helper gets reused elsewhere.

## Implementation order

1. Add `invertedArpUp` helper in `src/exercises/variants.ts` + unit tests.
2. Add `inversion: number` field to `arpeggioCycle` variant in `src/exercises/types.ts`.
3. Update `arpeggioCycleMidi` to accept `inversion` parameter; route through `invertedArpUp` only for `allUp` direction.
4. Update `arpeggioCycleApex` formula to factor in inversion + tests.
5. Add `ArpeggioInversionToggles` + `enabledArpeggioInversions` to Settings; bump storage v7 → v8; update defaults + merge.
6. Update `variantsFromSettings` to iterate enabled inversions for `allUp` and skip invalid (inversion ≥ size) combos.
7. Update `generateExercise` dispatch to pass `variant.inversion` through.
8. Update `paramsKey` / `paramsFromKey` for 4-segment arpeggio URLs + back-compat fallback.
9. Update `describeVariant` to append inversion suffix.
10. SettingsPanel: add Inversions row + helpers + extend `enableAll`.
11. BrowsePanel: add Inversion filter chip row + filter logic + grey-out when Variant ≠ Arpeggios.
12. Final test suite + scan + build gate.
13. Update `docs/plan.md`.
