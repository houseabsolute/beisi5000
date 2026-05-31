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
