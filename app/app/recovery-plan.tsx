import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { roadAPI } from '@/lib/evidence';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChecklistItem, Panel } from '@/components/consumer';
import { Body, Button, Choice, Dim, Kicker, Screen, Title } from '@/components/ui';
import type { ConsumerProduct } from '@/lib/consumer';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

type RecoveryConfig = {
  kicker: string;
  incidents: Array<{ id: string; title: string; detail: string }>;
  safety: Array<{ id: string; title: string; detail: string }>;
  evidence: Array<{ id: string; title: string; detail: string }>;
  actions: string[];
};

const CONFIG: Record<ConsumerProduct, RecoveryConfig> = {
  home: {
    kicker: 'Home recovery',
    incidents: [
      { id: 'water', title: 'Water damage', detail: 'A leak, backup, burst pipe, or appliance escape.' },
      { id: 'fire', title: 'Fire or smoke', detail: 'Fire, smoke, soot, or emergency response damage.' },
      { id: 'theft', title: 'Theft or break-in', detail: 'Missing property or forced entry.' },
      { id: 'weather', title: 'Weather damage', detail: 'Wind, hail, falling objects, or storm water.' },
    ],
    safety: [
      { id: 'people', title: 'Everyone is safe', detail: 'Or emergency help is already on the way.' },
      { id: 'source', title: 'The source is stopped if safe', detail: 'Water, power, or access is controlled without entering danger.' },
      { id: 'temporary', title: 'Further damage is limited', detail: 'Only safe, temporary steps have been taken.' },
    ],
    evidence: [
      { id: 'wide', title: 'Whole-room views', detail: 'Show the affected area before moving items.' },
      { id: 'damage', title: 'Close-up damage', detail: 'Capture damaged finishes, belongings, and the likely source.' },
      { id: 'items', title: 'Affected items list', detail: 'Record each item, approximate age, and replacement information.' },
      { id: 'receipts', title: 'Emergency receipts', detail: 'Keep invoices for cleanup, lodging, or urgent repairs.' },
    ],
    actions: [
      'Keep the area safe and prevent further damage only when it is safe to do so.',
      'Keep damaged items until an insurer or advisor says they can be discarded.',
      'Use this plan when you contact your insurer or advisor, then record the claim number they provide.',
    ],
  },
  auto: {
    kicker: 'Auto recovery',
    incidents: [
      { id: 'collision', title: 'Collision', detail: 'Your vehicle contacted another vehicle, person, or object.' },
      { id: 'glass', title: 'Glass damage', detail: 'A cracked windshield or damaged vehicle glass.' },
      { id: 'theft', title: 'Theft', detail: 'The vehicle or something inside it is missing.' },
      { id: 'vandalism', title: 'Vandalism', detail: 'Intentional exterior or interior damage.' },
    ],
    safety: [
      { id: 'people', title: 'Everyone is safe', detail: 'Or emergency help is already on the way.' },
      { id: 'traffic', title: 'Traffic risk is controlled', detail: 'Move to a safe place when possible and do not stand in live traffic.' },
      { id: 'vehicle', title: 'The vehicle is secure', detail: 'Turn it off and do not drive it when fluids, wheels, lights, or airbags make that unsafe.' },
    ],
    evidence: [
      { id: 'scene', title: 'Whole-scene views', detail: 'Show lanes, signs, weather, and vehicle positions from a safe place.' },
      { id: 'damage', title: 'Each vehicle and damage area', detail: 'Take wide and close views without entering traffic.' },
      { id: 'details', title: 'Driver and vehicle details', detail: 'Record names, contact details, plates, and insurance information.' },
      { id: 'tow', title: 'Police or tow details', detail: 'Keep the report number, tow company, location, and receipts.' },
    ],
    actions: [
      'Do not drive the vehicle if damage could make it unsafe.',
      'Keep original photos, exchange details, report numbers, and towing receipts together.',
      'Use this plan when you contact your insurer or advisor, then record the claim number they provide.',
    ],
  },
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

function planHtml({
  reference,
  product,
  incident,
  evidence,
  notes,
  actions,
}: {
  reference: string;
  product: ConsumerProduct;
  incident: string;
  evidence: string[];
  notes: string;
  actions: string[];
}) {
  const list = (items: string[]) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#17343A;padding:28px;line-height:1.45}h1{font-size:26px;margin:8px 0}h2{font-size:16px;margin-top:24px}p,li{font-size:14px}.ref{font-family:Menlo,monospace;font-size:12px;color:#586E73}.note{padding:12px;background:#F4F7F6;border:1px solid #C1D0D2}
  </style></head><body><div class="ref">${escapeHtml(reference)} · ${product.toUpperCase()}</div><h1>Pixie recovery plan</h1><p><b>Incident:</b> ${escapeHtml(incident)}</p><h2>Recorded information</h2><ul>${list(evidence)}</ul><h2>Next actions</h2><ol>${list(actions)}</ol>${notes ? `<h2>Notes</h2><p class="note">${escapeHtml(notes)}</p>` : ''}<p>This plan organizes information you reviewed. It does not submit a claim or confirm coverage.</p></body></html>`;
}

export default function RecoveryPlanScreen() {
  const params = useLocalSearchParams<{ product?: string; roadIncident?: string }>();
  const { product: selectedProduct } = useQuote();
  const product: ConsumerProduct = params.product === 'auto' || params.product === 'home' ? params.product : selectedProduct;
  const config = CONFIG[product];
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [incidentId, setIncidentId] = useState('');
  const [safety, setSafety] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [linkedRecord, setLinkedRecord] = useState('');
  useEffect(() => {
    if (!params.roadIncident) return;
    let active = true;
    roadAPI.get(params.roadIncident).then(record => {
      if (!active) return;
      setLinkedRecord(record.id);
      setNotes(`Evidence record ${record.id}\n${record.kind} at ${record.address}\n${new Date(record.happenedAt).toLocaleString()}\n${record.description}\n${record.counts.submitted} submitted perspectives; ${record.counts.accepted} accepted for case review.\nThis summary is a snapshot. Review the shared evidence record for current status.`);
      setIncidentId('collision');
    }).catch(() => { if (active) setExportStatus('Could not load the linked incident. You can still prepare a plan manually.'); });
    return () => { active = false; };
  }, [params.roadIncident]);

  const toggle = (items: string[], setItems: (next: string[]) => void, id: string) =>
    setItems(items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const incident = config.incidents.find((item) => item.id === incidentId);
  const evidenceLabels = config.evidence.filter((item) => evidence.includes(item.id)).map((item) => item.title);

  const buildPlan = () => {
    setReference(`PX-${product === 'home' ? 'HOME' : 'AUTO'}-${Date.now().toString().slice(-6)}`);
    setExportStatus('');
    setStage(3);
  };

  const exportPlan = async () => {
    if (!incident) return;
    const html = planHtml({ reference, product, incident: incident.title, evidence: evidenceLabels, notes, actions: config.actions });
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reference.toLowerCase()}-recovery-plan.html`;
        link.click();
        URL.revokeObjectURL(url);
        setExportStatus('A printable recovery plan was downloaded to this device.');
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Pixie recovery plan' });
        setExportStatus('Your recovery plan is ready to save or share.');
      } else {
        setExportStatus('The plan was created locally, but this device cannot open a share sheet.');
      }
    } catch {
      setExportStatus('This device could not create the PDF. Your reviewed plan remains on this screen.');
    }
  };

  const reset = () => {
    setStage(1);
    setIncidentId('');
    setSafety([]);
    setEvidence([]);
    setNotes('');
    setReference('');
    setExportStatus('');
  };

  return (
    <Screen>
      {linkedRecord ? <Body style={{ marginBottom: 16 }}>Linked evidence record: {linkedRecord}. Review the imported notes before sharing.</Body> : null}
      <View style={st.progress} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: stage }}>
        {['Safety', 'Record', 'Plan'].map((label, index) => (
          <View key={label} style={st.progressItem}>
            <View style={[st.progressDot, index + 1 <= stage && st.progressDotOn]} />
            <Text style={[st.progressText, index + 1 === stage && st.progressTextOn]}>{label}</Text>
          </View>
        ))}
      </View>

      {stage === 1 ? (
        <>
          <Kicker>{config.kicker} · Step 1 of 3</Kicker>
          <Title style={st.title}>First, make the situation safe.</Title>
          <Body style={st.lead}>If anyone may be hurt or the area is unsafe, call emergency services before continuing.</Body>
          <Kicker style={st.section}>What happened?</Kicker>
          <View accessibilityRole="radiogroup" accessibilityLabel="Incident type">
            {config.incidents.map((item) => (
              <Choice key={item.id} title={item.title} detail={item.detail} selected={incidentId === item.id} onPress={() => setIncidentId(item.id)} />
            ))}
          </View>
          <Kicker style={st.section}>Safety check</Kicker>
          {config.safety.map((item) => (
            <ChecklistItem key={item.id} title={item.title} detail={item.detail} checked={safety.includes(item.id)} onPress={() => toggle(safety, setSafety, item.id)} />
          ))}
          <View style={st.action}><Button label="Continue to my record" disabled={!incidentId || !safety.includes('people')} onPress={() => setStage(2)} /></View>
          {!safety.includes('people') ? <Dim style={st.hint}>Confirm that people are safe, or that emergency help is coming, before continuing.</Dim> : null}
        </>
      ) : null}

      {stage === 2 ? (
        <>
          <Kicker>{config.kicker} · Step 2 of 3</Kicker>
          <Title style={st.title}>Record only what you can do safely.</Title>
          <Body style={st.lead}>Use your phone camera and documents, then mark what you have. Pixie does not upload or inspect these files.</Body>
          {config.evidence.map((item) => (
            <ChecklistItem key={item.id} title={item.title} detail={item.detail} checked={evidence.includes(item.id)} onPress={() => toggle(evidence, setEvidence, item.id)} />
          ))}
          <Text nativeID="recovery-notes-label" style={st.inputLabel}>Notes for your summary</Text>
          <TextInput
            accessibilityLabelledBy="recovery-notes-label"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={800}
            placeholder={product === 'auto' ? 'Example: vehicle was towed to…' : 'Example: water stopped at 8:20 PM…'}
            placeholderTextColor={C.dim}
            style={st.input}
          />
          <Dim style={st.counter}>{notes.length}/800 · Stored only in this open plan</Dim>
          <View style={st.action}><Button label="Build my recovery plan" disabled={evidence.length === 0} onPress={buildPlan} /></View>
          <Button kind="link" label="Back to the safety check" onPress={() => setStage(1)} />
        </>
      ) : null}

      {stage === 3 && incident ? (
        <>
          <Kicker>{config.kicker} · Step 3 of 3</Kicker>
          <Title style={st.title}>Your recovery plan is ready.</Title>
          <Body style={st.lead}>Use this summary when you contact your insurer or advisor. Pixie has not submitted a claim.</Body>
          <Panel tone="ink">
            <Kicker style={{ color: '#AFC1C4' }}>Local reference</Kicker>
            <Text style={st.reference}>{reference}</Text>
            <Text style={st.summaryTitle}>{incident.title}</Text>
            <Body style={st.inverse}>{evidence.length} record section{evidence.length === 1 ? '' : 's'} reviewed</Body>
          </Panel>
          <Kicker style={st.section}>What to do next</Kicker>
          {config.actions.map((action, index) => (
            <View key={action} style={st.nextRow}><Text style={st.nextNumber}>0{index + 1}</Text><Body style={st.nextText}>{action}</Body></View>
          ))}
          <Kicker style={st.section}>Included in your record</Kicker>
          {evidenceLabels.map((label) => <Text key={label} style={st.included}>{label}</Text>)}
          {notes ? <View style={st.notes}><Kicker>Your notes</Kicker><Body style={{ marginTop: 6 }}>{notes}</Body></View> : null}
          <View style={st.action}><Button label="Save or share this plan" onPress={exportPlan} /></View>
          {exportStatus ? <Text accessibilityLiveRegion="polite" style={st.status}>{exportStatus}</Text> : null}
          <Button kind="secondary" label="Review my record" onPress={() => setStage(2)} />
          <Button kind="link" label="Start another recovery plan" onPress={reset} />
          <Dim style={st.disclosure}>The plan is a personal record. Your insurer decides coverage, reporting requirements, repair approval, and claim payment.</Dim>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  progress: { flexDirection: 'row', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: C.rule },
  progressItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42 },
  progressDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.rule },
  progressDotOn: { backgroundColor: C.ochre },
  progressText: { fontFamily: F.sansMedium, fontWeight: '500', fontSize: 12, color: C.dim },
  progressTextOn: { fontFamily: F.sansBold, fontWeight: '600', color: C.ink },
  title: { marginTop: 8 },
  lead: { marginTop: 10, color: C.dim },
  section: { marginTop: 24, marginBottom: 8 },
  action: { marginTop: 20 },
  hint: { marginTop: 8, marginBottom: 20, fontSize: 13, lineHeight: 18 },
  inputLabel: { marginTop: 22, marginBottom: 7, fontFamily: F.sansBold, fontWeight: '600', fontSize: 15, color: C.ink },
  input: { minHeight: 112, borderWidth: 1, borderColor: C.rule, borderRadius: 14, padding: 13, fontFamily: F.sans, fontSize: 16, lineHeight: 22, color: C.ink, textAlignVertical: 'top', backgroundColor: C.paper },
  counter: { marginTop: 6, fontSize: 12, textAlign: 'right' },
  reference: { marginTop: 8, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 14, color: '#D8E2E3' },
  summaryTitle: { marginTop: 18, fontFamily: F.sansBold, fontWeight: '600', fontSize: 24, color: C.paper },
  inverse: { marginTop: 6, color: '#D8E2E3', fontSize: 14 },
  nextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.rule },
  nextNumber: { width: 26, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 11, color: C.ochre },
  nextText: { flex: 1, fontSize: 14, lineHeight: 20 },
  included: { paddingVertical: 8, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 15, color: C.ink },
  notes: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: C.rule, borderRadius: 14, backgroundColor: C.land },
  status: { marginTop: 10, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 13, lineHeight: 18, color: C.moss },
  disclosure: { marginTop: 14, marginBottom: 24, fontSize: 12, lineHeight: 18 },
});
