<script lang="ts">
  import { practiceLog } from '../stores/practice-log';
  import { settings } from '../stores/settings';
  import { generateUniverse } from '../exercises/picker';
  import { cellKeyFor } from '../stores/practice-log';
  import type { ExerciseParams } from '../exercises/types';

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (params: ExerciseParams) => void;
  }
  let { open, onClose, onPick }: Props = $props();

  // Universe + derived cell-key set — recomputed only when settings change.
  const enabledCellKeys = $derived.by<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const p of generateUniverse($settings)) {
      set.add(cellKeyFor(p));
    }
    return set;
  });

  // Aggregate totals from the store.
  const totalSessions = $derived(
    Object.values($practiceLog.cells).reduce((sum, c) => sum + c.count, 0),
  );
  const coverageStats = $derived(practiceLog.coverage(enabledCellKeys));
  const coveragePct = $derived(
    coverageStats.total === 0 ? 0 : Math.round((coverageStats.played / coverageStats.total) * 100),
  );
  const todayN = $derived.by(() => {
    // Re-evaluate whenever events change (the $practiceLog dependency).
    void $practiceLog.recentEvents.length;
    return practiceLog.todayCount();
  });

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

  {#if totalSessions === 0}
    <p class="empty">No history yet — click ✓ Done after practicing an exercise to start tracking.</p>
  {:else}
    <p class="placeholder">Neglected list goes here (Task 8).</p>
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
  .empty,
  .placeholder {
    color: var(--text-dim);
    font-size: 13px;
    text-align: center;
    padding: 24px 8px;
  }
</style>
