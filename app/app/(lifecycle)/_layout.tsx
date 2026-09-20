import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { C, F } from '@/lib/theme';

export default function LifecycleLayout() {
  const inset = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.ochre, tabBarInactiveTintColor: C.dim, tabBarStyle: { backgroundColor: C.paper, borderTopColor: C.rule, elevation: 0, height: 60 + inset.bottom, paddingBottom: inset.bottom + 4, paddingTop: 4 }, tabBarLabelStyle: { fontFamily: F.sansMedium, fontWeight: '500', fontSize: 11, lineHeight: 14 }, tabBarItemStyle: { paddingVertical: 0 } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <AppIcon name="home" color={color} /> }} />
    <Tabs.Screen name="decide" options={{ title: 'Compare', tabBarIcon: ({ color }) => <AppIcon name="compare" color={color} /> }} />
    <Tabs.Screen name="protect" options={{ title: 'Insights', tabBarIcon: ({ color }) => <AppIcon name="shield" color={color} /> }} />
    <Tabs.Screen name="recover" options={{ title: 'Community', tabBarIcon: ({ color }) => <AppIcon name="community" color={color} /> }} />
  </Tabs>;
}
