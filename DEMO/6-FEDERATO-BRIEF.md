# Federato context for this demo

Use the [timed card](tracks/01-federato.md) at the table. This background explains the supplied challenge and how Pixie fits it; it is not a new competitive analysis or a claim about Federato's current roadmap.

## Who is doing what

A business owns a building and wants coverage. Its broker sends a submission to a carrier. The carrier's underwriter checks whether that risk fits the carrier's appetite and whether more evidence is needed. A quote may become a bound policy; an accepted prototype score is not a binding contract.

Federato is the software provider in this workflow, not the insurer taking the risk. Pitch Pixie as a demonstration of inspectable underwriting decisions over the supplied snapshot. Do not present the renter phone as Federato's consumer product.

## What their challenge gives us

The project includes synthetic submissions, policies, insureds, locations, buildings and related records, plus a commercial property guideline. The task is to score, rank and explain. Reading one submission is insufficient: TIV, construction, premium and losses may require different joins. A source path is useful evidence that the right record supplied the number.

The appetite rule says which business the carrier wants to write. That is different from winnability, whether a broker would actually bind the quote. This dataset does not supply the broker behaviour needed to demonstrate a credible winnability predictor. Pixie's ordering is a rule-based prioritisation, not that predictor.

## The most useful product conversation

"The incomplete case should not look complete. We keep a range, identify what evidence can change the result, and expose the rule so an underwriter can challenge it."

Show one provenance path, one what-if, and one guideline edit with its measured diff. The Challenger supports that story by making objections visible. Do not spend the first two minutes listing model names or agents.

The guideline editor is particularly useful to this audience. It lets a judge change a real rule, apply it, and inspect effects across the book. The preset's description is only an example; the response diff is the evidence. Restore the filed guideline before the next demo.

## Vocabulary to have ready

| Term | Meaning in this project |
|---|---|
| Appetite | The carrier's stated preferences and restrictions, represented here as a rule file. |
| TIV | Total insured value. It is not necessarily the policy limit or an expected loss. |
| Premium | The price for coverage. An estimated comparable premium is not a broker-confirmed offer. |
| Bound | Coverage was agreed in the historical record. A prototype decision does not itself bind coverage. |
| Incurred loss | Paid claims plus recorded outstanding claims amounts. |
| Loss ratio | Incurred losses divided by premium in the displayed dataset. Check the period and denominator. |
| Referral | A case sent for human review. |
| Subjectivity | A condition attached to a proposed underwriting action, such as providing inspection evidence. |
| Concentration | Exposure already held in the same area or cohort. Pixie shows nearby active-policy TIV. |
| Peril | A cause of loss such as flood or wildfire. |
| MGA | An organisation with delegated underwriting authority from a carrier. |
| E&S | Excess and surplus insurance. It does not mean errors and omissions. |

## Questions to expect

**Why does the backtest reject bound policies?** The retrospective rule may disagree with historical pricing or decisions. That measures disagreement, not whether the historical underwriter was wrong.

**What if the guideline changes?** The editor validates a candidate document, applies it, rescores cases and returns the change summary. The waterfall and what-if read the active rule too.

**What if the data is wrong?** Provenance and consistency flags let the underwriter identify the source. The prototype does not repair upstream records or independently guarantee source truth.

**How is the human involved?** The interface separates engine output, agent recommendation and a reasoned human override. The override is bounded and logged. Production authority controls are future work.
