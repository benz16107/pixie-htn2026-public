# Architecture

```mermaid
flowchart LR
  FD[Federato data] --> F[Facts with provenance]
  TD[Toronto data] --> F
  SV[Synthetic vehicle and route fixtures] --> F
  F --> E[Deterministic risk engine]
  E --> W[Federato web desk]
  E --> I[Intact lifecycle web]
  E --> X[Expo consumer app]
  E --> M[Privacy-limited MCP tools]
  X --> R[Pixie first-party recovery]
  E --> A[Agent desk]
  A --> O[Agent runtime]
  E --> ES[Elastic precedent and concentration]
  A --> S[Sentry traces and logs]
```

## One engine, two products

engine.assess() evaluates commercial cases and the tenant quote uses the same provenance rules with its own pricing service. Commercial rules live in rules/property_2025.yaml. Tenant pricing and Toronto context live in the Toronto pack. Auto and driving-context demo inputs live in versioned JSON fixtures. Models do not calculate a score or price.

The Federato web product is an underwriter workbench. It shows the queue, score interval, source trail, interactive calculation, sensitivity, precedent, portfolio impact, agent events, guideline changes and bounded overrides. Case panels can be rearranged, hidden or focused. The rulebook and case share the expandable equation interface. The P shortcut opens a modal presentation while leaving the current demo page mounted.

The Intact web product maps Quote, Decide, Protect, and Recover to their services and working proof. The Expo app is the consumer product and uses Home, Compare, Insights, and Community navigation. Home routes to the tenant estimate, inventory, and prevention flows. Auto routes to vehicle comparison, scenario testing, prevention records, Drive Score, and recovery.

## Consumer service boundary

- POST /quote/home exposes the tenant engine under the Home experience. It rejects homeowner products because no homeowner tariff exists.
- POST /quote/auto and POST /consumer/vehicles/compare use bundled synthetic vehicles and deterministic integer-cent arithmetic.
- POST /quote/scenario combines independently computed tenant and Auto totals without inventing a bundle discount.
- POST /driving/context accepts coarse route points and aggregate driving events. It returns behavior, route-context, and composite coaching scores with provenance. It stores no coordinates and cannot affect a quote or premium.
- Application and recovery routes require consent and a demo confirmation. They prepare unsent records.

## Incident evidence and community credits

The Expo app and `/intact/insurer` use `shared/evidence.ts` to call the same `/consumer/incidents` API. It stores uploaded bytes, hashes, declared metadata, review notes and status in `var/evidence.sqlite`, separate from the commercial case store. The web API proxy supports media playback and evidence-package exports.

Accepted witness contributions generate simulated credits. The phone allocates one shared balance between Home and Auto for a one-time payment preview. Neither the original premium nor Drive Score changes. Device-local identity is not verified production authentication; a file hash does not establish authenticity or fault. See [ROAD-HELP.md](ROAD-HELP.md).

## Native Expo surfaces

- Expo Router owns the Home, Compare, Insights, and Community navigation plus supporting screens.
- @expo/ui supplies native SwiftUI and Jetpack Compose controls in development builds.
- expo-widgets supplies the iOS drive-context widget and Live Activity.
- Expo Go and web use a labelled foreground fallback because native extensions cannot load there.
- The quote and Drive Score flows request location only after an explicit action. Drive Score uses foreground GPS speed and derives aggregate speeding and hard-brake events.

## MCP boundary

- The MCP server imports the same consumer functions as FastAPI.
- It exposes narrow tools for estimates, vehicle comparison, what-if scenarios, application drafts, policy summaries, driving context, and recovery.
- There is no full-profile tool. Policy summaries omit identity, address, contact values, driver licence, and VIN.
- Models call tools and explain their structured results. They do not set prices.

## Decision boundary

- Code owns commercial scores, intervals, thresholds, receipt arithmetic, scenario totals, and driving-context formulas.
- Models choose investigations, return typed judgments, and write explanations.
- Known, Estimated, and Missing values preserve provenance. A missing input evaluates across every applicable band instead of silently becoming zero.
- Recovery evidence does not decide fault and never enters pricing.

## Runtime

- FastAPI serves both products on port 8000. SQLite stores commercial cases and events; a separate SQLite database stores incidents and uploads. Provider caches live under `cache/`.
- Next.js serves the Federato desk, integrated slides and Intact insurer workspace on port 3100.
- Expo serves the consumer app on port 8081.
- The MCP server uses standard input/output by default and can use Streamable HTTP on port 8010.
- Elastic has an in-memory fallback with the same response shape. Replay reconstructs an agent run from recorded events and makes no model call.

The full API loads the commercial snapshot at startup. See [DATA.md](DATA.md) for machine-local dependencies and the difference between committed sample files and recorded replay events.
