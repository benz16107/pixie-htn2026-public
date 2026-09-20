"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ResetDemo } from "../desk/ResetDemo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaseView, DeskEvent, Hex } from "@/contract";
import { Swimlanes } from "../Swimlanes";
import { CasePanel, Chatter, QueueRail, SweepBoard } from "./Panels";
import { RecordButton } from "./RecordButton";
import { StationLine } from "./StationLine";
import { useRun, type Speed } from "./useRun";
import type { MapPin, Pulse } from "./DeskMap";
import type { Quote } from "./types";
import { PROXY, isPlumbing, nowLine, type Row } from "@/lib/live";
import { money } from "../bits";

const DeskMap = dynamic(() => import("./DeskMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-land" /> });

const LANES = ["lead", "intake", "appetite", "hazard", "portfolio", "challenger", "system"] as const;
const SPECIALISTS = new Set(["intake", "appetite", "hazard", "portfolio"]);
const BEATS = ["Queue", "Case run", "Evidence", "Backtest", "Toronto", "Close"] as const;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export type LiveProps = {
  rows: Row[];
  allRows: Row[];
  sites: Record<string, { lat: number; lng: number }>;
  details: Record<string, CaseView>;
  recorded: Record<string, number>;
  offlineEvents: Record<string, DeskEvent[]>;
  bookHexes: Hex[];
  fineHexes: Hex[];
  apiUp: boolean;
  backtest: { over: number; of: number; declines: number; excluded: number; changed: number; n3: number; prereg: string; lossRatio: number } | null;
};

export function LiveDesk(props: LiveProps) {
  const { allRows, sites, recorded, offlineEvents, bookHexes, fineHexes, apiUp, backtest } = props;
  const [rows, setRows] = useState(props.rows);
  const [details, setDetails] = useState(props.details);
  const [mode, setMode] = useState<"sweep" | "focus">("sweep");
  const [region, setRegion] = useState<"desk" | "toronto">("desk");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const [overlay, setOverlay] = useState<"backtest" | "close" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [reduced, setReduced] = useState(false);
  const script = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [quoteError, setQuoteError] = useState("");
  useEffect(() => () => script.current.forEach(clearTimeout), []);
  const run = useRun({ rows, recorded, offlineEvents, apiUp });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Rule and override updates arrive here while the desk is on screen.
  useEffect(() => {
    if (!apiUp) return;
    const es = new EventSource(`${PROXY}/events/queue`);
    es.addEventListener("queue", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as { kind: string; caseId: string; decision?: Row["decision"]; status?: string; channel?: string };
      setFlash(m.caseId);
      setTimeout(() => setFlash(null), 2600);
      if (m.kind === "decision" && m.decision) {
        setRows((rs) => rs.map((r) => (r.caseId === m.caseId ? { ...r, decision: m.decision! } : r)));
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [apiUp]);

  const pick = useCallback(
    async (id: string) => {
      setSelected(id);
      setMode("focus");
      if (!details[id] && apiUp) {
        const res = await fetch(`${PROXY}/cases/${id}`).catch(() => null);
        if (res?.ok) {
          const view = (await res.json()) as CaseView;
          setDetails((d) => ({ ...d, [id]: view }));
        }
      }
    },
    [apiUp, details],
  );

  const deskRows = useMemo(() => rows.filter((r) => r.region !== "toronto"), [rows]);

  const startSweep = useCallback(() => {
    setMode("sweep");
    setSelected(null);
    run.start(deskRows.map((r) => r.caseId), "replay");
  }, [deskRows, run]);

  const startFocus = useCallback(
    (id: string) => {
      pick(id);
      run.start([id], "replay");
    },
    [pick, run],
  );

  const loadQuote = useCallback(async () => {
    setRegion("toronto");
    if (quote) return;
    if (!apiUp) { setQuoteError("The quote needs the API. Open the saved receipt on the phone instead."); return; }
    setQuoteError("");
    const res = await fetch(`${PROXY}/quote/tenant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "180 Queen St W, Toronto", answers: { contentsValue: 30000, unitLevel: "upper", claims3yr: 0, deductible: 1000 } }),
    }).catch(() => null);
    if (res?.ok) setQuote((await res.json()) as Quote);
    else setQuoteError("The quote could not load. Select Toronto to retry.");
  }, [apiUp, quote]);

  const stopScript = useCallback(() => {
    script.current.forEach(clearTimeout);
    script.current = [];
  }, []);

  /** One click runs the whole story: sweep the queue, then deep-dive case 138. */
  const runDemo = useCallback(() => {
    stopScript();
    setOverlay(null);
    setRegion("desk");
    setBeat(0);
    startSweep();
    script.current = [
      setTimeout(() => {
        setBeat(1);
        startFocus("138");
      }, 9000),
      setTimeout(() => setBeat(2), 34000),
    ];
  }, [startFocus, startSweep, stopScript]);

  /** The six demo beats, driven by the keys, the beat buttons, or the scripted run. */
  const goBeat = useCallback(
    (i: number) => {
      stopScript();
      setBeat(i);
      const acts = [
        () => { stopScript(); setOverlay(null); setRegion("desk"); startSweep(); },
        () => { stopScript(); setOverlay(null); setRegion("desk"); startFocus("138"); },
        () => { setOverlay(null); void pick(selected ?? "138"); },
        () => setOverlay("backtest"),
        () => { setOverlay(null); loadQuote(); },
        () => setOverlay("close"),
      ];
      acts[i]?.();
    },
    [loadQuote, pick, selected, startFocus, startSweep, stopScript],
  );

  // Keyboard shortcuts work from page load; typing in a field is left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || t?.isContentEditable) return;
      if ((e.key === " " || e.key === "Enter") && t?.closest("button, a")) return;
      if (/^[1-6]$/.test(e.key)) return goBeat(Number(e.key) - 1);
      if (e.key === "Escape") setOverlay(null);
      if (e.key === "]") run.seek(run.elapsed + 5000);
      if (e.key === "[") run.seek(Math.max(0, run.elapsed - 5000));
      if (e.key === "e") run.seek(600_000);
      if (e.key === "d") runDemo();
      if (e.key === " ") {
        e.preventDefault();
        if (run.running) { stopScript(); run.stop(); }
        else runDemo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBeat, run, runDemo, stopScript]);

  const focusCase = selected ? run.cases[selected] : undefined;
  const events = useMemo(
    () =>
      (mode === "focus" && selected ? (run.cases[selected]?.events ?? []) : Object.values(run.cases).flatMap((c) => c.events)).filter(
        (e) => !isPlumbing(e),
      ),
    [mode, selected, run.cases],
  );
  const chatEvents = useMemo(() => [...events].sort((a, b) => a.tMs - b.tMs || a.seq - b.seq), [events]);

  const pins: MapPin[] = deskRows
    .filter((r) => sites[r.caseId])
    .map((r) => ({
      caseId: r.caseId,
      insured: r.insured,
      ...sites[r.caseId],
      state: run.cases[r.caseId]?.status ?? "waiting",
      decision: r.decision.kind,
    }));

  const hasSpecialist = (focusCase?.events ?? []).some((e) => SPECIALISTS.has(e.actor));
  const triageReason =
    str((focusCase?.events ?? []).find((e) => e.kind === "plan" || e.kind === "decision")?.body.text) ||
    "The interval never straddled a threshold, so no lookup could change the decision.";

  const site = selected ? sites[selected] : null;
  const focusPoint =
    region === "toronto" && quote
      ? { lat: quote.center[0], lng: quote.center[1], zoom: 13 }
      : mode === "focus" && site
        ? { lat: site.lat, lng: site.lng, zoom: 8.5 }
        : { lat: 38, lng: -96, zoom: 3.2 };
  const pulses: Pulse[] =
    mode === "focus" && site && focusCase?.status === "working" ? [{ id: "site", ...site, label: "hazard lookup" }] : [];
  const near = (h: Hex) => !site || (Math.abs(h.ring[0][0] - site.lat) < 1.6 && Math.abs(h.ring[0][1] - site.lng) < 1.9);
  const hexes = region === "toronto" && quote ? quote.hexes : mode === "focus" ? fineHexes.filter(near) : bookHexes;

  const decidedNow = Object.values(run.cases).filter((c) => c.status === "settled").length;
  const costCase = focusCase?.costUsd;
  const btn = "rounded-sm border border-edge px-2 py-0.5 transition-colors duration-150 hover:bg-raise";
  const latest = chatEvents.at(-1);
  const caption = nowLine(latest, run.running);

  return (
    <main className="live-page grid h-screen grid-rows-[44px_26px_minmax(0,1fr)_226px_22px] overflow-hidden bg-paper">
      {/* ------------------------------ top strip ------------------------------ */}
      <header className="flex items-center gap-3 overflow-hidden border-b border-edge bg-land px-4 text-[11px]">
        <span className="shrink-0 text-[12px] font-semibold tracking-[0.18em] text-ochre">PIXIE DESK</span>
        <span className="border border-ochre px-2 py-0.5 text-ochre">{run.source === "live" ? "LIVE RUN" : apiUp ? "RECORDED RUN" : "BUNDLED REPLAY"}</span>
        <Link href="/queue" className="underline underline-offset-4">Queue</Link>
        <span className="num hidden shrink-0 2xl:inline">
          <b className="font-semibold">158</b> subs · <b className="font-semibold">{allRows.length}</b> open ·{" "}
          <b className="font-semibold">{deskRows.length}</b> desk · <b className="font-semibold">{decidedNow}</b> decided
        </span>
        <span className="num shrink-0 rounded-sm border border-rule bg-paper/70 px-2 py-0.5" aria-live="off">
          {((run.totals.steps || run.totals.total ? Math.min(run.elapsed, run.totals.runMs || run.elapsed) : 0) / 1000).toFixed(1)}s ·{" "}
          {run.totals.steps} steps · ${run.totals.cost.toFixed(3)}
          {costCase !== undefined && <span className="text-dim"> · case ${costCase.toFixed(3)}</span>}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-sm border border-edge" role="group" aria-label="Run mode">
            <button onClick={startSweep} aria-pressed={mode === "sweep"} className={`px-2 py-0.5 ${mode === "sweep" ? "bg-ochre text-paper" : "hover:bg-raise"}`}>
              Sweep
            </button>
            <button
              onClick={() => startFocus(selected ?? "138")}
              aria-pressed={mode === "focus"}
              className={`px-2 py-0.5 ${mode === "focus" ? "bg-ochre text-paper" : "hover:bg-raise"}`}
            >
              Focus
            </button>
          </div>
          <div className="flex rounded-sm border border-rule" role="group" aria-label="Speed">
            {([1, 2, 4] as Speed[]).map((s) => (
              <button key={s} disabled={run.source === "live" && run.running} onClick={() => run.setSpeed(s)} aria-pressed={run.speed === s} className={`num px-1.5 py-0.5 ${run.speed === s ? "bg-ochre text-paper" : "hover:bg-raise"}`}>
                {s}×
              </button>
            ))}
          </div>
          <button disabled={!apiUp || run.running} onClick={() => { stopScript(); pick(selected ?? "138"); void run.start([selected ?? "138"], "live"); }} className={btn} title="Ask the desk to think for real. Costs model calls.">
            Run live
          </button>
          <ResetDemo />
          <RecordButton />
          <button
            onClick={runDemo}
            className="rounded-sm border border-ochre bg-ochre px-3 py-1 font-semibold text-paper transition-[background-color,transform] duration-150 hover:bg-ochre/85 active:scale-[0.98]"
          >
            Run the demo
          </button>
          <div className="flex rounded-sm border border-edge" role="group" aria-label="Region">
            <button onClick={() => setRegion("desk")} aria-pressed={region === "desk"} className={`px-2 py-0.5 ${region === "desk" ? "bg-ochre text-paper" : "hover:bg-raise"}`}>
              <span className="hidden 2xl:inline">Commercial desk</span>
              <span className="2xl:hidden">Desk</span>
            </button>
            <button onClick={loadQuote} aria-pressed={region === "toronto"} className={`px-2 py-0.5 ${region === "toronto" ? "bg-ochre text-paper" : "hover:bg-raise"}`}>
              <span className="hidden 2xl:inline">Toronto renter</span>
              <span className="2xl:hidden">Renter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-rule bg-paper px-4 text-[12px]">
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${run.running ? "animate-pulse bg-ochre motion-reduce:animate-none" : "bg-rule"}`} />
        <p className={`min-w-0 flex-1 truncate ${run.error ? "text-rust" : ""}`} title={run.error || quoteError || caption} aria-live="polite">
          {run.error || quoteError || caption}
        </p>
        <nav className="relative z-30 flex shrink-0 gap-1" aria-label="Demo beats">
        {BEATS.map((b, i) => (
          <button
            key={b}
            onClick={() => goBeat(i)}
            aria-pressed={beat === i}
            aria-label={`Beat ${i + 1}: ${b}`}
            className={`rounded-sm border px-1.5 text-[10px] transition-colors duration-150 ${beat === i ? "border-ochre bg-ochre text-paper" : "border-rule bg-paper/80 text-dim hover:border-edge hover:text-ink"}`}
          >
            {i + 1} {b}
          </button>
        ))}
              </nav>
      </div>

      {/* ------------------------------- middle -------------------------------- */}
      <div className="grid min-h-0 grid-cols-[214px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 overflow-y-auto border-r border-rule px-2 py-2" aria-label="Open queue">
          <QueueRail rows={rows} cases={run.cases} selected={selected} flash={flash} onPick={(id) => startFocus(id)} />
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden border-r border-rule" aria-label={mode === "focus" ? "The case walking the desk" : "Map"}>
          <div className="relative min-h-0 flex-1">
            <div className={mode === "focus" && region === "desk" ? "absolute inset-0 opacity-45" : "absolute inset-0"}>
              <DeskMap pins={region === "toronto" ? [] : pins} hexes={hexes} focus={focusPoint} pulses={pulses} onPick={(id) => startFocus(id)} reduced={reduced} />
            </div>
            {mode === "focus" && region === "desk" && focusCase && (
              <div className="pointer-events-none absolute left-5 top-4 max-w-[420px]">
                <p className="kicker">Case #{selected} · {focusCase.row.line} · {focusCase.row.state}</p>
                <h2 className="cond text-[24px] font-semibold leading-tight">{focusCase.row.insured}</h2>
                <p className="text-[12px] text-dim">{money(focusCase.row.valueAtStake)} at stake. Watch what the desk had to find out.</p>
              </div>
            )}
            {region === "toronto" && quote && (
              <div className="absolute left-5 top-4 max-w-[420px] rounded-sm border border-edge bg-paper/95 px-3 py-2 text-[12px]">
                <p className="kicker">Same engine, Toronto pack</p>
                <p>
                  {quote.address}: break-ins, fire protection and basement flooding priced per hex, then capped. Quote{" "}
                  <b className="num">${quote.annual.toFixed(2)}</b> a year.
                </p>
              </div>
            )}
          </div>
          {mode === "focus" && region === "desk" && focusCase && (
            <StationLine
              events={focusCase.events}
              caseTitle={`Case ${selected}`}
            />
          )}
        </section>

        <section className="min-h-0 overflow-y-auto border-r border-rule" aria-label="Case">
          <CasePanel c={selected ? (details[selected] ?? null) : null} state={focusCase} typed={!reduced} onStart={runDemo} />
        </section>
      </div>

      {/* ------------------------- lanes and chatter --------------------------- */}
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] border-t border-edge">
        <div className="relative flex min-h-0 flex-col overflow-hidden">
          {mode === "sweep" ? (
            <SweepBoard cases={run.cases} onPick={startFocus} />
          ) : (
            <>
              {focusCase?.status === "settled" && focusCase.events.length > 0 && !hasSpecialist && (
                <p className="shrink-0 px-4 pt-1 text-[12px]">
                  <b className="font-semibold">No specialist time spent: decided at triage.</b> <span className="text-dim">{triageReason}</span>
                </p>
              )}
              <Swimlanes
                events={events}
                initialScore={focusCase?.row.score ?? { lo: 0, hi: 100 }}
                lanes={[...LANES]}
                laneH={28}
                controls={false}
                follow
                pad="px-4 pb-0 pt-1"
                heading={`Agent lanes · case ${selected ?? ""}`}
              />
            </>
          )}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden border-l border-rule px-3 py-2">
          <p className="kicker mb-1">Agent chatter</p>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Chatter events={chatEvents} onPick={setHighlight} active={highlight} onStart={runDemo} />
          </div>
        </div>
      </div>

      {overlay && (
        <div className="absolute inset-x-0 bottom-0 top-[70px] z-20 grid place-items-center bg-paper/80 p-10" onClick={() => setOverlay(null)}>
          <div className="w-[720px] rounded-sm border border-edge bg-land p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)]" onClick={(e) => e.stopPropagation()}>
            {overlay === "backtest" && backtest && (
              <>
                <h2 className="cond text-[24px] font-semibold">The guideline versus the book</h2>
                <ul className="mt-3 space-y-1.5 text-[13px]">
                  <li>
                    <b className="num">{backtest.over}</b> of <b className="num">{backtest.of}</b> bound property policies sit above the $175,000 premium
                    ceiling, so the humans wrote outside the 2025 guideline routinely.
                  </li>
                  <li>
                    <b className="num">{backtest.declines}</b> human declines carry an underwriting reason
                    {backtest.excluded > 0 && (
                      <>
                        ; <b className="num">{backtest.excluded}</b> broker withdrawals are excluded
                      </>
                    )}
                    .
                  </li>
                  <li>
                    Enrichment changed <b className="num">{backtest.changed}</b> tiers across <b className="num">{backtest.n3}</b> cases.
                  </li>
                  <li>
                    Bound property loss ratio <b className="num">{backtest.lossRatio.toFixed(2)}</b> over {backtest.of} policies.
                  </li>
                </ul>
                <p className="mt-3 font-mono text-[11px] text-dim">Pre-registered at {backtest.prereg.slice(0, 12)} before the first run.</p>
              </>
            )}
            {overlay === "close" && (
              <>
                <h2 className="cond text-[24px] font-semibold">Every number is code. Every decision is traceable.</h2>
                <p className="mt-3 text-[13px] leading-relaxed">
                  The desk spent <b className="num">{run.totals.steps}</b> model steps and <b className="num">${run.totals.cost.toFixed(2)}</b> on{" "}
                  {run.totals.total} submissions, and only where information could flip a decision. The same engine also prices Toronto renters using
                  a separate renter guideline and documented price caps.
                </p>
              </>
            )}
            <button className="mt-4 rounded-sm border border-edge px-3 py-1 text-[12px]" onClick={() => setOverlay(null)}>
              Back to the desk (Esc)
            </button>
          </div>
        </div>
      )}
      <footer className="flex h-[22px] items-center gap-3 overflow-hidden border-t border-edge bg-land px-3 text-[10px] text-faint">
        <span className="text-ochre">PIXIE DESK</span>
        <span className="border border-ochre px-2 py-0.5 text-ochre">{run.source === "live" ? "LIVE RUN" : apiUp ? "RECORDED RUN" : "BUNDLED REPLAY"}</span>
        <Link href="/queue" className="underline underline-offset-4">Queue</Link>
        {!apiUp && <span className="text-rust">offline: replaying recorded runs from disk</span>}
        <span className="num">
          {decidedNow} of {deskRows.length} desk cases settled
        </span>
        {/* One quiet line, not a keycap rack: the buttons above already say what this screen does. */}
        <span className="ml-auto truncate">space runs the demo · 1–6 jump to a beat · [ and ] scrub five seconds · e ends · esc closes</span>
      </footer>
      <p className="sr-only">Value at stake {money(deskRows.reduce((n, r) => n + r.valueAtStake, 0))}</p>
    </main>
  );
}
