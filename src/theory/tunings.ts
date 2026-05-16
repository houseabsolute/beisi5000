import { midiOf } from './notes';

export interface Tuning {
  id: string;
  name: string;
  stringCount: number;
  /** Index 0 = lowest-pitch string. */
  openMidi: readonly number[];
  /** Display names for each open string, same order as openMidi. */
  openNoteNames: readonly string[];
}

export interface FretboardPosition {
  string: number;
  fret: number;
}

const DEFAULT_MAX_FRET = 24;

export const TUNINGS = {
  fourStringEADG: {
    id: 'fourStringEADG',
    name: '4-string EADG',
    stringCount: 4,
    openMidi: [midiOf('E', 1), midiOf('A', 1), midiOf('D', 2), midiOf('G', 2)],
    openNoteNames: ['E', 'A', 'D', 'G'],
  },
  fiveStringBEADG: {
    id: 'fiveStringBEADG',
    name: '5-string BEADG',
    stringCount: 5,
    openMidi: [
      midiOf('B', 0),
      midiOf('E', 1),
      midiOf('A', 1),
      midiOf('D', 2),
      midiOf('G', 2),
    ],
    openNoteNames: ['B', 'E', 'A', 'D', 'G'],
  },
  fiveStringEADGC: {
    id: 'fiveStringEADGC',
    name: '5-string EADGC',
    stringCount: 5,
    openMidi: [
      midiOf('E', 1),
      midiOf('A', 1),
      midiOf('D', 2),
      midiOf('G', 2),
      midiOf('C', 3),
    ],
    openNoteNames: ['E', 'A', 'D', 'G', 'C'],
  },
  sixStringBEADGC: {
    id: 'sixStringBEADGC',
    name: '6-string BEADGC',
    stringCount: 6,
    openMidi: [
      midiOf('B', 0),
      midiOf('E', 1),
      midiOf('A', 1),
      midiOf('D', 2),
      midiOf('G', 2),
      midiOf('C', 3),
    ],
    openNoteNames: ['B', 'E', 'A', 'D', 'G', 'C'],
  },
} as const satisfies Record<string, Tuning>;

export type TuningId = keyof typeof TUNINGS;

export function stringFretToMidi(
  tuning: Tuning,
  stringIndex: number,
  fret: number,
): number {
  if (fret < 0) throw new Error(`fret must be >= 0, got ${fret}`);
  if (stringIndex < 0 || stringIndex >= tuning.stringCount) {
    throw new Error(
      `stringIndex must be in [0, ${tuning.stringCount}), got ${stringIndex}`,
    );
  }
  return tuning.openMidi[stringIndex] + fret;
}

export function midiToPositions(
  tuning: Tuning,
  midi: number,
  options: { maxFret?: number } = {},
): FretboardPosition[] {
  const maxFret = options.maxFret ?? DEFAULT_MAX_FRET;
  const result: FretboardPosition[] = [];
  for (let s = 0; s < tuning.stringCount; s++) {
    const fret = midi - tuning.openMidi[s];
    if (fret >= 0 && fret <= maxFret) {
      result.push({ string: s, fret });
    }
  }
  return result;
}
