#!/usr/bin/env python3
"""Download the Toronto source layers used by the Pixie risk pack."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw"
MANIFEST_PATH = ROOT / "MANIFEST.json"
USER_AGENT = "atlas-htn2026/1.0 (benz16107@gmail.com)"
COMMIT_LIMIT = 20 * 1024 * 1024
SAMPLE_ROWS = 100

TPS_BREAK_INS = (
    "https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/"
    "Break_and_Enter_Open_Data/FeatureServer/0"
)
TRCA_FLOODLINE = (
    "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/"
    "Floodline_TRCA_Polygon/FeatureServer/1"
)
CKAN_API = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show"


SOURCES = (
    {
        "key": "break_and_enter_2023_onward",
        "kind": "arcgis",
        "url": TPS_BREAK_INS,
        "where": "REPORT_YEAR >= 2023",
    },
    {
        "key": "basement_flooding_study_areas",
        "kind": "ckan",
        "package": "basement-flooding-study-areas",
    },
    {
        "key": "fire_stations",
        "kind": "ckan",
        "package": "fire-station-locations",
    },
    {
        "key": "trca_floodline",
        "kind": "arcgis",
        "url": TRCA_FLOODLINE,
        "where": "1=1",
        # Floodline polygons are detailed enough that a 2,000-row response stalls.
        "page_size": 100,
        "geometry_precision": 5,
    },
    {
        "key": "fire_hydrants",
        "kind": "ckan",
        "package": "fire-hydrants",
    },
)


def get_bytes(url: str, params: dict[str, Any] | None = None, attempts: int = 3) -> bytes:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt == attempts - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def get_json(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = json.loads(get_bytes(url, params))
    if isinstance(payload, dict) and "error" in payload:
        raise RuntimeError(f"remote API error: {payload['error']}")
    return payload


def write_geojson(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    temporary.replace(path)


def fetch_arcgis(source: dict[str, Any], output: Path) -> tuple[int, str]:
    layer = get_json(source["url"], {"f": "json"})
    page_size = min(int(layer.get("maxRecordCount", 2000)), int(source.get("page_size", 2000)))
    count_payload = get_json(
        f"{source['url']}/query",
        {"where": source["where"], "returnCountOnly": "true", "f": "json"},
    )
    expected = int(count_payload["count"])
    features: list[dict[str, Any]] = []
    offset = 0
    while offset < expected:
        query = {
            "where": source["where"],
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": 4326,
            "orderByFields": layer.get("objectIdField", "OBJECTID"),
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "f": "geojson",
        }
        if "geometry_precision" in source:
            query["geometryPrecision"] = source["geometry_precision"]
        page = get_json(
            f"{source['url']}/query",
            query,
        )
        batch = page.get("features", [])
        if not batch:
            break
        features.extend(batch)
        offset += len(batch)
        print(f"  {source['key']}: {len(features)}/{expected}")
    if len(features) != expected:
        raise RuntimeError(f"expected {expected} rows but received {len(features)}")
    write_geojson(output, {"type": "FeatureCollection", "features": features})
    return len(features), f"{source['url']}/query"


def choose_geojson_resource(package: dict[str, Any]) -> dict[str, Any]:
    resources = [r for r in package.get("resources", []) if r.get("format", "").lower() == "geojson"]
    preferred = [r for r in resources if "4326" in r.get("name", "").lower() or "4326" in r.get("url", "").lower()]
    candidates = preferred or resources
    if not candidates:
        raise RuntimeError("the CKAN package has no GeoJSON resource")
    downloads = [r for r in candidates if "/download/" in r.get("url", "")]
    return (downloads or candidates)[-1]


def fetch_ckan(source: dict[str, Any], output: Path) -> tuple[int, str]:
    response = get_json(CKAN_API, {"id": source["package"]})
    if not response.get("success"):
        raise RuntimeError(f"CKAN package lookup failed for {source['package']}")
    resource = choose_geojson_resource(response["result"])
    payload = json.loads(get_bytes(resource["url"]))
    features = payload.get("features")
    if not isinstance(features, list):
        raise RuntimeError("download was not a GeoJSON FeatureCollection")
    write_geojson(output, payload)
    return len(features), resource["url"]


def keep_committable_copy(full_path: Path, row_count: int) -> dict[str, Any]:
    size = full_path.stat().st_size
    committed_path = full_path.with_name(full_path.name.replace(".full.geojson", ".geojson"))
    sample_path = full_path.with_name(full_path.name.replace(".full.geojson", ".sample.geojson"))
    committed_path.unlink(missing_ok=True)
    sample_path.unlink(missing_ok=True)
    if size <= COMMIT_LIMIT:
        shutil.copyfile(full_path, committed_path)
        return {"raw_file": str(committed_path.relative_to(ROOT)), "bytes": size, "sample_rows": None}
    payload = json.loads(full_path.read_text())
    sample = dict(payload)
    sample["features"] = payload["features"][:SAMPLE_ROWS]
    write_geojson(sample_path, sample)
    return {
        "raw_file": str(full_path.relative_to(ROOT)),
        "bytes": size,
        "sample_file": str(sample_path.relative_to(ROOT)),
        "sample_rows": min(SAMPLE_ROWS, row_count),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=[source["key"] for source in SOURCES], action="append")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    selected = [source for source in SOURCES if not args.only or source["key"] in args.only]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    manifest: dict[str, Any] = {"fetched_at": fetched_at, "datasets": {}}
    failures: list[tuple[str, str]] = []

    for source in selected:
        key = source["key"]
        full_path = RAW_DIR / f"{key}.full.geojson"
        print(f"Fetching {key}")
        try:
            if source["kind"] == "arcgis":
                rows, resolved_url = fetch_arcgis(source, full_path)
            else:
                rows, resolved_url = fetch_ckan(source, full_path)
            details = keep_committable_copy(full_path, rows)
            manifest["datasets"][key] = {
                "status": "ok",
                "rows": rows,
                "fetched_at": fetched_at,
                "source_url": resolved_url,
                **details,
            }
            print(f"  wrote {rows} rows")
        except Exception as error:  # continue so one portal outage does not block other layers
            message = f"{type(error).__name__}: {error}"
            failures.append((key, message))
            manifest["datasets"][key] = {
                "status": "failed",
                "rows": None,
                "fetched_at": fetched_at,
                "source_url": source.get("url") or f"{CKAN_API}?id={source['package']}",
                "error": message,
            }
            print(f"  FAILED: {message}", file=sys.stderr)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    if failures:
        print("\nFailures:")
        for key, message in failures:
            print(f"  {key}: {message}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
