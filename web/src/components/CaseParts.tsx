import type { CaseView } from "@/contract";
import { money } from "./bits";
import { parseHazard, parseSkip, signed, sourceLabel } from "@/lib/format";

type Portfolio = NonNullable<CaseView["portfolio"]>;

// Copy comes from the API's numbers; the count and radius are read from its line, or left out.
export function portfolioSentence(p: Portfolio) {
  const count = p.line.match(/^(\d+) active property locations?/)?.[1];
  const radius = p.line.match(/within (\d+\s?km)/)?.[1];
  const who = count ? `${count} active property location${count === "1" ? "" : "s"}` : "Active property locations";
  const over = p.neighbourhoodTiv > p.threshold;
  return `${who}${radius ? ` within ${radius}` : " nearby"} hold ${money(p.neighbourhoodTiv)}. ${over ? "Over" : "Under"} the ${money(p.threshold)} threshold: ${signed(p.points)} points.`;
}

export function PortfolioCallout({ p }: { p: Portfolio }) {
  return (
    <p className="absolute right-5 top-5 w-[270px] rounded-sm border border-edge bg-paper/95 px-3 py-2 text-[12px] leading-snug">
      <b className={`float-right ml-2.5 font-mono text-[20px] font-medium leading-none ${p.points < 0 ? "text-rust" : "text-moss"}`}>{signed(p.points)}</b>
      <span className="kicker mb-0.5 block">Portfolio</span>
      {portfolioSentence(p)}
    </p>
  );
}

export function HazardCard({ risk }: { risk: CaseView["risk"] }) {
  if (!risk.factors.length && !risk.skipped.length) return null;
  return (
    <section aria-labelledby="hz" className="absolute bottom-[18px] left-5 w-[380px] max-w-[calc(100%-40px)] rounded-sm border border-rule bg-paper/95 px-3.5 py-2.5">
      <h2 className="kicker mb-1.5 flex justify-between">
        <span id="hz">Hazard at site</span>
        <span>
          total <span className="num text-ink">×{risk.total.toFixed(2)}</span>
          {risk.totalCapped && " capped"}
        </span>
      </h2>
      <ul className="space-y-1.5">
        {risk.factors.map((f) => {
          const h = parseHazard(f.line, f.peril);
          const pts = h.points;
          return (
            <li key={f.peril} className="grid grid-cols-[48px_minmax(0,1fr)] items-baseline gap-x-2">
              <span className={`num text-[13px] font-medium ${f.applied > 1 ? "text-rust" : f.applied < 1 ? "text-moss" : ""}`}>×{f.applied.toFixed(2)}</span>
              <span className="min-w-0 text-[12px] leading-snug">
                <b className="font-semibold">{h.peril}.</b> {h.sentence}
                {f.capped && <span className="ml-1 font-mono text-[10px] text-ochre">[capped]</span>}
                <span className="mt-0.5 block text-[11px] text-dim">
                  {pts !== undefined && <span className="num">{signed(pts)} pts · </span>}
                  {f.source.startsWith("http") ? (
                    <a href={f.source} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ink hover:underline" title={f.source}>
                      {sourceLabel(f.source)}
                    </a>
                  ) : (
                    sourceLabel(f.source)
                  )}
                </span>
              </span>
            </li>
          );
        })}
        {risk.skipped.map(([key, why]) => {
          const s = parseSkip(key, why);
          return (
            <li key={key} className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-2 text-[11px] text-dim">
              <span className="font-mono">skip</span>
              <span className="min-w-0">
                {s.peril}: {s.reason}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
