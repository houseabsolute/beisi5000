<script lang="ts">
  import { settings, defaultSettings } from '../stores/settings';
  import { SCALES, type ScaleId, SCALE_CATEGORIES } from '../theory/scales';
  import { TUNINGS, type TuningId } from '../theory/tunings';
  import { HAND_POSITIONS, handPositionLabel, handPositionEmoji } from '../theory/fingerings';
  import { KEYS, type Key } from '../theory/keys';

  // Sort keys for display: by letter (C, D, E, F, G, A, B), then within
  // each letter by accidental (flat → natural → sharp). Produces
  // C, C♯, D♭, D, D♯, E♭, E, F, F♯, G♭, G, G♯, A♭, A, A♯, B♭, B.
  const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  function keySortIndex(k: Key): number {
    const li = LETTER_ORDER.indexOf(k.name[0]);
    const accidental = k.name.includes('♭')
      ? -1
      : k.name.includes('♯')
        ? 1
        : 0;
    return li * 3 + accidental + 1;
  }
  const SORTED_KEYS = [...KEYS].sort(
    (a, b) => keySortIndex(a) - keySortIndex(b),
  );
  import type { MetronomeBehavior } from '../audio/metronome';

  interface Props {
    open: boolean;
    onClose: () => void;
  }
  let { open, onClose }: Props = $props();


  function toggleScale(id: ScaleId) {
    settings.update((s) => ({
      ...s,
      enabledScales: { ...s.enabledScales, [id]: !s.enabledScales[id] },
    }));
  }

  function toggleKey(id: string) {
    settings.update((s) => {
      const enabled = new Set(s.enabledKeys);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      // preserve KEYS order
      return {
        ...s,
        enabledKeys: KEYS.map((k) => k.id).filter((kid) => enabled.has(kid)),
      };
    });
  }

  function toggleHand(hp: 'front' | 'mid' | 'back') {
    settings.update((s) => {
      const set = new Set(s.enabledHandPositions);
      if (set.has(hp)) set.delete(hp);
      else set.add(hp);
      return { ...s, enabledHandPositions: [...set] };
    });
  }

  function setTuning(id: TuningId) {
    settings.update((s) => ({ ...s, tuningId: id }));
  }

  function toggleVariant(key: keyof typeof $settings.enabledVariants) {
    settings.update((s) => ({
      ...s,
      enabledVariants: {
        ...s.enabledVariants,
        [key]: !s.enabledVariants[key],
      },
    }));
  }

  function toggleArpSize(key: keyof typeof $settings.enabledArpeggios.sizes) {
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        ...s.enabledArpeggios,
        sizes: {
          ...s.enabledArpeggios.sizes,
          [key]: !s.enabledArpeggios.sizes[key],
        },
      },
    }));
  }

  function toggleArpDirection(
    key: keyof typeof $settings.enabledArpeggios.directions,
  ) {
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        ...s.enabledArpeggios,
        directions: {
          ...s.enabledArpeggios.directions,
          [key]: !s.enabledArpeggios.directions[key],
        },
      },
    }));
  }

  function toggleAgility(key: keyof typeof $settings.enabledAgility) {
    settings.update((s) => ({
      ...s,
      enabledAgility: {
        ...s.enabledAgility,
        [key]: !s.enabledAgility[key],
      },
    }));
  }

  function setAllHandPositions(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledHandPositions: enabled ? ['front', 'mid', 'back'] : [],
    }));
  }

  function setAllVariants(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledVariants: {
        plain: enabled,
        multiOctaveA_2: enabled,
        multiOctaveA_3: enabled,
        multiOctaveB_2: enabled,
        consecutive_3: enabled,
        consecutive_4: enabled,
        mirror_3: enabled,
        mirror_4: enabled,
        intervalWalks: enabled,
      },
    }));
  }

  function setAllArpeggios(enabled: boolean): void {
    // One button pair for the whole Arpeggios section — flips both
    // sizes AND directions together. A cycle with sizes all-on but
    // directions all-off (or vice-versa) emits zero variants, so
    // toggling the two together is the natural unit.
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        sizes: {
          triad: enabled,
          seventh: enabled,
          ninth: enabled,
          eleventh: enabled,
          thirteenth: enabled,
        },
        directions: {
          allUp: enabled,
          upDown: enabled,
          downUp: enabled,
          zigzag: enabled,
        },
      },
    }));
  }

  function setAllAgility(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledAgility: { bigX: enabled, spider: enabled },
    }));
  }

  function setAllKeys(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledKeys: enabled ? KEYS.map((k) => k.id) : [],
    }));
  }

  function setAllScales(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
        (acc, id) => {
          acc[id] = enabled;
          return acc;
        },
        {} as Record<ScaleId, boolean>,
      ),
    }));
  }

  function enableAll(): void {
    settings.update((s) => ({
      ...s,
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
      enabledArpeggios: {
        sizes: {
          triad: true,
          seventh: true,
          ninth: true,
          eleventh: true,
          thirteenth: true,
        },
        directions: {
          allUp: true,
          upDown: true,
          downUp: true,
          zigzag: true,
        },
      },
      enabledAgility: { bigX: true, spider: true },
      enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
        (acc, id) => {
          acc[id] = true;
          return acc;
        },
        {} as Record<ScaleId, boolean>,
      ),
      enabledKeys: KEYS.map((k) => k.id),
      enabledHandPositions: ['front', 'mid', 'back'],
      includeOpenStringVariants: true,
    }));
  }

  function resetToDefaults(): void {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Reset all settings to defaults? This will not change your bass tuning.',
      )
    ) {
      return;
    }
    const defaults = defaultSettings();
    settings.update((s) => ({ ...defaults, tuningId: s.tuningId }));
  }

  function setMetro<K extends keyof typeof $settings.metronome>(
    k: K,
    v: (typeof $settings.metronome)[K],
  ) {
    settings.update((s) => ({ ...s, metronome: { ...s.metronome, [k]: v } }));
  }
</script>

{#if open}
  <button
    class="scrim"
    onclick={onClose}
    aria-label="Close settings"
    type="button"
  ></button>
{/if}

<aside class="panel" class:open>
  <header>
    <h2>Settings</h2>
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </header>

  <div class="body">
    <div class="bulk-actions">
      <button class="bulk-btn" onclick={enableAll} type="button">Enable all</button>
      <button class="bulk-btn" onclick={resetToDefaults} type="button">Reset to defaults</button>
    </div>

    <section>
      <h3>Bass</h3>
      <div class="radio-group">
        {#each Object.values(TUNINGS) as t (t.id)}
          <label class="radio">
            <input
              type="radio"
              name="tuning"
              checked={$settings.tuningId === t.id}
              onchange={() => setTuning(t.id as TuningId)}
            />
            {t.name}
          </label>
        {/each}
      </div>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.includeOpenStringVariants}
          onchange={(e) =>
            settings.update((s) => ({
              ...s,
              includeOpenStringVariants: e.currentTarget.checked,
            }))}
        />
        Include open-string variants where available
      </label>
    </section>

    <section>
      <div class="section-header">
        <h3>Hand positions</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllHandPositions(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllHandPositions(false)} type="button">None</button>
        </div>
      </div>
      <div class="chips">
        {#each HAND_POSITIONS as hp}
          <label class="chip-toggle">
            <input
              type="checkbox"
              checked={$settings.enabledHandPositions.includes(hp)}
              onchange={() => toggleHand(hp)}
            />
            <span>{handPositionEmoji(hp)} {handPositionLabel(hp)}</span>
          </label>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-header">
        <h3>Variants</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllVariants(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllVariants(false)} type="button">None</button>
        </div>
      </div>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.plain}
          onchange={() => toggleVariant('plain')}
        />
        Plain scale (1 octave, ↕)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.multiOctaveA_2}
          onchange={() => toggleVariant('multiOctaveA_2')}
        />
        Multi-octave A — 2 octaves (with high-string shift, walks back)
      </label>
      {#if TUNINGS[$settings.tuningId].stringCount >= 5}
        <label class="checkbox">
          <input
            type="checkbox"
            checked={$settings.enabledVariants.multiOctaveA_3}
            onchange={() => toggleVariant('multiOctaveA_3')}
          />
          Multi-octave A — 3 octaves (5/6-string only)
        </label>
      {/if}
      {#if TUNINGS[$settings.tuningId].stringCount >= 5}
        <label class="checkbox">
          <input
            type="checkbox"
            checked={$settings.enabledVariants.multiOctaveB_2}
            onchange={() => toggleVariant('multiOctaveB_2')}
          />
          Multi-octave B — 2 octaves (5/6-string)
        </label>
      {/if}
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.consecutive_3}
          onchange={() => toggleVariant('consecutive_3')}
        />
        Consecutive 1-2-3 (3-note groups, ↕)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.consecutive_4}
          onchange={() => toggleVariant('consecutive_4')}
        />
        Consecutive 1-2-3-4 (4-note groups, ↕)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.mirror_3}
          onchange={() => toggleVariant('mirror_3')}
        />
        Mirror 1-2-3-2-1 (peak of 3, ↕)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.mirror_4}
          onchange={() => toggleVariant('mirror_4')}
        />
        Mirror 1-2-3-4-3-2-1 (peak of 4, ↕)
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledVariants.intervalWalks}
          onchange={() => toggleVariant('intervalWalks')}
        />
        Walking intervals (2nds through octaves, ↑ and ↓)
      </label>
    </section>

    <section>
      <div class="section-header">
        <h3>Arpeggios</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllArpeggios(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllArpeggios(false)} type="button">None</button>
        </div>
      </div>
      <p class="hint">Cycles diatonic chord arpeggios through the key. Only available on 7-note scales.</p>
      <div class="arp-subhead">Sizes</div>
      <div class="chips">
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.triad}
            onchange={() => toggleArpSize('triad')}
          />
          <span>Triad</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.seventh}
            onchange={() => toggleArpSize('seventh')}
          />
          <span>7th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.ninth}
            onchange={() => toggleArpSize('ninth')}
          />
          <span>9th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.eleventh}
            onchange={() => toggleArpSize('eleventh')}
          />
          <span>11th</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.sizes.thirteenth}
            onchange={() => toggleArpSize('thirteenth')}
          />
          <span>13th</span>
        </label>
      </div>
      <div class="arp-subhead">Directions</div>
      <div class="chips">
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.allUp}
            onchange={() => toggleArpDirection('allUp')}
          />
          <span>↑↑ all up</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.upDown}
            onchange={() => toggleArpDirection('upDown')}
          />
          <span>↑↓ up then down</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.downUp}
            onchange={() => toggleArpDirection('downUp')}
          />
          <span>↓↑ down then up</span>
        </label>
        <label class="chip-toggle">
          <input
            type="checkbox"
            checked={$settings.enabledArpeggios.directions.zigzag}
            onchange={() => toggleArpDirection('zigzag')}
          />
          <span>↕ zigzag</span>
        </label>
      </div>
    </section>

    <section>
      <div class="section-header">
        <h3>Hand-agility drills</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllAgility(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllAgility(false)} type="button">None</button>
        </div>
      </div>
      <p class="hint">Chromatic finger-coordination patterns up the neck. No key — pure technique.</p>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledAgility.bigX}
          onchange={() => toggleAgility('bigX')}
        />
        Big X — diagonals across 4 adjacent strings
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.enabledAgility.spider}
          onchange={() => toggleAgility('spider')}
        />
        Spider — two-string crawl
      </label>
    </section>

    <section>
      <div class="section-header">
        <h3>Keys</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllKeys(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllKeys(false)} type="button">None</button>
        </div>
      </div>
      <div class="chips">
        {#each SORTED_KEYS as key}
          <label class="chip-toggle">
            <input
              type="checkbox"
              checked={$settings.enabledKeys.includes(key.id)}
              onchange={() => toggleKey(key.id)}
            />
            <span class:flat={key.spelling === 'flat'}>{key.name}</span>
          </label>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-header">
        <h3>Scales</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllScales(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllScales(false)} type="button">None</button>
        </div>
      </div>
      {#each Object.entries(SCALE_CATEGORIES) as [category, scales] (category)}
        <details open>
          <summary class="category">{category}</summary>
          <div class="scale-list">
            {#each scales as scale}
              {@const id = (Object.keys(SCALES) as ScaleId[]).find(
                (k) => SCALES[k].name === scale.name,
              )}
              {#if id}
                <label class="checkbox">
                  <input
                    type="checkbox"
                    checked={$settings.enabledScales[id]}
                    onchange={() => toggleScale(id)}
                  />
                  {scale.name}
                </label>
              {/if}
            {/each}
          </div>
        </details>
      {/each}
    </section>

    <section>
      <h3>Display</h3>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.showFingerNumbers}
          onchange={(e) =>
            settings.update((s) => ({
              ...s,
              showFingerNumbers: e.currentTarget.checked,
            }))}
        />
        Show finger numbers in notation
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.autoTrebleClef}
          onchange={(e) =>
            settings.update((s) => ({
              ...s,
              autoTrebleClef: e.currentTarget.checked,
            }))}
        />
        Use treble clef for high-register exercises
      </label>
    </section>

    <section>
      <h3>Metronome</h3>
      <label class="block">
        Tempo range
        <span class="tempo-row">
          <input
            type="number"
            min="30"
            max="240"
            value={$settings.metronome.tempoMin}
            onchange={(e) =>
              setMetro('tempoMin', Number(e.currentTarget.value))}
          />
          <span>–</span>
          <input
            type="number"
            min="30"
            max="240"
            value={$settings.metronome.tempoMax}
            onchange={(e) =>
              setMetro('tempoMax', Number(e.currentTarget.value))}
          />
          <span>BPM</span>
        </span>
      </label>
      <label class="block">
        Behavior
        <select
          value={$settings.metronome.behavior}
          onchange={(e) =>
            setMetro(
              'behavior',
              e.currentTarget.value as MetronomeBehavior,
            )}
        >
          <option value="normal">Normal</option>
          <option value="skip">Skip ticks</option>
          <option value="halve">Halving</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label class="block">
        Halving period (measures)
        <input
          type="number"
          min="1"
          max="16"
          value={$settings.metronome.halvingPeriodMeasures}
          onchange={(e) =>
            setMetro(
              'halvingPeriodMeasures',
              Number(e.currentTarget.value),
            )}
        />
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.metronome.accentBeatOne}
          onchange={(e) =>
            setMetro('accentBeatOne', e.currentTarget.checked)}
        />
        Accent beat 1
      </label>
      <label class="checkbox">
        <input
          type="checkbox"
          checked={$settings.metronome.stopAfterMinutes !== null}
          onchange={(e) =>
            setMetro(
              'stopAfterMinutes',
              e.currentTarget.checked
                ? ($settings.metronome.stopAfterMinutes ?? 2)
                : null,
            )}
        />
        Stop after
        <input
          type="number"
          min="0.5"
          max="60"
          step="0.5"
          value={$settings.metronome.stopAfterMinutes ?? 2}
          disabled={$settings.metronome.stopAfterMinutes === null}
          onchange={(e) =>
            setMetro(
              'stopAfterMinutes',
              Number(e.currentTarget.value),
            )}
        />
        min
      </label>
    </section>
  </div>
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
    width: min(420px, 92vw);
    background: var(--panel);
    border-left: 1px solid var(--border);
    transform: translateX(100%);
    transition: transform 0.2s ease-out;
    overflow-y: auto;
    z-index: 100;
    box-shadow: var(--shadow);
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
  .close:hover {
    background: var(--border);
    color: var(--text);
  }
  .body {
    padding: 14px 18px 32px;
  }
  section {
    margin-bottom: 22px;
  }
  section h3 {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }
  .radio {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
    color: var(--text);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip-toggle {
    cursor: pointer;
    user-select: none;
  }
  .chip-toggle input {
    display: none;
  }
  .chip-toggle span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--border);
    color: var(--text-dim);
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
  }
  .chip-toggle input:checked + span {
    background: var(--accent);
    color: var(--accent-text-on);
    border-color: var(--accent);
  }
  .chip-toggle span.flat {
    /* Flat-spelled keys use a slightly different tint when unchecked so
     * sharp / flat enharmonics are visually distinguishable in the grid. */
    background: var(--open-bg);
    color: var(--open-text);
  }
  .chip-toggle input:checked + span.flat {
    background: var(--open-text);
    color: var(--accent-text-on);
    border-color: var(--open-text);
  }
  .scale-list {
    padding: 4px 0 8px 4px;
  }
  .category {
    cursor: pointer;
    color: var(--text);
    font-size: 13px;
    padding: 6px 0;
    text-transform: capitalize;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--text-dim);
    margin-bottom: 12px;
  }
  .block input,
  .block select {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 14px;
  }
  .tempo-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tempo-row input {
    width: 80px;
  }
  .tempo-row span {
    color: var(--text);
  }
  .arp-subhead {
    margin: 10px 0 6px;
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 600;
  }
  .hint {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.4;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 10px;
  }
  .section-header h3 {
    margin: 0;
  }
  .bulk-section {
    display: flex;
    gap: 4px;
  }
  .bulk-section-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bulk-section-btn:hover {
    background: var(--border);
    color: var(--text);
  }
  .bulk-actions {
    display: flex;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .bulk-btn {
    background: var(--accent);
    color: var(--accent-text-on);
    border: 0;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .bulk-btn:hover {
    filter: brightness(1.1);
  }
</style>
