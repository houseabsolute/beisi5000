<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as alphaTab from '@coderline/alphatab';

  interface Props {
    alphaTexInput: string;
    tabVisible?: boolean;
  }

  let { alphaTexInput, tabVisible = true }: Props = $props();

  let element: HTMLDivElement;
  let api: alphaTab.AlphaTabApi | null = null;
  let apiReady = $state(false);
  let lastError = $state<string | null>(null);

  function loadTex(tex: string) {
    if (!api) return;
    lastError = null;
    try {
      api.tex(tex);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ExerciseDisplay] tex() threw:', e);
      lastError = msg;
    }
  }

  let resizeObs: ResizeObserver | null = null;
  let lastWidth = 0;
  let watermarkObserver: MutationObserver | null = null;

  onMount(() => {
    api = new alphaTab.AlphaTabApi(element, {
      core: {
        engine: 'svg',
        fontDirectory: '/font/',
      },
      player: {
        enablePlayer: false,
        // Even with playback disabled, AlphaTab's scroll machinery
        // runs on first render and pulls the document scroll down to
        // the staff — landing ~337px below the topbar. Off pins the
        // page at whatever the browser has it at.
        scrollMode: alphaTab.ScrollMode.Off,
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
        systemPaddingTop: 24,
        systemPaddingBottom: 16,
        notationStaffPaddingTop: 30,
        notationStaffPaddingBottom: 16,
        // Push effect bands (fingerings, etc.) away from the staves
        // below them. Default is 2, which packs them right against
        // the tab numbers.
        effectBandPaddingBottom: 14,
      },
      notation: {
        notationMode: alphaTab.NotationMode.SongBook,
        // Hide tempo marker, bar numbers, and dynamics — all noise
        // here. We set our own tempo, bars are uniform 4/4, and we
        // don't emit dynamics, but AlphaTab inserts an "f" by
        // default at the start of every staff.
        elements: new Map<alphaTab.NotationElement, boolean>([
          [alphaTab.NotationElement.BarNumber, false],
          [alphaTab.NotationElement.EffectTempo, false],
          [alphaTab.NotationElement.EffectDynamics, false],
        ]),
        fingeringMode: tabVisible
          ? alphaTab.FingeringMode.SingleNoteEffectBand
          : alphaTab.FingeringMode.ScoreDefault,
      },
    });

    api.error.on((e) => {
      const msg = (e as { message?: string })?.message ?? String(e);
      console.error('[ExerciseDisplay] AlphaTab error event:', e);
      lastError = msg;
    });

    // AlphaTab paints "rendered by alphaTab" at the bottom of every
    // render. The library uses MPL-2.0 (no attribution-in-render
    // requirement); strip the SVG element that carries it. The
    // watermark is appended via partial renders that arrive after
    // `renderFinished` and `postRenderFinished`, so install a
    // MutationObserver to catch it whenever AlphaTab inserts it.
    const hideWatermark = (root: HTMLElement) => {
      for (const t of root.querySelectorAll('svg text')) {
        if (t.textContent?.trim() === 'rendered by alphaTab') {
          // Removing the parent SVG entirely also reclaims its layout
          // space — setting display:none on the <text> leaves an
          // empty band at the bottom of the staff column.
          const svg = t.closest('svg');
          svg?.remove();
        }
      }
    };
    const observer = new MutationObserver(() => hideWatermark(element));
    observer.observe(element, { childList: true, subtree: true });
    hideWatermark(element);
    // Park the observer reference so onDestroy can clean it up.
    watermarkObserver = observer;

    apiReady = true;

    // AlphaTab measures the container's width when it first renders; it
    // doesn't re-flow when the container resizes (e.g. window resize,
    // mobile rotation). Watch for size changes and trigger a re-render.
    lastWidth = element.clientWidth;
    resizeObs = new ResizeObserver(() => {
      if (!api) return;
      const w = element.clientWidth;
      if (Math.abs(w - lastWidth) > 4) {
        lastWidth = w;
        api.render();
      }
    });
    resizeObs.observe(element);
  });

  onDestroy(() => {
    resizeObs?.disconnect();
    resizeObs = null;
    watermarkObserver?.disconnect();
    watermarkObserver = null;
    api?.destroy();
    api = null;
    apiReady = false;
  });

  // Re-render on every alphaTexInput change. Don't gate by renderedTex —
  // we previously hit a case where the gating flag was out of sync with the
  // actual rendered content and the box stayed empty.
  $effect(() => {
    const tex = alphaTexInput;
    if (apiReady && tex) {
      loadTex(tex);
    }
  });

  // Switch fingering placement when tab visibility changes. The effect
  // band requires tab to host it; with tab hidden, fall back to
  // inline-on-notation mode so fingers stay visible.
  $effect(() => {
    if (!api || !apiReady) return;
    const mode = tabVisible
      ? alphaTab.FingeringMode.SingleNoteEffectBand
      : alphaTab.FingeringMode.ScoreDefault;
    if (api.settings.notation.fingeringMode !== mode) {
      api.settings.notation.fingeringMode = mode;
      api.updateSettings();
      api.render();
    }
  });


</script>

<div class="alphatab-wrap">
  <div bind:this={element} class="alphatab-host"></div>
</div>
{#if lastError}
  <div class="alphatab-error">AlphaTab error: {lastError}</div>
{/if}

<style>
  /* AlphaTab measures the host's clientWidth (which INCLUDES padding)
     and renders the surface at that width — so if the host has padding,
     the surface ends up wider than the host's content area and we get a
     horizontal scrollbar. Use a wrapper for the visual padding/border
     and let the host itself be padding-free. */
  .alphatab-wrap {
    background: var(--notation-bg);
    border-radius: 8px;
    border: 1px solid var(--border);
    padding: 12px;
    overflow: hidden;
    min-height: 200px;
  }
  .alphatab-host {
    color: var(--text);
    overflow: hidden;
  }

  /* AlphaTab injects SVG content; ensure background matches the wrap */
  .alphatab-host :global(.at-surface) {
    background: var(--notation-bg) !important;
  }
  .alphatab-error {
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--danger-bg);
    color: var(--danger-text);
    border: 1px solid var(--danger-border);
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
</style>
