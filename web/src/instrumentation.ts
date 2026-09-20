import * as Sentry from "@sentry/nextjs";

// Server + edge runtime init (docs/research/sentry.md item 3). Client init lives in
// instrumentation-client.ts -- Next.js loads that one itself, this file only covers the two
// runtimes it can't reach from the browser bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
