# Devpost media kit

This folder contains the upload-ready images for Pixie's Hack the North submission. The project thumbnail and all 15 gallery images are PNG files below 5 MB. Every upload-ready image uses Devpost's recommended 3:2 ratio.

## Upload order

### Project thumbnail

Upload `gallery/00-thumbnail-3x2.png` in **Project Overview**. It is 1350 by 900 pixels, which matches Devpost's recommended 3:2 ratio.

Caption: Pixie connects quoting, decisions, prevention, recovery, deterministic insurance services, and an AI-facing MCP layer.

### Try it out links

Add these three links under Devpost's **Try it out** field:

| Label | URL |
| --- | --- |
| Pixie underwriting website | `https://pixie-underwriting.vercel.app` |
| Pixie Expo app | `https://pixie.expo.app` |
| Source code | `https://github.com/benz16107/pixie-htn2026-public` |

The public website uses its labelled bundled-sample mode. The Expo deployment uses bundled synthetic examples and does not contain API or provider credentials.

### Built with tags

Add these 25 tags individually in Devpost's **Built with** field:

```text
Federato
Expo
React Native
Expo Router
Expo Widgets
Expo Location
JavaScript
React
Next.js
TypeScript
Python
FastAPI
OpenAI API
OpenAI Agents SDK
Model Context Protocol
Elasticsearch
Elastic Agent Builder
Sentry
Jina AI
H3
MapLibre GL JS
deck.gl
Tailwind CSS
SwiftUI
Jetpack Compose
```

Intact and Rox are prize tracks rather than software dependencies, so they do not appear as "Built with" tags.

### Image gallery

Upload all 15 files below in order under **Project Details > Image Gallery**. The project thumbnail is a separate field and does not use one of these 15 gallery slots.

| Order | File | Caption |
| ---: | --- | --- |
| 1 | `gallery/01-federato-queue.png` | Pixie ranks the 38 property submissions covered by the supplied guideline and keeps the unresolved case beside the queue. |
| 2 | `gallery/02-federato-rulebook.png` | The rulebook exposes Federato's supplied criteria alongside Pixie's score equation, thresholds, and hard-failure cap. |
| 3 | `gallery/03-federato-case.png` | Case 138 keeps its score range, challenger finding, and non-destructive premium what-if in one review. |
| 4 | `gallery/04-federato-portfolio.png` | The portfolio view adds geographic concentration and external hazard context while keeping the source and units visible. |
| 5 | `gallery/05-federato-agent-activity.png` | Agent activity records each specialist, model call, timing result, and final underwriting decision. |
| 6 | `gallery/06-federato-validation.png` | The validation page reports the historical backtest, aggregate outcomes, and the known miss instead of hiding it. |
| 7 | `gallery/07-intact-live-mcp.png` | A live MCP request selects a narrow insurance tool, validates its arguments, and returns a deterministic estimate with receipt sources. |
| 8 | `gallery/08-rox-data-quality.png` | Pixie detects that two brokers submitted the same insured and keeps the conflict beside the underwriting decision. |
| 9 | `gallery/09-rox-checked-query.png` | The Ask agent turns a plain-language question into a checked Federato query and records every validation or recovery attempt. |
| 10 | `gallery/10-rox-agent-challenge.png` | The challenger tests the recommendation against case evidence and computed sensitivity results without changing the source records. |
| 11 | `gallery/11-sentry-guardrail.png` | Live Sentry API data shows the semantic guardrail rejecting a model-written number absent from the computed facts. |
| 12 | `gallery/12-elastic-live-proof.png` | Live Elastic APIs confirm five indices and three registered Agent Builder tools used by Pixie. |
| 13 | `gallery/13-elastic-comparables.png` | Elastic hybrid retrieval returns comparable risks with their indexed outcomes and backend label visible. |
| 14 | `gallery/14-expo-home-journey.png` | The Expo Home journey connects tenant entry, a local belongings inventory, and a coverage choice with visible pricing boundaries. |
| 15 | `gallery/15-expo-auto-journey.png` | The Expo Auto journey connects the monthly car budget, coverage comparison, Drive Score, and native-surface previews. |

The Sentry and Elastic proof sheets come from authenticated live API responses. Both images state that they are not screenshots of the providers' dashboards.

### Demo video

`video/01-live-mcp-request.mp4` and `video/01-live-mcp-request.webm` are 16-second silent captures of a live MCP request. The MP4 is the easier upload source. Devpost does not accept a local video file in the video field. Upload the final narrated demo to YouTube or Vimeo, allow public or unlisted playback and embedding, then paste its share URL into **Video demo link**.

The upload-only archive [`pixie-devpost-upload.zip`](../pixie-devpost-upload.zip) contains this guide, the separate thumbnail, and exactly 15 gallery images. Extract it before uploading. Devpost expects the individual PNG files, not the ZIP itself.

The larger [`pixie-devpost-media.zip`](../pixie-devpost-media.zip) is the source archive. It also contains unused captures and the video files, so do not treat every image in that archive as an additional gallery upload.

## Source files by track

These files preserve the original captures. Do not upload them in addition to the 15 gallery files. The final gallery already selects and reframes the strongest evidence from this source set.

### Federato

| Code | File | Shows |
| --- | --- | --- |
| F1 | `federato/01-submission-queue.png` | Ranked property queue and the unresolved case |
| F2 | `federato/02-rulebook.png` | Supplied appetite criteria, score equation, thresholds, and hard-failure cap |
| F3 | `federato/03-case-what-if.png` | Case 138 score range, challenger, and premium what-if |
| F4 | `federato/04-portfolio-map.png` | Geographic and portfolio context with the source and units visible |
| F5 | `federato/05-agent-activity.png` | Recorded agent activity, model calls, timing, and final decision |
| F6 | `federato/06-validation.png` | Historical backtest, known miss, and aggregate outcome data |

### Intact

| Code | File | Shows |
| --- | --- | --- |
| I1 | `intact/slide-1.png` | The Home and Auto customer app |
| I2 | `intact/slide-2.png` | Belongings inventory and customer-entered replacement values |
| I3 | `intact/slide-3.png` | Tenant price explorer and visible estimate boundary |
| I4 | `intact/slide-4.png` | Vehicle payment and illustrative insurance comparison |
| I5 | `intact/slide-5.png` | Drive Score, widget preview, and Live Activity preview |
| I6 | `intact/slide-6.png` | Recovery journey |
| I7 | `intact/slide-7.png` | Connected driver and witness evidence flow |
| I8 | `intact/slide-8.png` | Product boundaries and disclosures |
| I9 | `intact/09-live-mcp-agent.png` | Live MCP tool, arguments, deterministic estimate, and receipt sources |

### Rox

| Code | File | Shows |
| --- | --- | --- |
| R1 | `rox/01-duplicate-account.png` | Cross-record duplicate-account issue for cases 126 and 141 |
| R2 | `rox/02-checked-query.png` | Plain-language question, checked Federato query, attempts, and returned rows |
| R3 | `rox/03-challenger.png` | Agent challenge grounded in case evidence and sensitivity results |

### Sentry

| Code | File | Shows |
| --- | --- | --- |
| S1 | `sentry/01-number-guardrail.png` | Authenticated Sentry issue data, rejected sentence, computed fact, trace ID, and event count |

### Elastic

| Code | File | Shows |
| --- | --- | --- |
| E1 | `elastic/01-live-indices-and-tools.png` | Live document counts and registered Agent Builder tools |
| E2 | `elastic/02-comparable-risks.png` | Elastic-backed comparable-risk retrieval and real indexed outcomes |
| E3 | `elastic/03-portfolio-map.png` | Portfolio and geographic risk context |

### Expo

| Code | File | Shows |
| --- | --- | --- |
| X1 | `expo/home.png` | Home navigation and tenant-estimate entry point |
| X2 | `expo/auto.png` | Auto navigation and customer tasks |
| X3 | `expo/inventory.png` | Image Picker and local inventory flow |
| X4 | `expo/coverage.png` | Coverage choices and tenant estimate |
| X5 | `expo/car-budget.png` | Combined vehicle and illustrative insurance budget |
| X6 | `expo/drive.png` | Foreground Drive Score and native-surface previews |
| X7 | `expo/safety.png` | Prevention and safety flow |
| X8 | `expo/help.png` | Recovery and customer-controlled sharing |

The Expo screenshots are phone-sized captures of the shared Expo product flow. `X6` contains in-app previews of the iOS widget and Live Activity. Do not describe those previews as signed-device proof.

## Regenerate provider proof

Run this while the API and web desk are available on their documented local ports:

```bash
node scripts/capture_devpost_media.cjs
```

The command refreshes the Rox and Elastic product captures and queries the authenticated Sentry and Elastic APIs for the two provider proof sheets. It never prints provider credentials into an image.
