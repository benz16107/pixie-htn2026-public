import { type Explain, type Step } from "@/lib/explain";
import { EquationExplorer } from "./EquationExplorer";
import styles from "./Calculation.module.css";

const number = (n: number) => (Object.is(n, -0) ? 0 : n).toLocaleString("en-US", { maximumFractionDigits: 4 });
const range = (s: { lo: number; hi: number }) => s.lo === s.hi ? number(s.lo) : `[${number(s.lo)}, ${number(s.hi)}]`;
const delta = (n: number) => `${n < 0 ? "−" : "+"} ${number(Math.abs(n))}`;
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function Source({ value }: { value: string }) {
  return /^https?:\/\//.test(value)
    ? <a href={value} target="_blank" rel="noreferrer">Open source data ↗</a>
    : <span>{value || "Source not recorded"}</span>;
}

function Evidence({ step }: { step: Step }) {
  return <details className={styles.evidence}><summary>Rule & source</summary>
    <p>{step.rule}</p>
    {step.evidence && <p>{step.evidence}</p>}
    <p><Source value={step.source ?? ""} /></p>
  </details>;
}

export function Calculation({ x }: { x: Explain }) {
  const c = x.calculation;
  if (!c) return <div className={styles.calculation}><p>{x.decision.kind === "routed" ? "This submission is routed to another business line. The property guideline does not calculate a score." : "Calculation details are unavailable. The score breakdown still shows the recorded contributions."}</p></div>;
  const factors = x.steps.filter(s => s.kind === "factor");
  const adjustments = x.steps.filter(s => s.key.startsWith("cap."));
  const hazards = x.steps.filter(s => s.kind === "hazard");
  const premium = c.premiumEstimate;

  return <div className={styles.calculation}>
    <header className={styles.header}><h3>Engine calculation</h3></header>
    <EquationExplorer terms={{
      points: { value: range(c.raw), title: "Guideline points", detail: <>
    <>
      <p>{Object.entries(c.points).map(([band, points]) => `${band.replaceAll("_", " ")} = ${points}`).join(" · ")}</p>
      <p className={styles.note}>Federato supplied the appetite criteria. Pixie chose this point mapping, the caps and the decision thresholds.</p>
      <div className={styles.tableScroll}><table><thead><tr><th>Factor & evidence</th><th>Rule points / maximum</th><th>Score contribution</th></tr></thead><tbody>
        {factors.map(s => <tr key={s.key}><td><strong>{s.label}</strong><p>{s.value}</p><span className={styles.provenance}>{s.provenance} · {s.band?.replaceAll("_", " ")}</span><Evidence step={s} /></td>
          <td>{s.rawPointsLo == null || s.rawPointsHi == null ? "Unavailable" : `${range({ lo: s.rawPointsLo, hi: s.rawPointsHi })} / ${s.maxPoints}`}</td>
          <td>{s.rawPointsLo == null || s.rawPointsHi == null ? range({ lo: s.pointsLo, hi: s.pointsHi }) : `100 × ${range({ lo: s.rawPointsLo, hi: s.rawPointsHi })} / ${c.denominator} = ${range({ lo: s.pointsLo, hi: s.pointsHi })}`}</td></tr>)}
      </tbody><tfoot><tr><th>Total</th><td>{range(c.raw)} / {c.denominator}</td><td>{range(c.base)}</td></tr></tfoot></table></div>

    </>

    {premium && <details className={styles.evidence}><summary>Premium estimate & comparables</summary><p>For each comparable policy: rate = technical premium / TIV. The estimate uses the 25th and 75th percentiles of those rates, multiplied by this case&apos;s TIV.</p><div className={styles.equation}><p>Lower ≈ {money(premium.tiv)} × {number(premium.rateLo * 100)}% = {money(premium.lo)}</p><p>Upper ≈ {money(premium.tiv)} × {number(premium.rateHi * 100)}% = {money(premium.hi)}</p></div><p className={styles.note}>Rates shown are recovered from the rounded estimate. {premium.method}.</p><details className={styles.evidence}><summary>Comparable policy references · {premium.policies.length}</summary><p>{premium.policies.join(", ")}</p></details></details>}
      </> },
      ceiling: { value: number(c.denominator), title: "Maximum possible points", detail: <>
        <p className={styles.equation}>{factors.map(s => s.maxPoints).join(" + ")} = {c.denominator}</p>
        <p>Each factor contributes its own maximum. A rule with no target band has a smaller maximum.</p>
        <div className={styles.tableScroll}><table><thead><tr><th>Factor</th><th>Maximum points</th></tr></thead><tbody>{factors.map(s => <tr key={s.key}><td>{s.label}</td><td>{s.maxPoints}</td></tr>)}</tbody></table></div>
      </> },
      caps: { value: "cap", title: "Hard-failure caps", detail: <>
        <p className={styles.equation}>100 × {range(c.raw)} / {c.denominator} = {range(c.base)} → {range(c.afterCaps)}</p>
    <>
      <p className={styles.note}>A known hard failure caps both ends at {c.hardFailCap ?? "the configured limit"}. An estimated or missing failure caps only the low end. Hazard and portfolio points apply afterwards.</p>
      {adjustments.length ? <div className={styles.tableScroll}><table><thead><tr><th>Step</th><th>Point change</th><th>Running score</th></tr></thead><tbody>{adjustments.map(s => <tr key={s.key}><td><strong>{s.label}</strong><p>{s.value}</p><Evidence step={s} /></td><td>{range({ lo: s.pointsLo, hi: s.pointsHi })}</td><td>{range({ lo: s.runningLo, hi: s.runningHi })}</td></tr>)}</tbody></table></div> : <p>No hard-failure cap applied.</p>}
    </>

      </> },
      hazards: { value: delta(c.hazard.points), title: "Hazard adjustment", detail:
    <>
      <p>Public sources provide the observations. Pixie&apos;s hand-set mappings convert them to multipliers. These coefficients are prototype choices, not vendor ratings or rates fitted to claims.</p>
      {hazards.map(s => <details className={styles.hazard} key={s.key}><summary>{s.label.replace("Hazard: ", "").replaceAll("_", " ")} <b>×{s.multiplier}</b></summary><p>{s.evidence || s.value}</p><p>{s.multiplierRule}</p><p><Source value={s.source ?? ""} /></p></details>)}
      {!hazards.length && <p className={styles.note}>No individual hazard observations are recorded for this assessment.</p>}
      {c.hazard.applied && c.hazard.total != null ? <div className={styles.equation}>
        <p>M = clamp({hazards.length ? hazards.map(s => number(s.multiplier!)).join(" × ") : "recorded total"}, {c.hazard.bounds.join(", ")}) = {number(c.hazard.total)}</p>
        <p>Hazard points = clamp(−{c.hazard.maxPoints} × ln({number(c.hazard.total)}) / ln(1.25), −{c.hazard.maxPoints}, {c.hazard.maxPoints}) = {number(c.hazard.points)}</p>
      </div> : <p className={styles.note}>No hazard adjustment applied.</p>}
      <p className={styles.note}>ln is the natural logarithm. A combined multiplier of 1 gives zero points; 1.25 gives −{c.hazard.maxPoints}. Multipliers above 1 reduce appetite. New county and climate map layers do not enter this equation.</p>
    </>

      },
      portfolio: { value: delta(c.portfolio.points), title: "Portfolio adjustment", detail:
    <>
      {c.portfolio.applied && c.portfolio.nearTiv != null ? <><p>Active property TIV within {c.portfolio.radiusKm} km: {money(c.portfolio.nearTiv)}.</p><p className={styles.equation}>Portfolio points = round(−min({c.portfolio.maxPenalty}, {money(c.portfolio.nearTiv)} / {money(c.portfolio.tivPerPoint)}), 1 decimal) = {number(c.portfolio.points)}</p><p className={styles.note}>The radius, one-point-per-{money(c.portfolio.tivPerPoint)} rate and penalty cap are Pixie policy choices.</p></> : <p>No portfolio adjustment applied.</p>}
    </>

      },
      limits: { value: "clamp", title: "Score limits", detail: <p>After caps and adjustments, clamp keeps each end between 0 and 100. Values below zero become zero; values above 100 become 100.</p> },
      result: { value: x.score ? range(x.score) : "not scored", title: "Final score & decision", detail:
    <><p className={styles.equation}>{range(c.exact)} → {x.score ? range(x.score) : "not scored"}</p><p>The display rounds to whole points. The decision uses full precision, before any human adjustment.</p><p>Decline if the unrounded upper end is below {x.thresholds.decline}. Accept if the unrounded lower end is at least {x.thresholds.accept}. Otherwise keep the case open for review.</p><p>Current result: <strong>{x.decision.kind}</strong>.</p><a href="/method">General scoring method</a><span> · </span><a href={`/api/atlas/cases/${x.caseId}/explain`} target="_blank" rel="noreferrer">Calculation JSON</a></>
      },
    }} />
  </div>;
}
