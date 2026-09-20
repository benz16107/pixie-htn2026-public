import { File, Paths } from "expo-file-system";
import { parseDevice, type RoadDevice } from "./evidence";
const file = () => new File(Paths.document, "pixie-road-device.json");
export async function readDevice() {
  const f = file();
  return parseDevice(f.exists ? await f.text() : null);
}
export async function writeDevice(value: RoadDevice) {
  await file().write(JSON.stringify(value));
}
export async function readMedia(uri: string) {
  return new File(uri).base64();
}
