import * as Sentry from "@sentry/nextjs";

// Client init (docs/research/sentry.md items 3, 4, 8, 10): tracing, Session Replay with privacy
// masking on, the canvas capture for the map/deck.gl screen, and the feedback widget so a judge
// can file "this looks wrong" during the demo. Session replay stays at 0 background sample rate --
// the free plan's 50 replays/month is the tightest quota here -- and records only when an error
// fires, or when a judge presses "Record this" on the /live top bar
// (components/live/RecordButton.tsx calls Sentry.getReplay()?.start()).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
  environment: process.env.NEXT_PUBLIC_ATLAS_ENV || "hackathon",
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
    Sentry.replayCanvasIntegration(), // MapLibre/deck.gl render to <canvas>; without this the map
                                       // screen replays as a blank rectangle
    Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
