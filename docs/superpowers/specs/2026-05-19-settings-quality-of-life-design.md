# Settings + Browse quality-of-life design

**Date:** 2026-05-19
**Status:** Approved, ready for plan

## Goal

Two small UX improvements:

1. **Browse panel filter reorder** — move the Variant filter to the top of the filter section (right after Tuning) so users pick the exercise FAMILY first, then narrow by scale/key only when it applies. Visually disable Scale / Key / Hand chip rows when the Variant filter is set to something that doesn't use them.
2. **Settings "Enable all" + "Reset to defaults" + per-section "All" / "None" buttons** — make it easy to bulk-toggle multi-toggle sections.

## Browse panel reorder

### Current order

The filter chips are arranged top-to-bottom:

1. Tuning
2. Scale
3. Key
4. Hand
5. Variant
6. Open strings

### New order

Move Variant to position 2 (right after Tuning):

1. Tuning
2. **Variant**
3. Scale
4. Key
5. Hand
6. Open strings

The Variant chip set already exists at [src/components/BrowsePanel.svelte:272-284](src/components/BrowsePanel.svelte:272) — moving its `<section>` block earlier in the template is the entire change.

### Grey-out rules for inapplicable filters

When the user selects a Variant whose entries DON'T vary by scale/key/hand, the corresponding chip rows are visually disabled (still visible so the user understands what they map to, but greyed out and unclickable).

| Variant filter | Scale chips | Key chips | Hand chips |
|----------------|-------------|-----------|------------|
| Any            | enabled     | enabled   | enabled    |
| Plain scale    | enabled     | enabled   | enabled    |
| Multi-octave   | enabled     | enabled   | enabled    |
| Consecutive    | enabled     | enabled   | enabled    |
| Mirror         | enabled     | enabled   | enabled    |
| Walking ↑      | enabled     | enabled   | enabled    |
| Walking ↓      | enabled     | enabled   | enabled    |
| Arpeggios      | enabled     | enabled   | **DISABLED** |
| Agility        | **DISABLED** | **DISABLED** | **DISABLED** |

The disabled rows:
- Render with reduced opacity (~50%) and `pointer-events: none` so clicks have no effect.
- Force the underlying filter state to `'any'` so the result list isn't filtered by a stale, hidden value.
- Show a small inline note explaining why (e.g. "Not applicable for Agility" or "Not applicable for Arpeggios").

Implementation hook: a `$derived` flag `scaleDisabled`, `keyDisabled`, `handDisabled` based on `variantFamily`. Wherever the filter rows render, conditionally apply a `.disabled` CSS class.

### Behavior when Variant changes to a "disables-something" value

If the user has set, say, Scale = "Major" and then clicks Variant = "Agility":
- Scale state stays "Major" internally (so flipping back to Variant = "Plain scale" restores it).
- Visually it greys out.
- The filter logic in `results` derives `scaleId` as `'any'` when the row is disabled, so the result list isn't filtered out by a no-longer-applicable Scale value.

This keeps the user's previous selections intact for round-tripping without polluting agility results.

### Pseudo-code

```svelte
<!-- in <script> -->
const scaleDisabled = $derived(variantFamily === 'agility');
const keyDisabled = $derived(variantFamily === 'agility');
const handDisabled = $derived(variantFamily === 'agility' || variantFamily === 'arpeggios');

const effectiveScaleId = $derived(scaleDisabled ? 'any' : scaleId);
const effectiveKeyId = $derived(keyDisabled ? 'any' : keyId);
const effectiveHand = $derived(handDisabled ? 'any' : hand);

const results = $derived.by(() =>
  fullUniverse.filter((p) => {
    if (effectiveScaleId !== 'any' && p.scale.name !== SCALES[effectiveScaleId as ScaleId]?.name) return false;
    if (effectiveKeyId !== 'any' && p.rootName !== KEYS.find((k) => k.id === effectiveKeyId)?.name) return false;
    if (effectiveHand !== 'any' && p.handPosition !== effectiveHand) return false;
    // ... existing variant + open-strings filters ...
  }),
);

<!-- in template -->
<section class:disabled={scaleDisabled}>
  <span class="lbl">Scale</span>
  {#if scaleDisabled}
    <span class="hint">Not applicable for {variantFamily}</span>
  {/if}
  <!-- existing chip controls (will be greyed via .disabled CSS) -->
</section>
```

CSS additions:

```css
section.disabled {
  opacity: 0.5;
  pointer-events: none;
}
section.disabled .hint {
  font-size: 12px;
  color: var(--text-dim);
  margin-left: 6px;
}
```

Reuses the existing `.hint` color rule from arpeggios/agility settings.

## Settings: Enable all + Reset + per-section All/None

### Top of Settings panel

Add a small button row at the top, ABOVE the first section (currently "Bass"):

```svelte
<div class="bulk-actions">
  <button class="bulk-btn" onclick={enableAll}>Enable all</button>
  <button class="bulk-btn" onclick={resetToDefaults}>Reset to defaults</button>
</div>
```

Behavior:

- **"Enable all"** — flips every multi-toggle to `true`:
  - `enabledVariants.*` all `true`
  - `enabledArpeggios.sizes.*` all `true`
  - `enabledArpeggios.directions.*` all `true`
  - `enabledAgility.bigX` and `enabledAgility.spider` to `true`
  - `enabledScales.*` all `true`
  - `enabledKeys` set to `KEYS.map((k) => k.id)` (the canonical ordered list)
  - `enabledHandPositions` set to `['front', 'mid', 'back']`
  - `includeOpenStringVariants` to `true`
  - **Does NOT touch**: `tuningId`, `displayToggles`, `metronome`, `autoTrebleClef`, `showFingerNumbers`, `recentExclusionCount` (these are non-"toggle-set" preferences).

- **"Reset to defaults"** — calls `defaultSettings()` and applies, EXCEPT preserves `tuningId` (the user's bass shouldn't change just because they hit reset). Confirm via a `confirm()` prompt: "Reset all settings to defaults? This will not change your bass tuning."

### Per-section "All" / "None" buttons

For each multi-toggle section, add a small button pair in the section header — placed next to the `<h3>`. Sections that get the pair:

- Hand positions
- Variants
- **Arpeggios** — single button pair that toggles BOTH the sizes row AND the directions row together
- Hand-agility drills
- Keys
- Scales

Buttons render like:

```svelte
<section>
  <div class="section-header">
    <h3>Keys</h3>
    <div class="bulk-section">
      <button class="bulk-section-btn" onclick={enableAllKeys}>All</button>
      <button class="bulk-section-btn" onclick={disableAllKeys}>None</button>
    </div>
  </div>
  <!-- existing chip controls -->
</section>
```

CSS:

```css
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.bulk-section {
  display: flex;
  gap: 4px;
}
.bulk-section-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}
.bulk-section-btn:hover {
  background: var(--border);
  color: var(--text);
}
```

The existing `<h3>` styles still apply (`margin: 0 0 10px`) — the new wrapper `.section-header` reverses the margin from h3 to itself.

### Per-section helpers

Each "All" / "None" toggles the relevant sub-tree of settings. In `SettingsPanel.svelte`:

```ts
function setAllScales(enabled: boolean): void {
  settings.update((s) => ({
    ...s,
    enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
      (acc, id) => { acc[id] = enabled; return acc; },
      {} as Record<ScaleId, boolean>,
    ),
  }));
}

function setAllKeys(enabled: boolean): void {
  settings.update((s) => ({
    ...s,
    enabledKeys: enabled ? KEYS.map((k) => k.id) : [],
  }));
}

function setAllHandPositions(enabled: boolean): void {
  settings.update((s) => ({
    ...s,
    enabledHandPositions: enabled ? ['front', 'mid', 'back'] : [],
  }));
}

function setAllVariants(enabled: boolean): void {
  settings.update((s) => ({
    ...s,
    enabledVariants: {
      plain: enabled,
      multiOctaveA_2: enabled,
      multiOctaveA_3: enabled,
      multiOctaveB_2: enabled,
      consecutive_3: enabled,
      consecutive_4: enabled,
      mirror_3: enabled,
      mirror_4: enabled,
      intervalWalks: enabled,
    },
  }));
}

function setAllArpeggios(enabled: boolean): void {
  // One button pair for the whole Arpeggios section — flips both
  // sizes AND directions together. A cycle with sizes all-on but
  // directions all-off (or vice-versa) emits zero variants from the
  // picker, so toggling the two together is the natural unit.
  settings.update((s) => ({
    ...s,
    enabledArpeggios: {
      sizes: { triad: enabled, seventh: enabled, ninth: enabled, eleventh: enabled, thirteenth: enabled },
      directions: { allUp: enabled, upDown: enabled, downUp: enabled, zigzag: enabled },
    },
  }));
}

function setAllAgility(enabled: boolean): void {
  settings.update((s) => ({
    ...s,
    enabledAgility: { bigX: enabled, spider: enabled },
  }));
}
```

And the global helpers:

```ts
function enableAll(): void {
  settings.update((s) => ({
    ...s,
    enabledVariants: { plain: true, multiOctaveA_2: true, multiOctaveA_3: true, multiOctaveB_2: true, consecutive_3: true, consecutive_4: true, mirror_3: true, mirror_4: true, intervalWalks: true },
    enabledArpeggios: {
      sizes: { triad: true, seventh: true, ninth: true, eleventh: true, thirteenth: true },
      directions: { allUp: true, upDown: true, downUp: true, zigzag: true },
    },
    enabledAgility: { bigX: true, spider: true },
    enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
      (acc, id) => { acc[id] = true; return acc; },
      {} as Record<ScaleId, boolean>,
    ),
    enabledKeys: KEYS.map((k) => k.id),
    enabledHandPositions: ['front', 'mid', 'back'],
    includeOpenStringVariants: true,
  }));
}

function resetToDefaults(): void {
  if (!confirm('Reset all settings to defaults? This will not change your bass tuning.')) return;
  const defaults = defaultSettings();
  settings.update((s) => ({ ...defaults, tuningId: s.tuningId }));
}
```

Both `KEYS` and `SCALES` are already imported at the top of `SettingsPanel.svelte`.

### Top-button CSS

```css
.bulk-actions {
  display: flex;
  gap: 8px;
  padding: 10px 0 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.bulk-btn {
  background: var(--accent);
  color: var(--accent-text-on);
  border: 0;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.bulk-btn:hover {
  filter: brightness(1.1);
}
```

## Scope (what's in this pass)

### In scope

- Browse panel: reorder filter sections (Variant → 2nd position).
- Browse panel: grey out Scale/Key/Hand rows per the table above when the Variant filter would make them inapplicable. Filter logic uses the "effective" values so disabled rows act as `'any'`.
- Settings: top "Enable all" + "Reset to defaults" buttons.
- Settings: per-section "All" / "None" buttons for the 6 multi-toggle sections (Arpeggios gets ONE pair that toggles sizes + directions together).
- "Reset to defaults" preserves the user's `tuningId`.

### Out of scope (deferred)

- "Disable all" global button — user explicitly declined.
- Saving the user's pre-disabled scale/key values for "round-trip" restoration. The spec keeps them in state but doesn't add a discoverable "undo" UX beyond toggling Variant back.
- Persisting bulk-action history (no undo / redo).
- Animation or transition effects on the grey-out.

## Testing

### Unit tests

- `BrowsePanel.svelte` doesn't currently have tests; the existing convention is manual verification. No new automated tests for the reorder / grey-out.
- `SettingsPanel.svelte` doesn't currently have tests either; the existing convention is manual verification. No new automated tests for the bulk-action buttons.

### Manual verification gate

After implementation, verify in a real browser:
1. Open Settings → see top button row (Enable all + Reset to defaults).
2. Disable everything manually, click "Enable all" → all multi-toggles flip to enabled.
3. Click "Reset to defaults" → confirm prompt appears; accept → settings return to `defaultSettings()` except tuning is unchanged.
4. Per-section: click "All" / "None" — only that section flips.
5. Open Browse panel → confirm Variant chips appear directly under Tuning (BEFORE Scale).
6. Set Variant = "Agility" → Scale, Key, Hand chip rows go grey + show "Not applicable for agility" hint.
7. Set Variant = "Arpeggios" → Hand row goes grey; Scale / Key stay enabled.
8. With grey-out active, the result list is unaffected by stored (now-hidden) Scale/Key/Hand values.
9. Switch Variant back to "Plain scale" → all chip rows re-enable; previously-selected values are still selected.

## Risks and known concerns

- **`confirm()` prompt** is a native browser dialog — looks slightly unstyled. Acceptable for a destructive action. If you want a styled in-app modal later, that's a separate pass.
- **"Reset to defaults"** wipes settings the user may have spent time customizing (metronome tempo range, halving period, exercise count, etc.). The confirm prompt mitigates accidental clicks.
- **Greyed-out rows still take vertical space** in the panel. If the panel gets crowded, consider collapsing them entirely instead. Not in scope for this pass.

## Implementation order

1. Add the global bulk-action helpers (`enableAll`, `resetToDefaults`) + per-section helpers in `SettingsPanel.svelte`.
2. Add the top button row + per-section header layout (`<div class="section-header">` wrappers around `<h3>` + buttons).
3. Add CSS for `.bulk-actions`, `.bulk-btn`, `.section-header`, `.bulk-section`, `.bulk-section-btn`.
4. In `BrowsePanel.svelte`: move the Variant `<section>` block earlier (between Tuning and Scale).
5. Add the `$derived` `scaleDisabled` / `keyDisabled` / `handDisabled` flags + the effective-id derivations.
6. Wire the disabled-row CSS class + the inline hint text.
7. Manual verification per the checklist above.
8. Update `docs/plan.md` (Recent additions section).
