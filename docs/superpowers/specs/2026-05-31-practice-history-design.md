# Practice history & stats — design

> Design spec. Follow-up: [docs/superpowers/plans/2026-05-31-practice-history-implementation.md] (TBD via writing-plans).

## Goal

Add a practice log + coverage view so the user can see which (scale, key, variant family) cells have been neglected. Coverage-focused, not streaks/gamification. Explicit `✓ Done` button marks a practice event; the existing `Skip` button advances without logging.

## Scope

In:
- New `practice-log` store (separate from existing `history.ts` picker-exclusion ring).
- Bottom-bar button changes in App.svelte: `← Previous · ✓ Done · Skip →`.
- New topbar button (📊) opening a slide-out `HistoryPanel.svelte`.
- Header totals (Sessions, Coverage %, Today) + "neglected first" list.
- Row click loads a random exercise from that cell.
- Clear-history button with confirmation.
- Keyboard: `D` = Done, `N` = Skip (renaming from "Next" semantically), `P` = Previous unchanged.

Out (deferred):
- Streaks, badges, gamification.
- Heatmap or timeline visualizations (the brainstorm explored these — first cut is list-only).
- Per-tempo progress tracking.
- Cross-device sync.

## Architecture

### New module — `src/stores/practice-log.ts`

The primary store. Maintains an **aggregate per cell** as the canonical state, plus a small recent-events buffer for "today" / recent-feed queries.

```ts
import type { Rhythm } from '../exercises/types';

export type Family =
  | 'plain'
  | 'multiOctave'
  | 'consecutive'
  | 'mirror'
  | 'walkUp'
  | 'walkDown'
  | 'arpeggios'
  | 'agility';

export interface CellStats {
  count: number;
  firstPlayedTs: number;
  lastPlayedTs: number;
  perHand: { front?: number; mid?: number; back?: number };
  perRhythm: Partial<Record<Rhythm, number>>;
  perVariantId: Record<string, number>;
}

export interface PracticeEvent {
  ts: number;
  cellKey: string;
  paramsKey: string;  // exact exercise, for replay
}

export interface PracticeLogState {
  cells: Record<string, CellStats>;
  recentEvents: PracticeEvent[];  // cap 100
}
```

**Cell key format**: `${tuningId}|${scaleId}|${keyId}|${family}`

- `tuningId` is part of the key so 4-string and 5-string EADG don't merge.
- For agility, `scaleId` and `keyId` are empty strings: `'fourStringEADG|||agility'`.

**Storage key**: `bass-practice:practice-log:v1`. Persisted on every change via `store.subscribe(persist)` (same pattern as `settings.ts` / `history.ts`).

### Helpers (in same module)

```ts
// Map an ExerciseParams to its cell key.
export function cellKeyFor(p: ExerciseParams): string;

// Map a Variant to its family (mirrors BrowsePanel's matchVariantFamily).
export function familyForVariant(v: Variant): Family;

// `perVariantId` sub-counter key — distinguishes Big X / Spider, walking
// intervals 2-7, arpeggio sizes + inversions, etc.
export function variantIdFor(v: Variant): string;
```

### Store API

```ts
export const practiceLog: Writable<PracticeLogState> & {
  recordDone: (params: ExerciseParams) => void;
  todayCount: () => number;
  coverage: (enabledCellKeys: ReadonlySet<string>) => { played: number; total: number };
  clear: () => void;
};
```

`recordDone(params)`:
1. `cellKey = cellKeyFor(params)`
2. If `cells[cellKey]` missing: create with `count: 1`, `firstPlayedTs = lastPlayedTs = now`, per-* sub-counters initialized to 1 for the relevant slot.
3. Else: bump `count`, set `lastPlayedTs = now`, bump per-* sub-counters.
4. Prepend `{ ts: now, cellKey, paramsKey: paramsKey(params) }` to `recentEvents`, slice to 100.

## UI

### Bottom button bar (App.svelte)

Current:
```
←  ▶ Start  ← Previous  Next exercise →
```

New (the metronome ▶ row is unchanged; only the navigation row changes):
```
←  ✓ Done  Skip →
```

- **`✓ Done`** — green (`#10b981`); calls `practiceLog.recordDone($currentParams)` then `pickNext()`. Bound to `D` key.
- **`Skip →`** — purple (`--accent` = `#7c3aed`); calls `pickNext()` only. Bound to `N` key (preserves current Next behavior).
- **`←`** — unchanged (neutral); browser-history back. Bound to `P` key.

### Topbar

Add `📊` button between `🔍` Browse and `?` About:

```
[BèiSī 5000]     [🔍 Browse] [📊 History] [? About] [⚙ Settings]
```

### HistoryPanel

`src/components/HistoryPanel.svelte` — slide-out from the right (same pattern as Settings / Browse).

```
HEADER
  History                                [Clear] [✕]
  ────────────────────────────────────────────────
  [Sessions: 142]  [Coverage: 38%]  [Today: 12]
  ────────────────────────────────────────────────

NEGLECTED FIRST
  E Phrygian — Walking 3rds              [never]
  A♭ Major — Arpeggios                   [never]
  G Lydian — Mirror groups               [never]
  D Dorian — Walking 4ths                [28d]
  C Major Pent — Plain                   [19d · 2×]
  F Mixolydian — Multi-octave            [14d · 5×]
  B Locrian — Consecutive 3              [3d · 4×]
  …  (cap 50 rows)
```

**Totals**:
- **Sessions** — sum of all `cells[*].count`.
- **Coverage %** — `played / total × 100`, where:
  - `total` = enabled cell keys derived from `generateUniverse($settings)`.
  - `played` = `total ∩ { k : cells[k].count > 0 }`.
- **Today** — `recentEvents.filter(e => e.ts >= startOfDay()).length`.

**Neglected list** built from the enabled cell-key set:
1. For each enabled cell key, look up its `CellStats` (or treat as `count: 0` if missing).
2. Sort by: `count === 0 ? -Infinity : -lastPlayedTs` ascending (never-played first, then oldest-played).
3. Cap at 50 rows.
4. Render: scale name + variant family label, plus pill: `[never]` / `[Nd]` / `[Nd · M×]`.

**Pill thresholds** (for color):
- `never` → red background
- `>14d` → yellow
- `≤14d` → green

**Row click**:
1. Derive matching `ExerciseParams[]` by filtering `generateUniverse($settings)` to entries whose cellKey matches.
2. Random-pick one.
3. Call `onPick(params)` (same callback shape BrowsePanel uses).
4. Close panel.

**Clear button**: `window.confirm('Clear all practice history?')`, then `practiceLog.clear()`.

**Empty state** (no cells played and the panel is opened): `"No history yet — click ✓ Done after practicing an exercise to start tracking."` in place of the list.

### Family labels (UI display)

| Family | Label |
|---|---|
| `plain` | Plain scale |
| `multiOctave` | Multi-octave |
| `consecutive` | Consecutive groups |
| `mirror` | Mirror groups |
| `walkUp` | Walking ↑ |
| `walkDown` | Walking ↓ |
| `arpeggios` | Arpeggios |
| `agility` | Agility |

## Data flow

```
User clicks ✓ Done in App.svelte
  → practiceLog.recordDone($currentParams)
    → mutate cells[cellKey], prepend to recentEvents
    → persist to localStorage
  → pickNext()  (existing logic — random exercise from enabled universe)

User opens HistoryPanel
  → $derived: enabledCellKeys = derive from generateUniverse($settings)
  → $derived: rows = compute neglected-first list
  → $derived: totals = compute from cells + recentEvents

User clicks a row
  → filter generateUniverse to matching cell
  → random-pick one entry
  → onPick(params), close panel
  → App.svelte loads the exercise (existing onPick handler)
```

## Edge cases

- **Disabled Settings**: cells whose `(scale, key)` are no longer enabled still exist in `cells`. They don't appear in the neglected list or coverage % until re-enabled. No deletion on Settings change.
- **Agility scale/key**: empty strings in the cell key (`tuning|||agility`). Coverage denominator includes one agility cell per enabled tuning.
- **Settings storage version bump**: not required — practice-log has its own storage key.
- **Day boundary for "Today"**: local timezone via `new Date().setHours(0,0,0,0)`. No DST handling beyond what JS Date does.
- **`recentEvents` cap**: hard 100. Older events are GC'd. Aggregate counts in `cells` are never lost.
- **No retroactive logging**: if you played and didn't click Done, no entry. Done is the explicit acknowledgment.

## Testing

New test file `src/stores/practice-log.test.ts`:

- `familyForVariant` for each variant kind (plain, multiOctaveA/B, consecutive, mirror, intervalWalk up/down, arpeggioCycle, bigX, spider).
- `cellKeyFor` produces the expected string for each variant kind, including agility's empty scale/key.
- `variantIdFor` distinguishes arp `(size, direction, inversion)`, walking `(interval, dir)`, agility `(bigX, spider)`.
- `recordDone` mutations:
  - First call creates the cell with `count: 1`, both timestamps set.
  - Second call bumps `count` and `lastPlayedTs` but not `firstPlayedTs`.
  - Per-rhythm / per-hand / per-variant sub-counters increment.
  - `recentEvents` prepends and caps at 100.
- `coverage(enabledCellKeys)` returns correct `{ played, total }` against a synthetic set (some played, some not).
- `todayCount()` correctly filters events at day boundary (mock `Date.now`).
- `clear()` resets both `cells` and `recentEvents`.

UI verification (manual, via the preview pattern used for inversions):
1. Click Done; confirm a row appears in the panel.
2. Confirm totals update (Sessions +1, Today +1, Coverage % grows if first time in that cell).
3. Click a never-played row; confirm an exercise loads matching that scale/key/family.
4. Clear button confirmation + emptied state.
5. Disable a scale; confirm its rows disappear from neglected list and coverage shrinks.

## Risks

- **Coverage denominator semantics**: `generateUniverse(settings)` returns one entry per *fully specific* exercise (with every rhythm × hand × inversion × etc.). The cell-key set is the deduplicated projection. This is correct but worth a sanity-check test.
- **Performance of `generateUniverse` on every panel open**: cache via `$derived` over `$settings`; only recompute when settings change.
- **localStorage write on every Done click**: same pattern as settings; no measurable overhead.

## Implementation order

1. `practice-log.ts` store + helpers + unit tests.
2. App.svelte button bar changes (Done/Skip color split + `D` keyboard shortcut + wire `recordDone`).
3. `HistoryPanel.svelte` skeleton (header, totals row, empty state).
4. Neglected list with click-to-load + row rendering.
5. Clear button.
6. Manual UI verification gate.
7. Docs (`docs/plan.md` mark complete).
