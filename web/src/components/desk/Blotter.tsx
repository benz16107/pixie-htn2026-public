"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Row } from "@/lib/live";
import { BandScale, DecisionChip, IntervalBar, IssueTag, money, THRESHOLDS, type Thresholds } from "../bits";
import { QueueTable, whyLine, type Ranked } from "../QueueTable";
import { useKeys } from "./keys";

type Extras = { deskVerdict?: string; challengeRisks?: number };

/** Three numbers, not five: the split between the two books reads better as a sentence. */
const TILES = (rows: (Row & Extras)[]) => [
  { label: "submissions", value: String(rows.length), note: "rows in view" },
  { label: "still undecided", value: String(rows.filter((r) => r.decision.kind === "open").length), note: "unresolved facts may change the decision" },
  { label: "value at stake", value: money(rows.reduce((n, r) => n + r.valueAtStake, 0)), note: "total insured value in view" },
];

export function Blotter({ rows, view, t = THRESHOLDS }: { rows: (Row & Extras)[]; view: "open" | "all" | "scored"; t?: Thresholds }) {
  const router = useRouter();
  const [here, setHere] = useState<Ranked | null>(null);
  const [filter, setFilter] = useState("");
  const onCursor = useCallback((r: Ranked | null) => setHere(r), []);

  useKeys(
    (e) => {
      if (e.key === "o") return router.push("/queue?view=open"), true;
      if (e.key === "A") return router.push("/queue?view=all"), true;
      return false;
    },
    [router],
  );

  return (
    <main className="queue-page grid h-[calc(100dvh-40px)] grid-rows-[108px_minmax(0,1fr)] overflow-hidden">
      <header className="flex items-center gap-6 border-b border-edge bg-land px-6">
        <div className="min-w-[260px] flex-1">
          <p className="kicker text-ochre">Commercial submissions</p>
          <h1 className="cond mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">Submissions</h1>

        </div>
        <div className="hidden items-center border-l border-rule lg:flex">
          {TILES(rows).map((tile) => (
            <div key={tile.label} className="min-w-[116px] px-4" title={tile.note}>
              <span className="num block text-[21px] font-medium leading-none text-ink">{tile.value}</span>
              <span className="kicker mt-1 block">{tile.label}</span>
            </div>
          ))}
        </div>
        <div className="flex h-10 items-stretch border border-edge" role="group" aria-label="Which submissions">
          {(
            [
              ["scored", "scored"],
              ["open", "needs review"],
              ["all", "all cases"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={`/queue?view=${v}`}
              aria-current={v === view ? "page" : undefined}
              className={`flex items-center px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors duration-150 ${
                v === view ? "bg-ink text-paper" : "text-dim hover:bg-raise hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <Link href="/cases/138" className="flex h-10 shrink-0 items-center bg-ochre px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-paper hover:bg-[#d9912e]">
          Review #138
        </Link>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-h-0 border-r border-edge">
          <QueueTable rows={rows} view={view} onCursor={onCursor} filter={filter} setFilter={setFilter} t={t} />
        </div>
        {/* One scroll, not two: at 800px tall a split column cut the preview off mid-sentence. */}
        <aside className="min-h-0 overflow-y-auto" aria-label="The row under the cursor">
          <Preview r={here} t={t} />
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-rule py-1">
      <span className="kicker w-[74px] shrink-0">{label}</span>
      <span className="min-w-0 flex-1 text-[12px]">{children}</span>
    </div>
  );
}

/** The cursor row, opened out. Nothing here is fetched: it is the blotter row's own fields. */
function Preview({ r, t }: { r: Ranked | null; t: Thresholds }) {
  if (!r)
    return (
      <div className="px-6 py-10 text-center text-[12px] text-faint">Select a submission.</div>
    );
  const moved = !!r.deskVerdict && r.deskVerdict.replace(/d$/, "") !== r.decision.kind.replace(/d$/, "");
  const straddle = "straddles" in r.decision ? r.decision.straddles : null;
  const why = whyLine(r);

  return (
    <div className="px-6 py-6">
      <p className="flex items-baseline gap-2">
        <span className="num text-[11px] text-dim">#{r.caseId}</span>
        <span className="ml-auto">
          <DecisionChip decision={r.decision} large />
        </span>
      </p>
      <h2 className="cond mt-1 text-[26px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">{r.insured}</h2>
      <p className="mt-1.5 text-[13px] text-dim">
        {r.line} · {r.state} · {r.status}
        {r.label ? ` · ${r.label.toLowerCase()}` : ""}
      </p>

      {r.score && r.decision.kind !== "routed" ? (
        <div className="mt-3">
          <p className="flex items-baseline justify-between">
            <span className="kicker">{r.override ? "Engine score" : "Score range"}</span>
            <span className="num text-[22px] font-medium leading-none text-ink">
              {r.score.lo}–{r.score.hi}
            </span>
          </p>
          <div className="mt-1.5">
            <IntervalBar score={r.score} t={t} />
          </div>
          <BandScale t={t} className="mt-1" />
          {straddle !== null && <p className="mt-2 text-[12px] leading-snug text-ochre">The range crosses the line at {straddle}, so unresolved facts can change the decision.</p>}
        </div>
      ) : (
        <p className="mt-3 border border-dashed border-edge px-2 py-3 text-center text-[11px] text-faint">
          No guideline scores this line, so there is no interval to read.
        </p>
      )}

      <div className="mt-3">
        <Field label="at stake">
          <span className="num">{money(r.valueAtStake)}</span>
        </Field>
        {r.enrichmentDelta !== null && (
          <Field label="outside data">
            <span className="num">
              {r.enrichmentDelta > 0 ? "+" : r.enrichmentDelta < 0 ? "−" : "±"}
              {Math.abs(r.enrichmentDelta)}
            </span>{" "}
            <span className="text-dim">points</span>
          </Field>
        )}
        <Field label="desk">
          {moved ? (
            <span className="text-ochre">
              went with {r.deskVerdict!.replaceAll("_", " ")}, against the rules&rsquo; {r.decision.kind}
            </span>
          ) : (
            <span className="text-dim">{r.deskVerdict ? "agreed with the rules" : "not reviewed"}</span>
          )}
        </Field>
        {r.override && (
          <Field label="underwriter">
            <span className="num text-ink">
              {r.override.points > 0 ? "+" : "−"}
              {Math.abs(r.override.points)}
            </span>{" "}
            <span className="text-ink">
              → {r.override.score.lo}–{r.override.score.hi}, {r.override.decision.kind}
            </span>
            <span className="block text-faint" title={r.override.reason}>
              &ldquo;{r.override.reason}&rdquo;
            </span>
          </Field>
        )}
        <Field label="challenger">
          {r.challengeRisks ? (
            <span className="text-rust">{r.challengeRisks} risks raised</span>
          ) : (
            <span className="text-dim">has not run on this case</span>
          )}
        </Field>
        <Field label="deep dive">
          <span className={r.deepDived ? "text-moss" : "text-dim"}>{r.deepDived ? "completed" : r.deskVerdict ? "triage only" : "not run"}</span>
        </Field>
      </div>

      {why && (
        <div className="mt-3">
          <p className="kicker">What it turns on</p>
          <p className="cond mt-1 text-[16px] leading-snug">{why}</p>
        </div>
      )}

      {r.issues.length > 0 && (
        <div className="mt-3">
          <p className="kicker">Data issues</p>
          <ul className="mt-1 space-y-1">
            {r.issues.map((i, n) => (
              <li key={`${i.kind}${n}`} className="flex items-baseline gap-2 text-[11px]">
                <IssueTag kind={i.kind} severity={i.severity} />
                <span className="text-dim">{i.kind.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/cases/${r.caseId}`}
        className="mt-5 flex min-h-11 items-center justify-center bg-ochre px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-paper transition-colors duration-150 hover:bg-[#d9912e]"
      >
        open the case
      </Link>
    </div>
  );
}
