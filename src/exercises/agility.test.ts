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
      { string: 0, fret: 1 },
      { string: 1, fret: 2 },
      { string: 2, fret: 3 },
      { string: 3, fret: 4 },
      { string: 3, fret: 1 },
      { string: 2, fret: 2 },
      { string: 1, fret: 3 },
      { string: 0, fret: 4 },
    ]);
  });

  test('First X reverse (startFret=1, startString=0) on 4-string', () => {
    const seq = bigXSequence(TUNINGS.fourStringEADG, 0, 'reverse');
    const first = seq.slice(0, 8).map(n => ({ string: n.string, fret: n.fret }));
    expect(first).toEqual([
      { string: 3, fret: 4 },
      { string: 2, fret: 3 },
      { string: 1, fret: 2 },
      { string: 0, fret: 1 },
      { string: 0, fret: 4 },
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
    const topX = seq.slice(88, 96);
    expect(topX[0]).toMatchObject({ string: 0, fret: 12 });
    expect(topX[3]).toMatchObject({ string: 3, fret: 15 });
  });

  test('5-string BEADG startString=0 forward — 184 notes (uses lowest 4 strings = B,E,A,D)', () => {
    const seq = bigXSequence(TUNINGS.fiveStringBEADG, 0, 'forward');
    expect(seq).toHaveLength(184);
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
      { string: 0, fret: 1 },
      { string: 1, fret: 2 },
      { string: 0, fret: 3 },
      { string: 1, fret: 4 },
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
      { string: 1, fret: 4 },
      { string: 0, fret: 3 },
      { string: 1, fret: 2 },
      { string: 0, fret: 1 },
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
