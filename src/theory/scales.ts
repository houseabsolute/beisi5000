import type { PitchClass } from './notes';
import { addSemitones } from './notes';

export type ScaleCategory =
  | 'major'
  | 'minor'
  | 'modes'
  | 'modes-of-minor'
  | 'pentatonic'
  | 'chromatic'
  | 'octatonic';

export interface Scale {
  name: string;
  category: ScaleCategory;
  intervals: readonly number[];
  /**
   * Optional alternate intervals when descending. Classical melodic minor
   * lowers the 6th and 7th going down (effectively becoming natural minor),
   * so it sets this to [0,2,3,5,7,8,10]. Most scales don't need this.
   */
  descendingIntervals?: readonly number[];
}

export const SCALES = {
  major: { name: 'Major', category: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },

  naturalMinor: {
    name: 'Natural Minor',
    category: 'minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    category: 'minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  melodicMinor: {
    name: 'Melodic Minor',
    category: 'minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    // Classical: descending lowers the 6th and 7th (= natural minor).
    descendingIntervals: [0, 2, 3, 5, 7, 8, 10],
  },

  // Modes of the major scale, excluding Ionian (= Major) and Aeolian
  // (= Natural Minor) which are covered by their own categories.
  dorian: { name: 'Dorian', category: 'modes', intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: 'Phrygian', category: 'modes', intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: 'Lydian', category: 'modes', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: {
    name: 'Mixolydian',
    category: 'modes',
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  locrian: { name: 'Locrian', category: 'modes', intervals: [0, 1, 3, 5, 6, 8, 10] },

  phrygianDominant: {
    name: 'Phrygian Dominant',
    category: 'modes-of-minor',
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },
  lydianDominant: {
    name: 'Lydian Dominant',
    category: 'modes-of-minor',
    intervals: [0, 2, 4, 6, 7, 9, 10],
  },
  altered: {
    name: 'Altered',
    category: 'modes-of-minor',
    intervals: [0, 1, 3, 4, 6, 8, 10],
  },
  lydianSharp2: {
    name: 'Lydian ♯2',
    category: 'modes-of-minor',
    intervals: [0, 3, 4, 6, 7, 9, 11],
  },
  locrianNatural2: {
    name: 'Locrian ♮2',
    category: 'modes-of-minor',
    intervals: [0, 2, 3, 5, 6, 8, 10],
  },

  majorPentatonic: {
    name: 'Major Pentatonic',
    category: 'pentatonic',
    intervals: [0, 2, 4, 7, 9],
  },
  minorPentatonic: {
    name: 'Minor Pentatonic',
    category: 'pentatonic',
    intervals: [0, 3, 5, 7, 10],
  },
  blues: { name: 'Blues', category: 'pentatonic', intervals: [0, 3, 5, 6, 7, 10] },
  hirajoshi: {
    name: 'Hirajoshi',
    category: 'pentatonic',
    intervals: [0, 2, 3, 7, 8],
  },
  inSen: { name: 'In Sen', category: 'pentatonic', intervals: [0, 1, 5, 7, 10] },
  iwato: { name: 'Iwato', category: 'pentatonic', intervals: [0, 1, 5, 6, 10] },
  kumoi: { name: 'Kumoi', category: 'pentatonic', intervals: [0, 2, 3, 7, 9] },
  egyptian: {
    name: 'Egyptian',
    category: 'pentatonic',
    intervals: [0, 2, 5, 7, 10],
  },
  hungarian: {
    name: 'Hungarian Minor',
    category: 'pentatonic',
    intervals: [0, 2, 3, 6, 7, 8, 11],
  },

  chromatic: {
    name: 'Chromatic',
    category: 'chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },

  octatonicWholeHalf: {
    name: 'Octatonic (Whole-Half)',
    category: 'octatonic',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
  },
  octatonicHalfWhole: {
    name: 'Octatonic (Half-Whole)',
    category: 'octatonic',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
  },
} as const satisfies Record<string, Scale>;

export type ScaleId = keyof typeof SCALES;

export function scaleNotes(scale: Scale, root: PitchClass): PitchClass[] {
  return scale.intervals.map((interval) => addSemitones(root, interval));
}

export const SCALE_CATEGORIES: Record<ScaleCategory, Scale[]> = (() => {
  const result: Partial<Record<ScaleCategory, Scale[]>> = {};
  for (const scale of Object.values(SCALES) as Scale[]) {
    (result[scale.category] ??= []).push(scale);
  }
  return result as Record<ScaleCategory, Scale[]>;
})();
