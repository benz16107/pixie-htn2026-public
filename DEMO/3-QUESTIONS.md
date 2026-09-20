# Questions and answers

## "Is the AI setting the insurance price?"

"No. Python computes commercial scores, tenant and Auto estimates, driving-context coaching, thresholds, and portfolio totals. Agents call typed tools and explain the returned result."

## "Why an interval?"

"A missing fact may belong to several rule bands. Pixie evaluates all of them. The interval shows the decisions still possible and identifies the fact that would narrow it."

## "Is this a real carrier rate?"

"No. Tenant and Auto prices are illustrative and labelled on the receipt. Home pricing is tenant-only. The product claim is the source-labelled workflow, comparison, and handoff."

## "Does driving context change the premium?"

"No. It is a coaching result with separate behavior and synthetic route-context scores. The API stores no coordinates, returns none, and cannot write into a quote."

## "What can the MCP agent see?"

"It can call narrow estimate, comparison, draft, policy-summary, driving-context, and recovery tools. There is no full-profile tool, and draft actions remain unsent until a licensed workflow takes over."

## "What is live?"

"The screen labels the active path. Replay is a recorded agent run. Elastic results say Elastic or memory. Provider judgments name their source. I will not describe a fallback as a live call."

## "Why six agents?"

"Each role has a narrow question and typed output. The lead can ask at most two rounds, the run has a budget, and a challenger must address the draft before the decision closes."

## "What would make this production-ready?"

"Carrier-approved tariffs and guidelines, a larger prospective evaluation, fairness and privacy reviews, identity and access controls, native distribution, and provider deployment work."

## Wording to avoid

| Avoid | Say instead |
| --- | --- |
| "The AI decides the risk" | "The engine computes the decision interval; agents investigate and explain." |
| "This is an Intact price" | "This is an illustrative Pixie estimate under documented demo rules." |
| "The app prices homeowner insurance" | "Home currently prices tenant insurance and adds protection tools." |
| "Your route improves your premium" | "Route context provides coaching and cannot affect this quote or premium." |
| "Everything is live" | Name the live, replay, cache, or fallback path visible on screen. |
| "The backtest proves accuracy" | "The small pre-registered backtest exposes both matches and misses." |
