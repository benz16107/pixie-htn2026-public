# Data, local state and replay

A fresh clone contains code and selected illustrative fixtures. It does not contain the complete running demo's data or history.

## Federato snapshot

The tracked `data/federato` link points to `../../federato/data`. Place an authorised copy of the challenge snapshot in a sibling `federato/data` directory beside this repository, or configure the local link to an existing copy. `docs/federato` similarly points to the supplied documents in `../../federato/docs`.

`World.load()` reads these twelve files at API startup:

```text
Submission.json  Policy.json      Insured.json    Location.json
Building.json    Claim.json       Coverage.json   ExposureUnit.json
Broker.json      Contact.json     Underwriter.json Endorsement.json
```

Each file must retain the API response structure, with records at `output[0].data.results`. A fresh clone with unresolved links cannot start the full API, including its consumer routes, because startup loads the commercial book first.

Federato credentials in the root `.env` allow the client to refresh schema and execute queries. The current repository has no one-command full-snapshot downloader. The `python -m atlas_api.federato ping` command checks authentication and schema access; it does not populate the twelve snapshot files.

After restoring the snapshot, verify it without a provider call:

```bash
(cd api && uv run python -c 'from atlas_api.case import World; w = World.load(); print(len(w.submissions), "commercial submissions loaded")')
```

The recorded challenge dataset contains 158 submissions. Other snapshots may produce different counts and demo results.

## What is committed

| Material | Purpose |
| --- | --- |
| `web/src/fixtures/` | Explicit sample-mode cases, quotes and geographic context |
| `web/public/geography/` | County geometry and its source notes |
| `api/fixtures/` | Synthetic consumer rates, example media and service inputs |
| `packs/toronto/` | Versioned Toronto pricing and prepared geographic data |
| `shared/road-map/` | Cached Toronto map tiles and attribution |
| `eval/backtest.json` | Recorded historical comparison, not an automatic rerun |
| `eval/desk_run.json` | Run summaries, counts and costs; not the complete event database |
| `DEMO/verification/` | Recorded check results, not an executable test suite |

## What stays local

| Path | Contents |
| --- | --- |
| `.env`, `.token` | Credentials and cached authentication |
| `cache/` | Provider responses, schema/query caches and hazard lookups |
| `var/atlas.sqlite` | Commercial case views, events, human actions and recorded agent runs |
| `var/evidence.sqlite` | Incident reports, uploaded file bytes, review notes and history |
| App device storage | Inventory photos, demo identity, witness preferences and credit allocation |

`ATLAS_DB` overrides the commercial database path. `PIXIE_EVIDENCE_DB` overrides incident storage. `ATLAS_LAYERS_DIR` overrides the hazard-cache directory. Use absolute paths for overrides when launching from different working directories. Leave unused overrides unset rather than assigning an empty path.

For a complete offline presentation, transfer a consistent, authorised copy of the snapshot, caches and recorded commercial database. Stop the relevant service or use a SQLite backup rather than copying only the main file while writes are active. Do not include credentials, incident uploads or personal inventory in a public Git commit.

## Replay and live investigation

Replay reads `DeskEvent` rows from the commercial SQLite store. It does not reconstruct a full run from `eval/desk_run.json`. An empty store can hold newly scored cases after startup but has no prior model investigation to replay.

To create new recorded runs, a configured developer can deliberately run:

```bash
(cd api && uv run atlas record --cases 138,126,143)
```

This invokes live models and tools, incurs their normal costs, and writes events to the selected database. It is not part of installation. Inspect the recorded results before using them in a presentation.

The incident service is separate from the commercial store. Its uploads and review actions persist; they are not sent to a real insurer. The commercial demo reset does not clear that database. Device-local inventory is not a cloud backup.
