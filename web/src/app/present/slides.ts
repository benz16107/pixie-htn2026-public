export type Slide = {
  title: string;
  description: string;
  paragraphs?: string[];
  sources?: { label: string; href: string }[];
};

export const slides: Slide[] = [
  {
    title: "What single fact would change the answer?",
    description: "Pixie tells an underwriter why a submission needs attention, and what evidence could change the decision.",
  },
  {
    title: "Appetite and winnability",
    description: "Appetite is the risk you want. Winnability is the opportunity you can win. This dataset lacks the broker behaviour history needed to reproduce Federato's winnability model, so Pixie goes deeper on appetite.",
    paragraphs: [
      "Hit ratio is the share of issued quotes that become policies. Quote 100 and bind 20: a 20% hit ratio.",
      "A high-appetite bound quote is an offer that became a policy for a risk the carrier wanted to insure.",
    ],
  },
  {
    title: "A range tied to named missing facts",
    description: "Known, estimated or missing: each fact keeps its source. When unresolved facts could change the outcome, the appetite range shows that uncertainty.",
    paragraphs: [
      "The what-if slider shows how a new fact moves the decision and where it crosses a decision boundary.",
      "Imprecise credibility theory and conformal prediction offer related ideas about uncertainty. Pixie's range is rule-based, not a calibrated confidence interval.",
    ],
  },
  {
    title: "Investigate what is missing",
    description: "Pixie pulls submissions from Federato's API, assembles the facts, scores against the written guideline and ranks the queue for review.",
    paragraphs: [
      "Agents query the data, fetch hazard evidence and estimate premium from comparable policies when the available facts cannot settle a case.",
      "The underwriter receives the recommendation, its reasons, the counter-argument and a drafted broker request for the evidence that could settle it.",
    ],
  },
  {
    title: "The Challenger argues back",
    description: "A second agent attacks the draft decision using case evidence and deterministic sensitivity analysis. It gives the strongest objection, the risks, a remedy for each, and the evidence that would change its mind.",
    paragraphs: [
      "Roy and Singh report hallucination falling from 11.3% to 3.8% across 500 expert-validated cases. These are their study results, not Pixie's measured performance.",
      "In cases 126 and 143, the recorded desk recommendations questioned engine declines. The original scores and hard failures remain visible for human review.",
    ],
    sources: [
      { label: "Roy & Singh · adversarial self-critique", href: "https://arxiv.org/abs/2602.13213" },
      { label: "Effective challenge · banking review principle", href: "https://www.federalreserve.gov/frrs/guidance/supervisory-guidance-on-model-risk-management.htm" },
    ],
  },
  {
    title: "The underwriter has the final say",
    description: "An underwriter can adjust the score by up to five points with a written reason. The adjustment is logged, undoable and kept beside the untouched engine result.",
    paragraphs: [
      "Dietvorst's research found that letting people make even limited adjustments increased their willingness to use imperfect algorithms.",
      "The reviewed decision belongs in the case's audit trail. The proposed text-reply workflow extends that handoff through a connected messaging integration.",
    ],
    sources: [{ label: "Dietvorst, Simmons & Massey · algorithm aversion", href: "https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf" }],
  },
  {
    title: "See the risk within the portfolio",
    description: "Flood maps, earthquake history and wind evidence add geographic context, alongside how much active insured value already sits within 30 km.",
    paragraphs: [
      "This demo focuses on commercial property. Federato also serves commercial lines, specialty and E&S, meaning excess and surplus. Extending Pixie would require the relevant rules and evidence for each line.",
      "Carriers carry the insured risk; MGAs underwrite on their behalf. Federato's published customer stories include HDVI, QBE, Velocity Risk, Frederick Mutual and Propeller.",
    ],
    sources: [
      { label: "Federato · markets and MGAs", href: "https://www.federato.ai/icp/mga" },
      { label: "Federato · customer stories", href: "https://www.federato.ai/resources/case-studies" },
    ],
  },
  {
    title: "A backtest that shows its own miss",
    description: "The backtest includes a historical policy the rules would have accepted that later incurred $629,200 in losses.",
    paragraphs: ["Showing the miss lets the underwriter question the rulebook. Appetite fit does not guarantee a profitable risk."],
  },
  {
    title: "Why Pixie is different",
    description: "An appetite range tied to missing facts, a what-if tied to the decision boundary, and a Challenger grounded in computed evidence.",
    paragraphs: [
      "Shared calculation and evidence infrastructure supports both the underwriting desk and the renter's phone experience, with each product's own rules.",
      "The backtest exposes its mistakes. Code computes the underwriting numbers, and the underwriter makes the decision.",
    ],
  },
];
