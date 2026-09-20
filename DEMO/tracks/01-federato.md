# Federato: five-minute demo

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md) · [Underwriting background](../6-FEDERATO-BRIEF.md)

## The pitch

"A missing field should widen the decision, not quietly pass. Pixie shows the range, the source of every value, and the one fact that would settle the case."

Federato is one of the two main product demos. Stay in the commercial underwriter experience. The story is one incomplete submission, how Pixie reads Federato's linked records, and the portfolio exposure around the decision.

## What we built for this track

- A submission queue that puts unresolved cases first and explains what each one needs.
- A case view with known, estimated, and missing facts, each tied to its source field.
- A score interval that tests every plausible rule band when a field is missing.
- A what-if control that previews a confirmed answer without changing the filed submission.
- A portfolio map with active exposure, H3 concentration and geographic context layers. New climate layers support investigation without silently changing scores.
- An editable guideline with a measured whole-book diff and a reset.
- A small backtest that keeps sample size and known misses visible.

## What comes from Federato

Pixie reads the supplied Federato snapshot and schema, follows the actual joins between submissions, insureds, policies, locations, and losses, and keeps those source paths attached to the case. The adapter also supports checked queries for the Ask page. Pixie does not claim to call a hosted Federato production API.

## Why it fits Pixie

The risk engine cannot make an honest decision until the source data is hydrated correctly. Federato supplies the insurance-shaped records. Pixie adds uncertainty handling, rule execution, geographic portfolio context, and the review interface around them.

## Five-minute flow

Use the [full spoken script](../9-FEDERATO-FIVE-MINUTES.md) as the timing reference.

| Time | Show |
| --- | --- |
| 0:00–0:35 | Submissions and the scope of the property guideline |
| 0:35–1:25 | Rulebook, point mapping and clickable equation |
| 1:25–3:30 | Case 138: source-labelled premium, what-if, recorded query and calculation |
| 3:30–4:05 | Portfolio exposure and geographic context |
| 4:05–4:35 | Validation and the historical miss |
| 4:35–4:50 | Closing summary, leaving ten seconds free |

Press P for the [short explanatory slides](../10-PRESENTATION.md), then P again to return to the live page. Keep case 126's model-written Challenger available for questions; case 138 currently uses a deterministic sensitivity fallback.

## Know these details

`federato.py` performs schema-aware loading and preserves provenance. `engine.py` computes score intervals. `portfolio.py` groups active exposure into H3 cells. `guideline.py` validates edits before rescoring the book. The map visualizes computed portfolio totals; the model does not create them.

## Say this limitation

"This uses Federato's supplied synthetic snapshot and our transcription of the supplied appetite rule. The backtest shows historical outcomes and a known miss on a small synthetic sample. It does not prove loss prevention or model winnability."

## If it fails

Use case 138 and the saved backtest. If WebGL fails, the map keeps a geographic exposure fallback and the ranked concentration list. Do not describe a scenario label as a measured result unless the diff loaded.
