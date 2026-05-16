import { describe, test, expect } from 'vitest';
import { multiOctaveAMidi, multiOctaveBMidi } from './multi-octave';
import { SCALES } from '../theory/scales';
import { midiOf } from '../theory/notes';

describe('multiOctaveAMidi', () => {
  test('G major 2-octave from G1 yields 29 notes (15 asc + 14 desc, apex NOT repeated)', () => {
    const midi = multiOctaveAMidi(SCALES.major, midiOf('G', 1), 2);
    expect(midi).toHaveLength(29);
    expect(midi[0]).toBe(midiOf('G', 1));
    expect(midi[14]).toBe(midiOf('G', 3)); // apex at end of asc
    expect(midi[15]).toBe(midiOf('F#', 3)); // desc resumes one step below apex
    expect(midi[28]).toBe(midiOf('G', 1));
  });

  test('apex is played once (simple scale variant — no repeat)', () => {
    const midi = multiOctaveAMidi(SCALES.major, midiOf('G', 1), 2);
    const apex = midiOf('G', 3);
    expect(midi.filter((m) => m === apex).length).toBe(1);
  });

  test('low root played twice: at start AND end', () => {
    const midi = multiOctaveAMidi(SCALES.major, midiOf('G', 1), 2);
    const root = midiOf('G', 1);
    expect(midi.filter((m) => m === root).length).toBe(2);
  });

  test('3-octave on G major yields 43 notes (apex not repeated)', () => {
    const midi = multiOctaveAMidi(SCALES.major, midiOf('G', 1), 3);
    expect(midi).toHaveLength(43);
    expect(midi[0]).toBe(midiOf('G', 1));
    expect(midi[21]).toBe(midiOf('G', 4)); // apex
    expect(midi[22]).toBe(midiOf('F#', 4)); // desc one step below
    expect(midi[42]).toBe(midiOf('G', 1));
  });

  test('1-octave A on a 5-note pentatonic yields 11 notes (apex not repeated)', () => {
    const midi = multiOctaveAMidi(SCALES.majorPentatonic, midiOf('C', 2), 1);
    expect(midi).toHaveLength(11);
  });
});

describe('multiOctaveBMidi', () => {
  test('1-octave B is straightforward — apex NOT repeated, 15 notes', () => {
    const midi = multiOctaveBMidi(SCALES.major, midiOf('C', 2), 1);
    expect(midi).toHaveLength(15);
    expect(midi[0]).toBe(midiOf('C', 2));
    expect(midi[7]).toBe(midiOf('C', 3));
    expect(midi[14]).toBe(midiOf('C', 2));
    expect(midi.filter((m) => m === midiOf('C', 3)).length).toBe(1);
  });

  test('2-octave B yields 29 notes (straightforward, no apex repeat)', () => {
    const midi = multiOctaveBMidi(SCALES.major, midiOf('C', 2), 2);
    expect(midi).toHaveLength(29);
    expect(midi[0]).toBe(midiOf('C', 2));
    expect(midi[14]).toBe(midiOf('C', 4));
    expect(midi[28]).toBe(midiOf('C', 2));
  });
});
