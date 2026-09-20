import type { GuidelineDoc } from "@/lib/api";
import { EquationExplorer } from "./EquationExplorer";
import styles from "./Calculation.module.css";

export function MethodEquation({ rules }: { rules: GuidelineDoc }) {
  const maxima = rules.factors.map(f => ({ label: f.label, max: Math.max(...f.bands.map(b => rules.points[b.band])) }));
  const ceiling = maxima.reduce((sum, f) => sum + f.max, 0);
  return <div className={styles.calculation}><EquationExplorer terms={{
    points: { value: "points", title: "Guideline points", detail: <>
      <p>{Object.entries(rules.points).map(([band, points]) => `${band.replaceAll("_", " ")} = ${points}`).join(" · ")}</p>
      <p>Match each fact to the first applicable band, then total its points. Estimates evaluate low, point and high values. Missing facts retain every possible band, producing a low and high total.</p>
      <p className={styles.note}>Federato supplied the appetite criteria. Pixie chose the point mapping and decision thresholds.</p>
    </> },
    ceiling: { value: String(ceiling), title: "Maximum possible points", detail: <>
      <p className={styles.equation}>{maxima.map(f => f.max).join(" + ")} = {ceiling}</p>
      <p>Divide by the sum of each factor&apos;s maximum, then multiply by 100. A factor with no target band has a smaller maximum.</p>
      <div className={styles.tableScroll}><table><thead><tr><th>Factor</th><th>Maximum points</th></tr></thead><tbody>{maxima.map(f => <tr key={f.label}><td>{f.label}</td><td>{f.max}</td></tr>)}</tbody></table></div>
    </> },
    caps: { value: "cap", title: "Hard-failure caps", detail: <>
      {rules.hardFailCap == null ? <p>No hard-failure cap is configured.</p> : <p>A known hard failure caps both ends at {rules.hardFailCap}. A possible failure in an estimated or missing fact caps only the low end. Hazard and portfolio adjustments apply afterwards.</p>}
      <p className={styles.note}>The cap is a Pixie policy choice.</p>
    </> },
    hazards: { value: "+ hazard", title: "Hazard adjustment", detail: <>
      <p>Combine the recorded hazard multipliers into M, limited to 0.85–1.25.</p>
      <p className={styles.equation}>Hazard points = clamp(−R × ln(M) / ln(1.25), −R, R)</p>
      <p>R is the configured maximum point adjustment. A multiplier of 1 adds zero points; a multiplier above 1 reduces appetite. A case&apos;s calculation shows the observations, chosen multipliers and applied R.</p>
      <p className={styles.note}>Public sources supply observations. Pixie supplies the multiplier mappings. County and climate context layers do not change the score.</p>
    </> },
    portfolio: { value: "+ portfolio", title: "Portfolio adjustment", detail: <>
      <p className={styles.equation}>Portfolio points = round(−min(penalty cap, nearby TIV / $25,000,000), 1 decimal)</p>
      <p>Nearby TIV totals active property exposure within 30 km. The adjustment subtracts one point per $25M, up to the configured cap.</p>
      <p className={styles.note}>The radius, rate and cap are Pixie policy choices.</p>
    </> },
    limits: { value: "clamp", title: "Score limits", detail: <p>After caps and adjustments, limit each end to 0–100. A negative result becomes zero; a result over 100 becomes 100.</p> },
    result: { value: "score", title: "Final score & decision", detail: <>
      <p>Round for display. Use the unrounded range to decide:</p>
      <p>Decline when the high end is below {rules.thresholds.decline}. Accept when the low end is at least {rules.thresholds.accept}. Otherwise keep the case open for review.</p>
      <p>Other business lines route to their own desk. A human adjustment stays separate from the engine score.</p>
      <p className={styles.note}>This is a rule-based appetite range, not a calibrated probability of loss.</p>
    </> },
  }} /></div>;
}
