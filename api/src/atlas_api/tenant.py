"""Deterministic tenant quote built through the shared appetite engine."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .case import Case, Known, Missing, Site
from .case_store import CaseStore
from .engine import DEFAULT_RULES_DIR, Decided, RulesFile, assess

REPO_ROOT = Path(__file__).resolve().parents[3]
PACK_ROOT = REPO_ROOT / "packs" / "toronto"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from packs.toronto.layers import TorontoPack, TorontoProfile  # noqa: E402

LABEL = "Illustrative. Our documented model, not an Intact price or offer."


@dataclass(frozen=True)
class TenantAnswers:
    contents_value: int
    unit_level: str
    claims_5yr: int
    deductible: int
    liability: int = 1_000_000
    sewer_backup: bool = False
    bundle_auto: bool = False


def _normalise_address(address: str) -> str:
    return " ".join(address.lower().replace(", toronto", "").replace(",", " ").split())


def geocode(address: str | None, lat: float | None, lng: float | None) -> tuple[str, float, float]:
    if lat is not None and lng is not None:
        return address or f"{lat:.5f}, {lng:.5f}", float(lat), float(lng)
    if not address:
        raise ValueError("provide an address or both lat and lng")
    table = json.loads((PACK_ROOT / "addresses.json").read_text())
    place = table.get(_normalise_address(address))
    if place is None:
        raise ValueError("address is not in the offline geocoder; provide lat and lng")
    return place["address"], place["lat"], place["lng"]


def _tenant_case(
    case_id: str, address: str, lat: float, lng: float, answers: TenantAnswers, profile: TorontoProfile
) -> Case:
    water_referral = bool(
        profile.basement_flooding_study_area
        and answers.unit_level == "basement"
        and not answers.sewer_backup
    )
    unavailable = Missing(reason="not used by tenant guideline", resolver="none")
    return Case(
        id=case_id,
        kind="tenant",
        status="referred" if water_referral or answers.claims_5yr >= 2 else "quoted",
        as_of="2026-09-19",
        line=Known("tenant", source="applicant selection"),
        business_type=Known("new", source="quote flow"),
        primary_admin=Known("Toronto", source="region pack"),
        tiv=Known(float(answers.contents_value), source="applicant answer"),
        premium=unavailable,
        year_built=unavailable,
        construction_share=unavailable,
        loss_5yr=Known(float(answers.claims_5yr), source="applicant answer"),
        sites=(Site(id=profile.cell, lat=lat, lng=lng, region="toronto", admin="Toronto", tags=(), protection_class=None),),
        broker=unavailable,
        contact=unavailable,
        extra={
            "address": Known(address, source="offline geocoder or supplied coordinates"),
            "unit_level": Known(answers.unit_level, source="applicant answer"),
            "contents": Known(answers.contents_value, source="applicant answer"),
            "claims_5yr": Known(answers.claims_5yr, source="applicant answer"),
            "deductible": Known(answers.deductible, source="applicant choice"),
            "liability": Known(answers.liability, source="applicant choice"),
            "water_referral": Known(water_referral, source="unit answer and region-pack study-area lookup"),
            "hex": Known(profile.cell, source="resolution-9 cell of supplied point"),
        },
    )


def _money(cents: int) -> float:
    return round(cents / 100, 2)


def _receipt(profile: TorontoProfile, answers: TenantAnswers, rules: RulesFile) -> tuple[dict[str, Any], int]:
    pricing = rules.pricing or {}
    base = int(pricing["base_annual_cents"])
    running = base
    lines: list[dict[str, Any]] = []

    def flat(label: str, cents: int, source: str) -> None:
        nonlocal running
        before = running
        running += cents
        multiplier = running / before if before else 1.0
        lines.append({"label": label, "multiplier": round(multiplier, 3), "dollars": _money(cents),
                      "capped": False, "source": source})

    def multiply(label: str, multiplier: float, source: str, capped: bool = False) -> None:
        nonlocal running
        before = running
        running = round(before * multiplier)
        lines.append({"label": label, "multiplier": round(multiplier, 4),
                      "dollars": _money(running - before), "capped": capped, "source": source})

    contents_delta = (answers.contents_value - int(pricing["base_contents"])) // 1000
    if contents_delta:
        flat(
            f"Contents ${answers.contents_value:,}",
            contents_delta * int(pricing["contents_per_1000_cents"]),
            "your answer; $4 per $1,000 from the invented pricing table",
        )
    if answers.liability == 2_000_000:
        flat("$2M liability", int(pricing["liability_2m_cents"]), "your answer; invented constant")
    deductible_multiplier = float(pricing["deductible_multipliers"][answers.deductible])
    if deductible_multiplier != 1.0:
        multiply(f"${answers.deductible:,} deductible", deductible_multiplier, "your answer; invented constant")

    location_start = running
    break_source = (
        f"TPS Break and Enter 2023-2026: {profile.ring_count} within one cell ring of {profile.cell}"
    )
    multiply("Break-ins near you", profile.break_ins_multiplier, break_source,
             profile.break_ins_multiplier in {0.92, 1.10})
    multiply("Fire protection", profile.fire_multiplier,
             f"[{profile.backend}] Toronto Fire Stations: nearest {profile.fire_station_km:.1f} km")
    water_source = f"[{profile.backend}] Toronto basement flooding study areas"
    if profile.basement_flooding_study_area:
        water_source += f" {profile.basement_flooding_study_area}"
    if answers.unit_level == "upper":
        water_source += "; upper unit, not applied"
    multiply("Basement flooding", profile.water_multiplier, water_source)

    raw_location = profile.break_ins_multiplier * profile.fire_multiplier * profile.water_multiplier
    capped_location = max(0.85, min(1.25, raw_location))
    target = round(location_start * capped_location)
    if target != running:
        before = running
        running = target
        lines.append({"label": "Location total cap", "multiplier": round(capped_location / raw_location, 4),
                      "dollars": _money(running - before), "capped": True,
                      "source": "pack.yaml total location clamp 0.85 through 1.25"})

    if answers.sewer_backup:
        flat("Sewer backup add-on", int(pricing["sewer_backup_cents"]), "your answer; invented constant")
    if answers.claims_5yr == 1:
        multiply("One claim in 5 years", float(pricing["one_claim_multiplier"]),
                 "your answer; invented constant")
    if answers.bundle_auto:
        multiply("Auto bundle", float(pricing["bundle_multiplier"]), "your answer; invented constant")
    return {"base": _money(base), "lines": lines}, running


def _case_view(
    case: Case, address: str, assessment: Any, quote: dict[str, Any], profile: TorontoProfile,
    answers: TenantAnswers,
) -> dict[str, Any]:
    facts = []
    for fact_id, label in (
        ("address", "Address"), ("unit_level", "Unit level"), ("contents", "Contents value"),
        ("claims_5yr", "Claims, 5 yr"), ("deductible", "Deductible"), ("hex", "H3 cell"),
    ):
        value = case.fact(fact_id)
        display = value.v
        if fact_id in {"contents", "deductible"}:
            display = f"${display:,}"
        facts.append({"id": fact_id, "label": label, "display": str(display), "provenance": "known", "source": value.source})
    factors = [
        {"fact": factor.fact, "possible": sorted(factor.possible), "valueText": factor.value_text,
         "provenance": factor.provenance}
        for factor in assessment.factors
    ]
    reasons = quote["decision"]["reasons"]
    return {
        "caseId": case.id, "kind": "tenant", "title": address, "region": "toronto",
        "facts": facts, "factors": factors,
        # No interval: the tenant rules score on their own scale, and the receipt is what the reader checks.
        "score": None, "scoreWithoutEnrichment": None,
        "decision": {"kind": assessment.decision.kind, "because": reasons, "by": "desk"},
        "risk": {
            "factors": [
                {"peril": "break_ins", "line": f"Break-ins within one cell ring: {profile.ring_count}",
                 "applied": profile.break_ins_multiplier, "capped": profile.break_ins_multiplier in {0.92, 1.10},
                 "source": "TPS Break and Enter 2023-2026", "citation": "https://data.torontopolice.on.ca/"},
                {"peril": "fire", "line": f"[{profile.backend}] Fire station {profile.fire_station_km:.1f} km away",
                 "applied": profile.fire_multiplier, "capped": False, "source": "Toronto Fire Stations",
                 "citation": "https://open.toronto.ca/dataset/fire-station-locations/"},
                {"peril": "water", "line": f"[{profile.backend}] Basement flooding study-area lookup",
                 "applied": profile.water_multiplier, "capped": False,
                 "source": "Toronto Basement Flooding Study Areas",
                 "citation": "https://open.toronto.ca/dataset/basement-flooding-study-areas/"},
            ],
            "total": profile.total, "totalCapped": profile.total in {0.85, 1.25}, "skipped": [],
        },
        "portfolio": None, "contradictions": [],
        "explanation": f"{assessment.decision.kind.capitalize()} for {address}. The computed annual estimate is ${quote['annual']:.2f}.",
        "explanationVerified": True, "issues": [], "actions": [],
        "site": {"lat": case.sites[0].lat, "lng": case.sites[0].lng},
        "receipt": {**quote["receipt"], "annual": quote["annual"], "label": LABEL},
    }


def quote_tenant(
    *, address: str | None, lat: float | None, lng: float | None, answers: TenantAnswers,
    store: CaseStore | None = None, pack: TorontoPack | None = None,
) -> dict[str, Any]:
    resolved_address, lat, lng = geocode(address, lat, lng)
    pack = pack or TorontoPack()
    profile = pack.profile_point(lat, lng, unit_level=answers.unit_level)
    canonical = json.dumps({"address": resolved_address, "lat": lat, "lng": lng, "answers": answers.__dict__}, sort_keys=True)
    case_id = "TQ-" + hashlib.sha256(canonical.encode()).hexdigest()[:8]
    case = _tenant_case(case_id, resolved_address, lat, lng, answers, profile)
    rules = RulesFile.load(DEFAULT_RULES_DIR / "tenant.yaml")
    assessment = assess(case, rules)
    if not isinstance(assessment.decision, Decided):
        raise ValueError("tenant quote inputs must resolve every appetite factor")
    receipt, annual_cents = _receipt(profile, answers, rules)

    reasons = []
    if profile.basement_flooding_study_area and answers.unit_level == "basement" and not answers.sewer_backup:
        reasons.append(f"Basement unit inside flooding study area {profile.basement_flooding_study_area} without sewer backup")
    if answers.claims_5yr >= 2:
        reasons.append("Two or more claims in the last 5 years")
    if not reasons:
        reasons.append("The supplied answers meet the tenant appetite rules")
    next_step = (
        "A licensed advisor must review this referral."
        if assessment.decision.kind == "refer"
        else "Send this summary to a licensed advisor to turn it into a real quote."
    )
    quote = {
        "caseId": case_id, "address": resolved_address,
        "decision": {"kind": assessment.decision.kind, "reasons": reasons, "nextStep": next_step},
        "annual": _money(annual_cents), "monthly": _money(round(annual_cents / 12)), "label": LABEL,
        "receipt": receipt,
        "recommendations": ([{"addOn": "Sewer backup", "why": reasons[0]}]
                            if profile.basement_flooding_study_area and answers.unit_level == "basement" else []),
        "hexes": pack.map_hexes(lat, lng, 4), "center": [lat, lng],
        "listSummary": f"{resolved_address}, {answers.unit_level} unit. Estimate ${_money(annual_cents):.2f} a year. {assessment.decision.kind.capitalize()}.",
        "underwriterUrl": f"/cases/{case_id}",
        "answers": {"unitLevel": answers.unit_level, "contentsValue": answers.contents_value,
                    "deductible": answers.deductible, "liability": answers.liability,
                    "claims3yr": answers.claims_5yr},
    }
    if store is not None:
        queue = {
            "caseId": case_id, "insured": resolved_address, "line": "tenant", "state": "Toronto",
            "status": case.status, "valueAtStake": answers.contents_value,
            "score": None, "region": "toronto", "label": "Consumer referral",
            "decision": {"kind": assessment.decision.kind, "because": reasons, "by": "desk"},
            "issues": [], "deepDived": False, "enrichmentDelta": 0,
        }
        store.put_case(case_id, {"queue": queue, "case": _case_view(case, resolved_address, assessment, quote, profile, answers)})
    return quote
