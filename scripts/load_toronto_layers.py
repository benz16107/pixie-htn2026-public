#!/usr/bin/env python3
"""Load Toronto's basement-flooding study areas and fire stations into Elastic as `geo_shape`/
`geo_point` indices, so the consumer quote flow can answer "is this address in a flood study area"
and "how far is the nearest fire station" with ES|QL (`ST_INTERSECTS`/`ST_DISTANCE`) instead of the
local point-in-polygon/haversine math in packs/toronto/layers.py. That local math stays as the
fallback (packs.toronto.layers.TorontoPack tries Elastic first, AGENTS.md invariant 4).

    cd api && uv run python ../scripts/load_toronto_layers.py

Idempotent: doc ids are the source `_id`, so a re-run overwrites in place. Raw files already exist
on disk (packs/toronto/fetch.py); this script only indexes them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api" / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from elasticsearch import helpers  # noqa: E402

from atlas_api.portfolio import _elastic_client  # noqa: E402

RAW = ROOT / "packs" / "toronto" / "raw"
FLOOD_INDEX = "toronto-flood-zones"
FIRE_INDEX = "toronto-fire-stations"

FLOOD_MAPPING: dict[str, Any] = {
    "mappings": {"properties": {"asset_id": {"type": "keyword"}, "shape": {"type": "geo_shape"}}}
}
FIRE_MAPPING: dict[str, Any] = {
    "mappings": {"properties": {"name": {"type": "keyword"}, "location": {"type": "geo_point"}}}
}


def _first_point(geometry: dict[str, Any]) -> tuple[float, float]:
    """(lat, lon) from a Point or MultiPoint geometry."""
    coords = geometry["coordinates"]
    lng, lat = coords[0] if geometry["type"] == "MultiPoint" else coords
    return float(lat), float(lng)


def build_flood_docs() -> list[dict[str, Any]]:
    features = json.loads((RAW / "basement_flooding_study_areas.geojson").read_text())["features"]
    docs = []
    for f in features:
        props = f["properties"]
        docs.append({
            "_index": FLOOD_INDEX, "_id": str(props["_id"]),
            "_source": {"asset_id": props.get("Asset Identification"), "shape": f["geometry"]},
        })
    return docs


def build_fire_docs() -> list[dict[str, Any]]:
    features = json.loads((RAW / "fire_stations.geojson").read_text())["features"]
    docs = []
    for f in features:
        props = f["properties"]
        lat, lng = _first_point(f["geometry"])
        docs.append({
            "_index": FIRE_INDEX, "_id": str(props["_id"]),
            "_source": {"name": props.get("ADDRESS") or f"Station {props.get('STATION')}",
                        "location": {"lat": lat, "lon": lng}},
        })
    return docs


def main() -> int:
    client = _elastic_client()
    if client is None:
        print("no Elastic connection (ELASTIC_URL / credentials); the Toronto lookups use the local fallback")
        return 1
    for name, mapping in ((FLOOD_INDEX, FLOOD_MAPPING), (FIRE_INDEX, FIRE_MAPPING)):
        if not client.indices.exists(index=name):
            client.indices.create(index=name, **mapping)
            print(f"created index {name}")
        else:
            print(f"index {name} already exists, reusing")

    flood_docs = build_flood_docs()
    helpers.bulk(client, flood_docs)
    print(f"{FLOOD_INDEX}: loaded {len(flood_docs)} docs")

    fire_docs = build_fire_docs()
    helpers.bulk(client, fire_docs)
    print(f"{FIRE_INDEX}: loaded {len(fire_docs)} docs")

    client.indices.refresh(index=FLOOD_INDEX)
    client.indices.refresh(index=FIRE_INDEX)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
