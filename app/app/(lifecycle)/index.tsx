import { WitnessSavingsCard } from '@/components/WitnessSavingsCard';
import { useInventory } from '@/lib/inventory-store';
import { inventoryTotal } from '@/lib/inventory';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ActionCard, ConsumerHeader, Panel, ProductSwitch, SectionLabel } from '@/components/consumer';
import { Body, Button, Screen } from '@/components/ui';
import { bundledAutoEstimate } from '@/lib/consumer';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function HomeScreen() {
  const { product, setProduct, autoListing, autoProfile, place, driveSummary } = useQuote();
  const { items } = useInventory();
  const home = product === 'home';
  const auto = bundledAutoEstimate(autoListing, autoProfile);
  return <Screen topSafe>
    <ConsumerHeader />
    <ProductSwitch product={product} onChange={setProduct} />
    <SectionLabel>{home ? 'Your home' : 'Your car'}</SectionLabel>
    <Panel>
      <View style={st.cardHeading}><View style={st.productIcon}><AppIcon name={home ? 'home' : 'car'} size={28} /></View><View style={{ flex: 1 }}><Text style={st.category}>{home ? 'Tenant insurance' : `${autoListing.year} ${autoListing.make}`}</Text><Text style={st.cardTitle}>{home ? 'Made for your place' : autoListing.model}</Text></View></View>
      {home ? <><Body style={st.description}>{place?.address ?? 'An estimate for your belongings and the place you call home.'}</Body><View style={st.detailRow}><Text style={st.secondary}>{place ? 'Your address is saved' : 'Toronto tenant coverage'}</Text><Text style={st.secondary}>About 2 min</Text></View></> : <><View style={st.priceRow}><Text style={st.price}>${auto.monthly.toFixed(2)}</Text><Text style={st.priceUnit}>/ month</Text></View><Text style={st.secondary}>Illustrative insurance estimate</Text><View style={st.detailRow}><Text style={st.secondary}>Car payment</Text><Text style={st.detailValue}>${autoListing.paymentMonthly} / month</Text></View></>}
      <View style={st.button}><Button label={home ? (place ? 'Continue estimate' : 'Get a tenant estimate') : 'Compare cars'} onPress={() => router.push(home ? '/home-quote' : '/auto-compare')} /></View>
    </Panel>
    <WitnessSavingsCard />
    <SectionLabel>Explore before you choose</SectionLabel>
    <ActionCard icon="compare" title="What changes my price?" detail="Try coverage choices and see your estimate respond." onPress={() => router.push('/coverage-lab')} />
    <SectionLabel>For you</SectionLabel>
    {home ? <ActionCard icon="inventory" title="Your belongings" detail={items.length ? `${items.length} items, $${inventoryTotal(items).toLocaleString()} recorded. Add or review belongings.` : "Photograph your belongings and build your contents estimate."} onPress={() => router.push('/home-inventory')} /> : <ActionCard icon="drive" title="Your drive score" detail={driveSummary ? `${driveSummary.score} on your latest drive. Review your insights.` : 'Understand your driving and the roads around you.'} onPress={() => router.push('/driving-context')} />}
    <ActionCard icon="shield" title={home ? 'A safer home' : 'Ready for the road'} detail={home ? 'A few small checks for peace of mind.' : 'Keep your car and records prepared.'} onPress={() => router.push('/protect')} />
    <Text style={st.disclosure}>{home ? 'Tenant estimates for Toronto. ' : 'Example vehicles and prices. '}Illustrative estimates, not an insurance offer.</Text>
  </Screen>;
}
const st = StyleSheet.create({
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  productIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: C.ochreSoft, alignItems: 'center', justifyContent: 'center' },
  category: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginBottom: 4 },
  cardTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 21, lineHeight: 26, letterSpacing: -0.4, color: C.ink },
  description: { marginTop: 18, color: C.dim, fontSize: 16, lineHeight: 23 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.rule, paddingTop: 16, marginTop: 18 },
  secondary: { fontFamily: F.sans, color: C.dim, fontSize: 13, lineHeight: 19 },
  detailValue: { fontFamily: F.sansMedium, fontWeight: '500', color: C.ink, fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 22 },
  price: { fontFamily: F.sansBold, fontWeight: '600', fontVariant: ['tabular-nums'], fontSize: 42, letterSpacing: -1.4, color: C.ink },
  priceUnit: { fontFamily: F.sans, fontSize: 16, color: C.dim },
  button: { marginTop: 20 },
  disclosure: { marginTop: 12, marginBottom: 8, fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: C.dim },
});
