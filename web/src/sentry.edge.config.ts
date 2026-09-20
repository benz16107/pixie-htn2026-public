import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN_WEB || process.env.SENTRY_DSN_APP,
  tracesSampleRate: 1.0,
  environment: process.env.ATLAS_ENV || "hackathon",
});
