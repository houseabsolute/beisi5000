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
