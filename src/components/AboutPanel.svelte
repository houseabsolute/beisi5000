<script lang="ts">
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  let { open, onClose }: Props = $props();
</script>

{#if open}
  <button
    class="scrim"
    onclick={onClose}
    aria-label="Close about"
    type="button"
  ></button>
{/if}

<aside class="panel" class:open>
  <header>
    <h2>About</h2>
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </header>

  <div class="body">
    <section>
      <p class="lede">
        A randomized bass-guitar practice app. Hit
        <strong>✓ Done</strong> when you've played the exercise (it gets
        logged) or <strong>Skip</strong> to move on without logging, set a
        metronome alongside, and grind.
      </p>
    </section>

    <section>
      <h3>How it works</h3>
      <p>
        Each tap of <strong>✓ Done</strong> or <strong>Skip</strong>
        picks one combination from the universe of enabled options: a key,
        a scale, a variant, a hand position, a rhythm, and a bass tuning.
        The same exercise won't appear again for a while — the picker
        excludes the last 20 picks.
      </p>
      <p>
        Each exercise plays ascending and descending. Walking-interval
        exercises end with a return to the tonic root. Arpeggio cycles
        run every chord rooted on each scale degree in turn.
      </p>
    </section>

    <section>
      <h3>Display</h3>
      <ul>
        <li>
          <strong>Notation</strong> — standard music notation, bass clef.
        </li>
        <li>
          <strong>Tab</strong> — fret numbers per string.
        </li>
        <li>
          <strong>Fretboard</strong> — every used position on the neck,
          labelled with note names. The root is highlighted.
        </li>
      </ul>
      <p>Toggle each independently. Hide them all if you just want the metronome.</p>
    </section>

    <section>
      <h3>Hand positions</h3>
      <p>
        Each exercise specifies which finger plays the root, which fixes
        the rest of the fingering pattern:
      </p>
      <ul>
        <li>
          <strong>☝️ Front</strong> — index finger on the root. The
          comfortable position.
        </li>
        <li>
          <strong>🖐️ Mid</strong> — middle finger on the root. Index can
          reach back to root&minus;2 for the next string's lower scale notes.
        </li>
        <li>
          <strong>🤙 Back</strong> — pinky on the root. Stretchy; index
          reaches back to root&minus;4 to catch low notes.
        </li>
      </ul>
    </section>

    <section>
      <h3>Variants</h3>
      <ul>
        <li>
          <strong>Plain scale</strong> — straight up and back down,
          one octave.
        </li>
        <li>
          <strong>Multi-octave A / B</strong> — span 2–3 octaves. A walks
          back through different strings (the "spiral"); B retraces the
          ascending path.
        </li>
        <li>
          <strong>Consecutive groups</strong> — sequences like 1-2-3,
          2-3-4, 3-4-5… (or 4-note variants). Forces you to spell out
          short melodic fragments.
        </li>
        <li>
          <strong>Mirror groups</strong> — 1-2-3-2-1 (or 1-2-3-4-3-2-1).
          Out-and-back at every scale degree.
        </li>
        <li>
          <strong>Walking intervals</strong> — pairs at a fixed interval
          (2nds through octaves) that shift up or down through the scale.
          The arrow indicates which direction the interval goes (e.g.
          Walking 6ths&nbsp;↑ means the second note of each pair is a 6th
          ABOVE the first).
        </li>
        <li>
          <strong>Arpeggio cycles</strong> — diatonic chord arpeggios
          (triad, 7th, 9th, 11th, 13th) rooted on each scale degree in
          turn. Four directions (↑↑, ↑↓, ↓↑, ↕). The <strong>↑↑</strong>
          direction also supports inversions (1st&hellip;6th, depending
          on chord size) — selectable independently in Settings.
        </li>
        <li>
          <strong>Hand-agility drills</strong> — <em>Big&nbsp;X</em> and
          <em>Spider</em>, chromatic finger-coordination patterns
          scanning frets 1&nbsp;→&nbsp;12&nbsp;→&nbsp;1. No key — pure
          technique. Always in eighth notes regardless of rhythm settings.
        </li>
      </ul>
    </section>

    <section>
      <h3>Rhythms</h3>
      <p>
        Six rhythm patterns can be enabled in Settings; the picker rotates
        through whichever are on. Default is Quarter only.
      </p>
      <ul>
        <li><strong>♩ Quarter</strong> — one note per beat.</li>
        <li><strong>♪ Eighth</strong> — two per beat.</li>
        <li><strong>♪₃ Triplet</strong> — three per beat.</li>
        <li>
          <strong>(8ss) / (s8s) / (ss8)</strong> — an eighth plus two
          sixteenths in three permutations.
        </li>
      </ul>
    </section>

    <section>
      <h3>Practice history</h3>
      <p>
        The <strong>📊</strong> button opens the history panel. Every
        <strong>✓ Done</strong> click logs an entry against a (scale, key,
        variant family) cell. The panel shows total sessions, coverage
        percentage (over the cells your Settings currently enable), and
        today's count, plus a "neglected first" list sorted so the
        unpractised cells surface to the top.
      </p>
      <p>
        Click any row to load a random exercise from that cell.
        <strong>Clear</strong> wipes all history (with confirmation).
      </p>
    </section>

    <section>
      <h3>Metronome</h3>
      <ul>
        <li><strong>Normal</strong> — steady click.</li>
        <li>
          <strong>Skip ticks</strong> — randomly drops 1–3 consecutive
          clicks every so often. Forces you to keep your own time.
        </li>
        <li>
          <strong>Halving</strong> — clicks halve every few measures
          (T&nbsp;→&nbsp;T/2&nbsp;→&nbsp;T/4&nbsp;→&nbsp;T). The exercise
          tempo doesn't change; the click density does.
        </li>
        <li><strong>Both</strong> — skip ticks and halving combined.</li>
      </ul>
      <p>
        Tempo is randomly picked within your configured min/max range
        every time you tap <strong>✓ Done</strong> or <strong>Skip</strong>.
      </p>
    </section>

    <section>
      <h3>Settings</h3>
      <p>
        The gear icon opens the settings panel. Everything is persisted to
        your browser's local storage — no account, no backend. Toggling
        scales, keys, hand positions, variants, arpeggio sizes /
        directions / inversions, agility drills, and rhythms filters
        which exercises the picker can choose.
      </p>
    </section>

    <section>
      <h3>Keyboard shortcuts</h3>
      <ul class="shortcuts">
        <li><kbd>Space</kbd> — start / stop the metronome</li>
        <li><kbd>D</kbd> — mark this exercise done and pick next</li>
        <li><kbd>N</kbd> — skip without logging (pick next)</li>
        <li><kbd>P</kbd> — previous exercise (browser back)</li>
      </ul>
    </section>

    <section>
      <h3>Who made this</h3>
      <p>
        Built by a bass player who wanted a practice tool that matched
        how they actually woodshed: random key, random variant, random
        tempo — no thinking about <em>what</em> to play, just play it.
        Most existing tools either pick exercises in too predictable an
        order or stop short of the specific scale / fingering / hand
        position combinations that bassists actually need.
      </p>
      <p>The author is Dave Rolsky.</p>
    </section>

    <section>
      <h3>How it was built</h3>
      <p>
        Built collaboratively with
        <a href="https://claude.com/claude-code" target="_blank" rel="noopener">Claude Code</a>
        over a series of focused sessions. The code is TypeScript +
        Svelte 5 + AlphaTab for the staff rendering, with a custom
        layout algorithm that picks the most natural fretboard fingering
        for each exercise based on hand position and the bassist's
        physical-world constraints.
      </p>
      <p>
        Most of the layout rules came from real feedback during practice
        — "this jump shouldn't happen", "the apex should be at the same
        spot on the way down", "walking exercises should resolve to the
        root". Each rule is encoded in the picker or the fretboard
        layout, and the test suite captures the expected fingering for
        every notable case so regressions get caught immediately.
      </p>
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
    margin: 0 0 8px;
    color: var(--text);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .lede {
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
    margin: 0;
  }
  p {
    color: var(--text-dim);
    line-height: 1.55;
    margin: 0 0 8px;
  }
  ul {
    color: var(--text-dim);
    line-height: 1.55;
    margin: 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: 4px;
  }
  strong {
    color: var(--text);
    font-weight: 600;
  }
  .shortcuts kbd {
    display: inline-block;
    min-width: 1.6em;
    padding: 1px 6px;
    margin-right: 6px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: var(--text);
    text-align: center;
  }
</style>
