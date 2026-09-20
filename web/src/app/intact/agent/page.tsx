"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./AgentDemo.module.css";

type AgentResult = {
  tool: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
  error?: string;
};

const QUICK_RUNS = [
  {
    label: "Tenant estimate",
    prompt: "Estimate tenant coverage for 180 Queen St W with $30,000 of contents.",
    tool: "estimate_home_quote",
    arguments: { address: "180 Queen St W, Toronto", contents_value: 30000, unit_level: "upper", deductible: 1000, liability: 1000000 },
  },
  {
    label: "Compare cars",
    prompt: "Compare all three cars for an everyday Toronto driver.",
    tool: "compare_vehicles",
    arguments: { annual_km_band: "10000_20000", parking: "driveway", deductible: 1000, claims_5yr: 0 },
  },
  {
    label: "Explain a drive",
    prompt: "Explain a Toronto drive with one hard brake and school-area context.",
    tool: "assess_drive_context",
    arguments: { points: [{ lat: 43.639, lng: -79.443 }, { lat: 43.642, lng: -79.408 }, { lat: 43.65, lng: -79.381 }], distance_km: 9.4, speeding_events: 0, hard_brake_events: 1 },
  },
] as const;

function Result({ payload }: { payload: AgentResult }) {
  const result = payload.result;
  if (result.kind === "tenant") {
    const lines = Array.isArray(result.lines) ? result.lines as Array<Record<string, unknown>> : [];
    return (
      <div className={styles.answer}>
        <div className={styles.answerHead}><span>Tool result</span><strong>${String(result.monthly)} / month</strong></div>
        <p>{String(result.label)}</p>
        <div className={styles.receipt}>
          {lines.slice(0, 4).map((line) => <div key={String(line.label)}><span>{String(line.label)}</span><b>{Number(line.dollars) >= 0 ? "+" : ""}${String(line.dollars)}</b><small>{String(line.source)}</small></div>)}
        </div>
      </div>
    );
  }
  if (result.kind === "drive") {
    const factors = Array.isArray(result.routeFactors) ? result.routeFactors as Array<Record<string, unknown>> : [];
    return (
      <div className={styles.answer}>
        <div className={styles.answerHead}><span>Tool result</span><strong>{String(result.score)} coaching score</strong></div>
        <div className={styles.scoreSplit}><div><b>{String(result.behaviorScore)}</b><span>Driving</span></div><div><b>{String(result.routeContextScore)}</b><span>Road context</span></div></div>
        {factors.slice(0, 3).map((factor) => <p key={String(factor.key)}>{String(factor.label)} · {String(factor.areaLabel)}</p>)}
      </div>
    );
  }
  const rows = Array.isArray(result.rows) ? result.rows as Array<Record<string, unknown>> : [];
  return (
    <div className={styles.answer}>
      <div className={styles.answerHead}><span>Tool result</span><strong>Vehicle comparison ready</strong></div>
      <p>{String(result.label)}</p>
      <div className={styles.receipt}>
        {rows.map((row) => <div key={String(row.id)}><span>{String(row.name)}</span><b>${String(row.monthly)} / month</b><small>${Number(row.listingPrice).toLocaleString("en-CA")} example listing</small></div>)}
      </div>
    </div>
  );
}

export default function AgentDemoPage() {
  const [selected, setSelected] = useState(0);
  const [address, setAddress] = useState("180 Queen St W, Toronto");
  const [contents, setContents] = useState(30000);
  const [payload, setPayload] = useState<AgentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scenario = QUICK_RUNS[selected];

  const run = async () => {
    setBusy(true);
    setError("");
    setPayload(null);
    const args = selected === 0 ? { ...scenario.arguments, address, contents_value: contents } : scenario.arguments;
    try {
      const response = await fetch("/api/intact/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: scenario.tool, arguments: args }) });
      const next = await response.json() as AgentResult;
      if (!response.ok) throw new Error(next.error || "The MCP request failed");
      setPayload(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The MCP request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`intact-page ${styles.page}`}>
      <header className={styles.header}>
        <div><p>Pixie agent interface</p><h1>Let an agent ask. Keep the insurance math in tools.</h1></div>
        <div><p>An AI client can use MCP to call Pixie’s insurance tools. In this inspector, you select a preset tool and send a real request. Pixie calculates the result and returns its sources.</p><Link href="/intact">Back to system map</Link></div>
      </header>

      <section className={styles.flow} aria-label="MCP request flow">
        {["Customer request", "Agent chooses a tool", "MCP validates inputs", "Deterministic service", "Sourced answer"].map((label, index) => <div key={label}><span>0{index + 1}</span><strong>{label}</strong>{index < 4 ? <i aria-hidden>→</i> : null}</div>)}
      </section>

      <section className={styles.workspace}>
        <div className={styles.controls}>
          <p className={styles.eyebrow}>Try a real request</p>
          <div className={styles.scenarioTabs}>
            {QUICK_RUNS.map((item, index) => <button aria-pressed={selected === index} key={item.label} onClick={() => { setSelected(index); setPayload(null); setError(""); }}>{item.label}</button>)}
          </div>
          <div className={styles.prompt}><span>Customer</span><p>{selected === 0 ? `Estimate tenant coverage for ${address} with $${contents.toLocaleString("en-CA")} of contents.` : scenario.prompt}</p></div>
          {selected === 0 ? (
            <div className={styles.quoteInputs}>
              <label><span>Address</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
              <label><span>Contents</span><select value={contents} onChange={(event) => setContents(Number(event.target.value))}><option value={30000}>$30,000</option><option value={50000}>$50,000</option><option value={75000}>$75,000</option></select></label>
            </div>
          ) : null}
          <div className={styles.toolCall}><span>Tool selected</span><code>{scenario.tool}</code><small>Only the visible arguments below are sent.</small><pre>{JSON.stringify(selected === 0 ? { ...scenario.arguments, address, contents_value: contents } : scenario.arguments, null, 2)}</pre></div>
          <button className={styles.runButton} disabled={busy || !address.trim()} onClick={run}>{busy ? "Calling MCP…" : "Run live agent request"}</button>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
        <div className={styles.resultPane}>
          {payload ? <Result payload={payload} /> : <div className={styles.empty}><span>MCP</span><h2>The result will show its work here.</h2><p>Run a request to see the selected tool, validated arguments, deterministic answer, and source lines.</p></div>}
        </div>
      </section>

      <section className={styles.install}>
        <div><p className={styles.eyebrow}>Install it in an agent</p><h2>The repository already contains the server configuration.</h2><p>Open this repository in an MCP-capable agent. Project-aware clients can load <code>.mcp.json</code>. For an HTTP client, point it at the running Streamable HTTP endpoint.</p></div>
        <div className={styles.config}><span>Project configuration</span><pre>{`{
  "mcpServers": {
    "pixie-insurance": {
      "command": "uv",
      "args": ["--directory", "mcp", "run", "pixie-mcp"]
    }
  }
}`}</pre><small>HTTP: http://macserver:8010/mcp · 9 tools · no API key</small></div>
      </section>
    </main>
  );
}
