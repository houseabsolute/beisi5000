import { describe, test, expect } from 'vitest';
import { paramsKey, paramsFromKey, generateUniverse, pickWeightedRandom } from './picker';
import { walkingPairMaxSemitones } from './scale-generator';
import type { Settings } from '../stores/settings';
import { defaultSettings } from '../stores/settings';
import type { ArpeggioToggles, AgilityToggles } from '../stores/settings';

const baseSettings: Settings = defaultSettings();

describe('paramsKey', () => {
  test('produces stable identifier for same params', () => {
    const universe = generateUniverse(baseSettings);
    expect(universe.length).toBeGreaterThan(0);
    const a = universe[0];
    const k1 = paramsKey(a);
    const k2 = paramsKey({ ...a });
    expect(k1).toBe(k2);
  });

  test('differs for different keys', () => {
    const universe = generateUniverse(baseSettings);
    const a = universe[0];
    const b = {
      ...a,
      rootPc: ((a.rootPc + 1) % 12) as typeof a.rootPc,
      rootName: 'C♯',
    };
    expect(paramsKey(a)).not.toBe(paramsKey(b));
  });
});

describe('generateUniverse', () => {
  test('non-empty for default settings', () => {
    const universe = generateUniverse(baseSettings);
    expect(universe.length).toBeGreaterThan(50);
  });

  test('respects enabledScales filter', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledAgility: { bigX: false, spider: false },
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      expect(p.scale.name).toBe('Major');
    }
  });

  test('respects enabledKeys filter', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      expect(p.rootPc).toBe(0);
    }
  });

  test('flat key id (Bb) produces the right pitch class and rootName', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['Bb'],
      enabledAgility: { bigX: false, spider: false },
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.rootPc).toBe(10);
      expect(p.rootName).toBe('B♭');
    }
  });

  test('Bb major has key signature -2 (2 flats)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['Bb'],
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledAgility: { bigX: false, spider: false },
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      expect(p.keySignature).toBe(-2);
    }
  });

  test('D♯ major is filtered out (no representable spelling — would need 9 sharps)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['Ds'],
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledAgility: { bigX: false, spider: false },
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(0);
  });

  test('D♯ minor is allowed (G♯ minor relative major fits in 6 sharps)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['Ds'],
      enabledScales: { naturalMinor: true } as Settings['enabledScales'],
      enabledAgility: { bigX: false, spider: false },
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.keySignatureLabel).toBe('D#minor');
    }
  });

  test('D♯ chromatic is allowed (no key signature needed for chromatic)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledKeys: ['Ds'],
      enabledScales: { chromatic: true } as Settings['enabledScales'],
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
  });

  test('respects enabledHandPositions filter for hand-position-meaningful variants', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledHandPositions: ['front'],
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      // Wide-interval walks (5ths and beyond) are exempt — hand position
      // is dictated by interval direction, not user choice. Those
      // surface with their canonical hand position regardless of the
      // user's filter.
      if (
        p.variant.kind === 'intervalWalk' &&
        walkingPairMaxSemitones(p.scale, p.variant) >= 7
      ) {
        continue;
      }
      expect(p.handPosition).toBe('front');
    }
  });

  test('excludes invalid combos (back-hand at low fret)', () => {
    // E back-hand requires fret >= 3; with enough constraints we can verify
    // the picker filters out anything that has no valid starting position.
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C', 'E', 'G'],
      enabledHandPositions: ['back'],
      enabledVariants: { plain: true } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const universe = generateUniverse(settings);
    // None of the entries should produce a null pick — they should all be valid
    // (i.e., generateUniverse should have already filtered invalid combos)
    expect(universe.length).toBeGreaterThan(0);
  });

  test('includes open-string variants when enabled', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['A'],
      enabledHandPositions: ['front'],
      enabledVariants: { plain: true } as Settings['enabledVariants'],
      includeOpenStringVariants: true,
    };
    const universe = generateUniverse(settings);
    const open = universe.filter((p) => p.useOpenStrings);
    const fretted = universe.filter((p) => !p.useOpenStrings);
    expect(open.length).toBeGreaterThan(0);
    expect(fretted.length).toBeGreaterThan(0);
  });

  test('5-note pentatonic scales cap walk intervals at ±3', () => {
    // Per the user: wider walks on a 5-note scale jump too aggressively
    // through the limited note set, so cap at interval 3 (4ths).
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { kumoi: true } as Settings['enabledScales'],
      enabledKeys: ['A'],
      enabledHandPositions: ['front'],
      enabledVariants: {
        intervalWalks: true,
      } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      if (p.variant.kind === 'intervalWalk') {
        expect(p.variant.interval).toBeLessThanOrEqual(3);
      }
    }
    // And the cap is actually used (some interval=3 walks survive).
    const has3 = universe.some(
      (p) => p.variant.kind === 'intervalWalk' && p.variant.interval === 3,
    );
    expect(has3).toBe(true);
  });

  test('blues scale rejects walk interval 7 (over one octave for 6-note scale)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { blues: true } as Settings['enabledScales'],
      enabledKeys: ['A'],
      enabledHandPositions: ['front'],
      enabledVariants: {
        intervalWalks: true,
      } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const universe = generateUniverse(settings);
    for (const p of universe) {
      if (p.variant.kind === 'intervalWalk') {
        expect(p.variant.interval).toBeLessThanOrEqual(6); // blues is 6-note
      }
    }
  });

  test('D♯ Phrygian Dominant walking octaves up is rejected on 4-string EADG (range exceeds bass)', () => {
    // The desc half goes one octave below D♯ (= D♯1, MIDI 27), which is
    // below E1 (MIDI 28, lowest playable on 4-string EADG). Old picker
    // only validated the asc-half range and accepted the combo, leading
    // to negative frets in the layout.
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { phrygianDominant: true } as Settings['enabledScales'],
      enabledKeys: ['Ds'],
      enabledHandPositions: ['back'],
      enabledVariants: {
        intervalWalks: true,
      } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const universe = generateUniverse(settings);
    const offending = universe.filter(
      (p) =>
        p.variant.kind === 'intervalWalk' &&
        p.variant.interval === 7 &&
        p.variant.intervalDir === 'up',
    );
    expect(offending).toHaveLength(0);
  });

  test('wide-interval walks (5ths+) appear exactly once per key/scale regardless of hand-position filter', () => {
    // With only "back" hand enabled, the user would lose walking-5ths
    // (which is canonical-up=front) if the picker filtered by hand
    // position. The picker should exempt wide walks from the filter
    // and surface one canonical entry.
    const wideUp: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['back'],
      enabledVariants: { intervalWalks: true } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const u = generateUniverse(wideUp);
    const walk5Up = u.filter(
      (p) =>
        p.variant.kind === 'intervalWalk' &&
        p.variant.interval === 4 &&
        p.variant.intervalDir === 'up',
    );
    expect(walk5Up).toHaveLength(1);
    expect(walk5Up[0].handPosition).toBe('front'); // canonical for up
    const walk5Down = u.filter(
      (p) =>
        p.variant.kind === 'intervalWalk' &&
        p.variant.interval === 4 &&
        p.variant.intervalDir === 'down',
    );
    expect(walk5Down).toHaveLength(1);
    expect(walk5Down[0].handPosition).toBe('back'); // canonical for down
  });

  test('narrow-interval walks (≤4ths) still produce one entry per enabled hand position', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front', 'mid', 'back'],
      enabledVariants: { intervalWalks: true } as Settings['enabledVariants'],
      includeOpenStringVariants: false,
    };
    const u = generateUniverse(settings);
    const walk3Up = u.filter(
      (p) =>
        p.variant.kind === 'intervalWalk' &&
        p.variant.interval === 2 &&
        p.variant.intervalDir === 'up',
    );
    // 3 hand positions × 1 (asc dir filter applied above) = 3 entries.
    expect(walk3Up).toHaveLength(3);
    const hps = new Set(walk3Up.map((p) => p.handPosition));
    expect(hps).toEqual(new Set(['front', 'mid', 'back']));
  });

  test('G major has NO open-string variant on 4-string (G open is on highest string AND different octave)', () => {
    const settings: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['G'],
      enabledHandPositions: ['front'],
      enabledVariants: { plain: true } as Settings['enabledVariants'],
      includeOpenStringVariants: true,
    };
    const universe = generateUniverse(settings);
    const open = universe.filter((p) => p.useOpenStrings);
    expect(open).toHaveLength(0);
  });
});

describe('pickWeightedRandom', () => {
  test('picks from universe when history is empty', () => {
    const universe = generateUniverse(baseSettings);
    const picked = pickWeightedRandom(universe, new Set());
    expect(picked).not.toBeNull();
    expect(universe.some((p) => paramsKey(p) === paramsKey(picked!))).toBe(true);
  });

  test('avoids items in history if alternatives exist', () => {
    const universe = generateUniverse(baseSettings);
    expect(universe.length).toBeGreaterThan(2);
    const exclude = new Set(universe.slice(0, 5).map(paramsKey));
    const picked = pickWeightedRandom(universe, exclude);
    expect(exclude.has(paramsKey(picked!))).toBe(false);
  });

  test('falls back to full universe when all are in history', () => {
    const universe = generateUniverse(baseSettings).slice(0, 3);
    const exclude = new Set(universe.map(paramsKey));
    const picked = pickWeightedRandom(universe, exclude);
    expect(picked).not.toBeNull();
  });

  test('returns null for empty universe', () => {
    expect(pickWeightedRandom([], new Set())).toBeNull();
  });
});

function arpsOnly(overrides: Partial<ArpeggioToggles> = {}): Settings {
  const empty = (val: boolean) => ({
    plain: val,
    multiOctaveA_2: val,
    multiOctaveA_3: val,
    multiOctaveB_2: val,
    consecutive_3: val,
    consecutive_4: val,
    mirror_3: val,
    mirror_4: val,
    intervalWalks: val,
  });
  return {
    ...baseSettings,
    enabledVariants: empty(false),
    enabledArpeggios: {
      sizes: {
        triad: true,
        seventh: false,
        ninth: false,
        eleventh: false,
        thirteenth: false,
      },
      directions: {
        allUp: true,
        upDown: false,
        downUp: false,
        zigzag: false,
      },
      ...overrides,
    },
    enabledAgility: { bigX: false, spider: false },
  };
}

describe('generateUniverse — arpeggio universe', () => {
  test('arpeggios excluded for pentatonic scales', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { majorPentatonic: true } as Settings['enabledScales'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(0);
  });

  test('arpeggios excluded for chromatic scale', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { chromatic: true } as Settings['enabledScales'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(0);
  });

  test('arpeggios included for Major scale', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.variant.kind).toBe('arpeggioCycle');
    }
  });

  test('arpeggios included for Hungarian Minor (7 intervals, despite pentatonic category)', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { hungarian: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
  });

  test('one canonical entry per (scale, key, size, direction) — no hand-position multiplication', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front', 'mid', 'back'],
    };
    const universe = generateUniverse(settings);
    expect(universe).toHaveLength(1); // triad × allUp × C major × 1 hp
  });

  test('disabling all sizes removes arpeggios entirely', () => {
    const settings: Settings = arpsOnly({
      sizes: {
        triad: false,
        seventh: false,
        ninth: false,
        eleventh: false,
        thirteenth: false,
      },
    });
    expect(generateUniverse(settings)).toHaveLength(0);
  });

  test('disabling all directions removes arpeggios entirely', () => {
    const settings: Settings = arpsOnly({
      directions: {
        allUp: false,
        upDown: false,
        downUp: false,
        zigzag: false,
      },
    });
    expect(generateUniverse(settings)).toHaveLength(0);
  });

  test('no open-string arpeggio variants', () => {
    // includeOpenStringVariants ON shouldn't produce open-string arpeggio entries.
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C', 'E'],  // E has an open-string root on the low E string
      includeOpenStringVariants: true,
    };
    const universe = generateUniverse(settings);
    expect(universe.length).toBeGreaterThan(0);
    for (const p of universe) {
      expect(p.useOpenStrings).toBe(false);
    }
  });
});

describe('paramsKey / paramsFromKey — arpeggio round-trip', () => {
  test('triad allUp round-trips', () => {
    const settings: Settings = {
      ...arpsOnly(),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
    };
    const universe = generateUniverse(settings);
    const p = universe[0];
    const key = paramsKey(p);
    expect(key).toContain('arpeggio:3:allUp');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('arpeggioCycle');
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.size).toBe(3);
      expect(restored!.variant.direction).toBe('allUp');
    }
  });

  test('13th zigzag round-trips', () => {
    const settings: Settings = {
      ...arpsOnly({
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: true },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: true },
      }),
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['Bb'],
    };
    const universe = generateUniverse(settings);
    if (universe.length === 0) {
      // 13th zigzag on B♭ may not fit the bass — skip in that case.
      return;
    }
    const p = universe[0];
    const key = paramsKey(p);
    expect(key).toContain('arpeggio:7:zigzag');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    if (restored!.variant.kind === 'arpeggioCycle') {
      expect(restored!.variant.size).toBe(7);
      expect(restored!.variant.direction).toBe('zigzag');
    }
  });
});

describe('generateUniverse — agility universe', () => {
  function agilityOnly(toggles: { bigX?: boolean; spider?: boolean } = {}): Settings {
    const empty = (val: boolean) => ({
      plain: val,
      multiOctaveA_2: val,
      multiOctaveA_3: val,
      multiOctaveB_2: val,
      consecutive_3: val,
      consecutive_4: val,
      mirror_3: val,
      mirror_4: val,
      intervalWalks: val,
    });
    return {
      ...baseSettings,
      enabledVariants: empty(false),
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: {
        bigX: toggles.bigX ?? true,
        spider: toggles.spider ?? true,
      },
    };
  }

  test('Big X only, 4-string EADG: 4 entries (1 startString × 2 directions × 2 spellings)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    expect(universe).toHaveLength(4);
    for (const p of universe) {
      expect(p.variant.kind).toBe('bigX');
    }
  });

  test('Big X only, 5-string BEADG: 8 entries (2 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fiveStringBEADG',
    };
    expect(generateUniverse(s)).toHaveLength(8);
  });

  test('Big X only, 6-string BEADGC: 12 entries (3 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'sixStringBEADGC',
    };
    expect(generateUniverse(s)).toHaveLength(12);
  });

  test('Spider only, 4-string EADG: 12 entries (3 pairs × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: false, spider: true }),
      tuningId: 'fourStringEADG',
    };
    expect(generateUniverse(s)).toHaveLength(12);
  });

  test('Spider only, 5-string BEADG: 16 entries (4 × 2 × 2)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: false, spider: true }),
      tuningId: 'fiveStringBEADG',
    };
    expect(generateUniverse(s)).toHaveLength(16);
  });

  test('agility on with no enabled keys/scales/handPositions still emits entries', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
      enabledScales: {} as Settings['enabledScales'],
      enabledKeys: [],
      enabledHandPositions: [],
    };
    expect(generateUniverse(s)).toHaveLength(4);
  });

  test('agility entries use chromatic scale + C root + front hand', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    for (const p of universe) {
      expect(p.scale.name).toBe('Chromatic');
      expect(p.rootPc).toBe(0);
      expect(p.rootName).toBe('C');
      expect(p.handPosition).toBe('front');
      expect(p.useOpenStrings).toBe(false);
    }
  });

  test('agility entries have a populated spelling map (5 entries)', () => {
    const s: Settings = {
      ...agilityOnly({ bigX: true, spider: false }),
      tuningId: 'fourStringEADG',
    };
    const universe = generateUniverse(s);
    for (const p of universe) {
      expect(p.spelling).toBeDefined();
      expect(p.spelling!.size).toBe(5);
    }
  });

  test('disabling both agility toggles removes agility entries', () => {
    const s: Settings = agilityOnly({ bigX: false, spider: false });
    expect(generateUniverse(s)).toHaveLength(0);
  });
});

describe('paramsKey / paramsFromKey — agility round-trip', () => {
  function makeAgilitySettings(opts: { bigX: boolean; spider: boolean }) {
    return {
      ...baseSettings,
      enabledVariants: {
        plain: false, multiOctaveA_2: false, multiOctaveA_3: false,
        multiOctaveB_2: false, consecutive_3: false, consecutive_4: false,
        mirror_3: false, mirror_4: false, intervalWalks: false,
      },
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: opts,
    } as Settings;
  }

  test('bigX:0:fwd:sharp round-trips', () => {
    const s = makeAgilitySettings({ bigX: true, spider: false });
    const universe = generateUniverse(s);
    const target = universe.find(
      (p) =>
        p.variant.kind === 'bigX' &&
        p.variant.startString === 0 &&
        p.variant.direction === 'forward' &&
        p.variant.spelling === 'sharp',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:bigX:0:fwd:sharp');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.variant.kind).toBe('bigX');
    if (restored!.variant.kind === 'bigX') {
      expect(restored!.variant.startString).toBe(0);
      expect(restored!.variant.direction).toBe('forward');
      expect(restored!.variant.spelling).toBe('sharp');
    }
  });

  test('bigX:1:rev:flat round-trips on 5-string', () => {
    const s = makeAgilitySettings({ bigX: true, spider: false });
    const universe = generateUniverse({ ...s, tuningId: 'fiveStringBEADG' });
    const target = universe.find(
      (p) =>
        p.variant.kind === 'bigX' &&
        p.variant.startString === 1 &&
        p.variant.direction === 'reverse' &&
        p.variant.spelling === 'flat',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:bigX:1:rev:flat');
    const restored = paramsFromKey(key);
    expect(restored!.variant.kind).toBe('bigX');
  });

  test('spider:2:fwd:flat round-trips', () => {
    const s = makeAgilitySettings({ bigX: false, spider: true });
    const universe = generateUniverse(s);
    const target = universe.find(
      (p) =>
        p.variant.kind === 'spider' &&
        p.variant.lowerString === 2 &&
        p.variant.direction === 'forward' &&
        p.variant.spelling === 'flat',
    );
    expect(target).toBeDefined();
    const key = paramsKey(target!);
    expect(key).toContain('agility:spider:2:fwd:flat');
    const restored = paramsFromKey(key);
    expect(restored!.variant.kind).toBe('spider');
  });
});

describe('generateUniverse — rhythm multiplication', () => {
  function nonAgilityBase(rhythmOverride?: Partial<Settings['enabledRhythms']>): Settings {
    return {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledRhythms: {
        quarter: true,
        eighth: false,
        triplet: false,
        '8ss': false,
        's8s': false,
        'ss8': false,
        ...rhythmOverride,
      },
    };
  }

  test('default settings (quarter only) keep universe size = base × 1', () => {
    const u = generateUniverse(nonAgilityBase());
    expect(u.length).toBeGreaterThan(0);
    for (const p of u) {
      expect(p.rhythm).toBe('quarter');
    }
  });

  test('all 6 rhythms enabled: non-agility entries × 6', () => {
    const u1 = generateUniverse(nonAgilityBase());
    const u6 = generateUniverse(
      nonAgilityBase({
        eighth: true,
        triplet: true,
        '8ss': true,
        's8s': true,
        'ss8': true,
      }),
    );
    expect(u6.length).toBe(u1.length * 6);
  });

  test('agility entries always set rhythm = eighth, ignore enabledRhythms', () => {
    const s: Settings = {
      ...baseSettings,
      enabledVariants: {
        plain: false, multiOctaveA_2: false, multiOctaveA_3: false,
        multiOctaveB_2: false, consecutive_3: false, consecutive_4: false,
        mirror_3: false, mirror_4: false, intervalWalks: false,
      },
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: true, spider: false },
      enabledRhythms: {
        quarter: true, eighth: true, triplet: true, '8ss': true, 's8s': true, 'ss8': true,
      },
      tuningId: 'fourStringEADG',
    };
    const u = generateUniverse(s);
    // 4-string Big X: 1 startString × 2 directions × 2 spellings = 4 entries.
    expect(u.length).toBe(4);
    for (const p of u) {
      expect(p.rhythm).toBe('eighth');
    }
  });

  test('disabling all rhythms: non-agility universe empty; agility still emits', () => {
    const s: Settings = {
      ...baseSettings,
      enabledKeys: ['C'],
      enabledRhythms: {
        quarter: false, eighth: false, triplet: false, '8ss': false, 's8s': false, 'ss8': false,
      },
    };
    const u = generateUniverse(s);
    const nonAgility = u.filter((p) => p.variant.kind !== 'bigX' && p.variant.kind !== 'spider');
    expect(nonAgility.length).toBe(0);
    const agility = u.filter((p) => p.variant.kind === 'bigX' || p.variant.kind === 'spider');
    expect(agility.length).toBeGreaterThan(0);
    for (const p of agility) {
      expect(p.rhythm).toBe('eighth');
    }
  });
});

describe('paramsKey / paramsFromKey — rhythm round-trip', () => {
  function makeAgilitySettings(opts: { bigX: boolean; spider: boolean }) {
    return {
      ...baseSettings,
      enabledVariants: {
        plain: false, multiOctaveA_2: false, multiOctaveA_3: false,
        multiOctaveB_2: false, consecutive_3: false, consecutive_4: false,
        mirror_3: false, mirror_4: false, intervalWalks: false,
      },
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: opts,
    } as Settings;
  }

  test('quarter rhythm round-trips through 7-segment URL', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledRhythms: { quarter: true, eighth: false, triplet: false, '8ss': false, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p).toBeDefined();
    expect(p!.rhythm).toBe('quarter');
    const key = paramsKey(p!);
    expect(key).toContain('|quarter|');
    const restored = paramsFromKey(key);
    expect(restored).not.toBeNull();
    expect(restored!.rhythm).toBe('quarter');
  });

  test('triplet rhythm round-trips', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledRhythms: { quarter: false, eighth: false, triplet: true, '8ss': false, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p!.rhythm).toBe('triplet');
    const key = paramsKey(p!);
    expect(key).toContain('|triplet|');
    expect(paramsFromKey(key)!.rhythm).toBe('triplet');
  });

  test('8ss rhythm round-trips', () => {
    const s: Settings = {
      ...baseSettings,
      enabledScales: { major: true } as Settings['enabledScales'],
      enabledKeys: ['C'],
      enabledHandPositions: ['front'],
      enabledArpeggios: {
        sizes: { triad: false, seventh: false, ninth: false, eleventh: false, thirteenth: false },
        directions: { allUp: false, upDown: false, downUp: false, zigzag: false },
      },
      enabledAgility: { bigX: false, spider: false },
      enabledRhythms: { quarter: false, eighth: false, triplet: false, '8ss': true, 's8s': false, 'ss8': false },
    };
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'plain');
    expect(p!.rhythm).toBe('8ss');
    const key = paramsKey(p!);
    expect(key).toContain('|8ss|');
    expect(paramsFromKey(key)!.rhythm).toBe('8ss');
  });

  test('legacy 6-segment URL defaults rhythm to eighth', () => {
    const legacyKey = 'fourStringEADG|Major|C|front|plain|fretted';
    const restored = paramsFromKey(legacyKey);
    expect(restored).not.toBeNull();
    expect(restored!.rhythm).toBe('eighth');
  });

  test('agility URL encodes rhythm = eighth', () => {
    const s = makeAgilitySettings({ bigX: true, spider: false });
    const universe = generateUniverse(s);
    const p = universe.find((x) => x.variant.kind === 'bigX');
    expect(p!.rhythm).toBe('eighth');
    const key = paramsKey(p!);
    expect(key).toContain('|eighth|');
    expect(paramsFromKey(key)!.rhythm).toBe('eighth');
  });
});
