<script lang="ts">
  import type { NoteSequence } from '../exercises/types';
  import type { Tuning } from '../theory/tunings';
  import {
    midiPitchClass,
    pitchClassName,
    type AccidentalPreference,
    type PitchClass,
  } from '../theory/notes';
  import type { AccidentalKind } from '../theory/keys';

  interface Props {
    sequence: NoteSequence;
    tuning: Tuning;
    rootPc: PitchClass;
    /** Per-pitch-class accidental, when the exercise has a defined spelling
     * (diatonic scales). Pitch classes not in the map fall back to
     * `spellingPreference`. Empty/undefined for chromatic + octatonic. */
    spelling?: Map<PitchClass, AccidentalKind>;
    /** Sharp vs flat preference for pitches outside the spelling map. */
    spellingPreference?: AccidentalPreference;
  }
  let {
    sequence,
    tuning,
    rootPc,
    spelling,
    spellingPreference = 'sharp',
  }: Props = $props();

  // Natural-letter table: pitch class → letter name when no accidental.
  const NATURAL_PC_TO_LETTER: Record<number, string> = {
    0: 'C',
    2: 'D',
    4: 'E',
    5: 'F',
    7: 'G',
    9: 'A',
    11: 'B',
  };

  function noteNameFor(pc: PitchClass): string {
    const acc = spelling?.get(pc);
    if (acc) {
      let naturalPc: number;
      let suffix: string;
      switch (acc) {
        case 'natural':
          naturalPc = pc;
          suffix = '';
          break;
        case 'sharp':
          naturalPc = (pc - 1 + 12) % 12;
          suffix = '♯';
          break;
        case 'flat':
          naturalPc = (pc + 1) % 12;
          suffix = '♭';
          break;
        case 'doubleSharp':
          naturalPc = (pc - 2 + 12) % 12;
          suffix = '𝄪';
          break;
        case 'doubleFlat':
          naturalPc = (pc + 2) % 12;
          suffix = '♭♭';
          break;
      }
      const letter = NATURAL_PC_TO_LETTER[naturalPc];
      if (letter) return letter + suffix;
    }
    return pitchClassName(pc, spellingPreference)
      .replace('#', '♯')
      .replace('b', '♭');
  }

  // Layout constants
  const FRET_WIDTH = 44;
  const STRING_GAP = 32;
  const LEFT_PAD = 56; // space for string-name labels and open-string dots
  const RIGHT_PAD = 16;
  const TOP_PAD = 24;
  const BOTTOM_PAD = 30;

  // Range of frets to show: 0 (nut) up to one past the highest used fret,
  // with a minimum of 5 frets shown for context.
  const lowFret = 0;
  const highFret = $derived(
    Math.max(5, ...sequence.map((n) => n.fret + 1)),
  );
  const fretCount = $derived(highFret - lowFret + 1);

  const width = $derived(LEFT_PAD + fretCount * FRET_WIDTH + RIGHT_PAD);
  const height = $derived(
    TOP_PAD + (tuning.stringCount - 1) * STRING_GAP + BOTTOM_PAD,
  );

  // Standard fret-marker positions on a bass / guitar
  const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  const DOUBLE_MARKER_FRETS = new Set([12, 24]);

  // Unique fretboard positions used in the sequence, annotated with the
  // played note name. Order is insertion (first appearance in sequence).
  const positions = $derived.by(() => {
    const map = new Map<
      string,
      {
        string: number;
        fret: number;
        pc: PitchClass;
        name: string;
        isRoot: boolean;
      }
    >();
    for (const n of sequence) {
      const key = `${n.string},${n.fret}`;
      if (!map.has(key)) {
        const pc = midiPitchClass(n.midi);
        map.set(key, {
          string: n.string,
          fret: n.fret,
          pc,
          name: noteNameFor(pc),
          isRoot: pc === rootPc,
        });
      }
    }
    return Array.from(map.values());
  });

  // Y coordinate for a string. String 0 (lowest pitch) sits at the BOTTOM
  // to match tab convention.
  function stringY(stringIndex: number): number {
    return TOP_PAD + (tuning.stringCount - 1 - stringIndex) * STRING_GAP;
  }

  // X coordinate of a fret line (right side of the fret-N box).
  function fretLineX(fret: number): number {
    return LEFT_PAD + (fret - lowFret) * FRET_WIDTH;
  }

  // X coordinate of a played note: middle of the fret box (for fret > 0)
  // or just left of the nut for open strings.
  function noteX(fret: number): number {
    if (fret === 0) return LEFT_PAD - 22;
    return fretLineX(fret) - FRET_WIDTH / 2;
  }

  // Dot colors driven by CSS variables so the fretboard tracks the
  // app's color scheme.
  const ROOT_FILL = 'var(--fb-root-fill)';
  const NOTE_FILL = 'var(--fb-note-fill)';
  const NOTE_STROKE = 'var(--fb-note-stroke)';

  function midpointY(): number {
    return TOP_PAD + ((tuning.stringCount - 1) * STRING_GAP) / 2;
  }
</script>

<div class="fretboard-wrap">
  <svg
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="xMidYMid meet"
    style="width:100%;max-width:{width}px"
  >
    <!-- Fret marker dots (between strings) -->
    {#each MARKER_FRETS as marker}
      {#if marker >= lowFret && marker <= highFret}
        {#if DOUBLE_MARKER_FRETS.has(marker)}
          <circle
            cx={fretLineX(marker) - FRET_WIDTH / 2}
            cy={midpointY() - 14}
            r="3.5"
            fill="var(--fb-marker)"
          />
          <circle
            cx={fretLineX(marker) - FRET_WIDTH / 2}
            cy={midpointY() + 14}
            r="3.5"
            fill="var(--fb-marker)"
          />
        {:else}
          <circle
            cx={fretLineX(marker) - FRET_WIDTH / 2}
            cy={midpointY()}
            r="3.5"
            fill="var(--fb-marker)"
          />
        {/if}
      {/if}
    {/each}

    <!-- Strings -->
    {#each tuning.openNoteNames as name, s}
      <text
        x={LEFT_PAD - 30}
        y={stringY(s) + 4}
        font-size="12"
        fill="var(--fb-label-dim)"
        text-anchor="end"
      >
        {name}
      </text>
      <line
        x1={LEFT_PAD}
        y1={stringY(s)}
        x2={width - RIGHT_PAD}
        y2={stringY(s)}
        stroke="var(--fb-string)"
        stroke-width={1 + (tuning.stringCount - 1 - s) * 0.25}
      />
    {/each}

    <!-- Fret lines -->
    {#each Array(fretCount) as _, i}
      {@const fret = lowFret + i}
      <line
        x1={fretLineX(fret)}
        y1={stringY(tuning.stringCount - 1)}
        x2={fretLineX(fret)}
        y2={stringY(0)}
        stroke={fret === 0 ? 'var(--fb-nut)' : 'var(--fb-fret)'}
        stroke-width={fret === 0 ? 4 : 1.5}
      />
    {/each}

    <!-- Fret numbers along the bottom -->
    {#each Array(fretCount) as _, i}
      {@const fret = lowFret + i}
      {#if fret > 0}
        <text
          x={fretLineX(fret) - FRET_WIDTH / 2}
          y={height - 8}
          font-size="11"
          text-anchor="middle"
          fill="var(--fb-label-dim)"
        >
          {fret}
        </text>
      {/if}
    {/each}

    <!-- Note dots: one per unique (string, fret) used. Root highlighted. -->
    {#each positions as pos}
      <circle
        cx={noteX(pos.fret)}
        cy={stringY(pos.string)}
        r="13"
        fill={pos.isRoot ? ROOT_FILL : NOTE_FILL}
        stroke={NOTE_STROKE}
        stroke-width={pos.isRoot ? 2 : 1.25}
      />
      <text
        x={noteX(pos.fret)}
        y={stringY(pos.string) + 4}
        font-size="11"
        font-weight="700"
        text-anchor="middle"
        fill="var(--fb-note-stroke)"
      >
        {pos.name}
      </text>
    {/each}
  </svg>
</div>

<style>
  .fretboard-wrap {
    background: var(--fb-bg);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid var(--border);
  }
</style>
