export const ROOMS = ['Living room', 'Bedroom', 'Kitchen', 'Other'] as const;
export type Room = typeof ROOMS[number];
export type InventoryItem = { id: string; name: string; room: Room; value: number; photo?: string; example?: boolean };
export const SAMPLE_ITEMS: InventoryItem[] = [
  { id: 'sample-sofa', name: 'Sofa', room: 'Living room', value: 1400, example: true },
  { id: 'sample-tv', name: 'Television', room: 'Living room', value: 900, example: true },
  { id: 'sample-laptop', name: 'Laptop', room: 'Bedroom', value: 1800, example: true },
  { id: 'sample-table', name: 'Dining set', room: 'Kitchen', value: 750, example: true },
];
export function inventoryTotal(items: InventoryItem[]) { return items.reduce((total, item) => total + Math.round(item.value * 100), 0) / 100; }
export function contentsFromInventory(items: InventoryItem[]): number | null {
  const total = inventoryTotal(items);
  return !items.length || total > 100000 ? null : Math.max(10000, Math.ceil(total / 5000) * 5000);
}
export function parseInventory(raw: string | null): InventoryItem[] {
  if (!raw) return [];
  const items: unknown = JSON.parse(raw);
  if (!Array.isArray(items) || !items.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && ROOMS.includes(item.room) && Number.isFinite(item.value) && item.value > 0 && item.value <= 100000 && (item.photo === undefined || typeof item.photo === 'string'))) throw new Error('The saved inventory could not be read.');
  return items;
}
