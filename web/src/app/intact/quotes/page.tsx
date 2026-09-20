import { IntactQueue } from "@/components/intact/IntactQueue";
import { intactQuotes } from "@/lib/intact";

export const dynamic = "force-dynamic";

export default async function IntactQuotesPage() {
  const rows = await intactQuotes();
  const ready = rows.filter((row) => row.decision.kind === "approve").length;
  const referred = rows.filter((row) => row.decision.kind === "refer").length;

  return (
    <main className="intact-page intact-list-page">
      <header className="intact-page-title">
        <div>
          <p className="intact-label">Renter quote operations</p>
          <h1>Quotes and advisor referrals</h1>
        </div>
        <p>{ready} ready · {referred} need review · {rows.length} total</p>
      </header>
      <IntactQueue rows={rows} />
      <p className="intact-fineprint intact-list-note">This local queue contains demo quotes. Prices are illustrative and are not Intact prices or offers.</p>
    </main>
  );
}
