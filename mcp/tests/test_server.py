"""Protocol-level tests for the Pixie MCP tools."""

import pytest
from mcp import Client

from pixie_mcp.server import mcp


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with Client(mcp, raise_exceptions=True) as connected:
        yield connected


@pytest.mark.anyio
async def test_tool_catalog_is_privacy_limited(client: Client) -> None:
    tools = await client.list_tools()
    names = {tool.name for tool in tools.tools}
    assert names == {
        "compare_vehicles",
        "estimate_home_quote",
        "estimate_auto_quote",
        "run_quote_scenario",
        "prepare_application",
        "get_policy_summary",
        "request_recovery_handoff",
        "get_recovery_status",
        "assess_drive_context",
    }
    assert "get_full_profile" not in names


@pytest.mark.anyio
async def test_auto_tool_returns_structured_auditable_estimate(client: Client) -> None:
    result = await client.call_tool("estimate_auto_quote", {"vehicle_id": "corolla-le-2023"})
    quote = result.structured_content
    assert quote is not None
    assert quote["quoteId"].startswith("AQ-")
    assert quote["demoOnly"] is True
    assert "Not an insurer quote" in quote["label"]
    assert all(line["source"] for line in quote["receipt"]["lines"])


@pytest.mark.anyio
async def test_home_tool_reuses_tenant_quote_contract(client: Client) -> None:
    result = await client.call_tool(
        "estimate_home_quote",
        {"address": "180 Queen St W", "contents_value": 30000, "unit_level": "upper"},
    )
    quote = result.structured_content
    assert quote is not None
    assert quote["caseId"].startswith("TQ-")
    assert quote["supportedProduct"] == "tenant"
    assert "No homeowner tariff" in quote["scopeNote"]


@pytest.mark.anyio
async def test_combined_scenario_and_explicit_demo_writes(client: Client) -> None:
    scenario_result = await client.call_tool(
        "run_quote_scenario",
        {
            "tenant": {"address": "180 Queen St W", "contents_value": 30000, "unit_level": "upper"},
            "auto": {"vehicle_id": "cx5-gs-2022"},
        },
    )
    scenario = scenario_result.structured_content
    assert scenario is not None and len(scenario["quotes"]) == 2

    draft_result = await client.call_tool(
        "prepare_application",
        {
            "quote_ids": [scenario["quotes"][0]["caseId"], scenario["quotes"][1]["quoteId"]],
            "contact_preference": "in_app",
            "consent_to_prepare": True,
            "confirm_demo_only": True,
        },
    )
    draft = draft_result.structured_content
    assert draft is not None and draft["submitted"] is False and draft["demoOnly"] is True


@pytest.mark.anyio
async def test_policy_and_recovery_tools_never_return_contact_values(client: Client) -> None:
    policy_result = await client.call_tool("get_policy_summary", {"policy_id": "auto-demo"})
    policy = policy_result.structured_content
    assert policy is not None and policy["privacy"]["fullProfileAvailable"] is False
    assert not ({"name", "address", "email", "phone", "VIN"} & policy.keys())

    handoff_result = await client.call_tool(
        "request_recovery_handoff",
        {
            "policy_id": "auto-demo",
            "incident_type": "collision",
            "contact_preference": "phone_on_file",
            "consent_to_contact": True,
            "confirm_demo_only": True,
        },
    )
    handoff = handoff_result.structured_content
    assert handoff is not None and handoff["sent"] is False
    status_result = await client.call_tool("get_recovery_status", {"recovery_id": handoff["recoveryId"]})
    assert status_result.structured_content == handoff


@pytest.mark.anyio
async def test_drive_context_tool_returns_no_coordinates_or_pricing_effect(client: Client) -> None:
    result = await client.call_tool(
        "assess_drive_context",
        {
            "points": [{"lat": 43.65, "lng": -79.39}, {"lat": 43.7, "lng": -79.4}],
            "distance_km": 8,
            "speeding_events": 1,
            "hard_brake_events": 0,
        },
    )
    context = result.structured_content
    assert context is not None
    assert context["affectsQuote"] is False and context["affectsPremium"] is False
    assert context["behaviorScore"] == 85
    assert context["routeContextScore"] == 81
    assert context["score"] == 84
    assert context["routeContext"]["types"] == ["school_approach", "lower_complexity_corridor"]
    assert all(factor["source"] and factor["provenance"] for factor in context["routeFactors"])
    assert context["privacy"]["stored"] is False
    assert context["privacy"]["identityInputsUsed"] is False
    assert "lat" not in str(context) and "lng" not in str(context)
