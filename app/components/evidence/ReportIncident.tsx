import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Panel, ChecklistItem } from "@/components/consumer";
import { Body, Button, Screen, Title } from "@/components/ui";
import { roadAPI, type RoadDevice, type RoadIncident } from "@/lib/evidence";
import { useQuote } from "@/lib/store";
import { es } from "./styles";
import IncidentMap from "./IncidentMap";
const localTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
};
export function ReportIncident({
  device,
  onDone,
  onCancel,
}: {
  device: RoadDevice;
  onDone: (value: RoadIncident) => void;
  onCancel: () => void;
}) {
  const { autoListing } = useQuote();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState("");
  const [at, setAt] = useState(localTime);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [kind, setKind] = useState<RoadIncident["kind"]>("Collision");
  const [description, setDescription] = useState("");
  const [footage, setFootage] = useState(true);
  const [reward, setReward] = useState(2);
  const [safe, setSafe] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function locate() {
    setBusy(true);
    setError("");
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted)
        throw new Error(
          "Location access is off. Enter the incident address instead.",
        );
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(p.coords);
      if (place)
        setAddress(
          [place.streetNumber, place.street, place.city]
            .filter(Boolean)
            .join(" "),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enter the address instead.");
    } finally {
      setBusy(false);
    }
  }
  function next() {
    setError("");
    const time = new Date(at.replace(" ", "T"));
    if (
      !address.trim() ||
      !Number.isFinite(time.getTime()) ||
      time > new Date()
    ) {
      setError(
        "Enter a location and a valid incident time that is not in the future.",
      );
      return;
    }
    setStep(2);
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const value = await roadAPI.create({
        clientId: device.clientId,
        address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        happenedAt: new Date(at.replace(" ", "T")).toISOString(),
        kind,
        description,
        vehicle: `${autoListing.year} ${autoListing.make} ${autoListing.model}`,
        reward: footage ? 0 : reward,
        requestOpen: !footage,
        consent,
      });
      onDone(value);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The report was not shared. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      footer={
        <Button
          label={
            busy
              ? "Working…"
              : step === 1
                ? "Continue"
                : "Share incident with Pixie"
          }
          disabled={busy || (step === 2 && (!safe || !consent))}
          onPress={step === 1 ? next : create}
        />
      }
    >
      <Button
        kind="link"
        label={step === 1 ? "Cancel report" : "Back to location"}
        onPress={step === 1 ? onCancel : () => setStep(1)}
      />
      <Title>{step === 1 ? "Where and when?" : "What happened?"}</Title>
      <Body style={es.lead}>
        If anyone is hurt or in danger, call emergency services first. Record
        details only when you are safely stopped.
      </Body>
      {step === 1 ? (
        <Panel>
          <Text style={es.label}>Incident location</Text>
          <TextInput
            accessibilityLabel="Incident location"
            value={address}
            onChangeText={(v) => {
              setAddress(v);
              setCoords(null);
            }}
            placeholder="Street or intersection"
            style={es.input}
          />
          <Button
            kind="link"
            label="Use my current location"
            disabled={busy}
            onPress={locate}
          />
          <Button
            kind="link"
            label="Use Queen & Spadina example"
            onPress={() => {
              setAddress("Queen St W & Spadina Ave, Toronto");
              setCoords({ lat: 43.6488, lng: -79.3963 });
            }}
          />
          {coords ? (
            <>
              <IncidentMap
                {...coords}
                onPick={(lat, lng) => {
                  setCoords({ lat, lng });
                  setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                }}
              />
              {Platform.OS !== "web" ? (
                <Text style={es.note}>
                  Tap the map to correct the incident location.
                </Text>
              ) : null}
            </>
          ) : null}
          <Text style={es.label}>Local date and time</Text>
          <TextInput
            accessibilityLabel="Incident date and time"
            value={at}
            onChangeText={setAt}
            placeholder="YYYY-MM-DD HH:mm"
            style={es.input}
          />
          <Text style={es.note}>
            Use the time of the incident, not the upload time. Coordinates stay
            unknown if you only type an address.
          </Text>
        </Panel>
      ) : (
        <>
          <Panel>
            <Text style={es.label}>Incident type</Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Incident type"
              style={es.row}
            >
              {(
                ["Collision", "Hit and run", "Parked damage", "Other"] as const
              ).map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="radio"
                  aria-checked={v === kind}
                  accessibilityState={{ checked: v === kind }}
                  onPress={() => setKind(v)}
                  style={[es.option, v === kind && es.on]}
                >
                  <Text style={es.optionText}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={es.label}>In your own words</Text>
            <TextInput
              accessibilityLabel="Incident description"
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={3000}
              style={[es.input, { minHeight: 100 }]}
              placeholder="What you saw. Leave uncertain details out."
            />
            <Text style={es.note}>
              Vehicle from your Auto profile: {autoListing.make}{" "}
              {autoListing.model}.
            </Text>
          </Panel>
          <Panel>
            <Text style={es.heading}>Do you have footage?</Text>
            <View style={es.row}>
              {[true, false].map((v) => (
                <Pressable
                  key={String(v)}
                  accessibilityRole="radio"
                  aria-checked={footage === v}
                  accessibilityState={{ checked: footage === v }}
                  style={[es.option, footage === v && es.on]}
                  onPress={() => setFootage(v)}
                >
                  <Text style={es.optionText}>
                    {v ? "I have a photo or clip" : "Ask nearby witnesses"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!footage ? (
              <>
                <Text style={es.label}>
                  Demo credit per accepted contribution
                </Text>
                <View style={es.row}>
                  {[1, 2, 5].map((v) => (
                    <Pressable
                      key={v}
                      accessibilityRole="radio"
                      accessibilityLabel={`${v} dollar demo credit`}
                      aria-checked={reward === v}
                      accessibilityState={{ checked: reward === v }}
                      style={[es.option, reward === v && es.on]}
                      onPress={() => setReward(v)}
                    >
                      <Text style={es.optionText}>${v}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={es.note}>
                  Appears in the in-app witness feed. No push message is sent,
                  and no card or claim is charged.
                </Text>
              </>
            ) : (
              <Text style={es.note}>
                Attach your file after creating the incident. You can also
                request witness footage later.
              </Text>
            )}
          </Panel>
          <ChecklistItem
            title="I am safely stopped"
            detail="I can record this without putting anyone at risk."
            checked={safe}
            onPress={() => setSafe(!safe)}
          />
          <ChecklistItem
            title="Share this demo incident"
            detail="The location, description and files will be visible in the shared Pixie prototype, including its insurer desk. Use test material only."
            checked={consent}
            onPress={() => setConsent(!consent)}
          />
        </>
      )}
      {error ? (
        <Text role="alert" style={es.error}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
