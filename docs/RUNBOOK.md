# Setup and demo runbook

## Fresh clone

Use Node.js 22, npm, Python 3.12 and uv. These are the versions used for local verification; use the committed lockfiles. From the repository root:

```bash
test -f .env || cp .env.example .env
(cd api && uv sync)
(cd web && npm ci)
(cd app && npm ci)
(cd mcp && uv sync)
```

Copy the example only when creating a new `.env`; preserve an existing configured file. Supply credentials only for the integrations you intend to use. The full API also requires the [local Federato snapshot](DATA.md). A clone does not contain the recorded SQLite events or provider caches, and credentials alone do not recreate them.

For a limited web preview without the API, follow [bundled-sample mode](../web/README.md#bundled-sample-preview). `/present` itself needs no API.

## Configure each process

The Python service loads the root `.env`. Next.js and Expo should receive exported variables or their own project-local files when launched manually.

Create `web/.env.local` as needed:

```dotenv
ATLAS_API_URL=http://localhost:8000
PIXIE_MCP_URL=http://127.0.0.1:8010/mcp
NEXT_PUBLIC_EXPO_URL=http://localhost:8081
```

Create `app/.env.local` for the phone:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:8000
EXPO_PUBLIC_WEB_URL=http://YOUR_SERVER_IP:3100
```

Replace `YOUR_SERVER_IP` with a reachable LAN or Tailscale address. `macserver` is the team's existing Tailscale host, not a service a fresh clone creates. A phone cannot use the server's `localhost`. Public-prefixed variables are visible in the client bundle; never put provider secrets in them. Reload Expo after changing its public variables and rebuild Next.js after changing build-time public settings.

## Start services

Run each block in a separate terminal, starting from the repository root.

API, after restoring its data:

```bash
cd api
uv run uvicorn atlas_api.app:app --host 0.0.0.0 --port 8000
```

Web:

```bash
cd web
npm run build -- --webpack
npm run start -- --port 3100
```

Phone:

```bash
cd app
npx expo start --lan --port 8081
```

Optional MCP HTTP transport, needed by the web agent demonstration:

```bash
cd mcp
uv run pixie-mcp --transport streamable-http --host 127.0.0.1 --port 8010
```

Use the production Next.js build during judging. Keep the `web/`, `app/` and `shared/` directories in their repository layout. Both clients import shared evidence code.

| Service | Check |
| --- | --- |
| API | `curl -fsS http://localhost:8000/health`; route documentation at `/docs` |
| Web | Open `http://localhost:3100/queue` and `/present` |
| Intact insurer | Open `http://localhost:3100/intact/insurer` |
| Expo | Open the printed Expo URL; press W for the browser preview |
| MCP | `/intact/agent` uses `http://127.0.0.1:8010/mcp` by default; see the [protocol guide](../mcp/README.md) |

## Configured demo machine

`./start.sh` is a convenience launcher for the existing macOS demo host. It sources the root `.env`, checks ports, starts missing services and uses macOS keep-awake commands. It does not install npm dependencies, restore the Federato snapshot, record agent runs or configure Apple signing.

It also leaves already-running services untouched. Re-running it after a Git pull does not update a running web build. Build a new snapshot separately, verify it, then replace the serving process. Do not rebuild `.next` in place while a judge is using that server.

## Before judging

1. Preload `/queue?view=scored`, `/guideline`, `/cases/138`, `/map` and `/backtest`, in that order. Follow the [five-minute Federato script](../DEMO/9-FEDERATO-FIVE-MINUTES.md).
2. Press **P** to toggle the [presentation](../DEMO/10-PRESENTATION.md). Opening it from the app preserves the underlying inputs, panel choices and scroll position. Arrows move slides; P returns.
3. Confirm the product switch opens Intact. Preload `/intact/insurer` if showing road evidence.
4. On the phone, open Home, Compare, Insights and Community. Prepare one tenant receipt, the Auto comparison and the stationary Drive Score sample.
5. For the [incident exchange demo](../DEMO/10-ROAD-HELP.md), use separate driver and witness devices or browser profiles. Use test media. Verify that the reviewer and phone show the same incident.
6. For `/intact/agent`, start MCP and leave one successful sourced answer ready.
7. Use recorded replay for the commercial desk. A live model run requires configured model access and may make billable calls.
8. Native iOS widgets, Live Activities and Expo UI need a development build. Check [the mobile guide](EXPO.md) for project access, signing and device requirements.

## Verification

These commands use subshells so every path remains relative to the repository root:

```bash
(cd api && SENTRY_DSN_API= uv run pytest -q tests ../packs/us/test_property_context.py)
(cd mcp && uv run pytest -q)
(cd web && npm run build -- --webpack)
(cd app && npx tsc --noEmit)
(cd app && npm run test:inventory)
```

The API tests require the same snapshot that the service loads. For additional evaluations, read [eval/BACKTEST.md](../eval/BACKTEST.md) before running the `eval/` suite; some paths depend on local records or live model configuration. Recorded browser checks are in [DEMO/verification](../DEMO/verification).

## Recovery

- An unavailable API does not silently become the live book. Use explicitly labelled bundled-sample mode if needed.
- If a model run is slow, use recorded replay. A fresh empty database has no recorded run to replay.
- If Elastic is unavailable, identify the memory backend rather than describing it as an Elastic response.
- If the phone loses the API, use labelled Auto or driving samples. Uploads, reviews and witness credit refreshes need a working evidence service.
- Reset rehearsal guideline edits and overrides only when ready to discard those changes. The commercial reset does not erase the separate incident database or device-local inventory.

See [data locations and retention](DATA.md) before moving a demo to another machine.
