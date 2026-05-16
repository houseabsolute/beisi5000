<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Metronome,
    type BeatEvent,
    type MetronomeBehavior,
  } from '../audio/metronome';

  function behaviorLabel(b: MetronomeBehavior): string {
    switch (b) {
      case 'skip':
        return 'Skip ticks';
      case 'halve':
        return 'Halving';
      case 'both':
        return 'Skip + halving';
      default:
        return 'Normal';
    }
  }

  interface Props {
    tempo: number;
    /**
     * True when the user has manually pinned the tempo. The lock icon
     * reflects this; clicking the randomize button clears it.
     */
    tempoLocked?: boolean;
    onTempoChange?: (t: number) => void;
    onRandomizeTempo?: () => void;
    behavior?: MetronomeBehavior;
    accent?: boolean;
    halvingPeriodMeasures?: number;
    stopAfterMinutes?: number | null;
  }

  let {
    tempo,
    tempoLocked = false,
    onTempoChange,
    onRandomizeTempo,
    behavior = 'normal',
    accent = false,
    halvingPeriodMeasures = 4,
    stopAfterMinutes = null,
  }: Props = $props();

  let metronome: Metronome | null = null;
  let running = $state(false);
  let lastBeat = $state<BeatEvent | null>(null);

  function currentOptions() {
    return {
      tempo,
      behavior,
      accentBeatOne: accent,
      halvingPeriodMeasures,
      stopAfterSeconds:
        stopAfterMinutes !== null ? stopAfterMinutes * 60 : null,
    };
  }

  function ensureMetronome(): Metronome {
    if (!metronome) {
      metronome = new Metronome(currentOptions());
      metronome.onBeat((e) => {
        lastBeat = e;
        // The metronome stops itself when stopAfterSeconds elapses;
        // mirror that to the UI state.
        if (metronome && !metronome.isRunning) running = false;
      });
    }
    return metronome;
  }

  function toggle() {
    const m = ensureMetronome();
    if (running) {
      m.stop();
      running = false;
    } else {
      m.setOptions(currentOptions());
      lastBeat = null;
      m.start();
      running = true;
    }
  }

  // Reactively push setting changes into the running metronome.
  $effect(() => {
    if (metronome) {
      metronome.setOptions(currentOptions());
    }
  });

  onDestroy(() => {
    metronome?.destroy();
    metronome = null;
  });

  // Spacebar toggles the metronome. Skip when focus is in an editable
  // field — settings number inputs etc. should still respond to space
  // for their own purposes (none right now, but keep the discipline).
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const flash = $derived(lastBeat?.played ?? false);
  const beatNumber = $derived(
    lastBeat ? (lastBeat.beatInMeasure + 1).toString() : '·',
  );
  const isCountIn = $derived(lastBeat?.countIn ?? false);

  // Countdown timer. The clock starts when the first exercise beat
  // fires (count-in doesn't count) and ticks every 250ms so the
  // displayed second never lags by more than a quarter of a second.
  let exerciseStartedAt = $state<number | null>(null);
  let nowMs = $state(Date.now());

  $effect(() => {
    if (lastBeat && !lastBeat.countIn && exerciseStartedAt === null) {
      exerciseStartedAt = Date.now();
    }
  });
  $effect(() => {
    if (!running) {
      exerciseStartedAt = null;
    }
  });
  $effect(() => {
    if (!running || stopAfterMinutes === null) return;
    const id = setInterval(() => {
      nowMs = Date.now();
    }, 250);
    return () => clearInterval(id);
  });

  const remainingSeconds = $derived.by(() => {
    if (exerciseStartedAt === null || stopAfterMinutes === null) return null;
    const total = stopAfterMinutes * 60;
    const elapsed = (nowMs - exerciseStartedAt) / 1000;
    return Math.max(0, Math.ceil(total - elapsed));
  });

  function formatRemaining(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
</script>

<div class="metronome">
  <div class="readout">
    <span class="tempo">
      ♩ =
      <input
        type="number"
        class="tempo-input"
        class:locked={tempoLocked}
        min="20"
        max="400"
        value={tempo}
        onchange={(e) => onTempoChange?.(Number(e.currentTarget.value))}
        title={tempoLocked
          ? 'Manual tempo — sticks across exercises until you randomize'
          : 'Tap to set tempo (sticks across exercises)'}
      />
    </span>
    <button
      class="randomize-btn"
      onclick={() => onRandomizeTempo?.()}
      title="Pick a new random tempo (clears the manual setting)"
      type="button"
      aria-label="Randomize tempo"
    >
      🎲
    </button>
    <span
      class="dot"
      class:flash
      class:accent={lastBeat?.accent}
      class:countin={isCountIn}
    >
      {beatNumber}
    </span>
    {#if isCountIn}
      <span class="badge countin">Count-in</span>
    {:else if behavior !== 'normal'}
      <span class="badge">{behaviorLabel(behavior)}</span>
    {/if}
    {#if remainingSeconds !== null && running}
      <span class="badge timer">⏱ {formatRemaining(remainingSeconds)}</span>
    {:else if stopAfterMinutes !== null && !running}
      <span class="badge timer">⏱ {stopAfterMinutes}m</span>
    {/if}
  </div>
  <button class="btn" onclick={toggle} class:running>
    {running ? '⏸ Stop' : '▶ Start'}
  </button>
</div>

<style>
  .metronome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    flex-wrap: wrap;
  }
  .readout {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tempo {
    font-family: ui-monospace, monospace;
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .tempo-input {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 2px 4px;
    width: 4ch;
    text-align: right;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .tempo-input::-webkit-inner-spin-button,
  .tempo-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .tempo-input:hover,
  .tempo-input:focus {
    border-color: var(--border);
    outline: none;
  }
  .tempo-input.locked {
    color: var(--accent);
  }
  .randomize-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    width: 30px;
    height: 30px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .randomize-btn:hover {
    background: var(--panel-2);
    color: var(--text);
  }
  .dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--border);
    color: var(--text-dim);
    font-family: ui-monospace, monospace;
    font-size: 13px;
    font-weight: 600;
    transition:
      background-color 80ms,
      color 80ms,
      box-shadow 80ms;
  }
  .dot.flash {
    background: var(--text-dim);
    color: var(--bg);
  }
  .dot.flash.accent {
    background: var(--accent);
    color: var(--bg);
    box-shadow: 0 0 12px var(--accent);
  }
  .dot.countin {
    /* Visually distinguish the count-in beat dot from regular beats. */
    background: var(--open-bg);
    color: var(--open-text);
  }
  .badge {
    background: var(--border);
    color: var(--text);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
  }
  .badge.countin {
    background: var(--open-bg);
    color: var(--open-text);
  }
  .badge.timer {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .btn {
    background: var(--accent);
    color: var(--bg);
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    min-width: 100px;
  }
  .btn:hover {
    background: var(--accent-hover);
  }
  .btn.running {
    background: var(--border);
    color: var(--text);
  }
  .btn.running:hover {
    background: var(--text-dim);
    color: var(--bg);
  }
</style>
