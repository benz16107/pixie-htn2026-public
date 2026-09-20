import type { DeskMemory } from "@/lib/api";

/** What the desk remembered before it worked this case (GET /cases/{id}/memory). */

export function Memory({ m }: { m: DeskMemory }) {
  return (
    <section aria-labelledby="mem-h" className="space-y-5">
      <h2 id="mem-h" className="sr-only">
        What the desk remembered
      </h2>

      <div className="min-w-0">
        <p className="case-prose text-ink" style={{ textWrap: "pretty" }}>
          {m.summary}
        </p>
        {m.recalled.length > 0 && (
          <ul className="mt-1.5 border-t border-rule">
            {m.recalled.map((r) => (
              <li key={r.line} className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-rule py-4 text-[12px] last:border-b-0">
                <a href={`/cases/${r.caseId}`} className="num w-[38px] shrink-0 text-dim underline-offset-2 hover:text-ochre hover:underline">
                  #{r.caseId}
                </a>
                <b className="cond text-[15px] font-medium text-ink">{r.insured}</b>
                <span className="w-full text-dim">{r.why}</span>
                <span
                  title="Pixie's local cross-case recall, written by the desk and read back from disk"
                  className="shrink-0 rounded-sm border border-moss/50 bg-moss/10 px-1 text-[9px] uppercase leading-[13px] tracking-[0.06em] text-moss"
                >
                  Pixie recall
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="border-t border-rule pt-4 text-[12px] text-dim"><summary className="mb-3 cursor-pointer">Recall source</summary>
        <p className="text-[12px] leading-snug text-faint" title={m.source?.store}>
          {m.source ? (
            <><b className="font-medium text-dim">{m.source.name}</b>: {m.source.lines} line{m.source.lines === 1 ? "" : "s"}, stored locally and available without a network.</>
          ) : (
            <>Pixie recall from earlier desk cases.</>
          )}
        </p>
        {m.boundary && <p className="border-t border-rule pt-1 text-[12px] leading-relaxed text-faint">{m.boundary}</p>}
      </details>
    </section>
  );
}
