import { notFound } from "next/navigation";
import { api, type CaseWithReceipt } from "@/lib/api";
import { explainCase, isTenantExplain, precedentFor, sensitivityOf, surfaceOf, type Challenge, type PriceStep } from "@/lib/explain";
import { bandPhrase, factorValue, whenLabel } from "@/lib/format";
import { CaseMap } from "@/components/LiveMap";
import { HazardCard, PortfolioCallout } from "@/components/CaseParts";
import { Receipt } from "@/components/Receipt";
import { Swimlanes } from "@/components/Swimlanes";
import { PriceWaterfall, Waterfall } from "@/components/case/Waterfall";
import { Views } from "@/components/case/Views";
import { Calculation } from "@/components/case/Calculation";
import { Challenger, PrecedentPanel } from "@/components/case/Sidebar";
import { CaseNav } from "@/components/case/CaseNav";
import { CaseContext } from "@/components/geography/CaseContext";
import { Workspace, type CasePanel } from "@/components/case/Workspace";
import { Override } from "@/components/case/Override";
import { Memory } from "@/components/case/Memory";
import { BandScale, bandTone, DecisionChip, IntervalBar, IssueTag, ProvenanceBadge, THRESHOLDS } from "@/components/bits";
import { PercentileLine } from "@/components/BookInsights";

/** The guideline's own reading of a fact, shown only when it differs from the fact as displayed. */
function reads(display: string, asRead?: string) {
  if (!asRead) return "";
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return norm(asRead) === norm(display) || norm(display).includes(norm(asRead)) ? "" : ` · the guideline reads this as ${asRead}`;
}

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const [c, events, hexes, pins, explain, sens, precedent, surface, memory] = await Promise.all([
    api.case(id),
    api.events(id),
    api.mapBook("all"),
    api.mapPins(),
    explainCase(id),
    sensitivityOf(id),
    precedentFor(id),
    surfaceOf(id),
    api.memory(id),
  ]);
  const percentile = await api.percentile(id);
  if (!c) notFound();
  const view = c as CaseWithReceipt & { challenge?: Challenge; deskVerdict?: string };
  const pin = pins.find((p) => p.caseId === view.caseId);
  const place = view.facts.find((f) => f.id === "primary_admin" || f.id === "state")?.display;
  // The slider is denominated in dollars, so it may only ever be handed a money fact. Once the broker
  // answers on premium the mover can become something like business type, and a dollar slider under
  // "what if the submission type were" is nonsense: better to drop the slider than to mislabel it.
  const MONEY = new Set(["premium", "tiv", "loss_5yr"]);
  const premium =
    sens?.facts.find((f) => f.fact === "premium" && f.movesDecision) ?? sens?.facts.find((f) => f.movesDecision && MONEY.has(f.fact));
  // Start the slider where the case actually stands: the estimate the desk is working from.
  const dollars = (explain?.steps.find((s) => s.key === premium?.fact)?.value ?? "").match(/\$[\d,]+/g)?.map((d) => Number(d.replace(/[$,]/g, ""))) ?? [];
  const startAt = dollars.length ? Math.round(dollars.reduce((a, b) => a + b, 0) / dollars.length) : Math.round(((premium?.low.value ?? 0) + (premium?.high.value ?? 0)) / 2);
  const verdict = view.deskVerdict?.replaceAll("_", " ");
  const tenant = isTenantExplain(explain);
  // The explanation drives the waterfall and what-if control. Use its current-rule score for the
  // headline too, so a case saved under an older guideline cannot show two baselines on one screen.
  const displayScore = tenant ? view.score : explain?.score ?? view.score;
  // /guideline can move these two numbers, so the ruler reads the guideline this case was scored by.
  const bands = explain?.thresholds ?? THRESHOLDS;
  // Memory only has something to say on a case the desk has worked more than once.
  const remembered = memory && memory.recalled.length > 0 ? memory : null;


  const panels: CasePanel[] = [
    {
      id: "score", title: tenant ? "Price & scenarios" : "Appetite & what-if", defaultVisible: true,
      node: <section className="case-score" aria-label="How the score was built">
        <div className="case-score-top">
          <div>
            <p className="kicker">{tenant ? "Annual price" : "Engine appetite range"}</p>
            <p className={`num mt-2 text-[42px] leading-none ${bandTone(displayScore, bands)}`}>
              {tenant ? `$${explain.annual.toFixed(2)}` : displayScore ? displayScore.lo === displayScore.hi ? displayScore.lo : `${displayScore.lo}–${displayScore.hi}` : "Not scored"}
            </p>
          </div>
          {view.override && <div><p className="kicker">Underwriter adjustment</p><p className="num mt-2 text-[28px]">{view.override.score.lo}–{view.override.score.hi}</p></div>}
          {!tenant && displayScore && <div><IntervalBar score={displayScore} t={bands} /><BandScale t={bands} className="mt-2" /></div>}
        </div>
        {tenant ? <>
          <div className="score-chart-scroll"><div className="score-chart flex flex-col"><PriceWaterfall steps={explain.steps as unknown as PriceStep[]} annual={explain.annual} label={explain.label} /></div></div>
          {view.receipt && <Receipt r={view.receipt} />}
        </> : explain && explain.steps.length > 0 ? <Views
          caseId={view.caseId} surface={surface} sensitivity={sens}
          before={{ score: explain.score, decision: explain.decision.kind }}
          whatIf={premium ? { fact: premium.fact, label: premium.label, start: startAt } : null}
          waterfall={<Waterfall x={explain} />}
          calculation={<Calculation x={explain} />}
        /> : <p className="case-prose py-8 text-dim">{view.decision.kind === "routed" ? view.decision.because : "No scored steps for this case."}</p>}
        {view.kind === "commercial" && view.score && <details className="border-t border-rule pt-3 text-[12px]"><summary className="cursor-pointer text-dim">Underwriter adjustment {view.override ? "· applied" : "· ±5"}</summary><div className="mt-3"><Override caseId={view.caseId} current={view.override} bound={view.override?.bound ?? 5} /></div></details>}
      </section>,
    },
    {
      id: "challenge", title: "Challenger", defaultVisible: true,
      node: view.challenge ? <Challenger c={view.challenge} deskVerdict={view.deskVerdict} rulesDecision={view.decision.kind} /> : <div className="case-prose text-dim"><p>No recorded challenge for this case.</p><a className="mt-4 inline-block text-ochre" href="/live">Open agent desk</a></div>,
    },
    {
      id: "facts", title: "Facts & sources", defaultVisible: true,
      node: <table className="case-facts"><caption className="sr-only">Facts, provenance and sources</caption><tbody>
        {view.facts.map((f) => {
          const factor = view.factors.find((item) => item.fact === f.id);
          return <tr key={f.id}><th scope="row">{f.label}</th><td>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className={`num ${f.provenance === "missing" ? "text-rust" : "text-ink"}`}>{f.display}</span><ProvenanceBadge p={f.provenance} short /></div>
            <details><summary>Source</summary><p>{f.resolver ? `${f.resolver} resolves · ` : ""}{f.source}{reads(f.display, factor && factorValue(f.id, factor.valueText))}</p></details>
          </td></tr>;
        })}
      </tbody></table>,
    },
    {
      id: "decision", title: "Decision & conflicts", defaultVisible: true,
      node: <div>
        <p className="case-prose">{view.explanation}</p>
        {view.explanationVerified && <p className="mt-3 text-[11px] text-moss">Numbers checked against the case</p>}
        {view.contradictions.map((conflict, index) => <details key={index} className="mt-5 border-t border-rule pt-4 text-[13px]"><summary className="cursor-pointer text-ochre">Conflicting evidence</summary><dl className="mt-4 space-y-3 leading-relaxed"><div><dt className="text-dim">Supports the case</dt><dd>{conflict.good.map(bandPhrase).join("; ")}</dd></div><div><dt className="text-dim">Against the case</dt><dd>{conflict.bad.map(bandPhrase).join("; ")}</dd></div></dl></details>)}
        {percentile && <div className="mt-5 border-t border-rule pt-4"><PercentileLine p={percentile} /></div>}
      </div>,
    },
    {
      id: "site", title: "Site, hazards & nearby exposure",
      node: <div>
        {view.site && (view.site.lat !== 0 || view.site.lng !== 0) ? <div className="case-site-map"><CaseMap site={view.site} zoom={view.kind === "tenant" ? 13.5 : 8.2} hexes={hexes} home={pin?.ring} /></div> : <p className="case-prose text-dim">No confirmed coordinates for this case.</p>}
        <div className="case-site-evidence">{view.portfolio && <PortfolioCallout p={view.portfolio} />}<HazardCard risk={view.risk} /></div>
        {!view.risk.factors.length && !view.risk.skipped.length && <p className="mt-4 text-[13px] text-dim">No recorded hazard investigation.</p>}
      </div>,
    },
    { id: "geography", title: "Climate & geographic context", node: <CaseContext caseId={view.caseId} /> },
    {
      id: "precedent", title: "Comparable risks",
      node: precedent?.hits.length ? <PrecedentPanel p={precedent} /> : <p className="case-prose text-dim">No comparable risks returned for this case.</p>,
    },
    {
      id: "activity", title: `Agent activity · ${events.length} events`,
      node: events.length ? <div className="case-activity"><Swimlanes events={events} initialScore={view.scoreWithoutEnrichment ?? view.score} laneH={72} controls pad="p-0" heading="" /></div> : <p className="case-prose text-dim">{view.kind === "tenant" ? "This quote was calculated in code. No agent review is recorded." : "No agent run recorded for this case."}</p>,
    },
    {
      id: "trail", title: "Issues & action history",
      node: <div className="text-[13px] leading-relaxed">
        {view.issues.length ? <ul className="space-y-4">{view.issues.map((issue, index) => <li key={index}><IssueTag {...issue} /><p className="mt-2 text-dim">{issue.text}</p></li>)}</ul> : <p className="text-dim">No data issues.</p>}
        <div className="mt-5 border-t border-rule pt-4">{view.actions.length ? <ul className="space-y-3">{view.actions.map((action) => <li key={action.key}><span className="text-ink">{action.key.replaceAll("_", " ")}</span> · {action.channel} · {action.status} · {whenLabel(action.at)}</li>)}</ul> : <p className="text-dim">No outbound actions recorded.</p>}</div>
      </div>,
    },
    ...(remembered ? [{ id: "memory", title: "Previous reviews", node: <Memory m={remembered} /> }] : []),
  ];
  return <Workspace key={view.caseId} panels={panels} header={<>
    <CaseNav caseId={view.caseId} kind={view.kind} place={place} />
    <h1>{view.title}</h1>
    <DecisionChip decision={view.decision} large />
    {verdict && verdict !== view.decision.kind && <span className="border border-ochre/50 px-3 py-1.5 text-[12px] text-ochre">Desk: {verdict}</span>}
  </>} />;
}
