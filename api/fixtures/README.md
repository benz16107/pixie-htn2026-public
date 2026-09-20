# API fixtures

Committed fixtures contain synthetic consumer pricing inputs, example evidence images and selected service responses. They are illustrative data, not live provider responses.

- `api/fixtures/consumer_demo.json` supplies the Auto demonstration's vehicle and rate inputs.
- `api/fixtures/evidence/` supplies labelled illustrations for the incident example.
- `web/src/fixtures/` contains explicit bundled-sample desk and quote views.
- `eval/backtest.json` is a recorded historical comparison.
- `eval/desk_run.json` contains run summaries, model-call counts, costs and elapsed times. Full replay events live in the local commercial SQLite database.

Paths above are relative to the repository root. See [data and replay setup](../../docs/DATA.md) for the snapshot, caches and databases omitted from a fresh clone. The interface distinguishes sample, replay, cache, memory and live responses.
