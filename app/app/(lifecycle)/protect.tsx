import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionCard, ChecklistItem, ConsumerHeader, MiniStat, Panel, ProductSwitch } from '@/components/consumer';
import { Body, Button, Kicker, Screen, Title } from '@/components/ui';
import { AUTO_PROTECT_ACTIONS, HOME_PROTECT_ACTIONS } from '@/lib/consumer';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function ProtectScreen() {
  const { product, setProduct, driveSummary } = useQuote();
  const [done, setDone] = useState<string[]>([]);
  const actions = product === 'home' ? HOME_PROTECT_ACTIONS : AUTO_PROTECT_ACTIONS;
  const toggle = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const completed = actions.filter((action) => done.includes(action.id)).length;

  return (
    <Screen topSafe>
      <ConsumerHeader title="Insights" detail="Take care of what matters." />
      <ProductSwitch product={product} onChange={setProduct} />
      <Title style={st.title}>{product === 'auto' ? 'Your driving insights' : 'Your home checklist'}</Title>
      <Body style={st.lead}>{product === 'auto' ? 'A private view of your driving habits and the roads around you.' : 'A few practical checks for your place.'}</Body>
      {product === 'auto' ? (
        <Panel tone="plain">
          <Kicker>{driveSummary ? 'Latest drive' : 'Drive score'}</Kicker>
          {driveSummary ? (
            <>
              <View style={st.scoreStats}>
                <MiniStat value={String(driveSummary.score)} label="Overall" />
                <MiniStat value={String(driveSummary.behaviorScore)} label="Driving" />
                <MiniStat value={String(Math.round(driveSummary.routeContextScore))} label="Road" />
              </View>
              <Body style={st.summary}>{driveSummary.area} · {driveSummary.distanceKm.toFixed(1)} km · {driveSummary.speedingEvents + driveSummary.hardBrakeEvents} events</Body>
            </>
          ) : <Body style={st.inverseBody}>Your first drive starts here. Get a score with clear, useful feedback.</Body>}
          <View style={st.buttonGap}><Button label={driveSummary ? 'View driving insights' : 'Start my first drive'} onPress={() => router.push('/driving-context')} /></View>
        </Panel>
      ) : null}
      {product === 'auto' ? <ActionCard icon="document" title="Help with a road incident" detail="Witness requests, your contributions, and shared evidence records." onPress={() => router.push('/road-help?role=bystander')} /> : null}
      <Text accessibilityLiveRegion="polite" style={st.progress}>{completed} of {actions.length} checks complete</Text>
      {actions.map((action) => <ChecklistItem key={action.id} title={action.title} detail={action.detail} checked={done.includes(action.id)} onPress={() => toggle(action.id)} />)}
      {product === 'home' ? (
        <Button kind="secondary" label="Open room inventory" onPress={() => router.push('/home-inventory')} />
      ) : null}
      <Body style={st.note}>Keep receipts, dates, and photos with the record. An advisor can confirm which details matter to your policy.</Body>
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { marginTop: 28, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  lead: { marginTop: 9, marginBottom: 18, color: C.dim },
  progress: { marginBottom: 10, fontFamily: F.sans, fontSize: 13, color: C.dim },
  scoreStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  summary: { marginTop: 4, color: C.dim, fontSize: 13 },
  buttonGap: { marginTop: 14 },
  inverseKicker: { color: '#AFC1C4' },
  inverseBody: { marginTop: 9, color: C.dim },
  note: { marginTop: 18, marginBottom: 24, fontSize: 13, lineHeight: 19, color: C.dim },
});
