# Federato track research

Research checked on 2026-09-20. This note separates public requirements, sponsor-package guidance, and interpretation. It does not treat product marketing as a contest rule.

## What the official track requires

The public [Hack the North 2026 Devpost page](https://hackthenorth2026.devpost.com/) names the prize **"Federato: Building the Federato Insurance Agent"** and asks for an AI agent that:

- thinks like an underwriting professional;
- ingests insurance submissions;
- enriches them with real-world risk data;
- evaluates them relative to a carrier's appetite guidelines; and
- turns the result into explainable, actionable insight.

The public page provides a sample-submissions API, schema-discovery endpoint, sample appetite guidelines, and underwriting glossary. It lists one $3,500 team prize. It does **not** publish a Federato-specific point rubric, mandate a particular model or framework, say every supplied resource must be used, or require quote generation.

The supplied [student project guidelines](federato/STUDENT_PROJECT_GUIDELINES.txt) make the expected workflow more concrete: score submissions against appetite, reason about which API data to request, rank the queue, and explain every decision. Their "What Good Looks Like" section is guidance, not a weighted rubric:

| Level in the supplied guide | Sponsor guidance |
| --- | --- |
| Minimum viable | Query the API, apply appetite logic, calculate and rank scores, explain results, and handle 50+ submissions in reasonable time. |
| Strong | Construct queries dynamically, justify decisions in detail, handle missing fields/API errors, and provide clean errors. |
| Exceptional | Make agent reasoning traceable, deepen analysis for valuable cases, explain contradictions, and make the output immediately actionable. |
| Bonus enrichment | Use one or two researched external APIs, let the data visibly affect ranking, and explain what changed. |

The [event rules](https://hackthenorth2026.devpost.com/rules) allow a project to enter multiple sponsor prizes. Sponsor judging may be in person, Devpost-screened with ten finalists, or entirely on Devpost. The initial submission had to select sponsor prizes by 2:00 PM EDT on September 19. The main judging pitch is five minutes and should center on a live demo. The event-wide criteria are originality, user experience, technical complexity, and WOW factor. These are event criteria, not Federato-specific weights.

## Requirement-to-Pixie mapping

| Official ask | What Pixie actually does | Evidence | Honest wording or limitation |
| --- | --- | --- | --- |
| Build an AI underwriting agent | A Lead plans review depth, then Intake, Hazard, Portfolio, and Appetite agents use bounded tools. High-value open cases receive deeper review; agents cannot set a score. | [`desk.py`](../api/src/atlas_api/desk.py) defines the depth policy, specialist prompts, tools, and orchestration. | Say "a multi-agent underwriting desk." If the demo uses recorded events, call it a replay rather than a fresh live model run. |
| Ingest submissions | The Federato adapter authenticates to the supplied endpoint, discovers the schema, traverses reference paths, lints agent-written queries, parses API errors, and caches responses. The offline snapshot contains 158 submissions across 12 resources. | [`federato.py`](../api/src/atlas_api/federato.py), [`test_federato.py`](../api/tests/test_federato.py), and the supplied [API guide](federato/API_DOCUMENTATION.txt). | Say "Federato's supplied synthetic API and snapshot." Do not imply access to a Federato production tenant. A fresh clone needs credentials and the machine-local snapshot for live data. |
| Reason about what data to request | Intake receives the discovered schema, writes a query with a stated purpose, runs schema linting before the call, and can revise a rejected query. The Ask flow allows up to three lint/API/result-aware attempts. | [`desk.py`](../api/src/atlas_api/desk.py) and [`ask.py`](../api/src/atlas_api/ask.py). | Initial case hydration also uses deterministic code. Do not claim every query or join is invented by a model. |
| Enrich with real-world risk data | The hazard lane reads cached FEMA flood, USGS earthquake, USFS wildfire, Open-Meteo, and Nominatim records. Each finding carries its source URL and a deterministic adjustment. The portfolio lane adds nearby active-property TIV and H3-cell concentration. | [`layers.py`](../api/src/atlas_api/layers.py), [`portfolio.py`](../api/src/atlas_api/portfolio.py), and [`engine.py`](../api/src/atlas_api/engine.py). | Distinguish scoring enrichment from the newer NASA/county map layers that are context-only. A missing layer remains a gap. |
| Show that enrichment matters | The recorded comparison covers 38 scored property cases. Enrichment moved all 38 intervals, changed the rank of five of six open submissions, and changed zero decision tiers because hard appetite failures dominated. | [`backtest.json`](../eval/backtest.json) and [`BACKTEST.md`](../eval/BACKTEST.md). | This is a useful measured claim because it reports the zero as well as the rank changes. It is a small synthetic evaluation, not proof of production accuracy. |
| Apply carrier appetite | The supplied 2025 commercial-property bands are transcribed into a versioned rule file. Code evaluates each factor, applies explicit points, caps, and thresholds, and returns an interval when evidence spans more than one band. Other lines are routed instead of forced through the property rules. | [`property_2025.yaml`](../rules/property_2025.yaml), [`engine.py`](../api/src/atlas_api/engine.py), and [`test_engine.py`](../api/tests/test_engine.py). | The bands came from Federato; Pixie's point mapping, thresholds, caps, and adjustments are implementation choices. The range is rule-based uncertainty, not a statistical confidence interval. |
| Rank the queue | The web desk ranks unresolved decisions first, then orders by appetite-range midpoint and value at stake. Judges can sort the visible appetite range and open a case from the same queue. | [`QueueTable.tsx`](../web/src/components/QueueTable.tsx) and [`page.tsx`](../web/src/app/queue/page.tsx). | The property guideline scores 38 submissions. The other 120 records are assessed for scope and routed to their lines, not presented as property scores. |
| Explain every decision | Each rule input is `Known`, `Estimated`, or `Missing`; known values keep their source, estimates name their method and evidence, and missing facts identify who can resolve them. The case page exposes facts, sources, score calculation, conflicts, agent activity, issues, and action history. Generated prose is rejected if it invents a number. | [`case.py`](../api/src/atlas_api/case.py), [`engine.py`](../api/src/atlas_api/engine.py), [`openai_runtime.py`](../api/src/atlas_api/openai_runtime.py), and the [case page](../web/src/app/cases/[id]/page.tsx). | Lead with case 138: premium remains estimated, its score is a range, and the source trail identifies what the broker must confirm. |
| Make the result actionable | The queue says what needs attention. The case view names the fact that could flip the outcome, recomputes a scenario through the same engine, supports a bounded underwriter adjustment with a reason, and keeps the original evidence. | [`WhatIf.tsx`](../web/src/components/case/WhatIf.tsx), [`override.py`](../api/src/atlas_api/override.py), and [the five-minute script](../DEMO/9-FEDERATO-FIVE-MINUTES.md). | The what-if is hypothetical and never overwrites the filed submission. Pixie supports human review; it does not replace the underwriter. |
| Handle edge cases and contradictions | The case builder flags duplicate accounts, stale submissions, requested-limit/TIV conflicts, and missing roof years. Missing fields cannot silently pass. A Challenger can inspect deterministic sensitivities and ask what evidence would change its view. | [`case.py`](../api/src/atlas_api/case.py), [`test_case.py`](../api/tests/test_case.py), and [`desk.py`](../api/src/atlas_api/desk.py). | The implementation detects a defined set of data defects, not every possible insurance-data error. |

## Why the design is Federato-aligned

This is product alignment, not an extra contest requirement.

- Federato describes its own Submission Triage as extracting the information needed for eligibility, appetite, and winnability, then checking fit against rules, historical underwriting data, and current portfolio status. Pixie's schema-aware intake, deterministic appetite engine, precedent search, and concentration check follow that workflow. See Federato's [Submission Triage explanation](https://www.federato.ai/articles/submission-triage-how-it-works).
- Federato says underwriters should be able to trace fields to submission attachments, the open web, or third-party integrations, with citations and confidence indicators. Pixie's source-bearing values and visible agent/tool history address that trust problem. See Federato's [provenance article](https://www.federato.ai/articles/why-provenance-matters-agentic-ai-underwriting).
- Federato positions AI as decision support that automates intake and scoring while leaving judgment and strategy to underwriters. Pixie keeps numeric decisions in deterministic code and offers scenarios, explanations, and bounded human review. See Federato's [underwriter guide to AI](https://www.federato.ai/articles/underwriters-guide-ai).

## Best submission and demo emphasis

The cleanest Federato story is one end-to-end case:

1. Start with the ranked submissions queue and define appetite.
2. Open case 138 and show the 30–75 rule-based range instead of a false point estimate.
3. Trace its $2.073 million insured value through the discovered Federato relationships and show the agent's query purpose and result.
4. Show that the missing premium was estimated from 27 cited bound comparables, while remaining visibly unconfirmed.
5. Enter the $75,000 scenario and show the recomputed 91/accept result, then reset it to prove the record was not changed.
6. Show portfolio exposure or one sourced hazard finding, then close on the backtest's known miss and the enrichment comparison.

This sequence covers ingestion, agent reasoning, appetite, external/portfolio context, explainability, action, and measured limitations. It also fits the official requirement to center the judging pitch on a working live demo.

## Claims to avoid

- Do not say Federato published sponsor-specific judging weights. It did not on the public 2026 page.
- Do not call the supplied resources mandatory technologies or claim every one must be used.
- Do not claim Pixie calls a hosted production Federato API or reproduces Federato's full product.
- Do not call an estimated premium a broker-confirmed fact, or call the score range a confidence interval.
- Do not claim the current evaluation proves improved loss outcomes. The backtest deliberately shows a policy the engine would have accepted that later incurred $629,200 in losses.
- Do not say every map layer changes the score. The newer climate and county layers are investigation context; the scored hazard and portfolio paths are separate and measured.

## Verification

On 2026-09-20, `uv run pytest -q tests/test_engine.py tests/test_case.py tests/test_desk.py` passed: **26 passed**. The live Federato acceptance test was not rerun for this note; its captured test evidence and cached snapshot remain in the repository.
