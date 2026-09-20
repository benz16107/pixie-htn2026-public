# Pixie

Pixie is a Hack the North 2026 project with two products: a Federato underwriting desk and an Intact consumer insurance experience. They share deterministic calculation and evidence infrastructure, with separate rules for each product. The repository keeps the internal package name `atlas`.

## Try Pixie

- [Open the public underwriting website](https://pixie-underwriting.vercel.app)
- [Open the public Expo app](https://pixie.expo.app)
- [Browse the public source snapshot](https://github.com/benz16107/pixie-htn2026-public)

The public deployments use bundled synthetic examples and do not contain provider credentials. The local judging setup adds the recorded Federato snapshot and the live Sentry, Elastic, OpenAI, and MCP integrations.

## Federato underwriting desk

The desk assesses commercial submissions against the supplied property guideline. It keeps known, estimated and missing facts separate, exposes the score calculation, and lets agents investigate evidence that could change a decision.

- Review the ranked queue, then inspect one case's sources and appetite range.
- Click terms in the scoring equation to see their points, caps, multipliers and origins.
- Use a what-if without overwriting the case; inspect the Challenger's objections and a reasoned human adjustment of up to five points.
- Arrange, hide or focus case panels for review.
- Explore portfolio exposure and geographic context with source-labelled map layers.
- Check historical outcomes, including the policy the rulebook would have accepted that incurred $629,200 in losses.

The recorded snapshot contains 158 commercial submissions: 38 scored under the property guideline and 120 routed to other lines. Some known hard failures settle the result even when other facts are missing. The range is rule-based appetite uncertainty, not a calibrated loss probability.

## Intact consumer experience

The Expo app has **Home, Compare, Insights and Community** tabs, with a Home/Auto switch.

- Home offers a Toronto tenant estimate and a device-local photo inventory.
- Compare explores coverage choices, synthetic Auto listings and scenario prices.
- Insights includes prevention work and a coaching-only Drive Score.
- Community connects driver reports, witness evidence and a recovery plan.
- The web insurer workspace reviews the same incident files, metadata and history, and exports an evidence package.
- Accepted witness contributions earn simulated credits that can be allocated to a one-time Home or Auto payment preview. They do not change the quoted premium.

Home pricing is tenant-only. Auto rates and route zones are synthetic demo inputs. Estimates are illustrative Pixie calculations, not Intact prices or offers. Incident hashes identify received bytes; they do not establish authenticity or fault. Native widgets and Live Activities require a development build.

See the [mobile guide](docs/EXPO.md), [incident workflow](docs/ROAD-HELP.md) and [phone screenshots](docs/assets/intact/community/README.md).

## Present it

Use the [Federato five-minute script](DEMO/9-FEDERATO-FIVE-MINUTES.md): Submissions, Rulebook, Case 138, Portfolio, Validation.

Press **P** in the web app to open the slides, then **P** again to return without losing your inputs or panel choices. Arrow keys navigate the single nine-slide deck. `/present` also opens it directly. See [presentation controls](DEMO/10-PRESENTATION.md).

For Intact, use the [track guide](DEMO/tracks/02-intact.md) and [driver/witness/insurer walkthrough](DEMO/10-ROAD-HELP.md). The [judging guide](DEMO/README.md) links the other sponsor demonstrations.

## Run it

Start with the [setup and runbook](docs/RUNBOOK.md). Tested locally with Node.js 22 and Python 3.12, using npm and uv lockfiles.

| Service | Default port | Entry points |
| --- | ---: | --- |
| FastAPI | 8000 | `/health`, `/docs` |
| Next.js | 3100 | `/queue`, `/present`, `/intact`, `/intact/insurer` |
| Expo | 8081 | Phone app or browser preview |
| Optional MCP | 8010 or stdio | Consumer tools and `/intact/agent` |

A fresh clone does **not** contain the Federato snapshot, recorded SQLite events or provider caches. `data/federato` and `docs/federato` are links to a sibling local directory. Read [data and replay setup](docs/DATA.md) before starting the API. A limited web preview can use explicit bundled-sample mode; it is not the recorded full-book demo.

Copy [`.env.example`](.env.example) to a private root `.env` for backend configuration. Manual Next.js and Expo commands use their own environment files or exported variables; the runbook explains both. `start.sh` is a convenience script for the configured macserver, not a fresh-clone installer. It leaves already-running services untouched.

## Calculation and evidence boundaries

Code computes underwriting scores, prices, totals and adjustments. Models choose investigations and explain tool results. `verify_numbers()` rejects explanation numbers absent from computed facts, but does not prove every interpretation correct. Missing facts never silently pass a rule.

Existing hazard and nearby-exposure adjustments affect scoring. Newer heat, population and humidity layers provide investigation context only. Replay reads previously recorded events and makes no model call; it requires those local events to exist.

## Repository map

| Path | Purpose |
| --- | --- |
| [api/](api/README.md) | FastAPI, commercial engine, consumer services, agent desk and evidence storage |
| [web/](web/README.md) | Federato desk, presentation and Intact insurer workspace |
| [app/](app/README.md) | Expo consumer app |
| `shared/` | Evidence client contract and cached road-map assets shared by both clients |
| [mcp/](mcp/README.md) | Consumer-insurance MCP server |
| `packs/`, `rules/` | Region data and product guidelines |
| `eval/` | Backtest outputs and evaluation code |
| [DEMO/](DEMO/README.md) | Scripts, controls and verification records |
| [docs/](docs/README.md) | Architecture, setup, sources and limitations |

The active sponsor stories are Federato, Intact, Rox, Sentry, Elastic and Expo. Their implemented capabilities and limits are listed in the [track matrix](docs/TRACKS.md).
