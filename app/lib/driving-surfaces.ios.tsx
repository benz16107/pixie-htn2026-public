import { requireOptionalNativeModule } from 'expo-modules-core';
import type { DriveSurfaceResult, DriveSurfaceState } from './driving-surface-types';

export type { DriveSurfaceResult, DriveSurfaceState } from './driving-surface-types';

type Widgets = typeof import('./driving-widgets.ios');
let widgets: Widgets | null = null;
let lastState: DriveSurfaceState | null = null;

const unavailable: DriveSurfaceResult = {
  widget: false,
  liveActivity: false,
  error: 'Open the installed Pixie development build. Expo Go cannot display these widgets or Live Activities.',
};

function loadWidgets(): Widgets | null {
  if (!requireOptionalNativeModule('ExpoWidgets')) return null;
  widgets ??= require('./driving-widgets.ios') as Widgets;
  return widgets;
}

function widgetState(state: DriveSurfaceState): import('./driving-widgets.ios').DriveWidgetState {
  const { score, ...rest } = state;
  return score === null ? rest : { ...rest, score };
}

function failure(error: unknown, widget: boolean): DriveSurfaceResult {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    widget,
    liveActivity: false,
    error: `${widget ? 'The widget updated, but the Live Activity request failed. Check Live Activities in iPhone Settings for Pixie.' : 'The iPhone widget could not update. Reopen Pixie and retry.'} ${detail}`,
  };
}

export async function initializeDriveSurfaces(): Promise<DriveSurfaceResult> {
  try {
    const native = loadWidgets();
    if (!native) return unavailable;
    const timeline = await native.DriveWidget.getTimeline();
    if (!timeline.length && !lastState) {
      native.DriveWidget.updateSnapshot({
        zone: 'Ready for your next drive',
        context: 'Open Pixie to start a drive or try the Toronto sample.',
        speedKmh: 0,
        active: false,
      });
    }
    native.DriveWidget.reload();
    return { widget: true, liveActivity: false, error: null };
  } catch (error) {
    return failure(error, false);
  }
}

export async function syncDriveSurfaces(state: DriveSurfaceState): Promise<DriveSurfaceResult> {
  let widget = false;
  try {
    const native = loadWidgets();
    if (!native) return unavailable;
    lastState = state;
    native.DriveWidget.updateSnapshot(widgetState(state));
    widget = true;
    if (state.active) {
      const current = native.DriveActivity.getInstances()[0];
      if (current) await current.update(state);
      else native.DriveActivity.start(state, 'pixie://driving-context');
    }
    return { widget: true, liveActivity: state.active, error: null };
  } catch (error) {
    return failure(error, widget);
  }
}

export async function endDriveSurfaces(): Promise<DriveSurfaceResult> {
  let widget = false;
  try {
    const native = loadWidgets();
    if (!native) return unavailable;
    if (lastState) {
      lastState = { ...lastState, active: false, speedKmh: 0 };
      native.DriveWidget.updateSnapshot(widgetState(lastState));
    }
    widget = true;
    await Promise.all(native.DriveActivity.getInstances().map((activity) => activity.end('immediate')));
    return { widget: true, liveActivity: false, error: null };
  } catch (error) {
    return failure(error, widget);
  }
}
