# Federato: what the product actually is

Research pass for the Federato pitch, done 2026-09-19. Every claim below is cited. Marketing copy
is labeled as such where it isn't backed by an independent source. Anything I couldn't verify, I
say so rather than guess. Where I inferred something rather than read it directly, it's marked
INFERRED.

## Company snapshot

Federato was founded in 2020 out of Stanford by CEO Will Ross and CTO William Steenbergen, both
machine-learning researchers (Ross previously spent five years at IBM Watson; Steenbergen holds an
M.S. in computational and mathematical engineering). Before launching, the two spent roughly
1,200-1,250 hours interviewing underwriters and insurance leaders — this exact figure is repeated
across three separate podcast appearances, so it's a rehearsed talking point, not a one-off claim
([Emerging Tech Series](https://www.federato.ai/articles/the-emerging-tech-series-william-steenbergen-cto-federato), [Funders & Founders](https://www.federato.ai/articles/funders-founders-podcast-will-ross-ceo-of-federato-talks-riskops), [The Next Iteration Ep. 82](https://www.federato.ai/articles/the-next-iteration-podcast-ep-82-william-steenbergen-cto-co-founder-federato)).

Funding history:

| Round | Amount | Date | Lead | Total raised |
|---|---|---|---|---|
| Series A | $15M | 2022 | Emergence Capital (w/ Caffeinated Capital, Pear VC) | — ([PRNewswire](https://www.prnewswire.com/news-releases/federato-first-solution-to-unify-insurance-underwriting-and-portfolio-management-announces-15m-series-a-investment-301626692.html)) |
| Series B | $25M | 2023 | — | — ([Reinsurance News](https://www.reinsurancene.ws/underwriting-platform-federato-raises-25m-in-series-b-funding/)) |
| Series C | $40M | Nov 2024 | StepStone Group | $80M ([Federato](https://www.federato.ai/articles/federato-raises-80-million-to-date-with-series-c-accelerating-ai-era-for-insurance), [TechCrunch via Federato](https://www.federato.ai/articles/techcrunch-federato-fixes-insurance-risk-analysis-with-ai-raises-40m)) |
| Series D | $100M | Nov 2025 | Growth Equity at Goldman Sachs Alternatives | $180M ([FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/goldman-sachs-leads-100m-series-d-in-insurtech-federato), [Federato](https://www.federato.ai/articles/federato-raises-100-million-series-d-led-by-goldman-sachs)) |

An independent trade-press analysis of the Series D (Insurance Innovation Reporter) puts scale at
"dozens of carrier and MGA customers, thousands of daily users, and revenue measured in the tens of
millions," with "threefold growth in daily active users in the last year." That same piece notes
what it does *not* find anywhere in Federato's materials: customer retention/churn numbers, burn
rate, or a competitive response from Guidewire/Duck Creek
([IIReporter](https://iireporter.com/federatos-100m-signal-from-underwriting-intelligence-to-platform-ambition/)).
Worth saying at the booth as an honest gap, not repeating as if it were resolved.

Customers named on the Federato homepage as logos (not all have a written case study — see the
table under "customers" below): QBE, Brown & Brown, Palomar, Propeller, Ryan Specialty, Acrisure,
Accelerant, with Nationwide and QBE quoted in testimonials
([federato.ai homepage](https://www.federato.ai/), confirmed by direct fetch, 2026-09-19).

## 1. What an underwriter sees and does, screen by screen

I could not find a screenshot gallery or recorded demo video transcript that walks a full screen
sequence — the `/demo` and `/product-tour` pages are gated behind a "book a call" form and describe
the workflow in prose, not screen-by-screen UI. What follows is assembled from feature pages and
case studies, and I'm explicit about what's described vs. what's just named.

The named screens/modules, per the platform pages:

- **Action Center** — the core underwriter workspace. Named explicitly in the HDVI and Velocity
  Risk case studies as where submissions are prioritized and rules fire. HDVI's Chief Underwriting
  Officer describes 30+ rules configured here that trigger department handoffs automatically
  ([HDVI case study](https://www.federato.ai/articles/hdvi-powers-complex-data-workflows-and-builds-a-foundation-for-growth-agility-and-flexibility-with-federato-riskops)). This is the closest thing to a described "queue" screen, but no field-by-field
  layout is published.
- **Submission Triage** — an AI agent that reads an entire submission (emails, statements of value,
  loss runs, attachments) in context and decides: auto-decline, request more info, or prioritize for
  intake. Federato's own description: it "reasons through complete submission context" rather than
  scoring documents in isolation ([Submission Triage launch article](https://www.federato.ai/articles/submission-triage-orchestrate-agentic-ai-launch)).
- **Submission to Quote** — after triage, the system produces a "first-draft quote within minutes
  for the best-fit deals." The underwriter's stated job at this step is: "review, edit, and approve"
  — Federato is explicit that every AI-generated quote can be modified before it goes out
  ([Submission to Quote](https://www.federato.ai/platform/submission-to-quote)).
- **Quadrant / matrix scoring view** — submissions are shown ranked into four quadrants (see
  section 2). Velocity Risk's case study calls this the "prioritization matrix"
  ([Velocity Risk case study](https://www.federato.ai/articles/velocity-risk-drives-dramatic-efficiency-and-growth-through-winnability-and-appetite-with-riskops)).
- **Control Tower** — a separate, leader-facing screen (not the underwriter's desk) for real-time
  portfolio visibility: performance against targets by region/segment, ability to "catch portfolio
  drift" before quarter-end, and a place to "deploy and monitor models... while measuring
  performance, monitoring bias, and ensuring data provenance" ([Introducing Control Tower](https://www.federato.ai/articles/introducing-control-tower)). This is a management/governance
  surface, not what a line underwriter works from day to day.
- **Producer Portal / Partner Portals** — broker/producer-facing access to quotes, policies,
  commissions, claims. Named on the platform overview page but not described in detail
  (https://www.federato.ai/platform/producer-portal — page loaded but had no substantive
  screen-level detail beyond the module name).
- **Supplemental Apps** — line-of-business-specific add-ons (e.g., property: geospatial/cat modeling
  and building attribute lookups; commercial: industry risk frameworks; life/health: EHR and
  prescription history review). Framed as pluggable data-capture tools bolted onto the core
  workflow, not separate screens exactly — more like panels that appear depending on line of
  business ([Supplemental Apps article](https://www.federato.ai/library/post/supplemental-apps-by-line-elevating-underwriting-precision-across-industries)).
- **Claims** (new, Aug 2026) — a parallel workspace for adjusters: an AI agent guides First Notice
  of Loss (FNOL) intake, captures structured facts, and flags missing information before a human
  adjuster picks it up. It's explicitly framed as feeding data back into underwriting/pricing while
  the claim is still open, not after close ([Claims launch](https://insurance-canada.ca/2026/08/17/federato-ai-platform-launch-claims/)).

Repeated underwriter-workflow claim across marketing and case studies: "by noon each day, each
underwriter should have quoted the best three or four deals on their desk" (Nina Chiappetta, VP
Business Development at Velocity Risk, quoted on both the case study and platform pages) — this is
the clearest first-person description of the intended daily experience, and it's a testimonial, not
a Federato claim about itself.

**What I could not verify:** exact field layouts, button labels, color coding, or a literal
click-by-click walkthrough. Federato does not appear to publish a UI screenshot tour publicly (it's
demo-gated). If the pitch needs a screen-accurate claim, don't invent one.

## 2. The appetite model and how it's configured

Federato's core scoring construct is a **2x2 quadrant** built from two independently-computed axes:

- **Appetite** (x-axis): strategic/portfolio fit. "Appetite reflects strategic alignment and is
  derived from the insurer's specific underwriting rules, goals, and referral guidelines... codified
  directly into the platform and updated as strategy evolves"
  ([Quadrant scoring article](https://www.federato.ai/articles/quadrant-scoring-system)).
- **Winnability** (y-axis): probability the deal binds. "Calculated using Federato's AI models, which
  combine traditional insurance data (e.g., loss history, exposures) with behavioral interaction
  data (e.g., how fast brokers respond, past quote success)" (same source).

Each submission lands in one of four quadrants: high-appetite/high-winnability (top priority),
high-appetite/low-winnability (worth extra effort), low-appetite/high-winnability (pursued
selectively), low-appetite/low-winnability (deprioritized).

**Configuration**: appetite is "codified directly into the platform" from the carrier's own
underwriting rules — Velocity Risk's case study describes this concretely: they encoded their
proprietary "VISTA" algorithm as appetite rules inside Federato's rules engine, consolidating
multiple metrics into one appetite score
([Velocity Risk case study](https://www.federato.ai/articles/velocity-risk-drives-dramatic-efficiency-and-growth-through-winnability-and-appetite-with-riskops)). HDVI similarly programmed 30+ rules for their highest-volume line
([HDVI case study](https://www.federato.ai/articles/hdvi-powers-complex-data-workflows-and-builds-a-foundation-for-growth-agility-and-flexibility-with-federato-riskops)). Control Tower lets leaders "upload existing guidance documents to
auto-generate objectives and controls in an afternoon" — i.e., appetite can be bootstrapped from an
existing PDF guideline document rather than hand-coded from scratch
([Introducing Control Tower](https://www.federato.ai/articles/introducing-control-tower)).

So: appetite = configurable rules engine, tunable per carrier, per line of business, and updatable
in real time by leadership through Control Tower. Winnability = a separate ML layer trained on
historical submission/bind behavior, not something a carrier configures directly.

This maps closely onto the hackathon's own APPETITE_GUIDELINES.txt, which frames appetite as
accept/target/not-acceptable bands per factor (state, TIV, premium, building age, construction,
loss history) — that's a simplified, static version of the same idea (see "student framing" below).

## 3. What's automated vs. left to the human

Federato published this distinction directly and it's the cleanest answer I found to this question.
From ["5 insurance workflows AI can automate today (and 3 it still can't)"](https://www.federato.ai/articles/insurance-workflows-ai-can-automate):

**Automated today:**
1. Submission intake and triage — "high volume, repetitive structure, clear decision criteria."
2. Data collection/aggregation — "the task of gathering it has nothing to do with evaluating risk."
3. Quote prep and workflow coordination/handoffs.
4. Routine broker communications and status notifications.
5. Portfolio monitoring and operational reporting (real-time, replacing manual reports).

**Explicitly left to humans (Federato's own words, not mine):**
1. Complex/novel risk judgment — "the more unusual the risk, the less useful a pattern-matching
   model becomes."
2. Broker and customer relationship management — "insurance is a relationship business," trust
   built over years.
3. Strategic portfolio decisions (what to grow into) — factors "best understood and assessed with
   human expertise."

Every quote and every AI recommendation is stated to remain editable/approvable by the underwriter
before it's sent — this "human in the loop before commit" framing appears on the Submission to
Quote page, the platform overview, and repeated in Steenbergen's Carrier Management quote below. I
did not find a case where Federato claims full straight-through processing with zero human
sign-off; the claim is consistently "draft, not decision."

## 4. Is the scoring explainable? Rules, model, or mix?

This is a hybrid, and Federato is unusually specific about the layering (more specific than most
"explainable AI" marketing usually is), which is useful ammunition for the pitch. From the
[Chain-of-Thought prompting article](https://www.federato.ai/articles/chain-of-thought-prompting-ai-underwriting):

- **Structured data → traditional ML with SHAP values.** For scoring where the inputs are clean
  numeric/categorical fields (loss history, TIV, etc.), Federato says "feature importance and SHAP
  values provide adequate explainability" — i.e., a conventional interpretable-ML approach, not an
  LLM.
- **Unstructured data / multi-step reasoning → LLM chain-of-thought.** For submission documents,
  emails, and complex judgment calls, they prompt an LLM to "generate step-by-step explanations in
  natural language," with a worked example: "Location factors: Charleston, SC coordinates place this
  property in FEMA hurricane zone with historical major storm impacts every 15 years... Recommendation:
  High-risk rating due to combination of catastrophe exposure and extended recovery timeline."
- **Appetite → deterministic rules engine**, as covered above (carrier-configured if/then logic).
- Federato explicitly warns about the limits of their own approach: "LLMs can generate convincing
  explanations for incorrect conclusions" — i.e. they acknowledge chain-of-thought text is not
  itself proof of correct reasoning, and say human validation is still required.

Separately, there's a **provenance/citation layer** that sits underneath all of this: "source
citations and confidence scores for every field," with data lineage tracked "down to the source,
from anywhere in the workflow," whether the field came from a submission attachment, the open web,
or a third-party integration ([Why provenance matters](https://www.federato.ai/articles/why-provenance-matters-agentic-ai-underwriting)). Control Tower is also positioned as a governance
layer for this: leaders can "deploy and monitor models... while measuring performance, monitoring
bias, and ensuring data provenance for maximum interpretability" ([Control Tower](https://www.federato.ai/articles/introducing-control-tower)).

CTO William Steenbergen frames this directly as an answer to the "black box" objection in Carrier
Management: "AI analyzes large amounts of data at machine speed, while freeing expert underwriters
to do what they do best," and each quote "includes detailed explanations of the AI's reasoning,
addressing the 'black box' problem that concerns many insurers" ([Carrier Management, Oct 2025](https://www.carriermanagement.com/news/2025/10/30/280877.htm)).

No specific model provider (OpenAI, Anthropic, etc.) is named anywhere I found — Federato doesn't
disclose which LLM(s) power the chain-of-thought layer. That's an explicit gap, not an oversight on
my part: I searched for it and it isn't public.

**Verdict**: not a black box, not a pure rules engine, not a pure model — it's rules (appetite) +
supervised ML with SHAP (winnability, on structured data) + LLM chain-of-thought (unstructured
reasoning and generated explanation text) + a provenance/citation ledger underneath all three, with
Control Tower as the governance/audit surface over the whole stack.

## 5. The AI story as of 2026: agents and "AI-native"

Federato's positioning is that AI is not bolted onto a legacy policy admin system but *is* the
system: "AI isn't just a feature; it's the foundation... every workflow, from the first interaction
with a submission to the issuance of a policy, is powered by embedded AI agents that learn, adapt,
and improve outcomes over time" ([What is an AI-native insurance platform?](https://www.federato.ai/articles/what-is-an-ai-native-insurance-platform)). This is marketing
language — I'm quoting it as their stated position, not as a verified technical fact.

Named agentic products, in ship order:

- **Submission Triage** (launched April 29, 2025) — an AI agent, not a rules pipeline, that reads a
  full submission in context ([launch article](https://www.federato.ai/articles/submission-triage-orchestrate-agentic-ai-launch)).
- **Orchestrate** (same launch, April 2025) — a no-code AI workflow composer: an insurer's own team
  builds custom sub-agents (document classification, context extraction, summarization) via natural
  language prompting rather than code. Runs inside what Federato describes as "secure, single-tenant
  architecture with precise logging and full user control over model interactions and data flows."
  Customer-built examples cited: drafting broker emails, flagging submissions needing attention per
  guidelines, summarizing recent org news before underwriter review.
- **Control Tower / agentic guardrails** (Oct 2025) — strategy changes propagate as live constraints
  ("guardrails") on what the agents can do: "adjustments are applied instantly to agentic guardrails
  that guide every submission... the system automatically steers new business appropriately"
  ([Introducing Control Tower](https://www.federato.ai/articles/introducing-control-tower)).
- **Claims agent** (Aug 2026) — FNOL intake agent, described in section 1.

Federato's own recent blog content (Sept 2026) is notably self-critical of the industry's AI hype,
which is a useful contrast to cite: ["Why billions in insurance AI investment still haven't
transformed the work"](https://www.federato.ai/blog) (title only — the article itself 404'd when
fetched directly, so I can't quote its argument, only that it exists and was published 2026-09-18).
Their **2026 State of P&C Insurance report** (750 respondents) makes a related point with real
numbers: 91% of P&C leaders report real-time portfolio control, but only 27% of underwriters say
the same — a 64-point gap — and 89% of employees admit to using AI tools outside their company's
approved systems ("shadow AI") at least occasionally ([report coverage](https://finance.yahoo.com/technology/ai/articles/federato-research-91-p-c-130000293.html), [Federato's own release](https://www.federato.ai/articles/federato-releases-2026-state-of-p-c-insurance-report)). Insurers with fully
integrated AI are claimed to be "3.6 times more likely to achieve genuine portfolio control" than
those layering AI onto fragmented systems — that 3.6x figure is Federato's own research finding
about the market, not a customer-outcome claim about Federato specifically; worth distinguishing at
the booth.

## 6. What they measure and report as success

Metrics claimed, by source — I've kept these attributed individually because they come from
different customers/contexts and shouldn't be blended into one number:

| Metric | Value | Source | Customer |
|---|---|---|---|
| Time to quote | 89% faster (21.8 days → 2.3 days) | [Velocity Risk case study](https://www.federato.ai/articles/velocity-risk-drives-dramatic-efficiency-and-growth-through-winnability-and-appetite-with-riskops) | Velocity Risk |
| High-appetite bound policies | 3.7x increase | Same | Velocity Risk |
| High-appetite submissions quoted | 2.8x increase | [Submission Triage launch](https://www.federato.ai/articles/submission-triage-orchestrate-agentic-ai-launch) | early Triage adopters (unnamed) |
| Time to quote | 1 week → half a day | [HDVI case study](https://www.federato.ai/articles/hdvi-powers-complex-data-workflows-and-builds-a-foundation-for-growth-agility-and-flexibility-with-federato-riskops) | HDVI |
| Quotes per underwriter | 2x | [APAC expansion article](https://finance.yahoo.com/technology/ai/articles/federato-brings-proven-ai-native-230000689.html) | HDVI |
| Quote time (elsewhere cited) | 20 days → 5-8 days | Same | HDVI |
| Underwriting time recovered | 30% | Same | QBE |
| Systems consolidated | 14 → 1 | Same | QBE |
| Systems used (general claim) | 87% fewer systems, 70% less time seeking guidance | [Federato vs. underwriting workbench](https://www.federato.ai/articles/federato-vs-underwriting-workbench-how-are-they-different) | unspecified/aggregate |
| Submission processing time | 24 hours → 15 minutes (96% reduction) | Same APAC article | Mission Underwriting |
| Hit ratio | +50% (homepage) | [federato.ai homepage](https://www.federato.ai/) | aggregate/unspecified |
| High-appetite bound quotes | 5.5x | Same | aggregate/unspecified |
| High-appetite premium lift | +30% | Same | aggregate/unspecified |
| Systems used | 2x reduction | Same | aggregate/unspecified |
| Payback period / IRR | <12 months, 70-400% IRR | [QBE case study coverage](https://www.carriermanagement.com/features/2022/11/28/242456.htm) | QBE |
| Winnability score accuracy | "up to 10x more accurate than a traditional underwriting workbench" | [Federato vs. underwriting workbench](https://www.federato.ai/articles/federato-vs-underwriting-workbench-how-are-they-different) | unspecified — no methodology published |

None of these have a published methodology (baseline definition, sample size, statistical
significance). They're vendor-reported case-study numbers, several with named customer quotes
attached (which is better evidence than an anonymous aggregate stat, but still not independently
audited). I did not find any customer-reported metric that contradicts these; I also didn't find
independent verification of any of them.

## 7. What customers and reviewers say is missing or weak

This is the weakest-evidenced section, and I want to be direct about why: **Federato has
essentially no public, independent review footprint.**

- **G2**: the reviews page (https://www.g2.com/products/federato/reviews) returned HTTP 403 to
  direct fetch (likely bot-blocked), but the French-locale mirror rendered and showed a
  freshly-provisioned page: "This software hasn't been reviewed yet. Be the first to provide a
  review," with 0.0/5 across every category. So as of this research, **G2 shows zero independent
  customer reviews of Federato**, despite marketing copy elsewhere (repeated in search-engine
  summaries, not on Federato's own site) claiming specific G2-sourced stats like "reduces sites
  visited from 15 to 1." I could not trace that stat to an actual review; treat it as unverified.
- **Capterra**: no listing found for Federato at all.
- **TrustRadius**: no listing found for Federato at all.
- **Gartner Peer Insights**: no listing found for Federato at all.
- **Glassdoor** (employer reviews, not product reviews — different signal, included for honesty):
  3.3/5 across 44 reviews. Pros cited: "lots of freedom, great culture," strong engineering talent.
  Cons cited: "long working hours, inexperienced micro-managing executive leadership" ([Glassdoor](https://www.glassdoor.com/Reviews/Federato-Reviews-E6809618.htm)). This is about Federato as an
  employer, not about the product — flagging it only so it isn't mistaken for a product complaint.

Given the absence of independent reviews, the closest thing to a "what's weak" signal is the gap
Federato's *own* 2026 State of P&C report surfaces about the category broadly, not necessarily
Federato specifically: leadership consistently overestimates how much real-time control and
consistent guideline application actually happens at the underwriter level (the 91% vs. 27% gap,
93% of leaders believing guidelines are applied consistently vs. 88% of employees reporting
deviations from missing data/disconnected tools) ([2026 State of P&C report](https://www.federato.ai/articles/federato-releases-2026-state-of-p-c-insurance-report)). This is presented as evidence
*for* buying Federato, but it also reads as an honest admission that even sophisticated carriers
struggle to get guideline adherence and portfolio visibility all the way down to the desk — which is
exactly the kind of gap a hackathon project can point at without contradicting Federato.

One functional limitation I found stated outside Federato's own materials: real-time portfolio
intelligence depends on live connectivity to the carrier's policy administration and rating
systems; carriers with legacy/non-integrated cores face "connectivity challenges that limit
real-time data freshness" (this appeared in aggregated search-summary text, not a single citable
article page I could re-fetch directly — flagging as **weaker-sourced** than the rest of this
document; I'd treat it as plausible but not booth-safe to state as fact).

**What I did not find**: no security audit, no SOC 2 status, no uptime/SLA figures, no discussion of
data residency for multi-region (relevant given the new APAC expansion), no published error rates
for the AI scoring, and no customer complaint or negative case study anywhere (unsurprising, since
customer stories are self-selected by the vendor).

## 8. What they've shipped recently, and the roadmap

Timeline of major product moves, newest first:

- **Aug 4, 2026** — Federato Claims launches (end-to-end claims management, available standalone or
  bundled) ([insurance-canada.ca](https://insurance-canada.ca/2026/08/17/federato-ai-platform-launch-claims/)).
- **Jun-Jul 2026** — APAC/Japan expansion announced: Sydney office, ex-Guidewire RVP hired,
  targeting Australia/NZ first then Singapore/Japan/Korea; presenting sponsor at ITC Asia 2026
  ([Yahoo Finance/Federato](https://finance.yahoo.com/technology/ai/articles/federato-brings-proven-ai-native-230000689.html)).
- **Jul 21, 2026** — 2026 State of P&C Insurance report released (750 respondents) ([Federato](https://www.federato.ai/articles/federato-releases-2026-state-of-p-c-insurance-report)).
- **Nov 18, 2025** — Series D, $100M, led by Goldman Sachs Alternatives ([FinTech Futures](https://www.fintechfutures.com/venture-capital-funding/goldman-sachs-leads-100m-series-d-in-insurtech-federato)).
- **Oct 2025** — Agentic AI platform + Control Tower launch, explicit "black box" framing pitched
  directly at underwriter trust concerns ([Carrier Management](https://www.carriermanagement.com/news/2025/10/30/280877.htm)).
- **Apr 29, 2025** — Submission Triage + Orchestrate launch (first named "agentic AI" products)
  ([launch article](https://www.federato.ai/articles/submission-triage-orchestrate-agentic-ai-launch)).
- **Nov 2024** — Series C, $40M ([Federato](https://www.federato.ai/articles/federato-raises-80-million-to-date-with-series-c-accelerating-ai-era-for-insurance)).

**Roadmap**: Federato does not publish a forward-looking roadmap page. The clearest forward signal
is the platform's stated shape — Policy Administration, Billing & Payments, Claims, Product Studio,
Control Tower, Partner Portals — described as "the full policy lifecycle," with Claims being the
most recent piece to land (Aug 2026) after years of underwriting-only focus. INFERRED: given the
Claims launch explicitly closes a feedback loop ("claims data back into underwriting/pricing while
still open"), the next plausible extension is deeper claims-to-underwriting automation and/or
further international expansion (APAC is explicitly "just started" as of mid-2026) — I did not find
either of these stated as an official roadmap item, this is my own extrapolation from the pattern.

## Where the hackathon's framing differs from the commercial product

The `docs/federato/*.txt` package Federato wrote for this hackathon simplifies the real product in
several specific, named ways:

- **Appetite is static in the hackathon, dynamic in production.** APPETITE_GUIDELINES.txt gives one
  fixed table (accept/target/not-acceptable bands, no versioning, no update mechanism). In
  production, appetite is meant to be edited live through Control Tower and propagate instantly as
  "agentic guardrails" — the hackathon version has no equivalent of that governance/update layer at
  all. There is no Control Tower analog in the student API.
- **Winnability doesn't exist in the hackathon dataset.** The real product's other axis — a
  behavioral ML model trained on broker response speed, historical quote-to-bind rates — has no
  counterpart in the hackathon schema. The student data has no broker-interaction history, so a
  hackathon team literally cannot reproduce the winnability half of Federato's own quadrant without
  inventing a proxy. This is a real gap between "what you're asked to build" and "what the actual
  product scores on."
- **Explainability is asked for in the student brief but not specified in mechanism.** The student
  guidelines ask for "2-3 sentence explanations" in plain English — this matches the *spirit* of
  Federato's chain-of-thought layer but the hackathon docs never mention SHAP, provenance tracking,
  confidence scores, or the rules/ML/LLM split described in section 4. A team could build something
  that "explains" scores in a way structurally unlike how Federato's own platform actually
  separates rule-based, ML-based, and LLM-based explanation sources.
- **No claims, billing, or portfolio-steering surface.** The hackathon challenge is scoped entirely
  to submission triage/scoring — it does not touch Control Tower-style portfolio visibility,
  Claims, or Billing, all of which are real, shipped parts of the commercial platform as of 2026.
  This is explicit and intentional in the student guidelines ("Focus on reasoning," not full
  platform breadth) — not a discrepancy, just a scope choice worth naming so it isn't presented as
  if it were the whole product.
- **The data layer itself is synthetic and small** (50+ submissions) vs. production, where QBE alone
  runs an initial cohort of 50 *underwriters* against real submission volume in the tens of
  thousands. The hackathon explicitly frames this as intentional (schema discovery over
  field-by-field docs, per DATA_SCHEMA.txt) so agentic reasoning is the graded skill, not data
  engineering at scale.

None of this is a criticism of the hackathon package — the README and student guidelines are
explicit that this is a scoped-down slice of "the work Federato's Forward Deployed Engineering team
does daily" (STUDENT_PROJECT_GUIDELINES.txt), not a claim that it reproduces the whole product.

## What this means for Pixie

Pixie (repo: `atlas`) is a commercial-property underwriting desk built against the Federato
hackathon API: a deterministic Python scoring engine (`engine.assess()`) that turns a submission
into a *score interval* against a carrier's YAML-encoded guideline, six agents that decide what to
look up and argue the case, and a UI where every number on screen traces to a source. Details from
`README.md`, `docs/PITCHES.md`.

**Where Pixie overlaps what Federato already ships** — say these plainly, because the judges built
the thing Pixie overlaps with and will know if this is overstated:

- **Appetite-as-configuration.** Pixie's `rules/property_2025.yaml` is functionally the same idea as
  Federato's "codify the carrier's guideline into the platform" appetite layer (section 2) — a
  human-edited rules file drives the score. Pixie doesn't invent this pattern; it's a smaller,
  single-file version of what Control Tower and Action Center already do in production.
- **Rules for the auditable number, LLM for the prose.** Federato's own explainability architecture
  (section 4) splits "structured/numeric → traditional interpretable methods" from
  "unstructured/reasoning → LLM chain-of-thought." Pixie's invariant #1 ("no number comes from a
  model... models write prose from values the code already produced") is the same split, just
  stated as a harder rule. This is the strongest, most legitimate point of overlap — Pixie isn't
  proposing a new idea here, it's independently arriving at the same architecture Federato already
  uses and then enforcing it with a test (`verify_numbers()`) rather than a guideline.
- **Provenance on every field.** Federato's "source citations and confidence scores for every
  field" (section 4) is the same goal as Pixie's invariant #3 ("each field carries where it came
  from"). Same idea, same name for the concept even.
- **Human approves before it ships.** Both systems draft, neither auto-binds without a human step —
  Pixie's "refer" and "request more information" outcomes and Federato's "review, edit, approve"
  framing are the same posture toward automation.

**Where Pixie genuinely goes further, or does something Federato doesn't describe doing:**

- **A score interval, not a point score.** Federato's quadrant system (section 2) places a
  submission at one appetite/winnability point. Pixie scores an *interval* (e.g. 30-75) and treats a
  missing fact as widening that interval rather than defaulting it to a pass or a mid-value — this
  is invariant #2 ("missing is never a pass"). I found nothing in Federato's public material
  describing interval-based or uncertainty-aware scoring; their published examples (SHAP values,
  quadrant coordinates) are point estimates. This is a real, specific difference worth stating
  as a difference, not an improvement claim — I don't know if Federato does this internally and
  simply doesn't describe it publicly.
- **A what-if slider tied to the actual decision boundary.** Pixie's UI lets a user drag one fact
  (premium) and watch the decision flip at a computed threshold. I found no equivalent described on
  any Federato product page — their UI descriptions stop at "review, edit, approve," not
  counterfactual exploration of the score itself.
- **An adversarial second pass.** Pixie's "Challenger" agent argues against the desk's own draft
  before a decision stands, and by Pixie's own account changed the verdict on 2 of 6 cases it has
  run. Federato's Orchestrate lets a carrier compose custom sub-agents, but nothing in Federato's
  public materials describes a built-in adversarial/self-critique agent as a standard part of the
  scoring pipeline.
- **One engine, two rules files, two products.** Pixie's Toronto tenant-insurance pack running on
  the same `engine.assess()` as the commercial property pack is a portability claim Federato doesn't
  make about itself — their platform is scoped to P&C/specialty commercial lines, not personal
  lines, and nothing in their materials suggests a region- or line-agnostic core engine is how they
  built it internally. This is a legitimate "goes further" point, but it's also a much smaller
  system than Federato's — worth stating with the caveat that Pixie hasn't run its six-agent desk
  against a tenant case at all yet (per `docs/PITCHES.md`), so the "one engine, two products" claim
  is proven for the deterministic scorer, not for the agent layer.
- **A pre-registered backtest with a named miss.** Pixie commits its backtest method before running
  it and prints a case where its own logic would have accepted a policy that then lost money
  ($629,200 against $58,800 of premium). Federato's public metrics (section 6) are exclusively
  positive-outcome case studies with no published miss or failure case. This is a genuine
  methodological difference in how evidence is presented, not a claim that Pixie's underlying model
  is better — a fairer framing at the booth is "we show you our worst case; the vendor materials I
  read don't."

**Honest overlap risk to name before a judge does:** Pixie's core claim (rules for the number,
model for the prose, provenance on every field) is not a new idea relative to Federato — the
research above shows Federato already frames its own explainability architecture almost identically
(section 4). The credible pitch is not "we invented what you're missing," it's "we took your own
architecture pattern and pushed two things further than your public materials describe: interval
scoring under missing data, and an adversarial check before a decision ships" — and to say plainly
that whether Federato already does either of those internally is unknown; nothing in this research
confirms or rules it out.
