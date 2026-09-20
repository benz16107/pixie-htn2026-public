# Sentry for Pixie: capability research and integration plan

Scope: every Sentry capability worth using for Pixie (FastAPI + OpenAI Agents SDK backend, Next.js 16 web, Expo RN app), what each would show for our specific product, minimal code, and cost/risk. Everything below has a source URL. Claims I could not verify against a primary Sentry source are marked **unverified**.

Repo facts checked directly (not from docs):

- No Sentry SDK is installed anywhere yet: `grep -i sentry` on `web/package.json` and `app/package.json` returns nothing, and there's no `sentry-sdk` in the API's dependency files.
- `.env` has `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_DSN_API`, `SENTRY_DSN_APP`. `.env.example` has `SENTRY_DSN_API`, `SENTRY_DSN_WEB`, `SENTRY_DSN_APP` — note the mismatch: the real `.env` has `SENTRY_ORG` where the example has `SENTRY_DSN_WEB`. **The web app currently has no DSN in `.env`.** Someone needs to create a third Sentry project (web) and add `SENTRY_DSN_WEB`, or the Next.js app will have no error/trace ingestion.
- `api/src/atlas_api/desk.py` is the multi-agent underwriting desk: five `agents.Agent` instances (`agents.Runner.run`) — lead, intake, hazard, portfolio, appetite — each posting `DeskEvent`s to a per-case SQLite event log, with a `_Hooks` class that already mirrors every SDK tool call into a `tool_call` event, and a `verify_numbers` check (in `engine.py`) that every model sentence gets checked against tool-returned strings before it's allowed into the decision explanation. This is the natural place for AI Agent Monitoring and the "verify_numbers alert" idea below.
- `app.py` is the FastAPI shell (`uvicorn atlas_api.app:app`), SSE endpoints live in `events.py`/`ask.py`.
- Web app: Next.js 16, App Router (`web/src/app/{queue,cases,map,live,ask,backtest}`), no `instrumentation.ts` yet.
- Expo app: Expo SDK 57, Expo Router, no Sentry wizard run yet.

---

## 1. AI Agent Monitoring / LLM observability (OpenAI Agents SDK)

**What it is.** Sentry auto-instruments the OpenAI Agents SDK (and 15+ other agent/LLM frameworks) to emit two span types per agent run: `gen_ai.invoke_agent` (one per agent, nested for handoffs) and `gen_ai.execute_tool` (one per tool call), plus `gen_ai.generate_text`/`chat` spans for raw model calls. Spans carry `gen_ai.agent.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`/`output_tokens`, and (if `send_default_pii=True`) the actual input/output messages and tool arguments/results. Sentry derives a dollar cost per span (`gen_ai.usage.total_cost`) from `gen_ai.request.model` + token counts, priced against models.dev/OpenRouter's cached pricing tables — no manual cost math needed.
Sources: [OpenAI Agents integration](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/agent-tracing/openai-agents/index.mdx), [manual instrumentation](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/agent-tracing/manual-instrumentation.mdx), [AI agent tracing product page](https://sentry.io/product/tracing/ai-agent/), [cost tracking](https://docs.sentry.io/ai/monitoring/agents/costs) (via search snippet, not directly fetched — **partially unverified**, verify the exact attribute name at that URL before the talk).

**For Pixie.** One trace per `Desk.run()` call over a batch of cases becomes a nested tree: lead agent span → intake/hazard/portfolio/appetite spans (their asks/answers as child spans) → each `function_tool` call (Federato query, `estimate_premium`, layer reads) as an `execute_tool` span with real args/results. A judge opens Trace Explorer, clicks one trace, and sees the entire underwriting decision — five agents, every tool call, every token, real dollar cost — as one page. This is the single highest-leverage integration for the "beyond error monitoring" judging bar.

**Minimal code.** The `agents` SDK is already imported in `desk.py`. Two lines get automatic instrumentation:
```python
import sentry_sdk
sentry_sdk.init(dsn=os.environ["SENTRY_DSN_API"], traces_sample_rate=1.0, send_default_pii=True)
```
No changes to `Runner.run()` calls needed — the integration patches `agents` automatically. For richer per-case grouping, wrap `Desk.run()` in a custom root span (`sentry_sdk.start_span(op="pixie.underwrite_case", name=f"case {case_id}")`) so all five agents for one case nest under one trace instead of one per `Runner.run`.

**Cost/risk.** Free Developer plan: 5M spans/month (five agents × several tool calls each × N cases in a demo easily fits). `send_default_pii=True` sends full LLM prompts/completions and tool payloads to Sentry — for a demo with synthetic insurance cases this is fine, but it means real applicant PII (if any real data slips into fixtures) would leave the process. Turn it off (`send_default_pii=False`) for anything beyond fixture data; you lose message bodies but keep spans, timings, tokens, and cost.

---

## 2. Tracing and Trace Explorer

**What it is.** Standard distributed tracing (root transaction + child spans across service boundaries) plus a 2026 query engine ("Trace Explorer") that lets you filter/aggregate on any span attribute (duration, custom tags, `gen_ai.*` fields), see attribute breakdowns, and (new Feb 2026, beta) do cross-event querying — find spans based on their relationship to other events in the same trace.
Sources: [Trace Explorer announcement](https://blog.sentry.io/announcing-trace-explorer-and-span-metrics/), [Trace Explorer With Span Metrics](https://docs.sentry.io/product/explore/trace-explorer/), [Querying Traces](https://docs.sentry.io/guides/querying-traces/).

**For Pixie.** With `traces_sample_rate=1.0` on the API and a `sentry.link`/trace-header propagated from the Next.js frontend's fetch calls, one trace can span: browser click → Next.js API route → FastAPI `/queue` or `/cases/{id}` → SQLite read → (on `/ask`) the agent run. Sentry's default `@sentry/nextjs` and `sentry-sdk` instrumentation propagate `sentry-trace`/`baggage` headers automatically over `fetch`, so this is close to free once both SDKs are initialized.

**Minimal code.** `traces_sample_rate=1.0` in both `sentry_sdk.init()` (Python) and `Sentry.init()` (Next.js, via `instrumentation-client.ts` + `instrumentation.ts` for server). Automatic HTTP client instrumentation on both sides does the propagation.

**Cost/risk.** Shares the 5M spans/month free-plan budget with AI monitoring; a live demo screen polling SSE could burn through spans fast if every SSE reconnect/poll is traced — consider a lower `traces_sample_rate` (e.g. 0.5) or excluding the SSE stream endpoint from tracing via `traces_sampler`.

---

## 3. Logs (structured logging)

**What it is.** `sentry_sdk.integrations.logging.LoggingIntegration(capture_sentry_logs=True)` ships Python `logging` records to Sentry as structured, searchable Logs (separate product surface, correlated to the active trace/span). JS/RN SDKs have `enableLogs: true` + `Sentry.logger.info/warn/error(...)`. Logs support arbitrary attributes and can back both dashboard widgets and alerts.
Sources: [LoggingIntegration setup](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/integrations/logging/index.mdx), [Logs product docs](https://docs.sentry.io/product/logs/), [Alerts on logs](https://docs.sentry.io/product/monitors-and-alerts/alerts/).

**For Pixie.** Every `DeskEvent` the desk already posts (asks, answers, conflicts, resolutions) is a natural log line: `sentry_sdk.logger.info("ask", agent=..., case_id=..., addressed_to=...)`. Because Logs correlate to the active span, a judge browsing a trace can jump straight to the log lines emitted during that specific agent turn — the closest thing Sentry has to "replaying the desk's reasoning" without you building a custom viewer.

**Minimal code.**
```python
integrations=[LoggingIntegration(capture_sentry_logs=True, sentry_logs_level=logging.INFO)]
```
Then normal `logging.getLogger(__name__).info(...)` calls (or the standalone `sentry_sdk.logger.*` API) show up as Sentry Logs.

**Cost/risk.** Free plan: 5GB logs/month, generous for a hackathon. Structured logging is the cheapest, lowest-latency of all these features (async network I/O, no sampling decision needed) so it's a safe default to turn on everywhere.

---

## 4. Session Replay (web)

**What it is.** `Sentry.replayIntegration()` (already bundled correctly in `@sentry/nextjs`) records a DOM-based (rrweb-style) video-like replay of a user session, with `maskAllText`/`blockAllMedia`/`maskAllInputs` privacy defaults (masking on by default). A separate `replayCanvasIntegration()` is required to capture `<canvas>` content (MapLibre/deck.gl render to canvas) — it snapshots the canvas as an image at 2 fps; for WebGL it needs `preserveDrawingBuffer` (perf cost) or manual `snapshot()` calls inside your render loop. **No PII scrubbing exists for canvas recordings** — masking rules don't reach inside canvas pixels.
Sources: [Replay setup, privacy options](https://github.com/getsentry/sentry-docs/blob/master/platform-includes/session-replay/setup/javascript.mdx), [Next.js replay integration](https://github.com/getsentry/sentry-docs/blob/master/platform-includes/session-replay/setup/javascript.nextjs.mdx), canvas/WebGL behavior via web search of `docs.sentry.io/platforms/javascript/.../replaycanvas` (**not directly fetched — verify exact fps/flag names before quoting them live**).

**For Pixie.** The map view (`web/src/app/map`) and the case swimlane pages are the two screens worth replaying. Enable `replayIntegration()` everywhere (DOM replay covers queue/case pages fully) and add `replayCanvasIntegration()` specifically if you want the MapLibre canvas itself to show up in replays — otherwise replays of the map screen will show a blank rectangle where the map is.

**Minimal code.**
```typescript
// instrumentation-client.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN_WEB,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration(), Sentry.replayCanvasIntegration()],
});
```

**Cost/risk.** Free plan: 50 replays/month total — this is the tightest free-tier limit of everything in this doc. For a demo, set `replaysSessionSampleRate: 0` and rely only on `replaysOnErrorSampleRate: 1.0` (record only sessions that hit an error) plus a manual `Sentry.getReplay()?.start()` triggered from a "record this for the judges" button on the live demo screen, so you don't burn the quota on idle traffic before demo time.

---

## 5. Session Replay (mobile, Expo/React Native)

**What it is.** `Sentry.mobileReplayIntegration()` in `@sentry/react-native`, same privacy-first defaults, works in Expo Go-built apps via the Sentry Expo config plugin.
Source: [React Native init snippet with replay](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/react-native/common/index.mdx).

**For Pixie.** Replay the Expo consumer-quote flow (address entry → quote screen) — useful to show a judge exactly what a consumer saw when a quote came back wrong or slow.

**Minimal code.** `npx @sentry/wizard@latest -i reactNative` scaffolds `app.config.js`'s `withSentry()` plugin plus the `Sentry.init()` call with `integrations: [Sentry.mobileReplayIntegration()]`, `replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0.1`.

**Cost/risk.** Mobile replays count against the same 50/month free-plan pool as web replays — budget accordingly if you demo both apps.

---

## 6. Profiling (continuous)

**What it is.** `profile_lifecycle="trace"` + `profile_session_sample_rate` auto-captures a CPU profile for the lifetime of any active span (no separate start/stop calls needed); `profile_lifecycle="manual"` gives explicit `start_profiler()`/`stop_profiler()` control.
Source: [Continuous profiling setup](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/profiling/index.mdx).

**For Pixie.** Least differentiated feature for us — Pixie's slow paths are LLM round-trips (already covered by AI spans), not CPU-bound Python. Worth turning on only if a judge asks "what if it's slow for a boring reason" — e.g. the H3-based portfolio concentration scan in `portfolio.py` over many cases, or SQLite contention in `case_store.py`.

**Minimal code.** Add `profile_session_sample_rate=1.0, profile_lifecycle="trace"` to the same `sentry_sdk.init()` call.

**Cost/risk.** Continuous profiling has its own quota tier on paid plans; check whether it's included on Developer free before enabling broadly — treat as optional/stretch given the size of this integration relative to its payoff.

---

## 7. Uptime monitoring

**What it is.** A synthetic HTTP checker: pick a URL, an interval (1 min-1 hr), and Sentry polls it, alerting on non-2xx/3xx or timeout (10s). Can also auto-detect a monitor from your most common error hostname.
Source: [Uptime Monitoring docs](https://docs.sentry.io/product/monitors-and-alerts/monitors/uptime-monitoring/).

**For Pixie.** Point it at the deployed FastAPI health endpoint (or `/queue`) and the deployed Next.js app. Free plan includes exactly 1 uptime monitor — pick the API, since if it's down the web app has nothing to show anyway.

**Minimal code.** Zero code — configured entirely in the Sentry dashboard (Project → Alerts → Uptime Monitors → add URL).

**Cost/risk.** Free: 1 monitor included, additional monitors ~$1/month each. Purely a dashboard config, five minutes of effort, no latency or PII implications.

---

## 8. Cron monitors

**What it is.** Check-in based scheduled-job monitoring: either a `@sentry_sdk.crons.monitor` decorator (crontab or interval schedule) or manual `capture_checkin()` calls at job start/end. Sentry flags missed check-ins (`checkin_margin`) and overruns (`max_runtime`).
Source: [Crons setup, decorator and manual check-in examples](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/python/crons/index.mdx).

**For Pixie.** Only useful if there's a real scheduled job — e.g. a nightly re-score of the portfolio index, or a periodic Federato sync. If Pixie has no cron job today, skip this; don't invent a fake job just to light up a Sentry feature (a judge who reads the code will notice).

**Minimal code.**
```python
monitor_config = {"schedule": {"type": "crontab", "value": "0 3 * * *"}, "checkin_margin": 10, "max_runtime": 10}

@monitor(monitor_slug="portfolio-rescore", monitor_config=monitor_config)
def rescore_portfolio(): ...
```

**Cost/risk.** Free: 1 cron monitor included. Zero latency cost (fire-and-forget HTTP check-in).

---

## 9. Release health and source maps

**What it is.** "Release health" tracks crash-free session/user rate and adoption per release (needs `Sentry.init({release, ...})` plus a session-tracking integration — `browserSessionIntegration()` on web, automatic on mobile). Source maps: `withSentryConfig()` in `next.config.ts` uploads source maps at build time (needs `SENTRY_AUTH_TOKEN` — already in `.env`) so minified Next.js stack traces resolve to real file/line.
Sources: [withSentryConfig source map upload](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/javascript/guides/nextjs/index.mdx), [browserSessionIntegration](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/javascript/common/configuration/integrations/browsersession.mdx), [Release Adoption](https://github.com/getsentry/sentry-docs/blob/master/docs/product/releases/health/index.mdx).

**For Pixie.** Source maps matter the moment anything throws in production Next.js — without them a judge (or you, mid-demo) sees `at t (chunk-4f2a.js:1:38291)` instead of the real component. Cheap, do it before demo day regardless of anything else in this doc.

**Minimal code.**
```typescript
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: "atlas-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
```

**Cost/risk.** `SENTRY_AUTH_TOKEN` is a sensitive org-level token — confirm it's only used at build time (CI/local build), never shipped to the browser bundle.

---

## 10. User feedback widget and crash-report modal

**What it is.** `feedbackIntegration()` renders an embeddable "Report a Bug" widget on web; `Sentry.showReportDialog()` pops a crash-report form tied to a specific error event ID; `Sentry.captureFeedback()` is the RN equivalent (name/email/message, optionally linked to an event).
Sources: [feedbackIntegration in Next.js manual setup](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/javascript/guides/nextjs/manual-setup/index.mdx), [showReportDialog options](https://github.com/getsentry/sentry-docs/blob/master/docs/platforms/rust/common/user-feedback/configuration/index.mdx) (options list is framework-generic across SDKs), [RN captureFeedback](https://github.com/getsentry/sentry-docs/blob/master/platform-includes/user-feedback/sdk-api-example/react-native.mdx).

**For Pixie.** Put the feedback widget on the case page — an underwriter reviewing a case swimlane can flag "this explanation looks wrong" directly, and it lands in Sentry linked to whatever error/trace was active. This doubles as a live demo bit: click "report issue" on a case, show the judge the feedback landing in Sentry next to the trace.

**Minimal code.** `Sentry.feedbackIntegration({ colorScheme: "system" })` in the integrations array — one line, renders a floating button.

**Cost/risk.** None beyond a small bundle-size add; feedback text is user-typed, so it's inherently opt-in PII (the user chooses what to type).

---

## 11. Custom spans, measurements, and dashboards/metric alerts

**What it is.** `sentry_sdk.start_span(op=..., name=..., attributes={...})` for any custom operation; `span.set_measurement()`/custom span attributes back both Trace Explorer queries and Dashboards (duplicate a dashboard to make it editable, add widgets from Errors/Traces/Logs/Replays/Metrics datasets). Metric alerts fire on error frequency, latency percentiles, crash-free rate, or any custom metric; log-based alerts and dashboard widgets work the same way over the Logs dataset.
Sources: [Custom sampling attributes](https://github.com/getsentry/sentry-docs/blob/master/platform-includes/performance/custom-sampling-context/python.mdx), [Dashboards](https://docs.sentry.io/product/dashboards/), [Alerts](https://docs.sentry.io/product/monitors-and-alerts/alerts/).

**For Pixie.** Custom spans around `assess()` (the rules engine in `engine.py`), `estimate_premium()`, and `verify_numbers()` — tag each with `case_id`, `depth` (skim/standard/deep), and (for `verify_numbers`) a boolean `verification_passed` attribute. A dashboard panel then plots "verify_numbers failure rate over time" directly from span attributes, no extra log line needed.

**Minimal code.**
```python
with sentry_sdk.start_span(op="pixie.verify_numbers", name="verify decision text") as span:
    ok, reason = verify_numbers(explanation_text, tool_outputs)
    span.set_data("verification_passed", ok)
    if not ok:
        span.set_status("internal_error")
        sentry_sdk.capture_message(f"verify_numbers failed: {reason}", level="warning")
```

**Cost/risk.** Free plan: 20 metric monitors included — plenty for a hackathon's worth of alerts. No added latency beyond the span itself (already async).

---

## 12. Issue grouping / fingerprinting

**What it is.** Default grouping fingerprints error events from stacktrace/exception/message. Custom fingerprint rules (per-project, in Issue Grouping settings, or via `before_send`) let you override or refine grouping — e.g. `{{ default }}` plus a custom key to split/merge issues that would otherwise collide. Error-issues only; doesn't apply to performance/replay issues.
Source: [Fingerprint rules](https://docs.sentry.io/concepts/data-management/event-grouping/fingerprint-rules/) (content pulled via search summary — **verify exact rule syntax at the URL before using it live**).

**For Pixie.** Without a custom rule, every Federato query failure (`FederatoError`, already parsed and retried per the `desk.py` docstring) might group into one giant issue regardless of which query/schema caused it. A fingerprint rule keyed on the query name would split those into per-query issues, which is the difference between "something's wrong with Federato" and "the `hazard.wildfire_zone` query is broken" in the issue list.

**Minimal code.** Project Settings → Issue Grouping → add a fingerprint rule (dashboard config), or in code: `event["fingerprint"] = ["federato-error", query_name]` inside a `before_send` hook.

**Cost/risk.** None; pure UX/triage improvement, zero latency or data cost.

---

## 13. Sentry MCP server (for Pixie's own agent to query Sentry)

**What it is.** A hosted remote MCP server at `https://mcp.sentry.dev/mcp` (OAuth) or local stdio (`npx @sentry/mcp-server@latest --access-token=...`, needs a user auth token with `org:read`/`project:read`/`event:write` scopes) that exposes Sentry data to any MCP-capable LLM client. Confirmed tools from the GitHub repo and docs: `list_projects`, `resolve_short_id`, `get_sentry_event`, `list_error_events_in_project`, `list_project_issues`, `list_issue_events`, `get_sentry_issue`, `list_organization_replays`, plus AI-powered natural-language tools `search_events` and `search_issues` (translate plain English into Sentry's query syntax), and a Seer-integration tool for autofix analysis (can be disabled with `--disable-skills=seer`). The full tool list isn't fully enumerated in any single doc I fetched — **treat this list as partial, confirm the live tool list by connecting once**.
Sources: [getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp), [mcp.sentry.dev listing](https://mcpservers.org/servers/getsentry/sentry-mcp-ts), [MCP monitoring / MCP servers product docs, mentions mcp.sentry.dev](https://github.com/getsentry/sentry-docs/blob/master/docs/product/mcp-servers/getting-started.mdx).

**For Pixie.** This is the most on-theme "beyond error monitoring" idea: give Pixie's own lead agent an MCP tool connection to `mcp.sentry.dev`, scoped read-only, so a question like "what broke last night" or "why did case 143 take so long" gets answered by the agent itself querying Sentry (via `search_issues`/`search_events`) instead of a human opening the dashboard. Since Pixie already runs on the OpenAI Agents SDK, this is adding one more MCP-backed tool to an existing agent, not new infrastructure. A distinct, separate capability from "MCP monitoring" (instrumenting your own MCP servers with Sentry, `MCPIntegration()` — not what's asked here, but worth knowing it exists so you don't conflate the two in the writeup).

**Minimal code.** The OpenAI Agents SDK supports MCP servers as tool sources natively (`agents.mcp.MCPServerStreamableHttp` or similar, exact class name should be checked against the installed `openai-agents` version); point one at `https://mcp.sentry.dev/mcp` with an org-scoped read-only token, add it to the `lead` agent's `mcp_servers=[...]`.

**Cost/risk.** A token with only `org:read`/`project:read` (no `event:write`) limits blast radius to read-only queries. Latency: an extra network hop per Sentry query, fine for an "ask the desk" side-channel, not for the hot underwriting path.

---

## 14. Seer / AI debugging (root cause, autofix, PRs)

**What it is.** Sentry's own AI agent (not something you write). On an issue, Seer runs root-cause analysis over trace-connected telemetry, proposes a fix, and can open a PR or hand off to a coding agent. As of January 2026 Sentry expanded Seer to local development and code review with a flat, unlimited-usage pricing tier (**per Sentry's own Jan 2026 announcement — verify current pricing at time of the talk, pricing terms change fast**). A vendor claim of "94% root-cause accuracy" appears in press coverage — **this is Sentry's own marketing claim, not independently verified, cite it as "Sentry claims" if used at all**.
Sources: [Sentry press release, Seer expansion Jan 2026](https://sentry.io/about/press-releases/sentry-expands-seer-ai-debugging-agent), [Seer cookbook](https://sentry.io/cookbook/seer-agent-use-cases/), [Automated debugging workflow blog](https://blog.sentry.io/automated-debugging-workflow-sentry/).

**For Pixie.** When any of the five agents throws (a malformed Federato query, a tool exception, an unhandled `verify_numbers` failure), Seer can read the trace, the tool call inputs/outputs, and the log lines around it, and propose a root cause without you writing any glue. This costs zero integration code beyond having tracing + logs already on (items 1 and 3), since Seer works off ingested telemetry.

**Minimal code.** None — it's a dashboard/Sentry-side feature once traces and errors are flowing. Optionally enable "Autofix" on a specific issue during the demo to show a live root-cause + PR proposal.

**Cost/risk.** Confirm current Seer pricing before promising it's "free" at the booth — the free Developer plan's pricing page lists Seer as "at additional cost" on every plan including Developer (confirmed at [sentry.io/pricing](https://sentry.io/pricing/)); the exact rate wasn't listed on that page and needs a follow-up check if you plan to actually demo Autofix rather than just describe it.

---

## Free-plan limits (confirmed directly from sentry.io/pricing)

Developer (free) plan: 5,000 errors/month, 5M spans/month, 50 replays/month, 5GB logs/month, 1 uptime monitor (additional ~$1/mo each), 1 cron monitor (additional ~$0.78/mo each), 1 user, 30-day data retention. Seer AI features are "at additional cost" on every plan, Developer included; exact Seer pricing wasn't listed on the pricing page itself. Source: [sentry.io/pricing](https://sentry.io/pricing/) (fetched directly, 2026-09-19).

---

## Ranked integration plan for Pixie

Ordered by (impact on judging) / (effort). "Judging impact" maps to the Sentry prize's two stated bars: showing **at least two products beyond error monitoring**, and showing **how observability shaped what you built**.

| # | Item | Effort | Judging impact | Where in the repo |
|---|---|---|---|---|
| 1 | `sentry_sdk.init()` in `app.py` with `traces_sample_rate=1.0`, `send_default_pii` gated by env, OpenAI Agents auto-instrumentation | 10 min | High — turns on AI Agent Monitoring + Tracing simultaneously, the two products judges will look for first | `api/src/atlas_api/app.py` (init at startup), reads `SENTRY_DSN_API` already in `.env` |
| 2 | Root span per `Desk.run()` case so all 5 agents nest under one trace | 15 min | High — this is the "one underwriting decision as one trace" demo moment | `api/src/atlas_api/desk.py`, wrap the top of `Desk.run()` |
| 3 | `Sentry.init()` in Next.js (`instrumentation.ts` + `instrumentation-client.ts`), `withSentryConfig` for source maps | 20 min | High — second product (errors+tracing+replay on web), required before any production error is debuggable at all | `web/next.config.ts`, new `web/src/instrumentation.ts` / `web/src/instrumentation-client.ts`; needs new `SENTRY_DSN_WEB` in `.env` (currently missing) |
| 4 | `LoggingIntegration(capture_sentry_logs=True)` over the desk's existing `DeskEvent` posts | 15 min | Medium-high — third product (Logs), and it's free telemetry from work the desk already does | `api/src/atlas_api/desk.py` / `events.py`, wherever `DeskEvent`s are constructed |
| 5 | Custom `verify_numbers` span + alert on failure | 20 min | High, unconventional — directly answers "how observability shaped what you built": an alert that fires when an LLM's stated numbers don't match the tools' numbers is a genuinely novel use, not a template integration | `api/src/atlas_api/engine.py` around `verify_numbers()`, alert rule in Sentry dashboard on the `pixie.verify_numbers` span or the warning-level message |
| 6 | Sentry MCP server wired as a tool on the `lead` agent, read-only token | 30-45 min | High, unconventional — "what broke last night" answered by Pixie's own agent is a strong, memorable booth demo and satisfies "beyond error monitoring" with almost no new infra | `api/src/atlas_api/desk.py`, add `mcp_servers=[...]` to the `lead` `Agent(...)` construction |
| 7 | Session Replay on web (error-triggered only, `replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0`) + `replayCanvasIntegration()` for the map | 15 min | Medium — fourth product, visually demoable (replay a case swimlane) but budget-constrained (50/month free) | `web/src/instrumentation-client.ts` |
| 8 | Feedback widget on the case page | 10 min | Medium — fifth product, cheap, gives you a live "report issue → lands in Sentry" demo beat | `web/src/app/cases/[id]/...` layout, add `feedbackIntegration()` |
| 9 | Fingerprint rule splitting Federato query errors by query name | 10 min | Medium, unconventional — shows deliberate tuning of a Sentry feature most teams never touch (issue grouping), not just "we added the SDK" | Sentry dashboard, Issue Grouping settings for the API project; optionally `before_send` in `app.py` |
| 10 | Uptime monitor on the deployed API + cron monitor if a scheduled job exists | 10 min | Medium — sixth/seventh product, near-zero effort, rounds out the "beyond error monitoring" list generously | Sentry dashboard only, no code |
| 11 | Expo app: wizard-installed RN SDK with `mobileReplayIntegration()` and `captureFeedback()` on the quote screen | 20 min (wizard) | Medium — shows Sentry across all three surfaces (API, web, mobile), which most competitors demoing a single web app won't have | `app/` (Expo project), `SENTRY_DSN_APP` already in `.env` |
| 12 | Dashboard with a "cost per underwriting decision" widget (sum of `gen_ai.usage.total_cost` grouped by case) and a metric alert if p95 latency for `pixie.invoke_agent` spans exceeds a threshold | 20 min | Medium — ties directly to "how observability shaped what you built": you can say the dashboard is what you'd watch to catch a cost regression from a model swap | Sentry dashboard, built from spans emitted in items 1-2 |

Total effort for all 12: roughly 3.5-4 hours, most of it before any demo polish — items 1-6 (the high-impact half) alone are under 2.5 hours and cover four distinct Sentry products (AI Monitoring, Tracing, Logs, MCP) plus one genuinely unconventional alert.

---

## What we will claim at the booth (5 truthful sentences, pending the integration actually being built)

1. Every underwriting decision Pixie makes is one Sentry trace: five agents, every tool call, every token, and the dollar cost, from the first Federato query to the final explanation.
2. We alert when an agent's written explanation doesn't match the numbers our own rules engine computed, using a custom Sentry span and alert, not just when the process crashes.
3. Pixie's lead agent can answer "what broke last night" itself, by querying Sentry's own MCP server as one of its tools, instead of a human opening a dashboard.
4. We use four distinct Sentry products beyond error monitoring: AI Agent Monitoring, Tracing, structured Logs, and a custom fingerprint rule that separates Federato query failures by query instead of lumping them into one issue.
5. Sentry covers all three surfaces we shipped: the FastAPI underwriting desk, the Next.js case-review app, and the Expo consumer quote app, from one shared org.

(Claim 5 requires finishing item 11; claim 3 requires item 6; claim 2 requires item 5. Don't say any of these at the booth until the corresponding code is actually merged and has fired at least once against real demo traffic.)
