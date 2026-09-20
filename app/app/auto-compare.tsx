import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MiniStat, Panel, SourceMark } from '@/components/consumer';
import { Body, Button, Kicker, Screen, Title } from '@/components/ui';
import { AUTO_LISTINGS, autoName, quoteAuto, type AutoEstimateResult } from '@/lib/consumer';
import { useQuote } from '@/lib/store';
import { C, F, money } from '@/lib/theme';

type Estimates = Record<string, AutoEstimateResult>;

export default function AutoCompareScreen() {
  const { autoListing, setAutoListing, autoProfile } = useQuote();
  const [budget, setBudget] = useState(700);
  const [estimates, setEstimates] = useState<Estimates>({});

  useEffect(() => {
    let live = true;
    Promise.all(AUTO_LISTINGS.map(async (vehicle) => [vehicle.id, await quoteAuto(vehicle, autoProfile)] as const)).then((entries) => {
      if (live) setEstimates(Object.fromEntries(entries));
    });
    return () => { live = false; };
  }, [autoProfile]);

  const priced = Object.values(estimates).filter(result => 'estimate' in result && result.estimate.decision.kind === 'estimate_ready');
  const withinBudget = priced.filter(result => 'estimate' in result && result.estimate.ownershipMonthly <= budget).length;

  return (
    <Screen footer={<Button label={`Use ${autoListing.make} ${autoListing.model}`} onPress={() => router.dismissTo('/decide')} />}>
      <Kicker>Auto · listing comparison</Kicker>
      <Title style={st.title}>Find your next car.</Title>
      <Body style={st.lead}>Choose an example listing to compare the monthly car cost with an illustrative insurance estimate.</Body>

      <Panel>
        <Kicker>Monthly car + insurance budget</Kicker>
        <Text accessibilityLiveRegion="polite" style={st.budget}>${budget.toLocaleString()}</Text>
        <View style={st.budgetControl}><Pressable accessibilityRole="button" accessibilityLabel="Decrease budget by $25" accessibilityState={{disabled:budget<=300}} disabled={budget<=300} onPress={()=>setBudget(value=>Math.max(300,value-25))} style={st.budgetStep}><Text style={st.stepText}>−</Text></Pressable><Slider accessibilityLabel="Monthly car and insurance budget" accessibilityValue={{min:300,max:1500,now:budget}} minimumValue={300} maximumValue={1500} step={25} value={budget} onValueChange={setBudget} minimumTrackTintColor={C.ochre} maximumTrackTintColor={C.land} thumbTintColor={C.ochre} style={{height:44,flex:1}} /><Pressable accessibilityRole="button" accessibilityLabel="Increase budget by $25" accessibilityState={{disabled:budget>=1500}} disabled={budget>=1500} onPress={()=>setBudget(value=>Math.min(1500,value+25))} style={st.budgetStep}><Text style={st.stepText}>+</Text></Pressable></View>
        <Text style={st.budgetNote}>{priced.length ? `${withinBudget} of ${priced.length} example cars fit this budget.` : Object.keys(estimates).length === AUTO_LISTINGS.length ? 'These profiles need review before comparing budgets.' : 'Calculating the example cars…'} Fuel, tax, maintenance and financing interest are not included.</Text>
      </Panel>
      <View accessibilityRole="radiogroup" accessibilityLabel="Vehicle listings">
        {AUTO_LISTINGS.map((vehicle) => {
          const result = estimates[vehicle.id];
          const estimate = result && 'estimate' in result ? result.estimate : null;
          const live = result && 'estimate' in result && result.source === 'shared-api';
          const selected = autoListing.id === vehicle.id;
          return (
            <Pressable
              key={vehicle.id}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${autoName(vehicle)}. Listing price $${vehicle.listingPrice.toLocaleString('en-CA')}. ${estimate ? `Illustrative cover $${estimate.monthly} monthly.` : 'Estimate loading.'}`}
              onPress={() => setAutoListing(vehicle)}
              style={({ pressed }) => [st.card, selected && st.cardOn, pressed && { opacity: 0.75 }]}
            >
              <View style={st.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}><Kicker>{vehicle.year} · Example listing</Kicker><Text style={st.name}>{vehicle.make} {vehicle.model}</Text></View>
                <View style={[st.radio, selected && st.radioOn]} />
              </View>
              <Text style={st.listPrice}>${vehicle.listingPrice.toLocaleString('en-CA')}</Text>
              {estimate ? (
                <>
                  <SourceMark live={!!live} />
                  {estimate.decision.kind === 'estimate_ready' ? <>
                    <View style={st.costTrack} accessibilityLabel={`Car payment ${money(vehicle.paymentMonthly)} and insurance ${money(estimate.monthly)} per month`}><View style={{width:`${vehicle.paymentMonthly / estimate.ownershipMonthly * 100}%`,backgroundColor:C.ochre}} /><View style={{flex:1,backgroundColor:C.land}} /></View>
                    <Text style={[st.budgetNote,{color:estimate.ownershipMonthly <= budget ? C.moss : C.dim}]}>{money(Math.abs(budget-estimate.ownershipMonthly))} {estimate.ownershipMonthly <= budget ? 'under' : 'over'} your monthly budget</Text>
                  </> : <Text style={st.budgetNote}>This setup needs advisor review.</Text>}
                  <View style={st.stats}>
                    <MiniStat value={`$${vehicle.paymentMonthly}`} label="Car / month" />
                    <MiniStat value={`$${estimate.monthly}`} label="Cover / month" />
                    <MiniStat value={`$${estimate.ownershipMonthly}`} label="Total / month" />
                  </View>
                </>
              ) : <View accessibilityLabel="Loading estimate" style={{height:50,backgroundColor:C.land,borderRadius:8,marginTop:18}} />}
            </Pressable>
          );
        })}
      </View>
      <Body style={st.disclosure}>Vehicle listings, payments, and Pixie insurance estimates are illustrative. They are not Intact quotes or offers. Payments assume 60 months and exclude interest.</Body>
    </Screen>
  );
}

const st = StyleSheet.create({
  budgetStep:{width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:C.ochreSoft,borderRadius:10},stepText:{fontSize:22,color:C.ochre},
  budgetControl:{flexDirection:'row',alignItems:'center',gap:8},
  budget: {fontFamily:F.sansBold,fontWeight:'600',fontSize:36,color:C.ink,marginTop:8},
  budgetNote: {fontFamily:F.sans,fontSize:13,lineHeight:19,color:C.dim,marginTop:8},
  costTrack: {height:8,flexDirection:'row',overflow:'hidden',borderRadius:4,marginTop:16},
  title: { marginTop: 8 },
  lead: { marginTop: 10, marginBottom: 20, color: C.dim },
  card: { borderWidth: 1, borderColor: C.rule, borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: C.paper },
  cardOn: { borderColor: C.ochre, borderWidth: 2, backgroundColor: C.ochreSoft },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { marginTop: 5, fontFamily: F.sansBold, fontWeight: '600', fontSize: 20, color: C.ink },
  listPrice: { marginTop: 6, marginBottom: 12, fontFamily: F.monoMedium, fontWeight: '500', fontSize: 14, color: C.dim },
  radio: { width: 22, height: 22, borderWidth: 1.5, borderColor: C.dim, borderRadius: 11 },
  radioOn: { borderColor: C.ochre, borderWidth: 7 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  disclosure: { marginTop: 6, marginBottom: 22, fontSize: 13, lineHeight: 19, color: C.dim },
});
