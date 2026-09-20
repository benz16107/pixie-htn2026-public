import type { ReactNode } from 'react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Dim, Kicker } from '@/components/ui';
import { AppIcon, type IconName } from '@/components/AppIcon';
import type { ConsumerProduct } from '@/lib/consumer';
import { C, F } from '@/lib/theme';

export function ConsumerHeader({ title = 'Your insurance', detail = 'Home and auto, all in one place.' }: { title?: string; detail?: string }) {
  return <View style={st.header}>
    <View style={{ flex: 1 }}><Text accessibilityRole="header" style={st.headerTitle}>{title}</Text><Text style={st.headerDetail}>{detail}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="About Pixie and your data" onPress={() => router.push('/about')} style={({ pressed }) => [st.info, pressed && st.pressed]}><AppIcon name="info" size={24} /></Pressable>
  </View>;
}

export function ProductSwitch({ product, onChange }: { product: ConsumerProduct; onChange: (product: ConsumerProduct) => void }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel="Insurance product" style={st.switch}>
    {(['home', 'auto'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: product === value }} accessibilityLabel={value === 'home' ? 'Home insurance' : 'Auto insurance'} onPress={() => { onChange(value); if (Platform.OS !== 'web') void Haptics.selectionAsync(); }} style={({ pressed }) => [st.switchOption, product === value && st.switchOptionOn, pressed && st.pressed]}>
      <AppIcon name={value === 'home' ? 'home' : 'car'} size={18} color={product === value ? C.ink : C.dim} /><Text style={[st.switchText, product === value && st.switchTextOn]}>{value === 'home' ? 'Home' : 'Auto'}</Text>
    </Pressable>)}
  </View>;
}

export function Panel({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'ink' | 'warm' }) {
  return <View style={[st.panel, tone === 'ink' && st.panelInk, tone === 'warm' && st.panelWarm]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={st.section}>{children}</Text>;
}

export function SourceMark({ live }: { live: boolean }) {
  return <Text accessibilityLabel={live ? 'Estimate calculated by the connected service' : 'Illustrative estimate calculated on this device'} style={st.source}>{live ? 'Connected estimate' : 'Illustrative estimate'}</Text>;
}

export function ActionCard({ title, detail, meta, onPress, selected = false, icon = 'document' }: { title: string; detail: string; meta?: string; onPress: () => void; selected?: boolean; icon?: IconName }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [st.action, selected && st.actionOn, pressed && st.pressed]}>
    <View style={st.iconTile}><AppIcon name={icon} /></View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={st.actionTitle}>{title}</Text><Dim style={st.actionDetail}>{detail}</Dim>{meta ? <Text style={st.actionMeta}>{meta}</Text> : null}</View>
    <AppIcon name="chevron" size={14} color={C.dim} />
  </Pressable>;
}

export function ChecklistItem({ title, detail, checked, onPress }: { title: string; detail: string; checked: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [st.checkRow, pressed && st.pressed]}>
    <View style={[st.checkbox, checked && st.checkboxOn]}>{checked ? <AppIcon name="check" size={15} color={C.paper} /> : null}</View>
    <View style={{ flex: 1 }}><Text style={st.actionTitle}>{title}</Text><Dim style={st.actionDetail}>{detail}</Dim></View>
  </Pressable>;
}

export function MiniStat({ value, label, inverse = false }: { value: string; label: string; inverse?: boolean }) {
  return <View style={st.stat}><Text style={[st.statValue, inverse && st.statValueInverse]}>{value}</Text><Kicker style={inverse ? st.statLabelInverse : undefined}>{label}</Kicker></View>;
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 12, paddingBottom: 24 },
  headerTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 34, lineHeight: 40, letterSpacing: -1, color: C.ink },
  headerDetail: { marginTop: 6, fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.dim },
  info: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', padding: 3, backgroundColor: C.land, borderRadius: 12, gap: 3 },
  switchOption: { flex: 1, minHeight: 44, borderRadius: 9, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  switchOptionOn: { backgroundColor: C.paper },
  switchText: { fontFamily: F.sansMedium, fontWeight: '500', fontSize: 15, color: C.dim },
  switchTextOn: { color: C.ink },
  pressed: { opacity: 0.6 },
  section: { fontFamily: F.sansBold, fontWeight: '600', color: C.ink, fontSize: 20, letterSpacing: -0.3, marginTop: 28, marginBottom: 12 },
  panel: { borderRadius: 20, padding: 20, backgroundColor: C.paper, marginBottom: 12, gap: 2 },
  panelInk: { backgroundColor: C.deep },
  panelWarm: { backgroundColor: C.paper },
  source: { fontFamily: F.sans, fontSize: 12, color: C.dim },
  iconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.ochreSoft, justifyContent: 'center', alignItems: 'center' },
  action: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.paper, borderRadius: 18, padding: 16, marginBottom: 10 },
  actionOn: { backgroundColor: C.ochreSoft },
  actionTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, lineHeight: 22, color: C.ink },
  actionDetail: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  actionMeta: { marginTop: 7, color: C.dim, fontSize: 12 },
  checkRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.paper, borderRadius: 16, padding: 16, marginBottom: 8 },
  checkbox: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: C.dim, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.ochre, borderColor: C.ochre },
  stat: { flex: 1, minWidth: 90, paddingVertical: 10 },
  statValue: { fontFamily: F.sansBold, fontWeight: '600', fontVariant: ['tabular-nums'], fontSize: 23, color: C.ink, marginBottom: 5 },
  statValueInverse: { color: C.paper },
  statLabelInverse: { color: '#D1DBE7' },
});
