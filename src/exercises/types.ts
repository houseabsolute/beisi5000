import type { PitchClass } from '../theory/notes';
import type { Scale } from '../theory/scales';
import type { Tuning } from '../theory/tunings';
import type { HandPosition } from '../theory/fingerings';

export type ScaleDirection = 'up' | 'down' | 'updown';

export type ArpDirection = 'allUp' | 'upDown' | 'downUp' | 'zigzag';

export type Rhythm = 'quarter' | 'eighth' | 'triplet' | '8ss' | 's8s' | 'ss8';

export type AgilityDirection = 'forward' | 'reverse';
export type AgilitySpelling = 'sharp' | 'flat';

export type Variant =
  | { kind: 'plain' }
  | { kind: 'consecutive'; groupSize: number }
  | { kind: 'mirror'; peakSize: number }
  | {
      kind: 'intervalWalk';
      interval: number;
      intervalDir: 'up' | 'down';
    }
  | { kind: 'multiOctaveA'; octaves: number }
  | { kind: 'multiOctaveB'; octaves: number }
  | { kind: 'arpeggioCycle'; size: 3 | 4 | 5 | 6 | 7; direction: ArpDirection }
  | { kind: 'bigX'; startString: number; direction: AgilityDirection; spelling: AgilitySpelling }
  | { kind: 'spider'; lowerString: number; direction: AgilityDirection; spelling: AgilitySpelling };

export interface ExerciseParams {
  scale: Scale;
  rootPc: PitchClass;
  variant: Variant;
  scaleDirection: ScaleDirection;
  handPosition: HandPosition;
  tuning: Tuning;
  /**
   * Use the open-string position for the root when available.
   * Only meaningful with front hand (mid/back can't sit on an open string).
   * Provides the "open variant" the user wants alongside the fretted variant.
   */
  useOpenStrings?: boolean;
  /**
   * Display name for the root that includes spelling (e.g., "B♭" vs "A♯").
   * Affects the displayed exercise title and the AlphaTex key signature.
   */
  rootName?: string;
  /**
   * Key signature (positive=sharps, negative=flats), -7 to 7. Used by the
   * AlphaTex emitter so notation renders with the appropriate accidentals.
   */
  keySignature?: number;
  /**
   * AlphaTex `\ks` identifier (e.g., "Bb", "C#minor"). When set, the emitter
   * uses this instead of converting `keySignature` to a name — preserves
   * minor/major mode info so spelling rules apply correctly.
   */
  keySignatureLabel?: string | null;
  /**
   * Explicit accidental per pitch class for this exercise. Used so the
   * emitter can force-spell notes like B♯ (the leading tone in C♯ minor)
   * rather than letting AlphaTab default to the enharmonic equivalent
   * (C natural).
   */
  spelling?: Map<PitchClass, import('../theory/keys').AccidentalKind>;
}

export interface FretboardNote {
  string: number;
  fret: number;
  midi: number;
  /** 1=whole, 2=half, 4=quarter, 8=eighth, 16=sixteenth. */
  durationDenominator: number;
  /**
   * Fretting-hand finger: 1=index, 2=middle, 3=ring, 4=pinky.
   * Derived from the active hand window at placement time. Open strings
   * (fret 0) are conventionally assigned to the index (anchor at fret 0).
   * Currently informational — future layout work will read this to keep
   * the hand anchored when picking among candidate positions.
   */
  finger?: number;
  /**
   * Tuplet ratio (e.g., 3 = "3 in the time of 2"). When set, the
   * AlphaTex emitter emits `{tu N}` for the note so it renders with
   * the appropriate tuplet bracket. Used by triplet rhythms.
   */
  tuplet?: number;
}

export type NoteSequence = FretboardNote[];

export interface Exercise {
  params: ExerciseParams;
  sequence: NoteSequence;
  alphaTex: string;
  displayName: string;
}
