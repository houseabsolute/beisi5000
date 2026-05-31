import { writable, type Writable } from 'svelte/store';
import type { ExerciseParams, Variant, Rhythm } from '../exercises/types';
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

/**
 * Sub-counter key inside a cell's perVariantId map. Cells are already
 * bucketed by family, so the variantId doesn't repeat family info
 * (except for agility, where the two distinct exercise kinds share
 * the family and need to be told apart).
 */
export function variantIdFor(v: Variant): string {
  switch (v.kind) {
    case 'plain': return 'plain';
    case 'multiOctaveA': return `A:${v.octaves}`;
    case 'multiOctaveB': return `B:${v.octaves}`;
    case 'consecutive': return String(v.groupSize);
    case 'mirror': return String(v.peakSize);
    case 'intervalWalk': return String(v.interval);
    case 'arpeggioCycle': return `${v.size}:${v.direction}:${v.inversion}`;
    case 'bigX': return `bigX:${v.direction}:${v.spelling}`;
    case 'spider': return `spider:${v.direction}:${v.spelling}`;
  }
}

export interface CellStats {
  count: number;
  firstPlayedTs: number;
  lastPlayedTs: number;
  perHand: { front?: number; mid?: number; back?: number };
  perRhythm: Partial<Record<Rhythm, number>>;
  perVariantId: Record<string, number>;
}

export interface PracticeEvent {
  ts: number;
  cellKey: string;
  paramsKey: string;
}

export interface PracticeLogState {
  cells: Record<string, CellStats>;
  recentEvents: PracticeEvent[];
}

const STORAGE_KEY = 'bass-practice:practice-log:v1';
export const RECENT_CAP = 100;

function emptyState(): PracticeLogState {
  return { cells: {}, recentEvents: [] };
}

function load(): PracticeLogState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PracticeLogState>;
    return {
      cells: parsed.cells ?? {},
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
    };
  } catch {
    return emptyState();
  }
}

function persist(state: PracticeLogState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / disabled — ignore
  }
}

function createPracticeLogStore(): Writable<PracticeLogState> & {
  clear: () => void;
} {
  const store = writable<PracticeLogState>(load());
  store.subscribe(persist);
  return {
    ...store,
    clear() {
      store.set(emptyState());
    },
  };
}

export const practiceLog = createPracticeLogStore();
