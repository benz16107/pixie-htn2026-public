import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { C, F } from '@/lib/theme';

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

export const Title = (p: TextProps) => <Text accessibilityRole="header" {...p} style={[s.title, p.style]} />;
export const Body = (p: TextProps) => <Text {...p} style={[s.body, p.style]} />;
export const Dim = (p: TextProps) => <Text {...p} style={[s.body, s.dim, p.style]} />;
export const Kicker = (p: TextProps) => <Text {...p} style={[s.kicker, p.style]} />;
export const Mono = (p: TextProps) => <Text {...p} style={[s.mono, p.style]} />;

export function Progress({ current, total, labels }: { current: number; total: number; labels?: string[] }) {
  return (
    <View style={s.progressWrap}>
      <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }} style={s.progressTrack}>
        <View style={[s.progressValue, { width: `${(current / total) * 100}%` }]} />
      </View>
      {labels?.length ? (
        <View style={s.progressLabels} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {labels.map((label, i) => (
            <Text key={label} style={[s.progressLabel, i + 1 === current && s.progressLabelOn]}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Press feedback: scale on press-in through a Reanimated CSS transition, 120ms strong ease-out.
function Pressed({ pressed, children, style }: { pressed: boolean; children: ReactNode; style: ViewStyle | ViewStyle[] }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: pressed && !reduced ? 0.98 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: reduced ? 0 : 120,
          transitionTimingFunction: EASE_OUT,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'link';
  hint?: string;
  disabled?: boolean;
};

export function Button({ label, onPress, kind = 'primary', hint, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={kind === 'primary' ? { width: '100%' } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={kind === 'link' ? 8 : 0}
      pressRetentionOffset={16}
    >
      {({ pressed }) => (
        <Pressed pressed={pressed} style={[s.btn, kind === 'primary' ? s.primary : kind === 'secondary' ? s.secondary : s.link, disabled ? s.disabled : {}]}>
          <Text style={[s.btnText, kind === 'primary' ? { color: C.paper } : kind === 'link' ? s.linkText : {}]}>{label}</Text>
        </Pressed>
      )}
    </Pressable>
  );
}

export function Choice({
  title,
  detail,
  selected,
  onPress,
  role = 'radio',
}: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'button';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
    >
      {({ pressed }) => (
        <Pressed pressed={pressed} style={selected ? [s.choice, s.choiceOn] : s.choice}>
          <View style={[s.radio, selected && s.radioOn]} />
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>{title}</Text>
            {detail ? <Text style={[s.body, s.dim, { fontSize: 14 }]}>{detail}</Text> : null}
          </View>
        </Pressed>
      )}
    </Pressable>
  );
}

// A Toronto-block line drawing used once on the entry screen.
export function Contours({ height = 180 }: { height?: number }) {
  const paths = [
    'M-20 42 L112 42 L112 8 M112 42 L214 42 L214 92 L410 92',
    'M-10 118 L68 118 L68 76 L162 76 L162 154 L294 154 L294 118 L410 118',
    'M28 -10 L28 166 M258 -10 L258 72 M348 72 L348 190',
  ];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width="100%" height={height} viewBox={`0 0 390 ${height}`} preserveAspectRatio="xMidYMid slice">
        {paths.map((d, i) => <Path key={d} d={d} fill="none" stroke={i === 1 ? C.ochre : C.hex} strokeWidth={i === 1 ? 2 : 1} opacity={i === 1 ? 0.32 : 0.2} />)}
      </Svg>
    </View>
  );
}

// Scrollable content with a solid bottom action bar above the home indicator. The bar's measured
// height reserves matching scroll padding so the last line of content is never hidden behind it.
export function Screen({ children, footer, scrollRef, topSafe = false }: { children: ReactNode; footer?: ReactNode; scrollRef?: RefObject<ScrollView | null>; topSafe?: boolean }) {
  const inset = useSafeAreaInsets();
  const [footerH, setFooterH] = useState(0);
  const internalScrollRef = useRef<ScrollView>(null);
  const activeScrollRef = scrollRef ?? internalScrollRef;

  useEffect(() => {
    activeScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeScrollRef]);

  return (
    <View style={{ flex: 1, backgroundColor: C.background, paddingTop: topSafe ? inset.top : 0 }}>
      <ScrollView ref={activeScrollRef} contentContainerStyle={{ paddingBottom: 32 + (footer ? footerH : 0) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={s.screenInner}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
          style={[s.footer, { paddingBottom: Math.max(inset.bottom, 12) }]}
        >
          <View style={s.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screenInner: { width: '100%', maxWidth: 660, minWidth: 0, boxSizing: 'border-box', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 32, lineHeight: 38, color: C.ink, letterSpacing: -0.8 },
  body: { fontFamily: F.sans, fontSize: 17, lineHeight: 24, color: C.ink },
  dim: { color: C.dim },
  kicker: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 13, letterSpacing: 0.1, color: C.dim },
  mono: { fontFamily: F.mono, fontSize: 14, color: C.ink, fontVariant: ['tabular-nums'] },
  btn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: C.ochre },
  secondary: { backgroundColor: C.ochreSoft },
  link: { minHeight: 44, paddingHorizontal: 4 },
  disabled: { opacity: 0.45 },
  btnText: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, color: C.ochre },
  linkText: { color: C.ochre, fontFamily: F.sansMedium, fontWeight: '500' },
  choice: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', minHeight: 62, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: C.rule, backgroundColor: C.paper, marginBottom: 10 },
  choiceOn: { borderColor: C.ochre, borderWidth: 1.5, backgroundColor: C.ochreSoft },
  choiceTitle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, color: C.ink, marginBottom: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.dim, marginTop: 2 },
  radioOn: { borderColor: C.ochre, borderWidth: 6 },
  progressWrap: { marginBottom: 20 },
  progressTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: C.rule },
  progressValue: { height: '100%', borderRadius: 2, backgroundColor: C.ochre },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressLabel: { fontFamily: F.sansMedium, fontWeight: '500', fontSize: 11, color: C.dim },
  progressLabelOn: { color: C.ink, fontFamily: F.sansBold, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', borderTopWidth: 1, borderTopColor: C.rule, backgroundColor: C.paper, paddingTop: 12, gap: 6 },
  footerInner: { width: '100%', maxWidth: 660, minWidth: 0, boxSizing: 'border-box', alignSelf: 'center', paddingHorizontal: 20, gap: 6 },
});
