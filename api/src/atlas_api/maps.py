"""Map payloads, computed server side (no h3-js in the clients): case pins and active-policy TIV per H3 cell."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import h3

from .case import OPEN_STATUSES, World

PERIL_TAGS = {"flood": {"flood"}, "wildfire": {"wildfire"}, "wind": {"wind", "hurricane", "tornado", "hail"},
              "quake": {"earthquake"}}
PIN_RES = 3   # the web map filters pins by the res-3 cells it draws


def pins(world: World, decisions: dict[str, str]) -> list[dict[str, Any]]:
    """One pin per open submission with a resolved site; `decisions` maps case id -> decision kind."""
    out = []
    for sub in world.submissions.values():
        if sub["status"] not in OPEN_STATUSES:
            continue
        case = world.case(f"SUB-{sub['id']}")
        if not case.sites or not case.sites[0].lat:
            continue
        s = case.sites[0]
        perils = sorted(p for p, tags in PERIL_TAGS.items() if tags & set(s.tags))
        out.append({"caseId": str(sub["id"]), "insured": world.insureds.get(sub["insured"], {}).get("name", "?"),
                    "line": sub["line_of_business"], "decision": decisions.get(str(sub["id"]), "routed"),
                    "site": {"lat": s.lat, "lng": s.lng}, "cell": h3.latlng_to_cell(s.lat, s.lng, PIN_RES),
                    "perils": perils})
    return out


def book(world: World, res: int = 5, peril: str = "") -> list[dict[str, Any]]:
    """Active-policy TIV per H3 cell (every line: buildings reached through exposure units), optionally only
    locations tagged with `peril`. level 0-4 = quintile of the cell values in this response."""
    tags = PERIL_TAGS.get(peril)
    by_cell: dict[str, float] = defaultdict(float)
    seen: set[tuple[str, str]] = set()
    for p in world.policies.values():
        if p["status"] != "active":
            continue
        _tiv, sites = world._tiv_via_policy(p)
        for s in sites:
            if not s.lat or (tags and not tags & set(s.tags)) or (p["policy_number"], s.id) in seen:
                continue
            seen.add((p["policy_number"], s.id))
            by_cell[h3.latlng_to_cell(s.lat, s.lng, res)] += sum(b.tiv for b in s.buildings)
    values = sorted(v for v in by_cell.values() if v > 0)

    def level(v: float) -> int:
        return min(4, int(5 * sum(1 for x in values if x < v) / max(1, len(values))))

    return [{"cell": c, "ring": [[round(la, 5), round(lo, 5)] for la, lo in h3.cell_to_boundary(c)],
             "value": v, "level": level(v)} for c, v in sorted(by_cell.items()) if v > 0]
