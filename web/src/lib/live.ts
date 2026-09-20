import type { DeskEvent, Interval, QueueRow } from "@/contract";
import { parseHazard, parseSkip, prettyBands, signed } from "./format";

export const API = process.env.ATLAS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
/** The browser talks to the API through the same-origin proxy in app/api/atlas. */
export const PROXY = "/api/atlas";

/** The live queue carries a region and may have no interval at all (routed or tenant). */
export type Row = Omit<QueueRow, "score"> & { score: Interval | null; region?: "us" | "toronto"; label?: string };

export type CaseState = {
  row: Row;
  status: "waiting" | "working" | "settled";
  events: DeskEvent[];
  score: Interval | null;
  modelSteps: number;
  costUsd?: number;
  ms?: number;
  /** Cases the desk decided in code alone never open an event stream. */
  codeOnly: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Model-driven steps: everything an agent wrote, excluding the deterministic system log. */
export const isModelStep = (e: DeskEvent) => e.actor !== "system" && e.kind !== "tool_call" && e.kind !== "run_stats";

/** Bookkeeping the desk writes for itself: useful as numbers, noise as cards. */
export const isPlumbing = (e: DeskEvent) => e.kind === "run_stats";

export function foldScore(events: DeskEvent[], fallback: Interval | null): Interval | null {
  const last = [...events].reverse().find((e) => e.kind === "assessment" && e.body.score);
  return (last?.body.score as Interval | undefined) ?? fallback;
}

export type Chat = { id: string; who: string; line: string; tone: "plain" | "ask" | "answer" | "conflict" | "decision" };

/** One readable English line per event worth reading aloud. Silent on plumbing. */
export function chatLine(e: DeskEvent): Chat | null {
  const b = e.body;
  const text = prettyBands(str(b.text));
  const who = e.actor.charAt(0).toUpperCase() + e.actor.slice(1);
  const mk = (line: string, tone: Chat["tone"] = "plain"): Chat => ({ id: e.id, who, line, tone });
  switch (e.kind) {
    case "plan":
      return mk(text.replace(/^Deep dive \((\w+)\):\s*/i, (_, d) => `is going deep (${d}). `));
    case "ask":
      return mk(`asks ${e.to}: “${str(b.question) || text}”`, "ask");
    case "answer":
      return mk(`answers ${e.to}: ${text}`, "answer");
    case "estimate":
      return mk(`estimates ${text}`);
    case "finding": {
      if (b.skipped) {
        const s = parseSkip(str(b.skipped), text);
        return mk(`skipped the ${s.peril.toLowerCase()} lookup: ${s.reason}`);
      }
      if (/\(x[\d.]+,\s*[+-]?[\d.]+\s*pts\)/i.test(text)) {
        const h = parseHazard(text);
        return mk(`found ${h.peril.toLowerCase()}: ${h.sentence} (×${h.multiplier?.toFixed(2)}, ${signed(h.points ?? 0)} pts)`);
      }
      return mk(`found ${text}`);
    }
    case "assessment":
      return mk(text.replace(/^Re-assessed:/, "re-scored").replace(/^Triage/, "triaged"));
    case "conflict":
      return mk(`flags a conflict: ${text}`, "conflict");
    case "resolution": {
      const [, choice = "", why = ""] = text.match(/->\s*([a-z_]+):\s*(.*)$/i) ?? [];
      return mk(`resolves it by ${choice.replaceAll("_", " ")}. ${why}`, "decision");
    }
    case "decision":
      return mk(text, "decision");
    case "action":
      return mk(`${text} (${str(b.status)})`, "decision");
    case "query_retry":
      return mk(`had a query rejected: ${str(b.error).replace(/^\[\w+\]\s*/, "")}, and rewrote it`);
    case "note":
      return mk(text);
    case "run_stats":
    case "tool_call":
      return null;
    default:
      return text ? mk(text) : null;
  }
}

/** One plain line for the caption strip: what the desk is doing right now. */
export function nowLine(e: DeskEvent | undefined, running: boolean): string {
  if (!e) return running ? "Starting the desk…" : "The desk is idle. This line narrates every step once it runs.";
  const who = e.actor.charAt(0).toUpperCase() + e.actor.slice(1);
  const text = prettyBands(str(e.body.text));
  switch (e.kind) {
    case "plan":
      return `${who} is planning: ${text.replace(/^Deep dive \((\w+)\):\s*/i, "")}`;
    case "ask":
      return `${who} is asking ${e.to}: ${str(e.body.question) || text}`;
    case "answer":
      return `${who} is answering ${e.to}`;
    case "estimate":
      return `${who} is estimating ${text}`;
    case "finding":
      return `${who} found ${text}`;
    case "tool_call":
      return `${who} is running ${str(e.body.tool).replaceAll("_", " ")}`;
    case "assessment":
      return `${who} re-scored the case: ${text}`;
    case "conflict":
      return `The desk hit a conflict: ${text}`;
    case "resolution":
      return `${who} resolved it: ${text}`;
    case "decision":
      return `${who} decided: ${text}`;
    case "action":
      return `${who} is sending: ${text}`;
    default:
      return text || `${who} is working`;
  }
}
