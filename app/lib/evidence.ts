import { evidenceClient } from "../../shared/evidence";
export type {
  RoadIncident,
  Evidence,
  EvidenceRole,
} from "../../shared/evidence";
export const roadAPI = evidenceClient(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
);
export type RoadDevice = {
  clientId: string;
  anonymous: boolean;
  alerts: boolean;
  dismissed: string[];
  creditAllocation: "split" | "home" | "auto";
};
export const newRoadDevice = (): RoadDevice => ({
  clientId: `device-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  anonymous: true,
  alerts: true,
  dismissed: [],
  creditAllocation: "split",
});
export function parseDevice(raw: string | null): RoadDevice {
  if (!raw) return newRoadDevice();
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value.clientId !== "string" ||
    !Array.isArray(value.dismissed) ||
    typeof value.anonymous !== "boolean" ||
    typeof value.alerts !== "boolean"
  )
    throw new Error("Your local profile could not be opened.");
  return { ...value, creditAllocation: ["home", "auto", "split"].includes(value.creditAllocation) ? value.creditAllocation : "split" };
}
