import type { Receipt as R } from "@/lib/api";

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;

// Totals are summed in cents so the check is exact, not float-close.
export function Receipt({ r }: { r: R }) {
  const cents = Math.round(r.base * 100) + r.lines.reduce((s, l) => s + Math.round(l.dollars * 100), 0);
  const exact = cents === Math.round(r.annual * 100);
  return (
    <section aria-labelledby="rc" className="max-w-[560px]">
      <h2 id="rc" className="kicker mb-1.5 flex justify-between">
        <span>Receipt</span>
        <span className={exact ? "text-moss" : "text-rust"}>{exact ? "✓ lines sum exactly" : "× lines do not sum to the total"}</span>
      </h2>
      <table className="w-full border-collapse font-mono text-[12px]">
        <tbody>
          <tr className="border-t border-edge">
            <th scope="row" className="py-1.5 text-left cond font-medium">Base rate</th>
            <td />
            <td className="num py-1.5 text-right">{usd(r.base)}</td>
          </tr>
          {r.lines.map((l) => (
            <tr key={l.label} className="border-t border-dashed border-rule align-top" title={l.source}>
              <th scope="row" className="py-1.5 pr-3 text-left cond font-normal">
                {l.label}
                <span className="block text-[11px] text-dim">{l.source}</span>
              </th>
              <td className="num w-[90px] py-1.5 text-right text-dim">
                ×{l.multiplier.toFixed(2)}
                {l.capped && <span className="ml-1 text-[10px] text-ochre">[cap]</span>}
              </td>
              <td className="num w-[90px] py-1.5 text-right">{l.dollars > 0 ? "+" : ""}{usd(l.dollars)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-edge text-[13px]">
            <th scope="row" className="py-2 text-left cond font-semibold">Annual</th>
            <td className="num py-2 text-right text-[11px] text-dim">{usd(r.annual / 12)}/mo</td>
            <td className="num py-2 text-right font-semibold">{usd(cents / 100)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-dim">{r.label}</p>
    </section>
  );
}
