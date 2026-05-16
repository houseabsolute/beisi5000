import { describe, test, expect } from 'vitest';
import { TUNINGS, stringFretToMidi, midiToPositions } from './tunings';

describe('TUNINGS', () => {
  test('4-string EADG', () => {
    expect(TUNINGS.fourStringEADG.openMidi).toEqual([28, 33, 38, 43]);
    expect(TUNINGS.fourStringEADG.stringCount).toBe(4);
  });
  test('5-string BEADG (low B)', () => {
    expect(TUNINGS.fiveStringBEADG.openMidi).toEqual([23, 28, 33, 38, 43]);
    expect(TUNINGS.fiveStringBEADG.stringCount).toBe(5);
  });
  test('5-string EADGC (high C)', () => {
    expect(TUNINGS.fiveStringEADGC.openMidi).toEqual([28, 33, 38, 43, 48]);
    expect(TUNINGS.fiveStringEADGC.stringCount).toBe(5);
  });
  test('6-string BEADGC', () => {
    expect(TUNINGS.sixStringBEADGC.openMidi).toEqual([23, 28, 33, 38, 43, 48]);
    expect(TUNINGS.sixStringBEADGC.stringCount).toBe(6);
  });
  test('every tuning has matching openNoteNames length', () => {
    for (const t of Object.values(TUNINGS)) {
      expect(t.openNoteNames.length).toBe(t.openMidi.length);
      expect(t.openNoteNames.length).toBe(t.stringCount);
    }
  });
});

describe('stringFretToMidi', () => {
  test('4-string E open is MIDI 28', () => {
    expect(stringFretToMidi(TUNINGS.fourStringEADG, 0, 0)).toBe(28);
  });
  test('4-string A string fret 3 is C2 (MIDI 36)', () => {
    expect(stringFretToMidi(TUNINGS.fourStringEADG, 1, 3)).toBe(36);
  });
  test('4-string G string fret 12 is G3 (MIDI 55)', () => {
    expect(stringFretToMidi(TUNINGS.fourStringEADG, 3, 12)).toBe(55);
  });
  test('5-string BEADG B open is MIDI 23', () => {
    expect(stringFretToMidi(TUNINGS.fiveStringBEADG, 0, 0)).toBe(23);
  });
  test('throws on negative fret', () => {
    expect(() => stringFretToMidi(TUNINGS.fourStringEADG, 0, -1)).toThrow();
  });
  test('throws on invalid string index', () => {
    expect(() => stringFretToMidi(TUNINGS.fourStringEADG, 4, 0)).toThrow();
    expect(() => stringFretToMidi(TUNINGS.fourStringEADG, -1, 0)).toThrow();
  });
});

describe('midiToPositions', () => {
  test('finds open low E on 4-string', () => {
    const positions = midiToPositions(TUNINGS.fourStringEADG, 28);
    expect(positions).toContainEqual({ string: 0, fret: 0 });
  });

  test('A1 (MIDI 33) appears on E string fret 5 and A string open', () => {
    const positions = midiToPositions(TUNINGS.fourStringEADG, 33);
    expect(positions).toContainEqual({ string: 0, fret: 5 });
    expect(positions).toContainEqual({ string: 1, fret: 0 });
  });

  test('G2 (MIDI 43) appears on E(15), A(10), D(5), G(0)', () => {
    const positions = midiToPositions(TUNINGS.fourStringEADG, 43, { maxFret: 24 });
    expect(positions).toContainEqual({ string: 0, fret: 15 });
    expect(positions).toContainEqual({ string: 1, fret: 10 });
    expect(positions).toContainEqual({ string: 2, fret: 5 });
    expect(positions).toContainEqual({ string: 3, fret: 0 });
  });

  test('returns empty for note below lowest open string', () => {
    expect(midiToPositions(TUNINGS.fourStringEADG, 27)).toEqual([]);
  });

  test('respects maxFret', () => {
    // C3 = MIDI 48. On EADG, only G(5) and D(10) reachable within maxFret 12.
    const positions = midiToPositions(TUNINGS.fourStringEADG, 48, { maxFret: 12 });
    expect(positions).toContainEqual({ string: 3, fret: 5 });
    expect(positions).toContainEqual({ string: 2, fret: 10 });
    expect(positions.find((p) => p.string === 1)).toBeUndefined();
    expect(positions.find((p) => p.string === 0)).toBeUndefined();
  });

  test('positions sorted by string ascending', () => {
    const positions = midiToPositions(TUNINGS.fourStringEADG, 43);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].string).toBeGreaterThan(positions[i - 1].string);
    }
  });
});
