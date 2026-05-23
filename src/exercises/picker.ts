import { SCALES, type ScaleId, type Scale } from '../theory/scales';
import { TUNINGS, midiToPositions, type Tuning } from '../theory/tunings';
import type { HandPosition } from '../theory/fingerings';
import type { PitchClass } from '../theory/notes';
import {
  KEYS_BY_ID,
  keySignatureFor,
  keySignatureLabelFor,
  spellingMap,
  isEnharmonicallyRedundant,
} from '../theory/keys';
import type { ExerciseParams, Variant, Rhythm } from './types';
import {
  pickStartingPosition,
  pickStartingPositionForWalkingPairs,
  pickStartingPositionForWalking,
  hasOpenStringVariant,
  isLargeWalkingInterval,
  lowestDegreeOffsetSemitones,
  startConstraintsForVariant,
  isHandPositionMeaningful,
  canonicalHandPositionForVariant,
  arpeggioCycleApex,
} from './scale-generator';
import type { Settings, RhythmToggles } from '../stores/settings';
import { agilitySpellingMap } from './agility';

const MAX_FRET = 24;

/**
 * Stable identifier used by the history store to avoid re-picking the same
 * exercise too quickly. Includes the spelled key name so "B♭ major" and
 * "A♯ major" are tracked as separate exercises.
 */
/**
 * Inverse of {@link paramsKey}. Returns null if the key string is
 * malformed or references an unknown scale / key / tuning. Used to
 * restore an exercise from a URL hash.
 */
export function paramsFromKey(key: string): ExerciseParams | null {
  const parts = key.split('|');
  if (parts.length !== 6 && parts.length !== 7) return null;
  const tuningId = parts[0];
  const scaleName = parts[1];
  const rootName = parts[2];
  const handPosition = parts[3];
  const variantKey = parts[4];
  const rhythmStr = parts.length === 7 ? parts[5] : 'eighth';
  const openTag = parts[parts.length - 1];
  const tuning = TUNINGS[tuningId as keyof typeof TUNINGS];
  if (!tuning) return null;
  const scaleEntry = Object.values(SCALES).find((s) => s.name === scaleName);
  if (!scaleEntry) return null;
  const keyEntry = Object.values(KEYS_BY_ID).find((k) => k.name === rootName);
  if (!keyEntry) return null;
  if (
    handPosition !== 'front' &&
    handPosition !== 'mid' &&
    handPosition !== 'back'
  ) {
    return null;
  }
  if (
    rhythmStr !== 'quarter' &&
    rhythmStr !== 'eighth' &&
    rhythmStr !== 'triplet' &&
    rhythmStr !== '8ss' &&
    rhythmStr !== 's8s' &&
    rhythmStr !== 'ss8'
  ) {
    return null;
  }
  const rhythm: Rhythm = rhythmStr;
  let variant: Variant;
  if (variantKey === 'plain') {
    variant = { kind: 'plain' };
  } else {
    const colon = variantKey.indexOf(':');
    if (colon < 0) return null;
    const kind = variantKey.slice(0, colon);
    const rest = variantKey.slice(colon + 1);
    if (kind === 'multiOctaveA' || kind === 'multiOctaveB') {
      const octaves = Number(rest);
      if (!Number.isFinite(octaves)) return null;
      variant = { kind, octaves };
    } else if (kind === 'consecutive') {
      const groupSize = Number(rest);
      if (!Number.isFinite(groupSize)) return null;
      variant = { kind, groupSize };
    } else if (kind === 'mirror') {
      const peakSize = Number(rest);
      if (!Number.isFinite(peakSize)) return null;
      variant = { kind, peakSize };
    } else if (kind === 'walk') {
      const intervalDir = rest.startsWith('+')
        ? 'up'
        : rest.startsWith('-')
          ? 'down'
          : null;
      if (intervalDir === null) return null;
      const interval = Number(rest.slice(1));
      if (!Number.isFinite(interval)) return null;
      variant = { kind: 'intervalWalk', interval, intervalDir };
    } else if (kind === 'arpeggio') {
      // rest format: "<size>:<direction>" (legacy) or "<size>:<direction>:<inversion>"
      const parts = rest.split(':');
      if (parts.length !== 2 && parts.length !== 3) return null;
      const [sizeStr, dirStr, invStr] = parts;
      const size = Number(sizeStr);
      if (![3, 4, 5, 6, 7].includes(size)) return null;
      if (
        dirStr !== 'allUp' &&
        dirStr !== 'upDown' &&
        dirStr !== 'downUp' &&
        dirStr !== 'zigzag'
      ) {
        return null;
      }
      let inversion = 0;
      if (parts.length === 3) {
        inversion = Number(invStr);
        if (!Number.isInteger(inversion) || inversion < 0 || inversion > 6) return null;
        if (inversion >= size) return null;  // invalid combo
      }
      variant = {
        kind: 'arpeggioCycle',
        size: size as 3 | 4 | 5 | 6 | 7,
        direction: dirStr as 'allUp' | 'upDown' | 'downUp' | 'zigzag',
        inversion,
      };
    } else if (kind === 'agility') {
      // rest format: "<subkind>:<index>:<dir>:<spelling>"
      // e.g., "bigX:0:fwd:sharp" or "spider:2:rev:flat"
      const parts = rest.split(':');
      if (parts.length !== 4) return null;
      const [subkind, indexStr, dirStr, spellingStr] = parts;
      const index = Number(indexStr);
      if (!Number.isFinite(index)) return null;
      const direction = dirStr === 'fwd' ? 'forward' : dirStr === 'rev' ? 'reverse' : null;
      if (direction === null) return null;
      if (spellingStr !== 'sharp' && spellingStr !== 'flat') return null;
      if (subkind === 'bigX') {
        variant = {
          kind: 'bigX',
          startString: index,
          direction,
          spelling: spellingStr,
        };
      } else if (subkind === 'spider') {
        variant = {
          kind: 'spider',
          lowerString: index,
          direction,
          spelling: spellingStr,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  const useOpenStrings = openTag === 'open';
  const keySignature = keySignatureFor(keyEntry, scaleEntry);
  const keySignatureLabel = keySignatureLabelFor(keyEntry, scaleEntry);
  if (
    keySignatureLabel === null &&
    scaleEntry.category !== 'chromatic' &&
    scaleEntry.category !== 'octatonic'
  ) {
    return null;
  }
  // Reject URLs that resolve to an enharmonically-redundant combo —
  // they shouldn't be reachable through the picker either, and a
  // shared/bookmarked link to a redundant spelling should fall back
  // to picking a fresh exercise instead of loading a broken one.
  if (isEnharmonicallyRedundant(keyEntry, scaleEntry)) return null;
  return {
    scale: scaleEntry,
    rootPc: keyEntry.pc,
    rootName: keyEntry.name,
    variant,
    scaleDirection: 'updown',
    handPosition,
    tuning,
    useOpenStrings,
    keySignature,
    keySignatureLabel,
    spelling: spellingMap(keyEntry, scaleEntry),
    rhythm,
  };
}

export function paramsKey(p: ExerciseParams): string {
  let variantKey: string;
  switch (p.variant.kind) {
    case 'plain':
      variantKey = 'plain';
      break;
    case 'multiOctaveA':
    case 'multiOctaveB':
      variantKey = `${p.variant.kind}:${p.variant.octaves}`;
      break;
    case 'consecutive':
      variantKey = `consecutive:${p.variant.groupSize}`;
      break;
    case 'mirror':
      variantKey = `mirror:${p.variant.peakSize}`;
      break;
    case 'intervalWalk':
      variantKey = `walk:${p.variant.intervalDir === 'up' ? '+' : '-'}${p.variant.interval}`;
      break;
    case 'arpeggioCycle':
      variantKey = `arpeggio:${p.variant.size}:${p.variant.direction}:${p.variant.inversion}`;
      break;
    case 'bigX':
      variantKey = `agility:bigX:${p.variant.startString}:${
        p.variant.direction === 'forward' ? 'fwd' : 'rev'
      }:${p.variant.spelling}`;
      break;
    case 'spider':
      variantKey = `agility:spider:${p.variant.lowerString}:${
        p.variant.direction === 'forward' ? 'fwd' : 'rev'
      }:${p.variant.spelling}`;
      break;
  }
  return [
    p.tuning.id,
    p.scale.name,
    p.rootName ?? String(p.rootPc),
    p.handPosition,
    variantKey,
    p.rhythm ?? 'eighth',
    p.useOpenStrings ? 'open' : 'fretted',
  ].join('|');
}


function highestMidi(
  scale: Scale,
  lowRootMidi: number,
  variant: Variant,
): number {
  switch (variant.kind) {
    case 'plain':
      return lowRootMidi + 12;
    case 'multiOctaveA':
    case 'multiOctaveB':
      return lowRootMidi + variant.octaves * 12;
    case 'consecutive':
    case 'mirror':
      // Stays within one octave plus the octave note itself.
      return lowRootMidi + 12;
    case 'intervalWalk': {
      // Walking exercises reach degree `len + interval`:
      // - walking-up: boundary insertion plays [scaleDeg(len), scaleDeg(len + interval)].
      // - walking-down: desc half plays scaleDeg(len + interval) as the
      //   upper note of pair d=len (interval direction reverses).
      // Either way, the bass's top fret must accommodate it.
      const len = scale.intervals.length;
      const lastDegree = len + variant.interval;
      const octaveOffset = Math.floor(lastDegree / len) * 12;
      const idx = ((lastDegree % len) + len) % len;
      return lowRootMidi + octaveOffset + scale.intervals[idx];
    }
    case 'arpeggioCycle':
      return arpeggioCycleApex(scale, lowRootMidi, variant.size, variant.inversion);
    default:
      return lowRootMidi + 12;
  }
}

function fitsWithinMaxFret(midi: number, tuning: Tuning): boolean {
  return midiToPositions(tuning, midi, { maxFret: MAX_FRET }).length > 0;
}

function variantsFromSettings(s: Settings, stringCount: number): Variant[] {
  const variants: Variant[] = [];
  if (s.enabledVariants.plain) variants.push({ kind: 'plain' });
  if (s.enabledVariants.multiOctaveA_2)
    variants.push({ kind: 'multiOctaveA', octaves: 2 });
  if (stringCount >= 5 && s.enabledVariants.multiOctaveA_3)
    variants.push({ kind: 'multiOctaveA', octaves: 3 });
  if (stringCount >= 5 && s.enabledVariants.multiOctaveB_2)
    variants.push({ kind: 'multiOctaveB', octaves: 2 });
  if (s.enabledVariants.consecutive_3)
    variants.push({ kind: 'consecutive', groupSize: 3 });
  if (s.enabledVariants.consecutive_4)
    variants.push({ kind: 'consecutive', groupSize: 4 });
  if (s.enabledVariants.mirror_3)
    variants.push({ kind: 'mirror', peakSize: 3 });
  if (s.enabledVariants.mirror_4)
    variants.push({ kind: 'mirror', peakSize: 4 });
  if (s.enabledVariants.intervalWalks) {
    for (let interval = 1; interval <= 7; interval++) {
      variants.push({ kind: 'intervalWalk', interval, intervalDir: 'up' });
      variants.push({ kind: 'intervalWalk', interval, intervalDir: 'down' });
    }
  }
  const SIZE_KEYS = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
  const SIZE_VALUES: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
  const DIRECTIONS: Array<'allUp' | 'upDown' | 'downUp' | 'zigzag'> = [
    'allUp',
    'upDown',
    'downUp',
    'zigzag',
  ];
  const INV_KEYS = ['root', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
  const INV_VALUES = [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < SIZE_KEYS.length; i++) {
    if (!s.enabledArpeggios.sizes[SIZE_KEYS[i]]) continue;
    const size = SIZE_VALUES[i];
    for (const direction of DIRECTIONS) {
      if (!s.enabledArpeggios.directions[direction]) continue;
      if (direction === 'allUp') {
        // Iterate enabled inversions; skip those exceeding size-1.
        for (let k = 0; k < INV_KEYS.length; k++) {
          if (!s.enabledArpeggioInversions[INV_KEYS[k]]) continue;
          const inv = INV_VALUES[k];
          if (inv >= size) continue;  // 3rd inv of triad is invalid, etc.
          variants.push({ kind: 'arpeggioCycle', size, direction, inversion: inv });
        }
      } else {
        // Non-allUp: always inversion 0, ignore inversion toggles.
        variants.push({ kind: 'arpeggioCycle', size, direction, inversion: 0 });
      }
    }
  }
  const AGILITY_DIRECTIONS: Array<'forward' | 'reverse'> = ['forward', 'reverse'];
  const AGILITY_SPELLINGS: Array<'sharp' | 'flat'> = ['sharp', 'flat'];
  if (s.enabledAgility.bigX) {
    // 4 adjacent strings × 2 directions × 2 spellings per valid startString.
    for (let startString = 0; startString + 3 < stringCount; startString++) {
      for (const direction of AGILITY_DIRECTIONS) {
        for (const spelling of AGILITY_SPELLINGS) {
          variants.push({ kind: 'bigX', startString, direction, spelling });
        }
      }
    }
  }
  if (s.enabledAgility.spider) {
    for (let lowerString = 0; lowerString < stringCount - 1; lowerString++) {
      for (const direction of AGILITY_DIRECTIONS) {
        for (const spelling of AGILITY_SPELLINGS) {
          variants.push({ kind: 'spider', lowerString, direction, spelling });
        }
      }
    }
  }
  return variants;
}

function enabledRhythmsList(t: RhythmToggles): Rhythm[] {
  const out: Rhythm[] = [];
  if (t.quarter) out.push('quarter');
  if (t.eighth) out.push('eighth');
  if (t.triplet) out.push('triplet');
  if (t['8ss']) out.push('8ss');
  if (t['s8s']) out.push('s8s');
  if (t['ss8']) out.push('ss8');
  return out;
}

/**
 * Build the full set of valid exercise parameter tuples for the current
 * settings. Invalid combos (e.g., a hand position with no playable starting
 * fret for the root) are filtered out.
 */
export function generateUniverse(s: Settings): ExerciseParams[] {
  const tuning = TUNINGS[s.tuningId];
  const variants = variantsFromSettings(s, tuning.stringCount);
  if (variants.length === 0) return [];

  const rhythms = enabledRhythmsList(s.enabledRhythms);

  // Agility variants don't depend on key/scale/handPosition — short-circuit
  // before the keys × scales × handPositions iteration.
  const agilityVariants = variants.filter(
    (v) => v.kind === 'bigX' || v.kind === 'spider',
  );
  const nonAgilityVariants = variants.filter(
    (v) => v.kind !== 'bigX' && v.kind !== 'spider',
  );

  const result: ExerciseParams[] = [];

  for (const variant of agilityVariants) {
    // Agility exercises always use eighth notes regardless of enabledRhythms.
    result.push({
      scale: SCALES.chromatic,
      rootPc: 0,
      rootName: 'C',
      variant,
      scaleDirection: 'updown',
      handPosition: 'front',
      tuning,
      useOpenStrings: false,
      keySignature: 0,
      keySignatureLabel: 'C',
      spelling: agilitySpellingMap(variant.spelling),
      rhythm: 'eighth',
    });
  }

  const enabledScaleIds = (Object.keys(SCALES) as ScaleId[]).filter(
    (id) => s.enabledScales[id],
  );

  for (const scaleId of enabledScaleIds) {
    const scale = SCALES[scaleId];
    for (const keyId of s.enabledKeys) {
      const key = KEYS_BY_ID[keyId];
      if (!key) continue;
      const rootPc = key.pc;
      const rootName = key.name;
      const keySignature = keySignatureFor(key, scale);
      const keySignatureLabel = keySignatureLabelFor(key, scale);
      const spelling = spellingMap(key, scale);
      // Skip combinations with no representable spelling. For example,
      // D♯ major would need 9 sharps — bassists use E♭ major instead.
      // chromatic/octatonic intentionally have no key signature and
      // are kept.
      if (
        keySignatureLabel === null &&
        scale.category !== 'chromatic' &&
        scale.category !== 'octatonic'
      ) {
        continue;
      }
      // Skip combos where another enharmonic spelling renders cleaner
      // (e.g., G♭ Locrian → use F♯ Locrian instead). Without this, the
      // picker would surface both, with one of them showing a
      // misleading sharp/flat key signature relative to the user's
      // chosen root spelling.
      if (isEnharmonicallyRedundant(key, scale)) continue;
      // Build the (variant, handPosition) iteration plan. For walking
      // variants whose pair span exceeds the hand window (5ths and
      // wider), hand position is dictated by interval direction, not
      // user choice — emit ONE canonical entry regardless of which
      // hand positions the user has enabled. For every other variant,
      // iterate over the enabled hand positions normally.
      const plan: Array<{ variant: Variant; hp: HandPosition }> = [];
      for (const variant of nonAgilityVariants) {
        if (variant.kind === 'intervalWalk') {
          const maxInterval =
            scale.intervals.length === 5 ? 3 : scale.intervals.length;
          if (variant.interval > maxInterval) continue;
        }
        if (variant.kind === 'arpeggioCycle' && scale.intervals.length !== 7) {
          continue;
        }
        if (!isHandPositionMeaningful(scale, variant)) {
          plan.push({ variant, hp: canonicalHandPositionForVariant(variant) });
        } else {
          for (const hp of s.enabledHandPositions) {
            plan.push({ variant, hp });
          }
        }
      }

      for (const { variant, hp } of plan) {
        const constraints = startConstraintsForVariant(scale, variant, tuning);
        const lowestOffset = lowestDegreeOffsetSemitones(scale, variant);

        // Walking 7ths and octaves use a different layout (2 strings
        // apart per pair) — validate via the walking-pair-specific
        // picker so we don't surface combinations whose apex doesn't
        // fit within fret 24. Walking 2nds–6ths use the first-pair-fit
        // picker so the validated start matches what the generator
        // will produce.
        let startPos: ReturnType<typeof pickStartingPosition>;
        if (isLargeWalkingInterval(variant)) {
          const info = pickStartingPositionForWalkingPairs(
            rootPc,
            hp,
            tuning,
            scale,
            variant,
          );
          startPos = info ? info.pos : null;
        } else if (variant.kind === 'intervalWalk') {
          startPos = pickStartingPositionForWalking(
            rootPc,
            hp,
            tuning,
            scale,
            variant,
            constraints,
          );
        } else {
          startPos = pickStartingPosition(rootPc, hp, tuning, {
            minMidi: constraints.minMidi,
            minStringIndex: constraints.minStringIndex,
            maxStringIndex: constraints.maxStringIndex,
          });
        }
        if (!startPos) continue;

        const lowRootMidi =
          tuning.openMidi[startPos.string] + startPos.fret;
        const apex = highestMidi(scale, lowRootMidi, variant);
        if (fitsWithinMaxFret(apex, tuning)) {
          const entry = {
            scale,
            rootPc,
            rootName,
            keySignature,
            keySignatureLabel,
            spelling,
            variant,
            scaleDirection: 'updown' as const,
            handPosition: hp,
            tuning,
            useOpenStrings: false,
          };
          for (const rhythm of rhythms) {
            result.push({ ...entry, rhythm });
          }
        }
        if (
          s.includeOpenStringVariants &&
          variant.kind !== 'arpeggioCycle' &&
          hasOpenStringVariant(rootPc, hp, tuning) &&
          lowestOffset >= 0
        ) {
          const openStart = pickStartingPosition(rootPc, hp, tuning, {
            preferOpenStringRoot: true,
          });
          if (openStart) {
            const openLowRootMidi =
              tuning.openMidi[openStart.string] + openStart.fret;
            const openApex = highestMidi(scale, openLowRootMidi, variant);
            if (fitsWithinMaxFret(openApex, tuning)) {
              const openEntry = {
                scale,
                rootPc,
                rootName,
                keySignature,
                keySignatureLabel,
                spelling,
                variant,
                scaleDirection: 'updown' as const,
                handPosition: hp,
                tuning,
                useOpenStrings: true,
              };
              for (const rhythm of rhythms) {
                result.push({ ...openEntry, rhythm });
              }
            }
          }
        }
      }
    }
  }
  return result;
}

// Outdated nesting depth note: the variant-level loop used to be inside the
// hand-position loop's startPos check. Restructuring moved variant pickup
// before startPos so that startPos can depend on the variant.

/**
 * Pick uniformly at random from the universe, excluding any items whose
 * paramsKey is in `recentlyUsed`. If every item is excluded, fall back to
 * the full universe.
 */
export function pickWeightedRandom(
  universe: ExerciseParams[],
  recentlyUsed: Set<string>,
): ExerciseParams | null {
  if (universe.length === 0) return null;
  const available = universe.filter((p) => !recentlyUsed.has(paramsKey(p)));
  const pool = available.length > 0 ? available : universe;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick a random tempo within the user's configured range, rounded to the
 * nearest integer BPM.
 */
export function randomTempo(min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  return Math.round(min + Math.random() * (max - min));
}

