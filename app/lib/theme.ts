import { Platform } from 'react-native';

export const C = {
  background: '#F4F2EC',
  land: '#E8E5DC',
  paper: '#FFFEFA',
  ink: '#242C27',
  dim: '#63675E',
  rule: '#DADDD2',
  water: '#CDDAD4',
  ochre: '#365C45',
  ochreSoft: '#E8EEE3',
  hex: '#597465',
  rust: '#B42318',
  moss: '#365C45',
  deep: '#283D31',
};

const system = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
export const F = { serif: system, sans: system, sansMedium: system, sansBold: system, mono, monoMedium: mono };
export const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
export const CONTENTS_MIN = 10000;
export const CONTENTS_MAX = 100000;
export const CONTENTS_STEP = 5000;
