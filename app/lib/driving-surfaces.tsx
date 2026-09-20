import type { DriveSurfaceResult, DriveSurfaceState } from './driving-surface-types';

export type { DriveSurfaceResult, DriveSurfaceState } from './driving-surface-types';

const unavailable: DriveSurfaceResult = { widget: false, liveActivity: false, error: null };

export async function initializeDriveSurfaces(): Promise<DriveSurfaceResult> {
  return unavailable;
}

export async function syncDriveSurfaces(_state: DriveSurfaceState): Promise<DriveSurfaceResult> {
  return unavailable;
}

export async function endDriveSurfaces(): Promise<DriveSurfaceResult> {
  return unavailable;
}
