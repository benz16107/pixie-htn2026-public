import { useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Panel, ChecklistItem } from "@/components/consumer";
import { Body, Button, Screen, Title } from "@/components/ui";
import {
  roadAPI,
  type RoadDevice,
  type RoadIncident,
  type EvidenceRole,
} from "@/lib/evidence";
import { readMedia } from "@/lib/evidence-device";
import { EvidenceMedia } from "./Media";
import { es } from "./styles";
export function UploadEvidence({
  incident,
  device,
  role,
  onDone,
  onCancel,
}: {
  incident: RoadIncident;
  device: RoadDevice;
  role: EvidenceRole;
  onDone: (value: RoadIncident) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [statement, setStatement] = useState("");
  const [time, setTime] = useState("");
  const [atScene, setAtScene] = useState(false);
  const [anonymous, setAnonymous] = useState(device.anonymous);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(camera: boolean) {
    setError("");
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      )
        throw new Error("Camera access is off. Choose a file instead.");
      if (
        !camera &&
        Platform.OS === "ios" &&
        !(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted
      )
        throw new Error("Allow photo library access to choose a clip.");
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: camera ? ["images"] : ["images", "videos"],
        quality: 0.8,
        allowsEditing: false,
      };
      const r = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!r.canceled) {
        if ((r.assets[0].fileSize ?? 0) > 12 * 1024 * 1024)
          throw new Error("Choose a file up to 12 MB.");
        setFile(r.assets[0]);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The file could not be opened.",
      );
    }
  }
  async function send() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const capture = time ? new Date(time.replace(" ", "T")) : null;
      if (capture && !Number.isFinite(capture.getTime()))
        throw new Error(
          "Use YYYY-MM-DD HH:mm for capture time, or leave it unknown.",
        );
      const content = await readMedia(file.uri);
      if (content.length > (12 * 1024 * 1024 * 4) / 3 + 4)
        throw new Error("Choose a file up to 12 MB.");
      const next = await roadAPI.upload(incident.id, {
        clientId: device.clientId,
        role,
        filename:
          file.fileName ?? (file.type === "video" ? "clip.mp4" : "photo.jpg"),
        mime:
          file.mimeType ?? (file.type === "video" ? "video/mp4" : "image/jpeg"),
        content,
        capturedAt: capture?.toISOString() ?? null,
        lat: atScene ? incident.lat : null,
        lng: atScene ? incident.lng : null,
        statement,
        anonymous,
        consent,
      });
      onDone(next);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Your file has not been marked as received.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      footer={
        <Button
          label={busy ? "Uploading file…" : "Share evidence for review"}
          disabled={!file || !consent || busy}
          onPress={send}
        />
      }
    >
      <Button
        kind="link"
        label="Back to incident"
        disabled={busy}
        onPress={onCancel}
      />
      <Title>Your perspective</Title>
      <Body style={es.lead}>
        {incident.address}. Share only the relevant moments. Check for personal
        information before uploading.
      </Body>
      <Panel>
        {file ? (
          <>
            <EvidenceMedia
              uri={file.uri}
              mime={
                file.mimeType ??
                (file.type === "video" ? "video/mp4" : "image/jpeg")
              }
              label="Selected evidence"
            />
            <Text style={es.note}>
              {file.fileName ?? "Selected file"} ·{" "}
              {file.fileSize
                ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB`
                : "Size checked on upload"}
            </Text>
          </>
        ) : null}
        <View style={es.row}>
          <Button
            kind="secondary"
            label="Choose photo or video"
            disabled={busy}
            onPress={() => pick(false)}
          />
          {Platform.OS !== "web" ? (
            <Button
              kind="secondary"
              label="Take scene photo"
              disabled={busy}
              onPress={() => pick(true)}
            />
          ) : null}
        </View>
        <Text style={es.note}>
          PNG, JPEG, WebP, MP4, MOV or WebM. Up to 12 MB.
        </Text>
        <Text style={es.label}>What does this show?</Text>
        <TextInput
          accessibilityLabel="Witness statement"
          multiline
          value={statement}
          onChangeText={setStatement}
          maxLength={3000}
          style={[es.input, { minHeight: 90 }]}
          placeholder="Describe your angle and what you observed."
        />
        <Text style={es.label}>Capture time, if known</Text>
        <TextInput
          accessibilityLabel="Evidence capture time"
          value={time}
          onChangeText={setTime}
          style={es.input}
          placeholder="YYYY-MM-DD HH:mm"
        />
        <Text style={es.note}>
          Leave blank if unknown. This is your declaration, not a verified
          device timestamp.
        </Text>
      </Panel>
      {incident.lat !== null ? (
        <ChecklistItem
          title="Captured at the incident location"
          detail="I confirm the scene coordinates shown on the report. This is not an automatic GPS check."
          checked={atScene}
          onPress={() => setAtScene(!atScene)}
        />
      ) : null}
      <ChecklistItem
        title="Hide my contributor label"
        detail="Shown as an anonymous contributor. File contents, filename and metadata are not redacted."
        checked={anonymous}
        onPress={() => setAnonymous(!anonymous)}
      />
      <ChecklistItem
        title="I can share this file"
        detail="I have permission to share this test material with the driver and the shared insurer workspace."
        checked={consent}
        onPress={() => setConsent(!consent)}
      />
      <Text style={es.note}>
        Pixie hashes the uploaded bytes and detects exact duplicates. An insurer
        reviews relevance. No automatic fault decision or premium change
        follows.
      </Text>
      {error ? (
        <Text role="alert" style={es.error}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
