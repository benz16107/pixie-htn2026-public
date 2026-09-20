#!/usr/bin/env node
// Renders every page against a running web server and fails on any 5xx or error page.
// Usage: node smoke.mjs [baseUrl]   (default http://localhost:3100)
const base = process.argv[2] ?? process.env.SMOKE_URL ?? "http://localhost:3100";
const api = process.env.ATLAS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const idsFrom = async () => {
  try {
    const rows = await (await fetch(`${api}/queue?view=all`)).json();
    const pick = (f) => rows.filter(f).slice(0, 3).map((r) => r.caseId);
    // one of each shape the engine can produce: scored, unscored, tenant
    return [...new Set([...pick((r) => r.score), ...pick((r) => !r.score), ...pick((r) => r.caseId.startsWith("TQ-"))])];
  } catch {
    return ["138"];
  }
};

const paths = async () => [
  "/", "/queue", "/queue?view=all", "/queue?view=consumer", "/guideline", "/map", "/map?peril=flood", "/ask", "/backtest", "/live", "/privacy", "/terms", "/cases/nope-404",
  ...(await idsFrom()).map((id) => `/cases/${id}`),
];

let bad = 0;
for (const path of await paths()) {
  let status = 0;
  let note = "";
  try {
    const res = await fetch(base + path, { redirect: "follow" });
    status = res.status;
    const html = await res.text();
    const expected404 = path.endsWith("nope-404");
    if (status >= 500 || (status === 404 && !expected404)) note = "bad status";
    // A client-side crash still returns 200, so look for Next's error markup too.
    if (/Application error: a (client|server)-side exception/.test(html)) note = "client exception";
    if (/__next_error__/.test(html) && !expected404) note = "error page";
  } catch (e) {
    note = `fetch failed: ${e.message}`;
  }
  if (note) bad++;
  console.log(`${note ? "FAIL" : "ok  "} ${String(status).padEnd(3)} ${path}${note ? `  (${note})` : ""}`);
}
console.log(bad ? `\n${bad} page(s) broken` : "\nall pages render");
process.exit(bad ? 1 : 0);
