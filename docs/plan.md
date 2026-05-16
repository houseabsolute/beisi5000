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

State: 214 unit tests passing, svelte-check clean. Universe currently 17,058 exercises across 4 tunings. Walking-exercise layout scan: 0 cross-string ≥8 fret jumps.

## Recent additions (post-MVP polish)

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
- [ ] **Visual mobile verification on a real phone** — on the Render URL. Confirm panels, AlphaTab, fretboard, and metronome controls all behave at 375–414px.
- [ ] **Practice ergonomics** — keyboard shortcuts (Space = metronome start/stop, N = next, P = previous), "Previous exercise" button walking the picked-history ring backward, persist BrowsePanel filters across reloads.
- [ ] **Bundle size** — production JS is ~1.3 MB; AlphaTab is the bulk. Lazy-loading AlphaTab via dynamic import would drop the initial payload to ~200 KB.

### Future passes (not in scope for the current iteration)
- Arpeggios (triads, 7ths, 9ths) with cycle direction + note direction.
- Big X — hand-agility exercise.
- Spider — two-string crawl.
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
