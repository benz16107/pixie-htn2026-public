# How Pixie works

## Commercial desk

A submission arrives with known facts, estimates, and blanks. Pixie keeps those states separate and attaches a source to every value. The rule engine returns a score interval because an unknown fact may fit more than one rule band.

Case 138 is the cleanest example. Its premium is missing. The page shows how the current evidence produces the interval, which threshold the interval crosses, and what confirmed premium would move the decision. The what-if slider is hypothetical and does not change the stored case.

Six agents decide what to inspect, ask each other targeted questions, and challenge the draft. Tools compute the numbers. The model writes the reasoning. A guardrail checks every number in that reasoning against tool output before the UI displays it.

## Consumer lifecycle

The Intact experience uses four stages:

1. Quote gathers tenant or Auto facts and returns a sourced estimate.
2. Decide compares one changed input without overwriting the baseline.
3. Protect records a home inventory or runs coaching-only driving context.
4. Recover turns a safety check and incident record into a local plan the customer can save or share.

Home pricing reuses the working Toronto tenant engine. Auto pricing uses three synthetic vehicle listings and deterministic fixture tables. Driving context separates behavior from synthetic route exposure, publishes every source, stores no coordinates, and cannot affect a quote or premium.

The MCP server exposes these same calculations as narrow tools. It omits a full-profile tool and never submits an application or recovery request.

## Provider boundary

| Provider | Actual role | What to point at |
| --- | --- | --- |
| Federato | Submission schema, records, and source fields | Provenance on case 138 and Ask query attempts |
| Intact | The consumer problem and judging brief | Quote, Decide, Protect, Recover story |
| Elastic | Similar-case retrieval and nearby portfolio exposure | Provider badge, precedent, and map |
| Sentry | Traces, logs, and unsupported-number alerts | One decision trace |
| Expo | Native Home and Auto product | Router, Expo UI, widget, Live Activity, quote, and first-party recovery |

Replay, cache, fixture, local, and memory results are all labelled. Say which path is on screen.
