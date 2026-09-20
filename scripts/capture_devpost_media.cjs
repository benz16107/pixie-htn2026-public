const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "assets", "devpost", "captures");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function findPlaywright() {
  const npxRoot = path.join(os.homedir(), ".npm", "_npx");
  for (const entry of fs.readdirSync(npxRoot)) {
    const candidate = path.join(npxRoot, entry, "node_modules", "playwright");
    if (fs.existsSync(candidate)) return require(candidate);
  }
  throw new Error("Playwright is not installed in the npm cache");
}

async function focusPanel(page, panel) {
  const demo = page.getByRole("button", { name: "Demo layout" });
  if (await demo.isVisible().catch(() => false)) await demo.click();
  let focus = page.getByRole("button", { name: `Focus ${panel}` });
  if (!(await focus.isVisible().catch(() => false))) {
    const panels = page.locator("summary").filter({ hasText: /^Panels/ });
    await panels.click();
    await page.getByRole("checkbox", { name: new RegExp(`^${panel}`) }).click();
    await panels.click();
    focus = page.getByRole("button", { name: `Focus ${panel}` });
  }
  await focus.waitFor({ state: "visible" });
  await focus.click();
  await page.waitForTimeout(700);
}

async function captureLocal(chromium) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15_000);

  await page.goto("http://127.0.0.1:3100/cases/126", { waitUntil: "domcontentloaded" });
  await focusPanel(page, "Issues & action history");
  await page.screenshot({ path: path.join(OUT, "rox-data-issues.png") });

  await page.goto("http://127.0.0.1:3100/cases/138", { waitUntil: "domcontentloaded" });
  await focusPanel(page, "Comparable risks");
  await page.screenshot({ path: path.join(OUT, "elastic-comparable-risks.png") });

  await browser.close();
}

async function captureElastic(chromium) {
  const { ELASTIC_KIBANA_URL, ELASTIC_USERNAME, ELASTIC_PASSWORD } = process.env;
  const { ELASTIC_URL } = process.env;
  if (!ELASTIC_KIBANA_URL || !ELASTIC_URL || !ELASTIC_USERNAME || !ELASTIC_PASSWORD) return "skipped";
  const auth = Buffer.from(`${ELASTIC_USERNAME}:${ELASTIC_PASSWORD}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };
  const indexNames = ["pixie-precedent", "pixie-exposure", "pixie-toronto", "toronto-flood-zones", "toronto-fire-stations"];
  const indices = await Promise.all(indexNames.map(async (name) => {
    const result = await fetch(`${ELASTIC_URL.replace(/\/$/, "")}/${name}/_count`, { headers }).then((r) => r.json());
    return { name, count: result.count };
  }));
  const tools = await fetch(`${ELASTIC_KIBANA_URL.replace(/\/$/, "")}/api/agent_builder/tools`, {
    headers: { ...headers, "kbn-xsrf": "true" },
  }).then((r) => r.json());
  const customTools = (tools.results || []).filter((tool) => [
    "portfolio_concentration_by_hex", "tiv_percentile_rank", "hazard_declined_significant_terms",
  ].includes(tool.id));

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const rows = indices.map(({ name, count }) => `<tr><td>${name}</td><td>${Number(count).toLocaleString("en-US")}</td><td class="ok">live</td></tr>`).join("");
  const toolRows = customTools.map((tool) => `<li><b>${tool.id}</b><p>${tool.description}</p></li>`).join("");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#07151d;color:#eef8fb;font:16px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
    main{padding:58px 70px}.eyebrow{color:#42d3c7;text-transform:uppercase;letter-spacing:.15em;font-size:13px}
    h1{font:700 42px/1.12 system-ui,sans-serif;margin:14px 0 10px}.sub{color:#91a9b3;margin:0 0 36px}.grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:28px}
    .card{border:1px solid #24414b;background:#0b2029;padding:26px}h2{font:650 18px/1.2 system-ui,sans-serif;margin:0 0 20px}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:13px 8px;border-top:1px solid #1d3943}th{color:#7e9aa5;font-size:12px;text-transform:uppercase;letter-spacing:.1em}
    td:nth-child(2),th:nth-child(2){text-align:right}.ok{color:#62dfb9}ul{list-style:none;margin:0;padding:0}li{border-top:1px solid #1d3943;padding:14px 0}
    li b{color:#f8c65d}li p{color:#91a9b3;margin:6px 0 0;font:14px/1.45 system-ui,sans-serif}.foot{margin-top:28px;color:#7e9aa5;font-size:13px}
  </style></head><body><main><p class="eyebrow">Live Elastic API verification</p><h1>Five indices and three Agent Builder tools answer underwriting questions</h1>
    <p class="sub">Authenticated against the hackathon Elastic project on ${new Date().toISOString().slice(0, 10)}</p><div class="grid">
    <section class="card"><h2>Indexed records</h2><table><thead><tr><th>Index</th><th>Documents</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
    <section class="card"><h2>Registered Agent Builder tools</h2><ul>${toolRows}</ul></section></div>
    <p class="foot">Rendered from authenticated Elasticsearch and Kibana API responses. This is a Pixie proof sheet, not a screenshot of Kibana.</p>
  </main></body></html>`);
  await page.screenshot({ path: path.join(OUT, "elastic-live-indices.png") });
  await browser.close();
  return "captured-from-api";
}

async function captureSentry(chromium) {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) return "skipped";
  const headers = { Authorization: `Bearer ${token}` };
  const issue = await fetch("https://us.sentry.io/api/0/issues/7743566054/", { headers }).then((r) => r.json());
  const event = await fetch("https://us.sentry.io/api/0/issues/7743566054/events/latest/", { headers }).then((r) => r.json());
  const detail = event.contexts?.verify_numbers || {};
  const trace = event.contexts?.trace || {};
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#0f0d18;color:#f5f3fb;font:16px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    main{padding:64px 76px}.eyebrow{color:#a899ff;text-transform:uppercase;letter-spacing:.16em;font-size:13px}
    h1{font:700 42px/1.14 system-ui,sans-serif;max-width:1200px;margin:16px 0 12px}.sub{color:#aaa3bb;margin:0 0 44px}
    .grid{display:grid;grid-template-columns:1.4fr .8fr;gap:28px}.card{border:1px solid #38324b;background:#171421;padding:28px}
    h2{font:650 18px/1.2 system-ui,sans-serif;margin:0 0 22px}.sentence{font-size:28px;color:#ffb3a7;margin:0 0 26px}
    dl{display:grid;grid-template-columns:180px 1fr;margin:0}dt,dd{padding:13px 0;border-top:1px solid #302a41;margin:0}dt{color:#8f87a2}dd{color:#f5f3fb}
    .tag{display:inline-block;border:1px solid #6756c8;color:#c9c0ff;padding:5px 9px;margin:0 8px 8px 0;font-size:13px}
    .foot{margin-top:28px;color:#8f87a2;font-size:13px}.ok{color:#7de2bd}
  </style></head><body><main>
    <p class="eyebrow">Live Sentry API verification</p>
    <h1>Pixie catches a number the model could not support</h1>
    <p class="sub">Project atlas-api · observed ${escape(event.dateCreated)} · issue ${escape(issue.id)}</p>
    <div class="grid"><section class="card"><h2>Rejected model sentence</h2><p class="sentence">${escape(detail.sentence)}</p>
      <dl><dt>Guardrail</dt><dd>pixie.alert = verify_numbers</dd><dt>Case</dt><dd>${escape(detail.case_id)}</dd><dt>Agent</dt><dd>${escape(detail.agent)}</dd><dt>Computed fact</dt><dd>${escape((detail.facts || []).join(", "))}</dd><dt>Result</dt><dd class="ok">Sentence withheld; deterministic fallback shown</dd></dl>
    </section><aside class="card"><h2>Sentry evidence</h2><span class="tag">Error Monitoring</span><span class="tag">Tracing</span><span class="tag">Structured Logs</span><span class="tag">AI Agent Monitoring</span>
      <dl><dt>Events</dt><dd>${escape(issue.count)}</dd><dt>Environment</dt><dd>hackathon</dd><dt>Platform</dt><dd>${escape(event.platform)}</dd><dt>Trace ID</dt><dd>${escape(trace.trace_id)}</dd><dt>Last seen</dt><dd>${escape(issue.lastSeen)}</dd></dl>
    </aside></div><p class="foot">Rendered from authenticated Sentry API data. This is a Pixie proof sheet, not a screenshot of Sentry's dashboard.</p>
  </main></body></html>`);
  await page.screenshot({ path: path.join(OUT, "sentry-number-guardrail.png") });
  await browser.close();
  return "captured-from-api";
}

(async () => {
  loadEnv(path.join(ROOT, ".env"));
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = findPlaywright();
  await captureLocal(chromium);
  const elastic = await captureElastic(chromium);
  const sentry = await captureSentry(chromium);
  console.log(JSON.stringify({ output: OUT, elastic, sentry }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
