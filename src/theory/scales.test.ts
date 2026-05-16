import { describe, test, expect } from 'vitest';
import { SCALES, scaleNotes, SCALE_CATEGORIES } from './scales';
import { pitchClass } from './notes';

describe('SCALES registry', () => {
  test('contains major', () => {
    expect(SCALES.major).toBeDefined();
    expect(SCALES.major.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  test('contains the three minors', () => {
    expect(SCALES.naturalMinor.intervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(SCALES.harmonicMinor.intervals).toEqual([0, 2, 3, 5, 7, 8, 11]);
    expect(SCALES.melodicMinor.intervals).toEqual([0, 2, 3, 5, 7, 9, 11]);
  });

  test('contains the 5 distinct church modes (Ionian = Major, Aeolian = Natural Minor; both excluded)', () => {
    expect(SCALES.dorian.intervals).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(SCALES.phrygian.intervals).toEqual([0, 1, 3, 5, 7, 8, 10]);
    expect(SCALES.lydian.intervals).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(SCALES.mixolydian.intervals).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(SCALES.locrian.intervals).toEqual([0, 1, 3, 5, 6, 8, 10]);
    expect((SCALES as Record<string, unknown>).ionian).toBeUndefined();
    expect((SCALES as Record<string, unknown>).aeolian).toBeUndefined();
  });

  test('contains pentatonic family', () => {
    expect(SCALES.majorPentatonic.intervals).toEqual([0, 2, 4, 7, 9]);
    expect(SCALES.minorPentatonic.intervals).toEqual([0, 3, 5, 7, 10]);
    expect(SCALES.blues.intervals).toEqual([0, 3, 5, 6, 7, 10]);
  });

  test('contains chromatic and both octatonics', () => {
    expect(SCALES.chromatic.intervals).toHaveLength(12);
    expect(SCALES.octatonicWholeHalf.intervals).toHaveLength(8);
    expect(SCALES.octatonicHalfWhole.intervals).toHaveLength(8);
    expect(SCALES.octatonicWholeHalf.intervals).toEqual([0, 2, 3, 5, 6, 8, 9, 11]);
    expect(SCALES.octatonicHalfWhole.intervals).toEqual([0, 1, 3, 4, 6, 7, 9, 10]);
  });

  test('contains modes of harmonic and melodic minor', () => {
    expect(SCALES.phrygianDominant.intervals).toEqual([0, 1, 4, 5, 7, 8, 10]);
    expect(SCALES.lydianDominant.intervals).toEqual([0, 2, 4, 6, 7, 9, 10]);
    expect(SCALES.altered.intervals).toEqual([0, 1, 3, 4, 6, 8, 10]);
  });

  test('contains exotic pentatonics', () => {
    expect(SCALES.hirajoshi).toBeDefined();
    expect(SCALES.inSen).toBeDefined();
    expect(SCALES.iwato).toBeDefined();
    expect(SCALES.kumoi).toBeDefined();
    expect(SCALES.egyptian).toBeDefined();
  });

  test('every scale starts on degree 0', () => {
    for (const scale of Object.values(SCALES)) {
      expect(scale.intervals[0]).toBe(0);
    }
  });

  test('every scale has a name and category', () => {
    for (const scale of Object.values(SCALES)) {
      expect(scale.name).toBeTruthy();
      expect(scale.category).toBeTruthy();
    }
  });
});

describe('scaleNotes', () => {
  test('C major yields C D E F G A B', () => {
    expect(scaleNotes(SCALES.major, pitchClass('C'))).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  test('G major yields G A B C D E F#', () => {
    expect(scaleNotes(SCALES.major, pitchClass('G'))).toEqual([7, 9, 11, 0, 2, 4, 6]);
  });

  test('A natural minor yields A B C D E F G', () => {
    expect(scaleNotes(SCALES.naturalMinor, pitchClass('A'))).toEqual([
      9, 11, 0, 2, 4, 5, 7,
    ]);
  });

  test('E phrygian yields E F G A B C D', () => {
    expect(scaleNotes(SCALES.phrygian, pitchClass('E'))).toEqual([
      4, 5, 7, 9, 11, 0, 2,
    ]);
  });

  test('chromatic from C is all 12 notes', () => {
    expect(scaleNotes(SCALES.chromatic, 0)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });
});

describe('SCALE_CATEGORIES', () => {
  test('groups scales by category', () => {
    expect(SCALE_CATEGORIES.major).toContain(SCALES.major);
    expect(SCALE_CATEGORIES.minor).toContain(SCALES.naturalMinor);
    expect(SCALE_CATEGORIES.minor).toContain(SCALES.harmonicMinor);
    expect(SCALE_CATEGORIES.minor).toContain(SCALES.melodicMinor);
    expect(SCALE_CATEGORIES.modes).toContain(SCALES.dorian);
    expect(SCALE_CATEGORIES.pentatonic).toContain(SCALES.majorPentatonic);
    expect(SCALE_CATEGORIES.pentatonic).toContain(SCALES.blues);
    expect(SCALE_CATEGORIES.chromatic).toContain(SCALES.chromatic);
    expect(SCALE_CATEGORIES.octatonic).toContain(SCALES.octatonicWholeHalf);
  });

  test('every scale appears in exactly one category', () => {
    const all = Object.values(SCALES);
    for (const s of all) {
      const found = Object.values(SCALE_CATEGORIES).filter((arr) => arr.includes(s));
      expect(found.length).toBe(1);
    }
  });
});
