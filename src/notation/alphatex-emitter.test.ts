import { describe, test, expect } from 'vitest';
import { emitAlphaTex } from './alphatex-emitter';
import { TUNINGS } from '../theory/tunings';
import type { NoteSequence } from '../exercises/types';

const cMajorAscending: NoteSequence = [
  { string: 1, fret: 3, midi: 36, durationDenominator: 8 }, // C2
  { string: 1, fret: 5, midi: 38, durationDenominator: 8 }, // D2
  { string: 2, fret: 2, midi: 40, durationDenominator: 8 }, // E2
  { string: 2, fret: 3, midi: 41, durationDenominator: 8 }, // F2
  { string: 2, fret: 5, midi: 43, durationDenominator: 8 }, // G2
  { string: 3, fret: 2, midi: 45, durationDenominator: 8 }, // A2
  { string: 3, fret: 4, midi: 47, durationDenominator: 8 }, // B2
  { string: 3, fret: 5, midi: 48, durationDenominator: 8 }, // C3
];

describe('emitAlphaTex', () => {
  test('emits tuning highest-to-lowest for 4-string EADG wrapped in parens', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain('\\tuning (G2 D2 A1 E1)');
  });

  test('emits tuning highest-to-lowest for 5-string BEADG wrapped in parens', () => {
    const tex = emitAlphaTex([], TUNINGS.fiveStringBEADG);
    expect(tex).toContain('\\tuning (G2 D2 A1 E1 B0)');
  });

  test('emits tuning highest-to-lowest for 6-string BEADGC wrapped in parens', () => {
    const tex = emitAlphaTex([], TUNINGS.sixStringBEADGC);
    expect(tex).toContain('\\tuning (C3 G2 D2 A1 E1 B0)');
  });

  test('emits \\ks <keyName> in body for flat key signatures', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      keySignature: -2,
    });
    expect(tex).toContain('\\ks Bb');
    expect(tex).not.toContain('\\ks -2');
  });

  test('emits \\ks <keyName> for sharp key signatures', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      keySignature: 6,
    });
    expect(tex).toContain('\\ks F#');
  });

  test('does not emit \\ks for 0 / no keySignature', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).not.toContain('\\ks');
  });

  test('includes tempo', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      tempo: 100,
    });
    expect(tex).toContain('\\tempo 100');
  });

  test('default tempo when not provided', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toMatch(/\\tempo \d+/);
  });

  test('emits both score and tabs by default', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain('staff{score tabs}');
  });

  test('score-only when displayMode is score', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      displayMode: 'score',
    });
    expect(tex).toContain('staff{score}');
    expect(tex).not.toContain('staff{score tabs}');
    expect(tex).not.toContain('staff{tabs}');
  });

  test('tabs-only when displayMode is tabs', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      displayMode: 'tabs',
    });
    expect(tex).toContain('staff{tabs}');
    expect(tex).not.toContain('staff{score tabs}');
    expect(tex).not.toContain('staff{score}');
  });

  test('emits notes as fret.string with AlphaTex 1-indexed string ordering', () => {
    // My index 1 (A string) -> AlphaTex string 3 on 4-string bass
    // My index 2 (D string) -> AlphaTex string 2
    // My index 3 (G string) -> AlphaTex string 1
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain('3.3'); // C(A,3) -> fret 3 string 3
    expect(tex).toContain('5.3'); // D(A,5)
    expect(tex).toContain('2.2'); // E(D,2)
    expect(tex).toContain('5.1'); // C(G,5)
  });

  test('emits eighth-note duration prefix', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain(':8');
  });

  test('groups notes into 4/4 measures separated by |', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    // 8 eighth notes = 1 full measure, no | needed within
    // 16 notes = 2 measures separated by |
    const sixteen = [...cMajorAscending, ...cMajorAscending];
    const tex16 = emitAlphaTex(sixteen, TUNINGS.fourStringEADG);
    expect(tex16).toContain('|');
  });

  test('includes title when provided', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG, {
      title: 'C Major Test',
    });
    expect(tex).toContain('C Major Test');
  });

  test('output is non-empty even for empty sequence', () => {
    const tex = emitAlphaTex([], TUNINGS.fourStringEADG);
    expect(tex.length).toBeGreaterThan(0);
  });

  test('emits bass clef', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain('\\clef F4');
  });

  test('emits bass instrument program', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    expect(tex).toContain('\\instrument 33');
  });

  test('pads incomplete final measure with rests (15 eighth notes -> 1 rest)', () => {
    // 15 notes of eighth-note duration = 1 full measure (8) + 7 in next measure
    const fifteen: NoteSequence = [];
    for (let i = 0; i < 15; i++) {
      fifteen.push({
        string: 1,
        fret: 3 + (i % 4),
        midi: 36 + i,
        durationDenominator: 8,
      });
    }
    const tex = emitAlphaTex(fifteen, TUNINGS.fourStringEADG);
    // Body should have exactly one ' r' (rest token) padding the last measure
    const restCount = (tex.match(/\br\b/g) || []).length;
    expect(restCount).toBe(1);
    // The body should end with the rest
    expect(tex.trim().endsWith('r')).toBe(true);
  });

  test('full-measure sequence has no rest padding (8 eighth notes)', () => {
    const tex = emitAlphaTex(cMajorAscending, TUNINGS.fourStringEADG);
    const restCount = (tex.match(/(\s|^)r(\s|$)/g) || []).length;
    expect(restCount).toBe(0);
  });
});
