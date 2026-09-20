#!/usr/bin/env python3
"""One-off Sentry dashboard setup: the verify_numbers alert rule (docs/research/sentry.md item 5),
and best-effort uptime/cron monitors (item 6). Idempotent by name -- a rule/monitor that already
exists is left alone, not duplicated.

    cd api && uv run python ../scripts/sentry_setup.py

Needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT_API (project slug for the FastAPI project;
pass --project or set the env var) with scopes org:read, project:read, project:write, alerts:write.
Run against the live API on 2026-09-19 with a user token carrying those scopes: the alert workflow
and the uptime monitor were both created. A token without them prints a clear 403 and the script
still exits 0, so it is safe to leave in CI/setup docs.
See docs/SENTRY.md for exactly what did and did not run and why.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_env() -> dict[str, str]:
    env = dict(os.environ)
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k, v.strip().strip("'").strip('"'))
    return env


def _call(host: str, path: str, token: str, method: str = "GET", body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{host}{path}", data=data, method=method,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except json.JSONDecodeError:
            return e.code, {"detail": "non-JSON error body"}


ALERT_NAME = "Pixie: an agent stated a number the engine did not compute"


def verify_numbers_alert_rule(host: str, org: str, project: str, token: str) -> None:
    """Fire when a new issue carries the tag pixie.alert=verify_numbers, which telemetry.
    verify_numbers_alert() sets when an agent states a number no tool computed.

    Sentry retired the per-project /rules/ API (it answers 410 "This API no longer exists").
    Issue alerts now live in the workflow engine: a trigger says which issues wake the workflow,
    an action filter narrows by tag, and the action notifies. Verified against the live API
    2026-09-19."""
    status, existing = _call(host, f"/api/0/organizations/{org}/workflows/", token)
    if status == 200 and any(w.get("name") == ALERT_NAME for w in existing):
        print("alert rule: already exists, left alone")
        return
    payload = {
        "name": ALERT_NAME,
        "enabled": True,
        "config": {"frequency": 5},
        "triggers": {"logicType": "any-short", "conditions": [
            {"type": "first_seen_event", "comparison": True, "conditionResult": True},
            {"type": "regression_event", "comparison": True, "conditionResult": True},
        ]},
        "actionFilters": [{
            "logicType": "all",
            "conditions": [{"type": "tagged_event", "conditionResult": True,
                            "comparison": {"key": "pixie.alert", "match": "eq", "value": "verify_numbers"}}],
            "actions": [{"type": "email", "data": {"fallthroughType": "ActiveMembers"},
                         "config": {"targetType": "issue_owners"}}],
        }],
        "detectorIds": [],
    }
    status, out = _call(host, f"/api/0/organizations/{org}/workflows/", token, "POST", payload)
    print(f"alert rule: {'created ' + str(out.get('id')) if status in (200, 201) else f'FAILED {status}: {out}'}")


def uptime_monitor(host: str, org: str, project: str, token: str, url: str) -> None:
    """POST .../projects/{org}/{project}/uptime/. Do not send `mode`: only superusers may set it."""
    status, existing = _call(host, f"/api/0/organizations/{org}/uptime/", token)
    if status == 200 and any(m.get("url") == url for m in existing):
        print("uptime monitor: already exists, left alone")
        return
    payload = {"name": "Pixie API health", "url": url, "intervalSeconds": 300,
               "timeoutMs": 10_000, "environment": "hackathon"}
    status, out = _call(host, f"/api/0/projects/{org}/{project}/uptime/", token, "POST", payload)
    print(f"uptime monitor: {'created ' + str(out.get('id')) if status in (200, 201) else f'FAILED {status}: {out}'}")


def main() -> None:
    env = _load_env()
    token = env.get("SENTRY_AUTH_TOKEN")
    org = env.get("SENTRY_ORG")
    project = env.get("SENTRY_PROJECT_API", "atlas-api")
    health_url = (env.get("ATLAS_PUBLIC_URL") or env.get("PUBLIC_URL", "")).rstrip("/") + "/health"
    host = "https://us.sentry.io"
    if not token or not org:
        print("SENTRY_AUTH_TOKEN / SENTRY_ORG not set; nothing to do.", file=sys.stderr)
        return
    verify_numbers_alert_rule(host, org, project, token)
    if health_url.startswith("http"):
        uptime_monitor(host, org, project, token, health_url)
    else:
        print("uptime monitor: skipped, neither ATLAS_PUBLIC_URL nor PUBLIC_URL is set")
    print("Cron monitor: created by running the job itself -- eval/backtest.py's "
         "_write_backtest_monitored() wraps it in @sentry_sdk.crons.monitor(monitor_slug='pixie-backtest'); "
         "Sentry auto-creates the monitor on its first check-in, no separate API call needed.")


if __name__ == "__main__":
    main()
