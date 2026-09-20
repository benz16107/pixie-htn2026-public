"""Exposure index: active-policy TIV concentration near a case, and per-H3-cell TIV for the map.

Two implementations behind one `ExposureIndex` protocol:
  ElasticIndex    queries the live `pixie-exposure` index (scripts/load_elastic.py loads it):
                  a geo_distance filter + terms aggregation on the h3_r5/h3_r7 keyword fields with
                  sum(tiv) sub-aggregations. This is the sponsor-prize path (see docs/ELASTIC.md).
  InMemoryIndex   the original in-process index, same math, no network. `open_index()` falls back
                  to this silently whenever Elastic is unreachable or the index isn't built yet,
                  so the demo still runs with the network off (AGENTS.md invariant 4).

    index = open_index(world)
    index.impact(case, insured_id)     # portfolio agent tool (concentration near one case)
    index.book(res=5, peril="flood")   # /map/book (active TIV per H3 cell)
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Any, Protocol

import h3
from dotenv import load_dotenv

from .case import Case, World

load_dotenv()   # ELASTIC_URL/USERNAME/PASSWORD -- portfolio.py is imported before app.py's own load_dotenv() in tests/scripts

RES = 5
RES_FINE = 7
RADIUS_KM = 30.0
PENALTY_PER_TIV = 1 / 25_000_000   # 1 point per $25M near the case, capped at the rules' max_penalty

EXPOSURE_INDEX = "pixie-exposure"


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


@dataclass(frozen=True)
class Impact:
    points: float
    near_tiv: float
    cell_tiv: float
    cell: str
    n_locations: int
    policies: tuple[str, ...]
    near_cells: tuple[str, ...] = ()
    backend: str = "memory"   # "elastic" | "memory" -- which index answered (shown on the desk)


class ExposureIndex(Protocol):
    backend: str

    def impact(self, case: Case, insured_id: int | None = None) -> Impact | None: ...
    def book(self, res: int = RES, peril: str = "") -> list[dict[str, Any]]: ...


# ---------- in-memory: no network, same math -----------------------------------------------------

class InMemoryIndex:
    backend = "memory"

    def __init__(self, world: World, max_penalty: float = 10) -> None:
        self.world = world
        self.max_penalty = max_penalty
        self.rows: list[tuple[str, int, float, float, float, str]] = []   # policy, insured, lat, lng, tiv, cell
        for p in world.policies.values():
            if p["status"] != "active" or p["line_of_business"] != "property":
                continue
            _tiv, sites = world._tiv_via_policy(p)
            for s in sites:
                tiv = sum(b.tiv for b in s.buildings)
                if s.lat and s.lng:
                    self.rows.append((p["policy_number"], p["insured"], s.lat, s.lng, tiv,
                                      h3.latlng_to_cell(s.lat, s.lng, RES)))

    def impact(self, case: Case, insured_id: int | None = None) -> Impact | None:
        if not case.sites:
            return None
        site = case.sites[0]
        cell = h3.latlng_to_cell(site.lat, site.lng, RES)
        near = [r for r in self.rows if r[1] != insured_id and _km((site.lat, site.lng), (r[2], r[3])) <= RADIUS_KM]
        in_cell = [r for r in self.rows if r[1] != insured_id and r[5] == cell]
        near_tiv = sum(r[4] for r in near)
        pts = -min(self.max_penalty, near_tiv * PENALTY_PER_TIV)
        return Impact(points=round(pts, 1), near_tiv=near_tiv, cell_tiv=sum(r[4] for r in in_cell), cell=cell,
                      n_locations=len(near), policies=tuple(sorted({r[0] for r in near})),
                      near_cells=tuple(sorted({r[5] for r in near})), backend=self.backend)

    def book(self, res: int = RES, peril: str = "") -> list[dict[str, Any]]:
        from .maps import book as _book   # local import: maps.py doesn't import portfolio.py, no cycle
        return _book(self.world, res, peril)


# ---------- Elastic: the sponsor-prize path -------------------------------------------------------

class ElasticIndex:
    backend = "elastic"

    def __init__(self, client: Any, world: World, max_penalty: float = 10) -> None:
        self.client = client
        self.max_penalty = max_penalty
        self._mem = InMemoryIndex(world, max_penalty=max_penalty)   # per-query fallback if ES hiccups mid-demo

    def impact(self, case: Case, insured_id: int | None = None) -> Impact | None:
        if not case.sites:
            return None
        site = case.sites[0]
        cell = h3.latlng_to_cell(site.lat, site.lng, RES)
        filters: list[dict[str, Any]] = [
            {"term": {"line": "property"}},
            {"geo_distance": {"distance": f"{RADIUS_KM}km", "geo_point": {"lat": site.lat, "lon": site.lng}}},
        ]
        must_not = [{"term": {"insured": str(insured_id)}}] if insured_id is not None else []
        try:
            resp = self.client.search(
                index=EXPOSURE_INDEX, size=0, track_total_hits=True,
                query={"bool": {"filter": filters, "must_not": must_not}},
                aggs={
                    "near_tiv": {"sum": {"field": "tiv"}},
                    "policies": {"terms": {"field": "policy_id", "size": 1000}},
                    "cells": {"terms": {"field": "h3_r5", "size": 1000},
                              "aggs": {"tiv": {"sum": {"field": "tiv"}}}},
                },
            )
        except Exception:
            return self._mem.impact(case, insured_id)

        agg = resp["aggregations"]
        near_tiv = agg["near_tiv"]["value"] or 0.0
        cell_buckets = agg["cells"]["buckets"]
        cell_tiv = next((b["tiv"]["value"] or 0.0 for b in cell_buckets if b["key"] == cell), 0.0)
        near_cells = tuple(sorted(b["key"] for b in cell_buckets))
        policies = tuple(sorted(b["key"] for b in agg["policies"]["buckets"]))
        n_locations = resp["hits"]["total"]["value"]
        pts = -min(self.max_penalty, near_tiv * PENALTY_PER_TIV)
        return Impact(points=round(pts, 1), near_tiv=near_tiv, cell_tiv=cell_tiv, cell=cell,
                      n_locations=n_locations, policies=policies, near_cells=near_cells, backend=self.backend)

    def book(self, res: int = RES, peril: str = "") -> list[dict[str, Any]]:
        if res not in (RES, RES_FINE):   # pixie-exposure only stores h3_r5 and h3_r7 keyword fields
            return self._mem.book(res, peril)
        query: dict[str, Any] = {"bool": {"filter": [{"term": {"perils": peril}}] if peril else []}}
        try:
            resp = self.client.search(
                index=EXPOSURE_INDEX, size=0, query=query,
                aggs={"cells": {"terms": {"field": f"h3_r{res}", "size": 10_000},
                                "aggs": {"tiv": {"sum": {"field": "tiv"}}}}},
            )
        except Exception:
            return self._mem.book(res, peril)

        by_cell = {b["key"]: b["tiv"]["value"] or 0.0 for b in resp["aggregations"]["cells"]["buckets"]}
        values = sorted(v for v in by_cell.values() if v > 0)

        def level(v: float) -> int:
            return min(4, int(5 * sum(1 for x in values if x < v) / max(1, len(values))))

        return [{"cell": c, "ring": [[round(la, 5), round(lo, 5)] for la, lo in h3.cell_to_boundary(c)],
                 "value": v, "level": level(v)} for c, v in sorted(by_cell.items()) if v > 0]


# ---------- open_index: Elastic when reachable, in-memory otherwise --------------------------------

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


def open_index(world: World, max_penalty: float = 10) -> ExposureIndex:
    """Prefer the live `pixie-exposure` Elastic index; fall back to the in-memory index silently
    (no exception, no log spam) if ELASTIC_* isn't set, the project is unreachable, or the index
    hasn't been loaded yet (run scripts/load_elastic.py)."""
    client = _elastic_client()
    if client is not None:
        try:
            if client.indices.exists(index=EXPOSURE_INDEX):
                return ElasticIndex(client, world, max_penalty=max_penalty)
        except Exception:
            pass
    return InMemoryIndex(world, max_penalty=max_penalty)
