import { API } from "@/lib/live";

// Same-origin proxy to the desk API: the browser can then stream SSE without CORS,
// and the demo works wherever the laptop serves the web app from.
export const dynamic = "force-dynamic";

const target = (req: Request, path: string[]) => `${API}/${path.join("/")}${new URL(req.url).search}`;

const down = (e: unknown) =>
  // The desk API restarts during a run; say so plainly instead of throwing a 500 page.
  new Response(JSON.stringify({ error: "desk API unreachable", detail: String(e) }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });

export async function GET(req: Request, ctx: RouteContext<"/api/atlas/[...path]">) {
  const { path } = await ctx.params;
  let res: Response;
  try {
    res = await fetch(target(req, path), {
      headers: { accept: req.headers.get("accept") ?? "*/*" },
      cache: "no-store",
    });
  } catch (e) {
    return down(e);
  }
  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/json",
    "cache-control": "no-store, no-transform",
  });
  return new Response(res.body, { status: res.status, headers });
}

export async function POST(req: Request, ctx: RouteContext<"/api/atlas/[...path]">) {
  const { path } = await ctx.params;
  let res: Response;
  try {
    res = await fetch(target(req, path), { method: "POST", headers: { "content-type": "application/json" }, body: await req.text() });
  } catch (e) {
    return down(e);
  }
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/atlas/[...path]">) {
  const { path } = await ctx.params;
  try {
    const res = await fetch(target(req, path), { method: "PUT", headers: { "content-type": "application/json" }, body: await req.text() });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
  } catch (e) {
    return down(e);
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/atlas/[...path]">) {
  const { path } = await ctx.params;
  try {
    const res = await fetch(target(req, path), { method: "DELETE" });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
  } catch (e) {
    return down(e);
  }
}
