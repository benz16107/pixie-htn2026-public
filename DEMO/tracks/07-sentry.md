# Sentry: five-minute demo

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md) · [Implementation notes](../../docs/SENTRY.md)

## The pitch

"Sentry records the whole underwriting decision and raises a semantic error when agent prose contains a number our tools never computed."

This is a short technical demo. Spend the time in one real trace and one real incident. The product UI is supporting context.

## What we use from Sentry

- Python tracing around each underwriting case.
- AI agent and tool spans, including model, token, timing, and cost fields when the SDK provides them.
- Structured logs for query rejection, conflicts, actions, and guardrail events.
- A custom `pixie.alert=verify_numbers` event for unsupported numerical claims.
- Uptime and cron-monitor setup documented with their current limits.
- Next.js and Expo JavaScript instrumentation. Browser replay needs the public web DSN, and Expo Go cannot prove native crash capture.

## Why it fits Pixie

An underwriter needs the result, while the team operating Pixie needs to know why a run was slow, expensive, or unsafe. Sentry connects the user-visible case to the agent and tool spans that produced it. The number guardrail turns a bad explanation into an observable failure instead of silent bad text.

## Five-minute flow

| Time | Show and say |
|---|---|
| 0:00-0:40 | Open `INCIDENTS.md`. Explain the real wrong-project DSN incident and the engineering change it caused. |
| 0:40-2:10 | Open one real `pixie.underwrite_case` trace. Follow the case span into agent and tool spans. Point only to fields visible in the trace. |
| 2:10-3:20 | Show `verify_numbers_alert` and a saved unsupported-number event. Explain that Pixie replaces the unsafe sentence with a deterministic fallback. |
| 3:20-4:20 | Show the uptime or workflow configuration that actually exists. Separate configured monitoring from proven notification delivery. |
| 4:20-5:00 | Return to the case. Close on being able to connect a bad user result to the exact model or tool span. |

## Know these details

The API initializes Sentry only when `SENTRY_DSN_API` is set. `telemetry.py` owns the custom attributes and alert event. The agent integration nests model and tool spans under Pixie's case span. The previous verification observed 53 ingested transactions after the DSN correction; that is one recorded observation, not a guaranteed count per run.

## Say this limitation

"A configured workflow is not proof that an email arrived. The repository emits monitor check-ins when the script runs, but it does not schedule a nightly job. Expo Go also does not prove native crash reporting or mobile replay."

## If it fails

Use the saved trace capture, the incident record, and `api/tests/test_telemetry.py`. Do not create a fake incident and do not call an instrumentation test a live Sentry event.
