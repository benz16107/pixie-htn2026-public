export interface DriveAssessment {
  assessmentId: string;
  coachingOnly: true;
  affectsQuote: false;
  affectsPremium: false;
  score: number;
  behaviorScore: number;
  routeContextScore: number;
  composite: { behaviorWeight: number; routeContextWeight: number; behaviorContribution: number; routeContextContribution: number; formula: string };
  band: 'steady' | 'watch' | 'focus';
  factors: Array<{ key: 'speeding' | 'hard_brake'; label: string; observed: number; ratePer100Km: number; effectPoints: number; source: string }>;
  routeFactors: Array<{ key: string; label: string; areaLabel: string; contextScore: number; meaning: string }>;
  tips: string[];
  routeContext: { labels: string[]; types: string[]; coarsePointsReceived: number; rawCoordinatesReturned: false; meaning: string };
  privacy: { stored: false; rawCoordinateRetention: 'none'; note: string };
  label: string;
}

export type DriveAssessmentResult = { assessment: DriveAssessment; source: 'shared-api' | 'bundled-demo' };

export type DriveSessionSummary = {
  score: number;
  behaviorScore: number;
  routeContextScore: number;
  band: DriveAssessment['band'];
  distanceKm: number;
  durationSeconds: number;
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  speedingEvents: number;
  hardBrakeEvents: number;
  area: string;
  updatedAt: number;
  source: DriveAssessmentResult['source'];
};

export type DriveAssessmentInput = {
  points?: Array<{ lat: number; lng: number }>;
  distanceKm?: number;
  speedingEvents?: number;
  hardBrakeEvents?: number;
};

const API = process.env.EXPO_PUBLIC_API_URL;
const SYNTHETIC_ROUTE = {
  points: [
    { lat: 43.639, lng: -79.443 },
    { lat: 43.642, lng: -79.408 },
    { lat: 43.650, lng: -79.381 },
  ],
  distanceKm: 9.4,
  speedingEvents: 0,
  hardBrakeEvents: 1,
};

const FALLBACK: DriveAssessment = {
  assessmentId: 'DRV-DEMO-TORONTO',
  coachingOnly: true,
  affectsQuote: false,
  affectsPremium: false,
  score: 87,
  behaviorScore: 91,
  routeContextScore: 73.33,
  composite: { behaviorWeight: 0.75, routeContextWeight: 0.25, behaviorContribution: 68.25, routeContextContribution: 18.33, formula: 'behaviorScore × 0.75 + routeContextScore × 0.25' },
  band: 'steady',
  factors: [
    { key: 'speeding', label: 'Speeding events', observed: 0, ratePer100Km: 0, effectPoints: 0, source: 'Bundled synthetic route' },
    { key: 'hard_brake', label: 'Hard-brake events', observed: 1, ratePer100Km: 10.64, effectPoints: -9, source: 'Bundled synthetic route and demo formula' },
  ],
  routeFactors: [
    { key: 'outside_demo_context', label: 'Outside bundled Toronto context examples', areaLabel: 'Unclassified coarse route area', contextScore: 80, meaning: 'No matching bundled context.' },
    { key: 'dense_intersection_demo', label: 'Dense intersection and building corridor', areaLabel: 'Downtown Toronto demo area', contextScore: 68, meaning: 'Higher attention demand in the synthetic route context.' },
    { key: 'school_approach_demo', label: 'School approach', areaLabel: 'Downtown Toronto demo area', contextScore: 72, meaning: 'Higher attention demand in the synthetic route context.' },
  ],
  tips: ['Leave more space before dense intersections.'],
  routeContext: { labels: ['Outside bundled Toronto context examples', 'Dense intersection and building corridor', 'School approach'], types: ['outside_demo_context', 'dense_intersection_building_corridor', 'school_approach'], coarsePointsReceived: 3, rawCoordinatesReturned: false, meaning: 'Route context measures exposure and attention demand.' },
  privacy: { stored: false, rawCoordinateRetention: 'none', note: 'Synthetic route only. Raw coordinates are not retained.' },
  label: 'Coaching only. This does not change a quote or premium.',
};

function valid(value: unknown): value is DriveAssessment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DriveAssessment>;
  return typeof item.assessmentId === 'string' && typeof item.score === 'number' && typeof item.behaviorScore === 'number' && typeof item.routeContextScore === 'number' && !!item.composite && Array.isArray(item.factors) && Array.isArray(item.routeFactors) && item.affectsPremium === false;
}

function fallbackAssessment(input: Required<DriveAssessmentInput>): DriveAssessment {
  const speedingPenalty = Math.min(35, input.speedingEvents * 8);
  const brakePenalty = Math.min(30, input.hardBrakeEvents * 7);
  const behaviorScore = Math.max(0, 100 - speedingPenalty - brakePenalty);
  const routeContextScore = FALLBACK.routeContextScore;
  const score = Math.round(behaviorScore * 0.75 + routeContextScore * 0.25);
  return {
    ...FALLBACK,
    assessmentId: `DRV-LOCAL-${Date.now().toString().slice(-6)}`,
    score,
    behaviorScore,
    band: score >= 85 ? 'steady' : score >= 65 ? 'watch' : 'focus',
    composite: {
      ...FALLBACK.composite,
      behaviorContribution: Number((behaviorScore * 0.75).toFixed(2)),
      routeContextContribution: Number((routeContextScore * 0.25).toFixed(2)),
    },
    factors: [
      { ...FALLBACK.factors[0], observed: input.speedingEvents, effectPoints: -speedingPenalty, source: 'Foreground GPS speed samples and bundled demo formula' },
      { ...FALLBACK.factors[1], observed: input.hardBrakeEvents, effectPoints: -brakePenalty, source: 'Foreground GPS speed changes and bundled demo formula' },
    ],
    label: 'Coaching preview from this foreground session. This does not change a quote or premium.',
  };
}

export async function assessDrive(input: DriveAssessmentInput = {}): Promise<DriveAssessmentResult> {
  const payload: Required<DriveAssessmentInput> = {
    points: input.points && input.points.length >= 2 ? input.points.slice(-50) : SYNTHETIC_ROUTE.points,
    distanceKm: Math.max(0.5, input.distanceKm ?? SYNTHETIC_ROUTE.distanceKm),
    speedingEvents: input.speedingEvents ?? SYNTHETIC_ROUTE.speedingEvents,
    hardBrakeEvents: input.hardBrakeEvents ?? SYNTHETIC_ROUTE.hardBrakeEvents,
  };
  if (API) {
    try {
      const response = await fetch(`${API}/driving/context`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (valid(payload)) return { assessment: payload, source: 'shared-api' };
      }
    } catch {}
  }
  return { assessment: fallbackAssessment(payload), source: 'bundled-demo' };
}
