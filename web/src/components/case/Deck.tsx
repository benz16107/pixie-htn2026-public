"use client";
import { useState } from "react";
import { useKeys } from "../desk/keys";

export type Panel = { id: string; label: string; count?: string; node: React.ReactNode };

/** The bottom deck. One panel at a time; the number keys still select them, unprinted. */
export function Deck({ panels }: { panels: Panel[] }) {
  const [on, setOn] = useState(panels[0]?.id);

  useKeys(
    (e) => {
      const i = Number(e.key);
      if (i >= 1 && i <= panels.length) return setOn(panels[i - 1].id), true;
      return false;
    },
    [panels.length, panels.map((p) => p.id).join()],
  );

  return (
    <section className="grid min-h-0 grid-rows-[25px_minmax(0,1fr)]" aria-label="Case detail">
      <div role="tablist" aria-label="Case detail" className="flex items-stretch border-b border-rule">
        {panels.map((p) => (
          <button
            key={p.id}
            role="tab"
            id={`deck-${p.id}`}
            aria-selected={on === p.id}
            aria-controls={`deckpanel-${p.id}`}
            onClick={() => setOn(p.id)}
            className={`flex items-center gap-1.5 border-r border-rule px-3.5 text-[11px] uppercase tracking-[0.1em] transition-colors duration-150 ${
              on === p.id ? "bg-raise text-ochre shadow-[inset_0_-2px_0_var(--color-ochre)]" : "text-dim hover:bg-land hover:text-ink"
            }`}
          >
            {p.label}
            {p.count && <span className="num normal-case tracking-normal text-faint">{p.count}</span>}
          </button>
        ))}
      </div>
      {panels.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`deckpanel-${p.id}`}
          aria-labelledby={`deck-${p.id}`}
          hidden={on !== p.id}
          className="min-h-0 overflow-auto"
        >
          {p.node}
        </div>
      ))}
    </section>
  );
}
