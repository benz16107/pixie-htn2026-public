import Link from "next/link";
import { api } from "@/lib/api";
import { MethodEquation } from "@/components/case/MethodEquation";

export default async function MethodPage() {
  const rules = await api.guideline();
  if (!rules) return <main className="p-8" role="alert">The active guideline is unavailable. <Link href="/guideline" className="text-ochre underline">Open rulebook</Link></main>;
  return <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header className="border-b border-edge pb-6">
      <Link href="/guideline" className="text-[12px] text-ochre hover:underline">Back to rulebook</Link>
      <p className="kicker mt-6">{rules.id} · {rules.hash}</p>
      <h1 className="cond mt-2 text-4xl font-semibold text-ink">Scoring method</h1>
      <p className="mt-3 text-[14px] text-dim">Higher scores mean a closer fit to the carrier&apos;s appetite.</p>
    </header>
    <MethodEquation rules={rules} />
    <div className="mt-8 flex gap-6 border-t border-rule pt-5 text-[13px] text-ochre"><Link href="/cases/138">See case 138</Link><Link href="/queue?view=scored">Scored submissions</Link></div>
  </main>;
}
