import bounds from "./road-map/index.json";
export function roadMapPosition(lat: number, lng: number) {
  const n = 2 ** bounds.zoom;
  const x = (((lng + 180) / 360) * n - bounds.x) * 256;
  const y =
    (((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n -
      bounds.y) *
    256;
  return { x, y, available: x >= 128 && y >= 100 && x <= 640 && y <= 668 };
}
