import { writable, get, type Writable } from 'svelte/store';

const STORAGE_KEY = 'bass-practice:history:v1';

interface HistoryState {
  items: string[];
}

function load(): HistoryState {
  if (typeof localStorage === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as HistoryState;
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function persist(state: HistoryState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function createHistoryStore(): Writable<HistoryState> & {
  push: (key: string, limit: number) => void;
  asSet: () => Set<string>;
  clear: () => void;
} {
  const store = writable<HistoryState>(load());
  store.subscribe(persist);
  return {
    ...store,
    push(key: string, limit: number) {
      store.update((s) => {
        const items = [key, ...s.items.filter((k) => k !== key)].slice(0, limit);
        return { items };
      });
    },
    asSet() {
      return new Set(get(store).items);
    },
    clear() {
      store.set({ items: [] });
    },
  };
}

export const history = createHistoryStore();
