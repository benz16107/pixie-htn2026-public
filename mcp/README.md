# Pixie MCP server

This MCP 2.x server exposes Pixie's deterministic consumer-insurance demo to an AI client. It shares the same Python functions as the FastAPI routes. Models do not set prices.

The Home tool currently supports renter or tenant insurance through the existing Toronto tenant engine. It does not implement or claim a homeowner tariff. Auto estimates come from the bundled synthetic listings and pricing table in `api/fixtures/consumer_demo.json`. Every result says that it is illustrative and not an insurer quote or offer.

Privacy is part of the tool boundary. `get_policy_summary` returns coverage and renewal facts without a name, address, contact value, driver licence, or VIN. There is no `get_full_profile` tool. `prepare_application` and `request_recovery_handoff` require explicit consent plus `confirm_demo_only=true`; they prepare unsent demo records and never submit to a carrier.

`assess_drive_context` accepts route points rounded to at most three decimal places plus aggregate speeding and hard-brake counts. It returns separate behavior and synthetic Toronto route-context scores, every factor's provenance, and the transparent 75/25 coaching composite. It stores nothing, returns no coordinates, uses no identity input, and cannot affect a quote or premium.

Install and run over standard input/output:

```bash
cd mcp
uv sync
uv run pixie-mcp
```

The repository-level `.mcp.json` already registers this command as `pixie-insurance` for project clients that support MCP configuration files. Open the repository as the client workspace, approve the local server if the client asks, then inspect its tool list. No API key is required because the server uses bundled demonstration data and the local Pixie API package.

For local Streamable HTTP, use a separate port from the FastAPI service:

```bash
cd mcp
uv run pixie-mcp --transport streamable-http --host 127.0.0.1 --port 8010
```

The local endpoint is `http://127.0.0.1:8010/mcp`. From another device on the same Tailscale network, use `http://macserver:8010/mcp`. `start.sh` starts this HTTP transport automatically.

An MCP client connects in this order:

1. Send `initialize` and keep the returned `mcp-session-id` header.
2. Send the `notifications/initialized` notification with that session header.
3. Call `tools/list`, then call a tool such as `compare_vehicles` or `estimate_home_quote`.

The server currently exposes nine tools. Draft and recovery tools require explicit consent and a second `confirm_demo_only` flag. They create local, unsent records.

Run the protocol-level tests:

```bash
cd mcp
uv run pytest -q
```

## Use it in an agent or a recording

[The Intact recording guide](../DEMO/11-INTACT-VIDEO.md#connect-an-actual-agent-for-the-mcp-scene) has tested Codex CLI setup syntax, a tenant prompt, a car-comparison prompt, and the 20-second video sequence. The website at `/intact/agent` is a real MCP tool inspector with preset tool selection. It is not an autonomous chat client. The tools receive the arguments the caller supplies; they do not automatically read the Expo user's private profile.

The stdio option runs on the same machine as the agent. The HTTP option needs the server's host to be reachable. To reach macserver from another device, bind the service to `0.0.0.0`, as `start.sh` does; the loopback-only command above is reachable only on macserver.
