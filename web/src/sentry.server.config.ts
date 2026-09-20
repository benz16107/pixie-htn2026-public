import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN_WEB doesn't exist yet (no third Sentry project has been created for the web app --
// docs/SENTRY.md explains this); reuse the same DSN as the app until Ben creates one.
Sentry.init({
  dsn: process.env.SENTRY_DSN_WEB || process.env.SENTRY_DSN_APP,
  tracesSampleRate: 1.0,
  enableLogs: true,
  environment: process.env.ATLAS_ENV || "hackathon",
});
