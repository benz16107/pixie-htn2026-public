"use client";
import type { ReactNode } from "react";
import type { Actor, DeskEvent } from "@/contract";
import { parseHazard, parseSkip, prettyBands } from "@/lib/format";

const ORDER: Actor[] = ["system", "lead", "intake", "appetite", "hazard", "portfolio", "challenger", "human"];
const NAME: Record<string, string> = {
  system: "Triage",
  lead: "Lead",
  intake: "Intake",
  appetite: "Appetite",
  hazard: "Hazard",
  portfolio: "Portfolio",
  challenger: "Challenger",
  human: "Underwriter",
};
const GEO = new Set(["hazard", "portfolio"]);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const QUIET = new Set(["tool_call", "run_stats", "query", "query_retry", "note"]);

/** The headline each agent produced, in plain words. */
function headline(e: DeskEvent): { title: string; detail: string } {
  const text = prettyBands(str(e.body.text));
  switch (e.kind) {
    case "plan":
      return { title: text.replace(/^Deep dive \((\w+)\):\s*/i, (_, d) => `Deep dive, ${d} depth. `).slice(0, 80), detail: text };
    case "ask":
      return { title: `Asks ${e.to}`, detail: str(e.body.question) || text };
    case "answer":
      return { title: `Answers ${e.to}`, detail: text };
    case "estimate":
      return { title: text.split(" from ")[0], detail: text };
    case "assessment":
      return { title: text, detail: `Interval now ${str((e.body.score as { lo?: number } | undefined)?.lo)}` };
    case "conflict":
      return { title: "Conflict", detail: text };
    case "resolution":
      return { title: "Resolved", detail: text.replace(/^[a-z_:]+\s*->\s*/i, "") };
    case "challenge":
      return { title: "Argues against the draft", detail: text };
    case "response":
      return { title: "Answers the challenge", detail: text };
    case "decision":
      return { title: text.split(":")[0], detail: text };
    case "action":
      return { title: text, detail: str(e.body.status) };
    case "finding": {
      if (e.body.skipped) {
        const s = parseSkip(str(e.body.skipped), text);
        return { title: `${s.peril} lookup skipped`, detail: s.reason };
      }
      if (/\(x[\d.]+,\s*[+-]?[\d.]+\s*pts\)/i.test(text)) {
        const h = parseHazard(text);
        return { title: `${h.peril}: ${h.sentence}`, detail: `×${h.multiplier?.toFixed(2)}, ${h.points} points` };
      }
      return { title: text, detail: str(e.body.source) };
    }
    default:
      return { title: text || e.kind.replaceAll("_", " "), detail: "" };
  }
}

/**
 * The case walks the desk. The rail is a real row of stations, one column each, and the band
 * below it holds a single card: what the desk is saying right now, or the broker email when
 * that moment comes. Everything earlier is in the chatter log, so nothing stacks.
 */
export function StationLine({
  events,
  caseTitle,
  takeover,
}: {
  events: DeskEvent[];
  caseTitle: string;
  /** A moment that owns the card slot for as long as it lasts, e.g. the broker email. */
  takeover?: ReactNode;
}) {
  const loud = events.filter((e) => !QUIET.has(e.kind));
  const present = ORDER.filter((a) => loud.some((e) => e.actor === a));
  const stations = present.length ? present : ORDER.slice(0, 6);
  const latest = loud.at(-1);
  const at = Math.max(0, stations.indexOf((latest?.actor ?? "system") as Actor));
  const pct = ((at + 0.5) / stations.length) * 100;
  const here = latest ? loud.filter((e) => e.actor === latest.actor).length : 0;
  const h = latest ? headline(latest) : null;
  const geo = !!latest && GEO.has(latest.actor);

  return (
    <section className="relative z-10 shrink-0 border-t border-edge bg-paper px-4 pb-2.5 pt-1.5" aria-label="Where the case is on the desk">
      {/* the case token, alone on its row, so it can travel without meeting anything */}
      <div className="relative h-[21px]">
        <div
          className="num absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ochre px-2 py-[2px] text-[10px] text-paper transition-[left] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ left: `clamp(66px, ${pct}%, calc(100% - 66px))` }}
        >
          {caseTitle} · {loud.length} steps
        </div>
      </div>

      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stations.length}, minmax(0, 1fr))` }}>
        <span aria-hidden className="absolute inset-x-0 top-[6px] h-[2px] bg-rule" />
        <span
          aria-hidden
          className="absolute left-0 top-[6px] h-[2px] bg-ink transition-[width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
        {stations.map((a, i) => {
          const mine = loud.filter((e) => e.actor === a);
          const live = i === at;
          return (
            <li key={a} className="relative flex flex-col items-center gap-[5px]">
              <span
                className={`size-[14px] rounded-full border-2 bg-paper ${
                  live ? "border-rust shadow-[0_0_0_5px_rgba(226,89,74,0.18)]" : mine.length ? "border-edge bg-ink" : "border-rule"
                }`}
              />
              <span className={`truncate text-[10px] font-semibold uppercase tracking-[0.09em] ${live ? "text-rust" : mine.length ? "text-ink" : "text-dim"}`}>
                {NAME[a]}
              </span>
              <span className="num text-[9px] text-dim">{mine.length ? `${mine.length} step${mine.length > 1 ? "s" : ""}` : "—"}</span>
            </li>
          );
        })}
      </ol>

      {/* one card slot: it swaps, it never stacks */}
      <div className="mt-2 h-[104px]">
        {takeover ??
          (h && latest ? (
            <article
              key={latest.id}
              className={`lane-card flex h-full flex-col overflow-hidden rounded-sm border px-3 py-2 text-[12px] leading-snug ${
                geo ? "border-ochre bg-ochre-soft/70" : "border-edge bg-land/60"
              }`}
            >
              <p className="kicker mb-0.5">{NAME[latest.actor] ?? latest.actor}</p>
              <b className="block truncate font-semibold" title={h.title}>
                {h.title}
              </b>
              {h.detail && (
                <span className="mt-0.5 line-clamp-2 text-dim" title={h.detail}>
                  {h.detail}
                </span>
              )}
              <span className="num mt-auto pt-1 text-[9px] text-dim">
                t+{(latest.tMs / 1000).toFixed(0)}s{here > 1 ? ` · ${here} steps here` : ""} · earlier steps are in the chatter log
              </span>
            </article>
          ) : (
            <p className="flex h-full items-center text-[12px] text-dim">The case has not reached a station yet.</p>
          ))}
      </div>
    </section>
  );
}
