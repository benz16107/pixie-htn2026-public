"""Deterministic, privacy-limited consumer insurance services.

Tenant estimates delegate to :mod:`atlas_api.tenant`. Auto estimates use only the
bundled illustrative table in ``api/fixtures/consumer_demo.json``. This module is
the shared implementation for HTTP and MCP adapters.
"""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Any, Iterable

from .tenant import TenantAnswers, quote_tenant

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "consumer_demo.json"
AUTO_LABEL = "Illustrative Pixie estimate from bundled demo tables. Not an insurer quote or offer."
TENANT_SCOPE = "Home currently supports renter or tenant insurance only. No homeowner tariff is implemented."


@lru_cache(maxsize=1)
def _fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text())


def consumer_capabilities() -> dict[str, Any]:
    """Return the honest product and data boundary exposed by every adapter."""
    return {
        "demoOnly": True,
        "products": {
            "home": {"available": ["tenant"], "homeownerAvailable": False, "note": TENANT_SCOPE},
            "auto": {"available": ["illustrative_estimate"], "liveCarrierRates": False},
        },
        "privacy": {
            "fullProfileTool": False,
            "policySummariesOmit": ["name", "address", "email", "phone", "driverLicence", "VIN"],
            "applicationSubmission": False,
        },
        "source": _fixture()["label"],
    }


def vehicle_listings() -> list[dict[str, Any]]:
    """Return public demo listing fields without a customer profile or VIN."""
    return [
        {
            "id": vehicle["id"],
            "year": vehicle["year"],
            "make": vehicle["make"],
            "model": vehicle["model"],
            "listingPrice": vehicle["listingPrice"],
            "provenance": vehicle["source"],
            "demoOnly": True,
        }
        for vehicle in _fixture()["vehicles"]
    ]


def _vehicle(vehicle_id: str) -> dict[str, Any]:
    vehicle = next((item for item in _fixture()["vehicles"] if item["id"] == vehicle_id), None)
    if vehicle is None:
        choices = ", ".join(item["id"] for item in _fixture()["vehicles"])
        raise ValueError(f"unknown demo vehicle {vehicle_id!r}; choose one of: {choices}")
    return vehicle


def _choice(table: str, value: str | int) -> float:
    choices = _fixture()["autoPricing"][table]
    key = str(value)
    if key not in choices:
        raise ValueError(f"unsupported {table} value {value!r}; choose one of: {', '.join(choices)}")
    return float(choices[key])


def _money(cents: int) -> float:
    return round(cents / 100, 2)


def estimate_auto_quote(
    *,
    vehicle_id: str,
    annual_km_band: str = "10000_20000",
    parking: str = "driveway",
    deductible: int = 1000,
    claims_5yr: int = 0,
) -> dict[str, Any]:
    """Compute an illustrative Auto estimate with an auditable cent receipt."""
    if claims_5yr < 0:
        raise ValueError("claims_5yr must be zero or greater")
    vehicle = _vehicle(vehicle_id)
    pricing = _fixture()["autoPricing"]
    base = int(pricing["baseAnnualCents"])
    running = base
    lines: list[dict[str, Any]] = []

    def multiply(label: str, multiplier: float, source: str) -> None:
        nonlocal running
        before = running
        running = round(before * multiplier)
        lines.append(
            {
                "label": label,
                "multiplier": round(multiplier, 4),
                "dollars": _money(running - before),
                "source": source,
                "provenance": "bundled_demo_table",
            }
        )

    multiply(
        f"{vehicle['year']} {vehicle['make']} {vehicle['model']}",
        float(vehicle["vehicleFactor"]),
        vehicle["source"],
    )
    multiply(
        "Annual distance",
        _choice("annualKmMultipliers", annual_km_band),
        f"Customer selection {annual_km_band}; illustrative annual-distance table",
    )
    multiply(
        "Overnight parking",
        _choice("parkingMultipliers", parking),
        f"Customer selection {parking}; illustrative parking table",
    )
    multiply(
        f"${deductible:,} deductible",
        _choice("deductibleMultipliers", deductible),
        f"Customer selection ${deductible:,}; illustrative deductible table",
    )
    claim_key = "2_plus" if claims_5yr >= 2 else str(claims_5yr)
    multiply(
        "Claims in 5 years",
        _choice("claimMultipliers", claim_key),
        f"Customer answer {claims_5yr}; illustrative claims table",
    )

    canonical = json.dumps(
        {
            "vehicle": vehicle_id,
            "annualKmBand": annual_km_band,
            "parking": parking,
            "deductible": deductible,
            "claims5yr": claims_5yr,
        },
        sort_keys=True,
    )
    quote_id = "AQ-" + hashlib.sha256(canonical.encode()).hexdigest()[:8]
    review = claims_5yr >= 2
    return {
        "quoteId": quote_id,
        "product": "auto",
        "demoOnly": True,
        "vehicle": {
            "id": vehicle["id"],
            "year": vehicle["year"],
            "make": vehicle["make"],
            "model": vehicle["model"],
            "listingPrice": vehicle["listingPrice"],
            "provenance": vehicle["source"],
        },
        "inputs": {
            "annualKmBand": annual_km_band,
            "parking": parking,
            "deductible": deductible,
            "claims5yr": claims_5yr,
        },
        "decision": {
            "kind": "advisor_review" if review else "estimate_ready",
            "reasons": ["Two or more claims need an advisor to review the estimate"] if review else ["The supplied demo inputs can be estimated"],
            "nextStep": "Ask a licensed advisor for a real quote. No application has been submitted.",
        },
        "annual": _money(running),
        "monthly": _money(round(running / 12)),
        "receipt": {"base": _money(base), "baseSource": pricing["baseSource"], "lines": lines},
        "label": AUTO_LABEL,
    }


def compare_vehicles(
    *,
    vehicle_ids: Iterable[str] | None = None,
    annual_km_band: str = "10000_20000",
    parking: str = "driveway",
    deductible: int = 1000,
    claims_5yr: int = 0,
) -> dict[str, Any]:
    """Compare listing price and the same deterministic insurance scenario."""
    ids = list(vehicle_ids) if vehicle_ids is not None else [item["id"] for item in _fixture()["vehicles"]]
    if not ids:
        raise ValueError("provide at least one vehicle_id")
    if len(ids) > 6:
        raise ValueError("compare at most 6 vehicles")
    rows = []
    for vehicle_id in ids:
        quote = estimate_auto_quote(
            vehicle_id=vehicle_id,
            annual_km_band=annual_km_band,
            parking=parking,
            deductible=deductible,
            claims_5yr=claims_5yr,
        )
        rows.append(
            {
                "vehicle": quote["vehicle"],
                "quoteId": quote["quoteId"],
                "illustrativeAnnual": quote["annual"],
                "illustrativeMonthly": quote["monthly"],
                "decision": quote["decision"],
            }
        )
    rows.sort(key=lambda row: (row["illustrativeAnnual"], row["vehicle"]["listingPrice"]))
    return {"comparison": rows, "sameScenario": {"annualKmBand": annual_km_band, "parking": parking, "deductible": deductible, "claims5yr": claims_5yr}, "label": AUTO_LABEL}


def estimate_home_quote(
    *,
    home_product: str,
    address: str | None,
    lat: float | None,
    lng: float | None,
    contents_value: int,
    unit_level: str,
    claims_5yr: int,
    deductible: int,
    liability: int = 1_000_000,
    sewer_backup: bool = False,
    bundle_auto: bool = False,
) -> dict[str, Any]:
    """Estimate renter or tenant insurance through the existing tenant engine."""
    if home_product != "tenant":
        raise ValueError(TENANT_SCOPE)
    if (lat is None) != (lng is None):
        raise ValueError("lat and lng must be supplied together")
    quote = quote_tenant(
        address=address,
        lat=lat,
        lng=lng,
        answers=TenantAnswers(
            contents_value=contents_value,
            unit_level=unit_level,
            claims_5yr=claims_5yr,
            deductible=deductible,
            liability=liability,
            sewer_backup=sewer_backup,
            bundle_auto=bundle_auto,
        ),
    )
    return {**quote, "productCategory": "home", "supportedProduct": "tenant", "scopeNote": TENANT_SCOPE, "demoOnly": True}


def run_quote_scenario(*, tenant: dict[str, Any] | None, auto: dict[str, Any] | None) -> dict[str, Any]:
    """Combine already-computed tenant and Auto estimates without changing either model."""
    if tenant is None and auto is None:
        raise ValueError("provide tenant, auto, or both scenarios")
    tenant_quote = estimate_home_quote(home_product="tenant", **tenant) if tenant is not None else None
    auto_quote = estimate_auto_quote(**auto) if auto is not None else None
    quotes = [quote for quote in (tenant_quote, auto_quote) if quote is not None]
    annual_cents = sum(round(float(quote["annual"]) * 100) for quote in quotes)
    return {
        "scenarioId": "QS-" + hashlib.sha256(json.dumps({"tenant": tenant, "auto": auto}, sort_keys=True).encode()).hexdigest()[:8],
        "demoOnly": True,
        "quotes": quotes,
        "combinedAnnual": _money(annual_cents),
        "combinedMonthly": _money(round(annual_cents / 12)),
        "labels": [quote["label"] for quote in quotes],
        "note": "The combined total adds independent illustrative estimates. It is not a multi-policy carrier quote.",
    }


def get_policy_summary(policy_id: str) -> dict[str, Any]:
    """Return a deliberately limited demo summary, never a customer profile."""
    policy = next((item for item in _fixture()["policySummaries"] if item["id"] == policy_id), None)
    if policy is None:
        raise ValueError("unknown demo policy; choose tenant-demo or auto-demo")
    return {
        **policy,
        "demoOnly": True,
        "privacy": {
            "omitted": ["name", "address", "email", "phone", "driverLicence", "VIN"],
            "fullProfileAvailable": False,
        },
    }


def prepare_application(
    *, quote_ids: Iterable[str], contact_preference: str, consent_to_prepare: bool, confirm_demo_only: bool
) -> dict[str, Any]:
    """Prepare an advisor-ready draft. This never submits to an insurer."""
    ids = sorted(set(quote_ids))
    if not ids or any(not quote_id.startswith(("TQ-", "AQ-")) for quote_id in ids):
        raise ValueError("quote_ids must contain at least one Pixie TQ- or AQ- quote id")
    if contact_preference not in {"email_on_file", "phone_on_file", "in_app"}:
        raise ValueError("contact_preference must be email_on_file, phone_on_file, or in_app")
    if not consent_to_prepare:
        raise ValueError("consent_to_prepare must be true before creating a draft")
    if not confirm_demo_only:
        raise ValueError("confirm_demo_only must be true; this service creates demo drafts only")
    canonical = json.dumps({"quoteIds": ids, "contactPreference": contact_preference}, sort_keys=True)
    return {
        "applicationId": "APP-DEMO-" + hashlib.sha256(canonical.encode()).hexdigest()[:8],
        "status": "draft_prepared",
        "quoteIds": ids,
        "contactPreference": contact_preference,
        "demoOnly": True,
        "submitted": False,
        "nextStep": "Review the draft with a licensed advisor. A separate explicit carrier submission would be required.",
        "privacy": {"contactValueIncluded": False, "fullProfileIncluded": False},
    }


_RECOVERY: dict[str, dict[str, Any]] = {}
_RECOVERY_LOCK = Lock()


def request_recovery_handoff(
    *, policy_id: str, incident_type: str, contact_preference: str, consent_to_contact: bool, confirm_demo_only: bool
) -> dict[str, Any]:
    """Create an in-memory demo recovery handoff with no contact value or incident narrative."""
    get_policy_summary(policy_id)
    if incident_type not in {"collision", "water", "theft", "other"}:
        raise ValueError("incident_type must be collision, water, theft, or other")
    if contact_preference not in {"email_on_file", "phone_on_file", "in_app"}:
        raise ValueError("contact_preference must be email_on_file, phone_on_file, or in_app")
    if not consent_to_contact:
        raise ValueError("consent_to_contact must be true before preparing a handoff")
    if not confirm_demo_only:
        raise ValueError("confirm_demo_only must be true; no real recovery request will be sent")
    canonical = json.dumps({"policyId": policy_id, "incidentType": incident_type, "contactPreference": contact_preference}, sort_keys=True)
    recovery_id = "REC-DEMO-" + hashlib.sha256(canonical.encode()).hexdigest()[:8]
    record = {
        "recoveryId": recovery_id,
        "status": "demo_handoff_ready",
        "policyId": policy_id,
        "incidentType": incident_type,
        "contactPreference": contact_preference,
        "demoOnly": True,
        "sent": False,
        "privacy": {"contactValueIncluded": False, "incidentNarrativeIncluded": False},
        "nextStep": "Contact emergency services when needed, then contact the insurer or licensed advisor directly.",
    }
    with _RECOVERY_LOCK:
        _RECOVERY[recovery_id] = record
    return record


def get_recovery_status(recovery_id: str) -> dict[str, Any]:
    """Read an in-memory demo handoff status by opaque id."""
    with _RECOVERY_LOCK:
        record = _RECOVERY.get(recovery_id)
    if record is None:
        raise ValueError("unknown demo recovery handoff")
    return dict(record)
