"use client";
import { useState } from "react";

/** Start a Sentry Session Replay on demand.
 *
 * Replay is configured with a 0 background sample rate (the free plan allows 50 replays a month),
 * so nothing is recorded until an error fires or someone presses this. A judge who sees something
 * wrong presses it, keeps going, and the replay is waiting in Sentry with everything masked. */
export function RecordButton() {
  const [state, setState] = useState<"idle" | "recording" | "unavailable">("idle");

  async function start() {
    const Sentry = await import("@sentry/nextjs");
    const replay = Sentry.getReplay();
    if (!replay) {
      setState("unavailable");
      return;
    }
    replay.start();
    Sentry.logger?.info?.("replay started from the live desk", { source: "record-button" });
    setState("recording");
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN || state === "unavailable") {
    return <span className="font-mono text-[10px] text-dim">no replay (DSN unset)</span>;
  }
  return (
    <button
      onClick={start}
      disabled={state === "recording"}
      title="Record this session to Sentry, with every field masked."
      className={`rounded-sm border px-2 py-0.5 ${
        state === "recording" ? "border-rust text-rust" : "border-edge hover:bg-raise"
      }`}
    >
      {state === "recording" ? "recording" : "Record this"}
    </button>
  );
}
