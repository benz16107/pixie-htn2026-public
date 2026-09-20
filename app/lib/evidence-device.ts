import { parseDevice, type RoadDevice } from "./evidence";
const KEY = "pixie-road-device-v1";
export async function readDevice() {
  return parseDevice(localStorage.getItem(KEY));
}
export async function writeDevice(value: RoadDevice) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export async function readMedia(uri: string) {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
