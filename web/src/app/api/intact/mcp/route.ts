import { NextResponse } from "next/server";

const MCP_URL = process.env.PIXIE_MCP_URL ?? "http://127.0.0.1:8010/mcp";
const ALLOWED_TOOLS = new Set(["estimate_home_quote", "compare_vehicles", "assess_drive_context"]);

type JsonRecord = Record<string, unknown>;

async function rpc(body: JsonRecord, sessionId?: string) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`MCP returned ${response.status}`);
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) as JsonRecord : {} };
}

function toolData(payload: JsonRecord) {
  const result = payload.result as JsonRecord | undefined;
  if (result?.structuredContent && typeof result.structuredContent === "object") return result.structuredContent as JsonRecord;
  const content = Array.isArray(result?.content) ? result.content as JsonRecord[] : [];
  const text = content.find((item) => typeof item.text === "string")?.text;
  if (!text || typeof text !== "string") return {};
  try { return JSON.parse(text) as JsonRecord; } catch { return { message: text }; }
}

function present(tool: string, data: JsonRecord) {
  if (tool === "estimate_home_quote") {
    const receipt = data.receipt as JsonRecord | undefined;
    return {
      kind: "tenant",
      id: data.caseId,
      monthly: data.monthly,
      annual: data.annual,
      decision: (data.decision as JsonRecord | undefined)?.kind,
      reasons: (data.decision as JsonRecord | undefined)?.reasons,
      label: data.label,
      lines: Array.isArray(receipt?.lines) ? receipt.lines : [],
    };
  }
  if (tool === "compare_vehicles") {
    const comparison = Array.isArray(data.comparison) ? data.comparison as JsonRecord[] : [];
    const rows = comparison.map((entry) => {
      const vehicle = entry.vehicle as JsonRecord | undefined;
      return {
        id: vehicle?.id,
        name: [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
        listingPrice: vehicle?.listingPrice,
        monthly: entry.illustrativeMonthly,
        annual: entry.illustrativeAnnual,
        nextStep: (entry.decision as JsonRecord | undefined)?.nextStep,
      };
    });
    return { kind: "vehicles", rows, scenario: data.sameScenario, label: data.label };
  }
  return {
    kind: "drive",
    score: data.score,
    behaviorScore: data.behaviorScore,
    routeContextScore: data.routeContextScore,
    band: data.band,
    factors: data.factors,
    routeFactors: data.routeFactors,
    label: data.label,
  };
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { tool?: string; arguments?: JsonRecord };
    if (!input.tool || !ALLOWED_TOOLS.has(input.tool)) return NextResponse.json({ error: "Unsupported demo tool" }, { status: 400 });

    const initialized = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "pixie-web-demo", version: "1.0" } },
    });
    const sessionId = initialized.response.headers.get("mcp-session-id");
    if (!sessionId) throw new Error("MCP did not create a session");
    await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId);
    const called = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: input.tool, arguments: input.arguments ?? {} } }, sessionId);
    const data = toolData(called.payload);
    return NextResponse.json({ tool: input.tool, arguments: input.arguments ?? {}, result: present(input.tool, data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MCP request failed" }, { status: 502 });
  }
}
