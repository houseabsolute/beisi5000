<script lang="ts">
  import { practiceLog } from '../stores/practice-log';
  import { settings } from '../stores/settings';
  import { generateUniverse } from '../exercises/picker';
  import { cellKeyFor, familyForVariant } from '../stores/practice-log';
  import type { ExerciseParams } from '../exercises/types';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (params: ExerciseParams) => void;
  }
  let { open, onClose, onPick }: Props = $props();

  // Single pass over the enabled universe: bucket all params by cellKey
  // so we can render labels, compute coverage, and pick a random
  // exercise for a row without traversing the universe again.
  const paramsByCell = $derived.by<Map<string, ExerciseParams[]>>(() => {
    const m = new Map<string, ExerciseParams[]>();
    for (const p of generateUniverse($settings)) {
      const k = cellKeyFor(p);
      const arr = m.get(k);
      if (arr) arr.push(p);
      else m.set(k, [p]);
    }
    return m;
  });

  const enabledCellKeys = $derived.by<ReadonlySet<string>>(() => new Set(paramsByCell.keys()));

  // Aggregate totals from the store.
  const totalSessions = $derived(
    Object.values($practiceLog.cells).reduce((sum, c) => sum + c.count, 0),
  );
  const coverageStats = $derived.by(() => {
    let played = 0;
    for (const key of enabledCellKeys) {
      if ($practiceLog.cells[key]?.count) played++;
    }
    return { played, total: enabledCellKeys.size };
  });
  const coveragePct = $derived(
    coverageStats.total === 0 ? 0 : Math.round((coverageStats.played / coverageStats.total) * 100),
  );
  const todayN = $derived.by(() => {
    // Re-evaluate whenever events change (the $practiceLog dependency).
    void $practiceLog.recentEvents.length;
    return practiceLog.todayCount();
  });

  interface Row {
    cellKey: string;
    label: string;       // e.g. "C Major — Walking ↑"
    count: number;
    lastPlayedTs: number | null;
  }

  const FAMILY_LABEL: Record<string, string> = {
    plain: 'Plain scale',
    multiOctave: 'Multi-octave',
    consecutive: 'Consecutive groups',
    mirror: 'Mirror groups',
    walkUp: 'Walking ↑',
    walkDown: 'Walking ↓',
    arpeggios: 'Arpeggios',
    agility: 'Agility',
  };

  function rowLabel(p: ExerciseParams): string {
    const family = familyForVariant(p.variant);
    const familyLabel = FAMILY_LABEL[family] ?? family;
    if (family === 'agility') {
      return `${p.tuning.name} — Agility`;
    }
    const root = p.rootName ?? '';
    return `${root} ${p.scale.name} — ${familyLabel}`;
  }

  const ROW_CAP = 50;
  const rows = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    for (const [cellKey, paramsList] of paramsByCell) {
      const cell = $practiceLog.cells[cellKey];
      out.push({
        cellKey,
        label: rowLabel(paramsList[0]),
        count: cell?.count ?? 0,
        lastPlayedTs: cell?.lastPlayedTs ?? null,
      });
    }
    // Sort: never-played first, then oldest-played first.
    out.sort((a, b) => {
      if (a.count === 0 && b.count !== 0) return -1;
      if (b.count === 0 && a.count !== 0) return 1;
      if (a.count === 0 && b.count === 0) return a.label.localeCompare(b.label);
      return (a.lastPlayedTs ?? 0) - (b.lastPlayedTs ?? 0);
    });
    return out.slice(0, ROW_CAP);
  });

  function pillText(r: Row): string {
    if (r.count === 0) return 'never';
    const days = Math.floor((Date.now() - (r.lastPlayedTs ?? 0)) / (24 * 60 * 60 * 1000));
    const dayStr = days === 0 ? 'today' : `${days}d`;
    return r.count > 1 ? `${dayStr} · ${r.count}×` : dayStr;
  }

  function pillClass(r: Row): string {
    if (r.count === 0) return 'pill never';
    const days = Math.floor((Date.now() - (r.lastPlayedTs ?? 0)) / (24 * 60 * 60 * 1000));
    if (days > 14) return 'pill old';
    return 'pill fresh';
  }

  function pickRandomFromCell(cellKey: string): void {
    const matches = paramsByCell.get(cellKey);
    if (!matches || matches.length === 0) return;
    const pick = matches[Math.floor(Math.random() * matches.length)];
    onPick(pick);
    onClose();
  }

  function confirmClear(): void {
    if (typeof window === 'undefined') return;
    if (window.confirm('Clear all practice history?')) {
      practiceLog.clear();
    }
  }
</script>

{#if open}
  <button
    class="scrim"
    onclick={onClose}
    aria-label="Close history"
    type="button"
  ></button>
{/if}

<aside class="panel" class:open>
  <header>
    <h2>History</h2>
    <div class="header-actions">
      <button class="clear-btn" onclick={confirmClear} type="button">Clear</button>
      <button class="close" onclick={onClose} aria-label="Close">✕</button>
    </div>
  </header>

  <div class="totals">
    <div class="stat">
      <div class="stat-value">{totalSessions}</div>
      <div class="stat-label">Sessions</div>
    </div>
    <div class="stat">
      <div class="stat-value">{coveragePct}%</div>
      <div class="stat-label">Coverage</div>
    </div>
    <div class="stat">
      <div class="stat-value">{todayN}</div>
      <div class="stat-label">Today</div>
    </div>
  </div>

  {#if rows.length === 0}
    <p class="empty">No history yet — click ✓ Done after practicing an exercise to start tracking.</p>
  {:else}
    <h3 class="section-title">Neglected first</h3>
    <ul class="rows">
      {#each rows as r (r.cellKey)}
        <li>
          <button
            class="row-btn"
            onclick={() => pickRandomFromCell(r.cellKey)}
            type="button"
          >
            <span class="row-label">{r.label}</span>
            <span class={pillClass(r)}>{pillText(r)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: pointer;
    z-index: 50;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(420px, 92vw);
    height: 100vh;
    background: var(--panel);
    color: var(--text);
    border-left: 1px solid var(--border);
    padding: 16px;
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.18s ease-out;
    z-index: 60;
  }
  .panel.open {
    transform: translateX(0);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  header h2 {
    margin: 0;
    font-size: 18px;
  }
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .clear-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: var(--text);
    border-color: var(--text-dim);
  }
  .close {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 18px;
    cursor: pointer;
  }
  .totals {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .stat {
    flex: 1;
    text-align: center;
  }
  .stat-value {
    font-size: 22px;
    font-weight: 600;
    color: var(--accent);
  }
  .stat-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .empty {
    color: var(--text-dim);
    font-size: 13px;
    text-align: center;
    padding: 24px 8px;
  }
  .section-title {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 4px 0 8px 0;
  }
  .rows {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .rows li {
    margin: 0;
  }
  .row-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    padding: 8px 4px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  .row-btn:hover {
    background: var(--panel-2);
  }
  .row-label {
    flex: 1;
  }
  .pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }
  .pill.never {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }
  .pill.old {
    background: rgba(253, 224, 71, 0.15);
    color: #d4a72c;
  }
  .pill.fresh {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }
</style>
