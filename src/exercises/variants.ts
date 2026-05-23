import type { Scale } from '../theory/scales';
import type { Variant, ArpDirection } from './types';

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
 * Build one arpeggio of `size` notes by stacking thirds (every other
 * scale degree) UPWARD from starting degree `d`.
 *
 * Used by arpeggioCycleMidi. The "stack of thirds" abstraction relies on
 * scaleDegreeMidi accepting arbitrary positive or negative degree
 * indices across octaves, which it already does.
 */
export function arpUp(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    out.push(scaleDegreeMidi(scale, rootMidi, d + 2 * i));
  }
  return out;
}

/**
 * Build one arpeggio of `size` notes by stacking thirds DOWNWARD from
 * starting degree `d`. This is NOT the up-stack reversed — it's the
 * stack going down from the root, so the function exists separately
 * rather than delegating to arpUp.
 */
export function arpDown(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    out.push(scaleDegreeMidi(scale, rootMidi, d - 2 * i));
  }
  return out;
}

/**
 * Build one arpeggio of `size` notes for the chord rooted at scale
 * degree `d`, voiced in `inversion` (0 = root position; K = K-th
 * inversion). For inversion K, the K chord tones below the new bass
 * get raised one octave so they sit above. Notes returned in
 * pitch-ascending order. Equivalent to `arpUp` when inversion = 0.
 */
export function invertedArpUp(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
  inversion: number,
): number[] {
  const scaleLen = scale.intervals.length;
  const degrees: number[] = [];
  for (let pos = 0; pos < size; pos++) {
    const degree = d + 2 * pos + (pos < inversion ? scaleLen : 0);
    degrees.push(degree);
  }
  degrees.sort((a, b) => a - b);
  return degrees.map((deg) => scaleDegreeMidi(scale, rootMidi, deg));
}

/**
 * Cycle through diatonic-third arpeggios rooted on each scale degree.
 * Asc + desc with the high-root arp as the pivot so the exercise
 * resolves symmetrically (same shape as the walking-interval cycles).
 * Spec: docs/superpowers/specs/2026-05-17-arpeggios-design.md.
 */
export function arpeggioCycleMidi(
  scale: Scale,
  rootMidi: number,
  size: 3 | 4 | 5 | 6 | 7,
  direction: ArpDirection,
  inversion: number = 0,
): number[] {
  if (direction === 'zigzag') {
    return arpeggioZigzag(scale, rootMidi, size); // zigzag ignores inversion
  }
  return arpeggioConsecutive(scale, rootMidi, size, direction, inversion);
}

function arpeggioConsecutive(
  scale: Scale,
  rootMidi: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
  inversion: number,
): number[] {
  const out: number[] = [];
  // Asc half (d=0..7)
  for (let d = 0; d <= 7; d++) {
    out.push(...arpAtDegree(scale, rootMidi, d, size, direction, inversion, 'asc'));
  }
  // Desc half (d=7..0)
  for (let d = 7; d >= 0; d--) {
    out.push(...arpAtDegree(scale, rootMidi, d, size, direction, inversion, 'desc'));
  }
  return out;
}

function arpAtDegree(
  scale: Scale,
  rootMidi: number,
  d: number,
  size: number,
  direction: Exclude<ArpDirection, 'zigzag'>,
  inversion: number,
  half: 'asc' | 'desc',
): number[] {
  const useUp =
    (half === 'asc' && (direction === 'allUp' || direction === 'upDown')) ||
    (half === 'desc' && (direction === 'allUp' || direction === 'downUp'));
  if (useUp) {
    // Only allUp gets inverted; upDown/downUp's up-arp halves stay at root position.
    return direction === 'allUp'
      ? invertedArpUp(scale, rootMidi, d, size, inversion)
      : arpUp(scale, rootMidi, d, size);
  }
  return arpDown(scale, rootMidi, d, size);
}

function arpeggioZigzag(
  scale: Scale,
  rootMidi: number,
  size: number,
): number[] {
  // Asc half: 8 arpeggios, alternating UP/DOWN, each starting a step
  // above where the previous ended.
  const asc: number[] = [];
  let d = 0;
  let goingUp = true;
  for (let i = 0; i < 8; i++) {
    const arp = goingUp
      ? arpUp(scale, rootMidi, d, size)
      : arpDown(scale, rootMidi, d, size);
    asc.push(...arp);
    // Next arp starts a step above this arp's LAST degree.
    d = (goingUp ? d + 2 * (size - 1) : d - 2 * (size - 1)) + 1;
    goingUp = !goingUp;
  }
  // Desc = reverse(asc). Drop the first note of desc to avoid doubling
  // the pivot note (asc's last note == desc's first note).
  const desc = asc.slice().reverse().slice(1);
  return [...asc, ...desc];
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
