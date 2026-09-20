import { Platform, type ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/lib/theme';

const icons = {
  home: { symbol: 'house', path: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9' },
  car: { symbol: 'car', path: 'm5 7 2-4h10l2 4M3 12l2-5h14l2 5v6H3v-6Zm2 6v3m14-3v3M6 12h2m8 0h2' },
  compare: { symbol: 'slider.horizontal.3', path: 'M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11M8 3v6m6 0v6m-8 0v6' },
  shield: { symbol: 'shield.lefthalf.filled', path: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6' },
  community: { symbol: 'person.2', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm9 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  help: { symbol: 'questionmark.circle', path: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9 8a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4v.01' },
  info: { symbol: 'info.circle', path: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6m0-10v.01' },
  chevron: { symbol: 'chevron.right', path: 'm9 5 7 7-7 7' },
  check: { symbol: 'checkmark', path: 'm5 12 4 4L19 6' },
  inventory: { symbol: 'shippingbox', path: 'm3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7 5l10 5' },
  drive: { symbol: 'speedometer', path: 'M4 19a10 10 0 1 1 16 0M12 5v2M5 10l2 1m12-1-2 1m-5 4 4-6M10 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z' },
  document: { symbol: 'doc.text', path: 'M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8m-8 4h8' },
  lock: { symbol: 'lock', path: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v12H5V10Zm7 5v3' },
} as const;

export type IconName = keyof typeof icons;
export function AppIcon({ name, size = 22, color = C.ochre }: { name: IconName; size?: number; color?: ColorValue }) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={icons[name].symbol} tintColor={color} weight="regular" resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={icons[name].path} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>;
}
