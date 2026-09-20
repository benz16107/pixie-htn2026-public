"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { slides } from "./slides";
import styles from "./Presentation.module.css";

const STORAGE_KEY = "pixie.deck.v2";
export const DEMO_PATH_KEY = "pixie.deck.demoPath";

export function rememberDemoPage() {
  try { sessionStorage.setItem(DEMO_PATH_KEY, window.location.pathname + window.location.search + window.location.hash); } catch { /* Storage is optional. */ }
}

function restoreIndex() {
  try {
    const value = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) ? Math.max(0, Math.min(slides.length - 1, value)) : 0;
  } catch { return 0; }
}

export function Presentation({ onDismiss }: { onDismiss?: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const slide = slides[index];

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setIndex(restoreIndex()); setReady(true); });
    return () => cancelAnimationFrame(frame);
  }, []);

  const go = useCallback((target: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, target));
    try { sessionStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Navigation works without storage. */ }
    setIndex(next);
  }, []);

  const toggle = useCallback(() => {
    if (onDismiss) return onDismiss();
    let path = "/queue?view=scored";
    try {
      const saved = sessionStorage.getItem(DEMO_PATH_KEY);
      if (saved && /^\/(queue|cases|guideline|map|backtest|method|intact|live)(?:[/?#]|$)/.test(saved)) path = saved;
    } catch { /* Use the submissions page when storage is unavailable. */ }
    router.push(path);
  }, [onDismiss, router]);

  useEffect(() => {
    if (!ready) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
          target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
      if ((event.key === "Enter" || event.key === " ") && target?.closest("button, a")) return;
      const key = event.key.toLowerCase();
      if (["arrowright", " ", "enter", "pagedown"].includes(key)) go(index + 1);
      else if (["arrowleft", "pageup"].includes(key)) go(index - 1);
      else if (key === "home") go(0);
      else if (key === "end") go(slides.length - 1);
      else if (key === "p" || key === "escape") toggle();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, ready, toggle]);

  return <div className={styles.deck} data-ready={ready}>
    <header className={styles.header}>
      <span className={styles.brand}>PIXIE <span>FEDERATO</span></span>
      <span className={styles.counter}>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
    </header>
    <main className={styles.stage} onClick={event => {
      if ((event.target as HTMLElement).closest("a, button") || window.getSelection()?.toString()) return;
      go(index + (event.clientX / window.innerWidth > 0.35 ? 1 : -1));
    }}>
      {ready && <article key={index} className={styles.slide}>
        <h1>{slide.title}</h1>
        <p className={styles.description}>{slide.description}</p>
        {slide.paragraphs && <div className={styles.details}>{slide.paragraphs.map(text => <p key={text}>{text}</p>)}</div>}
        {slide.sources && <div className={styles.sources}>{slide.sources.map(source =>
          <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</div>}
      </article>}
    </main>
    <footer className={styles.footer}>
      <div className={styles.progress} aria-label="Slide navigation">{slides.map((item, n) =>
        <button key={item.title} onClick={() => go(n)} aria-label={`Slide ${n + 1}: ${item.title}`} aria-current={index === n ? "step" : undefined}><span /></button>)}</div>
      <div className={styles.controls}>
        <div className={styles.navigation}>
          <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">←</button>
          <button onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next slide">→</button>
        </div>
        <button className={styles.toggle} onClick={toggle} disabled={!ready}>Demo <kbd>P</kbd></button>
      </div>
    </footer>
  </div>;
}
