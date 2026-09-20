"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-6 py-16">
    <h1 className="cond text-3xl font-semibold">The desk could not load this page</h1>
    <p className="mt-3 text-dim">The API may be restarting or unreachable. Try again once the API indicator is green.</p>
    <div className="mt-6 flex gap-4"><button onClick={reset} className="border border-ochre px-4 py-2 text-ochre">Try again</button><Link href="/live" className="border border-edge px-4 py-2">Open recorded demo</Link></div>
  </main>;
}
