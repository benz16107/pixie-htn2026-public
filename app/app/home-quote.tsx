import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Choice, Dim, Kicker, Progress, Screen, Title } from '@/components/ui';
import { EXAMPLES, type Place } from '@/lib/api';
import { useQuote } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function HomeQuoteScreen() {
  const { place, setPlace, setAnswers } = useQuote();
  const [text, setText] = useState(place?.address ?? '');
  const [picked, setPicked] = useState<Place | null>(place);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addressRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const addressTop = useRef(0);

  const showAddressError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      addressRef.current?.focus();
      scrollRef.current?.scrollTo({ y: Math.max(0, addressTop.current - 20), animated: true });
    });
  };

  const pickExample = (i: number) => {
    const ex = EXAMPLES[i];
    setPicked(ex);
    setText(ex.address);
    setAnswers({ unitLevel: ex.answers.unitLevel });
    setError('');
  };

  const useMyLocation = async () => {
    setBusy(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission was not given. Type your address instead.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [r] = await Location.reverseGeocodeAsync(coords).catch(() => []);
      const address = r ? [r.streetNumber, r.street].filter(Boolean).join(' ') || r.name || 'Your location' : 'Your location';
      setPicked({ address, lat: coords.latitude, lng: coords.longitude });
      setText(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your location. Type your address instead.');
    } finally {
      setBusy(false);
    }
  };

  // Resolve typed text to a point: an example, else the platform geocoder.
  const resolve = async (): Promise<Place | null> => {
    if (picked && picked.address === text) return picked;
    const ex = EXAMPLES.find((e) => e.address.toLowerCase() === text.trim().toLowerCase());
    if (ex) return ex;
    try {
      const [g] = await Location.geocodeAsync(`${text}, Toronto, ON`);
      if (g) return { address: text.trim(), lat: g.latitude, lng: g.longitude };
    } catch {}
    return null;
  };

  const go = async (withMap: boolean) => {
    if (!text.trim()) {
      showAddressError('Type an address, use your location, or pick an example.');
      return;
    }
    setBusy(true);
    const p = await resolve();
    setBusy(false);
    if (!p) return showAddressError('We could not find that address in Toronto. Check the spelling or pick an example.');
    setPlace(p);
    router.push(withMap ? '/map' : '/questions/1');
  };

  return (
    <Screen
      scrollRef={scrollRef}
      footer={
        <>
          <Button label="Review my coverage" hint="Takes you to one screen with useful choices already filled in" onPress={() => go(false)} disabled={busy} />
          <Button
            kind="link"
            label="See the neighbourhood risk map first"
            hint="Shows the local break-in data used by the estimate"
            onPress={() => go(true)}
          />
        </>
      }
    >
      <Progress current={1} total={3} labels={['Address', 'Coverage', 'Estimate']} />
      <View style={{ paddingTop: 12, paddingBottom: 20 }}>
        <Kicker>Tenant insurance · Toronto</Kicker>
        <Title style={{ marginTop: 8 }}>Cover your place.</Title>
        <Body style={{ marginTop: 10 }}>
          Enter your address, choose your coverage, and get an estimate with every cost explained.
        </Body>
      </View>

      <View onLayout={(event) => { addressTop.current = event.nativeEvent.layout.y; }}>
        <Text nativeID="addr-label" style={st.label}>
          Your address
        </Text>
        <TextInput
          ref={addressRef}
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError('');
          }}
          placeholder="e.g. 180 Queen St W"
          placeholderTextColor={C.dim}
          accessibilityLabel="Your address"
          accessibilityLabelledBy="addr-label"
          accessibilityHint={error || 'Enter a Toronto street address'}
          aria-invalid={!!error}
          aria-describedby="addr-error"
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          returnKeyType="next"
          onSubmitEditing={() => go(true)}
          style={[st.input, error ? { borderColor: C.rust } : null]}
        />
        <Text nativeID="addr-error" accessibilityLiveRegion="assertive" role="alert" style={[st.error, !error && st.errorEmpty]}>
          {error}
        </Text>
      </View>
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button kind="secondary" label="Use my location" onPress={useMyLocation} disabled={busy} hint="Asks once for your location to fill in the address" />
        {busy ? <ActivityIndicator color={C.ink} accessibilityLabel="Working" /> : null}
      </View>

      <Kicker style={{ marginTop: 28, marginBottom: 10 }}>Try a Toronto address</Kicker>
      {EXAMPLES.map((ex, i) => (
        <Choice key={ex.address} role="button" title={ex.address} detail={ex.hint} selected={picked?.address === ex.address} onPress={() => pickExample(i)} />
      ))}
      <Dim style={{ fontSize: 13, marginTop: 6 }}>
        No account, name, or email. Prices are illustrative Pixie estimates, not an Intact price or offer.
      </Dim>
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 15, color: C.ink, marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: C.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: F.sans,
    fontSize: 17,
    color: C.ink,
    backgroundColor: C.paper,
  },
  error: { fontFamily: F.sans, fontSize: 14, color: C.rust, marginTop: 6 },
  errorEmpty: { height: 0, marginTop: 0, overflow: 'hidden' },
});
