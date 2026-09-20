"use client";
import { useEffect, useRef, useState } from "react";
import type { CaseView, DeskEvent, Interval } from "@/contract";
import { DecisionChip, IntervalBar, money } from "../bits";
import { chatLine, type CaseState, type Chat, type Row } from "@/lib/live";
import { prettyBands } from "@/lib/format";
import { C_ROW_H } from "./layout";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/* ---------------------------------- queue rail --------------------------------- */

type Ranked = { r: Row; c?: CaseState; score: Interval | null; scored: boolean; group: number; mid: number };

function RailRows({
  list,
  top,
  selected,
  flash,
  onPick,
}: {
  list: Ranked[];
  top: number;
  selected: string | null;
  flash: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <>
      {list.map(({ r, c, score, scored }, i) => {
        const on = selected === r.caseId;
        const status = c?.status ?? "waiting";
        return (
          <button
            key={r.caseId}
            onClick={() => onPick(r.caseId)}
            aria-current={on ? "true" : undefined}
            className={`absolute inset-x-0 flex items-center gap-2 rounded-sm border px-2 text-left transition-[transform,background-color,border-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
              flash === r.caseId ? "animate-pulse border-moss bg-moss/20 motion-reduce:animate-none" : on ? "border-edge bg-land" : "border-transparent hover:border-rule hover:bg-land/60"
            }`}
            style={{ transform: `translateY(${(top + i) * C_ROW_H}px)`, height: C_ROW_H - 3 }}
          >
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${
                status === "working" ? "animate-pulse bg-ochre motion-reduce:animate-none" : status === "settled" ? "bg-ink" : "bg-rule"
              }`}
            />
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block truncate text-[12px] font-medium leading-tight">{r.insured}</span>
              <span className="num block truncate text-[10px] text-dim">
                #{r.caseId} · {r.state} · {money(r.valueAtStake)}
              </span>
            </span>
            {status === "settled" || ("by" in r.decision && r.decision.by === "human") ? (
              <span className="shrink-0"><DecisionChip decision={r.decision} /></span>
            ) : status === "working" ? (
              <span className="num shrink-0 text-[10px] text-ochre">{scored ? `${score!.lo}–${score!.hi}` : "—"}</span>
            ) : (
              <span className="num shrink-0 text-[10px] text-dim">{scored ? "queued" : "—"}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

export function QueueRail({
  rows,
  cases,
  selected,
  flash,
  onPick,
}: {
  rows: Row[];
  cases: Record<string, CaseState>;
  selected: string | null;
  flash: string | null;
  onPick: (id: string) => void;
}) {
  // Commercial cases first, by the interval that has settled; consumer referrals last.
  const GROUP: Record<string, number> = { open: 0, refer: 1, accept: 1, approve: 1, decline: 2, routed: 3 };
  const rank = (r: Row) => {
    const c = cases[r.caseId];
    const score = c?.score ?? r.score ?? null;
    const scored = !!score && (score.lo !== 0 || score.hi !== 0);
    return { r, c, score, scored, group: GROUP[r.decision.kind] ?? 3, mid: scored ? (score!.lo + score!.hi) / 2 : -1 };
  };
  const sorted = (list: Row[]): Ranked[] => list.map(rank).sort((a, b) => a.group - b.group || b.mid - a.mid || b.r.valueAtStake - a.r.valueAtStake);
  const desk = sorted(rows.filter((r) => r.region !== "toronto"));
  const consumer = sorted(rows.filter((r) => r.region === "toronto"));

  return (
    <div className="relative" style={{ height: (desk.length + consumer.length + 2) * C_ROW_H }}>
      <p className="kicker absolute inset-x-0 px-1" style={{ top: 4 }}>
        Open queue
      </p>
      <RailRows list={desk} top={0.6} selected={selected} flash={flash} onPick={onPick} />
      {consumer.length > 0 && (
        <>
          <p className="kicker absolute inset-x-0 px-1" style={{ top: (desk.length + 0.7) * C_ROW_H }}>
            Consumer referrals
          </p>
          <RailRows list={consumer} top={desk.length + 1.3} selected={selected} flash={flash} onPick={onPick} />
        </>
      )}
    </div>
  );
}

/** Sweep view: one row per case, its events as a filling strip. Lanes are for one case at a time. */
export function SweepBoard({ cases, onPick }: { cases: Record<string, CaseState>; onPick: (id: string) => void }) {
  const list = Object.values(cases).sort((a, b) => b.events.length - a.events.length || a.row.caseId.localeCompare(b.row.caseId));
  const ACTOR: Record<string, string> = {
    lead: "bg-ink",
    intake: "bg-moss",
    appetite: "bg-ochre",
    hazard: "bg-rust",
    portfolio: "bg-water",
    system: "bg-rule",
    human: "bg-moss",
  };
  return (
    <div className="flex min-h-0 flex-col px-4 pb-1 pt-1.5">
      <p className="kicker mb-1">Sweep · {list.length} cases at once</p>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {list.map((c) => {
          const last = c.events.filter((e) => e.kind !== "run_stats").at(-1);
          return (
            <li key={c.row.caseId}>
              <button onClick={() => onPick(c.row.caseId)} className="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-land">
                <span className="num w-[92px] shrink-0 truncate text-[11px]">#{c.row.caseId} {c.row.state}</span>
                <span className="w-[130px] shrink-0 truncate text-[11px]">{c.row.insured}</span>
                <span className="flex h-3 w-[180px] shrink-0 items-center gap-[2px]">
                  {c.events.slice(-30).map((e) => (
                    <span key={e.id} className={`lane-card h-2.5 w-1 rounded-[1px] ${ACTOR[e.actor] ?? "bg-rule"}`} />
                  ))}
                </span>
                <span className="num w-[52px] shrink-0 text-[11px]">{c.score ? `${c.score.lo}–${c.score.hi}` : "—"}</span>
                <span className="num w-[56px] shrink-0 text-[11px] text-dim">{c.costUsd ? `$${c.costUsd.toFixed(3)}` : c.codeOnly ? "code" : ""}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-dim">
                  {c.status === "settled" ? ("because" in c.row.decision ? c.row.decision.because[0] : c.row.decision.kind) : (last?.body.text as string) ?? "queued"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------- case panel --------------------------------- */

const FACT_STATE = { missing: "text-rust", estimated: "text-ochre", known: "text-moss" } as const;

export function CasePanel({ c, state, typed, onStart }: { c: CaseView | null; state?: CaseState; typed: boolean; onStart: () => void }) {
  const events = state?.events ?? [];
  const score = state?.score ?? c?.score ?? null;
  const decided = events.find((e) => e.kind === "decision");
  const conflicts = events.filter((e) => e.kind === "conflict");
  const resolutions = events.filter((e) => e.kind === "resolution");
  const seen = new Set(events.filter((e) => e.kind === "finding" || e.kind === "estimate").map((e) => str(e.body.fact)));
  const explanation = decided ? prettyBands(str(decided.body.text)) : "";

  if (!c)
    return (
      <div className="p-4 text-[12px]">
        <p className="text-dim">A case and its decision land here.</p>
        <button onClick={onStart} className="mt-3 rounded-sm border border-ochre bg-ochre px-3 py-1 text-paper transition-colors duration-150 hover:bg-ochre/85">
          Run the demo
        </button>
      </div>
    );
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 py-3">
      <div>
        <p className="num text-[10px] text-dim">CASE #{c.caseId}</p>
        <h2 className="font-serif text-[20px] font-semibold leading-tight text-balance">{c.title}</h2>
      </div>
      {score && (score.lo !== 0 || score.hi !== 0) ? (
        <div>
          <p className="kicker mb-0.5 flex justify-between">
            <span>Interval <span className="num text-ink">{score.lo}–{score.hi}</span></span>
            <span>refer band 45–70</span>
          </p>
          <IntervalBar score={score} />
        </div>
      ) : (
        <p className="text-[12px] text-dim">
          No interval: <span className="text-ink">{c.decision.kind === "routed" ? c.decision.because : "not scored by this guideline"}</span>
        </p>
      )}
      <div>
        <p className="kicker mb-1">Facts</p>
        <ul className="space-y-1">
          {c.facts.map((f) => {
            const live = seen.has(f.id) || state?.status === "settled";
            const pv = state && !live && f.provenance !== "known" ? "missing" : f.provenance;
            return (
              <li key={f.id} className="flex items-baseline gap-2 text-[11px]">
                <span className="w-[86px] shrink-0 truncate text-dim">{f.label}</span>
                <span className={`num min-w-0 flex-1 truncate transition-colors duration-300 ${FACT_STATE[pv]}`} title={f.source}>
                  {state && !live && f.provenance !== "known" ? "waiting" : f.display}
                </span>
                <span className={`shrink-0 font-mono text-[9px] uppercase ${FACT_STATE[pv]}`}>{pv}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {explanation && (
        <div>
          <p className="kicker mb-1">
            Lead&apos;s decision {c.explanationVerified && <span className="text-moss">✓ verified</span>}
          </p>
          <Typed key={explanation} text={explanation} on={typed} />
        </div>
      )}
      {conflicts.length > 0 && (
        <div>
          <p className="kicker mb-1">Conflicts</p>
          {conflicts.map((e) => {
            const fix = resolutions.find((r) => r.body.conflict_id === e.body.conflict_id);
            return (
              <div key={e.id} className="lane-card mb-1 rounded-sm border border-rust px-2 py-1 text-[11px]">
                <span className="line-clamp-3" title={prettyBands(str(e.body.text))}>
                  {prettyBands(str(e.body.text))}
                </span>
                {fix && (
                  <span className="mt-0.5 line-clamp-2 text-[11px] text-moss" title={prettyBands(str(fix.body.text))}>
                    → {prettyBands(str(fix.body.text)).replace(/^[a-z_:]+\s*->\s*/i, "")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!explanation && state?.status === "working" && <p className="text-[11px] text-dim">The desk is still working this case…</p>}
    </div>
  );
}

/** Reveals the explanation at reading speed; reduced motion shows it whole. */
function Typed({ text, on }: { text: string; on: boolean }) {
  const [n, setN] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + 3)), 16);
    return () => clearInterval(id);
  }, [text.length, on]);
  // Nine lines is what the column holds at 900px. The rest is one hover away, and the same
  // sentence is in the chatter log.
  return (
    <p className="line-clamp-8 font-serif text-[13px] leading-snug" title={text}>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse">▍</span>}
    </p>
  );
}

/* ----------------------------------- chatter ----------------------------------- */

export function Chatter({ events, onPick, active, onStart }: { events: DeskEvent[]; onPick: (id: string) => void; active: string | null; onStart: () => void }) {
  const box = useRef<HTMLUListElement>(null);
  const lines = events.map(chatLine).filter(Boolean) as Chat[];
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);
  const tone: Record<Chat["tone"], string> = {
    plain: "",
    ask: "border-l-ink",
    answer: "border-l-moss",
    conflict: "border-l-rust",
    decision: "border-l-ink bg-land",
  };
  return (
    <ul ref={box} className="h-full overflow-y-auto pr-1 text-[11px] leading-snug" aria-live="polite" aria-label="Agent chatter">
      {lines.length === 0 && (
        <li className="text-dim">
          The agents talk here: who asked whom, what came back, what they disagreed about.
          <button onClick={onStart} className="mt-2 block rounded-sm border border-edge px-2 py-1 text-ink transition-colors duration-150 hover:bg-land">
            Run the demo
          </button>
        </li>
      )}
      {lines.map((l) => (
        <li key={l.id}>
          <button
            onClick={() => onPick(l.id)}
            className={`lane-card w-full border-l-2 border-transparent py-[3px] pl-2 text-left hover:bg-land ${tone[l.tone]} ${active === l.id ? "bg-land" : ""}`}
          >
            <b className="font-semibold">{l.who}</b> {l.line}
          </button>
        </li>
      ))}
    </ul>
  );
}
