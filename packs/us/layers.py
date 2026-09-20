"""Offline public-hazard profile over the C2 location caches."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent
CACHE = ROOT.parents[1] / "cache" / "layers"


@dataclass(frozen=True)
class RiskFactor:
    peril: str
    applied: float
    observation: str
    source: str


@dataclass(frozen=True)
class RiskProfile:
    factors: tuple[RiskFactor, ...]
    total: float
    total_capped: bool


def _load(source: str, location_id: str) -> dict[str, Any]:
    return json.loads((CACHE / source / f"{location_id}.json").read_text())


def _flood(data: dict[str, Any]) -> tuple[float, str]:
    if data["status"] != "mapped":
        return 1.0, "outside mapped flood hazard area"
    sfha = any(str(feature.get("SFHA_TF", "")).upper() in {"T", "TRUE", "Y", "YES"}
               for feature in data.get("features", []))
    return (1.10, "special flood hazard area") if sfha else (1.03, "mapped flood zone")


def _earthquake(data: dict[str, Any]) -> tuple[float, str]:
    count = int(data["count"])
    return (1.06 if count >= 5 else 1.02 if count >= 1 else 1.0, f"{count} earthquakes")


def _wildfire(data: dict[str, Any]) -> tuple[float, str]:
    value = data.get("value")
    if value is None:
        return 1.0, "no mapped wildfire value"
    number = float(value)
    return (1.10 if number >= 300 else 1.05 if number >= 100 else 1.0, f"hazard value {number:g}")


def _weather(data: dict[str, Any]) -> tuple[float, str]:
    wind = int(data["days_wind_gust_over_threshold"])
    rain = int(data["days_precipitation_over_threshold"])
    total = wind + rain
    return (1.06 if total >= 15 else 1.03 if total >= 5 else 1.0, f"{total} threshold days")


class USPack:
    def __init__(self) -> None:
        self.config = yaml.safe_load((ROOT / "pack.yaml").read_text())

    def profile(self, sites: tuple[Any, ...], layers: str | None = None) -> RiskProfile:
        if layers == "data_only" or not sites:
            return RiskProfile((), 1.0, False)
        calculators = {
            "flood": ("fema_flood", _flood, "FEMA"),
            "earthquake": ("usgs_earthquakes", _earthquake, "USGS"),
            "wildfire": ("usfs_wildfire", _wildfire, "USFS"),
            "severe_weather": ("open_meteo", _weather, "Open-Meteo"),
        }
        factors = []
        for peril, (directory, calculator, source) in calculators.items():
            observations = [calculator(_load(directory, site.id)) for site in sites]
            applied, observation = max(observations, key=lambda item: item[0])
            factors.append(RiskFactor(peril, applied, observation, source))
        raw_total = math.prod(factor.applied for factor in factors)
        total = max(float(self.config["total"]["floor"]), min(float(self.config["total"]["cap"]), raw_total))
        return RiskProfile(tuple(factors), round(total, 4), total != raw_total)
