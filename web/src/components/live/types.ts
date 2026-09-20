export type Quote = {
  caseId: string;
  address: string;
  decision: { kind: "approve" | "refer"; reasons: string[]; nextStep: string };
  annual: number;
  monthly: number;
  label: string;
  receipt: { base: number; lines: { label: string; multiplier: number; dollars: number; capped: boolean; source: string }[] };
  hexes: { cell: string; ring: [number, number][]; value: number; level: 0 | 1 | 2 | 3 | 4 }[];
  center: [number, number];
  listSummary?: string;
};
