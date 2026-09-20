# Pixie web app

Next.js serves the Federato underwriting desk, integrated presentation and Intact insurer workspace. Run commands in this directory after reading the root [runbook](../docs/RUNBOOK.md).

## Local development

```bash
npm ci
npm run dev -- --port 3100
```

The API defaults to `http://localhost:8000`. To change it, create `web/.env.local` with `ATLAS_API_URL=http://your-api-host:8000`. Browser requests pass through the same-origin `/api/atlas` proxy; the server must be able to reach that API URL.

Set `NEXT_PUBLIC_EXPO_URL` to the phone/browser preview address used by Intact links. `/intact/agent` also needs an MCP HTTP server; `PIXIE_MCP_URL` defaults to `http://127.0.0.1:8010/mcp`.

## Production demo

```bash
npm run build -- --webpack
npm run start -- --port 3100
```

Use a separate build directory if another build is already serving a demo. `start.sh` skips a running web server, so running it again does not deploy changed source.

Keep the repository layout intact: the web app imports `../shared/` for incident evidence and map assets. `npm ci` runs the postinstall step that copies MapLibre workers into `public/maplibre/`.

## Main routes

| Route | Purpose |
| --- | --- |
| `/queue` | Commercial submissions and ranking |
| `/guideline`, `/method` | Active rulebook and clickable scoring method |
| `/cases/138` | Sources, calculation, what-if, investigation and movable panels |
| `/map` | Portfolio exposure and source-labelled context layers |
| `/backtest` | Historical outcomes and recorded enrichment comparison |
| `/present` | Short explanatory slides |
| `/intact` | Consumer workflow overview |
| `/intact/insurer` | Incident evidence, reviews and exports |
| `/intact/quotes` | Tenant receipts and advisor referrals |
| `/intact/agent` | Consumer MCP demonstration |

**P** opens the presentation over the current app page; **P** returns to the same inputs and panel state. Arrows change slides. There is no separate D shortcut or Q&A deck. See [the presentation guide](../DEMO/10-PRESENTATION.md).

## Bundled-sample preview

Without a configured API, set `NEXT_PUBLIC_FIXTURES=1` in `web/.env.local` before building or starting development. Supported desk views show the **BUNDLED SAMPLES** label and use committed examples. This is a limited preview: sample-mode actions do not write changes, and live case calculations, uploads, model runs and connected insurer workflows still need the API. Remove the flag and rebuild before presenting the live book.

The standalone slides require no API. The full API needs the local [Federato snapshot](../docs/DATA.md).

## Checks

```bash
npx tsc --noEmit
npm run build -- --webpack
```

Recorded browser checks live in [DEMO/verification](../DEMO/verification). Client telemetry uses `NEXT_PUBLIC_SENTRY_DSN`; server telemetry uses `SENTRY_DSN_WEB` or `SENTRY_DSN_APP`. These are optional. Never put private credentials in a `NEXT_PUBLIC_` variable.
