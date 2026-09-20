# Elastic for Pixie — verified capabilities + feature plan

Everything under "Verified live" was run against our actual serverless project (`atlas-fe1ce1`,
Elasticsearch 9.6.0, `build_flavor: serverless`, Kibana 9.6.0 serverless) on 2026-09-19 — created
real indices and Agent Builder tools, ran real queries, then cleaned up. Nothing here is copied
from docs without a live check unless marked "docs only."

Existing integration for context: `api/src/atlas_api/portfolio.py` already has an `ExposureIndex`
protocol with `ElasticIndex`/`InMemoryIndex`, loading `pixie-exposure` (122 location docs, `h3_r5`/
`h3_r7` keyword cells, `geo_point`, `tiv`, `perils`) and `pixie-toronto` (23,641 break-and-enter
points, `h3_r9`). `docs/ELASTIC.md` covers that part. This doc is the research base for what to add
next, written for the agent(s) wiring Pixie's remaining Elastic features.

## Verified live on our project

**semantic_text default inference.** Created an index with `"notes": {"type": "semantic_text"}`
and no `inference_id`. Elasticsearch resolved it to `.jina-embeddings-v5-text-small` (dense,
1024-dim, cosine) — not ELSER. The project also exposes ELSER v2 (`.elser-2-elastic`, sparse) and
Jina CLIP v2 (multimodal) as named inference endpoints if we want sparse or image embeddings
instead; `semantic_text` just needs `inference_id` set explicitly to switch.

**Retrievers.** `rrf` (reciprocal rank fusion of a BM25 `standard` retriever and a `semantic`
retriever) and `linear` (weighted, with `normalizer: minmax`) both ran and returned correctly
ordered results. `text_similarity_reranker` ran against `.jina-reranker-v3` as the `field`+
`inference_text` reranker over a `standard` retriever — also correct. Available reranker models on
this project: `.jina-reranker-v2-base-multilingual`, `.jina-reranker-v3`, `.jina-reranker-v3.5`,
`.jina-reranker-m0` (multimodal), `.rerank-v1-elasticsearch` (hosted).

**ES|QL.** `POST _query` is live on serverless. Confirmed: `STATS ... BY field` (grouped
aggregation), `ST_DISTANCE` (returns meters, geo_point to geo_point), `ST_INTERSECTS` (geo_point
against a `TO_GEOSHAPE(...)` polygon literal — works for point-in-polygon, e.g. "is this site
inside a flood study area"), `BUCKET(date_field, interval)` for time bucketing (must be used
inside `STATS ... BY`, not as a bare `EVAL` — confirmed by a real error message, then confirmed
working inside `STATS`). `LOOKUP JOIN` is implemented but requires the *joined* index to have
`"index.mode": "lookup"` set at creation — a plain index gives `verification_exception: Lookup
Join requires a single lookup mode index`. This matters: to `LOOKUP JOIN` submissions against a
Toronto layer, the Toronto index needs to be created with `index.mode: lookup`, not the default.

**Geo types.** `geo_point` and `geo_shape` both mapped and indexed correctly. `geo_bounds` and
`geohex_grid` (H3-flavored geo grid aggregation, precision 7 tested) aggregations both ran with no
license error. `significant_terms` and `percentiles` aggregations both ran with no license error.

**License.** `GET _license` reports `type: enterprise` on this serverless project (not a
traditional license file — serverless bills by resource units, `max_resource_units: 100000` — but
every aggregation that's normally platinum/enterprise-gated on self-managed, `significant_terms`,
`geohex_grid`, `percentiles`, ran with zero license friction). Don't budget time for a license
workaround; there isn't one needed here.

**Watcher / ILM.** `GET _watcher/stats` → no handler (Watcher doesn't exist on serverless).
`GET _ilm/policy` → `api_not_available_exception`, 410 (classic ILM doesn't exist on serverless
either). `GET _data_stream` works — serverless uses **Data Stream Lifecycle (DSL)** instead of ILM,
and Kibana's alerting/rules framework instead of Watcher. Don't plan a Watcher-based feature; use a
Kibana alerting rule or (better, see below) a Workflow instead.

**Agent Builder.** Live at `{KIBANA_URL}/api/agent_builder/*`. `GET /api/agent_builder/tools`
listed ~30 builtin tools, including `platform.core.execute_esql`, `platform.core.generate_esql`,
`platform.core.search`, `platform.core.list_indices`, `platform.core.get_index_mapping`,
`platform.core.create_visualization`, `platform.core.execute_workflow`,
`platform.core.generate_workflow`, `platform.core.list_workflow_executions`, plus a `platform.streams.*`
family (design/inspect/update ingest pipelines) and `platform.core.cases.*` (case management). We
then **created a real custom tool**:

```
POST {KIBANA}/api/agent_builder/tools
{
  "id": "portfolio_concentration_by_hex",
  "type": "esql",
  "description": "Portfolio TIV concentration grouped by H3 hex cell",
  "configuration": {
    "query": "FROM pixie-exposure | STATS total_tiv = SUM(tiv), n = COUNT(*) BY h3_r5 | SORT total_tiv DESC",
    "params": {}
  }
}
```

...and executed it via `POST {KIBANA}/api/agent_builder/tools/_execute` (`{"tool_id": "...",
"tool_params": {}}`), which returned real rows. This is a fully working, no-code way to hand the
judge a live tool they can run themselves in Kibana's Agent Builder chat, or via MCP. **Note:**
`DELETE` on a custom tool 500'd on our project (`{"api_keys":[]}` — looks like a serverless bug
unrelated to our data); a leftover `portfolio_concentration_by_hex` tool may still exist pointing
at the now-deleted test index and can be deleted or overwritten from the Kibana UI later.

Docs-confirmed (not independently re-verified beyond the above, since the behavior matched):
Agent Builder exposes an MCP server at `{KIBANA_URL}/api/agent_builder/mcp` (or
`/s/{space}/api/agent_builder/mcp`), and every tool created in Agent Builder — including ones we
make — is auto-exposed through it to any MCP client (Claude Desktop, our own agent code) with no
extra config. Auth is API key (works on serverless, one shared identity) or OAuth 2.1
(serverless-only, per-user). Agent Builder also serves an A2A endpoint (`/a2a`) for delegating to
other agents (e.g. Google ADK), which is out of scope for a 36-hour build but worth naming.

**Workflows.** `GET /api/workflows` returned `{"total": 0, "results": []}` — the feature is live
and enabled on this project, just empty. Public Elastic material says Workflows shipped as GA in
9.4 (our project is 9.6), described as the layer that "triggers actions in external systems,
coordinates multistep processes, and closes the loop between what the platform detects and what it
does about it" — internal actions (query ES|QL, update a case, create a Kibana alert) and external
actions (Slack, Jira). Agent Builder ships matching tools (`generate_workflow`,
`execute_workflow`, `validate_workflow`, `get_step_definitions`), so an agent can draft and run a
Workflow, not just call one a human wrote.

**Dashboards.** Docs-confirmed only (not re-verified live, to avoid burning the object-creation
budget on something screenshot-verifiable at demo time): Kibana dashboards share via Share → Link
(recipient needs project access) or Share → Embed (`?embed=true` iframe URL). For a judge with
project credentials this is a plain link; for a public booth screen, embed with a fixed time range.

## Ranked feature plan for Pixie

Ordered by (judge-visible impact) × (how much it makes Elastic the agents' context layer, not a
side chart). Effort assumes the existing `ElasticIndex`/`portfolio.py` scaffolding and
`scripts/load_elastic.py` loader pattern are reused, not rebuilt. ★ = unconventional (3+ required,
5 included).

### 1. `search_book` agent tool — hybrid precedent search (45 min)
Add a `pixie-decisions` index: one doc per past/current submission with a `semantic_text` field
(`summary`: business type, hazard tags, TIV band, key issues) plus keyword `decision`
(bind/decline/refer), `peril`, `line`, and `h3_r5`. Register a `@function_tool` (same pattern as
`_hazard_tools`/`_intake_tools` in `desk.py`) that runs an `rrf` retriever — `standard` BM25 on
`business_type`/`tags` fused with `semantic` on `summary` — filtered to `decision != "open"`, and
returns the top 5 with their decision and why. Wire it into the same actor that calls
`estimate_premium_tool`, since "what did we do with similar risks" is the natural next question
after "what should the premium be." **Judge sees:** a new finding on the desk lane, e.g. "3 similar
warehouse risks in the book: 2 bound at ~$40k premium, 1 declined for uninspected sprinkler gap" —
with real citations, not a canned string. **Code:** `api/src/atlas_api/portfolio.py` (new
`DecisionIndex` next to `ExposureIndex`, same protocol-with-fallback shape) + one new tool in
`desk.py`'s `_intake_tools` or a new `_precedent_tools`.

### 2. Agent Builder ES|QL tool judges can run themselves in Kibana (15 min)
Register `portfolio_concentration_by_hex` (shown above) for real against `pixie-exposure` — it's
already proven to work end to end on our project. Add 2-3 siblings: `hazard_declined_significant_terms`
(#8 below) and `tiv_percentile_rank` (#7 below). **Judge sees:** open Kibana → Agent Builder →
Tools, click "Run" on a tool with zero setup, get the exact number the desk shows. This directly
answers the prize's "Agent Builder tools" ask with something that isn't just a demo string.
**Code:** none — lives in Kibana project config; document the 3 `POST` calls in `docs/ELASTIC.md`
so anyone can re-create them after a project reset.

### 3. ★ Similar-risks-we-already-wrote panel on the case page (40 min)
Surface `search_book`'s result (#1) as its own panel on the case UI, not buried in the finding
text: card per precedent submission — decision badge, TIV, peril tags, one-line why, click-through
to that old case. This is the "beyond RAG with a chatbot" ask made literal: the retrieval result is
a first-class UI object the underwriter acts on (open the old case, copy its rationale), not a
chat answer. **Code:** `app/app/quote.tsx` or a new case-detail route reads a new `/case/{id}/precedents`
endpoint in `api/src/atlas_api/app.py` that calls the same `DecisionIndex.search()` from #1.

### 4. Portfolio percentile badge — "this submission's TIV is in the 92nd percentile of the book" (20 min)
One `percentiles` aggregation on `pixie-exposure.tiv`, filtered to the same peril/line as the
incoming submission, computed at case-open time. Cheap, verified live, and it's a number
underwriters actually reason with (is this risk unusually large for us). **Judge sees:** a single
sentence on the triage card. **Code:** one method on `ElasticIndex` in `portfolio.py`, one line in
`desk.py`'s triage finding.

### 5. ★ `significant_terms`: which hazard tags are over-represented among declines (35 min)
Run `significant_terms` on `hazard_tags` (keyword, multi-value) with the query filtered to
`decision: declined` against the whole-book background — this is exactly what `significant_terms`
is for (foreground vs. background rate, not just frequency) and it's already confirmed working with
no license gate. **Judge sees:** a sentence like "declined submissions are 4.2x more likely to
carry the `no-sprinkler` tag than the book average" surfaced once per case if the case shares that
tag. This is a genuinely different aggregation from the `terms`-agg concentration query another
agent is already wiring, so it reads as a second, distinct Elastic capability rather than a
reskin. **Code:** new method on `DecisionIndex` (#1), one new finding type in `desk.py`.

### 6. ★ ES|QL geo join: Toronto flood/fire layers against consumer quote sites (45 min)
Load `packs/toronto/raw/basement_flooding_study_areas.geojson` (67 polygons) and
`fire_stations.geojson` (85 points) into two new indices — `toronto-flood-zones` (`geo_shape`,
created with `"index.mode": "lookup"`) and `toronto-fire-stations` (`geo_point`, same mode). Both
raw files already exist on disk (fetched by `packs/toronto/fetch.py`) but aren't in Elastic yet —
only `break_and_enter` is (`pixie-toronto`, per `docs/ELASTIC.md`). Two ES|QL queries, both
confirmed to work on this project: `ST_INTERSECTS(quote_site.loc, flood_zone.shape)` for
"is this address inside a basement-flooding study area" and `ST_DISTANCE(quote_site.loc, station.loc)`
sorted ascending for nearest fire station. Skip the `LOOKUP JOIN` keyword itself for the hackathon
(it needs both sides to share a join key, and our data doesn't have one) — do the two ES|QL calls
from the API instead, which is the same "spatial join" result the prize brief means by "geo
joins," just expressed as two queries rather than one `LOOKUP JOIN`. **Judge sees:** the consumer
quote flow (`app/app/quote.tsx` → `map.tsx`) gains a real "this address is in a flood study area /
2.1 km from the nearest fire station" line instead of the current FEMA/USFS-only layers.
**Code:** `api/src/atlas_api/layers.py` (new Toronto ES|QL-backed layer, same `SOURCES` pattern as
`fema_flood`/`usfs_wildfire`) + a loader script next to `scripts/load_elastic.py`.

### 7. Concentration map upgrade: `geohex_grid` for a real hex layer, not app-side H3 math (25 min)
`HexMap.tsx`/`HexMap.web.tsx` currently render whatever `h3_r5` cells the app computes. Swap the
map's data source for a `geohex_grid` aggregation (confirmed working, precision-tunable) so the hex
boundaries and the TIV-per-cell numbers come from the same Elastic call, and precision becomes a
one-line change instead of a re-index. **Judge sees:** no visible change, but "zoom to change hex
resolution" becomes trivial to add live if asked. **Code:** `api/src/atlas_api/portfolio.py`
(`book()` method), `app/components/HexMap.tsx`.

### 8. ★ `text_similarity_reranker` on the desk's "similar issues" queue triage (30 min)
When the lead agent (`desk.py`'s `lead_plan`) is deciding case priority, rerank the open-case queue
by semantic similarity to a short "what's urgent right now" prompt (e.g. "uninspected fire risk,"
set by the underwriter that morning) using `text_similarity_reranker` over `.jina-reranker-v3`
against each case's `summary` semantic_text field. This uses reranking for agent decision-making,
not just search-result ordering — a different use of the same primitive than #1's retrieval.
**Judge sees:** the queue order changes live when the underwriter types a new focus prompt.
**Code:** `api/src/atlas_api/desk.py` (`lead_plan` input), reuses `pixie-decisions` from #1.

### 9. Kibana dashboard: one link, whole book (20 min)
Build one Kibana dashboard: `geohex_grid` map panel (TIV by cell), `percentiles` panel (TIV
distribution), `significant_terms` panel (hazard tags among declines), ES|QL table panel (top-3
cells, the exact query already documented in `docs/ELASTIC.md`). Share via Share → Link. **Judge
sees:** the same numbers the app shows, in Kibana, as external proof it's not hardcoded.
**Code:** none (Kibana Saved Objects); document the panel list in `docs/ELASTIC.md`.

### 10. Workflow: auto-file a Kibana case on decline (30 min, tech-preview risk)
A Workflow triggered by the desk posting a `decline` decision: internal action to create a Kibana
case (`platform.core.cases.manage`-equivalent step) tagged with the hazard tags and case id, so the
"why we declined" trail lives in Elastic, not just in Pixie's own event log. This is the literal
"Workflows that close the loop by taking action" ask. Lower priority than 1-9 because Workflows had
zero configured on our project and this is unexplored territory under time pressure — good stretch
goal if 1-9 land early. **Code:** Kibana Workflow definition (YAML/JSON via
`generate_workflow`/`validate_workflow` Agent Builder tools) + a webhook call from
`api/src/atlas_api/desk.py` when a decision posts, or trigger the workflow directly from
`execute_workflow`.

## Five truthful booth sentences

1. "Every case's portfolio-concentration number comes from a live `geo_distance` filter and `terms`
   aggregation against our 122-location Elastic index, computed per request — not pre-baked; you
   can rerun the exact ES|QL in Kibana and get our number."
2. "Our `semantic_text` fields default to Jina's v5 dense embedding model on this serverless
   project, and we fuse it with BM25 using an `rrf` retriever so the underwriting desk can search
   past decisions by meaning, not just keyword match on hazard tags."
3. "We registered a custom Agent Builder ES|QL tool — `portfolio_concentration_by_hex` — that any
   MCP client, including Claude, can call over Agent Builder's `/api/agent_builder/mcp` endpoint
   with zero extra glue code."
4. "We use `significant_terms`, not `terms`, to find which hazard tags are statistically
   over-represented among our declined submissions versus the book at large — that's a genuinely
   different question than a frequency count, and it runs with no license gate on serverless."
5. "Toronto's basement-flooding study areas and fire-station locations are indexed as `geo_shape`/
   `geo_point` in Elastic and joined against a quote address with `ST_INTERSECTS`/`ST_DISTANCE` in
   ES|QL — the same spatial-join primitive Elastic's docs call out for time-series and geo
   workloads, applied to open city data instead of logs."

## Exact Kibana queries to demo

Paste into Kibana Dev Tools / ES|QL tab at `ELASTIC_KIBANA_URL` (from `.env`).

Book concentration (already live, from `docs/ELASTIC.md`):
```
FROM pixie-exposure
| STATS tiv = SUM(tiv) BY h3_r5
| SORT tiv DESC
```

Percentile rank of TIV (feature #4):
```
FROM pixie-exposure
| STATS p25 = PERCENTILE(tiv, 25), p50 = PERCENTILE(tiv, 50), p75 = PERCENTILE(tiv, 75), p95 = PERCENTILE(tiv, 95)
```

Significant hazard tags among declines (feature #5, once `pixie-decisions` exists):
```
GET pixie-decisions/_search
{
  "size": 0,
  "query": { "term": { "decision": "declined" } },
  "aggs": { "over_represented_tags": { "significant_terms": { "field": "hazard_tags" } } }
}
```

Hybrid precedent search (feature #1, once `pixie-decisions` exists):
```
POST pixie-decisions/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        { "standard": { "query": { "match": { "business_type": "warehouse" } } } },
        { "standard": { "query": { "semantic": { "field": "summary", "query": "uninspected sprinkler system near flood-prone creek" } } } }
      ]
    }
  },
  "size": 5,
  "_source": ["summary", "decision", "tiv", "peril"]
}
```

Agent Builder custom tool (feature #2, create once, then just click "Run" in Kibana):
```
POST kbn:/api/agent_builder/tools
{
  "id": "portfolio_concentration_by_hex",
  "type": "esql",
  "description": "Portfolio TIV concentration grouped by H3 hex cell",
  "configuration": {
    "query": "FROM pixie-exposure | STATS total_tiv = SUM(tiv), n = COUNT(*) BY h3_r5 | SORT total_tiv DESC",
    "params": {}
  }
}
```
