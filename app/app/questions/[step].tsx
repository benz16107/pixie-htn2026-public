import { AppIcon } from '@/components/AppIcon';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Redirect, router, Stack } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Dim, Kicker, Progress, Screen, Title } from '@/components/ui';
import type { Answers } from '@/lib/api';
import { useQuote } from '@/lib/store';
import { C, CONTENTS_MAX as MAX, CONTENTS_MIN as MIN, CONTENTS_STEP as STEP, F } from '@/lib/theme';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

function choose(onPress: () => void) {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  onPress();
}

function Options<T extends string | number>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: { value: T; label: string; note?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={st.options}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={String(item.value)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${item.label}${item.note ? `. ${item.note}` : ''}`}
            onPress={() => choose(() => onChange(item.value))}
            style={({ pressed }) => [st.option, selected && st.optionOn, pressed && st.optionPressed]}
          >
            <Text style={[st.optionLabel, selected && st.optionLabelOn]}>{item.label}</Text>
            {item.note ? <Text style={[st.optionNote, selected && st.optionNoteOn]}>{item.note}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHead}>
        <Text style={st.sectionNumber}>{number}</Text>
        <Text style={st.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label === '−' ? 'Decrease' : 'Increase'} by ${usd(STEP)}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [st.step, pressed && st.optionPressed, disabled && st.disabled]}
    >
      <Text style={st.stepText}>{label}</Text>
    </Pressable>
  );
}

function Contents({ answers, setAnswers }: { answers: Answers; setAnswers: (patch: Partial<Answers>) => void }) {
  const value = answers.contentsValue;
  const lastDetent = useRef(value);
  const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));
  const update = (n: number) => {
    const next = clamp(Math.round(n / STEP) * STEP);
    if (next !== lastDetent.current && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    lastDetent.current = next;
    setAnswers({ contentsValue: next });
  };
  const annualChange = ((value - 20_000) / 1_000) * 4;

  return (
    <>
      <View style={st.valueRow}>
        <Text style={st.big} accessibilityLiveRegion="polite" accessibilityLabel={`Contents coverage ${usd(value)}`}>
          {usd(value)}
        </Text>
        <Text style={st.priceChange}>{annualChange === 0 ? 'BASE PRICE' : `${annualChange > 0 ? '+' : '−'}${usd(Math.abs(annualChange))}/YR`}</Text>
      </View>
      <View style={st.sliderRow}>
        <Stepper label="−" disabled={value <= MIN} onPress={() => update(value - STEP)} />
        <Slider
          style={st.slider}
          minimumValue={MIN}
          maximumValue={MAX}
          step={STEP}
          value={value}
          onValueChange={update}
          minimumTrackTintColor={C.ochre}
          maximumTrackTintColor={C.rule}
          thumbTintColor={C.ink}
          accessibilityLabel="Contents coverage"
          accessibilityValue={{ min: MIN, max: MAX, now: value, text: usd(value) }}
        />
        <Stepper label="+" disabled={value >= MAX} onPress={() => update(value + STEP)} />
      </View>
      <Dim style={st.help}>Use the replacement cost of your furniture, clothes, electronics and kitchen items. Every $1,000 changes the annual estimate by $4.</Dim>
    </>
  );
}

export default function CoverageScreen() {
  const { place, answers, setAnswers } = useQuote();
  if (!place) return <Redirect href="/" />;

  return (
    <Screen footer={<><Button label="Price this coverage" hint="Creates your estimate and an itemised receipt" onPress={() => router.push('/quote')} /><Button kind="link" label="Explore price changes first" onPress={() => router.push('/coverage-lab')} /></>}>
      <Stack.Screen options={{ title: 'Your coverage' }} />
      <Progress current={2} total={3} labels={['Address', 'Coverage', 'Estimate']} />
      <Kicker>{place.address}</Kicker>
      <Title style={st.title}>Confirm your coverage</Title>
      <Body style={st.lead}>We filled in a common renter setup. Change anything here, then see each choice on your price receipt.</Body>

      <View style={st.fastFill} accessible accessibilityLabel="Fast fill complete. Five details are ready to review.">
        <View style={st.fastFillMark}><AppIcon name="check" size={20} color={C.paper} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.fastFillTitle}>Fast-fill complete</Text>
          <Dim style={{ fontSize: 13 }}>Five details, one review screen</Dim>
        </View>
      </View>

      <Section number="01" title="Where is your unit?">
        <Options
          label="Unit level"
          value={answers.unitLevel}
          onChange={(unitLevel) => setAnswers({ unitLevel })}
          items={[
            { value: 'basement', label: 'Basement', note: 'Below grade' },
            { value: 'ground', label: 'Ground', note: 'Street level' },
            { value: 'upper', label: 'Upper', note: 'Floor 2+' },
          ]}
        />
        <Dim style={st.help}>This tells us whether sewer backup and surface water can reach the unit.</Dim>
      </Section>

      <Section number="02" title="Your things">
        <Contents answers={answers} setAnswers={setAnswers} />
      </Section>

      <Section number="03" title="Deductible">
        <Options
          label="Deductible"
          value={answers.deductible}
          onChange={(deductible) => setAnswers({ deductible })}
          items={[
            { value: 500, label: '$500', note: '12% more' },
            { value: 1000, label: '$1,000', note: 'Standard' },
            { value: 2500, label: '$2,500', note: '12% less' },
          ]}
        />
        <Dim style={st.help}>This is what you pay first when you make a claim.</Dim>
      </Section>

      <Section number="04" title="Liability">
        <Options
          label="Liability limit"
          value={answers.liability}
          onChange={(liability) => setAnswers({ liability })}
          items={[
            { value: 1_000_000, label: '$1 million', note: 'Included' },
            { value: 2_000_000, label: '$2 million', note: '+$12/year' },
          ]}
        />
      </Section>

      <Section number="05" title="Claims in the last 5 years">
        <Options
          label="Claims in the last 5 years"
          value={answers.claims3yr}
          onChange={(claims3yr) => setAnswers({ claims3yr })}
          items={[
            { value: 0, label: 'None', note: 'No change' },
            { value: 1, label: 'One', note: '8% more' },
            { value: 2, label: 'Two or more', note: 'Advisor review' },
          ]}
        />
        <Dim style={st.help}>Two or more claims go to an advisor. Pixie does not guess when the history needs a person.</Dim>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { marginTop: 4, fontSize: 29, lineHeight: 34 },
  lead: { marginTop: 8, color: C.dim },
  fastFill: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: C.land },
  fastFillMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.moss },
  fastFillCheck: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, color: C.paper },
  fastFillTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 15, color: C.ink },
  section: { paddingTop: 22, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.rule },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 11 },
  sectionNumber: { fontFamily: F.monoMedium, fontWeight: '500', fontSize: 11, color: C.ochre },
  sectionTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 18, color: C.ink },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: C.rule, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 10, justifyContent: 'center' },
  optionOn: { borderColor: C.ochre, backgroundColor: C.ochreSoft },
  optionPressed: { opacity: 0.72 },
  optionLabel: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 14, lineHeight: 18, color: C.ink },
  optionLabelOn: { color: C.ochre },
  optionNote: { fontFamily: F.sans, fontSize: 11, lineHeight: 15, color: C.dim, marginTop: 2 },
  optionNoteOn: { color: C.ink },
  help: { fontSize: 13, lineHeight: 18, marginTop: 9, marginBottom: 12 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  big: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 34, color: C.ink, fontVariant: ['tabular-nums'] },
  priceChange: { fontFamily: F.monoMedium, fontWeight: '500', fontSize: 11, color: C.moss },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  slider: { flex: 1, height: 44 },
  step: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: F.monoMedium, fontWeight: '500', fontSize: 22, color: C.ink },
  disabled: { opacity: 0.35 },
});
