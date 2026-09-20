"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/components/bits";
import { StatusBar } from "@/components/desk/Kbd";
import { MethodEquation } from "@/components/case/MethodEquation";
import { useKeys } from "@/components/desk/keys";
import { api, type GuidelineDiff, type GuidelineDoc, type GuidelineEdit, type Pred } from "@/lib/api";

/**
 * The carrier's appetite, as a document you can edit (docs/GUIDELINE.md).
 *
 * D1 reads it the way the rest of the desk reads everything: a fixed-height terminal, the document
 * on the left in a monospaced table, the controls on the right, and a diff that lands in the same
 * place every time so the eye already knows where to look when the book re-ranks. Five scenarios
 * carry the keys 1 to 5, `a` applies, `d` discards, `r` restores the filed guideline.
 */

const MONEY_FACTS = new Set(["tiv", "premium", "loss_5yr"]);
const BAND_TONE: Record<string, string> = {
  target: "border-moss/50 bg-moss/10 text-moss",
  acceptable: "border-ochre/50 bg-ochre/10 text-ochre",
  not_acceptable: "border-rust/60 bg-rust/10 text-rust",
};
const BTN =
  "shrink-0 border border-edge px-2.5 text-[11px] uppercase leading-[23px] tracking-[0.08em] text-dim transition-colors duration-150 hover:border-ochre hover:text-ochre disabled:border-rule disabled:text-faint disabled:hover:border-rule";

// ---------- editing the document: one path for hand edits and for scenario buttons --------------

function applyEdit(doc: GuidelineDoc, e: GuidelineEdit): GuidelineDoc {
  const next: GuidelineDoc = structuredClone(doc);
  if (e.kind === "threshold") next.thresholds[e.key] = e.value;
  else if (e.kind === "cap") next.hardFailCap = e.value;
  else if (e.kind === "points") next.points[e.key] = e.value;
  else {
    const band = next.factors.find((f) => f.fact === e.fact)?.bands.find((b) => b.band === e.band);
    if (band) band.pred = { [e.op]: e.value } as Pred;
  }
  return next;
}

const num = (x: unknown) => (typeof x === "number" ? x : Number(x));

/** A number inside a sentence: type it, or hold the arrow keys. Styled as text, not as a form field. */
function Edge({ value, fact, onChange, label }: { value: number; fact: string; onChange: (n: number) => void; label: string }) {
  const cash = MONEY_FACTS.has(fact);
  return (
    <span className="inline-flex items-baseline">
      <input
        type="number"
        value={value}
        step={cash ? 5000 : 1}
        aria-label={label}
        // Controlled on the document's own number: a scenario key and a keystroke both land here.
        // An empty or unparseable field keeps the last good value rather than writing NaN.
        onChange={(ev) => Number.isFinite(ev.target.valueAsNumber) && onChange(ev.target.valueAsNumber)}
        className={`num ${cash ? "w-[12ch]" : "w-[8ch]"} border-b border-dashed border-edge bg-transparent px-0.5 text-center text-[11px] text-ink focus:border-solid focus:border-ochre focus:outline-none`}
      />
      {cash && value >= 1000 && <span className="ml-1 text-[10px] text-faint">{money(value)}</span>}
    </span>
  );
}

/** The state list, as chips. Click × to drop one, type two letters and press Enter to add one. */
function States({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {values.map((s) => (
        <span key={s} className="num inline-flex items-center gap-1 border border-rule bg-land px-1 text-[10px] leading-[15px]">
          {s}
          <button onClick={() => onChange(values.filter((v) => v !== s))} aria-label={`remove ${s}`} className="text-faint hover:text-rust">
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        maxLength={2}
        placeholder="+"
        aria-label="add a state"
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || draft.length !== 2 || values.includes(draft)) return;
          e.preventDefault();
          onChange([...values, draft]);
          setDraft("");
        }}
        className="num w-[3.5ch] border border-dashed border-edge bg-transparent text-center text-[10px] leading-[15px] text-ink placeholder:text-faint focus:border-solid focus:border-ochre focus:outline-none"
      />
    </span>
  );
}

/** One band of one factor, rendered as the guideline's own sentence with its numbers editable. */
function Band({ fact, band, pred, onPred }: { fact: string; band: string; pred: Pred; onPred: (p: Pred) => void }) {
  const set = (op: string, value: unknown) => onPred({ [op]: value } as Pred);
  let body: React.ReactNode;
  if ("else" in pred) body = <span className="text-faint">anything else</span>;
  else if ("between" in pred) {
    const [lo, hi] = pred.between as [number, number];
    body = (
      <>
        <Edge fact={fact} value={lo} label={`${fact} ${band} lower edge`} onChange={(n) => set("between", [n, hi])} />{" "}
        <span className="text-faint">to</span>{" "}
        <Edge fact={fact} value={hi} label={`${fact} ${band} upper edge`} onChange={(n) => set("between", [lo, n])} />
      </>
    );
  } else if ("in" in pred) body = <States values={pred.in as string[]} onChange={(v) => set("in", v)} />;
  else if ("eq" in pred) body = <span className="num text-ink">{String(pred.eq)}</span>;
  else if ("share_gt" in pred) {
    const [share, types] = pred.share_gt as [number, string[]];
    body = (
      <span className="text-dim">
        over <span className="num text-ink">{Math.round(share * 100)}%</span> of TIV in {types.join(", ")}
      </span>
    );
  } else {
    const op = (["lte", "lt", "gte", "gt"] as const).find((k) => k in pred)!;
    const word = { lte: "at most", lt: "under", gte: "at least", gt: fact === "year_built" ? "built after" : "over" }[op];
    body = (
      <>
        <span className="text-faint">{word}</span>{" "}
        <Edge fact={fact} value={num(pred[op])} label={`${fact} ${band} edge`} onChange={(n) => set(op, n)} />
      </>
    );
  }
  return (
    <>
      <span className={`w-[112px] shrink-0 whitespace-nowrap border px-1 text-center text-[10px] uppercase leading-[17px] tracking-[0.05em] ${BAND_TONE[band]}`}>
        {band.replace("_", " ")}
      </span>
      <span className="min-w-0 text-[12px]">{body}</span>
    </>
  );
}

// ---------- the thresholds: the two lines every decision is measured against ---------------------

function Thresholds({ doc, onEdit }: { doc: GuidelineDoc; onEdit: (e: GuidelineEdit) => void }) {
  const { decline, accept } = doc.thresholds;
  const cap = doc.hardFailCap ?? 0;
  return (
    <>
      {/* the same three zones the interval bar paints behind every score on the desk */}
      <div className="relative h-[42px] select-none border border-rule bg-paper">
        {(
          [
            ["Decline", 0, decline, "bg-rust/12", "text-rust"],
            ["Review", decline, accept, "bg-ochre/12", "text-ochre"],
            ["Accept", accept, 100, "bg-moss/12", "text-moss"],
          ] as const
        ).map(([label, from, to, fill, tone]) => (
          <div
            key={label}
            className={`absolute inset-y-0 flex flex-col items-center justify-center ${fill}`}
            style={{ left: `${from}%`, width: `${Math.max(to - from, 0)}%` }}
          >
            <span className={`whitespace-nowrap px-1 text-[10px] uppercase tracking-[0.08em] ${tone}`}>{to - from > 16 ? label : ""}</span>
            <span className="num whitespace-nowrap text-[9px] text-faint">
              {from}–{to}
            </span>
          </div>
        ))}
        {[decline, accept].map((at) => (
          <div key={at} aria-hidden className="absolute inset-y-0 border-l border-ink" style={{ left: `${at}%` }} />
        ))}
        <div aria-hidden className="absolute inset-y-0 border-l border-dashed border-rust" style={{ left: `${cap}%` }}>
          {/* right-anchored, so the sentence stays inside the decline zone instead of crossing a divider */}
          <span className="num absolute bottom-0 right-1 hidden whitespace-nowrap text-[9px] text-rust sm:block">cap {cap}</span>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
        {(
          [
            ["threshold", "decline", decline, "decline at"],
            ["threshold", "accept", accept, "accept at"],
            ["cap", "cap", cap, "hard-fail cap"],
          ] as const
        ).map(([kind, key, value, label]) => (
          <label key={label} className="flex items-center gap-1.5">
            <span className="kicker">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              aria-label={label}
              onChange={(e) =>
                onEdit(kind === "cap" ? { kind: "cap", value: Number(e.target.value) } : { kind: "threshold", key: key as "decline" | "accept", value: Number(e.target.value) })
              }
              className="h-3 w-[128px] appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-edge [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-[13px] [&::-webkit-slider-thumb]:w-[8px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[1px] [&::-webkit-slider-thumb]:bg-ochre"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={value}
              aria-label={`${label}, typed`}
              onChange={(e) =>
                onEdit(kind === "cap" ? { kind: "cap", value: Number(e.target.value) } : { kind: "threshold", key: key as "decline" | "accept", value: Number(e.target.value) })
              }
              className="num w-[4.5ch] border-b border-dashed border-edge bg-transparent text-center text-[11px] text-ink focus:border-solid focus:border-ochre focus:outline-none"
            />
          </label>
        ))}
      </div>
    </>
  );
}

// ---------- the diff: what the edit did to the book ---------------------------------------------

function Diff({ diff }: { diff: GuidelineDiff }) {
  const moves = Object.entries(diff.counts).map(([k, n]) => `${n} ${k.replace("->", " became ")}`);
  const line = [
    ...moves,
    diff.valueIntoQueue > 0 ? `${money(diff.valueIntoQueue)} into the queue` : "",
    diff.valueOutOfQueue > 0 ? `${money(diff.valueOutOfQueue)} out of the queue` : "",
  ].filter(Boolean);
  return (
    <section aria-labelledby="diff-h" className="flex min-h-0 flex-1 flex-col border-t border-edge">
      <h2 id="diff-h" className="kicker flex items-baseline justify-between border-b border-rule px-3 py-1.5">
        <span className="text-ochre">What changed</span>
        <span className="num normal-case tracking-normal text-faint">
          {diff.casesScored} re-scored in {diff.ms} ms
        </span>
      </h2>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <p className={`cond text-[20px] font-semibold leading-tight ${diff.tierChanges ? "text-ochre" : "text-dim"}`}>
          {diff.tierChanges === 0
            ? `No decision changed. ${diff.changed} of ${diff.casesScored} cases re-banded.`
            : `${diff.tierChanges} case${diff.tierChanges === 1 ? "" : "s"} changed decision`}
        </p>
        {line.length > 0 && <p className="mt-0.5 text-[11px] text-dim">{line.join(" · ")}</p>}
        <p className="mt-0.5 text-[10px] leading-snug text-faint">{diff.change.join("; ") || "restored to the file on disk"}</p>

        {diff.cases.length > 0 && (
          <ul className="mt-2 border-t border-rule">
            {diff.cases.slice(0, 10).map((c) => (
              <li key={c.caseId} className="border-b border-rule py-1">
                <p className="flex items-baseline gap-2 text-[11px]">
                  <a href={`/cases/${c.caseId}`} className="num w-[40px] shrink-0 text-dim underline-offset-2 hover:text-ochre hover:underline">
                    #{c.caseId}
                  </a>
                  <span className="cond min-w-0 flex-1 truncate text-[12px] text-ink" title={c.insured}>
                    {c.insured}
                  </span>
                  {c.tierChanged ? (
                    <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.06em] text-ochre">
                      {c.tierBefore} → {c.tierAfter}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-faint">{c.tierAfter}, unchanged</span>
                  )}
                  <span className="num w-[52px] shrink-0 text-right text-dim">{money(c.valueAtStake)}</span>
                </p>
                <p className="pl-[48px] text-[10px] leading-snug text-faint">
                  {c.factors
                    .map((f) => `${f.fact.replaceAll("_", " ")}: ${f.from.join("/").replaceAll("_", " ")} → ${f.to.join("/").replaceAll("_", " ")}`)
                    .join("; ") || "no band moved"}
                  <span className="num">
                    {" · "}
                    {c.scoreBefore ? `${c.scoreBefore.lo}–${c.scoreBefore.hi}` : "—"} → {c.scoreAfter ? `${c.scoreAfter.lo}–${c.scoreAfter.hi}` : "—"}
                  </span>
                </p>
              </li>
            ))}
            {diff.cases.length > 10 && (
              <li className="py-1 text-[10px] text-faint">and {diff.cases.length - 10} more, each one in its own case ledger</li>
            )}
          </ul>
        )}
        {diff.rankMoves.length > 0 && (
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-[11px]">
            <span className="kicker">Queue order</span>
            {diff.rankMoves.map((m) => (
              <span key={m.caseId} className="num text-ink">
                #{m.caseId} <span className="text-faint">{m.from}→</span>
                {m.to}
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- the page ----------------------------------------------------------------------------

export default function GuidelinePage() {
  const [server, setServer] = useState<GuidelineDoc | null>(null); // what the desk is scoring with
  const [doc, setDoc] = useState<GuidelineDoc | null>(null); // what is on screen
  const [diff, setDiff] = useState<GuidelineDiff | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState<string | null>(null);
  const live = useRef(true);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    live.current = true;
    api.guideline().then((g) => {
      if (g && live.current) {
        setServer(g);
        setDoc(g);
      } else if (live.current) setError("The guideline could not be loaded. Check the API connection and try again.");
      if (live.current) setLoading(false);
    });
    return () => {
      live.current = false;
    };
  }, [attempt]);

  const pending = useMemo(() => {
    if (!doc || !server) return { any: false, n: 0, bands: new Set<string>(), thresholds: false };
    const bands = new Set<string>();
    for (const f of doc.factors) {
      const was = server.factors.find((x) => x.fact === f.fact);
      for (const b of f.bands) {
        const wasBand = was?.bands.find((x) => x.band === b.band);
        if (JSON.stringify(wasBand?.pred) !== JSON.stringify(b.pred)) bands.add(`${f.fact}.${b.band}`);
      }
    }
    const thresholds = JSON.stringify(doc.thresholds) !== JSON.stringify(server.thresholds) || doc.hardFailCap !== server.hardFailCap;
    return { any: bands.size > 0 || thresholds, n: bands.size + (thresholds ? 1 : 0), bands, thresholds };
  }, [doc, server]);

  const edit = (e: GuidelineEdit) => setDoc((d) => (d ? applyEdit(d, e) : d));

  const apply = async () => {
    if (!doc || busy) return;
    setBusy(true);
    const r = await api.putGuideline(doc);
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.detail);
    setError("");
    setServer(r.data.guideline);
    setDoc(r.data.guideline);
    setDiff(r.data.diff);
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    const r = await api.resetGuideline();
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.detail);
    setError("");
    setRan(null);
    setServer(r.data.guideline);
    setDoc(r.data.guideline);
    setDiff(r.data.diff.changed > 0 ? r.data.diff : null);
  };

  const discard = () => {
    setDoc(server);
    setRan(null);
    setError("");
  };

  // The key bus already ignores keystrokes aimed at an input, so 1-5 stay safe while a state or a
  // band edge is being typed. `!leader` keeps `g a` (ask) and `g b` (proof) working from here.
  useKeys(
    (e, leader) => {
      if (leader) return false;
      const n = Number(e.key);
      if (doc && n >= 1 && n <= doc.scenarios.length) {
        const s = doc.scenarios[n - 1];
        setDoc((d) => (d ? s.edits.reduce(applyEdit, d) : d));
        setRan(s.id);
        return true;
      }
      if (e.key === "a" && pending.any) return void apply(), true;
      if (e.key === "d" && pending.any) return discard(), true;
      if (e.key === "r") return void reset(), true;
      return false;
    },
    [doc, pending.any, server, busy],
  );

  if (!doc || !server)
    return (
      <main className="guideline-page grid h-[calc(100dvh-40px)] place-items-center text-[12px] text-dim">
        <section className="max-w-lg px-6" aria-live="polite">
          {loading ? <><p>Loading the guideline…</p><div className="mt-4 h-40 animate-pulse bg-land motion-reduce:animate-none" /></> : <><p role="alert">{error}</p><button className="mt-4 border border-ochre px-4 py-2 text-ochre" onClick={() => { setLoading(true); setError(""); setAttempt((n) => n + 1); }}>Try again</button></>}
        </section>
      </main>
    );

  const tiles = [
    { label: "rules", value: String(server.factors.length), sub: "factors in force" },
    { label: "decline / accept", value: `${server.thresholds.decline} / ${server.thresholds.accept}`, sub: "under, and at or over" },
    { label: "hard-fail cap", value: String(server.hardFailCap ?? "—"), sub: "break a hard rule, score no higher" },
    { label: "pending", value: String(pending.n), sub: "edits the desk is not scoring yet" },
  ];

  return (
    <main className="guideline-page grid h-[calc(100dvh-40px)] grid-rows-[68px_minmax(0,1fr)_26px] overflow-hidden">
      <header className="flex items-stretch border-b border-edge bg-land">
        <div className="flex min-w-[230px] flex-col justify-center border-r border-edge px-4">
          <p className="kicker text-ochre">Active guideline</p>
          <h1 className="cond mt-1 text-[20px] font-semibold leading-none text-ink">2025 commercial property</h1>
          <p className="mt-1 text-[9px] text-faint">{server.id} · {server.hash}</p>
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="flex min-w-[112px] shrink-0 flex-col justify-center border-r border-rule px-3.5">
            <span className="kicker">{t.label}</span>
            <span className={`num text-[18px] font-medium leading-[21px] ${t.label === "pending" && pending.n ? "text-ochre" : "text-ink"}`}>{t.value}</span>

          </div>
        ))}
        <span className="flex-1" />
        <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-rule px-3">
          <span
            className={`border px-1.5 text-[9px] uppercase leading-[15px] tracking-[0.1em] ${
              server.edited ? "border-ochre bg-ochre text-paper" : "border-edge text-faint"
            }`}
          >
            {server.edited ? "edited" : "as filed"}
          </span>
          <button onClick={reset} disabled={busy} className={BTN}>
            restore filed
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------ the document ------------------------------ */}
        <div className="min-h-0 overflow-y-auto border-r border-edge">
          <section aria-labelledby="th-h" className="border-b border-rule px-6 py-5">
            <h2 id="th-h" className="kicker mb-1.5 flex items-baseline gap-2">
              <span>Decision thresholds</span>
              {pending.thresholds && <Pendant />}
              <Link href="/method" className="ml-auto normal-case tracking-normal text-ochre hover:underline">Scoring method</Link>
            </h2>
            <Thresholds doc={doc} onEdit={edit} />
          </section>

          <section aria-labelledby="equation-h" className="border-b border-rule px-6 py-5">
            <h2 id="equation-h" className="kicker">Scoring equation · active rules</h2>
            <MethodEquation rules={server} />
          </section>

          <section aria-labelledby="fa-h" className="px-6 py-5">
            <h2 id="fa-h" className="kicker mb-1 flex items-baseline gap-2">
              <span>Factors</span>

            </h2>
            <table className="w-full border-collapse">
              <caption className="sr-only">Every factor in the guideline, its bands and the test each band applies.</caption>
              <tbody>
                {doc.factors.map((f) => (
                  <FactorRows
                    key={f.fact}
                    f={f}
                    pending={pending.bands}
                    onEdit={(band, p) => edit({ kind: "band", fact: f.fact, band, op: Object.keys(p)[0], value: Object.values(p)[0] })}
                  />
                ))}
              </tbody>
            </table>

          </section>
        </div>

        {/* --------------------------- scenarios and diff --------------------------- */}
        <div className="flex min-h-0 flex-col">
          <section aria-labelledby="sc-h" className="shrink-0 px-3 py-2">
            <h2 id="sc-h" className="kicker mb-1">
              Scenarios
            </h2>
            <ul>
              {doc.scenarios.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setDoc((d) => (d ? s.edits.reduce(applyEdit, d) : d));
                      setRan(s.id);
                    }}
                    title={s.note}
                    className={`flex w-full items-baseline gap-2 border-b border-rule py-3 pl-1.5 text-left transition-colors duration-150 hover:bg-land ${
                      ran === s.id ? "bg-raise" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`cond block text-[13px] font-semibold ${ran === s.id ? "text-ochre" : "text-ink"}`}>{s.label}</span>

                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {error && (
            <p role="alert" className="mx-3 mb-2 shrink-0 border-l-2 border-rust bg-rust/10 px-2 py-1 text-[11px] leading-snug text-rust">
              <span className="kicker mr-1.5 text-rust">Refused</span>
              {error}
            </p>
          )}

          <div className="flex shrink-0 items-center gap-2 border-y border-rule bg-land px-3 py-1.5">
            {pending.any ? (
              <>
                <span className="min-w-0 flex-1 text-[11px]">
                  <b className="text-ochre">
                    {pending.n} pending edit{pending.n === 1 ? "" : "s"}
                  </b>

                </span>
                <button onClick={apply} disabled={busy} className={`${BTN} border-ochre text-ochre hover:bg-ochre hover:text-paper`}>
                  {busy ? "re-scoring…" : "apply"}
                </button>
                <button onClick={discard} disabled={busy} className={BTN}>
                  discard
                </button>
              </>
            ) : (
              <span className="text-[11px] text-faint">No pending changes</span>
            )}
          </div>

          {diff ? (
            <Diff diff={diff} />
          ) : (
            <p className="flex-1 px-3 py-2 text-[11px] leading-snug text-faint">
              No changes applied.
            </p>
          )}
        </div>
      </div>

      <StatusBar
        left={
          <>
            <span className="text-ochre">RULES</span>
            <span className="num">
              {server.id} · {server.hash}
            </span>
            <span className={server.edited ? "text-ochre" : "text-dim"}>{server.edited ? "edited in memory, the file on disk is untouched" : "as filed"}</span>
          </>
        }
      />
    </main>
  );
}

/** One factor: a header row, then one row per band. A table, because the bands are a table. */
function FactorRows({
  f,
  pending,
  onEdit,
}: {
  f: GuidelineDoc["factors"][number];
  pending: Set<string>;
  onEdit: (band: string, p: Pred) => void;
}) {
  return (
    <>
      <tr className="border-t border-edge">
        <th scope="rowgroup" colSpan={2} className="pb-2 pt-5 text-left">
          <span className="flex items-baseline gap-2">
            <span title={f.source} className="cond text-[17px] font-semibold text-ink">{f.label}</span>
            {f.hardFail && (
              <span title="a not-acceptable value here caps the whole score" className="border border-rust/60 px-1 text-[9px] uppercase leading-[13px] tracking-[0.06em] text-rust">
                hard fail
              </span>
            )}
            {f.routes && (
              <span title="a not-acceptable value here sends the case to another desk" className="border border-dashed border-edge px-1 text-[9px] uppercase leading-[13px] tracking-[0.06em] text-faint">
                routes
              </span>
            )}
            {f.bands.some((b) => pending.has(`${f.fact}.${b.band}`)) && <Pendant />}
            <span className="num ml-auto hidden text-[10px] font-normal text-faint xl:inline">{f.source}</span>
          </span>
        </th>
      </tr>
      {f.bands.map((b) => (
        <tr key={b.band} className="border-t border-rule">
          <td colSpan={2} className={pending.has(`${f.fact}.${b.band}`) ? "border-l-2 border-ochre pl-1.5" : "pl-[8px]"}>
            <span className="flex flex-wrap items-baseline gap-3 py-2">
              <Band fact={f.fact} band={b.band} pred={b.pred} onPred={(p) => onEdit(b.band, p)} />
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

function Pendant() {
  return (
    <span className="border border-ochre bg-ochre-soft px-1 text-[9px] uppercase leading-[13px] tracking-[0.06em] text-ochre">pending</span>
  );
}
