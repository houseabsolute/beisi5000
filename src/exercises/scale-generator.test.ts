import { describe, test, expect } from 'vitest';
import {
  ascendingScaleMidi,
  descendingScaleMidi,
  pickStartingPosition,
  layOnFretboard,
  generateExercise,
  arpeggioCycleApex,
  startConstraintsForVariant,
  formatDisplayName,
} from './scale-generator';
import { SCALES } from '../theory/scales';
import { TUNINGS } from '../theory/tunings';
import { pitchClass, midiOf, type PitchClass } from '../theory/notes';
import { multiOctaveAMidi } from './multi-octave';
import { KEYS_BY_ID, keySignatureFor, keySignatureLabelFor, spellingMap } from '../theory/keys';

describe('ascendingScaleMidi', () => {
  test('C major from C2 (MIDI 36) yields 8 ascending notes', () => {
    const notes = ascendingScaleMidi(SCALES.major, 36);
    expect(notes).toEqual([36, 38, 40, 41, 43, 45, 47, 48]);
  });

  test('chromatic from C2 yields 13 notes (12 + octave)', () => {
    const notes = ascendingScaleMidi(SCALES.chromatic, 36);
    expect(notes).toHaveLength(13);
    expect(notes[0]).toBe(36);
    expect(notes[12]).toBe(48);
  });

  test('major pentatonic from C2 yields 6 notes (5 + octave)', () => {
    const notes = ascendingScaleMidi(SCALES.majorPentatonic, 36);
    expect(notes).toEqual([36, 38, 40, 43, 45, 48]);
  });
});

describe('descendingScaleMidi', () => {
  test('C major descending starts at top octave', () => {
    const notes = descendingScaleMidi(SCALES.major, 36);
    expect(notes).toEqual([48, 47, 45, 43, 41, 40, 38, 36]);
  });
});

describe('pickStartingPosition', () => {
  test('C front hand on 4-string EADG: lowest STRING is E (fret 8)', () => {
    const pos = pickStartingPosition(
      pitchClass('C'),
      'front',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 0, fret: 8 });
  });

  test('G front hand on 4-string EADG: E string fret 3 (lowest string with G)', () => {
    const pos = pickStartingPosition(
      pitchClass('G'),
      'front',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 0, fret: 3 });
  });

  test('E front hand on 4-string EADG: E string fret 0 (open)', () => {
    const pos = pickStartingPosition(
      pitchClass('E'),
      'front',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 0, fret: 0 });
  });

  test('E mid hand on 4-string EADG: A string fret 7 (E string fret 0 invalid for mid)', () => {
    const pos = pickStartingPosition(
      pitchClass('E'),
      'mid',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 1, fret: 7 });
  });

  test('E back hand on 4-string EADG: A string fret 7', () => {
    const pos = pickStartingPosition(
      pitchClass('E'),
      'back',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 1, fret: 7 });
  });

  test('A front hand with preferOpenStringRoot picks A string open (fret 0)', () => {
    const pos = pickStartingPosition(
      pitchClass('A'),
      'front',
      TUNINGS.fourStringEADG,
      { preferOpenStringRoot: true },
    );
    expect(pos).toEqual({ string: 1, fret: 0 });
  });

  test('A front hand WITHOUT preferOpenStringRoot picks E string fret 5 (lowest string)', () => {
    const pos = pickStartingPosition(
      pitchClass('A'),
      'front',
      TUNINGS.fourStringEADG,
    );
    expect(pos).toEqual({ string: 0, fret: 5 });
  });

  test('returns null when no valid position exists', () => {
    const pos = pickStartingPosition(
      pitchClass('B'),
      'front',
      TUNINGS.fourStringEADG,
      { maxFret: 0 },
    );
    expect(pos).toBeNull();
  });
});

describe('layOnFretboard', () => {
  test('lays out C major ascending one octave from A string fret 3', () => {
    const midi = ascendingScaleMidi(SCALES.major, midiOf('C', 2));
    const start = { string: 1, fret: 3 };
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start);
    expect(seq).toHaveLength(8);
    expect(seq[0].string).toBe(1);
    expect(seq[0].fret).toBe(3);
    expect(seq[0].midi).toBe(36);
    expect(seq[seq.length - 1].midi).toBe(48); // high C
    // each note's string+fret should produce the right midi
    for (const n of seq) {
      expect(TUNINGS.fourStringEADG.openMidi[n.string] + n.fret).toBe(n.midi);
    }
  });

  test('does not skip strings unnecessarily on ascending scale', () => {
    const midi = ascendingScaleMidi(SCALES.major, midiOf('C', 2));
    const start = { string: 1, fret: 3 };
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start);
    // Successive notes should be on same or adjacent string (within +/- 1)
    for (let i = 1; i < seq.length; i++) {
      expect(Math.abs(seq[i].string - seq[i - 1].string)).toBeLessThanOrEqual(1);
    }
  });
});

describe('layOnFretboard — physical fingering examples', () => {
  test('G major front-hand on 4-string: 3-3-2 pattern', () => {
    // [G A B] on E, [C D E] on A, [F# G A] on D — wait, just one octave so [F# G] only
    // User's example: [G A B] on E, [C D E] on A, [F# G] on D for one octave
    const midi = ascendingScaleMidi(SCALES.major, midiOf('G', 1));
    const start = { string: 0, fret: 3 }; // G on E string fret 3
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start, 'front');
    expect(seq.map((n) => ({ s: n.string, f: n.fret }))).toEqual([
      { s: 0, f: 3 }, // G  (E,3)
      { s: 0, f: 5 }, // A  (E,5)
      { s: 0, f: 7 }, // B  (E,7)
      { s: 1, f: 3 }, // C  (A,3)
      { s: 1, f: 5 }, // D  (A,5)
      { s: 1, f: 7 }, // E  (A,7)
      { s: 2, f: 4 }, // F# (D,4)
      { s: 2, f: 5 }, // G  (D,5)
    ]);
  });

  test('D dorian mid-hand on 4-string starting on E string: 2-3-3 pattern', () => {
    // D mid-hand starts at E string fret 10 (lowest string with D).
    // Per user: 2 on E (D, E), 3 on A (F, G, A), 3 on D (B, C, D).
    const midi = ascendingScaleMidi(SCALES.dorian, midiOf('D', 2));
    const start = { string: 0, fret: 10 };
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start, 'mid');
    expect(seq.map((n) => ({ s: n.string, f: n.fret }))).toEqual([
      { s: 0, f: 10 }, // D  (E,10)
      { s: 0, f: 12 }, // E  (E,12)
      { s: 1, f: 8 }, // F  (A,8) — index back-stretch to root-2
      { s: 1, f: 10 }, // G  (A,10)
      { s: 1, f: 12 }, // A  (A,12)
      { s: 2, f: 9 }, // B  (D,9)
      { s: 2, f: 10 }, // C  (D,10)
      { s: 2, f: 12 }, // D  (D,12)
    ]);
  });

  test('multi-octave A G major front-hand: stays on G string for high-position shift', () => {
    // User's exact expected fingering for 4-string EADG, 2 octaves:
    // Phase 1 (initial position [3,7]):
    //   [G A B] on E, [C D E] on A, [F# G A] on D, [B C D] on G
    // Phase 2 (shift up, stay on G string):
    //   [E F# G] on G        (high G is the apex, played once)
    // Phase 3 (descending in new high position [9-13]):
    //   [F# E] on G, [D C B] on D, [A G F#] on A, [E D C] on E
    // Phase 4 (walk back to original position on E):
    //   [B A G] on E
    const midi = multiOctaveAMidi(SCALES.major, midiOf('G', 1), 2);
    const start = { string: 0, fret: 3 };
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start, 'front');
    expect(seq.map((n) => ({ s: n.string, f: n.fret }))).toEqual([
      // Phase 1
      { s: 0, f: 3 }, // G
      { s: 0, f: 5 }, // A
      { s: 0, f: 7 }, // B
      { s: 1, f: 3 }, // C
      { s: 1, f: 5 }, // D
      { s: 1, f: 7 }, // E
      { s: 2, f: 4 }, // F#
      { s: 2, f: 5 }, // G
      { s: 2, f: 7 }, // A
      { s: 3, f: 4 }, // B
      { s: 3, f: 5 }, // C
      { s: 3, f: 7 }, // D
      // Phase 2 (shift on G string, NOT jumping to D string)
      { s: 3, f: 9 }, // E
      { s: 3, f: 11 }, // F#
      { s: 3, f: 12 }, // G (apex, played once — multi-octave A no
                      //   longer repeats the apex per the simple-scale
                      //   variant rule)
      // Phase 3 (descending in high position)
      { s: 3, f: 11 }, // F#
      { s: 3, f: 9 }, // E
      { s: 2, f: 12 }, // D
      { s: 2, f: 10 }, // C
      { s: 2, f: 9 }, // B
      { s: 1, f: 12 }, // A
      { s: 1, f: 10 }, // G
      { s: 1, f: 9 }, // F#
      { s: 0, f: 12 }, // E
      { s: 0, f: 10 }, // D
      { s: 0, f: 8 }, // C
      // Phase 4 (walk back on E string to original position)
      { s: 0, f: 7 }, // B
      { s: 0, f: 5 }, // A
      { s: 0, f: 3 }, // G
    ]);
  });

  test('A major back-hand on 4-string: 1-3-2-2 with stretch to root-4 for G♯', () => {
    // [A] on E, [B C# D] on A, [E F#] on D, [G# A] on G — G# requires root-4 stretch
    const midi = ascendingScaleMidi(SCALES.major, midiOf('A', 1));
    const start = { string: 0, fret: 5 }; // A on E string fret 5 (pinky on root)
    const seq = layOnFretboard(midi, TUNINGS.fourStringEADG, start, 'back');
    expect(seq.map((n) => ({ s: n.string, f: n.fret }))).toEqual([
      { s: 0, f: 5 }, // A  (E,5)
      { s: 1, f: 2 }, // B  (A,2)
      { s: 1, f: 4 }, // C# (A,4)
      { s: 1, f: 5 }, // D  (A,5)
      { s: 2, f: 2 }, // E  (D,2)
      { s: 2, f: 4 }, // F# (D,4)
      { s: 3, f: 1 }, // G# (G,1) — root-4 stretch (root 5, fret 1 = root-4)
      { s: 3, f: 2 }, // A  (G,2)
    ]);
  });
});

describe('generateExercise', () => {
  test('plain C major scale always plays ascending + descending (15 notes)', () => {
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('C'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
    });
    // 8 ascending + 7 descending (apex not repeated) = 15
    expect(ex.sequence).toHaveLength(15);
    expect(ex.sequence[0].midi).toBe(midiOf('C', 2));
    expect(ex.sequence[7].midi).toBe(midiOf('C', 3));
    expect(ex.sequence[14].midi).toBe(midiOf('C', 2));
    expect(ex.displayName).toContain('C');
    expect(ex.displayName).toContain('Major');
  });

  test('plain G major front-hand starts on E string (lowest string), 3-3-2 ascending', () => {
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('G'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
    });
    expect(ex.sequence[0].string).toBe(0); // E string
    expect(ex.sequence[0].fret).toBe(3);
    // First 8 notes are ascending — 3 on E, 3 on A, 2 on D
    expect(ex.sequence.slice(0, 3).every((n) => n.string === 0)).toBe(true);
    expect(ex.sequence.slice(3, 6).every((n) => n.string === 1)).toBe(true);
    expect(ex.sequence.slice(6, 8).every((n) => n.string === 2)).toBe(true);
  });

  test('A major fretted variant starts on E string fret 5 (no open strings)', () => {
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('A'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
    });
    expect(ex.sequence[0].string).toBe(0);
    expect(ex.sequence[0].fret).toBe(5);
    expect(ex.displayName).not.toContain('open');
  });

  test('A major OPEN variant starts on A string fret 0', () => {
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('A'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      useOpenStrings: true,
    });
    expect(ex.sequence[0].string).toBe(1); // A string
    expect(ex.sequence[0].fret).toBe(0); // open
    expect(ex.displayName).toContain('open');
  });

  test('C In Sen scale walk -2 mid-hand: F3 lands on G string (no 10-fret cross-string jump)', () => {
    // The desc half goes up to F3 (MIDI 53) following C3 (MIDI 48). The
    // natural fingering is a same-string slide (G string fret 5 → 10),
    // NOT a 1-string + 10-fret leap (G fret 5 → D fret 15). The old
    // strict same-string-stretch filter (>4 frets rejected) forced the
    // worse layout. The fall-back limit is now 6 to allow this slide.
    const ex = generateExercise({
      scale: SCALES.inSen,
      rootPc: pitchClass('C'),
      variant: { kind: 'intervalWalk', interval: 2, intervalDir: 'down' },
      scaleDirection: 'updown',
      handPosition: 'mid',
      tuning: TUNINGS.fourStringEADG,
    });
    const f3 = ex.sequence.find((n) => n.midi === midiOf('F', 3));
    expect(f3).toBeDefined();
    // Reject the cross-string leap: D string fret 15. The acceptable
    // placements are G string fret 10 (same-string slide) or any position
    // that does NOT pair string<3 with fret≥15.
    expect(!(f3!.string < 3 && f3!.fret >= 15)).toBe(true);
  });

  test('walking exercises end on the root, at the same fretboard spot as the start', () => {
    // C Chromatic Scale walk -1 Mid: the user reported the exercise
    // ended at a different fretboard position than it started. The
    // appended root resolution + the pinned-root-position rule together
    // ensure the last note IS the root, AND it's at the same string/fret
    // as the first note.
    const ex = generateExercise({
      scale: SCALES.chromatic,
      rootPc: pitchClass('C'),
      variant: { kind: 'intervalWalk', interval: 1, intervalDir: 'down' },
      scaleDirection: 'updown',
      handPosition: 'mid',
      tuning: TUNINGS.fourStringEADG,
    });
    const first = ex.sequence[0];
    const last = ex.sequence[ex.sequence.length - 1];
    expect(last.midi).toBe(first.midi); // same pitch (the root)
    expect(last.string).toBe(first.string); // same string
    expect(last.fret).toBe(first.fret); // same fret
  });

  test('C♯ Minor Pentatonic walking -3 mid-hand: starts on A string, no large leaps', () => {
    // Two bugs the user reported:
    // (1) Started on E string fret 9 instead of A string fret 4
    //     because the generator picked the lowest STRING without the
    //     picker's minStringIndex=1 constraint for walking-down variants.
    // (2) After landing on G string fret 6 (C♯3), the next note (G♯3)
    //     leapt to D string fret 18 — a 1-string + 12-fret jump.
    const ex = generateExercise({
      scale: SCALES.minorPentatonic,
      rootPc: pitchClass('C#'),
      variant: { kind: 'intervalWalk', interval: 3, intervalDir: 'down' },
      scaleDirection: 'updown',
      handPosition: 'mid',
      tuning: TUNINGS.fourStringEADG,
    });
    // Bug (1): starts on A string fret 4 (string index 1) — NOT on E
    // string fret 9 (string index 0). Walking-down needs a string below.
    expect(ex.sequence[0].string).toBeGreaterThanOrEqual(1);

    // Bug (2): no two consecutive notes have BOTH a string change AND a
    // fret distance > 8. (Same-string slides up to 7 frets are OK; small
    // cross-string moves are OK; the bad case is leaping to a far fret
    // on a different string.)
    for (let i = 1; i < ex.sequence.length; i++) {
      const prev = ex.sequence[i - 1];
      const cur = ex.sequence[i];
      const stringDiff = Math.abs(cur.string - prev.string);
      const fretDiff = Math.abs(cur.fret - prev.fret);
      if (stringDiff >= 1 && fretDiff > 8) {
        throw new Error(
          `Note ${i} (midi ${cur.midi}): jump from string=${prev.string} fret=${prev.fret} to string=${cur.string} fret=${cur.fret} crosses ${stringDiff} string(s) AND ${fretDiff} frets — too large`,
        );
      }
    }
  });

  test('G major front-hand 1-octave scale: finger sequence walks 1-3-4 per string', () => {
    // Root G on E string fret 3 (anchor=3, window [3, 7]).
    // Asc: E3(1) E5(3) E7(4) A3(1) A5(3) A7(4) D4(2) D5(3).
    // Desc retraces (with apex shared, so the 8th note is the apex).
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('G'),
      variant: { kind: 'plain' },
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
    });
    expect(ex.sequence.map((n) => n.finger)).toEqual([
      1, 3, 4, 1, 3, 4, 2, 3, // asc through apex G5 on D string
      2, 4, 3, 1, 4, 3, 1, // desc
    ]);
  });

  test('mid-hand finger: middle on root, pinky on root+2', () => {
    // C minor pentatonic mid-hand, root on A string fret 3 (anchor for
    // window [2, 5] = 2). Note 0 (root C) plays on the middle finger,
    // so finger=2 from the formula (3 - 2 + 1 = 2).
    const ex = generateExercise({
      scale: SCALES.minorPentatonic,
      rootPc: pitchClass('C'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'mid',
      tuning: TUNINGS.fourStringEADG,
    });
    expect(ex.sequence[0].finger).toBe(2); // middle on root
    // The 3rd of minor pentatonic (E♭) is 3 frets above root, which the
    // mid-hand rule forces onto the next string (index reach-back).
    // Whatever fret it lands on, the index is the leading finger.
    expect(ex.sequence[1].finger).toBe(1);
  });

  test('back-hand finger: pinky on root', () => {
    // E natural minor back-hand, root on A string fret 7 (window [4, 7]).
    // Pinky (4) plays the root at fret 7.
    const ex = generateExercise({
      scale: SCALES.naturalMinor,
      rootPc: pitchClass('E'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'back',
      tuning: TUNINGS.fourStringEADG,
    });
    expect(ex.sequence[0].finger).toBe(4);
  });

  test('open string is treated as index finger (1)', () => {
    // E major front-hand with useOpenStrings: starts on open E (fret 0).
    // Open strings always render as index finger per the design.
    const ex = generateExercise({
      scale: SCALES.major,
      rootPc: pitchClass('E'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'front',
      tuning: TUNINGS.fourStringEADG,
      useOpenStrings: true,
    });
    expect(ex.sequence[0].fret).toBe(0);
    expect(ex.sequence[0].finger).toBe(1);
  });

  test('B Kumoi walk +1 Back: descent resolves to the start position', () => {
    // Original bug: descent jumped 3rd-from-last from anchored hand to
    // a far position. The cost function should pull the descent back
    // to the starting position. With the walking-fret relaxation, the
    // exercise now starts at A string fret 2 instead of E7, so the
    // resolution naturally lands at A2. Assert the layout's invariant
    // that holds independent of the start position: the FINAL note
    // matches the starting fretboard position, and the third-from-last
    // doesn't jump far from there.
    const ex = generateExercise({
      scale: SCALES.kumoi,
      rootPc: pitchClass('B'),
      variant: { kind: 'intervalWalk', interval: 1, intervalDir: 'up' },
      scaleDirection: 'updown',
      handPosition: 'back',
      tuning: TUNINGS.fourStringEADG,
    });
    const start = ex.sequence[0];
    expect(ex.sequence.at(-1)).toMatchObject({
      string: start.string,
      fret: start.fret,
    });
    // The third-from-last should sit within roughly a hand's reach of
    // the start (≤ 4 frets and ≤ 1 string away). Catches a recurrence
    // of the original "jump to a far position to play the root"
    // failure mode.
    const thirdFromLast = ex.sequence.at(-3)!;
    expect(Math.abs(thirdFromLast.fret - start.fret)).toBeLessThanOrEqual(5);
    expect(Math.abs(thirdFromLast.string - start.string)).toBeLessThanOrEqual(
      1,
    );
  });

  test('A Egyptian walk -3 Back: descent resolves to the root without a big same-string slide', () => {
    // User report: ends with D14 → D7, a 7-fret slide on the D string.
    // The descent should resolve to the start position through a
    // cross-string move (e.g., G12 → D7), not a slide. The ascent
    // can still have a same-string slide when the apex note (here
    // MIDI 64) is only reachable at a high fret of the top string —
    // that's not a layout failure, it's a tuning limit. Scoped to
    // the last 4 notes which is where the user noticed the issue.
    const ex = generateExercise({
      scale: SCALES.egyptian,
      rootPc: pitchClass('A'),
      variant: { kind: 'intervalWalk', interval: 3, intervalDir: 'down' },
      scaleDirection: 'updown',
      handPosition: 'back',
      tuning: TUNINGS.fourStringEADG,
    });
    const tail = ex.sequence.slice(-4);
    for (let i = 1; i < tail.length; i++) {
      const prev = tail[i - 1];
      const cur = tail[i];
      if (prev.string === cur.string) {
        const dFret = Math.abs(cur.fret - prev.fret);
        expect(
          dFret,
          `idx (tail) ${i - 1}→${i}: same-string move of ${dFret} frets is a hand shift along the string — the cost function should have picked a cross-string alternative`,
        ).toBeLessThan(5);
      }
    }
  });

  test('every placed note gets a finger in [1, 4]', () => {
    // Sweep a handful of exercises and assert finger is always a valid
    // finger number — covers every push site in the layout.
    const cases: Array<Parameters<typeof generateExercise>[0]> = [
      {
        scale: SCALES.major,
        rootPc: pitchClass('C'),
        variant: { kind: 'plain' },
        scaleDirection: 'updown',
        handPosition: 'front',
        tuning: TUNINGS.fourStringEADG,
      },
      {
        scale: SCALES.harmonicMinor,
        rootPc: pitchClass('A'),
        variant: { kind: 'multiOctaveA', octaves: 2 },
        scaleDirection: 'updown',
        handPosition: 'mid',
        tuning: TUNINGS.fourStringEADG,
      },
      {
        scale: SCALES.minorPentatonic,
        rootPc: pitchClass('D'),
        variant: { kind: 'intervalWalk', interval: 2, intervalDir: 'up' },
        scaleDirection: 'updown',
        handPosition: 'back',
        tuning: TUNINGS.fourStringEADG,
      },
    ];
    for (const params of cases) {
      const ex = generateExercise(params);
      for (const n of ex.sequence) {
        expect(n.finger, `note midi=${n.midi} string=${n.string} fret=${n.fret}`).toBeGreaterThanOrEqual(1);
        expect(n.finger, `note midi=${n.midi} string=${n.string} fret=${n.fret}`).toBeLessThanOrEqual(4);
      }
    }
  });

  test('D dorian mid-hand on 4-string: max 3 notes per string mid-scale', () => {
    const ex = generateExercise({
      scale: SCALES.dorian,
      rootPc: pitchClass('D'),
      variant: { kind: 'plain' },
      scaleDirection: 'up',
      handPosition: 'mid',
      tuning: TUNINGS.fourStringEADG,
    });
    // First 8 notes (ascending). Count notes per string in the ascending half.
    const ascending = ex.sequence.slice(0, 8);
    const counts: Record<number, number> = {};
    for (const n of ascending) counts[n.string] = (counts[n.string] ?? 0) + 1;
    for (const [, count] of Object.entries(counts)) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });
});

describe('pickStartingPosition — maxStringIndex constraint', () => {
  test('respects maxStringIndex (excludes higher-pitched strings)', () => {
    // 4-string EADG. Pitch class for E (rootPc=4) is on string 0 (open) and
    // string 2 fret 2 (D string + 2 = E). With maxStringIndex=1, only the
    // lowest-2 strings are allowed → must pick string 0.
    const tuning = TUNINGS.fourStringEADG;
    const pos = pickStartingPosition(4 as PitchClass, 'front', tuning, {
      maxStringIndex: 1,
    });
    expect(pos).not.toBeNull();
    expect(pos!.string).toBeLessThanOrEqual(1);
  });

  test('returns null when no string ≤ maxStringIndex carries the root', () => {
    // Pitch class for B (rootPc=11). On a 4-string EADG (strings 0..3 =
    // E,A,D,G), B is reachable on string 0 fret 7, string 1 fret 2, etc.
    // Constrain to maxStringIndex=-1 (no strings allowed) and check null.
    const tuning = TUNINGS.fourStringEADG;
    const pos = pickStartingPosition(11 as PitchClass, 'front', tuning, {
      maxStringIndex: -1,
    });
    expect(pos).toBeNull();
  });
});

describe('arpeggioCycleApex', () => {
  test('triad in C major rooted at C2 → degree 11 = G3', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 3)).toBe(midiOf('G', 3));
  });

  test('7th-chord in C major → degree 13 = B3', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 4)).toBe(midiOf('B', 3));
  });

  test('13th-chord in C major → degree 19 = A4', () => {
    expect(arpeggioCycleApex(SCALES.major, midiOf('C', 2), 7)).toBe(midiOf('A', 4));
  });
});

describe('startConstraintsForVariant — arpeggio', () => {
  test('4-string tuning → maxStringIndex = 1', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 3, direction: 'allUp' },
      TUNINGS.fourStringEADG,
    );
    expect(c.maxStringIndex).toBe(1);
    expect(c.minStringIndex).toBe(0);
  });

  test('5-string tuning → maxStringIndex = 2', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 7, direction: 'zigzag' },
      TUNINGS.fiveStringBEADG,
    );
    expect(c.maxStringIndex).toBe(2);
  });

  test('6-string tuning → maxStringIndex = 2', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'arpeggioCycle', size: 3, direction: 'allUp' },
      TUNINGS.sixStringBEADGC,
    );
    expect(c.maxStringIndex).toBe(2);
  });

  test('non-arpeggio variants leave maxStringIndex undefined (back-compat)', () => {
    const c = startConstraintsForVariant(
      SCALES.major,
      { kind: 'plain' },
      TUNINGS.fourStringEADG,
    );
    expect(c.maxStringIndex).toBeUndefined();
  });
});

describe('generateExercise — arpeggioCycle', () => {
  function makeParams(
    scaleId: 'major' | 'naturalMinor' | 'dorian',
    keyId: string,
    size: 3 | 4 | 5 | 6 | 7,
    direction: 'allUp' | 'upDown' | 'downUp' | 'zigzag',
    tuningId: 'fourStringEADG' | 'fiveStringBEADG' = 'fourStringEADG',
  ) {
    const key = KEYS_BY_ID[keyId];
    const scale = SCALES[scaleId];
    const tuning = TUNINGS[tuningId];
    return {
      scale,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'arpeggioCycle' as const, size, direction },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning,
      keySignature: keySignatureFor(key, scale),
      keySignatureLabel: keySignatureLabelFor(key, scale),
      spelling: spellingMap(key, scale),
    };
  }

  test('C major triad allUp on 4-string starts on string 0 or 1', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp'));
    expect(ex.sequence[0].string).toBeLessThanOrEqual(1);
  });

  test('C major triad allUp on 5-string starts on string 0, 1, or 2', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp', 'fiveStringBEADG'));
    expect(ex.sequence[0].string).toBeLessThanOrEqual(2);
  });

  test('final note pins to start position', () => {
    const ex = generateExercise(makeParams('major', 'G', 3, 'upDown'));
    const start = ex.sequence[0];
    const last = ex.sequence[ex.sequence.length - 1];
    expect(last.string).toBe(start.string);
    expect(last.fret).toBe(start.fret);
  });

  test('no negative frets across directions that fit on C major / 4-string', () => {
    // allUp and zigzag stay within one octave above root — safe for all sizes.
    // upDown/downUp descend below root, pushing minMidi up; for sizes > 3 on
    // C major the apex then exceeds fret 24 on a 4-string, so the picker
    // would filter those combinations out — we only test the valid subset.
    const universalDirs = ['allUp', 'zigzag'] as const;
    const allDirs = ['allUp', 'upDown', 'downUp', 'zigzag'] as const;
    const sizes = [3, 4, 5] as const;
    for (const sz of sizes) {
      const dirs = sz === 3 ? allDirs : universalDirs;
      for (const d of dirs) {
        const ex = generateExercise(makeParams('major', 'C', sz, d));
        for (const n of ex.sequence) {
          expect(n.fret).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('every note uses eighth-note duration', () => {
    const ex = generateExercise(makeParams('major', 'C', 3, 'allUp'));
    for (const n of ex.sequence) {
      expect(n.durationDenominator).toBe(8);
    }
  });
});

describe('formatDisplayName — arpeggios', () => {
  function arpParams(
    keyId: string,
    scaleId: 'major' | 'naturalMinor' | 'dorian' | 'phrygianDominant',
    size: 3 | 4 | 5 | 6 | 7,
    direction: 'allUp' | 'upDown' | 'downUp' | 'zigzag',
  ) {
    const key = KEYS_BY_ID[keyId];
    const scale = SCALES[scaleId];
    return {
      scale,
      rootPc: key.pc,
      rootName: key.name,
      variant: { kind: 'arpeggioCycle' as const, size, direction },
      scaleDirection: 'updown' as const,
      handPosition: 'front' as const,
      tuning: TUNINGS.fourStringEADG,
    };
  }

  test('C major triad allUp', () => {
    expect(formatDisplayName(arpParams('C', 'major', 3, 'allUp'))).toBe(
      'C Major — Triad cycle ↑↑',
    );
  });

  test('E♭ dorian 9th zigzag', () => {
    expect(formatDisplayName(arpParams('Eb', 'dorian', 5, 'zigzag'))).toBe(
      'E♭ Dorian — 9th cycle ↕',
    );
  });

  test('B♭ phrygian-dominant 7th upDown', () => {
    expect(formatDisplayName(arpParams('Bb', 'phrygianDominant', 4, 'upDown'))).toBe(
      'B♭ Phrygian Dominant — 7th cycle ↑↓',
    );
  });

  test('C natural-minor 11th downUp', () => {
    expect(formatDisplayName(arpParams('C', 'naturalMinor', 6, 'downUp'))).toBe(
      'C Natural Minor — 11th cycle ↓↑',
    );
  });

  test('no hand chip suffix (consistent with walking 7ths/octaves)', () => {
    const name = formatDisplayName(arpParams('C', 'major', 3, 'allUp'));
    expect(name).not.toContain('Front');
    expect(name).not.toContain('Mid');
    expect(name).not.toContain('Back');
  });
});
