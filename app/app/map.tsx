import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import HexMap from '@/components/HexMap';
import { LEVEL_ALPHA, LEVEL_LABEL } from '@/components/hexStyle';
import { Body, Button, Dim, Kicker, Screen, Title } from '@/components/ui';
import { hexesNear, type Hex } from '@/lib/api';
import { useQuote } from '@/lib/store';
import { C } from '@/lib/theme';

export default function MapScreen() {
  const { place } = useQuote();
  const [hexes, setHexes] = useState<Hex[] | null>(null);

  useEffect(() => {
    if (place) hexesNear(place).then(setHexes);
  }, [place]);

  if (!place) return <Redirect href="/" />;

  const home = hexes?.[0];
  const values = (hexes ?? []).map((h) => h.value).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)] ?? 0;
  const summary = home
    ? `The block around ${place.address} had ${home.value} reported break-ins from 2023 to 2026, counting its own cell and the six around it. The middle of the ${values.length} cells on this map had ${median}. Your cell is in the "${LEVEL_LABEL[home.level].toLowerCase()}" band for Toronto.`
    : '';

  return (
    <Screen
      footer={
        <>
          <Button label="Review my coverage" onPress={() => router.push('/questions/1')} />
          <Button kind="link" label="Continue without the map" hint="The estimate still lists every source in words" onPress={() => router.push('/questions/1')} />
        </>
      }
    >
      <Kicker>{place.address}</Kicker>
      <Title style={{ marginTop: 4, fontSize: 26, lineHeight: 30 }}>Break-ins on your block</Title>
      <Dim style={{ marginTop: 6, fontSize: 14 }}>Each hexagon is about 0.1 km². Darker means more reported break-ins than the other cells shown.</Dim>

      <View style={st.map}>
        {hexes === null ? (
          <ActivityIndicator style={{ flex: 1 }} color={C.ink} accessibilityLabel="Loading the map" />
        ) : hexes.length ? (
          <HexMap hexes={hexes} center={[place.lat, place.lng]} home={home?.cell} label={`Map of break-ins around ${place.address}. ${summary}`} />
        ) : (
          <Body style={{ padding: 16 }}>No map data for this address offline. You can still continue; the quote lists every factor.</Body>
        )}
      </View>

      <View style={st.legend} accessible accessibilityLabel="Legend: five shades from the fewest to the most break-ins among the cells on this map">
        {LEVEL_ALPHA.map((a, i) => (
          <View key={i} style={{ flex: 1 }}>
            <View style={{ height: 12, borderRadius: 2, backgroundColor: `rgba(54,119,131,${a})`, borderWidth: 0.5, borderColor: C.rule }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Dim style={{ fontSize: 12 }}>Fewer on this map</Dim>
        <Dim style={{ fontSize: 12 }}>More</Dim>
      </View>

      {summary ? (
        <View style={{ marginTop: 20 }}>
          <Kicker style={{ marginBottom: 6 }}>In words</Kicker>
          <Body>{summary}</Body>
          <Dim style={{ fontSize: 13, marginTop: 8 }}>
            Source: Toronto Police Service, Break and Enter 2023-2026. Police place each event at the nearest intersection,
            so a cell is about one block.
          </Dim>
        </View>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  map: { height: 340, marginTop: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.rule, backgroundColor: C.land },
  legend: { flexDirection: 'row', gap: 3, marginTop: 10 },
});
