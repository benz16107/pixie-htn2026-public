import type { DecisionView, Interval } from "@/contract";
import { API, PROXY } from "./live";

export type StepKind = "factor" | "cap" | "hazard" | "portfolio" | "clamp" | "human";
export type PriceKind = "base" | "multiplier" | "flat";

/** Tenant cases price in dollars rather than points, so their waterfall is a running total. */
export type PriceStep = {
  key: string;
  label: string;
  kind: PriceKind;
  multiplier?: number;
  dollars: number;
  runningDollars: number;
  capped: boolean;
  source?: string;
  percentile?: number;
};

export type Step = {
  key: string;
  label: string;
  band?: string;
  kind: StepKind;
  pointsLo: number;
  pointsHi: number;
  runningLo: number;
  runningHi: number;
  capped: boolean;
  rule?: string;
  value?: string;
  provenance?: string;
  source?: string;
  layer?: string;
  multiplier?: number;
  evidence?: string;
  citation?: string;
  cells?: string[];
  rawPointsLo?: number;
  rawPointsHi?: number;
  maxPoints?: number;
  multiplierRule?: string;
};

export type Calculation = {
  points: Record<string, number>;
  denominator: number;
  raw: Interval;
  base: Interval;
  afterCaps: Interval;
  hardFailCap: number | null;
  hazard: { applied: boolean; product: number | null; total: number | null; bounds: number[]; maxPoints: number; points: number };
  portfolio: { applied: boolean; points: number; nearTiv: number | null; maxPenalty: number; radiusKm: number; tivPerPoint: number };
  exact: Interval;
  premiumEstimate: { tiv: number; lo: number; hi: number; median: number | null; rateLo: number; rateHi: number; method: string; policies: string[] } | null;
};

export type Explain = {
  caseId: string;
  kind: "commercial" | "tenant";
  score: Interval | null;
  decision: DecisionView;
  thresholds: { decline: number; accept: number };
  rulesId: string;
  reconciles: boolean;
  steps: Step[];
  calculation?: Calculation | null;
  /** tenant only */
  annual?: number;
  label?: string;
  percentiles?: Record<string, number>;
};

export const isTenantExplain = (x: Explain | null): x is Explain & { steps: PriceStep[]; annual: number } =>
  !!x && x.kind === "tenant" && typeof x.annual === "number";

export type Flip = { at: number; display: string; from: string; to: string; text: string };
export type Sensitivity = {
  caseId: string;
  facts: {
    fact: string;
    label: string;
    provenance: string;
    resolver?: string;
    low: { value: number; display: string; decision: string };
    high: { value: number; display: string; decision: string };
    flip?: Flip | null;
    movesDecision: boolean;
    spread?: number;
  }[];
};

export type WhatIf = {
  before: { score: Interval | null; decision: DecisionView };
  after: { score: Interval | null; decision: DecisionView };
  changed: { fact: string; from?: string; to?: string }[];
  decisiveOverride?: string | null;
  notes?: string[];
};

/** One fact axis of the decision space: its grid values, and where the case sits on it. */
export type SurfaceAxis = {
  fact: string;
  label: string;
  unit: "money" | "year" | "count";
  min: number;
  max: number;
  values: number[];
  /** 0-1 position of each grid value; the step nearest the case's own value is snapped onto it. */
  t: number[];
  ticks: string[];
  at: number | null;
  tAt: number | null;
  provenance: string;
  uncertainty: { lo: number; hi: number; tLo: number; tHi: number; text: string } | null;
};

export type Tier = "accept" | "refer" | "decline" | "open" | "routed";

/** POST /cases/{id}/surface: the engine re-run over every combination of two or three facts. */
export type Surface = {
  caseId: string;
  rulesId: string;
  axes: SurfaceAxis[];
  resolution: number;
  shape: number[];
  /** Flat, row-major over `axes`: the point at (i, j, k) is at i * shape[1] * shape[2] + j * shape[2] + k. */
  grid: { lo: number[]; hi: number[]; tier: Tier[] };
  thresholds: { decline: number; accept: number };
  case: { lo: number; hi: number; tier: Tier; t: (number | null)[]; at: (number | null)[] };
  points: number;
  ms: number;
  cached: boolean;
};

export type Precedent = {
  backend: string;
  basisExplained: string;
  hits: {
    policyNumber?: string;
    insured: string;
    state: string;
    tiv: number;
    // A declined submission never became a policy: no premium, no incurred loss, no ratio.
    premium: number | null;
    status?: string;
    incurred: number | null;
    lossRatio: number | null;
    outcome: string;
    decision: string;
    summary: string;
    similarity: number;
    basis?: string[];
  }[];
};

export type Challenge = {
  argument: string;
  verified?: boolean;
  risks: { risk: string; size: string; likelihood?: string; remedy: string; grounded?: boolean }[];
  changeMyMind: string[];
  responses?: { risk: string; response: string; accepted?: boolean }[];
  verdictChanged?: boolean;
};

/** Server-side reads go straight to the API; the browser uses the same-origin proxy. */
const base = typeof window === "undefined" ? API : PROXY;

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const explainCase = (id: string) => get<Explain>(`/cases/${id}/explain`);
export const sensitivityOf = (id: string) => get<Sensitivity>(`/cases/${id}/sensitivity`);
export const precedentFor = (id: string) => get<Precedent>(`/cases/${id}/precedent`);

async function post<T>(path: string, body: unknown, at = base): Promise<T | null> {
  try {
    const res = await fetch(at + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const whatIf = (id: string, overrides: Record<string, number | string>) =>
  post<WhatIf>(`/cases/${id}/whatif`, { overrides }, PROXY);

/** The grid behind the 3D view. Read once on the server; the API caches it per desk run. */
export const surfaceOf = (id: string, resolution = 11) => post<Surface>(`/cases/${id}/surface`, { resolution });

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const signed = (n: number, d = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(d)}`;
