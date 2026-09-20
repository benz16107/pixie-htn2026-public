import { AskBox } from "@/components/AskBox";
import { api } from "@/lib/api";

export default function AskPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-9 sm:px-10">
      <p className="font-mono text-[11px] text-dim">ASK · FEDERATO QUERY API</p>
      <h1 className="mt-1 font-serif text-[34px] font-semibold leading-tight">Ask the book a question</h1>
      <p className="mb-8 mt-2 max-w-[66ch] text-[14px] leading-relaxed text-dim">
        Intake turns the question into a Federato query. A lint pass catches array dot-paths and unexpanded references
        before the call, and API errors go back to Intake for a rewrite. Every attempt stays visible.
      </p>
      <AskBox canned={api.askCanned} />
    </main>
  );
}
