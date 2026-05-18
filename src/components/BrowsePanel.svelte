<script lang="ts">
  import { settings, defaultSettings } from '../stores/settings';
  import {
    SCALES,
    type ScaleId,
    SCALE_CATEGORIES,
  } from '../theory/scales';
  import { TUNINGS, type TuningId } from '../theory/tunings';
  import {
    HAND_POSITIONS,
    handPositionLabel,
    handPositionEmoji,
    type HandPosition,
  } from '../theory/fingerings';
  import { KEYS } from '../theory/keys';
  import {
    generateUniverse,
    paramsKey,
  } from '../exercises/picker';
  import { formatDisplayName } from '../exercises/scale-generator';
  import type { ExerciseParams, Variant } from '../exercises/types';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (params: ExerciseParams) => void;
  }
  let { open, onClose, onPick }: Props = $props();

  type VariantFamily =
    | 'any'
    | 'plain'
    | 'multiOctave'
    | 'consecutive'
    | 'mirror'
    | 'walkUp'
    | 'walkDown'
    | 'arpeggios';
  type OpenChoice = 'either' | 'fretted' | 'open';

  interface BrowseFilters {
    tuningId: TuningId;
    scaleId: ScaleId | 'any';
    keyId: string | 'any';
    hand: HandPosition | 'any';
    variantFamily: VariantFamily;
    openStrings: OpenChoice;
  }

  const FILTERS_STORAGE_KEY = 'bass-practice:browse-filters:v1';

  function loadFilters(): BrowseFilters {
    const defaults: BrowseFilters = {
      tuningId: $settings.tuningId,
      scaleId: 'any',
      keyId: 'any',
      hand: 'any',
      variantFamily: 'any',
      openStrings: 'either',
    };
    if (typeof localStorage === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<BrowseFilters>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }

  const initial = loadFilters();
  let tuningId = $state<TuningId>(initial.tuningId);
  let scaleId = $state<ScaleId | 'any'>(initial.scaleId);
  let keyId = $state<string | 'any'>(initial.keyId);
  let hand = $state<HandPosition | 'any'>(initial.hand);
  let variantFamily = $state<VariantFamily>(initial.variantFamily);
  let openStrings = $state<OpenChoice>(initial.openStrings);

  // Persist on every change.
  $effect(() => {
    const snapshot: BrowseFilters = {
      tuningId,
      scaleId,
      keyId,
      hand,
      variantFamily,
      openStrings,
    };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // storage full or disabled — ignore
      }
    }
  });

  // Build a synthetic Settings that enables everything for the chosen
  // tuning. The picker honours it and gives us the full universe for
  // that tuning; we then filter in-memory by the user's other choices.
  const fullUniverse = $derived.by(() => {
    const synthetic = {
      ...defaultSettings(),
      tuningId,
      enabledVariants: {
        plain: true,
        multiOctaveA_2: true,
        multiOctaveA_3: true,
        multiOctaveB_2: true,
        consecutive_3: true,
        consecutive_4: true,
        mirror_3: true,
        mirror_4: true,
        intervalWalks: true,
      },
      includeOpenStringVariants: true,
    };
    return generateUniverse(synthetic);
  });

  const results = $derived.by(() =>
    fullUniverse.filter((p) => {
      if (
        scaleId !== 'any' &&
        p.scale.name !== SCALES[scaleId as ScaleId]?.name
      ) {
        return false;
      }
      if (keyId !== 'any' && p.rootName !== KEYS.find((k) => k.id === keyId)?.name)
        return false;
      if (hand !== 'any' && p.handPosition !== hand) return false;
      if (variantFamily !== 'any' && !matchVariantFamily(p.variant, variantFamily))
        return false;
      if (openStrings === 'open' && !p.useOpenStrings) return false;
      if (openStrings === 'fretted' && p.useOpenStrings) return false;
      return true;
    }),
  );

  const RESULT_CAP = 200;

  function scaleIdByName(name: string): ScaleId | '' {
    for (const [id, s] of Object.entries(SCALES)) {
      if (s.name === name) return id as ScaleId;
    }
    return '';
  }

  function matchVariantFamily(v: Variant, family: string): boolean {
    switch (family) {
      case 'plain':
        return v.kind === 'plain';
      case 'multiOctave':
        return v.kind === 'multiOctaveA' || v.kind === 'multiOctaveB';
      case 'consecutive':
        return v.kind === 'consecutive';
      case 'mirror':
        return v.kind === 'mirror';
      case 'walkUp':
        return v.kind === 'intervalWalk' && v.intervalDir === 'up';
      case 'walkDown':
        return v.kind === 'intervalWalk' && v.intervalDir === 'down';
      case 'arpeggios':
        return v.kind === 'arpeggioCycle';
      default:
        return true;
    }
  }

  function pick(p: ExerciseParams): void {
    onPick(p);
    onClose();
  }

  function clearFilters(): void {
    scaleId = 'any';
    keyId = 'any';
    hand = 'any';
    variantFamily = 'any';
    openStrings = 'either';
  }
</script>

{#if open}
  <button
    class="scrim"
    onclick={onClose}
    aria-label="Close browse"
    type="button"
  ></button>
{/if}

<aside class="panel" class:open>
  <header>
    <h2>Browse exercises</h2>
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </header>

  <div class="filters">
    <section>
      <label class="row">
        <span class="lbl">Tuning</span>
        <select bind:value={tuningId}>
          {#each Object.values(TUNINGS) as t}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>
      </label>
    </section>

    <section>
      <label class="row">
        <span class="lbl">Scale</span>
        <select bind:value={scaleId}>
          <option value="any">Any scale</option>
          {#each Object.entries(SCALE_CATEGORIES) as [cat, scales]}
            <optgroup label={cat}>
              {#each scales as s}
                <option value={scaleIdByName(s.name)}>{s.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
    </section>

    <section>
      <span class="lbl">Key</span>
      <div class="chips">
        <button
          class="chip-toggle"
          class:on={keyId === 'any'}
          onclick={() => (keyId = 'any')}
          type="button">Any</button
        >
        {#each KEYS as k}
          <button
            class="chip-toggle"
            class:on={keyId === k.id}
            onclick={() => (keyId = k.id)}
            type="button">{k.name}</button
          >
        {/each}
      </div>
    </section>

    <section>
      <span class="lbl">Hand</span>
      <div class="chips">
        <button
          class="chip-toggle"
          class:on={hand === 'any'}
          onclick={() => (hand = 'any')}
          type="button">Any</button
        >
        {#each HAND_POSITIONS as hp}
          <button
            class="chip-toggle"
            class:on={hand === hp}
            onclick={() => (hand = hp)}
            type="button"
            >{handPositionEmoji(hp)} {handPositionLabel(hp)}</button
          >
        {/each}
      </div>
    </section>

    <section>
      <span class="lbl">Variant</span>
      <div class="chips">
        {#each [{ id: 'any', label: 'Any' }, { id: 'plain', label: 'Plain scale' }, { id: 'multiOctave', label: 'Multi-octave' }, { id: 'consecutive', label: 'Consecutive' }, { id: 'mirror', label: 'Mirror' }, { id: 'walkUp', label: 'Walking ↑' }, { id: 'walkDown', label: 'Walking ↓' }, { id: 'arpeggios', label: 'Arpeggios' }] as v}
          <button
            class="chip-toggle"
            class:on={variantFamily === v.id}
            onclick={() => (variantFamily = v.id as typeof variantFamily)}
            type="button">{v.label}</button
          >
        {/each}
      </div>
    </section>

    <section>
      <span class="lbl">Open strings</span>
      <div class="chips">
        <button
          class="chip-toggle"
          class:on={openStrings === 'either'}
          onclick={() => (openStrings = 'either')}
          type="button">Either</button
        >
        <button
          class="chip-toggle"
          class:on={openStrings === 'fretted'}
          onclick={() => (openStrings = 'fretted')}
          type="button">Fretted only</button
        >
        <button
          class="chip-toggle"
          class:on={openStrings === 'open'}
          onclick={() => (openStrings = 'open')}
          type="button">Open variants only</button
        >
      </div>
    </section>

    <div class="summary">
      <span>{results.length} matches</span>
      <button class="clear" onclick={clearFilters} type="button">Reset</button>
    </div>
  </div>

  <ul class="results">
    {#each results.slice(0, RESULT_CAP) as p (paramsKey(p))}
      <li>
        <button class="result" onclick={() => pick(p)} type="button">
          {formatDisplayName(p)}
        </button>
      </li>
    {/each}
    {#if results.length > RESULT_CAP}
      <li class="overflow">
        Showing {RESULT_CAP} of {results.length}. Narrow filters to see more.
      </li>
    {/if}
    {#if results.length === 0}
      <li class="overflow">No exercises match these filters.</li>
    {/if}
  </ul>
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    border: 0;
    cursor: pointer;
    z-index: 90;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(480px, 96vw);
    background: var(--panel);
    border-left: 1px solid var(--border);
    transform: translateX(100%);
    transition: transform 0.2s ease-out;
    overflow-y: auto;
    z-index: 100;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
  }
  .panel.open {
    transform: translateX(0);
  }
  header {
    position: sticky;
    top: 0;
    background: var(--panel);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    z-index: 1;
  }
  header h2 {
    margin: 0;
    color: var(--accent);
    font-size: 18px;
  }
  .close {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
  }
  .filters {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
  }
  .filters section {
    margin-bottom: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .lbl {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }
  select {
    flex: 1;
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 6px 8px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip-toggle {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .chip-toggle:hover {
    color: var(--text);
  }
  .chip-toggle.on {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }
  .summary {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-dim);
  }
  .clear {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .clear:hover {
    color: var(--text);
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 8px 0;
    flex: 1;
  }
  .results li {
    margin: 0;
  }
  .result {
    width: 100%;
    text-align: left;
    background: transparent;
    color: var(--text);
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 10px 18px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
  }
  .result:hover {
    background: var(--panel-2);
  }
  .overflow {
    padding: 14px 18px;
    color: var(--text-dim);
    font-size: 12px;
  }
</style>
