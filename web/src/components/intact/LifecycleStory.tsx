"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./LifecycleStory.module.css";

export type LifecycleStage = "quote" | "decide" | "protect" | "recover";

type SystemKey = "expo" | "api" | "mcp" | "handoff";
type GraphNode = { label: string; note: string; href: string; newTab?: boolean };

const SYSTEMS: { key: SystemKey; code: string; title: string; detail: string }[] = [
  { key: "expo", code: "S1", title: "Expo consumer app", detail: "Home + Auto routes" },
  { key: "api", code: "S2", title: "Deterministic API + risk data", detail: "Pricing, context, recovery" },
  { key: "mcp", code: "S3", title: "MCP agent interface", detail: "9 consent-limited tools" },
  { key: "handoff", code: "S4", title: "Advisor + recovery", detail: "Review before contact" },
];

const STAGES: {
  key: LifecycleStage;
  number: string;
  label: string;
  promise: string;
  summary: string;
  systems: SystemKey[];
  home: GraphNode[];
  auto: GraphNode[];
  shared?: GraphNode[];
}[] = [
  {
    key: "quote",
    number: "01",
    label: "Quote",
    promise: "Collect once",
    summary: "Sourced estimates with visible receipt lines.",
    systems: ["expo", "api", "mcp"],
    home: [{ label: "Tenant quote", note: "Illustrative tenant pricing", href: "/home-quote" }],
    auto: [{ label: "Vehicle comparison", note: "Corolla, CX-5, IONIQ 5", href: "/auto-compare" }],
  },
  {
    key: "decide",
    number: "02",
    label: "Decide",
    promise: "Change one fact",
    summary: "What-if inputs stay separate from confirmed facts.",
    systems: ["expo", "api", "mcp", "handoff"],
    home: [{ label: "Coverage what-if", note: "Contents coverage trade-off", href: "/decide?product=home" }],
    auto: [{ label: "Auto what-if", note: "Use, parking, deductible", href: "/auto-compare" }],
    shared: [{ label: "Advisor desk", note: "Human review of the same facts", href: "/intact/quotes", newTab: false }],
  },
  {
    key: "protect",
    number: "03",
    label: "Protect",
    promise: "Act before loss",
    summary: "Practical prevention continues after purchase.",
    systems: ["expo", "api", "mcp"],
    home: [{ label: "Home inventory", note: "Reviewed room and item record", href: "/home-inventory" }],
    auto: [{ label: "Driving context", note: "Coaching only, no pricing effect", href: "/driving-context" }],
  },
  {
    key: "recover",
    number: "04",
    label: "Recover",
    promise: "Connect the evidence",
    summary: "Safety steps and evidence stay under customer control.",
    systems: ["expo", "api", "mcp", "handoff"],
    home: [
      { label: "Property evidence", note: "Damage details + room context", href: "/recovery-plan?product=home" },
      { label: "Home recovery plan", note: "Local checklist + PDF", href: "/recovery-plan?product=home" },
    ],
    auto: [
      { label: "Driver evidence", note: "Incident + photos + footage", href: "/road-help?role=driver" },
      { label: "Witness perspectives", note: "Nearby requests + contributions", href: "/road-help?role=bystander" },
      { label: "Auto recovery plan", note: "Safety-first checklist + PDF", href: "/recovery-plan?product=auto" },
    ],
    shared: [{ label: "Insurer evidence desk", note: "Review perspectives + export files", href: "/intact/insurer", newTab: false }],
  },
];

const CONNECTIONS = STAGES.flatMap((stage, stageIndex) =>
  stage.systems.map((system) => ({
    system,
    stage: stage.key,
    sourceX: 125 + SYSTEMS.findIndex((item) => item.key === system) * 250,
    targetX: 125 + stageIndex * 250,
  })),
);

function expoPath(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

function updateLocation(stage: LifecycleStage) {
  const url = new URL(window.location.href);
  url.searchParams.set("stage", stage);
  url.searchParams.delete("product");
  window.history.replaceState({}, "", url);
}

function ProofNode({ node, expoUrl }: { node: GraphNode; expoUrl: string }) {
  const href = node.href.startsWith("/intact") ? node.href : expoPath(expoUrl, node.href);
  const content = (
    <>
      <strong>{node.label}</strong>
      <small>{node.note}</small>
      <b aria-hidden>↗</b>
    </>
  );

  if (node.newTab === false) return <Link href={href}>{content}</Link>;
  return <a href={href} target="_blank" rel="noreferrer">{content}</a>;
}

export function LifecycleStory({ initialStage, expoUrl }: { initialStage: LifecycleStage; expoUrl: string }) {
  const [activeStage, setActiveStage] = useState(initialStage);

  const selectStage = (stage: LifecycleStage) => {
    setActiveStage(stage);
    updateLocation(stage);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <div>
          <p className={styles.kicker}>Pixie for Intact · connected consumer insurance</p>
          <h1>One set of facts, connected through the full insurance lifecycle.</h1>
        </div>
        <p>Every node is visible. Follow a system into Quote, Decide, Protect, or Recover, then open the working Home and Auto proof.</p>
      </header>

      <section className={styles.graph} aria-label="Pixie connected insurance system graph">
        <div className={styles.systemGrid} aria-label="Connected systems">
          {SYSTEMS.map((system) => {
            const content = <><span>{system.code}</span><strong>{system.title}</strong><small>{system.key === "mcp" ? "9 tools · open live demo ↗" : system.detail}</small></>;
            return system.key === "mcp" ? (
              <Link className={styles.systemNode} data-active={STAGES.find((stage) => stage.key === activeStage)?.systems.includes(system.key)} href="/intact/agent" key={system.key}>{content}</Link>
            ) : (
              <div className={styles.systemNode} data-active={STAGES.find((stage) => stage.key === activeStage)?.systems.includes(system.key)} key={system.key}>{content}</div>
            );
          })}
        </div>

        <div className={styles.connectionField} aria-hidden>
          <svg viewBox="0 0 1000 96" preserveAspectRatio="none">
            {CONNECTIONS.map((connection) => (
              <path
                d={`M ${connection.sourceX} 0 C ${connection.sourceX} 34, ${connection.targetX} 62, ${connection.targetX} 96`}
                data-active={connection.stage === activeStage}
                data-system={connection.system}
                key={`${connection.system}-${connection.stage}`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <span>consented facts + deterministic results</span>
        </div>

        <div className={styles.stageGrid} aria-label="Lifecycle stages">
          {STAGES.map((stage) => (
            <button
              aria-controls={`stage-${stage.key}`}
              aria-pressed={activeStage === stage.key}
              key={stage.key}
              onClick={() => selectStage(stage.key)}
              type="button"
            >
              <span>{stage.number}</span>
              <strong>{stage.label}</strong>
              <small>{stage.promise}</small>
            </button>
          ))}
        </div>

        <div className={styles.capabilityGrid}>
          {STAGES.map((stage) => (
            <article className={styles.stageColumn} data-active={activeStage === stage.key} id={`stage-${stage.key}`} key={stage.key}>
              <button className={styles.mobileStageButton} aria-pressed={activeStage === stage.key} onClick={() => selectStage(stage.key)} type="button">
                <span>{stage.number}</span>
                <strong>{stage.label}</strong>
                <small>{stage.promise}</small>
              </button>

              <div className={styles.stageSummary}>
                <p>{stage.summary}</p>
                <div aria-label={`${stage.label} connected systems`}>
                  {stage.systems.map((key) => <span key={key}>{SYSTEMS.find((system) => system.key === key)?.code}</span>)}
                </div>
              </div>

              <div className={styles.productBranches}>
                <section className={styles.branch} aria-label={`${stage.label} Home capabilities`}>
                  <p>Home</p>
                  {stage.home.map((node) => <ProofNode expoUrl={expoUrl} key={`${stage.key}-home-${node.label}`} node={node} />)}
                </section>
                <section className={styles.branch} aria-label={`${stage.label} Auto capabilities`}>
                  <p>Auto</p>
                  {stage.auto.map((node) => <ProofNode expoUrl={expoUrl} key={`${stage.key}-auto-${node.label}`} node={node} />)}
                </section>
                {stage.shared ? (
                  <section className={`${styles.branch} ${styles.sharedBranch}`} aria-label={`${stage.label} shared capabilities`}>
                    <p>Human support</p>
                    {stage.shared.map((node) => <ProofNode expoUrl={expoUrl} key={`${stage.key}-shared-${node.label}`} node={node} />)}
                  </section>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.disclosure}>
        <strong>Demo boundaries</strong>
        <p>Home pricing means tenant insurance. Auto listings, route context, policies, and prices are synthetic. Recovery plans stay local, and MCP drafts or advisor requests remain unsent until the customer gives the required consent.</p>
      </footer>
    </div>
  );
}
