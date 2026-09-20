# Elastic: five-minute demo

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md) · [Implementation notes](../../docs/ELASTIC.md)

## The pitch

"Before we write another risk, Elastic retrieves similar decisions and calculates how much active exposure is already concentrated nearby."

Elastic is the strongest secondary integration because it supports both main products and several different query types.

## What we use from Elastic

- Five indices covering precedent, active portfolio exposure, decline analysis, and Toronto location data.
- Lexical BM25 and semantic retrieval combined with reciprocal rank fusion for similar cases.
- A configured semantic reranker for the supported precedent path.
- `significant_terms` to compare declined or loss-making cohorts with the whole book.
- Percentile queries that place a submission's value and premium in context.
- Geospatial filtering and aggregation for nearby active insured value and Toronto risk cells.

## Why it fits Pixie

The agent can ask a question, but it should not invent the comparable cases or add nearby exposure itself. Elastic retrieves the evidence and performs the aggregation. Pixie's engine consumes the labelled result, and the UI shows which backend answered.

## Five-minute flow

| Time | Show and say |
|---|---|
| 0:00-0:35 | Open case 138. Ask two questions: what happened on comparable risks, and how concentrated are we near this site? |
| 0:35-1:45 | Show the precedent hits and outcomes in the case sidebar. Point to the `elastic` badge and explain lexical plus semantic retrieval. |
| 1:45-3:00 | Open `/map`. Rotate the 3D exposure view and filter one peril. Explain that H3 groups the book and tower height is the Elastic-backed active TIV total. |
| 3:00-4:00 | Show the case percentile or the prepared decline-insight response. Explain why `significant_terms` is different from a raw count. |
| 4:00-5:00 | Open the prepared API response or query definition. Close on retrieval, filters, geospatial sums, and cohort statistics in one service. |

## Know these details

`precedent.py` owns the hybrid retrieval. `portfolio.py` excludes the current insured before summing nearby active exposure. `insights_routes.py` exposes percentiles and decline terms. The local fallback has the same response shape and always labels itself `memory`.

## Say this limitation

"The historical sample is small. Similarity and significant terms do not establish causal risk. If the badge says memory, this request did not use Elastic."

## If it fails

Continue with the labelled local result and show the saved real Elastic query and response. Map tiles can fail independently; the concentration list and geographic fallback still show the computed data.
