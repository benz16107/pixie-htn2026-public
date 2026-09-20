# Handoff

Updated 2026-09-20 after the Intact consumer-lifecycle implementation.

## Current product

Pixie has two separate front ends over one inspectable risk engine:

- Federato is the commercial underwriter desk. Its five-minute path is the unresolved queue row, case 138, then the 3D portfolio or validation as supporting proof.
- Intact is the consumer product. Its web page presents Quote, Decide, Protect, and Recover. Its Expo app performs the Home and Auto tasks.

The top-left product switch changes the full web experience. Inside Intact, a second route switch selects Home or Auto. Home pricing currently means tenant insurance. Auto rates and listings are synthetic demonstration inputs.

## Intact implementation

The web entry at `/intact` is a focused lifecycle presentation. Use it as the pitch and open the working proof only for the active stage.

The Expo app has four persistent tabs:

- Quote runs the Toronto tenant path or compares a Corolla, CX-5, and IONIQ 5 under one Auto scenario.
- Decide changes one confirmed input at a time.
- Protect records a room inventory or opens driving context.
- Recover prepares a reviewed recovery plan that the customer can save or share locally.

Driving context calls `POST /driving/context`. It separates behavior, synthetic route context, and a documented coaching composite. It accepts coarse points, stores no coordinates, returns none, and cannot change a quote or premium.

The iOS development build includes a widget and Live Activity through expo-widgets. Expo UI supplies SwiftUI and Jetpack Compose controls. Expo Go and web show a labelled foreground fallback.

## MCP server

The server under `mcp/` imports the same deterministic consumer functions as FastAPI. It exposes estimate, comparison, scenario, draft, limited policy, driving-context, and recovery tools. It has no full-profile tool. Draft and recovery tools require consent and remain unsent demonstrations.

Run it over standard input/output:

```bash
cd mcp && uv run pixie-mcp
```

See [mcp/README.md](mcp/README.md) for Streamable HTTP and tool boundaries.

## Start and verify

Run `./start.sh` from this repository. It starts the API on 8000, the web production build on 3100, and Expo on 8081. Use a reachable `EXPO_PUBLIC_API_URL` for a physical phone.

Verification commands:

```bash
cd api && SENTRY_DSN_API= uv run pytest -q
cd mcp && uv run pytest -q
cd web && npm run build
cd app && npx tsc --noEmit
cd app && npx expo config --type public
```

Use [docs/RUNBOOK.md](docs/RUNBOOK.md) for recovery steps and [DEMO/README.md](DEMO/README.md) for the pitch.

## Important code

| File | Responsibility |
| --- | --- |
| `api/src/atlas_api/case.py` | Facts, provenance, missing values, and data defects |
| `api/src/atlas_api/engine.py` | Bands, intervals, caps, thresholds, and explanations |
| `api/src/atlas_api/consumer.py` | Tenant adapter, Auto estimates, comparisons, drafts, and recovery |
| `api/src/atlas_api/driving.py` | Stateless behavior and synthetic route-context coaching |
| `api/src/atlas_api/tenant.py` | Toronto renter quote and itemized receipt |
| `api/src/atlas_api/desk.py` | Six agent roles, replay, budget, and number verification |
| `api/src/atlas_api/portfolio.py` | Concentration calculations |
| `mcp/src/pixie_mcp/server.py` | Privacy-limited consumer MCP tools |
| `web/src/components/intact/LifecycleStory.tsx` | Intact web presentation |
| `app/app/(lifecycle)/` | Expo Quote, Decide, Protect, Recover tabs |
| `app/app/driving-context.tsx` | Drive coaching, location action, and native glance surfaces |
| `app/lib/driving-surfaces.ios.tsx` | iOS widget and Live Activity |

## Invariants to preserve

- Do not hard-code the 45 and 70 commercial thresholds. Read the active guideline.
- Replay must remain visibly labelled and must not call a model.
- A hypothetical what-if value must never overwrite a confirmed fact.
- A human override requires a reason, stays within five points, and does not rewrite the engine result.
- Home pricing supports tenant insurance only.
- Every consumer price remains labelled as illustrative and not an Intact quote or offer.
- Driving context remains coaching-only, stores no route, and cannot affect pricing.
- Recovery evidence does not determine fault or enter pricing.
- Demo reset must undo stored human changes and guideline edits.
- `cache/layers`, `var`, and `data/federato` are machine-local or gitignored.

## Active demo tracks

Federato, Intact, Rox, Sentry, Elastic, and Expo have dedicated stories. Federato and Intact are the two main product demos. Expo is the native implementation of Intact rather than a separate insurance product.
