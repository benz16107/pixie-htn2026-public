import { C } from '@/lib/theme';
import { Button, Host, Text } from '@expo/ui/jetpack-compose';

export function DrivingNativeAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Host style={{ width: '100%', height: 52 }} seedColor={C.ochre}>
      <Button onClick={onPress} enabled={!disabled} colors={{ containerColor: C.ochre, contentColor: '#FFFFFF' }}>
        <Text>{label}</Text>
      </Button>
    </Host>
  );
}
