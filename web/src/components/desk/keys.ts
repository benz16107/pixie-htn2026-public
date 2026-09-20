"use client";
import { useEffect } from "react";

export type KeyHandler = (e: KeyboardEvent, leader: string | null) => boolean;

/**
 * One key bus for the whole desk. Handlers run newest-first and claim an event by returning
 * true; whatever is left sets or clears the `g` leader, so `g q` works from any page without
 * every screen growing its own listener and its own idea of what `g` means.
 */
const handlers: KeyHandler[] = [];
let leader: string | null = null;
let leaderAt = 0;
let wired = false;

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || !!el?.isContentEditable;
};

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector("dialog[open]")) return;
    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement | null)?.closest("button, a")) return;
    const active = Date.now() - leaderAt < 1400 ? leader : null;
    leader = null;
    for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i](e, active)) return;
    if (e.key === "g") {
      leader = "g";
      leaderAt = Date.now();
    }
  });
}

/** `deps` follows the usual rule: list everything the handler closes over. */
export function useKeys(fn: KeyHandler, deps: unknown[]) {
  useEffect(() => {
    wire();
    handlers.push(fn);
    return () => {
      const i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
