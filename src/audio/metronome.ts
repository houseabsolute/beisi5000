import { halvingShouldClick, SkipBehavior } from './behaviors';

export type MetronomeBehavior = 'normal' | 'skip' | 'halve' | 'both';

export interface MetronomeOptions {
  tempo: number;
  beatsPerMeasure?: number;
  behavior?: MetronomeBehavior;
  halvingPeriodMeasures?: number;
  accentBeatOne?: boolean;
  skipProbability?: number;
  /** Beats to play at a distinct pitch before the exercise begins. The
   * count-in always plays (it ignores skip / halving behaviors) so the
   * player gets a stable lead-in. Set to 0 to disable. Default 4. */
  countInBeats?: number;
  /** Stop the metronome automatically after this many seconds of
   * exercise playback (the count-in does NOT count). null / undefined =
   * play indefinitely. */
  stopAfterSeconds?: number | null;
}

export interface BeatEvent {
  beatIndex: number;
  beatInMeasure: number;
  played: boolean;
  accent: boolean;
  /** True for the lead-in beats before the exercise proper begins. */
  countIn: boolean;
}

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SECONDS = 0.1;

export class Metronome {
  private audioContext: AudioContext | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime = 0;
  private beatIndex = 0;
  private skipBehavior: SkipBehavior;
  private opts: Required<MetronomeOptions>;
  private listeners = new Set<(e: BeatEvent) => void>();
  // AudioContext time at which the first exercise beat (beatIndex 0) is
  // scheduled to fire. Used to enforce stopAfterSeconds without counting
  // the count-in toward the duration.
  private exerciseStartTime: number | null = null;

  constructor(options: MetronomeOptions) {
    this.opts = {
      tempo: options.tempo,
      beatsPerMeasure: options.beatsPerMeasure ?? 4,
      behavior: options.behavior ?? 'normal',
      halvingPeriodMeasures: options.halvingPeriodMeasures ?? 4,
      accentBeatOne: options.accentBeatOne ?? false,
      skipProbability: options.skipProbability ?? 0.15,
      countInBeats: options.countInBeats ?? 4,
      stopAfterSeconds: options.stopAfterSeconds ?? null,
    };
    this.skipBehavior = new SkipBehavior(this.opts.skipProbability);
  }

  get isRunning(): boolean {
    return this.timerId !== null;
  }

  get tempo(): number {
    return this.opts.tempo;
  }

  /** Update metronome options. Some changes (like tempo) take effect on the
   *  next scheduled beat. */
  setOptions(patch: Partial<MetronomeOptions>): void {
    if (patch.skipProbability !== undefined) {
      this.skipBehavior = new SkipBehavior(patch.skipProbability);
    }
    Object.assign(this.opts, patch);
  }

  onBeat(listener: (e: BeatEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.timerId !== null) return;
    if (!this.audioContext) {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext })
          .AudioContext ??
        (
          window as unknown as {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio API not available');
      this.audioContext = new Ctx();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    // beatIndex < 0 is the count-in; index 0 is the first exercise beat.
    this.beatIndex = -this.opts.countInBeats;
    this.skipBehavior.reset();
    this.exerciseStartTime = null;
    this.nextNoteTime = this.audioContext.currentTime + 0.05;
    this.scheduleLoop();
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  destroy(): void {
    this.stop();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.listeners.clear();
  }

  private scheduleLoop = (): void => {
    if (!this.audioContext) return;
    while (
      this.nextNoteTime <
      this.audioContext.currentTime + LOOKAHEAD_SECONDS
    ) {
      // Record when the exercise proper begins so the duration timer
      // measures from there, not from the count-in.
      if (this.beatIndex === 0 && this.exerciseStartTime === null) {
        this.exerciseStartTime = this.nextNoteTime;
      }
      this.scheduleBeat(this.nextNoteTime, this.beatIndex);
      const secondsPerBeat = 60 / this.opts.tempo;
      this.nextNoteTime += secondsPerBeat;
      this.beatIndex++;
    }
    // Auto-stop after the configured duration (exercise time only,
    // not counting the count-in).
    if (
      this.opts.stopAfterSeconds !== null &&
      this.exerciseStartTime !== null &&
      this.audioContext.currentTime >=
        this.exerciseStartTime + this.opts.stopAfterSeconds
    ) {
      this.stop();
      return;
    }
    this.timerId = setTimeout(this.scheduleLoop, SCHEDULER_INTERVAL_MS);
  };

  private scheduleBeat(when: number, beatIndex: number): void {
    if (!this.audioContext) return;

    const isCountIn = beatIndex < 0;
    // Count-in counts from 1 up to countInBeats; exercise beats wrap
    // mod beatsPerMeasure as usual.
    const beatInMeasure = isCountIn
      ? this.opts.countInBeats + beatIndex
      : beatIndex % this.opts.beatsPerMeasure;
    const isAccent =
      !isCountIn && this.opts.accentBeatOne && beatInMeasure === 0;

    let playClick = true;
    if (!isCountIn) {
      // Count-in beats ignore skip and halving — they need to be
      // consistent so the player can lock in the tempo.
      if (this.opts.behavior === 'halve' || this.opts.behavior === 'both') {
        if (
          !halvingShouldClick(
            beatIndex,
            this.opts.halvingPeriodMeasures,
            this.opts.beatsPerMeasure,
          )
        ) {
          playClick = false;
        }
      }
      if (
        playClick &&
        (this.opts.behavior === 'skip' || this.opts.behavior === 'both')
      ) {
        if (this.skipBehavior.shouldSkip()) {
          playClick = false;
        }
      }
    }

    if (playClick) {
      this.playClickAt(when, isAccent, isCountIn);
    }

    // Notify listeners on the main thread (close to when the click sounds)
    const delayMs = Math.max(0, (when - this.audioContext.currentTime) * 1000);
    setTimeout(() => {
      const event: BeatEvent = {
        beatIndex,
        beatInMeasure,
        played: playClick,
        accent: isAccent,
        countIn: isCountIn,
      };
      for (const l of this.listeners) l(event);
    }, delayMs);
  }

  private playClickAt(
    when: number,
    accent: boolean,
    countIn: boolean,
  ): void {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.type = 'square';
    // Distinct pitch for count-in (a perfect 4th below the regular
    // click) so the player hears the lead-in clearly without confusing
    // it for the exercise beat.
    osc.frequency.value = countIn ? 660 : accent ? 1320 : 880;
    const peakGain = accent ? 0.45 : countIn ? 0.35 : 0.3;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peakGain, when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);

    osc.start(when);
    osc.stop(when + 0.06);
  }
}
