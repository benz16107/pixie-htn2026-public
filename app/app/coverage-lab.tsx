import { WitnessSavingsCard } from '@/components/WitnessSavingsCard';
import { useEffect, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Panel, SectionLabel } from '@/components/consumer';
import { Body, Button, Kicker, Screen, Title } from '@/components/ui';
import { EXAMPLES, quoteTenant, type Answers, type Place } from '@/lib/api';
import { quoteAuto, type AutoProfile } from '@/lib/consumer';
import { useQuote } from '@/lib/store';
import { C, F, money } from '@/lib/theme';

type Result = { key: string; monthly: number; baseline: number; annual: number; review: boolean; reasons: string[]; live: boolean; lines: {label:string;dollars:number;source:string}[] };
function Options<T extends string | number>({ label, value, options, onChange }: {label:string;value:T;options:{value:T;label:string}[];onChange:(value:T)=>void}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={st.options}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} aria-checked={value===option.value} accessibilityState={{checked:value===option.value}} onPress={() => {onChange(option.value); if(Platform.OS!=='web') void Haptics.selectionAsync().catch(() => {});}} style={[st.option,value===option.value && st.optionOn]}><Text style={[st.optionText,value===option.value && {color:C.ochre}]}>{option.label}</Text></Pressable>)}</View>;
}
function Control({ title, children }: {title:string;children:ReactNode}) { return <View style={{marginTop:18}}><Text style={st.controlTitle}>{title}</Text>{children}</View>; }

export default function CoverageLab() {
  const { product, place, answers, autoListing, autoProfile, setAnswers, setAutoProfile, setPlace } = useQuote();
  const home = product === 'home';
  const [baseAnswers] = useState(answers);
  const [baseAuto] = useState(autoProfile);
  const [draft, setDraft] = useState<Answers>(answers);
  const [auto, setAuto] = useState<AutoProfile>(autoProfile);
  const [address, setAddress] = useState<Place|null>(place);
  const [result, setResult] = useState<Result|null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loss, setLoss] = useState(5000);
  const key = JSON.stringify({home,address,draft,auto,vehicle:autoListing.id,retry});
  const current = result?.key === key ? result : null;
  const canCalculate = !home || !!address;

  useEffect(() => {
    let active = true;
    setError('');
    if (!canCalculate) return;
    const timeout = setTimeout(async () => {
      try {
        if (home && address) {
          const [before, after] = await Promise.all([quoteTenant(address, baseAnswers),quoteTenant(address,draft)]);
          if ('error' in before || 'error' in after) throw new Error('The estimate service is unavailable. Reconnect and try again.');
          if (before.offline || after.offline) throw new Error('Connect to the estimate service to price changed coverage. Cached prices cannot price these choices.');
          if (active) setResult({key,monthly:after.quote.monthly,baseline:before.quote.monthly,annual:after.quote.annual,review:after.quote.decision.kind==='refer',reasons:after.quote.decision.reasons,live:true,lines:after.quote.receipt.lines});
        } else {
          const [before,after] = await Promise.all([quoteAuto(autoListing,baseAuto),quoteAuto(autoListing,auto)]);
          if ('error' in before || 'error' in after) throw new Error('The vehicle estimate could not be calculated.');
          if (before.source !== after.source) throw new Error('The connection changed during comparison. Try again to compare both prices using the same service.');
          if (active) setResult({key,monthly:after.estimate.monthly,baseline:before.estimate.monthly,annual:after.estimate.annual,review:after.estimate.decision.kind==='advisor_review',reasons:after.estimate.decision.reasons,live:after.source==='shared-api',lines:after.estimate.factors});
        }
      } catch(cause) { if(active) setError(cause instanceof Error ? cause.message : 'This estimate is unavailable.'); }
    },350);
    return () => {active=false;clearTimeout(timeout);};
  },[key]);

  const deductible = home ? draft.deductible : auto.deductible;
  const yourShare = Math.min(loss,deductible);
  const delta = current ? Math.round((current.monthly-current.baseline)*100)/100 : 0;
  return <Screen footer={<>
    <View style={st.footerPrice} accessibilityLiveRegion="polite">
      <Text style={st.amount}>{current ? current.review ? 'Advisor review' : `${money(current.monthly)} / month` : error ? 'Estimate unavailable' : canCalculate ? 'Updating estimate…' : 'Choose an address'}</Text>
      {current && !current.review ? <Text style={st.note}>{delta===0 ? 'No price change' : `${money(Math.abs(delta))} ${delta<0?'less':'more'} / mo`}</Text> : null}
    </View>
    <Button label="Save choices and review" disabled={!current} onPress={() => { if (!current) return; if(home && address){setPlace(address);setAnswers(draft);router.push('/questions/1');}else{setAutoProfile(auto);router.dismissTo('/decide');} }} /></>}>
    <Title>Make it yours.</Title><Body style={st.lead}>Move a choice. See the price change. Your saved setup stays the same until you choose to keep it.</Body>
    {home && !address ? <Panel><Text style={st.controlTitle}>Start with a place</Text><Body style={st.note}>Use your address for a personal scenario, or explore a clearly labelled Toronto example.</Body><Button label="Enter my address" onPress={() => router.push('/home-quote')} /><Button kind="link" label="Try 180 Queen St W" onPress={() => setAddress(EXAMPLES[0])} /></Panel> : null}
    <Panel>
      <Kicker>{home ? address?.address ?? 'Tenant estimate' : `${autoListing.make} ${autoListing.model}`}{home && address && !place ? ' · Example address' : ''}</Kicker>
      {!canCalculate ? <Text style={st.pending}>Choose an address to see a price.</Text> : error ? <><Text role="alert" style={st.error}>{error}</Text><Button kind="link" label="Retry estimate" onPress={() => setRetry(n=>n+1)} /></> : current ? <>
        {current.review ? <><Text style={st.review}>An advisor needs to review this setup.</Text>{current.reasons.map(reason=><Text key={reason} style={st.note}>{reason}</Text>)}</> : <><Text accessibilityLiveRegion="polite" style={st.price}>{money(current.monthly)}<Text style={st.unit}> / month</Text></Text><Text style={[st.delta,{color:delta<0?C.moss:C.dim}]}>{delta===0 ? 'Same price as your saved choices' : `${money(Math.abs(delta))} ${delta<0?'less':'more'} per month than your saved choices`}</Text><View style={st.comparison}><Text style={st.note}>Saved {money(current.baseline)}/mo</Text><Text style={st.note}>New {money(current.annual)}/yr</Text></View></>}
        <Text style={st.note}>{current.live ? 'Calculated by the estimate service.' : 'Calculated on-device from example prices.'} Illustrative, not an insurance offer.</Text>
      </> : <View accessibilityLabel="Updating your estimate" style={{marginVertical:18,gap:10}}><View style={st.skeleton}/><View style={[st.skeleton,{width:'65%',height:14}]}/></View>}
    </Panel>
    <SectionLabel>Your choices</SectionLabel><Panel>
      {home ? <><Control title={`Contents coverage · $${draft.contentsValue.toLocaleString()}`}><Slider accessibilityLabel="Contents coverage amount" accessibilityValue={{min:10000,max:100000,now:draft.contentsValue}} minimumValue={10000} maximumValue={100000} step={5000} value={draft.contentsValue} onValueChange={value=>setDraft(d=>({...d,contentsValue:value}))} minimumTrackTintColor={C.ochre} maximumTrackTintColor={C.land} thumbTintColor={C.ochre} style={{height:44}}/><Text style={st.note}>Replacement value of your belongings.</Text></Control><Control title="Liability limit"><Options label="Liability limit" value={draft.liability} options={[{value:1000000,label:'$1 million'},{value:2000000,label:'$2 million'}]} onChange={liability=>setDraft(d=>({...d,liability}))}/></Control></> : <><Control title="Distance each year"><Options label="Annual distance" value={auto.annualKmBand} options={[{value:'under_10000',label:'Under 10k km'},{value:'10000_20000',label:'10–20k km'},{value:'over_20000',label:'Over 20k km'}]} onChange={annualKmBand=>setAuto(a=>({...a,annualKmBand}))}/></Control><Control title="Where you park"><Options label="Parking" value={auto.parking} options={[{value:'garage',label:'Garage'},{value:'driveway',label:'Driveway'},{value:'street',label:'Street'}]} onChange={parking=>setAuto(a=>({...a,parking}))}/></Control></>}
      <Control title="Your deductible">{home ? <Options label="Deductible" value={draft.deductible} options={[{value:500,label:'$500'},{value:1000,label:'$1,000'},{value:2500,label:'$2,500'}]} onChange={deductible=>setDraft(d=>({...d,deductible}))}/> : <Options label="Deductible" value={auto.deductible} options={[{value:500,label:'$500'},{value:1000,label:'$1,000'},{value:2000,label:'$2,000'}]} onChange={deductible=>setAuto(a=>({...a,deductible}))}/>}</Control>
      <Button kind="link" label="Reset to saved choices" onPress={()=>{setDraft(baseAnswers);setAuto(baseAuto);}}/>
    </Panel>
    <WitnessSavingsCard configure monthly={current && !current.review ? current.monthly : null} />
    <SectionLabel>What does a deductible mean?</SectionLabel><Panel><Text style={st.controlTitle}>Try a repair bill</Text><Options label="Example repair bill" value={loss} options={[{value:1000,label:'$1,000'},{value:5000,label:'$5,000'},{value:10000,label:'$10,000'}]} onChange={setLoss}/><View style={st.lossTrack}><View style={{width:`${yourShare/loss*100}%`,backgroundColor:C.ochre}}/><View style={{flex:1,backgroundColor:C.land}}/></View><View style={st.comparison}><View><Text style={st.amount}>{money(yourShare)}</Text><Text style={st.note}>Up to your deductible</Text></View><View><Text style={st.amount}>{money(loss-yourShare)}</Text><Text style={st.note}>Remaining bill</Text></View></View><Text style={st.note}>Arithmetic example only, assuming a covered loss. Actual payment depends on policy limits, exclusions, and your insurer's review.</Text></Panel>
    {current?.lines.length ? <><SectionLabel>Behind this price</SectionLabel><Panel>{current.lines.map((line,i)=><View key={`${line.label}-${i}`} style={st.receipt}><View style={st.comparison}><Text style={st.receiptTitle}>{line.label}</Text><Text style={st.amount}>{money(line.dollars)}</Text></View><Text style={st.note}>{line.source}</Text></View>)}</Panel></> : null}
  </Screen>;
}
const st=StyleSheet.create({
  footerPrice:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:6},lead:{color:C.dim,marginTop:10,marginBottom:20},price:{fontFamily:F.sansBold,fontWeight:'600',fontSize:40,letterSpacing:-1,color:C.ink,marginVertical:14},unit:{fontFamily:F.sans,fontSize:15,letterSpacing:0,color:C.dim},note:{fontFamily:F.sans,fontSize:13,lineHeight:19,color:C.dim,marginVertical:5},pending:{fontSize:17,color:C.dim,marginVertical:20},delta:{fontFamily:F.sansMedium,fontWeight:'500',fontSize:14,lineHeight:20},comparison:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:12,marginVertical:8},controlTitle:{fontFamily:F.sansBold,fontWeight:'600',fontSize:17,lineHeight:23,color:C.ink,marginBottom:10},options:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{flexGrow:1,minHeight:46,paddingHorizontal:12,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:C.background,borderWidth:1,borderColor:C.rule},optionOn:{borderColor:C.ochre,backgroundColor:C.ochreSoft},optionText:{fontFamily:F.sansMedium,fontWeight:'500',fontSize:14,color:C.ink},skeleton:{height:42,width:'80%',borderRadius:8,backgroundColor:C.land},lossTrack:{height:12,borderRadius:6,overflow:'hidden',flexDirection:'row',marginTop:20},amount:{fontFamily:F.sansBold,fontWeight:'600',fontSize:16,color:C.ink},receipt:{paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.rule},receiptTitle:{flex:1,fontFamily:F.sansMedium,fontWeight:'500',fontSize:15,color:C.ink},error:{color:C.rust,fontSize:14,lineHeight:20,marginTop:12},review:{color:C.ink,fontSize:22,fontWeight:'600',lineHeight:28,marginVertical:12},
});
