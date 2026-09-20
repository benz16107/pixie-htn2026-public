'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { intactSlides } from './slides';
import s from './IntactPresentation.module.css';

const POSITION = 'pixie.intact.deck.v1';
const DEMO = 'pixie.intact.deck.demo';

export function rememberIntactDemoPage() {
  const path = window.location.pathname + window.location.search + window.location.hash;
  if (/^\/intact(?:[/?#]|$)/.test(path) && !path.startsWith('/intact/present')) {
    try { sessionStorage.setItem(DEMO, path); } catch { /* The demo still works without storage. */ }
  }
}

function Journey() {
  return <ol className={s.journey} aria-label="The connected insurance journey">
    {[['Quote', 'Gather the facts'], ['Decide', 'Explore a choice'], ['Protect', 'Understand the risk'], ['Recover', 'Connect the evidence']].map(([title, detail], index) =>
      <li key={title}><span>0{index + 1}</span><strong>{title}</strong><small>{detail}</small></li>)}
  </ol>;
}

export function IntactPresentation({ onDismiss }: { onDismiss?: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState(false);
  const [clean, setClean] = useState(false);
  const [imageError, setImageError] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const notesButton = useRef<HTMLButtonElement>(null);
  const slide = intactSlides[index];
  const embedded = !!onDismiss;
  const expo = (process.env.NEXT_PUBLIC_EXPO_URL ?? 'http://macserver:8081').replace(/\/$/, '');
  const proofUrl = slide.phone ? `${expo}${slide.demo}` : slide.demo;

  useEffect(() => {
    let initial = -1;
    if (!embedded) initial = intactSlides.findIndex(item => `#${item.id}` === window.location.hash);
    if (initial < 0) {
      try { const saved = Number(sessionStorage.getItem(POSITION)); if (Number.isInteger(saved)) initial = saved; } catch { /* Start with the first slide. */ }
    }
    const restored = Math.max(0, Math.min(intactSlides.length - 1, initial));
    setIndex(restored);
    try { sessionStorage.setItem(POSITION, String(restored)); } catch { /* A deep link still works without storage. */ }
    setReady(true);
  }, [embedded]);

  const go = useCallback((target: number) => {
    const next = Math.max(0, Math.min(intactSlides.length - 1, target));
    setIndex(next);
    setImageError(false);
    stage.current?.scrollTo({ top: 0 });
    try { sessionStorage.setItem(POSITION, String(next)); } catch { /* Navigation does not depend on storage. */ }
    if (!embedded) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${intactSlides[next].id}`);
  }, [embedded]);

  useEffect(() => {
    if (embedded) return;
    const restoreHash = () => {
      const target = intactSlides.findIndex(item => `#${item.id}` === window.location.hash);
      if (target >= 0) go(target);
    };
    window.addEventListener('hashchange', restoreHash);
    return () => window.removeEventListener('hashchange', restoreHash);
  }, [embedded, go]);

  const demo = useCallback(() => {
    if (onDismiss) return onDismiss();
    let target = '/intact';
    try {
      const saved = sessionStorage.getItem(DEMO);
      if (saved && /^\/intact(?:[/?#]|$)/.test(saved) && !saved.startsWith('/intact/present')) target = saved;
    } catch { /* Fall back to the overview. */ }
    router.push(target);
  }, [onDismiss, router]);

  useEffect(() => {
    if (!ready) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' && target?.closest('button, a')) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowright' || key === ' ' || key === 'pagedown') go(index + 1);
      else if (key === 'arrowleft' || key === 'pageup') go(index - 1);
      else if (key === 'home') go(0);
      else if (key === 'end') go(intactSlides.length - 1);
      else if (key === 'n' && !clean) setNotes(value => !value);
      else if (key === 'r') { setNotes(false); setClean(value => !value); }
      else if (key === 'escape' && clean) setClean(false);
      else if (key === 'escape' && notes) { setNotes(false); notesButton.current?.focus(); }
      else if (key === 'p' || key === 'escape') demo();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, clean, notes, index, go, demo]);

  return <div className={`${s.deck} ${clean ? s.clean : ''}`} data-ready={ready}>
    <header className={s.header}>
      <span className={s.brand}>pixie<span>For the Intact challenge</span></span>
      <div className={s.headerActions}>
        <button ref={notesButton} aria-expanded={notes} aria-controls="intact-speaker-notes" onClick={() => setNotes(value => !value)}>Script <kbd>N</kbd></button>
        <button onClick={() => { setNotes(false); setClean(true); }}>Recording view <kbd>R</kbd></button>
        <button onClick={demo}>Demo <kbd>P</kbd></button>
      </div>
      {clean && <span className={s.cleanCounter}>{String(index + 1).padStart(2, '0')} / 08</span>}
    </header>
    <main ref={stage} className={s.stage} aria-label="Intact presentation">
      <article key={slide.id} className={`${s.slide} ${slide.visual === 'journey' ? s.closing : ''}`}>
        <div className={s.copy}>
          <p className={s.eyebrow}>{slide.chapter}<span>{slide.time.replace('–', ' to ')}</span></p>
          <h1>{slide.title}</h1>
          <p className={s.description}>{slide.description}</p>
          <p className={s.takeaway}>{slide.takeaway}</p>
          {index === 0 ? <Journey /> : null}
          {slide.id === 'witness' ? <ol className={s.evidenceFlow} aria-label="Evidence review steps"><li>Driver report</li><li>Witness upload</li><li>Insurer review</li><li>Credit preview</li></ol> : null}
          {slide.id === 'agent' ? <ol className={s.evidenceFlow} aria-label="Agent request steps"><li>Question</li><li>MCP tool</li><li>Calculation</li><li>Sourced result</li></ol> : null}
          <div className={s.proofAction}>
            <a href={proofUrl} target={slide.phone ? '_blank' : undefined} rel={slide.phone ? 'noopener noreferrer' : undefined}>{slide.demoLabel}<span aria-hidden="true">↗</span></a>
            <span>{slide.phone ? 'Phone browser preview opens in a new tab' : 'Press P in the demo to return here'}</span>
          </div>
        </div>
        {slide.visual === 'journey' ? <div className={s.finish}>
          <Journey />
          <div className={s.connections}><span>Consumer app</span><span>Shared evidence</span><span>MCP tools</span></div>
          <p className={s.finalLimit}>{slide.limit}</p>
        </div> : <figure className={`${s.proof} ${slide.visual === 'agent' ? s.webProof : ''}`}>
          {imageError ? <div role="status" className={s.imageFallback}>Product capture unavailable. Use “{slide.demoLabel}” to see the working feature.</div> : <img src={`/intact/presentation/${slide.visual}.png`} alt={slide.alt} onError={() => setImageError(true)} draggable={false} />}
          <figcaption>{slide.caption}<span>Captured product example</span></figcaption>
        </figure>}
      </article>
      <p className={s.boundary}>{slide.id === 'close' ? 'Pixie · Hack the North 2026 · Intact submission' : slide.limit}</p>
    </main>
    <footer className={s.footer}>
      <nav className={s.chapters} aria-label="Presentation chapters">{intactSlides.map((item, i) => <button key={item.id} onClick={() => go(i)} aria-label={`Slide ${i + 1}: ${item.chapter}`} aria-current={i === index ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{item.chapter}</button>)}</nav>
      <div className={s.transport}><span>{index + 1} of {intactSlides.length} · Three-minute draft</span><div><button disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous slide">←</button><button disabled={index === intactSlides.length - 1} onClick={() => go(index + 1)} aria-label="Next slide">→</button></div></div>
    </footer>
    {notes && !clean ? <aside id="intact-speaker-notes" className={s.notes} aria-label="Speaker notes">
      <div className={s.notesHead}><strong>{slide.time.replace('–', ' to ')} · {slide.seconds} seconds</strong><button onClick={() => { setNotes(false); notesButton.current?.focus(); }} aria-label="Close script">Close</button></div>
      <h2>Say</h2><p className={s.narration}>{slide.narration}</p>
      <h2>Show</h2><ol>{slide.shots.map(shot => <li key={shot}>{shot}</li>)}</ol>
      <h2>Keep accurate</h2><p>{slide.limit}</p>
      <p className={s.notesHint}>Record the phone separately. Close this script before capturing the slide.</p>
    </aside> : null}
    {clean ? <button className={s.exitClean} onClick={() => setClean(false)}>Show controls · R</button> : null}
    <span className={s.srOnly} aria-live="polite">Slide {index + 1} of {intactSlides.length}: {slide.chapter}</span>
  </div>;
}
