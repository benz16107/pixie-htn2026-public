"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeskEvent } from "@/contract";
import { PROXY, foldScore, isModelStep, type CaseState, type Row } from "@/lib/live";
export type Speed = 1 | 2 | 4;
type Options = { rows: Row[]; recorded: Record<string, number>; offlineEvents: Record<string, DeskEvent[]>; apiUp: boolean };
const blank = (row: Row, recorded: number): CaseState => ({ row, status: "waiting", events: [], score: row.score, modelSteps: 0, codeOnly: recorded === 0 });
const closed = (e: DeskEvent) => (e.kind === "note" || e.kind === "budget_note") && typeof e.body.calls === "number";
function fold(c: CaseState, events: DeskEvent[]): CaseState {
  const stats = [...events].reverse().find((e) => (e.kind === "note" || e.kind === "budget_note" || e.kind === "run_stats") && typeof e.body.cost_usd === "number")?.body;
  return { ...c, events, status: events.some(closed) ? "settled" : events.length ? "working" : "waiting", score: foldScore(events, c.row.score), modelSteps: events.filter(isModelStep).length, costUsd: stats?.cost_usd as number | undefined };
}
export function useRun({ rows, recorded, offlineEvents, apiUp }: Options) {
  const [cases, setCases] = useState<Record<string, CaseState>>({});
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState<Speed>(2);
  const [source, setSource] = useState<"replay" | "live">("replay");
  const [error, setError] = useState("");
  const streams = useRef<EventSource[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(0);
  const generation = useRef(0);
  const current = useRef<{ ids: string[]; mode: "replay" | "live" } | null>(null);
  const loaded = useRef<Record<string, DeskEvent[]>>({});
  const stop = useCallback(() => {
    generation.current++;
    streams.current.forEach((s) => s.close()); streams.current = [];
    timers.current.forEach(clearTimeout); timers.current = [];
    setRunning(false);
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((Date.now() - started.current) * (source === "replay" ? speed : 1)), 100);
    return () => clearInterval(id);
  }, [running, source, speed]);
  const push = useCallback((id: string, e: DeskEvent) => {
    setCases((prev) => {
      const c = prev[id];
      if (!c || c.events.some((x) => x.id === e.id)) return prev;
      return { ...prev, [id]: fold(c, [...c.events, e].sort((a, b) => a.seq - b.seq)) };
    });
  }, []);
  const start = useCallback(async (requested: string[], mode: "replay" | "live" = "replay", sp: Speed = speed) => {
    stop();
    const token = generation.current;
    const ids = requested.filter((id) => rows.some((r) => r.caseId === id));
    if (!ids.length) return;
    const active = () => token === generation.current;
    setError(""); setSource(mode); setElapsed(0); setRunning(true);
    started.current = Date.now(); current.current = { ids, mode }; loaded.current = {};
    const initial = Object.fromEntries(ids.map((id) => [id, blank(rows.find((r) => r.caseId === id)!, mode === "live" ? 1 : recorded[id] ?? 0)]));
    setCases(initial);
    const replay = async () => {
      const pairs = await Promise.all(ids.map(async (id) => {
        if (!apiUp) return [id, offlineEvents[id] ?? []] as const;
        const res = await fetch(`${PROXY}/cases/${id}/events`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`Could not load the recording for case ${id}. Try the replay again.`);
        return [id, await res.json() as DeskEvent[]] as const;
      }));
      if (!active()) return;
      setSource("replay"); current.current = { ids, mode: "replay" };
      loaded.current = Object.fromEntries(pairs); started.current = Date.now();
      let duration = 0;
      for (const [id, evs] of pairs) {
        const t0 = evs[0]?.tMs ?? 0;
        duration = Math.max(duration, (evs.at(-1)?.tMs ?? t0) - t0);
        for (const e of evs) timers.current.push(setTimeout(() => { if (active()) push(id, e); }, (e.tMs - t0) / sp));
        if (!evs.length) timers.current.push(setTimeout(() => { if (active()) setCases((p) => ({ ...p, [id]: { ...p[id], status: "settled" } })); }, 100));
      }
      timers.current.push(setTimeout(() => { if (active()) { setElapsed(duration); setRunning(false); } }, duration / sp + 150));
    };
    try {
      if (mode === "replay") { await replay(); return; }
      if (!apiUp) throw new Error("The API is offline. Choose Replay to use the stored run.");
      const res = await fetch(`${PROXY}/desk/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseIds: ids, mode: "live" }), signal: AbortSignal.timeout(15000) });
      const body = await res.json();
      if (!active()) return;
      if (!res.ok) throw new Error(body.detail ?? `Live run failed (${res.status}).`);
      if (body.mode === "replay") { setError("The API is in offline mode. Showing the recorded run."); await replay(); return; }
      if (!body.runId) throw new Error("The API did not return a live run id.");
      const es = new EventSource(`${PROXY}/events/stream?cases=${ids.join(",")}&run_id=${encodeURIComponent(body.runId)}`);
      streams.current.push(es);
      es.addEventListener("desk", (ev) => {
        if (!active()) return;
        const e = JSON.parse((ev as MessageEvent).data) as DeskEvent;
        if (e.runId && e.runId !== body.runId) return;
        push(e.caseId, e);
      });
      es.addEventListener("done", () => { es.close(); if (active()) { setElapsed(Date.now() - started.current); setRunning(false); } });
      es.onerror = () => { es.close(); if (active()) { setError("The live connection ended. The result is incomplete; use Replay or start a new run."); setRunning(false); } };
    } catch (e) {
      if (active()) { setError(e instanceof Error ? e.message : "The run could not start."); setRunning(false); }
    }
  }, [apiUp, offlineEvents, push, recorded, rows, speed, stop]);
  const seek = useCallback((ms: number) => {
    if (current.current?.mode !== "replay") return;
    stop(); setElapsed(ms);
    setCases((prev) => Object.fromEntries(Object.entries(prev).map(([id, c]) => {
      const evs = loaded.current[id] ?? [];
      const t0 = evs[0]?.tMs ?? 0;
      return [id, evs.length ? fold(blank(c.row, evs.length), evs.filter((e) => e.tMs - t0 <= ms)) : c];
    })));
  }, [stop]);
  const totals = useMemo(() => {
    const list = Object.values(cases);
    return { runMs: Math.max(0, ...list.map((c) => (c.events.at(-1)?.tMs ?? 0) - (c.events[0]?.tMs ?? 0))), steps: list.reduce((n, c) => n + c.modelSteps, 0), cost: list.reduce((n, c) => n + (c.costUsd ?? 0), 0), settled: list.filter((c) => c.status === "settled").length, total: list.length };
  }, [cases]);
  const changeSpeed = useCallback((s: Speed) => {
    setSpeed(s); const c = current.current;
    if (c?.mode === "replay" && running) void start(c.ids, c.mode, s);
  }, [running, start]);
  return { cases, setCases, start, stop, seek, running, elapsed, speed, setSpeed: changeSpeed, totals, source, error };
}
