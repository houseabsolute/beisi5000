import { describe, test, expect } from 'vitest';
import {
  consecutiveAscMidi,
  mirrorAscMidi,
  intervalWalkAscMidi,
  variantSequenceMidi,
  arpUp,
  arpDown,
  arpeggioCycleMidi,
} from './variants';
import { SCALES } from '../theory/scales';
import { midiOf } from '../theory/notes';

const C2 = midiOf('C', 2); // 36
const cMaj = SCALES.major;

describe('consecutiveAscMidi', () => {
  test('1-2-3 over C major (1 octave) yields 6 groups × 3 notes = 18 notes', () => {
    const seq = consecutiveAscMidi(cMaj, C2, 3);
    expect(seq).toHaveLength(18);
    // First group [C D E]
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('D', 2));
    expect(seq[2]).toBe(midiOf('E', 2));
    // Last group [A B C(8va)]
    expect(seq[15]).toBe(midiOf('A', 2));
    expect(seq[16]).toBe(midiOf('B', 2));
    expect(seq[17]).toBe(midiOf('C', 3));
  });

  test('1-2-3-4 over C major yields 5 groups × 4 notes = 20 notes', () => {
    const seq = consecutiveAscMidi(cMaj, C2, 4);
    expect(seq).toHaveLength(20);
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[3]).toBe(midiOf('F', 2));
    expect(seq[19]).toBe(midiOf('C', 3));
  });

  test('1-2-3 over pentatonic (5-note scale) yields 4 groups × 3 = 12 notes', () => {
    const seq = consecutiveAscMidi(SCALES.majorPentatonic, C2, 3);
    expect(seq).toHaveLength(12);
  });
});

describe('mirrorAscMidi', () => {
  test('1-2-3-2-1 over C major yields 6 groups × 5 notes = 30 notes', () => {
    const seq = mirrorAscMidi(cMaj, C2, 3);
    expect(seq).toHaveLength(30);
    // First group [C D E D C]
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('D', 2));
    expect(seq[2]).toBe(midiOf('E', 2));
    expect(seq[3]).toBe(midiOf('D', 2));
    expect(seq[4]).toBe(midiOf('C', 2));
    // Last group [A B C(8va) B A]
    expect(seq[25]).toBe(midiOf('A', 2));
    expect(seq[26]).toBe(midiOf('B', 2));
    expect(seq[27]).toBe(midiOf('C', 3));
    expect(seq[28]).toBe(midiOf('B', 2));
    expect(seq[29]).toBe(midiOf('A', 2));
  });

  test('1-2-3-4-3-2-1 over C major yields 5 groups × 7 notes = 35 notes', () => {
    const seq = mirrorAscMidi(cMaj, C2, 4);
    expect(seq).toHaveLength(35);
  });
});

describe('intervalWalkAscMidi', () => {
  test('walking thirds (interval=2, up) over C major yields 7 pairs × 2 = 14 notes', () => {
    const seq = intervalWalkAscMidi(cMaj, C2, 2, 'up');
    expect(seq).toHaveLength(14);
    // [C E][D F][E G]...
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('E', 2));
    expect(seq[2]).toBe(midiOf('D', 2));
    expect(seq[3]).toBe(midiOf('F', 2));
    expect(seq[4]).toBe(midiOf('E', 2));
    expect(seq[5]).toBe(midiOf('G', 2));
    // Last pair [B D(8va)]
    expect(seq[12]).toBe(midiOf('B', 2));
    expect(seq[13]).toBe(midiOf('D', 3));
  });

  test('walking thirds (interval=2, down) over C major: pairs descend a third', () => {
    const seq = intervalWalkAscMidi(cMaj, C2, 2, 'down');
    expect(seq).toHaveLength(14);
    // [C A(below)][D B(below)][E C]...
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('A', 1)); // third below C
    expect(seq[2]).toBe(midiOf('D', 2));
    expect(seq[3]).toBe(midiOf('B', 1)); // third below D
    expect(seq[4]).toBe(midiOf('E', 2));
    expect(seq[5]).toBe(midiOf('C', 2));
  });

  test('walking octaves (interval=7, up) over C major yields 7 pairs of [d, d+octave]', () => {
    const seq = intervalWalkAscMidi(cMaj, C2, 7, 'up');
    expect(seq).toHaveLength(14);
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('C', 3));
    expect(seq[2]).toBe(midiOf('D', 2));
    expect(seq[3]).toBe(midiOf('D', 3));
  });
});

describe('variantSequenceMidi (asc + desc by reverse)', () => {
  test('consecutive 1-2-3 yields 36 notes (apex repeated at the turnaround)', () => {
    const seq = variantSequenceMidi(cMaj, C2, {
      kind: 'consecutive',
      groupSize: 3,
    });
    expect(seq).toHaveLength(36);
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[17]).toBe(midiOf('C', 3)); // last asc note (the top)
    expect(seq[18]).toBe(midiOf('C', 3)); // apex repeated as first desc note
    expect(seq[35]).toBe(midiOf('C', 2));
  });

  test('mirror 1-2-3-2-1 yields 59 notes', () => {
    const seq = variantSequenceMidi(cMaj, C2, {
      kind: 'mirror',
      peakSize: 3,
    });
    expect(seq).toHaveLength(59);
    expect(seq[0]).toBe(midiOf('C', 2));
    // Apex is at the peak of the last asc group [A B C B A] = position 27
    expect(seq[27]).toBe(midiOf('C', 3));
  });

  test('walking thirds up: descending half reverses interval direction (starts at HighRoot)', () => {
    // 14 ascending + 2 boundary (asc-direction pair at high root) +
    // 16 descending + 1 root resolution = 33 notes
    const seq = variantSequenceMidi(cMaj, C2, {
      kind: 'intervalWalk',
      interval: 2,
      intervalDir: 'up',
    });
    expect(seq).toHaveLength(33);
    // Asc first pair: [C2, E2]
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('E', 2));
    // Asc last pair (degree 6 = B): [B2, D3]
    expect(seq[12]).toBe(midiOf('B', 2));
    expect(seq[13]).toBe(midiOf('D', 3));
    // Boundary asc-direction pair at high root: [C3, E3] (3rd up from C3)
    expect(seq[14]).toBe(midiOf('C', 3));
    expect(seq[15]).toBe(midiOf('E', 3));
    // Desc first pair (high root = degree 7, reversed direction):
    // [C3, A2 (a 3rd below C3)]
    expect(seq[16]).toBe(midiOf('C', 3));
    expect(seq[17]).toBe(midiOf('A', 2));
    // Desc last pair (degree 0 = C): [C2, A1 (a 3rd below C2)]
    expect(seq[30]).toBe(midiOf('C', 2));
    expect(seq[31]).toBe(midiOf('A', 1));
    // Appended root resolution
    expect(seq[32]).toBe(midiOf('C', 2));
  });

  test('walking 6ths up: descending starts at HighRoot then 6th below', () => {
    const seq = variantSequenceMidi(cMaj, C2, {
      kind: 'intervalWalk',
      interval: 5,
      intervalDir: 'up',
    });
    // Asc last pair: [B2, G3]
    expect(seq[13]).toBe(midiOf('G', 3));
    // Boundary asc-direction pair at high root: [C3, A3] (6th up from C3)
    expect(seq[14]).toBe(midiOf('C', 3));
    expect(seq[15]).toBe(midiOf('A', 3));
    // Desc first pair (reversed direction): [C3, E2] (high root and a 6th below)
    expect(seq[16]).toBe(midiOf('C', 3));
    expect(seq[17]).toBe(midiOf('E', 2));
  });
});

describe('arpUp', () => {
  test('triad on C major degree 0 = [C E G]', () => {
    expect(arpUp(cMaj, C2, 0, 3)).toEqual([
      midiOf('C', 2),
      midiOf('E', 2),
      midiOf('G', 2),
    ]);
  });

  test('7th-chord on C major degree 0 = [C E G B]', () => {
    expect(arpUp(cMaj, C2, 0, 4)).toEqual([
      midiOf('C', 2),
      midiOf('E', 2),
      midiOf('G', 2),
      midiOf('B', 2),
    ]);
  });

  test('triad on C major degree 7 (octave up) = [C(8va) E(8va) G(8va)]', () => {
    expect(arpUp(cMaj, C2, 7, 3)).toEqual([
      midiOf('C', 3),
      midiOf('E', 3),
      midiOf('G', 3),
    ]);
  });

  test('7th-chord on C major degree 1 = [D F A C(8va)] (non-zero d, crosses octave boundary)', () => {
    expect(arpUp(cMaj, C2, 1, 4)).toEqual([
      midiOf('D', 2),
      midiOf('F', 2),
      midiOf('A', 2),
      midiOf('C', 3),
    ]);
  });
});

describe('arpDown', () => {
  test('triad on C major degree 0 = [C, A(below), F(below)]', () => {
    expect(arpDown(cMaj, C2, 0, 3)).toEqual([
      midiOf('C', 2),
      midiOf('A', 1),
      midiOf('F', 1),
    ]);
  });

  test('triad on C major degree 7 = [C(8va) A F]', () => {
    expect(arpDown(cMaj, C2, 7, 3)).toEqual([
      midiOf('C', 3),
      midiOf('A', 2),
      midiOf('F', 2),
    ]);
  });
});

describe('arpeggioCycleMidi — allUp', () => {
  test('triad in C major: 16 arpeggios × 3 notes = 48 notes', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp');
    expect(seq).toHaveLength(48);
    // First arp [C E G]
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
    // Last arp of asc half = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // First arp of desc half = high-root arp UP again (the pivot doubling)
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // Last arp of desc half = low-root arp UP [C E G]
    expect(seq.slice(45, 48)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
  });

  test('final note is the top of low-root arp UP (G)', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'allUp');
    expect(seq[seq.length - 1]).toBe(midiOf('G', 2));
    // Note: final is G (top of low-root arp UP), not the root itself.
    // The pinned-root landing belongs to layOnFretboard, not the MIDI.
  });
});

describe('arpeggioCycleMidi — upDown', () => {
  test('triad in C major: asc plays up, desc plays down', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'upDown');
    expect(seq).toHaveLength(48);
    // Asc first arp = [C E G] (up)
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('E', 2), midiOf('G', 2)]);
    // End of asc = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
    // Start of desc = high-root arp DOWN [C(8va) A F]
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('A', 2), midiOf('F', 2)]);
    // Last arp of desc = low-root arp DOWN [C A(below) F(below)]
    expect(seq.slice(45, 48)).toEqual([midiOf('C', 2), midiOf('A', 1), midiOf('F', 1)]);
  });
});

describe('arpeggioCycleMidi — downUp', () => {
  test('triad in C major: asc plays down, desc plays up', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 3, 'downUp');
    expect(seq).toHaveLength(48);
    // Asc first arp = [C A(below) F(below)] (down from low root)
    expect(seq.slice(0, 3)).toEqual([midiOf('C', 2), midiOf('A', 1), midiOf('F', 1)]);
    // End of asc = high-root arp DOWN [C(8va) A F]
    expect(seq.slice(21, 24)).toEqual([midiOf('C', 3), midiOf('A', 2), midiOf('F', 2)]);
    // Start of desc = high-root arp UP [C(8va) E(8va) G(8va)]
    expect(seq.slice(24, 27)).toEqual([midiOf('C', 3), midiOf('E', 3), midiOf('G', 3)]);
  });
});

describe('arpeggioCycleMidi — C minor allUp (third on degree 1 is minor)', () => {
  test('first arp in C natural minor is [C E♭ G]', () => {
    const seq = arpeggioCycleMidi(SCALES.naturalMinor, C2, 3, 'allUp');
    expect(seq[0]).toBe(midiOf('C', 2));
    expect(seq[1]).toBe(midiOf('E', 2) - 1); // E♭
    expect(seq[2]).toBe(midiOf('G', 2));
  });
});

describe('arpeggioCycleMidi — D dorian triad downUp', () => {
  test('first arp = D dorian triad played DOWN from D: [D, B(below), G(below)]', () => {
    const D2 = midiOf('D', 2);
    const seq = arpeggioCycleMidi(SCALES.dorian, D2, 3, 'downUp');
    expect(seq.slice(0, 3)).toEqual([midiOf('D', 2), midiOf('B', 1), midiOf('G', 1)]);
  });
});

describe('arpeggioCycleMidi — 13th-chord allUp (size = scale length)', () => {
  test('each arp in C major 13th allUp contains all 7 scale notes', () => {
    const seq = arpeggioCycleMidi(cMaj, C2, 7, 'allUp');
    // 16 arpeggios × 7 notes = 112
    expect(seq).toHaveLength(112);
    // First arp: degrees 0,2,4,6,8,10,12 in scaleDegreeMidi semantics
    // = C, E, G, B, D(8va), F(8va), A(8va)
    expect(seq.slice(0, 7)).toEqual([
      midiOf('C', 2), midiOf('E', 2), midiOf('G', 2),
      midiOf('B', 2),
      midiOf('D', 3), midiOf('F', 3), midiOf('A', 3),
    ]);
  });
});
