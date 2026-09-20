import { Button } from '@/components/ui';

export function DrivingNativeAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} disabled={disabled} />;
}
