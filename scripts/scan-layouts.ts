// Scan the entire universe of exercises looking for fret-choice issues.
// Use to spot regressions after changing the layout algorithm or to find
// edge-case exercises worth investigating.
//
// Usage:
//   npx tsx scripts/scan-layouts.ts                  # all exercises
//   npx tsx scripts/scan-layouts.ts walking          # only interval-walk variants
//
// Flags any of:
//   - Negative frets (should never happen — picker should reject these combos).
//   - Cross-string moves ≥ 8 frets (a multi-string leap of that size is
//     almost always a layout bug — a same-string slide of the same
//     distance is just a hand shift).

import { generateExercise } from '../src/exercises/scale-generator.ts';
import { generateUniverse } from '../src/exercises/picker.ts';
import { defaultSettings } from '../src/stores/settings.ts';
import type { Variant } from '../src/exercises/types.ts';

const onlyWalking = process.argv.includes('walking');

const s = defaultSettings();
const universe = generateUniverse(s);

let totalChecked = 0;
let totalIssues = 0;
const samples: { tag: string; msg: string }[] = [];

for (const params of universe) {
  if (onlyWalking && params.variant.kind !== 'intervalWalk') continue;
  totalChecked++;
  let ex;
  try {
    ex = generateExercise(params);
  } catch (e) {
    samples.push({
      tag: tagOf(params),
      msg: `THROW: ${e instanceof Error ? e.message : String(e)}`,
    });
    totalIssues++;
    continue;
  }
  const names = params.tuning.openNoteNames;
  for (let i = 0; i < ex.sequence.length; i++) {
    const n = ex.sequence[i];
    if (n.fret < 0) {
      samples.push({
        tag: tagOf(params),
        msg: `idx ${i}: NEGATIVE fret ${names[n.string]}${n.fret}`,
      });
      totalIssues++;
      break;
    }
  }
  // The first note's position is the exercise's "home" — the cost
  // function pulls intermediate root MIDI occurrences back to it,
  // which legitimately creates big jumps after the layout has
  // drifted to high frets. Filter those out so the scan only shows
  // jumps that are NOT explained by "snap back to home".
  const home = ex.sequence[0];
  let badJump = false;
  for (let i = 1; i < ex.sequence.length; i++) {
    const prev = ex.sequence[i - 1];
    const cur = ex.sequence[i];
    const sd = Math.abs(cur.string - prev.string);
    const fd = Math.abs(cur.fret - prev.fret);
    if (sd >= 1 && fd >= 8) {
      const snapToHome =
        cur.string === home.string && cur.fret === home.fret;
      if (snapToHome) continue;
      samples.push({
        tag: tagOf(params),
        msg: `idx ${i - 1}→${i}: ${names[prev.string]}${prev.fret}→${names[cur.string]}${cur.fret} (Δs=${sd}, Δf=${fd})`,
      });
      badJump = true;
      break;
    }
  }
  if (badJump) totalIssues++;
}

console.log(
  `${totalIssues} issues out of ${totalChecked} exercises${onlyWalking ? ' (walking only)' : ''}`,
);
const SAMPLE = 20;
for (const issue of samples.slice(0, SAMPLE)) {
  console.log(`  ${issue.tag}`);
  console.log(`    ${issue.msg}`);
}
if (samples.length > SAMPLE)
  console.log(`  ... and ${samples.length - SAMPLE} more`);

function variantTag(v: Variant): string {
  switch (v.kind) {
    case 'plain':
      return 'scale';
    case 'consecutive':
      return Array.from({ length: v.groupSize }, (_, i) => i + 1).join('-');
    case 'mirror':
      return `mirror-${v.peakSize}`;
    case 'intervalWalk':
      return `walk ${v.intervalDir === 'up' ? '+' : '-'}${v.interval}`;
    case 'multiOctaveA':
      return `mo-A ${v.octaves}oct`;
    case 'multiOctaveB':
      return `mo-B ${v.octaves}oct`;
    case 'arpeggioCycle':
      return 'arp placeholder';
  }
}

function tagOf(p: ReturnType<typeof generateUniverse>[number]): string {
  return `${p.rootName ?? p.rootPc} ${p.scale.name} — ${variantTag(p.variant)} — ${p.handPosition}${p.useOpenStrings ? ' open' : ''}`;
}
