const CONNECTOR = new Set(["then", "/", "+", "–", "-", "or"]);

/** "g then q / m" renders as keycaps with the joining words left as words. */
export function Kbd({ combo }: { combo: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {combo.split(" ").map((t, i) =>
        CONNECTOR.has(t) ? (
          <span key={i} className="text-[9px] text-faint">
            {t}
          </span>
        ) : (
          <kbd key={i} className="key">
            {t}
          </kbd>
        ),
      )}
    </span>
  );
}

/**
 * The line along the bottom of a full-height screen: what the screen is showing, and nothing else.
 *
 * It used to print this screen's shortcuts. Every key still works, and the `?` sheet in the top strip
 * still lists them; a demo audience reads the numbers, not the keycaps.
 */
export function StatusBar({ left }: { left: React.ReactNode }) {
  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-4 overflow-hidden border-t border-edge bg-land px-3 text-[10px] text-dim">
      <span className="flex min-w-0 shrink items-center gap-3 truncate">{left}</span>
    </footer>
  );
}
