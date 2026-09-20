"""telemetry.py is a thin Sentry wrapper: every call must not raise whether or not Sentry has been
initialised (a no-op queue with no client when it hasn't; a real event when app.py's _init_sentry
already ran in this test session because .env sets a real SENTRY_DSN_API)."""

from atlas_api.telemetry import log, verify_numbers_alert


def test_log_does_not_raise_without_a_configured_dsn():
    log("ingest.query", case_id="138", resource="Submission")
    log("verify_numbers.rejected", level="error", case_id="138", agent="lead")


def test_verify_numbers_alert_does_not_raise_without_a_configured_dsn():
    verify_numbers_alert("138", "lead", "TIV is $9,999,999", ["9999999"], ["TIV $5,200,000 via hq"])
