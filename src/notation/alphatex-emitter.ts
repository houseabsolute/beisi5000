import { midiOctave, midiPitchClass, pitchClassName } from '../theory/notes';
import {
  ALPHATEX_ACCIDENTAL,
  type AccidentalKind,
} from '../theory/keys';
import type { Tuning } from '../theory/tunings';
import type { NoteSequence } from '../exercises/types';

export type DisplayMode = 'score' | 'tabs' | 'both';

export interface EmitOptions {
  displayMode?: DisplayMode;
  tempo?: number;
  title?: string;
  /**
   * Key signature: positive = sharps, negative = flats, 0 = none.
   * Range -7 to 7 per AlphaTex spec.
   */
  keySignature?: number;
  /**
   * Explicit AlphaTex `\ks` identifier (e.g., "Bb", "C#minor"). Overrides
   * the conversion from `keySignature` — pass this when scale mode matters
   * for spelling (minor scales need the "minor" suffix so the leading tone
   * spells as B♯ instead of C♮ in C♯ melodic minor, for example).
   */
  keySignatureLabel?: string | null;
  /**
   * Per-pitch-class accidental override. The emitter attaches
   * `{acc forceSharp}` (or similar) to each note so AlphaTab can't pick a
   * different enharmonic spelling. Empty/undefined leaves spelling to
   * AlphaTab's defaults.
   */
  spelling?: Map<number, AccidentalKind>;
  /**
   * When true, append `{lf N}` to each note so AlphaTab renders the
   * fretting-hand finger above the staff. Reads the `finger` field
   * the layout computes (1=index..4=pinky); AlphaTex `lf` uses 2=index
   * through 5=pinky, so the emitter shifts by +1. Notes with no
   * `finger` value are emitted without a finger marker.
   */
  showFingerNumbers?: boolean;
  /**
   * Per-measure clef auto-switching. When true, the staff switches to
   * treble clef once a run of 3+ consecutive beats includes any note at
   * or above A3 (MIDI 57 — top line of bass clef), and switches back
   * to bass on the equivalent run of low beats. When false (default),
   * the staff stays in bass clef throughout.
   */
  autoClef?: boolean;
}

/** True when the majority of the given notes sit above A3 (MIDI 57 —
 * the top line of bass clef, A below middle C). At that density
 * treble clef is more readable than stacking ledger lines above bass. */
export function majorityAboveA3(notes: NoteSequence): boolean {
  if (notes.length === 0) return false;
  let above = 0;
  for (const n of notes) {
    if (n.midi > 57) above++;
  }
  return above * 2 > notes.length;
}

/**
 * Decide a clef (bass or treble) for each bar of the sequence using a
 * beat-level "run" rule. Beat-level classification preserves the original
 * noise-filter behavior: switch clefs only when a run of 3 consecutive
 * beats sits in the opposite range. With mixed-duration rhythms, beat
 * boundaries don't align with note count — partition by summed duration
 * to define each beat's note membership.
 */
function computePerBarClefs(
  sequence: NoteSequence,
  barNoteIndices: number[][],
): ('bass' | 'treble')[] {
  const BEAT_BEATS = 1; // one quarter beat
  const EPS = 0.0001;

  const beatsPerNote = (n: NoteSequence[number]): number => {
    const raw = 4 / n.durationDenominator;
    return n.tuplet ? (raw * 2) / n.tuplet : raw;
  };

  // Walk all notes, accumulating into beats. Record which beat each
  // note belongs to (parallel array to sequence).
  const noteBeatIndex: number[] = [];
  const beatNoteIndices: number[][] = [[]];
  let beatsInBeat = 0;
  for (let i = 0; i < sequence.length; i++) {
    beatNoteIndices[beatNoteIndices.length - 1].push(i);
    noteBeatIndex.push(beatNoteIndices.length - 1);
    beatsInBeat += beatsPerNote(sequence[i]);
    if (beatsInBeat >= BEAT_BEATS - EPS) {
      beatsInBeat = 0;
      if (i < sequence.length - 1) beatNoteIndices.push([]);
    }
  }

  // Per-beat class: H if any note in the beat is at or above MIDI 57
  // (top line of bass clef). Matches the existing threshold.
  const beatClass: ('H' | 'L')[] = beatNoteIndices.map((indices) =>
    indices.some((i) => sequence[i] && sequence[i].midi >= 57) ? 'H' : 'L',
  );

  // RUN=3 noise filter: flip clef when 3 consecutive beats sit in the
  // opposite direction.
  const RUN = 3;
  const perBeat: ('bass' | 'treble')[] = [];
  let cur: 'bass' | 'treble' = 'bass';
  for (let b = 0; b < beatClass.length; b++) {
    const oppType = cur === 'bass' ? 'H' : 'L';
    if (b + RUN <= beatClass.length) {
      let allOpp = true;
      for (let k = 0; k < RUN; k++) {
        if (beatClass[b + k] !== oppType) {
          allOpp = false;
          break;
        }
      }
      if (allOpp) cur = cur === 'bass' ? 'treble' : 'bass';
    }
    perBeat.push(cur);
  }

  // Roll up per-bar: bar's clef = clef at its first beat (= beat that
  // contains the bar's first note).
  return barNoteIndices.map((indices) => {
    if (indices.length === 0) return 'bass';
    const firstBeat = noteBeatIndex[indices[0]];
    return perBeat[firstBeat] ?? 'bass';
  });
}

const DEFAULT_TEMPO = 120;

export function emitAlphaTex(
  sequence: NoteSequence,
  tuning: Tuning,
  options: EmitOptions = {},
): string {
  const { displayMode = 'both', tempo = DEFAULT_TEMPO, title } = options;

  const staffSpec =
    displayMode === 'score'
      ? 'score'
      : displayMode === 'tabs'
        ? 'tabs'
        : 'score tabs';

  const tuningStr = [...tuning.openMidi]
    .reverse()
    .map((midi) => `${pitchClassName(midiPitchClass(midi), 'sharp')}${midiOctave(midi)}`)
    .join(' ');

  const headerLines: string[] = [];
  if (title) headerLines.push(`\\title "${escapeQuotes(title)}"`);
  headerLines.push(`\\tempo ${tempo}`);
  headerLines.push(`\\track "Bass"`);
  headerLines.push(`\\instrument 33`); // GM program 33 = Electric Bass (fingered)
  // \tuning is a multi-arg metadata directive — AlphaTex requires its
  // arguments wrapped in parens.
  headerLines.push(`\\tuning (${tuningStr})`);
  // Bass clef (F4) is the default opening clef. When `autoClef` is on,
  // individual bars whose notes sit mostly above A3 emit a per-bar
  // `\clef G2` switch later in the body.
  headerLines.push(`\\clef F4`);
  headerLines.push(`\\staff{${staffSpec}}`);

  // \ks is a bar-level directive that takes a key identifier (e.g., Bb,
  // F#, Aminor), not a number of sharps/flats. Placed at the start of the
  // body so it applies from the first bar onward.
  let ksToken = '';
  if (options.keySignatureLabel) {
    ksToken = `\\ks ${options.keySignatureLabel} `;
  } else if (options.keySignature !== undefined && options.keySignature !== 0) {
    ksToken = `\\ks ${keySignatureToName(options.keySignature)} `;
  }

  if (sequence.length === 0) {
    return headerLines.join('\n') + '\n.\n';
  }

  const spelling = options.spelling;
  const showFingers = options.showFingerNumbers ?? false;

  // Build per-note tokens. Each token carries its own optional duration
  // prefix — the emitter inserts a `:N ` only when the duration changes
  // from the previous note.
  let currentDur = -1;
  const tokens = sequence.map((n) => {
    let prefix = '';
    if (n.durationDenominator !== currentDur) {
      prefix = `:${n.durationDenominator} `;
      currentDur = n.durationDenominator;
    }
    const alphaTexString = tuning.stringCount - n.string;
    // AlphaTex packs every per-note property into a single `{ ... }`
    // block separated by spaces — multiple `{...}{...}` blocks are
    // not accepted (the second one parses as a fresh, unrecognized
    // property). Collect each property's `name args` fragment first
    // and emit them together.
    const props: string[] = [];
    if (spelling) {
      const pc = ((n.midi % 12) + 12) % 12;
      const acc = spelling.get(pc);
      if (acc) props.push(`acc ${ALPHATEX_ACCIDENTAL[acc]}`);
    }
    if (showFingers && n.finger !== undefined) {
      // AlphaTex `lf 1` parses as "thumb", `lf 2` as index, etc.
      // AlphaTab then renders those one-indexed-from-thumb digits as
      // 1..5 in the effect band — so for bass-convention "1=index"
      // we shift +1 (internal 1=index → lf 2 → displays "1" because
      // SingleNoteEffectBand subtracts thumb).
      props.push(`lf ${n.finger + 1}`);
    }
    if (n.tuplet !== undefined) {
      props.push(`tu ${n.tuplet}`);
    }
    let token = `${n.fret}.${alphaTexString}`;
    if (props.length > 0) token += `{${props.join(' ')}}`;
    return prefix + token;
  });

  // Bar splitting by summed beat fraction. Each note contributes
  //   (4 / durationDenominator) * (tuplet ? 2/tuplet : 1)
  // beats. When we reach 4 beats, close the bar and start a new one.
  const BAR_BEATS = 4;
  const EPS = 0.0001;
  const beatsPerNote = (n: (typeof sequence)[number]): number => {
    const raw = 4 / n.durationDenominator;
    return n.tuplet ? (raw * 2) / n.tuplet : raw;
  };

  const autoClef = options.autoClef ?? false;

  // Walk the sequence, building bar-index-arrays for the autoClef helper
  // and bar-string lists for the body.
  const barNoteIndices: number[][] = [[]];
  let beatsInBar = 0;
  for (let i = 0; i < sequence.length; i++) {
    barNoteIndices[barNoteIndices.length - 1].push(i);
    beatsInBar += beatsPerNote(sequence[i]);
    if (beatsInBar >= BAR_BEATS - EPS) {
      beatsInBar = 0;
      if (i < sequence.length - 1) barNoteIndices.push([]);
    }
  }

  // If the last bar has leftover beats, pad with rests matching the
  // last note's duration so no extra duration prefix is needed.
  const lastBar = barNoteIndices[barNoteIndices.length - 1];
  if (lastBar.length > 0 && beatsInBar > EPS) {
    const lastNote = sequence[lastBar[lastBar.length - 1]];
    const restBeats = BAR_BEATS - beatsInBar;
    const restBeatsPerSlot = beatsPerNote(lastNote);
    const restCount = Math.max(1, Math.round(restBeats / restBeatsPerSlot));
    for (let r = 0; r < restCount; r++) {
      tokens.push('r');
      lastBar.push(tokens.length - 1);
    }
  }

  const barClefs = autoClef
    ? computePerBarClefs(sequence, barNoteIndices)
    : null;

  const measures: string[] = [];
  let activeClef: 'bass' | 'treble' = 'bass';
  for (let m = 0; m < barNoteIndices.length; m++) {
    const indices = barNoteIndices[m];
    const slice = indices.map((i) => tokens[i]);
    let prefix = '';
    if (barClefs) {
      const desired: 'bass' | 'treble' = barClefs[m] ?? activeClef;
      if (desired !== activeClef) {
        // Insert a bar-level clef change before this measure. AlphaTex
        // treats `\clef` as bar metadata when it appears in the body.
        prefix = `\\clef ${desired === 'treble' ? 'G2' : 'F4'} `;
        activeClef = desired;
      }
    }
    measures.push(prefix + slice.join(' '));
  }

  const body = ksToken + measures.join(' | ');
  return headerLines.join('\n') + '\n.\n' + body;
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

/**
 * Convert a key-signature integer (-7 sharps/flats..7) into the AlphaTex
 * identifier the `\ks` directive expects. Uses flat names for negative,
 * sharp/natural names for non-negative.
 */
function keySignatureToName(ks: number): string {
  switch (ks) {
    case -7:
      return 'Cb';
    case -6:
      return 'Gb';
    case -5:
      return 'Db';
    case -4:
      return 'Ab';
    case -3:
      return 'Eb';
    case -2:
      return 'Bb';
    case -1:
      return 'F';
    case 0:
      return 'C';
    case 1:
      return 'G';
    case 2:
      return 'D';
    case 3:
      return 'A';
    case 4:
      return 'E';
    case 5:
      return 'B';
    case 6:
      return 'F#';
    case 7:
      return 'C#';
    default:
      return 'C';
  }
}
