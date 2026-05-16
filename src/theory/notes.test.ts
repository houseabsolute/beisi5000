import { describe, test, expect } from 'vitest';
import {
  pitchClass,
  addSemitones,
  pitchClassName,
  midiPitchClass,
  midiOctave,
  midiOf,
} from './notes';

describe('pitchClass', () => {
  test('C is 0', () => expect(pitchClass('C')).toBe(0));
  test('C# is 1', () => expect(pitchClass('C#')).toBe(1));
  test('Db is 1', () => expect(pitchClass('Db')).toBe(1));
  test('D is 2', () => expect(pitchClass('D')).toBe(2));
  test('B is 11', () => expect(pitchClass('B')).toBe(11));
  test('Cb wraps to 11', () => expect(pitchClass('Cb')).toBe(11));
  test('B# wraps to 0', () => expect(pitchClass('B#')).toBe(0));
  test('case insensitive', () => expect(pitchClass('c')).toBe(0));
  test('accepts unicode sharp/flat', () => {
    expect(pitchClass('F♯')).toBe(6);
    expect(pitchClass('B♭')).toBe(10);
  });
  test('rejects invalid letter', () => expect(() => pitchClass('H')).toThrow());
});

describe('addSemitones', () => {
  test('zero is identity', () => expect(addSemitones(0, 0)).toBe(0));
  test('C + 7 = G', () => expect(addSemitones(0, 7)).toBe(7));
  test('B + 1 wraps to C', () => expect(addSemitones(11, 1)).toBe(0));
  test('C - 1 wraps to B', () => expect(addSemitones(0, -1)).toBe(11));
  test('handles multiples of 12', () => expect(addSemitones(0, 24)).toBe(0));
  test('handles large positives', () => expect(addSemitones(0, 13)).toBe(1));
  test('handles large negatives', () => expect(addSemitones(0, -13)).toBe(11));
});

describe('pitchClassName', () => {
  test('0 with sharp preference is C', () =>
    expect(pitchClassName(0, 'sharp')).toBe('C'));
  test('1 with sharp preference is C#', () =>
    expect(pitchClassName(1, 'sharp')).toBe('C#'));
  test('1 with flat preference is Db', () =>
    expect(pitchClassName(1, 'flat')).toBe('Db'));
  test('10 with sharp preference is A#', () =>
    expect(pitchClassName(10, 'sharp')).toBe('A#'));
  test('10 with flat preference is Bb', () =>
    expect(pitchClassName(10, 'flat')).toBe('Bb'));
});

describe('midi math', () => {
  test('A4 (MIDI 69) is pitch class 9 (A)', () =>
    expect(midiPitchClass(69)).toBe(9));
  test('C4 (MIDI 60) is pitch class 0 (C)', () =>
    expect(midiPitchClass(60)).toBe(0));
  test('A4 is octave 4', () => expect(midiOctave(69)).toBe(4));
  test('C4 is octave 4', () => expect(midiOctave(60)).toBe(4));
  test('B3 (MIDI 59) is octave 3', () => expect(midiOctave(59)).toBe(3));
  test('C-1 (MIDI 0) is octave -1', () => expect(midiOctave(0)).toBe(-1));

  test('midiOf("C", 4) is 60', () => expect(midiOf('C', 4)).toBe(60));
  test('midiOf("A", 4) is 69', () => expect(midiOf('A', 4)).toBe(69));
  test('midiOf("E", 1) is 28 (low bass E)', () =>
    expect(midiOf('E', 1)).toBe(28));
  test('midiOf("B", 0) is 23 (low B on 5-string)', () =>
    expect(midiOf('B', 0)).toBe(23));
});
