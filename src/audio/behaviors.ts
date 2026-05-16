/**
 * Halving behavior: cycles through three click rates while the exercise tempo
 * stays constant.
 *   Phase 0 (T):   click every beat
 *   Phase 1 (T/2): click every 2 beats
 *   Phase 2 (T/4): click every 4 beats
 *
 * Each phase lasts `halvingPeriodMeasures` measures of 4/4, after which it
 * advances. After phase 2 we cycle back to phase 0.
 */
export function halvingShouldClick(
  beatIndex: number,
  halvingPeriodMeasures: number,
  beatsPerMeasure: number = 4,
): boolean {
  const beatsPerPhase = halvingPeriodMeasures * beatsPerMeasure;
  const cycleLength = 3 * beatsPerPhase;
  const cyclePos = ((beatIndex % cycleLength) + cycleLength) % cycleLength;
  const phase = Math.floor(cyclePos / beatsPerPhase);
  const beatInPhase = cyclePos % beatsPerPhase;

  switch (phase) {
    case 0:
      return true;
    case 1:
      return beatInPhase % 2 === 0;
    case 2:
      return beatInPhase % 4 === 0;
    default:
      return true;
  }
}

export const SKIP_BEHAVIOR_WARMUP_BEATS = 8;

/**
 * Skip-ticks behavior: each beat, decide whether to skip with the given
 * probability. Skip events run for 1, 2, or 3 consecutive beats (uniformly
 * chosen). After a skip event, the very next beat must play (no back-to-back
 * skip events). This bounds consecutive skips at 3.
 *
 * The first {@link SKIP_BEHAVIOR_WARMUP_BEATS} beats always play so the
 * player can lock in the tempo before skips begin.
 */
export class SkipBehavior {
  private remainingInEvent = 0;
  private cooldown = false;
  private beatsSeen = 0;

  constructor(
    public probability: number = 0.15,
    private rng: () => number = Math.random,
    private warmupBeats: number = SKIP_BEHAVIOR_WARMUP_BEATS,
  ) {}

  shouldSkip(): boolean {
    this.beatsSeen++;
    if (this.beatsSeen <= this.warmupBeats) {
      return false;
    }
    if (this.remainingInEvent > 0) {
      this.remainingInEvent--;
      if (this.remainingInEvent === 0) this.cooldown = true;
      return true;
    }
    if (this.cooldown) {
      this.cooldown = false;
      return false;
    }
    if (this.rng() < this.probability) {
      const lengthRaw = Math.floor(this.rng() * 3); // 0, 1, or 2
      const length = lengthRaw + 1; // 1, 2, or 3
      this.remainingInEvent = length - 1;
      if (this.remainingInEvent === 0) this.cooldown = true;
      return true;
    }
    return false;
  }

  reset(): void {
    this.remainingInEvent = 0;
    this.cooldown = false;
    this.beatsSeen = 0;
  }
}
