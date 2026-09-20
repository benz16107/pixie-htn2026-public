import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, createWidget } from 'expo-widgets';

import type { DriveSurfaceState } from './driving-surface-types';

export type DriveWidgetState = Omit<DriveSurfaceState, 'score'> & { score?: number };

export const DriveWidget = createWidget<DriveWidgetState>('DriveContext', (state) => {
  'widget';
  return (
    <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#365C45')]}>Pixie Drive Score</Text>
      <Text modifiers={[font({ size: 19, weight: 'bold' })]}>{state.zone}</Text>
      <Text modifiers={[font({ size: 13 })]}>{state.context}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle('#63675E')]}>{state.score == null ? 'Waiting for a drive' : `${state.score ?? '—'} score · ${state.speedKmh} km/h`}</Text>
    </VStack>
  );
});

export const DriveActivity = createLiveActivity<DriveSurfaceState>('DriveContext', (state) => {
  'widget';
  const compact = <Text modifiers={[font({ size: 12, weight: 'bold' })]}>PX</Text>;
  return {
    banner: (
      <HStack spacing={8} modifiers={[padding({ all: 14 })]}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#365C45')]}>Drive score active</Text>
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{state.zone}</Text>
          <Text modifiers={[font({ size: 12 })]}>{state.context}</Text>
        </VStack>
        <Spacer />
        <Text modifiers={[font({ size: 11 })]}>{state.score ?? '—'} · {state.speedKmh} km/h</Text>
      </HStack>
    ),
    compactLeading: compact,
    compactTrailing: <Text modifiers={[font({ size: 11 })]}>{state.score ?? '—'}</Text>,
    minimal: compact,
    expandedCenter: <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{state.zone}: {state.score ?? '—'} score</Text>,
  };
});
