#!/usr/bin/env python3
"""Prefetch public hazard layers for every Federato Location."""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
LOCATIONS_PATH = ROOT / "data" / "federato" / "Location.json"
CACHE_ROOT = ROOT / "cache" / "layers"
SUMMARY_PATH = CACHE_ROOT / "SUMMARY.json"
USER_AGENT = "atlas-htn2026 (benz16107@gmail.com)"

FEMA_URL = (
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/"
    "USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query"
)
USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
USFS_URL = (
    "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/"
    "USFS_EDW_RMRS_WRC_WildfireHazardPotential/ImageServer/identify"
)
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

WIND_GUST_THRESHOLD_KMH = 80.0
PRECIPITATION_THRESHOLD_MM = 25.0
SOURCE_NAMES = ("fema_flood", "usgs_earthquakes", "usfs_wildfire", "open_meteo", "nominatim")
CACHE_VERSIONS = {
    "fema_flood": 1,
    "usgs_earthquakes": 1,
    "usfs_wildfire": 1,
    "open_meteo": 1,
    "nominatim": 2,
}

network_requests = 0
last_nominatim_request = 0.0


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def request_json(
    url: str,
    params: dict[str, Any],
    *,
    throttle_nominatim: bool = False,
    attempts: int = 3,
) -> dict[str, Any]:
    global last_nominatim_request, network_requests
    encoded = urllib.parse.urlencode(params)
    request = urllib.request.Request(f"{url}?{encoded}", headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        if throttle_nominatim:
            delay = 1.0 - (time.monotonic() - last_nominatim_request)
            if delay > 0:
                time.sleep(delay)
            last_nominatim_request = time.monotonic()
        network_requests += 1
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read())
            if isinstance(payload, dict) and "error" in payload:
                raise RuntimeError(f"remote API error: {payload['error']}")
            return payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == attempts - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def load_locations() -> list[dict[str, Any]]:
    payload = json.loads(LOCATIONS_PATH.read_text())
    data = payload["output"][0]["data"]
    rows = data["results"] if isinstance(data, dict) else data
    if len(rows) != 70:
        raise ValueError(f"expected 70 locations, found {len(rows)}")
    if any(row.get("latitude") is None or row.get("longitude") is None for row in rows):
        raise ValueError("every location must have latitude and longitude")
    return rows


def cache_path(source: str, location_id: Any) -> Path:
    return CACHE_ROOT / source / f"{location_id}.json"


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def cached_or_fetch(
    source: str,
    location: dict[str, Any],
    fetch: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[dict[str, Any], bool]:
    path = cache_path(source, location["id"])
    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get("cache_version", 1) == CACHE_VERSIONS[source]:
            return cached, True
    payload = fetch(location)
    payload.update(
        {
            "cache_version": CACHE_VERSIONS[source],
            "location_id": location["id"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "fetched_at": utc_now(),
        }
    )
    write_json(path, payload)
    return payload, False


def fetch_fema(location: dict[str, Any]) -> dict[str, Any]:
    payload = request_json(
        FEMA_URL,
        {
            "geometry": f"{location['longitude']},{location['latitude']}",
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF,esri_symbology",
            "returnGeometry": "false",
            "f": "json",
        },
    )
    features = [feature.get("attributes", {}) for feature in payload.get("features", [])]
    return {
        "source": FEMA_URL,
        "status": "mapped" if features else "outside_mapped_hazard_area",
        "features": features,
    }


def fetch_usgs(location: dict[str, Any]) -> dict[str, Any]:
    payload = request_json(
        USGS_URL,
        {
            "format": "geojson",
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "maxradiuskm": 50,
            "minmagnitude": 4,
            "starttime": "1994-01-01",
            "endtime": "2024-01-01",
        },
    )
    features = payload.get("features", [])
    return {
        "source": USGS_URL,
        "status": "ok",
        "count": len(features),
        "query": {
            "minimum_magnitude": 4,
            "radius_km": 50,
            "start": "1994-01-01",
            "end_exclusive": "2024-01-01",
        },
    }


def fetch_usfs(location: dict[str, Any]) -> dict[str, Any]:
    geometry = {
        "x": location["longitude"],
        "y": location["latitude"],
        "spatialReference": {"wkid": 4326},
    }
    payload = request_json(
        USFS_URL,
        {
            "geometry": json.dumps(geometry, separators=(",", ":")),
            "geometryType": "esriGeometryPoint",
            "returnGeometry": "false",
            "returnCatalogItems": "false",
            "f": "json",
        },
    )
    raw_value = payload.get("value")
    is_nodata = raw_value is None or str(raw_value).strip().lower() in {"", "nodata", "no data"}
    value: int | float | str | None = raw_value
    if not is_nodata:
        try:
            numeric = float(str(raw_value))
            value = int(numeric) if numeric.is_integer() else numeric
        except ValueError:
            pass
    return {
        "source": USFS_URL,
        "status": "urban_nodata" if is_nodata else "ok",
        "value": None if is_nodata else value,
        "raw_value": raw_value,
    }


def count_days_over(values: list[Any], threshold: float) -> int:
    return sum(value is not None and float(value) > threshold for value in values)


def fetch_open_meteo(location: dict[str, Any]) -> dict[str, Any]:
    payload = request_json(
        OPEN_METEO_URL,
        {
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31",
            "daily": "wind_gusts_10m_max,precipitation_sum",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "timezone": "UTC",
        },
    )
    daily = payload.get("daily", {})
    dates = daily.get("time", [])
    gusts = daily.get("wind_gusts_10m_max", [])
    precipitation = daily.get("precipitation_sum", [])
    if not (len(dates) == len(gusts) == len(precipitation) == 365):
        raise RuntimeError(
            f"Open-Meteo returned {len(dates)} dates, {len(gusts)} gusts, "
            f"and {len(precipitation)} precipitation values"
        )
    return {
        "source": OPEN_METEO_URL,
        "status": "ok",
        "year": 2023,
        "days": len(dates),
        "wind_gust_threshold_kmh": WIND_GUST_THRESHOLD_KMH,
        "days_wind_gust_over_threshold": count_days_over(gusts, WIND_GUST_THRESHOLD_KMH),
        "precipitation_threshold_mm": PRECIPITATION_THRESHOLD_MM,
        "days_precipitation_over_threshold": count_days_over(
            precipitation, PRECIPITATION_THRESHOLD_MM
        ),
    }


def normalize_county(value: str | None) -> str:
    normalized = re.sub(r"[^a-z0-9 ]", "", (value or "").lower())
    return re.sub(r"\b(county|parish|borough|municipality|census area)\b", "", normalized).strip()


def fetch_nominatim(location: dict[str, Any]) -> dict[str, Any]:
    payload = request_json(
        NOMINATIM_URL,
        {
            "lat": location["latitude"],
            "lon": location["longitude"],
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
        },
        throttle_nominatim=True,
    )
    address = payload.get("address", {})
    state_code = address.get("ISO3166-2-lvl4", "").split("-")[-1].upper()
    county = address.get("county") or address.get("state_district")
    location_state = str(location.get("state") or "").upper()
    location_county = location.get("county")
    state_mismatch = None if not state_code or not location_state else state_code != location_state
    county_mismatch = (
        None
        if not county or not location_county
        else normalize_county(county) != normalize_county(location_county)
    )
    mismatches = (state_mismatch, county_mismatch)
    jurisdiction_mismatch = True if True in mismatches else None if None in mismatches else False
    return {
        "source": NOMINATIM_URL,
        "status": "ok",
        "display_name": payload.get("display_name"),
        "reverse_state": address.get("state"),
        "reverse_state_code": state_code or None,
        "reverse_county": county,
        "location_state": location_state or None,
        "location_county": location_county,
        "state_mismatch": state_mismatch,
        "county_mismatch": county_mismatch,
        "jurisdiction_mismatch": jurisdiction_mismatch,
    }


FETCHERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "fema_flood": fetch_fema,
    "usgs_earthquakes": fetch_usgs,
    "usfs_wildfire": fetch_usfs,
    "open_meteo": fetch_open_meteo,
    "nominatim": fetch_nominatim,
}


def print_failures(failures: list[dict[str, Any]]) -> None:
    print("\nFailures")
    print(f"{'source':<20} {'location':<10} error")
    print(f"{'-' * 20} {'-' * 10} {'-' * 50}")
    if not failures:
        print(f"{'none':<20} {'-':<10} -")
        return
    for failure in failures:
        message = failure["error"].replace("\n", " ")
        print(f"{failure['source']:<20} {str(failure['location_id']):<10} {message[:100]}")


def main() -> int:
    locations = load_locations()
    failures: list[dict[str, Any]] = []
    cache_hits: Counter[str] = Counter()
    fetched: Counter[str] = Counter()
    statuses: dict[str, Counter[str]] = {source: Counter() for source in SOURCE_NAMES}

    for index, location in enumerate(locations, 1):
        print(f"[{index:02d}/{len(locations)}] location {location['id']}")
        for source, fetcher in FETCHERS.items():
            try:
                payload, was_cached = cached_or_fetch(source, location, fetcher)
                (cache_hits if was_cached else fetched)[source] += 1
                statuses[source][str(payload.get("status", "unknown"))] += 1
            except Exception as error:  # keep fetching other sources and locations
                failures.append(
                    {
                        "source": source,
                        "location_id": location["id"],
                        "error": f"{type(error).__name__}: {error}",
                    }
                )

    summary = {
        "generated_at": utc_now(),
        "locations": len(locations),
        "expected_cache_files": len(locations) * len(SOURCE_NAMES),
        "network_requests": network_requests,
        "cache_hits": {source: cache_hits[source] for source in SOURCE_NAMES},
        "fetched": {source: fetched[source] for source in SOURCE_NAMES},
        "statuses": {
            source: dict(sorted(statuses[source].items())) for source in SOURCE_NAMES
        },
        "failures": failures,
        "thresholds": {
            "wind_gust_kmh_strictly_over": WIND_GUST_THRESHOLD_KMH,
            "precipitation_mm_strictly_over": PRECIPITATION_THRESHOLD_MM,
        },
    }
    write_json(SUMMARY_PATH, summary)
    print_failures(failures)
    print(f"\nNetwork requests: {network_requests}")
    print(f"Cache hits: {sum(cache_hits.values())}/{len(locations) * len(SOURCE_NAMES)}")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted; completed cache files remain valid.", file=sys.stderr)
        raise SystemExit(130)
