import * as WebBrowser from 'expo-web-browser';
import { Pressable, Text, View } from 'react-native';
import { Body, Dim, Kicker, Screen, Title } from '@/components/ui';
import { C, F } from '@/lib/theme';

const SOURCES = [
  { name: 'Toronto Police Service, Break and Enter (2023-2026)', use: 'Break-ins near you. Prices contents theft only.', url: 'https://data.torontopolice.on.ca/' },
  { name: 'City of Toronto, Basement Flooding Study Areas', use: 'Water factor for basement and ground-floor units, and the sewer backup recommendation.', url: 'https://open.toronto.ca/dataset/basement-flooding-study-areas/' },
  { name: 'City of Toronto, Fire Station Locations and Fire Hydrants', use: 'Fire protection: station distance and a hydrant within 150 m.', url: 'https://open.toronto.ca/dataset/fire-station-locations/' },
  { name: 'OpenStreetMap Nominatim', use: 'Turns the address you type into a map point.', url: 'https://nominatim.org/' },
];

const GUARDRAILS = [
  ['Peril-matched', 'Each place factor only prices the loss it measures: break-ins price theft of your things, flooding areas price water damage. There is no "bad neighbourhood" factor.'],
  ['Capped', 'Each factor stays between ×0.92 and ×1.10, and all place factors together between ×0.85 and ×1.25. The receipt marks a line CAPPED when a cap applied.'],
  ['Smoothed', 'A block with few reports is pulled toward its neighbourhood, so one bad month does not move a price.'],
  ['No personal traits', 'No age, sex, income, ethnicity or credit. We never ask, and no dataset we use contains them.'],
];

const LIMITS = [
  'Prices are illustrative Pixie estimates. They are not an Intact price or an offer of insurance.',
  'The base price and the contents, deductible and liability steps use example constants. The receipt labels each source.',
  'Police place each break-in at the nearest intersection, so the finest honest grid is about one block.',
  'Toronto only. Two or more claims in five years, or a unit in a floodline, goes to an advisor rather than getting a price.',
  'Nothing is stored against your name: a quote keeps the address, your coverage choices and the receipt so an advisor can open it.',
];

export default function About() {
  return (
    <Screen>
      <Title>Your data and your estimate</Title>
      <Body style={{ marginTop: 8 }}>
        Pixie uses the details you confirm and public Toronto data to prepare an itemized estimate. Fixed rules calculate every number. An assistant can explain the result, but it cannot change the price.
      </Body>

      <Kicker style={{ marginTop: 24, marginBottom: 6 }}>Fairness guardrails</Kicker>
      {GUARDRAILS.map(([h, t]) => (
        <View key={h} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.rule }}>
          <Text style={{ fontFamily: F.sansBold, fontWeight: '600', fontSize: 16, color: C.ink }}>{h}</Text>
          <Body style={{ fontSize: 15 }}>{t}</Body>
        </View>
      ))}

      <Kicker style={{ marginTop: 24, marginBottom: 6 }}>Sources</Kicker>
      {SOURCES.map((s) => (
        <View key={s.name} style={{ paddingBottom: 10, borderTopWidth: 1, borderTopColor: C.rule }}>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(s.url)}
            accessibilityRole="link"
            accessibilityLabel={s.name}
            accessibilityHint="Opens the dataset page"
            style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', backgroundColor: pressed ? C.land : 'transparent' })}
          >
            <Text style={{ fontFamily: F.sansMedium, fontWeight: '500', fontSize: 16, color: C.ink, textDecorationLine: 'underline' }}>{s.name}</Text>
          </Pressable>
          <Dim style={{ fontSize: 14 }}>{s.use}</Dim>
        </View>
      ))}

      <Kicker style={{ marginTop: 24, marginBottom: 6 }}>Your belongings</Kicker>
      <Body style={{ fontSize: 15 }}>Item photos and replacement values stay in this app's local storage. They are not uploaded for recognition or sent with a quote. Only the contents amount you choose enters the estimate. You can edit or delete individual items. Removing app data removes the inventory; it is not a cloud backup.</Body>

      <Kicker style={{ marginTop: 24, marginBottom: 6 }}>Road incident evidence</Kicker>
      <Body style={{ fontSize: 15 }}>Road help is a shared demo workspace. After you confirm sharing, its API stores incident details and uploaded files on the demo server for driver, witness and insurer review. Use test material only. This is different from your private belongings inventory. The reporter can delete a demo incident and its files. No automatic retention period, production login, push alert, payment, or insurer submission is connected. Hiding your contributor label does not redact a file.</Body>

      <Kicker style={{ marginTop: 24, marginBottom: 6 }}>Limits</Kicker>
      {LIMITS.map((l) => (
        <Body key={l} style={{ fontSize: 15, marginBottom: 8 }}>
          · {l}
        </Body>
      ))}
      <Dim style={{ fontSize: 13, marginTop: 12 }}>
        Map data © OpenStreetMap contributors.
      </Dim>
    </Screen>
  );
}
