import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DrivingNativeAction } from '@/components/DrivingNativeAction';
import { MiniStat, Panel } from '@/components/consumer';
import { Body, Button, Kicker, Screen, Title } from '@/components/ui';
import { endDriveSurfaces, initializeDriveSurfaces, syncDriveSurfaces, type DriveSurfaceResult } from '@/lib/driving-surfaces';
import { assessDrive, type DriveAssessmentResult, type DriveSessionSummary } from '@/lib/driving';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

const ZONES = [
  { id: 'residential', name: 'Parkdale streets', context: 'Schools and local intersections nearby', speedLimit: 40 },
  { id: 'expressway', name: 'Gardiner corridor', context: 'Controlled access and fewer conflict points', speedLimit: 90 },
  { id: 'downtown', name: 'Downtown core', context: 'Dense crossings, buildings, and pedestrians', speedLimit: 40 },
] as const;

type Zone = (typeof ZONES)[number];
type Point = { lat: number; lng: number };
type Metrics = { distanceKm: number; durationSeconds: number; currentSpeedKmh: number; maxSpeedKmh: number; speedingEvents: number; hardBrakeEvents: number };

const EMPTY_METRICS: Metrics = { distanceKm: 0, durationSeconds: 0, currentSpeedKmh: 0, maxSpeedKmh: 0, speedingEvents: 0, hardBrakeEvents: 0 };

function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Steady';
  if (score >= 65) return 'Keep watching';
  return 'Needs attention';
}

export default function DrivingContextScreen() {
  const { setDriveSummary } = useQuote();
  const [surfaceStatus, setSurfaceStatus] = useState<DriveSurfaceResult | null>(null);
  const drivingRef = useRef(false);
  const generationRef = useRef(0);
  const [zone, setZone] = useState<Zone>(ZONES[0]);
  const [active, setActive] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [permission, setPermission] = useState<'idle' | 'working' | 'denied'>('idle');
  const [assessment, setAssessment] = useState<DriveAssessmentResult | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const metricsRef = useRef<Metrics>(EMPTY_METRICS);
  const lastRef = useRef<{ point: Point; speedKmh: number; time: number } | null>(null);
  const startedAtRef = useRef(0);
  const sampleCountRef = useRef(0);
  const speedingRef = useRef(false);
  const zoneRef = useRef<Zone>(zone);
  const nativeBuild = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
  const nativeIos = Platform.OS === 'ios' && nativeBuild;

  useEffect(() => { zoneRef.current = zone; }, [zone]);
  useEffect(() => {
    let mounted = true;
    void initializeDriveSurfaces().then((result) => { if (mounted) setSurfaceStatus(result); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => () => {
    drivingRef.current = false;
    generationRef.current += 1;
    subscriptionRef.current?.remove();
    void endDriveSurfaces();
  }, []);

  const publish = (next: DriveAssessmentResult, nextMetrics: Metrics, area: string = zoneRef.current.name) => {
    setAssessment(next);
    const summary: DriveSessionSummary = {
      score: next.assessment.score,
      behaviorScore: next.assessment.behaviorScore,
      routeContextScore: next.assessment.routeContextScore,
      band: next.assessment.band,
      ...nextMetrics,
      area,
      updatedAt: Date.now(),
      source: next.source,
    };
    setDriveSummary(summary);
    void syncDriveSurfaces({ zone: area, context: next.assessment.routeFactors[0]?.label ?? zoneRef.current.context, score: summary.score, speedKmh: summary.currentSpeedKmh, active: drivingRef.current }).then(setSurfaceStatus);
  };

  const assessCurrent = async (nextMetrics = metricsRef.current, area?: string) => {
    const generation = generationRef.current;
    const next = await assessDrive({
      points: pointsRef.current,
      distanceKm: nextMetrics.distanceKm,
      speedingEvents: nextMetrics.speedingEvents,
      hardBrakeEvents: nextMetrics.hardBrakeEvents,
    });
    if (generation === generationRef.current) publish(next, nextMetrics, area);
    return next;
  };

  const handleLocation = (location: Location.LocationObject) => {
    if (!drivingRef.current) return;
    const rawPoint = { lat: location.coords.latitude, lng: location.coords.longitude };
    const point = { lat: Number(rawPoint.lat.toFixed(3)), lng: Number(rawPoint.lng.toFixed(3)) };
    const previous = lastRef.current;
    const now = location.timestamp || Date.now();
    const deltaKm = previous ? distanceKm(previous.point, rawPoint) : 0;
    const elapsedSeconds = previous ? Math.max(1, (now - previous.time) / 1000) : 1;
    const reportedSpeed = location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed * 3.6 : null;
    const calculatedSpeed = deltaKm / elapsedSeconds * 3600;
    const currentSpeedKmh = Math.max(0, Math.round(reportedSpeed ?? calculatedSpeed));
    const overThreshold = currentSpeedKmh > zoneRef.current.speedLimit + 5;
    const speedingEvents = metricsRef.current.speedingEvents + (overThreshold && !speedingRef.current ? 1 : 0);
    speedingRef.current = overThreshold;
    const hardBrake = previous && elapsedSeconds <= 5 && previous.speedKmh >= 25 && previous.speedKmh - currentSpeedKmh >= 12;
    const nextMetrics: Metrics = {
      distanceKm: Number((metricsRef.current.distanceKm + Math.min(deltaKm, 0.5)).toFixed(3)),
      durationSeconds: Math.max(0, Math.round((now - startedAtRef.current) / 1000)),
      currentSpeedKmh,
      maxSpeedKmh: Math.max(metricsRef.current.maxSpeedKmh, currentSpeedKmh),
      speedingEvents,
      hardBrakeEvents: metricsRef.current.hardBrakeEvents + (hardBrake ? 1 : 0),
    };
    pointsRef.current = [...pointsRef.current, point].slice(-50);
    metricsRef.current = nextMetrics;
    lastRef.current = { point: rawPoint, speedKmh: currentSpeedKmh, time: now };
    sampleCountRef.current += 1;
    setMetrics(nextMetrics);
    if (sampleCountRef.current === 2 || sampleCountRef.current % 5 === 0) void assessCurrent(nextMetrics, 'Current drive');
  };

  const startLiveDrive = async () => {
    if (permission === 'working') return;
    setPermission('working');
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      setPermission('denied');
      return;
    }
    pointsRef.current = [];
    metricsRef.current = EMPTY_METRICS;
    lastRef.current = null;
    sampleCountRef.current = 0;
    speedingRef.current = false;
    startedAtRef.current = Date.now();
    setMetrics(EMPTY_METRICS);
    setAssessment(null);
    setSampleMode(false);
    generationRef.current += 1;
    drivingRef.current = true;
    setActive(true);
    setPermission('idle');
    void syncDriveSurfaces({ zone: 'Starting drive', context: 'Waiting for the first GPS sample', score: null, speedKmh: 0, active: true }).then(setSurfaceStatus);
    const generation = generationRef.current;
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 4 },
      handleLocation,
      () => setPermission('denied'),
    );
    if (!drivingRef.current || generation !== generationRef.current) subscription.remove();
    else subscriptionRef.current = subscription;
  };

  const startSampleDrive = async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    const nextMetrics = { distanceKm: 9.4, durationSeconds: 14 * 60, currentSpeedKmh: 38, maxSpeedKmh: 82, speedingEvents: 0, hardBrakeEvents: 1 };
    metricsRef.current = nextMetrics;
    pointsRef.current = [{ lat: 43.639, lng: -79.443 }, { lat: 43.642, lng: -79.408 }, { lat: 43.650, lng: -79.381 }];
    setMetrics(nextMetrics);
    setSampleMode(true);
    generationRef.current += 1;
    drivingRef.current = true;
    setActive(true);
    await assessCurrent(nextMetrics, 'Toronto sample trip');
  };

  const stopDrive = async () => {
    if (finishing) return;
    setFinishing(true);
    drivingRef.current = false;
    generationRef.current += 1;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (!sampleMode && pointsRef.current.length) await assessCurrent(metricsRef.current, 'Most recent drive');
    setSurfaceStatus(await endDriveSurfaces());
    setActive(false);
    setFinishing(false);
  };

  const selectZone = (next: Zone) => {
    setZone(next);
    if (active && assessment) void syncDriveSurfaces({ zone: next.name, context: next.context, score: assessment.assessment.score, speedKmh: metrics.currentSpeedKmh, active: true }).then(setSurfaceStatus);
  };

  const score = assessment?.assessment.score ?? 100;

  return (
    <Screen>
      <Title>Drive score</Title>
      <Body style={st.lead}>Your driving habits and road context, explained.</Body>


      <Panel>
        <View style={st.scoreHero}>
          <View><Text style={st.score}>{assessment ? score : '—'}</Text><Text style={st.scoreBand}>{assessment ? scoreLabel(score) : 'Ready to start'}</Text></View>
          <View style={st.liveReadout}>
            <Text style={st.liveLabel}>{active ? (sampleMode ? 'Sample drive' : 'Live drive') : 'Trip summary'}</Text>
            <Text style={st.speed}>{metrics.currentSpeedKmh}<Text style={st.speedUnit}> km/h</Text></Text>
          </View>
        </View>
        <View style={st.darkStats}>
          <MiniStat value={`${metrics.distanceKm.toFixed(1)} km`} label="Distance" />
          <MiniStat value={timeLabel(metrics.durationSeconds)} label="Duration" />
          <MiniStat value={String(metrics.speedingEvents + metrics.hardBrakeEvents)} label="Events" />
        </View>
      </Panel>

      <View style={st.actionGap}>
        {active ? <DrivingNativeAction disabled={finishing} label={finishing ? "Finishing drive…" : "Finish this drive"} onPress={stopDrive} /> : Platform.OS === 'web' ? <Button label="Preview a sample drive" onPress={startSampleDrive} /> : <DrivingNativeAction disabled={permission === 'working'} label={permission === 'working' ? 'Starting GPS…' : 'Start a live drive'} onPress={startLiveDrive} />}
      </View>
      {!active && Platform.OS !== 'web' ? <Button kind="link" label="Preview with a Toronto sample" onPress={startSampleDrive} /> : null}
      {permission === 'denied' ? <Text accessibilityLiveRegion="polite" style={st.denied}>Location is unavailable. You can still use the Toronto sample.</Text> : null}

      <Kicker style={st.section}>On your Home & Lock Screen</Kicker>
      <View style={st.surfaceRow}>
        <View style={st.widgetPreview}>
          <Text style={st.previewKicker}>Pixie Drive Score</Text>
          <Text style={st.previewArea}>{assessment?.assessment.routeFactors[0]?.areaLabel ?? zone.name}</Text>
          <Text style={st.previewContext}>{assessment?.assessment.routeFactors[0]?.label ?? zone.context}</Text>
          <Text style={st.previewScore}>{assessment ? `${score} score · ${metrics.currentSpeedKmh} km/h` : 'Ready for your next drive'}</Text>
        </View>
        <View style={st.lockPreview}>
          <Text style={[st.previewKicker, { color: C.paper }]}>Drive Score</Text>
          <View style={st.lockRow}><Text style={st.lockScore}>{assessment ? score : '—'}</Text><Text style={st.lockDetail}>{zone.name}{'\n'}{metrics.currentSpeedKmh} km/h</Text></View>
          <Text style={st.lockFoot}>Lock Screen + Dynamic Island</Text>
        </View>
      </View>
      <Body style={st.previewNote}>{nativeIos ? 'The installed development build updates these native surfaces during the drive.' : 'Preview shown here. Install the iOS development build to add the widget and start the Live Activity.'}</Body>

      {nativeIos && surfaceStatus ? (
        <View accessibilityLiveRegion="polite">
          <Body style={st.previewNote}>{surfaceStatus.error ?? (surfaceStatus.liveActivity ? 'Live Activity started. Lock your iPhone to see it. The Home Screen widget has your latest score.' : surfaceStatus.widget ? 'Your widget is ready. Add Pixie Drive Score from the Home Screen widget gallery. Start a drive or the Toronto sample for a Live Activity.' : 'Native widgets are unavailable in this build.')}</Body>
          {surfaceStatus.error ? <Button kind="link" label="Retry widget and Live Activity" onPress={() => {
            const retry = active ? syncDriveSurfaces({ zone: sampleMode ? 'Toronto sample trip' : zone.name, context: assessment?.assessment.routeFactors[0]?.label ?? zone.context, score: assessment?.assessment.score ?? null, speedKmh: metrics.currentSpeedKmh, active: true }) : initializeDriveSurfaces();
            void retry.then(setSurfaceStatus);
          }} /> : null}
        </View>
      ) : null}

      <Kicker style={st.section}>Road context</Kicker>
      <View accessibilityRole="radiogroup" accessibilityLabel="Road context examples" style={st.zones}>
        {ZONES.map((item) => (
          <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: zone.id === item.id }} onPress={() => selectZone(item)} style={({ pressed }) => [st.zone, zone.id === item.id && st.zoneOn, pressed && { opacity: 0.74 }]}>
            <View style={{ flex: 1 }}><Text style={st.zoneName}>{item.name}</Text><Text style={st.zoneContext}>{item.context}</Text></View>
            <Text style={st.zoneLimit}>{item.speedLimit}<Text style={st.zoneUnit}> km/h sample</Text></Text>
          </Pressable>
        ))}
      </View>

      {assessment ? (
        <Panel tone="warm">
          <Kicker>Your score, explained</Kicker>
          <View style={st.resultRow}><Text style={st.resultLabel}>Driving behavior</Text><Text style={st.resultValue}>{assessment.assessment.behaviorScore}</Text></View>
          <View style={st.resultRow}><Text style={st.resultLabel}>Road context</Text><Text style={st.resultValue}>{Math.round(assessment.assessment.routeContextScore)}</Text></View>
          {assessment.assessment.routeFactors.slice(0, 3).map((factor) => <Body key={factor.key} style={st.factor}>{factor.label}: {factor.areaLabel}</Body>)}
          <Body style={st.disclosure}>The coaching score is 75% driving events and 25% route context. It cannot change an estimate or premium.</Body>
        </Panel>
      ) : null}

      <Panel>
        <Kicker>Your privacy</Kicker>
        <Body style={st.disclosure}>Location is used only while this drive is open in the foreground. Approximate route points help explain the road context. No route is stored, and your score never changes your premium.</Body>
      </Panel>
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { marginTop: 7 },
  lead: { marginTop: 10, marginBottom: 18, color: C.dim },
  scoreHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 },
  score: { color: C.ochre, fontFamily: F.sansBold, fontWeight: '600', fontSize: 68, lineHeight: 70 },
  scoreBand: { marginTop: 2, color: C.dim, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 13 },
  liveReadout: { alignItems: 'flex-end', paddingBottom: 4 },
  liveLabel: { color: C.dim, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 12 },
  speed: { marginTop: 7, color: C.ink, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 25 },
  speedUnit: { color: C.dim, fontFamily: F.sans, fontSize: 12 },
  darkStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.rule },
  actionGap: { marginTop: 14 },
  denied: { marginTop: 8, color: C.ochre, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 13 },
  section: { marginTop: 24, marginBottom: 9 },
  surfaceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  widgetPreview: { flex: 1, minWidth: 140, minHeight: 164, padding: 14, borderRadius: 24, backgroundColor: C.paper, justifyContent: 'space-between' },
  lockPreview: { flex: 1, minWidth: 140, minHeight: 164, padding: 14, borderRadius: 24, backgroundColor: C.deep },
  previewKicker: { color: C.ochre, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 11 },
  previewArea: { marginTop: 11, color: C.ink, fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, lineHeight: 20 },
  previewContext: { marginTop: 5, color: C.dim, fontFamily: F.sans, fontSize: 11, lineHeight: 15 },
  previewScore: { marginTop: 10, color: C.ink, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 10 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  lockScore: { color: C.paper, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 40 },
  lockDetail: { flex: 1, color: C.paper, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 12, lineHeight: 17 },
  lockFoot: { marginTop: 'auto', color: '#AFC1C4', fontFamily: F.sans, fontSize: 10 },
  previewNote: { marginTop: 9, color: C.dim, fontSize: 12, lineHeight: 17 },
  zones: { gap: 8 },
  zone: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1, borderColor: C.rule, borderRadius: 14 },
  zoneOn: { borderColor: C.ochre, backgroundColor: C.ochreSoft },
  zoneName: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 15, color: C.ink },
  zoneContext: { marginTop: 3, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.dim },
  zoneLimit: { color: C.ink, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 16 },
  zoneUnit: { color: C.dim, fontFamily: F.sans, fontSize: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.rule },
  resultLabel: { color: C.dim, fontFamily: F.sansMedium, fontWeight: '500', fontSize: 14 },
  resultValue: { color: C.ink, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 18 },
  factor: { marginTop: 9, color: C.dim, fontSize: 12, lineHeight: 17 },
  disclosure: { marginTop: 12, color: C.dim, fontSize: 12, lineHeight: 18 },
});
