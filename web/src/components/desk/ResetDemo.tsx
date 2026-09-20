"use client";
import { useState } from "react";
import { api } from "@/lib/api";
export function ResetDemo() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <span className="flex shrink-0 items-center gap-2">
    <button disabled={busy} title="Restore all decisions, broker replies, overrides and guideline edits for the next demo" className="border border-edge px-2 py-0.5 text-[10px] disabled:opacity-50" onClick={async () => {
      setBusy(true); setError(""); const r = await api.demoReset();
      if (r.ok) window.location.reload(); else { setError(r.status); setBusy(false); }
    }}>{busy ? "Resetting…" : "Reset demo"}</button>
    {error && <span role="alert" className="text-rust">{error}</span>}
  </span>;
}
