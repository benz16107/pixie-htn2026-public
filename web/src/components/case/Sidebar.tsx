import { money } from "@/components/bits";
import type { Challenge, Precedent } from "@/lib/explain";

/** The Challenger's case against the decision: sized risks, a remedy each, and what would change its mind. */
export function Challenger({ c, deskVerdict, rulesDecision }: { c: Challenge; deskVerdict?: string; rulesDecision: string }) {
  const moved = deskVerdict && deskVerdict !== rulesDecision;
  return (
    <section aria-labelledby="ch-h" className="min-w-0">
      <h2 id="ch-h" className="kicker mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span>The case against</span>
        <span className="normal-case tracking-normal text-faint">
          challenger{c.verified && <span className="ml-1.5 text-moss">✓ verified</span>}
        </span>
      </h2>

      {moved && (
        <p className="mb-5 border border-ochre/30 bg-ochre-soft/30 p-3 text-[13px] leading-relaxed">
          The rules say <b className="text-ink">{rulesDecision}</b>. After the challenge the desk went with{" "}
          <b className="text-ochre">{deskVerdict.replaceAll("_", " ")}</b>.
        </p>
      )}

      <p className="case-prose text-ink" style={{ textWrap: "pretty" }}>
        {c.argument}
      </p>

      <ul className="mt-5">
        {c.risks.map((r) => (
          <li key={r.risk} className="border-t border-rule py-3">
            <details>
              <summary className="cursor-pointer text-[14px] leading-relaxed text-ink">{r.risk}</summary>
              <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-dim">
                <p>{r.size}</p>
                {r.likelihood && <p>{r.likelihood}</p>}
                <p><span className="text-ink">Remedy: </span>{r.remedy}</p>
                {r.grounded && <p className="text-[11px] text-moss">Grounded in case evidence</p>}
              </div>
            </details>
          </li>
        ))}
      </ul>

      {c.changeMyMind.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="kicker mb-0.5">What would change my mind</p>
          <ul>
            {c.changeMyMind.map((m) => (
              <li key={m} className="cond relative mt-2 pl-3 text-[15px] leading-relaxed text-dim before:absolute before:left-0 before:top-[7px] before:size-[4px] before:bg-dim">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** What happened last time we wrote risks like this one. */
export function PrecedentPanel({ p }: { p: Precedent }) {
  if (!p.hits.length) return null;
  // A declined precedent never became a policy, so it has no premium, no incurred loss and no
  // loss ratio. Those hits still belong in the list: they say what the desk turned away.
  const written = p.hits.filter((h): h is typeof h & { lossRatio: number; premium: number } => typeof h.lossRatio === "number");
  const worst = written.length ? written.reduce((a, b) => (b.lossRatio > a.lossRatio ? b : a)) : null;
  return (
    <section aria-labelledby="pr-h" className="py-1">
      <h2 id="pr-h" className="kicker mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span>{p.hits.length} comparable risks</span>
        <span
          title={p.backend === "elastic" ? "served by the Elasticsearch index pixie-precedent" : "served by the in-process fallback store"}
          className={`rounded-sm border px-1 text-[9px] uppercase leading-[13px] tracking-[0.08em] ${
            p.backend === "elastic" ? "border-moss/50 bg-moss/10 text-moss" : "border-edge text-dim"
          }`}
        >
          {p.backend}
        </span>
      </h2>
      <p className="text-[10px] leading-snug text-faint">{p.basisExplained}</p>
      <ul className="mt-1">
        {p.hits.map((h) => (
          <li key={h.policyNumber ?? h.insured} className="border-t border-rule py-4">
            <p className="flex items-baseline gap-2">
              <b className="cond min-w-0 flex-1 truncate text-[12px] font-medium">{h.insured}</b>
              <span className="num text-[10px] text-faint">{h.state}</span>
              {typeof h.lossRatio === "number" ? (
                <span
                  title="incurred losses over premium: over 1.00 means the policy lost money"
                  className={`num text-[11px] ${h.lossRatio >= 1 ? "text-rust" : "text-moss"}`}
                >
                  {h.lossRatio.toFixed(2)}
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-[0.06em] text-faint">declined</span>
              )}
            </p>
            <p className="num text-[10px] text-faint">
              {money(h.tiv)} TIV ·{" "}
              {typeof h.premium === "number" ? `prem ${money(h.premium)} · incurred ${money(h.incurred ?? 0)} · ${h.decision}` : h.outcome}
            </p>
          </li>
        ))}
      </ul>
      <p className="cond mt-1 border-t border-rule pt-1 text-[12px] leading-snug text-dim">
        {worst ? (
          <>
            The worst of them, {worst.insured}, ran a loss ratio of <b className="num font-semibold text-rust">{worst.lossRatio.toFixed(2)}</b> on{" "}
            {money(worst.premium)} of premium.
          </>
        ) : (
          "These submissions were declined; no policy loss outcome is available."
        )}
      </p>
    </section>
  );
}
