# Rox: five-minute demo

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md)

## The pitch

"Pixie finds the record defect before it gives the underwriter a confident answer, then shows the exact rows that caused the warning."

Use the messy-enterprise-data angle in the supplied track notes. Confirm that the final track rules accept a product demonstration because Pixie does not use a Rox SDK.

## What we built for this track

- Missing-value handling that widens a decision instead of treating a blank as zero.
- Duplicate-account detection across related submissions.
- Checks for stale, inconsistent, and conflicting records.
- Schema-aware query linting with a visible retry path for unsupported queries.
- Local cross-case recall that notices an earlier related case without supplying a score or price.
- A source trail that lets a judge inspect the conflicting records.

## What part matches Rox

The track is about an agent working through imperfect business data, resolving sources, and handling uncertainty. Cases 126 and 141 are the strongest proof: the same underlying account appears in two submissions, and Pixie names the duplicate issue before making the underwriter interpret the results.

## Why it fits Pixie

Insurance decisions often join submissions, organizations, locations, policies, and losses. A polished summary is dangerous if those joins are wrong. Pixie makes data quality part of the decision rather than a hidden preprocessing step.

## Five-minute flow

| Time | Show and say |
|---|---|
| 0:00-0:40 | Open cases 126 and 141. Show the repeated insured and the two case ids. |
| 0:40-1:40 | Point to the duplicate-account issue and the source fields that support it. Say that Pixie detects the defect but does not rewrite the source system. |
| 1:40-2:40 | Show the local recall panel on the later case. Explain why the earlier case matched and repeat that recall is advisory only. |
| 2:40-3:50 | Open `/ask` and run one prepared query. Show the checked query, retry information if present, returned rows, and backend label. |
| 3:50-5:00 | Return to the case decision. Close on a traceable issue and a specific next action rather than a confident summary over bad data. |

## Know these details

`federato.py` normalizes fields, validates joins, and lints the supported query subset. `ask.py` caches by question and exposes how it obtained the result. `memory.py` stores number-free identity and issue labels in Pixie's local session. None of that memory enters the engine's fact list.

## Say this limitation

"Pixie detects a defined set of defects and explains them. It does not repair Federato upstream, and this build does not integrate a Rox SDK."

## If it fails

Use the two case pages and their stored source rows. Skip Ask if the query service is unavailable. The duplicate evidence is the demo; a generated explanation is optional.
