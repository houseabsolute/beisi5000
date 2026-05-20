# Settings + Browse quality-of-life implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two small UX improvements: (1) Settings panel gets a top "Enable all" + "Reset to defaults" button pair plus per-section "All"/"None" buttons; (2) Browse panel moves the Variant filter to position 2 (right after Tuning) and greys out Scale/Key/Hand chip rows when the chosen Variant doesn't use them.

**Architecture:** UI-only changes to two existing Svelte components. New state/helpers live in the components themselves (no shared module). All changes route through the existing `settings` store so persistence works automatically. No new tests — both components use the existing manual-verification convention.

**Tech Stack:** Svelte 5 (runes), TypeScript.

**Reference spec:** [docs/superpowers/specs/2026-05-19-settings-quality-of-life-design.md](../specs/2026-05-19-settings-quality-of-life-design.md)

---

## File structure

**Modified files (no new files):**

| File | What changes |
|------|--------------|
| `src/components/SettingsPanel.svelte` | Add 7 helper functions + top button row + per-section header layout for 6 sections + new CSS |
| `src/components/BrowsePanel.svelte` | Move Variant `<section>` to position 2; add `$derived` disabled flags + effective filter values + conditional `.disabled` CSS class + new CSS |

No test changes — both components currently rely on manual verification (no Svelte unit tests in the repo). Manual verification step at the end.

---

## Task 1: Settings panel — per-section helpers

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add the 6 per-section helper functions**

In `src/components/SettingsPanel.svelte`, find the existing `toggleAgility` function (around line 104). After it, add these 6 helpers:

```ts
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
    // directions all-off (or vice-versa) emits zero variants, so
    // toggling the two together is the natural unit.
    settings.update((s) => ({
      ...s,
      enabledArpeggios: {
        sizes: {
          triad: enabled,
          seventh: enabled,
          ninth: enabled,
          eleventh: enabled,
          thirteenth: enabled,
        },
        directions: {
          allUp: enabled,
          upDown: enabled,
          downUp: enabled,
          zigzag: enabled,
        },
      },
    }));
  }

  function setAllAgility(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledAgility: { bigX: enabled, spider: enabled },
    }));
  }

  function setAllKeys(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledKeys: enabled ? KEYS.map((k) => k.id) : [],
    }));
  }

  function setAllScales(enabled: boolean): void {
    settings.update((s) => ({
      ...s,
      enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
        (acc, id) => {
          acc[id] = enabled;
          return acc;
        },
        {} as Record<ScaleId, boolean>,
      ),
    }));
  }
```

Confirm `KEYS`, `SCALES`, `ScaleId` are already imported at the top of the file (they should be from the existing scale + key chip rendering).

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors. (The helpers are defined but not yet called — TypeScript may flag them as unused locals if strict.)

If unused-locals warnings appear, ignore them — Task 2 wires the buttons that call them.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(settings): add per-section bulk toggle helpers"
```

---

## Task 2: Settings panel — per-section "All" / "None" buttons in section headers

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Replace 6 section headers with `.section-header` flex wrapper containing h3 + button pair**

For each of the 6 multi-toggle sections, wrap the `<h3>` in a `<div class="section-header">` and add a button pair next to it.

**(a)** Hand positions (around line 168). Find:
```svelte
    <section>
      <h3>Hand positions</h3>
```

Replace with:
```svelte
    <section>
      <div class="section-header">
        <h3>Hand positions</h3>
        <div class="bulk-section">
          <button class="bulk-section-btn" onclick={() => setAllHandPositions(true)} type="button">All</button>
          <button class="bulk-section-btn" onclick={() => setAllHandPositions(false)} type="button">None</button>
        </div>
      </div>
```

**(b)** Variants (around line 184). Find `<h3>Variants</h3>` and apply the same wrapping using `setAllVariants`.

**(c)** Arpeggios (around line 264). Find `<h3>Arpeggios</h3>` and apply the same wrapping using `setAllArpeggios`.

**(d)** Hand-agility drills (around line 347). Find `<h3>Hand-agility drills</h3>` and apply the same wrapping using `setAllAgility`.

**(e)** Keys (around line 368). Find `<h3>Keys</h3>` and apply the same wrapping using `setAllKeys`.

**(f)** Scales (around line 384). Find `<h3>Scales</h3>` and apply the same wrapping using `setAllScales`.

The `<h3>Bass</h3>`, `<h3>Display</h3>`, `<h3>Metronome</h3>` sections are NOT modified (they aren't multi-toggle sets).

- [ ] **Step 2: Add CSS for `.section-header`, `.bulk-section`, `.bulk-section-btn`**

In the `<style>` block at the bottom of `src/components/SettingsPanel.svelte`, add:

```css
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 10px;
  }
  .section-header h3 {
    margin: 0;
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
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bulk-section-btn:hover {
    background: var(--border);
    color: var(--text);
  }
```

The `.section-header h3 { margin: 0 }` override cancels the existing `section h3 { margin: 0 0 10px }` rule so the flex parent's margin is the single source of spacing.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(settings): per-section All/None buttons in section headers"
```

---

## Task 3: Settings panel — top "Enable all" + "Reset to defaults" buttons

**Files:**
- Modify: `src/components/SettingsPanel.svelte`

- [ ] **Step 1: Add the global helpers**

In `src/components/SettingsPanel.svelte`, after the per-section helpers added in Task 1, add:

```ts
  function enableAll(): void {
    settings.update((s) => ({
      ...s,
      enabledVariants: {
        plain: true,
        multiOctaveA_2: true,
        multiOctaveA_3: true,
        multiOctaveB_2: true,
        consecutive_3: true,
        consecutive_4: true,
        mirror_3: true,
        mirror_4: true,
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
      enabledAgility: { bigX: true, spider: true },
      enabledScales: (Object.keys(SCALES) as ScaleId[]).reduce(
        (acc, id) => {
          acc[id] = true;
          return acc;
        },
        {} as Record<ScaleId, boolean>,
      ),
      enabledKeys: KEYS.map((k) => k.id),
      enabledHandPositions: ['front', 'mid', 'back'],
      includeOpenStringVariants: true,
    }));
  }

  function resetToDefaults(): void {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Reset all settings to defaults? This will not change your bass tuning.',
      )
    ) {
      return;
    }
    const defaults = defaultSettings();
    settings.update((s) => ({ ...defaults, tuningId: s.tuningId }));
  }
```

Confirm `defaultSettings` is imported at the top of the file. If not, add it to the existing import from `../stores/settings`:

```ts
import { settings, defaultSettings } from '../stores/settings';
```

- [ ] **Step 2: Add the button row to the panel body**

Find the `<div class="body">` opening tag (around line 99, just after the panel header). Add the button row as the FIRST child of `<div class="body">`:

```svelte
  <div class="body">
    <div class="bulk-actions">
      <button class="bulk-btn" onclick={enableAll} type="button">Enable all</button>
      <button class="bulk-btn" onclick={resetToDefaults} type="button">Reset to defaults</button>
    </div>

    <section>
      <h3>Bass</h3>
      <!-- existing sections continue ... -->
```

- [ ] **Step 3: Add CSS for `.bulk-actions` and `.bulk-btn`**

In the `<style>` block (alongside the styles added in Task 2), add:

```css
  .bulk-actions {
    display: flex;
    gap: 8px;
    padding-bottom: 16px;
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

- [ ] **Step 4: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPanel.svelte
git commit -m "feat(settings): top Enable all + Reset to defaults buttons"
```

---

## Task 4: Browse panel — move Variant filter to position 2

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

- [ ] **Step 1: Move the Variant `<section>` block earlier in the template**

In `src/components/BrowsePanel.svelte`, find the existing Variant section (around line 272-284 — it contains the `{#each [{ id: 'any', label: 'Any' }, ...]}` chip array).

CUT that entire `<section>` block (from `<section>` to its closing `</section>`).

PASTE it immediately AFTER the Tuning `<section>` (which is the first section, around lines 204-213), BEFORE the Scale `<section>`.

The resulting order should be:
1. Tuning
2. **Variant** (moved here)
3. Scale
4. Key
5. Hand
6. Open strings

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(browse): move Variant filter to position 2"
```

---

## Task 5: Browse panel — grey out inapplicable filters

**Files:**
- Modify: `src/components/BrowsePanel.svelte`

When the Variant filter is "Agility", Scale / Key / Hand chip rows have no effect on the result list — they should be visually dimmed and unclickable. Same for Hand when Variant is "Arpeggios".

- [ ] **Step 1: Add `$derived` disabled flags + effective filter values**

In `src/components/BrowsePanel.svelte`, find the existing `const results = $derived.by(...)` block (around line 123). BEFORE that block, add:

```ts
  // When the user picks a Variant whose universe entries are canonical
  // (no scale / key / hand variation), the corresponding filter rows
  // don't affect the result list — grey them out and treat them as 'any'
  // so a stale stored value doesn't quietly filter results to empty.
  const scaleDisabled = $derived(variantFamily === 'agility');
  const keyDisabled = $derived(variantFamily === 'agility');
  const handDisabled = $derived(
    variantFamily === 'agility' || variantFamily === 'arpeggios',
  );

  const effectiveScaleId = $derived(scaleDisabled ? 'any' : scaleId);
  const effectiveKeyId = $derived(keyDisabled ? 'any' : keyId);
  const effectiveHand = $derived(handDisabled ? 'any' : hand);
```

- [ ] **Step 2: Use the effective values in the `results` filter**

Replace the existing `results` derivation (lines around 123-140) so the Scale / Key / Hand filter clauses use the `effective*` variables instead of the raw state:

```ts
  const results = $derived.by(() =>
    fullUniverse.filter((p) => {
      if (
        effectiveScaleId !== 'any' &&
        p.scale.name !== SCALES[effectiveScaleId as ScaleId]?.name
      ) {
        return false;
      }
      if (
        effectiveKeyId !== 'any' &&
        p.rootName !== KEYS.find((k) => k.id === effectiveKeyId)?.name
      )
        return false;
      if (effectiveHand !== 'any' && p.handPosition !== effectiveHand) return false;
      if (variantFamily !== 'any' && !matchVariantFamily(p.variant, variantFamily))
        return false;
      if (openStrings === 'open' && !p.useOpenStrings) return false;
      if (openStrings === 'fretted' && p.useOpenStrings) return false;
      return true;
    }),
  );
```

Only the Scale / Key / Hand checks change (use `effective*`). The Variant and Open-strings checks remain the same.

- [ ] **Step 3: Apply the `.disabled` class + hint text to Scale / Key / Hand sections**

In `BrowsePanel.svelte`, find the Scale `<section>` (now at around position 3 after Task 4's reorder). Wrap it conditionally with the disabled state:

```svelte
    <section class:disabled={scaleDisabled}>
      <label class="row">
        <span class="lbl">Scale</span>
        <select bind:value={scaleId}>
          <!-- existing options -->
        </select>
        {#if scaleDisabled}
          <span class="hint">Not applicable for {variantFamily}</span>
        {/if}
      </label>
    </section>
```

Same pattern for Key:

```svelte
    <section class:disabled={keyDisabled}>
      <span class="lbl">Key</span>
      {#if keyDisabled}
        <span class="hint">Not applicable for {variantFamily}</span>
      {/if}
      <div class="chips">
        <!-- existing chip buttons -->
      </div>
    </section>
```

Same pattern for Hand:

```svelte
    <section class:disabled={handDisabled}>
      <span class="lbl">Hand</span>
      {#if handDisabled}
        <span class="hint">Not applicable for {variantFamily}</span>
      {/if}
      <div class="chips">
        <!-- existing chip buttons -->
      </div>
    </section>
```

- [ ] **Step 4: Add the `.disabled` CSS**

In the `<style>` block at the bottom of `BrowsePanel.svelte`, add:

```css
  section.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  section.disabled .hint {
    font-size: 12px;
    color: var(--text-dim);
    margin-left: 8px;
  }
```

(Reuse `var(--text-dim)`, which is already in the codebase's CSS variables palette.)

- [ ] **Step 5: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/BrowsePanel.svelte
git commit -m "feat(browse): grey out inapplicable filters for Agility/Arpeggios"
```

---

## Task 6: Manual UI verification

**No code changes — verification gate.**

The preview tool's Electron context doesn't render AlphaTab so we'll just verify the UI structure via DOM (and the user verifies visually in a real browser later).

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app in a real browser at the printed URL.**

- [ ] **Step 3: Settings panel verification**
- Open Settings (⚙ button).
- Top of panel: confirm "Enable all" and "Reset to defaults" buttons appear in a row above the Bass section.
- Click "Enable all". All multi-toggle sections (variants, arpeggios, agility, keys, scales, hand positions) should flip to fully enabled.
- Manually disable a few items.
- Click "Reset to defaults". Confirm prompt appears. Accept. Settings revert to defaults BUT tuning stays the same.
- For each of the 6 multi-toggle sections (Hand positions, Variants, Arpeggios, Hand-agility drills, Keys, Scales): click the section's "All" button — only that section flips on. Click "None" — only that section flips off.
- Close Settings, reload page. Confirm changes persisted to localStorage.

- [ ] **Step 4: Browse panel verification**
- Open Browse (🔍 button).
- Confirm filter order top-to-bottom: Tuning → Variant → Scale → Key → Hand → Open strings.
- Set Variant = "Agility". Confirm Scale, Key, Hand chip rows go semi-transparent + show "Not applicable for agility" inline hint. The result list should show agility entries despite any previously-set Scale/Key/Hand values.
- Set Variant = "Arpeggios". Confirm ONLY the Hand row greys out (Scale and Key stay clickable).
- Set Variant = "Plain scale". Confirm all three rows re-enable; previously-selected Scale / Key / Hand values are still selected (kept in state, just visible again).

- [ ] **Step 5: If anything looks wrong, report. Otherwise no commit.**

---

## Task 7: Update `docs/plan.md`

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Add a "Recent additions" bullet for the QoL improvements**

In `docs/plan.md`, find the "Recent additions (post-MVP polish)" section. Add a new bullet at the top:

```markdown
- [x] **Settings + Browse quality-of-life.** Settings panel gets top "Enable all" + "Reset to defaults" buttons plus per-section "All"/"None" pairs on 6 sections (Hand positions, Variants, Arpeggios, Hand-agility drills, Keys, Scales). Browse panel reorders so Variant filter sits right under Tuning, and Scale/Key/Hand chip rows grey out when the chosen Variant doesn't use them (Arpeggios hides Hand; Agility hides Scale/Key/Hand). Spec: [docs/superpowers/specs/2026-05-19-settings-quality-of-life-design.md](superpowers/specs/2026-05-19-settings-quality-of-life-design.md).
```

- [ ] **Step 2: Commit**

```bash
git add docs/plan.md
git commit -m "docs(settings): note bulk-toggles + browse polish in plan.md"
```

---

## Self-review checklist

After all tasks:

- [ ] All 7 helper functions defined and wired to buttons.
- [ ] Top button row appears as first child of `<div class="body">`.
- [ ] Section headers wrapped consistently for 6 sections (Bass / Display / Metronome unchanged).
- [ ] Browse filter order: Tuning → Variant → Scale → Key → Hand → Open strings.
- [ ] Grey-out works for Agility (Scale/Key/Hand) and Arpeggios (Hand only).
- [ ] `effectiveScaleId` / `effectiveKeyId` / `effectiveHand` used in the `results` derivation.
- [ ] `npm run check` clean. `npx vitest run` passes.
- [ ] Manual UI verification passed.
