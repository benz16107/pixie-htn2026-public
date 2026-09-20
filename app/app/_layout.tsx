import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { CommunityProvider } from '@/lib/community-store';
import { InventoryProvider } from '@/lib/inventory-store';
import { QuoteProvider } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { initializeDriveSurfaces } from '@/lib/driving-surfaces';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// JS errors + tracing (docs/research/sentry.md item 5, and docs/SENTRY.md for what Expo Go can't
// do here: no native crash reporting and no mobileReplayIntegration, both need a compiled dev/EAS
// build; app.json's @sentry/react-native/expo plugin only runs its native step on that build too).
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
  environment: process.env.EXPO_PUBLIC_ATLAS_ENV || 'hackathon',
});

function RootLayout() {
  const reduced = useReducedMotion();
  useEffect(() => { void initializeDriveSurfaces(); }, []);
  useEffect(() => { void SplashScreen.hideAsync(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QuoteProvider>
    <InventoryProvider>
    <CommunityProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.background },
          headerShadowVisible: false,
          headerTintColor: C.ochre,
          headerTitleStyle: { fontFamily: F.sansBold, fontWeight: '600', fontSize: 17, color: C.ink },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: C.background },
          animation: reduced ? 'fade' : 'default',

        }}
      >
        <Stack.Screen name="(lifecycle)" options={{ title: 'Pixie', headerShown: false }} />
        <Stack.Screen name="home-quote" options={{ title: 'Tenant quote' }} />
        <Stack.Screen name="auto-compare" options={{ title: 'Compare vehicles' }} />
        <Stack.Screen name="coverage-lab" options={{ title: 'Explore your price' }} />
        <Stack.Screen name="home-inventory" options={{ title: 'Room inventory' }} />
        <Stack.Screen name="driving-context" options={{ title: 'Drive score' }} />
        <Stack.Screen name="road-help" options={{ title: 'Incident exchange' }} />
        <Stack.Screen name="recovery-plan" options={{ title: 'Recovery plan' }} />
        <Stack.Screen name="map" options={{ title: 'Your block' }} />
        <Stack.Screen name="questions/[step]" options={{ title: 'Your unit' }} />
        <Stack.Screen name="quote" options={{ title: 'Your quote' }} />
        <Stack.Screen name="about" options={{ title: 'About', headerRight: () => null }} />
      </Stack>
    </CommunityProvider>
    </InventoryProvider>
    </QuoteProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
