import type { Scale } from '../theory/scales';

function overOctaves(
  intervals: readonly number[],
  rootMidi: number,
  octaves: number,
  ascending: boolean,
): number[] {
  const ordered = ascending ? intervals : [...intervals].reverse();
  const result: number[] = [];
  if (ascending) {
    for (let oct = 0; oct < octaves; oct++) {
      const startMidi = rootMidi + oct * 12;
      for (const interval of ordered) {
        result.push(startMidi + interval);
      }
    }
    result.push(rootMidi + octaves * 12);
  } else {
    result.push(rootMidi + octaves * 12);
    for (let oct = octaves - 1; oct >= 0; oct--) {
      const startMidi = rootMidi + oct * 12;
      for (const interval of ordered) {
        result.push(startMidi + interval);
      }
    }
  }
  return result;
}

/**
 * Multi-Octave A: asymmetric loop. Ascend N octaves, then descend back to
 * the low root through the same notes. Apex is NOT repeated — these are
 * "simple scale" runs (per the user's rule: apex repeat applies only to
 * the more complex variants — walking intervals, consecutive groups,
 * mirrors — where the boundary helps re-orient the ear).
 */
export function multiOctaveAMidi(
  scale: Scale,
  rootMidi: number,
  octaves: number,
): number[] {
  const ascending = overOctaves(scale.intervals, rootMidi, octaves, true);
  const descending = overOctaves(
    scale.descendingIntervals ?? scale.intervals,
    rootMidi,
    octaves,
    false,
  ).slice(1); // drop shared apex
  return [...ascending, ...descending];
}

/**
 * Multi-Octave B: straightforward N-octave scale, up and back down. Apex
 * is NOT repeated — this is a "straightforward 2-octave" exercise.
 */
export function multiOctaveBMidi(
  scale: Scale,
  rootMidi: number,
  octaves: number,
): number[] {
  const ascending = overOctaves(scale.intervals, rootMidi, octaves, true);
  const descending = overOctaves(
    scale.descendingIntervals ?? scale.intervals,
    rootMidi,
    octaves,
    false,
  ).slice(1); // drop shared apex
  return [...ascending, ...descending];
}
