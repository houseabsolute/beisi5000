import type { ExerciseParams, Variant } from '../exercises/types';
import { pitchClassName } from '../theory/notes';
import { SCALES } from '../theory/scales';
import type { ScaleId } from '../theory/scales';

export type Family =
  | 'plain'
  | 'multiOctave'
  | 'consecutive'
  | 'mirror'
  | 'walkUp'
  | 'walkDown'
  | 'arpeggios'
  | 'agility';

/**
 * Mirror BrowsePanel's `matchVariantFamily` taxonomy: this is the
 * coverage unit. Hand position, rhythm, exact arpeggio inversion, etc.
 * are all dimensions WITHIN a family, captured in CellStats.perHand /
 * perRhythm / perVariantId rather than splitting the cell.
 */
export function familyForVariant(v: Variant): Family {
  switch (v.kind) {
    case 'plain': return 'plain';
    case 'multiOctaveA':
    case 'multiOctaveB':
      return 'multiOctave';
    case 'consecutive': return 'consecutive';
    case 'mirror': return 'mirror';
    case 'intervalWalk':
      return v.intervalDir === 'up' ? 'walkUp' : 'walkDown';
    case 'arpeggioCycle': return 'arpeggios';
    case 'bigX':
    case 'spider':
      return 'agility';
  }
}

function scaleIdFor(scaleName: string): ScaleId | '' {
  for (const [id, s] of Object.entries(SCALES)) {
    if (s.name === scaleName) return id as ScaleId;
  }
  return '';
}

/**
 * Cell key: `tuningId|scaleId|keyId|family`. Agility uses empty
 * scaleId/keyId since chromatic exercises aren't keyed.
 */
export function cellKeyFor(p: ExerciseParams): string {
  const family = familyForVariant(p.variant);
  if (family === 'agility') {
    return `${p.tuning.id}|||agility`;
  }
  const scaleId = scaleIdFor(p.scale.name);
  const keyId = p.rootName ?? pitchClassName(p.rootPc, 'sharp');
  return `${p.tuning.id}|${scaleId}|${keyId}|${family}`;
}
