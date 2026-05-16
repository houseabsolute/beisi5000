import type { PitchClass } from './notes';
import type { Scale, ScaleCategory } from './scales';

export type AccidentalKind =
  | 'natural'
  | 'sharp'
  | 'flat'
  | 'doubleSharp'
  | 'doubleFlat';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export type KeySpelling = 'sharp' | 'flat';

export interface Key {
  /** Display name with unicode accidental, e.g., "C", "F♯", "B♭". */
  name: string;
  /** Stable identifier used in settings storage, ASCII-only. */
  id: string;
  pc: PitchClass;
  spelling: KeySpelling;
  /**
   * Key signature for this key's MAJOR scale: positive = sharps, negative
   * = flats. AlphaTex `\ks` accepts integers from -7 to 7. Three "weird"
   * sharp keys (G♯, A♯, D♯) have impractical key sigs (8-10 sharps); we
   * use 0 for those so AlphaTab renders without a key signature, with
   * each accidental displayed explicitly.
   */
  majorKeySignature: number;
}

export const KEYS: readonly Key[] = [
  { id: 'C', name: 'C', pc: 0, spelling: 'sharp', majorKeySignature: 0 },
  { id: 'Db', name: 'D♭', pc: 1, spelling: 'flat', majorKeySignature: -5 },
  { id: 'Cs', name: 'C♯', pc: 1, spelling: 'sharp', majorKeySignature: 7 },
  { id: 'D', name: 'D', pc: 2, spelling: 'sharp', majorKeySignature: 2 },
  { id: 'Eb', name: 'E♭', pc: 3, spelling: 'flat', majorKeySignature: -3 },
  { id: 'Ds', name: 'D♯', pc: 3, spelling: 'sharp', majorKeySignature: 0 },
  { id: 'E', name: 'E', pc: 4, spelling: 'sharp', majorKeySignature: 4 },
  { id: 'F', name: 'F', pc: 5, spelling: 'flat', majorKeySignature: -1 },
  { id: 'Gb', name: 'G♭', pc: 6, spelling: 'flat', majorKeySignature: -6 },
  { id: 'Fs', name: 'F♯', pc: 6, spelling: 'sharp', majorKeySignature: 6 },
  { id: 'G', name: 'G', pc: 7, spelling: 'sharp', majorKeySignature: 1 },
  { id: 'Ab', name: 'A♭', pc: 8, spelling: 'flat', majorKeySignature: -4 },
  { id: 'Gs', name: 'G♯', pc: 8, spelling: 'sharp', majorKeySignature: 0 },
  { id: 'A', name: 'A', pc: 9, spelling: 'sharp', majorKeySignature: 3 },
  { id: 'Bb', name: 'B♭', pc: 10, spelling: 'flat', majorKeySignature: -2 },
  { id: 'As', name: 'A♯', pc: 10, spelling: 'sharp', majorKeySignature: 0 },
  { id: 'B', name: 'B', pc: 11, spelling: 'sharp', majorKeySignature: 5 },
] as const;

export const KEYS_BY_ID: Record<string, Key> = Object.fromEntries(
  KEYS.map((k) => [k.id, k]),
);

/**
 * For each mode-of-minor scale, the semitone offset between the mode root
 * and its parent harmonic/melodic minor root.
 *   modeRoot = parentRoot + offset (so parentRoot = modeRoot - offset).
 *
 * - Phrygian Dominant: 5th mode of harmonic minor.
 * - Lydian Dominant:   4th mode of melodic minor.
 * - Altered:           7th mode of melodic minor.
 * - Lydian ♯2:         6th mode of harmonic minor.
 * - Locrian ♮2:        6th mode of melodic minor.
 */
const MODE_OF_MINOR_OFFSETS: Record<string, number> = {
  'Phrygian Dominant': 7,
  'Lydian Dominant': 5,
  Altered: 11,
  'Lydian ♯2': 8,
  'Locrian ♮2': 9,
};

/**
 * Compute the key signature to use for a given key + scale combination.
 * Drives AlphaTab's accidental spelling — a flat-spelled key emits a flat
 * key signature so notes render as B♭ rather than A♯, etc.
 *
 * - Major: the key's major key signature.
 * - Natural minor: the relative major's key signature (3 semitones up).
 * - Modes: the parent major's key signature.
 * - Other scales (pentatonic, blues, harmonic/melodic minor, octatonic,
 *   chromatic, modes-of-minor): the key's own major key signature so
 *   accidentals match the user's spelling preference. Out-of-key notes
 *   render with explicit accidentals.
 */
/**
 * The blues scale is rooted in minor tonality (the 1, b3, 4, b5, 5, b7
 * intervals are an extension of the minor pentatonic). It reads more
 * naturally with the parallel natural-minor key signature, so its
 * `Eb3` lands on the staff as `Eb` rather than `D#`. This helper lets
 * `keySignatureFor` and `keySignatureLabelFor` route blues through the
 * minor branch.
 */
function isMinorTonality(scale: Scale): boolean {
  return scale.name === 'Blues';
}

export function keySignatureFor(key: Key, scale: Scale): number {
  if (scale.category === 'major') {
    return key.majorKeySignature;
  }
  if (scale.category === 'minor' || isMinorTonality(scale)) {
    // All minor scales (natural, harmonic, melodic) share the natural minor
    // key signature = relative major (+3 semitones). Harmonic/melodic minor's
    // raised 6th/7th render with explicit accidentals.
    const relPc = ((key.pc + 3) % 12) as PitchClass;
    const relMajor = KEYS.find(
      (k) => k.pc === relPc && k.spelling === key.spelling,
    );
    if (relMajor && relMajor.majorKeySignature !== 0)
      return relMajor.majorKeySignature;
    const fallback = KEYS.find((k) => k.pc === relPc);
    return fallback?.majorKeySignature ?? 0;
  }
  if (scale.category === 'modes') {
    // Mode → semitones to subtract from mode root to get parent major root.
    // (Ionian=0 and Aeolian=9 not listed since we removed them — they're
    // covered by major and natural minor.)
    const modeOffsets: Record<string, number> = {
      Dorian: 2,
      Phrygian: 4,
      Lydian: 5,
      Mixolydian: 7,
      Locrian: 11,
    };
    const offset = modeOffsets[scale.name];
    if (offset === undefined) return key.majorKeySignature;
    const parentPc = ((key.pc - offset + 12) % 12) as PitchClass;
    const parent = KEYS.find(
      (k) => k.pc === parentPc && k.spelling === key.spelling,
    );
    if (parent && parent.majorKeySignature !== 0)
      return parent.majorKeySignature;
    const fallback = KEYS.find((k) => k.pc === parentPc);
    return fallback?.majorKeySignature ?? 0;
  }
  if (scale.category === 'modes-of-minor') {
    // Modes of harmonic/melodic minor: use the parent's natural minor key
    // signature (= relative major of the parent root). Prefer the flat
    // spelling since minor-mode roots are conventionally written with
    // flats (e.g., E♭ minor not D♯ minor).
    const offset = MODE_OF_MINOR_OFFSETS[scale.name];
    if (offset === undefined) return key.majorKeySignature;
    const parentMinorPc = ((key.pc - offset + 12) % 12) as PitchClass;
    const relMajPc = ((parentMinorPc + 3) % 12) as PitchClass;
    const flatParent = KEYS.find(
      (k) => k.pc === relMajPc && k.spelling === 'flat',
    );
    if (flatParent && flatParent.majorKeySignature !== 0)
      return flatParent.majorKeySignature;
    const sharpParent = KEYS.find(
      (k) => k.pc === relMajPc && k.spelling === 'sharp',
    );
    return sharpParent?.majorKeySignature ?? 0;
  }
  // Chromatic and octatonic scales don't conform to any diatonic key
  // signature; using one creates a misleading visual context. Render with
  // no key signature and rely on explicit accidentals.
  if (scale.category === 'chromatic' || scale.category === 'octatonic') {
    return 0;
  }
  // Pentatonic, blues, modes-of-minor: use the key's major key signature
  // so flat keys render as flats and sharp keys as sharps. AlphaTab adds
  // explicit accidentals for notes outside the key signature.
  return key.majorKeySignature;
}

/**
 * Convert a Key to the ASCII identifier AlphaTex's `\ks` directive expects
 * (e.g., "B♭" -> "Bb", "F♯" -> "F#").
 */
function keyToAlphaTexName(key: Key): string {
  return key.name.replace(/♯/g, '#').replace(/♭/g, 'b');
}

/**
 * Build a map from pitch class to the correct accidental spelling for the
 * given key + scale. Only defined for 7-note diatonic-style scales (major,
 * three minors, modes, modes-of-minor, Hungarian) where each scale degree
 * gets a unique letter name. Other scales (pentatonic, blues, chromatic,
 * octatonic) return an empty map and fall back to AlphaTab's default
 * accidental choice.
 *
 * Example: C♯ melodic minor → {1:#, 3:#, 4:natural, 6:#, 8:#, 10:#, 0:#}.
 * The pitch class 0 entry forces the leading tone to render as B♯ instead
 * of C-natural.
 */
export function spellingMap(
  key: Key,
  scale: Scale,
): Map<PitchClass, AccidentalKind> {
  const result = new Map<PitchClass, AccidentalKind>();
  if (scale.intervals.length !== 7) return result;

  const rootLetter = key.name[0].toUpperCase();
  const rootIdx = LETTERS.indexOf(rootLetter as (typeof LETTERS)[number]);
  if (rootIdx < 0) return result;

  for (let i = 0; i < 7; i++) {
    const letter = LETTERS[(rootIdx + i) % 7];
    const expectedPc = ((key.pc + scale.intervals[i]) % 12) as PitchClass;
    const naturalPc = LETTER_PC[letter];
    let semitones = expectedPc - naturalPc;
    while (semitones > 6) semitones -= 12;
    while (semitones < -6) semitones += 12;
    let acc: AccidentalKind | null;
    switch (semitones) {
      case 0:
        acc = 'natural';
        break;
      case 1:
        acc = 'sharp';
        break;
      case 2:
        acc = 'doubleSharp';
        break;
      case -1:
        acc = 'flat';
        break;
      case -2:
        acc = 'doubleFlat';
        break;
      default:
        acc = null;
    }
    if (acc !== null) result.set(expectedPc, acc);
  }
  // If our forced letter sequence requires any double accidental, the
  // spelling is awkward (e.g., D♭ Locrian ♮2 needs A♭♭, B♭♭). Drop the
  // override entirely for these cases — AlphaTab's defaults will use
  // simpler enharmonic spellings.
  for (const acc of result.values()) {
    if (acc === 'doubleSharp' || acc === 'doubleFlat') return new Map();
  }
  return result;
}

/** The AlphaTex `{acc ...}` keyword for each accidental kind. */
export const ALPHATEX_ACCIDENTAL: Record<AccidentalKind, string> = {
  natural: 'forceNatural',
  sharp: 'forceSharp',
  flat: 'forceFlat',
  doubleSharp: 'forceDoubleSharp',
  doubleFlat: 'forceDoubleFlat',
};

/**
 * True when the user's chosen root spelling produces the same scale as
 * a cleaner enharmonic spelling already in the picker. For Locrian and
 * the other modes, the mathematical parent is one of the diatonic
 * majors; if the user picks a flat root but the parent is a sharp key
 * (e.g., G♭ Locrian → parent G major, 1 sharp), the same notes are
 * available under the sharp-spelled enharmonic (F♯ Locrian), which
 * renders with the parent's natural key signature. We skip the
 * redundant flat-spelled (or sharp-spelled when the parent is flat)
 * version so the picker doesn't surface visually broken duplicates.
 * Not yet applied to non-modes categories — those have their own
 * enharmonic-handling logic in {@link keySignatureLabelFor}.
 */
export function isEnharmonicallyRedundant(key: Key, scale: Scale): boolean {
  if (scale.category !== 'modes') return false;
  const offsets: Record<string, number> = {
    Dorian: 2,
    Phrygian: 4,
    Lydian: 5,
    Mixolydian: 7,
    Locrian: 11,
  };
  const offset = offsets[scale.name];
  if (offset === undefined) return false;
  const parentPc = ((key.pc - offset + 12) % 12) as PitchClass;
  const parent =
    KEYS.find((k) => k.pc === parentPc && k.spelling === key.spelling) ??
    KEYS.find((k) => k.pc === parentPc);
  if (!parent) return true;
  // "Weird" sharp parents (G♯, A♯, D♯) have majorKeySignature 0 by
  // convention — those modes are unrepresentable as a key signature
  // and should be skipped.
  if (parent.majorKeySignature === 0 && parent.pc !== 0) return true;
  // Spelling mismatch: flat root with sharp parent (or vice versa).
  // F♯ Locrian (sharp) → parent G (1 sharp): OK.
  // G♭ Locrian (flat) → parent G (1 sharp): redundant, prefer F♯.
  if (key.spelling === 'flat' && parent.majorKeySignature > 0) return true;
  if (key.spelling === 'sharp' && parent.majorKeySignature < 0) return true;
  return false;
}

/**
 * AlphaTex `\ks` identifier for a key + scale combination, or null when no
 * key signature should be emitted. Using the minor-qualified identifier
 * (e.g., `C#minor`) tells AlphaTab to use minor-mode spelling rules — for
 * example, the leading tone in C♯ melodic minor renders as B♯ instead of
 * C♮.
 */
export function keySignatureLabelFor(key: Key, scale: Scale): string | null {
  if (scale.category === 'chromatic' || scale.category === 'octatonic') {
    return null;
  }
  const ascii = keyToAlphaTexName(key);
  if (scale.category === 'minor' || isMinorTonality(scale)) {
    // D♭ minor and G♭ minor need 8/9 flats (their relative majors,
    // F♭ and B♭♭, are beyond AlphaTab's ±7 range). Skip these so the
    // picker doesn't surface them; the user has C♯ minor and F♯ minor
    // as enharmonic alternatives.
    if (key.id === 'Db' || key.id === 'Gb') return null;
    // A♭ minor's relative major is C♭ (7 flats). AlphaTab's `\ks
    // Abminor` identifier triggers an intermittent parse error on
    // first-render cold-load (`AT219 (9,5)->(9,4)`) — the identifier
    // isn't reliably consumed as the argument to `\ks`. The relative
    // major's name (`Cb`) parses cleanly and produces the same -7-flat
    // signature; we override per-note accidentals with `{acc ...}`
    // anyway, so losing the minor-mode spelling hint doesn't affect
    // the rendered notes.
    if (key.id === 'Ab') return 'Cb';
    return `${ascii}minor`;
  }
  if (scale.category === 'major') {
    // Skip the label for "weird" sharp keys whose major scale would need
    // 8+ sharps (G♯/A♯/D♯) — AlphaTab can't represent that key signature.
    if (key.majorKeySignature === 0 && key.pc !== 0) return null;
    return ascii;
  }
  if (scale.category === 'modes') {
    // Enharmonic-redundant combos (e.g., G♭ Locrian when F♯ Locrian
    // is already in the picker) are filtered out by the picker via
    // {@link isEnharmonicallyRedundant} before this function runs.
    // What remains has a sensible parent matching the user's spelling.
    const offsets: Record<string, number> = {
      Dorian: 2,
      Phrygian: 4,
      Lydian: 5,
      Mixolydian: 7,
      Locrian: 11,
    };
    const offset = offsets[scale.name];
    if (offset === undefined) return ascii;
    const parentPc = ((key.pc - offset + 12) % 12) as PitchClass;
    const parent =
      KEYS.find((k) => k.pc === parentPc && k.spelling === key.spelling) ??
      KEYS.find((k) => k.pc === parentPc);
    if (!parent || (parent.majorKeySignature === 0 && parent.pc !== 0))
      return null;
    return keyToAlphaTexName(parent);
  }
  if (scale.category === 'modes-of-minor') {
    // Emit "<parentMinor>minor" so AlphaTab uses minor-mode spelling for
    // the keysig and accidentals. The chosen parent must be a minor key
    // AlphaTab can actually represent — D♭ minor and G♭ minor need 8/9
    // flats, so when those would be the parent, fall through to the
    // enharmonic sharp spelling (C♯ minor / F♯ minor).
    const offset = MODE_OF_MINOR_OFFSETS[scale.name];
    if (offset === undefined) return null;
    const parentMinorPc = ((key.pc - offset + 12) % 12) as PitchClass;
    const flatParent = KEYS.find(
      (k) => k.pc === parentMinorPc && k.spelling === 'flat',
    );
    if (flatParent && flatParent.id !== 'Db' && flatParent.id !== 'Gb')
      return `${keyToAlphaTexName(flatParent)}minor`;
    const sharpParent = KEYS.find(
      (k) => k.pc === parentMinorPc && k.spelling === 'sharp',
    );
    if (sharpParent && sharpParent.majorKeySignature !== 0)
      return `${keyToAlphaTexName(sharpParent)}minor`;
    return null;
  }
  // Pentatonic, blues, modes-of-minor: use key's major label if it has a
  // usable signature.
  if (key.majorKeySignature === 0 && key.pc !== 0) return null;
  return ascii;
}
