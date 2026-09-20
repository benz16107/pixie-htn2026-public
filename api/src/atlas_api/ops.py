"""Sentry as an agent tool (docs/research/sentry.md item 13): a small ops agent that answers
"what broke in the last hour" by querying Sentry itself, instead of a human opening the dashboard.

Off by default: ATLAS_SENTRY_MCP=1 turns it on. When on, it spawns `npx @sentry/mcp-server@latest`
over stdio (the research doc's "local stdio" option -- no OAuth browser flow needed) using
SENTRY_AUTH_TOKEN as its access token. Cheap: one extra local process, spun up only for the call
that needs it, torn down after. Read-only in practice because that token only carries
project:releases (docs/SENTRY.md records this); a token with org:read/project:read/event:write
would light this up fully without any code change here.
"""

from __future__ import annotations

import os


def enabled() -> bool:
    return os.environ.get("ATLAS_SENTRY_MCP") == "1" and bool(os.environ.get("SENTRY_AUTH_TOKEN"))


async def ask_ops(question: str) -> str:
    """"What broke in the last hour?" / "why did case 143 take so long?" etc. Callers should check
    `enabled()` first (the /ops/ask route returns 503 instead of calling this when it's off)."""
    if not enabled():
        raise RuntimeError("ATLAS_SENTRY_MCP is not set; the Sentry ops tool is disabled")
    from agents import Agent, Runner
    from agents.mcp import MCPServerStdio

    token = os.environ["SENTRY_AUTH_TOKEN"]
    org = os.environ.get("SENTRY_ORG", "")
    async with MCPServerStdio(
        name="sentry",
        params={"command": "npx", "args": ["-y", "@sentry/mcp-server@latest", f"--access-token={token}",
                                            "--disable-skills=seer"]},
        client_session_timeout_seconds=30,
    ) as server:
        agent = Agent(name="ops", model=os.environ.get("ATLAS_MODEL_SPECIALIST", "gpt-5.6-luna"),
                     mcp_servers=[server],
                     instructions=f"You answer questions about the Sentry org '{org}' (Pixie's own "
                                  "observability -- its own traces, logs and issues) using your Sentry "
                                  "tools only. One or two sentences.")
        result = await Runner.run(agent, question, max_turns=4)
        return str(result.final_output)
