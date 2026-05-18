// Trace a single exercise — print every note's MIDI and fretboard
// position. Use when the user reports a specific exercise looks wrong.
//
// Usage:
//   npx tsx scripts/trace-exercise.ts <keyId> <scaleId> <variantSpec> <handPosition> [tuningId]
//
// Examples:
//   npx tsx scripts/trace-exercise.ts Bb major walk+2 front
//   npx tsx scripts/trace-exercise.ts As naturalMinor walk-3 mid
//   npx tsx scripts/trace-exercise.ts C inSen walk-2 mid fourStringEADG
//   npx tsx scripts/trace-exercise.ts G major moA2 front
//   npx tsx scripts/trace-exercise.ts C major plain back
//
// variantSpec grammar:
//   plain                       → plain 1-octave scale
//   walk<+|->N                  → walking N-th interval (e.g. walk+2, walk-3)
//   moA<N> | moB<N>             → multi-octave A or B, N octaves
//   cons<N>                     → consecutive groups of N (1-2-3 etc)
//   mirror<N>                   → mirror groups, peak size N
//   arp<size>-<direction>       → arpeggio cycle, e.g. arp3-allUp, arp7-zigzag

import { generateExercise } from '../src/exercises/scale-generator.ts';
import { SCALES, type ScaleId } from '../src/theory/scales.ts';
import { TUNINGS, type TuningId } from '../src/theory/tunings.ts';
import {
  KEYS_BY_ID,
  keySignatureFor,
  keySignatureLabelFor,
  spellingMap,
} from '../src/theory/keys.ts';
import type { Variant } from '../src/exercises/types.ts';
import type { HandPosition } from '../src/theory/fingerings.ts';

const [, , keyId, scaleId, variantSpec, handPosition, tuningArg] = process.argv;
if (!keyId || !scaleId || !variantSpec || !handPosition) {
  console.error(
    'usage: tsx scripts/trace-exercise.ts <keyId> <scaleId> <variantSpec> <handPosition> [tuningId]',
  );
  process.exit(2);
}

const key = KEYS_BY_ID[keyId];
if (!key) throw new Error(`Unknown key id: ${keyId}`);
const scale = SCALES[scaleId as ScaleId];
if (!scale) throw new Error(`Unknown scale id: ${scaleId}`);
const tuning = TUNINGS[(tuningArg ?? 'fourStringEADG') as TuningId];
if (!tuning) throw new Error(`Unknown tuning id: ${tuningArg}`);

const variant = parseVariant(variantSpec);
const ex = generateExercise({
  scale,
  rootPc: key.pc,
  rootName: key.name,
  variant,
  scaleDirection: 'updown',
  handPosition: handPosition as HandPosition,
  tuning,
  keySignature: keySignatureFor(key, scale),
  keySignatureLabel: keySignatureLabelFor(key, scale),
  spelling: spellingMap(key, scale),
});

const stringNames = tuning.openNoteNames;
console.log(ex.displayName);
console.log(`length=${ex.sequence.length}`);
for (let i = 0; i < ex.sequence.length; i++) {
  const n = ex.sequence[i];
  const fingerLabel = n.finger ? ` f${n.finger}` : '';
  console.log(
    `${String(i).padStart(2)}: midi=${n.midi}  ${stringNames[n.string]}${n.fret}${fingerLabel}`,
  );
}

function parseVariant(spec: string): Variant {
  if (spec === 'plain') return { kind: 'plain' };
  const walk = spec.match(/^walk([+-])(\d+)$/);
  if (walk) {
    return {
      kind: 'intervalWalk',
      interval: Number(walk[2]),
      intervalDir: walk[1] === '+' ? 'up' : 'down',
    };
  }
  const moA = spec.match(/^moA(\d+)$/);
  if (moA) return { kind: 'multiOctaveA', octaves: Number(moA[1]) };
  const moB = spec.match(/^moB(\d+)$/);
  if (moB) return { kind: 'multiOctaveB', octaves: Number(moB[1]) };
  const cons = spec.match(/^cons(\d+)$/);
  if (cons) return { kind: 'consecutive', groupSize: Number(cons[1]) };
  const mirror = spec.match(/^mirror(\d+)$/);
  if (mirror) return { kind: 'mirror', peakSize: Number(mirror[1]) };
  const arp = spec.match(/^arp(\d+)-(allUp|upDown|downUp|zigzag)$/);
  if (arp) {
    const size = Number(arp[1]);
    if (![3, 4, 5, 6, 7].includes(size)) {
      throw new Error(`Invalid arpeggio size: ${size} (must be 3-7)`);
    }
    return {
      kind: 'arpeggioCycle',
      size: size as 3 | 4 | 5 | 6 | 7,
      direction: arp[2] as 'allUp' | 'upDown' | 'downUp' | 'zigzag',
    };
  }
  throw new Error(`Unknown variant spec: ${spec}`);
}
