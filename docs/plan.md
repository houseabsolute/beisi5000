# Project plan / roadmap

Living document. Updated as the project moves.

## Done — scales MVP

A randomized practice picker for bass scales, end-to-end:

- Music theory primitives: pitch classes, MIDI math, ~30 scales (major, three minors, modes, modes-of-minor, pentatonics, blues, octatonics, chromatic, hungarian), 17 spelled keys, key-signature + spelling-map generation, double-accidental detection.
- Bass tunings: 4-string EADG, 5-string BEADG and EADGC, 6-string BEADGC.
- Hand positions (front/mid/back) with per-position windows + per-string note caps + reachability rules.
- Variants: plain (1 octave), multi-octave A (spiral, 2/3 oct), multi-octave B (straightforward, 2 oct on 5/6-string), consecutive groups (1-2-3, 1-2-3-4), mirror groups (1-2-3-2-1, 1-2-3-4-3-2-1), interval walks (2nds through octaves, both directions).
- Layout algorithm with greedy placement + position cache + first-pair-fit start picker (walking) + lookahead-biased tail (walking) + pinned root resolution.
- Universe generation + weighted random picker with recent-exclusion history.
- AlphaTex emitter for AlphaTab rendering (notation + tab, correct key signatures, spelled accidentals).
- Custom SVG fretboard component with note-name labels + root highlight.
- Web Audio metronome with skip-ticks and tempo-halving behaviors.
- Settings UI (slide-out side panel) — all 17 keys, all scales, all variants, all hand positions, metronome controls, display toggles.
- All settings persisted to localStorage.

State: 316 unit tests passing, svelte-check clean. Universe currently 16,150 exercises across 4 tunings (default 4-string adds 16 agility entries: 4 Big X + 12 Spider). Walking-exercise, arpeggio, and agility layout scans: 0 cross-string ≥8 fret jumps.

## Recent additions (post-MVP polish)

- [x] **Hand-agility drills — Big X and Spider.** Chromatic finger-coordination patterns scanning frets 1 → 12 → 1. Both have 4 variants: 2 directions (forward / reverse) × 2 spellings (sharp / flat). Big X plays diagonals across 4 adjacent strings (random 4-subset rotated by picker on 5/6-string basses). Spider plays interleaved patterns on adjacent string pairs (rotated by picker). 96 agility universe entries across 4 tunings. Spec: [docs/superpowers/specs/2026-05-18-agility-drills-design.md](superpowers/specs/2026-05-18-agility-drills-design.md). New module: [src/exercises/agility.ts](../src/exercises/agility.ts).
- [x] **Arpeggio cycle exercises.** 5 chord sizes (triad → 13th) × 4 directions (allUp / upDown / downUp / zigzag) on 14 diatonic 7-note scales × 17 keys. Picker emits one canonical entry per `(scale, key, size, direction)`; root constrained to the bottom 2 strings (4-string) / bottom 3 strings (5/6-string). Spec: [docs/superpowers/specs/2026-05-17-arpeggios-design.md](superpowers/specs/2026-05-17-arpeggios-design.md). New helpers in [src/exercises/variants.ts](../src/exercises/variants.ts) (`arpUp`, `arpDown`, `arpeggioCycleMidi`) and [src/exercises/scale-generator.ts](../src/exercises/scale-generator.ts) (`arpeggioCycleApex`, `maxStringIndex` constraint). `canonicalHandPositionForWideWalk` renamed to `canonicalHandPositionForVariant`.
- [x] **DP-based lookahead in `layOnFretboard`** — `solveLookaheadDP` runs a layered DP over the last `PIN_LOOKAHEAD=6` notes; per-step cost is squared so the DP minimizes L2 movement and distributes string-crossings evenly instead of landing them on the final note. Applied to walking, consecutive, and mirror variants.
- [x] **Per-string cap enforced in fall-back** — the picker's fall-back path now respects the per-string cap (3 notes max after leaving the starting string) EXCEPT on the top string, where multi-octave A's apex extension can run longer. Spreads asc/desc evenly without breaking the mo-A spiral.
- [x] **Mid hand same-string cap from root** — middle-finger-on-root to pinky-on-(root+2) is the natural mid-hand span; any +3 from root forces cross-string instead of a same-string stretch. Fixes minor-pentatonic-mid and blues-mid fingerings.
- [x] **Walking picker tie-break = ergonomic score** — `string * 4 + fret` lets the picker prefer A2 over E7 for B (lower fret outweighs lower string when the gap is wide) while still preferring E4 over G1 for A♭ (low fret on both, lower string wins).
- [x] **About page** — `src/components/AboutPanel.svelte`, slide-out from a `?` topbar button. Includes "Who made this" / "How it was built" sections.
- [x] **BrowsePanel** — `src/components/BrowsePanel.svelte`, slide-out from a 🔍 topbar button. Filter chips for tuning / scale / key / hand / variant family / open-strings; tap a result row to load it. Filters run in-memory over the full universe.
- [x] **Light-mode redesign** — full CSS-variable palette in `src/app.css` (`--bg`, `--panel`, `--panel-2`, `--notation-bg`, `--accent` = medium purple `#7c3aed`, dedicated `--fb-*` vars for the fretboard SVG). Every component now reads from vars — no remaining hardcoded dark colors.
- [x] **AlphaTab horizontal fit** — `.alphatab-wrap` carries the visual padding/border; `.alphatab-host` (the element AlphaTab measures) is padding-free. Surface width always matches host content width. ResizeObserver triggers `api.render()` on container resize for mobile rotation / window resize.
- [x] **URL-based exercise navigation** — current exercise is mirrored to `location.hash` via `paramsKey()`; `paramsFromKey()` parses on mount and `hashchange`. Bookmarkable + reload-stable + browser back/forward works.
- [x] **Blues key signature uses parallel natural minor** — C Blues now reads as `Cminor` (3 flats), so the `Eb3` in the scale lands as `Eb` on the staff rather than `D#`. Helper `isMinorTonality(scale)` in `keys.ts` routes blues through the minor branches.
- [x] **Mobile layout polish (CSS)** — `@media (max-width: 520px)` block in `App.svelte` tightens padding for phone viewports. Verified at 375×812.
- [x] **Render.com deployment files** — `render.yaml` blueprint, `docs/deployment.md` covers blueprint + manual paths.
- [x] **App-name brainstorm** — `docs/name-brainstorm.md`. Decision still pending.
- [x] **Repo-level documentation** — `CLAUDE.md`, `docs/plan.md`. Trace + scan scripts in `scripts/`.

## Still open

- [x] **App name decision** — landed on **BèiSī 5000** (display) / `beisi5000` (npm + Render slug). `package.json#name`, `index.html`, `App.svelte`, and `render.yaml` all updated.
- [x] **Render.com deploy** — live on Render.com via the `render.yaml` blueprint. Auto-deploys on push to default branch.
- [x] **Visual mobile verification on a real phone** — verified on the deployed Render URL: panels, AlphaTab, fretboard, and metronome controls all behave.
- [x] **Practice ergonomics** — Space toggles the metronome, N picks the next exercise, P walks browser history back (Previous + Next UI buttons mirror these). BrowsePanel filters persist to localStorage under `bass-practice:browse-filters:v1`.

Bundle size cleanup (lazy-load AlphaTab via dynamic import, ~1.3 MB → ~200 KB) was considered and intentionally deferred — the app loads fine over Render's CDN and is for personal use; not worth the code-split complexity right now.

### Future passes (not in scope for the current iteration)
- Arpeggios — further passes:
  - Open-string arpeggio variants.
  - Inversions — arpeggios that don't start on the chord root.
  - Selecting which scale degrees to root on (current pass always cycles 1 → 8).
  - Chord-progression exercises — ii–V–I, cycle of fifths, diatonic 7ths chained, etc. — a different exercise unit (multi-key, not single-key cycle).
  - Arpeggios on non-diatonic scales (pentatonics, chromatic, octatonic) — would need a different chord-tone-selection convention.
  - User-selected hand position for arpeggios.
- Other time signatures (currently 4/4 only).
- Exercise history / streaks / stats.
- Cloud sync / multi-user accounts.

## How layout decisions get made

The user is the bassist. When a layout looks wrong:
1. They report the specific exercise (e.g. "B♭ Major Walking 3rds ↓ Front").
2. We trace it by running a small TS script that calls `generateExercise` and prints the sequence.
3. We identify the rule violation (this is usually informative — wrong starting position, missing constraint, etc.).
4. We add a test asserting the right behavior.
5. We fix the relevant logic in `picker.ts` / `scale-generator.ts` / `variants.ts` / `keys.ts`.

The user's rules accumulate in `CLAUDE.md` under "User-imposed rules". Don't change these without checking with them first.

## Definition of done for the MVP

The scales slice ships when:
- All 17 keys × all enabled scales × all variants × all hand positions × all bass types produce playable, musically-reasonable layouts (no negative frets, no big cross-string leaps, smooth resolutions to the tonic).
- The app deploys to Render.com and the user can practice on their phone over LAN or hosted URL.
- About page exists and is up to date.
- Multi-stage picker lets the user grab a specific exercise.

After MVP ships, arpeggios is the next pass.
