"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Actor, DeskEvent, Interval } from "@/contract";
import { humanize, parseHazard, parseSkip, prettyBands, signed } from "@/lib/format";
import { IntervalBar } from "./bits";

const ALL_LANES: Actor[] = ["lead", "intake", "appetite", "hazard", "portfolio", "system", "human"];
const DEFAULT_LANE_H = 60;
const LABEL_W = 92;
const COL_W = 200;
const CARD_W = 188;
const CARD_H = 46;
const SAME_MOMENT_MS = 1000;
const TOP = 16; // header row for the moment labels
const GEO = new Set<Actor>(["hazard", "portfolio"]);

type Card = { e: DeskEvent; chips: DeskEvent[]; col: number; lane: number };
type Text = { title: string; meta?: string; tag?: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0];

/** A card's words: the kind decides the phrasing; raw engine strings are cleaned, never shown bare. */
function describe(e: DeskEvent): Text {
  const b = e.body;
  const text = prettyBands(str(b.text));
  switch (e.kind) {
    case "plan":
      return { title: text.replace(/^Deep dive \((\w+)\):\s*/i, "Deep dive, $1 depth. "), tag: "plan" };
    case "ask":
      return { title: str(b.question) || text.replace(/^Ask \w+:\s*/i, ""), tag: `asks ${e.to ?? ""}`.trim() };
    case "answer":
      return { title: firstSentence(text), tag: `answers ${e.to ?? ""}`.trim() };
    case "assessment":
      return { title: text.replace(/^Re-assessed:/, "Re-assessed").replace(/\s*\(triage [^)]+\)/, "") };
    case "estimate":
      return { title: text, tag: "estimate" };
    case "query":
      return { title: text, tag: "query" };
    case "query_retry":
      return { title: `Federato rejected the query: ${str(b.error).replace(/^\[\w+\]\s*/, "")}`, tag: "retry" };
    case "conflict": {
      const st = (b.stances ?? {}) as Record<string, string>;
      const who = Object.entries(st).map(([a, s]) => `${a} ${s === "against" ? "against" : "for"}`).join(", ");
      return { title: firstSentence(text), meta: who || undefined, tag: "conflict" };
    }
    case "resolution": {
      const [, choice = "", why = ""] = text.match(/->\s*([a-z_]+):\s*(.*)$/i) ?? [];
      return { title: choice ? `Chose ${humanize(choice).toLowerCase()}` : text, meta: why ? firstSentence(why) : undefined, tag: "resolution" };
    }
    case "decision":
      return { title: text.split(":")[0] || text, meta: firstSentence(text.split(":").slice(1).join(":").trim()), tag: "decision" };
    case "note":
      return { title: text, tag: "note" };
    case "finding": {
      if (b.skipped) {
        const s = parseSkip(str(b.skipped), text);
        return { title: `${s.peril} lookup skipped`, meta: s.reason };
      }
      if (/^[a-z_]+: .*\(x[\d.]+,\s*[+-]?[\d.]+\s*pts\)$/i.test(text)) {
        const h = parseHazard(text);
        return { title: `${h.peril}: ${h.sentence}`, meta: `×${h.multiplier?.toFixed(2)} · ${signed(h.points ?? 0)} pts` };
      }
      return { title: text };
    }
    case "tool_call":
      return { title: `Ran ${humanize(str(b.tool)).toLowerCase()}`, tag: "tool" };
    default:
      return { title: text || humanize(e.kind), tag: e.kind.replaceAll("_", " ") };
  }
}

/** Tool calls ride on the card they produced: same actor, within a second, matching text when possible. */
function attach(events: DeskEvent[]): { cards: DeskEvent[]; chips: Map<string, DeskEvent[]> } {
  const cards: DeskEvent[] = [];
  const chips = new Map<string, DeskEvent[]>();
  for (const e of events) {
    const riders = e.kind === "tool_call" || e.kind === "action";
    const recent = cards.filter((c) => c.actor === e.actor && e.tMs - c.tMs <= 1500 && c.kind !== "tool_call");
    if (riders && recent.length) {
      const t = str(e.body.text).replace(/^[a-z_]+:\s*/i, "");
      const src = str((e.body.args as Record<string, unknown> | undefined)?.source);
      const host =
        recent.find((c) => src && str(c.body.skipped) === src) ??
        recent.find((c) => t && str(c.body.text).startsWith(t.slice(0, 30))) ??
        recent.at(-1)!;
      chips.set(host.id, [...(chips.get(host.id) ?? []), e]);
    } else cards.push(e);
  }
  return { cards, chips };
}

/** Ordinal columns: events in the same second share a column; a lane never overlaps itself. */
function layout(events: DeskEvent[], lanes: Actor[]): { cards: Card[]; cols: number; colTimes: number[] } {
  const { cards, chips } = attach(events);
  const last: Record<number, number> = {};
  const colTimes: number[] = [];
  let prev: { col: number; t: number } | null = null;
  const out = cards.map((e) => {
    const lane = Math.max(0, lanes.indexOf(e.actor));
    const floor = prev ? (e.tMs - prev.t < SAME_MOMENT_MS ? prev.col : prev.col + 1) : 0;
    const col = Math.max(floor, (last[lane] ?? -1) + 1);
    last[lane] = col;
    prev = { col, t: e.tMs };
    colTimes[col] ??= e.tMs;
    return { e, chips: chips.get(e.id) ?? [], col, lane };
  });
  return { cards: out, cols: colTimes.length, colTimes };
}

const TONE: Record<string, string> = {
  decision: "border-[1.5px] border-edge bg-paper",
  conflict: "border-rust bg-paper",
  resolution: "border-edge bg-paper",
  note: "border-dashed border-dim bg-paper",
  query_retry: "border-rust/70 bg-land",
};

function CardView({ c, x, y }: { c: Card; x: number; y: number }) {
  const { e } = c;
  const d = describe(e);
  const tone = TONE[e.kind] ?? (GEO.has(e.actor) ? "border-ochre bg-ochre-soft" : "border-rule bg-land");
  const full = str(e.body.text);
  return (
    <li
      className={`lane-card absolute rounded-sm border px-2 py-1 text-[11px] leading-[1.28] has-[details[open]]:z-30 ${tone}`}
      style={{ left: x, top: y, width: CARD_W, minHeight: CARD_H }}
      title={full}
    >
      <span className="float-right ml-1 font-mono text-[10px] text-dim">{(e.tMs / 1000).toFixed(0).padStart(2, "0")}s</span>
      {d.tag && (
        <span className={`mr-1 font-mono text-[9px] uppercase tracking-wide ${e.kind === "conflict" || e.kind === "query_retry" ? "text-rust" : "text-dim"}`}>{d.tag}</span>
      )}
      <span className={c.chips.length ? "line-clamp-1" : "line-clamp-2"}>{d.title}</span>
      {d.meta && <span className="line-clamp-1 text-[10px] text-dim">{d.meta}</span>}
      {c.chips.length > 0 && (
        <span className="mt-0.5 flex flex-wrap gap-1">
          {c.chips.slice(0, 3).map((t) =>
            t.kind === "action" ? (
              <span key={t.id} className="rounded-sm bg-moss px-[5px] font-mono text-[9px] font-medium text-paper">
                {str(t.body.text)} · {str(t.body.status)}
              </span>
            ) : (
              <details key={t.id} className="group relative">
                <summary className="cursor-pointer list-none rounded-sm bg-moss px-[5px] font-mono text-[9px] font-medium text-paper [&::-webkit-details-marker]:hidden">
                  {str(t.body.tool)} <span aria-hidden className="inline-block transition-transform duration-150 group-open:rotate-90">›</span>
                </summary>
                <pre className="absolute left-0 top-full z-20 mt-1 max-h-64 w-[320px] overflow-auto whitespace-pre-wrap break-words rounded-sm border border-edge bg-paper p-2 font-mono text-[10px] leading-snug shadow-[0_6px_16px_-6px_rgba(47,42,34,0.35)]">
                  {JSON.stringify({ args: t.body.args, result: t.body.result }, null, 2)}
                </pre>
              </details>
            ),
          )}
          {c.chips.length > 3 && <span className="font-mono text-[9px] text-dim">+{c.chips.length - 3}</span>}
        </span>
      )}
    </li>
  );
}

function Arrows({ cards, pos, height, width }: { cards: Card[]; pos: Map<string, { x: number; y: number }>; height: number; width: number }) {
  const byId = new Map(cards.map((c) => [c.e.id, c]));
  const edges: { from: string; to: string; dashed: boolean }[] = [];
  for (const c of cards) {
    if (c.e.inReplyTo && byId.has(c.e.inReplyTo)) edges.push({ from: c.e.inReplyTo, to: c.e.id, dashed: false });
    for (const r of c.e.refs) if (r !== c.e.inReplyTo && byId.has(r)) edges.push({ from: r, to: c.e.id, dashed: true });
  }
  return (
    <svg aria-hidden className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={height}>
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8z" fill="#95a3af" />
        </marker>
      </defs>
      {edges.map(({ from, to, dashed }) => {
        const a = pos.get(from)!;
        const b = pos.get(to)!;
        const x1 = a.x + CARD_W;
        const y1 = a.y + CARD_H / 2;
        const y2 = b.y + CARD_H / 2;
        const mid = b.x > x1 ? x1 + (b.x - x1) / 2 : x1 + 6;
        const d = b.x > x1 ? `M${x1},${y1} H${mid} V${y2} H${b.x - 2}` : `M${a.x + CARD_W / 2},${y1 + (y2 > y1 ? CARD_H / 2 : -CARD_H / 2)} V${y2 + (y2 > y1 ? -CARD_H / 2 : CARD_H / 2) - (y2 > y1 ? 2 : -2)}`;
        return <path key={`${from}-${to}`} d={d} fill="none" stroke="#95a3af" strokeWidth={1.25} strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#arr)" />;
      })}
    </svg>
  );
}

export function Swimlanes({
  events,
  initialScore,
  lanes = ALL_LANES,
  laneH = DEFAULT_LANE_H,
  controls = true,
  heading = "Agent lanes",
  follow = false,
  pad = "px-10 pb-5 pt-2.5",
}: {
  events: DeskEvent[];
  initialScore: Interval | null;
  lanes?: Actor[];
  laneH?: number;
  controls?: boolean;
  heading?: string;
  follow?: boolean;
  pad?: string;
}) {
  const LANE_H = Math.max(laneH, CARD_H + 14);
  const LANES = lanes;
  const sorted = useMemo(() => [...events].sort((a, b) => a.seq - b.seq), [events]);
  const { cards, cols, colTimes } = useMemo(() => layout(sorted, lanes), [sorted, lanes]);
  const scroller = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState<number | null>(null); // null = the whole run
  const [speed, setSpeed] = useState(1);

  const end = sorted.at(-1)?.tMs ?? 0;
  useEffect(() => {
    if (clock === null) return;
    const id = setTimeout(() => setClock((c) => (c === null || c > end ? null : c + 250 * speed)), 250);
    return () => clearTimeout(id);
  }, [clock, speed, end]);

  const shown = clock === null ? cards : cards.filter((c) => c.e.tMs <= clock);
  const latestCol = shown.reduce((m, c) => Math.max(m, c.col), 0);

  // Keep the newest card in view: jump to the end on load, follow the replay as it grows.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, (latestCol + 1) * COL_W - el.clientWidth + 24);
    el.scrollTo({ left: target, behavior: clock === null && !follow ? "auto" : "smooth" });
  }, [latestCol, clock, follow]);

  const assessed = sorted.filter((e) => e.kind === "assessment" && e.body.score && (clock === null || e.tMs <= clock)).at(-1);
  const score = (assessed?.body.score as Interval | undefined) ?? initialScore;
  const height = TOP + LANES.length * LANE_H;
  const width = cols * COL_W + 12;
  const pos = new Map(shown.map((c) => [c.e.id, { x: c.col * COL_W + 6, y: TOP + c.lane * LANE_H + (LANE_H - CARD_H) / 2 }]));
  const btn = "rounded-sm border border-edge px-2 py-px font-mono text-[11px] transition-colors duration-150 hover:bg-ink hover:text-paper";

  return (
    <section aria-labelledby="lanes-h" className={`flex min-h-0 flex-col ${pad}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3">
        <h2 id="lanes-h" className={heading ? "kicker shrink-0 truncate" : "sr-only"}>{heading || "Agent activity"}</h2>
        {controls && (
        <div className="flex items-center gap-2" role="group" aria-label="Replay">
          <button className={btn} onClick={() => { setSpeed(1); setClock(0); }}>Replay 1×</button>
          <button className={btn} onClick={() => { setSpeed(4); setClock(0); }}>4×</button>
          {clock !== null && <button className={btn} onClick={() => setClock(null)}>Skip to end</button>}
        </div>
        )}
        <span className="hidden shrink-0 truncate text-[11px] text-dim xl:inline">
          <span className="num">{cards.length}</span> steps, <span className="num">{sorted.length}</span> events. Columns are moments, not seconds.
        </span>
        <div className="ml-auto flex min-w-[180px] max-w-[360px] flex-1 items-center gap-3">
          <span className="kicker whitespace-nowrap">Interval</span>
          <div className="flex-1"><IntervalBar score={score} compact /></div>
          <span className="num w-[44px] text-[11px]" aria-live="polite">{score ? `${score.lo}–${score.hi}` : "—"}</span>
        </div>
        <span className="kicker font-mono">
          t+ <span className="num">{((clock === null ? end : Math.min(clock, end)) / 1000).toFixed(0)}</span> s
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <ul className="shrink-0" style={{ width: LABEL_W, paddingTop: TOP }} aria-hidden>
          {LANES.map((l) => (
            <li key={l} className="flex items-center border-b border-dashed border-rule text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ height: LANE_H }}>
              {l}
            </li>
          ))}
        </ul>
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain pb-2" tabIndex={0} aria-label="Desk events, scroll sideways for earlier steps">
          <div className="relative" style={{ width: Math.max(width, 100), height }}>
            {LANES.map((l, i) => (
              <div key={l} className="absolute inset-x-0 border-b border-dashed border-rule" style={{ top: TOP + i * LANE_H, height: LANE_H }}>
                {l === "human" && !shown.some((c) => c.e.actor === "human") && (
                  <span className="sticky left-0 inline-block px-1.5 pt-[18px] text-[11px] text-dim">Waiting on the underwriter. Human decisions appear here.</span>
                )}
              </div>
            ))}
            {colTimes.map((t, i) =>
              i % 2 === 0 ? (
                <span key={i} className="absolute top-0 font-mono text-[9px] text-dim" style={{ left: i * COL_W + 8 }}>
                  {(t / 1000).toFixed(1)}s
                </span>
              ) : null,
            )}
            <Arrows cards={shown} pos={pos} height={height} width={width} />
            <ol aria-label="Desk events in order">
              {shown.map((c) => {
                const p = pos.get(c.e.id)!;
                return <CardView key={c.e.id} c={c} x={p.x} y={p.y} />;
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
