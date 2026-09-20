"""Cached hazard layers (lane A3's prefetch) read per location, turned into capped multipliers.

Files live at $ATLAS_LAYERS_DIR/<source>/<location_id>.json (fallback: <repo>/cache/layers). A missing
file is a gap, never a guess. This module is the only place that names the US layer sources, so
engine.py stays region-agnostic (AGENTS.md 5).

ponytail: the multiplier curves below are hand-set step functions; they move into packs/us/pack.yaml
when A3's RegionPack (C3) lands.
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[3]
SOURCES = {
    "fema_flood": "flood",
    "usgs_earthquakes": "earthquake",
    "usfs_wildfire": "wildfire",
    "open_meteo": "wind_and_rain",
    "nominatim": "geocode_check",
}
TOTAL_CAP = (0.85, 1.25)

# Explanations of the step functions implemented in factor(), not vendor-supplied rates.
MULTIPLIER_RULES = {
    "fema_flood": "Unmapped or empty FEMA result: 0.97; mapped outside SFHA: 1.05; SFHA: 1.15; SFHA floodway: 1.20. An unmapped result does not establish zero flood risk.",
    "usgs_earthquakes": "M4+ events within 50 km, 1994–2023: 0 → 1.00; 1–4 → 1.03; 5–9 → 1.06; 10+ → 1.10.",
    "usfs_wildfire": "Wildfire hazard potential: below 100 or no value → 1.00; 100 to below 400 → 1.04; 400+ → 1.08. No value is not proof of no hazard.",
    "open_meteo": "Start at 1.00. Add 0.05 for at least 3 days with gusts over 80 km/h; add 0.02 for at least 15 days with precipitation over 25 mm.",
    "nominatim": "Geocode verification has multiplier 1.00 and no score adjustment, including when it flags a mismatch.",
}


def layers_dir() -> Path:
    return Path(os.environ.get("ATLAS_LAYERS_DIR") or REPO / "cache" / "layers")


def read(source: str, location_id: str) -> dict[str, Any] | None:
    p = layers_dir() / source / f"{location_id}.json"
    return json.loads(p.read_text()) if p.exists() else None


def available(location_id: str) -> dict[str, bool]:
    return {s: (layers_dir() / s / f"{location_id}.json").exists() for s in SOURCES}


@dataclass(frozen=True)
class LayerFactor:
    source: str
    peril: str
    observation: str
    multiplier: float
    url: str


def factor(source: str, rec: dict[str, Any]) -> LayerFactor:
    m, obs = 1.0, ""
    if source == "fema_flood":
        feats = rec.get("features") or []
        if rec.get("status") != "mapped" or not feats:
            m, obs = 0.97, "outside FEMA mapped flood hazard areas"
        else:
            f = feats[0]
            zone, sub = f.get("FLD_ZONE"), f.get("ZONE_SUBTY") or ""
            if f.get("SFHA_TF") == "T":
                m = 1.20 if "Floodway" in sub else 1.15
                obs = f"FEMA zone {zone}{' floodway' if 'Floodway' in sub else ''} (1% annual chance)"
            else:
                m, obs = 1.05, f"FEMA zone {zone} ({sub or 'outside SFHA'})"
    elif source == "usgs_earthquakes":
        n = rec.get("count") or 0
        m = 1.0 if n == 0 else 1.03 if n < 5 else 1.06 if n < 10 else 1.10
        obs = f"{n} M4+ earthquakes within 50 km, 1994-2023"
    elif source == "usfs_wildfire":
        v = rec.get("value")
        m = 1.0 if v is None or v < 100 else 1.04 if v < 400 else 1.08
        obs = "no wildfire hazard value (urban)" if v is None else f"wildfire hazard potential {v}"
    elif source == "open_meteo":
        gust, rain = rec.get("days_wind_gust_over_threshold", 0), rec.get("days_precipitation_over_threshold", 0)
        m = (1.05 if gust >= 3 else 1.0) + (0.02 if rain >= 15 else 0.0)
        obs = f"{gust} days gusts over 80 km/h, {rain} days rain over 25 mm ({rec.get('year')})"
    elif source == "nominatim":
        mism = [k for k in ("state_mismatch", "county_mismatch") if rec.get(k)]
        obs = f"reverse geocode {rec.get('display_name')}" + (f"; {', '.join(mism)}" if mism else "; matches")
    return LayerFactor(source, SOURCES[source], obs, round(m, 3), rec.get("source", ""))


@dataclass(frozen=True)
class Profile:
    total: float


class LayersPack:
    """The engine's `pack` hook: profile() multiplies the multipliers the Hazard agent chose."""

    def __init__(self, multipliers: dict[str, float]) -> None:
        self.multipliers = multipliers

    def profile(self, sites: Any, layers: str | None = None) -> Profile:
        if layers == "data_only" or not self.multipliers:
            return Profile(1.0)
        total = math.prod(self.multipliers.values())
        return Profile(max(TOTAL_CAP[0], min(TOTAL_CAP[1], total)))
