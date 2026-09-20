# Federato judging script, five minutes

Presentation order: Submissions → Rulebook → Case 138 → Portfolio → Validation.
Updated on 2026-09-20 with the simplified Pixie presentation. The spoken script keeps the same order and wording. Spoken text is in blockquotes. Finish by 4:50 and leave ten seconds free.

## Slides and live-demo shortcuts

Open http://macserver:3100/present, or press **P** in the desk. There is one nine-slide deck of short summaries from the supplied pitch notes, styled like the Pixie Federato app.

- **P** toggles between slides and the current demo page. Opening slides from the app preserves the mounted page, panel layout, scroll position and unsaved inputs.
- **Right arrow / Space** advances; **Left arrow** goes back. Click the slide's right side to advance or its left side to go back.
- **Home / End** jumps to the opening or closing slide. **Esc** returns to the demo.
- Switch app pages normally, in this order: Submissions, Rulebook, Case 138, Portfolio, Validation.
- The slides contain no equations, score graphics, separate Q&A section, timer or rehearsal notes. Study figures and the historical miss appear only in the supplied pitch's summaries.

The slides explain the ideas while the app shows the evidence. The spoken script below keeps its existing structure. At the close, press **P**, then **End**.

## Prepare before the timer

Open these tabs at http://macserver:3100:

1. `/queue?view=scored`. Click **appetite range** once so the arrow points down.
2. `/guideline`. Use the active rulebook and its clickable **Scoring equation**. Do not apply edits during this presentation.
3. `/cases/138`. Restore **Demo layout**. Keep Facts & sources visible. Verify the original score is 30–75 and no what-if scenario is active.
4. A second `/cases/138` tab with **Agent activity** enabled and focused. Scroll to the intake query and open **run_federato_query** before presenting. This is the same case, prepared to avoid searching mid-demo.
5. `/map?layer=heat&site=126`. Preload the map. Know how to select **Portfolio exposure**, then return to **Heat waves**.
6. `/backtest`. Start at the $629,200 known miss and know where **What the existing enrichment changed** sits below it.

Use Focus to show one case panel at a time. Leave Decision space out of the timed presentation. Keep case 126's model-written Challenger available for questions; case 138 currently has a deterministic sensitivity fallback, so do not describe its objection as a second model's output.

## 0:00–0:35. Submissions: the problem and the queue

**Do:** show the scored queue, sorted by appetite range descending. Point to the scores and recommendations.

> Federato asked us to build an agent that scores submissions, chooses which data to request, ranks opportunities and explains its decisions.
>
> Pixie has assessed all 158 commercial submissions. This property guideline scores 38 and routes the other business lines separately.
>
> These are ordered by appetite score. Before opening one, let me show you what that score means.

## 0:35–1:25. Rulebook: explain the rules and equation

**Do:** open Rulebook. Point to two criteria, such as premium and building year. Show **Scoring equation**. Click **points**, then the denominator **12** or **cap**. Do not edit a rule.

> Appetite means the kinds of risks this carrier wants to insure. Federato supplied this commercial property guideline, including preferred premium bands, building age, location and loss history.
>
> I translated those criteria into explicit point rules: two for target, one for acceptable, zero for not acceptable. The equation normalises those points and applies hard-failure caps and evidence adjustments.
>
> Each term opens its explanation. When facts are missing or uncertain, the engine can return a range. The language model investigates and explains; code calculates the numbers.

The supplied criteria and Pixie's chosen weights are different things. The page labels the weights, caps and adjustments as implementation choices. The rulebook equation uses active rules even when an unapplied draft exists.

## 1:25–2:20. Case 138: the range and the fact that changes it

**Do:** open case 138, Lumen Data Works. Point to estimated premium in **Facts & sources**. Focus **Appetite & what-if**. Enter `75000` in the premium scenario amount. Pause for **91, accept**, then reset.

> Now here is Lumen Data Works. Its appetite range is 30 to 75. Premium is estimated rather than confirmed, and every field shows its source. Giving this one precise score would hide that distinction.
>
> Suppose the broker confirms a premium of 75,000 dollars. The same engine recomputes the result as 91, accept.
>
> This is a hypothetical input, not a change to the case record. It identifies the fact to verify before acting. I can reset it and preserve the original evidence.

$75,000 is a reproducible target-band scenario, not the exact acceptance boundary. It replaces an estimate with a new scenario value outside that estimate; the result can therefore exceed the previous upper endpoint.

## 2:20–3:10. Same case: prove where the evidence came from

**Do:** switch to the prepared activity tab for case 138. Point to the query purpose, expansion and returned insured value. Do not read the JSON aloud.

> Here is the recorded investigation behind that case. The agent has the discovered schema and tools to request more evidence.
>
> This submission has no direct policy or building link, so the investigation follows the insured's headquarters to its buildings.
>
> This query records why it was requested and returns 2.073 million dollars of insured value. A separate calculation estimates premium from 27 bound property comparables.
>
> We can inspect what was requested, what came back and which values remain estimates.

The query's recorded purpose is “Verify the hydrated insured value for case 138.” It filters Insured ID 7, expands headquarters and buildings, and selects their IDs and TIV. Initial schema-aware hydration also uses deterministic logic; do not claim every query is invented by an LLM.

## 3:10–3:30. Same case: connect the equation to the action

**Do:** return to the first case 138 tab and select **Calculation**. Point to `100 × 9 / 12`, then click the hazard adjustment if time allows.

> And here is that case's exact equation. Nine out of twelve points gives a base score of 75. Caps and evidence adjustments produce the final range.
>
> The underwriter can inspect the calculation and decide what evidence to request next.

## 3:30–4:05. Portfolio: see how risks sit together

**Do:** show **Portfolio exposure**, then select **Heat waves**. Point to the exposure concentration, selected site and layer legend.

> The portfolio is the geographic view of the book. It shows where we already hold insured value and where another submission sits alongside that exposure.
>
> We can also inspect hazard context, like these county heat layers, with their source and units.
>
> The newer climate layers support investigation. The existing hazard and nearby-exposure adjustments feed the engine, and we measure their effect on ranking.

The map shows geographic exposure and hazard context, not a geographic ranking of appetite scores. Do not imply the new heat, population or humidity layers already alter the appetite score.

## 4:05–4:35. Validation: outcomes and limitations

**Do:** open Validation. Point to the $629,200 known miss, then scroll to the recorded enrichment comparison.

> Finally, validation shows what happened afterwards. This historical policy would have been accepted, but later incurred 629,200 dollars in losses. Appetite fit does not guarantee a profitable risk.
>
> In the recorded enrichment comparison, five of six open submissions changed rank, while no decision tier changed.
>
> That shows what the extra data actually changed. This small synthetic dataset demonstrates the workflow; it does not establish production accuracy.

The historical outcome cohort contains 27 bound property policies. The enrichment comparison covers 38 scored submissions, with a six-submission open queue. The report is a recorded snapshot, not an automatic rerun of current rule edits.

## 4:35–4:50. Close

**Do:** return from Validation with **P**, then press **End** for the closing slide. Stop clicking and look at the judges.

> Pixie shows why a submission needs attention, what fact could change the answer, and how the number was calculated. The underwriter makes the decision.

## 4:50–5:00. Buffer

Leave these seconds for slow clicks or pauses. If behind, skip the map-layer change and shorten the second equation explanation. Preserve the Rulebook introduction, case 138 what-if, API query trace and closing line.

## Optional Challenger demonstration for questions

Open `/cases/126` and focus **Challenger**. Expand one risk and remedy.

> A second agent challenges the draft using the case evidence and computed sensitivity analysis. Here the engine says decline, while the recorded desk recommendation asks for referral with conditions. The hard rule failures remain visible; the underwriter can inspect the objection and the evidence requested.

This is a recorded model-written challenge. Do not claim it proves the engine wrong or changes the engine's score. It is outside the five-minute script to keep the main presentation on one submission.

## Answers to likely questions

- **Is the range a confidence interval?** No. It is a rule-based appetite range reflecting the available evidence. It is not a calibrated probability of loss.
- **Why does confirming $75,000 produce 91 when the earlier upper end was 75?** It replaces an estimated premium with a new confirmed scenario value outside that estimate. The engine recomputes against the new evidence; the old range was not a prediction interval covering every possible premium.
- **Why score only 38?** Those are the commercial property submissions covered by the supplied guideline. The other 120 commercial submissions are assessed for scope and routed. They are not an unprocessed backlog.
- **Why are most scores points?** Known hard failures can settle the appetite result despite other missing facts. Pixie does not manufacture a wide range for every case.
- **Where does the score come from?** Our explicit point mapping and decision thresholds implement the sponsor's written criteria. The method page exposes the mapping, normalisation, caps and adjustments.
- **Does the Challenger prove a better decision?** No. It makes objections and requested evidence inspectable. Human review and hard-rule handling still matter.
- **Can an underwriter disagree?** The case has an optional adjustment of up to five points, with a required reason, an audit record and undo. The original engine result stays visible. Larger disagreements belong in the decision itself.
- **What about winnability?** This build focuses on appetite. The supplied snapshot does not provide a usable broker-behaviour signal for a defensible winnability model.
- **What is distinctive?** The implemented combination is an evidence-labelled range, a scenario tied to the decision boundary, and a critic supplied with deterministic sensitivity results. Do not claim no commercial competitor has it without verified comparative research.
- **What would production need?** Representative evaluation, calibration of the scoring policy, stronger data-quality checks, and tested authority and integration controls.

## Keep out of the timed pitch

The tenant phone, all eleven map layers, panel dragging, authentication setup, a rulebook edit, and a full live model run distract from the sponsor's core criteria. Keep them available for questions. The critic paper is now verified and cited on the Challenger slide. Its 500-case evaluation reports 11.3% to 3.8% hallucination; those are the authors' results, not Pixie's. Keep acquisition claims and regulatory-compliance claims out. Customer examples in the slides link to Federato's own case studies. Do not promise an SMS response writes a decision unless that integration has been tested for this demo.

## Source and verification notes

- Supplied `STUDENT_PROJECT_GUIDELINES.pdf`: four challenge requirements, Strong/Exceptional criteria, optional enrichment requirement and common pitfalls.
- Supplied `APPETITE_GUIDELINES.pdf`: 2025 commercial property criteria.
- Supplied glossary, API documentation, schema and query guide: terminology, relationships and query mechanics.
- Read-only current API checks: queue contains 158 US commercial records and four Toronto consumer records; 38 scores. Case 138 is 30–75; its $75,000 what-if returns 91/accept. Case 126 retains decline and a recorded conditional referral recommendation.
- Browser checks: case 138's premium what-if displays 91/accept; its activity panel exposes the successful query, purpose and returned building value; the queue's appetite-range header sorts descending. Reset preserves the case record.
- Recorded backtest: $629,200 known miss; five of six open submissions reranked; zero decision tiers changed.
