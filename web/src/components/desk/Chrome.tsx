"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ResetDemo } from "./ResetDemo";
import { IntactPresentation, rememberIntactDemoPage } from "@/app/intact/present/IntactPresentation";
import { Presentation, rememberDemoPage } from "@/app/present/Presentation";

const FEDERATO_DESTS = [
  { href: "/queue", label: "submissions", title: "Cases that need an underwriting decision" },
  { href: "/map", label: "portfolio", title: "Geographic concentration and active insured value" },
  { href: "/guideline", label: "rulebook", title: "The active property guideline and proposed edits" },
  { href: "/backtest", label: "validation", title: "How the rulebook compares with historical outcomes" },
];

const INTACT_DESTS = [
  { href: "/intact/insurer", label: "insurer", title: "Driver and witness evidence, review, and exports" },
  { href: "/intact", label: "overview", title: "Renter quote volume and advisor handoff" },
  { href: "/intact/quotes", label: "advisor desk", title: "Ready estimates and quotes that need advisor review" },
];

/** The desk frame and the product switch shared by both product modes. */
export function Chrome() {
  const path = usePathname();
  const [presenting, setPresenting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const intact = path.startsWith("/intact");

  useEffect(() => {
    if (path.startsWith("/intact")) rememberIntactDemoPage();
    else if (path !== "/present") rememberDemoPage();
  }, [path]);

  useEffect(() => {
    const element = dialog.current;
    if (presenting) element?.showModal();
    return () => element?.close();
  }, [presenting]);

  useEffect(() => {
    const present = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (path === "/present" || path === "/intact/present" || event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
          target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']") ||
          document.querySelector("dialog[open]")) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (intact) rememberIntactDemoPage(); else rememberDemoPage();
        setPresenting(true);
      }
    };
    window.addEventListener("keydown", present, true);
    return () => window.removeEventListener("keydown", present, true);
  }, [path, intact]);

  useEffect(() => {
    document.documentElement.dataset.product = intact ? "intact" : "federato";
    return () => {
      delete document.documentElement.dataset.product;
    };
  }, [intact]);

  const presentation = presenting && <dialog ref={dialog} aria-label="Pixie presentation"
    className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0"
    onCancel={() => setPresenting(false)}>
    {intact ? <IntactPresentation onDismiss={() => setPresenting(false)} /> : <Presentation onDismiss={() => setPresenting(false)} />}
  </dialog>;

  if (path === "/present" || path === "/intact/present") return null;
  if (path.startsWith("/live")) return presentation;

  return (<>
      <header className={`desk-chrome product-chrome flex h-[40px] items-stretch border-b border-edge bg-land text-[11px] ${intact ? "intact-chrome" : ""}`}>
        <span className="flex items-center border-r border-edge px-3 font-semibold tracking-[0.18em] text-ink">PIXIE</span>
        <div className="product-switch flex items-center gap-0.5 border-r border-edge px-1" role="group" aria-label="Product mode">
          <Link href="/queue" aria-current={!intact ? "page" : undefined} className={!intact ? "product-switch-on" : ""}>
            Federato
          </Link>
          <Link href="/intact" aria-current={intact ? "page" : undefined} className={intact ? "product-switch-on" : ""}>
            Intact
          </Link>
        </div>
        <nav aria-label="Main" className="flex shrink-0">
          {(intact ? INTACT_DESTS : FEDERATO_DESTS).map((d) => {
            const on = intact
              ? d.href === "/intact" ? path === "/intact" : path.startsWith(d.href)
              : path.startsWith(d.href) || (d.href === "/queue" && path.startsWith("/cases"));
            return (
              <Link
                key={d.href}
                href={d.href}
                title={d.title}
                aria-current={on ? "page" : undefined}
                className={`flex items-center border-r border-rule px-3.5 uppercase tracking-[0.1em] transition-colors duration-150 ${
                  on ? "bg-raise text-ochre shadow-[inset_0_-2px_0_var(--color-ochre)]" : "text-dim hover:bg-raise hover:text-ink"
                }`}
              >
                {d.label}
              </Link>
            );
          })}
        </nav>
        <span className="chrome-status ml-auto flex shrink-0 items-center gap-3 pr-3 text-[10px] text-dim">
          <button onClick={() => { if (intact) rememberIntactDemoPage(); else rememberDemoPage(); setPresenting(true); }} title="Toggle presentation (P)">Present <kbd>P</kbd></button>
          {!intact && <ResetDemo />}
          {process.env.NEXT_PUBLIC_FIXTURES === "1" && <span className="text-ochre">BUNDLED SAMPLES</span>}
        </span>
      </header>
      {presentation}
  </>);
}
