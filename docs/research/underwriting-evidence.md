# What the evidence says about underwriting decisions, explanation, and what regulators will require

Research for the Pixie pitch. Scope: published evidence on underwriter consistency, when experts take
algorithmic advice, which explanations actually help, what is binding or imminent on AI in insurance
underwriting, precedent for answering with a range, and measured rates of numeric error in language
model output.

Every substantive claim below has a URL or a full reference. Where I am reasoning rather than citing,
the line starts with **INFERRED**. Where the evidence is thin or contested I say so instead of
smoothing it over. Two places where a judge could legitimately call the evidence weak are flagged in
bold as **weak evidence**.

---

## 1. Decision quality in underwriting: do two underwriters agree?

### The one number everyone cites

The Kahneman, Sibony and Sunstein noise audit at a large insurance company is the canonical figure.
The company gave the same realistic case files to underwriters and to claims adjusters and compared
the outputs.

> "the median difference in the pricing determined by its underwriters for identical policies was 55
> percent" and "the median difference in the payouts determined by its claims adjusters for identical
> claims was 43 percent"
> ([Sibony, "How noisy is your company?", strategy+business](https://www.strategy-business.com/article/How-noisy-is-your-company))

The expectation gap is the part that lands with an insurance audience. The same source reports the
authors surveyed 828 senior executives on how much variation they would expect between two
professionals doing the same job:

> "their median answer was 10 percent"

So the observed spread was about five times what the people running the business expected. A senior
executive at the audited company estimated "the company's annual cost of noise in underwriting,
counting both the loss of business from excessive quotes and the losses incurred on underpriced
contracts, was in the hundreds of millions of dollars"
([same source](https://www.strategy-business.com/article/How-noisy-is-your-company)).

A trade-press account adds the sample size and a concrete example: the audit covered "48 underwriters
at a large insurance company" in 2015, executives "predicted that there would be roughly a 10%
variance between the high and low prices," and in one case "one underwriter quoted $9,500 annually
while another quoted $16,700" for the same risk
([Insurance Thought Leadership, "Our Big Problem With 'Noise'"](https://www.insurancethoughtleadership.com/our-big-problem-noise)).

The method was first described publicly in Kahneman, Rosenfield, Gandhi and Blaser, "Noise: How to
Overcome the High, Hidden Cost of Inconsistent Decision Making," *Harvard Business Review*, October
2016 ([hbr.org/2016/10/noise](https://hbr.org/2016/10/noise)), and expanded in *Noise: A Flaw in Human
Judgment* (2021).

### Be honest about how good this evidence is

**Weak evidence.** This is one audit, at one unnamed company, run by the authors, with no published
protocol, no per-case data, no inter-rater reliability statistic, and no peer review as a standalone
study. The 55% is a median pairwise percentage difference, not a coefficient of variation or an
intraclass correlation, so it is not directly comparable to anything in the actuarial literature. It
has never been replicated in public. It is the strongest number in the field, and it is still a single
consultancy engagement written up in a business book.

A knowledgeable judge may well know this. The defensible framing is: the best available estimate of
underwriter noise is large, roughly five times what management expects, and nobody has published a
better one. Not: "studies show 55%."

### What else exists

I could not find a peer-reviewed study measuring agreement between commercial property underwriters on
identical submissions. Searches across CAS, SOA, Lloyd's and the reinsurers did not turn one up. What
does exist:

- Reinsurers sell underwriting audit services premised on inconsistency being real and costly. Swiss
  Re describes audits as "a review of technical decision quality" and part of risk management
  ([Swiss Re, Underwriting excellence](https://www.swissre.com/reinsurance/life-and-health/underwriting-excellence.html)).
  RGA markets forensic auditing of misclassified cases
  ([RGA, US Underwriting](https://www.rgare.com/solutions/underwriting/us-underwriting)). These are
  marketing pages, not measurements.
- Gen Re runs a multi-carrier accelerated underwriting study with 53 participating individual life
  carriers
  ([Gen Re 2023 survey summary, PDF](https://www.genre.com/content/dam/generalreinsuranceprogram/documents/surveylhau23-en.pdf)).
  Useful as evidence that the industry treats consistency as an open problem; it does not report
  pairwise underwriter agreement.
- **Weak evidence.** A vendor blog claims "15 to 25% decision variation on identical risks" across
  commercial P&C lines
  ([Insurance Support World](https://www.insurancesupportworld.com/blog/why-inconsistent-broker-submissions-undermine-underwriting-accuracy/)).
  No study is cited and I could not trace one. Do not put this number on a slide.

### The older, sturdier literature underneath it

The claim that mechanical combination beats clinical judgment is one of the best-replicated findings in
applied psychology. Grove, Zald, Lebow, Snitz and Nelson (2000) meta-analysed 136 studies of human
health and behaviour prediction and found algorithms outperformed human forecasters by about 10% on
average, with algorithmic superiority far more common than the reverse (summarised in
[Dietvorst, Simmons and Massey 2015, p. 1](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Dietvorst-Simmons-Massey-2014.pdf)).
The lineage runs back to Meehl's 1954 *Clinical Versus Statistical Prediction* and Dawes (1979).

**INFERRED.** The strongest claim Pixie can make from this body of work is narrow and safe: a written
guideline applied by code produces the same answer for the same submission every time, and the
published evidence says human judgment applied to the same submission does not. That is a consistency
claim, not an accuracy claim. Nothing above shows Pixie's score is *better* than an underwriter's, only
that it is repeatable.

---

## 2. Algorithm aversion and algorithm appreciation

### Aversion: people abandon a model that visibly errs

Dietvorst, Simmons and Massey (2015), *Journal of Experimental Psychology: General* 144(1), 114-126.
Abstract, verbatim:

> "We show that people are especially averse to algorithmic forecasters after seeing them perform, even
> when they see them outperform a human forecaster. This is because people more quickly lose confidence
> in algorithmic than human forecasters after seeing them make the same mistake."
> ([PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Dietvorst-Simmons-Massey-2014.pdf))

The magnitudes are stark. Participants produced "15-29% more error than the model in the MBA student
forecasting task of Studies 1, 2, and 4 and 90-97% more error than the model in the airline passenger
forecasting task of Studies 3a and 3b," and still: "In every experiment, participants in the
model-and-human condition were significantly less likely to tie their bonuses to the model than were
participants who did not see the model perform" (same PDF, Main Analyses). Watching the model work made
people trust it less, even when watching it work meant watching it win.

### The fix: let people move it

Dietvorst, Simmons and Massey (2018), "Overcoming Algorithm Aversion: People Will Use Imperfect
Algorithms If They Can (Even Slightly) Modify Them," *Management Science* 64(3), 1155-1170. Participants
were assigned to a can't-change condition or to adjust-by-10, adjust-by-5 or adjust-by-2 conditions.
Those who could restrictively modify the model's forecasts "were more likely to choose to use the
model's forecasts than those who could not, and as a result, they performed better and earned more
money"
([PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf),
[INFORMS](https://pubsonline.informs.org/doi/10.1287/mnsc.2016.2643)).

The adjustment can be tiny. Two percentage points of allowed movement was enough. This is the single
most actionable finding in this document for Pixie's product shape.

### Appreciation: the opposite result, in other conditions

Logg, Minson and Moore (2019), "Algorithm appreciation: People prefer algorithmic to human judgment,"
*Organizational Behavior and Human Decision Processes* 151, 90-103. Six experiments; lay people adhered
*more* to advice labelled as algorithmic than to the same advice labelled as human, for numeric
estimates, song popularity and romantic matching
([SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2941774),
[ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0749597818303388)).

The moderators matter more than the headline. Appreciation is strongest in domains people see as
opaque and weakest in domains people see as requiring human qualities, and the effect attenuates for
domain experts judging their own field.

**INFERRED, and this is the honest read for a room of underwriters.** Aversion and appreciation are not
contradictory results, they are different populations. Logg's participants were lay people with no
stake. Pixie's users are experts whose professional identity is the judgment being automated, who will
see the system err, and who carry the loss. That population sits on the aversion side of the line.

### Experts overriding models usually makes things worse

Hoffman, Kahn and Li (2018), "Discretion in Hiring," *Quarterly Journal of Economics* 133(2), 765-800.
Firms adopted a job test; managers could override it. "Managers who appear to hire against test
recommendations end up with worse average hires, suggesting that managers often overrule test
recommendations because they are biased or mistaken, not only because they have superior private
information." The authors checked whether exceptions traded duration for productivity and found no
evidence of it
([QJE](https://academic.oup.com/qje/article-abstract/133/2/765/4430650),
[PDF](https://www-2.rotman.utoronto.ca/facbios/file/Discretion.pdf),
[NBER w21709](https://www.nber.org/papers/w21709)).

This is the uncomfortable pairing. Dietvorst 2018 says give the expert a knob or they will not use the
system. Hoffman et al. say turning the knob typically destroys value. Both are true. The resolution the
evidence supports is a bounded, logged, reviewable override rather than a free one.

---

## 3. Explainability that actually helps, versus explainability that just raises confidence

### The core negative result

Bansal, Wu, Zhou, Fok, Nushi, Kamar, Ribeiro and Weld (2021), "Does the Whole Exceed its Parts? The
Effect of AI Explanations on Complementary Team Performance," CHI '21. Abstract, verbatim:

> "While we observed complementary improvements from AI augmentation, they were not increased by
> explanations. Rather, explanations increased the chance that humans will accept the AI's
> recommendation, regardless of its correctness. Our result poses new challenges for human-centered
> AI."
> ([PDF](https://idl.cs.washington.edu/files/2021-AIExplanationsTeamPerformance-CHI.pdf),
> [ACM DL](https://dl.acm.org/doi/10.1145/3411764.3445717),
> [arXiv 2006.14779](https://arxiv.org/abs/2006.14779))

Three datasets, mixed-method user studies, AI accuracy comparable to humans. Explanations moved
acceptance, not accuracy. That is the finding a sharp judge will quote back at a team that says "we
show our reasoning."

### The theory that tells you when explanations do help

Fok and Weld (2024), "In search of verifiability: Explanations rarely enable complementary performance
in AI-advised decision making," *AI Magazine* 45(3). Their claim: "explanations are only useful to the
extent that they allow a human decision maker to verify the correctness of the AI's prediction," and
most tasks "fundamentally do not allow easy verification, regardless of explanation method"
([arXiv 2305.07722](https://arxiv.org/abs/2305.07722),
[Wiley](https://onlinelibrary.wiley.com/doi/abs/10.1002/aaai.12182)).

**INFERRED, and this is Pixie's best argument.** Fok and Weld's framing is a test Pixie happens to pass
where a SHAP waterfall on a gradient-boosted model fails. Pixie's contributions are not learned feature
attributions, they are the named clauses of a written guideline with the number each clause produced
and the document it came from. A commercial property underwriter can open the guideline, read the
clause, look at the input value, and confirm or refute the bar without trusting the system at all. That
is verification in Fok and Weld's sense, not explanation in Bansal's sense. The distinction is worth
naming out loud in the pitch, because it is the difference between "we made a waterfall" and "we made
the decision checkable."

### Where a contribution waterfall actually sits

The negative results above were run on learned models where the explanation is an approximation of an
opaque function. A rule contribution chart on a deterministic rules engine is a different object: it is
not an estimate of what the system did, it is a decomposition of exactly what the system did. No study
I found evaluates that specific case in an underwriting setting, so this is an argument from the theory
rather than a citation. **The empirical gap is real and a judge could push on it.**

### Reducing overreliance costs something

Buçinca, Malaya and Gajos (2021), "To Trust or to Think: Cognitive Forcing Functions Can Reduce
Overreliance on AI in AI-Assisted Decision-Making," *PACM HCI* 5(CSCW1), Article 188. Cognitive forcing
interventions, which make the person commit or engage before seeing the recommendation, reduced
overreliance, and participants liked them least and rated them worst
([Harvard page](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml),
[PDF](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf),
[ACM DL](https://dl.acm.org/doi/10.1145/3449287)). A follow-up found partial explanations reduce
overreliance on incorrect suggestions relative to no explanation, and that people high in need for
cognition benefit more from explanations
([ACM DL 3710946](https://dl.acm.org/doi/10.1145/3710946)).

The effect is also moderated by individual differences, which means "our explanation helps
underwriters" is a claim that would need testing with actual underwriters, not an entitlement.

### Showing uncertainty does not automatically help

- Zhang, Liao and Bellamy (2020), "Effect of Confidence and Explanation on Accuracy and Trust
  Calibration in AI-Assisted Decision Making": showing confidence improved trust and trust calibration
  but did not improve AI-assisted accuracy
  ([arXiv 2001.02114](https://arxiv.org/pdf/2001.02114)).
- "Designing for Appropriate Reliance: The Roles of AI Uncertainty Presentation, Initial User Decision,
  and User Demographics" (*PACM HCI*, 2024): "showing calibrated model uncertainty alone is
  inadequate," and calibration plus a frequency format is what let users adjust reliance and reduced
  confirmation bias ([ACM DL 3637318](https://dl.acm.org/doi/10.1145/3637318)).

**INFERRED.** A 30-75 interval on screen is not self-justifying. The design question the evidence
raises is whether the interval is calibrated (does a 30-75 interval contain the settled answer as often
as it claims) and whether its width is presented in a form underwriters read correctly. Pixie's
interval, as described, comes from missing-fact propagation rather than from a coverage guarantee, so
the honest description is "bounds under unknown inputs," not "a calibrated confidence interval." See
section 5.

---

## 4. Regulation: what is already binding or imminent

### United States: NAIC Model Bulletin (December 2023)

Primary text: [NAIC Model Bulletin, Use of Artificial Intelligence Systems by Insurers, adopted
December 4 2023 (PDF)](https://content.naic.org/sites/default/files/inline-files/2023-12-4%20Model%20Bulletin_Adopted_0.pdf).
Adoption status: as of mid-2026, 25 states plus the District of Columbia have adopted it, with
California, Colorado, New York and Texas running their own frameworks
([Quarles](https://www.quarles.com/newsroom/publications/nearly-half-of-states-have-now-adopted-naic-model-bulletin-on-insurers-use-of-ai),
[NAIC adoption map, PDF](https://content.naic.org/sites/default/files/cmte-h-big-data-artificial-intelligence-wg-map-ai-model-bulletin.pdf)).

What it requires in practice. Insurers are expected to maintain a written AI Systems Program ("AIS
Program"):

> "all Insurers authorized to do business in this state are expected to develop, implement, and
> maintain a written program (an 'AIS Program') for the responsible use of AI Systems that make, or
> support decisions related to regulated insurance practices" (Section 3)

The proportionality test names four things that directly describe Pixie's design choices:

> "(i) the nature of the decisions being made, informed, or supported using the AI System; (ii) the type
> and Degree of Potential Harm to Consumers...; (iii) the extent to which humans are involved in the
> final decision-making process; (iv) the transparency and explainability of outcomes to the impacted
> consumer; and (v) the extent and scope of the insurer's use or reliance on data, Predictive Models,
> and AI Systems from third parties" (Section 3)

Specific program requirements worth quoting at a judge:

- Governance covering "each stage of an AI System life cycle, from proposed development to retirement"
  (2.1), and documentation requirements that "should be developed with Section 4 in mind" (2.2).
- Model management including "Inventories and descriptions of the Predictive Models" (3.3a), "Detailed
  documentation of the development and use" (3.3b), and assessments of "interpretability,
  repeatability, robustness, regular tuning, reproducibility, traceability, model drift, and the
  auditability of these measurements" (3.3c).
- "Validating, testing, and retesting as necessary to assess the generalization of AI System outputs
  upon implementation" (3.4).
- Notice: processes "providing notice to impacted consumers that AI Systems are in use" (1.9).
- Third parties: due diligence, audit rights in contracts, and a requirement that vendors "cooperate
  with the Insurer with regard to regulatory inquiries" (4.1, 4.2).

Section 4 is the examination list. In an investigation or market conduct action an insurer can expect
requests for the written program, the adoption evidence, its scope including "any AI Systems and
technologies not included in or addressed by the AIS Program," policies and training materials, data
lineage and bias analysis records, the model inventory, per-model compliance documentation, "the
techniques, measurements, thresholds, and similar controls used by the Insurer," and validation,
testing and auditing documentation "including evaluation of Model Drift." The bulletin closes by saying
its goal "is not to prescribe specific practices or to prescribe specific documentation requirements."

**INFERRED.** The bulletin is expectations under existing unfair trade practice law, not a new rule
with its own penalties. Its teeth are the Unfair Trade Practices Act (#880), the P&C Model Rating Law
(#1780) requirement that rates not be "excessive, inadequate, or unfairly discriminatory," and the
Market Conduct Surveillance Model Law (#693), all cited in Section 1.

### United States: New York DFS Circular Letter No. 7 (2024)

[Insurance Circular Letter No. 7 (2024), dfs.ny.gov](https://www.dfs.ny.gov/industry-guidance/circular-letters/cl2024-07),
issued 11 July 2024. This is the most demanding US document on the list and the one closest to what
Pixie does.

Quantitative testing. Section 18 expects multiple statistical measures, including "Adverse Impact
Ratio," "Denials Odds Ratios," "Marginal Effects," "Standardized Mean Differences," statistical
significance testing and "Drivers of Disparity" analysis. Section 17 requires testing "prior to putting
AIS into production and on a regular cadence thereafter, as well as whenever material updates or
changes are made," and Section 29 expects testing "at least annually... including drift."

Explainability as a standing obligation. Section 19 requires "the ability to explain, at all times, how
the insurer's AIS operates and to articulate a logical relationship between ECDIS and other model
variables with an insured or potential insured individual's risk."

Adverse decisions. Section 39 requires that the reasons given "include details about all information
upon which the insurer based any declination, limitation, rate differential, or other adverse
underwriting decision, including the source of the specific information," and that consumers be told
they have "the right to request information about the specific data that resulted in the underwriting
or pricing decision." Section 40: "An insurer may not rely on the proprietary nature of a third-party
vendor's algorithmic processes to justify the lack of specificity related to an adverse underwriting or
pricing action." Section 41 treats inadequate disclosure of adverse-decision reasons as potentially "an
unfair or deceptive act and practice."

Effective challenge. Section 32 expects insurers to "promote independent review and effective challenge
to risk analysis, validation, testing, development, and other processes." Section 34 puts internal
audit on the effectiveness of the whole framework.

Scope. The circular applies to "all insurers authorized to write insurance in New York State." The
final version addressed comments that commercial P/C and group life "may not always have a direct
consumer impact" by directing a risk-based approach rather than exempting them, noting for example that
"commercial property/casualty insurance is issued to sole proprietors"
([Debevoise](https://www.debevoisedatablog.com/2024/07/15/nydfs-adopts-final-circular-on-use-of-ai-or-external-data-by-insurers/),
[Alston & Bird](https://www.alstonprivacy.com/nydfs-issues-final-circular-letter-guidance-on-use-of-ai-in-insurance-underwriting-and-pricing/),
[Sullivan & Cromwell memo, PDF](https://www.sullcrom.com/SullivanCromwell/_Assets/PDFs/Memos/NYDFS-Final-Guidance-AI-Use-Insurance-Underwriting-Pricing.pdf)).

### United States: Colorado SB21-169 and the DOI regulations

SB21-169 (2021) is the statute. The Division of Insurance implemented it in stages.

- Regulation 10-1-1, governance and risk management for life insurers using external consumer data and
  information sources (ECDIS), adopted 21 September 2023, effective 14 November 2023
  ([DOI notice of adoption](https://doi.colorado.gov/announcements/notice-of-adoption-new-regulation-10-1-1-governance-and-risk-management-framework)).
- A quantitative testing regulation for life insurance underwriting, drafted 27 September 2023
  ([DOI draft, PDF](https://doi.colorado.gov/sites/doi/files/documents/DRAFT%20Proposed%20Algorithm%20and%20Predictive%20Model%20Quantitative%20Testing%20Regulation.pdf)),
  with life insurers required to be able to demonstrate absence of unfair discrimination by 1 December
  2024 and progress reports from 1 June 2024
  ([BCLP](https://www.bclplaw.com/en-US/events-insights-news/the-future-of-insurance-colorados-new-ecdis-and-ai-model-regulations-1.html)).
- Amended Regulation 10-1-1 extends the governance framework to private passenger auto and health
  benefit plans, finalised 20 August 2025, effective 15 October 2025, interim progress reports due 1
  December 2025, full compliance and annual reporting from 1 July 2026
  ([Amended Reg 10-1-1, PDF](https://www.insurereinsure.com/wp-content/uploads/sites/919/2025/08/Amended-Regulation-10-1-1.pdf),
  [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2025/9/colorado-division-of-insurance-expands-ai-related-governance-and-risk-management-obligations-for-insurers),
  [Actuarial Review](https://ar.casact.org/colorado-expands-ai-governance-to-auto-and-health-insurers/)).

The mechanism to notice: Colorado does not ask whether you intended to discriminate, it asks you to
produce documented quantitative test results showing you do not. That is an evidentiary burden on the
insurer, and it is the direction of travel.

**Scope caveat that matters for Pixie.** Colorado's regime covers individual life, private passenger
auto and health benefit plans. Commercial property is not in it.

### European Union: AI Act

Annex III point 5(c) makes high-risk those "AI systems intended to be used for risk assessment and
pricing in relation to natural persons in the case of life and health insurance"
([Annex III, artificialintelligenceact.eu](https://artificialintelligenceact.eu/annex/3/),
[EC AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3)).

**Commercial property underwriting is outside Annex III point 5(c).** It is neither life nor health,
and a corporate insured is not a natural person. A judge who knows the AI Act may test whether Ben
knows this. Claiming EU AI Act compliance as a selling point for a commercial property desk is a
mistake; claiming the architecture is ready for it if the product moves into personal lines is fine.

Article 86 gives affected persons a right to "clear and meaningful explanations of the role of the AI
system in the decision-making procedure and the main elements of the decision taken," for decisions
based on an Annex III high-risk system that produce legal or similarly significant effects
([Article 86 text](https://www.artificial-intelligence-act.com/Artificial_Intelligence_Act_Article_86.html),
[activeMind](https://www.activemind.legal/legislation/ai-act/article-86/)).

Timing has slipped. Annex III high-risk obligations were to apply from 2 August 2026. Under the Digital
Omnibus on AI (Regulation (EU) 2026/1744, published in the Official Journal 24 July 2026, in force 27
July 2026), stand-alone Annex III high-risk obligations are deferred to 2 December 2027, and Annex I
embedded systems to 2 August 2028. Article 50 transparency obligations were not deferred
([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/),
[Travers Smith](https://www.traverssmith.com/knowledge/knowledge-container/eu-agrees-to-delay-key-ai-act-compliance-deadlines/),
[Cloud Security Alliance research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/)).

EIOPA published an Opinion on AI governance and risk management on 6 August 2025 (EIOPA-BoS-25-360),
addressed to national supervisors, covering AI systems in insurance that are *not* prohibited or
high-risk under the AI Act, and reading AI obligations into Solvency II, IDD, DORA and GDPR rather than
creating new ones
([EIOPA Opinion, PDF](https://www.eiopa.europa.eu/document/download/88342342-a17f-4f88-842f-bf62c93012d6_en?filename=Opinion+on+Artificial+Intelligence+governance+and+risk+management.pdf),
[EIOPA page](https://www.eiopa.europa.eu/publications/opinion-artificial-intelligence-governance-and-risk-management_en)).
Note the gap it fills: commercial lines AI in the EU is governed by this Opinion plus Solvency II
governance, not by the AI Act's high-risk regime.

### Canada, since Intact is a track

- **OSFI Guideline E-23, Model Risk Management.** Final version published 11 September 2025, in effect
  1 May 2027. It applies to all federally regulated financial institutions, and the scope was expanded
  from the earlier version to cover life insurers, fraternal companies, P&C companies, and foreign bank
  branches. It covers all models "regardless of their source (i.e., internal or third party) or
  purpose," and requires ongoing testing, monitoring and review across the model lifecycle
  ([OSFI Guideline E-23](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027),
  [Blakes](https://www.blakes.com/insights/osfi-releases-final-guideline-e-23-for-model-risk-management-and-ai-use-by-frfis/),
  [Torys](https://www.torys.com/en/our-latest-thinking/publications/2025/10/osfi-updates-and-expands-scope-of-guideline-e-23)).
  This is the single most relevant Canadian instrument for a commercial property underwriting engine at
  a federally regulated insurer, because it is scoped by *model*, not by line of business or by
  consumer impact.
- **AMF (Quebec) Guideline on the use of artificial intelligence**, published 30 March, applies to
  authorized insurers among others, in force 1 May 2027
  ([Norton Rose Fulbright](https://www.nortonrosefulbright.com/en-ca/knowledge/publications/27e0daab/amf-s-ai-guideline-is-now-official-what-financial-institutions-need-to-know)).
- **Quebec Law 25, section 12.1.** Where a decision is based exclusively on automated processing of
  personal information, the organisation must inform the person at or before the time of the decision,
  and on request give the personal information used, the reasons and principal factors that led to the
  decision, and the right to have the information corrected, with a right to submit observations to a
  person who can review the decision
  ([WatchDog summary of s.12.1](https://watchdogsecurity.io/law25/automated-decision-making-transparency),
  [SiLaw](https://silaws.com/2026/05/31/automated-decision-ai-disclosure-loi25/)). Note this is keyed to
  *personal information*, so a corporate commercial property insured is generally outside it, and a
  sole proprietor may not be.
- **CCIR** issued a 2024 statement on the use of AI by insurers and intermediaries, and **RIBO**
  published Responsible Use of AI guidance in May 2025 for Ontario brokerages
  ([Torys, AI and insurance](https://www.torys.com/our-latest-thinking/torys-quarterly/q4-2025/ai-and-insurance)).

### The banking precedent everyone in the room will already know

Federal Reserve SR 11-7 / OCC 2011-12, Supervisory Guidance on Model Risk Management (April 2011).
Its central concept is "effective challenge": critical analysis by objective, informed parties who can
identify limitations and assumptions and produce appropriate change, performed by people not involved
in development, implementation or use, with the "skill, knowledge, and stature" to challenge the model,
with findings documented, tracked, escalated and remediated
([SR 11-7, PDF](https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf)).

**INFERRED, and this is the strongest regulatory argument Pixie has.** Pixie's Challenger agent is a
software implementation of the effective-challenge concept that SR 11-7 has required in banking since
2011 and that NYDFS Section 32 now repeats for insurance. Framing the adversarial agent as "automated
effective challenge, logged per decision" speaks the exact language a model risk officer already uses.
The caveat that follows is real: effective challenge in SR 11-7 means *independent people*, not an
instance of the same model family, and a judge may say so. See section on hardest questions.

### Adverse-action reasons, specifically

NAIC Model 670, the Insurance Information and Privacy Protection Model Act, gives a person the right to
request the reasons for an adverse underwriting decision in writing within 90 business days, with the
insurer obliged to furnish reasons within 21 business days, and limits the privilege exception to
information about criminal activity, fraud, material misrepresentation or material nondisclosure
([Model 670, PDF](https://content.naic.org/sites/default/files/model-law-670.pdf)).

**INFERRED.** Pixie's provenance-on-every-value design maps directly onto the Model 670 duty and the
NYDFS Section 39 duty. Both ask a question Pixie can answer mechanically: which specific pieces of
information produced this declination, and where did each come from. That is a stronger compliance
story than any explainability claim about the model.

### One live political risk

An Executive Order of 11 December 2025, "Ensuring a National Policy Framework for Artificial
Intelligence," directs development of federal legislation to preempt state AI laws outside a few carved
out areas, following a Senate vote of 99-1 in 2025 to strip a ten-year state AI preemption moratorium
from the One Big Beautiful Bill Act. The NAIC publicly objected and reaffirmed state authority under
McCarran-Ferguson
([NAIC statement](https://content.naic.org/article/statement-national-association-insurance-commissioners-naic-ai-executive-order),
[Latham & Watkins](https://www.lw.com/en/insights/ai-executive-order-targets-state-laws-and-seeks-uniform-federal-standards),
[Ropes & Gray, March 2026](https://www.ropesgray.com/en/insights/alerts/2026/03/examining-the-landscape-and-limitations-of-the-federal-push-to-override-state-ai-regulation)).
The state-level regime is contested but currently operative.

### What all of this requires in practice, condensed

| Requirement | Where it comes from |
|---|---|
| Written AI program, board or senior-management accountable | NAIC Section 3 §1.3; NYDFS §§21-24; OSFI E-23 |
| Model inventory and per-model documentation | NAIC §3.3a-b; NYDFS §29 |
| Pre-production testing, regular re-testing, drift evaluation | NAIC §3.4; NYDFS §§17, 29; OSFI E-23 |
| Quantitative unfair-discrimination testing with named metrics | NYDFS §18; Colorado Reg 10-1-1 and the quantitative testing regs |
| Ability to explain the system's operation at all times | NYDFS §19 |
| Adverse decision reasons naming the specific data and its source | NYDFS §39; NAIC Model 670 |
| No hiding behind vendor proprietary claims | NYDFS §§14, 40 |
| Independent review and effective challenge | NYDFS §32; SR 11-7 |
| Consumer notice that AI is in use | NAIC §1.9; NYDFS §39; Quebec Law 25 s.12.1 |
| Third-party audit rights and regulator cooperation clauses | NAIC §4.2; NYDFS §§35-37 |

---

## 5. Representing a decision as a range under missing information

Yes, this is an established idea, and it has several names depending on which literature you borrow
from. None of them is standard in insurance underwriting practice, which is both the opportunity and
the weakness.

### Partial identification (econometrics)

Manski's programme. When data are missing, the parameter is not point-identified, but informative
bounds usually still exist under weak assumptions. Manski, "Partial Identification of Probability
Distributions" (Springer, 2003) and *Identification for Prediction and Decision* (Harvard University
Press, 2007)
([HUP](https://www.hup.harvard.edu/books/9780674026537),
[cemmap paper, PDF](https://www.cemmap.ac.uk/wp-content/legacy/forms/manskipaper.pdf)). The decision
half is Manski (2000), "Identification problems and decisions under ambiguity," *Journal of
Econometrics* 95(2), 415-442
([IDEAS](https://ideas.repec.org/a/eee/econom/v95y2000i2p415-442.html)), and Manski, "Identification and
Statistical Decision Theory" ([arXiv 2204.11318](https://arxiv.org/pdf/2204.11318)).

This is the closest formal match to what Pixie does. A missing fact means the score is set-identified,
and the interval is the identified set. **The correct name for Pixie's behaviour is partial
identification, or "worst-case and best-case bounds under the unknown input."**

### Imprecise probability

Walley's theory of coherent lower previsions, and credal sets as closed convex sets of probability
measures. The pricing analogue is exactly Pixie's shape: replace a single fair price with a supremum
acceptable buying price and an infimum acceptable selling price
([Stanford Encyclopedia, Imprecise Probabilities](https://plato.stanford.edu/entries/imprecise-probabilities/supplement-formal.html),
[White Rose review, PDF](https://eprints.whiterose.ac.uk/id/eprint/145944/1/validation-ip.pdf)).

### Conformal prediction (the machine learning route, and the one in actuarial journals)

Conformal prediction gives finite-sample, distribution-free coverage without assuming the model is
correct. Applications in insurance exist and are recent:

- Hong, "Conformal prediction of future insurance claims in the regression problem," *European
  Actuarial Journal* ([Springer](https://link.springer.com/article/10.1007/s13385-026-00445-y)).
- Manna, Sett, Dey, Gu, Schifano and He, "Distribution-free inference for LightGBM and GLM with Tweedie
  loss," which finds locally weighted Pearson residuals for LightGBM "maintained the nominal coverage
  with the smallest average width" ([arXiv 2507.06921](https://arxiv.org/pdf/2507.06921)).
- The Society of Actuaries in Ireland ran an EAA web session on conformal prediction and uncertainty in
  actuarial models in March 2025
  ([listing](https://web.actuaries.ie/events/2025/03/eaa-web-session-intro-conformal-prediction-uncertainty-actuarial-models)).

**Important distinction Ben should not blur.** Conformal prediction intervals carry a coverage
guarantee earned from calibration data. Pixie's interval, as described, is a propagation of unknown
inputs through a deterministic rule set. Those are different objects. Calling the 30-75 interval a
confidence interval or implying a coverage guarantee would be wrong and a statistically literate judge
would catch it. Calling it a partial-identification bound is both accurate and more impressive.

### Abstain rather than guess

- Chow (1970) established the reject option: a classifier that declines to predict in the region where
  it is likely wrong. The modern line is surveyed in "Machine learning with a reject option: a survey,"
  *Machine Learning* (2024) ([ACM DL](https://dl.acm.org/doi/abs/10.1007/s10994-024-06534-x)) and
  "Optimal Strategies for Reject Option Classifiers," *JMLR* 24
  ([PDF](https://jmlr.org/papers/volume24/21-0048/21-0048.pdf)).
- Learning to defer, where the system routes uncertain cases to a human expert: Mozannar and Sontag
  (2020), "Consistent Estimators for Learning to Defer to an Expert," ICML
  ([PMLR PDF](https://proceedings.mlr.press/v119/mozannar20b/mozannar20b.pdf)).
- For language models specifically, Kalai, Nachum, Vempala and Zhang (2025), "Why Language Models
  Hallucinate": models hallucinate partly because standard scoring rewards guessing over admitting
  uncertainty, and the proposed fix is to change benchmark scoring to reward calibrated abstention
  ([OpenAI PDF](https://cdn.openai.com/pdf/d04913be-3f6f-4d2b-b283-ff432ef4aaa5/why-language-models-hallucinate.pdf),
  [arXiv 2509.04664](https://arxiv.org/pdf/2509.04664)).

**INFERRED.** Underwriting already has a name for abstention: "refer." Pixie's refer band at 45 is the
existing workflow, and the literature above is the formal justification for it. The novel part is not
referring, it is that the reason for the referral is a named missing fact rather than an underwriter's
discomfort, and that the what-if slider shows which single fact would settle it. I found no published
precedent for that specific mechanic in insurance. It may genuinely be new; it is also untested.

---

## 6. Hallucinated numbers, and why a string check is a reasonable guard

### Measured rates

Grounded summarisation, the easiest case. Vectara's Hallucination Leaderboard (HHEM-2.3, last updated
11 May 2026, over 7,700 articles across news, technology, science, medicine, legal, sports, business and
education): best model 1.8% (Antgroup Finix S1 32B), another leading model at 3.1%,
and the worst in the table at 24.2%
([GitHub](https://github.com/vectara/hallucination-leaderboard/)). Note what this measures: summarising
a short document that is right there. It is the friendliest possible test and the floor is still not
zero.

Numbers from tables, the case Pixie actually faces. FAITH, a 2025 benchmark built by masking spans in
S&P 500 annual reports, splits tasks by reasoning type. From Table 3:

- Claude-Sonnet-4: 95.6% overall, 97.0% Direct Lookup, 82.6% Comparative, 94.1% Bivariate, **80.0%
  Multivariate**.
- A second evaluated model: 91.9% overall, 97.8% Direct Lookup, 93.1% Comparative, 91.8%
  Bivariate, **90.0% Multivariate**.

The paper states: "While most models perform adequately on Direct Lookup (A), accuracy systematically
decreases as tasks require calculation and logical inference," and that on multivariate tasks "a
significant number of models... score at or near 0.0%." Even the best model's 10-20% failure rate on
multivariate calculation is called "a critical barrier"
([arXiv 2508.05201](https://arxiv.org/abs/2508.05201),
[HTML](https://arxiv.org/html/2508.05201v1)).

Retrieval helps and does not solve it. Magesh, Surani, Dahl, Suzgun, Manning and Ho, "Hallucination-Free?
Assessing the Reliability of Leading AI Legal Research Tools," *Journal of Empirical Legal Studies* 22
(2025), 216-242: Lexis+ AI, Westlaw AI-Assisted Research and Ask Practical Law AI "each hallucinate
between 17% and 33% of the time," reduced relative to GPT-4 but far from the vendors' "hallucination-free"
claims ([arXiv 2405.20362](https://arxiv.org/abs/2405.20362),
[Stanford PDF](https://law.stanford.edu/wp-content/uploads/2024/05/Legal_RAG_Hallucinations.pdf)).

Citations are not verification. Liu, Zhang and Liang (2023), "Evaluating Verifiability in Generative
Search Engines," EMNLP Findings: across Bing Chat, NeevaAI, perplexity.ai and YouChat, "on average, only
51.5% of generated sentences are fully supported by citations and only 74.5% of citations support their
associated sentence," which the authors call "concerningly low... especially given their facade of
trustworthiness" ([arXiv 2304.09848](https://arxiv.org/abs/2304.09848),
[ACL Anthology PDF](https://aclanthology.org/2023.findings-emnlp.467.pdf)).

**This last one is the sharpest argument for Pixie's guard.** Attaching a source to a sentence is not
the same as the sentence being true of that source. Pixie's string check is precisely a machine test of
the property that Liu et al. found generative systems fail about half the time.

### Known mitigations, with evidence

- **Tool use / offload the arithmetic.** Gao, Madaan, Zhou, Alon, Liu, Yang, Callan and Neubig (2023),
  "PAL: Program-aided Language Models," ICML. The model writes code, an interpreter runs it. On GSM8K,
  PAL with Codex reaches 72.0% against 65.6% for chain-of-thought; on GSM-hard, where the numbers are
  larger, 61.2% against 23.1%
  ([arXiv 2211.10435](https://arxiv.org/abs/2211.10435),
  [PMLR](https://proceedings.mlr.press/v202/gao23f.html)). The gap widening on hard numbers is the whole
  point: natural-language arithmetic degrades as the numbers get less familiar. This is direct support
  for "no number is ever produced by a language model."
- **Grounding in retrieved sources.** Multiple measured reductions, none to zero: 68% to 10% in
  structured output generation
  ([arXiv 2404.08189](https://arxiv.org/pdf/2404.08189)), 17-33% residual in the legal tools above.
- **Verification passes.** Evidence here is genuinely mixed, see below.

### The evidence against trusting model reasoning, which Ben should know before a judge raises it

- Turpin, Michael, Perez and Bowman (2023), "Language Models Don't Always Say What They Think: Unfaithful
  Explanations in Chain-of-Thought Prompting," NeurIPS 2023. Adding biasing features to inputs, such as
  reordering multiple-choice options so the answer is always "(A)," changes model answers, and models
  "systematically fail to mention" the bias in their explanations. "CoT explanations can be plausible yet
  misleading, which risks increasing trust in LLMs without guaranteeing their safety"
  ([arXiv 2305.04388](https://arxiv.org/abs/2305.04388),
  [NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2023/hash/ed3fea9033a80fea1376299fa7863f4a-Abstract-Conference.html)).
- Chen, Benton et al., Anthropic Alignment Science Team (2025), "Reasoning Models Don't Always Say What
  They Think." Overall CoT faithfulness scores of 25% for Claude 3.7 Sonnet and 39% for DeepSeek R1; on
  misaligned hints, 20% and 29%; hint reveal rates often below 20%
  ([arXiv 2505.05410](https://arxiv.org/abs/2505.05410),
  [Anthropic PDF](https://assets.anthropic.com/m/71876fabef0f0ed4/original/reasoning_models_paper.pdf)).

**INFERRED, and it is the cleanest statement of Pixie's thesis.** These two papers say the model's
narrative is not reliable evidence about the model's process. Pixie's design does not need it to be.
The narrative is prose, the decision is code, and the guard is a string comparison between them. Pixie
is arguably the right architecture *because* chain-of-thought is unfaithful, not in spite of it.

### The adversarial agent: the evidence is genuinely mixed

For:
- Du, Li, Torralba, Tenenbaum and Mordatch (2023), "Improving Factuality and Reasoning in Language Models
  through Multiagent Debate," ICML 2024. Multiple model instances propose and debate over rounds; the
  authors report significant gains in mathematical and strategic reasoning and improved factual validity
  ([arXiv 2305.14325](https://arxiv.org/abs/2305.14325)).
- McAleese et al., OpenAI (2024), "LLM Critics Help Catch LLM Bugs." On code containing naturally
  occurring LLM errors, model-written critiques were preferred over human critiques 63% of the time, and
  human-plus-critic teams caught similar numbers of bugs to the critic alone while hallucinating fewer
  ([OpenAI PDF](https://cdn.openai.com/llm-critics-help-catch-llm-bugs-paper.pdf),
  [arXiv 2407.00215](https://arxiv.org/html/2407.00215v1)). The authors also flag the failure mode
  directly: critics "can have limitations of their own, including hallucinated bugs that could mislead
  humans."

Against:
- Huang, Chen, Mishra, Zheng, Yu, Song and Zhou (2024), "Large Language Models Cannot Self-Correct
  Reasoning Yet," ICLR 2024. With no external feedback, "LLMs struggle to self-correct their reasoning,
  and in most instances, the performance after self-correction degrades"
  ([arXiv 2310.01798](https://arxiv.org/pdf/2310.01798),
  [ICLR proceedings](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8b4add8b0aa8749d80a34ca5d941c355-Abstract-Conference.html)).

The human-groups literature is also less decisive than the "devil's advocate" folklore suggests. Schwenk
(1990), "Effects of devil's advocacy and dialectical inquiry on decision making: A meta-analysis,"
*OBHDP* 47(1), 161-176, found neither technique was more effective than the other at introducing
productive conflict
([ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/074959789090051A)). Earlier
individual studies, such as Schweiger, Sandberg and Ragan (1986) in *AMJ*, did find both beat consensus
on recommendation and assumption quality
([AMJ](https://journals.aom.org/doi/10.5465/255859)).

**The honest summary: structured dissent beats unstructured agreement, but which structure you pick does
not clearly matter, and a critic with no external feedback source can degrade the answer.** Pixie's
Challenger is on the better side of that line only because it has external feedback, the tool-computed
numbers and the guideline text, rather than only its own priors. That distinction is worth stating
explicitly, because it is what separates the design from the thing Huang et al. showed does not work.

---

## Which of Pixie's bets the evidence supports

**(a) No number from a language model, every model sentence string-checked against tool-computed
numbers. Strongly supported, and the best-evidenced bet of the four.**
FAITH measures accuracy collapsing from 97.0% on direct lookup to 80.0% on multivariate calculation for
the best model, with many models near zero on multivariate
([arXiv 2508.05201](https://arxiv.org/abs/2508.05201)). PAL shows offloading arithmetic to an interpreter
moves GSM-hard from 23.1% to 61.2% ([arXiv 2211.10435](https://arxiv.org/abs/2211.10435)). Liu et al.
show that attaching a source to a sentence leaves roughly half of sentences not fully supported
([arXiv 2304.09848](https://arxiv.org/abs/2304.09848)), which is exactly the failure a string check
catches. NYDFS §19 independently requires the ability to explain how the system operates "at all times,"
which a deterministic engine satisfies and a generated number does not.

**(b) A missing fact widens the score into a range. Supported in principle, with a naming problem.**
Partial identification (Manski), imprecise probability (Walley), reject-option classification (Chow
1970 onward) and learning to defer (Mozannar and Sontag 2020) are all established formalisms for exactly
this move, and conformal prediction is arriving in actuarial journals
([EAJ](https://link.springer.com/article/10.1007/s13385-026-00445-y)). Kalai et al. 2025 argue directly
that systems should be rewarded for admitting uncertainty rather than guessing. What the evidence does
*not* support is calling the interval a confidence interval, or assuming that showing it improves
decisions: Zhang et al. 2020 found confidence displays improved trust calibration but not accuracy
([arXiv 2001.02114](https://arxiv.org/pdf/2001.02114)), and the 2024 CSCW study found calibrated
uncertainty alone "inadequate" without the right presentation format
([ACM DL 3637318](https://dl.acm.org/doi/10.1145/3637318)).

**(c) An adversarial agent argues against every decision. Supported by regulation more strongly than by
the AI literature.**
SR 11-7's "effective challenge" and NYDFS §32's "independent review and effective challenge" mean Pixie
is implementing something regulators already demand
([SR 11-7 PDF](https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf)). On the AI side the
evidence cuts both ways: multiagent debate helps
([arXiv 2305.14325](https://arxiv.org/abs/2305.14325)), LLM critics help and hallucinate bugs
([OpenAI PDF](https://cdn.openai.com/llm-critics-help-catch-llm-bugs-paper.pdf)), and intrinsic
self-correction without external feedback degrades performance
([arXiv 2310.01798](https://arxiv.org/pdf/2310.01798)). Pixie's version has external feedback, which is
the condition under which critique works.

**(d) Every value carries its provenance. Supported, and it is the compliance bet rather than the UX
bet.**
NYDFS §39 requires adverse-decision reasons to include "details about all information upon which the
insurer based any declination... including the source of the specific information," and §40 forbids
hiding behind vendor proprietary claims. NAIC Model 670 gives a 21-business-day duty to furnish reasons.
NAIC Section 4 asks for data source, provenance and lineage per model under examination. Provenance is
not a nice-to-have, it is the artefact a market conduct examiner asks for. On the human-factors side,
Fok and Weld's verifiability theory
([arXiv 2305.07722](https://arxiv.org/abs/2305.07722)) says provenance is what makes an explanation
useful rather than merely persuasive, which is the one route around Bansal et al.'s finding that
explanations raise acceptance without raising accuracy
([CHI '21 PDF](https://idl.cs.washington.edu/files/2021-AIExplanationsTeamPerformance-CHI.pdf)).

**The bet the evidence does not support, and that nobody listed:** that underwriters will use it. Nothing
in Pixie's design as described addresses algorithm aversion, and Dietvorst 2015 shows experts abandon a
model after seeing it err even when it beats them by wide margins. Dietvorst 2018 gives the cheap fix:
let the underwriter move the output within a bound. The what-if slider is close to this but appears to
be a what-if on the input, not a bounded override of the output. That is a one-feature gap between the
product and the best-replicated finding in the adoption literature.

---

## The three hardest questions an industry judge could ask, and the honest answer to each

### 1. "Your string check proves the prose matches the numbers. It says nothing about whether the numbers are right. What have you actually guaranteed?"

This is the strongest attack and it lands. The guard verifies consistency between two artefacts, not
correctness of either. A wrong rule weight, a stale hazard layer or a misparsed submission field
produces a wrong number that the checker will happily confirm the prose reports faithfully.

The honest answer has three parts. First, that is still the failure mode worth eliminating first,
because it is the one that is invisible: a wrong number from a deterministic engine is reproducible,
auditable and fixable, while a number invented by a model in a sentence is none of those. Second, the
correctness of the numbers is a different control and Pixie has the beginnings of it in the backtest
suite and in the fact that every bar traces to a clause of a written guideline a human can read.
Third, this is exactly the split regulators make. NAIC Section 3.4 asks for validation and testing of
outputs, and NYDFS §§17-18 ask for quantitative testing on a cadence; neither is satisfied by a string
check. Pixie has the transcription control and not yet the validation control, and saying so is more
credible than claiming both.

### 2. "Your Challenger is the same model family arguing with itself. SR 11-7 effective challenge means independent people with standing and authority. Why is this not theatre?"

Also lands. SR 11-7 is explicit that validation must be done by people "not involved in the development,
implementation, or use of the model" with the "skill, knowledge, and stature to effectively challenge"
it ([SR 11-7 PDF](https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf)). An agent in the
same process is none of those things, and Huang et al. showed intrinsic self-correction degrades
performance ([arXiv 2310.01798](https://arxiv.org/pdf/2310.01798)).

The honest answer is to concede the framing and narrow the claim. Pixie's Challenger is not effective
challenge and should never be presented as satisfying SR 11-7 or NYDFS §32. What it is: a per-decision
objection log, grounded in tool-computed numbers and guideline text rather than in the model's own
priors, which gives the human reviewer a starting list of the specific things that could be wrong with
this specific file. The value is that it makes the human's challenge cheaper and leaves an artefact, not
that it replaces the human. Evidence that critique with external grounding catches real errors exists
(CriticGPT, 63% preference over human critiques) alongside the authors' own warning about hallucinated
bugs ([OpenAI PDF](https://cdn.openai.com/llm-critics-help-catch-llm-bugs-paper.pdf)). Pixie labels each
objection grounded or not, which is the right instinct; the number a judge will want is what fraction of
objections are false alarms, and Ben should know that number before being asked.

### 3. "Underwriter noise: what is your evidence, other than one unreplicated consultancy audit in a pop-science book? And for commercial property specifically?"

This is the question a genuinely knowledgeable judge asks, and it is the weakest point in the pitch.

The honest answer: the 55% figure is one noise audit of 48 underwriters at one unnamed company, reported
by the authors, with no published protocol or data and no replication
([strategy+business](https://www.strategy-business.com/article/How-noisy-is-your-company),
[Insurance Thought Leadership](https://www.insurancethoughtleadership.com/our-big-problem-noise)). There
is no peer-reviewed measurement of agreement between commercial property underwriters on identical
submissions that I could find, and the numbers circulating in vendor content are unsourced. The sturdy
part of the literature is older and broader: mechanical combination beats clinical judgment across 136
studies by roughly 10% on average (Grove et al. 2000), which is about accuracy, not about consistency in
commercial property.

What Ben should say instead of defending the number: Pixie does not need underwriter noise to be 55% to
be worth building. It needs two weaker claims that are unarguable. A guideline applied by code gives the
same answer twice, and no human process does. And whatever the true noise level is, no carrier currently
measures it, because measuring it requires the thing Pixie produces, a replayable scored decision with
every input and its source attached. The right offer to a carrier is not "we fix your 55% noise," it is
"run us alongside your desk for a quarter and we will tell you what your actual number is." That reframe
turns the weakest evidence in the deck into the product's first use case.

---

## Sources

- [Sibony, "How noisy is your company?", strategy+business](https://www.strategy-business.com/article/How-noisy-is-your-company)
- [Kahneman, Rosenfield, Gandhi, Blaser, "Noise," HBR October 2016](https://hbr.org/2016/10/noise)
- [Insurance Thought Leadership, "Our Big Problem With 'Noise'"](https://www.insurancethoughtleadership.com/our-big-problem-noise)
- [Dietvorst, Simmons, Massey 2015, Algorithm Aversion (PDF)](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/Dietvorst-Simmons-Massey-2014.pdf)
- [Dietvorst, Simmons, Massey 2018, Overcoming Algorithm Aversion (PDF)](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf) · [INFORMS](https://pubsonline.informs.org/doi/10.1287/mnsc.2016.2643)
- [Logg, Minson, Moore 2019, Algorithm appreciation (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2941774) · [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0749597818303388)
- [Hoffman, Kahn, Li 2018, Discretion in Hiring (QJE)](https://academic.oup.com/qje/article-abstract/133/2/765/4430650) · [PDF](https://www-2.rotman.utoronto.ca/facbios/file/Discretion.pdf) · [NBER](https://www.nber.org/papers/w21709)
- [Bansal et al. 2021, Does the Whole Exceed its Parts (PDF)](https://idl.cs.washington.edu/files/2021-AIExplanationsTeamPerformance-CHI.pdf) · [ACM DL](https://dl.acm.org/doi/10.1145/3411764.3445717)
- [Fok & Weld 2024, In Search of Verifiability](https://arxiv.org/abs/2305.07722) · [AI Magazine](https://onlinelibrary.wiley.com/doi/abs/10.1002/aaai.12182)
- [Buçinca, Malaya, Gajos 2021, To Trust or to Think (PDF)](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf) · [ACM DL](https://dl.acm.org/doi/10.1145/3449287)
- [Zhang, Liao, Bellamy 2020, Effect of Confidence and Explanation](https://arxiv.org/pdf/2001.02114)
- [Designing for Appropriate Reliance, PACM HCI 2024](https://dl.acm.org/doi/10.1145/3637318)
- [NAIC Model Bulletin on AI, adopted 4 Dec 2023 (PDF)](https://content.naic.org/sites/default/files/inline-files/2023-12-4%20Model%20Bulletin_Adopted_0.pdf) · [NAIC announcement](https://content.naic.org/article/naic-members-approve-model-bulletin-use-ai-insurers) · [adoption map (PDF)](https://content.naic.org/sites/default/files/cmte-h-big-data-artificial-intelligence-wg-map-ai-model-bulletin.pdf) · [Quarles on adoption count](https://www.quarles.com/newsroom/publications/nearly-half-of-states-have-now-adopted-naic-model-bulletin-on-insurers-use-of-ai)
- [NYDFS Insurance Circular Letter No. 7 (2024)](https://www.dfs.ny.gov/industry-guidance/circular-letters/cl2024-07) · [Debevoise](https://www.debevoisedatablog.com/2024/07/15/nydfs-adopts-final-circular-on-use-of-ai-or-external-data-by-insurers/) · [Alston & Bird](https://www.alstonprivacy.com/nydfs-issues-final-circular-letter-guidance-on-use-of-ai-in-insurance-underwriting-and-pricing/) · [Sullivan & Cromwell (PDF)](https://www.sullcrom.com/SullivanCromwell/_Assets/PDFs/Memos/NYDFS-Final-Guidance-AI-Use-Insurance-Underwriting-Pricing.pdf)
- [Colorado DOI, Reg 10-1-1 notice of adoption](https://doi.colorado.gov/announcements/notice-of-adoption-new-regulation-10-1-1-governance-and-risk-management-framework) · [Amended Reg 10-1-1 (PDF)](https://www.insurereinsure.com/wp-content/uploads/sites/919/2025/08/Amended-Regulation-10-1-1.pdf) · [draft quantitative testing reg (PDF)](https://doi.colorado.gov/sites/doi/files/documents/DRAFT%20Proposed%20Algorithm%20and%20Predictive%20Model%20Quantitative%20Testing%20Regulation.pdf) · [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2025/9/colorado-division-of-insurance-expands-ai-related-governance-and-risk-management-obligations-for-insurers) · [Actuarial Review](https://ar.casact.org/colorado-expands-ai-governance-to-auto-and-health-insurers/)
- [EU AI Act Annex III](https://artificialintelligenceact.eu/annex/3/) · [EC AI Act Service Desk, Annex III](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3) · [Article 86](https://www.artificial-intelligence-act.com/Artificial_Intelligence_Act_Article_86.html) · [activeMind on Art. 86](https://www.activemind.legal/legislation/ai-act/article-86/)
- [Gibson Dunn on the Digital Omnibus deferral](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/) · [Travers Smith](https://www.traverssmith.com/knowledge/knowledge-container/eu-agrees-to-delay-key-ai-act-compliance-deadlines/) · [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/)
- [EIOPA Opinion on AI governance and risk management, 6 Aug 2025 (PDF)](https://www.eiopa.europa.eu/document/download/88342342-a17f-4f88-842f-bf62c93012d6_en?filename=Opinion+on+Artificial+Intelligence+governance+and+risk+management.pdf) · [EIOPA page](https://www.eiopa.europa.eu/publications/opinion-artificial-intelligence-governance-and-risk-management_en)
- [OSFI Guideline E-23, Model Risk Management (2027)](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027) · [Blakes](https://www.blakes.com/insights/osfi-releases-final-guideline-e-23-for-model-risk-management-and-ai-use-by-frfis/) · [Torys](https://www.torys.com/en/our-latest-thinking/publications/2025/10/osfi-updates-and-expands-scope-of-guideline-e-23)
- [Norton Rose Fulbright on the AMF AI guideline](https://www.nortonrosefulbright.com/en-ca/knowledge/publications/27e0daab/amf-s-ai-guideline-is-now-official-what-financial-institutions-need-to-know) · [Torys, AI and insurance (Canada)](https://www.torys.com/our-latest-thinking/torys-quarterly/q4-2025/ai-and-insurance)
- [Quebec Law 25 s.12.1 summary](https://watchdogsecurity.io/law25/automated-decision-making-transparency) · [SiLaw](https://silaws.com/2026/05/31/automated-decision-ai-disclosure-loi25/)
- [Federal Reserve SR 11-7 (PDF)](https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf)
- [NAIC Model 670, Insurance Information and Privacy Protection Model Act (PDF)](https://content.naic.org/sites/default/files/model-law-670.pdf)
- [NAIC statement on the AI Executive Order](https://content.naic.org/article/statement-national-association-insurance-commissioners-naic-ai-executive-order) · [Latham & Watkins](https://www.lw.com/en/insights/ai-executive-order-targets-state-laws-and-seeks-uniform-federal-standards) · [Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2026/03/examining-the-landscape-and-limitations-of-the-federal-push-to-override-state-ai-regulation)
- [Manski, Identification for Prediction and Decision (HUP)](https://www.hup.harvard.edu/books/9780674026537) · [Partial Identification of Probability Distributions (PDF)](https://www.cemmap.ac.uk/wp-content/legacy/forms/manskipaper.pdf) · [Identification and Statistical Decision Theory](https://arxiv.org/pdf/2204.11318) · [Manski 2000, JEcm](https://ideas.repec.org/a/eee/econom/v95y2000i2p415-442.html)
- [Stanford Encyclopedia, Imprecise Probabilities](https://plato.stanford.edu/entries/imprecise-probabilities/supplement-formal.html) · [White Rose, Imprecise Probabilities (PDF)](https://eprints.whiterose.ac.uk/id/eprint/145944/1/validation-ip.pdf)
- [Hong, Conformal prediction of future insurance claims, EAJ](https://link.springer.com/article/10.1007/s13385-026-00445-y) · [Manna et al., Distribution-free inference for LightGBM and GLM with Tweedie loss](https://arxiv.org/pdf/2507.06921) · [Society of Actuaries in Ireland session](https://web.actuaries.ie/events/2025/03/eaa-web-session-intro-conformal-prediction-uncertainty-actuarial-models)
- [Machine learning with a reject option: a survey](https://dl.acm.org/doi/abs/10.1007/s10994-024-06534-x) · [Optimal Strategies for Reject Option Classifiers, JMLR (PDF)](https://jmlr.org/papers/volume24/21-0048/21-0048.pdf) · [Mozannar & Sontag 2020 (PDF)](https://proceedings.mlr.press/v119/mozannar20b/mozannar20b.pdf)
- [Kalai et al. 2025, Why Language Models Hallucinate (OpenAI PDF)](https://cdn.openai.com/pdf/d04913be-3f6f-4d2b-b283-ff432ef4aaa5/why-language-models-hallucinate.pdf) · [arXiv](https://arxiv.org/pdf/2509.04664)
- [Vectara Hallucination Leaderboard](https://github.com/vectara/hallucination-leaderboard/)
- [FAITH benchmark](https://arxiv.org/abs/2508.05201) · [HTML with tables](https://arxiv.org/html/2508.05201v1)
- [Magesh et al., Hallucination-Free?](https://arxiv.org/abs/2405.20362) · [Stanford PDF](https://law.stanford.edu/wp-content/uploads/2024/05/Legal_RAG_Hallucinations.pdf)
- [Liu, Zhang, Liang, Evaluating Verifiability in Generative Search Engines](https://arxiv.org/abs/2304.09848) · [ACL Anthology (PDF)](https://aclanthology.org/2023.findings-emnlp.467.pdf)
- [Gao et al., PAL: Program-aided Language Models](https://arxiv.org/abs/2211.10435) · [PMLR](https://proceedings.mlr.press/v202/gao23f.html)
- [Reducing hallucination in structured outputs via RAG](https://arxiv.org/pdf/2404.08189)
- [Turpin et al., Language Models Don't Always Say What They Think](https://arxiv.org/abs/2305.04388) · [NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2023/hash/ed3fea9033a80fea1376299fa7863f4a-Abstract-Conference.html)
- [Chen, Benton et al., Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410) · [Anthropic PDF](https://assets.anthropic.com/m/71876fabef0f0ed4/original/reasoning_models_paper.pdf)
- [Huang et al., LLMs Cannot Self-Correct Reasoning Yet](https://arxiv.org/pdf/2310.01798) · [ICLR](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8b4add8b0aa8749d80a34ca5d941c355-Abstract-Conference.html)
- [Du et al., Multiagent Debate](https://arxiv.org/abs/2305.14325)
- [McAleese et al., LLM Critics Help Catch LLM Bugs (OpenAI PDF)](https://cdn.openai.com/llm-critics-help-catch-llm-bugs-paper.pdf) · [arXiv HTML](https://arxiv.org/html/2407.00215v1)
- [Schwenk 1990, meta-analysis (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/074959789090051A) · [Schweiger, Sandberg, Ragan 1986, AMJ](https://journals.aom.org/doi/10.5465/255859)
- [Swiss Re, Underwriting excellence](https://www.swissre.com/reinsurance/life-and-health/underwriting-excellence.html) · [RGA, US Underwriting](https://www.rgare.com/solutions/underwriting/us-underwriting) · [Gen Re 2023 AU survey (PDF)](https://www.genre.com/content/dam/generalreinsuranceprogram/documents/surveylhau23-en.pdf)
