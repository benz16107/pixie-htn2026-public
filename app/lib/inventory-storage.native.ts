import { Directory, File, Paths } from 'expo-file-system';
import { parseInventory, type InventoryItem } from './inventory';
const folder = () => new Directory(Paths.document, 'pixie-inventory');
const manifest = () => new File(folder(), 'items.json');
export async function readInventory() {
  const file = manifest();
  return parseInventory(file.exists ? await file.text() : null);
}
export async function writeInventory(items: InventoryItem[]) {
  await folder().create({ intermediates: true, idempotent: true });
  await manifest().write(JSON.stringify(items));
}
export async function keepPhoto(uri: string, id: string) {
  await folder().create({ intermediates: true, idempotent: true });
  const photo = new File(folder(), `${id}-${Date.now()}.jpg`);
  await new File(uri).copy(photo);
  return photo.uri;
}
export async function removePhoto(uri?: string) {
  const root = folder().uri.replace(/\/$/, '') + '/';
  if (uri?.startsWith(root)) {
    const file = new File(uri);
    if (file.exists) await file.delete();
  }
}
