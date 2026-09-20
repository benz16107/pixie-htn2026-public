#!/usr/bin/env python3
"""Load the two Elastic indices Pixie's exposure index and Toronto layer read: `pixie-exposure`
(active-policy locations, any line) and `pixie-toronto` (Toronto break-and-enter points).

    cd api && uv run python ../scripts/load_elastic.py

Idempotent: every doc id is deterministic (policy:location, and the event's own id), so a re-run
overwrites in place instead of duplicating. See docs/ELASTIC.md for the ES|QL and geo_distance
queries this data answers.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api" / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

import h3  # noqa: E402
from elasticsearch import Elasticsearch, helpers  # noqa: E402

from atlas_api.case import World  # noqa: E402
from atlas_api.maps import PERIL_TAGS  # noqa: E402
from atlas_api.portfolio import EXPOSURE_INDEX, RES, RES_FINE  # noqa: E402

TORONTO_INDEX = "pixie-toronto"
TORONTO_RES = 9
TORONTO_EVENTS = ROOT / "packs" / "toronto" / "raw" / "break_and_enter_2023_onward.geojson"

EXPOSURE_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "policy_id": {"type": "keyword"},
            "insured": {"type": "keyword"},
            "line": {"type": "keyword"},
            "state": {"type": "keyword"},
            "geo_point": {"type": "geo_point"},
            "tiv": {"type": "double"},
            "perils": {"type": "keyword"},
            "protection_class": {"type": "integer"},
            "h3_r5": {"type": "keyword"},
            "h3_r7": {"type": "keyword"},
        }
    }
}

TORONTO_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "geo_point": {"type": "geo_point"},
            "date": {"type": "date"},
            "h3_r9": {"type": "keyword"},
        }
    }
}


def client() -> Elasticsearch:
    url = os.environ["ELASTIC_URL"]
    user, pw = os.environ["ELASTIC_USERNAME"], os.environ["ELASTIC_PASSWORD"]
    c = Elasticsearch(url, basic_auth=(user, pw), request_timeout=30)
    info = c.info()
    print(f"connected: {info['cluster_name']} (ES {info['version']['number']}, {info['version']['build_flavor']})")
    return c


def _perils(tags: tuple[str, ...]) -> list[str]:
    tagset = set(tags)
    return sorted(p for p, group in PERIL_TAGS.items() if group & tagset)


def build_exposure_docs(world: World) -> list[dict[str, Any]]:
    """One doc per active-policy location, any line -- the same rows maps.book() aggregates."""
    docs = []
    seen: set[tuple[str, str]] = set()
    for p in world.policies.values():
        if p["status"] != "active":
            continue
        _tiv, sites = world._tiv_via_policy(p)
        for s in sites:
            if not s.lat or not s.lng or (p["policy_number"], s.id) in seen:
                continue
            seen.add((p["policy_number"], s.id))
            tiv = sum(b.tiv for b in s.buildings)
            docs.append({
                "_index": EXPOSURE_INDEX,
                "_id": f"{p['policy_number']}:{s.id}",
                "_source": {
                    "policy_id": p["policy_number"],
                    "insured": str(p["insured"]),
                    "line": p["line_of_business"],
                    "state": s.admin,
                    "geo_point": {"lat": s.lat, "lon": s.lng},
                    "tiv": tiv,
                    "perils": _perils(s.tags),
                    "protection_class": s.protection_class,
                    "h3_r5": h3.latlng_to_cell(s.lat, s.lng, RES),
                    "h3_r7": h3.latlng_to_cell(s.lat, s.lng, RES_FINE),
                },
            })
    return docs


def build_toronto_docs() -> list[dict[str, Any]]:
    features = json.loads(TORONTO_EVENTS.read_text())["features"]
    docs = []
    for f in features:
        props = f["properties"]
        lng, lat = f["geometry"]["coordinates"]
        occ_date = datetime.fromtimestamp(props["OCC_DATE"] / 1000, tz=timezone.utc).date().isoformat()
        doc_id = str(props.get("EVENT_UNIQUE_ID") or props["OBJECTID"])
        docs.append({
            "_index": TORONTO_INDEX,
            "_id": doc_id,
            "_source": {
                "geo_point": {"lat": lat, "lon": lng},
                "date": occ_date,
                "h3_r9": h3.latlng_to_cell(lat, lng, TORONTO_RES),
            },
        })
    return docs


def main() -> None:
    c = client()
    world = World.load()

    for name, mapping in ((EXPOSURE_INDEX, EXPOSURE_MAPPING), (TORONTO_INDEX, TORONTO_MAPPING)):
        if not c.indices.exists(index=name):
            c.indices.create(index=name, **mapping)
            print(f"created index {name}")
        else:
            print(f"index {name} already exists, reusing")

    exposure_docs = build_exposure_docs(world)
    helpers.bulk(c, exposure_docs)
    print(f"{EXPOSURE_INDEX}: loaded {len(exposure_docs)} docs")

    toronto_docs = build_toronto_docs()
    helpers.bulk(c, toronto_docs)
    print(f"{TORONTO_INDEX}: loaded {len(toronto_docs)} docs")

    c.indices.refresh(index=EXPOSURE_INDEX)
    c.indices.refresh(index=TORONTO_INDEX)

    # size big enough to pull every h3_r5 bucket, then sort client-side: ordering a multi-shard
    # terms agg directly by a sub-aggregation metric is only approximate (each shard pre-prunes
    # by its own top `size` before the sum is known), and this index spans 6 shards.
    top = c.search(
        index=EXPOSURE_INDEX, size=0,
        aggs={"cells": {"terms": {"field": "h3_r5", "size": 10_000},
                        "aggs": {"tiv": {"sum": {"field": "tiv"}}}}},
    )
    buckets = sorted(top["aggregations"]["cells"]["buckets"], key=lambda b: -b["tiv"]["value"])
    print("top 3 h3_r5 cells by tiv:")
    for b in buckets[:3]:
        print(f"  {b['key']}: ${b['tiv']['value']:,.0f} ({b['doc_count']} locations)")


if __name__ == "__main__":
    main()
