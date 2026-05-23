import { describe, test, expect } from 'vitest';
import { emitAlphaTex } from './alphatex-emitter';
import { TUNINGS } from '../theory/tunings';
import type { NoteSequence } from '../exercises/types';
import type { AccidentalKind } from '../theory/keys';

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

describe('emitAlphaTex — autoClef', () => {
  function makeSeq(midis: number[]): NoteSequence {
    return midis.map((midi) => ({
      string: 0,
      fret: 0,
      midi,
      durationDenominator: 8,
    }));
  }

  test('autoClef off → no \\clef switches in body', () => {
    // A sequence with very high notes that WOULD trigger a switch.
    const seq = makeSeq([60, 62, 64, 65, 67, 69, 71, 72]);
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG, { autoClef: false });
    // Header has the initial \clef F4, but the body should have no further \clef tokens.
    const bodyClefSwitches = (tex.split('\n.\n')[1]?.match(/\\clef/g) || []).length;
    expect(bodyClefSwitches).toBe(0);
  });

  test('F Major Walking 5ths ↓ switches to treble at the high-note bar (not earlier)', () => {
    // The desc half of F Major walking 5ths down (rooted at F2 = MIDI 41)
    // reaches C4 (60), B♭3 (58), and A3 (57) on consecutive beats 8/9/10.
    // With autoClef on, those 3 beats trigger a switch — and the switch
    // should land at bar 2 (beats 8-11, where the run starts), NOT one
    // bar earlier. The low opening bars must remain bass.
    const seq = makeSeq([
      // Asc half (14 low notes — beats 0-6)
      41, 34, 43, 36, 45, 38, 46, 40, 48, 41, 50, 43, 52, 45,
      // Boundary pair (2 notes — beat 7)
      53, 46,
      // Desc half — first 3 pairs reach C4, B♭3, A3 (beats 8, 9, 10 = high)
      53, 60, 52, 58, 50, 57,
      // Remaining desc + final (low — beats 11+)
      48, 55, 46, 53, 45, 52, 43, 50, 41, 48, 41,
    ]);
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG, { autoClef: true });
    // Body is everything after the `.` separator. Bars are split by `|`.
    const body = tex.split('\n.\n')[1] ?? '';
    const bars = body.split('|').map((s) => s.trim());
    // Bar 0 and bar 1 are the asc/boundary bars (all low) — no clef switch.
    expect(bars[0]).not.toContain('\\clef');
    expect(bars[1]).not.toContain('\\clef');
    // Bar 2 contains beats 8-11 with C4, B♭3, A3 — should switch to treble.
    expect(bars[2]).toContain('\\clef G2');
    // The remaining low bars switch back to bass.
    expect(body).toContain('\\clef F4');
  });

  test('low-only sequence stays in bass clef (no body \\clef)', () => {
    // All notes below A3.
    const seq = makeSeq([36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 50, 48, 45, 41]);
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG, { autoClef: true });
    const bodyClefSwitches = (tex.split('\n.\n')[1]?.match(/\\clef/g) || []).length;
    expect(bodyClefSwitches).toBe(0);
  });
});

describe('emitAlphaTex — mixed durations', () => {
  test('uniform quarter notes emit a single :4 prefix', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 4 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 4 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 4 },
      { string: 1, fret: 8, midi: 41, durationDenominator: 4 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    expect(tex).toContain(':4');
    // Only ONE :4 token (no per-note duration changes).
    const matches = tex.match(/:4(?:\s|$)/g) || [];
    expect(matches.length).toBe(1);
  });

  test('uniform eighth notes emit a single :8 prefix', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 8 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    const matches = tex.match(/:8(?:\s|$)/g) || [];
    expect(matches.length).toBe(1);
  });

  test('mixed 8ss pattern emits both :8 and :16 prefixes', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8 },
      { string: 1, fret: 4, midi: 37, durationDenominator: 16 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 16 },
      { string: 1, fret: 6, midi: 39, durationDenominator: 8 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 16 },
      { string: 1, fret: 8, midi: 41, durationDenominator: 16 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    expect(tex).toContain(':8');
    expect(tex).toContain(':16');
  });

  test('triplet notes emit {tu 3} on every note', () => {
    const seq: NoteSequence = [
      { string: 1, fret: 3, midi: 36, durationDenominator: 8, tuplet: 3 },
      { string: 1, fret: 5, midi: 38, durationDenominator: 8, tuplet: 3 },
      { string: 1, fret: 7, midi: 40, durationDenominator: 8, tuplet: 3 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG);
    const matches = tex.match(/\{tu 3\}/g) || [];
    expect(matches.length).toBe(3);
  });

  test('triplet combined with spelling — both properties in one {} block', () => {
    const spelling = new Map<number, AccidentalKind>();
    spelling.set(1, 'sharp');
    const seq: NoteSequence = [
      // MIDI 37 → pitch class 1 = C♯
      { string: 1, fret: 4, midi: 37, durationDenominator: 8, tuplet: 3 },
    ];
    const tex = emitAlphaTex(seq, TUNINGS.fourStringEADG, { spelling });
    // BOTH acc and tu inside ONE {} block (not two separate blocks).
    expect(tex).toMatch(/\{[^}]*acc\s+forceSharp[^}]*tu\s+3[^}]*\}|\{[^}]*tu\s+3[^}]*acc\s+forceSharp[^}]*\}/);
    // Should NOT have two separate {} blocks
    expect(tex).not.toMatch(/\}\s*\{/);
  });
});
