from fastapi.testclient import TestClient

from atlas_api.app import app


def _request(unit_level: str, *, sewer_backup: bool = False) -> dict:
    return {
        "address": "565 McRoberts Ave",
        "answers": {
            "contentsValue": 20_000,
            "unitLevel": unit_level,
            "claims5yr": 0,
            "deductible": 1000,
            "liability": 1_000_000,
            "sewerBackup": sewer_backup,
        },
    }


def test_receipt_sums_exactly_in_integer_cents_and_persists() -> None:
    with TestClient(app) as client:
        quote = client.post("/quote/tenant", json={
            "address": "1100 Queen St W",
            "answers": {"contentsValue": 25_000, "unitLevel": "upper", "claims3yr": 1,
                        "deductible": 500, "liability": 2_000_000},
        }).json()
        cents = round(quote["receipt"]["base"] * 100)
        cents += sum(round(line["dollars"] * 100) for line in quote["receipt"]["lines"])
        assert cents == round(quote["annual"] * 100)
        stored = client.get(quote["underwriterUrl"])
        assert stored.status_code == 200
        assert stored.json()["caseId"] == quote["caseId"]
        assert stored.json()["receipt"]["annual"] == quote["annual"]


def test_basement_in_study_area_refers_but_upper_approves() -> None:
    with TestClient(app) as client:
        basement = client.post("/quote/tenant", json=_request("basement")).json()
        upper = client.post("/quote/tenant", json=_request("upper")).json()
        covered = client.post("/quote/tenant", json=_request("basement", sewer_backup=True)).json()
        assert basement["decision"]["kind"] == "refer"
        assert upper["decision"]["kind"] == "approve"
        assert covered["decision"]["kind"] == "approve"


def test_two_claims_in_five_years_refers() -> None:
    with TestClient(app) as client:
        payload = _request("upper")
        payload["answers"]["claims5yr"] = 2
        assert client.post("/quote/tenant", json=payload).json()["decision"]["kind"] == "refer"


def test_map_returns_closed_server_side_polygons() -> None:
    with TestClient(app) as client:
        response = client.get("/map/toronto?lat=43.6503&lng=-79.3869&k=1")
        assert response.status_code == 200
        hexes = response.json()
        assert hexes and all(item["ring"][0] == item["ring"][-1] for item in hexes)
