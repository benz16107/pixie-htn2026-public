import { WitnessSavingsCard } from '@/components/WitnessSavingsCard';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ActionCard, ConsumerHeader, Panel, ProductSwitch, SectionLabel } from '@/components/consumer';
import { Body, Button, Screen } from '@/components/ui';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function CommunityScreen() {
  const { product, setProduct, driveSummary } = useQuote();
  return <Screen topSafe>
    <ConsumerHeader title="Community" detail="Support each other. Keep the details together." />
    <ProductSwitch product={product} onChange={setProduct} />
    <SectionLabel>Were you there?</SectionLabel>
    <ActionCard icon="community" title="I witnessed an incident" detail="Share a photo or clip. Accepted contributions earn simulated credit toward your home or auto insurance." meta="See the offered amount on each witness request." onPress={() => router.push('/road-help?role=bystander')} />
    {product === 'auto' ? <ActionCard icon="car" title="I was in an incident" detail="Record what happened and ask witnesses for another angle." onPress={() => router.push('/road-help?role=driver')} /> : null}
    <WitnessSavingsCard />
    <SectionLabel>{product === 'auto' ? 'After a road incident' : 'When something happens at home'}</SectionLabel>
    <Panel>
      <View style={st.heading}><AppIcon name="document" size={25} /><Text style={st.title}>Make a recovery plan</Text></View>
      <Body style={st.description}>{product === 'auto' ? 'Check everyone is safe, record what happened, and keep the details together.' : 'Check your safety, record any damage, and prepare a summary of what happened.'}</Body>
      <Button label="Get started" onPress={() => router.push({ pathname: '/recovery-plan', params: { product } })} />
      <View style={st.privacy}><AppIcon name="lock" size={14} color={C.dim} /><Text style={st.note}>Your notes stay private until you share them.</Text></View>
    </Panel>
    <Text style={st.note}>If anyone is hurt or in danger, call emergency services first. Pixie prepares a personal record; it does not submit a claim.</Text>
    <SectionLabel>{product === 'auto' ? 'Your driving' : 'Your records'}</SectionLabel>
    {product === 'auto' ? <ActionCard icon="drive" title={driveSummary ? 'Review your last drive' : 'Driving insights'} detail={driveSummary ? `Score ${driveSummary.score}. Review your driving and road context.` : 'Understand your driving score before your next trip.'} onPress={() => router.push('/driving-context')} /> : <ActionCard icon="inventory" title="Your belongings" detail="Review your inventory before making a plan." onPress={() => router.push('/home-inventory')} />}
  </Screen>;
}
const st = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: F.sansBold, fontWeight: '600', fontSize: 21, lineHeight: 26, color: C.ink },
  description: { marginTop: 16, marginBottom: 20, fontSize: 16, color: C.dim },
  privacy: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 16 },
  note: { flexShrink: 1, fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.dim },
});
