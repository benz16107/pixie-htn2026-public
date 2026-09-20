import type { QueueRow } from "@/contract";
import { api, type CaseWithReceipt } from "@/lib/api";

export type IntactQuoteRow = QueueRow & { quote?: CaseWithReceipt };

export async function intactQuotes(): Promise<IntactQuoteRow[]> {
  const rows = await api.queue("consumer");
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      quote: await api.case(row.caseId),
    })),
  );
}
