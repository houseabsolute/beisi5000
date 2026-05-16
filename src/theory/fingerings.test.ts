import { describe, test, expect } from 'vitest';
import {
  HAND_POSITIONS,
  isValidStartingFret,
  handPositionLabel,
  handPositionEmoji,
} from './fingerings';

describe('HAND_POSITIONS', () => {
  test('lists front, mid, back in that order', () => {
    expect(HAND_POSITIONS).toEqual(['front', 'mid', 'back']);
  });
});

describe('isValidStartingFret', () => {
  test('front is valid at any non-negative fret (index can reach the open string)', () => {
    expect(isValidStartingFret('front', 0)).toBe(true);
    expect(isValidStartingFret('front', 1)).toBe(true);
    expect(isValidStartingFret('front', 12)).toBe(true);
  });

  test('mid requires fret >= 2 (index needs to reach behind, no useful nut wrap)', () => {
    expect(isValidStartingFret('mid', 0)).toBe(false);
    expect(isValidStartingFret('mid', 1)).toBe(false);
    expect(isValidStartingFret('mid', 2)).toBe(true);
    expect(isValidStartingFret('mid', 5)).toBe(true);
  });

  test('back requires fret >= 3 (pinky on root, index 3 frets back)', () => {
    expect(isValidStartingFret('back', 0)).toBe(false);
    expect(isValidStartingFret('back', 2)).toBe(false);
    expect(isValidStartingFret('back', 3)).toBe(true);
    expect(isValidStartingFret('back', 5)).toBe(true);
  });
});

describe('handPositionLabel and emoji', () => {
  test('labels are capitalized', () => {
    expect(handPositionLabel('front')).toBe('Front');
    expect(handPositionLabel('mid')).toBe('Mid');
    expect(handPositionLabel('back')).toBe('Back');
  });

  test('each hand position has a hand emoji', () => {
    for (const hp of HAND_POSITIONS) {
      const emoji = handPositionEmoji(hp);
      expect(emoji).toBeTruthy();
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});
