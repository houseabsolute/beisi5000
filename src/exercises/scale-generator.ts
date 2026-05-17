import { midiPitchClass, pitchClassName, type PitchClass } from '../theory/notes';
import type { Scale } from '../theory/scales';
import {
  type Tuning,
  type FretboardPosition,
  midiToPositions,
} from '../theory/tunings';
import {
  type HandPosition,
  isValidStartingFret,
  isValidWalkingStartingFret,
  handPositionLabel,
  handPositionEmoji,
} from '../theory/fingerings';
import { emitAlphaTex } from '../notation/alphatex-emitter';
import { multiOctaveAMidi, multiOctaveBMidi } from './multi-octave';
import {
  intervalWalkAscMidi,
  scaleDegreeMidi,
  variantSequenceMidi,
} from './variants';
import type {
  ExerciseParams,
  Exercise,
  FretboardNote,
  NoteSequence,
  Variant,
} from './types';

const DEFAULT_MAX_FRET = 24;

export function ascendingScaleMidi(scale: Scale, rootMidi: number): number[] {
  return [...scale.intervals.map((i) => rootMidi + i), rootMidi + 12];
}

export function descendingScaleMidi(scale: Scale, rootMidi: number): number[] {
  // For scales that distinguish descending (e.g., classical melodic minor),
  // build from descendingIntervals; otherwise reverse the ascending sequence.
  if (scale.descendingIntervals) {
    return [
      rootMidi + 12,
      ...[...scale.descendingIntervals]
        .reverse()
        .map((i) => rootMidi + i),
    ];
  }
  return ascendingScaleMidi(scale, rootMidi).reverse();
}

/**
 * Pick the starting fretboard position for the root.
 *
 * Default: lowest-pitched string where the root is reachable AND the hand
 * position is valid for that fret. (User's rule: "all scales should start
 * on the lowest possible string.")
 *
 * `minMidi` constrains the root to a position whose pitch is at least this
 * MIDI value — used for walking-down interval variants where the lower
 * note of each pair needs to fit on a string below the upper note's string.
 *
 * If `preferOpenStringRoot` is true, search for a position where the root
 * sits on an open string (fret 0). Only meaningful with front hand, since
 * mid/back require fret >= 2 / >= 3.
 */
export function pickStartingPosition(
  rootPc: PitchClass,
  handPosition: HandPosition,
  tuning: Tuning,
  options: {
    maxFret?: number;
    preferOpenStringRoot?: boolean;
    minMidi?: number;
    /**
     * Minimum string index (0 = lowest pitch). Used by walking-down
     * interval variants to ensure there's at least one string BELOW the
     * starting position so the lower note of each pair can land on an
     * adjacent lower string at the same fret.
     */
    minStringIndex?: number;
    /**
     * Maximum string index (inclusive). Used by arpeggio-cycle variants
     * to keep the root low on the neck so the cycle has room to climb.
     * 4-string basses: 1 (bottom 2 strings). 5/6-string: 2.
     */
    maxStringIndex?: number;
  } = {},
): FretboardPosition | null {
  const maxFret = options.maxFret ?? DEFAULT_MAX_FRET;
  const minMidi = options.minMidi ?? -Infinity;
  const minStringIndex = options.minStringIndex ?? 0;
  const maxStringIndex = options.maxStringIndex ?? tuning.stringCount - 1;
  const candidates: FretboardPosition[] = [];
  for (let s = minStringIndex; s <= maxStringIndex; s++) {
    const openPc = midiPitchClass(tuning.openMidi[s]);
    // Find the lowest fret on this string that produces the pitch class.
    // If the open string + that fret is below minMidi, walk up an octave.
    let fret = ((rootPc - openPc) % 12 + 12) % 12;
    while (tuning.openMidi[s] + fret < minMidi && fret + 12 <= maxFret) {
      fret += 12;
    }
    if (
      fret <= maxFret &&
      isValidStartingFret(handPosition, fret) &&
      tuning.openMidi[s] + fret >= minMidi
    ) {
      candidates.push({ string: s, fret });
    }
  }
  if (candidates.length === 0) return null;

  if (options.preferOpenStringRoot) {
    const openPos = candidates.find((c) => c.fret === 0);
    if (openPos) return openPos;
  }

  // Default: lowest STRING (not lowest fret), tie-break by lowest fret.
  // First, drop top-string candidates if there are non-top alternatives
  // — exercises that start on the highest string have nowhere to climb
  // and force awkward same-string runs.
  const filtered = excludeTopStringIfPossible(candidates, tuning);
  filtered.sort((a, b) => a.string - b.string || a.fret - b.fret);
  return filtered[0];
}

/**
 * Drop top-string starting positions when other strings are available.
 * Exercises that start on the highest string have no string above to
 * spread onto, which forces high-fret same-string runs on the climb.
 * If the ONLY valid positions are on the top string, return them
 * unchanged — better to surface the exercise than to lose it entirely.
 */
function excludeTopStringIfPossible(
  candidates: FretboardPosition[],
  tuning: Tuning,
): FretboardPosition[] {
  const topString = tuning.stringCount - 1;
  const nonTop = candidates.filter((c) => c.string !== topString);
  return nonTop.length > 0 ? nonTop : candidates;
}

/**
 * The lowest scale-degree offset (in semitones, relative to the root)
 * the variant ever reaches. All walking-interval exercises eventually
 * touch `degree -interval`: walking-down does so on the asc half (where
 * pairs go DOWN), walking-up does so on the desc half (where the
 * interval direction reverses). Used by both the picker and the
 * generator to require a starting MIDI that keeps the low notes
 * reachable on the bass.
 */
export function lowestDegreeOffsetSemitones(
  scale: Scale,
  variant: Variant,
): number {
  if (variant.kind === 'intervalWalk') {
    const len = scale.intervals.length;
    const degree = -variant.interval;
    const octaveOffset = Math.floor(degree / len) * 12;
    const idx = ((degree % len) + len) % len;
    return octaveOffset + scale.intervals[idx];
  }
  return 0;
}

/**
 * Build the start-position constraints (minMidi, minStringIndex) for a
 * variant. The picker uses these to surface only validly-playable
 * exercises; the generator uses the same values so its starting position
 * matches what the picker validated.
 */
export function startConstraintsForVariant(
  scale: Scale,
  variant: Variant,
  tuning: Tuning,
): { minMidi?: number; minStringIndex: number } {
  if (variant.kind !== 'intervalWalk') return { minStringIndex: 0 };
  const lowestOffset = lowestDegreeOffsetSemitones(scale, variant);
  const minMidi =
    lowestOffset < 0 ? tuning.openMidi[0] - lowestOffset : undefined;
  // Walking-down's first pair drops a string for the lower note; require
  // at least one string below the starting string.
  const minStringIndex = variant.intervalDir === 'down' ? 1 : 0;
  return { minMidi, minStringIndex };
}

/**
 * Pick the starting position for a walking-interval exercise that uses
 * the general layout (2nds through 6ths — 7ths and octaves use the
 * separate `pickStartingPositionForWalkingPairs`).
 *
 * The first pair of any walking exercise locks in the fingering shape:
 * if the second note of the pair doesn't fit comfortably near the root,
 * the whole exercise plays in an awkward stretched position. We rank
 * candidates by how close the closest second-note placement sits to the
 * root, then break ties by lowest fret (so we play the exercise in a
 * low-neck region where there's room for the desc-half's low notes).
 *
 * This replaces the plain "lowest string" rule for walking — that rule
 * works for plain scales but for walking-up with a minMidi constraint
 * (when the desc reaches BELOW the root), the lowest valid string can
 * be at a very high fret while a higher string at a much lower fret
 * fits the first pair better.
 */
export function pickStartingPositionForWalking(
  rootPc: PitchClass,
  handPosition: HandPosition,
  tuning: Tuning,
  scale: Scale,
  variant: Variant,
  constraints: { minMidi?: number; minStringIndex?: number } = {},
): FretboardPosition | null {
  if (variant.kind !== 'intervalWalk') return null;
  const minMidi = constraints.minMidi ?? -Infinity;
  const minStringIndex = constraints.minStringIndex ?? 0;
  const ascSign = variant.intervalDir === 'up' ? 1 : -1;

  // Collect every valid root position. Walking exercises pair each
  // root note with a second note on a different string, so the
  // mid/back hand-position fret minimums (which exist to allow a
  // reach-back for adjacent same-string scale tones) don't apply —
  // mid/back can start as low as fret 1 here. Open-string roots stay
  // front-only since mid/back physically can't fret fret 0.
  const rawCandidates: FretboardPosition[] = [];
  for (let s = minStringIndex; s < tuning.stringCount; s++) {
    const openPc = midiPitchClass(tuning.openMidi[s]);
    let fret = ((rootPc - openPc) % 12 + 12) % 12;
    while (tuning.openMidi[s] + fret < minMidi && fret + 12 <= DEFAULT_MAX_FRET) {
      fret += 12;
    }
    if (
      fret <= DEFAULT_MAX_FRET &&
      isValidWalkingStartingFret(handPosition, fret) &&
      tuning.openMidi[s] + fret >= minMidi
    ) {
      rawCandidates.push({ string: s, fret });
    }
  }
  if (rawCandidates.length === 0) return null;
  // Walking exercises sound jumpier when they begin on an open string
  // (no warm-up note from a fretted root), so prefer fretted starts
  // when at least one is available. Falls back to open-only when
  // there's no fretted alternative.
  const withoutOpen = rawCandidates.filter((c) => c.fret > 0);
  const candidates = excludeTopStringIfPossible(
    withoutOpen.length > 0 ? withoutOpen : rawCandidates,
    tuning,
  );

  // Score by closest second-note fit. STRING_WEIGHT mirrors the cost
  // function in layOnFretboard so the picker agrees with what the
  // layout will do.
  const STRING_WEIGHT = 4;
  const scored = candidates.map((c) => {
    const rootMidi = tuning.openMidi[c.string] + c.fret;
    const secondMidi = scaleDegreeMidi(scale, rootMidi, variant.interval * ascSign);
    let bestFit = Infinity;
    for (
      let s2 = Math.max(0, c.string - 2);
      s2 <= Math.min(tuning.stringCount - 1, c.string + 2);
      s2++
    ) {
      const fret2 = secondMidi - tuning.openMidi[s2];
      if (fret2 < 0 || fret2 > DEFAULT_MAX_FRET) continue;
      const dist =
        Math.abs(s2 - c.string) * STRING_WEIGHT + Math.abs(fret2 - c.fret);
      if (dist < bestFit) bestFit = dist;
    }
    return { pos: c, fit: bestFit };
  });
  // Sort by fit (with a tolerance) then by ergonomic position. The
  // tolerance lets candidates within a couple cost-units of the best
  // fit tie-break on position — e.g., B Harm Min walking 3rds ↓
  // gives A2 fit=5 and D9 fit=4, both essentially the same physical
  // ease; without tolerance D9 wins by a hair, but A2 is the
  // first-position-friendly start the player expects. STRING_WEIGHT
  // mirrors the layout's cost-function idea that a string move costs
  // about as much as a 4-fret move.
  const FIT_TOLERANCE = 2;
  scored.sort((a, b) => {
    if (Math.abs(a.fit - b.fit) > FIT_TOLERANCE) return a.fit - b.fit;
    return (
      a.pos.string * 4 + a.pos.fret - (b.pos.string * 4 + b.pos.fret)
    );
  });
  return scored[0].pos;
}

/**
 * 7ths and octaves: the natural bass fingering puts the two notes of each
 * pair on strings that are exactly 2 apart (so the fret distance stays
 * within 0-2). Anything else requires same-string stretches greater than
 * the 4-fret limit. This returns true when the variant should be laid out
 * with a fixed 2-string-apart pair offset.
 */
/**
 * Largest pair span in semitones across every position in a walking
 * variant. Computed by stepping through each scale degree and measuring
 * the gap to its walking partner (interval scale steps away). Used to
 * decide whether hand position is a meaningful choice — if every pair
 * spans more than the hand can comfortably hold, the starting finger
 * is forced by interval direction and not by user choice.
 *
 * Returns 0 for non-walking variants.
 */
export function walkingPairMaxSemitones(
  scale: Scale,
  variant: Variant,
): number {
  if (variant.kind !== 'intervalWalk') return 0;
  const len = scale.intervals.length;
  let max = 0;
  for (let k = 0; k < len; k++) {
    const a = scale.intervals[k];
    const otherK =
      variant.intervalDir === 'up' ? k + variant.interval : k - variant.interval;
    const octaveOffset = Math.floor(otherK / len) * 12;
    const idx = ((otherK % len) + len) % len;
    const b = scale.intervals[idx] + octaveOffset;
    const span = Math.abs(b - a);
    if (span > max) max = span;
  }
  return max;
}

/**
 * Hand position is "meaningful" — i.e., the user's front/mid/back
 * choice actually changes the layout — only when every walking pair
 * fits inside (or near) a hand window. For walking 5ths and wider, the
 * pair span (≥ 7 semitones) exceeds the hand's stretched reach, so
 * the starting finger is dictated by interval direction (index for
 * scale-up + interval-up, pinky for the down variants) and hand
 * position becomes redundant. The picker then surfaces just one
 * canonical version of these exercises regardless of which hand
 * positions are enabled.
 */
export function isHandPositionMeaningful(
  scale: Scale,
  variant: Variant,
): boolean {
  if (variant.kind !== 'intervalWalk') return true;
  return walkingPairMaxSemitones(scale, variant) < 7;
}

/**
 * Canonical hand position for a wide-interval walking variant — used
 * when {@link isHandPositionMeaningful} is false. Scale-up + interval-up
 * leads with the index finger (front); the inverse leads with the
 * pinky (back). Only meaningful for intervalWalk variants.
 */
export function canonicalHandPositionForWideWalk(
  variant: Variant,
): HandPosition {
  if (variant.kind !== 'intervalWalk') return 'front';
  return variant.intervalDir === 'down' ? 'back' : 'front';
}

export function isLargeWalkingInterval(variant: Variant): boolean {
  return (
    variant.kind === 'intervalWalk' &&
    (variant.interval === 6 || variant.interval === 7)
  );
}

/**
 * Pick a starting position for a walking-7ths or walking-octaves exercise.
 * Each pair will sit on two strings exactly 2 apart, so the starting string
 * must be at most `stringCount - 3` (leaving 2 strings above it for the
 * upper member of the pair). Among the candidates, we pick the LOWEST FRET
 * (not the lowest string) so the whole walk plays in a comfortable region
 * of the neck. The picker also verifies that the highest upper note and
 * the lowest lower note of the walk both fit within fret 24.
 */
export function pickStartingPositionForWalkingPairs(
  rootPc: PitchClass,
  handPosition: HandPosition,
  tuning: Tuning,
  scale: Scale,
  variant: Variant,
): { pos: FretboardPosition; stringOffset: number } | null {
  if (variant.kind !== 'intervalWalk') return null;
  const stringOffset = 2;
  const candidates: { pos: FretboardPosition; maxFret: number }[] = [];
  for (let s = 0; s + stringOffset < tuning.stringCount; s++) {
    const openPc = midiPitchClass(tuning.openMidi[s]);
    const rootFret = ((rootPc - openPc) % 12 + 12) % 12;
    if (rootFret > DEFAULT_MAX_FRET) continue;
    if (!isValidWalkingStartingFret(handPosition, rootFret)) continue;
    const rootMidi = tuning.openMidi[s] + rootFret;

    const topDegree = scale.intervals.length - 1;
    // The asc + desc structure of intervalWalkAscDescMidi covers BOTH
    // [degree -interval, degree topDegree+interval] regardless of
    // intervalDir. The desc half reverses the interval direction, so a
    // walking-up exercise's desc half reaches degree -interval (one
    // octave below the root for walking octaves), and a walking-down
    // exercise's desc half reaches degree topDegree+interval. Validate
    // the FULL range so combos that go below the bass's lowest playable
    // note (or above the top fret) get rejected.
    const highMidi = scaleDegreeMidi(
      scale,
      rootMidi,
      topDegree + variant.interval,
    );
    const lowMidi = scaleDegreeMidi(scale, rootMidi, -variant.interval);

    const upperString = s + stringOffset;
    const highFret = highMidi - tuning.openMidi[upperString];
    const lowFret = lowMidi - tuning.openMidi[s];
    if (highFret < 0 || highFret > DEFAULT_MAX_FRET) continue;
    if (lowFret < 0 || lowFret > DEFAULT_MAX_FRET) continue;
    // The root appears as the UPPER note of either asc d=0
    // (walking-down) or desc d=0 (walking-up), so it must fit on the
    // upperString. Without this check, scales whose `interval` span is
    // less than the 10-semitone string-pair gap (e.g., chromatic
    // walk +6 = 6 semitones) produce a negative fret for the root on
    // upperString.
    if (rootMidi < tuning.openMidi[upperString]) continue;
    candidates.push({
      pos: { string: s, fret: rootFret },
      maxFret: Math.max(highFret, rootFret),
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.pos.fret - b.pos.fret);
  return { pos: candidates[0].pos, stringOffset };
}

/**
 * Lay walking-interval pairs onto the fretboard with a fixed string
 * offset between each pair's two notes. Used for 7ths and octaves where
 * 1-string fingerings would require impractical fret stretches.
 */
export function layWalkingPairsOnFretboard(
  midiSeq: number[],
  tuning: Tuning,
  baseString: number,
  stringOffset: number,
): NoteSequence {
  const result: NoteSequence = [];
  const upperString = baseString + stringOffset;
  for (let i = 0; i + 1 < midiSeq.length; i += 2) {
    const a = midiSeq[i];
    const b = midiSeq[i + 1];
    const upperMidi = Math.max(a, b);
    const lowerMidi = Math.min(a, b);
    const upperFret = upperMidi - tuning.openMidi[upperString];
    const lowerFret = lowerMidi - tuning.openMidi[baseString];
    // Treat each pair as a mini-window anchored at the lower fret of the
    // two notes — that's where the index naturally sits when reaching
    // across two strings for a 7th/octave pair.
    const anchor = Math.min(upperFret, lowerFret);
    const upperNote: FretboardNote = {
      string: upperString,
      fret: upperFret,
      midi: upperMidi,
      durationDenominator: 8,
      finger: assignFinger(upperFret, anchor),
    };
    const lowerNote: FretboardNote = {
      string: baseString,
      fret: lowerFret,
      midi: lowerMidi,
      durationDenominator: 8,
      finger: assignFinger(lowerFret, anchor),
    };
    if (a === upperMidi) {
      result.push(upperNote, lowerNote);
    } else {
      result.push(lowerNote, upperNote);
    }
  }
  return result;
}

/**
 * Are there both fretted and open-string starting positions for this root +
 * hand-position + tuning? Used by the picker to know when to surface "open"
 * as a separate exercise variant.
 *
 * Conditions:
 *   - Hand position is front (open-string roots can't sit under mid/back).
 *   - Open variant is at the same pitch as the lowest fretted variant
 *     (so it's a fingering choice, not a different octave).
 *   - Open variant is NOT on the highest string — otherwise an ascending
 *     exercise has no string above to spread onto.
 */
export function hasOpenStringVariant(
  rootPc: PitchClass,
  handPosition: HandPosition,
  tuning: Tuning,
): boolean {
  if (handPosition !== 'front') return false;
  const lowest = pickStartingPosition(rootPc, handPosition, tuning);
  const open = pickStartingPosition(rootPc, handPosition, tuning, {
    preferOpenStringRoot: true,
  });
  if (!lowest || !open) return false;
  if (open.fret !== 0) return false;
  if (open.string === tuning.stringCount - 1) return false;
  if (lowest.string === open.string) return false;
  const lowestMidi = tuning.openMidi[lowest.string] + lowest.fret;
  const openMidi = tuning.openMidi[open.string] + open.fret;
  return lowestMidi === openMidi;
}

/**
 * Hand-position fret windows (inclusive).
 *
 * Base = comfortable 4-finger position. Stretch = with one extra fret reach
 * by index (back) or both index and pinky (mid).
 *
 * - front:  base [root,    root+4]  / stretch same    — index on root, pinky to root+4
 * - mid:    base [root-1,  root+2]  / stretch [root-2, root+3]
 *           middle on root; index back-stretch to root-2 lets the next string's
 *           first scale note sit comfortably under the index.
 * - back:   base [root-3,  root]    / stretch [root-4, root]
 *           pinky on root; index back-stretch to root-4 catches notes that
 *           would otherwise be unreachable on the next string up.
 */
/**
 * Map a fret to a fretting-hand finger (1=index .. 4=pinky) given the
 * current window's anchor — the fret the index finger sits on.
 *
 * - Open string (fret 0): conventionally the index, anchored at fret 0.
 *   This matches a player's mental model: e.g., open E followed by G♯ on
 *   E fret 4 is played with index + pinky (stretch), not a hand shift.
 * - Otherwise: `fret - anchor + 1`, clamped to [1, 4]. Frets beyond the
 *   pinky's normal reach (anchor+3) are still pinky, just stretched.
 */
function assignFinger(fret: number, anchorFret: number): number {
  if (fret === 0) return 1;
  const raw = fret - anchorFret + 1;
  if (raw < 1) return 1;
  if (raw > 4) return 4;
  return raw;
}

/**
 * Map a fret to the window anchor (index-finger fret) it implies for a
 * given hand position. Mirrors `computeBaseWindow(rootFret, hp)[0]`.
 * Pulled out so cost computations can find the anchor implied by any
 * candidate placement without recomputing the full window tuple.
 */
function anchorForFret(fret: number, hp: HandPosition): number {
  switch (hp) {
    case 'front':
      return Math.max(0, fret);
    case 'mid':
      return Math.max(0, fret - 1);
    case 'back':
      return Math.max(0, fret - 3);
  }
}

const STRING_WEIGHT = 4;
// A 4-fret same-string move means the hand is fully stretched
// (index→pinky). With this penalty, a cross-string-by-1 move with up to
// 3 Δfret (cost 4+3=7) wins over the stretched same-string slide
// (cost 4+5=9). Matches the player's preference to switch strings
// rather than stretch the hand.
const SAME_STRING_FULL_STRETCH_PENALTY = 5;
// A 5+ fret same-string move slides the hand along the string. Almost
// always wrong, but sometimes the cleanest option when the alternative
// is a far cross-string leap (e.g., F3 in C In Sen mid-hand). Penalty
// is moderate — it loses to good cross-string moves but beats cross-
// string leaps with large Δfret. Tuned to 5 so that the DP prefers a
// clean cross-string trajectory into the pinned root over an
// equivalent-cost slide (the squared-cost DP magnifies small per-step
// differences).
const SAME_STRING_HAND_SLIDE_PENALTY = 5;
// Outside the 5-fret stretched window of the current anchor — the hand
// has to move. Roughly two cross-string moves' worth of cost.
const WINDOW_SHIFT_PENALTY = 8;
// When the most recently used finger was index (1) or pinky (4), the
// hand is committed to its current position. Extra penalty for moving
// it from there.
const EDGE_FINGER_INERTIA_PENALTY = 4;
// Two consecutive moves of 4+ frets are much harder than one. The
// hand has to span the full stretch twice in a row, with no chance to
// settle. Penalty added when both the incoming and outgoing moves
// reach 4 frets.
const CONSECUTIVE_LARGE_JUMP_PENALTY = 4;
const LARGE_JUMP_THRESHOLD = 4;

/**
 * Unified placement cost. Used wherever the layout has to choose among
 * candidate fretboard positions for the next note (fall-back picker and
 * lookahead DP). Tuned to:
 *
 * - Prefer keeping the hand anchored at its "home" position (the start
 *   position's anchor). `anchorFret` is always the home anchor here,
 *   not whatever drifted local window the layout happened to be in —
 *   that's what makes the hand return to home when reachable.
 * - Prefer cross-string moves over fully-stretched (4-fret) same-string
 *   moves.
 * - Tolerate 5+ fret same-string slides when no cross-string option is
 *   reasonable — they're cheap enough to win over a bad cross-string
 *   leap but lose to a clean cross-string move.
 * - When the boundary fingers (index/pinky) are engaged, charge extra
 *   for moves that disturb the anchor.
 */
function placementCost(
  prev: FretboardPosition,
  prevFinger: number,
  cand: FretboardPosition,
  anchorFret: number,
  /**
   * Fret distance of the move that brought us TO `prev`, if known.
   * Used to surcharge a second consecutive large fret jump — pairs of
   * 4+ fret moves in a row are punishingly hard, much more than two
   * separate single jumps.
   */
  prevMoveFret?: number,
): number {
  const dString = Math.abs(cand.string - prev.string);
  const dFret = Math.abs(cand.fret - prev.fret);
  // String distance is linear up to 2 strings (a wrist rotation), then
  // doubles past that — 3+ strings means moving the whole forearm, not
  // just the fingers, and is much harder than 1.5× a 2-string move.
  // Without this, the DP picks "E12 → G4" (3 strings + 8 frets =
  // wrist/arm relocation) as a smoother trajectory entry than "E12 →
  // A14" (1 string + 2 frets), because subsequent steps from G4 cost
  // less. The non-linear penalty correctly identifies the big arm
  // motion as the dominant cost.
  let cost = dString * STRING_WEIGHT + dFret;
  if (dString >= 3) cost += dString * STRING_WEIGHT;
  // Fret distance past the 4-fret comfortable hand span scales
  // quadratically — every additional fret past the pinky's reach is
  // incrementally more committed to a full hand shift. dFret 5 adds
  // 1; dFret 7 adds 9; dFret 10 adds 36. Keeps small reaches cheap
  // while making big leaps decisively expensive.
  if (dFret > 4) {
    const over = dFret - 4;
    cost += over * over;
  }
  if (dString === 0) {
    if (dFret === 4) cost += SAME_STRING_FULL_STRETCH_PENALTY;
    else if (dFret >= 5) cost += SAME_STRING_HAND_SLIDE_PENALTY;
  }
  const inWindow =
    cand.fret >= anchorFret && cand.fret <= anchorFret + 4;
  if (!inWindow) {
    cost += WINDOW_SHIFT_PENALTY;
    if (prevFinger === 1 || prevFinger === 4) {
      cost += EDGE_FINGER_INERTIA_PENALTY;
    }
  }
  if (
    prevMoveFret !== undefined &&
    prevMoveFret >= LARGE_JUMP_THRESHOLD &&
    dFret >= LARGE_JUMP_THRESHOLD
  ) {
    cost += CONSECUTIVE_LARGE_JUMP_PENALTY;
  }
  return cost;
}

function computeBaseWindow(
  rootFret: number,
  hp: HandPosition,
): [number, number] {
  switch (hp) {
    case 'front':
      return [Math.max(0, rootFret), rootFret + 4];
    case 'mid':
      return [Math.max(0, rootFret - 1), rootFret + 2];
    case 'back':
      return [Math.max(0, rootFret - 3), rootFret];
  }
}

function computeStretchWindow(
  rootFret: number,
  hp: HandPosition,
): [number, number] {
  switch (hp) {
    case 'front':
      return [Math.max(0, rootFret), rootFret + 4];
    case 'mid':
      return [Math.max(0, rootFret - 2), rootFret + 3];
    case 'back':
      return [Math.max(0, rootFret - 4), rootFret];
  }
}

/**
 * Maximum scale notes per string before forcing a string change.
 *
 * For the EXERCISE'S STARTING string, this depends on which finger plays the
 * root:
 *   - front (index on root): 3 — index, ring, pinky each play scale notes
 *   - mid (middle on root):  2 — middle and pinky; only 2 scale notes fit
 *   - back (pinky on root):  1 — pinky on root, then move strings immediately
 *
 * For every subsequent string (after we've left the starting string), the
 * leading finger is index regardless of original hand position, so max is 3.
 */
function maxNotesOnStartingString(hp: HandPosition): number {
  switch (hp) {
    case 'front':
      return 3;
    case 'mid':
      return 2;
    case 'back':
      return 1;
  }
}
const MAX_NOTES_PER_STRING = 3;

/**
 * Lay a sequence of MIDI notes onto the fretboard.
 *
 * Strategy: stay in a single hand position as long as possible, but cap the
 * notes per string per the rules above. For each note:
 *   1. If we haven't hit the per-string cap, try same string within base
 *      window, then adjacent strings (direction-aware).
 *   2. If we have hit the cap, force a move to the adjacent string toward
 *      the music's direction.
 *   3. Use stretch window when base doesn't fit (back hand index back to
 *      root-4; mid hand pinky to root+3 — both built into the window).
 *   4. Fall back to closest reachable position; shift window to follow and
 *      reset the per-string counter (we're now in a new hand position).
 *
 * For G major front-hand this produces 3-3-2; A major back-hand gives
 * 1-3-2-2 with a root-4 stretch for G♯; D dorian mid-hand gives 2-3-3.
 */
/**
 * Find the lowest-total-movement-cost trajectory through `midis` that
 * starts from `startPos`'s neighborhood and ends at `pinPos` (forced).
 *
 * Used for the lookahead-biased tail of walking-interval exercises:
 * once the layout enters the lookahead window, a per-step greedy picker
 * can't see the multi-note plan and lands the inevitable string-crossing
 * in the worst possible place. A small DP over the up-to-4 candidate
 * positions per note finds a trajectory that distributes movement
 * smoothly across the window instead.
 *
 * The cost between two positions matches the rest of layOnFretboard's
 * cost function: `STRING_WEIGHT * stringDiff + fretDiff`.
 *
 * Returns an array of positions, one per MIDI value, with the final
 * entry equal to `pinPos`.
 */
function solveLookaheadDP(
  midis: number[],
  startPos: FretboardPosition,
  startFinger: number,
  startAnchor: number,
  pinPos: FretboardPosition,
  pinnedMidi: number,
  handPosition: HandPosition,
  tuning: Tuning,
  avoidOpenStrings: boolean = false,
): FretboardPosition[] {
  const OPEN_STRING_PENALTY = 6;
  // Per-step cost is SQUARED so the DP minimizes the L2 norm of the
  // trajectory's movements, not the L1. With L1, two trajectories with
  // the same sum cost are equal — the DP tie-breaks arbitrarily, often
  // landing the big string-crossing on the very last note. With L2,
  // (small + small + small + big)² loses to (medium + medium + medium +
  // medium)², so the DP naturally spreads movement evenly across the
  // window. Squaring also amplifies the placement-cost penalties
  // (window shift, hand slide) — desirable, since a single 5+ fret
  // same-string slide shouldn't be excused by the rest of the path
  // being smooth.
  const edgeCost = (
    from: FretboardPosition,
    fromFinger: number,
    fromAnchor: number,
    to: FretboardPosition,
    prevMoveFret?: number,
  ): number => {
    const open = avoidOpenStrings && to.fret === 0 ? OPEN_STRING_PENALTY : 0;
    const c =
      placementCost(from, fromFinger, to, fromAnchor, prevMoveFret) + open;
    return c * c;
  };

  // Candidate positions per note. Last layer is forced to [pinPos] so
  // every path through the DP ends at the pin.
  const candidates: FretboardPosition[][] = midis.map((m) =>
    midiToPositions(tuning, m),
  );
  // Silence unused-parameter warning — pinnedMidi reserved for future
  // tuning of intermediate root behavior.
  void pinnedMidi;
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].length === 0) {
      throw new Error(`MIDI ${midis[i]} unreachable on tuning ${tuning.id}`);
    }
  }
  candidates[candidates.length - 1] = [pinPos];

  // layers[i][k] = { cost: best cost to reach candidates[i][k] from
  // startPos, prevIdx: the index into candidates[i-1] of the chosen prev,
  // prevEdgeFret: dFret of the move that landed at this cell — used by
  // the next layer's cost function to detect consecutive large jumps }.
  type Cell = { cost: number; prevIdx: number; prevEdgeFret: number };
  const layers: Cell[][] = [];

  // First note: cost from startPos (with the layout's actual prior
  // finger/anchor so the DP sees the same hand state the main loop
  // had when it kicked off the lookahead).
  layers.push(
    candidates[0].map((p) => ({
      cost: edgeCost(startPos, startFinger, startAnchor, p),
      prevIdx: -1,
      prevEdgeFret: Math.abs(p.fret - startPos.fret),
    })),
  );

  for (let i = 1; i < candidates.length; i++) {
    const layer: Cell[] = candidates[i].map((p) => {
      let bestCost = Infinity;
      let bestPrev = -1;
      let bestEdgeFret = 0;
      candidates[i - 1].forEach((q, k) => {
        const qFinger = assignFinger(q.fret, startAnchor);
        const c =
          layers[i - 1][k].cost +
          edgeCost(q, qFinger, startAnchor, p, layers[i - 1][k].prevEdgeFret);
        if (c < bestCost) {
          bestCost = c;
          bestPrev = k;
          bestEdgeFret = Math.abs(p.fret - q.fret);
        }
      });
      return { cost: bestCost, prevIdx: bestPrev, prevEdgeFret: bestEdgeFret };
    });
    layers.push(layer);
  }

  // Trace back. Final layer has exactly one entry (pinPos).
  const path: FretboardPosition[] = [];
  let idx = 0;
  for (let i = candidates.length - 1; i >= 0; i--) {
    path.unshift(candidates[i][idx]);
    idx = layers[i][idx].prevIdx;
  }
  return path;
}

export function layOnFretboard(
  midiSeq: number[],
  tuning: Tuning,
  startPos: FretboardPosition,
  handPosition: HandPosition = 'front',
  options: { applyPinLookahead?: boolean; avoidOpenStrings?: boolean } = {},
): NoteSequence {
  // Lookahead is for variants whose desc wanders far from the start
  // (walking-interval exercises that drift high to reach the apex). For
  // plain scales / multi-octave / mirror / consecutive variants the desc
  // naturally retraces the asc and lookahead just disturbs the natural
  // fingering.
  const applyPinLookahead = options.applyPinLookahead ?? false;
  const avoidOpenStrings = options.avoidOpenStrings ?? false;
  // Open-string positions (fret 0) sound jumpier and harder to mute
  // in walking exercises. The penalty is sized so a candidate that
  // just-barely sits outside the current window (one full hand-shift
  // away, cost roughly basic + shift ≈ 12-17) still wins against
  // the open-string option — i.e., we'll happily move the hand to
  // a fretted note rather than tap an open string. Cases where every
  // alternative is way out of reach (cost > ~25) still pick the open
  // string because their basic-cost difference exceeds the penalty.
  const OPEN_STRING_PENALTY = 10;
  if (midiSeq.length === 0) return [];
  let baseWindow = computeBaseWindow(startPos.fret, handPosition);
  let stretchWindow = computeStretchWindow(startPos.fret, handPosition);
  // The home anchor is the index-finger position implied by startPos
  // and the hand position. Cost computations always reference home,
  // never the drifted local window — that's what pulls the layout
  // back toward the start when the player's hand could reasonably
  // return there. Local baseWindow is still used for reachability
  // probes in the early paths.
  const homeAnchor = anchorForFret(startPos.fret, handPosition);

  const result: FretboardNote[] = [
    {
      ...startPos,
      midi: midiSeq[0],
      durationDenominator: 8,
      finger: assignFinger(startPos.fret, baseWindow[0]),
    },
  ];
  // Position cache: within a single hand-position window, every unique MIDI
  // keeps the position of its first placement, so a pitch always plays at
  // the same fretboard location. The cache CLEARS whenever the window
  // shifts (the hand moves to a new position) — this is what makes
  // multi-octave scales work: within each octave's hand position, pitches
  // are consistent, but a pitch revisited from a different hand position
  // can use that position's natural fingering.
  let positionCache = new Map<number, FretboardPosition>();
  positionCache.set(midiSeq[0], {
    string: startPos.string,
    fret: startPos.fret,
  });
  // Pinned root: the starting note's MIDI always plays at the starting
  // fretboard position, even after window shifts have cleared the regular
  // cache. Ensures the exercise ENDS where it began, since the appended
  // resolution root in walking exercises is the same MIDI as the start.
  const pinnedRootMidi = midiSeq[0];
  const pinnedRootPos = { string: startPos.string, fret: startPos.fret };

  // Lookahead window for the resolution: when we enter the last
  // PIN_LOOKAHEAD notes, run a small DP that finds the lowest-cost
  // trajectory ending at the pinned root. Without lookahead, the apex
  // shifts the layout to high frets and every subsequent greedy
  // placement chases its local prev — by the time the final pin fires,
  // the hand is far from the start and the resolution becomes a leap.
  const PIN_LOOKAHEAD = 6;
  let lookaheadPath: FretboardPosition[] | null = null;
  let lookaheadStartIdx = -1;

  // Per-string accounting. Counts notes on the current string within the
  // current hand position AND in the current direction. Resets when we
  // change strings, shift position, or reverse pitch direction.
  let onStartingString = true;
  let countOnCurrentString = 1;
  let lastDirection: 'up' | 'down' | null = null;

  const fitOnString = (
    s: number,
    target: number,
    win: [number, number],
  ): FretboardPosition | null => {
    if (s < 0 || s >= tuning.stringCount) return null;
    const fret = target - tuning.openMidi[s];
    if (fret < 0) return null;
    if (fret < win[0] || fret > win[1]) return null;
    return { string: s, fret };
  };

  /**
   * Reject same-string fits that would require >4 fret jump from the
   * previous note. Anything wider than a 1-2-3-4 hand stretch is
   * impractical on bass — walking intervals like 6ths shouldn't be placed
   * on the same string with fret 1 → fret 9 while we're still in the
   * regular window. The fall-back path does NOT enforce this limit —
   * once we've left the window, a long same-string slide is a hand
   * shift, which is fine and often more natural than a multi-string
   * leap. The cost function alone decides there.
   */
  const MAX_SAME_STRING_STRETCH = 4;
  // Mid hand's natural span on the starting string is middle (root) →
  // pinky (root+2). Reaching root+3 on the same string requires a
  // stretch from middle to pinky that's uncomfortable; the natural move
  // for any +3 interval (e.g. the m3 of minor pentatonic / blues) is
  // cross-string with index reaching back. Cap same-string moves FROM
  // the root at +2 for mid hand to force the cross-string fingering.
  const MID_MAX_FROM_ROOT_SAME_STRING = 2;
  const fitSameWithStretchLimit = (
    s: number,
    target: number,
    win: [number, number],
    prevString: number,
    prevFret: number,
  ): FretboardPosition | null => {
    const fit = fitOnString(s, target, win);
    if (!fit) return null;
    if (
      s === prevString &&
      Math.abs(fit.fret - prevFret) > MAX_SAME_STRING_STRETCH
    ) {
      return null;
    }
    if (
      handPosition === 'mid' &&
      prevString === startPos.string &&
      prevFret === startPos.fret &&
      s === prevString &&
      Math.abs(fit.fret - startPos.fret) > MID_MAX_FROM_ROOT_SAME_STRING
    ) {
      return null;
    }
    return fit;
  };

  for (let i = 1; i < midiSeq.length; i++) {
    const target = midiSeq[i];
    const prev = result[result.length - 1];

    // Pin ONLY the final note if it's the root (i.e., the appended
    // resolution root in walking exercises). Intermediate occurrences of
    // the root MIDI use the regular cost-based picker — pinning every
    // occurrence creates big jumps when the layout has drifted away
    // from start (e.g., walking +2 mid-exercise root resolutions).
    // The cost function + DP-aware pinning of the lookahead window
    // already pulls the hand back toward home when reachable.
    if (target === pinnedRootMidi && i === midiSeq.length - 1) {
      baseWindow = computeBaseWindow(pinnedRootPos.fret, handPosition);
      stretchWindow = computeStretchWindow(pinnedRootPos.fret, handPosition);
      result.push({
        string: pinnedRootPos.string,
        fret: pinnedRootPos.fret,
        midi: target,
        durationDenominator: 8,
        finger: assignFinger(pinnedRootPos.fret, baseWindow[0]),
      });
      positionCache = new Map<number, FretboardPosition>();
      positionCache.set(target, { ...pinnedRootPos });
      countOnCurrentString = 1;
      onStartingString = false;
      continue;
    }

    // Lookahead: for the last PIN_LOOKAHEAD notes, run a small DP that
    // finds the lowest-total-movement-cost trajectory ending at the
    // pinned root. We compute it ONCE when we first hit the window, then
    // consume the precomputed path on each subsequent iteration.
    const remaining = midiSeq.length - 1 - i;
    if (
      applyPinLookahead &&
      remaining === PIN_LOOKAHEAD - 1 &&
      lookaheadPath === null
    ) {
      lookaheadStartIdx = i;
      lookaheadPath = solveLookaheadDP(
        midiSeq.slice(i),
        prev,
        prev.finger ?? assignFinger(prev.fret, homeAnchor),
        homeAnchor,
        pinnedRootPos,
        pinnedRootMidi,
        handPosition,
        tuning,
        avoidOpenStrings,
      );
    }
    if (lookaheadPath !== null && i >= lookaheadStartIdx) {
      const pos = lookaheadPath[i - lookaheadStartIdx];
      // Loosely follow the DP's pick for window/counters so nothing
      // downstream reads stale state. (Nothing should — the DP carries
      // us to the end — but defend against future code paths.)
      baseWindow = computeBaseWindow(pos.fret, handPosition);
      stretchWindow = computeStretchWindow(pos.fret, handPosition);
      result.push({
        string: pos.string,
        fret: pos.fret,
        midi: target,
        durationDenominator: 8,
        finger: assignFinger(pos.fret, baseWindow[0]),
      });
      onStartingString = false;
      countOnCurrentString =
        pos.string === prev.string ? countOnCurrentString + 1 : 1;
      positionCache.set(target, { string: pos.string, fret: pos.fret });
      continue;
    }

    if (positionCache.has(target)) {
      const cached = positionCache.get(target)!;
      result.push({
        string: cached.string,
        fret: cached.fret,
        midi: target,
        durationDenominator: 8,
        finger: assignFinger(cached.fret, baseWindow[0]),
      });
      continue;
    }

    const ascending = target >= prev.midi;
    const direction: 'up' | 'down' = ascending ? 'up' : 'down';
    if (lastDirection !== null && direction !== lastDirection) {
      // Direction reversed (e.g., past the apex of multi-octave A) — the
      // per-string cap restarts so we can stay on the same string for the
      // first notes of the new direction.
      countOnCurrentString = 0;
    }
    lastDirection = direction;

    const sameString = prev.string;
    const towardString = ascending ? prev.string + 1 : prev.string - 1;
    const awayString = ascending ? prev.string - 1 : prev.string + 1;

    const maxForThisString = onStartingString
      ? maxNotesOnStartingString(handPosition)
      : MAX_NOTES_PER_STRING;
    const allowSameString = countOnCurrentString < maxForThisString;

    // When the variant asks to avoid open strings, treat a fret-0 fit
    // from the early-path probes as a non-fit. The fall-back picker
    // (which ranks all candidates with an open-string surcharge) will
    // then choose a fretted alternative if one is reasonably close.
    const acceptFit = (
      p: FretboardPosition | null,
    ): FretboardPosition | null =>
      avoidOpenStrings && p && p.fret === 0 ? null : p;
    let pick: FretboardPosition | null = null;
    if (allowSameString)
      pick = acceptFit(
        fitSameWithStretchLimit(
          sameString,
          target,
          baseWindow,
          prev.string,
          prev.fret,
        ),
      );
    if (!pick) pick = acceptFit(fitOnString(towardString, target, baseWindow));
    if (!pick && allowSameString)
      pick = acceptFit(
        fitSameWithStretchLimit(
          sameString,
          target,
          stretchWindow,
          prev.string,
          prev.fret,
        ),
      );
    if (!pick)
      pick = acceptFit(fitOnString(towardString, target, stretchWindow));
    if (!pick) pick = acceptFit(fitOnString(awayString, target, baseWindow));
    if (!pick) pick = acceptFit(fitOnString(awayString, target, stretchWindow));

    // 2-string jumps for large intervals (walking 6ths in the regular
    // path — walking 7ths/octaves use the separate pair layout). The
    // hand naturally skips a string when consecutive notes are a wide
    // leap apart. Only fire this heuristic when prev → target IS such
    // a leap (Δmidi >= 7); otherwise small-interval moves like
    // walking 3rds would pick a far 2-string-away candidate over the
    // closer 1-string-away alternative that the fall-back picker
    // ranks correctly.
    if (!pick && Math.abs(target - prev.midi) >= 7) {
      const toward2 = ascending ? prev.string + 2 : prev.string - 2;
      const away2 = ascending ? prev.string - 2 : prev.string + 2;
      const wide: [number, number] = [
        Math.max(0, prev.fret - 4),
        prev.fret + 4,
      ];
      pick = fitOnString(toward2, target, wide);
      if (!pick) pick = fitOnString(away2, target, wide);
    }

    if (pick === null) {
      // No valid position in current hand position. Rank all reachable
      // positions by the unified placement cost against home — pulls
      // the hand back toward its starting position when home is
      // reachable, while still tolerating far placements when the
      // only candidates are out of reach (e.g., apex notes of
      // multi-octave runs — all candidates get the same window-shift
      // penalty, so ranking falls back to |Δstring|·4 + |Δfret|).
      const all = midiToPositions(tuning, target);
      if (all.length === 0) {
        throw new Error(`MIDI ${target} unreachable on tuning ${tuning.id}`);
      }
      const isTopString = prev.string === tuning.stringCount - 1;
      // The per-string cap is a soft preference in the fall-back, not a
      // hard filter. It charges a penalty (CAP_EXCEEDED_PENALTY)
      // against same-string candidates once we've already played the
      // cap's worth of notes there. Cheaper than the alternative cost
      // (e.g., a cross-string move into open A at Δ7 frets), the
      // penalty loses and the layout stays on the string — which is
      // what the player would actually do during a resolution.
      // Stronger than a typical cross-string Δ≤3 move, so the
      // multi-octave A spiral still spreads through strings in the
      // bulk of the exercise. Top string is exempt (no string to
      // spread to).
      const CAP_EXCEEDED_PENALTY = 16;
      const prevFinger = prev.finger ?? assignFinger(prev.fret, homeAnchor);
      const prevprev =
        result.length >= 2 ? result[result.length - 2] : undefined;
      const prevMoveFret = prevprev
        ? Math.abs(prev.fret - prevprev.fret)
        : undefined;
      // Cap relaxation has two paths so the multi-octave-A spiral
      // still fires for mid-exercise descents while the final
      // resolution stays on the home string:
      //
      //   1. NEAR HOME — candidate sits within stretched reach of the
      //      home anchor. The cap doesn't matter because we're already
      //      at home.
      //   2. APPROACHING HOME IN THE RESOLUTION — candidate is closer
      //      to home than prev, AND fewer than RESOLUTION_NOTES notes
      //      remain. Captures the F♯ Mixolydian / C Natural Minor
      //      back-hand cases where the descent has drifted high but
      //      is about to wrap up and the cap shouldn't knock us off
      //      the home string for the final few notes.
      const NEAR_HOME_FRETS = 5;
      const RESOLUTION_NOTES = 6;
      const capPenalty = (p: FretboardPosition): number => {
        if (isTopString) return 0;
        if (p.string !== prev.string) return 0;
        if (countOnCurrentString < maxForThisString) return 0;
        if (p.fret <= homeAnchor + NEAR_HOME_FRETS) return 0;
        const distPrev = Math.abs(prev.fret - homeAnchor);
        const distCand = Math.abs(p.fret - homeAnchor);
        const remaining = midiSeq.length - 1 - i;
        if (distCand < distPrev && remaining < RESOLUTION_NOTES) return 0;
        return CAP_EXCEEDED_PENALTY;
      };
      const openPenalty = (p: FretboardPosition): number =>
        avoidOpenStrings && p.fret === 0 ? OPEN_STRING_PENALTY : 0;
      pick = all.reduce((acc, p) => {
        const cost =
          placementCost(prev, prevFinger, p, homeAnchor, prevMoveFret) +
          capPenalty(p) +
          openPenalty(p);
        const accCost =
          placementCost(prev, prevFinger, acc, homeAnchor, prevMoveFret) +
          capPenalty(acc) +
          openPenalty(acc);
        return cost < accCost ? p : acc;
      });
      // Only reset window/counters if we genuinely shifted out of the
      // current window. If the fall-back pick already sits inside the
      // current window, we're not shifting position.
      const inCurrentWindow =
        pick.fret >= baseWindow[0] && pick.fret <= baseWindow[1];
      if (!inCurrentWindow) {
        baseWindow = computeBaseWindow(pick.fret, handPosition);
        stretchWindow = computeStretchWindow(pick.fret, handPosition);
        onStartingString = false;
        countOnCurrentString = 1;
        positionCache = new Map<number, FretboardPosition>();
      } else if (pick.string === sameString) {
        countOnCurrentString++;
      } else {
        countOnCurrentString = 1;
        onStartingString = false;
      }
    } else if (pick.string === sameString) {
      countOnCurrentString++;
    } else {
      countOnCurrentString = 1;
      onStartingString = false;
    }

    result.push({
      ...pick,
      midi: target,
      durationDenominator: 8,
      finger: assignFinger(pick.fret, baseWindow[0]),
    });
    positionCache.set(target, { string: pick.string, fret: pick.fret });
  }
  return result;
}

export function generateExercise(params: ExerciseParams): Exercise {
  const { scale, rootPc, variant, handPosition, tuning, useOpenStrings } =
    params;

  // Use the same constraints the picker validated. Without these,
  // walking-down variants would start on a string with no string below,
  // forcing the layout into awkward fall-backs.
  const constraints = startConstraintsForVariant(scale, variant, tuning);
  // Walking exercises (other than 7ths/octaves which use the dedicated
  // walking-pair logic) pick a start position based on first-pair fit,
  // not "lowest string" — the lowest valid string can be at a very high
  // fret when minMidi is enforced. Plain/mirror/consecutive/multi-octave
  // variants keep the original lowest-string rule.
  const lowRootPos =
    variant.kind === 'intervalWalk' &&
    !isLargeWalkingInterval(variant) &&
    !useOpenStrings
      ? pickStartingPositionForWalking(
          rootPc,
          handPosition,
          tuning,
          scale,
          variant,
          constraints,
        )
      : pickStartingPosition(rootPc, handPosition, tuning, {
          preferOpenStringRoot: !!useOpenStrings,
          minMidi: constraints.minMidi,
          minStringIndex: constraints.minStringIndex,
        });
  if (!lowRootPos) {
    throw new Error(
      `No valid starting position for root pc ${rootPc} with ${handPosition} hand`,
    );
  }
  const lowRootMidi = tuning.openMidi[lowRootPos.string] + lowRootPos.fret;

  // All scale exercises play ascending followed by descending (no apex repeat).
  // The user's rule: "all scale exercises should include ascending and
  // descending, no matter how many octaves it includes."
  let sequence: NoteSequence;

  if (variant.kind === 'plain') {
    const ascendingMidi = ascendingScaleMidi(scale, lowRootMidi);
    const ascendingSeq = layOnFretboard(
      ascendingMidi,
      tuning,
      lowRootPos,
      handPosition,
    );
    if (scale.descendingIntervals) {
      // Build descending half from the scale's alternate descending
      // intervals (e.g., classical melodic minor uses natural minor
      // going down). Lay out separately and trim the shared apex.
      const descMidi = descendingScaleMidi(scale, lowRootMidi).slice(1);
      const apex = ascendingSeq[ascendingSeq.length - 1];
      const descSeq = layOnFretboard(
        [apex.midi, ...descMidi],
        tuning,
        { string: apex.string, fret: apex.fret },
        handPosition,
      ).slice(1);
      sequence = [...ascendingSeq, ...descSeq];
    } else {
      const downSeq = ascendingSeq.slice(0, -1).reverse();
      sequence = [...ascendingSeq, ...downSeq];
    }
  } else if (variant.kind === 'multiOctaveA') {
    const midi = multiOctaveAMidi(scale, lowRootMidi, variant.octaves);
    sequence = layOnFretboard(midi, tuning, lowRootPos, handPosition);
  } else if (variant.kind === 'multiOctaveB') {
    const midi = multiOctaveBMidi(scale, lowRootMidi, variant.octaves);
    sequence = layOnFretboard(midi, tuning, lowRootPos, handPosition);
  } else if (isLargeWalkingInterval(variant)) {
    // 7ths and octaves use a dedicated layout that places each pair on
    // strings 2 apart, avoiding the >4-fret same-string stretches that
    // the general layout would produce.
    const info = pickStartingPositionForWalkingPairs(
      rootPc,
      handPosition,
      tuning,
      scale,
      variant,
    );
    if (!info) {
      throw new Error(
        'No valid walking-pair starting position for this exercise',
      );
    }
    const rootMidiAtStart =
      tuning.openMidi[info.pos.string] + info.pos.fret;
    // variantSequenceMidi handles the asc + desc structure (desc uses the
    // reversed interval direction starting at the high root).
    const fullMidi = variantSequenceMidi(scale, rootMidiAtStart, variant);
    sequence = layWalkingPairsOnFretboard(
      fullMidi,
      tuning,
      info.pos.string,
      info.stringOffset,
    );
  } else if (
    variant.kind === 'consecutive' ||
    variant.kind === 'mirror' ||
    variant.kind === 'intervalWalk'
  ) {
    const midi = variantSequenceMidi(scale, lowRootMidi, variant);
    // Lookahead applies to all variants whose final note is the root
    // and that can drift to high frets reaching their apex. Walking is
    // the obvious case; consecutive/mirror open-string variants also
    // benefit because the apex can leave the open-string region while
    // the pin sits at fret 0.
    // Avoid open strings for interval walks — open notes sound jumpier
    // mid-walk and a nearby fretted alternative is almost always more
    // playable. Consecutive/mirror variants don't get the avoidance
    // because their open-string variants are an explicitly enabled
    // user choice (`useOpenStrings`).
    sequence = layOnFretboard(midi, tuning, lowRootPos, handPosition, {
      applyPinLookahead: true,
      avoidOpenStrings: variant.kind === 'intervalWalk',
    });
  } else {
    throw new Error(
      `Variant ${(variant as { kind: string }).kind} not yet implemented`,
    );
  }

  const displayName = formatDisplayName(params);
  const alphaTex = emitAlphaTex(sequence, tuning, {
    title: displayName,
    keySignature: params.keySignature,
    keySignatureLabel: params.keySignatureLabel,
    spelling: params.spelling,
  });
  return { params, sequence, alphaTex, displayName };
}

export function formatDisplayName(params: ExerciseParams): string {
  const root = params.rootName ?? pitchClassName(params.rootPc, 'sharp');
  const variantLabel = describeVariant(params.variant, params.scale);
  const openTag = params.useOpenStrings ? ' (open)' : '';
  // Drop the hand-position suffix for walking exercises whose pair
  // span exceeds the hand window — the starting finger is determined
  // by interval direction there, not user choice, so showing "Front"
  // or "Back" would be misleading.
  if (!isHandPositionMeaningful(params.scale, params.variant)) {
    return `${root} ${params.scale.name}${openTag} — ${variantLabel}`;
  }
  const handLabel = handPositionLabel(params.handPosition);
  const handEmoji = handPositionEmoji(params.handPosition);
  return `${root} ${params.scale.name}${openTag} — ${variantLabel} — ${handLabel} ${handEmoji}`;
}

function describeVariant(v: ExerciseParams['variant'], scale: Scale): string {
  switch (v.kind) {
    case 'plain':
      return 'scale ↕';
    case 'multiOctaveA':
      return `multi-octave A (${v.octaves} oct)`;
    case 'multiOctaveB':
      return `multi-octave B (${v.octaves} oct)`;
    case 'consecutive': {
      const labels = Array.from({ length: v.groupSize }, (_, i) => i + 1).join(
        '-',
      );
      return `${labels} ↕`;
    }
    case 'mirror': {
      const up = Array.from({ length: v.peakSize }, (_, i) => i + 1);
      const down = up.slice(0, -1).reverse();
      return `${[...up, ...down].join('-')} ↕`;
    }
    case 'intervalWalk': {
      // For 7-note diatonic scales the step in scale degrees matches a
      // musical interval (skip-1 = 3rd, skip-2 = 4th, etc.). For other
      // scales (pentatonics, blues, octatonics) the step doesn't produce a
      // consistent musical interval; label as "Scale walk +N" or "-N"
      // with the sign indicating the direction of the interval within
      // each pair.
      if (scale.intervals.length === 7) {
        const arrow = v.intervalDir === 'up' ? '↑' : '↓';
        return `Walking ${INTERVAL_NAMES[v.interval] ?? `${v.interval + 1}ths`} ${arrow}`;
      }
      const sign = v.intervalDir === 'up' ? '+' : '-';
      return `Scale walk ${sign}${v.interval}`;
    }
    case 'arpeggioCycle':
      return 'Arpeggio (placeholder)';
  }
}

const INTERVAL_NAMES: Record<number, string> = {
  1: '2nds',
  2: '3rds',
  3: '4ths',
  4: '5ths',
  5: '6ths',
  6: '7ths',
  7: 'octaves',
};
