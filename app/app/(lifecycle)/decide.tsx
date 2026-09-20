import { WitnessSavingsCard } from '@/components/WitnessSavingsCard';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionCard, ConsumerHeader, MiniStat, Panel, ProductSwitch, SectionLabel } from '@/components/consumer';
import { Body, Button, Screen } from '@/components/ui';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function CompareScreen() {
  const { product, setProduct, answers, autoListing, autoProfile } = useQuote();
  const home = product === 'home';
  return <Screen topSafe>
    <ConsumerHeader title="Compare" detail="Explore your options before you choose." />
    <ProductSwitch product={product} onChange={setProduct} />
    <SectionLabel>Your saved choices</SectionLabel>
    <Panel>
      <Text style={st.title}>{home ? 'Tenant coverage' : `${autoListing.make} ${autoListing.model}`}</Text>
      <View style={st.stats}><MiniStat value={`$${(home ? answers.contentsValue : autoProfile.deductible).toLocaleString()}`} label={home ? 'Contents' : 'Deductible'} /><MiniStat value={home ? `$${answers.deductible.toLocaleString()}` : autoProfile.parking} label={home ? 'Deductible' : 'Parking'} /></View>
      <Body style={st.note}>See how a change affects the estimate. Nothing is saved until you choose to keep it.</Body>
      <Button label="Explore my price" onPress={() => router.push('/coverage-lab')} />
    </Panel>
    <WitnessSavingsCard configure />
    <SectionLabel>{home ? 'Start with what you own' : 'Before you buy'}</SectionLabel>
    <ActionCard icon={home ? 'inventory' : 'car'} title={home ? 'Build my contents estimate' : 'Find a car within my budget'} detail={home ? 'Photograph belongings, add replacement values, and use your total.' : 'Compare the car payment and insurance against your monthly budget.'} onPress={() => router.push(home ? '/home-inventory' : '/auto-compare')} />
  </Screen>;
}
const st=StyleSheet.create({title:{fontFamily:F.sansBold,fontWeight:'600',fontSize:21,color:C.ink},stats:{flexDirection:'row',flexWrap:'wrap',marginTop:12},note:{fontSize:15,color:C.dim,marginTop:4,marginBottom:20}});
