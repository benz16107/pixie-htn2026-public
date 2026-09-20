# Backtest definitions (pre-registered before the first run, Sat 17:35)

Purpose: measure the desk against what really happened, honestly, with n shown next to every number.
Rules that apply to every metric:
- **As of the submission date.** Each case is built as of its Submission.received_date. Loss history uses only claims with date_of_loss before that date, on the insured's OTHER policies. A policy's own claims are never an input (no leakage). A test asserts this.
- **Deterministic path only.** The backtest runs the code scoring (appetite + risk + portfolio), not the LLM agents, so it is reproducible byte for byte.
- **Report small n plainly.** No correlation statistics; counts and rates with n.

## B1. Outcomes, property (n = 27 bound property policies)
Group the bound property policies by the desk's decision at submission (accept / open / decline).
Per group: count, total premium, total incurred (paid + reserve, indemnity + expense, on that policy's own claims), loss ratio = incurred / premium.
Question: do the policies the desk would have declined have a worse loss ratio than the ones it would have accepted?

## B2. Human declines (n = 11 with an underwriting reason; 3 broker_withdrew shown as excluded)
For each human decline, the desk's decision and its top reason vs the human decline_reason, mapped by REASON_TO_LANE:
- loss_history -> the loss factor (Appetite)
- cat_exposure_aggregation -> portfolio concentration (Portfolio)
- outside_appetite -> line or state (Appetite)
- insufficient_controls -> controls gaps in ExposureUnit data (Intake), where the data allows
Report: how many the desk also declines, and how many for the matching reason.

## B3. Enrichment effect (all scored property cases)
Score each case with external hazard layers on vs off. Report the cases whose decision tier changes, naming the factor that changed it.

**Added after the first run (2026-09-20), with the reason.** The pre-registered metric came back 0: no property case changed decision tier, because the property declines are structural hard fails (state outside the 2025 list, building age, loss history) that no external layer can move. Rather than quietly swap the metric, the tier-change count stays and is reported as 0 with that reason, and four sub-metrics are added so "enrichment matters" is measurable instead of asserted:
- `intervalMoved` and `medianAbsMidpointMove`: how many cases had their score interval move at all, and the median size of the move in points.
- `rankChanged`, `rankQueueN` and `rankMoves`: how many open-queue cases change rank position with layers on, and by how many places. Ranking uses the same order `/queue` uses (interval midpoint, then value at stake).
- `topMovers` and `topMoversOpenQueue`: the three cases the layers move most, overall and inside the open queue, each naming the peril and the applied multiplier.
- Every row carries `hardFailCapped`, so a move inside an already-capped decline is not passed off as a decision change.

## B4. Guideline vs book (n = 27 bound property policies)
How many bound property policies the 2025 guideline would decline, by factor. Expected headline (from the raw data): premium above $175K on 17 of 27. This explains why agreement with past human binds is low: the humans wrote outside the 2025 guideline.

## Known honest misses to show
- Policy 1081 (bound, CA, new): fully in appetite at submission, later produced $629,200 in claims. The desk would have accepted it. Show it.
