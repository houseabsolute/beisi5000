import { writable, get, type Writable } from 'svelte/store';
import type { ExerciseParams, Variant, Rhythm } from '../exercises/types';
import { pitchClassName } from '../theory/notes';
import { SCALES } from '../theory/scales';
import type { ScaleId } from '../theory/scales';
import { paramsKey } from '../exercises/picker';

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
  const scaleId = p.scaleId ?? scaleIdFor(p.scale.name);
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
const RECENT_CAP = 100;

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
  recordDone: (params: ExerciseParams) => void;
  todayCount: () => number;
  clear: () => void;
} {
  const store = writable<PracticeLogState>(load());
  store.subscribe(persist);
  return {
    ...store,
    recordDone(params: ExerciseParams) {
      const now = Date.now();
      const cellKey = cellKeyFor(params);
      const variantId = variantIdFor(params.variant);
      store.update((s) => {
        const prev = s.cells[cellKey];
        // Deep-clone nested sub-counters so mutations produce new references,
        // which is required for Svelte store subscribers to fire correctly.
        const baseCell: CellStats = prev
          ? { ...prev,
              perHand: { ...prev.perHand },
              perRhythm: { ...prev.perRhythm },
              perVariantId: { ...prev.perVariantId },
            }
          : { count: 0, firstPlayedTs: now, lastPlayedTs: now, perHand: {}, perRhythm: {}, perVariantId: {} };
        baseCell.count += 1;
        baseCell.lastPlayedTs = now;
        baseCell.perHand[params.handPosition] = (baseCell.perHand[params.handPosition] ?? 0) + 1;
        if (params.rhythm) {
          baseCell.perRhythm[params.rhythm] = (baseCell.perRhythm[params.rhythm] ?? 0) + 1;
        }
        baseCell.perVariantId[variantId] = (baseCell.perVariantId[variantId] ?? 0) + 1;
        const events: PracticeEvent[] = [
          { ts: now, cellKey, paramsKey: paramsKey(params) },
          ...s.recentEvents,
        ].slice(0, RECENT_CAP);
        return {
          cells: { ...s.cells, [cellKey]: baseCell },
          recentEvents: events,
        };
      });
    },
    todayCount() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const s = get(store);
      return s.recentEvents.filter((e) => e.ts >= startMs).length;
    },
    clear() {
      store.set(emptyState());
    },
  };
}

export const practiceLog = createPracticeLogStore();
