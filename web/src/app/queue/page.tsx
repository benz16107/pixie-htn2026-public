import { api } from "@/lib/api";
import type { Row } from "@/lib/live";
import { Blotter } from "@/components/desk/Blotter";
import { THRESHOLDS } from "@/components/bits";
import { redirect } from "next/navigation";

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const requested = (await searchParams).view;
  if (requested === "consumer") redirect("/intact/quotes");
  const view = requested === "all" || requested === "open" ? requested : "scored";
  // The guideline is editable at /guideline, so the band ruler on every row has to read the one in
  // force rather than the two numbers that happened to be filed on disk.
  const [rowsRaw, guideline] = await Promise.all([api.queue(view === "open" ? "open" : "all"), api.guideline()]);
  const commercial = (rowsRaw as unknown as (Row & { deskVerdict?: string; challengeRisks?: number })[])
    .filter((row) => row.region !== "toronto" && !row.caseId.startsWith("TQ-"));
  // The API's "open" view means active submissions, which also includes already routed and
  // declined rows. On this screen "needs review" means an unresolved underwriting decision.
  const rows = commercial.filter((row) => view === "open" ? row.decision.kind === "open" : view === "scored" ? row.score !== null : true);
  return <Blotter rows={rows} view={view} t={guideline?.thresholds ?? THRESHOLDS} />;
}
