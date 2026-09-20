export type EvidenceRole = "driver" | "bystander";
export type EvidenceStatus = "pending" | "accepted" | "rejected";
export type Evidence = {
  id: string;
  clientId: string;
  role: EvidenceRole;
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  submittedAt: string;
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  statement: string;
  anonymous: boolean;
  status: EvidenceStatus;
  reviewNote: string;
  credit: number;
  rewardAtSubmission: number;
  mediaPath: string;
  checks: {
    integrity: string;
    timeDifferenceSeconds: number | null;
    distanceMetres: number | null;
    metadataSource: string;
    authenticity: string;
    device: string;
  };
};
export type RoadIncident = {
  id: string;
  clientId: string;
  address: string;
  lat: number | null;
  lng: number | null;
  happenedAt: string;
  createdAt: string;
  kind: "Collision" | "Hit and run" | "Parked damage" | "Other";
  description: string;
  vehicle: string;
  reward: number;
  requestOpen: boolean;
  status: "open" | "reviewing" | "closed";
  evidence: Evidence[];
  events: { at: string; text: string }[];
  counts: { submitted: number; accepted: number; pending: number };
  disclaimer: string;
};
export function evidenceClient(base: string) {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}/consumer/incidents${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(body ? 60000 : 10000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "The evidence service could not complete this request. Check your connection and try again.",
      );
    }
    return response.json();
  }
  return {
    demo: (clientId: string, role: EvidenceRole) =>
      call<RoadIncident>("/demo", { clientId, role }),
    remove: (id: string, clientId: string) =>
      call<{ deleted: string }>(`/${id}/delete`, { clientId }),
    list: () => call<{ incidents: RoadIncident[] }>(""),
    get: (id: string) => call<RoadIncident>(`/${id}`),
    create: (body: unknown) => call<RoadIncident>("", body),
    upload: (id: string, body: unknown) =>
      call<RoadIncident>(`/${id}/evidence`, body),
    request: (id: string, body: unknown) =>
      call<RoadIncident>(`/${id}/request`, body),
    review: (
      id: string,
      evidence: string,
      status: EvidenceStatus,
      note: string,
    ) =>
      call<RoadIncident>(`/${id}/evidence/${evidence}/review`, {
        status,
        note,
      }),
    status: (id: string, status: RoadIncident["status"], note: string) =>
      call<RoadIncident>(`/${id}/status`, { status, note }),
    media: (item: Evidence) => `${base}${item.mediaPath}`,
    export: (id: string) => `${base}/consumer/incidents/${id}/export`,
  };
}
