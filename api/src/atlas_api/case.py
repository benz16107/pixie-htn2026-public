"""Case model with provenance, and World (the indexed Federato snapshot).

Invariant (AGENTS.md 2, 3): every scalar a rule can read is a Value. A rule never sees a bare
float, so a Missing value cannot be silently treated as passing.

    world = World.load("data/federato")
    case = world.case("SUB-138")
    case.tiv                # Known(2_073_000, source="Insured.hq -> Location 19 -> Buildings [35]")
    case.premium             # Missing(reason="open submission has no bound Policy", resolver="broker")
    case.issues              # DataIssues: duplicates, stale submissions, limit vs TIV, missing roof year
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Generic, Literal, TypeVar

from .federato import Snapshot

# repo root / data / federato, resolved from this file so `World.load()` works from any cwd
# (uv run's cwd is api/, but the pulled snapshot lives at the repo root's data/federato symlink).
DEFAULT_SNAPSHOT_DIR = str(Path(__file__).resolve().parents[3] / "data" / "federato")

T = TypeVar("T")
Resolver = Literal["broker", "intake", "hazard", "portfolio", "applicant", "none"]

# open (non-bound) submission statuses: still live in the queue, so duplicate/stale checks apply
OPEN_STATUSES = {"received", "cleared", "quoted"}


# ---------- Value: the whole provenance story in one sum type -----------------------------------

@dataclass(frozen=True)
class Known(Generic[T]):
    v: T
    source: str


@dataclass(frozen=True)
class Estimated(Generic[T]):
    lo: T
    hi: T
    point: T
    method: str
    evidence: tuple[str, ...] = ()


@dataclass(frozen=True)
class Missing:
    reason: str
    resolver: Resolver


Value = Known[T] | Estimated[T] | Missing


@dataclass(frozen=True)
class DataIssue:
    kind: Literal["duplicate_account", "limit_vs_tiv", "missing_roof_year", "stale_submission"]
    severity: Literal["info", "warn", "block"]
    text: str
    facts: tuple[str, ...] = ()


# ---------- Building / Site: structural detail, not case-level scalars --------------------------
# ponytail: plain fields here, not Value-wrapped like Case's scalars. The sketch wraps every
# building field too (for a future building-level provenance drill-down in the UI); T1-T3 doesn't
# need that yet, so it's skipped. Add Value-wrapping if W3 wants a per-building provenance badge.

@dataclass(frozen=True)
class Building:
    id: int
    tiv: float
    year_built: int
    construction: str
    sprinklered: bool
    roof_year: int | None


@dataclass(frozen=True)
class Site:
    id: str
    lat: float
    lng: float
    region: str
    admin: str                      # state
    tags: tuple[str, ...]           # Federato hazard_tags
    protection_class: int | None
    buildings: tuple[Building, ...] = ()


# ---------- Case ----------------------------------------------------------------------------------

@dataclass(frozen=True)
class Case:
    id: str                        # "SUB-138"
    kind: Literal["commercial", "tenant"]
    status: str
    as_of: str
    line: Value
    business_type: Value
    primary_admin: Value
    tiv: Value
    premium: Value
    year_built: Value
    construction_share: Value
    loss_5yr: Value
    sites: tuple[Site, ...]
    broker: Value
    contact: Value
    extra: dict[str, Value] = field(default_factory=dict)
    issues: tuple[DataIssue, ...] = ()
    human_outcome: str | None = None

    def fact(self, name: str) -> Value:
        if name in self.extra:
            return self.extra[name]
        return getattr(self, name)

    def with_fact(self, name: str, value: Value, by: str) -> "Case":
        """Immutable update. The desk (T7) folds Findings into a new Case, then re-assesses."""
        if hasattr(self, name) and name not in ("extra",):
            from dataclasses import replace
            return replace(self, **{name: value})
        extra = dict(self.extra)
        extra[name] = value
        from dataclasses import replace
        return replace(self, extra=extra)

    def fact_ids(self) -> dict[str, str]:
        """fact id -> rendered value, the whitelist verify_numbers() (T7) checks explanations against."""
        out: dict[str, str] = {}
        for name in ("tiv", "premium", "year_built", "loss_5yr"):
            v = getattr(self, name)
            if isinstance(v, Known):
                out[name] = str(v.v)
            elif isinstance(v, Estimated):
                out[f"{name}_lo"] = str(v.lo)
                out[f"{name}_hi"] = str(v.hi)
                out[f"{name}_point"] = str(v.point)
        return out


# ---------- World: snapshot + indexes, built once --------------------------------------------------

class World:
    """Federato snapshot + indexes, loaded once at startup. `packs` and `rules` are accepted for
    signature compatibility with T4's engine (region packs, rules files); T1-T3 doesn't load them."""

    def __init__(self, snapshot: Snapshot, packs: list[str] | None = None, rules: str | None = None) -> None:
        self.snapshot = snapshot
        self.packs = packs or []
        self.rules_dir = rules

        self.submissions: dict[int, dict[str, Any]] = snapshot.records["Submission"]
        self.policies: dict[int, dict[str, Any]] = snapshot.records["Policy"]
        self.insureds: dict[int, dict[str, Any]] = snapshot.records["Insured"]
        self.locations: dict[int, dict[str, Any]] = snapshot.records["Location"]
        self.buildings: dict[int, dict[str, Any]] = snapshot.records["Building"]
        self.claims: dict[int, dict[str, Any]] = snapshot.records["Claim"]
        self.brokers: dict[int, dict[str, Any]] = snapshot.records["Broker"]
        self.contacts: dict[int, dict[str, Any]] = snapshot.records["Contact"]
        self.exposure_units: dict[int, dict[str, Any]] = snapshot.records["ExposureUnit"]

        self.policies_by_submission: dict[int, dict[str, Any]] = {}
        self.policies_by_insured: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for p in self.policies.values():
            sub_id = p.get("submission")
            if sub_id is not None:
                self.policies_by_submission[sub_id] = p
            self.policies_by_insured[p["insured"]].append(p)

        self.claims_by_policy: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for c in self.claims.values():
            self.claims_by_policy[c["policy"]].append(c)

        # bound comparables by line: T4's estimate_premium reads this. A Policy record only exists
        # once a submission binds, so every Policy is "bound" regardless of its later status
        # (active/expired/non_renewed/cancelled all still carry a real technical_premium/TIV).
        self.bound_by_line: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for p in self.policies.values():
            self.bound_by_line[p["line_of_business"]].append(p)

    @staticmethod
    def load(snapshot_dir: str = DEFAULT_SNAPSHOT_DIR, packs: list[str] | None = None,
             rules: str | None = None) -> "World":
        return World(Snapshot.load(snapshot_dir), packs=packs, rules=rules)

    # ---- case building --------------------------------------------------------------------------

    def case(self, case_id: str, as_of: str | None = None) -> Case:
        if not case_id.startswith("SUB-"):
            raise ValueError(f"unsupported case id {case_id!r}; only 'SUB-<id>' is built in T1-T3")
        sub_id = int(case_id.removeprefix("SUB-"))
        sub = self.submissions.get(sub_id)
        if sub is None:
            raise KeyError(f"no Submission {sub_id}")
        as_of = as_of or sub["received_date"]

        policy = self.policies_by_submission.get(sub_id)
        insured = self.insureds[sub["insured"]]
        broker = self.brokers.get(sub["broker"])
        contact = self.contacts.get(sub["contact"])

        if policy is not None:
            tiv, sites = self._tiv_via_policy(policy)
            premium: Value = Known(float(policy["premium"]), source=f"Policy.premium ({policy['policy_number']})")
            business_type: Value = Known(policy["business_type"],
                                          source=f"Policy.business_type ({policy['policy_number']})")
        else:
            tiv, sites = self._tiv_via_hq(insured)
            premium = Missing(reason="open submission has no bound Policy", resolver="broker")
            business_type = self._infer_business_type(sub, as_of)

        primary_admin: Value = (Known(sites[0].admin, source=f"Location {sites[0].id}")
                                 if sites else Missing(reason="no site resolved", resolver="broker"))
        year_built, construction_share = self._year_and_construction(sites)
        loss_5yr = self._loss_5yr(sub["insured"], as_of, exclude_policy_id=policy["id"] if policy else None)

        issues: list[DataIssue] = []
        issues.extend(self._duplicate_and_stale_issues(sub))
        issues.extend(self._limit_vs_tiv_issue(sub, tiv))
        issues.extend(self._missing_roof_year_issues(sites))

        return Case(
            id=case_id,
            kind="commercial",
            status=sub["status"],
            as_of=as_of,
            line=Known(sub["line_of_business"], source="Submission.line_of_business"),
            business_type=business_type,
            primary_admin=primary_admin,
            tiv=tiv,
            premium=premium,
            year_built=year_built,
            construction_share=construction_share,
            loss_5yr=loss_5yr,
            sites=sites,
            broker=(Known(broker["name"], source="Broker.name") if broker
                    else Missing(reason="no broker on file", resolver="none")),
            contact=(Known(f"{contact['name']} <{contact['email']}>", source="Contact") if contact
                     else Missing(reason="no contact on file", resolver="none")),
            extra={"requested_limit": Known(float(sub["requested_limit"]), source="Submission.requested_limit")},
            issues=tuple(issues),
            human_outcome=sub.get("decline_reason"),
        )

    # ---- TIV hydration ---------------------------------------------------------------------------

    def _site_from_location(self, loc_id: int) -> Site:
        loc = self.locations[loc_id]
        buildings = tuple(self._building(bid) for bid in loc.get("buildings", []))
        return Site(
            id=str(loc_id), lat=loc.get("latitude") or 0.0, lng=loc.get("longitude") or 0.0,
            region="us", admin=loc["state"], tags=tuple(loc.get("hazard_tags") or ()),
            protection_class=loc.get("protection_class"), buildings=buildings,
        )

    def _building(self, bid: int) -> Building:
        b = self.buildings[bid]
        return Building(id=bid, tiv=b["tiv"], year_built=b["year_built"], construction=b["construction_type"],
                         sprinklered=b["sprinklered"], roof_year=b.get("roof_year"))

    def bound_comparables(self, line: str) -> list[tuple[str, float, float]]:
        """(policy_number, technical_premium, tiv) for every bound policy on `line` whose TIV is
        resolvable. T4's estimate_premium reads this to build the premium comparables."""
        out: list[tuple[str, float, float]] = []
        for p in self.bound_by_line.get(line, []):
            tp = p.get("technical_premium")
            if not tp:
                continue
            tiv, _sites = self._tiv_via_policy(p)
            if isinstance(tiv, Known) and tiv.v > 0:
                out.append((p["policy_number"], float(tp), tiv.v))
        return out

    def _tiv_via_policy(self, policy: dict[str, Any]) -> tuple[Value, tuple[Site, ...]]:
        """bound plan: Policy.exposure_units -> location -> buildings"""
        loc_ids: list[int] = []
        for eu_id in policy.get("exposure_units", []):
            eu = self.exposure_units.get(eu_id)
            loc_id = eu.get("location") if eu else None
            if loc_id is not None and loc_id not in loc_ids:
                loc_ids.append(loc_id)
        if not loc_ids:
            return Missing(reason="policy has no location-linked exposure units", resolver="broker"), ()
        sites = tuple(self._site_from_location(lid) for lid in loc_ids)
        total = sum(b.tiv for s in sites for b in s.buildings)
        n_buildings = sum(len(s.buildings) for s in sites)
        source = f"Policy.exposure_units -> location -> buildings ({len(loc_ids)} locations, {n_buildings} buildings)"
        return Known(float(total), source=source), sites

    def _tiv_via_hq(self, insured: dict[str, Any]) -> tuple[Value, tuple[Site, ...]]:
        """open plan: Insured.hq -> buildings"""
        hq_id = insured.get("hq")
        if hq_id is None:
            return Missing(reason="insured has no hq location", resolver="broker"), ()
        site = self._site_from_location(hq_id)
        total = sum(b.tiv for b in site.buildings)
        bids = [b.id for b in site.buildings]
        source = f"Insured.hq -> Location {hq_id} -> Buildings {bids}"
        return Known(float(total), source=source), (site,)

    def _year_and_construction(self, sites: tuple[Site, ...]) -> tuple[Value, Value]:
        buildings = [b for s in sites for b in s.buildings]
        if not buildings:
            missing = Missing(reason="no buildings resolved", resolver="broker")
            return missing, missing
        total_tiv = sum(b.tiv for b in buildings) or 1
        year = sum(b.year_built * b.tiv for b in buildings) / total_tiv
        share: dict[str, float] = {}
        for b in buildings:
            share[b.construction] = share.get(b.construction, 0.0) + b.tiv / total_tiv
        return (Known(round(year, 1), source=f"TIV-weighted over {len(buildings)} buildings"),
                Known(share, source=f"TIV share over {len(buildings)} buildings"))

    def _loss_5yr(self, insured_id: int, as_of: str, exclude_policy_id: int | None = None) -> Value:
        """Loss history from the insured's other policies' claims before as_of."""
        policies = self.policies_by_insured.get(insured_id, [])
        if not policies:
            return Missing(reason="insured has no policy history", resolver="broker")
        as_of_date = date.fromisoformat(as_of)
        try:
            start = as_of_date.replace(year=as_of_date.year - 5)
        except ValueError:  # Feb 29 with no leap year 5 back
            start = as_of_date.replace(year=as_of_date.year - 5, day=28)
        total = 0.0
        n = 0
        for p in policies:
            if p["id"] == exclude_policy_id:
                continue
            for c in self.claims_by_policy.get(p["id"], []):
                dol = date.fromisoformat(c["date_of_loss"])
                if start <= dol < as_of_date:
                    total += c["paid_indemnity"] + c["paid_expense"] + c["reserve_indemnity"] + c["reserve_expense"]
                    n += 1
        eligible_policies = len(policies) - (1 if exclude_policy_id is not None else 0)
        return Known(total, source=f"{n} claims across {eligible_policies} other policies of the insured, {start} to {as_of_date}")

    # ---- business type: Estimated for every open submission, never silently "new" ----------------

    def _infer_business_type(self, sub: dict[str, Any], as_of: str) -> Value:
        insured_id, line = sub["insured"], sub["line_of_business"]
        others = [p for p in self.policies_by_insured.get(insured_id, []) if p["line_of_business"] == line]

        later = [p for p in others if p["dates"].get("quoted") and p["dates"]["quoted"] > as_of]
        if later:
            p = sorted(later, key=lambda p: p["dates"]["quoted"])[0]
            return Estimated(
                lo="renewal", hi="renewal", point="renewal",
                method="insured bound a same-line policy after this submission was received",
                evidence=(f"{p['policy_number']} quoted {p['dates']['quoted']}, this submission received {as_of}",),
            )
        active = [p for p in others if p["status"] in ("active", "bound")]
        if active:
            return Estimated(
                lo="renewal", hi="renewal", point="renewal",
                method="insured holds an active or bound policy on this line",
                evidence=(active[0]["policy_number"],),
            )
        return Estimated(
            lo="new", hi="new", point="new",
            method=f"no active, bound, or later policy on {line} among {len(others)} of the insured's "
                   f"other submissions on this line",
            evidence=tuple(p["policy_number"] for p in others),
        )

    # ---- DataIssues -------------------------------------------------------------------------------

    def _duplicate_and_stale_issues(self, sub: dict[str, Any]) -> list[DataIssue]:
        issues: list[DataIssue] = []
        if sub["status"] not in OPEN_STATUSES:
            return issues
        insured_id, line = sub["insured"], sub["line_of_business"]

        siblings = [
            s for s in self.submissions.values()
            if s["id"] != sub["id"] and s["insured"] == insured_id and s["line_of_business"] == line
            and s["status"] in OPEN_STATUSES
        ]
        for sib in siblings:
            if sib["broker"] != sub["broker"]:
                issues.append(DataIssue(
                    kind="duplicate_account", severity="warn",
                    text=f"insured {insured_id} has open {line} submissions from two brokers: "
                         f"SUB-{sub['id']} (broker {sub['broker']}) and SUB-{sib['id']} (broker {sib['broker']})",
                    facts=(f"SUB-{sub['id']}.broker={sub['broker']}", f"SUB-{sib['id']}.broker={sib['broker']}"),
                ))

        others = [p for p in self.policies_by_insured.get(insured_id, []) if p["line_of_business"] == line]
        later = [p for p in others if p["dates"].get("quoted") and p["dates"]["quoted"] > sub["received_date"]]
        if later:
            p = sorted(later, key=lambda p: p["dates"]["quoted"])[0]
            issues.append(DataIssue(
                kind="stale_submission", severity="warn",
                text=f"SUB-{sub['id']} was received {sub['received_date']} but the insured later bound "
                     f"{p['policy_number']} (quoted {p['dates']['quoted']}) on the same line: ask the broker "
                     f"whether this submission is stale or a duplicate",
                facts=(f"SUB-{sub['id']}.received_date={sub['received_date']}",
                       f"{p['policy_number']}.quoted={p['dates']['quoted']}"),
            ))
        return issues

    def _limit_vs_tiv_issue(self, sub: dict[str, Any], tiv: Value) -> list[DataIssue]:
        if not isinstance(tiv, Known):
            return []
        limit = sub["requested_limit"]
        if tiv.v > 0 and limit < 0.25 * tiv.v:
            return [DataIssue(
                kind="limit_vs_tiv", severity="warn",
                text=f"requested limit ${limit:,.0f} is far below TIV ${tiv.v:,.0f} ({limit / tiv.v:.0%})",
                facts=(f"SUB-{sub['id']}.requested_limit={limit}", f"tiv={tiv.v}"),
            )]
        return []

    def _missing_roof_year_issues(self, sites: tuple[Site, ...]) -> list[DataIssue]:
        issues = []
        for s in sites:
            for b in s.buildings:
                if b.roof_year is None:
                    issues.append(DataIssue(
                        kind="missing_roof_year", severity="info",
                        text=f"Building {b.id} at Location {s.id} has no roof_year on file",
                        facts=(f"Building.{b.id}.roof_year=missing",),
                    ))
        return issues


if __name__ == "__main__":
    w = World.load()
    c = w.case("SUB-138")
    assert isinstance(c.tiv, Known) and c.tiv.v == 2_073_000, c.tiv
    assert isinstance(c.premium, Missing) and c.premium.resolver == "broker", c.premium
    assert any(i.kind == "duplicate_account" for i in w.case("SUB-126").issues)
    assert any(i.kind == "duplicate_account" for i in w.case("SUB-141").issues)
    assert isinstance(w.case("SUB-143").business_type, Estimated)
    assert any(i.kind == "stale_submission" for i in w.case("SUB-143").issues)
    assert any(i.kind == "limit_vs_tiv" for i in w.case("SUB-134").issues)
    print("case.py self-check ok")
