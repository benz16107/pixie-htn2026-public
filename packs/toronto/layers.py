#!/usr/bin/env python3
"""Build and read the deterministic Toronto H3 risk pack.

All source names, thresholds, and geographic rules live in this directory.  The shared
underwriting engine only consumes the resulting ``profile`` method and never names a region.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import h3
import yaml

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
SCORES_PATH = ROOT / "hex_scores.json"
PACK_PATH = ROOT / "pack.yaml"

# ---- Elastic: live ES|QL geo lookups, exact-point instead of the H3-cell-center-baked local scores.
# A standalone helper (not importing atlas_api) so packs/ stays a region pack the api reaches into,
# never the other way. TorontoPack falls back to the local flood-polygon/haversine math below whenever
# Elastic is unreachable or unset, same "prefer Elastic, fall back silently" shape as
# atlas_api.portfolio.ExposureIndex (AGENTS.md invariant 4: the demo never blanks out).
FLOOD_INDEX = "toronto-flood-zones"
FIRE_INDEX = "toronto-fire-stations"


def _elastic_client() -> Any | None:
    url = os.environ.get("ELASTIC_URL")
    user, pw = os.environ.get("ELASTIC_USERNAME"), os.environ.get("ELASTIC_PASSWORD")
    if not (url and user and pw):
        return None
    try:
        from elasticsearch import Elasticsearch
        client = Elasticsearch(url, basic_auth=(user, pw), request_timeout=3)
        if not client.ping():
            return None
        return client
    except Exception:
        return None


def _esql_rows(client: Any, query: str) -> list | None:
    """None = Elastic didn't answer (caller falls back to local); [] is a real empty result."""
    try:
        return client.esql.query(query=query).body["values"]
    except Exception:
        return None


def _elastic_lookup(client: Any, lat: float, lng: float) -> tuple[str | None, float | None] | None:
    """(basement flood study-area asset id or None, nearest fire station km) from live ES|QL against
    the exact point, or None entirely if Elastic didn't answer either query."""
    point = f'TO_GEOPOINT("POINT({lng} {lat})")'
    flood_rows = _esql_rows(client, f"FROM {FLOOD_INDEX} | WHERE ST_INTERSECTS({point}, shape) "
                                     f"| KEEP asset_id | LIMIT 1")
    fire_rows = _esql_rows(client, f"FROM {FIRE_INDEX} | EVAL d = ST_DISTANCE(location, {point}) "
                                    f"| SORT d ASC | LIMIT 1 | KEEP d")
    if flood_rows is None or fire_rows is None:
        return None
    study_area = flood_rows[0][0] if flood_rows else None
    fire_km = fire_rows[0][0] / 1000.0 if fire_rows else None
    return study_area, fire_km


def _load(name: str) -> dict[str, Any]:
    return json.loads((RAW / name).read_text())


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dlat, dlng = lat2 - lat1, lng2 - lng1
    root = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(root))


def _rings(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        yield from coordinates
    elif geometry["type"] == "MultiPolygon":
        for polygon in coordinates:
            yield from polygon


def _point_in_ring(lng: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > lat) != (y2 > lat):
            crossing = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lng < crossing:
                inside = not inside
        previous = current
    return inside


def _contains(geometry: dict[str, Any], lat: float, lng: float) -> bool:
    coordinates = geometry["coordinates"]
    polygons = [coordinates] if geometry["type"] == "Polygon" else coordinates
    for polygon in polygons:
        if polygon and _point_in_ring(lng, lat, polygon[0]):
            if not any(_point_in_ring(lng, lat, hole) for hole in polygon[1:]):
                return True
    return False


def _point(geometry: dict[str, Any]) -> tuple[float, float]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Point":
        lng, lat = coordinates
    elif geometry["type"] == "MultiPoint":
        lng, lat = coordinates[0]
    else:
        raise ValueError(f"expected point geometry, got {geometry['type']}")
    return float(lat), float(lng)


def _percentile(sorted_values: list[float], value: float) -> float:
    if len(sorted_values) <= 1:
        return 0.5
    return (bisect.bisect_right(sorted_values, value) - 1) / (len(sorted_values) - 1)


def _level(percentile: float) -> int:
    return min(4, int(percentile * 5))


def _percentile_multiplier(percentile: float) -> float:
    anchors = ((0.0, 0.92), (0.10, 0.95), (0.50, 1.0), (0.90, 1.08), (0.97, 1.10), (1.0, 1.10))
    for (p1, m1), (p2, m2) in zip(anchors, anchors[1:]):
        if percentile <= p2:
            share = (percentile - p1) / (p2 - p1)
            return _clamp(m1 + share * (m2 - m1), 0.92, 1.10)
    return 1.10


def build() -> dict[str, Any]:
    config = yaml.safe_load(PACK_PATH.read_text())
    resolution = int(config["h3_resolution"])
    credibility = float(config["shrinkage"]["prior_weight"])
    per_cell: Counter[str] = Counter()
    neighbourhood_cells: dict[str, Counter[str]] = defaultdict(Counter)

    events = _load("break_and_enter_2023_onward.geojson")["features"]
    for feature in events:
        lat, lng = _point(feature["geometry"])
        cell = h3.latlng_to_cell(lat, lng, resolution)
        neighbourhood = str(feature["properties"].get("HOOD_158") or "unknown")
        per_cell[cell] += 1
        neighbourhood_cells[cell][neighbourhood] += 1

    cells: set[str] = set()
    for cell in per_cell:
        cells.update(h3.grid_disk(cell, 1))
    ring_counts = {cell: sum(per_cell[near] for near in h3.grid_disk(cell, 1)) for cell in cells}

    neighbourhood_values: dict[str, list[int]] = defaultdict(list)
    cell_neighbourhood: dict[str, str] = {}
    for cell in cells:
        votes: Counter[str] = Counter()
        for near in h3.grid_disk(cell, 1):
            votes.update(neighbourhood_cells.get(near, {}))
        hood = votes.most_common(1)[0][0] if votes else "city"
        cell_neighbourhood[cell] = hood
        neighbourhood_values[hood].append(ring_counts[cell])
    city_mean = sum(ring_counts.values()) / len(ring_counts)
    neighbourhood_mean = {
        hood: sum(values) / len(values) for hood, values in neighbourhood_values.items()
    }
    shrunk = {
        cell: (ring_counts[cell] + credibility * neighbourhood_mean.get(cell_neighbourhood[cell], city_mean))
        / (1 + credibility)
        for cell in cells
    }
    distribution = sorted(shrunk.values())

    flood_features = _load("basement_flooding_study_areas.geojson")["features"]
    stations = [_point(feature["geometry"]) for feature in _load("fire_stations.geojson")["features"]]
    records: dict[str, Any] = {}
    for cell in sorted(cells):
        lat, lng = h3.cell_to_latlng(cell)
        percentile = _percentile(distribution, shrunk[cell])
        break_multiplier = _percentile_multiplier(percentile)
        if per_cell[cell] <= 1:
            break_multiplier = min(break_multiplier, 1.03)
        study_area = None
        for feature in flood_features:
            if _contains(feature["geometry"], lat, lng):
                study_area = feature["properties"].get("Asset Identification")
                break
        station_km = min(_haversine_km((lat, lng), station) for station in stations)
        fire_multiplier = 1.0 if station_km <= 1.5 else 1.03 if station_km <= 3.0 else 1.05
        water_multiplier = 1.10 if study_area else 1.0
        total = _clamp(break_multiplier * fire_multiplier * water_multiplier, 0.85, 1.25)
        records[cell] = {
            "ring_count": ring_counts[cell],
            "event_count": per_cell[cell],
            "neighbourhood": cell_neighbourhood[cell],
            "neighbourhood_mean": round(neighbourhood_mean.get(cell_neighbourhood[cell], city_mean), 6),
            "shrunk_count": round(shrunk[cell], 6),
            "percentile": round(percentile, 6),
            "level": _level(percentile),
            "break_ins_multiplier": round(_clamp(break_multiplier, 0.92, 1.10), 4),
            "basement_flooding_study_area": study_area,
            "water_multiplier": water_multiplier,
            "fire_station_km": round(station_km, 3),
            "fire_multiplier": fire_multiplier,
            "total_multiplier": round(total, 4),
        }

    output = {
        "schema_version": 1,
        "h3_resolution": resolution,
        "cell_count": len(records),
        "event_count": len(events),
        "cells": records,
    }
    SCORES_PATH.write_text(json.dumps(output, sort_keys=True, separators=(",", ":")) + "\n")
    return output


@dataclass(frozen=True)
class TorontoProfile:
    cell: str
    ring_count: int
    level: int
    break_ins_multiplier: float
    basement_flooding_study_area: str | None
    water_multiplier: float
    fire_station_km: float
    fire_multiplier: float
    total: float
    backend: str = "local"   # "elastic" | "local" -- which one answered the flood/fire lookup


class TorontoPack:
    def __init__(self, root: Path = ROOT) -> None:
        self.root = root
        self.config = yaml.safe_load((root / "pack.yaml").read_text())
        self.scores = json.loads((root / "hex_scores.json").read_text())
        self.cells = self.scores["cells"]
        self.flood_features = json.loads(
            (root / "raw" / "basement_flooding_study_areas.geojson").read_text()
        )["features"]
        self.stations = [
            _point(feature["geometry"])
            for feature in json.loads((root / "raw" / "fire_stations.geojson").read_text())["features"]
        ]
        self._client = _elastic_client()   # pinged once per pack instance, not per quote

    def profile_point(self, lat: float, lng: float, *, unit_level: str = "upper") -> TorontoProfile:
        cell = h3.latlng_to_cell(lat, lng, int(self.config["h3_resolution"]))
        record = self.cells.get(cell)
        if record is None:
            raise ValueError("point is outside the scored pack")

        live = _elastic_lookup(self._client, lat, lng) if self._client is not None else None
        if live is not None:
            backend = "elastic"
            study_area, fire_station_km = live
            fire_station_km = fire_station_km if fire_station_km is not None else record["fire_station_km"]
            fire_multiplier = 1.0 if fire_station_km <= 1.5 else 1.03 if fire_station_km <= 3.0 else 1.05
        else:
            backend = "local"
            study_area = next(
                (
                    feature["properties"].get("Asset Identification")
                    for feature in self.flood_features
                    if _contains(feature["geometry"], lat, lng)
                ),
                None,
            )
            fire_station_km, fire_multiplier = record["fire_station_km"], record["fire_multiplier"]

        water = 1.10 if study_area and unit_level in {"basement", "ground"} else 1.0
        total = _clamp(record["break_ins_multiplier"] * fire_multiplier * water, 0.85, 1.25)
        return TorontoProfile(
            cell=cell,
            ring_count=record["ring_count"],
            level=record["level"],
            break_ins_multiplier=record["break_ins_multiplier"],
            basement_flooding_study_area=study_area,
            water_multiplier=water,
            fire_station_km=round(fire_station_km, 3),
            fire_multiplier=fire_multiplier,
            total=round(total, 4),
            backend=backend,
        )

    def map_hexes(self, lat: float, lng: float, k: int = 3) -> list[dict[str, Any]]:
        center = h3.latlng_to_cell(lat, lng, int(self.config["h3_resolution"]))
        result = []
        for cell in sorted(h3.grid_disk(center, k)):
            record = self.cells.get(cell)
            if record is None:
                continue
            ring = [[round(a, 6), round(b, 6)] for a, b in h3.cell_to_boundary(cell)]
            ring.append(ring[0])
            result.append({"cell": cell, "ring": ring, "value": record["ring_count"], "level": record["level"]})
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="build in memory and report counts")
    args = parser.parse_args()
    output = build()
    print(f"wrote {output['cell_count']} cells from {output['event_count']} events")
    if args.check:
        assert all(0.92 <= row["break_ins_multiplier"] <= 1.10 for row in output["cells"].values())
        assert all(0.85 <= row["total_multiplier"] <= 1.25 for row in output["cells"].values())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
