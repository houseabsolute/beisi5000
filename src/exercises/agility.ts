import type { Tuning } from '../theory/tunings';
import type { PitchClass } from '../theory/notes';
import type { AccidentalKind } from '../theory/keys';
import type {
  FretboardNote,
  NoteSequence,
  AgilityDirection,
  AgilitySpelling,
} from './types';

// The 5 black-key pitch classes — C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭.
const BLACK_KEY_PCS = [1, 3, 6, 8, 10] as const;

const ASCENDING_START_FRETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DESCENDING_START_FRETS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
const START_FRETS = [...ASCENDING_START_FRETS, ...DESCENDING_START_FRETS];

function makeNote(
  tuning: Tuning,
  string: number,
  fret: number,
  finger: number,
): FretboardNote {
  return {
    string,
    fret,
    midi: tuning.openMidi[string] + fret,
    durationDenominator: 8,
    finger,
  };
}

/**
 * Build the full Big X drill — 23 X's (12 ascending the neck + 11
 * descending) on the 4 adjacent strings starting at `startString`.
 * Each X is 8 notes (rising + falling diagonal, each played either
 * forward or reverse per `direction`).
 */
export function bigXSequence(
  tuning: Tuning,
  startString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  for (const startFret of START_FRETS) {
    result.push(...bigXAtFret(tuning, startString, startFret, direction));
  }
  return result;
}

function bigXAtFret(
  tuning: Tuning,
  startString: number,
  startFret: number,
  direction: AgilityDirection,
): FretboardNote[] {
  const notes: FretboardNote[] = [];
  if (direction === 'forward') {
    // Rising diagonal: (S+i, N+i) for i = 0..3, fingers 1..4
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + i, i + 1));
    }
    // Falling diagonal: (S+3-i, N+i) for i = 0..3, fingers 1..4
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + i, i + 1));
    }
  } else {
    // Reverse: each diagonal played backwards, pairing order preserved.
    // Rising reversed: (S+3-i, N+3-i) for i = 0..3, fingers 4..1
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + 3 - i, startFret + 3 - i, 4 - i));
    }
    // Falling reversed: (S+i, N+3-i) for i = 0..3, fingers 4..1
    for (let i = 0; i < 4; i++) {
      notes.push(makeNote(tuning, startString + i, startFret + 3 - i, 4 - i));
    }
  }
  return notes;
}

/**
 * Build the full Spider drill — 23 positions (12 ascending the neck +
 * 11 descending) on the two adjacent strings `lowerString` (L) and
 * `lowerString + 1` (H). Each position is 8 notes (normal pass + swap
 * pass, each played either forward or reverse per `direction`).
 */
export function spiderSequence(
  tuning: Tuning,
  lowerString: number,
  direction: AgilityDirection,
): NoteSequence {
  const result: FretboardNote[] = [];
  for (const startFret of START_FRETS) {
    result.push(...spiderAtFret(tuning, lowerString, startFret, direction));
  }
  return result;
}

function spiderAtFret(
  tuning: Tuning,
  lowerString: number,
  startFret: number,
  direction: AgilityDirection,
): FretboardNote[] {
  const L = lowerString;
  const H = lowerString + 1;
  const notes: FretboardNote[] = [];
  if (direction === 'forward') {
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    notes.push(makeNote(tuning, H, startFret + 0, 1));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 3, 4));
  } else {
    notes.push(makeNote(tuning, H, startFret + 3, 4));
    notes.push(makeNote(tuning, L, startFret + 2, 3));
    notes.push(makeNote(tuning, H, startFret + 1, 2));
    notes.push(makeNote(tuning, L, startFret + 0, 1));
    notes.push(makeNote(tuning, L, startFret + 3, 4));
    notes.push(makeNote(tuning, H, startFret + 2, 3));
    notes.push(makeNote(tuning, L, startFret + 1, 2));
    notes.push(makeNote(tuning, H, startFret + 0, 1));
  }
  return notes;
}

/**
 * Build the per-pitch-class accidental override map for an agility
 * exercise. Forces every black-key note to render as sharp or flat
 * per the variant's `spelling` field; white-key notes stay natural.
 */
export function agilitySpellingMap(
  spelling: AgilitySpelling,
): Map<PitchClass, AccidentalKind> {
  const acc: AccidentalKind = spelling;
  const m = new Map<PitchClass, AccidentalKind>();
  for (const pc of BLACK_KEY_PCS) {
    m.set(pc as PitchClass, acc);
  }
  return m;
}
