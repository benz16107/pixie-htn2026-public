# Federato demo, four minutes

Open http://macserver:3100/queue. Keep tabs ready for cases 138 and 126, the portfolio, the scoring method, and validation.

## 0:00. Say what problem you chose

"This dataset gives us the facts for appetite, but no usable broker-behaviour signal for winnability. I focused on what an underwriter should do when the facts behind an appetite decision are incomplete."

Show the Scored view. All 158 commercial submissions have already been assessed. The current property guideline scores 38 and routes the other 120 to their respective lines. Scored includes historical submissions; Needs review is restricted to unresolved active submissions.

Select Ranges. With the current filed guideline and recorded investigations, case 138 is the only nonzero interval. Known hard failures collapse most other scores. Do not describe routed cases as waiting for the model to score them.

## 0:30. Lead with the range

Open case 138. Click Demo layout to restore the four core panels. Click Focus on Appetite & what-if while explaining the range. Use Back to all panels when pointing to Facts & sources.

"The engine gives this case a range because the available evidence does not settle its appetite. Every input has a source, and estimates stay labelled as estimates."

Point to the range and the premium's provenance. In the checked demo state the range is 30–75 and premium is an estimate, not a confirmed broker fact. Always read the live state if the demo has been reset or someone has replied.

Move the premium what-if slider into its favourable band. Show the displayed decision boundary and result.

"This asks which fact would change the answer. The slider runs the same deterministic engine again. It does not ask a language model to invent a better score."

Reset the scenario. The what-if does not change the case's recorded facts.

## 1:20. Show how the number is calculated

Click Scoring method in the case toolbar, or open /method.

"Facts match written guideline bands. We total the worst and best possible points, normalise them, apply the hard-failure rules, then add any computed hazard and concentration adjustments. You can inspect the full calculation."

The page reads band values, denominator and thresholds from the active guideline. Under the filed rules, the denominator is 12 and the decline/accept thresholds are 45 and 70.

If challenged on statistics, say: "This is a rule-based uncertainty range. It is not a calibrated confidence interval or a probability of loss."

## 1:45. Show a real disagreement

Open case 126 and click Focus on Challenger. Expand one risk to show its remedy.

"The Challenger questions the draft decision using the case evidence and computed sensitivity results. Here the engine still says decline, while the recorded desk recommendation is referral with conditions. You can read the objection, the risks and the evidence it asks for."

Do not say the Challenger changed the engine's score or proved the decline wrong. Case 126 and case 143 have recorded model-written challenges. Case 138 currently has a deterministic sensitivity fallback. The feature works with both, but they are different evidence.

On a scored case, expand Underwriter adjustment at the bottom of the appetite panel. Add a small adjustment and a reason only if you want to demonstrate the saved audit event; undo it afterwards.

"The underwriter can adjust by up to five points with a reason. The engine's original score remains beside it."

## 2:30. Put the case in the portfolio

Open Portfolio and select Heat waves in Map layer. Click a county, or choose case 126 to show Harris County and its building-loss comparison. Select Humidity and show the monthly climate chart. Then return to Portfolio exposure and expand Largest concentrations to zoom a cell.

"The county polygons are FEMA hazard context. The coloured submission points are NASA climate estimates. Both show their units, dates and coverage. These new layers help identify evidence to investigate; they do not silently change the rulebook's appetite score."

County building-loss layers show expected annual building-loss dollars per $1M of county building value. They are not loss forecasts for the submission. Heat shows annualized event-days, and population is geographic context only. Climate is a 2001–2020 mean on a coarse grid, not today's weather. Five submission coordinates have no FEMA county match, including case 138; the interface states that gap.

In Sources, coverage & calculation, show where the data came from. The snapshot has 3,109 county polygons and climate records for all 21 plotted sites. Crime has no connected, comparable data source. Keep the distinction between portfolio exposure cells, county hazard polygons and site climate points clear.

## 3:00. Show the rules and admit the miss

Open Rulebook. Select a scenario, show the pending edit, then Discard. If you choose Apply, it re-scores the real demo book; restore the filed rules after the demonstration.

Open Validation.

"The backtest also prints where this approach failed. This accepted historical policy had $629,200 in incurred losses. That miss stays visible."

The example is PR-2026-1081. Call it incurred losses, not net loss or profit. Do not present the small hackathon backtest as production validation.

## 3:35. Close

"Pixie shows why a submission needs attention, which fact would change the decision, and how that decision was calculated. The model investigates and argues; code calculates the risk numbers, and the underwriter makes the call."

For a combined Federato/Intact pitch, briefly show the working renter quote on the phone. Say "The two products share deterministic computation and provenance conventions." Commercial appetite and tenant pricing are different calculations; do not claim they use an identical formula.

## Arrange the case before presenting

Drag a panel by its dotted handle, or use its menu to move it earlier or later. The menu also offers Full width and Hide panel. Panels lets you bring back site evidence, comparable risks, activity, and action history. The browser remembers the arrangement across cases and reloads. Focus shows one panel; Escape returns to the dashboard. Demo layout restores the four core panels.

## Keep these for questions

- Recorded agent workflow: /live. Use its replay for a predictable demonstration and call it a replay. A fresh live run can take longer and use model credits.
- Broker email or SMS: show the draft or recorded action only if present. This walkthrough does not send messages. Do not promise a text reply will write a decision unless the live integration is connected and tested.
- Research: avoid the unsourced 500-case hallucination percentage, claims that no competitor has an interval, regulatory-compliance claims, and acquisition dates in the timed pitch. The implemented mechanics stand on their own; cite a verified paper when discussing research.
- The interface displays all 38 existing property scores. No synthetic records, wider invented ranges, or new underwriting rules were added for presentation.
