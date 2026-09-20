# Intact: asynchronous judging guide

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md)

## The pitch

"Pixie gives customers one clear place to get insurance, understand a choice, reduce risk, and recover after an incident. The web diagram explains the system. The Expo app proves the customer experience. The MCP server lets an AI agent use the same narrow, sourced insurance tools."

This submission is judged from the Devpost page. The first image and first 15 seconds must explain the whole product without narration.

## The story to tell

The web page shows four connected insurance jobs: Quote, Decide, Protect, and Recover. Each job connects directly to its Home proof, Auto proof, deterministic service, and MCP role. Clicking a node opens its evidence.

The phone uses consumer language instead. Its tabs are Home, Compare, Insights, and Community. Home and Auto share the same app but show different tools. This keeps the pitch architecture out of the customer's way.

| Customer need | Working proof |
| --- | --- |
| Get covered | Photo inventory fills tenant contents coverage; a budget slider compares three cars with insurance |
| Understand the choice | Live coverage explorer, deductible repair-bill example, and itemized receipt |
| Reduce risk | Room inventory, prevention tasks, and foreground Drive Score |
| Get help | Safety-first incident record and local recovery-plan PDF |
| Ask through an agent | Live MCP tenant estimate, car comparison, and drive explanation |

## Why the Drive Score is different

The phone measures speed and hard braking during an explicit foreground session. The service evaluates road context separately. Driving near a school or dense intersection can lower the context score because the route needs more attention. That does not label the driver as unsafe. The final coaching score shows both parts, stores no coordinates, and stays outside pricing.

## Live MCP demo

Open `/intact/agent`. Use **Tenant estimate** first.

1. Change the address or contents amount.
2. Point to the selected tool and the exact arguments.
3. Click **Run live agent request**.
4. Show the itemized result and its sources.
5. Switch to **Explain a drive** to show the behavior score beside the road-context score.

Say: "The model can choose a tool and explain the answer. The MCP server validates the input. Deterministic code owns the price and score."

The repository contains `.mcp.json`, so project-aware agents can start the stdio server. Other MCP clients can use `http://macserver:8010/mcp` while the HTTP process is running. The server exposes nine tools and needs no API key.

## Devpost gallery

1. Connected web diagram with Quote, Decide, Protect, Recover, MCP, Expo, and proof nodes visible.
2. Consumer phone Home screen.
3. Three-car comparison.
4. Active Drive Score and the widget or Live Activity.
5. Live MCP request with a sourced tenant result.
6. Tenant receipt or ready recovery plan.

## Two-minute, forty-second video

| Time | Action | Script |
| ---: | --- | --- |
| 0:00 to 0:18 | Show the connected web diagram. | "Getting insurance is one moment in a longer relationship. Pixie connects quoting, decisions, prevention, and recovery to one phone app and one set of controlled tools." |
| 0:18 to 0:42 | Show the phone Home and Auto comparison. | "The phone speaks in customer tasks. I can estimate tenant coverage or compare the cost of a car and its insurance before I buy." |
| 0:42 to 1:15 | Run the Drive Score sample. | "During an opt-in drive, Pixie measures speed changes and hard braking. It evaluates coarse road context separately, explains both scores, and stores no route." |
| 1:15 to 1:30 | Show widget and Live Activity proof. | "Expo keeps the active score visible on the Home Screen, Lock Screen, and Dynamic Island in the native development build." |
| 1:30 to 2:05 | Open the live MCP page and run the tenant request. | "An AI agent can ask for the same estimate through MCP. You can see the tool, every argument, the deterministic answer, and the source behind each line." |
| 2:05 to 2:27 | Show Community and create a recovery plan. | "After an incident, Pixie starts with safety, organizes the record locally, and lets the customer decide whether to share it." |
| 2:27 to 2:40 | Return to the diagram. | "Models choose and explain. Typed tools calculate. Customers can see what happened and what to do next." |

## Required disclosure

"Pixie currently prices tenant insurance, not homeowner insurance. Vehicle listings, Auto prices, and route contexts are illustrative. Drive Score is coaching only and cannot change a premium. Native widgets and Live Activities require an iOS development build. Pixie does not submit an insurance application or claim."

If the API is unavailable, use the labelled illustrative estimates. If Apple signing is unavailable, show the foreground Drive Score and the in-app native-surface previews. If geocoding fails, use one of the provided Toronto addresses.

## Stronger discovery sequence

Record this as a close-up phone segment for Devpost. It works without explaining the architecture first.

1. Home → **Your belongings**. Add a real item and replacement value, or tap **Try a furnished-room example**. Show room totals. Say: "Start with what you own instead of guessing a coverage amount. I supply the value; Pixie totals it and uses it in the estimate."
2. Use the total in an estimate, select a Toronto example, and open **Explore price changes first**. Change the deductible. Show the updated monthly price in the footer and the repair-bill example below. Say: "I can compare the price with what I might pay toward a covered loss before keeping a change."
3. Switch to Auto → **Compare cars**. Change the monthly budget. Say: "A car's payment is only part of the monthly cost. Pixie adds illustrative insurance and shows which cars fit my budget."

Use the [new screenshots](../../docs/assets/intact/discovery/README.md) in the gallery. The inventory uses camera or library input, local persistence, and customer-entered values. Do not describe it as AI recognition or an appraisal. Vehicle listings remain examples, not a live AutoTrader feed. Keep the API running for the Home price explorer. Cached tenant prices cannot price arbitrary new choices.

## Connected driver and witness recovery

The mobile app now includes Incident exchange for both drivers and bystanders. The website adds an **Insurer** tab under Intact. Demonstrate a driver report, a witness upload, a reviewer decision, and the status returning to the phone. Follow the [road-help script](../10-ROAD-HELP.md). Expo Image Picker handles photos and clips, Expo Video plays the evidence, and the existing recovery plan carries the incident reference. Credits are demo bookkeeping; file hashes do not establish authenticity or fault.

## Witness incentive to demonstrate

Open Community on either Home or Auto, then **I witnessed an incident**. Each request states its offered demo credit. A submitted file waits for review before it earns anything. Accept it in the insurer workspace, then show the witness Home screen: the shared credit is split between Home and Auto. In Compare, move all of it to Auto and show the simulated next-payment reduction. The credit is one-time, not a recurring premium discount; no real insurer has approved this program. See [the connected walkthrough](../10-ROAD-HELP.md).
