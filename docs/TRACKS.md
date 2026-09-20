# Active tracks

This is the honest claim matrix for the current build. The booth scripts live in [DEMO/tracks](../DEMO/tracks).

| Track | What Pixie uses | Demonstration | Limit to state |
| --- | --- | --- | --- |
| Federato | Snapshot ingestion, schema-aware queries, provenance, and case hydration | Trace case 138 to its source fields, then show the one missing fact that could change the decision | A fresh clone needs credentials and the machine-local snapshot for live data |
| Intact | Connected Home and Auto experience over deterministic tenant, Auto, driving, MCP, and recovery services | Show the consumer app, connected insurer evidence review, and one sourced MCP request | Home pricing is tenant-only; Auto, route inputs and witness credits are illustrative; no displayed price is an Intact offer |
| Rox | Defect detection, missing-value handling, and guarded query repair | Show duplicate, stale, or inconsistent records before the desk decides | The project detects a defined set of defects rather than every possible data error |
| Sentry | API tracing, structured logs, model-output alerts, web instrumentation, and Expo JavaScript instrumentation | Open one underwriting trace and the alert path for an unsupported number | Some account-side monitors and alert rules still require provider setup |
| Elastic | Hybrid precedent retrieval, decline terms, portfolio concentration, and Toronto geo queries | Show similar cases and nearby exposure with the backend badge visible | The UI can fall back to memory; do not call that Elastic |
| Expo | Router, Location, Expo UI, widgets, Live Activity, map, haptics, PDF, share, speech, and referral handoff | Run the Auto comparison and Drive Score sample, or the complete tenant estimate | Native UI and widget extensions require a development build; Expo Go shows the shared foreground flow and native-surface previews |

Removed tracks are absent from the current navigation and judging guide.
