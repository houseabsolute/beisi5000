import { describe, test, expect } from 'vitest';
import {
  SKIP_BEHAVIOR_WARMUP_BEATS,
  SkipBehavior,
  halvingShouldClick,
} from './behaviors';

describe('halvingShouldClick', () => {
  // 4 measures per phase, 4/4 = 16 beats per phase, 48 beats per full cycle
  test('phase 1 (T): every beat clicks', () => {
    for (let b = 0; b < 16; b++) {
      expect(halvingShouldClick(b, 4)).toBe(true);
    }
  });

  test('phase 2 (T/2): every other beat clicks', () => {
    expect(halvingShouldClick(16, 4)).toBe(true);
    expect(halvingShouldClick(17, 4)).toBe(false);
    expect(halvingShouldClick(18, 4)).toBe(true);
    expect(halvingShouldClick(19, 4)).toBe(false);
    expect(halvingShouldClick(30, 4)).toBe(true);
    expect(halvingShouldClick(31, 4)).toBe(false);
  });

  test('phase 3 (T/4): every 4th beat clicks', () => {
    expect(halvingShouldClick(32, 4)).toBe(true);
    expect(halvingShouldClick(33, 4)).toBe(false);
    expect(halvingShouldClick(34, 4)).toBe(false);
    expect(halvingShouldClick(35, 4)).toBe(false);
    expect(halvingShouldClick(36, 4)).toBe(true);
    expect(halvingShouldClick(44, 4)).toBe(true);
    expect(halvingShouldClick(47, 4)).toBe(false);
  });

  test('cycles back to phase 1 at beat 48', () => {
    expect(halvingShouldClick(48, 4)).toBe(true);
    expect(halvingShouldClick(49, 4)).toBe(true);
    expect(halvingShouldClick(63, 4)).toBe(true);
  });

  test('respects custom halvingPeriodMeasures', () => {
    // 8 measures per phase = 32 beats per phase, 96 beats per cycle
    expect(halvingShouldClick(0, 8)).toBe(true);
    expect(halvingShouldClick(31, 8)).toBe(true); // still phase 1
    expect(halvingShouldClick(32, 8)).toBe(true); // phase 2 start
    expect(halvingShouldClick(33, 8)).toBe(false);
  });
});

describe('SkipBehavior', () => {
  test('returns false (no skip) when probability is 0', () => {
    const beh = new SkipBehavior(0);
    for (let b = 0; b < 100; b++) {
      expect(beh.shouldSkip()).toBe(false);
    }
  });

  test('first 8 beats always play even with probability 1', () => {
    const beh = new SkipBehavior(1, () => 0); // always trigger if not warming up
    for (let b = 0; b < SKIP_BEHAVIOR_WARMUP_BEATS; b++) {
      expect(beh.shouldSkip()).toBe(false);
    }
    // 9th beat onward CAN skip
    expect(beh.shouldSkip()).toBe(true);
  });

  test('always skips when probability is 1, but caps event at 3 with cooldown', () => {
    const seq: boolean[] = [];
    const beh = new SkipBehavior(1, () => 0, 0); // no warmup for this test
    for (let b = 0; b < 8; b++) seq.push(beh.shouldSkip());
    expect(seq).toEqual([true, false, true, false, true, false, true, false]);
  });

  test('skip event of length 3, then forced cooldown', () => {
    // rng=0.5 -> Math.floor(0.5 * 3) = 1, length = 2
    // rng=0.99 -> Math.floor(0.99 * 3) = 2, length = 3
    let calls = 0;
    const rng = () => {
      // first call (probability check): always trigger
      // second call (length): return value to make length = 3
      calls++;
      return calls === 2 ? 0.99 : 0;
    };
    const beh = new SkipBehavior(1, rng, 0); // no warmup
    expect(beh.shouldSkip()).toBe(true); // start skip event of length 3
    expect(beh.shouldSkip()).toBe(true); // skip 2/3
    expect(beh.shouldSkip()).toBe(true); // skip 3/3
    expect(beh.shouldSkip()).toBe(false); // cooldown
  });

  test('never produces 4+ consecutive skips even with probability 1', () => {
    // With rng always returning small value, all skip events are length 1
    // but they should never chain into 4+ skips because of cooldown
    const beh = new SkipBehavior(1, () => 0, 0); // no warmup
    let consecutive = 0;
    let maxConsecutive = 0;
    for (let b = 0; b < 200; b++) {
      if (beh.shouldSkip()) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
    }
    expect(maxConsecutive).toBeLessThanOrEqual(3);
  });

  test('after a skip event, the very next beat is always normal (no back-to-back events)', () => {
    // Set up a deterministic sequence: probability check passes, length 1, then cooldown
    let i = 0;
    const values = [
      0,
      0, // first call: trigger skip, length 1
      0,
      0, // would-be next call but we're in cooldown
      0,
      0, // first eligible beat after cooldown
    ];
    const rng = () => values[i++ % values.length];
    const beh = new SkipBehavior(1, rng, 0); // no warmup
    expect(beh.shouldSkip()).toBe(true); // skip
    expect(beh.shouldSkip()).toBe(false); // cooldown - even with probability 1
    expect(beh.shouldSkip()).toBe(true); // next eligible
  });
});
