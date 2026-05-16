<script lang="ts">
  import ExerciseDisplay from './components/ExerciseDisplay.svelte';
  import Fretboard from './components/Fretboard.svelte';
  import MetronomeControls from './components/MetronomeControls.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import AboutPanel from './components/AboutPanel.svelte';
  import BrowsePanel from './components/BrowsePanel.svelte';
  import { generateExercise } from './exercises/scale-generator';
  import {
    generateUniverse,
    pickWeightedRandom,
    paramsKey,
    paramsFromKey,
    randomTempo,
  } from './exercises/picker';
  import { onMount } from 'svelte';
  import {
    midiOctave,
    midiPitchClass,
    pitchClassName,
  } from './theory/notes';
  import {
    handPositionEmoji,
    handPositionLabel,
  } from './theory/fingerings';
  import { isHandPositionMeaningful } from './exercises/scale-generator';
  import { settings } from './stores/settings';
  import { history } from './stores/history';
  import {
    emitAlphaTex,
    type DisplayMode,
  } from './notation/alphatex-emitter';
  import type { Exercise, ExerciseParams } from './exercises/types';

  function noteName(midi: number): string {
    return `${pitchClassName(midiPitchClass(midi), 'sharp')}${midiOctave(midi)}`;
  }

  let panelOpen = $state(false);
  let aboutOpen = $state(false);
  let browseOpen = $state(false);
  let currentExercise = $state<Exercise | null>(null);
  let currentTempo = $state(120);
  // Manual tempo override. When non-null, every new exercise keeps
  // this tempo instead of getting a fresh random pick — the user's
  // explicit choice "sticks" until they click randomize again.
  let userTempo = $state<number | null>(null);
  let universeSize = $state(0);
  let shareStatus = $state<'idle' | 'copied' | 'failed'>('idle');
  let shareStatusTimer: ReturnType<typeof setTimeout> | null = null;
  // Set when WE update the URL hash, so the resulting hashchange event
  // doesn't loop us back through onHashChange → setCurrentExercise.
  let suppressHashChange = false;

  function pickNext() {
    const universe = generateUniverse($settings);
    universeSize = universe.length;
    if (universe.length === 0) {
      currentExercise = null;
      return;
    }
    const params = pickWeightedRandom(universe, history.asSet());
    if (!params) return;
    setCurrentExercise(params);
  }

  function setCurrentExercise(params: ExerciseParams): void {
    const exercise = generateExercise(params);
    history.push(paramsKey(params), $settings.recentExclusionCount);
    currentExercise = exercise;
    // Honour the user's manual tempo override across exercises; only
    // randomize if they haven't pinned a value.
    currentTempo =
      userTempo ??
      randomTempo(
        $settings.metronome.tempoMin,
        $settings.metronome.tempoMax,
      );
    // Sync URL so the user can bookmark / reload this specific exercise.
    const hash = '#' + encodeURIComponent(paramsKey(params));
    if (location.hash !== hash) {
      suppressHashChange = true;
      location.hash = hash;
    }
  }

  function setUserTempo(t: number): void {
    const min = Math.max(20, Math.min(400, Math.round(t)));
    userTempo = min;
    currentTempo = min;
  }

  function randomizeTempo(): void {
    userTempo = null;
    currentTempo = randomTempo(
      $settings.metronome.tempoMin,
      $settings.metronome.tempoMax,
    );
  }

  // Load from URL hash on mount, fall back to random.
  onMount(() => {
    const fromHash = paramsFromHash();
    if (fromHash) {
      setCurrentExercise(fromHash);
    } else if (!currentExercise) {
      pickNext();
    }
    // Browser back/forward: reload the exercise the URL now points to.
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  function paramsFromHash(): ExerciseParams | null {
    if (!location.hash || location.hash.length < 2) return null;
    try {
      return paramsFromKey(decodeURIComponent(location.hash.slice(1)));
    } catch {
      return null;
    }
  }

  function onHashChange(): void {
    if (suppressHashChange) {
      suppressHashChange = false;
      return;
    }
    const fromHash = paramsFromHash();
    if (fromHash) setCurrentExercise(fromHash);
  }

  // App-level keyboard shortcuts:
  //   N = next exercise
  //   P / browser-back = previous (the URL hash is in the browser
  //   history, so back/forward already restores prior exercises).
  $effect(() => {
    function onKey(e: KeyboardEvent) {
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
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        pickNext();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        window.history.back();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Re-emit AlphaTex when the notation/tab toggles change, so the
  // staff layout matches what the user has selected.
  const displayMode = $derived<DisplayMode | null>(
    $settings.displayToggles.notation && $settings.displayToggles.tab
      ? 'both'
      : $settings.displayToggles.notation
        ? 'score'
        : $settings.displayToggles.tab
          ? 'tabs'
          : null,
  );

  const alphaTexForDisplay = $derived.by(() => {
    if (!currentExercise || displayMode === null) return '';
    return emitAlphaTex(currentExercise.sequence, currentExercise.params.tuning, {
      displayMode,
      title: currentExercise.displayName,
      keySignature: currentExercise.params.keySignature,
      keySignatureLabel: currentExercise.params.keySignatureLabel,
      spelling: currentExercise.params.spelling,
      showFingerNumbers: $settings.showFingerNumbers,
      // Auto-switch clef per-bar inside the emitter using a 4-beat
      // run rule. Switching off keeps the staff in bass clef
      // throughout regardless of register.
      autoClef: $settings.autoTrebleClef,
    });
  });

  function loadPicked(params: ExerciseParams): void {
    setCurrentExercise(params);
  }

  async function shareCurrentExerciseUrl(): Promise<void> {
    if (!currentExercise) return;
    const url = window.location.href;
    if (shareStatusTimer) {
      clearTimeout(shareStatusTimer);
      shareStatusTimer = null;
    }
    try {
      await navigator.clipboard.writeText(url);
      shareStatus = 'copied';
    } catch {
      shareStatus = 'failed';
    }
    shareStatusTimer = setTimeout(() => {
      shareStatus = 'idle';
      shareStatusTimer = null;
    }, 1600);
  }

  function toggleDisplay(key: 'notation' | 'tab' | 'fretboard') {
    settings.update((s) => ({
      ...s,
      displayToggles: {
        ...s.displayToggles,
        [key]: !s.displayToggles[key],
      },
    }));
  }
</script>

<header class="topbar">
  <div class="brand">BèiSī 5000</div>
  <div class="topbar-actions">
    <button
      class="iconbtn"
      onclick={() => (browseOpen = true)}
      aria-label="Browse exercises"
      title="Browse exercises"
      type="button"
    >
      🔍
    </button>
    <button
      class="iconbtn"
      onclick={() => (aboutOpen = true)}
      aria-label="About this app"
      title="About this app"
      type="button"
    >
      ?
    </button>
    <button
      class="iconbtn"
      onclick={() => (panelOpen = true)}
      aria-label="Open settings"
      title="Settings"
      type="button"
    >
      ⚙
    </button>
  </div>
</header>

<main>
  {#if currentExercise}
    <section class="exercise">
      <div class="exercise-header">
        <h1>{currentExercise.displayName}</h1>
        <button
          class="share-btn"
          class:copied={shareStatus === 'copied'}
          class:failed={shareStatus === 'failed'}
          onclick={shareCurrentExerciseUrl}
          aria-label="Copy link to this exercise"
          title={shareStatus === 'copied'
            ? 'Link copied to clipboard'
            : shareStatus === 'failed'
              ? 'Copy failed — try again'
              : 'Copy link to this exercise'}
          type="button"
        >
          {#if shareStatus === 'copied'}
            ✓ Copied
          {:else if shareStatus === 'failed'}
            ⚠ Failed
          {:else}
            🔗 Share
          {/if}
        </button>
      </div>

      <div class="meta">
        <span class="chip key"
          >{currentExercise.params.rootName ??
            pitchClassName(currentExercise.params.rootPc, 'sharp')}</span
        >
        <span class="chip">{currentExercise.params.scale.name}</span>
        {#if isHandPositionMeaningful(currentExercise.params.scale, currentExercise.params.variant)}
          <span class="chip"
            >{handPositionEmoji(currentExercise.params.handPosition)}
            {handPositionLabel(currentExercise.params.handPosition)}</span
          >
        {/if}
        <span class="chip">{currentExercise.params.tuning.name}</span>
        {#if currentExercise.params.useOpenStrings}
          <span class="chip open">open</span>
        {/if}
        <span class="chip"
          >{describeVariant(
            currentExercise.params.variant,
            currentExercise.params.scale,
          )}</span
        >
      </div>

      <div class="view-toggles" role="group" aria-label="Display views">
        <button
          class="toggle"
          class:on={$settings.displayToggles.notation}
          onclick={() => toggleDisplay('notation')}
          title={$settings.displayToggles.notation ? 'Hide notation' : 'Show notation'}
          type="button"
        >
          Notation
        </button>
        <button
          class="toggle"
          class:on={$settings.displayToggles.tab}
          onclick={() => toggleDisplay('tab')}
          title={$settings.displayToggles.tab ? 'Hide tab' : 'Show tab'}
          type="button"
        >
          Tab
        </button>
        <button
          class="toggle"
          class:on={$settings.displayToggles.fretboard}
          onclick={() => toggleDisplay('fretboard')}
          title={$settings.displayToggles.fretboard ? 'Hide fretboard' : 'Show fretboard'}
          type="button"
        >
          Fretboard
        </button>
      </div>

      {#if displayMode !== null}
        <ExerciseDisplay
          alphaTexInput={alphaTexForDisplay}
          tabVisible={$settings.displayToggles.tab}
        />
      {/if}
      {#if $settings.displayToggles.fretboard}
        <div class="fretboard-row">
          <Fretboard
            sequence={currentExercise.sequence}
            tuning={currentExercise.params.tuning}
            rootPc={currentExercise.params.rootPc}
            spelling={currentExercise.params.spelling}
            spellingPreference={currentExercise.params.rootName?.includes('♭')
              ? 'flat'
              : 'sharp'}
          />
        </div>
      {/if}

      <div class="metronome-row">
        <MetronomeControls
          tempo={currentTempo}
          tempoLocked={userTempo !== null}
          onTempoChange={setUserTempo}
          onRandomizeTempo={randomizeTempo}
          behavior={$settings.metronome.behavior}
          accent={$settings.metronome.accentBeatOne}
          halvingPeriodMeasures={$settings.metronome.halvingPeriodMeasures}
          stopAfterMinutes={$settings.metronome.stopAfterMinutes}
        />
      </div>

      <div class="nav-row">
        <button
          class="prev-btn"
          onclick={() => window.history.back()}
          aria-label="Previous exercise"
          title="Previous exercise (P)"
          type="button"
        >
          ←
        </button>
        <button
          class="next-btn"
          onclick={pickNext}
          title="Next exercise (N)"
        >
          Next exercise →
        </button>
      </div>

      <details>
        <summary>Note sequence</summary>
        <table>
          <thead>
            <tr><th>#</th><th>Note</th><th>String</th><th>Fret</th></tr>
          </thead>
          <tbody>
            {#each currentExercise.sequence as note, i}
              <tr>
                <td>{i + 1}</td>
                <td>{noteName(note.midi)}</td>
                <td>{currentExercise.params.tuning.openNoteNames[note.string]}</td>
                <td>{note.fret}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>
    </section>
  {:else}
    <section class="empty">
      <p>No exercises match your filters. Open settings and enable more.</p>
      {#if universeSize === 0}
        <button onclick={() => (panelOpen = true)}>Open settings</button>
      {/if}
    </section>
  {/if}
</main>

<SettingsPanel open={panelOpen} onClose={() => (panelOpen = false)} />
<AboutPanel open={aboutOpen} onClose={() => (aboutOpen = false)} />
<BrowsePanel
  open={browseOpen}
  onClose={() => (browseOpen = false)}
  onPick={loadPicked}
/>

<script module lang="ts">
  import type { Variant } from './exercises/types';
  import type { Scale } from './theory/scales';

  const INTERVAL_NAMES: Record<number, string> = {
    1: '2nds',
    2: '3rds',
    3: '4ths',
    4: '5ths',
    5: '6ths',
    6: '7ths',
    7: 'octaves',
  };

  function describeVariant(v: Variant, scale: Scale): string {
    switch (v.kind) {
      case 'plain':
        return 'scale ↕';
      case 'multiOctaveA':
        return `multi-octave A (${v.octaves} oct)`;
      case 'multiOctaveB':
        return `multi-octave B (${v.octaves} oct)`;
      case 'consecutive':
        return (
          Array.from({ length: v.groupSize }, (_, i) => i + 1).join('-') + ' ↕'
        );
      case 'mirror': {
        const up = Array.from({ length: v.peakSize }, (_, i) => i + 1);
        const down = up.slice(0, -1).reverse();
        return [...up, ...down].join('-') + ' ↕';
      }
      case 'intervalWalk': {
        if (scale.intervals.length === 7) {
          const arrow = v.intervalDir === 'up' ? '↑' : '↓';
          const name = INTERVAL_NAMES[v.interval] ?? `${v.interval + 1}ths`;
          return `Walking ${name} ${arrow}`;
        }
        const sign = v.intervalDir === 'up' ? '+' : '-';
        return `Scale walk ${sign}${v.interval}`;
      }
    }
  }
</script>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.01em;
  }
  .topbar-actions {
    display: flex;
    gap: 8px;
  }
  .iconbtn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 18px;
  }
  .iconbtn:hover {
    background: var(--border);
    color: var(--text);
  }
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 20px;
  }
  .exercise {
    background: var(--panel);
    padding: 20px;
    border-radius: 12px;
  }
  .exercise-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  h1 {
    margin: 0;
    font-size: 18px;
    color: var(--text);
  }
  /* Share matches the view-toggle clickable style so the user can
     visually group "things that respond to clicks". */
  .share-btn {
    flex: 0 0 auto;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 80ms,
      color 80ms,
      border-color 80ms;
  }
  .share-btn:hover {
    color: var(--text);
    background: var(--panel-2);
  }
  .share-btn.copied {
    background: var(--accent);
    color: var(--accent-text-on);
    border-color: var(--accent);
  }
  .share-btn.failed {
    color: var(--accent);
    border-color: var(--accent);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    margin-bottom: 16px;
  }
  /* Chips are informational tags, not buttons. Flatter than the
     clickable controls so the user can tell at a glance which
     elements respond to clicks. */
  .chip {
    background: transparent;
    color: var(--text-dim);
    padding: 2px 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .chip + .chip::before {
    content: '·';
    color: var(--border);
    margin: 0 8px 0 0;
  }
  .chip.key {
    color: var(--accent);
    font-weight: 700;
  }
  .chip.open {
    color: var(--open-text);
    font-weight: 600;
  }
  .view-toggles {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  .toggle {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 80ms,
      color 80ms,
      border-color 80ms;
  }
  .toggle:hover {
    color: var(--text);
  }
  .toggle.on {
    background: var(--accent);
    color: var(--accent-text-on);
    border-color: var(--accent);
  }
  .fretboard-row {
    margin-top: 12px;
  }
  .metronome-row {
    margin-top: 16px;
  }
  .nav-row {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .prev-btn {
    flex: 0 0 56px;
    padding: 14px;
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
  }
  .prev-btn:hover {
    background: var(--border);
  }
  .next-btn {
    flex: 1;
    padding: 14px;
    background: var(--accent);
    color: var(--accent-text-on);
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .next-btn:hover {
    background: var(--accent-hover);
  }
  details {
    margin-top: 16px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
  }
  summary {
    cursor: pointer;
    color: var(--text-dim);
    user-select: none;
  }
  table {
    margin-top: 8px;
    border-collapse: collapse;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  th,
  td {
    padding: 4px 12px;
    text-align: right;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--text-dim);
    font-weight: 500;
  }
  .empty {
    background: var(--panel);
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    color: var(--text-dim);
  }

  /* Narrow widths: tighten padding and the exercise title so more
     content fits on a phone screen without horizontal scroll. */
  @media (max-width: 520px) {
    .topbar {
      padding: 12px 14px;
    }
    main {
      padding: 12px;
    }
    .exercise {
      padding: 14px;
    }
    h1 {
      font-size: 16px;
    }
    .exercise-header {
      flex-wrap: wrap;
    }
    .next-btn {
      padding: 12px;
      font-size: 14px;
    }
  }
</style>
