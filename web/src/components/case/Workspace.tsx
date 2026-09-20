"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Workspace.module.css";

export type CasePanel = { id: string; title: string; node: ReactNode; defaultVisible?: boolean };
type Layout = { order: string[]; hidden: string[]; wide: string[] };
const STORAGE = "pixie-case-layout-v1";

export function Workspace({ header, panels }: { header: ReactNode; panels: CasePanel[] }) {
  const initial = (): Layout => ({ order: panels.map((p) => p.id), hidden: panels.filter((p) => !p.defaultVisible).map((p) => p.id), wide: [] });
  const [layout, setLayout] = useState<Layout>(initial);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  const focusButton = useRef<HTMLButtonElement | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (saved && typeof saved === "object" && "order" in saved && "hidden" in saved && "wide" in saved) {
        const valid = (v: unknown): v is string[] => Array.isArray(v) && v.every((id) => typeof id === "string");
        if (valid(saved.order) && valid(saved.hidden) && valid(saved.wide)) {
          const ids = panels.map((p) => p.id);
          setLayout({ order: [...new Set([...saved.order.filter((id) => ids.includes(id)), ...ids])], hidden: saved.hidden.filter((id) => ids.includes(id)), wide: saved.wide.filter((id) => ids.includes(id)) });
        }
      }
    } catch { /* Storage can be disabled in private browser contexts. */ }
    ready.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: Layout) => {
    setLayout(next);
    if (ready.current) {
      try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { setNotice("Layout changed for this visit; browser storage is unavailable."); }
    }
  };
  const ids = [...layout.order.filter((id) => panels.some((p) => p.id === id)), ...panels.filter((p) => !layout.order.includes(p.id)).map((p) => p.id)];
  const visible = ids.filter((id) => !layout.hidden.includes(id));
  const move = (id: string, to: string) => {
    if (id === to) return;
    const order = [...ids];
    const index = order.indexOf(to);
    order.splice(order.indexOf(id), 1);
    order.splice(index, 0, id);
    update({ ...layout, order });
    setNotice(`${panels.find((p) => p.id === id)?.title} moved.`);
  };
  const leaveFocus = () => { setFocus(null); requestAnimationFrame(() => focusButton.current?.focus()); };
  useEffect(() => {
    if (!focus) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setFocus(null); requestAnimationFrame(() => focusButton.current?.focus()); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  return (
    <main className={styles.workspace}>
      <header className={styles.identity}>{header}</header>
      <div className={styles.toolbar}>
        {focus ? <button onClick={leaveFocus}>Back to all panels</button> : <>
          <button onClick={() => { update(initial()); setNotice("Demo layout restored."); }}>Demo layout</button>
          <details ref={menu} className={styles.panelMenu}>
            <summary>Panels <span>{visible.length}/{panels.length}</span></summary>
            <div className={styles.menuItems}>
              {panels.map((panel) => <label key={panel.id}><input type="checkbox" checked={!layout.hidden.includes(panel.id)} onChange={(e) => update({ ...layout, hidden: e.target.checked ? layout.hidden.filter((id) => id !== panel.id) : [...layout.hidden, panel.id] })} />{panel.title}</label>)}
              <button onClick={() => { update({ ...layout, hidden: [] }); if (menu.current) menu.current.open = false; }}>Show all panels</button>
            </div>
          </details>
        </>}
        <a href="/method">Scoring method</a>
        <span role="status" className={styles.status}>{notice}</span>
      </div>
      <div className={`${styles.grid} ${focus ? styles.focused : ""}`}>
        {ids.map((id) => {
          const panel = panels.find((p) => p.id === id)!;
          const hidden = layout.hidden.includes(id) || (!!focus && focus !== id);
          const position = visible.indexOf(id);
          return <section key={id} data-panel={id} hidden={hidden} className={`${styles.tile} ${layout.wide.includes(id) ? styles.wide : ""} ${target === id ? styles.dropTarget : ""} ${dragged === id ? styles.dragging : ""}`}
            onDragOver={(e) => { if (!dragged || dragged === id) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setTarget(id); }}
            onDrop={(e) => { e.preventDefault(); if (dragged) move(dragged, id); setDragged(null); setTarget(null); }}>
            <header className={styles.tileHeader}>
              {!focus && <button type="button" className={styles.handle} draggable aria-label={`Move ${panel.title}`} title="Drag to move. Arrow keys move earlier or later."
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; setDragged(id); }}
                onDragEnd={() => { setDragged(null); setTarget(null); }}
                onKeyDown={(e) => { const offset = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0; if (offset && visible[position + offset]) { e.preventDefault(); move(id, visible[position + offset]); } }}>
                <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true"><path d="M3 3h1m4 0h1M3 9h1m4 0h1M3 15h1m4 0h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>}
              <h2>{panel.title}</h2>
              <div className={styles.tileActions}>
                {!focus && <details><summary aria-label={`Options for ${panel.title}`} title="Panel options">•••</summary><div className={styles.options}>
                  <button disabled={position === 0} onClick={() => move(id, visible[position - 1])}>Move earlier</button>
                  <button disabled={position === visible.length - 1} onClick={() => move(id, visible[position + 1])}>Move later</button>
                  <button onClick={() => update({ ...layout, wide: layout.wide.includes(id) ? layout.wide.filter((key) => key !== id) : [...layout.wide, id] })}>{layout.wide.includes(id) ? "Standard width" : "Full width"}</button>
                  <button onClick={() => update({ ...layout, hidden: [...layout.hidden, id] })}>Hide panel</button>
                </div></details>}
                <button aria-label={focus ? `Close focus on ${panel.title}` : `Focus ${panel.title}`} onClick={(event) => { if (focus) leaveFocus(); else { focusButton.current = event.currentTarget; setFocus(id); window.scrollTo({ top: 0, behavior: "instant" }); } }}>{focus ? "Close" : "Focus"}</button>
              </div>
            </header>
            {!hidden && <div className={styles.body}>{panel.node}</div>}
          </section>;
        })}
        {!visible.length && <p className={styles.empty}>All panels are hidden. Choose Panels or restore the Demo layout.</p>}
      </div>
    </main>
  );
}
