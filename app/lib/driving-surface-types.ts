export type DriveSurfaceState = {
  zone: string;
  context: string;
  score: number | null;
  speedKmh: number;
  active: boolean;
};

export type DriveSurfaceResult = {
  widget: boolean;
  liveActivity: boolean;
  error: string | null;
};
