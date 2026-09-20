# Integration boundaries

| Integration | Boundary in Pixie | Offline behavior |
| --- | --- | --- |
| Federato | `federato.py` loads schema-aware submission data into provenance-carrying case facts | Uses the stored snapshot and query cache |
| Agent runtime | `desk.py` gives typed tools to specialist agents and verifies numerical claims | Commercial replay uses recorded events without a model call |
| Elastic | `precedent.py`, `portfolio.py`, and Toronto lookups return provider-labelled results | Uses matching in-memory implementations |
| Sentry | `telemetry.py` and SDK setup record decisions, tools, logs, and guardrail failures | No DSN is a clean no-op |
| Expo | The mobile client calls the tenant quote and case APIs | Local fixtures keep the interface demonstrable but do not prove the API path |

Transport payloads stop at their owning modules. The engine receives domain objects, not provider response shapes. Provider failures return an unavailable or fallback state rather than invented data.
