import Link from "next/link";
import type { QueueRow } from "@/contract";
import type { CaseWithReceipt } from "@/lib/api";

type QuoteRow = QueueRow & { quote?: CaseWithReceipt };

const dollars = (n: number) => `$${n.toFixed(2)}`;
const decisionReason = (row: QueueRow) => {
  if (row.decision.kind === "open") return "Waiting for a fact that can change the decision";
  if (row.decision.kind === "routed") return row.decision.because;
  return row.decision.because[0] ?? "No reason recorded";
};

export function IntactQueue({ rows, compact = false }: { rows: QuoteRow[]; compact?: boolean }) {
  const shown = compact ? rows.slice(0, 4) : rows;

  if (!shown.length) {
    return (
      <div className="intact-empty">
        <p>No renter quotes are in the local queue yet.</p>
        <p>Finish one quote in the Expo app, then refresh this page.</p>
      </div>
    );
  }

  return (
    <div className="intact-quote-list">
      {shown.map((row) => {
        const receipt = row.quote?.receipt;
        const referred = row.decision.kind === "refer";
        return (
          <Link key={row.caseId} href={`/intact/cases/${row.caseId}`} className="intact-quote-row">
            <span className={`intact-status ${referred ? "intact-status-refer" : "intact-status-approved"}`}>
              {referred ? "Advisor review" : "Ready"}
            </span>
            <span className="intact-quote-person">
              <strong>{row.insured}</strong>
              <small>#{row.caseId} · {row.state}</small>
            </span>
            <span className="intact-quote-reason">
              {decisionReason(row)}
            </span>
            <span className="intact-quote-price">
              <strong>{receipt ? dollars(receipt.annual) : "Pending"}</strong>
              <small>{receipt ? "illustrative / year" : "receipt unavailable"}</small>
            </span>
            <span aria-hidden className="intact-row-arrow">→</span>
          </Link>
        );
      })}
    </div>
  );
}
