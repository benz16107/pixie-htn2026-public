"""Federato client, schema graph, query builder, snapshot loader.

Owns every Federato wire detail. Nothing outside this module should need to know the envelope
shape, the JWT, or the "[CODE] message {json}" error string.

    client = FederatoClient.from_env()
    client.schema()                                   # dict, cached to cache/schema.json
    client.query({"resource": "Policy", "pagination": {"limit": 5}})   # QueryResult, disk-cached by payload hash

    graph = SchemaGraph.from_schema(client.schema())
    paths = graph.paths("Submission", "Building.tiv")  # both TIV routes, shortest first
    qb = QueryBuilder(graph)
    qb.lint({"resource": "Policy", "where": {"exposure_units.location.state": "CA"}})
    # -> [LintIssue(kind="array_dot_path", ...)]

    snap = Snapshot.load("data/federato")               # all 12 pulled resources, id-keyed

CLI: `python -m atlas_api.federato ping` mints a token and fetches the schema live.
     `python -m atlas_api.federato` (no args) runs the offline self-check below.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal

import httpx
from dotenv import load_dotenv

AUTH_URL = "https://auth.product.federato.ai/oauth/token"
AUDIENCE = "https://product.federato.ai/core-api"
HANDLER_URL = "https://product.federato.ai/integrations-api/handlers/federato-hack-north?outputOnly=true"

TOKEN_REFRESH_SECONDS = 3 * 3600 + 50 * 60  # 3h50m; tokens last 4h

RESOURCES = [
    "Submission", "Policy", "Insured", "Location", "Building", "Claim",
    "Coverage", "ExposureUnit", "Broker", "Contact", "Underwriter", "Endorsement",
]


# ---------- errors: parsed from "[CODE] message {json}" (often prefixed by "Workflow step error: ") ----------

class FederatoErrorCode(str, Enum):
    VALIDATION = "VALIDATION_ERROR"
    AUTH = "AUTH"
    NOT_FOUND = "NOT_FOUND"
    UNKNOWN = "UNKNOWN"


_ERROR_RE = re.compile(r"\[(\w+)\]\s*(.*?)(?:\s*(\{.*\}))?$", re.DOTALL)


@dataclass
class FederatoError(Exception):
    code: FederatoErrorCode
    message: str
    details: dict[str, Any]
    payload: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return f"[{self.code.value}] {self.message}"

    @staticmethod
    def parse(raw: str, payload: dict[str, Any] | None = None) -> "FederatoError":
        m = _ERROR_RE.search(raw.strip())
        if not m:
            return FederatoError(FederatoErrorCode.UNKNOWN, raw.strip(), {}, payload or {})
        code_str, message, details_str = m.groups()
        try:
            code = FederatoErrorCode(code_str)
        except ValueError:
            code = FederatoErrorCode.UNKNOWN
        details: dict[str, Any] = {}
        if details_str:
            try:
                details = json.loads(details_str)
            except json.JSONDecodeError:
                details = {}
        return FederatoError(code, message.strip(), details, payload or {})


# ---------- schema graph ----------------------------------------------------------------------------

@dataclass(frozen=True)
class FieldInfo:
    resource: str
    path: str                      # "dates.effective" (nested object, same resource) or "exposure_units" (a hop)
    type: Literal["string", "number", "boolean", "array", "object", "reference"]
    optional: bool
    ref: str | None = None         # target resource when type == "reference"
    many: bool = False             # cardinality many => array boundary ($elemMatch / unwind needed)


@dataclass(frozen=True)
class Hop:
    field: FieldInfo


@dataclass(frozen=True)
class RefPath:
    """Submission -insured-> Insured -hq-> Location -buildings[]-> Building . tiv"""
    start: str
    hops: tuple[Hop, ...]
    leaf: FieldInfo
    crosses_array: bool

    def describe(self) -> str:
        parts = [self.start]
        for h in self.hops:
            name = h.field.path
            parts.append(f"{name}[]" if h.field.many else name)
        parts.append(self.leaf.path)
        return " -> ".join(parts)


def _flatten(resource: str, fields: dict[str, Any], prefix: str = "") -> dict[str, FieldInfo]:
    out: dict[str, FieldInfo] = {}
    for name, spec in fields.items():
        path = f"{prefix}{name}"
        ftype = spec.get("type", "string")
        optional = bool(spec.get("optional", False))
        if ftype == "reference":
            out[path] = FieldInfo(resource, path, "reference", optional,
                                   ref=spec.get("resource"), many=(spec.get("cardinality") == "many"))
        elif ftype == "object" and "fields" in spec:
            out[path] = FieldInfo(resource, path, "object", optional)
            out.update(_flatten(resource, spec["fields"], prefix=f"{path}."))
        elif ftype == "array":
            out[path] = FieldInfo(resource, path, "array", optional, many=True)
        else:
            out[path] = FieldInfo(resource, path, ftype, optional)
    return out


@dataclass
class SchemaGraph:
    fields: dict[str, dict[str, FieldInfo]]   # resource -> field path -> info

    @staticmethod
    def from_schema(raw: dict[str, Any]) -> "SchemaGraph":
        """`raw` is the unwrapped schema response: {"Submission": {"type":"object","fields":{...}}, ...}"""
        fields = {resource: _flatten(resource, spec.get("fields", {})) for resource, spec in raw.items()}
        return SchemaGraph(fields=fields)

    def paths(self, start: str, target: str, max_hops: int = 4) -> list[RefPath]:
        """All reference paths from `start` to `target` ("Resource.field"), BFS, shortest first.
        Walks reverse references too (Policy.submission -> Submission), since Submission carries
        no `policy` field: the bound TIV path is Submission <-submission- Policy -exposure_units[]->..."""
        target_resource, _, target_field = target.partition(".")
        if not target_field:
            raise ValueError(f"target must be 'Resource.field', got {target!r}")

        results: list[RefPath] = []
        seen: set[tuple[str, ...]] = set()
        queue: deque[tuple[str, tuple[Hop, ...]]] = deque([(start, ())])
        while queue:
            resource, hops = queue.popleft()
            if resource == target_resource:
                leaf = self.fields.get(resource, {}).get(target_field)
                if leaf is not None and leaf.type != "reference":
                    key = tuple(h.field.path for h in hops)
                    if key not in seen:
                        seen.add(key)
                        results.append(RefPath(start, hops, leaf, any(h.field.many for h in hops)))
                    continue
            if len(hops) >= max_hops:
                continue
            for finfo in self.fields.get(resource, {}).values():
                if finfo.type == "reference" and finfo.ref:
                    queue.append((finfo.ref, hops + (Hop(finfo),)))
            for r2, r2fields in self.fields.items():
                for finfo in r2fields.values():
                    if finfo.type == "reference" and finfo.ref == resource:
                        rev = FieldInfo(resource, f"<-{r2}.{finfo.path}", "reference", True, ref=r2, many=True)
                        queue.append((r2, hops + (Hop(rev),)))
        results.sort(key=lambda p: len(p.hops))
        return results

    def summary(self) -> str:
        """Compact text for LLM prompts: one line per resource, refs marked '->R' and arrays '[]'."""
        lines = []
        for resource, fields in self.fields.items():
            parts = []
            for path, info in fields.items():
                if info.type == "reference":
                    parts.append(f"{path}->{info.ref}{'[]' if info.many else ''}")
                elif "." not in path:  # skip flattened nested-object children in the summary
                    parts.append(f"{path}:{info.type}")
            lines.append(f"{resource}: {', '.join(parts)}")
        return "\n".join(lines)


# ---------- query builder ---------------------------------------------------------------------------

_KNOWN_OPERATORS = {
    "$eq", "$ne", "$exists", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$contains",
    "$elemMatch", "$and", "$or", "$not", "$sum", "$avg", "$min", "$max", "$count",
    "$countDistinct", "$expand",
}


@dataclass(frozen=True)
class LintIssue:
    kind: Literal["array_dot_path", "unexpanded_reference", "unknown_field", "unknown_operator"]
    at: str
    fix: str


class QueryBuilder:
    def __init__(self, graph: SchemaGraph) -> None:
        self.graph = graph

    def fetch(self, path: RefPath, where: dict[str, Any] | None = None) -> dict[str, Any]:
        """Payload that returns the leaf values along `path`: expand chain for every forward hop,
        unwind at array hops, select the leaf. Never emits a dot-path through an array."""
        if any(h.field.path.startswith("<-") for h in path.hops):
            raise ValueError(
                "fetch() only builds forward expand chains; a reverse hop needs its own query "
                "rooted at that resource"
            )

        def build_expand(hops: tuple[Hop, ...]) -> Any:
            if not hops:
                return True
            head, *rest = hops
            return {head.field.path: build_expand(tuple(rest))}

        expand = build_expand(path.hops) if path.hops else {}
        unwind = [
            ".".join(h.field.path for h in path.hops[: i + 1])
            for i, h in enumerate(path.hops)
            if h.field.many
        ]
        leaf_path = ".".join([h.field.path for h in path.hops] + [path.leaf.path])

        payload: dict[str, Any] = {"resource": path.start}
        if expand:
            payload["expand"] = expand
        if unwind:
            payload["unwind"] = unwind
        if where:
            payload["where"] = where
        payload["select"] = [leaf_path]
        return payload

    def lint(self, payload: dict[str, Any]) -> list[LintIssue]:
        """Static checks against the schema BEFORE calling the API: dot-paths through an array
        (needs $elemMatch, unless already `unwind`-ed), and reference fields dot-pathed into
        without `expand`. A path already covered by the payload's own expand/unwind is clean."""
        issues: list[LintIssue] = []
        resource = payload.get("resource")
        if not resource or resource not in self.graph.fields:
            return issues
        expanded = self._expanded_paths(payload.get("expand", {}))
        unwound = set(self._unwind_paths(payload.get("unwind", [])))
        for clause_name in ("where", "filter"):
            clause = payload.get(clause_name)
            if isinstance(clause, dict):
                self._lint_clause(resource, clause, expanded, unwound, issues)
        return issues

    def _expanded_paths(self, spec: Any, prefix: str = "") -> set[str]:
        paths: set[str] = set()
        if not isinstance(spec, dict):
            return paths
        for k, v in spec.items():
            path = k if not prefix else f"{prefix}.{k}"
            paths.add(path)
            if isinstance(v, dict):
                paths |= self._expanded_paths(v, prefix=path)
        return paths

    def _unwind_paths(self, entries: Any) -> list[str]:
        out = []
        for e in entries or []:
            if isinstance(e, str):
                out.append(e)
            elif isinstance(e, dict) and "path" in e:
                out.append(e["path"])
        return out

    def _lint_clause(self, resource: str, clause: dict[str, Any], expanded: set[str],
                      unwound: set[str], issues: list[LintIssue]) -> None:
        for key, value in clause.items():
            if key.startswith("$"):
                if key not in _KNOWN_OPERATORS:
                    issues.append(LintIssue("unknown_operator", key, f"'{key}' is not a documented operator"))
                if isinstance(value, list):
                    for v in value:
                        if isinstance(v, dict):
                            self._lint_clause(resource, v, expanded, unwound, issues)
                elif isinstance(value, dict):
                    self._lint_clause(resource, value, expanded, unwound, issues)
                continue
            self._check_path(resource, key, expanded, unwound, issues)
            if isinstance(value, dict) and not any(k.startswith("$") for k in value):
                # a nested clause keyed by object shape, e.g. {"dates": {"effective": "..."}}
                self._lint_clause(resource, {f"{key}.{k}": v for k, v in value.items()}, expanded, unwound, issues)

    def _check_path(self, resource: str, dotted: str, expanded: set[str], unwound: set[str],
                     issues: list[LintIssue]) -> None:
        segs = dotted.split(".")
        cur_resource = resource
        idx = 0
        consumed: list[str] = []   # full path segments from the query root (crosses resource hops)
        while idx < len(segs):
            fields = self.graph.fields.get(cur_resource, {})
            matched_key, matched_info = None, None
            for length in range(len(segs) - idx, 0, -1):
                candidate = ".".join(segs[idx: idx + length])
                if candidate in fields:
                    matched_key, matched_info = candidate, fields[candidate]
                    break
            if matched_info is None:
                issues.append(LintIssue("unknown_field", dotted, f"'{segs[idx]}' is not a field on {cur_resource}"))
                return
            consumed.append(matched_key)
            full_path = ".".join(consumed)
            idx += matched_key.count(".") + 1
            is_last = idx >= len(segs)
            if matched_info.type == "reference":
                if not is_last:
                    if matched_info.many:
                        if full_path not in unwound:
                            issues.append(LintIssue(
                                "array_dot_path", dotted,
                                f"'{full_path}' is an array; use $elemMatch instead of a dot-path through it",
                            ))
                    elif full_path not in expanded:
                        issues.append(LintIssue(
                            "unexpanded_reference", dotted,
                            f"add expand: {{'{full_path}': true}} to reach {matched_info.ref} before "
                            f"filtering its fields",
                        ))
                cur_resource = matched_info.ref or cur_resource
            elif not is_last:
                issues.append(LintIssue(
                    "unknown_field", dotted, f"'{matched_key}' is not an object or reference on {cur_resource}",
                ))
                return


# ---------- disk cache (tiny interface; T5 swaps this for the SQLite CaseStore) -----------------------

class Cache:
    def get(self, key: str) -> Any | None:
        raise NotImplementedError

    def set(self, key: str, value: Any) -> None:
        raise NotImplementedError


class JsonFileCache(Cache):
    """One JSON file per key under `root`. ponytail: no eviction/TTL, add if cache/ grows unwieldy."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def get(self, key: str) -> Any | None:
        p = self._path(key)
        if not p.exists():
            return None
        return json.loads(p.read_text())

    def set(self, key: str, value: Any) -> None:
        self._path(key).write_text(json.dumps(value))


def _payload_key(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


# ---------- client -----------------------------------------------------------------------------------

@dataclass(frozen=True)
class QueryResult:
    resource: str
    total: int
    rows: list[dict[str, Any]]
    ms: int


class FederatoClient:
    """httpx client. Token minted lazily, cached to `token_path`, refreshed at 3h50m or on the
    first 401 (retried once). Every query() is cached to disk by payload hash, so replay and the
    backtest never hit the network."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        cache_dir: Path = Path("cache"),
        token_path: Path = Path(".token"),
        http: httpx.Client | None = None,
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.cache_dir = cache_dir
        self.token_path = token_path
        self.http = http or httpx.Client(timeout=30.0)
        self.query_cache: Cache = JsonFileCache(cache_dir / "federato" / "q")
        self._schema_cache_path = cache_dir / "federato" / "schema.json"
        self._token: str | None = None
        self._token_minted_at: float = 0.0
        self.network_calls = 0  # test hook: counts calls that actually hit the wire

    @classmethod
    def from_env(cls) -> "FederatoClient":
        load_dotenv()  # walks up from this file to the repo root's .env (AGENTS.md: secrets only in .env)
        return cls(os.environ["FEDERATO_CLIENT_ID"], os.environ["FEDERATO_CLIENT_SECRET"])

    # ---- auth ----

    def _mint_token(self) -> str:
        resp = self.http.post(AUTH_URL, json={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "audience": AUDIENCE,
            "grant_type": "client_credentials",
        })
        resp.raise_for_status()
        token = resp.json()["access_token"]
        self._token = token
        self._token_minted_at = time.time()
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        self.token_path.write_text(json.dumps({"access_token": token, "minted_at": self._token_minted_at}))
        return token

    def token(self, force: bool = False) -> str:
        if not force and self._token is None and self.token_path.exists():
            try:
                cached = json.loads(self.token_path.read_text())
                self._token = cached["access_token"]
                self._token_minted_at = cached["minted_at"]
            except (json.JSONDecodeError, KeyError, OSError):
                pass
        if force or self._token is None or time.time() - self._token_minted_at > TOKEN_REFRESH_SECONDS:
            return self._mint_token()
        return self._token

    # ---- raw call ----

    def _call(self, body: dict[str, Any], *, retried: bool = False) -> Any:
        token = self.token()
        self.network_calls += 1
        resp = self.http.post(HANDLER_URL, json=body, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 401 and not retried:
            self.token(force=True)
            return self._call(body, retried=True)
        payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
        if resp.status_code >= 400:
            message = resp.text
            try:
                message = resp.json().get("message", resp.text)
            except json.JSONDecodeError:
                pass
            raise FederatoError.parse(message, payload)
        # outputOnly=true still wraps the step result as {"output": [{"data": ...}]}; unwrap here so
        # nothing outside this module sees the envelope.
        body_json = resp.json()
        if isinstance(body_json, dict) and "output" in body_json:
            return body_json["output"][0]["data"]
        return body_json

    # ---- public API ----

    def schema(self, use_cache: bool = True) -> dict[str, Any]:
        if use_cache and self._schema_cache_path.exists():
            return json.loads(self._schema_cache_path.read_text())
        data = self._call({"action": "schema"})
        self._schema_cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._schema_cache_path.write_text(json.dumps(data))
        return data

    def query(self, payload: dict[str, Any], *, use_cache: bool = True) -> QueryResult:
        key = _payload_key(payload)
        if use_cache:
            cached = self.query_cache.get(key)
            if cached is not None:
                return QueryResult(**cached)
        t0 = time.time()
        data = self._call({"action": "query", "payload": payload})
        ms = int((time.time() - t0) * 1000)
        rows = data.get("results") if isinstance(data, dict) else None
        if rows is None and isinstance(data, dict):
            rows = data.get("groups", [])
        total = data.get("total", len(rows or [])) if isinstance(data, dict) else 0
        result = QueryResult(resource=payload.get("resource", ""), total=total, rows=rows or [], ms=ms)
        self.query_cache.set(key, {"resource": result.resource, "total": result.total,
                                    "rows": result.rows, "ms": result.ms})
        return result


# ---------- snapshot (the pulled JSON, unwrapped) -----------------------------------------------------

@dataclass
class Snapshot:
    """Immutable pull of all 12 resources, keyed by id. `data/federato/<Resource>.json` files are
    the raw API response ({"output": [{"data": {"total", "results"}}]}); unwrap once here."""
    records: dict[str, dict[int, dict[str, Any]]] = field(default_factory=dict)
    fetched_at: str = ""

    @staticmethod
    def load(root: str | Path) -> "Snapshot":
        root = Path(root)
        records: dict[str, dict[int, dict[str, Any]]] = {}
        for name in RESOURCES:
            raw = json.loads((root / f"{name}.json").read_text())
            rows = raw["output"][0]["data"]["results"]
            records[name] = {row["id"]: row for row in rows}
        return Snapshot(records=records, fetched_at=datetime.now(timezone.utc).isoformat())

    def get(self, resource: str, record_id: int) -> dict[str, Any] | None:
        return self.records.get(resource, {}).get(record_id)

    def all(self, resource: str) -> list[dict[str, Any]]:
        return list(self.records.get(resource, {}).values())


# repo root / data / federato, resolved from this file so callers work from any cwd
DEFAULT_SNAPSHOT_DIR = str(Path(__file__).resolve().parents[3] / "data" / "federato")


# ---------- CLI ----------------------------------------------------------------------------------

def _ping() -> None:
    client = FederatoClient.from_env()
    schema = client.schema(use_cache=False)
    resources = sorted(schema.keys())
    print(f"token ok, schema has {len(resources)} resources: {', '.join(resources)}")


def _self_check() -> None:
    """T1/T2 accept criteria. Bad-operator parsing uses a captured real error string (no network).
    The schema graph and lint run against the schema, fetched once and then cached to disk, so a
    later offline run reads cache/federato/schema.json instead of hitting the network again."""
    # T1: "[CODE] message {json}" parsing, against the real error text a live $grt query returns
    err = FederatoError.parse(
        'Workflow step error: [VALIDATION_ERROR] Unknown operator "$grt" {"operator":"$grt","path":"premium"}'
    )
    assert err.code is FederatoErrorCode.VALIDATION, err
    assert err.details.get("operator") == "$grt", err

    # T1: snapshot loads all 158 submissions and 938 exposure units
    snap = Snapshot.load(DEFAULT_SNAPSHOT_DIR)
    assert len(snap.all("Submission")) == 158, len(snap.all("Submission"))
    assert len(snap.all("ExposureUnit")) == 938, len(snap.all("ExposureUnit"))

    # T2: SchemaGraph.paths finds both the bound and the open TIV routes
    client = FederatoClient.from_env()
    graph = SchemaGraph.from_schema(client.schema())  # cached after the first live fetch
    found = graph.paths("Submission", "Building.tiv")
    assert any("hq" in p.describe() for p in found), "missing the open (Insured.hq) TIV route"
    assert any("exposure_units" in p.describe() for p in found), "missing the bound (exposure_units) TIV route"

    # T2: lint flags an array dot-path with an $elemMatch fix, and clears it once unwound
    qb = QueryBuilder(graph)
    bad = qb.lint({"resource": "Policy", "where": {"exposure_units.location.state": "CA"}})
    assert bad and bad[0].kind == "array_dot_path" and "$elemMatch" in bad[0].fix, bad
    fixed = qb.lint({"resource": "Policy", "unwind": ["exposure_units"],
                      "filter": {"exposure_units.location.state": "CA"}})
    assert not any(i.kind == "array_dot_path" for i in fixed), fixed

    print("federato.py self-check ok")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "ping":
        _ping()
    elif len(sys.argv) <= 1:
        _self_check()
    else:
        print("usage: python -m atlas_api.federato [ping]", file=sys.stderr)
        raise SystemExit(2)
