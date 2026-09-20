# Screen map

| Screen | Purpose | Best use |
| --- | --- | --- |
| `/queue` | Commercial submissions, appetite and review priority | Start the Federato pitch |
| `/guideline`, `/method` | Active rules and expandable scoring equation | Explain scoring before the case |
| `/cases/138` | Sources, calculation, what-if, recorded investigation and adjustable panels | Main commercial example |
| `/cases/126` | Recorded model-written Challenger | Optional challenge example; case 138 uses a sensitivity fallback |
| `/map` | Exposure concentration and source-labelled geographic context | Explain existing exposure and hazards |
| `/backtest` | Historical outcomes and recorded enrichment effects | Show measured changes and the known miss |
| `/present`, or P in the app | One nine-slide explanatory deck | P switches both ways; arrows move slides |
| `/live` | Recorded specialist investigation or a deliberate live run | Technical or provider questions |
| `/ask` | Natural language to a checked Federato query | Federato or Rox query demonstration |
| `/intact` | Home and Auto workflow overview | Intact opening |
| `/intact/insurer` | Incident reports, submitted files, reviews and exports | Connected evidence demonstration |
| `/intact/quotes` | Tenant receipts and advisor referrals | Human handoff |
| `/intact/agent` | Consumer MCP tools | Sourced agent request |
| Expo Home | Tenant estimate, inventory, Auto entry and community savings | Customer starting point |
| Expo Compare | Coverage scenarios, car budget and credit allocation | Customer control |
| Expo Insights | Prevention and coaching-only Drive Score | Risk awareness |
| Expo Community | Incident reporting, witnesses and recovery plan | Post-incident workflow |
| `/privacy`, `/terms` | Product trust pages | Reference when needed |

The Federato sequence is Submissions, Rulebook, Case 138, Portfolio, Validation. Focus one case panel at a time. Equation details belong in the app; the slides contain short summaries.

The product switch moves between Federato and Intact. Home/Auto is a separate consumer context switch. Home pricing is tenant-only. Auto inputs and witness credits are illustrative. Drive Score never changes a price.

Both web products use port 3100. The Expo app uses port 8081 and calls the shared API on port 8000. Replace `localhost` with a reachable server address on another device.
