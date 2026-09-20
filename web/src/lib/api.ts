import type { AskResult, CaseView, DeskEvent, Hex, QueueRow, QuoteView } from "@/contract";
import askFixture from "@/fixtures/ask.json";
import backtestFixture from "@/fixtures/backtest.json";
import type { Pin } from "@/components/BookMap";
import mapBook from "@/fixtures/map-book.json";
import mapPins from "@/fixtures/map-pins.json";
import queue from "@/fixtures/queue.json";
import case126 from "@/fixtures/case-126.json";
import case138 from "@/fixtures/case-138.json";
import case143 from "@/fixtures/case-143.json";
import caseTQ from "@/fixtures/case-TQ-7f3a.json";
import caseTQ2 from "@/fixtures/case-TQ-2b91.json";
import caseTQ3 from "@/fixtures/case-TQ-5c0e.json";
import events138 from "@/fixtures/events-138.json";

// contract.ts leaves BacktestView open; this is the shape the page reads (mirrors proof.BacktestReport).
export type Backtest = typeof backtestFixture;

// A3/Elastic lane: precedent search, declines significant_terms, TIV/premium percentile rank.
// No fixture -- these panels just don't render when the API (or Elastic) is unreachable.
export type PrecedentHit = {
  policy_number: string | null; case_id: string; insured: string; decision: "bound" | "declined";
  state: string; line: string; construction: string; broker: string; tiv: number; premium: number | null;
  incurred: number | null; loss_ratio: number | null; perils: string[]; outcome: string;
};
export type PrecedentResult = { backend: "elastic" | "memory"; query: string; n: number; nLossMaking: number; hits: PrecedentHit[] };
export type SignificantTerm = { field: string; value: string; doc_count: number; background_count: number; score: number };
export type DeclinesInsight = {
  backend: "elastic" | "memory"; nBook: number; nDeclined: number; nLossMaking: number;
  declined: SignificantTerm[]; lossMaking: SignificantTerm[];
};
export type Percentile = { backend: "elastic" | "memory"; n: number; tiv: number; tivPercentile: number; premium?: number; premiumPercentile?: number };

// Tenant cases carry the quote receipt; contract.ts has it on QuoteView only, so the case view extends it here.
export type Receipt = Omit<QuoteView["receipt"], "base"> & { base: number; annual: number; label: string };
export type CaseWithReceipt = CaseView & { receipt?: Receipt };


// The live guideline (docs/GUIDELINE.md). `pred` is one band's test, e.g. {between: [75000, 100000]}.
export type Pred = Record<string, unknown>;
export type GuidelineBand = { band: "target" | "acceptable" | "not_acceptable"; pred: Pred; text: string };
export type GuidelineFactor = { fact: string; label: string; hardFail: boolean; routes: boolean; source: string; bands: GuidelineBand[] };
export type GuidelineEdit =
  | { kind: "threshold"; key: "decline" | "accept"; value: number }
  | { kind: "cap"; value: number }
  | { kind: "points"; key: string; value: number }
  | { kind: "band"; fact: string; band: string; op: string; value: unknown };
export type Scenario = { id: string; label: string; note: string; effect: string; edits: GuidelineEdit[] };
export type GuidelineDoc = {
  id: string; kind: string; hash: string; edited: boolean;
  thresholds: { decline: number; accept: number };
  hardFailCap: number | null;
  points: Record<string, number>;
  factors: GuidelineFactor[];
  scenarios: Scenario[];
};
export type GuidelineCaseChange = {
  caseId: string; insured: string; tierBefore: string; tierAfter: string; tierChanged: boolean;
  scoreBefore: { lo: number; hi: number } | null; scoreAfter: { lo: number; hi: number } | null;
  valueAtStake: number; factors: { fact: string; from: string[]; to: string[]; value: string }[];
};
export type GuidelineDiff = {
  casesScored: number; changed: number; tierChanges: number; counts: Record<string, number>;
  valueIntoQueue: number; valueOutOfQueue: number; cases: GuidelineCaseChange[];
  rankMoves: { caseId: string; insured: string; from: number; to: number; delta: number }[];
  enteredQueue: string[]; leftQueue: string[]; ms: number; change: string[];
};
export type GuidelineResult = { guideline: GuidelineDoc; diff: GuidelineDiff };

// What the desk remembered (GET /cases/{id}/memory). Advisory only: see `boundary`.
export type MemoryRow = {
  caseId: string; insured: string; broker: string; state: string;
  dataIssues: string[]; why: string; line: string;
};
export type MemorySource = {
  name: string; store: string; needsNetwork: false; lines: number;
};
export type DeskMemory = {
  caseId: string; summary: string; recalled: MemoryRow[]; boundary: string;
  source?: MemorySource;
};

// On the server we call the API directly; in the browser we go through the same-origin proxy,
// so the page works from another machine (the API sends no CORS headers).
const BASE = typeof window === "undefined" ? (process.env.ATLAS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") : "/api/atlas";
const FIXTURES_ONLY = process.env.NEXT_PUBLIC_FIXTURES === "1";
export const PERILS = ["all", "flood", "wildfire", "wind", "quake"] as const;
export type Peril = (typeof PERILS)[number];
const OPEN = new Set(["cleared", "received", "quoted"]);

const cases: Record<string, unknown> = { "126": case126, "138": case138, "143": case143, "TQ-7f3a": caseTQ, "TQ-2b91": caseTQ2, "TQ-5c0e": caseTQ3 };
const events: Record<string, unknown> = { "138": events138 };

// Bundled samples are an explicit mode. An unavailable API must not impersonate the current book.
async function get<T>(path: string, fixture: () => T | undefined, optional = false): Promise<T | undefined> {
  if (!FIXTURES_ONLY) {
    try {
      const res = await fetch(BASE + path, { cache: "no-store", signal: AbortSignal.timeout(1500) });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return undefined;
    } catch {}
    if (optional) return undefined;
    throw new Error("The desk API could not load this page. Check the connection and try again.");
  }
  return fixture();
}

async function postJson<T>(path: string, body: unknown): Promise<T | undefined> {
  if (FIXTURES_ONLY) return undefined;
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: string }> {
  if (FIXTURES_ONLY) return { ok: false, status: "Sample mode: nothing was sent or changed." };
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const result = await res.json().catch(() => ({}));
    const status = typeof result.status === "string" ? result.status : "";
    const ok = res.ok && !["failed", "not_connected"].includes(status);
    const labels: Record<string, string> = { sent: "Sent", dry: "Dry run: composed, not sent", not_connected: "Account not connected; nothing sent", failed: "Send failed" };
    return { ok, status: res.ok ? `${result.deduped ? "Already processed: " : ""}${(labels[status] ?? status) || "Done"}` : `Request failed (${res.status})` };
  } catch {
    return { ok: false, status: "API unreachable" };
  }
}

/** Unlike post(), this keeps the API's `detail`: the override bound is only a bound if you see it. */
async function send(path: string, init: RequestInit): Promise<{ ok: boolean; detail: string }> {
  if (FIXTURES_ONLY) return { ok: false, detail: "Sample mode: nothing was changed." };
  try {
    const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(8000) });
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    return { ok: res.ok, detail: res.ok ? "" : (body.detail ?? `API returned ${res.status}`) };
  } catch {
    return { ok: false, detail: "API unreachable" };
  }
}

/** Like send(), but keeps the response body: the guideline diff IS the answer. */
async function sendJson<T>(path: string, init: RequestInit): Promise<{ ok: boolean; detail: string; data?: T }> {
  if (FIXTURES_ONLY) return { ok: false, detail: "Sample mode: nothing was changed." };
  try {
    const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(15000) });
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    return res.ok ? { ok: true, detail: "", data: body as T } : { ok: false, detail: body.detail ?? `API returned ${res.status}` };
  } catch {
    return { ok: false, detail: "desk API unreachable" };
  }
}

export const api = {
  queue: async (view: "open" | "all" | "consumer") =>
    (await get<QueueRow[]>(`/queue?view=${view}`, () => {
      const rows = queue as unknown as QueueRow[];
      return view === "consumer" ? rows.filter((r) => r.line === "tenant") : view === "open" ? rows.filter((r) => OPEN.has(r.status)) : rows;
    })) ?? [],
  case: (id: string) => get<CaseWithReceipt>(`/cases/${id}`, () => cases[id] as CaseWithReceipt | undefined),
  events: async (id: string) =>
    (await get<DeskEvent[]>(`/cases/${id}/events?replay=0`, () => events[id] as DeskEvent[] | undefined)) ?? [],
  mapBook: async (peril: Peril, res: 3 | 5 = 5) =>
    (await get<Hex[]>(`/map/book?res=${res}&peril=${peril === "all" ? "" : peril}`, () =>
      (mapBook as unknown as Record<string, Record<Peril, Hex[]>>)[res][peril],
    )) ?? [],
  // Not in contract.ts yet: case sites for the map. Backend can serve it as GET /map/pins.
  mapPins: async () => (await get<Pin[]>(`/map/pins`, () => mapPins as unknown as Pin[])) ?? [],
  askCanned: Object.keys(askFixture),
  ask: async (question: string) =>
    (await postJson<AskResult & { path?: string }>(`/ask`, { question })) ??
    ((askFixture as unknown as Record<string, AskResult>)[question] ? { ...(askFixture as unknown as Record<string, AskResult>)[question], path: "sample" } : undefined),
  backtest: async () => (await get<Backtest>(`/backtest`, () => backtestFixture)) as Backtest,
  precedent: (id: string) => get<PrecedentResult>(`/cases/${id}/precedent`, () => undefined, true),
  declines: () => get<DeclinesInsight>(`/insights/declines`, () => undefined, true),
  percentile: (id: string) => get<Percentile>(`/cases/${id}/percentile`, () => undefined, true),
  override: (caseId: string, points: number, reason: string) =>
    send(`/cases/${caseId}/override`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ points, reason }) }),
  clearOverride: (caseId: string) => send(`/cases/${caseId}/override`, { method: "DELETE" }),
  memory: (id: string) => get<DeskMemory>(`/cases/${id}/memory`, () => undefined, true),
  demoReset: () => post(`/demo/reset`, {}),
  guideline: () => get<GuidelineDoc>(`/guideline`, () => undefined, true),
  putGuideline: (doc: GuidelineDoc) =>
    sendJson<GuidelineResult>(`/guideline`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) }),
  resetGuideline: () => sendJson<GuidelineResult>(`/guideline/reset`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
};
