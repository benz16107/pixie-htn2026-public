import { useRef, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Panel, SectionLabel } from '@/components/consumer';
import { Body, Button, Kicker, Screen, Title } from '@/components/ui';
import { ROOMS, SAMPLE_ITEMS, contentsFromInventory, inventoryTotal, type Room } from '@/lib/inventory';
import { useInventory } from '@/lib/inventory-store';
import { keepPhoto, removePhoto } from '@/lib/inventory-storage';
import { useQuote } from '@/lib/store';
import { C, F, money } from '@/lib/theme';

export default function InventoryScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { items, save, ready, error: storageError } = useInventory();
  const { setAnswers, place, setProduct } = useQuote();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [room, setRoom] = useState<Room>('Living room');
  const [photo, setPhoto] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const total = inventoryTotal(items);
  const contents = contentsFromInventory(items);
  const roomTotals = ROOMS.map(room => ({room, total: inventoryTotal(items.filter(item => item.room === room))})).filter(row => row.total > 0);
  const reset = () => { setName(''); setValue(''); setPhoto(undefined); setEditing(undefined); };

  const pickPhoto = async (camera: boolean) => {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setError('Camera access is off. Choose a photo or add the item without one.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.45, allowsEditing: true, base64: Platform.OS === 'web' };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const asset = result.assets[0];
        if (Platform.OS === 'web' && (!asset.base64 || asset.base64.length > 2000000)) { setError('Choose a photo smaller than 1.5 MB for this browser preview.'); return; }
        setPhoto(Platform.OS === 'web' ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri);
      }
    } catch { setError('The photo could not be opened. You can still add an item without a photo.'); }
  };
  const add = async () => {
    setError(''); setMessage('');
    const amount = Number(value.replace(/,/g, ''));
    if (!name.trim() || !Number.isFinite(amount) || amount < 0.01 || amount > 100000) { setError('Enter an item name and a replacement value between $0.01 and $100,000.'); return; }
    setBusy(true);
    const id = editing ?? `item-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const old = items.find(item => item.id === id);
    let savedPhoto = photo;
    try {
      if (photo && photo !== old?.photo) savedPhoto = await keepPhoto(photo, id);
      const item = { id, name: name.trim(), room, value: Math.round(amount * 100) / 100, photo: savedPhoto };
      await save(editing ? items.map(current => current.id === editing ? item : current) : [...items, item]);
      if (old?.photo && old.photo !== savedPhoto) void removePhoto(old.photo).catch(() => {});
      reset(); setMessage('Saved on this device.');
    } catch { if (savedPhoto && savedPhoto !== old?.photo) void removePhoto(savedPhoto).catch(() => {}); setError('This item could not be saved. Free some device storage and try again.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError(''); setMessage('');
    try { const removed = items.find(item => item.id === id); await save(items.filter(item => item.id !== id)); void removePhoto(removed?.photo).catch(() => {}); if (editing === id) reset(); setMessage('Item removed from this device.'); } catch { setError('Could not remove the item. Please try again.'); } finally { setBusy(false); }
  };
  const seed = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await save([...items, ...SAMPLE_ITEMS.filter(sample => !items.some(item => item.id === sample.id))]); setMessage('Added four labelled examples. Edit or remove anything.'); } catch { setError('Could not save the examples on this device.'); } finally { setBusy(false); }
  };

  return <Screen scrollRef={scrollRef} footer={items.length ? <Button disabled={!contents || busy} label={contents ? `Use $${contents.toLocaleString()} in my estimate` : 'Inventory exceeds the online estimate limit'} onPress={() => { if (contents) { setProduct('home'); setAnswers({ contentsValue: contents }); router.push(place ? '/coverage-lab' : '/home-quote'); } }} /> : undefined}>
    <Title>Your belongings</Title>
    <Body style={st.lead}>Start with a photo. Add what it would cost to replace the item, and see your home total take shape.</Body>
    <Panel>
      <Kicker>Recorded replacement value</Kicker><Text style={st.total}>{money(total)}</Text>
      <Text style={st.note}>{items.length} {items.length === 1 ? 'item' : 'items'} across {roomTotals.length} {roomTotals.length === 1 ? 'room' : 'rooms'}</Text>
      {roomTotals.map(row => <View key={row.room} style={st.roomRow}><View style={st.roomLabel}><Text style={st.note}>{row.room}</Text><Text style={st.value}>{money(row.total)}</Text></View><View style={st.track}><View style={[st.fill, {width:`${row.total / total * 100}%`}]} /></View></View>)}
      <Text style={st.note}>Photos and values stay on this device. You identify and value each item; no automatic photo analysis runs.</Text>
    </Panel>
    <SectionLabel>{editing ? 'Edit your item' : 'Add a belonging'}</SectionLabel>
    <Panel>
      {photo ? <Image source={{uri:photo}} accessibilityLabel="Selected inventory photo" style={st.photo} /> : null}
      <View style={st.photoButtons}>{Platform.OS !== 'web' ? <Button kind="secondary" label="Take photo" onPress={() => pickPhoto(true)} disabled={busy} /> : null}<Button kind="secondary" label="Choose photo" onPress={() => pickPhoto(false)} disabled={busy} /></View>
      {photo ? <Button kind="link" label="Remove selected photo" onPress={() => setPhoto(undefined)} /> : null}
      <Text style={st.label}>Item name</Text><TextInput accessibilityLabel="Item name" value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Living room sofa" placeholderTextColor={C.dim} style={st.input} />
      <Text style={st.label}>Replacement value</Text><TextInput accessibilityLabel="Replacement value" value={value} onChangeText={setValue} maxLength={10} keyboardType="decimal-pad" placeholder="Amount in dollars" placeholderTextColor={C.dim} style={st.input} />
      <Text style={st.label}>Room</Text><View accessibilityRole="radiogroup" accessibilityLabel="Inventory room" style={st.rooms}>{ROOMS.map(r => <Pressable key={r} accessibilityRole="radio" aria-checked={room===r} accessibilityState={{checked: room===r}} onPress={() => setRoom(r)} style={[st.roomChoice, room===r && st.roomOn]}><Text style={[st.note, room===r && {color:C.ochre}]}>{r}</Text></Pressable>)}</View>
      <Button label={busy ? 'Saving…' : editing ? 'Save changes' : 'Save item'} onPress={add} disabled={busy || !ready || !!storageError} />
      {editing ? <Button kind="link" label="Cancel editing" onPress={reset} /> : null}
      {error || storageError ? <Text role="alert" style={st.error}>{error || storageError}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={st.success}>{message}</Text> : null}
    </Panel>
    {!items.some(item => item.example) ? <Button kind="link" label="Try a furnished-room example" disabled={busy || !ready || !!storageError} onPress={seed} /> : null}
    {items.length ? <><SectionLabel>Your inventory</SectionLabel>{items.map(item => <Panel key={item.id}><View style={st.itemRow}>{item.photo ? <Image source={{uri:item.photo}} style={st.thumbnail} accessibilityLabel={`Photo of ${item.name}`} /> : null}<View style={{flex:1}}><Text style={st.itemName}>{item.name}</Text><Text style={st.note}>{item.room}{item.example ? ' · Example' : ''}</Text><Text style={st.value}>{money(item.value)}</Text></View></View><View style={st.itemActions}><Button kind="link" label={`Edit ${item.name}`} disabled={busy} onPress={() => {setEditing(item.id);setName(item.name);setValue(String(item.value));setPhoto(item.photo);setRoom(item.room);setMessage('');scrollRef.current?.scrollTo({y:0,animated:true});}} /><Button kind="link" label={`Remove ${item.name}`} disabled={busy} onPress={() => remove(item.id)} /></View></Panel>)}<Body style={st.note}>{contents ? `The next $5,000 step is $${contents.toLocaleString()}, with a $10,000 minimum. This is a starting point based only on the items you recorded. Include the rest of your belongings before choosing coverage.` : 'Your recorded total is above the $100,000 online estimate limit. An advisor can help review the full inventory.'}</Body></> : null}
  </Screen>;
}
const st = StyleSheet.create({
  lead:{color:C.dim,marginTop:10,marginBottom:20},total:{fontFamily:F.sansBold,fontWeight:'600',fontSize:38,color:C.ink,marginVertical:10,letterSpacing:-1},
  note:{fontFamily:F.sans,fontSize:13,lineHeight:19,color:C.dim},roomRow:{marginVertical:8},roomLabel:{flexDirection:'row',justifyContent:'space-between',gap:8},track:{height:5,backgroundColor:C.land,borderRadius:3,marginTop:7,overflow:'hidden'},fill:{height:5,backgroundColor:C.ochre},
  value:{fontFamily:F.sansMedium,fontWeight:'500',fontSize:15,color:C.ink},label:{fontFamily:F.sansMedium,fontWeight:'500',fontSize:14,color:C.ink,marginTop:16,marginBottom:7},input:{minHeight:48,borderWidth:1,borderColor:C.rule,borderRadius:12,paddingHorizontal:12,fontFamily:F.sans,fontSize:17,color:C.ink},
  photo:{width:'100%',height:180,borderRadius:14,marginBottom:12},photoButtons:{flexDirection:'row',gap:10,flexWrap:'wrap'},rooms:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:20},roomChoice:{minHeight:44,paddingHorizontal:12,justifyContent:'center',borderRadius:12,backgroundColor:C.background},roomOn:{backgroundColor:C.ochreSoft,borderWidth:1,borderColor:C.ochre},
  error:{color:C.rust,fontSize:14,marginTop:12},success:{color:C.moss,fontSize:14,marginTop:12},itemRow:{flexDirection:'row',gap:12,alignItems:'center'},thumbnail:{height:64,width:64,borderRadius:10},itemName:{fontFamily:F.sansBold,fontWeight:'600',fontSize:17,color:C.ink},itemActions:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:8},
});
