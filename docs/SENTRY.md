> Website audit, 2026-09-20: the current checkout has no web/.env.local and no NEXT_PUBLIC_SENTRY_DSN in the build environment. Browser replay is therefore unavailable in this build. The API DSN and previously verified API traces are separate. Use [the current Sentry demo card](../DEMO/tracks/07-sentry.md); older setup claims below describe prior verification.

# Sentry: what's instrumented, and why

Lane A4. Full research and the ranked 12-item plan this follows: `docs/research/sentry.md` (that
file lives only in the `atlas` worktree today, uncommitted there -- see the note at the end of this
file). Org: **benzhou**. Everything below is either running code (linked to the exact file) or an
honestly-documented gap.

## 1. What's instrumented, by surface

### API (FastAPI + OpenAI Agents SDK) -- `api/src/atlas_api/`

- **Init**: `app.py::_init_sentry()`. `traces_sample_rate=1.0`, `enable_logs=True`,
  `OpenAIAgentsIntegration` (auto-instruments every `agents.Runner.run()` call into
  `gen_ai.invoke_agent` / `gen_ai.execute_tool` spans with model, tokens and cost). PII
  (full prompts/completions/tool args) only ships when `ATLAS_SENTRY_PII=1` -- off by default.
  Reads `SENTRY_DSN_API` from `.env`.
- **One trace per underwriting decision** -- `desk.py::Desk.run().one()`. Every case gets a root
  span (`op="pixie.underwrite_case"`) that every agent/tool span nests under (see "Trace anatomy"
  below).
- **Structured Logs** (`telemetry.py::log()`, `sentry_sdk.logger.*`) record Federato queries,
  lint or API rejection, conflicts the Lead must resolve, and decision events. Every log line
  carries `case_id` where one exists.
- **The verify_numbers alert** -- `telemetry.py::verify_numbers_alert()`, called from
  `desk.py::_CaseRun.checked()` whenever `verify_numbers()` rejects a model sentence. Fires an
  **error-level Sentry event** (not just a log) carrying the offending sentence, the case id, the
  agent name, and the full fact list that sentence was checked against, tagged
  `pixie.alert=verify_numbers`.
- **Cron monitor** -- `eval/backtest.py::_write_backtest_monitored()`, wrapped in
  `sentry_sdk.crons.monitor(monitor_slug="pixie-backtest")`. This is the nightly/precompute job:
  it re-runs the pre-registered B1-B4 backtest and refreshes `eval/backtest.json`, which
  `GET /backtest` serves. **The check-in only fires when the script runs** -- nothing in this repo
  schedules it yet (no cron/launchd entry); Ben needs to add one (e.g. `0 3 * * *
  cd api && uv run python ../eval/backtest.py`) for "missed check-in" alerting to mean anything.
- **Sentry MCP as an agent tool** -- `ops.py::ask_ops()`, gated behind `ATLAS_SENTRY_MCP=1`
  (off by default). Spawns `npx @sentry/mcp-server@latest --access-token=$SENTRY_AUTH_TOKEN` over
  local stdio (no OAuth browser flow) and hands it to a one-off "ops" agent, exposed at
  `POST /ops/ask`. This is the intended "what broke in the last hour" tool; see the token-scope
  gap below for why it can't actually query anything today.

### Web (Next.js 16) -- `web/src/`

- `instrumentation.ts` (server+edge init via `register()`), `sentry.server.config.ts`,
  `sentry.edge.config.ts`, `instrumentation-client.ts` (browser init).
- Tracing (`tracesSampleRate: 1.0`), Logs (`enableLogs: true`).
- **Session Replay**, privacy masking on: `maskAllText: true`, `maskAllInputs: true`,
  `blockAllMedia: true`. `replaysSessionSampleRate: 0` (protects the free plan's 50/month quota),
  `replaysOnErrorSampleRate: 1.0` (records whenever an error fires). `replayCanvasIntegration()` is
  on too, so the MapLibre/deck.gl map screen shows up in a replay instead of a blank rectangle.
- **Feedback widget** -- `feedbackIntegration({ colorScheme: "system" })`: a floating "Report a
  Bug" button, site-wide.
- **Source maps** -- `next.config.ts`'s `withSentryConfig`, uploads at build time using
  `SENTRY_AUTH_TOKEN` (build-time only, never shipped to the browser bundle).
- **DSN gap**: `SENTRY_DSN_WEB` doesn't exist in `.env` (no third Sentry project was ever created
  for the web app). All three config files fall back to `SENTRY_DSN_APP`, so web events land in the
  app's Sentry project for now. **Ben: create a web project and set `SENTRY_DSN_WEB` in `.env` and
  `web/.env.local`'s `NEXT_PUBLIC_SENTRY_DSN`** to split them apart.
- Lives in `web/.env.local` (gitignored, not committed): `NEXT_PUBLIC_SENTRY_DSN`,
  `SENTRY_DSN_WEB`, `SENTRY_DSN_APP`, `SENTRY_ORG`, `SENTRY_AUTH_TOKEN`.

### Expo app -- `app/`

- `app/app/_layout.tsx`: `Sentry.init()` (DSN, `tracesSampleRate: 1.0`, `enableLogs: true`) plus
  `export default Sentry.wrap(RootLayout)`.
- `app.json`'s `@sentry/react-native/expo` plugin, configured with org/project for source-map
  upload on a native/EAS build.
- DSN in `app/.env.local` (gitignored): `EXPO_PUBLIC_SENTRY_DSN` = `SENTRY_DSN_APP`.
- **Expo Go limit**: this demo runs in Expo Go, which is a fixed prebuilt binary with no custom
  native modules. JS errors and tracing work fine in Expo Go. Native crash reporting and
  `mobileReplayIntegration()` (session replay) do **not** -- both need a compiled dev/EAS build, so
  neither is wired here. The config plugin's native init step is a no-op under Expo Go for the same
  reason; it only does anything on a real build.

## 2. Trace anatomy: one underwriting decision

Open Sentry -> Explore -> Traces, filter by `op:pixie.underwrite_case`, pick one. The root span
(`desk.py::Desk.run().one()`) carries, as span data:

| Attribute | Meaning |
|---|---|
| `pixie.case_id` | the submission id |
| `pixie.depth` | skim / standard / deep (the Lead's plan) |
| `pixie.model_lead`, `pixie.model_specialist` | model ids from `.env` |
| `pixie.decision` | the verdict (`decline`, `accept_with_subjectivity`, ...) |
| `pixie.interval_lo` / `pixie.interval_hi` | the final score interval |
| `pixie.model_calls`, `pixie.tokens_in`, `pixie.tokens_out`, `pixie.cost_usd` | rolled up over every agent turn in the case |
| `pixie.explanation_fallback` | set when the Lead's own explanation failed verify_numbers and the template was used instead |

Nested under it, `OpenAIAgentsIntegration` auto-adds one `gen_ai.invoke_agent` span per agent turn
(lead/intake/hazard/portfolio/appetite, including every ask/answer round) and one
`gen_ai.execute_tool` span per tool call (Federato query, `estimate_premium`, `use_layer`,
`concentration`, `assess_case`, ...), each carrying `gen_ai.request.model`,
`gen_ai.usage.input_tokens`/`output_tokens`, and Sentry's derived `gen_ai.usage.total_cost`. A judge
opens one trace and sees the whole decision: every agent, every tool call, every token, real dollar
cost, top to bottom.

## 3. Alert rules and monitors: what actually got created

Updated 2026-09-19 23:55, after Ben issued a user token with `org:read`, `project:read`,
`project:write` and `alerts:write`. Everything in this section now exists in the org.

**A stale DSN was the real problem.** `SENTRY_DSN_API` pointed at project `4512115040845824`,
which is not a project in this org (`atlas-api` is `4512115041370112`). Every API trace, log and
error had been going nowhere. `.env` now carries the DSN read back from
`GET /projects/benzhou/atlas-api/keys/`, and one desk run put **53 transactions** into `atlas-api`,
which is the first data that project has ever received.

- **verify_numbers alert rule: created** (workflow `6034549`, "Pixie: an agent stated a number the
  engine did not compute"). Sentry retired the per-project `/rules/` API, which now answers
  `410 This API no longer exists`. Issue alerts live in the workflow engine instead:
  `POST /organizations/{org}/workflows/` with a trigger (`first_seen_event`, `regression_event`),
  an action filter on the tag `pixie.alert=verify_numbers`, and an email action.
  `scripts/sentry_setup.py` was rewritten to use it and is idempotent by workflow name.
- **Uptime monitor: created** (`10388850`), checking the tunnel's `/health` every 300 s with a
  10 s timeout in the `hackathon` environment. `POST /projects/{org}/{project}/uptime/`; do not
  send `mode`, only superusers may set it. The script skips this when no `PUBLIC_URL` is set.
- **If the tunnel restarts**, the monitor points at a dead URL. Delete it or re-run the script
  after updating `PUBLIC_URL`.
- **Cron monitor on the nightly backtest**: this one doesn't need the API at all. Sentry
  auto-creates a monitor from its first check-in. Running `eval/backtest.py` once (confirmed
  locally -- it sent an in-progress check-in, then an error check-in when it hit an unrelated
  missing-cache-fixture crash) is enough to register `pixie-backtest` in the dashboard. That crash
  (`cache/layers/fema_flood/1.json` missing, `eval/backtest.py` via `packs/us/layers.py`) is real
  and pre-existing in this worktree -- also the cause of `test_backtest.py`'s two pre-existing
  failures -- but it's a local fixture gap, not something this run changed, so it isn't in
  `INCIDENTS.md` (that log is for incidents that changed the build). It should be visible at
  `https://benzhou.sentry.io/issues/?query=fema_flood` once a scoped token exists to confirm it
  landed.
- **Fix**: Ben creates a new org auth token (or project auth token) with
  `org:read, project:read, project:write, alerts:write` and re-runs
  `cd api && uv run python ../scripts/sentry_setup.py`.

## 4. Five truthful booth sentences

1. "Every underwriting decision Pixie makes is one Sentry trace: five agents, every tool call,
   every token, and the dollar cost, from the first Federato query to the final explanation." --
   true today: `desk.py::Desk.run().one()`'s root span plus `OpenAIAgentsIntegration`'s automatic
   child spans (Trace anatomy, above).
2. "We don't just alert when the process crashes -- we alert when an agent's own words don't match
   the numbers our engine computed." -- true today in code:
   `telemetry.py::verify_numbers_alert()`, wired from every `checked()` call site in `desk.py`.
   True end-to-end since 2026-09-19: the alert workflow that turns that tagged error into an email
   exists (section 3), so the sentence to say is "the guard fires, the event lands, and the
   workflow emails us."
3. "We use four distinct Sentry products beyond error monitoring on the API alone: AI Agent
   Monitoring, Tracing, structured Logs, and a cron monitor on our nightly precompute job." -- true:
   `app.py::_init_sentry()` (AI monitoring + tracing), `telemetry.py::log()` (Logs),
   `eval/backtest.py::_write_backtest_monitored()` (crons).
4. "Sentry covers all three surfaces we shipped: the FastAPI underwriting desk, the Next.js
   case-review app (with Session Replay and a feedback widget), and the Expo consumer quote app." --
   true: `api/src/atlas_api/app.py`, `web/src/instrumentation-client.ts`,
   `app/app/_layout.tsx`.
5. "Pixie's own agent can query Sentry as a tool, so it can eventually answer 'what broke in the
   last hour' itself instead of a human opening a dashboard." -- true in code
   (`ops.py::ask_ops()`, `POST /ops/ask`, gated behind `ATLAS_SENTRY_MCP=1`); **honest caveat**: the
   current token now carries `org:read` and `project:read`, so the tool can read issues; it has not
   been exercised end to end, so say "the wiring is real" and show the code, not a live answer.

## 5. Gaps, in one place

- `docs/research/sentry.md` contains the research used for this implementation.
- `SENTRY_DSN_WEB` doesn't exist; web reuses `SENTRY_DSN_APP` (section 1).
- `/ops/ask` has never been run against the live Sentry MCP server, though the token now has the
  scopes for it.
- Continuous profiling (research item 6) and the issue-fingerprint rule for Federato errors
  (research item 12) were both judged lower-leverage than the rest of the plan for the time
  available and were skipped, not attempted.
