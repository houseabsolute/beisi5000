import type { Scale } from '../theory/scales';
import type { Variant } from './types';

/**
 * Compute the MIDI value for a scale degree (0-indexed). Negative degrees
 * and degrees beyond the octave are handled with modular arithmetic across
 * octaves so callers can ask for, e.g., "degree -2" (the second below the
 * root) or "degree 9" (the third of the next octave).
 */
export function scaleDegreeMidi(
  scale: Scale,
  rootMidi: number,
  degree: number,
): number {
  const len = scale.intervals.length;
  const octaveOffset = Math.floor(degree / len) * 12;
  const index = ((degree % len) + len) % len;
  return rootMidi + octaveOffset + scale.intervals[index];
}

/**
 * Consecutive groups (e.g., 1-2-3, 1-2-3-4) ascending through the scale.
 * Group k contains degrees [k, k+1, ..., k+groupSize-1]. Groups start at
 * degree 0 and end at the last position where the group still fits within
 * one octave (so the final group's last note is the octave / degree N).
 */
export function consecutiveAscMidi(
  scale: Scale,
  rootMidi: number,
  groupSize: number,
): number[] {
  const top = scale.intervals.length; // octave degree
  const result: number[] = [];
  for (let d = 0; d <= top - groupSize + 1; d++) {
    for (let j = 0; j < groupSize; j++) {
      result.push(scaleDegreeMidi(scale, rootMidi, d + j));
    }
  }
  return result;
}

/**
 * Mirror patterns (e.g., 1-2-3-2-1) ascending through the scale. `peakSize`
 * is the count of notes up to the peak (inclusive). 1-2-3-2-1 has peakSize=3
 * and a total of 2*peakSize-1 = 5 notes per group.
 */
export function mirrorAscMidi(
  scale: Scale,
  rootMidi: number,
  peakSize: number,
): number[] {
  const top = scale.intervals.length;
  const result: number[] = [];
  // Shape offsets: ascend to peak then descend back: [0,1,...,peakSize-1,peakSize-2,...,0]
  const shape: number[] = [];
  for (let j = 0; j < peakSize; j++) shape.push(j);
  for (let j = peakSize - 2; j >= 0; j--) shape.push(j);
  for (let d = 0; d <= top - peakSize + 1; d++) {
    for (const off of shape) {
      result.push(scaleDegreeMidi(scale, rootMidi, d + off));
    }
  }
  return result;
}

/**
 * Interval walks (e.g., walking thirds, fourths). `interval` is in scale
 * degrees: 1=2nd, 2=3rd, 3=4th, ..., 7=octave. `intervalDir` controls
 * whether the second note in each pair is above (up) or below (down) the
 * first.
 *
 * The walk traverses all 7 starting degrees of one octave (0..6), so the
 * sequence has 7 pairs = 14 notes.
 */
export function intervalWalkAscMidi(
  scale: Scale,
  rootMidi: number,
  interval: number,
  intervalDir: 'up' | 'down',
): number[] {
  const result: number[] = [];
  const offset = intervalDir === 'up' ? interval : -interval;
  for (let d = 0; d < scale.intervals.length; d++) {
    result.push(scaleDegreeMidi(scale, rootMidi, d));
    result.push(scaleDegreeMidi(scale, rootMidi, d + offset));
  }
  return result;
}

/**
 * Walking-interval exercises play through the scale ascending with one
 * interval direction, then descend with the REVERSED interval direction.
 *
 * For walking 6ths up on C major:
 *   - Ascending half: 7 pairs [d, d+5] for d=0..6, each interval up.
 *     Last note: G one octave above starting C.
 *   - Descending half: 8 pairs [d, d−5] for d=7..0, each interval DOWN.
 *     First note: the HIGH ROOT (C an octave up), then a 6th below it.
 *
 * The high root sits at the asc→desc boundary as the first descending pair.
 */
function intervalWalkAscDescMidi(
  scale: Scale,
  rootMidi: number,
  interval: number,
  intervalDir: 'up' | 'down',
): number[] {
  const len = scale.intervals.length;
  const ascSign = intervalDir === 'up' ? 1 : -1;
  const result: number[] = [];
  // Ascending half: scale-up, interval in the given direction.
  for (let d = 0; d < len; d++) {
    result.push(scaleDegreeMidi(scale, rootMidi, d));
    result.push(scaleDegreeMidi(scale, rootMidi, d + interval * ascSign));
  }
  // Boundary: a "phantom" pair using the high root in the asc direction.
  // Lets the player play the root once for the asc direction before the
  // desc loop plays it again for the desc direction, e.g.,
  // walking-3rds-down on E♭ Lydian gets [..., D, B♭, E♭, C, E♭, G, ...].
  result.push(scaleDegreeMidi(scale, rootMidi, len));
  result.push(scaleDegreeMidi(scale, rootMidi, len + interval * ascSign));
  // Descending half: scale-down (degrees N..0), interval direction
  // reversed. The first pair (degree N = the octave / high root) bridges
  // the turnaround and is the desc-direction sibling of the boundary
  // pair pushed above.
  for (let d = len; d >= 0; d--) {
    result.push(scaleDegreeMidi(scale, rootMidi, d));
    result.push(scaleDegreeMidi(scale, rootMidi, d - interval * ascSign));
  }
  // Final resolution: append the (low) root so the exercise ends on the
  // tonic instead of a passing tone like B (walking-up) or C♯
  // (walking-down). This also lets the layout pin the start position so
  // the fingering finishes where it began.
  result.push(rootMidi);
  return result;
}

/**
 * Build the full MIDI sequence for any variant kind, including the
 * descending half.
 *
 * - Consecutive and mirror variants: descending = reverse of ascending
 *   with the apex dropped (apex played once at the transition).
 * - Interval-walk variants ("scale walk"): descending uses the REVERSED
 *   interval direction starting at the high root, so an "ascending 6ths"
 *   exercise turns around with high-root → 6th-below, then continues
 *   descending the scale with 6th-down pairs.
 */
export function variantSequenceMidi(
  scale: Scale,
  rootMidi: number,
  variant: Variant,
): number[] {
  switch (variant.kind) {
    case 'consecutive': {
      // Top note is the LAST note of the ascending sequence (e.g., the
      // octave at the end of [A B C] in 1-2-3 over C major). Repeat it at
      // the asc→desc boundary per the user's rule.
      const asc = consecutiveAscMidi(scale, rootMidi, variant.groupSize);
      const desc = asc.slice().reverse();
      return [...asc, ...desc];
    }
    case 'mirror': {
      // Mirror groups already pass through the top note in the middle of
      // the last group, so it's played twice naturally. The asc's LAST
      // note (the lower end of the last mirror group) is dropped to keep
      // the boundary smooth.
      const asc = mirrorAscMidi(scale, rootMidi, variant.peakSize);
      const desc = asc.slice(0, -1).reverse();
      return [...asc, ...desc];
    }
    case 'intervalWalk':
      return intervalWalkAscDescMidi(
        scale,
        rootMidi,
        variant.interval,
        variant.intervalDir,
      );
    default:
      throw new Error(
        `variantSequenceMidi: unsupported variant kind ${variant.kind}`,
      );
  }
}
