# Rox, Sentry, and Elastic track research

Research checked on 2026-09-20. This note separates official prize requirements, first-party product guidance, Pixie's implementation evidence, and claims that the submission should avoid.

## Event-wide requirements

Hack the North requires a source-code link and recommends a demo video. The event asks judges to assess originality, user experience, technical complexity, and wow factor. The judging pitch should center on a live demo rather than slides. These criteria apply across the three sponsor tracks below. Source: [Hack the North 2026 on Devpost](https://hackthenorth2026.devpost.com/).

## Rox: Best AI Agent

### Official qualification and judging criteria

The official [Rox prize description](https://hackthenorth2026.devpost.com/) requires a system that uses large language models, operates on messy real-world data, and takes meaningful actions. The data may contain unstructured information, missing fields, conflicting sources, or noise. The description suggests validation, source resolution, intelligent error handling, and decisions under uncertainty as relevant techniques.

Rox judges technical complexity, creativity, how well the system handles messiness, and practical utility. The public rules do not require a Rox SDK or API, define a minimum number of defects or data sources, or assign scoring weights.

Rox's own engineering articles support a few design choices without adding contest requirements:

- [Why Revenue Agents are Uniquely Hard to Build](https://www.rox.com/articles/why-revenue-agents-are-uniquely-hard-to-build) describes heterogeneous data, entity resolution before agent execution, and controlled query interfaces.
- [How We Build Agents at Rox](https://www.rox.com/articles/how-we-build-agents-at-rox) discusses confident answers caused by bad retrieval and the use of controlled retrieval and typed actions.
- [How Rox Mines Signal from Sales Data at Scale](https://www.rox.com/articles/how-rox-mines-signal-from-sales-data-at-scale) explains why preserving raw source evidence helps prevent fabricated or omitted facts.
- [Rox's System of Record for Contact Data](https://www.rox.com/articles/how-we-are-building-rox%E2%80%99s-system-of-record-for-contact-data) describes partial and conflicting records from multiple sources.

### Pixie mapping

| Official concern | Pixie evidence | Honest boundary |
| --- | --- | --- |
| LLM agent on messy data | The desk coordinates specialist agents over linked commercial insurance records. [`desk.py`](../api/src/atlas_api/desk.py) contains the orchestration and tools. | The dataset is realistic but synthetic. Pixie does not use a Rox product. |
| Missing data | Every rule input is `Known`, `Estimated`, or `Missing`. [`case.py`](../api/src/atlas_api/case.py) defines those types, and [`engine.py`](../api/src/atlas_api/engine.py) evaluates every applicable band. | Missing values can widen a rule-based score range. The range is not a statistical confidence interval. |
| Conflicting records | Cases 126 and 141 receive `duplicate_account` issues. Case 143 receives a dated stale-submission issue. Case 134 receives a requested-limit and insured-value issue. [`test_case.py`](../api/tests/test_case.py) locks those behaviors. | Pixie detects four implemented issue classes. It does not solve general entity resolution. |
| Multiple sources | Case hydration follows submissions, insureds, policies, locations, buildings, and claims while preserving source paths. [`case.py`](../api/src/atlas_api/case.py) implements the joins. | Pixie does not merge or rewrite provider records. |
| Error handling | The Ask agent receives schema-lint errors, API errors, or an empty result and can revise its payload up to three times. [`ask.py`](../api/src/atlas_api/ask.py) exposes every attempt. | Deterministic code validates the query. The model cannot bypass the linter. |
| Meaningful action | Pixie ranks the case, names the evidence to request, and records the underwriter's next action. | It does not send an unconfirmed message or modify Federato upstream. |
| Safe recall | Local cross-case memory stores identity and issue labels. [`openai_runtime.py`](../api/src/atlas_api/openai_runtime.py) excludes recall from the engine's accepted fact list. | Recall is advisory and cannot provide a score or price. |

### Claims to avoid

- Do not say that Pixie uses a Rox SDK, API, or platform.
- Do not call the synthetic commercial records real customer data.
- Do not claim that Pixie repairs upstream data or detects every possible defect.
- Do not describe local recall as confirmed case evidence.

## Sentry: Best Use of Sentry

### Official qualification and judging criteria

The official [Sentry prize description](https://hackthenorth2026.devpost.com/) requires Sentry plus at least two named products beyond error monitoring. Its list includes Session Replay, Logs, Tracing, Profiling, Uptime Monitoring, and MCP or AI agent monitoring. The sponsor also asks teams to show how observability changed the project, not only that an SDK was installed.

Sentry judges creativity, depth of integration, and how much Sentry data influenced the project. The public rules do not publish weights or require Session Replay.

Relevant first-party documentation includes:

- [OpenAI Agents monitoring](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/agent-tracing/openai-agents/index.mdx), which documents automatic agent and tool spans, model use, and token counts. It also treats prompts and tool data as potentially sensitive.
- [Python custom tracing](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/tracing/instrumentation/custom-instrumentation/index.mdx), which supports Pixie's case-level root span.
- [Python structured Logs](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/logs/index.mdx), which documents searchable structured attributes.
- [Next.js Session Replay](https://github.com/getsentry/sentry-docs/blob/master/platform-includes/session-replay/setup/javascript.nextjs.mdx), which documents sampling and privacy masking.
- [Sentry MCP server](https://github.com/getsentry/sentry-docs/blob/master/docs/product/mcp-servers/getting-started.mdx), which supports agent access to Sentry data. Pixie's local MCP path has not been tested end to end.

### Pixie mapping

| Official concern | Pixie evidence | Honest boundary |
| --- | --- | --- |
| Two products beyond errors | The API uses Tracing, structured Logs, and AI Agent Monitoring. [`app.py`](../api/src/atlas_api/app.py), [`desk.py`](../api/src/atlas_api/desk.py), and [`telemetry.py`](../api/src/atlas_api/telemetry.py) contain the integration. | Cron Monitoring is additional, but the submission does not rely on Cron to meet the named two-product requirement. |
| Decision tracing | Each case creates a `pixie.underwrite_case` span with decision and usage attributes. Agent and tool spans nest under it when the SDK provides them. [`desk.py`](../api/src/atlas_api/desk.py) owns the root span. | A recorded replay must be labelled as a replay rather than a fresh model run. |
| Semantic failure monitoring | `verify_numbers_alert()` sends a tagged error when model prose contains a number absent from the facts. The UI uses a deterministic fallback. [`telemetry.py`](../api/src/atlas_api/telemetry.py) and [`openai_runtime.py`](../api/src/atlas_api/openai_runtime.py) implement the path. | The event proves the guard fired. It does not prove that an alert email arrived. |
| Structured logs | Queries, rejections, conflicts, actions, and guardrail events carry structured attributes and a case ID when available. [`telemetry.py`](../api/src/atlas_api/telemetry.py) centralizes those calls. | Prompts and tool arguments remain disabled unless the explicit PII flag is enabled. |
| Cron check-ins | The backtest write uses the `pixie-backtest` monitor. [`backtest.py`](../eval/backtest.py) contains the wrapper. | The repository does not install a nightly scheduler. Check-ins happen only when the script runs. |
| Observability changed the project | A stale API DSN pointed to a project ID absent from the organization. The setup was corrected with the live project key, and one verification run produced 53 ingested transactions. [`SENTRY.md`](SENTRY.md) records the incident and resulting setup changes. | The count is one observation, not a normal per-run count. [`INCIDENTS.md`](../INCIDENTS.md) currently has no completed incident row, so the demo should use the documented setup evidence and a real trace. |
| Web and mobile coverage | Next.js contains tracing, Logs, masked error Replay, and feedback configuration. Expo contains JavaScript tracing and Logs. | The current web build lacks the public browser DSN. Expo Go cannot prove native crash capture or mobile replay. |

### Claims to avoid

- Do not rely on Session Replay to meet the prize requirement in the current build.
- Do not say that the repository schedules a nightly backtest.
- Do not claim verified email delivery from the alert workflow.
- Do not claim native Expo crash capture or mobile replay from Expo Go.
- Do not say that the Sentry MCP path has been tested end to end.

## Elastic: Find the Signal, Best Use of Elasticsearch

### Official qualification and preferred capabilities

The official [Elastic prize description](https://hackthenorth2026.devpost.com/) asks teams to use Elasticsearch to turn messy, unstructured, real-world data into information that a person or agent can act on. It prefers agentic systems that reason over indexed data, decide what to retrieve, call tools, and trigger actions.

The description suggests hybrid BM25 and Jina dense-vector search, reranking, aggregations, ES|QL, geographic or time-series queries, Agent Builder tools, and Workflows. That list is guidance rather than a hard checklist. The public rules do not define weights, document-count minimums, or a requirement to implement Workflows.

Relevant first-party documentation includes:

- [Hybrid search](https://www.elastic.co/docs/solutions/search/hybrid-search), which recommends full-text and vector retrieval with `semantic_text` and reciprocal rank fusion.
- [Semantic reranking](https://www.elastic.co/docs/solutions/search/ranking/semantic-reranking), which documents `text_similarity_reranker` over other retrievers.
- [Agent Builder tools](https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/tools/index-search-tools), which documents query tools that can use Query DSL or ES|QL.
- [`significant_terms`](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-significantterms-aggregation), which compares a foreground term frequency with its background frequency.
- [ES|QL spatial functions](https://www.elastic.co/docs/reference/query-languages/esql/functions-operators/spatial-functions), which documents `ST_DISTANCE` and `ST_INTERSECTS`.

### Pixie mapping

| Preferred capability | Pixie evidence | Honest boundary |
| --- | --- | --- |
| Agent context layer | The Hazard agent can call precedent search, and the Portfolio agent can call nearby concentration. [`desk.py`](../api/src/atlas_api/desk.py) connects both tools to the agent workflow. | The engine, not Elasticsearch or the model, owns the final appetite calculation. |
| Hybrid retrieval | `pixie-precedent` fuses BM25 and semantic retrieval with RRF and applies the Jina v3 reranker. [`precedent.py`](../api/src/atlas_api/precedent.py) contains the query. | The precedent summaries are generated from structured synthetic policy facts, not raw broker documents. |
| Aggregations | `significant_terms` compares declined and loss-making cohorts with the whole book. `percentile_ranks` places a case in the bound book. [`precedent.py`](../api/src/atlas_api/precedent.py) and [`insights_routes.py`](../api/src/atlas_api/insights_routes.py) expose the results. | These outputs are descriptive. They do not establish causal risk. |
| Geographic queries | The exposure index uses `geo_distance` and H3 aggregation. Toronto indices use `ST_INTERSECTS` and `ST_DISTANCE`. [`portfolio.py`](../api/src/atlas_api/portfolio.py) and [`layers.py`](../packs/toronto/layers.py) own the queries. | Toronto data is public real-world data. The commercial portfolio is synthetic. |
| Agent Builder | Three registered ES|QL tools cover H3 concentration, declined-peril counts, and TIV percentile breakpoints. [`ELASTIC.md`](ELASTIC.md) records their live verification. | The declined-peril tool is a frequency count, not the production `significant_terms` score. The breakpoint tool does not return one case's percentile rank. |
| Actionable result | Nearby active exposure can contribute a deterministic score adjustment. Retrieved precedents and cohort statistics support the recommendation. | Pixie has no implemented Elastic Workflow. |
| Offline fallback | Results carry `elastic`, `memory`, or `local` backend labels. Tests compare Elastic and memory concentration. [`test_portfolio.py`](../api/tests/test_portfolio.py) and [`test_precedent.py`](../api/tests/test_precedent.py) cover the paths. | The memory precedent ranking is deterministic but does not reproduce Elastic's semantic ranking. |

The live project note records five indices: `pixie-precedent`, `pixie-exposure`, `pixie-toronto`, `toronto-flood-zones`, and `toronto-fire-stations`. The recorded document counts and exact query examples live in [`ELASTIC.md`](ELASTIC.md).

### Claims to avoid

- Do not present the synthetic commercial book as real customer data.
- Do not say that Pixie indexed raw broker documents.
- Do not claim that similarity or significant terms proves causation.
- Do not describe a `memory` or `local` response as an Elastic result.
- Do not claim an Elastic Workflow exists.

## Verification

On 2026-09-20, the following focused suite passed from `api/`:

```text
uv run pytest -q tests/test_case.py tests/test_telemetry.py tests/test_precedent.py tests/test_portfolio.py
21 passed in 1.59s
```

The suite covers implemented data issues, safe telemetry calls, precedent search and aggregation paths, and Elastic versus memory portfolio parity. Live provider state can still change, so screenshots must show the backend and date observed.
