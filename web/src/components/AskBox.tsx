"use client";
import { useState } from "react";
import type { AskResult } from "@/contract";
import { api } from "@/lib/api";

const cell = (v: unknown, column: string) =>
  typeof v === "number" ? (/premium|tiv|incurred|amount|limit|value/i.test(column) ? `$${v.toLocaleString("en-US")}` : v.toLocaleString("en-US", { useGrouping: !/year|id/i.test(column) })) : v === false ? "no" : v === true ? "yes" : String(v ?? "");

function Attempt({ a, i, last }: { a: AskResult["attempts"][number]; i: number; last: boolean }) {
  const ok = !a.error && !a.lint.length;
  return (
    <li className="relative border-l border-rule pb-5 pl-6 last:pb-0">
      <span
        aria-hidden
        className={`absolute -left-[7px] top-0.5 grid size-[13px] place-items-center rounded-full border text-[9px] ${ok ? "border-moss bg-moss text-paper" : "border-rust bg-paper text-rust"}`}
      >
        {ok ? "✓" : "×"}
      </span>
      <p className="kicker flex items-baseline justify-between gap-3">
        <span>Attempt {i + 1}</span>
        {ok ? <span className="text-moss">ran, {a.rows} rows</span> : <span className="text-rust">{a.error ? "API rejected it" : "lint stopped it"}</span>}
      </p>
      <details className="mt-2 border border-rule bg-land">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11px] text-dim transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          View generated query <span aria-hidden className="ml-1 text-faint">+</span>
        </summary>
        <pre className="max-h-[360px] overflow-auto border-t border-rule p-3 font-mono text-[11px] leading-snug">{JSON.stringify(a.payload, null, 2)}</pre>
      </details>
      {a.lint.map((l) => (
        <p key={l} className="mt-1 text-[12px]"><span className="mr-1.5 font-mono text-[10px] text-ochre">LINT</span>{l}</p>
      ))}
      {a.error && (
        <p className="mt-1 font-mono text-[11px] text-rust"><span className="mr-1.5 text-[10px]">ERROR</span>{a.error}</p>
      )}
      {!ok && !last && <p className="mt-1.5 text-[12px] text-dim">Intake used this feedback to rewrite the next query.</p>}
    </li>
  );
}

export function AskBox({ canned }: { canned: string[] }) {
  const [q, setQ] = useState(canned[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(AskResult & { path?: string; total?: number }) | null>(null);
  const [miss, setMiss] = useState("");

  const ask = async (question: string) => {
    if (busy || !question.trim()) return;
    setQ(question);
    setBusy(true);
    setMiss("");
    const r = await api.ask(question.trim());
    setBusy(false);
    setRes(r ?? null);
    if (!r) setMiss("The API is unreachable and this question has no cached answer. Pick one of the questions below.");
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] xl:gap-12">
      <div>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q); }}>
          <label htmlFor="q" className="kicker">Question, in plain English</label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="question"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              aria-describedby={miss ? "q-miss" : undefined}
              aria-invalid={miss ? true : undefined}
              className="min-w-0 flex-1 rounded-sm border border-edge bg-paper px-3 py-2.5 text-[14px] placeholder:text-dim"
            />
            <button disabled={busy} className="rounded-sm border border-ochre bg-ochre px-5 text-[13px] font-medium text-paper transition-colors duration-150 hover:bg-ochre/85 disabled:opacity-60">
              {busy ? "Asking…" : "Ask"}
            </button>
          </div>
          {miss && <p id="q-miss" className="mt-1.5 text-[12px] text-rust">{miss}</p>}
        </form>
        <p className="kicker mt-4">Cached questions</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {canned.map((c) => (
            <li key={c}>
              <button
                disabled={busy}
                onClick={() => ask(c)}
                aria-pressed={res?.question === c}
                className={`rounded-sm border px-2.5 py-1 text-left text-[12px] transition-colors duration-150 ${res?.question === c ? "border-edge bg-land" : "border-rule hover:border-edge"}`}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
        {res && (
          <>
            <p className="kicker mt-8">Query trace</p>
            <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-dim">{res.rationale}</p>
            <ol className="mt-4 ml-1.5">
              {res.attempts.map((a, i) => <Attempt key={i} a={a} i={i} last={i === res.attempts.length - 1} />)}
            </ol>
          </>
        )}
      </div>

      <section aria-labelledby="ans-h">
        <div role="status" className="sr-only">{busy ? "Asking" : res ? `${res.rows.length} rows returned` : ""}</div>
        {!res && !busy && (
          <div className="border-l border-rule pl-6 pt-1 text-dim">
            <p className="cond text-[18px] text-ink">The answer will appear here.</p>
            <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed">Pick a cached question to show the answer, source rows, and the query corrections Intake made.</p>
          </div>
        )}
        {busy && <div className="mt-7 h-40 animate-pulse rounded-sm bg-land motion-reduce:animate-none" />}
        {res && !busy && (
          <>
            <h2 id="ans-h" className="kicker">Answer · {res.path === "sample" ? "bundled sample" : res.path === "cache" ? "cached result" : res.path === "live" ? "live query" : res.path === "offline" ? "offline" : "stored result"}</h2>
            <p className="mt-1.5 font-serif text-[22px] leading-snug">{res.answer}</p>
            <p className="mt-2 text-[13px] text-dim">
              <span className="num">{res.rows.length}</span> rows shown
              {typeof res.total === "number" && <> of <span className="num">{res.total}</span> matches</>}.
              {res.path === "sample" ? " These rows come from a bundled sample." : " Inspect the query and source rows below."}
            </p>
            <div className="mt-4 max-h-[520px] overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-paper">
                  <tr className="border-b border-edge">
                    {res.columns.map((c) => (
                      // Federato column names are dot-paths. Wrapping them keeps the table inside
                      // a 1280 screen; the full path stays on hover.
                      <th key={c} scope="col" title={c}
                          className="kicker max-w-[120px] break-words py-1.5 pr-4 text-left align-bottom font-normal normal-case leading-tight">
                        {c.replaceAll("_", " ").replaceAll(".", ". ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r, i) => (
                    <tr key={i} className="border-b border-rule">
                      {res.columns.map((c) => (
                        <td key={c} className={`py-1.5 pr-4 ${typeof r[c] === "number" ? "num" : ""}`}>{cell(r[c], c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
