import { writable, get, type Writable } from 'svelte/store';
import { TUNINGS, type TuningId } from '../theory/tunings';
import { SCALES, type ScaleId } from '../theory/scales';
import { KEYS } from '../theory/keys';
import type { HandPosition } from '../theory/fingerings';
import type { MetronomeBehavior } from '../audio/metronome';
export interface VariantToggles {
  plain: boolean;
  multiOctaveA_2: boolean;
  multiOctaveA_3: boolean; // only used by 5/6-string
  multiOctaveB_2: boolean; // only used by 5/6-string
  consecutive_3: boolean; // 1-2-3 groups
  consecutive_4: boolean; // 1-2-3-4 groups
  mirror_3: boolean; // 1-2-3-2-1
  mirror_4: boolean; // 1-2-3-4-3-2-1
  intervalWalks: boolean; // walking 2nds..octaves, both interval directions
}

export interface ArpeggioToggles {
  sizes: {
    triad: boolean;        // 3 notes
    seventh: boolean;      // 4 notes
    ninth: boolean;        // 5 notes
    eleventh: boolean;     // 6 notes
    thirteenth: boolean;   // 7 notes
  };
  directions: {
    allUp: boolean;
    upDown: boolean;
    downUp: boolean;
    zigzag: boolean;
  };
}

export interface AgilityToggles {
  bigX: boolean;
  spider: boolean;
}

export interface RhythmToggles {
  quarter: boolean;
  eighth: boolean;
  triplet: boolean;
  '8ss': boolean;
  's8s': boolean;
  'ss8': boolean;
}

export interface ArpeggioInversionToggles {
  root: boolean;
  first: boolean;
  second: boolean;
  third: boolean;
  fourth: boolean;
  fifth: boolean;
  sixth: boolean;
}

export interface MetronomeSettings {
  tempoMin: number;
  tempoMax: number;
  behavior: MetronomeBehavior;
  accentBeatOne: boolean;
  halvingPeriodMeasures: number;
  /** When set, the metronome auto-stops after this many minutes of
   * exercise play (the count-in does NOT count). null = play
   * indefinitely. */
  stopAfterMinutes: number | null;
}

export interface Settings {
  tuningId: TuningId;
  enabledScales: Record<ScaleId, boolean>;
  /**
   * Stable key ids from {@link KEYS} (e.g., "C", "Bb", "Fs"). Each id
   * specifies a pitch class AND a spelling, so "C♯ major" and "D♭ major"
   * are distinct exercises with different key signatures.
   */
  enabledKeys: string[];
  enabledHandPositions: HandPosition[];
  enabledVariants: VariantToggles;
  enabledArpeggios: ArpeggioToggles;
  enabledAgility: AgilityToggles;
  enabledRhythms: RhythmToggles;
  enabledArpeggioInversions: ArpeggioInversionToggles;
  includeOpenStringVariants: boolean;
  /** Independent toggles for each of the three display views. */
  displayToggles: {
    notation: boolean;
    tab: boolean;
    fretboard: boolean;
  };
  /**
   * When true, exercises whose notes sit mostly above A3 (the top
   * line of bass clef) render in treble clef instead. Auto-detects
   * per exercise — high-register pieces switch to treble, then the
   * next low-register exercise switches back to bass. Off by default;
   * many bassists prefer staying in bass clef regardless.
   */
  autoTrebleClef: boolean;
  /**
   * When true, AlphaTab renders the fretting-hand finger (1=index,
   * 2=middle, 3=ring, 4=pinky) above each note. Off by default — the
   * fingering is also implied by the fretboard diagram and most
   * players don't need explicit numbers.
   */
  showFingerNumbers: boolean;
  metronome: MetronomeSettings;
  recentExclusionCount: number;
}

const STORAGE_KEY = 'bass-practice:settings:v8';

export function defaultSettings(): Settings {
  const enabledScales = Object.keys(SCALES).reduce(
    (acc, id) => {
      acc[id as ScaleId] = true;
      return acc;
    },
    {} as Record<ScaleId, boolean>,
  );

  return {
    tuningId: 'fourStringEADG',
    enabledScales,
    // All 17 spellings enabled by default (12 sharp/natural + 5 flats)
    enabledKeys: KEYS.map((k) => k.id),
    enabledHandPositions: ['front', 'mid', 'back'],
    enabledVariants: {
      plain: true,
      multiOctaveA_2: true,
      multiOctaveA_3: false,
      multiOctaveB_2: false,
      consecutive_3: true,
      consecutive_4: true,
      mirror_3: true,
      mirror_4: false,
      intervalWalks: true,
    },
    enabledArpeggios: {
      sizes: {
        triad: true,
        seventh: true,
        ninth: true,
        eleventh: true,
        thirteenth: true,
      },
      directions: {
        allUp: true,
        upDown: true,
        downUp: true,
        zigzag: true,
      },
    },
    enabledAgility: {
      bigX: true,
      spider: true,
    },
    enabledRhythms: {
      quarter: true,
      eighth: false,
      triplet: false,
      '8ss': false,
      's8s': false,
      'ss8': false,
    },
    enabledArpeggioInversions: {
      root: true,
      first: false,
      second: false,
      third: false,
      fourth: false,
      fifth: false,
      sixth: false,
    },
    includeOpenStringVariants: true,
    displayToggles: {
      notation: true,
      tab: true,
      fretboard: true,
    },
    showFingerNumbers: false,
    autoTrebleClef: false,
    metronome: {
      tempoMin: 60,
      tempoMax: 140,
      behavior: 'normal',
      accentBeatOne: false,
      halvingPeriodMeasures: 4,
      stopAfterMinutes: 2,
    },
    recentExclusionCount: 20,
  };
}

function loadSettings(): Settings {
  const defaults = defaultSettings();
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Merge so newly added settings get their defaults
    return {
      ...defaults,
      ...parsed,
      enabledScales: { ...defaults.enabledScales, ...parsed.enabledScales },
      enabledVariants: {
        ...defaults.enabledVariants,
        ...parsed.enabledVariants,
      },
      enabledArpeggios: {
        sizes: {
          ...defaults.enabledArpeggios.sizes,
          ...parsed.enabledArpeggios?.sizes,
        },
        directions: {
          ...defaults.enabledArpeggios.directions,
          ...parsed.enabledArpeggios?.directions,
        },
      },
      enabledAgility: {
        ...defaults.enabledAgility,
        ...parsed.enabledAgility,
      },
      enabledRhythms: {
        ...defaults.enabledRhythms,
        ...parsed.enabledRhythms,
      },
      enabledArpeggioInversions: {
        ...defaults.enabledArpeggioInversions,
        ...parsed.enabledArpeggioInversions,
      },
      displayToggles: {
        ...defaults.displayToggles,
        ...parsed.displayToggles,
      },
      metronome: { ...defaults.metronome, ...parsed.metronome },
    };
  } catch {
    return defaults;
  }
}

function persist(s: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage full or disabled — ignore
  }
}

function createSettingsStore(): Writable<Settings> {
  const store = writable<Settings>(loadSettings());
  store.subscribe(persist);
  return store;
}

export const settings = createSettingsStore();

export function getSettings(): Settings {
  return get(settings);
}

export function tuningOf(s: Settings) {
  return TUNINGS[s.tuningId];
}
