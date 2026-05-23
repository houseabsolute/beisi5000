# Rhythm variations — design

**Date:** 2026-05-22
**Status:** Approved, ready for plan

## Goal

Add **rhythm** as a new axis of variation for exercises. Each exercise gets one of 6 rhythms; the picker rotates through enabled rhythms alongside its existing axes (keys × scales × variants × etc.). Also: change the default rhythm from eighth notes to **quarter notes** (eighth notes becomes an opt-in variant). Agility drills (Big X / Spider) opt out of the rhythm dimension and always use eighth notes.

## The 6 rhythms

Each rhythm fills one quarter beat with a fixed pattern of slots. The exercise's note sequence is mapped onto these slots, repeating the pattern across beats indefinitely.

| Rhythm    | Notes/beat | Slot durations         | AlphaTex per slot | Default toggle |
|-----------|-----------|------------------------|-------------------|----------------|
| `quarter` | 1         | 4 (quarter)            | `:4`              | **ON**         |
| `eighth`  | 2         | 8, 8                   | `:8`              | OFF            |
| `triplet` | 3         | 8, 8, 8 + `{tu 3}`     | `:8 a{tu 3} b{tu 3} c{tu 3}` | OFF |
| `8ss`     | 3         | 8, 16, 16              | `:8 a :16 b c`    | OFF            |
| `s8s`     | 3         | 16, 8, 16              | `:16 a :8 b :16 c`| OFF            |
| `ss8`     | 3         | 16, 16, 8              | `:16 a b :8 c`    | OFF            |

The `8ss` / `s8s` / `ss8` names encode the slot pattern: `8` = eighth note, `s` = sixteenth note.

## Scope

### In scope

- Add `Rhythm` type + `rhythm` field on `ExerciseParams`.
- 6 rhythm choices; toggleable via Settings.
- Default: Quarter ON, others OFF.
- Picker iterates `(variant universe × enabled rhythms)` — universe entries multiply by N (N = enabled rhythm count).
- New `applyRhythm(sequence, rhythm)` helper assigns `durationDenominator` (and `tuplet` for triplets) per note based on slot position.
- AlphaTex emitter handles mixed per-note durations and triplet markers.
- Agility variants (`bigX`, `spider`) opt out — always emit eighth notes, no rhythm multiplication in the picker.
- Settings UI section "Rhythms" with 6 toggles + brief hint about agility opt-out.
- Display name shows a rhythm glyph (or label for mixed patterns).
- URL encoding includes rhythm segment.
- BrowsePanel gets a Rhythm filter chip row.
- Storage version v6 → v7.

### Out of scope

- Pure 16th-notes-per-beat rhythm (`ssss`).
- Other tuplets (5-tuplet, 7-tuplet, etc.).
- Swing / triplet-feel mode.
- Per-exercise rhythm overrides.
- "Rhythm-of-the-day" master selector (rhythm is per-exercise, not session-level).
- Tempo adjustments tied to rhythm (the metronome stays at the user's set BPM; triplets just play 3 notes per beat).
- Per-rhythm-pattern variation within an exercise (e.g., random alternation between 8ss and s8s within one exercise) — each exercise uses ONE pattern uniformly.

## Data model

### `Rhythm` type (in `src/exercises/types.ts`)

```ts
export type Rhythm = 'quarter' | 'eighth' | 'triplet' | '8ss' | 's8s' | 'ss8';
```

### `ExerciseParams` extension

Add `rhythm: Rhythm` to the interface. Required (every exercise has a rhythm).

For backward compatibility with URL hashes from older sessions, `paramsFromKey` falls back to `'eighth'` when the rhythm segment is missing (the historical default).

### `FretboardNote` extension

Add an optional `tuplet?: number` field:

```ts
export interface FretboardNote {
  string: number;
  fret: number;
  midi: number;
  durationDenominator: number;
  finger?: number;
  /**
   * Tuplet ratio (e.g., 3 = "3 in the time of 2"). When set, the
   * AlphaTex emitter emits `{tu N}` for the note so it renders with
   * the appropriate tuplet bracket.
   */
  tuplet?: number;
}
```

### `Settings.enabledRhythms`

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

Add `enabledRhythms: RhythmToggles` to `Settings`. Default: `{ quarter: true, eighth: false, triplet: false, '8ss': false, 's8s': false, 'ss8': false }`. Storage key bumps from `v6` to `v7`.

## Sequence generation

### New `applyRhythm` helper (in `src/exercises/rhythm.ts`, new file)

```ts
export function applyRhythm(sequence: NoteSequence, rhythm: Rhythm): NoteSequence {
  const pattern = RHYTHM_PATTERNS[rhythm];
  return sequence.map((note, i) => {
    const slot = pattern[i % pattern.length];
    return {
      ...note,
      durationDenominator: slot.duration,
      ...(slot.tuplet !== undefined ? { tuplet: slot.tuplet } : {}),
    };
  });
}

interface RhythmSlot {
  duration: number;     // 4, 8, or 16
  tuplet?: number;       // 3 for triplets
}

const RHYTHM_PATTERNS: Record<Rhythm, RhythmSlot[]> = {
  quarter: [{ duration: 4 }],
  eighth:  [{ duration: 8 }, { duration: 8 }],
  triplet: [
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
  ],
  '8ss': [{ duration: 8 },  { duration: 16 }, { duration: 16 }],
  's8s': [{ duration: 16 }, { duration: 8 },  { duration: 16 }],
  'ss8': [{ duration: 16 }, { duration: 16 }, { duration: 8 }],
};
```

The helper assigns durations per slot, cycling the pattern across the note count. Leftover notes at the end keep the slot's duration — bar padding is the emitter's job (see "Bar splitting" below).

### `generateExercise` dispatch

After the variant-specific sequence generation produces the raw `NoteSequence`, apply the rhythm:

```ts
let sequence = /* ... existing variant dispatch ... */;
// Agility variants opt out of the rhythm dimension — always eighth.
const effectiveRhythm = (variant.kind === 'bigX' || variant.kind === 'spider')
  ? 'eighth'
  : params.rhythm;
sequence = applyRhythm(sequence, effectiveRhythm);
```

The variant generators continue to emit notes WITHOUT setting `durationDenominator` (or with any placeholder value — `applyRhythm` overwrites it). For minimal disruption, leave the existing `durationDenominator: 8` calls in place — `applyRhythm` overrides them.

## Picker / universe

### `variantsFromSettings` — unchanged

The variant list itself doesn't change. Rhythm multiplication happens in `generateUniverse` after the existing iteration.

### `generateUniverse` — multiply by enabled rhythms

After computing the existing `(scale, key, variant, hp)` tuple entry, expand each entry by the enabled rhythms. For agility variants, just emit once at `'eighth'`.

Pseudo-code:

```ts
const enabledRhythms: Rhythm[] = computeEnabledRhythms(s.enabledRhythms);

// For each existing canonical entry:
const baseEntry: ExerciseParams = { ...existingFields };

if (variant.kind === 'bigX' || variant.kind === 'spider') {
  // Agility: always eighth, no multiplication
  result.push({ ...baseEntry, rhythm: 'eighth' });
} else {
  for (const rhythm of enabledRhythms) {
    result.push({ ...baseEntry, rhythm });
  }
}
```

If `enabledRhythms.length === 0`, non-agility entries produce nothing. Agility entries still emit at eighth — they're independent of the rhythm settings.

### Universe size

Default (Quarter only enabled): 16,150 (current) — same size because each existing non-agility entry now has `rhythm: 'quarter'`. Agility entries stay at eighth.

Worst case (all 6 enabled): non-agility multiplied × 6. Currently ~16,134 non-agility entries → ~96,800 entries × 6 ≈ ~580k. Wait — that's too much. Let me recheck.

Actually only the *enabled* rhythms multiply. With all 6 enabled: 16,134 non-agility × 6 = ~96,800 non-agility entries, plus ~16 agility = ~97,000 total. That's manageable.

(My earlier "580k" calc was wrong — sorry.)

## AlphaTex emitter changes

### Per-note duration tracking

The current emitter assumes uniform duration:

```ts
const dur = sequence[0].durationDenominator;
// ...
const body = ksToken + `:${dur} ` + measures.join(' | ');
```

Replace with per-note tracking. As the emitter walks the token stream, it tracks the "current" duration. When a note's duration differs, it inserts `:N ` before the note's token:

```ts
let currentDur = -1;
const tokens = sequence.map((n) => {
  let prefix = '';
  if (n.durationDenominator !== currentDur) {
    prefix = `:${n.durationDenominator} `;
    currentDur = n.durationDenominator;
  }
  // ... existing per-note token build (fret.string, properties) ...
  let token = `${n.fret}.${alphaTexString}`;
  const props = [...existingProps];
  if (n.tuplet !== undefined) {
    props.push(`tu ${n.tuplet}`);
  }
  if (props.length > 0) token += `{${props.join(' ')}}`;
  return prefix + token;
});
```

Body becomes:

```ts
const body = ksToken + measures.join(' | ');
```

(The `:N ` prefix is no longer global — it's embedded in the first token of each rhythm-change.)

### Bar splitting

The current emitter splits bars by note count (`notesPerMeasure = dur`). With mixed durations, the split is by **summed beat fraction**. One bar of 4/4 = 4 beats. Each note's duration contributes `4 / n.durationDenominator` beats. For tuplet notes, contribution is `(4 / n.durationDenominator) * (2 / n.tuplet)` (e.g., triplet eighth contributes `0.5 * 2/3 = 1/3` beat — three of them sum to 1 beat).

Pseudo-code:

```ts
function beatsForNote(n: FretboardNote): number {
  const raw = 4 / n.durationDenominator;
  return n.tuplet ? raw * (2 / n.tuplet) : raw;
}

const measures: string[][] = [[]];
let beatsInBar = 0;
const BAR_BEATS = 4;
for (let i = 0; i < tokens.length; i++) {
  measures[measures.length - 1].push(tokens[i]);
  beatsInBar += beatsForNote(sequence[i]);
  if (beatsInBar >= BAR_BEATS - 0.0001) {  // float-safe ≥
    beatsInBar = 0;
    if (i < tokens.length - 1) measures.push([]);
  }
}
```

For partial bars (leftover beats at the end), pad with rests matching the dominant duration. Simplest: if `beatsInBar > 0` after the loop, append `r` rests summing to `4 - beatsInBar` beats. Existing rest-padding logic uses `r` for one slot of the current duration; the new logic needs to compute the rest's duration to match the leftover beat fraction. For simplicity:

- If leftover is a whole-beat multiple: pad with quarter rests (`:4 r`).
- Otherwise: pad with the same duration as the last note (e.g., a half-beat leftover after eighth notes → `:8 r`).

This keeps padding simple without being perfectly compact.

### `autoClef` adaptation

The auto-clef logic currently chunks by `notesPerBeat = Math.floor(notesPerMeasure / 4)`. With mixed durations, this no longer maps. Redo as:

```ts
function computePerBarClefs(
  sequence: NoteSequence,
  bars: number[][],  // indices into sequence, one array per bar
): ('bass' | 'treble')[]
```

The bar-splitting step (above) produces an index-per-bar mapping; auto-clef walks each bar and classifies it as H (any note > MIDI 56) or L, then applies the existing 3-run rule per bar instead of per beat.

This is a meaningful refactor of `computePerBarClefs`. Acceptable since the change is mechanical (re-keyed from beats to bars).

## URL encoding

### `paramsKey`

Add a rhythm segment after the hand-position segment. New format:

```
<tuningId>|<scaleName>|<rootName>|<handPosition>|<variantKey>|<rhythm>|<openTag>
```

(Previously: `<tuningId>|<scaleName>|<rootName>|<handPosition>|<variantKey>|<openTag>`.)

For backward compatibility, `paramsFromKey` handles BOTH formats:
- 6 segments (legacy): defaults rhythm to `'eighth'`.
- 7 segments (new): parses rhythm from position 5.

### Examples

```
fourStringEADG|Major|C|front|plain|quarter|fretted
fourStringEADG|Major|C|front|plain|triplet|fretted
fourStringEADG|Chromatic|C|front|agility:bigX:0:fwd:sharp|eighth|fretted
```

For agility entries, rhythm is always `eighth` per the opt-out rule.

## UI changes

### `SettingsPanel.svelte` — new "Rhythms" section

Place between "Hand-agility drills" and "Keys" (or wherever fits the existing flow). Section content:

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
    <input type="checkbox" checked={$settings.enabledRhythms.quarter} onchange={() => toggleRhythm('quarter')} />
    ♩ Quarter notes
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={$settings.enabledRhythms.eighth} onchange={() => toggleRhythm('eighth')} />
    ♫ Eighth notes
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={$settings.enabledRhythms.triplet} onchange={() => toggleRhythm('triplet')} />
    ♫₃ Eighth-note triplets
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={$settings.enabledRhythms['8ss']} onchange={() => toggleRhythm('8ss')} />
    ♪♬ Eighth + two sixteenths (8ss)
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={$settings.enabledRhythms['s8s']} onchange={() => toggleRhythm('s8s')} />
    ♬♪♬ Sixteenth + eighth + sixteenth (s8s)
  </label>
  <label class="checkbox">
    <input type="checkbox" checked={$settings.enabledRhythms['ss8']} onchange={() => toggleRhythm('ss8')} />
    ♬♬♪ Two sixteenths + eighth (ss8)
  </label>
</section>
```

Helpers in the `<script>` block:

```ts
function toggleRhythm(key: keyof typeof $settings.enabledRhythms) {
  settings.update((s) => ({
    ...s,
    enabledRhythms: { ...s.enabledRhythms, [key]: !s.enabledRhythms[key] },
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

`enableAll` and `resetToDefaults` already-existing in the file should be extended to also set the rhythm toggles. `enableAll` flips all 6 on; `resetToDefaults` restores the `defaultSettings()` (Quarter-only).

### Display name

`formatDisplayName` appends a rhythm glyph to the variant label. The glyph mapping:

| Rhythm    | Glyph     |
|-----------|-----------|
| `quarter` | `♩`       |
| `eighth`  | `♫`       |
| `triplet` | `♫₃`      |
| `8ss`     | `(8ss)`   |
| `s8s`     | `(s8s)`   |
| `ss8`     | `(ss8)`   |

(Mixed-rhythm names use the slot-pattern letters in parens since there's no single concise glyph.)

For agility variants: NO rhythm glyph in the display name (consistent with how they don't show hand-position).

Example display names:

```
C Major — scale ↕ ♩ — Front ☝️
C Major — scale ↕ ♫ — Front ☝️
C Major — scale ↕ (8ss) — Front ☝️
F# Dorian — Triad cycle ↑↑ ♫₃
Big X E-A-D-G ↑ ♯   (no rhythm glyph)
```

`describeVariant` doesn't change (variant labels are unchanged). The glyph is appended in `formatDisplayName`.

### `BrowsePanel.svelte`

Add a "Rhythm" filter section between Variant and Scale (or after Variant if that feels cleaner). Chip row similar to existing ones:

```svelte
<section>
  <span class="lbl">Rhythm</span>
  <div class="chips">
    <button class="chip-toggle" class:on={rhythm === 'any'} onclick={() => (rhythm = 'any')}>Any</button>
    <button class="chip-toggle" class:on={rhythm === 'quarter'} onclick={() => (rhythm = 'quarter')}>♩ Quarter</button>
    <button class="chip-toggle" class:on={rhythm === 'eighth'} onclick={() => (rhythm = 'eighth')}>♫ Eighth</button>
    <button class="chip-toggle" class:on={rhythm === 'triplet'} onclick={() => (rhythm = 'triplet')}>♫₃ Triplet</button>
    <button class="chip-toggle" class:on={rhythm === '8ss'} onclick={() => (rhythm = '8ss')}>8ss</button>
    <button class="chip-toggle" class:on={rhythm === 's8s'} onclick={() => (rhythm = 's8s')}>s8s</button>
    <button class="chip-toggle" class:on={rhythm === 'ss8'} onclick={() => (rhythm = 'ss8')}>ss8</button>
  </div>
</section>
```

Filter logic uses `rhythm === 'any' || p.rhythm === rhythm`.

The rhythm chip row is greyed out (using the existing `.disabled` pattern) when Variant filter is `'agility'` — agility doesn't vary by rhythm.

## Testing

### Unit tests

**`src/exercises/rhythm.test.ts`** (new file):
- `applyRhythm` with each of the 6 rhythms on a 12-note sequence; assert per-note `durationDenominator` and `tuplet` fields match the slot pattern, repeating across notes.
- Quarter on 12 notes → all 12 have `durationDenominator: 4`, no tuplet.
- Eighth on 12 notes → all 12 have `durationDenominator: 8`, no tuplet.
- Triplet on 12 notes → all 12 have `durationDenominator: 8, tuplet: 3`.
- 8ss on 12 notes → pattern `[8, 16, 16, 8, 16, 16, ...]` (4 beats of the pattern).
- s8s on 12 notes → pattern `[16, 8, 16, 16, 8, 16, ...]`.
- ss8 on 12 notes → pattern `[16, 16, 8, 16, 16, 8, ...]`.
- Mid-pattern (5-note) sequence with 8ss → `[8, 16, 16, 8, 16]` (slots 0, 1, 2, 0, 1 — pattern partially repeats).

**`src/exercises/scale-generator.test.ts`** — generateExercise tests:
- `generateExercise({ ..., rhythm: 'quarter' })` returns sequence with all notes `durationDenominator: 4`.
- `generateExercise({ ..., rhythm: 'eighth' })` returns sequence with all notes `durationDenominator: 8`.
- `generateExercise({ ..., rhythm: 'triplet', variant: { kind: 'plain' } })` returns sequence where every note has `tuplet: 3`.
- For an agility variant (`bigX`), regardless of `params.rhythm`, the returned sequence has `durationDenominator: 8` everywhere (the opt-out works).

**`src/exercises/picker.test.ts`** — universe expansion:
- Default settings (Quarter only) → universe size matches existing (16,150 with default tuning).
- All 6 rhythms enabled → non-agility entries multiply × 6.
- Disabling all rhythms → non-agility entries empty; agility entries still present (independent of rhythm settings).
- Each non-agility universe entry has the expected `rhythm` field set.
- Agility entries have `rhythm: 'eighth'`.
- `paramsKey` round-trip preserves rhythm.
- `paramsKey` round-trip with each of the 6 rhythms.
- Legacy URL (6 segments, no rhythm) defaults to `'eighth'` (matches the historical default).

**`src/notation/alphatex-emitter.test.ts`**:
- Quarter-note sequence emits `:4 ` once, no per-note duration prefixes.
- Eighth-note sequence emits `:8 ` once.
- Triplet sequence emits `:8` with `{tu 3}` on every note.
- Mixed `[8, 16, 16, 8, 16, 16]` sequence emits `:8 a :16 b c :8 d :16 e f` — re-introduces the prefix only when duration changes.
- Mixed-duration bar splitting: a 6-note `[8, 16, 16, 8, 16, 16]` sequence is one bar of 4/4 (sum: 0.5+0.25+0.25+0.5+0.25+0.25 = 2 beats — wait, that's only HALF a bar; need 12 such patterns of half-bar each, OR pad with rests). Verify a 6-note sequence pads to a full bar with rests summing to 2 beats.

### Manual UI verification (after implementation)

1. Settings → "Rhythms" section appears; defaults match (Quarter ON, others OFF).
2. Toggle Eighth on; next exercise pick → some exercises now display rhythm glyph `♫` in the title.
3. Toggle Triplet on; next pick → some exercises have triplet bracket above notes in the staff.
4. Pick an agility exercise → no rhythm glyph in title; renders as eighth notes regardless of which rhythms are enabled.
5. Browse → "Rhythm" filter chip row appears. Filter by "Triplet" → only triplet exercises shown. When Variant filter is "Agility" → rhythm row greys out.
6. URL hash → contains rhythm segment, e.g., `…|plain|quarter|fretted`. Reload restores.
7. "Reset to defaults" → restores Quarter-only.
8. "Enable all" → all 6 rhythm toggles flip on.

### Universe scan

`scripts/scan-layouts.ts` doesn't need new flags — rhythm doesn't affect fretboard placement, only duration. The existing scan validates placements regardless of rhythm.

## Risks and known concerns

- **Quarter-note exercises take significantly longer to play.** A 32-note scale at 120 BPM: at quarters = ~16 seconds; at eighths = ~8 seconds. For walking exercises (~33 notes including resolution) at quarters = ~16.5 sec, vs ~8.25 sec at eighths. This is the user's stated intent ("for simplicity"), but worth flagging in case it feels too long once tested.
- **Mixed-rhythm AlphaTex bar-splitting** is the most complex change. Float arithmetic (summing beat fractions) needs a tolerance for "≥ 4 beats." The pseudo-code uses `BAR_BEATS - 0.0001` to avoid floating-point misses.
- **Triplet rendering relies on `{tu 3}` parsing.** Verify with a quick AlphaTab test before committing. If `tu` doesn't parse cleanly, alternative AlphaTex syntax `:8t` (triplet duration) may work — fallback only if needed.
- **Rest-padding for partial bars** is intentionally simple (use last note's duration). For mixed-rhythm sequences with multiple duration changes near the end, the padding may use a slightly off duration. Acceptable for a practice tool; could be polished later if it looks ugly.
- **Universe size** grows from 16,150 to up to ~97k with all rhythms enabled. `pickWeightedRandom` is O(N) per pick; should still be ~1ms. `generateUniverse` runs more often (once per settings change); ~50ms in worst case. Acceptable.
- **Storage version bump (v6 → v7)** wipes the user's existing settings — same convention as past bumps.
- **`computePerBarClefs` rewrite** changes the bar boundary heuristic. The existing tests should still pass since the cases they cover use uniform durations.

## Implementation order

1. Add `Rhythm` type + `RHYTHM_PATTERNS` constant + `applyRhythm` helper in `src/exercises/rhythm.ts` (new file) + unit tests.
2. Add `tuplet?: number` field to `FretboardNote`.
3. Add `RhythmToggles` interface + `enabledRhythms` field to Settings; bump storage to v7; update `defaultSettings` + `loadSettings` merge.
4. Add `rhythm: Rhythm` field to `ExerciseParams`.
5. Update `generateExercise` to call `applyRhythm` (with agility opt-out).
6. Update `generateUniverse` to multiply entries by enabled rhythms (with agility opt-out).
7. Update `paramsKey` / `paramsFromKey` for the new rhythm segment + backward-compat fallback.
8. Update `formatDisplayName` to append rhythm glyph (skipping agility).
9. Update `emitAlphaTex`: per-note duration tracking + tuplet markers + mixed-duration bar splitting + `autoClef` adaptation.
10. SettingsPanel: add "Rhythms" section + helpers + extend `enableAll` and `resetToDefaults`.
11. BrowsePanel: add Rhythm filter chip row + filter logic + grey-out when Variant filter is Agility.
12. Update existing tests for any `paramsKey` / `generateUniverse` / `emitAlphaTex` expectations that change.
13. Manual UI verification per the checklist above.
14. Update `docs/plan.md`.
