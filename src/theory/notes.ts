export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type AccidentalPreference = 'sharp' | 'flat';

const LETTER_PITCH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function pitchClass(name: string): PitchClass {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('empty note name');
  const letter = trimmed[0].toUpperCase();
  if (!(letter in LETTER_PITCH)) {
    throw new Error(`invalid note letter: ${letter}`);
  }
  let pc = LETTER_PITCH[letter];
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '#' || ch === '♯') pc += 1;
    else if (ch === 'b' || ch === '♭') pc -= 1;
    else throw new Error(`invalid accidental: ${ch}`);
  }
  return mod12(pc) as PitchClass;
}

export function addSemitones(pc: PitchClass, semitones: number): PitchClass {
  return mod12(pc + semitones) as PitchClass;
}

export function pitchClassName(
  pc: PitchClass,
  prefer: AccidentalPreference = 'sharp',
): string {
  return prefer === 'flat' ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

export function midiPitchClass(midi: number): PitchClass {
  return mod12(midi) as PitchClass;
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiOf(noteName: string, octave: number): number {
  const pc = pitchClass(noteName);
  return (octave + 1) * 12 + pc;
}
