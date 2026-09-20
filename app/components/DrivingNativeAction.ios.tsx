import { C } from '@/lib/theme';
import { Button, Host } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled as disabledModifier, tint } from '@expo/ui/swift-ui/modifiers';

export function DrivingNativeAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Host style={{ width: '100%', height: 52 }}>
      <Button
        label={label}
        onPress={onPress}
        modifiers={[buttonStyle('borderedProminent'), controlSize('large'), tint(C.ochre), disabledModifier(!!disabled)]}
      />
    </Host>
  );
}
