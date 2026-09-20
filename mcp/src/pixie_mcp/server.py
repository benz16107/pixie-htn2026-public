"""MCP 2.x adapter over Pixie's deterministic consumer insurance services."""

from __future__ import annotations

import argparse
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel, Field

from atlas_api.consumer import (
    compare_vehicles as compare_vehicle_estimates,
    estimate_auto_quote as compute_auto_quote,
    estimate_home_quote as compute_home_quote,
    get_policy_summary as read_policy_summary,
    get_recovery_status as read_recovery_status,
    prepare_application as build_application_draft,
    request_recovery_handoff as build_recovery_handoff,
    run_quote_scenario as compute_quote_scenario,
)
from atlas_api.driving import assess_drive_context as compute_drive_context


class CoarseRoutePoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class TenantScenario(BaseModel):
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    contents_value: int = Field(ge=10_000, le=250_000, multiple_of=1000)
    unit_level: Literal["basement", "ground", "upper"]
    claims_5yr: int = Field(default=0, ge=0)
    deductible: Literal[500, 1000, 2500] = 1000
    liability: Literal[1_000_000, 2_000_000] = 1_000_000
    sewer_backup: bool = False
    bundle_auto: bool = False


class AutoScenario(BaseModel):
    vehicle_id: str
    annual_km_band: Literal["under_10000", "10000_20000", "over_20000"] = "10000_20000"
    parking: Literal["garage", "driveway", "street"] = "driveway"
    deductible: Literal[500, 1000, 2000] = 1000
    claims_5yr: int = Field(default=0, ge=0)


mcp = MCPServer(
    "Pixie consumer insurance demo",
    version="0.1.0",
    instructions=(
        "Use these tools only for transparent, illustrative tenant and Auto estimates. "
        "Home currently means renter or tenant insurance; no homeowner tariff exists. "
        "Never describe a result as a carrier quote. Policy tools intentionally omit identity, address, contact values, "
        "driver licence, and VIN. Draft and recovery tools do not submit or send anything. "
        "Driving context is coaching only, retains no coordinates, and never affects pricing."
    ),
)


@mcp.tool(structured_output=True)
def compare_vehicles(
    vehicle_ids: list[str] | None = None,
    annual_km_band: Literal["under_10000", "10000_20000", "over_20000"] = "10000_20000",
    parking: Literal["garage", "driveway", "street"] = "driveway",
    deductible: Literal[500, 1000, 2000] = 1000,
    claims_5yr: int = 0,
) -> dict[str, Any]:
    """Compare bundled demo car listings under one deterministic, illustrative insurance scenario."""
    return compare_vehicle_estimates(
        vehicle_ids=vehicle_ids,
        annual_km_band=annual_km_band,
        parking=parking,
        deductible=deductible,
        claims_5yr=claims_5yr,
    )


@mcp.tool(structured_output=True)
def estimate_home_quote(
    address: str | None,
    contents_value: int,
    unit_level: Literal["basement", "ground", "upper"],
    claims_5yr: int = 0,
    deductible: Literal[500, 1000, 2500] = 1000,
    liability: Literal[1_000_000, 2_000_000] = 1_000_000,
    sewer_backup: bool = False,
    bundle_auto: bool = False,
    lat: float | None = None,
    lng: float | None = None,
    home_product: Literal["tenant"] = "tenant",
) -> dict[str, Any]:
    """Estimate renter or tenant coverage through Pixie's existing tenant engine. No homeowner tariff is available."""
    return compute_home_quote(
        home_product=home_product,
        address=address,
        lat=lat,
        lng=lng,
        contents_value=contents_value,
        unit_level=unit_level,
        claims_5yr=claims_5yr,
        deductible=deductible,
        liability=liability,
        sewer_backup=sewer_backup,
        bundle_auto=bundle_auto,
    )


@mcp.tool(structured_output=True)
def estimate_auto_quote(
    vehicle_id: str,
    annual_km_band: Literal["under_10000", "10000_20000", "over_20000"] = "10000_20000",
    parking: Literal["garage", "driveway", "street"] = "driveway",
    deductible: Literal[500, 1000, 2000] = 1000,
    claims_5yr: int = 0,
) -> dict[str, Any]:
    """Return a deterministic Auto estimate from bundled demo tables, with a source on every receipt line."""
    return compute_auto_quote(
        vehicle_id=vehicle_id,
        annual_km_band=annual_km_band,
        parking=parking,
        deductible=deductible,
        claims_5yr=claims_5yr,
    )


@mcp.tool(structured_output=True)
def run_quote_scenario(tenant: TenantScenario | None = None, auto: AutoScenario | None = None) -> dict[str, Any]:
    """Run tenant, Auto, or combined demo scenarios and add only the independently computed totals."""
    return compute_quote_scenario(
        tenant=tenant.model_dump() if tenant is not None else None,
        auto=auto.model_dump() if auto is not None else None,
    )


@mcp.tool(structured_output=True)
def prepare_application(
    quote_ids: list[str],
    contact_preference: Literal["email_on_file", "phone_on_file", "in_app"],
    consent_to_prepare: bool,
    confirm_demo_only: bool,
) -> dict[str, Any]:
    """Prepare an advisor-ready demo draft after explicit consent. It never submits to an insurer."""
    return build_application_draft(
        quote_ids=quote_ids,
        contact_preference=contact_preference,
        consent_to_prepare=consent_to_prepare,
        confirm_demo_only=confirm_demo_only,
    )


@mcp.tool(structured_output=True)
def get_policy_summary(policy_id: Literal["tenant-demo", "auto-demo"]) -> dict[str, Any]:
    """Read a limited synthetic policy summary. Identity, address, contacts, licence, and VIN are omitted."""
    return read_policy_summary(policy_id)


@mcp.tool(structured_output=True)
def request_recovery_handoff(
    policy_id: Literal["tenant-demo", "auto-demo"],
    incident_type: Literal["collision", "water", "theft", "other"],
    contact_preference: Literal["email_on_file", "phone_on_file", "in_app"],
    consent_to_contact: bool,
    confirm_demo_only: bool,
) -> dict[str, Any]:
    """Prepare an unsent, in-memory demo recovery handoff after explicit consent."""
    return build_recovery_handoff(
        policy_id=policy_id,
        incident_type=incident_type,
        contact_preference=contact_preference,
        consent_to_contact=consent_to_contact,
        confirm_demo_only=confirm_demo_only,
    )


@mcp.tool(structured_output=True)
def get_recovery_status(recovery_id: str) -> dict[str, Any]:
    """Read the status of an opaque demo recovery handoff id."""
    return read_recovery_status(recovery_id)


@mcp.tool(structured_output=True)
def assess_drive_context(
    points: list[CoarseRoutePoint],
    distance_km: float,
    speeding_events: int = 0,
    hard_brake_events: int = 0,
) -> dict[str, Any]:
    """Return stateless coaching from coarse points and aggregate events; never affect insurance pricing."""
    return compute_drive_context(
        points=[(point.lat, point.lng) for point in points],
        distance_km=distance_km,
        speeding_events=speeding_events,
        hard_brake_events=hard_brake_events,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Pixie consumer-insurance MCP server")
    parser.add_argument("--transport", choices=("stdio", "streamable-http"), default="stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()
    if args.transport == "streamable-http":
        mcp.run(transport="streamable-http", host=args.host, port=args.port, json_response=True)
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
