"use client";
import { useEffect, useRef, useState } from "react";
import type { Interval } from "@/contract";
import { usd, whatIf, type Sensitivity, type WhatIf as WhatIfResult } from "@/lib/explain";
import { useKeys } from "../desk/keys";
import type { Pin } from "./DecisionSpace";

const TONE: Record<string, string> = { accept: "text-moss", approve: "text-moss", decline: "text-rust", refer: "text-ochre", open: "text-ochre" };

export function WhatIf({ caseId, fact, label, start, sensitivity, before, onState }: {
  caseId: string; fact: string; label: string; start: number;
  sensitivity: Sensitivity | null;
  before: { score: Interval | null; decision: string };
  onState?: (state: Pin) => void;
}) {
  const [value, setValue] = useState(start);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const axis = sensitivity?.facts.find((item) => item.fact === fact);
  const max = Math.max(fact === "premium" ? 200_000 : (axis?.high.value ?? start) * 1.2, start, 1000);
  const slider = useRef<HTMLInputElement>(null);
  const emit = useRef(onState);
  useEffect(() => { emit.current = onState; }, [onState]);
  useKeys((event) => event.key === "f" ? (event.preventDefault(), slider.current?.focus(), true) : false, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (value === start) { setResult(null); setPending(false); return; }
      whatIf(caseId, { [fact]: value }).then((response) => {
        if (!active) return;
        setPending(false);
        setResult(response);
        setError(response ? "" : "Could not recompute this scenario. Try another value.");
      });
    }, 100);
    return () => { active = false; clearTimeout(timer); };
  }, [value, caseId, fact, start]);

  const score = result?.after.score ?? before.score;
  const kind = result?.after.decision.kind ?? before.decision;
  useEffect(() => {
    emit.current?.(pending || error || value === start ? null : { fact, value, score, kind });
  }, [fact, value, score?.lo, score?.hi, kind, pending, error, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (next: number) => {
    if (!Number.isFinite(next)) return;
    const bounded = Math.max(0, Math.min(max, next));
    if (bounded === value) return;
    setValue(bounded); setPending(bounded !== start); setError("");
    if (bounded === start) setResult(null);
  };

  return <section aria-labelledby="whatif-h" className="border-t border-rule pt-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 id="whatif-h" className="kicker">What if · {label}</h3>
        <label className="mt-2 flex items-center gap-2 text-[20px] text-ochre">
          <span>$</span><input type="number" min={0} max={max} step={1000} value={value} aria-label={`${label} scenario amount`} onChange={(event) => change(event.target.valueAsNumber)} className="num w-[12ch] border-b border-edge bg-transparent py-1 text-ochre" />
        </label>
      </div>
      <div className="text-right" aria-live="polite">
        <p className="kicker">{value === start ? "Current case" : "Scenario result"}</p>
        <p className="num mt-2 text-[28px] leading-tight">{pending ? "Calculating…" : error ? "Unavailable" : score ? score.lo === score.hi ? score.lo : `${score.lo}–${score.hi}` : "Not scored"}</p>
        {!pending && !error && <span className={`text-[11px] uppercase tracking-wider ${TONE[kind] ?? "text-dim"}`}>{kind}</span>}
      </div>
    </div>
    <div className="relative mt-5 pt-5">
      {axis?.flip && <span className="absolute top-0 text-[11px] text-dim">Boundary {axis.flip.display} · {axis.flip.from} to {axis.flip.to}</span>}
      <input ref={slider} type="range" min={0} max={max} step={1} value={value} onChange={(event) => change(event.target.valueAsNumber)} aria-label={`${label} what-if`} className="h-7 w-full cursor-pointer accent-ochre" />
      <div className="num flex justify-between text-[10px] text-faint"><span>$0</span><span>{usd(max)}</span></div>
    </div>
    {error && <p role="alert" className="mt-2 text-[12px] text-rust">{error}</p>}
    {value !== start && <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-[11px] text-dim">Scenario only</span><button onClick={() => change(start)} className="ml-auto min-h-8 border border-edge px-3 text-[11px] text-dim hover:text-ink">Reset scenario</button></div>}
  </section>;
}
