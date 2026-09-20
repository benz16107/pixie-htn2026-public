import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "@/components/Receipt";
import { api } from "@/lib/api";

export default async function IntactCasePage({ params }: PageProps<"/intact/cases/[id]">) {
  const { id } = await params;
  const view = await api.case(id);
  if (!view || view.kind !== "tenant") notFound();
  const referred = view.decision.kind === "refer";
  const reasons = view.decision.kind === "open"
    ? ["Waiting for a fact that can change the decision"]
    : view.decision.kind === "routed"
      ? [view.decision.because]
      : view.decision.because;

  return (
    <main className="intact-page intact-case-page">
      <Link href="/intact/quotes" className="intact-back">← Renter quotes</Link>
      <header className="intact-case-head">
        <div>
          <p className="intact-label">Quote #{view.caseId}</p>
          <h1>{view.title}</h1>
        </div>
        <span className={`intact-status ${referred ? "intact-status-refer" : "intact-status-approved"}`}>
          {referred ? "Advisor review" : "Ready"}
        </span>
      </header>

      <div className="intact-case-grid">
        <section className="intact-case-call">
          <p className="intact-label">Decision</p>
          <h2>{referred ? "A person needs to check this quote" : "The renter rules can price this quote"}</h2>
          <ul>
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <p>{view.explanation}</p>
          {referred && (
            <Link href={`/cases/${view.caseId}`} className="intact-primary-link">
              Continue in Federato desk →
            </Link>
          )}
        </section>

        <section className="intact-receipt-panel">
          {view.receipt ? <Receipt r={view.receipt} /> : <p>The quote receipt is unavailable.</p>}
        </section>
      </div>

      <section className="intact-facts">
        <div className="intact-section-heading">
          <div><p className="intact-label">Attached facts</p><h2>What the advisor receives</h2></div>
          <span>{view.facts.length} sourced values</span>
        </div>
        <div className="intact-fact-grid">
          {view.facts.map((fact) => (
            <div key={fact.id}>
              <span>{fact.label}</span>
              <strong>{fact.display}</strong>
              <small>{fact.source}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
