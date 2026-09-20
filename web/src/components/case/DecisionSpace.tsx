"use client";
import { Deck, OrbitView, type Layer } from "@deck.gl/core";
import { ColumnLayer, LineLayer, PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Interval } from "@/contract";
import type { Surface, SurfaceAxis, Tier } from "@/lib/explain";

/**
 * The decision space. The floor is the two facts that move this case; the height of every column is
 * the score interval the engine returns for that combination, so the accept plateau, the hard-fail
 * cliff and the case's own pin are one picture. Every number is read from POST /cases/{id}/surface,
 * which is the same deterministic engine as the waterfall.
 */

const SPAN = 100; // the floor is 100 x 100 world units, centred on the origin
const HALF = SPAN / 2;
const ZS = 0.62; // score points -> world units, so a 100-point column is shorter than the floor is wide
const INK = [207, 215, 221] as const;
const DIM = [149, 163, 175] as const;
const RULE = [49, 61, 71] as const;

const TIER_RGB: Record<Tier, [number, number, number]> = {
  accept: [53, 184, 138], // moss
  open: [240, 164, 55], // ochre
  refer: [240, 164, 55],
  decline: [226, 89, 74], // rust
  routed: [149, 163, 175], // dim
};
const TIER_WORD: Record<Tier, string> = {
  accept: "accept",
  open: "open, it straddles a threshold",
  refer: "refer",
  decline: "decline",
  routed: "routed to another desk",
};

export type Pin = { fact: string; value: number; score: Interval | null; kind: string } | null;

const rgba = (c: readonly number[], a = 255) => [c[0], c[1], c[2], a] as [number, number, number, number];
const nearest = (t: number[], v: number) => t.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(t[best] - v) ? i : best), 0);
const axisT = (a: SurfaceAxis, v: number) => (a.max === a.min ? 0.5 : (v - a.min) / (a.max - a.min));
const px = (t: number) => (t - 0.5) * SPAN;

export default function DecisionSpace({ s, pin }: { s: Surface; pin: Pin }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const deck = useRef<Deck<OrbitView> | null>(null);
  const [slice, setSlice] = useState(() => (s.axes[2] ? nearest(s.axes[2].t, s.axes[2].tAt ?? 0.5) : 0));
  const [renderError, setRenderError] = useState(false);
  const [home, setHome] = useState(HOME);
  const [view, setView] = useState(HOME);

  const [ax, ay, az] = s.axes;
  const shape = s.shape;
  const at = (i: number, j: number) => (shape.length === 3 ? i * shape[1] * shape[2] + j * shape[2] + slice : i * shape[1] + j);

  // Where the case stands. The slider owns its axis; every other axis uses the case's own value.
  const slider = s.axes.findIndex((a) => a.fact === pin?.fact);
  const tOf = (a: SurfaceAxis, k: number) => (k === slider && pin ? axisT(a, pin.value) : (a.tAt ?? 0.5));
  const caseT: [number, number] = [tOf(ax, 0), tOf(ay, 1)];
  const caseScore = (slider >= 0 && pin?.score ? pin.score : s.case) as { lo: number; hi: number };
  const caseTier = (slider >= 0 && pin ? (pin.kind as Tier) : s.case.tier) ?? "open";

  const cells = useMemo(() => {
    const out: { p: [number, number, number]; h: number; c: [number, number, number, number]; tier: Tier; lo: number; hi: number; i: number; j: number }[] = [];
    for (let i = 0; i < shape[0]; i++)
      for (let j = 0; j < shape[1]; j++) {
        const n = at(i, j);
        const lo = s.grid.lo[n];
        const hi = s.grid.hi[n];
        const tier = s.grid.tier[n];
        out.push({ p: [px(ax.t[i]), px(ay.t[j]), lo * ZS], h: Math.max((hi - lo) * ZS, 1.1), c: rgba(TIER_RGB[tier]), tier, lo, hi, i, j });
      }
    return out;
  }, [s, slice]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { accept: 0, open: 0, decline: 0 } as Record<string, number>;
    for (const cell of cells) c[cell.tier === "refer" ? "open" : cell.tier] = (c[cell.tier === "refer" ? "open" : cell.tier] ?? 0) + 1;
    return c;
  }, [cells]);

  const layers = useMemo(
    () => buildLayers({ s, cells, ax, ay, caseT, caseScore, caseTier }),
    [s, cells, caseT[0], caseT[1], caseScore.lo, caseScore.hi, caseTier, slider, slice], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!canvas.current) return;
    if (!canvas.current.getContext("webgl2")) {
      const timer = window.setTimeout(() => setRenderError(true), 0);
      return () => window.clearTimeout(timer);
    }
    deck.current = new Deck<OrbitView>({
      onError: () => setRenderError(true),
      canvas: canvas.current,
      views: new OrbitView({ orbitAxis: "Z", fovy: 44, near: 0.05, far: 6000 }),
      controller: { dragRotate: true, scrollZoom: { speed: 0.012, smooth: true }, dragPan: false },
      viewState: home,
      getTooltip: ({ object }) =>
        object?.tier
          ? {
              text: `${ax.ticks[object.i]} · ${ay.ticks[object.j]}\nscore ${object.lo === object.hi ? object.lo : `${object.lo} to ${object.hi}`}\n${TIER_WORD[object.tier as Tier]}`,
              style: { background: "#2f2a22", color: "#f3efe4", fontSize: "11px", padding: "6px 8px", borderRadius: "4px", whiteSpace: "pre-line", lineHeight: "1.4" },
            }
          : null,
      onViewStateChange: ({ viewState }) => setView(viewState as typeof HOME),
    });
    return () => {
      deck.current?.finalize();
      deck.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    deck.current?.setProps({ layers, viewState: view });
  }, [layers, view]);

  // The case page gives this figure whatever height is left over, so the camera is fitted to the
  // canvas rather than to a number picked at one screen size.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const zoom = Math.log2(Math.max(0.5, Math.min((el.clientHeight || 360) / 160, (el.clientWidth || 900) / 192)));
      setHome((h) => ({ ...h, zoom }));
      setView((v) => ({ ...v, zoom }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = (dOrbit: number, dTilt: number, dZoom: number) =>
    setView((v) => ({
      ...v,
      rotationOrbit: v.rotationOrbit + dOrbit,
      rotationX: Math.max(4, Math.min(86, v.rotationX + dTilt)),
      zoom: Math.max(0.5, Math.min(4.4, v.zoom + dZoom)),
    }));

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, [number, number, number]> = {
      ArrowLeft: [-12, 0, 0],
      ArrowRight: [12, 0, 0],
      ArrowUp: [0, 6, 0],
      ArrowDown: [0, -6, 0],
      "+": [0, 0, 0.3],
      "=": [0, 0, 0.3],
      "-": [0, 0, -0.3],
    };
    if (e.key === "Home") return (e.preventDefault(), setView(home));
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    step(...m);
  };

  const unknown = s.axes.filter((a) => a.uncertainty);
  const flat = counts.accept === 0 && counts.open === 0;

  return (
    <figure className="flex min-h-0 flex-1 flex-col">
      {/* A terrain squashed to 200px reads as a smear. Below that the pane scrolls instead. */}
      <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-sm border border-rule bg-paper">
        {renderError && <div className="absolute inset-0 z-10 overflow-auto bg-paper p-5">
          <p className="mb-3 text-sm text-dim">3D is unavailable in this browser. Computed scenarios:</p>
          <table className="w-full text-left text-xs"><thead><tr><th>{ax.label}</th><th>{ay.label}</th><th>Score</th><th>Decision</th></tr></thead><tbody>{cells.map((cell) => <tr key={`${cell.i}-${cell.j}`} className="border-t border-rule"><td className="py-2">{ax.ticks[cell.i]}</td><td>{ay.ticks[cell.j]}</td><td>{cell.lo === cell.hi ? cell.lo : `${cell.lo}–${cell.hi}`}</td><td>{cell.tier}</td></tr>)}</tbody></table>
        </div>}
        <canvas
          ref={canvas}
          tabIndex={0}
          onKeyDown={onKey}
          aria-label={`Decision space for case ${s.caseId}. ${ax.label} across, ${ay.label} into the screen, score as height. Arrow keys orbit and tilt, plus and minus zoom, Home resets.`}
          className="h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />

        {/* controls: the mouse can orbit and zoom, these do the same without a drag */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <div className="flex overflow-hidden rounded-sm border border-rule bg-paper/90">
            {[
              { k: "left", label: "Orbit left", glyph: "‹", go: () => step(-24, 0, 0) },
              { k: "down", label: "Tilt down", glyph: "⌄", go: () => step(0, -8, 0) },
              { k: "up", label: "Tilt up", glyph: "⌃", go: () => step(0, 8, 0) },
              { k: "right", label: "Orbit right", glyph: "›", go: () => step(24, 0, 0) },
            ].map((b) => (
              <button key={b.k} onClick={b.go} aria-label={b.label} title={b.label} className={CTRL}>
                {b.glyph}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-sm border border-rule bg-paper/90">
            <button onClick={() => step(0, 0, -0.35)} aria-label="Zoom out" title="Zoom out" className={CTRL}>
              −
            </button>
            <button onClick={() => step(0, 0, 0.35)} aria-label="Zoom in" title="Zoom in" className={CTRL}>
              +
            </button>
            <button onClick={() => setView(home)} className={`${CTRL} w-auto px-2 text-[10px]`}>
              Reset
            </button>
          </div>
        </div>

        {/* legend: what the three colours mean, and how much of this slice each one covers */}
        <dl className="absolute left-2 top-2 flex gap-3 rounded-sm border border-rule bg-paper/90 px-2.5 py-1.5 text-[10px]">
          {(["accept", "open", "decline"] as const).map((t) => (
            <span key={t} className="flex items-baseline gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: `rgb(${TIER_RGB[t].join(",")})` }} />
              <dt className="text-dim">{t === "open" ? "open" : t}</dt>
              <dd className="num">{counts[t] ?? 0}</dd>
            </span>
          ))}
          <span className="border-l border-rule pl-3 text-dim">of {cells.length} squares</span>
        </dl>
      </div>

      <figcaption className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        {az && (
          <label className="flex shrink-0 items-center gap-1.5">
            <span className="kicker">{az.label} held at</span>
            <select
              value={slice}
              onChange={(e) => setSlice(+e.target.value)}
              className="num rounded-sm border border-rule bg-paper px-1.5 py-0.5 text-[11px] transition-colors duration-150 hover:border-ochre"
            >
              {az.values.map((v, i) => (
                <option key={v} value={i}>
                  {az.ticks[i]}
                  {i === nearest(az.t, az.tAt ?? -1) && az.at !== null ? "  (this case)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="min-w-0 flex-1 truncate text-dim">
          {flat ? (
            <>
              A known hard failure keeps every scenario below {s.thresholds.decline}.
            </>
          ) : unknown.length ? (
            <>{unknown[0].uncertainty!.text} The vertical line marks its score range.</>
          ) : (
            <>Every square is the engine re-run on that pair of facts. Drag to orbit, scroll to zoom.</>
          )}
        </p>
        <span className="num shrink-0 text-[10px] text-dim">
          {s.points.toLocaleString()} assessments · {s.ms} ms
        </span>
      </figcaption>
    </figure>
  );
}

const CTRL =
  "flex h-6 w-6 items-center justify-center border-r border-rule text-[12px] leading-none text-dim transition-colors duration-150 last:border-r-0 hover:bg-land hover:text-ink active:scale-[0.94]";

const HOME = {
  target: [0, 0, 24] as [number, number, number],
  rotationX: 33,
  rotationOrbit: -28,
  zoom: 1.88,
  minZoom: 0.5,
  maxZoom: 4.4,
  minRotationX: 4,
  maxRotationX: 86,
};

// ---------- the scene ------------------------------------------------------------------------

function buildLayers({
  s,
  cells,
  ax,
  ay,
  caseT,
  caseScore,
  caseTier,
}: {
  s: Surface;
  cells: { p: [number, number, number]; h: number; c: [number, number, number, number]; tier: Tier; lo: number; hi: number; i: number; j: number }[];
  ax: SurfaceAxis;
  ay: SurfaceAxis;
  caseT: [number, number];
  caseScore: { lo: number; hi: number };
  caseTier: Tier;
}): Layer[] {
  const cx = px(caseT[0]);
  const cy = px(caseT[1]);
  const loZ = caseScore.lo * ZS;
  const hiZ = caseScore.hi * ZS;
  const edge = HALF + 6;
  const top = 100 * ZS;

  // the frame: a floor outline, a score ruler, and the case's own crosshair across the floor
  const frame: { path: [number, number, number][]; c: readonly number[]; w: number }[] = [
    { path: [[-edge, -edge, 0], [edge, -edge, 0], [edge, edge, 0], [-edge, edge, 0], [-edge, -edge, 0]], c: RULE, w: 1.2 },
    { path: [[cx, -edge, 0], [cx, edge, 0]], c: DIM, w: 1 },
    { path: [[-edge, cy, 0], [edge, cy, 0]], c: DIM, w: 1 },
  ];
  for (const g of [0, 25, 50, 75, 100]) frame.push({ path: [[-edge, -edge, g * ZS], [-edge + 3, -edge, g * ZS]], c: RULE, w: 1 });

  const thresholds = [
    { at: s.thresholds.decline, c: TIER_RGB.decline, label: `decline below ${s.thresholds.decline}` },
    { at: s.thresholds.accept, c: TIER_RGB.accept, label: `accept at ${s.thresholds.accept}` },
  ];

  // PathLayer extrudes its ribbon in the ground plane, so a vertical segment collapses to nothing.
  // Everything that stands up uses LineLayer.
  const uprights = [
    { a: [-edge, -edge, 0], b: [-edge, -edge, top], c: rgba(RULE), w: 1.2 },
    { a: [cx, cy, 0], b: [cx, cy, hiZ], c: rgba(INK, 205), w: 3 },
    { a: [cx, cy, loZ], b: [cx, cy, hiZ], c: rgba(INK), w: 9 },
  ] as { a: [number, number, number]; b: [number, number, number]; c: [number, number, number, number]; w: number }[];

  // the uncertainty of a missing or estimated fact: a path through the space at the case's other
  // coordinates, riding the terrain, so you can see every score the case could still have
  const unknownAxis = ax.uncertainty ? 0 : ay.uncertainty ? 1 : -1;
  const trail: [number, number, number][] = [];
  if (unknownAxis >= 0) {
    const a = unknownAxis === 0 ? ax : ay;
    const { tLo, tHi } = a.uncertainty!;
    const fixed = unknownAxis === 0 ? caseT[1] : caseT[0];
    const jFixed = nearest((unknownAxis === 0 ? ay : ax).t, fixed);
    // The ends always count, so a tight estimate that falls between two steps still draws a bar.
    const stops = [tLo, ...a.t.filter((t) => t > tLo && t < tHi), tHi];
    for (const t of stops) {
      const i = nearest(a.t, t);
      const cell = cells.find((c) => (unknownAxis === 0 ? c.i === i && c.j === jFixed : c.j === i && c.i === jFixed));
      if (!cell) continue;
      const z = ((cell.lo + cell.hi) / 2) * ZS;
      trail.push(unknownAxis === 0 ? [px(t), px(fixed), z] : [px(fixed), px(t), z]);
    }
  }

  const uncertaintyStrip: { poly: [number, number, number][] }[] = [];
  if (unknownAxis >= 0) {
    const u = (unknownAxis === 0 ? ax : ay).uncertainty!;
    const lo = px(u.tLo);
    const hi = px(u.tHi);
    const w = Math.max(hi - lo, 1.6); // a hairline estimate still has to read as a line
    const mid = (lo + hi) / 2;
    const [a, b] = [mid - w / 2, mid + w / 2];
    uncertaintyStrip.push({
      poly:
        unknownAxis === 0
          ? [[a, -edge, 0.15], [b, -edge, 0.15], [b, edge, 0.15], [a, edge, 0.15]]
          : [[-edge, a, 0.15], [edge, a, 0.15], [edge, b, 0.15], [-edge, b, 0.15]],
    });
    for (const v of [a, b])
      frame.push({
        path: unknownAxis === 0 ? [[v, -edge, 0.2], [v, edge, 0.2]] : [[-edge, v, 0.2], [edge, v, 0.2]],
        c: INK,
        w: 1.8,
      });
  }

  const labels: { text: string; p: [number, number, number]; c: readonly number[]; size: number; anchor?: "start" | "middle" | "end"; baseline?: "top" | "center" | "bottom" }[] = [
    // Name and range in one label, sat toward the high end of its own axis so it also says which
    // way is up. Corner ticks were tried first: the two axes' ends meet at the same corner.
    { text: `${ax.label.toUpperCase()}  ${ax.ticks[0]} → ${ax.ticks[ax.ticks.length - 1]}`, p: [22, -edge - 7, 0], c: DIM, size: 10.5 },
    { text: `${ay.label.toUpperCase()}  ${ay.ticks[0]} → ${ay.ticks[ay.ticks.length - 1]}`, p: [edge + 11, 22, 0], c: DIM, size: 10.5 },
    { text: "SCORE", p: [-edge - 4, -edge, top + 6], c: DIM, size: 11 },
  ];
  for (const g of [0, 100]) labels.push({ text: `${g}`, p: [-edge - 3, -edge, g * ZS], c: DIM, size: 10, anchor: "end" });
  for (const t of thresholds) labels.push({ text: t.label, p: [-edge - 3, -edge, t.at * ZS], c: t.c, size: 10.5, anchor: "end" });
  labels.push({
    text: `this case · ${Math.round(caseScore.lo) === Math.round(caseScore.hi) ? Math.round(caseScore.lo) : `${Math.round(caseScore.lo)}–${Math.round(caseScore.hi)}`}`,
    p: [cx, cy, hiZ + 9],
    c: INK,
    size: 12,
  });
  if (unknownAxis >= 0) {
    const u = (unknownAxis === 0 ? ax : ay).uncertainty!;
    const mid = px((u.tLo + u.tHi) / 2);
    labels.push({
      text: u.tHi - u.tLo > 0.5 ? "could be anywhere here" : "our estimate",
      p: unknownAxis === 0 ? [mid, -edge + 8, 0.6] : [-edge + 8, mid, 0.6],
      c: INK,
      size: 10.5,
    });
  }

  return [
    new PathLayer({
      id: "frame",
      data: frame,
      getPath: (d) => d.path,
      getColor: (d) => rgba(d.c),
      getWidth: (d) => d.w,
      widthUnits: "pixels",
      widthMinPixels: 1,
    }),
    new ColumnLayer({
      id: "volume",
      data: cells,
      diskResolution: 4,
      angle: 45,
      radius: (SPAN / (s.shape[0] - 1)) * 0.6,
      extruded: true,
      pickable: true,
      getPosition: (d) => d.p,
      getElevation: (d) => d.h,
      getFillColor: (d) => d.c,
      material: { ambient: 0.62, diffuse: 0.5, shininess: 20, specularColor: [40, 36, 30] },
      transitions: { getElevation: 180, getPosition: 180 },
    }),
    new PathLayer({
      id: "thresholds",
      data: thresholds,
      getPath: (d) => [
        [-edge, -edge, d.at * ZS],
        [edge, -edge, d.at * ZS],
        [edge, edge, d.at * ZS],
        [-edge, edge, d.at * ZS],
        [-edge, -edge, d.at * ZS],
      ],
      getColor: (d) => rgba(d.c, 190),
      getWidth: 1.4,
      widthUnits: "pixels",
      widthMinPixels: 1.4,
    }),
    // the missing fact on the floor: a strip over every value it could take. A missing fact covers
    // the whole axis, an estimate a narrow band, and both read at a glance.
    new SolidPolygonLayer({
      id: "uncertainty-floor",
      data: uncertaintyStrip,
      getPolygon: (d) => d.poly,
      getFillColor: rgba(INK, 42),
      extruded: false,
    }),
    // the same fact through the space: every score the case could still have
    new PathLayer({
      id: "uncertainty",
      data: trail.length > 1 ? [{ path: trail }] : [],
      getPath: (d) => d.path,
      getColor: rgba(INK, 235),
      getWidth: 3,
      widthUnits: "pixels",
      widthMinPixels: 3,
      capRounded: true,
    }),
    // the score ruler and the case's mast: the thick part is the interval the case still spans
    new LineLayer({
      id: "uprights",
      data: uprights,
      getSourcePosition: (d) => d.a,
      getTargetPosition: (d) => d.b,
      getColor: (d) => d.c,
      getWidth: (d) => d.w,
      widthUnits: "pixels",
      widthMinPixels: 1,
      transitions: { getSourcePosition: 160, getTargetPosition: 160 },
    }),
    new ScatterplotLayer({
      id: "pin-head",
      data: [
        { p: [cx, cy, hiZ] as [number, number, number], r: 8.5, fill: rgba(TIER_RGB[caseTier]) },
        { p: [cx, cy, 0.4] as [number, number, number], r: 10, fill: rgba(INK, 0) },
      ],
      getPosition: (d) => d.p,
      getRadius: (d) => d.r,
      radiusUnits: "pixels",
      getFillColor: (d) => d.fill,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 2.5,
      getLineColor: rgba(INK),
      transitions: { getPosition: 160 },
    }),
    new TextLayer({
      id: "labels",
      data: labels,
      getPosition: (d) => d.p,
      getText: (d) => d.text,
      getColor: (d) => rgba(d.c),
      getSize: (d) => d.size,
      sizeUnits: "pixels",
      getTextAnchor: (d) => d.anchor ?? "middle",
      getAlignmentBaseline: (d) => d.baseline ?? "center",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontWeight: 500,
      characterSet: "auto",
      background: true,
      getBackgroundColor: [10, 13, 16, 235],
      backgroundPadding: [3, 1, 3, 1],
      // A label on the rim can end up behind a near column; this keeps the text on top at any angle.
      parameters: { depthCompare: "always", depthWriteEnabled: false },
    }),
  ];
}
