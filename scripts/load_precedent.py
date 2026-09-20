#!/usr/bin/env python3
"""Load `pixie-precedent`: one doc per bound policy or declined submission, for the desk's hybrid
precedent search (`GET /cases/{id}/precedent`), the `significant_terms` book insight
(`GET /insights/declines`) and the TIV/premium percentile rank (`GET /cases/{id}/percentile`).

    cd api && uv run python ../scripts/load_precedent.py

Idempotent: the doc id is the policy number (bound) or submission number (declined), so a re-run
overwrites in place. See docs/ELASTIC.md for the ES|QL/DSL and the caveats this data answers.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api" / "src"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from elasticsearch import helpers  # noqa: E402

from atlas_api.case import World  # noqa: E402
from atlas_api.portfolio import _elastic_client  # noqa: E402
from atlas_api.precedent import PRECEDENT_INDEX, build_precedent_docs  # noqa: E402

MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "policyNumber": {"type": "keyword"},
            "caseId": {"type": "keyword"},
            "insured": {"type": "text"},
            "line": {"type": "keyword"},
            "state": {"type": "keyword"},
            "construction": {"type": "keyword"},
            "broker": {"type": "keyword"},
            "decision": {"type": "keyword"},        # "bound" | "declined"
            "declineReason": {"type": "keyword"},
            "tiv": {"type": "double"},
            "tivBand": {"type": "keyword"},
            "premium": {"type": "double"},
            "perils": {"type": "keyword"},
            "status": {"type": "keyword"},
            "incurred": {"type": "double"},
            "lossRatio": {"type": "double"},
            # semantic_text with no inference_id: Elasticsearch resolves it to
            # .jina-embeddings-v5-text-small on this project (verified live, docs/research/elastic.md).
            # match queries against it still work (BM25-style lexical + the model's own retrieval),
            # so the same field backs both legs of the rrf retriever.
            "summary": {"type": "semantic_text"},
        }
    }
}


def main() -> int:
    client = _elastic_client()
    if client is None:
        print("no Elastic connection (ELASTIC_URL / credentials); PrecedentIndex uses the in-memory fallback")
        return 1
    if client.indices.exists(index=PRECEDENT_INDEX):
        client.indices.delete(index=PRECEDENT_INDEX)
        print(f"dropped existing {PRECEDENT_INDEX} (recreating with the semantic_text/decision mapping)")
    client.indices.create(index=PRECEDENT_INDEX, **MAPPING)
    print(f"created index {PRECEDENT_INDEX}")

    docs = build_precedent_docs(World.load())
    actions = [{"_index": PRECEDENT_INDEX, "_id": d["id"], "_source": d} for d in docs]
    helpers.bulk(client, actions)
    client.indices.refresh(index=PRECEDENT_INDEX)
    n_bound = sum(1 for d in docs if d["decision"] == "bound")
    n_declined = sum(1 for d in docs if d["decision"] == "declined")
    print(f"{PRECEDENT_INDEX}: loaded {len(docs)} docs ({n_bound} bound, {n_declined} declined)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
