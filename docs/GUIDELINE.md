# The live guideline

`rules/property_2025.yaml` implements the supplied commercial property criteria. Federato supplied the bands; Pixie chose the points, thresholds, hard-failure caps and evidence adjustments. The rulebook's expandable scoring equation explains those choices. Applying an edit rescores the supported book, while an unapplied draft leaves the active equation unchanged.

The screen is `/guideline`. The following is a recorded example; counts and timings depend on the local data and active rules: click **Open Washington**, the state list
gains WA and the factor is marked pending, press **Apply**, and the panel on the right says
*1 case changed decision · 1 decline became open · $26.3M moved into the queue · 158 submissions
re-scored in 36 ms*, with #143 Aperture Cloud Corp named underneath and the factor that moved it.
Open #143 and the waterfall now cites `primary state: acceptable` where it cited a hard-fail cap.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/guideline` | The active guideline as a document: `id`, a content `hash`, `edited`, `thresholds`, `hardFailCap`, `points`, and every factor with its bands, whether it hard-fails and whether it routes. Also the one-click scenarios. |
| PUT | `/guideline` | Validate an edited document, swap it in, re-score all 158 submissions, return the new document and the diff. A rejected document returns 422 with a message and changes nothing. |
| POST | `/guideline/reset` | Restore the file as it is on disk and re-score. Returns the same diff shape. Idempotent. |
| POST | `/demo/reset` | Restores the guideline as well as the human events, overrides and outbox. One button puts the standard demo back. |

The `PUT` response's `diff` is the point of the feature:

```jsonc
{
  "casesScored": 158, "changed": 2, "tierChanges": 1,
  "counts": {"decline->open": 1},
  "valueIntoQueue": 26254000, "valueOutOfQueue": 0,
  "cases": [{"caseId": "143", "insured": "Aperture Cloud Corp",
              "tierBefore": "decline", "tierAfter": "open", "tierChanged": true,
              "scoreBefore": {"lo": 30, "hi": 30}, "scoreAfter": {"lo": 30, "hi": 67},
              "valueAtStake": 26254000,
              "factors": [{"fact": "primary_admin", "from": ["not_acceptable"], "to": ["acceptable"], "value": "WA (Location 27)"}]}],
  "rankMoves": [{"caseId": "143", "from": 4, "to": 2, "delta": 2}],
  "change": ["primary_admin acceptable: WA added"],
  "hashBefore": "f69a79667938", "ms": 36.5
}
```

## What validation rejects

Everything is checked before anything is applied, so a bad document never lands half-way
(`test_a_bad_edit_never_applies_the_good_half_of_itself`). Each message names the problem:

- the decline threshold at or above the accept threshold ("otherwise no case can be open"), or either
  one outside 0 to 100;
- a hard-fail cap above the accept threshold, which would let a case that breaks a hard rule be
  accepted anyway, or a negative cap;
- a points table that does not reward better bands more: target > acceptable > not_acceptable;
- a band range that is inverted (`between: [100000, 75000]`) or empty (`between: [75000, 75000]`);
- an empty or repeating list (`in: []`), or a `share_gt` fraction outside 0 to 1;
- a factor with no catch-all band, so a value outside every range would fall through unscored;
- a factor listed twice, a guideline with no factors, a band that is not target / acceptable /
  not_acceptable, and a value that should be a number and is not;
- an unknown fact name or an unknown predicate, from the engine's own parser
  (`RulesFile.from_raw`), so an edited guideline gets exactly the checks a file on disk gets.

## How it works

`api/src/atlas_api/guideline.py` holds the active `RulesFile` in memory. Every scorer reads it
through `guideline.active()`: `app.py` (startup, the queue, the case view, the waterfall, what-if,
sensitivity, the decision surface, actions), `desk.py`, `override.py`, `cli.py`. That is the whole
trick, and the bug it avoids is the obvious one: if any reader still loaded the YAML itself, the
case page and the queue would quietly disagree after an edit.
`test_every_reader_sees_the_edit` fails if that ever happens again.

Applying a guideline re-scores every submission (`rescore_book`) and folds each recorded desk run
back over its case, then diffs the stored views before and against after. It is pure engine code:
no model, no network, ~36 ms for 158 submissions on an M2, which is why the screen can afford a
full re-score per click rather than an incremental update.

A change is an event in the same ledger everything else uses: one `GuidelineP` event per moved case,
actor `human`, carrying the edit in words, the hash before and after, and the engine's own interval
and decision on each side. It shows up in that case's swimlane with the desk's own events.

## How this maps to Federato

Federato's Control Tower is the leader-facing surface where a carrier's appetite is configured:
"adjustments are applied instantly to agentic guardrails that guide every submission… the system
automatically steers new business appropriately"
([Introducing Control Tower](https://www.federato.ai/articles/introducing-control-tower)).
`docs/research/federato-product.md` recorded the honest position before this feature existed: our
appetite was "a simplified, static version of the same idea."

This closes the gap on the part that matters for a demo: the appetite is editable by a human, the
change takes effect immediately, and the queue re-steers. What it does not claim to be is the rest
of Control Tower, which is a portfolio-performance and model-governance screen for leadership.

## Honest limitations

A real carrier needs four things this does not have:

1. **In memory only.** An edit lives for the life of the API process and never touches
   `rules/property_2025.yaml`. Restart the API and the filed guideline is back. This is deliberate
   for a demo (a reset must always work), and wrong for production.
2. **No versioning.** There is one previous state, the file on disk. No history, no named versions,
   no "what was in force on 14 March", which is the first thing a regulator asks.
3. **No approval workflow.** The person editing is the person applying. A carrier needs a draft, a
   reviewer and an effective date.
4. **No permissions.** Every request is the same anonymous user; the event ledger records
   "underwriting leader" because that is who the screen is for, not because anyone authenticated.

Also: the edit applies to new scoring, not to already-bound policies, and the scenario effects
quoted on the screen are measured against this 158-submission snapshot
(`test_every_scenario_still_does_what_its_label_says` fails if the data or the engine moves).

## The scenarios, and what they really do

Measured against the demo book, not guessed:

| Scenario | Edit | Measured effect |
|---|---|---|
| Open Washington | WA added to acceptable states | 1 decline becomes open: #143 Aperture Cloud Corp, $26.3M, 4th to 2nd in the open queue |
| Open Texas | TX added to acceptable states | No decision changes. 7 cases re-band on state; every Texas case in the queue also breaks the loss-history rule |
| Tolerate losses to $1.5M | `loss_5yr` acceptable under $1,500,000 | 20 cases re-band, 1 decline becomes open ($13.4M). After Open Texas it also frees #134 Willowbrook Stores, $24.3M |
| Premium floor to $75K | `premium` acceptable $75,000 to $175,000 | The book's one accept becomes a decline: #81 Coastal Freight Systems, $18.5M, on a premium of $58,800 |
| Soften the hard-fail cap to 50 | cap 30 becomes 50 | 27 declines become open and $1.34B of TIV lands back in the queue |

Open Texas is the useful one to show a judge who suspects theatre: the desk says plainly that
nothing changed, and why.
