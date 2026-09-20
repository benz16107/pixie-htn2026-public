"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseOverride } from "@/contract";
import { api } from "@/lib/api";
import { useKeys } from "../desk/keys";

/**
 * The underwriter's bounded nudge of the engine's interval (docs/OVERRIDE.md). Dietvorst et al.
 * (2018): people use an imperfect model far more when they can move its output, even by a couple of
 * points. Plus and minus inside the bound, a reason that is required, and an undo.
 *
 * `ink` is this control's colour, here and on the waterfall's final bar. The engine owns amber,
 * jade and ember; the human owns plain ink, so on any screen you can tell whose number you are
 * looking at without reading a word. The engine's own interval never moves and sits beside it.
 */
export function Override({ caseId, current, bound = 5 }: { caseId: string; current?: CaseOverride; bound?: number }) {
  const router = useRouter();
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useKeys((e) => (e.key === "o" && !current ? (e.preventDefault(), field.current?.focus(), true) : false), [current]);

  const run = async (fn: () => Promise<{ ok: boolean; detail: string }>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setNote(r.ok ? "" : r.detail);
    if (r.ok) {
      setPoints(0);
      setReason("");
      router.refresh();
    }
  };

  if (current) {
    const when = new Date(current.at * 1000).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
    const moved = current.decision.kind !== current.engineDecision.kind;
    return (
      <div className="mt-1.5 flex flex-wrap items-baseline gap-3 border-y border-ink/40 bg-ink/[0.06] px-2 py-1 text-[11px]">
        <span className="kicker shrink-0 text-ink">Underwriter adjusted</span>
        <span className="num shrink-0 font-medium text-ink">
          {current.points > 0 ? "+" : "−"}
          {Math.abs(current.points)}
        </span>
        <span className="num shrink-0 text-dim">
          {current.engineScore.lo}–{current.engineScore.hi} → <span className="text-ink">{current.score.lo}–{current.score.hi}</span>
          {moved && (
            <>
              , {current.engineDecision.kind} → <span className="text-ink">{current.decision.kind}</span>
            </>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-dim" title={current.reason}>
          &ldquo;{current.reason}&rdquo;, {current.by} at {when}
        </span>
        <button
          onClick={() => run(() => api.clearOverride(caseId))}
          disabled={busy}
          className="shrink-0 border border-edge px-2 text-[10px] uppercase leading-[16px] tracking-[0.08em] text-dim transition-colors duration-150 hover:border-ink hover:text-ink disabled:text-faint"
        >
          undo
        </button>
      </div>
    );
  }

  const step = (d: number) => setPoints((p) => Math.max(-bound, Math.min(bound, p + d)));
  const btn =
    "shrink-0 border border-edge px-1.5 leading-[18px] transition-colors duration-150 hover:border-ink hover:text-ink disabled:border-rule disabled:text-faint";

  return (
    <form
      className="mt-1.5 flex flex-wrap items-center gap-2 border-y border-rule px-2 py-1 text-[11px]"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => api.override(caseId, points, reason));
      }}
    >
      <span className="kicker shrink-0" id="ov-h">
        Underwriter adjusts
      </span>
      <button type="button" className={btn} onClick={() => step(-1)} disabled={points <= -bound} aria-label="one point down">
        −
      </button>
      <span className="num w-[26px] shrink-0 text-center font-medium text-ink" aria-live="polite" aria-label={`adjustment ${points} points`}>
        {points > 0 ? `+${points}` : points}
      </span>
      <button type="button" className={btn} onClick={() => step(1)} disabled={points >= bound} aria-label="one point up">
        +
      </button>
      <input
        ref={field}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason required"
        aria-labelledby="ov-h"
        className="min-w-0 flex-1 border border-rule bg-paper px-1.5 leading-[18px] text-ink placeholder:text-faint focus:border-ochre focus:outline-none"
      />
      <span className="num shrink-0 whitespace-nowrap text-[10px] text-faint">±{bound} max</span>
      <button type="submit" className={`${btn} uppercase tracking-[0.08em]`} disabled={busy || points === 0 || !reason.trim()}>
        apply
      </button>
      {note && (
        <span role="status" className="max-w-[260px] shrink-0 truncate text-[10px] text-rust" title={note}>
          {note}
        </span>
      )}
    </form>
  );
}
