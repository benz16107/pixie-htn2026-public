"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DecisionChip, IntervalBar, money, THRESHOLDS, type Thresholds } from "./bits";
import { useKeys } from "./desk/keys";
import type { Row } from "@/lib/live";

type Key = "rank" | "insured" | "score" | "value";
const GROUP: Record<string, number> = { open: 0, refer: 1, accept: 1, approve: 1, decline: 2, routed: 3 };
/** Consumer referrals sit under the desk's own book, the way they arrive. */
const group = (r: Row) => (r.region === "toronto" ? 10 : 0) + (GROUP[r.decision.kind] ?? 3);
const scored = (r: Row) => !!r.score && r.decision.kind !== "routed";
const mid = (r: Row) => (scored(r) ? (r.score!.lo + r.score!.hi) / 2 : -1);

type Extras = { deskVerdict?: string; challengeRisks?: number };
export type Ranked = Row & Extras & { rank: number };

const COLS: { key?: Key; label: string; w: string; align?: "right"; small?: "hide" }[] = [
  { key: "insured", label: "submission", w: "w-[44%] sm:w-[31%]" },
  { key: "value", label: "exposure", w: "w-[14%]", align: "right", small: "hide" },
  { key: "score", label: "appetite range", w: "w-[32%] sm:w-[23%]" },
  { label: "decision", w: "w-[24%] sm:w-[14%]" },
  { label: "needs attention", w: "w-[18%]", small: "hide" },
];

/**
 * The queue. One row per submission, five columns, a cursor you drive with j and k, and a
 * preview that follows the cursor so the whole book reads without a single click.
 */
export function QueueTable({
  rows,
  view,
  onCursor,
  filter,
  setFilter,
  t = THRESHOLDS,
}: {
  rows: (Row & Extras)[];
  view: "open" | "all" | "consumer" | "scored";
  onCursor: (r: Ranked | null) => void;
  filter: string;
  setFilter: (s: string) => void;
  t?: Thresholds;
}) {
  const router = useRouter();
  const ranked = useMemo<Ranked[]>(
    () =>
      [...rows]
        .sort((a, b) => group(a) - group(b) || mid(b) - mid(a) || b.valueAtStake - a.valueAtStake)
        .map((r, i) => ({ ...r, rank: i + 1 })),
    [rows],
  );
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const hit = (r: Ranked) => !q || `${r.insured} ${r.caseId} ${r.line} ${r.state} ${r.decision.kind}`.toLowerCase().includes(q);
    const val = (r: Ranked): string | number => ({ rank: r.rank, insured: r.insured, score: mid(r), value: r.valueAtStake })[sort.key];
    return ranked.filter(hit).sort((a, b) => {
      const x = val(a),
        y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [ranked, sort, filter]);

  const at = Math.min(cursor, Math.max(sorted.length - 1, 0));
  const here = sorted[at] ?? null;
  useEffect(() => onCursor(here), [here, onCursor]);

  // Keep the cursor row in view without hijacking the page: only the blotter scrolls.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('tr[data-on="1"]')?.scrollIntoView({ block: "nearest" });
  }, [at, sorted.length]);

  useKeys(
    (e, leader) => {
      if (e.key === "/") return e.preventDefault(), search.current?.focus(), true;
      if (e.key === "j" || e.key === "ArrowDown") return setCursor((c) => Math.min(c + 1, sorted.length - 1)), e.preventDefault(), true;
      if (e.key === "k" || e.key === "ArrowUp") return setCursor((c) => Math.max(c - 1, 0)), e.preventDefault(), true;
      if (leader === "g" && e.key === "g") return setCursor(0), true;
      if (e.key === "G") return setCursor(sorted.length - 1), true;
      if (e.key === "Enter" && here) return router.push(`/cases/${here.caseId}`), true;
      return false;
    },
    [sorted.length, here, router],
  );

  const toggle = (key: Key) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "rank" || key === "insured" ? 1 : -1 }));

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-[46px] shrink-0 items-center gap-2 border-b border-rule px-4 text-[13px]">
        <input
          ref={search}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFilter("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Search insured, case, location, or decision"
          aria-label="Filter submissions"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
        />
        <span className="num shrink-0 text-faint">
          {sorted.length}/{ranked.length} rows
        </span>
      </div>

      <div ref={box} className="relative min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <caption className="sr-only">
            Submission blotter, ranked by score interval. Column headers sort. Press j and k to move the cursor, Enter to open a case.
          </caption>
          <thead className="sticky top-0 z-10 bg-paper">
            <tr className="border-b border-edge">
              {COLS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={c.key && sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className={`h-[36px] whitespace-nowrap px-3 font-normal sm:px-4 ${c.align === "right" ? "text-right" : "text-left"} ${c.small === "hide" ? "hidden sm:table-cell" : ""} ${c.w}`}
                >
                  {c.key ? (
                    <button onClick={() => toggle(c.key!)} className="kicker rounded-sm hover:text-ochre">
                      {c.label}
                      <span aria-hidden className="ml-1 inline-block w-2">
                        {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  ) : (
                    <span className="kicker">{c.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <BlotterRow key={r.caseId} r={r} on={i === at} t={t} onPick={() => setCursor(i)} onOpen={() => router.push(`/cases/${r.caseId}`)} />
            ))}
            {!!sorted.length && (
              <tr>
                <td colSpan={COLS.length} className="px-2 pt-2 text-[10px] text-faint">
                  — end of the {view === "open" ? "open" : "full"} book, {sorted.length} rows
                </td>
              </tr>
            )}
            {!sorted.length && (
              <tr>
                <td colSpan={COLS.length} className="px-2 py-6 text-center text-dim">
                  Nothing matches “{filter}”. Esc clears it.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** "route" and "routed" are the same call; only show the desk's verdict when it really differs. */
const same = (a: string, b: string) => a.replace(/d$/, "") === b.replace(/d$/, "");

export function whyLine(r: Ranked | (Row & Extras)): string {
  const reasons = "because" in r.decision ? (Array.isArray(r.decision.because) ? r.decision.because : [r.decision.because]) : [];
  if (reasons.length) return reasons.slice(0, 2).map((b) => b.replace(/:/g, " ").replaceAll("_", " ")).join("; ");
  if (r.decision.kind === "open")
    return `waiting on ${r.decision.flippers.map((f) => f.fact).join(", ") || "the broker"}`;
  return "";
}

function BlotterRow({ r, on, t, onPick, onOpen }: { r: Ranked; on: boolean; t: Thresholds; onPick: () => void; onOpen: () => void }) {
  const has = scored(r);
  const moved = !!r.deskVerdict && !same(r.deskVerdict, r.decision.kind);
  // A routed row's reason is the same sentence 16 times over. Its destination is the news.
  const why = r.decision.kind === "routed" ? `→ ${r.decision.to}` : whyLine(r);
  const whyTitle = r.decision.kind === "routed" ? r.decision.because : why;
  const issues = Object.values(
    r.issues.reduce<Record<string, { kind: string; severity: string; n: number }>>((m, i) => {
      m[i.kind] = { ...i, n: (m[i.kind]?.n ?? 0) + 1 };
      return m;
    }, {}),
  );

  return (
    <tr
      data-on={on ? "1" : "0"}
      tabIndex={on ? 0 : -1}
      onFocus={onPick}
      onClick={onPick}
      onDoubleClick={onOpen}
      className={`h-[68px] cursor-default border-b border-rule/70 ${on ? "cursor-row" : "hover:bg-land"}`}
    >
      <td className="truncate px-4">
        <Link href={`/cases/${r.caseId}`} className="cond block truncate text-[16px] font-semibold text-ink underline-offset-2 hover:text-ochre hover:underline">
          {r.insured}
        </Link>
        <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.08em] text-dim">
          #{r.caseId} · {r.line} · {r.state}{r.deepDived ? " · deep review" : ""}
        </span>
      </td>
      <td className="num hidden px-4 text-right text-[13px] sm:table-cell">{money(r.valueAtStake)}</td>
      <td className="px-3 sm:px-4">
        {has ? (
          <span className="flex items-center gap-2">
            <span className="flex-1">
              <IntervalBar score={r.score} compact t={t} />
            </span>
            <span className="num w-[48px] shrink-0 text-right text-[12px]">
              {r.score!.lo}–{r.score!.hi}
            </span>
          </span>
        ) : (
          // Held to one line on purpose: a blotter row that grows breaks the reading rhythm.
          <span className="flex items-center gap-2" title="no 2025 property guideline scores this line, so it has no interval">
            <span aria-hidden className="h-px flex-1 bg-rule" />
            <span className="w-[76px] shrink-0 whitespace-nowrap text-right text-[10px] text-faint">not scored</span>
          </span>
        )}
      </td>
      <td className="truncate px-3 sm:px-4">
        <DecisionChip decision={r.decision} />
        {moved && <span className="ml-1.5 hidden text-[9px] uppercase tracking-[0.06em] text-ochre sm:inline">desk changed</span>}
      </td>
      <td className="hidden px-4 sm:table-cell" title={whyTitle}>
        <span className={`line-clamp-2 text-[13px] leading-snug ${r.decision.kind === "routed" ? "text-faint" : "text-dim"}`}>{why || "No follow-up required"}</span>
        {(issues.length > 0 || r.override || r.challengeRisks) && (
          <span className="mt-1 block text-[9px] uppercase tracking-[0.07em] text-faint">
            {issues.length ? `${issues.reduce((sum, issue) => sum + issue.n, 0)} data flag${issues.length === 1 ? "" : "s"}` : ""}
            {r.override ? `${issues.length ? " · " : ""}underwriter adjusted` : ""}
            {r.challengeRisks ? `${issues.length || r.override ? " · " : ""}${r.challengeRisks} challenge risk${r.challengeRisks === 1 ? "" : "s"}` : ""}
          </span>
        )}
      </td>
    </tr>
  );
}
