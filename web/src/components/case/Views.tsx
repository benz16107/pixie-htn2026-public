"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Interval } from "@/contract";
import type { Sensitivity, Surface } from "@/lib/explain";
import { useKeys } from "../desk/keys";
import { WhatIf } from "./WhatIf";
import type { Pin } from "./DecisionSpace";

// WebGL needs a browser, so the 3D view never renders on the server.
const DecisionSpace = dynamic(() => import("./DecisionSpace"), {
  ssr: false,
  loading: () => <div className="min-h-0 flex-1 animate-pulse border border-rule bg-land motion-reduce:animate-none" />,
});

const TABS = [
  { id: "2d" as const, label: "score breakdown" },
  { id: "calculation" as const, label: "calculation" },
  { id: "3d" as const, label: "decision space" },
];

/**
 * One decision, two ways to read it. The waterfall is how the score was built; the decision space is
 * everywhere the score could have landed. The same what-if slider drives both, so dragging it moves
 * the bar on one and walks the case across the accept boundary on the other.
 */
export function Views({
  caseId,
  surface,
  sensitivity,
  before,
  whatIf,
  waterfall,
  calculation,
}: {
  caseId: string;
  surface: Surface | null;
  sensitivity: Sensitivity | null;
  before: { score: Interval | null; decision: string };
  whatIf: { fact: string; label: string; start: number } | null;
  waterfall: React.ReactNode;
  calculation: React.ReactNode;
}) {
  const [tab, setTab] = useState<"2d" | "3d" | "calculation">("2d");
  const [pin, setPin] = useState<Pin>(null);

  useKeys(
    (e) => {
      if (e.key === "w") return setTab("2d"), true;
      if (e.key === "s" && surface) return setTab("3d"), true;
      return false;
    },
    [surface],
  );


  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-b border-rule">
        <div role="tablist" aria-label="How to read this decision" className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              disabled={t.id === "3d" && !surface}
              className={`-mb-px flex items-center border-b-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors duration-150 disabled:cursor-not-allowed disabled:text-rule ${
                tab === t.id ? "border-ochre text-ochre" : "border-transparent text-dim hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className={tab === "calculation" ? "min-w-0" : "score-chart-scroll"}>
        {tab === "calculation" ? calculation : <div className="score-chart flex flex-col">{tab === "2d" ? waterfall : surface ? <DecisionSpace s={surface} pin={pin} /> : null}</div>}
      </div>

      {whatIf && tab !== "calculation" && (
        <>
          <WhatIf key={`${caseId}-${whatIf.fact}-${whatIf.start}`} caseId={caseId} fact={whatIf.fact} label={whatIf.label} start={whatIf.start} sensitivity={sensitivity} before={before} onState={setPin} />

        </>
      )}
    </>
  );
}
