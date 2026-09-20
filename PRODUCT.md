# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Pixie has two connected products. Commercial underwriters use the Federato desk to triage property submissions, inspect evidence, test guideline changes, and record a decision. Consumers use the Intact experience to quote, compare, protect, and recover across Auto and Home. Home pricing currently supports tenant insurance. An advisor receives cases that the rules should not auto-price.

## Product Purpose

Pixie keeps insurance useful through four stages: Quote, Decide, Protect, and Recover. It shows which facts are known, estimated, or missing; computes scores and prices in code; and keeps the source of every value visible. An asynchronous judge should understand the consumer lifecycle from the first diagram, then verify each stage through the linked working proof.

## Positioning

The commercial desk and consumer app call the same region-agnostic assessment engine with separate rules and data packs. Models investigate and explain. Deterministic code computes scores, premiums, comparisons, estimates, and totals.

## Operating Context

The Federato experience is a desktop workspace for commercial underwriting. The Intact experience has a lifecycle presentation on the web and a native Expo consumer app. The app supports a working Toronto tenant estimate, deterministic synthetic Auto comparisons, what-if choices, prevention records, driving-context coaching, and a locally exportable recovery plan. External enrichment has cached or bundled fallbacks for unreliable hackathon Wi-Fi.

## Capabilities and Constraints

- The Federato web product contains queue, case, guideline, portfolio, Ask, backtest, and recorded demo views.
- The Intact web product presents Quote, Decide, Protect, and Recover as a focused Home or Auto story.
- The Expo app uses the same four stages and lets the customer switch between Home and Auto.
- Home pricing supports renter or tenant insurance. It does not implement a homeowner tariff.
- Auto pricing compares three bundled synthetic vehicles through a deterministic, itemized demo model.
- The driving-context prototype combines behavior with synthetic route context for coaching. It does not change a quote or premium.
- Pixie Recover is a first-party safety, incident-record, and local plan flow. It uploads and submits nothing automatically.
- The MCP server exposes narrow estimate, comparison, application-draft, policy-summary, driving-context, and recovery tools. It does not expose a full customer profile.
- Missing data never counts as a pass. Every value keeps its provenance.
- All consumer prices remain labelled as Pixie's illustrative model, not an Intact price or offer.

## Brand Commitments

The user-facing product name is Pixie. Federato and Intact are distinct product modes. Federato reads as an underwriting workspace. Intact reads as a consumer insurance service. Recovery remains inside Pixie so the customer can review the record before saving or sharing a local plan.

## Evidence on Hand

The repository contains recorded commercial runs, bundled cases, Toronto risk data, itemized tenant receipts, synthetic Auto listings, driving-context fixtures, a pre-registered backtest, API and MCP tests, web captures, Expo screens, and per-track demo scripts. The sample book, consumer pricing constants, and route zones are synthetic or illustrative.

## Product Principles

1. Show the source beside the number.
2. Separate consumer clarity from underwriter density.
3. Let the customer test a choice without overwriting a confirmed fact.
4. Ask for consent before preparing an application, exporting a recovery plan, or sharing it.
5. Keep raw route coordinates out of stored demo records.
6. Keep every pitch claim tied to working code or visible evidence.

## Accessibility & Inclusion

Controls require visible focus or pressed states, readable contrast, screen-reader labels, safe-area handling, and reduced-motion support. The consumer quote does not use age, sex, income, ethnicity, or credit. Route context estimates the attention a route may require and does not judge a neighbourhood, identity, or home address.
