import { API } from "@/lib/live";
export const dynamic = "force-dynamic";
async function proxy(
  req: Request,
  ctx: RouteContext<"/api/intact/evidence/[...path]">,
) {
  const { path } = await ctx.params;
  if (
    path[0] !== "consumer" ||
    path[1] !== "incidents" ||
    path.some((p) => !/^[a-zA-Z0-9-]+$/.test(p))
  )
    return Response.json({ detail: "Unknown evidence route" }, { status: 404 });
  try {
    const headers = new Headers();
    if (req.headers.has("range"))
      headers.set("range", req.headers.get("range")!);
    if (req.method === "POST") headers.set("content-type", "application/json");
    const upstream = await fetch(`${API}/${path.join("/")}`, {
      method: req.method,
      headers,
      body: req.method === "POST" ? await req.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const out = new Headers({
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    for (const key of [
      "content-type",
      "content-disposition",
      "content-range",
      "accept-ranges",
      "content-length",
    ])
      if (upstream.headers.has(key)) out.set(key, upstream.headers.get(key)!);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return Response.json(
      {
        detail:
          "The evidence service is unavailable. Your action was not confirmed.",
      },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
