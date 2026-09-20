import { WitnessSavingsCard } from '@/components/WitnessSavingsCard';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { Redirect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Body, Button, Dim, Kicker, Mono, Progress, Screen, Title } from '@/components/ui';
import { quoteTenant, WEB_URL, type Answers, type QuoteResult, type QuoteView, type ReceiptLine } from '@/lib/api';
import { useQuote } from '@/lib/store';
import { C, F, money } from '@/lib/theme';

const enter = (i: number) => FadeInDown.duration(220).delay(60 + i * 60).reduceMotion(ReduceMotion.System);
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

// The words the device reads: the decision, the price, and the top two factors by
// dollar impact -- never a number the receipt does not already show.
function quoteSpeechText(q: QuoteView): string {
  const top = [...q.receipt.lines]
    .filter((l) => l.dollars !== 0)
    .sort((a, b) => Math.abs(b.dollars) - Math.abs(a.dollars))
    .slice(0, 2);
  const factors = top.map((l) => `${l.label}, ${l.dollars > 0 ? 'adding' : 'saving'} ${money(Math.abs(l.dollars))}`).join('. ');
  const verdict = q.decision.kind === 'approve' ? 'Your estimate is ready' : 'Your quote needs an advisor to review it';
  return `${verdict}, at ${money(q.annual)} a year, about ${money(q.monthly)} a month. ${factors ? `The biggest factors: ${factors}.` : ''} ${q.label}`;
}

function receiptHtml(q: QuoteView): string {
  const row = (label: string, dollars: number, source: string, capped = false) => `
    <tr>
      <td style="padding:6px 0;font-family:-apple-system,sans-serif;font-size:14px;">${label}${capped ? ' <b>(capped)</b>' : ''}<div style="font-size:11px;color:#586E73;">${source}</div></td>
      <td style="padding:6px 0;text-align:right;font-family:Menlo,monospace;font-size:14px;white-space:nowrap;">${dollars >= 0 ? '+' : '−'}$${Math.abs(dollars).toFixed(2)}</td>
    </tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;color:#17343A;padding:24px;}
    table{width:100%;border-collapse:collapse;} tr{border-top:1px solid #C1D0D2;}
    h1{font-size:22px;margin:0 0 4px;} h2{font-size:32px;margin:4px 0 12px;}
  </style></head><body>
    <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#586E73;">${q.address}</div>
    <h1>${q.decision.kind === 'approve' ? 'Estimate ready' : 'Referred to an advisor'} · #${q.caseId}</h1>
    <h2>${money(q.annual)} <span style="font-size:16px;color:#586E73;">a year, about ${money(q.monthly)} a month</span></h2>
    <table>
      ${row('Base price', q.receipt.base, '$20,000 contents, $1M liability, $1,000 deductible (invented constant)')}
      ${q.receipt.lines.map((l) => row(l.label, l.dollars, l.source, l.capped)).join('')}
      <tr style="border-top:2px solid #17343A;"><td style="padding-top:10px;font-weight:600;">Total</td><td style="padding-top:10px;text-align:right;font-family:Menlo,monospace;font-weight:600;">${money(q.annual)}</td></tr>
    </table>
    <p style="font-size:12px;color:#586E73;margin-top:18px;">${q.label}</p>
  </body></html>`;
}

function Line({ l, i }: { l: ReceiptLine; i: number }) {
  const sign = l.dollars > 0 ? '+' : '';
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${l.label}: ${l.dollars === 0 ? 'no change' : `${l.dollars > 0 ? 'plus' : 'minus'} ${money(Math.abs(l.dollars))}`}. ${open ? 'Hide' : 'Show'} source.`}
      onPress={() => setOpen((shown) => !shown)}
    >
      {({ pressed }) => (
        <Animated.View entering={enter(i)} style={[st.line, pressed && { opacity: 0.65 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={st.lineLabel}>{l.label}</Text>
            {l.capped ? <Text style={st.cap}>CAPPED</Text> : null}
            <View style={st.leader} />
            <Mono style={st.amount}>
              {sign}
              {money(l.dollars)}
            </Mono>
            <Text style={st.disclosure}>{open ? '−' : '+'}</Text>
          </View>
          {open ? (
            <Dim style={{ fontSize: 13, lineHeight: 18, marginTop: 5 }}>
              {!l.source.startsWith('your answer') ? `Applied ×${l.multiplier.toFixed(2)}. ` : ''}{l.source}
            </Dim>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}

const describe = (a: Answers) =>
  `${a.unitLevel} unit, $${a.contentsValue.toLocaleString('en-US')} contents, $${a.deductible.toLocaleString('en-US')} deductible, $${a.liability / 1e6}M liability`;

export default function QuoteScreen() {
  const { place, answers, setPlace } = useQuote();
  const [res, setRes] = useState<QuoteResult | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (!place) return;
    let live = true;
    quoteTenant(place, answers).then((r) => {
      if (!live) return;
      setRes(r);
      if ('quote' in r && Platform.OS !== 'web')
        Haptics.notificationAsync(
          r.quote.decision.kind === 'approve' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [place, answers]);

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  if (!place) return <Redirect href="/" />;
  if (!res)
    return (
      <Screen>
        <Kicker>{place.address}</Kicker>
        <View style={[st.skeleton, { height: 90 }]} accessibilityLabel="Working out your quote" accessible />
        <View style={[st.skeleton, { height: 220 }]} />
      </Screen>
    );
  if ('error' in res)
    return (
      <Screen footer={<Button label="Try an example address" onPress={() => router.dismissTo('/')} />}>
        <Title style={{ fontSize: 26 }}>We could not price this address</Title>
        <Body style={{ marginTop: 8 }} role="alert">
          {res.error}
        </Body>
      </Screen>
    );

  const q = res.quote;
  const approve = q.decision.kind === 'approve';
  const cents = Math.round(q.receipt.base * 100) + q.receipt.lines.reduce((s, l) => s + Math.round(l.dollars * 100), 0);
  const exact = cents === Math.round(q.annual * 100);
  const differs = res.offline && describe(q.answers) !== describe(answers);

  const readAloud = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSpeaking(true);
    Speech.speak(quoteSpeechText(q), { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const sharePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(q) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Your Pixie quote' });
        setShareStatus('Your itemised PDF receipt is ready to keep or send to an advisor.');
      } else {
        setShareStatus('This device cannot open a share sheet. Use the web receipt instead.');
      }
    } catch {
      setShareStatus('We could not create the PDF on this device. Your web receipt is still available.');
    }
  };

  const openAdvisorHandoff = () => WebBrowser.openBrowserAsync(`${WEB_URL}${q.underwriterUrl}`);

  return (
    <Screen
      footer={
        <>
          <Button
            label={approve ? 'Save and share my receipt' : 'Open the advisor handoff'}
            hint={approve ? 'Creates a PDF with the price and every source' : 'Opens this exact case for a licensed advisor'}
            onPress={approve ? sharePdf : openAdvisorHandoff}
          />
          <Button
            kind="link"
            label="Open the web receipt"
            hint="Opens the same estimate and sourced facts in your browser"
            onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/intact/cases/${q.caseId}`)}
          />
        </>
      }
    >
      <Progress current={3} total={3} labels={['Address', 'Coverage', 'Estimate']} />
      <Kicker>{q.address}</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <Text accessibilityLabel={approve ? 'Estimate ready' : 'Referred to an advisor'} style={[st.chip, approve ? st.approve : st.refer]}>{approve ? 'ESTIMATE READY' : 'REFERRED'}</Text>
        <Mono accessibilityLabel={`Quote ${q.caseId}`} style={{ color: C.dim }}>#{q.caseId}</Mono>
      </View>
      <Text style={st.price}>
        {money(q.annual)}
        <Text style={st.per}> a year</Text>
      </Text>
      <Dim>About {money(q.monthly)} a month</Dim>
      {q.decision.reasons.map((r) => (
        <Body key={r} style={{ marginTop: 6 }}>
          {r.replace('last 3 years', 'last 5 years')}
        </Body>
      ))}
      {differs ? (
        <Text style={st.note}>
          Offline sample: this is the cached quote for {describe(q.answers)}. Connect to the quote service to price your answers.
        </Text>
      ) : null}

      <WitnessSavingsCard product="home" monthly={approve && !differs ? q.monthly : null} configure />
      <View style={st.coverageCard}>
        <View style={{ flex: 1 }}>
          <Kicker>Your coverage</Kicker>
          <Text style={st.coverageValue}>{usd(q.answers.contentsValue)} things · {usd(q.answers.deductible)} deductible</Text>
          <Dim style={{ fontSize: 13 }}>{q.answers.liability / 1e6}M liability · {q.answers.unitLevel} unit · {q.answers.claims3yr || 0} claims</Dim>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit your coverage" hitSlop={8} onPress={() => router.push('/questions/1')} style={st.editButton}>
          <Text style={st.editText}>Edit</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" label={speaking ? 'Stop listening' : 'Listen to my quote'} hint="Speaks the decision and the biggest factors aloud" onPress={readAloud} />
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" label="Edit coverage" hint="Returns to the coverage choices" onPress={() => router.push('/questions/1')} />
        </View>
      </View>
      {shareStatus ? <Text accessibilityLiveRegion="polite" style={st.shareStatus}>{shareStatus}</Text> : null}
      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Kicker>Why this price</Kicker>
          <Kicker style={{ color: exact ? C.moss : C.rust }}>{exact ? 'Receipt verified' : 'Check receipt'}</Kicker>
        </View>
        <Dim style={{ fontSize: 13, marginBottom: 8 }}>Tap a line to see its source and the exact multiplier.</Dim>
        <View style={[st.line, { borderTopColor: C.ink, borderTopWidth: 1.5 }]} accessible accessibilityLabel={`Base price ${money(q.receipt.base)}: $20,000 contents, $1 million liability, $1,000 deductible`}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={st.lineLabel}>Base price</Text>
            <View style={st.leader} />
            <Mono style={st.amount}>{money(q.receipt.base)}</Mono>
          </View>
          <Dim style={{ fontSize: 13 }}>$20,000 contents, $1M liability, $1,000 deductible (invented constant)</Dim>
        </View>
        {q.receipt.lines.map((l, i) => (
          <Line key={l.label} l={l} i={i} />
        ))}
        <Animated.View entering={enter(q.receipt.lines.length)} style={[st.line, st.total]}>
          <Text style={[st.lineLabel, { fontFamily: F.sansBold }]}>Total</Text>
          <View style={st.leader} />
          <Mono style={[st.amount, { fontFamily: F.monoMedium, fontWeight: '500', fontSize: 17 }]}>{money(cents / 100)}</Mono>
        </Animated.View>
        <Text style={st.label}>{q.label}</Text>

      </View>

      {q.recommendations.length ? (
        <View style={st.rec}>
          <Kicker style={{ color: C.ochre }}>We recommend</Kicker>
          {q.recommendations.map((r) => (
            <View key={r.addOn} style={{ marginTop: 6 }}>
              <Text style={st.lineLabel}>{r.addOn}</Text>
              <Body style={{ fontSize: 15 }}>{r.why}</Body>
            </View>
          ))}
        </View>
      ) : null}

      <Kicker style={{ marginTop: 22, marginBottom: 4 }}>Next step</Kicker>
      <Body>{q.decision.nextStep}</Body>
      <Dim style={{ fontSize: 13, marginTop: 14 }}>
        No age, sex, income, ethnicity or credit is used. Location factors only price the peril they measure, and each is capped.
      </Dim>
      <Button kind="link" label="How the price is made" onPress={() => router.push('/about')} />
      {!approve ? <Button kind="link" label="Save a PDF copy" hint="Creates an itemised receipt for you to keep" onPress={sharePdf} /> : null}
      <Button
        kind="link"
        label="Start a new quote"
        onPress={() => {
          setPlace(null);
          router.dismissTo('/');
        }}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  skeleton: { backgroundColor: C.land, borderRadius: 12, marginTop: 14 },
  chip: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 11, letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  approve: { backgroundColor: C.moss, borderColor: C.moss, color: C.paper },
  refer: { backgroundColor: C.ochreSoft, borderColor: C.ochre, color: C.ink },
  price: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 46, lineHeight: 52, color: C.ink, marginTop: 8, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  per: { fontFamily: F.sans, fontSize: 18, color: C.dim },
  note: { fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink, backgroundColor: C.ochreSoft, padding: 12, borderRadius: 12, marginTop: 12 },
  coverageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.rule, backgroundColor: C.paper },
  coverageValue: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 15, color: C.ink, marginTop: 4 },
  editButton: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 14, color: C.rust, textDecorationLine: 'underline' },
  shareStatus: { fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.moss, marginTop: 10 },
  line: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.rule, borderStyle: 'dashed' },
  lineLabel: { fontFamily: F.sansMedium, fontWeight: '500', fontSize: 16, color: C.ink, flexShrink: 1 },
  leader: { flex: 1, minWidth: 8 },
  amount: { fontFamily: F.mono, fontSize: 15, color: C.ink, minWidth: 72, textAlign: 'right' },
  disclosure: { width: 14, fontFamily: F.sansBold, fontWeight: '600', fontSize: 16, color: C.dim, textAlign: 'right' },
  cap: { fontFamily: F.monoMedium, fontWeight: '500', fontSize: 10, letterSpacing: 1, color: C.ink, borderWidth: 1, borderColor: C.ink, paddingHorizontal: 4, borderRadius: 3 },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: 8, borderTopColor: C.ink, borderTopWidth: 2, borderStyle: 'solid' },
  label: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginTop: 6 },
  rec: { marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: C.ochreSoft },
});
