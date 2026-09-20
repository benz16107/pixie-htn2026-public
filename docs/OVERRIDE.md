# Bounded underwriter adjustment

An underwriter can move a scored interval by up to five points with a written reason. The engine's result remains visible, and the case labels the adjusted result as human judgement.

## API and record

- `POST /cases/{id}/override` accepts `points` and `reason`, records a human `DeskEvent`, and returns the adjusted result.
- `DELETE /cases/{id}/override` removes the override events and restores the view without the human adjustment.
- `POST /demo/reset` clears overrides alongside other commercial rehearsal changes.

The case response retains its original `score` and `decision` and adds an `override` block with the original values, adjusted values, reason, actor and timestamp. The waterfall can display the adjustment separately from the engine steps. Numeric provenance is `human`.

The API rejects an empty reason, zero or non-finite movement, an adjustment beyond ±5, and cases without a scored interval. Adjusted endpoints are rounded and limited to 0–100, then classified using the active guideline thresholds. It does not silently reduce an excessive requested adjustment to the allowed bound.

## Why allow an adjustment?

[Dietvorst, Simmons and Massey](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf) found that allowing limited modifications increased participants' willingness to use imperfect algorithmic forecasts. This motivates the control; it does not validate Pixie's five-point limit or establish an adoption effect for this product.

The what-if control changes a hypothetical input. This adjustment changes the displayed output under the underwriter's name, with the original result beside it. Larger disagreements belong in the review decision and requested evidence.

## Limits

The bound is a product choice in `api/src/atlas_api/override.py`. We have not measured its effect on loss ratio or decision quality. A later engine run reapplies the recorded point adjustment to the new engine interval; it does not ask the human to confirm the adjustment again.

Undo deletes override events in this demo implementation, so the ledger is not an immutable production audit system. A logged score adjustment is also not independent model validation or proof of regulatory compliance. The current feature does not depend on an SMS or iMessage integration.
