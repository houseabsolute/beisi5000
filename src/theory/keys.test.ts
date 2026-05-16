import { describe, test, expect } from 'vitest';
import {
  KEYS,
  KEYS_BY_ID,
  keySignatureFor,
  keySignatureLabelFor,
  spellingMap,
  isEnharmonicallyRedundant,
} from './keys';
import { SCALES } from './scales';

describe('KEYS registry', () => {
  test('has 17 entries: 12 sharp/natural + 5 flats', () => {
    expect(KEYS).toHaveLength(17);
    const flats = KEYS.filter((k) => k.spelling === 'flat');
    expect(flats.map((k) => k.name)).toEqual(['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭']);
  });

  test('every key has unique id', () => {
    const ids = KEYS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('flat-only pitch classes (D♭, E♭, G♭, A♭, B♭) have a flat alternative', () => {
    expect(KEYS_BY_ID.Db).toBeDefined();
    expect(KEYS_BY_ID.Eb).toBeDefined();
    expect(KEYS_BY_ID.Gb).toBeDefined();
    expect(KEYS_BY_ID.Ab).toBeDefined();
    expect(KEYS_BY_ID.Bb).toBeDefined();
  });
});

describe('keySignatureFor (major)', () => {
  test('C major = 0', () => {
    expect(keySignatureFor(KEYS_BY_ID.C, SCALES.major)).toBe(0);
  });
  test('G major = 1 sharp', () => {
    expect(keySignatureFor(KEYS_BY_ID.G, SCALES.major)).toBe(1);
  });
  test('F major = 1 flat', () => {
    expect(keySignatureFor(KEYS_BY_ID.F, SCALES.major)).toBe(-1);
  });
  test('B♭ major = 2 flats', () => {
    expect(keySignatureFor(KEYS_BY_ID.Bb, SCALES.major)).toBe(-2);
  });
  test('F♯ major = 6 sharps', () => {
    expect(keySignatureFor(KEYS_BY_ID.Fs, SCALES.major)).toBe(6);
  });
  test('G♭ major = 6 flats', () => {
    expect(keySignatureFor(KEYS_BY_ID.Gb, SCALES.major)).toBe(-6);
  });
});

describe('keySignatureFor (natural minor)', () => {
  test('A minor = 0 (relative major C)', () => {
    expect(keySignatureFor(KEYS_BY_ID.A, SCALES.naturalMinor)).toBe(0);
  });
  test('E minor = 1 sharp (relative major G)', () => {
    expect(keySignatureFor(KEYS_BY_ID.E, SCALES.naturalMinor)).toBe(1);
  });
  test('D minor = 1 flat (relative major F)', () => {
    expect(keySignatureFor(KEYS_BY_ID.D, SCALES.naturalMinor)).toBe(-1);
  });
  test('B♭ minor = 5 flats (relative major D♭)', () => {
    expect(keySignatureFor(KEYS_BY_ID.Bb, SCALES.naturalMinor)).toBe(-5);
  });
});

describe('keySignatureFor (modes)', () => {
  test('D dorian = 0 (parent major C)', () => {
    expect(keySignatureFor(KEYS_BY_ID.D, SCALES.dorian)).toBe(0);
  });
  test('E phrygian = 0 (parent major C)', () => {
    expect(keySignatureFor(KEYS_BY_ID.E, SCALES.phrygian)).toBe(0);
  });
  test('F lydian = 0 (parent major C)', () => {
    expect(keySignatureFor(KEYS_BY_ID.F, SCALES.lydian)).toBe(0);
  });
  test('G mixolydian = 0 (parent major C)', () => {
    expect(keySignatureFor(KEYS_BY_ID.G, SCALES.mixolydian)).toBe(0);
  });
});

describe('keySignatureFor (harmonic / melodic minor use natural minor keysig)', () => {
  test('E melodic minor uses E natural minor (1 sharp), not E major (4 sharps)', () => {
    expect(keySignatureFor(KEYS_BY_ID.E, SCALES.melodicMinor)).toBe(1);
  });
  test('A harmonic minor uses A natural minor (0 sharps)', () => {
    expect(keySignatureFor(KEYS_BY_ID.A, SCALES.harmonicMinor)).toBe(0);
  });
  test('C harmonic minor uses C natural minor (3 flats = E♭ major)', () => {
    expect(keySignatureFor(KEYS_BY_ID.C, SCALES.harmonicMinor)).toBe(-3);
  });
});

describe('keySignatureFor (modes-of-minor)', () => {
  test('C Locrian ♮2 uses E♭ minor keysig (6 flats) — parent is E♭ melodic minor', () => {
    expect(keySignatureFor(KEYS_BY_ID.C, SCALES.locrianNatural2)).toBe(-6);
  });
  test('G Phrygian Dominant uses C minor keysig (3 flats) — parent is C harmonic minor', () => {
    expect(keySignatureFor(KEYS_BY_ID.G, SCALES.phrygianDominant)).toBe(-3);
  });
  test('E Phrygian Dominant uses A minor keysig (0) — parent is A harmonic minor', () => {
    expect(keySignatureFor(KEYS_BY_ID.E, SCALES.phrygianDominant)).toBe(0);
  });
  test('B♭ Lydian Dominant uses F minor keysig (4 flats) — parent is F melodic minor', () => {
    expect(keySignatureFor(KEYS_BY_ID.Bb, SCALES.lydianDominant)).toBe(-4);
  });
});

describe('keySignatureFor (other scales — fall back to key major)', () => {
  test('A♭ Hirajoshi uses A♭ major (-4 flats) so notation renders A♭ B♭ not G♯ A♯', () => {
    expect(keySignatureFor(KEYS_BY_ID.Ab, SCALES.hirajoshi)).toBe(-4);
  });
  test('B♭ minor pentatonic uses B♭ major (-2 flats)', () => {
    expect(keySignatureFor(KEYS_BY_ID.Bb, SCALES.minorPentatonic)).toBe(-2);
  });
  test('A blues uses A natural minor (0 sharps) — blues is a minor-tonality scale', () => {
    expect(keySignatureFor(KEYS_BY_ID.A, SCALES.blues)).toBe(0);
  });
  test('C blues uses C natural minor (3 flats)', () => {
    expect(keySignatureFor(KEYS_BY_ID.C, SCALES.blues)).toBe(-3);
  });
  test('C octatonic uses 0', () => {
    expect(keySignatureFor(KEYS_BY_ID.C, SCALES.octatonicWholeHalf)).toBe(0);
  });
  test('B♭ octatonic uses 0 even though B♭ is a flat key', () => {
    expect(keySignatureFor(KEYS_BY_ID.Bb, SCALES.octatonicHalfWhole)).toBe(0);
  });
  test('F♯ chromatic uses 0 even though F♯ is a sharp key', () => {
    expect(keySignatureFor(KEYS_BY_ID.Fs, SCALES.chromatic)).toBe(0);
  });
});

describe('keySignatureLabelFor', () => {
  test('major scales emit the key name', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.C, SCALES.major)).toBe('C');
    expect(keySignatureLabelFor(KEYS_BY_ID.Bb, SCALES.major)).toBe('Bb');
    expect(keySignatureLabelFor(KEYS_BY_ID.Fs, SCALES.major)).toBe('F#');
  });

  test('minor scales emit Xminor for proper spelling', () => {
    // The critical case: C# melodic minor should emit "C#minor" so the
    // raised 7th renders as B♯ rather than C♮.
    expect(keySignatureLabelFor(KEYS_BY_ID.Cs, SCALES.melodicMinor)).toBe(
      'C#minor',
    );
    expect(keySignatureLabelFor(KEYS_BY_ID.E, SCALES.melodicMinor)).toBe(
      'Eminor',
    );
    expect(keySignatureLabelFor(KEYS_BY_ID.A, SCALES.naturalMinor)).toBe(
      'Aminor',
    );
    expect(keySignatureLabelFor(KEYS_BY_ID.Bb, SCALES.harmonicMinor)).toBe(
      'Bbminor',
    );
  });

  test('chromatic and octatonic return null (no key signature)', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.C, SCALES.chromatic)).toBeNull();
    expect(
      keySignatureLabelFor(KEYS_BY_ID.Bb, SCALES.octatonicWholeHalf),
    ).toBeNull();
  });

  test('modes emit the parent major name', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.D, SCALES.dorian)).toBe('C');
    expect(keySignatureLabelFor(KEYS_BY_ID.E, SCALES.phrygian)).toBe('C');
    expect(keySignatureLabelFor(KEYS_BY_ID.F, SCALES.lydian)).toBe('C');
  });

  test('pentatonic falls back to key name', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.Ab, SCALES.hirajoshi)).toBe('Ab');
  });

  test('blues uses the parallel natural minor label', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.A, SCALES.blues)).toBe('Aminor');
    expect(keySignatureLabelFor(KEYS_BY_ID.C, SCALES.blues)).toBe('Cminor');
  });

  test('weird sharp keys (G♯, A♯, D♯) return null in major (8+ sharps not representable)', () => {
    expect(keySignatureLabelFor(KEYS_BY_ID.Gs, SCALES.major)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.As, SCALES.major)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Ds, SCALES.major)).toBeNull();
  });

  test('D♭ and G♭ minor return null (8/9 flats not representable)', () => {
    // Their relative majors are F♭ (-8) and B♭♭ (-9), beyond AlphaTab's
    // ±7 range. C♯ minor / F♯ minor are enharmonic alternatives.
    expect(keySignatureLabelFor(KEYS_BY_ID.Db, SCALES.naturalMinor)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Db, SCALES.harmonicMinor)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Db, SCALES.melodicMinor)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Gb, SCALES.naturalMinor)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Gb, SCALES.harmonicMinor)).toBeNull();
    expect(keySignatureLabelFor(KEYS_BY_ID.Gb, SCALES.melodicMinor)).toBeNull();
  });

  test('weird sharp keys in minor still work (relative major fits)', () => {
    // G♯ minor = relative major B (5 sharps) — fine.
    expect(keySignatureLabelFor(KEYS_BY_ID.Gs, SCALES.naturalMinor)).toBe(
      'G#minor',
    );
  });

  test('isEnharmonicallyRedundant flags Locrian (and similar modes) where the parent spelling disagrees with the root', () => {
    // G♭ Locrian: parent is G major (1 sharp). User picked the flat
    // spelling; the sharp-spelled enharmonic F♯ Locrian renders
    // cleaner — flag as redundant so the picker skips it.
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.Gb, SCALES.locrian)).toBe(true);
    // F♯ Locrian: parent G major (1 sharp). Spelling matches — keep.
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.Fs, SCALES.locrian)).toBe(
      false,
    );
    // D♭ Locrian: parent D major (2 sharps). Flag.
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.Db, SCALES.locrian)).toBe(true);
    // C♯ Locrian: parent D major (2 sharps). Spelling matches — keep.
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.Cs, SCALES.locrian)).toBe(
      false,
    );
    // C Locrian: parent D♭ major (-5 flats). Spelling matches (C is
    // natural, parent is flat — both ≤0 so consistent). Keep.
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.C, SCALES.locrian)).toBe(false);
    // Non-modes scales: never flagged here (other categories have
    // their own handling).
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.Gb, SCALES.major)).toBe(false);
    expect(isEnharmonicallyRedundant(KEYS_BY_ID.C, SCALES.chromatic)).toBe(
      false,
    );
  });

  test('modes-of-minor whose flat parent needs >7 flats fall back to the sharp enharmonic', () => {
    // G♯ Phrygian Dominant: mathematical parent is D♭ harmonic minor
    // (needs 8 flats — AlphaTab rejects). Must use C♯ minor (4 sharps)
    // instead. Previously emitted "\ks Dbminor", which broke AlphaTex
    // parsing entirely (AT219).
    expect(
      keySignatureLabelFor(KEYS_BY_ID.Gs, SCALES.phrygianDominant),
    ).toBe('C#minor');
  });

  test('label sign matches the value sign for non-redundant modes', () => {
    // Sweep every key × every modes scale and assert that whenever a
    // label is emitted for a non-enharmonically-redundant combo, the
    // label's implied keysig matches the sign convention of the
    // user's chosen root spelling. Enharmonically-redundant combos
    // (filtered by the picker) are exempt — their label is whatever
    // the parent happens to be, but they never reach the user.
    const modeScales = [
      SCALES.dorian,
      SCALES.phrygian,
      SCALES.lydian,
      SCALES.mixolydian,
      SCALES.locrian,
    ];
    for (const key of KEYS) {
      for (const scale of modeScales) {
        if (isEnharmonicallyRedundant(key, scale)) continue;
        const label = keySignatureLabelFor(key, scale);
        if (label === null) continue;
        const ks = keySignatureFor(key, scale);
        if (key.spelling === 'flat') expect(ks).toBeLessThanOrEqual(0);
        if (key.spelling === 'sharp') expect(ks).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('spellingMap', () => {
  test('C major: all naturals', () => {
    const m = spellingMap(KEYS_BY_ID.C, SCALES.major);
    expect(m.get(0)).toBe('natural');
    expect(m.get(2)).toBe('natural');
    expect(m.get(4)).toBe('natural');
    expect(m.get(7)).toBe('natural');
    expect(m.get(11)).toBe('natural');
  });

  test('G major: F is sharp (the leading tone in keysig)', () => {
    const m = spellingMap(KEYS_BY_ID.G, SCALES.major);
    expect(m.get(7)).toBe('natural'); // G
    expect(m.get(6)).toBe('sharp'); // F#
  });

  test('B♭ major: B is flat, E is flat', () => {
    const m = spellingMap(KEYS_BY_ID.Bb, SCALES.major);
    expect(m.get(10)).toBe('flat'); // Bb
    expect(m.get(3)).toBe('flat'); // Eb
  });

  test('C♯ melodic minor: raised 7th is B♯ (pc 0 → sharp)', () => {
    const m = spellingMap(KEYS_BY_ID.Cs, SCALES.melodicMinor);
    expect(m.get(1)).toBe('sharp'); // C#
    expect(m.get(3)).toBe('sharp'); // D#
    expect(m.get(4)).toBe('natural'); // E
    expect(m.get(6)).toBe('sharp'); // F#
    expect(m.get(8)).toBe('sharp'); // G#
    expect(m.get(10)).toBe('sharp'); // A#
    expect(m.get(0)).toBe('sharp'); // B# — the critical case
  });

  test('non-diatonic scales return empty map (no override)', () => {
    expect(spellingMap(KEYS_BY_ID.C, SCALES.majorPentatonic).size).toBe(0);
    expect(spellingMap(KEYS_BY_ID.Bb, SCALES.blues).size).toBe(0);
    expect(spellingMap(KEYS_BY_ID.C, SCALES.chromatic).size).toBe(0);
    expect(spellingMap(KEYS_BY_ID.C, SCALES.octatonicWholeHalf).size).toBe(0);
  });

  test('scales that would require double accidentals return empty (AlphaTab defaults)', () => {
    // D♭ Locrian ♮2 forces letter sequence D-E-F-G-A-B-C, which would
    // produce A♭♭ and B♭♭ — drop the override rather than render
    // double-flats.
    expect(spellingMap(KEYS_BY_ID.Db, SCALES.locrianNatural2).size).toBe(0);
  });
});
