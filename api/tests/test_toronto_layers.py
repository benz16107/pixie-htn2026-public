from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from packs.toronto.layers import TorontoPack, _elastic_client  # noqa: E402


def test_three_demo_addresses_have_different_factors() -> None:
    pack = TorontoPack()
    city_hall = pack.profile_point(43.6503, -79.3869, unit_level="upper")
    ossington = pack.profile_point(43.6434853, -79.4228957, unit_level="upper")
    basement = pack.profile_point(43.6903801, -79.4594893, unit_level="basement")

    signatures = {
        (p.break_ins_multiplier, p.fire_multiplier, p.water_multiplier) for p in (city_hall, ossington, basement)
    }
    assert len(signatures) == 3
    assert basement.basement_flooding_study_area
    assert basement.water_multiplier == 1.10


def test_pack_caps_and_single_event_credibility() -> None:
    pack = TorontoPack()
    rows = pack.cells.values()
    assert all(0.92 <= row["break_ins_multiplier"] <= 1.10 for row in rows)
    assert all(1.00 <= row["fire_multiplier"] <= 1.05 for row in rows)
    assert all(0.85 <= row["total_multiplier"] <= 1.25 for row in rows)
    assert all(row["break_ins_multiplier"] <= 1.03 for row in rows if row["event_count"] == 1)


def test_map_rings_are_closed_lat_lng() -> None:
    hexes = TorontoPack().map_hexes(43.6503, -79.3869, 1)
    assert hexes
    assert all(item["ring"][0] == item["ring"][-1] for item in hexes)
    assert all(-90 <= lat <= 90 and -180 <= lng <= 180 for item in hexes for lat, lng in item["ring"])


def test_elastic_flood_and_fire_lookup_agrees_with_local() -> None:
    """ST_INTERSECTS/ST_DISTANCE against toronto-flood-zones/toronto-fire-stations should find the
    same flood study area the local point-in-polygon check finds, and a plausible fire distance.
    Skips (not fails) when Elastic or the two indices aren't reachable (AGENTS.md invariant 4;
    run scripts/load_toronto_layers.py to load them)."""
    pack = TorontoPack()
    if pack._client is None:
        pytest.skip("Elastic unreachable; run scripts/load_toronto_layers.py against a live project")
    basement = pack.profile_point(43.6903801, -79.4594893, unit_level="basement")
    assert basement.backend == "elastic"
    assert basement.basement_flooding_study_area == "BFA3"   # same asset id the local check finds
    assert 0 < basement.fire_station_km < 10
