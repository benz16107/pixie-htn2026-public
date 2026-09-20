"""Stateless, coaching-only driving context from coarse route points."""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "driving_context_demo.json"
COACHING_LABEL = (
    "Coaching only. This result is not underwriting, does not change a quote or premium, "
    "and is not shared with an insurer."
)


@lru_cache(maxsize=1)
def _fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text())


def _is_coarse(value: float) -> bool:
    return abs(value - round(value, 3)) < 1e-9


def _zone_for(lat: float, lng: float) -> dict[str, Any] | None:
    for zone in _fixture()["zones"]:
        bounds = zone["bounds"]
        if bounds["south"] <= lat <= bounds["north"] and bounds["west"] <= lng <= bounds["east"]:
            return zone
    return None


def assess_drive_context(
    *,
    points: Iterable[tuple[float, float]],
    distance_km: float,
    speeding_events: int,
    hard_brake_events: int,
) -> dict[str, Any]:
    """Assess aggregate driver events without storing or returning route coordinates."""
    route = [(float(lat), float(lng)) for lat, lng in points]
    if not 2 <= len(route) <= 50:
        raise ValueError("provide between 2 and 50 coarse route points")
    if not 0.5 <= distance_km <= 500:
        raise ValueError("distance_km must be between 0.5 and 500")
    if speeding_events < 0 or hard_brake_events < 0:
        raise ValueError("driver event counts must be zero or greater")
    for lat, lng in route:
        if not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError("route point is outside valid latitude or longitude bounds")
        if not _is_coarse(lat) or not _is_coarse(lng):
            raise ValueError("route points must be rounded to at most 3 decimal places")

    context_counts: dict[str, tuple[dict[str, Any], int]] = {}
    for lat, lng in route:
        zone = _zone_for(lat, lng)
        if zone is None:
            outside_zone = {
                "id": "outside_demo_context",
                "label": "Outside bundled Toronto context examples",
                "contextType": "outside_demo_context",
                "areaLabel": "Unclassified coarse route area",
                "contextScore": _fixture()["scoring"]["outsideDemoContextScore"],
                "source": "No matching bundled synthetic route context",
            }
            current = context_counts.get(outside_zone["id"], (outside_zone, 0))
            context_counts[outside_zone["id"]] = (outside_zone, current[1] + 1)
        else:
            current = context_counts.get(zone["id"], (zone, 0))
            context_counts[zone["id"]] = (zone, current[1] + 1)

    scoring = _fixture()["scoring"]
    speeding_rate = speeding_events / distance_km * 100
    hard_brake_rate = hard_brake_events / distance_km * 100
    speeding_penalty = min(
        int(scoring["speedingPenaltyCap"]),
        round(speeding_rate * float(scoring["speedingPenaltyPerEventPer100Km"])),
    )
    hard_brake_penalty = min(
        int(scoring["hardBrakePenaltyCap"]),
        round(hard_brake_rate * float(scoring["hardBrakePenaltyPerEventPer100Km"])),
    )
    behavior_score = max(0, int(scoring["startingScore"]) - speeding_penalty - hard_brake_penalty)
    behavior_weight = float(scoring["behaviorWeight"])
    route_context_weight = float(scoring["routeContextWeight"])

    route_factors = []
    route_context_score = 0.0
    for zone, count in context_counts.values():
        point_share = count / len(route)
        context_contribution = float(zone["contextScore"]) * point_share
        route_context_score += context_contribution
        route_factors.append(
            {
                "key": zone["id"],
                "label": zone["label"],
                "contextType": zone["contextType"],
                "areaLabel": zone["areaLabel"],
                "coarsePointsMatched": count,
                "pointShare": round(point_share, 4),
                "contextScore": zone["contextScore"],
                "routeContextContribution": round(context_contribution, 2),
                "compositeContribution": round(context_contribution * route_context_weight, 2),
                "source": zone["source"],
                "provenance": "bundled_synthetic_route_context",
                "meaning": (
                    "Estimates route exposure and attention demand only. A lower context score means "
                    "more attention may be useful; it does not judge the driver or affect insurance pricing."
                ),
            }
        )
    route_context_score = round(route_context_score, 2)
    behavior_contribution = behavior_score * behavior_weight
    route_context_contribution = route_context_score * route_context_weight
    composite_score = int(behavior_contribution + route_context_contribution + 0.5)
    band = "steady" if composite_score >= 85 else "watch" if composite_score >= 65 else "focus"

    factors = [
        {
            "key": "speeding",
            "label": "Speeding events",
            "observed": speeding_events,
            "ratePer100Km": round(speeding_rate, 2),
            "effectPoints": -speeding_penalty,
            "source": (
                f"Caller-supplied aggregate count and distance; {scoring['speedingPenaltyPerEventPer100Km']} "
                f"points per event per 100 km, capped at {scoring['speedingPenaltyCap']}"
            ),
            "provenance": "request_aggregate_and_bundled_demo_formula",
        },
        {
            "key": "hard_brake",
            "label": "Hard-brake events",
            "observed": hard_brake_events,
            "ratePer100Km": round(hard_brake_rate, 2),
            "effectPoints": -hard_brake_penalty,
            "source": (
                f"Caller-supplied aggregate count and distance; {scoring['hardBrakePenaltyPerEventPer100Km']} "
                f"points per event per 100 km, capped at {scoring['hardBrakePenaltyCap']}"
            ),
            "provenance": "request_aggregate_and_bundled_demo_formula",
        },
    ]
    tips = []
    if speeding_events:
        tips.append("Leave more time for the trip so posted speed changes do not require catching up.")
    if hard_brake_events:
        tips.append("Increase following distance and scan farther ahead for stops.")
    if not tips:
        tips.append("Keep the same pace and following distance on the next drive.")

    assessment_key = json.dumps(
        {
            "contexts": sorted(
                (factor["contextType"], factor["coarsePointsMatched"])
                for factor in route_factors
            ),
            "distanceKm": round(distance_km, 1),
            "speedingEvents": speeding_events,
            "hardBrakeEvents": hard_brake_events,
        },
        sort_keys=True,
    )
    return {
        "assessmentId": "DRV-" + hashlib.sha256(assessment_key.encode()).hexdigest()[:8],
        "coachingOnly": True,
        "affectsQuote": False,
        "affectsPremium": False,
        "score": composite_score,
        "behaviorScore": behavior_score,
        "routeContextScore": route_context_score,
        "composite": {
            "behaviorWeight": behavior_weight,
            "routeContextWeight": route_context_weight,
            "behaviorContribution": round(behavior_contribution, 2),
            "routeContextContribution": round(route_context_contribution, 2),
            "formula": (
                f"behaviorScore × {behavior_weight:.2f} + "
                f"routeContextScore × {route_context_weight:.2f}"
            ),
        },
        "band": band,
        "factors": factors,
        "routeFactors": route_factors,
        "tips": tips,
        "routeContext": {
            "labels": [factor["label"] for factor in route_factors],
            "types": [factor["contextType"] for factor in route_factors],
            "coarsePointsReceived": len(route),
            "rawCoordinatesReturned": False,
            "meaning": (
                "The route-context score estimates exposure and attention needs. "
                "It does not indicate whether the driver behaved well or poorly."
            ),
        },
        "privacy": {
            "stored": False,
            "identityInputsUsed": False,
            "rawCoordinateRetention": "none",
            "note": "Coordinates are classified during this request and then discarded.",
        },
        "source": _fixture()["label"],
        "label": COACHING_LABEL,
    }
