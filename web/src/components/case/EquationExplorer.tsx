"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./Calculation.module.css";

type Term = { value: string; title: string; detail: ReactNode };
export type EquationTerms = Record<"points" | "ceiling" | "caps" | "hazards" | "portfolio" | "limits" | "result", Term>;

export function EquationExplorer({ terms }: { terms: EquationTerms }) {
  const [selected, setSelected] = useState<keyof EquationTerms | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const close = () => { setSelected(null); trigger.current?.focus(); };
  const term = (key: keyof EquationTerms) => <button type="button" className={styles.term}
    aria-label={`${terms[key].title}: ${terms[key].value}`} aria-expanded={selected === key}
    aria-controls={`${id}-detail`} onClick={(event) => { trigger.current = event.currentTarget; setSelected(selected === key ? null : key); }}>
    {terms[key].value}
  </button>;

  return <div onKeyDown={(event) => { if (event.key === "Escape" && selected) { event.stopPropagation(); close(); } }}>
    <div className={styles.interactiveEquation} aria-label="Interactive score equation">
      <span>round(</span>{term("limits")}<span>(</span>{term("caps")}<span>(100 × </span>
      {term("points")}<span> / </span>{term("ceiling")}<span>) </span>
      {term("hazards")}<span> </span>{term("portfolio")}<span>, 0, 100)) = </span>{term("result")}
    </div>
    <p className={styles.hint}>Select a term to see its calculation.</p>
    <div id={`${id}-detail`} hidden={!selected} className={styles.disclosure}>
      {selected && <><div className={styles.detailHeader}><h4>{terms[selected].title}</h4><button type="button" onClick={close} aria-label="Close calculation detail">Close</button></div>{terms[selected].detail}</>}
    </div>
  </div>;
}
