import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname, "..") },
  // The demo is opened from another machine over Tailscale. Without this, `next dev` refuses the
  // cross-origin requests for /_next/* and the page never hydrates: every control looks dead.
  // For the demo itself prefer `npm run build && npm run start`, which has no HMR socket at all.
  allowedDevOrigins: ["100.95.223.110", "*.ts.net", "*.local", "192.168.*.*", "100.*.*.*"],
};

// Source maps: without this a production stack trace reads "at t (chunk-4f2a.js:1:38291)"
// instead of the real component (docs/research/sentry.md item 9). Silent unless SENTRY_AUTH_TOKEN
// is set (it is, in .env, but only build-time/CI -- never shipped to the browser bundle).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_WEB || "atlas-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
