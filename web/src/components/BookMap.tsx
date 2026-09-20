"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapLibre, LngLatBounds, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Hex } from "@/contract";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { METRICS, metricColor, sites, siteValue, isClimate, geoValue, type MapLayer, type CountyGeoJSON } from '@/lib/geography';
import statesData from "@/fixtures/us-states.json";
const states = statesData as FeatureCollection<Polygon | MultiPolygon>;

const OFFLINE_STYLE: StyleSpecification = {
          version: 8,
          sources: { states: { type: "geojson", data: states, attribution: '<a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html">US Census 2024</a>' } },
          layers: [
            { id: "water", type: "background", paint: { "background-color": "#0d181d" } },
            { id: "land", type: "fill", source: "states", paint: { "fill-color": "#19242b" } },
            { id: "borders", type: "line", source: "states", paint: { "line-color": "#53636c", "line-width": 1 } },
          ],
        };

export type Pin = { caseId: string; insured: string; decision: string; site: { lat: number; lng: number }; cell: string; perils?: string[]; ring?: [number, number][] };

// The bundler hides the worker file MapLibre looks for next to its module; postinstall copies it to public/.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const pinsInPaintOrder = (pins: Pin[]) => [...pins].sort((a, b) => Number(a.decision === "open") - Number(b.decision === "open"));

type RGBA = [number, number, number, number];
const INK: RGBA = [207, 215, 221, 255];
const PAPER: RGBA = [10, 13, 16, 255];
export const PIN_FILL: Record<string, RGBA> = {
  open: PAPER, // hollow, ringed in ink: still undecided
  decline: [226, 89, 74, 255],
  refer: [240, 164, 55, 255],
  accept: [53, 184, 138, 255],
  approve: [53, 184, 138, 255],
  routed: [93, 106, 117, 190],
};

/**
 * Re-paints OpenFreeMap's Positron layer by layer into the night desk instead of shipping a
 * custom style. Kept deliberately low-contrast: the map is a backdrop for the hexes and pins.
 */
export function earthTone(map: MapLibre) {
  for (const l of map.getStyle().layers) {
    const id = l.id;
    if (l.type === "background") map.setPaintProperty(id, "background-color", "#0b0f13");
    else if (l.type === "fill")
      map.setPaintProperty(id, "fill-color", id.includes("water") ? "#0d181d" : id === "park" || id.includes("wood") ? "#101a16" : "#121a21");
    else if (l.type === "line")
      map.setPaintProperty(id, "line-color", id.includes("water") ? "#17303a" : id.startsWith("boundary") ? "#33414b" : "#1d262e");
    else if (l.type === "symbol") {
      map.setPaintProperty(id, "text-color", id.startsWith("water") ? "#4e6a72" : "#95a3af");
      map.setPaintProperty(id, "text-halo-color", "#080b0e");
    }
  }
}

export default function BookMap({
  hexes,
  pins,
  center,
  zoom,
  highlight,
  compact = false,
  perspective = false,
  contextLayer = 'exposure',
  countyData,
  selectedCounty,
  selectedSite,
  showExposure = true,
  onCountySelect,
  onSiteSelect,
}: {
  hexes: Hex[];
  pins: Pin[];
  center: [number, number]; // [lng, lat]
  zoom: number;
  highlight?: string;
  compact?: boolean;
  perspective?: boolean;
  contextLayer?: MapLayer;
  countyData?: CountyGeoJSON;
  selectedCounty?: string;
  selectedSite?: string;
  showExposure?: boolean;
  onCountySelect?: (id: string) => void;
  onSiteSelect?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [trouble, setTrouble] = useState("");
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!box.current) return;
    let map: MapLibre;
    let styleReady = false;
    let styleTimer = 0;
    let offlineStyle = false;
    const loadOfflineStyle = () => {
      if (offlineStyle) return;
      offlineStyle = true;
      setOffline(true);
      map.setStyle(OFFLINE_STYLE);
    };
    try {
      map = new MapLibre({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center,
        zoom,
        pitch: perspective ? 40 : 0,
        bearing: perspective ? -8 : 0,
        attributionControl: { compact: true },
        interactive: !compact,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Map rendering is unavailable";
      const id = window.setTimeout(() => setTrouble(message), 0);
      return () => window.clearTimeout(id);
    }
    if (!compact) map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    styleTimer = window.setTimeout(() => {
      if (!styleReady) loadOfflineStyle();
    }, 5000);
    map.on("style.load", () => { if (!offlineStyle) earthTone(map); });
    map.on("load", () => {
      styleReady = true;
      window.clearTimeout(styleTimer);
      setTrouble("");
      setReady(true);
    });
    map.on("error", (e) => {
      const message = e.error?.message ?? "The map renderer is unavailable";
      console.error("maplibre", message);
      if (!styleReady) loadOfflineStyle();
    });
    overlay.current = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay.current);
    mapRef.current = map;
    if (!compact) map.fitBounds([[-125, 24], [-66, 50]], { padding: { top: 60, bottom: 65, left: 35, right: 35 }, duration: 0 });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(box.current);
    return () => {
      window.clearTimeout(styleTimer);
      resize.disconnect();
      mapRef.current = null;
      map.remove();
    };
    // center/zoom only seed the camera; later changes are the user's pans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (compact) { map.jumpTo({ pitch: perspective ? 40 : 0, bearing: perspective ? -8 : 0 }); return; }
    const selected = hexes.find((hex) => hex.cell === highlight);
    const bounds = new LngLatBounds();
    if (selected) selected.ring.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    else { bounds.extend([-125, 24]); bounds.extend([-66, 50]); }
    map.fitBounds(bounds, { padding: { top: 60, bottom: 65, left: 35, right: 35 }, maxZoom: 6, pitch: perspective ? 40 : 0, bearing: perspective ? -8 : 0, duration: 0 });
  }, [highlight, hexes, compact, perspective]);

  useEffect(() => {
    const maxValue = Math.max(1, ...hexes.map((hex) => hex.value));
    overlay.current?.setProps({
      getTooltip: ({ object }) =>
        object?.properties?.name && contextLayer !== 'exposure' && !isClimate(contextLayer)
          ? `${object.properties.name}, ${object.properties.state}\n${METRICS[contextLayer].label}: ${geoValue(object.properties[contextLayer])} ${METRICS[contextLayer].unit}`
          : object && "insured" in object
          ? `#${object.caseId} ${object.insured} · ${object.decision}${contextLayer !== "exposure" ? `\n${METRICS[contextLayer].label}: ${geoValue(siteValue(sites.get(object.caseId), contextLayer))} ${METRICS[contextLayer].unit}` : ""}`
          : object && "value" in object
            ? `${perspective ? "Tower height" : "Cell shade"}: $${(object.value / 1e6).toFixed(1)}M active TIV`
            : null,
      layers: [
        new GeoJsonLayer({
          id: 'county-context', data: countyData ?? { type: 'FeatureCollection', features: [] },
          visible: contextLayer !== 'exposure' && !isClimate(contextLayer),
          filled: true, stroked: true, pickable: !compact,
          getFillColor: feature => contextLayer !== 'exposure' ? metricColor(contextLayer, feature.properties?.[contextLayer]) : [0,0,0,0],
          getLineColor: feature => feature.properties?.id === selectedCounty ? [255,245,211,255] : [110,129,140,100],
          getLineWidth: feature => feature.properties?.id === selectedCounty ? 2.5 : 0.4,
          lineWidthUnits: 'pixels',
          onClick: ({ object }) => { if (object?.properties?.id) onCountySelect?.(object.properties.id); },
          updateTriggers: { getFillColor: contextLayer, getLineColor: selectedCounty, getLineWidth: selectedCounty },
        }),
        new PolygonLayer<Hex>({
          id: "hexes",
          visible: showExposure,
          data: hexes,
          getPolygon: (h) => h.ring.map(([lat, lng]) => [lng, lat]),
          extruded: perspective,
          elevationScale: perspective ? 1 : 0,
          getElevation: (h) => (h.value / maxValue) * 350_000,
          getFillColor: (h) => [183, 129, 58, perspective ? 105 + h.level * 24 : 40 + h.level * 45],
          getLineColor: (h) => (h.cell === highlight ? INK : [143, 99, 39, 160]),
          getLineWidth: (h) => (h.cell === highlight ? 3 : 1),
          lineWidthUnits: "pixels",
          wireframe: false,
          material: {
            ambient: 0.38,
            diffuse: 0.62,
            shininess: 24,
            specularColor: [225, 190, 126],
          },
          pickable: !compact,
          transitions: { getElevation: 500 },
          updateTriggers: {
            getElevation: [maxValue, perspective],
            getFillColor: perspective,
            getLineColor: highlight,
            getLineWidth: highlight,
          },
        }),
        new ScatterplotLayer<Pin>({
          id: "pins",
          data: pinsInPaintOrder(pins),
          getPosition: (p) => [p.site.lng, p.site.lat],
          getFillColor: (p) => isClimate(contextLayer) ? metricColor(contextLayer, siteValue(sites.get(p.caseId), contextLayer)) : PIN_FILL[p.decision] ?? PIN_FILL.routed,
          getLineColor: (p) => (p.caseId === selectedSite || p.decision === "open" ? INK : PAPER),
          getRadius: (p) => (p.caseId === selectedSite ? 11 : isClimate(contextLayer) ? 8 : p.decision === "open" ? 8 : 6),
          radiusUnits: "pixels",
          lineWidthUnits: "pixels",
          getLineWidth: 2,
          stroked: true,
          pickable: !compact,
          onClick: ({ object }) => { if (object) { if (onSiteSelect) onSiteSelect(object.caseId); else router.push(`/cases/${object.caseId}`); } },
          updateTriggers: { getFillColor: contextLayer, getLineColor: selectedSite, getRadius: [contextLayer, selectedSite] },
        }),
      ],
    });
  }, [hexes, pins, highlight, compact, perspective, router, countyData, contextLayer, selectedCounty, selectedSite, showExposure, onCountySelect, onSiteSelect]);

  // maplibre-gl.css sets .maplibregl-map to position: relative, outranking layered utilities, so size the parent.
  return (
    <div className="absolute inset-0" data-map-ready={ready || !!trouble}>
      {!ready && !trouble && <div role="status" aria-label="Loading portfolio map" className="absolute inset-0 z-10 animate-pulse bg-land motion-reduce:animate-none" />}
      {offline && !trouble && <span className="absolute bottom-2 right-3 z-10 text-[10px] text-dim">Offline basemap · US Census 2024</span>}
      {trouble && <MapFallback hexes={hexes} pins={pins} perspective={perspective} reason={trouble} contextLayer={contextLayer} countyData={countyData} onCountySelect={onCountySelect} onSiteSelect={onSiteSelect} showExposure={showExposure} />}
      <div ref={box} className={`h-full w-full ${trouble ? "hidden" : ""}`} />
    </div>
  );
}

function MapFallback({ hexes, pins, perspective, reason, contextLayer, countyData, onCountySelect, onSiteSelect, showExposure }: { hexes: Hex[]; pins: Pin[]; perspective: boolean; reason: string; contextLayer: MapLayer; countyData?: CountyGeoJSON; onCountySelect?: (id:string)=>void; onSiteSelect?: (id:string)=>void; showExposure: boolean }) {
  const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const top = mercatorY(50), bottom = mercatorY(24);
  const point = ([lng, lat]: number[]) => [40 + ((lng + 125) / 59) * 920, 100 + ((top - mercatorY(lat)) / (top - bottom)) * 420];
  const path = (rings: number[][][]) => rings.map((ring) => ring.map((p, i) => `${i ? "L" : "M"}${point(p).join(",")}`).join(" ") + "Z").join(" ");
  return (
    <div className="absolute inset-0 overflow-hidden bg-water">
      <svg viewBox="0 0 1000 600" className="h-full w-full" role="img" aria-label="Portfolio exposure on US Census state boundaries">
        {states.features.map((state, index) => {
          const polygons = state.geometry.type === "Polygon" ? [state.geometry.coordinates] : state.geometry.coordinates;
          return <path key={index} d={polygons.map(path).join(" ")} fill="#19242b" fillRule="evenodd" stroke="#53636c" strokeWidth="1"><title>{state.properties?.name}</title></path>;
        })}
        {contextLayer !== 'exposure' && !isClimate(contextLayer) && countyData?.features.map(feature => {
          const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
          const color = metricColor(contextLayer, feature.properties[contextLayer]);
          return <path key={feature.properties.id} d={polygons.map(path).join(' ')} fill={`rgb(${color.slice(0,3).join(',')})`} stroke="#596974" strokeWidth=".3" onClick={()=>onCountySelect?.(feature.properties.id)}><title>{`${feature.properties.name}: ${geoValue(feature.properties[contextLayer])}`}</title></path>;
        })}
        {showExposure && hexes.map((hex) => <path key={hex.cell} d={path([hex.ring.map(([lat, lng]) => [lng, lat])])} fill="#b7813a" fillOpacity={0.2 + hex.level * 0.15} stroke="#d19a4e" strokeWidth="1"><title>{`$${hex.value.toLocaleString()} active TIV`}</title></path>)}
        {pinsInPaintOrder(pins).map((pin) => {
          const [x, y] = point([pin.site.lng, pin.site.lat]);
          const color = isClimate(contextLayer) ? metricColor(contextLayer,siteValue(sites.get(pin.caseId),contextLayer)) : PIN_FILL[pin.decision] ?? PIN_FILL.routed;
          return <a key={pin.caseId} href={`/cases/${pin.caseId}`} onClick={e=>{if(onSiteSelect){e.preventDefault();onSiteSelect(pin.caseId);}}} aria-label={`Open case ${pin.caseId}, ${pin.insured}`}><circle cx={x} cy={y} r={pin.decision === "open" ? 7 : 5} fill={`rgb(${color.slice(0, 3).join(",")})`} stroke="#cfd7dd" strokeWidth="2"><title>{`#${pin.caseId} ${pin.insured}`}</title></circle></a>;
        })}
      </svg>
      <p className="absolute bottom-2 right-3 text-[10px] text-dim" title={reason}>{perspective ? "3D unavailable · " : ""}Static map · US Census 2024</p>
    </div>
  );
}
