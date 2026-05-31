# Practice history & stats — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a practice log + coverage view. Explicit `✓ Done` button logs a practice event for the current exercise; new `📊` topbar opens a panel listing the most-neglected (scale, key, variant family) cells.

**Architecture:** New `practice-log.ts` store maintains a per-cell aggregate (count, first/last timestamps, per-hand/per-rhythm/per-variant breakdowns) plus a 100-entry recent-events buffer. App.svelte gains a `✓ Done` button alongside the renamed `Skip` button. New `HistoryPanel.svelte` slide-out reads the aggregate, computes coverage % against `generateUniverse($settings)`, and renders a "neglected first" list. Existing `history.ts` (picker-exclusion ring) is untouched.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest.

**Reference spec:** [docs/superpowers/specs/2026-05-31-practice-history-design.md](../specs/2026-05-31-practice-history-design.md)

---

## File structure

**New files:**

| File | Responsibility |
|---|---|
| `src/stores/practice-log.ts` | Practice log store + `cellKeyFor` / `familyForVariant` / `variantIdFor` helpers |
| `src/stores/practice-log.test.ts` | Unit tests for store + helpers |
| `src/components/HistoryPanel.svelte` | Slide-out panel (header totals + neglected list + clear button) |

**Modified files:**

| File | What changes |
|---|---|
| `src/App.svelte` | Bottom nav row: `← Previous · ✓ Done · Skip →` with color split; `D` keyboard shortcut wires `recordDone`; new `📊` topbar button mounts HistoryPanel |
| `docs/plan.md` | Mark feature complete in "Recent additions" |

---

## Task 1: Family + cellKey helpers + tests

**Files:**
- Create: `src/stores/practice-log.ts`
- Create: `src/stores/practice-log.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/stores/practice-log.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { familyForVariant, cellKeyFor } from './practice-log';
import { SCALES } from '../theory/scales';
import { TUNINGS } from '../theory/tunings';
import { pitchClass } from '../theory/notes';
import type { ExerciseParams, Variant } from '../exercises/types';

function baseParams(variant: Variant, scaleId: keyof typeof SCALES = 'major'): ExerciseParams {
  return {
    scale: SCALES[scaleId],
    rootPc: pitchClass('C'),
    rootName: 'C',
    variant,
    scaleDirection: 'updown',
    handPosition: 'front',
    tuning: TUNINGS.fourStringEADG,
  };
}

describe('familyForVariant', () => {
  test('plain → plain', () => {
    expect(familyForVariant({ kind: 'plain' })).toBe('plain');
  });
  test('multiOctaveA → multiOctave', () => {
    expect(familyForVariant({ kind: 'multiOctaveA', octaves: 2 })).toBe('multiOctave');
  });
  test('multiOctaveB → multiOctave', () => {
    expect(familyForVariant({ kind: 'multiOctaveB', octaves: 2 })).toBe('multiOctave');
  });
  test('consecutive → consecutive', () => {
    expect(familyForVariant({ kind: 'consecutive', groupSize: 3 })).toBe('consecutive');
  });
  test('mirror → mirror', () => {
    expect(familyForVariant({ kind: 'mirror', peakSize: 4 })).toBe('mirror');
  });
  test('intervalWalk up → walkUp', () => {
    expect(familyForVariant({ kind: 'intervalWalk', interval: 3, intervalDir: 'up' })).toBe('walkUp');
  });
  test('intervalWalk down → walkDown', () => {
    expect(familyForVariant({ kind: 'intervalWalk', interval: 5, intervalDir: 'down' })).toBe('walkDown');
  });
  test('arpeggioCycle → arpeggios', () => {
    expect(familyForVariant({ kind: 'arpeggioCycle', size: 3, direction: 'allUp', inversion: 0 })).toBe('arpeggios');
  });
  test('bigX → agility', () => {
    expect(familyForVariant({ kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' })).toBe('agility');
  });
  test('spider → agility', () => {
    expect(familyForVariant({ kind: 'spider', lowerString: 0, direction: 'forward', spelling: 'sharp' })).toBe('agility');
  });
});

describe('cellKeyFor', () => {
  test('plain C major front 4-string → fourStringEADG|major|C|plain', () => {
    const params = baseParams({ kind: 'plain' });
    expect(cellKeyFor(params)).toBe('fourStringEADG|major|C|plain');
  });
  test('walkUp uses walkUp family', () => {
    const params = baseParams({ kind: 'intervalWalk', interval: 3, intervalDir: 'up' });
    expect(cellKeyFor(params)).toBe('fourStringEADG|major|C|walkUp');
  });
  test('arpeggio uses arpeggios family regardless of size/inversion', () => {
    const params = baseParams({ kind: 'arpeggioCycle', size: 4, direction: 'allUp', inversion: 2 });
    expect(cellKeyFor(params)).toBe('fourStringEADG|major|C|arpeggios');
  });
  test('agility uses empty scaleId / keyId — fourStringEADG|||agility', () => {
    const params: ExerciseParams = {
      scale: SCALES.chromatic,
      rootPc: 0,
      rootName: 'C',
      variant: { kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
    };
    expect(cellKeyFor(params)).toBe('fourStringEADG|||agility');
  });
  test('agility on 5-string still produces a tuning-keyed agility cell', () => {
    const params: ExerciseParams = {
      scale: SCALES.chromatic,
      rootPc: 0,
      rootName: 'C',
      variant: { kind: 'spider', lowerString: 0, direction: 'forward', spelling: 'flat' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fiveStringBEADG,
    };
    expect(cellKeyFor(params)).toBe('fiveStringBEADG|||agility');
  });
  test('different scaleId produces different cell key', () => {
    const p1 = baseParams({ kind: 'plain' }, 'major');
    const p2 = baseParams({ kind: 'plain' }, 'dorian');
    expect(cellKeyFor(p1)).not.toBe(cellKeyFor(p2));
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement helpers**

Create `src/stores/practice-log.ts`:

```ts
import type { ExerciseParams, Variant } from '../exercises/types';
import { pitchClassName } from '../theory/notes';
import { SCALES } from '../theory/scales';
import type { ScaleId } from '../theory/scales';

export type Family =
  | 'plain'
  | 'multiOctave'
  | 'consecutive'
  | 'mirror'
  | 'walkUp'
  | 'walkDown'
  | 'arpeggios'
  | 'agility';

/**
 * Mirror BrowsePanel's `matchVariantFamily` taxonomy: this is the
 * coverage unit. Hand position, rhythm, exact arpeggio inversion, etc.
 * are all dimensions WITHIN a family, captured in CellStats.perHand /
 * perRhythm / perVariantId rather than splitting the cell.
 */
export function familyForVariant(v: Variant): Family {
  switch (v.kind) {
    case 'plain': return 'plain';
    case 'multiOctaveA':
    case 'multiOctaveB':
      return 'multiOctave';
    case 'consecutive': return 'consecutive';
    case 'mirror': return 'mirror';
    case 'intervalWalk':
      return v.intervalDir === 'up' ? 'walkUp' : 'walkDown';
    case 'arpeggioCycle': return 'arpeggios';
    case 'bigX':
    case 'spider':
      return 'agility';
  }
}

function scaleIdFor(scaleName: string): ScaleId | '' {
  for (const [id, s] of Object.entries(SCALES)) {
    if (s.name === scaleName) return id as ScaleId;
  }
  return '';
}

/**
 * Cell key: `tuningId|scaleId|keyId|family`. Agility uses empty
 * scaleId/keyId since chromatic exercises aren't keyed.
 */
export function cellKeyFor(p: ExerciseParams): string {
  const family = familyForVariant(p.variant);
  if (family === 'agility') {
    return `${p.tuning.id}|||agility`;
  }
  const scaleId = scaleIdFor(p.scale.name);
  const keyId = p.rootName ?? pitchClassName(p.rootPc, 'sharp');
  return `${p.tuning.id}|${scaleId}|${keyId}|${family}`;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: 16 tests pass.

Run full suite:
Run: `npx vitest run`
Expected: all tests pass (existing 389 + 16 new = 405).

- [ ] **Step 5: Commit**

```bash
git add src/stores/practice-log.ts src/stores/practice-log.test.ts
git commit -m "feat(history): familyForVariant + cellKeyFor helpers"
```

---

## Task 2: variantIdFor helper + tests

**Files:**
- Modify: `src/stores/practice-log.ts`
- Modify: `src/stores/practice-log.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/stores/practice-log.test.ts`:

```ts
import { variantIdFor } from './practice-log';

describe('variantIdFor', () => {
  test('plain → plain', () => {
    expect(variantIdFor({ kind: 'plain' })).toBe('plain');
  });
  test('multiOctaveA(2 oct) → A:2', () => {
    expect(variantIdFor({ kind: 'multiOctaveA', octaves: 2 })).toBe('A:2');
  });
  test('multiOctaveA(3 oct) → A:3', () => {
    expect(variantIdFor({ kind: 'multiOctaveA', octaves: 3 })).toBe('A:3');
  });
  test('multiOctaveB(2 oct) → B:2', () => {
    expect(variantIdFor({ kind: 'multiOctaveB', octaves: 2 })).toBe('B:2');
  });
  test('consecutive(group=4) → 4', () => {
    expect(variantIdFor({ kind: 'consecutive', groupSize: 4 })).toBe('4');
  });
  test('mirror(peak=3) → 3', () => {
    expect(variantIdFor({ kind: 'mirror', peakSize: 3 })).toBe('3');
  });
  test('walkUp(interval 5) → 5  (direction lives in the family key)', () => {
    expect(variantIdFor({ kind: 'intervalWalk', interval: 5, intervalDir: 'up' })).toBe('5');
  });
  test('walkDown(interval 7) → 7', () => {
    expect(variantIdFor({ kind: 'intervalWalk', interval: 7, intervalDir: 'down' })).toBe('7');
  });
  test('arpeggio triad allUp root → 3:allUp:0', () => {
    expect(variantIdFor({ kind: 'arpeggioCycle', size: 3, direction: 'allUp', inversion: 0 })).toBe('3:allUp:0');
  });
  test('arpeggio 7th 1st inv upDown → 4:upDown:1', () => {
    expect(variantIdFor({ kind: 'arpeggioCycle', size: 4, direction: 'upDown', inversion: 1 })).toBe('4:upDown:1');
  });
  test('bigX forward sharp → bigX:forward:sharp', () => {
    expect(variantIdFor({ kind: 'bigX', startString: 0, direction: 'forward', spelling: 'sharp' })).toBe('bigX:forward:sharp');
  });
  test('spider reverse flat → spider:reverse:flat', () => {
    expect(variantIdFor({ kind: 'spider', lowerString: 1, direction: 'reverse', spelling: 'flat' })).toBe('spider:reverse:flat');
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/stores/practice-log.test.ts -t variantIdFor`
Expected: FAIL — `variantIdFor` not exported.

- [ ] **Step 3: Implement variantIdFor**

Add to `src/stores/practice-log.ts` after `cellKeyFor`:

```ts
/**
 * Sub-counter key inside a cell's perVariantId map. Cells are already
 * bucketed by family, so the variantId doesn't repeat family info
 * (except for agility, where the two distinct exercise kinds share
 * the family and need to be told apart).
 */
export function variantIdFor(v: Variant): string {
  switch (v.kind) {
    case 'plain': return 'plain';
    case 'multiOctaveA': return `A:${v.octaves}`;
    case 'multiOctaveB': return `B:${v.octaves}`;
    case 'consecutive': return String(v.groupSize);
    case 'mirror': return String(v.peakSize);
    case 'intervalWalk': return String(v.interval);
    case 'arpeggioCycle': return `${v.size}:${v.direction}:${v.inversion}`;
    case 'bigX': return `bigX:${v.direction}:${v.spelling}`;
    case 'spider': return `spider:${v.direction}:${v.spelling}`;
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: all 28 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/practice-log.ts src/stores/practice-log.test.ts
git commit -m "feat(history): variantIdFor for per-variant drill-down counters"
```

---

## Task 3: practiceLog store skeleton + load/persist + clear

**Files:**
- Modify: `src/stores/practice-log.ts`
- Modify: `src/stores/practice-log.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/stores/practice-log.test.ts`:

```ts
import { get } from 'svelte/store';
import { practiceLog } from './practice-log';

describe('practiceLog store', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    practiceLog.clear();
  });

  test('initial state has empty cells and empty recentEvents', () => {
    const s = get(practiceLog);
    expect(s.cells).toEqual({});
    expect(s.recentEvents).toEqual([]);
  });

  test('clear() resets cells and recentEvents', () => {
    practiceLog.update((s) => ({
      cells: { 'foo|major|C|plain': { count: 1, firstPlayedTs: 1, lastPlayedTs: 1, perHand: {}, perRhythm: {}, perVariantId: {} } },
      recentEvents: [{ ts: 1, cellKey: 'foo|major|C|plain', paramsKey: 'k' }],
    }));
    practiceLog.clear();
    const s = get(practiceLog);
    expect(s.cells).toEqual({});
    expect(s.recentEvents).toEqual([]);
  });
});
```

Add the `beforeEach` import at the top of the file if it isn't already there:

```ts
import { describe, test, expect, beforeEach } from 'vitest';
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/stores/practice-log.test.ts -t "practiceLog store"`
Expected: FAIL — `practiceLog` not exported.

- [ ] **Step 3: Implement skeleton store**

Add to `src/stores/practice-log.ts` (top of file imports, alongside existing):

```ts
import { writable, type Writable } from 'svelte/store';
import type { Rhythm } from '../exercises/types';
```

Add the types and store at the bottom of the file:

```ts
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
  paramsKey: string;
}

export interface PracticeLogState {
  cells: Record<string, CellStats>;
  recentEvents: PracticeEvent[];
}

const STORAGE_KEY = 'bass-practice:practice-log:v1';
const RECENT_CAP = 100;

function emptyState(): PracticeLogState {
  return { cells: {}, recentEvents: [] };
}

function load(): PracticeLogState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PracticeLogState>;
    return {
      cells: parsed.cells ?? {},
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
    };
  } catch {
    return emptyState();
  }
}

function persist(state: PracticeLogState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / disabled — ignore
  }
}

function createPracticeLogStore(): Writable<PracticeLogState> & {
  clear: () => void;
} {
  const store = writable<PracticeLogState>(load());
  store.subscribe(persist);
  return {
    ...store,
    clear() {
      store.set(emptyState());
    },
  };
}

export const practiceLog = createPracticeLogStore();
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: all 30 tests pass.

Run typecheck:
Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/practice-log.ts src/stores/practice-log.test.ts
git commit -m "feat(history): practiceLog store skeleton with load/persist/clear"
```

---

## Task 4: recordDone mutations

**Files:**
- Modify: `src/stores/practice-log.ts`
- Modify: `src/stores/practice-log.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/stores/practice-log.test.ts`:

```ts
describe('practiceLog.recordDone', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    practiceLog.clear();
  });

  test('first recordDone creates a cell with count=1, both timestamps set, rhythm/hand/variant sub-counters', () => {
    const tNow = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(tNow));
    const params: ExerciseParams = {
      ...baseParams({ kind: 'plain' }),
      rhythm: 'quarter',
    };
    practiceLog.recordDone(params);
    const s = get(practiceLog);
    const cell = s.cells['fourStringEADG|major|C|plain'];
    expect(cell).toBeDefined();
    expect(cell.count).toBe(1);
    expect(cell.firstPlayedTs).toBe(tNow);
    expect(cell.lastPlayedTs).toBe(tNow);
    expect(cell.perHand.front).toBe(1);
    expect(cell.perRhythm.quarter).toBe(1);
    expect(cell.perVariantId.plain).toBe(1);
    vi.useRealTimers();
  });

  test('second recordDone bumps count and lastPlayedTs but not firstPlayedTs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000_000_000));
    const params: ExerciseParams = { ...baseParams({ kind: 'plain' }), rhythm: 'quarter' };
    practiceLog.recordDone(params);
    vi.setSystemTime(new Date(2_000_000_000_000));
    practiceLog.recordDone(params);
    const cell = get(practiceLog).cells['fourStringEADG|major|C|plain'];
    expect(cell.count).toBe(2);
    expect(cell.firstPlayedTs).toBe(1_000_000_000_000);
    expect(cell.lastPlayedTs).toBe(2_000_000_000_000);
    expect(cell.perHand.front).toBe(2);
    expect(cell.perRhythm.quarter).toBe(2);
    vi.useRealTimers();
  });

  test('different rhythm in same cell increments separate sub-counter', () => {
    const p1: ExerciseParams = { ...baseParams({ kind: 'plain' }), rhythm: 'quarter' };
    const p2: ExerciseParams = { ...baseParams({ kind: 'plain' }), rhythm: 'eighth' };
    practiceLog.recordDone(p1);
    practiceLog.recordDone(p2);
    const cell = get(practiceLog).cells['fourStringEADG|major|C|plain'];
    expect(cell.count).toBe(2);
    expect(cell.perRhythm.quarter).toBe(1);
    expect(cell.perRhythm.eighth).toBe(1);
  });

  test('different hand increments separate perHand', () => {
    const front: ExerciseParams = { ...baseParams({ kind: 'plain' }), handPosition: 'front' };
    const mid: ExerciseParams = { ...baseParams({ kind: 'plain' }), handPosition: 'mid' };
    practiceLog.recordDone(front);
    practiceLog.recordDone(mid);
    const cell = get(practiceLog).cells['fourStringEADG|major|C|plain'];
    expect(cell.perHand.front).toBe(1);
    expect(cell.perHand.mid).toBe(1);
  });

  test('missing rhythm is skipped (no sub-counter mutation)', () => {
    const params = baseParams({ kind: 'plain' });
    expect(params.rhythm).toBeUndefined();
    practiceLog.recordDone(params);
    const cell = get(practiceLog).cells['fourStringEADG|major|C|plain'];
    expect(cell.perRhythm).toEqual({});
  });

  test('arpeggio inversion is recorded in perVariantId', () => {
    const params: ExerciseParams = {
      ...baseParams({ kind: 'arpeggioCycle', size: 3, direction: 'allUp', inversion: 2 }),
      rhythm: 'eighth',
    };
    practiceLog.recordDone(params);
    const cell = get(practiceLog).cells['fourStringEADG|major|C|arpeggios'];
    expect(cell.perVariantId['3:allUp:2']).toBe(1);
  });

  test('recentEvents is prepended (newest first) and capped at 100', () => {
    for (let i = 0; i < 105; i++) {
      practiceLog.recordDone(baseParams({ kind: 'plain' }));
    }
    const s = get(practiceLog);
    expect(s.recentEvents.length).toBe(100);
  });
});
```

Update the `vitest` import at the top of the file to include `vi`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/stores/practice-log.test.ts -t "recordDone"`
Expected: FAIL — `recordDone` not implemented.

- [ ] **Step 3: Implement recordDone**

In `src/stores/practice-log.ts`, add `paramsKey` import at the top:

```ts
import { paramsKey } from '../exercises/picker';
```

Replace the `createPracticeLogStore` function with:

```ts
function createPracticeLogStore(): Writable<PracticeLogState> & {
  recordDone: (params: ExerciseParams) => void;
  clear: () => void;
} {
  const store = writable<PracticeLogState>(load());
  store.subscribe(persist);
  return {
    ...store,
    recordDone(params: ExerciseParams) {
      const now = Date.now();
      const cellKey = cellKeyFor(params);
      const variantId = variantIdFor(params.variant);
      store.update((s) => {
        const prev = s.cells[cellKey];
        const baseCell: CellStats = prev
          ? { ...prev,
              perHand: { ...prev.perHand },
              perRhythm: { ...prev.perRhythm },
              perVariantId: { ...prev.perVariantId },
            }
          : { count: 0, firstPlayedTs: now, lastPlayedTs: now, perHand: {}, perRhythm: {}, perVariantId: {} };
        baseCell.count += 1;
        baseCell.lastPlayedTs = now;
        baseCell.perHand[params.handPosition] = (baseCell.perHand[params.handPosition] ?? 0) + 1;
        if (params.rhythm) {
          baseCell.perRhythm[params.rhythm] = (baseCell.perRhythm[params.rhythm] ?? 0) + 1;
        }
        baseCell.perVariantId[variantId] = (baseCell.perVariantId[variantId] ?? 0) + 1;
        const events: PracticeEvent[] = [
          { ts: now, cellKey, paramsKey: paramsKey(params) },
          ...s.recentEvents,
        ].slice(0, RECENT_CAP);
        return {
          cells: { ...s.cells, [cellKey]: baseCell },
          recentEvents: events,
        };
      });
    },
    clear() {
      store.set(emptyState());
    },
  };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: all 37 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/practice-log.ts src/stores/practice-log.test.ts
git commit -m "feat(history): recordDone mutates aggregate + appends recentEvent"
```

---

## Task 5: todayCount + coverage helpers

**Files:**
- Modify: `src/stores/practice-log.ts`
- Modify: `src/stores/practice-log.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/stores/practice-log.test.ts`:

```ts
describe('practiceLog.todayCount', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    practiceLog.clear();
  });

  test('returns 0 when no events', () => {
    expect(practiceLog.todayCount()).toBe(0);
  });

  test('counts only events from today (local midnight onward)', () => {
    vi.useFakeTimers();
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    const yesterdayNoon = new Date(todayNoon.getTime() - 24 * 60 * 60 * 1000);

    vi.setSystemTime(yesterdayNoon);
    practiceLog.recordDone(baseParams({ kind: 'plain' }));
    practiceLog.recordDone(baseParams({ kind: 'plain' }));

    vi.setSystemTime(todayNoon);
    practiceLog.recordDone(baseParams({ kind: 'plain' }));
    practiceLog.recordDone(baseParams({ kind: 'plain' }));
    practiceLog.recordDone(baseParams({ kind: 'plain' }));

    expect(practiceLog.todayCount()).toBe(3);
    vi.useRealTimers();
  });
});

describe('practiceLog.coverage', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    practiceLog.clear();
  });

  test('empty log against 5 enabled cells → played=0 total=5', () => {
    const enabled = new Set(['a', 'b', 'c', 'd', 'e']);
    expect(practiceLog.coverage(enabled)).toEqual({ played: 0, total: 5 });
  });

  test('played cells outside the enabled set do not count', () => {
    practiceLog.recordDone(baseParams({ kind: 'plain' })); // creates 'fourStringEADG|major|C|plain'
    const enabled = new Set(['x', 'y']);
    expect(practiceLog.coverage(enabled)).toEqual({ played: 0, total: 2 });
  });

  test('played cells inside the enabled set count once each', () => {
    practiceLog.recordDone(baseParams({ kind: 'plain' }));
    practiceLog.recordDone(baseParams({ kind: 'plain' })); // same cell twice — still 1 played
    const enabled = new Set(['fourStringEADG|major|C|plain', 'fourStringEADG|major|D|plain']);
    expect(practiceLog.coverage(enabled)).toEqual({ played: 1, total: 2 });
  });

  test('total=0 (no enabled cells) → played=0, total=0 (caller decides display)', () => {
    expect(practiceLog.coverage(new Set())).toEqual({ played: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/stores/practice-log.test.ts -t "todayCount\|coverage"`
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Add the methods**

Add `get` to the existing svelte/store import at the top of `src/stores/practice-log.ts`:

```ts
import { writable, get, type Writable } from 'svelte/store';
```

Replace the entire `createPracticeLogStore` function with:

```ts
function createPracticeLogStore(): Writable<PracticeLogState> & {
  recordDone: (params: ExerciseParams) => void;
  todayCount: () => number;
  coverage: (enabled: ReadonlySet<string>) => { played: number; total: number };
  clear: () => void;
} {
  const store = writable<PracticeLogState>(load());
  store.subscribe(persist);
  return {
    ...store,
    recordDone(params: ExerciseParams) {
      const now = Date.now();
      const cellKey = cellKeyFor(params);
      const variantId = variantIdFor(params.variant);
      store.update((s) => {
        const prev = s.cells[cellKey];
        const baseCell: CellStats = prev
          ? { ...prev,
              perHand: { ...prev.perHand },
              perRhythm: { ...prev.perRhythm },
              perVariantId: { ...prev.perVariantId },
            }
          : { count: 0, firstPlayedTs: now, lastPlayedTs: now, perHand: {}, perRhythm: {}, perVariantId: {} };
        baseCell.count += 1;
        baseCell.lastPlayedTs = now;
        baseCell.perHand[params.handPosition] = (baseCell.perHand[params.handPosition] ?? 0) + 1;
        if (params.rhythm) {
          baseCell.perRhythm[params.rhythm] = (baseCell.perRhythm[params.rhythm] ?? 0) + 1;
        }
        baseCell.perVariantId[variantId] = (baseCell.perVariantId[variantId] ?? 0) + 1;
        const events: PracticeEvent[] = [
          { ts: now, cellKey, paramsKey: paramsKey(params) },
          ...s.recentEvents,
        ].slice(0, RECENT_CAP);
        return {
          cells: { ...s.cells, [cellKey]: baseCell },
          recentEvents: events,
        };
      });
    },
    todayCount() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const s = get(store);
      return s.recentEvents.filter((e) => e.ts >= startMs).length;
    },
    coverage(enabled: ReadonlySet<string>) {
      const s = get(store);
      let played = 0;
      for (const key of enabled) {
        if (s.cells[key]?.count) played++;
      }
      return { played, total: enabled.size };
    },
    clear() {
      store.set(emptyState());
    },
  };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run src/stores/practice-log.test.ts`
Expected: all 43 tests pass.

Run full suite:
Run: `npx vitest run && npm run check`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/stores/practice-log.ts src/stores/practice-log.test.ts
git commit -m "feat(history): todayCount + coverage helpers"
```

---

## Task 6: App.svelte — Done/Skip button bar + D shortcut

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add practiceLog import**

In the `<script>` block of `src/App.svelte`, add to the existing imports:

```ts
import { practiceLog } from './stores/practice-log';
```

- [ ] **Step 2: Add the doneAndNext handler**

After the existing `pickNext()` function (around line 65), add:

```ts
  function doneAndNext(): void {
    if (currentExercise) {
      practiceLog.recordDone(currentExercise.params);
    }
    pickNext();
  }
```

- [ ] **Step 3: Extend the keyboard shortcut handler to add `D` for Done**

Find the existing `$effect` keyboard handler (around line 136). Update the `onKey` body to include `D`:

```ts
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        pickNext();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        doneAndNext();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        window.history.back();
      }
```

- [ ] **Step 4: Replace the nav-row markup**

Find the existing `.nav-row` block in the template (around line 371):

```svelte
      <div class="nav-row">
        <button
          class="prev-btn"
          onclick={() => window.history.back()}
          aria-label="Previous exercise"
          title="Previous exercise (P)"
          type="button"
        >
          ←
        </button>
        <button
          class="next-btn"
          onclick={pickNext}
          title="Next exercise (N)"
        >
          Next exercise →
        </button>
      </div>
```

Replace with:

```svelte
      <div class="nav-row">
        <button
          class="prev-btn"
          onclick={() => window.history.back()}
          aria-label="Previous exercise"
          title="Previous exercise (P)"
          type="button"
        >
          ←
        </button>
        <button
          class="done-btn"
          onclick={doneAndNext}
          title="Mark done and pick next (D)"
          type="button"
        >
          ✓ Done
        </button>
        <button
          class="skip-btn"
          onclick={pickNext}
          title="Skip without logging (N)"
          type="button"
        >
          Skip →
        </button>
      </div>
```

- [ ] **Step 5: Add CSS for `.done-btn` + rename `.next-btn` to `.skip-btn`**

In the `<style>` block, find the `.next-btn` rules (around line 597). Replace them with:

```css
  .done-btn {
    flex: 1;
    padding: 14px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .done-btn:hover {
    background: #0ea371;
  }
  .skip-btn {
    flex: 1;
    padding: 14px;
    background: var(--accent);
    color: var(--accent-text-on);
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .skip-btn:hover {
    background: var(--accent-hover);
  }
```

Also find the mobile `@media (max-width: 520px)` block and replace `.next-btn` with `.skip-btn` and add `.done-btn` rules if there's a mobile padding override:

Run `grep -n "next-btn" src/App.svelte` first. Any occurrence inside the `@media` block should be updated to cover both `.done-btn` and `.skip-btn`. Apply the same padding/font tweaks to both.

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean; 405 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte
git commit -m "feat(history): Done + Skip button split with D keyboard shortcut"
```

---

## Task 7: HistoryPanel skeleton + topbar 📊 button

**Files:**
- Create: `src/components/HistoryPanel.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create HistoryPanel.svelte (header + totals + empty state)**

Create `src/components/HistoryPanel.svelte`:

```svelte
<script lang="ts">
  import { practiceLog } from '../stores/practice-log';
  import { settings } from '../stores/settings';
  import { generateUniverse } from '../exercises/picker';
  import { cellKeyFor } from '../stores/practice-log';
  import type { ExerciseParams } from '../exercises/types';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (params: ExerciseParams) => void;
  }
  let { open, onClose, onPick }: Props = $props();

  // Universe + derived cell-key set — recomputed only when settings change.
  const enabledCellKeys = $derived.by<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const p of generateUniverse($settings)) {
      set.add(cellKeyFor(p));
    }
    return set;
  });

  // Aggregate totals from the store.
  const totalSessions = $derived(
    Object.values($practiceLog.cells).reduce((sum, c) => sum + c.count, 0),
  );
  const coverageStats = $derived(practiceLog.coverage(enabledCellKeys));
  const coveragePct = $derived(
    coverageStats.total === 0 ? 0 : Math.round((coverageStats.played / coverageStats.total) * 100),
  );
  const todayN = $derived.by(() => {
    // Re-evaluate whenever events change (the $practiceLog dependency).
    void $practiceLog.recentEvents.length;
    return practiceLog.todayCount();
  });

  function confirmClear(): void {
    if (typeof window === 'undefined') return;
    if (window.confirm('Clear all practice history?')) {
      practiceLog.clear();
    }
  }
</script>

{#if open}
  <button
    class="scrim"
    onclick={onClose}
    aria-label="Close history"
    type="button"
  ></button>
{/if}

<aside class="panel" class:open>
  <header>
    <h2>History</h2>
    <div class="header-actions">
      <button class="clear-btn" onclick={confirmClear} type="button">Clear</button>
      <button class="close" onclick={onClose} aria-label="Close">✕</button>
    </div>
  </header>

  <div class="totals">
    <div class="stat">
      <div class="stat-value">{totalSessions}</div>
      <div class="stat-label">Sessions</div>
    </div>
    <div class="stat">
      <div class="stat-value">{coveragePct}%</div>
      <div class="stat-label">Coverage</div>
    </div>
    <div class="stat">
      <div class="stat-value">{todayN}</div>
      <div class="stat-label">Today</div>
    </div>
  </div>

  {#if totalSessions === 0}
    <p class="empty">No history yet — click ✓ Done after practicing an exercise to start tracking.</p>
  {:else}
    <p class="placeholder">Neglected list goes here (Task 8).</p>
  {/if}
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: pointer;
    z-index: 50;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(420px, 92vw);
    height: 100vh;
    background: var(--panel);
    color: var(--text);
    border-left: 1px solid var(--border);
    padding: 16px;
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.18s ease-out;
    z-index: 60;
  }
  .panel.open {
    transform: translateX(0);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  header h2 {
    margin: 0;
    font-size: 18px;
  }
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .clear-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }
  .close {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 18px;
    cursor: pointer;
  }
  .totals {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .stat {
    flex: 1;
    text-align: center;
  }
  .stat-value {
    font-size: 22px;
    font-weight: 600;
    color: var(--accent);
  }
  .stat-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .empty,
  .placeholder {
    color: var(--text-dim);
    font-size: 13px;
    text-align: center;
    padding: 24px 8px;
  }
</style>
```

- [ ] **Step 2: Mount the panel in App.svelte**

In `src/App.svelte`'s `<script>`, add the import alongside other component imports:

```ts
import HistoryPanel from './components/HistoryPanel.svelte';
```

Add a state variable alongside `panelOpen` / `aboutOpen` / `browseOpen` (around line 39):

```ts
let historyOpen = $state(false);
```

In the topbar markup (around line 224), add a `📊` button between `🔍` and `?`:

```svelte
    <button
      class="iconbtn"
      onclick={() => (browseOpen = true)}
      aria-label="Browse exercises"
      title="Browse exercises"
      type="button"
    >
      🔍
    </button>
    <button
      class="iconbtn"
      onclick={() => (historyOpen = true)}
      aria-label="Practice history"
      title="Practice history"
      type="button"
    >
      📊
    </button>
    <button
      class="iconbtn"
      onclick={() => (aboutOpen = true)}
      aria-label="About this app"
      title="About this app"
      type="button"
    >
      ?
    </button>
```

After the `<BrowsePanel ... />` mount (around line 421), add:

```svelte
<HistoryPanel
  open={historyOpen}
  onClose={() => (historyOpen = false)}
  onPick={loadPicked}
/>
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean; 405 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryPanel.svelte src/App.svelte
git commit -m "feat(history): HistoryPanel skeleton + 📊 topbar button"
```

---

## Task 8: HistoryPanel neglected list + row click

**Files:**
- Modify: `src/components/HistoryPanel.svelte`

- [ ] **Step 1: Compute the rows**

In `src/components/HistoryPanel.svelte`, after the `coveragePct` / `todayN` derivations, add:

```ts
  interface Row {
    cellKey: string;
    label: string;       // e.g. "C Major — Walking ↑"
    count: number;
    lastPlayedTs: number | null;
  }

  const FAMILY_LABEL: Record<string, string> = {
    plain: 'Plain scale',
    multiOctave: 'Multi-octave',
    consecutive: 'Consecutive groups',
    mirror: 'Mirror groups',
    walkUp: 'Walking ↑',
    walkDown: 'Walking ↓',
    arpeggios: 'Arpeggios',
    agility: 'Agility',
  };

  // Universe entries are dense in (scale, key, family) combos — pick one
  // params per cellKey so we can render the row label and replay later.
  const sampleParamsByCell = $derived.by<Map<string, ExerciseParams>>(() => {
    const m = new Map<string, ExerciseParams>();
    for (const p of generateUniverse($settings)) {
      const k = cellKeyFor(p);
      if (!m.has(k)) m.set(k, p);
    }
    return m;
  });

  function rowLabel(p: ExerciseParams): string {
    const family = cellKeyFor(p).split('|').pop() as string;
    const familyLabel = FAMILY_LABEL[family] ?? family;
    if (family === 'agility') {
      return `${p.tuning.name} — Agility`;
    }
    const root = p.rootName ?? '';
    return `${root} ${p.scale.name} — ${familyLabel}`;
  }

  const ROW_CAP = 50;
  const rows = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    for (const [cellKey, sampleParams] of sampleParamsByCell) {
      const cell = $practiceLog.cells[cellKey];
      out.push({
        cellKey,
        label: rowLabel(sampleParams),
        count: cell?.count ?? 0,
        lastPlayedTs: cell?.lastPlayedTs ?? null,
      });
    }
    // Sort: never-played first, then oldest-played first.
    out.sort((a, b) => {
      if (a.count === 0 && b.count !== 0) return -1;
      if (b.count === 0 && a.count !== 0) return 1;
      if (a.count === 0 && b.count === 0) return a.label.localeCompare(b.label);
      return (a.lastPlayedTs ?? 0) - (b.lastPlayedTs ?? 0);
    });
    return out.slice(0, ROW_CAP);
  });

  function pillText(r: Row): string {
    if (r.count === 0) return 'never';
    const days = Math.floor((Date.now() - (r.lastPlayedTs ?? 0)) / (24 * 60 * 60 * 1000));
    const dayStr = days === 0 ? 'today' : `${days}d`;
    return r.count > 1 ? `${dayStr} · ${r.count}×` : dayStr;
  }

  function pillClass(r: Row): string {
    if (r.count === 0) return 'pill never';
    const days = Math.floor((Date.now() - (r.lastPlayedTs ?? 0)) / (24 * 60 * 60 * 1000));
    if (days > 14) return 'pill old';
    return 'pill fresh';
  }
```

- [ ] **Step 2: Add a click handler**

Add after `pillClass`:

```ts
  function pickRandomFromCell(cellKey: string): void {
    const matches: ExerciseParams[] = [];
    for (const p of generateUniverse($settings)) {
      if (cellKeyFor(p) === cellKey) matches.push(p);
    }
    if (matches.length === 0) return;
    const pick = matches[Math.floor(Math.random() * matches.length)];
    onPick(pick);
    onClose();
  }
```

- [ ] **Step 3: Replace the placeholder list in the template**

In the template, replace this block:

```svelte
  {#if totalSessions === 0}
    <p class="empty">No history yet — click ✓ Done after practicing an exercise to start tracking.</p>
  {:else}
    <p class="placeholder">Neglected list goes here (Task 8).</p>
  {/if}
```

With:

```svelte
  {#if rows.length === 0}
    <p class="empty">No history yet — click ✓ Done after practicing an exercise to start tracking.</p>
  {:else}
    <h3 class="section-title">Neglected first</h3>
    <ul class="rows">
      {#each rows as r (r.cellKey)}
        <li>
          <button
            class="row-btn"
            onclick={() => pickRandomFromCell(r.cellKey)}
            type="button"
          >
            <span class="row-label">{r.label}</span>
            <span class={pillClass(r)}>{pillText(r)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
```

(The empty-state condition changes from `totalSessions === 0` to `rows.length === 0` so the list renders any time the universe has at least one cell.)

- [ ] **Step 4: Add row + pill styles**

In the `<style>` block, replace `.empty, .placeholder { ... }` with:

```css
  .empty {
    color: var(--text-dim);
    font-size: 13px;
    text-align: center;
    padding: 24px 8px;
  }
  .section-title {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 4px 0 8px 0;
  }
  .rows {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .rows li {
    margin: 0;
  }
  .row-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    padding: 8px 4px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  .row-btn:hover {
    background: var(--panel-2);
  }
  .row-label {
    flex: 1;
  }
  .pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }
  .pill.never {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }
  .pill.old {
    background: rgba(253, 224, 71, 0.15);
    color: #d4a72c;
  }
  .pill.fresh {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }
</style>
```

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean; tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/HistoryPanel.svelte
git commit -m "feat(history): HistoryPanel neglected list + pills + row click"
```

---

## Task 9: Manual UI verification gate

**No code changes — verification only.**

- [ ] **Step 1: Run automated gate first**

Run: `npx vitest run`
Expected: 405+ tests pass.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

Run: `npx tsx scripts/scan-layouts.ts`
Expected: 0 issues across 16,150 exercises.

Run: `npm run build`
Expected: clean.

- [ ] **Step 2: Start dev server + open browser**

Run: `npm run dev` (or use the existing preview MCP setup).

- [ ] **Step 3: Verify Done/Skip buttons**

- Confirm bottom nav row shows `←  ✓ Done  Skip →` (green / purple).
- Click `✓ Done` — exercise advances; clicking it again increments stats for the new exercise.
- Click `Skip →` — exercise advances; no log entry created.
- Press `D` key — same as Done. Press `N` — same as Skip.

- [ ] **Step 4: Verify HistoryPanel**

- Click `📊` topbar button — panel slides out.
- Header shows: Sessions, Coverage %, Today counts.
- After a few `Done` clicks, Sessions and Today increment, Coverage % grows.
- Neglected list shows the universe of cells, never-played first.
- Pills: red `never` for unplayed, green `Nd` for recent, yellow `Nd` for >14d.

- [ ] **Step 5: Verify row click**

- Click a never-played row. Panel closes, exercise loads matching that scale/key/family.
- Click a played row. Same — loads a random exercise from that cell.

- [ ] **Step 6: Verify Clear button**

- Click `Clear` in panel header. Confirm prompt appears.
- Confirm — log clears, totals reset to 0, list shows empty state.

- [ ] **Step 7: Verify settings interaction**

- Open Settings, disable some scales. Reopen History. Confirm rows for disabled scales disappear and coverage % adjusts.
- Re-enable scales. Confirm rows reappear with prior counts preserved (no data loss on disable).

- [ ] **Step 8: Verify persistence**

- Reload the page. Confirm totals, cells, and recent events persist.

- [ ] **Step 9: If anything looks wrong, report. Otherwise no commit.**

---

## Task 10: Update `docs/plan.md`

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Add the completion entry**

In the "Recent additions" section of `docs/plan.md`, add a new bullet at the top:

```markdown
- [x] **Practice history & stats.** New `📊` topbar button opens a slide-out panel listing the most-neglected (scale, key, variant family) cells. Bottom nav row gains a `✓ Done` button (green) alongside the renamed `Skip →` (purple); `D` key shortcut logs + advances. Aggregate stored per cell in `bass-practice:practice-log:v1` with per-hand/per-rhythm/per-variant sub-counters and a 100-entry recent-events buffer. Coverage % computed against `generateUniverse($settings)`. Spec: [docs/superpowers/specs/2026-05-31-practice-history-design.md](superpowers/specs/2026-05-31-practice-history-design.md). New modules: [src/stores/practice-log.ts](../src/stores/practice-log.ts), [src/components/HistoryPanel.svelte](../src/components/HistoryPanel.svelte).
```

- [ ] **Step 2: Update the State line**

Find the State line near the top (currently `389 unit tests passing`). Update test count based on `npx vitest run` output from Task 9 (~405 expected: 389 + 16 new).

- [ ] **Step 3: Remove "Exercise history / streaks / stats" from Future passes**

Find:

```markdown
- Exercise history / streaks / stats.
```

Replace with:

```markdown
- Streaks / gamification (history & stats shipped — streaks deferred).
```

(Or remove entirely if streaks aren't planned at all. Per the user's explicit "no streaks", remove the line entirely.)

- [ ] **Step 4: Commit**

```bash
git add docs/plan.md
git commit -m "docs(history): mark practice history & stats complete in plan.md"
```

---

## Self-review checklist

- [ ] Every section of the spec is covered:
  - Data model (Tasks 1–5)
  - Done/Skip button bar (Task 6)
  - Topbar + panel mount (Task 7)
  - Neglected list + row click + clear (Tasks 7 + 8)
  - Manual verification (Task 9)
  - Docs (Task 10)
- [ ] Function names match across tasks (`cellKeyFor`, `familyForVariant`, `variantIdFor`, `recordDone`, `todayCount`, `coverage`, `clear`).
- [ ] No `TBD` / `TODO` / placeholder strings in code.
- [ ] Storage key explicit: `bass-practice:practice-log:v1`.
- [ ] Recent-events cap explicit: `RECENT_CAP = 100`.
- [ ] Row cap explicit: `ROW_CAP = 50`.
- [ ] Pill thresholds explicit: never / >14d / ≤14d.
- [ ] Coverage % uses enabled cell keys from `generateUniverse($settings)`.
- [ ] No retroactive logging — Done is the only entry point.
- [ ] Existing `history.ts` (picker exclusion ring) untouched.
