import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { readInventory, writeInventory } from './inventory-storage';
import type { InventoryItem } from './inventory';
const Context = createContext<{ items: InventoryItem[]; ready: boolean; error: string; save: (items: InventoryItem[]) => Promise<void> } | null>(null);
export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writing = useRef(false);
  useEffect(() => { let live = true; readInventory().then(next => { if (live) setItems(next); }).catch(() => { if (live) setError('Your saved inventory is unavailable. Reopen the app before adding more items.'); }).finally(() => { if (live) setReady(true); }); return () => { live = false; }; }, []);
  const save = async (next: InventoryItem[]) => {
    if (!ready || error) throw new Error('Your saved inventory is not ready. Please reopen the app.');
    if (writing.current) throw new Error('An item is still being saved. Try again in a moment.');
    writing.current = true;
    try { await writeInventory(next); setItems(next); } finally { writing.current = false; }
  };
  return <Context.Provider value={{items, ready, error, save}}>{children}</Context.Provider>;
}
export function useInventory() { const value = useContext(Context); if (!value) throw new Error('InventoryProvider missing'); return value; }
