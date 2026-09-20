import { parseInventory, type InventoryItem } from './inventory';
const KEY = 'pixie-inventory-v1';
export async function readInventory() { return parseInventory(localStorage.getItem(KEY)); }
export async function writeInventory(items: InventoryItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); }
export async function keepPhoto(uri: string, _id: string): Promise<string> {
  if (!uri.startsWith('data:image/')) throw new Error('Choose the photo again before saving.');
  return uri;
}
export async function removePhoto(_uri?: string) {}
