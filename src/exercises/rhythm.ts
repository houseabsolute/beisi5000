import type { NoteSequence, Rhythm } from './types';

interface RhythmSlot {
  duration: number;     // 4 (quarter), 8 (eighth), or 16 (sixteenth)
  tuplet?: number;       // 3 for eighth-note triplets
}

// Each rhythm fills one quarter beat with a sequence of slots.
// applyRhythm cycles through these slots, assigning one per note in
// the exercise sequence. Beats accumulate across the sequence.
const RHYTHM_PATTERNS: Record<Rhythm, readonly RhythmSlot[]> = {
  quarter: [{ duration: 4 }],
  eighth:  [{ duration: 8 }, { duration: 8 }],
  triplet: [
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
    { duration: 8, tuplet: 3 },
  ],
  '8ss':   [{ duration: 8 },  { duration: 16 }, { duration: 16 }],
  's8s':   [{ duration: 16 }, { duration: 8 },  { duration: 16 }],
  'ss8':   [{ duration: 16 }, { duration: 16 }, { duration: 8 }],
};

/**
 * Overwrite each note's `durationDenominator` (and optionally `tuplet`)
 * based on the rhythm's per-beat slot pattern. Notes cycle through the
 * pattern modulo its length, so a 12-note sequence with the `8ss`
 * pattern produces [8,16,16, 8,16,16, 8,16,16, 8,16,16]. Other fields
 * (string, fret, midi, finger) are preserved.
 */
export function applyRhythm(
  sequence: NoteSequence,
  rhythm: Rhythm,
): NoteSequence {
  const pattern = RHYTHM_PATTERNS[rhythm];
  return sequence.map((note, i) => {
    const slot = pattern[i % pattern.length];
    const withDuration = { ...note, durationDenominator: slot.duration };
    if (slot.tuplet !== undefined) {
      withDuration.tuplet = slot.tuplet;
    } else {
      // Explicitly drop any inherited tuplet from the input note.
      delete withDuration.tuplet;
    }
    return withDuration;
  });
}
