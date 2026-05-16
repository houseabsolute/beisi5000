export type HandPosition = 'front' | 'mid' | 'back';

export const HAND_POSITIONS: readonly HandPosition[] = ['front', 'mid', 'back'];

/**
 * Whether a hand position can comfortably start on a given fret.
 * - front: index on starting fret. Valid at any fret >= 0.
 * - mid: middle on starting fret, index one fret lower. Requires fret >= 2 so
 *   the index has somewhere useful to sit (open-string at fret 0 doesn't extend
 *   the position usefully for most exercises).
 * - back: pinky on starting fret, index three frets lower. Requires fret >= 3.
 */
export function isValidStartingFret(hp: HandPosition, fret: number): boolean {
  switch (hp) {
    case 'front':
      return fret >= 0;
    case 'mid':
      return fret >= 2;
    case 'back':
      return fret >= 3;
  }
}

/**
 * Relaxed fret-minimum for walking exercises where the second note of
 * each pair sits on a lower string — the pinky/middle on the root no
 * longer needs the back-stretch slack, so the standard mid/back fret
 * minimums don't apply. Open-string roots stay front-only (mid/back
 * physically can't fret an open string with the middle/pinky).
 */
export function isValidWalkingStartingFret(
  hp: HandPosition,
  fret: number,
): boolean {
  switch (hp) {
    case 'front':
      return fret >= 0;
    case 'mid':
    case 'back':
      return fret >= 1;
  }
}

const LABELS: Record<HandPosition, string> = {
  front: 'Front',
  mid: 'Mid',
  back: 'Back',
};

const EMOJIS: Record<HandPosition, string> = {
  front: '☝️',
  mid: '🖐️',
  back: '🤙',
};

export function handPositionLabel(hp: HandPosition): string {
  return LABELS[hp];
}

export function handPositionEmoji(hp: HandPosition): string {
  return EMOJIS[hp];
}
