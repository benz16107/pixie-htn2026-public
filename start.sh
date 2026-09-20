#!/usr/bin/env bash
# Bring Pixie up. Run it from anywhere: ~/Code/hackathons/htn-2026/atlas/start.sh
# Starts what is down, leaves what is already up alone, prints the URLs and stops on a failure.
set -u
cd "$(dirname "$0")"
ROOT="$PWD"
# macserver's Homebrew Node currently has a missing shared library. Prefer its verified Node 22.
[ ! -x "$HOME/.nvm/versions/node/v22.22.3/bin/node" ] || export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
set -a; . ./.env 2>/dev/null; set +a

up() { lsof -tiTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# Everything runs here on macserver; Ben demos from his laptop and phone over Tailscale. The
# Funnel gives the API one permanent public HTTPS address, so nothing needs rewriting when the
# venue's network changes. Only check that the pieces are still reachable.
TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
[ -n "${TS_IP:-}" ] && echo "tailnet $TS_IP (macserver)"

if up 8000; then
  echo "api   already up"
else
  echo "api   starting..."
  (cd api && nohup uv run uvicorn atlas_api.app:app --host 0.0.0.0 --port 8000 > /tmp/pixie-api.log 2>&1 &)
  for _ in $(seq 1 40); do sleep 1; curl -fsS localhost:8000/health >/dev/null 2>&1 && break; done
fi
curl -fsS localhost:8000/health >/dev/null 2>&1 || { echo "api FAILED, see /tmp/pixie-api.log"; tail -5 /tmp/pixie-api.log; exit 1; }

if up 3100; then
  echo "web   already up"
else
  echo "web   building..."
  (cd web && npm run build > /tmp/pixie-build.log 2>&1) || { echo "web build FAILED, see /tmp/pixie-build.log"; tail -15 /tmp/pixie-build.log; exit 1; }
  (cd web && nohup npm run start -- --port 3100 > /tmp/pixie-web.log 2>&1 &)
  for _ in $(seq 1 30); do sleep 1; curl -fsS localhost:3100/queue >/dev/null 2>&1 && break; done
fi
curl -fsS localhost:3100/queue >/dev/null 2>&1 || { echo "web FAILED, see /tmp/pixie-web.log"; exit 1; }

if up 8081; then
  echo "phone already up"
else
  echo "phone starting..."
  (cd app && nohup npx expo start --lan --port 8081 > /tmp/pixie-expo.log 2>&1 &)
fi

if up 8010; then
  echo "mcp   already up"
else
  echo "mcp   starting..."
  (cd mcp && nohup uv run pixie-mcp --transport streamable-http --host 0.0.0.0 --port 8010 > /tmp/pixie-mcp.log 2>&1 &)
  for _ in $(seq 1 20); do sleep 1; up 8010 && break; done
fi
up 8010 || { echo "mcp FAILED, see /tmp/pixie-mcp.log"; tail -5 /tmp/pixie-mcp.log; exit 1; }

# macserver sleeps on battery, which takes the whole demo down. Keep it awake and plugged in.
if ! pgrep -qf "caffeinate -disu"; then
  nohup caffeinate -disu > /dev/null 2>&1 &
  echo "awake   caffeinate running (kill it with: pkill caffeinate)"
fi
pmset -g batt 2>/dev/null | grep -q "AC Power" || echo "POWER   on battery. Plug macserver in."

cat <<EOF

  Open these on the laptop, with Tailscale on:

  Desk        http://macserver:3100/live      <- press "Run the demo"
  A case      http://macserver:3100/cases/138
  Queue       http://macserver:3100/queue
  Backtest    http://macserver:3100/backtest
  Ask         http://macserver:3100/ask
  Map         http://macserver:3100/map
  Intact      http://macserver:3100/intact     <- four-stage pitch

  If the name does not resolve, use http://${TS_IP:-100.95.223.110}:3100 instead.

  Phone       Tailscale on, then Expo Go: exp://${TS_IP:-100.95.223.110}:8081
  API         http://macserver:8000
  MCP HTTP    http://macserver:8010/mcp
  MCP stdio   project clients can load $ROOT/.mcp.json

  Reset the demo:  curl -X POST localhost:8000/demo/reset
  Runbook:         $ROOT/docs/RUNBOOK.md
EOF
