"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Hex } from "@/contract";
import { earthTone } from "../BookMap";

export type MapPin = { caseId: string; insured: string; lat: number; lng: number; state: "waiting" | "working" | "settled"; decision: string };
export type Pulse = { id: string; lat: number; lng: number; label: string };

const FILL: Record<string, string> = {
  open: "#0a0d10",
  decline: "#e2594a",
  refer: "#f0a437",
  accept: "#35b88a",
  approve: "#35b88a",
  routed: "#5d6a75",
};

export default function DeskMap({
  pins,
  hexes,
  focus,
  pulses,
  onPick,
  reduced,
}: {
  pins: MapPin[];
  hexes: Hex[];
  focus: { lat: number; lng: number; zoom: number } | null;
  pulses: Pulse[];
  onPick: (caseId: string) => void;
  reduced: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const [cam, setCam] = useState({ lat: 38, lng: -96, zoom: 3.2 });
  const [size, setSize] = useState({ w: 640, h: 520 });
  const [trouble, setTrouble] = useState("");

  useEffect(() => {
    if (!box.current) return;
    const el = box.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      map.current?.resize();
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    let m: MapLibre;
    try {
      m = new MapLibre({
      container: el,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-96, 38],
      zoom: 3.2,
      interactive: true,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch {
      setTrouble("no WebGL on this machine, showing hexes only");
      return () => ro.disconnect();
    }
    m.on("style.load", () => earthTone(m));
    m.on("error", (e) => setTrouble(e.error?.message ?? "map error"));
    // If the basemap has not drawn in 6s the demo still needs a map: hexes and pins on paper.
    const watchdog = setTimeout(() => setTrouble((t) => t || "map tiles unavailable, showing hexes only"), 6000);
    m.once("idle", () => {
      clearTimeout(watchdog);
      setTrouble("");
    });
    const sync = () => {
      const c = m.getCenter();
      setCam({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
    };
    m.on("move", sync);
    m.on("moveend", sync);
    map.current = m;
    return () => {
      clearTimeout(watchdog);
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  const flownTo = useRef("");
  useEffect(() => {
    const m = map.current;
    if (!m || !focus) return;
    // Only move when the target actually changes: otherwise every render restarts the flight.
    const key = `${focus.lat},${focus.lng},${focus.zoom}`;
    if (flownTo.current === key) return;
    flownTo.current = key;
    const to = { center: [focus.lng, focus.lat] as [number, number], zoom: focus.zoom };
    if (reduced) m.jumpTo(to);
    else m.flyTo({ ...to, duration: 1400, curve: 1.3, essential: true });
  }, [focus, reduced]);

  // Project with the camera in state, so the overlay is a pure function of what React knows.
  const merc = (lat: number, lng: number, z: number) => {
    const w = 512 * 2 ** z;
    const s = Math.sin((lat * Math.PI) / 180);
    return [((lng + 180) / 360) * w, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * w];
  };
  const [ox, oy] = merc(cam.lat, cam.lng, cam.zoom);
  const at = (lat: number, lng: number) => {
    const [x, y] = merc(lat, lng, cam.zoom);
    return { x: x - ox + size.w / 2, y: y - oy + size.h / 2 };
  };

  return (
    // Land and contours sit under the canvas: when tiles fail the panel still reads as a map.
    <div className="absolute inset-0 bg-water">
      <div ref={box} className="h-full w-full" />
      {trouble && (
        <p className="absolute bottom-2 left-2 z-10 rounded-sm border border-rule bg-paper/90 px-2 py-0.5 font-mono text-[10px] text-dim">{trouble}</p>
      )}
      <svg className="absolute inset-0" width={size.w} height={size.h} style={{ pointerEvents: "none" }} aria-hidden>
        {hexes.map((h) => {
          const pts = h.ring.map(([la, ln]) => { const p = at(la, ln); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
          return <polygon key={h.cell} points={pts} fill="#f0a437" fillOpacity={0.07 + h.level * 0.09} stroke="#b87d24" strokeOpacity={0.5} strokeWidth={1} />;
        })}
        {pulses.map((p) => {
          const { x, y } = at(p.lat, p.lng);
          return (
            <g key={p.id}>
              <circle className="pulse-ring" cx={x} cy={y} r={10} fill="none" stroke="#e2594a" strokeWidth={2} />
              <circle className="pulse-ring pulse-ring-2" cx={x} cy={y} r={10} fill="none" stroke="#e2594a" strokeWidth={1.5} />
            </g>
          );
        })}
        {pins.map((p) => {
          const { x, y } = at(p.lat, p.lng);
          const working = p.state === "working";
          return (
            <g key={p.caseId} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={() => onPick(p.caseId)}>
              <title>{`#${p.caseId} ${p.insured}: ${p.state === "settled" ? p.decision : p.state}`}</title>
              {working && <circle className="pulse-ring" cx={x} cy={y} r={9} fill="none" stroke="#cfd7dd" strokeWidth={1.5} />}
              <circle
                cx={x}
                cy={y}
                r={p.state === "waiting" ? 4.5 : 7}
                fill={p.state === "settled" ? (FILL[p.decision] ?? FILL.routed) : "#0a0d10"}
                stroke="#cfd7dd"
                strokeWidth={working ? 2.5 : 1.5}
                className="pin"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
