// A3/Elastic lane: precedent search + declines significant_terms + TIV percentile, all read
// straight from pixie-precedent (docs/ELASTIC.md). Every number here is API-sourced, never guessed.
import type { DeclinesInsight, Percentile, PrecedentResult } from "@/lib/api";
import { money } from "./bits";

/** Which store answered. The desk never hides whether a number came from Elastic or memory. */
function BackendTag({ backend }: { backend: "elastic" | "memory" }) {
  return (
    <span
      title={backend === "elastic" ? "served by the Elasticsearch index pixie-precedent" : "served by the in-process fallback store"}
      className={`rounded-sm border px-1 font-mono text-[9px] uppercase leading-[13px] tracking-[0.08em] ${
        backend === "elastic" ? "border-moss/50 bg-moss/10 text-moss" : "border-edge text-dim"
      }`}
    >
      {backend}
    </span>
  );
}

export function PrecedentPanel({ p }: { p: PrecedentResult }) {
  if (!p.hits.length) return null;
  return (
    <section aria-labelledby="pc">
      <h2 className="kicker mb-1.5 flex items-center justify-between">
        <span id="pc">Precedent</span>
        <BackendTag backend={p.backend} />
      </h2>
      <p className="mb-1.5 text-[11px] text-dim">
        {p.hits.length} nearest of {p.n} past risks in the book. {p.nLossMaking} of {p.hits.length} produced losses.
      </p>
      <ul>
        {p.hits.map((h) => (
          <li key={h.case_id} className="border-t border-rule py-1 text-[11px]">
            <b className="cond text-[12px] font-semibold">{h.insured}</b>{" "}
            <span className={h.decision === "declined" ? "text-rust" : "text-moss"}>{h.decision}</span>
            <span className="text-dim"> — {h.outcome}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FIELD_LABEL: Record<string, string> = { perils: "peril", state: "state", construction: "construction", broker: "broker" };

function TermList({ terms, tone }: { terms: DeclinesInsight["declined"]; tone: string }) {
  if (!terms.length) return <p className="text-[11px] text-faint">Nothing over-represented at this sample size.</p>;
  const top = terms[0]?.score ?? 1;
  return (
    <ul>
      {terms.slice(0, 4).map((t) => (
        <li key={`${t.field}:${t.value}`} className="relative border-t border-rule py-[3px] text-[11px]">
          {/* the bar is the score, so the list ranks itself without a second column of numbers */}
          <span aria-hidden className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${Math.max(4, (t.score / top) * 100)}%`, opacity: 0.14 }} />
          <span className="relative flex items-baseline gap-1.5">
            <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-faint">{FIELD_LABEL[t.field] ?? t.field}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{t.value}</span>
            <span className="num shrink-0 text-[10px] text-dim" title={`${t.doc_count} of the ${t.background_count} on the book with this trait`}>
              {t.doc_count}/{t.background_count}
            </span>
            <span className="num w-[30px] shrink-0 text-right text-[10px] text-dim" title="how far over its usual rate this trait turns up here">
              {t.score.toFixed(2)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "What the book teaches" -- significant_terms over declines and loss-making bound policies vs. the whole book. */
export function DeclinesPanel({ d }: { d: DeclinesInsight }) {
  return (
    <section aria-labelledby="dc" className="px-3.5 py-2.5">
      <h2 className="kicker mb-1 flex items-center justify-between">
        <span id="dc">What the book teaches</span>
        <BackendTag backend={d.backend} />
      </h2>
      <p className="mb-2 text-[11px] leading-snug text-dim">
        What turns up far more often in the {d.nDeclined} we declined and the {d.nLossMaking} that lost money than in the other {d.nBook} on the book.
        Elasticsearch <span className="num text-faint">significant_terms</span>, so a common trait only counts if it is over-represented here.
      </p>
      <p className="text-[9px] uppercase tracking-[0.1em] text-rust">Declines</p>
      <TermList terms={d.declined} tone="bg-rust" />
      <p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-ochre">Loss-making</p>
      <TermList terms={d.lossMaking} tone="bg-ochre" />
    </section>
  );
}

/** "TIV is in the 38th percentile of what we write" -- percentile_ranks against the bound book. */
export function PercentileLine({ p }: { p: Percentile }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 normal-case tracking-normal text-dim">
      TIV <span className="num text-ink">{money(p.tiv)}</span> is the{" "}
      <span className="num text-ochre">{Math.round(p.tivPercentile)}th</span> percentile of what we write
      {p.premiumPercentile !== undefined && (
        <>
          (premium <span className="num text-ochre">{Math.round(p.premiumPercentile)}th</span>)
        </>
      )}
      <BackendTag backend={p.backend} />
    </span>
  );
}
