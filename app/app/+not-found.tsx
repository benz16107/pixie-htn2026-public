import { Link, Stack } from 'expo-router';
import { Body, Screen, Title } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Title>This screen does not exist</Title>
      <Link href="/" accessibilityRole="link" style={{ marginTop: 16 }}>
        <Body style={{ textDecorationLine: 'underline' }}>Start a quote</Body>
      </Link>
    </Screen>
  );
}
