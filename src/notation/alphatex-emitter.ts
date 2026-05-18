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
 * "run" rule. Each quarter-note beat is classified as `H` (any note on
 * the beat sits above A3) or `L` (every note sits at or below A3). The
 * clef switches when a run of `RUN` consecutive beats sits in the
 * opposite range — preventing flicker on short excursions while still
 * snapping to the right clef when an exercise climbs (or descends)
 * and stays there.
 */
function computePerBarClefs(
  sequence: NoteSequence,
  notesPerBeat: number,
  beatsPerMeasure: number,
): ('bass' | 'treble')[] {
  // Classify each beat. A beat counts as "H" (high) if it contains
  // any note at or above A3 (MIDI 57 = the bass clef's top line).
  // The top line itself isn't a ledger line, but exercises that tap
  // the top line on the way to notes above it read more cleanly when
  // the whole high run reads under one clef.
  const totalBeats = Math.ceil(sequence.length / notesPerBeat);
  const beatClass: ('H' | 'L')[] = [];
  for (let b = 0; b < totalBeats; b++) {
    const notes = sequence.slice(b * notesPerBeat, (b + 1) * notesPerBeat);
    if (notes.length === 0) {
      beatClass.push('L');
      continue;
    }
    const hasHigh = notes.some((n) => n.midi >= 57);
    beatClass.push(hasHigh ? 'H' : 'L');
  }

  // Decide clef per beat. Cur changes only when RUN consecutive
  // beats are firmly in the opposite direction. Short threshold
  // catches multi-octave climbs that crest only briefly above the
  // staff. AlphaTab's clef metadata is bar-level — the change will
  // snap to the bar boundary containing the run, not the precise
  // beat where the run starts.
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

  // Roll up to per-bar clef. A bar's base clef is the clef in force
  // at its first beat. AlphaTab clefs are bar-level only (no mid-bar
  // switches), so a high-note run that starts partway through a bar
  // moves the clef change to the start of that bar.
  // Mid-bar clef changes are tracked upstream as an unplanned idea:
  // https://github.com/CoderLine/alphaTab/issues/1991 — revisit if
  // that ships.
  const totalBars = Math.ceil(totalBeats / beatsPerMeasure);
  const barClefs: ('bass' | 'treble')[] = [];
  for (let m = 0; m < totalBars; m++) {
    const firstBeat = m * beatsPerMeasure;
    barClefs.push(perBeat[firstBeat] ?? 'bass');
  }
  return barClefs;
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

  const dur = sequence[0].durationDenominator;
  const notesPerMeasure = dur; // 4/4 timing: notes per measure equals duration denominator

  const spelling = options.spelling;
  const showFingers = options.showFingerNumbers ?? false;
  const tokens = sequence.map((n) => {
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
    let token = `${n.fret}.${alphaTexString}`;
    if (props.length > 0) token += `{${props.join(' ')}}`;
    return token;
  });

  const autoClef = options.autoClef ?? false;
  // Per-bar clef decisions for auto mode. Granularity is a quarter-note
  // beat (4 beats per 4/4 bar); a clef switch fires when a run of 4+
  // consecutive beats sits in the opposite range. The new clef applies
  // starting at the first bar that contains the run.
  const beatsPerMeasure = 4;
  const notesPerBeat = Math.max(1, Math.floor(notesPerMeasure / beatsPerMeasure));
  const barClefs = autoClef
    ? computePerBarClefs(sequence, notesPerBeat, beatsPerMeasure)
    : null;

  const measures: string[] = [];
  let activeClef: 'bass' | 'treble' = 'bass';
  for (let i = 0; i < tokens.length; i += notesPerMeasure) {
    const slice = tokens.slice(i, i + notesPerMeasure);
    // Pad incomplete measure with rests so 4/4 timing always sums to 4 beats.
    const padding = notesPerMeasure - slice.length;
    if (padding > 0) {
      for (let p = 0; p < padding; p++) slice.push('r');
    }
    let prefix = '';
    if (barClefs) {
      const m = i / notesPerMeasure;
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

  const body = ksToken + `:${dur} ` + measures.join(' | ');
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
