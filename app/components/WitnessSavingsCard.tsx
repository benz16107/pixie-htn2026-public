import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Panel } from './consumer';
import { Button } from './ui';
import { useCommunity } from '@/lib/community-store';
import { useQuote } from '@/lib/store';
import { bundledAutoEstimate } from '@/lib/consumer';
import { C, F, money } from '@/lib/theme';
import { allocateCredit, creditPreview, witnessRewards, type CreditAllocation } from '../../shared/witness-rewards';

export function WitnessSavingsCard({ configure = false, monthly, product: forProduct }: {
  configure?: boolean;
  monthly?: number | null;
  product?: 'home' | 'auto';
}) {
  const { device, reports, loaded, loadError, deviceError, refresh, settings } = useCommunity();
  const { product: selectedProduct, autoListing, autoProfile } = useQuote();
  const product = forProduct ?? selectedProduct;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = loaded && device !== null && !loadError && !deviceError;
  const rewards = witnessRewards(reports, device?.clientId ?? '');
  const allocation = device?.creditAllocation ?? 'split';
  const split = allocateCredit(rewards.earned, allocation);
  const base = monthly !== undefined ? monthly : product === 'auto' ? bundledAutoEstimate(autoListing, autoProfile).monthly : null;
  const preview = creditPreview(base, split[product]);
  async function allocate(value: CreditAllocation) {
    setSaving(true);
    setError('');
    try { await settings({ creditAllocation: value }); }
    catch { setError('Could not save your choice. Try again.'); }
    finally { setSaving(false); }
  }
  return <View style={st.wrap}>
    <Panel>
      <View style={st.heading}><Text accessibilityRole="header" style={st.title}>Community savings</Text><Text style={st.badge}>Simulation</Text></View>
      {deviceError || loadError ? <><Text role="alert" style={st.note}>{deviceError || loadError}</Text>{loadError ? <Button kind="link" label="Refresh savings" onPress={() => { void refresh(); }} /> : null}</> : !available ? <View accessibilityLabel="Loading community savings" style={st.skeleton} /> : <>
        <Text style={st.amount}>{money(rewards.earned)}</Text>
        <Text style={st.note}>{rewards.acceptedCount ? `From ${rewards.acceptedCount} accepted witness contribution${rewards.acceptedCount === 1 ? '' : 's'}.` : 'Share a witness perspective. Earn credit when a reviewer accepts it.'}</Text>
        {rewards.pending > 0 ? <Text style={st.pending}>{money(rewards.pending)} awaiting review, not included yet.</Text> : null}
        {configure ? <>
          <Text style={st.label}>Put my credit toward</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Credit allocation" style={st.choices}>
            {(['split', 'home', 'auto'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === 'split' ? 'Split credit between Home and Auto' : `Apply credit to ${value === 'home' ? 'Home' : 'Auto'}`} aria-checked={allocation === value} accessibilityState={{ checked: allocation === value, disabled: saving }} disabled={saving} onPress={() => { void allocate(value); }} style={[st.choice, allocation === value && st.selected]}><Text style={[st.choiceText, allocation === value && { color: C.ochre }]}>{value === 'split' ? 'Split equally' : value === 'home' ? 'Home' : 'Auto'}</Text></Pressable>)}
          </View>
        </> : null}
        <View accessibilityLiveRegion="polite" style={st.breakdown}>
          <View style={st.share}><Text style={st.note}>Home credit</Text><Text style={st.value}>{money(split.home)}</Text></View>
          <View style={st.share}><Text style={st.note}>Auto credit</Text><Text style={st.value}>{money(split.auto)}</Text></View>
        </View>
        {rewards.earned > 0 ? <View style={st.receipt}>
          <Text style={st.label}>{product === 'home' ? 'Home' : 'Auto'} next-payment preview</Text>
          {preview ? <><View style={st.row}><Text style={st.note}>Illustrative monthly estimate</Text><Text style={st.figure}>{money(preview.base)}</Text></View><View style={st.row}><Text style={st.note}>One-time witness credit</Text><Text style={st.figure}>−{money(preview.applied)}</Text></View><View style={st.row}><Text style={st.total}>Simulated next payment</Text><Text style={st.total}>{money(preview.nextPayment)}</Text></View>{preview.remaining > 0 ? <Text style={st.note}>{money(preview.remaining)} unused credit remains in this scenario.</Text> : null}</> : <Text style={st.note}>{money(split[product])} available toward one payment. Complete your estimate to see the total.</Text>}
        </View> : null}
        {configure ? <Text style={st.note}>One shared balance. Splitting it allocates half to each policy.</Text> : <Button kind="link" label="Choose where to use my credit" onPress={() => router.push('/decide')} />}
        {error ? <Text role="alert" style={st.error}>{error}</Text> : null}
      </>}
      <Text style={st.disclosure}>Prototype credit only. No cash value or insurer-approved discount. Your quoted premium stays unchanged.</Text>
      {!configure ? <Button kind="link" label="Browse witness requests" onPress={() => router.push('/road-help?role=bystander')} /> : null}
    </Panel>
  </View>;
}
const st = StyleSheet.create({
  wrap: { marginTop: 20 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 20, color: C.ink },
  badge: { color: C.ochre, backgroundColor: C.ochreSoft, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, fontSize: 11, fontWeight: '600' },
  amount: { fontFamily: F.sansBold, fontSize: 36, fontWeight: '600', color: C.ochre, letterSpacing: -1, marginTop: 16, fontVariant: ['tabular-nums'] },
  note: { fontFamily: F.sans, color: C.dim, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  pending: { fontSize: 13, lineHeight: 19, color: C.dim, marginTop: 8 },
  label: { fontWeight: '600', fontFamily: F.sansBold, fontSize: 14, color: C.ink, marginTop: 14, marginBottom: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { flex: 1, minWidth: 70, minHeight: 44, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.background, borderWidth: 1, borderColor: C.rule },
  selected: { backgroundColor: C.ochreSoft, borderColor: C.ochre },
  choiceText: { color: C.dim, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  breakdown: { flexDirection: 'row', gap: 16, marginTop: 18, marginBottom: 10 },
  share: { flex: 1 },
  value: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 21, color: C.ink, marginTop: 3, fontVariant: ['tabular-nums'] },
  receipt: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.rule, paddingBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginBottom: 9 },
  figure: { fontFamily: F.sans, color: C.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
  total: { flexShrink: 1, fontWeight: '600', fontSize: 16, lineHeight: 21, color: C.ochre, fontVariant: ['tabular-nums'] },
  disclosure: { fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: C.dim, marginTop: 14 },
  error: { color: C.rust, fontSize: 14, marginTop: 10 },
  skeleton: { height: 108, backgroundColor: C.land, borderRadius: 10, marginTop: 16 },
});
