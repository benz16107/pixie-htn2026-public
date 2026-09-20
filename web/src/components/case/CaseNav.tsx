"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useKeys } from "../desk/keys";

/** The way back. `u` takes it too, listed in the `?` sheet rather than printed here. */
export function CaseNav({ caseId, kind, place }: { caseId: string; kind: string; place?: string }) {
  const router = useRouter();
  useKeys(
    (e) => {
      if (e.key === "u") return router.push("/queue"), true;
      return false;
    },
    [router],
  );
  return (
    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-dim">
      <Link href="/queue" className="hover:text-ochre">
        blotter
      </Link>
      <span className="text-faint">/</span>
      <span className="num normal-case tracking-normal text-ink">#{caseId}</span>
      <span className="text-faint">·</span>
      <span>{kind}</span>
      {place && (
        <>
          <span className="text-faint">·</span>
          <span>{place}</span>
        </>
      )}
    </p>
  );
}
