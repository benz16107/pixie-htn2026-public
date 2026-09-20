import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import {
  ChecklistItem,
  Panel,
  SectionLabel,
} from "@/components/consumer";
import { Body, Button, Kicker, Screen, Title } from "@/components/ui";
import {
  roadAPI,
  type EvidenceRole,
  type RoadIncident,
} from "@/lib/evidence";
import { useCommunity } from "@/lib/community-store";
import { WitnessSavingsCard } from "@/components/WitnessSavingsCard";
import { ReportIncident } from "@/components/evidence/ReportIncident";
import { UploadEvidence } from "@/components/evidence/UploadEvidence";
import { EvidenceMedia } from "@/components/evidence/Media";
import IncidentMap from "@/components/evidence/IncidentMap";
import { es } from "@/components/evidence/styles";
import { C } from "@/lib/theme";

export default function RoadHelp() {
  const params = useLocalSearchParams<{ role?: string; incident?: string }>();
  const [role, setRole] = useState<EvidenceRole>(
    params.role === "bystander" ? "bystander" : "driver",
  );
  const [tab, setTab] = useState<"home" | "reports" | "profile">("home");
  const { device, reports, setReports, loaded, loadError, deviceError, refresh, settings: saveSettings } = useCommunity();
  const [selected, setSelected] = useState<string | null>(
    params.incident ?? null,
  );
  const [mode, setMode] = useState<"browse" | "report" | "upload">("browse");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const update = (value: RoadIncident) => {
    setReports((old) => [value, ...old.filter((x) => x.id !== value.id)]);
    setSelected(value.id);
    setMode("browse");
    setError("");
  };
  const settings = async (patch: Parameters<typeof saveSettings>[0]) => {
    try { await saveSettings(patch); }
    catch { setError("The preference could not be saved on this device."); }
  };
  async function demo() {
    if (!device) return;
    setBusy(true);
    setError("");
    try {
      update(await roadAPI.demo(device.clientId, role));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load example.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!incident || !device) return;
    setBusy(true);
    setError("");
    try {
      await roadAPI.remove(incident.id, device.clientId);
      setReports((old) => old.filter((r) => r.id !== incident.id));
      setSelected(null);
      setConfirmDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete incident.");
    } finally {
      setBusy(false);
    }
  }
  const incident = reports.find((r) => r.id === selected);
  const myReports = reports.filter(
    (r) =>
      r.clientId === device?.clientId ||
      r.evidence.some((e) => e.clientId === device?.clientId),
  );
  const credits = reports
    .flatMap((r) => r.evidence)
    .filter((e) => e.clientId === device?.clientId && e.credit > 0);
  const metres = (r: RoadIncident) =>
    near && r.lat !== null && r.lng !== null
      ? Math.round(
          Math.hypot(
            (r.lat - near.lat) * 111200,
            (r.lng - near.lng) * 111200 * Math.cos((near.lat * Math.PI) / 180),
          ),
        )
      : null;
  const requests = reports
    .filter(
      (r) =>
        r.requestOpen &&
        r.status !== "closed" &&
        !device?.dismissed.includes(r.id) &&
        (!near || (metres(r) !== null && metres(r)! <= 5000)),
    )
    .sort((a, b) => (metres(a) ?? 0) - (metres(b) ?? 0));
  async function nearby() {
    setBusy(true);
    setError("");
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted)
        throw new Error(
          "Location access is off. You can still browse all requests.",
        );
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setNear({ lat: p.coords.latitude, lng: p.coords.longitude });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not find nearby requests.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleRequest(reward: number) {
    if (!device || !incident) return;
    setBusy(true);
    setError("");
    try {
      update(
        await roadAPI.request(incident.id, {
          clientId: device.clientId,
          requestOpen: !incident.requestOpen,
          reward,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request not saved.");
    } finally {
      setBusy(false);
    }
  }
  if (mode === "report" && device)
    return (
      <ReportIncident
        device={device}
        onDone={update}
        onCancel={() => setMode("browse")}
      />
    );
  if (mode === "upload" && incident && device)
    return (
      <UploadEvidence
        incident={incident}
        device={device}
        role={incident.clientId === device.clientId ? "driver" : "bystander"}
        onDone={update}
        onCancel={() => setMode("browse")}
      />
    );
  const messages = (
    <>
      {deviceError ? <Text role="alert" style={es.error}>{deviceError}</Text> : null}
      {error ? (
        <Text role="alert" style={es.error}>
          {error}
        </Text>
      ) : null}
      {loadError ? (
        <>
          <Text role="alert" style={es.error}>
            {loadError}
          </Text>
          <Button kind="link" label="Retry connection" onPress={refresh} />
        </>
      ) : null}
    </>
  );
  if (selected)
    return (
      <Screen>
        <Button
          kind="link"
          label="Back to incident exchange"
          onPress={() => {
            setSelected(null);
            setError("");
            setConfirmDelete(false);
          }}
        />
        {messages}
        {!incident ? (
          <Body>
            {loaded
              ? "This incident is unavailable. Return to your reports or retry."
              : "Loading incident…"}
          </Body>
        ) : (
          <>
            <Kicker>{incident.id}</Kicker>
            <Title>{incident.address}</Title>
            <Body style={es.lead}>
              {incident.kind} · {new Date(incident.happenedAt).toLocaleString()}
            </Body>
            <Panel>
              <Text style={es.status}>
                {incident.status} · {incident.counts.submitted} perspectives
              </Text>
              <Text style={es.heading}>
                {incident.counts.accepted} accepted for review
              </Text>
              <Text style={es.note}>
                {incident.counts.pending} waiting for review. Acceptance does
                not establish fault or authenticity.
              </Text>
              {incident.description ? (
                <Body>{incident.description}</Body>
              ) : null}
              {incident.lat !== null && incident.lng !== null ? (
                <IncidentMap lat={incident.lat} lng={incident.lng} />
              ) : (
                <Text style={es.note}>Scene coordinates are unknown.</Text>
              )}
              <Text style={es.note}>
                {incident.vehicle || "Vehicle not recorded"}
              </Text>
            </Panel>
            {incident.status !== "closed" ? (
              <>
                <Button
                  label={
                    incident.clientId === device?.clientId
                      ? "Add my photo or clip"
                      : "Contribute a perspective"
                  }
                  disabled={
                    !device || (incident.clientId !== device?.clientId && !incident.requestOpen)
                  }
                  onPress={() => setMode("upload")}
                />
                {role === "driver" && incident.clientId === device?.clientId ? (
                  <Panel>
                    <Text style={es.heading}>
                      {incident.requestOpen
                        ? "Witness request is open"
                        : "Need another perspective?"}
                    </Text>
                    <Text style={es.note}>
                      Requests appear in Pixie's in-app feed. Accepted contributions earn simulated insurance credit.
                      There is no cash value or real policy discount.
                    </Text>
                    {incident.requestOpen ? (
                      <Button
                        kind="secondary"
                        label="Pause footage request"
                        disabled={busy}
                        onPress={() => toggleRequest(incident.reward)}
                      />
                    ) : (
                      <View style={es.row}>
                        {[1, 2, 5].map((reward) => (
                          <Button
                            key={reward}
                            kind="secondary"
                            label={`Offer $${reward} demo credit`}
                            disabled={busy}
                            onPress={() => toggleRequest(reward)}
                          />
                        ))}
                      </View>
                    )}
                  </Panel>
                ) : (
                  <Text style={es.note}>
                    {incident.requestOpen
                      ? `$${incident.reward} simulated insurance credit per accepted contribution. Your own incident cannot earn a credit.`
                      : "This request is paused."}
                  </Text>
                )}
              </>
            ) : (
              <Body style={es.lead}>
                This incident is closed for new evidence.
              </Body>
            )}
            <SectionLabel>Evidence record</SectionLabel>
            {incident.evidence.length === 0 ? (
              <Panel>
                <Text style={es.note}>
                  No footage yet. Add your own file or ask witnesses to
                  contribute.
                </Text>
              </Panel>
            ) : (
              incident.evidence.map((item) => (
                <Panel key={item.id}>
                  <Text style={es.status}>
                    {item.role} · {item.status}
                  </Text>
                  <EvidenceMedia
                    uri={roadAPI.media(item)}
                    mime={item.mime}
                    label={item.filename}
                  />
                  <Text style={es.label}>
                    {item.anonymous
                      ? "Anonymous contributor"
                      : `${item.role === "driver" ? "Driver" : "Witness"} contribution`}
                  </Text>
                  <Text style={es.note}>
                    {item.filename} · {(item.bytes / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  {item.statement ? <Body>{item.statement}</Body> : null}
                  <Text style={es.hash}>SHA-256 {item.sha256}</Text>
                  <Text style={es.note}>
                    Capture time{" "}
                    {item.capturedAt
                      ? new Date(item.capturedAt).toLocaleString()
                      : "unknown"}
                    .{" "}
                    {item.checks.distanceMetres === null
                      ? "Location unknown."
                      : `${item.checks.distanceMetres} m from the reported scene.`}{" "}
                    Metadata is contributor-declared; device and authenticity
                    are not verified.
                  </Text>
                  {item.reviewNote ? (
                    <Text style={es.note}>Reviewer: {item.reviewNote}</Text>
                  ) : null}
                  {item.credit > 0 ? (
                    <Text style={es.status}>
                      ${item.credit} demo credit recorded
                    </Text>
                  ) : null}
                </Panel>
              ))
            )}
            <SectionLabel>Activity</SectionLabel>
            {incident.events
              .slice()
              .reverse()
              .map((event, i) => (
                <View style={es.rule} key={`${event.at}-${i}`}>
                  <Text style={es.note}>
                    {new Date(event.at).toLocaleString()}
                  </Text>
                  <Body>{event.text}</Body>
                </View>
              ))}
            <View style={{ marginTop: 24, gap: 8 }}>
              <Button
                kind="secondary"
                label="Export evidence package"
                onPress={() =>
                  WebBrowser.openBrowserAsync(
                    roadAPI.export(incident.id),
                  ).catch(() => setError("Could not open the evidence export."))
                }
              />
              {incident.clientId === device?.clientId ? (
              <Button
                kind="secondary"
                label="Use this in my recovery plan"
                onPress={() =>
                  router.push({
                    pathname: "/recovery-plan",
                    params: { product: "auto", roadIncident: incident.id },
                  })
                }
              />
              ) : null}
            </View>
            {incident.clientId === device?.clientId ? (
              <View style={{ marginTop: 16 }}>
                {confirmDelete ? (
                  <>
                    <Text style={es.error}>
                      Delete this incident and every attached file from the
                      shared workspace? This cannot be undone.
                    </Text>
                    <Button
                      kind="secondary"
                      label="Confirm deletion"
                      disabled={busy}
                      onPress={remove}
                    />
                    <Button
                      kind="link"
                      label="Keep incident"
                      onPress={() => setConfirmDelete(false)}
                    />
                  </>
                ) : (
                  <Button
                    kind="link"
                    label="Delete this demo incident"
                    onPress={() => setConfirmDelete(true)}
                  />
                )}
              </View>
            ) : null}
            <Text style={es.note}>
              Shared demo workspace. Fault, coverage and payments remain
              decisions for the insurer. The package includes the files and
              their hash manifest.
            </Text>
          </>
        )}
      </Screen>
    );
  return (
    <Screen>
      <Title>Incident exchange</Title>
      <Body style={es.lead}>One incident. Every perspective together.</Body>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Your role"
        style={es.tabs}
      >
        {(["driver", "bystander"] as const).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="radio"
            aria-checked={role === v}
            accessibilityState={{ checked: role === v }}
            onPress={() => {
              setRole(v);
              setTab("home");
              setError("");
            }}
            style={[
              es.option,
              { flex: 1, alignItems: "center" },
              role === v && es.on,
            ]}
          >
            <Text style={es.optionText}>
              {v === "driver" ? "Driver" : "Bystander"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={es.tabs}>
        {(["home", "reports", "profile"] as const).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === v }}
            aria-selected={tab === v}
            onPress={() => setTab(v)}
            style={[es.option, tab === v && es.on]}
          >
            <Text style={es.optionText}>
              {v === "home"
                ? "Overview"
                : v === "reports"
                  ? "My reports"
                  : "Profile"}
            </Text>
          </Pressable>
        ))}
      </View>
      {messages}
      {tab === "profile" || (tab === "home" && role === "bystander") ? <WitnessSavingsCard configure /> : null}
      {tab === "profile" ? (
        <>
          <Panel>
            <Kicker>Accepted contributions</Kicker>
            <Text style={es.note}>
              Accepted witness contributions fund your savings preview.
              No payment method or insurer account is connected.
            </Text>
            {credits.map((e) => (
              <View key={e.id} style={es.rule}>
                <Text style={es.note}>
                  {e.filename} · accepted contribution
                </Text>
                <Text style={es.heading}>+${e.credit.toFixed(2)}</Text>
              </View>
            ))}
          </Panel>
          <ChecklistItem
            title="Show witness requests"
            detail="Display requests in this app. This does not enable background location or push notifications."
            checked={device?.alerts ?? true}
            onPress={() => settings({ alerts: !device?.alerts })}
          />
          <ChecklistItem
            title="Hide my contributor label by default"
            detail="File contents and metadata remain visible to reviewers."
            checked={device?.anonymous ?? true}
            onPress={() => settings({ anonymous: !device?.anonymous })}
          />
          <Button
            kind="link"
            label="Restore dismissed requests"
            onPress={() => settings({ dismissed: [] })}
          />
          <Text style={es.note}>
            This local profile is for demo continuity, not a verified identity.
            Your driving score and quoted premium stay unchanged.
            Accepted witness credit can reduce a simulated next payment.
          </Text>
        </>
      ) : (
        <>
          {tab === "home" && role === "driver" ? (
            <Panel>
              <Text style={es.heading}>Were you in an incident?</Text>
              <Body style={es.lead}>
                Record the place and time, add your footage, or ask witnesses
                for another angle.
              </Body>
              <Button
                label="I was in an incident"
                disabled={!device}
                onPress={() => setMode("report")}
              />
            </Panel>
          ) : null}
          {tab === "home" && role === "bystander" ? (
            <>
              <Text style={es.heading}>Did you capture something?</Text>
              <Text style={es.note}>
                Contribute only when safely stopped.{" "}
                {near
                  ? "Showing reports within 5 km of your current location."
                  : "Showing all open requests. Location is not being tracked."}
              </Text>
              <Button
                kind="link"
                label={near ? "Show all requests" : "Find requests near me"}
                disabled={busy}
                onPress={near ? () => setNear(null) : nearby}
              />
              {!device?.alerts ? (
                <Panel>
                  <Body>Witness requests are paused in your profile.</Body>
                  <Button
                    kind="link"
                    label="Show requests again"
                    onPress={() => settings({ alerts: true })}
                  />
                </Panel>
              ) : null}
            </>
          ) : null}
          <SectionLabel>
            {tab === "home" && role === "bystander"
              ? "Footage requests"
              : "Your reports and contributions"}
          </SectionLabel>
          {!loaded ? (
            <View
              accessibilityLabel="Loading evidence records"
              style={{ height: 130, backgroundColor: C.land, borderRadius: 14 }}
            />
          ) : (
            (tab === "home" && role === "bystander"
              ? device?.alerts
                ? requests
                : []
              : myReports
            ).map((report) => (
              <Panel key={report.id}>
                <Text style={es.status}>
                  {report.status} · {report.counts.submitted} perspectives
                </Text>
                <Text style={es.heading}>{report.address}</Text>
                <Text style={es.note}>
                  {new Date(report.happenedAt).toLocaleString()} · {report.kind}
                  {metres(report) !== null ? ` · ${metres(report)} m away` : ""}
                </Text>
                {role === "bystander" && report.requestOpen ? (
                  <Text style={es.note}>
                    ${report.reward} simulated insurance credit per accepted contribution
                  </Text>
                ) : null}
                <Button
                  kind="secondary"
                  label={`Open ${report.id}`}
                  onPress={() => setSelected(report.id)}
                />
                {role === "bystander" && tab === "home" ? (
                  <Button
                    kind="link"
                    label="I wasn't there"
                    onPress={() =>
                      device &&
                      settings({ dismissed: [...device.dismissed, report.id] })
                    }
                  />
                ) : null}
              </Panel>
            ))
          )}
          {loaded &&
          (tab === "home" && role === "bystander"
            ? requests.length === 0
            : myReports.length === 0) ? (
            <Panel>
              <Body>
                {role === "bystander" && tab === "home"
                  ? "No open requests here yet. A driver can create an incident and ask for footage."
                  : "Your reports and contributions will appear here."}
              </Body>
            </Panel>
          ) : null}
        </>
      )}
      <Text style={es.note}>
        Shared prototype workspace. Use demo footage only. Files are shared
        after you confirm. Pixie does not contact emergency services or submit
        an insurance claim.
      </Text>
      <Button
        kind="link"
        label="Try an illustrated example"
        disabled={!device || busy}
        onPress={demo}
      />
      <Button kind="link" label="Refresh reports" onPress={refresh} />
    </Screen>
  );
}
