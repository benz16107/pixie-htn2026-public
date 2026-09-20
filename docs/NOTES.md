# Federato challenge: what the real data looks like (pulled Sat 16:10)

Auth works (client credentials in .env, token cached in .token, both gitignored). Raw pulls in data/*.json, schema in schema.json, docs as text in docs/*.txt.

- 12 resources: Submission, Policy, Insured, Location, Building, Claim, Coverage, ExposureUnit, Broker, Contact, Underwriter, Endorsement.
- 158 submissions across property, health, cgl, auto, cyber, excess, lpl. The appetite guideline covers **property only**.
- 113 policies (76 active) form the existing portfolio for "are we already exposed to this risk?".
- 70 locations, **all US** (CA 19, TX 9, TN 8, FL 7, ...). Every location has latitude/longitude, county, zip, `hazard_tags` (flood 31, wildfire 23, hail 17, tornado 15, earthquake 14, ...) and `protection_class` 1-10.
- 129 buildings with TIV, year_built, construction_type (8 types), sprinklered, roof_year, stories, square footage.
- 179 claims with cause_of_loss, paid/reserve amounts: the five-year loss history for the "loss value under $100K" rule.
- Judging rubric (STUDENT_PROJECT_GUIDELINES): MVP = query, apply appetite, rank, explain. Strong = dynamic queries, detailed explanations, edge cases. Exceptional = traceable agentic reasoning, adapts (deepens analysis on high-value), explains contradictions, actionable UI. Bonus = 1-2 external APIs that visibly change the ranking (they suggest Nominatim, OpenFEMA, Open-Meteo).
- Query gotchas: dot-paths don't traverse arrays (use $elemMatch); references need $expand; `where` runs before expansion and `filter` after.
