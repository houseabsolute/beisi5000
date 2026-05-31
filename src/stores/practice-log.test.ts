import { describe, test, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { practiceLog } from './practice-log';
import { familyForVariant, cellKeyFor, variantIdFor } from './practice-log';
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
